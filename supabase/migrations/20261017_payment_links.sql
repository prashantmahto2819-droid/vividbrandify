-- Payment links from the admin panel: any amount, GST invoice on payment.
-- The link lives on an ordinary order (product_slug = 'payment-link'), so invoices, emails and the GST register work unchanged.
alter table public.orders
  add column if not exists pay_link_id text,
  add column if not exists pay_link_url text,
  add column if not exists pay_link_expires_at timestamptz;
create index if not exists orders_pay_link_id_idx on public.orders (pay_link_id);
