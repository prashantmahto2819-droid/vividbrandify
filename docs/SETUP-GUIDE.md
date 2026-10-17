# Vivid Brandify: going live on Cloudflare + Supabase

**Supabase is already set up.** The VIVIDBRANDIFY project has the site content, the leads table, the admin accounts and an image bucket, and all the security rules are on. You only need the steps below.

---

## 1. Upload the site to Cloudflare (about 3 minutes)

1. Open **dash.cloudflare.com** and go to **Workers & Pages** in the left menu.
2. Click **Create** (or **Create application**), then **Pages**, then **Upload assets** ("Drag and drop your files").
3. Project name: `vividbrandify`, then click **Create project**.
4. Drag **`vividbrandify-site.zip`** into the upload box and click **Deploy site**.
5. You get an address like `https://vividbrandify.pages.dev`. Open it: the site should be live.

## 2. Connect your domain

1. In the same Pages project, open the **Custom domains** tab and click **Set up a custom domain**.
2. Type your domain (for example `vividbrandify.com`) and click **Continue**, then **Activate domain**.
3. Do the same for `www.vividbrandify.com`.

If Cloudflare says a DNS record already exists for that name, let it replace that record. That old record is what points to the previous site. SSL turns on by itself within a few minutes.

## 3. Tell Supabase your domain (so login emails link to your site)

In **supabase.com**, open the **VIVIDBRANDIFY** project and go to **Authentication → URL Configuration**:

- **Site URL**: `https://vividbrandify.com` (your domain)
- **Redirect URLs**: add `https://vividbrandify.com/admin/`

Save.

## 4. Create your admin account

1. Open `https://<your-domain>/admin/`.
2. Enter the **setup code**, your name, email and a password, then click **Create account**.
3. If Supabase asks you to confirm your email, open the email from Supabase, click the link, then come back to `/admin/` and sign in.

The setup code works only once. After the first admin exists, it is never accepted again.

## 5. Turn on delete (one SQL paste, optional but recommended)

This lets the admin panel delete leads and images and remove admins. In Supabase, open **SQL Editor → New query**, paste the SQL below and click **Run**:

```sql
create or replace function public.remove_admin(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Only admins can remove admins.'; end if;
  if p_user_id = auth.uid() then raise exception 'You can''t remove your own account.'; end if;
  delete from public.admins where user_id = p_user_id;
  return true;
end $$;
revoke execute on function public.remove_admin(uuid) from public, anon;
grant execute on function public.remove_admin(uuid) to authenticated;

create policy "admins delete leads" on public.leads
  for delete to authenticated using ((select public.is_admin()));
create policy "admins delete media" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and (select public.is_admin()));
```

---

## 6. Sell software online (Razorpay)

1. Admin → **Store → Products & plans**: add each app or software. Put one plan per line in **Plans and prices**:
   `Plan name | price | monthly, yearly or one-time | setup fee | note`
   e.g. `Starter | 999 | monthly | 2999 | 1 user, 5,000 messages`. Tick **Published** and save.
2. In Razorpay: **Account & Settings → API Keys** → generate a key (start with **Test mode**). Copy the Key ID and Key Secret.
3. Admin → **Store → Payments & email**: paste the Key ID and Key Secret, tick **Take payments on the website**, save.
4. Razorpay → **Account & Settings → Webhooks → Add new webhook**: paste the Webhook URL shown in the admin, type a secret, and tick
   `payment.captured, payment.failed, subscription.activated, subscription.charged, subscription.halted, subscription.cancelled, subscription.completed, refund.processed`.
   Paste the same secret into **Webhook secret** in the admin and save.
5. Monthly and yearly plans use Razorpay Subscriptions. If plan creation fails, ask Razorpay support to enable Subscriptions on your account.
6. Test a purchase with Razorpay's test cards or UPI, check it under **Store → Orders**, then switch to your **Live** keys.

## 7. GST billing

Admin → **Store → Payments & email → GST billing**:

