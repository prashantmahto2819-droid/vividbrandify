-- Vivid Brandify: Supabase database objects used by the website (reference copy).
-- These were applied to the VIVIDBRANDIFY project as migrations. Do not re-run blindly.

-- Tables
--   public.site_content (key text pk, value jsonb, updated_at)  -- every editable section of the site
--   public.leads (id, created_at, name, phone, email, business, service, message, source,
--                 status new|contacted|won|lost, notes, opt_in, last_message_at, follow_up_on)
--   public.admins (user_id -> auth.users, role admin|staff, active, created_at)
--   private.settings (k, v)  -- holds the one-time admin setup code
-- Storage bucket: media (public read, admin write)
-- Edge function: site-art (serves two slider illustrations)

-- Access rules (row level security)
--   site_content: anyone reads; admins insert/update
--   leads: anyone inserts (status 'new', no notes); admins and staff read/update; admins delete*
--   admins: members see their own row; admins see all
--   storage.objects (media): admins list/upload/update; delete*
--   * the delete rules are in docs/SETUP-GUIDE.md ("Turn on delete") and must be run once by hand.

-- Functions (rpc)
--   is_admin(), is_team_member(), my_role(), admin_setup_needed(), claim_first_admin(email, code)
--   add_team_member(email, role), set_team_member_access(user_id, role, active), list_team()
--   add_admin(email)  -- older name, adds a full admin

-- WhatsApp automation (BotCommerce webhook workflows), sent server-side with pg_net
--   private.automation (single row: webhook URLs, on/off switches, team numbers)
--   private.automation_log (every send, joined with net._http_response for status)
--   trigger leads_whatsapp_automation (after insert on leads): welcome to lead + alert to team
--   rpc: get_automation(), save_automation(jsonb), send_automation_sample(kind, phone),
--        send_offer_reminders(lead_ids, offer_slug)  -- opted-in leads only
--        automation_log(limit)

-- leads.business_type and leads.city (added with the "Business category" and "City" form fields).
-- Both are optional text up to 80 characters and are included in the automation payload
-- as business_type and city.
-- alter table public.leads add column if not exists business_type text not null default '' check (char_length(business_type) <= 80);
-- alter table public.leads add column if not exists city text not null default '' check (char_length(city) <= 80);

-- Store and GST (see docs/SETUP-GUIDE.md sections 6-8)
-- public.orders            one row per checkout (product, plan, customer, GST split, Razorpay ids, status)
-- public.order_payments    one row per successful charge, with invoice_no (prefix + financial year + number) and view_key for the invoice link
-- private.store_settings   Razorpay / Resend keys, GST details, email switches and wording (admin RPCs get_store_settings / save_store_settings)
-- private.razorpay_plans   cache of Razorpay plan ids per product/plan/amount
-- private.invoice_counter  invoice sequence per financial year
-- private.mail_log         every email the store function sends (admin RPC mail_log)
-- public.store_internal()  service-role only helper used by the edge function
-- trigger leads_email_automation -> edge function /store/lead-mail for enquiry emails
