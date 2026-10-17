-- Quotations: built in the admin panel, shared with the customer as a link (/q/<id>?k=<key>) they can print or accept.
-- Totals and the quote number are worked out in the database, so the shared page always matches what was saved.

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  quote_no text unique,
  lead_id uuid references public.leads(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined')),
  customer jsonb not null default '{}'::jsonb check (jsonb_typeof(customer) = 'object'),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 50),
  discount bigint not null default 0 check (discount >= 0),
  gst_mode text not null default 'add' check (gst_mode in ('add', 'included', 'none')),
  gst_rate numeric(5,2) not null default 0 check (gst_rate >= 0 and gst_rate <= 40),
  seller_state text not null default '',
  buyer_state text not null default '',
  subtotal bigint not null default 0,
  taxable bigint not null default 0,
  cgst bigint not null default 0,
  sgst bigint not null default 0,
  igst bigint not null default 0,
  total bigint not null default 0,
  valid_until date,
  notes text not null default '' check (char_length(notes) <= 2000),
  terms text not null default '' check (char_length(terms) <= 4000),
  view_key text not null default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid default auth.uid(),
  order_no text,
  accepted_at timestamptz
);
create index if not exists quotes_lead_idx on public.quotes (lead_id);
create index if not exists quotes_created_idx on public.quotes (created_at desc);

create table if not exists private.quote_counter (fy text primary key, n int not null default 0);

-- Totals from the line items (amounts in paise) and a number per financial year: QT/26-27/0001
create or replace function private.quote_before() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare
  d date := (now() at time zone 'Asia/Kolkata')::date;
  y int; v_fy text; k int; t numeric := 0; net bigint; r numeric; it jsonb; tax bigint;
begin
  for it in select * from jsonb_array_elements(new.items) loop
    t := t + round(coalesce(nullif(it->>'qty', '')::numeric, 0) * coalesce(nullif(it->>'rate', '')::numeric, 0));
  end loop;
  new.subtotal := t;
  net := greatest(t::bigint - new.discount, 0);
  if new.gst_mode = 'none' then new.gst_rate := 0; end if;
  r := new.gst_rate;
  if r = 0 then
    new.taxable := net; new.total := net;
  elsif new.gst_mode = 'included' then
    new.taxable := round(net * 100 / (100 + r)); new.total := net;
  else
    new.taxable := net; new.total := net + round(net * r / 100);
  end if;
  tax := new.total - new.taxable;
  if new.buyer_state = '' or new.buyer_state = new.seller_state then
    new.cgst := tax / 2; new.sgst := tax - tax / 2; new.igst := 0;
  else
    new.cgst := 0; new.sgst := 0; new.igst := tax;
  end if;
  new.updated_at := now();
  if tg_op = 'INSERT' and new.quote_no is null then
    y := extract(year from d)::int - case when extract(month from d) < 4 then 1 else 0 end;
    v_fy := lpad((y % 100)::text, 2, '0') || '-' || lpad(((y + 1) % 100)::text, 2, '0');
    insert into private.quote_counter as c (fy, n) values (v_fy, 1)
      on conflict (fy) do update set n = c.n + 1 returning c.n into k;
    new.quote_no := 'QT/' || v_fy || '/' || lpad(k::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists quotes_before on public.quotes;
create trigger quotes_before before insert or update on public.quotes
  for each row execute function private.quote_before();

-- Team members (admins and staff) work with quotes; only admins remove them.
alter table public.quotes enable row level security;
drop policy if exists quotes_team_read on public.quotes;
drop policy if exists quotes_team_insert on public.quotes;
drop policy if exists quotes_team_update on public.quotes;
drop policy if exists quotes_admin_remove on public.quotes;
create policy quotes_team_read on public.quotes for select to authenticated using (public.is_team_member());
create policy quotes_team_insert on public.quotes for insert to authenticated with check (public.is_team_member());
create policy quotes_team_update on public.quotes for update to authenticated using (public.is_team_member()) with check (public.is_team_member());
create policy quotes_admin_remove on public.quotes for delete to authenticated using (public.is_admin());
grant select, insert, update, delete on public.quotes to authenticated;

-- The customer's view: one quote, only with its secret key, plus the seller details printed on it.
create or replace function public.quote_public(p_id uuid, p_key text) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select jsonb_build_object(
    'id', q.id, 'quote_no', q.quote_no, 'created_at', q.created_at, 'status', q.status, 'customer', q.customer, 'items', q.items,
    'discount', q.discount, 'gst_mode', q.gst_mode, 'gst_rate', q.gst_rate, 'seller_state', q.seller_state, 'buyer_state', q.buyer_state,
    'subtotal', q.subtotal, 'taxable', q.taxable, 'cgst', q.cgst, 'sgst', q.sgst, 'igst', q.igst, 'total', q.total,
    'valid_until', q.valid_until, 'notes', q.notes, 'terms', q.terms, 'accepted_at', q.accepted_at,
    'seller', (select jsonb_build_object('name', s.value->>'seller_name', 'address', s.value->>'seller_address', 'gstin', s.value->>'seller_gstin', 'sac', s.value->>'sac_code')
               from private.store_settings s where s.id = 1))
  from public.quotes q
  where q.id = p_id and q.view_key = p_key and q.status <> 'draft';
$$;

-- The customer accepts online: the quote is marked accepted and the lead's timeline says so.
create or replace function public.quote_accept(p_id uuid, p_key text, p_name text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare q public.quotes;
begin
  select * into q from public.quotes where id = p_id and view_key = p_key and status <> 'draft';
  if q.id is null then return jsonb_build_object('ok', false, 'error', 'Quote not found.'); end if;
  if q.status = 'accepted' then return jsonb_build_object('ok', true, 'already', true); end if;
  if q.valid_until is not null and q.valid_until < (now() at time zone 'Asia/Kolkata')::date then
    return jsonb_build_object('ok', false, 'error', 'This quote has expired. Please ask us for a fresh one.');
  end if;
  update public.quotes set status = 'accepted', accepted_at = now() where id = q.id;
  if q.lead_id is not null then
    insert into public.lead_activity (lead_id, kind, detail)
      values (q.lead_id, 'note', left('Customer accepted quote ' || q.quote_no || ' online' || case when coalesce(p_name, '') <> '' then ' (' || left(p_name, 80) || ')' else '' end, 500));
    update public.leads set stage = 'negotiation' where id = q.lead_id and stage in ('new', 'contacted', 'qualified', 'proposal');
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.quote_public(uuid, text) from public;
revoke all on function public.quote_accept(uuid, text, text) from public;
grant execute on function public.quote_public(uuid, text) to anon, authenticated;
grant execute on function public.quote_accept(uuid, text, text) to anon, authenticated;