- Tick **Charge GST**, set the rate (18% for most software/IT services) and choose whether your prices are **before GST** (GST added at checkout) or **including GST**.
- Enter your GSTIN, legal name, registered address, SAC code and invoice prefix. Confirm the rate and SAC code with your CA.
- Buyers pick their state at checkout (or it is read from their GSTIN). Same state as yours → CGST + SGST; other states → IGST.
- Every payment, including each monthly/yearly renewal, gets a numbered tax invoice (e.g. `VB/26-27/0001`), emailed to the buyer and linked in **Orders**.
- **Orders → GST register** downloads a month's invoices as CSV for your CA / GSTR-1.

## 8. Email automation (Resend)

1. Create a Resend account, add your domain (e.g. vividbrandify.com) and add the DNS records it shows in Cloudflare DNS. Wait until Resend shows it verified.
2. Resend → **API Keys → Create API key** (Sending access).
3. Admin → **Store → Payments & email**: paste the API key, set **Send from** (e.g. `Vivid Brandify <hello@vividbrandify.com>`), add team emails, tick the emails you want, save, then **Send test**.
4. Emails sent: auto-reply to every enquiry, new-enquiry alert to the team, receipt + GST invoice to buyers, new-order alert to the team. All appear under **Recent emails**.

## Updating the site later

- **Content** (slides, blog, reviews, widget, colours, SEO and so on): edit it in `/admin/`. Changes appear on the site within about 10 seconds.
- **Site files** (only when the code changes): in Cloudflare, open the Pages project and choose **Create deployment**, then upload the new zip. Your content and leads stay in Supabase and are not affected.

## WhatsApp widget code

Go to **Admin → WhatsApp → Chat widget**, choose **custom code**, paste your provider's `<script>` snippet and click **Save changes**. It goes onto every page.

## Good to know

- **Leads** from the contact form are saved in Supabase (table `leads`) and show up in **Admin → Leads**. You can export them as CSV.
- **More admins:** use **Admin → Account & backup → Add admin**. Supabase's free email service only sends emails to members of your Supabase team. If a new admin doesn't get the confirmation email, either set up your own email service under **Supabase → Authentication → SMTP Settings**, or confirm that account by hand in Supabase → Authentication → Users.
- **Uploaded images** are stored in the Supabase Storage bucket `media`.
- **If Supabase can't be reached**, the site still opens and loads its content in the visitor's browser.

## 9. Legal pages and GST details

Admin → Site → **Legal & GST** holds the business details from the GST certificate (trade name, legal name, GSTIN, registered address, grievance officer) and the four policies: Terms, Privacy, Refund and cancellation, Delivery. They appear at `/legal/terms`, `/legal/privacy`, `/legal/refunds`, `/legal/delivery` and `/legal/business`, in the footer of every page and as a note at checkout. Razorpay asks for these pages when it activates your account. Have your CA or lawyer read the policies once.

Invoices use the seller details under Store → **Payments & email** (GSTIN, legal business name, registered address, SAC code). Confirm the SAC code with your CA.

## 10. Payment links (any amount)

Admin → Orders → **+ Payment link**, or **₹ Request payment** on a lead, creates a Razorpay payment link for any amount: a website advance, a campaign fee, a custom package. Choose whether GST is added on top, already included, or not charged. Share the link on WhatsApp in one tap. When the customer pays, the order is marked paid, a numbered GST invoice is emailed, and a lead it came from moves to Won.

One-time setup (needs Supabase access):
1. Run `supabase/migrations/20261017_payment_links.sql` in the SQL editor (adds three columns to `orders`).
2. Deploy the updated `store` edge function (`supabase functions deploy store --no-verify-jwt`).
3. In Razorpay → Webhooks, also tick `payment_link.paid`, `payment_link.expired` and `payment_link.cancelled`.

## 11. Quotations

Admin → Sales → **Quotes**, or **Quote** on a lead, builds a quotation: line items, discount, GST added or included, validity and terms. **Save and share** gives a link (`/q/…`) to send on WhatsApp. The customer can view it, download it as PDF and **accept it online**; acceptance is recorded on the lead's timeline. From a quote you can create a payment link for the full amount or an advance (50% or 30%). Quotes sent 3+ days ago without an answer appear on the Today screen.

One-time setup (needs Supabase access): run `supabase/migrations/20261017_quotes.sql` in the SQL editor. The quote page itself is part of the website and goes live with the next deploy.
