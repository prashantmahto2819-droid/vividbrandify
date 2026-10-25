# Vivid Brandify website

Marketing website with an admin panel, festival offer pages, blog, leads CRM and a WhatsApp chat widget.

- **Hosting:** Cloudflare Pages (serves the repository root; `docs/`, `supabase/` and this README are blocked by `_worker.js`)
- **Database, logins and images:** Supabase project `VIVIDBRANDIFY`
- **Admin panel:** `https://<your-domain>/admin/`

## Connect Cloudflare to this repository (one time)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick this repository and click **Begin setup**.
3. Fill in the build settings:
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Build command:** leave empty
   - **Build output directory:** leave empty
4. Click **Save and Deploy**.
5. Open the new project → **Custom domains** → add your domain. If the domain is attached to the old Pages project that you uploaded by hand, remove it there first.

From then on, every change pushed to `main` goes live automatically within about a minute.

## What's in the repository

| Path | What it is |
|---|---|
| `index.html` | Page template for the public site |
| `_worker.js` | Runs on Cloudflare: fills each page with content and SEO tags from Supabase |
| `assets/` | Site styles, script, Supabase connection (`config.js`) |
| `admin/` | Admin panel (content editor, offers, leads, messaging, team) |
| `supabase/schema-notes.sql` | Notes on the database tables, access rules and functions |
| `docs/SETUP-GUIDE.md` | First-time setup, domain, and the "Turn on delete" SQL |
| `assets/apps.json` | Our apps (Vividora, BizCRT, Vivid Relay, Drishti): plans and per-app legal text, until edited in Admin → Store → Our apps |
| `docs/CODEBASE-SUMMARY.md` | **Complete codebase summary and changelog.** Start here. |

## WhatsApp automation (BotCommerce)

Admin → **WhatsApp → Automation** connects BotCommerce webhook workflows:

- **Welcome message** to every new lead from the website
- **New-lead alert** to the team's WhatsApp numbers
- **Offer reminders** to opted-in leads, sent from Leads → Message leads

For each one: create an approved template and a Webhook Workflow in BotCommerce, paste the Webhook Callback URL, save, click **Send sample**, then **Capture Webhook Response** in BotCommerce and map `phone` and the template variables. The webhook URLs are stored in Supabase and never reach the browser.

## Store, GST and email

- Products are edited in Admin → Store → Products & plans and sold on `/product/<slug>` pages.
- `supabase/functions/store/index.ts` is the Supabase edge function `store`: Razorpay checkout, payment verification, webhooks, GST invoices (`/invoice`) and Resend emails. Deploy it with `verify_jwt` off; it checks Razorpay signatures and admin tokens itself.
- Keys (Razorpay, Resend) are entered in Admin → Store → Payments & email and stored in `private.store_settings`; they never reach the browser.
- Orders live in `public.orders`, each charge in `public.order_payments` with its invoice number.

## Editing content

Content isn't stored in this repository. Slides, services, offers, blog posts and settings are edited in the admin panel and saved in Supabase, so they change instantly without a deploy. Only code changes go through this repository.
