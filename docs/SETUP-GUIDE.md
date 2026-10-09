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
