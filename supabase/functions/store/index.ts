// Vivid Brandify store + email automation.
// Routes (all under /functions/v1/store):
//   GET  /status      public: is the store taking payments?
//   POST /checkout    public: start a Razorpay order (one-time) or subscription (monthly/yearly, optional setup fee)
//   POST /verify      public: confirm a payment from Razorpay Checkout (signature checked with the key secret)
//   POST /webhook     Razorpay webhooks (signature checked with the webhook secret): captures, renewals, cancellations
//   POST /lead-mail   internal (database trigger): auto-reply to a new enquiry and alert the team
//   POST /test-mail   admin only: send a test email
// Keys live in private.store_settings and are read with the service role; they are never sent to browsers.

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const RZP = "https://api.razorpay.com/v1";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type Cfg = Record<string, any>;
type Plan = { name: string; price: number; billing: "one-time" | "monthly" | "yearly"; setup: number; note: string };

class HttpError extends Error { status: number; constructor(status: number, msg: string) { super(msg); this.status = status; } }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/* ---------- database (service role) ---------- */
async function db(path: string, init: RequestInit & { prefer?: string } = {}) {
  const r = await fetch(SB_URL + path, {
    ...init,
    headers: { apikey: SB_SERVICE, Authorization: "Bearer " + SB_SERVICE, "Content-Type": "application/json", ...(init.prefer ? { Prefer: init.prefer } : {}), ...(init.headers || {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error("db " + r.status + ": " + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}
const internal = (action: string, p: unknown = {}) => db("/rest/v1/rpc/store_internal", { method: "POST", body: JSON.stringify({ p_action: action, p }) });
async function content(key: string) {
  const rows = await db("/rest/v1/site_content?select=value&key=eq." + encodeURIComponent(key));
  return rows && rows[0] ? rows[0].value : null;
}
async function orderBy(col: string, val: string) {
  const rows = await db("/rest/v1/orders?select=*&limit=1&" + col + "=eq." + encodeURIComponent(val));
  return rows && rows[0] ? rows[0] : null;
}
const patchOrder = (id: string, patch: Record<string, unknown>) =>
  db("/rest/v1/orders?id=eq." + id, { method: "PATCH", body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }), prefer: "return=representation" }).then(r => r[0]);

/* ---------- helpers ---------- */
export function parsePlans(text: string): Plan[] {
  return String(text || "").split("\n").map(l => l.trim()).filter(Boolean).map(l => {
    const [name = "", price = "", billing = "", setup = "", note = ""] = l.split("|").map(x => x.trim());
    const num = (s: string) => { const n = Number(String(s).replace(/[^\d.]/g, "")); return Number.isFinite(n) ? n : 0; };
    const b = billing.toLowerCase();
    const bill = /year|annual|yr/.test(b) ? "yearly" : /month|mo\b|pm/.test(b) ? "monthly" : "one-time";
    return { name: name || "Standard", price: num(price), billing: bill as Plan["billing"], setup: num(setup), note };
  }).filter(p => p.price > 0 || p.setup > 0);
}
const paise = (rupees: number) => Math.round(rupees * 100);
const rupees = (p: number) => "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
function orderNo() {
  const d = new Date(), ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(3))).map(b => b.toString(36).padStart(2, "0")).join("").toUpperCase().slice(0, 5);
  return "VB-" + ymd + "-" + rnd;
}
async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const fill = (t: string, v: Record<string, string>) => String(t || "").replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));

async function razorpay(cfg: Cfg, path: string, body: unknown) {
  const r = await fetch(RZP + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa(cfg.razorpay_key_id + ":" + cfg.razorpay_key_secret) },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, "Payment gateway error: " + ((j.error && j.error.description) || r.status));
  return j;
}
const storeReady = (c: Cfg) => !!(c && c.store_on && /^rzp_(test|live)_/.test(c.razorpay_key_id || "") && c.razorpay_key_secret);
const mailReady = (c: Cfg) => !!(c && c.resend_api_key && /@/.test(c.mail_from || ""));

