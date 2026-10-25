# Vivid Brandify website: codebase summary

> **What this file is for:** one place to understand the whole website and admin panel without reading every file again. Share this link at the start of a new chat and work can continue from here.
> **Rule:** every change to the code adds a line to the [Changelog](#13-changelog) at the bottom, and updates the section it touches (routes, tables, files, settings).
>
> Repository: `prashantmahto2819-droid/vividbrandify` (branch `main`) · Last updated: 2026-10-25

---

## 1. What it is

The public website and the admin panel of **Vivid Brandify** (trade name of Vrish Bhanu, sole proprietorship, GSTIN 22CPKPB5753E1Z7, Dipka, Korba, Chhattisgarh): a digital marketing agency that also builds and sells its own software.

- **Website:** services, hero slider, our apps (Vividora, BizCRT, Vivid Relay, Drishti), software store with Razorpay checkout, festival offers, work, reviews, blog, FAQ, enquiry form, legal pages.
- **Admin panel (`/admin`):** edit every section of the site, plus a small CRM: Today, leads pipeline, quotations, payment links, orders and GST invoices, projects, renewals, WhatsApp automation, team (admin and staff).
- **No build step.** Plain HTML, CSS and JavaScript. Pushing to `main` deploys.

## 2. Architecture

```
Browser ──► Cloudflare Pages (_worker.js)
              ├─ "/" "/blog/x" "/offer/x" "/product/x" "/bizcrt" "/apps/x" "/legal/x"
              │     → reads site_content from Supabase, fills SEO tags + window.__SITE__, returns index.html
              ├─ "/q/<id>?k=<key>"  → quotation page (rpc quote_public), printable
              ├─ "/sitemap.xml" "/robots.txt"
              └─ everything else → static file (assets/*, admin/*)
Browser JS ──► Supabase (publishable key, row-level security)
              ├─ REST: site_content, leads (insert), BizCRT plans (read)
              └─ Edge function "store": Razorpay checkout/verify/webhook, payment links, invoices, emails (Resend)
Admin JS ───► Supabase auth (email + password) → REST + RPC as admin or staff
```

- **Hosting:** Cloudflare Pages, advanced mode (`_worker.js` at the repository root), auto-deploy from GitHub `main`.
- **Database:** Supabase project `twyrrvncbpzmgzkyhdei` (Postgres, Auth, Storage bucket `media`, Edge Functions). The same project also hosts BizCRT's tables (`crm_*`, `plans`, `plan_modules`, `plan_addons`); **do not change BizCRT tables from this repository.**
- **If Supabase is down:** the worker falls back to the static `index.html`, and `assets/content.js` loads content in the browser.

## 3. File map

| Path | What it does |
| --- | --- |
| `index.html` | Page template. Placeholders `<!--SEO-->`, `<!--THEME-->`, `<!--HEAD_CODE-->`, `<!--DATA-->`, `<!--NOSCRIPT-->`, `<!--BODY_END-->` are filled by the worker. Holds the home sections and the empty view containers (`offerView`, `productView`, `bizView`, `appView`, `legalView`, `articleView`). |
| `_worker.js` | Cloudflare worker: server-side render, SEO and JSON-LD, sitemap, robots, quotation page, app list loading. |
| `assets/site.js` | All public-site behaviour: hero slider, live visuals, sections, our apps, store and checkout, offers, BizCRT page, app pages, legal pages, chat widget, enquiry forms, in-page routing. |
| `assets/site.css` | Public-site styles and brand tokens (light and dark). |
| `assets/content.js` | Browser fallback loader for content (same shape as the worker's `publicContent`). |
| `assets/config.js` | Supabase URL and publishable key (`window.VB_SUPABASE`). |
| `assets/apps.json` | **Default list of our apps** with plans, FAQ and per-app legal text. Used until the list is saved once in the admin. |
| `assets/brand/` | Logo (`logo.png`), favicon, apple-touch icon, OG image. |
| `assets/legal/gst-registration-certificate.pdf` | GST certificate linked from `/legal/business`. |
| `admin/index.html`, `admin/admin.css` | Admin shell and styles. |
| `admin/admin.js` | Admin app: navigation, content editors, Today, dashboard, leads, quotes, payment links, orders, projects, renewals, automation, team, media, backup. |
| `admin/schema.js` | Content schema: every editable section, its fields and validation (drives the admin forms). |
| `admin/supabase-api.js` | Admin data layer: one `api("METHOD resource/id", body)` switch over Supabase REST/RPC. |
| `supabase/functions/store/index.ts` | Edge function `store` (Deno). |
| `supabase/migrations/*.sql` | Migrations added since 2026-10-17 (payment links, quotes, projects and renewals). |
| `supabase/schema-notes.sql` | Reference notes for the older database objects (tables, policies, RPCs, triggers). |
| `docs/SETUP-GUIDE.md` | Owner's setup guide (Cloudflare, domain, admin account, Razorpay, GST, email, legal, payment links, quotations, projects). |
| `docs/CODEBASE-SUMMARY.md` | This file. |

## 4. Public routes

| URL | Rendered by | Notes |
| --- | --- | --- |
| `/` | worker + `vbStart()` | Home. Section order and visibility come from `site_content.sections`. |
| `/#<section>` | browser | `services`, `apps`, `bizcrt`, `store`, `work`, `process`, `reviews`, `blog`, `faq`, `contact`. |
| `/blog/<slug>` | worker + `showPost` | Published posts only. |
| `/offer/<slug>` | worker + `showOffer` | Festival offer page with countdown and enquiry form. |
| `/product/<slug>` | worker + `showProduct` | Store product: plans, Razorpay checkout, GST maths. |
| `/bizcrt` | worker + `showBiz` | BizCRT page; plans, modules and add-ons read live from BizCRT tables. |
| `/apps/<slug>` | worker + `showApp` | App page (Vividora, Vivid Relay, Drishti...). `/apps/bizcrt` redirects to `/bizcrt`. |
| `/legal/terms` `privacy` `refunds` `delivery` `business` | worker + `showLegal` | Policies from `site_content.legal`, plus a per-app "Our software products" block (`#app-<slug>` anchors). |
| `/q/<uuid>?k=<key>` | worker `quotePage` | Customer's quotation: print, accept. Not indexed. |
| `/sitemap.xml`, `/robots.txt` | worker | Sitemap includes posts, products, live offers, apps, legal pages. |
| `/admin/` | static | Admin panel. |

In-page navigation uses `history.pushState`; links carry `data-post`, `data-offer`, `data-product`, `data-biz`, `data-app`, `data-legal`, `data-sec`, `data-jump`.

## 5. Content model (`public.site_content`, key → JSON)

Objects: `settings`, `theme`, `seo`, `widget`, `code`, `bizcrt`, `legal`.
Lists: `sections`, `slides`, `services`, `steps`, `testimonials`, `posts`, `faqs`, `offers`, `products`, `work`, `apps`.

- Fields of every key are defined in `admin/schema.js` (`SCHEMA`), and cleaned by `sanitize()` before saving.
- Public filtering happens in `publicContent()` (worker) and `toPublic()` (content.js): only active slides, published posts, offers, products and apps, active work; legal only when `published`.
- **`apps`**: if the key does not exist yet, the site uses `assets/apps.json`. Saving the list once in Admin → Store → Our apps stores it in the database, and from then on the database copy wins.

### Our apps (`apps` list) fields
`published, showOnHome, showInSlider, name, slug, category, status (Live | Early access | Coming soon), mark, color, logo, screenshot, visual (vividora | bizcrt | relay | drishti | software), tagline, summary, features, whoFor, plans, priceNote, product, ctaLabel, ctaUrl, page, url, faqs, slideTitle, slideText, policyUrl, legalTerms, legalPrivacy, legalRefunds, legalDelivery`

- `plans`: one per line, `Name | price | period | note | popular`. Price `0` = free; words like `On request` are shown as written.
- `product`: slug of a store product; its plans then get a Buy button that opens Razorpay checkout. Without it, plan buttons open the enquiry form with the plan filled in (the team then sends a payment link from the admin).
- `page`: send links elsewhere (BizCRT uses `/bizcrt`).
- The four `legal*` fields appear on the matching legal page under "Our software products".

| App | What | Plans in apps.json | Status |
| --- | --- | --- | --- |
| Vividora | AI video studio (self-hosted; repo `vividora`) | Self-hosted free · Studio setup ₹9,999 one-time · Managed on request | Live |
| BizCRT | Official WhatsApp Cloud API CRM (bizcrt.com; repo `bizcrm`) | Live from BizCRT `plans` table | Live |
| Vivid Relay | WhatsApp Web gateway, hosted or self-hosted with licence (relay.vividbrandify.com; repo `wa-gateway`) | Trial 7 days · Starter ₹499 · Growth ₹1,299 · Business ₹2,999 per 30 days | Live |
| Drishti | Staff monitoring and remote access, self-hosted (Go agent, Fastify, Postgres, MinIO, MeshCentral) | Office setup and per-computer licence, on request | Early access |

## 6. Database (beyond `site_content`)

| Table / object | Purpose |
| --- | --- |
| `leads` | Enquiries. Pipeline fields: `stage`, `priority`, `score`, `owner_id`, `deal_value`, `next_action`, `follow_up_on`, `tags`, `opt_in`, `business_type`, `city`. Classified on insert by `private.lead_classify()`. |
| `lead_activity` | Lead timeline (notes, calls, WhatsApp, stage changes...). |
| `admins` | Team: `role` admin or staff, `active`. RPCs `is_admin()`, `is_team_member()`, `my_role()`, `add_team_member`, `set_team_member_access`, `list_team`. |
| `orders`, `order_payments` | Store orders and each successful charge with GST split and `invoice_no`. Payment links are orders with `product_slug = 'payment-link'` and `pay_link_id/url/expires_at`. |
| `quotes` (+ `private.quote_counter`) | Quotations `QT/26-27/0001`. RPCs `quote_public(id,key)`, `quote_accept(id,key)`. |
| `projects` | Work after a deal: status todo/doing/review/done/hold, tasks JSON, due date, value. |
| `renewals` | Domain, hosting, AMC, software, SSL, ads renewals with cycle and amount. |
| `private.store_settings` | Razorpay and Resend keys, GST settings, email wording (admin RPCs only). |
| `private.automation`, `automation_log` | WhatsApp automation via BotCommerce webhooks (pg_net). Opted-in leads only. |
| `private.crm_settings` | Round-robin assignment and pipeline settings. |
| Storage `media` | Uploaded images (public read, admin write). |

Row-level security everywhere: the public can read `site_content` and insert `leads`; team members read and edit work data; only admins delete and change settings.

## 7. Edge function `store` (`/functions/v1/store/...`, verify_jwt off, checks auth itself)

| Route | Use |
| --- | --- |
| `GET /status` | Is the store on, test mode, GST rate and seller state (shown at checkout). |
| `POST /checkout` | Creates a Razorpay order (one-time) or subscription (monthly/yearly) for a product plan. Prices come from `site_content.products`, never from the browser. |
| `POST /verify` | Verifies the Razorpay signature, records the payment, issues the GST invoice, sends emails. |
| `POST /webhook` | Razorpay webhooks (payments, subscriptions, `payment_link.paid/expired/cancelled`). |
| `GET /invoice` | Printable GST tax invoice by `view_key`. |
| `POST /pay-link`, `/pay-link/cancel` | Admin: create or cancel a payment link for any amount. |
| `POST /lead-mail`, `/test-mail` | Enquiry emails via Resend; test email from the admin. |

Secrets live in `private.store_settings` (set from Admin → Sales → Payments & email), never in the code.

## 8. Admin panel

Navigation (admin): Today · Dashboard · Content (slides, offers, services, steps, testimonials, posts, faqs) · Sales (quotes, orders, payments & email) · Work (projects, renewals) · Store (our apps, BizCRT page, products & plans) · Layout (sections) · WhatsApp (chat widget, leads, automation) · Site (settings, legal & GST, theme, SEO) · Advanced (code, media, account & backup).
Staff see only Today, Dashboard, Leads, Quotes, Projects, Renewals, Orders and their account.

- Content editors are generated from `SCHEMA`; save writes `site_content` through `saveRows`.
- Today: replies due, follow-ups, unpaid links, quiet deals, project work, renewals.
- Quotes → payment link → order → invoice; accepted quote or won lead → "Start project".

## 9. Front-end building blocks (`assets/site.js`)

- `vbStart()` boots from `window.__SITE__`. Order: `renderChrome`, `renderHero`, `renderSections`, `renderOffers`, `renderStore`, `renderBizSpotlight`, `renderApps`, `renderWidget`, then the view for the URL.
- `visual(kind, item)`: drawn previews for slides and cards: `chat`, `voice`, `software`, `video`, `website`, `crm`, `growth`, `image`, `apps` (four app tiles), `app:<slug>` (Vividora pipeline, Relay campaign, Drishti office grid, BizCRT app).
- Hero slider: tabs with a progress line as the timer; pauses on mouse hover and keyboard focus; the site adds an "Our apps" slide as slide 2 unless a slide already uses the `apps` visual; apps with `showInSlider` add their own slide.
- When the Our apps section is visible and includes BizCRT, the separate BizCRT spotlight is hidden (the BizCRT tab covers it); hide the apps section to bring the spotlight back.
- `mdLite()`: `## heading`, `- bullet`, `**bold**`, `[text](link)`; a heading may sit directly above its text.
- Design tokens: Bricolage Grotesque (display) and Figtree (body); flame orange accent; each app has its own colour in `--app`.
- The page is shown after fonts load (max 700 ms) to avoid layout shift.

## 10. Payments and legal (Razorpay readiness)

- Footer and checkout link to Terms, Privacy, Refund and cancellation, Delivery, and Business and GST details.
- Every legal page names the business, GSTIN and the four apps; each app has its own terms, privacy, refund and delivery section.
- Business page lists "Our products" (all apps) for the payment gateway's website review.
- To sell an app plan online with Razorpay: create a product in Store → Products & plans with the same plans, then put its slug in the app's "Store product" field.

## 11. Local test harness (not in the repository)

Kept in the session scratch folder `/tmp/claude-0/sbm`; rebuild if missing.
- `mock.mjs` (mock Supabase on :3400, seeded from `seed9.sql`), `pages.mjs` (runs `_worker.js` with a local ASSETS on :3500, `ROOT=<repo>`), `fresh.sh` (restart the mock), `seedleads.py`, `fontroute.py` (serves Google Fonts locally).
- Playwright scripts: `e2e`, `forms2`, `store`, `cls`, `admin_audit`, `staff`, `today`, `quote_ui`, `paylink_ui`, `pipe`, `work_ui`, `apps_shot`, `apps_admin`.

## 12. Rules and open items

- Never mention the AI assistant on the site. Never put secrets in code or chat; keys go in the admin or Supabase.
- Message only opted-in leads.
- Do not touch BizCRT tables, functions or auth from this repository (BizCRT uses its own `crm_` objects).
- Owner to do: Razorpay keys and webhook events (`payment_link.paid`, `payment_link.expired`, `payment_link.cancelled`); Resend key; confirm SAC codes with the CA; lawyer review of policies; real reviews; domain move.
- Vividora's own site names Jharkhand courts; Vivid Brandify's terms name Korba, Chhattisgarh. Pick one.
- Drishti pricing is "on request" until prices are decided.

## 13. Changelog

| Date | Change |
| --- | --- |
| 2026-10-09 | First version: site, admin, festival offers, leads messaging, staff role; Cloudflare root deploy; BotCommerce WhatsApp automation; torch-logo rebrand; enquiry categories and city; admin dashboard; software store with Razorpay; GST invoices. |
| 2026-10-10 | Leads pipeline (stages, score, owner, activity); Our work section; phone action bar. |
| 2026-10-11 | BizCRT page and spotlight; design pass (tabbed slider, layered visuals, service illustrations, live CRM board); legal pages and GST details. |
| 2026-10-17 | Today screen; payment links for any amount; quotations with customer link and accept. |
| 2026-10-18 | Projects board and renewals tracker. |
| 2026-10-25 | **Our apps**: Vividora, BizCRT, Vivid Relay, Drishti. Home "Our apps" tabs, "Our apps" slide, app pages `/apps/<slug>` with plans, FAQ and enquiry, footer links, enquiry options, sitemap and JSON-LD. Per-app terms, privacy, refunds and delivery on the legal pages; products listed on the business page. Admin → Store → Our apps editor (defaults from `assets/apps.json`). `mdLite` now renders a heading placed directly above its paragraph. This summary file added. |
