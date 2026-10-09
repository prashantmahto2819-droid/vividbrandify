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

## Editing content

Content isn't stored in this repository. Slides, services, offers, blog posts and settings are edited in the admin panel and saved in Supabase, so they change instantly without a deploy. Only code changes go through this repository.