/* ---------- email ---------- */
async function siteInfo() {
  const [settings, seo] = await Promise.all([content("settings"), content("seo")]);
  const st = settings || {}, url = String((seo && seo.siteUrl) || "https://vividbrandify.pages.dev").replace(/\/$/, "");
  return { brand: st.brand || "Vivid Brandify", url, phone: st.phone || "", whatsapp: st.whatsapp || "", email: st.email || "", motto: st.logoSub || "" };
}
function emailHtml(site: Awaited<ReturnType<typeof siteInfo>>, title: string, body: string, rows: [string, string][] = [], button?: [string, string]) {
  const paras = esc(body).split(/\n{2,}/).map(p => '<p style="margin:0 0 14px;line-height:1.6">' + p.replace(/\n/g, "<br>") + "</p>").join("");
  const table = rows.length ? '<table role="presentation" style="width:100%;border-collapse:collapse;margin:8px 0 18px;font-size:14px">' + rows.map(([k, v]) => '<tr><td style="padding:8px 0;color:#6B5A5C;border-top:1px solid #EADFDA;width:40%">' + esc(k) + '</td><td style="padding:8px 0;border-top:1px solid #EADFDA;font-weight:600">' + esc(v) + "</td></tr>").join("") + "</table>" : "";
  const btn = button ? '<p style="margin:6px 0 18px"><a href="' + esc(button[1]) + '" style="display:inline-block;background:#F7941D;color:#1C0F04;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">' + esc(button[0]) + "</a></p>" : "";
  return '<!doctype html><html><body style="margin:0;background:#FBF7F4;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#241517">' +
    '<table role="presentation" width="100%" style="background:#FBF7F4;padding:24px 12px"><tr><td align="center">' +
    '<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #EADFDA">' +
    '<tr><td style="padding:20px 24px;border-bottom:3px solid #F7941D"><img src="' + esc(site.url) + '/assets/brand/logo.png" alt="' + esc(site.brand) + '" height="48" style="display:block;height:48px"></td></tr>' +
    '<tr><td style="padding:24px"><h1 style="font-size:20px;margin:0 0 16px">' + esc(title) + "</h1>" + paras + table + btn + "</td></tr>" +
    '<tr><td style="padding:16px 24px;background:#24100F;color:#D8BFB4;font-size:12.5px;line-height:1.6">' + esc(site.brand) + (site.motto ? " · " + esc(site.motto) : "") + "<br>" +
    [site.phone && "Call " + esc(site.phone), site.email && esc(site.email), '<a href="' + esc(site.url) + '" style="color:#F9A440">' + esc(site.url.replace(/^https?:\/\//, "")) + "</a>"].filter(Boolean).join(" · ") +
    "</td></tr></table></td></tr></table></body></html>";
}
async function sendMail(cfg: Cfg, kind: string, to: string[], subject: string, html: string, text: string, replyTo?: string) {
  const list = to.map(x => x.trim()).filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)).slice(0, 10);
  if (!list.length) return { ok: false, error: "no valid recipient" };
  let ok = false, error = "";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + cfg.resend_api_key, "Content-Type": "application/json" },
      body: JSON.stringify({ from: cfg.mail_from, to: list, subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    ok = r.ok;
    if (!ok) { const j = await r.json().catch(() => ({})); error = (j && (j.message || j.name)) || "HTTP " + r.status; }
  } catch (e) { error = String((e as Error).message || e); }
  await internal("mail_log", { kind, recipient: list.join(", "), subject, ok, error }).catch(() => {});
  return { ok, error };
}
const teamList = (cfg: Cfg) => String(cfg.team_emails || "").split(/[,;\s]+/).filter(Boolean);

async function orderEmails(cfg: Cfg, o: any) {
  if (!mailReady(cfg) || o.emailed) return;
  const site = await siteInfo();
  const vars = { name: (o.customer_name || "").split(" ")[0] || "there", brand: site.brand, product: o.product_name, plan: o.plan_name, amount: rupees(o.amount_paid), order_no: o.order_no, site: site.url, whatsapp: site.whatsapp ? "+" + String(site.whatsapp).replace(/\D/g, "") : "" };
  const billingLine = o.billing === "one-time" ? "One-time payment" : (o.billing === "monthly" ? "Monthly plan" : "Yearly plan") + ", renews automatically";
  const rows: [string, string][] = [["Order", o.order_no], ["Product", o.product_name + (o.plan_name ? " – " + o.plan_name : "")], ["Billing", billingLine], ["Amount paid", rupees(o.amount_paid)], ["Payment ID", o.rzp_payment_id || "–"]];
  if (cfg.mail_order_on && o.email) {
    const subject = fill(cfg.order_subject || "Payment received: {product} ({order_no})", vars);
    const body = fill(cfg.order_body || "Hi {name},\n\nThank you for your purchase. We've received your payment and our team will contact you within one working day to get you set up.\n\nKeep this email as your receipt.", vars);
    await sendMail(cfg, "order_receipt", [o.email], subject, emailHtml(site, "Thank you for your order", body, rows), body + "\n\n" + rows.map(r => r.join(": ")).join("\n"), site.email || undefined);
  }
  if (cfg.mail_order_alert_on && teamList(cfg).length) {
    const subject = "New order " + o.order_no + ": " + o.product_name + " (" + rupees(o.amount_paid) + ")";
    const body = o.customer_name + " just paid for " + o.product_name + ".\n\nPhone: " + (o.phone || "–") + "\nEmail: " + (o.email || "–") + "\nBusiness: " + (o.business || "–") + (o.gstin ? "\nGSTIN: " + o.gstin : "") + (o.city ? "\nCity: " + o.city : "");
    await sendMail(cfg, "order_alert", teamList(cfg), subject, emailHtml(site, "New order received", body, rows, ["Open admin panel", site.url + "/admin/"]), body, o.email || undefined);
  }
  await patchOrder(o.id, { emailed: true }).catch(() => {});
}

/* ---------- payments ---------- */
async function markPaid(cfg: Cfg, o: any, paymentId: string, amount: number) {
  if (o.status === "paid" || o.status === "active") {
    if (paymentId && o.rzp_payment_id !== paymentId && o.billing !== "one-time") {
      // a renewal charge on an existing subscription
      return patchOrder(o.id, { rzp_payment_id: paymentId, payments: (o.payments || 0) + 1, amount_paid: (o.amount_paid || 0) + amount, last_payment_at: new Date().toISOString(), status: "active" });
    }
    return o;
  }
  const upd = await patchOrder(o.id, {
    status: o.billing === "one-time" ? "paid" : "active", rzp_payment_id: paymentId, payments: 1,
    amount_paid: amount || o.price + o.setup_fee, last_payment_at: new Date().toISOString(),
  });
  // add the buyer to Leads as a won customer, so follow-ups and WhatsApp messages work for them too
  if (!upd.lead_id) {
    try {
      const lead = await db("/rest/v1/leads", { method: "POST", prefer: "return=representation", body: JSON.stringify({
        name: upd.customer_name || "Customer", phone: upd.phone, email: upd.email, business: upd.business, city: upd.city,
        service: ("Purchase: " + upd.product_name + (upd.plan_name ? " – " + upd.plan_name : "")).slice(0, 120),
        message: "Order " + upd.order_no + " · " + rupees(upd.amount_paid), source: "/product/" + upd.product_slug, status: "new", notes: "",
      }) });
      if (lead && lead[0]) {
        await db("/rest/v1/leads?id=eq." + lead[0].id, { method: "PATCH", body: JSON.stringify({ status: "won", notes: "Paid online · " + upd.order_no }) });
        await patchOrder(upd.id, { lead_id: lead[0].id });
      }
    } catch (_) { /* the order is what matters */ }
  }
  await orderEmails(cfg, await orderBy("id", upd.id));
  return upd;
}

async function checkout(req: Request, cfg: Cfg) {
  if (!storeReady(cfg)) throw new HttpError(503, "Online payments are not switched on yet. Please send an enquiry instead.");
  const b = await req.json().catch(() => ({}));
  const products = (await content("products")) || [];
  const p = products.find((x: any) => x.published && x.slug === b.product);
  if (!p) throw new HttpError(404, "This product is no longer available.");
  const plans = parsePlans(p.plans);
  const plan = plans[Number(b.plan)];
  if (!plan) throw new HttpError(400, "Please choose a plan.");
  const c = b.customer || {};
  const cust = { name: clean(c.name, 120), email: clean(c.email, 160).toLowerCase(), phone: clean(c.phone, 30), business: clean(c.business, 160), gstin: clean(c.gstin, 20).toUpperCase(), city: clean(c.city, 80) };
  if (!cust.name) throw new HttpError(400, "Please add your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cust.email)) throw new HttpError(400, "Please add a valid email for your receipt.");
  if (cust.phone.replace(/\D/g, "").length < 10) throw new HttpError(400, "Please add a valid phone number.");
  // a simple brake against scripted abuse
  const recent = await db("/rest/v1/orders?select=id&created_at=gte." + encodeURIComponent(new Date(Date.now() - 60_000).toISOString()));
  if (recent.length >= 20) throw new HttpError(429, "Too many checkouts right now. Please try again in a minute.");

  const price = paise(plan.price), setup = paise(plan.setup), no = orderNo();
  const desc = p.name + (plans.length > 1 || plan.name !== "Standard" ? " – " + plan.name : "");
  const notes = { order_no: no, product: p.slug, plan: plan.name };
  const row = (await db("/rest/v1/orders", { method: "POST", prefer: "return=representation", body: JSON.stringify({
    order_no: no, product_slug: p.slug, product_name: clean(p.name, 160), plan_name: clean(plan.name, 80), billing: plan.billing, price, setup_fee: setup,
    customer_name: cust.name, email: cust.email, phone: cust.phone, business: cust.business, gstin: cust.gstin, city: cust.city,
  }) }))[0];

  const base = { key: cfg.razorpay_key_id, order_no: no, name: (await siteInfo()).brand, description: desc.slice(0, 250), prefill: { name: cust.name, email: cust.email, contact: cust.phone }, notes };
  if (plan.billing === "one-time") {
    const o = await razorpay(cfg, "/orders", { amount: price + setup, currency: "INR", receipt: no, notes });
    await patchOrder(row.id, { rzp_order_id: o.id });
    return { ...base, mode: "order", order_id: o.id, amount: price + setup, currency: "INR" };
  }
  const period = plan.billing;
  const pkey = cfg.razorpay_key_id.slice(0, 9) + ":" + period + ":" + price + ":" + p.slug + ":" + plan.name;
  let planId = (await internal("plan_get", { key: pkey }))?.plan_id;
  if (!planId) {
    const rp = await razorpay(cfg, "/plans", { period, interval: 1, item: { name: desc.slice(0, 100), amount: price, currency: "INR" }, notes: { product: p.slug, plan: plan.name } });
    planId = rp.id;
    await internal("plan_put", { key: pkey, plan_id: planId });
  }
  const sub = await razorpay(cfg, "/subscriptions", {
    plan_id: planId, total_count: period === "monthly" ? 60 : 10, quantity: 1, customer_notify: 1, notes,
    ...(setup ? { addons: [{ item: { name: "One-time setup fee", amount: setup, currency: "INR" } }] } : {}),
  });
  await patchOrder(row.id, { rzp_subscription_id: sub.id });
  return { ...base, mode: "subscription", subscription_id: sub.id, amount: price + setup, currency: "INR" };
}

async function verify(req: Request, cfg: Cfg) {
  const b = await req.json().catch(() => ({}));
  const o = await orderBy("order_no", clean(b.order_no, 40));
  if (!o) throw new HttpError(404, "Order not found.");
  const pay = clean(b.razorpay_payment_id, 60), sig = clean(b.razorpay_signature, 200);
  const msg = o.billing === "one-time" ? o.rzp_order_id + "|" + pay : pay + "|" + o.rzp_subscription_id;
  const good = !!pay && safeEqual(await hmacHex(cfg.razorpay_key_secret || "", msg), sig);
  if (!good) throw new HttpError(400, "We couldn't confirm this payment. If money was deducted, please contact us with your order number " + o.order_no + ".");
  const upd = await markPaid(cfg, o, pay, o.price + o.setup_fee);
  return { ok: true, order_no: upd.order_no, status: upd.status };
}

async function webhook(req: Request, cfg: Cfg) {
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") || "";
  if (!cfg.razorpay_webhook_secret || !safeEqual(await hmacHex(cfg.razorpay_webhook_secret, raw), sig)) throw new HttpError(401, "bad signature");
  const ev = JSON.parse(raw), e = ev.event as string, P = ev.payload || {};
  const pay = P.payment && P.payment.entity, sub = P.subscription && P.subscription.entity;
  if (e === "payment.captured" && pay && pay.order_id && !pay.invoice_id) {
    const o = await orderBy("rzp_order_id", pay.order_id);
    if (o) await markPaid(cfg, o, pay.id, pay.amount);
  } else if ((e === "subscription.charged" || e === "subscription.activated") && sub) {
    const o = await orderBy("rzp_subscription_id", sub.id);
    if (o) {
      if (e === "subscription.charged" && pay) await markPaid(cfg, o, pay.id, pay.amount);
      const fresh = await orderBy("id", o.id);
      await patchOrder(o.id, { status: fresh.status === "created" ? "active" : fresh.status, next_charge_at: sub.charge_at ? new Date(sub.charge_at * 1000).toISOString() : null });
    }
  } else if (sub && /^subscription\.(halted|cancelled|completed|paused)$/.test(e)) {
    const o = await orderBy("rzp_subscription_id", sub.id);
    if (o) await patchOrder(o.id, { status: e === "subscription.paused" ? "halted" : e.split(".")[1] });
  } else if (e === "payment.failed" && pay) {
    const o = pay.order_id ? await orderBy("rzp_order_id", pay.order_id) : null;
    if (o && o.status === "created") await patchOrder(o.id, { status: "failed" });
  } else if (e === "refund.processed" && P.refund && P.refund.entity) {
    const o = await orderBy("rzp_payment_id", P.refund.entity.payment_id);
    if (o) await patchOrder(o.id, { status: "refunded" });
  }
  return { ok: true };
}

/* ---------- enquiry emails ---------- */
async function leadMail(req: Request, cfg: Cfg) {
  if (!safeEqual(req.headers.get("x-internal-secret") || "", cfg.internal_secret || "")) throw new HttpError(401, "unauthorised");
  if (!mailReady(cfg)) return { skipped: "mail not set up" };
  const { lead_id } = await req.json().catch(() => ({}));
  const rows = await db("/rest/v1/leads?select=*&id=eq." + encodeURIComponent(String(lead_id || "")));
  const l = rows && rows[0];
  if (!l || String(l.source || "").startsWith("/product/")) return { skipped: true }; // buyers get the order emails instead
  const site = await siteInfo();
  const vars = { name: String(l.name || "").split(" ")[0] || "there", brand: site.brand, service: l.service || "our services", site: site.url, whatsapp: site.whatsapp ? "+" + String(site.whatsapp).replace(/\D/g, "") : "", phone: site.phone };
  const rowsT: [string, string][] = [["Name", l.name], ["Phone", l.phone || "–"], ["Email", l.email || "–"], ["Business", [l.business, l.business_type].filter(Boolean).join(" · ") || "–"], ["City", l.city || "–"], ["Interested in", l.service || "–"], ["Message", l.message || "–"]];
  const out: Record<string, unknown> = {};
  if (cfg.mail_lead_reply_on && l.email) {
    const subject = fill(cfg.lead_reply_subject || "Thanks for contacting {brand}", vars);
    const body = fill(cfg.lead_reply_body || "Hi {name},\n\nThanks for your enquiry about {service}. Our team will get back to you within one working day.\n\nIf it's urgent, message us on WhatsApp at {whatsapp}.", vars);
    out.reply = await sendMail(cfg, "lead_reply", [l.email], subject, emailHtml(site, "We've received your enquiry", body, [], [ "Visit our website", site.url ]), body, site.email || undefined);
  }
  if (cfg.mail_lead_alert_on && teamList(cfg).length) {
    const subject = "New enquiry: " + l.name + " – " + (l.service || "website");
    out.alert = await sendMail(cfg, "lead_alert", teamList(cfg), subject, emailHtml(site, "New enquiry from your website", "A new enquiry just arrived. Reply quickly: leads contacted within the hour convert far better.", rowsT, ["Open leads", site.url + "/admin/"]), rowsT.map(r => r.join(": ")).join("\n"), l.email || undefined);
  }
  return out;
}

async function testMail(req: Request, cfg: Cfg) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const r = await fetch(SB_URL + "/rest/v1/rpc/is_admin", { method: "POST", headers: { apikey: SB_ANON || SB_SERVICE, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: "{}" });
  if (!r.ok || (await r.json()) !== true) throw new HttpError(403, "Only admins can send test emails.");
  if (!mailReady(cfg)) throw new HttpError(400, "Add your Resend API key and a 'send from' address first, then save.");
  const { to } = await req.json().catch(() => ({}));
  const site = await siteInfo();
  const res = await sendMail(cfg, "test", [String(to || "")], "Test email from " + site.brand, emailHtml(site, "Email is working", "This is a test from your website's email automation. Enquiry replies, team alerts and payment receipts will look like this."), "Email is working.");
  if (!res.ok) throw new HttpError(502, "Resend said: " + res.error);
  return { ok: true };
}

/* ---------- router ---------- */
export async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const route = new URL(req.url).pathname.replace(/^.*\/store/, "") || "/";
  try {
    const cfg: Cfg = (await internal("config")) || {};
    if (route === "/status" && req.method === "GET") return json({ store: storeReady(cfg), test: /^rzp_test_/.test(cfg.razorpay_key_id || ""), gst_note: cfg.gst_note || "" });
    if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
    if (route === "/checkout") return json(await checkout(req, cfg));
    if (route === "/verify") return json(await verify(req, cfg));
    if (route === "/webhook") return json(await webhook(req, cfg));
    if (route === "/lead-mail") return json(await leadMail(req, cfg));
    if (route === "/test-mail") return json(await testMail(req, cfg));
    throw new HttpError(404, "Not found");
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(e);
    return json({ error: status === 500 ? "Something went wrong. Please try again or contact us." : (e as Error).message }, status);
  }
}

Deno.serve(handle);
