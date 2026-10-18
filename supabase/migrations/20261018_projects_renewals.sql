-- Projects (work after a deal is won) and renewals (domain, hosting, AMC, plans that come round again).
-- Both are team data: admins and staff read and edit them; only admins remove them.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 160),
  lead_id uuid references public.leads(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  client jsonb not null default '{}'::jsonb check (jsonb_typeof(client) = 'object'),
  service text not null default '' check (char_length(service) <= 160),
  status text not null default 'todo' check (status in ('todo', 'doing', 'review', 'done', 'hold')),
  owner_id uuid,
  start_on date,
  due_on date,
  value bigint not null default 0 check (value >= 0),
  tasks jsonb not null default '[]'::jsonb check (jsonb_typeof(tasks) = 'array' and jsonb_array_length(tasks) <= 60),
  notes text not null default '' check (char_length(notes) <= 4000),
  done_at timestamptz,
  created_by uuid default auth.uid()
);
create index if not exists projects_status_idx on public.projects (status);
create index if not exists projects_lead_idx on public.projects (lead_id);

create table if not exists public.renewals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client jsonb not null default '{}'::jsonb check (jsonb_typeof(client) = 'object'),
  lead_id uuid references public.leads(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  kind text not null default 'domain' check (kind in ('domain', 'hosting', 'amc', 'software', 'ssl', 'ads', 'other')),
  label text not null default '' check (char_length(label) <= 160),
  renew_on date not null,
  cycle text not null default 'yearly' check (cycle in ('monthly', 'quarterly', 'yearly', 'once')),
  amount bigint not null default 0 check (amount >= 0),
  cost bigint not null default 0 check (cost >= 0),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  last_renewed_on date,
  notes text not null default '' check (char_length(notes) <= 1000),
  created_by uuid default auth.uid()
);
create index if not exists renewals_due_idx on public.renewals (renew_on) where status = 'active';

-- updated_at, and done_at when a project is marked done
create or replace function private.touch_work() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if tg_table_name = 'projects' then
    if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then new.done_at := now(); end if;
    if new.status <> 'done' then new.done_at := null; end if;
  end if;
  return new;
end $$;
create trigger projects_touch before insert or update on public.projects for each row execute function private.touch_work();
create trigger renewals_touch before insert or update on public.renewals for each row execute function private.touch_work();

alter table public.projects enable row level security;
alter table public.renewals enable row level security;
create policy projects_team_read on public.projects for select to authenticated using (public.is_team_member());
create policy projects_team_insert on public.projects for insert to authenticated with check (public.is_team_member());
create policy projects_team_update on public.projects for update to authenticated using (public.is_team_member()) with check (public.is_team_member());
create policy projects_admin_remove on public.projects for delete to authenticated using (public.is_admin());
create policy renewals_team_read on public.renewals for select to authenticated using (public.is_team_member());
create policy renewals_team_insert on public.renewals for insert to authenticated with check (public.is_team_member());
create policy renewals_team_update on public.renewals for update to authenticated using (public.is_team_member()) with check (public.is_team_member());
create policy renewals_admin_remove on public.renewals for delete to authenticated using (public.is_admin());
grant select, insert, update, delete on public.projects, public.renewals to authenticated;
