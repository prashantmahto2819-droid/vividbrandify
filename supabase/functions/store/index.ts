// Vivid Brandify store + email automation.
// Routes (all under /functions/v1/store):
//   GET  /status      public: is the store taking payments?
//   POST /checkout    public: start a Razorpay order (one-time) or subscription (monthly/yearly, optional setup fee)
//   POST /verify      public: confirm a payment from Razorpay Checkout (signature checked with the key secret)
//   POST /webhook     Razorpay webhooks (signature checked with the webhook secret): captures, renewals, cancellations
//   POST /lead-mail   internal (database trigger): auto-reply to a new enquiry and alert the team
//   POST /test-mail   admin only: send a test email
//   POST /pay-link    team only: a Razorpay payment link for any amount (custom work, advances), GST invoice on payment
//   POST /pay-link/cancel  team only: cancel an unpaid link
//   GET  /invoice     GST tax invoice for one payment (?id=<payment id>&k=<view key>), printable
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
/* ---------- GST ---------- */
export const STATES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
  "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
  "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra",
  "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
};
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const gstOn = (c: Cfg) => !!(c.gst_on && Number(c.gst_rate) > 0 && GSTIN_RE.test(c.seller_gstin || ""));
// Splits an amount (paise) into taxable value and GST. "Inclusive" prices already contain GST; otherwise GST is added on top.
export function gstOf(amount: number, rate: number, inclusive: boolean, sameState: boolean) {
  if (!rate) return { taxable: amount, tax: 0, cgst: 0, sgst: 0, igst: 0, total: amount };
  const taxable = inclusive ? Math.round(amount * 100 / (100 + rate)) : amount;
  const total = inclusive ? amount : amount + Math.round(amount * rate / 100);
  const tax = total - taxable;
  const cgst = sameState ? Math.floor(tax / 2) : 0, sgst = sameState ? tax - cgst : 0, igst = sameState ? 0 : tax;
  return { taxable, tax, cgst, sgst, igst, total };
}
export function inWords(paiseAmt: number) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n: number) => n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  const three = (n: number) => (n >= 100 ? ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " : "") : "") + (n % 100 ? two(n % 100) : "");
  const words = (n: number) => {
    if (!n) return "Zero";
    const parts: string[] = [];
    const crore = Math.floor(n / 1e7); n %= 1e7; const lakh = Math.floor(n / 1e5); n %= 1e5; const th = Math.floor(n / 1000); n %= 1000;
    if (crore) parts.push(words(crore) + " Crore"); if (lakh) parts.push(two(lakh) + " Lakh"); if (th) parts.push(two(th) + " Thousand"); if (n) parts.push(three(n));
    return parts.join(" ");
  };
  const r = Math.floor(paiseAmt / 100), p = paiseAmt % 100;
  return "Rupees " + words(r) + (p ? " and " + two(p) + " Paise" : "") + " Only";
}

const keysReady = (c: Cfg) => !!(c && /^rzp_(test|live)_/.test(c.razorpay_key_id || "") && c.razorpay_key_secret);
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

const invoiceUrl = (pay: any) => SB_URL + "/functions/v1/store/invoice?id=" + pay.id + "&k=" + pay.view_key;
function taxRows(pay: any): [string, string][] {
  if (!pay || !Number(pay.gst_rate)) return [];
  const r = Number(pay.gst_rate);
  return [["Taxable value", rupees(pay.taxable)]].concat(pay.igst ? [["IGST " + r + "%", rupees(pay.igst)]] : [["CGST " + r / 2 + "%", rupees(pay.cgst)], ["SGST " + r / 2 + "%", rupees(pay.sgst)]]) as [string, string][];
}
// Receipt for a renewal charge (the first payment is covered by orderEmails)
async function receipt(cfg: Cfg, o: any, pay: any, renewal: boolean) {
  if (!mailReady(cfg) || !cfg.mail_order_on || !o.email || !renewal) return;
  const site = await siteInfo();
  const rows: [string, string][] = ([["Invoice", pay.invoice_no], ["Order", o.order_no], ["Product", o.product_name + (o.plan_name ? " – " + o.plan_name : "")], ["Renewal", o.billing === "monthly" ? "Monthly" : "Yearly"]] as [string, string][]).concat(taxRows(pay), [["Amount paid", rupees(pay.amount)]]);
  const body = "Hi " + ((o.customer_name || "").split(" ")[0] || "there") + ",\n\nYour " + o.product_name + " plan has renewed and we've received your payment. Your invoice is below.";
  await sendMail(cfg, "renewal_receipt", [o.email], "Payment received: " + o.product_name + " renewal (" + pay.invoice_no + ")", emailHtml(site, "Your plan has renewed", body, rows, ["Download invoice", invoiceUrl(pay)]), body + "\n\n" + rows.map(r => r.join(": ")).join("\n") + "\nInvoice: " + invoiceUrl(pay), site.email || undefined);
}
async function orderEmails(cfg: Cfg, o: any) {
  if (!mailReady(cfg) || o.emailed) return;
  const site = await siteInfo();
  const pays = await db("/rest/v1/order_payments?select=*&order_id=eq." + o.id + "&kind=eq.first&limit=1");
  const pay = pays && pays[0];
  const vars = { name: (o.customer_name || "").split(" ")[0] || "there", brand: site.brand, product: o.product_name, plan: o.plan_name, amount: rupees(o.amount_paid), order_no: o.order_no, site: site.url, whatsapp: site.whatsapp ? "+" + String(site.whatsapp).replace(/\D/g, "") : "" };
  const billingLine = o.billing === "one-time" ? "One-time payment" : (o.billing === "monthly" ? "Monthly plan" : "Yearly plan") + ", renews automatically";
  const rows: [string, string][] = ((pay ? [["Invoice", pay.invoice_no]] : []) as [string, string][]).concat([["Order", o.order_no], ["Product", o.product_name + (o.plan_name ? " – " + o.plan_name : "")], ["Billing", billingLine]], taxRows(pay), [["Amount paid", rupees(o.amount_paid)], ["Payment ID", o.rzp_payment_id || "–"]]);
  if (cfg.mail_order_on && o.email) {
    const subject = fill(cfg.order_subject || "Payment received: {product} ({order_no})", vars);
    const body = fill(cfg.order_body || "Hi {name},\n\nThank you for your purchase. We've received your payment and our team will contact you within one working day to get you set up.\n\nKeep this email as your receipt.", vars);
    await sendMail(cfg, "order_receipt", [o.email], subject, emailHtml(site, "Thank you for your order", body, rows, pay ? ["Download GST invoice", invoiceUrl(pay)] : undefined), body + "\n\n" + rows.map(r => r.join(": ")).join("\n") + (pay ? "\nInvoice: " + invoiceUrl(pay) : ""), site.email || undefined);
  }
  if (cfg.mail_order_alert_on && teamList(cfg).length) {
    const subject = "New order " + o.order_no + ": " + o.product_name + " (" + rupees(o.amount_paid) + ")";
    const body = o.customer_name + " just paid for " + o.product_name + ".\n\nPhone: " + (o.phone || "–") + "\nEmail: " + (o.email || "–") + "\nBusiness: " + (o.business || "–") + (o.gstin ? "\nGSTIN: " + o.gstin : "") + (o.city ? "\nCity: " + o.city : "");
    await sendMail(cfg, "order_alert", teamList(cfg), subject, emailHtml(site, "New order received", body, rows, ["Open admin panel", site.url + "/admin/"]), body, o.email || undefined);
  }
  await patchOrder(o.id, { emailed: true }).catch(() => {});
}

/* ---------- payments ---------- */
// Records one successful charge with its own GST invoice number (idempotent per Razorpay payment id).
async function recordPayment(cfg: Cfg, o: any, paymentId: string, amount: number, kind: "first" | "renewal") {
  const have = await db("/rest/v1/order_payments?select=*&rzp_payment_id=eq." + encodeURIComponent(paymentId));
  if (have && have[0]) return { pay: have[0], fresh: false };
  const g = gstOf(amount, Number(o.gst_rate) || 0, true, o.seller_state && o.seller_state === o.buyer_state);
  const n = await internal("invoice_no");
  const invoiceNo = (cfg.invoice_prefix || "VB/") + n.fy + "/" + String(n.n).padStart(4, "0");
  const rows = await db("/rest/v1/order_payments", { method: "POST", prefer: "return=representation", body: JSON.stringify({
    order_id: o.id, kind, rzp_payment_id: paymentId, amount, taxable: g.taxable, cgst: g.cgst, sgst: g.sgst, igst: g.igst, gst_rate: Number(o.gst_rate) || 0, invoice_no: invoiceNo,
  }) });
  return { pay: rows[0], fresh: true };
}
async function markPaid(cfg: Cfg, o: any, paymentId: string, amount: number) {
  if (o.status === "paid" || o.status === "active") {
    if (paymentId && o.rzp_payment_id !== paymentId && o.billing !== "one-time") {
      // a renewal charge on an existing subscription
      const { pay, fresh } = await recordPayment(cfg, o, paymentId, amount, "renewal");
      if (!fresh) return o;
      const upd = await patchOrder(o.id, { rzp_payment_id: paymentId, payments: (o.payments || 0) + 1, amount_paid: (o.amount_paid || 0) + amount, last_payment_at: new Date().toISOString(), status: "active" });
      await receipt(cfg, upd, pay, true).catch(() => {});
      return upd;
    }
    return o;
  }
  const paidAmt = amount || o.total_amount || o.price + o.setup_fee;
  await recordPayment(cfg, o, paymentId, paidAmt, "first");
  const upd = await patchOrder(o.id, {
    status: o.billing === "one-time" ? "paid" : "active", rzp_payment_id: paymentId, payments: 1,
    amount_paid: paidAmt, last_payment_at: new Date().toISOString(),
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
  // a payment link sent to an existing lead: the deal is won
  if (upd.lead_id && upd.product_slug === "payment-link") {
    try {
      await db("/rest/v1/leads?id=eq." + upd.lead_id, { method: "PATCH", body: JSON.stringify({ stage: "won" }) });
      await db("/rest/v1/lead_activity", { method: "POST", body: JSON.stringify({ lead_id: upd.lead_id, kind: "note", detail: ("Paid " + rupees(upd.amount_paid) + " online for " + upd.product_name + " (" + upd.order_no + ")").slice(0, 500) }) });
    } catch (_) { /* the payment is what matters */ }
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
  const cust = { name: clean(c.name, 120), email: clean(c.email, 160).toLowerCase(), phone: clean(c.phone, 30), business: clean(c.business, 160), gstin: clean(c.gstin, 20).toUpperCase().replace(/\s/g, ""), city: clean(c.city, 80), state: clean(c.state, 2) };
  if (cust.gstin && !GSTIN_RE.test(cust.gstin)) throw new HttpError(400, "That GSTIN doesn't look right. It has 15 characters, e.g. 23ABCDE1234F1Z5. Leave it empty if you don't have one.");
  if (cust.gstin) cust.state = cust.gstin.slice(0, 2);
  if (!STATES[cust.state]) throw new HttpError(400, "Please choose your state.");
  if (!cust.name) throw new HttpError(400, "Please add your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cust.email)) throw new HttpError(400, "Please add a valid email for your receipt.");
  if (cust.phone.replace(/\D/g, "").length < 10) throw new HttpError(400, "Please add a valid phone number.");
  // a simple brake against scripted abuse
  const recent = await db("/rest/v1/orders?select=id&created_at=gte." + encodeURIComponent(new Date(Date.now() - 60_000).toISOString()));
  if (recent.length >= 20) throw new HttpError(429, "Too many checkouts right now. Please try again in a minute.");

  const price = paise(plan.price), setup = paise(plan.setup), no = orderNo();
  const useGst = gstOn(cfg), rate = useGst ? Number(cfg.gst_rate) : 0, incl = !!cfg.gst_inclusive;
  const sellerState = useGst ? cfg.seller_gstin.slice(0, 2) : "", same = sellerState === cust.state;
  const gP = gstOf(price, rate, incl, same), gS = gstOf(setup, rate, incl, same);
  const desc = p.name + (plans.length > 1 || plan.name !== "Standard" ? " – " + plan.name : "");
  const notes = { order_no: no, product: p.slug, plan: plan.name };
  const row = (await db("/rest/v1/orders", { method: "POST", prefer: "return=representation", body: JSON.stringify({
    order_no: no, product_slug: p.slug, product_name: clean(p.name, 160), plan_name: clean(plan.name, 80), billing: plan.billing, price, setup_fee: setup,
    customer_name: cust.name, email: cust.email, phone: cust.phone, business: cust.business, gstin: cust.gstin, city: cust.city,
    gst_rate: rate, gst_inclusive: incl, buyer_state: cust.state, seller_state: sellerState,
    taxable_amount: gP.taxable + gS.taxable, tax_amount: gP.tax + gS.tax, total_amount: gP.total + gS.total,
  }) }))[0];

  const base = { key: cfg.razorpay_key_id, order_no: no, name: (await siteInfo()).brand, description: desc.slice(0, 250), prefill: { name: cust.name, email: cust.email, contact: cust.phone }, notes };
  if (plan.billing === "one-time") {
    const o = await razorpay(cfg, "/orders", { amount: gP.total + gS.total, currency: "INR", receipt: no, notes });
    await patchOrder(row.id, { rzp_order_id: o.id });
    return { ...base, mode: "order", order_id: o.id, amount: gP.total + gS.total, currency: "INR" };
  }
  const period = plan.billing;
  const pkey = cfg.razorpay_key_id.slice(0, 9) + ":" + period + ":" + gP.total + ":" + p.slug + ":" + plan.name;
  let planId = (await internal("plan_get", { key: pkey }))?.plan_id;
  if (!planId) {
    const rp = await razorpay(cfg, "/plans", { period, interval: 1, item: { name: desc.slice(0, 100), amount: gP.total, currency: "INR" }, notes: { product: p.slug, plan: plan.name } });
    planId = rp.id;
    await internal("plan_put", { key: pkey, plan_id: planId });
  }
  const sub = await razorpay(cfg, "/subscriptions", {
    plan_id: planId, total_count: period === "monthly" ? 60 : 10, quantity: 1, customer_notify: 1, notes,
    ...(setup ? { addons: [{ item: { name: "One-time setup fee", amount: gS.total, currency: "INR" } }] } : {}),
  });
  await patchOrder(row.id, { rzp_subscription_id: sub.id });
  return { ...base, mode: "subscription", subscription_id: sub.id, amount: gP.total + gS.total, currency: "INR" };
}

async function verify(req: Request, cfg: Cfg) {
  const b = await req.json().catch(() => ({}));
  const o = await orderBy("order_no", clean(b.order_no, 40));
  if (!o) throw new HttpError(404, "Order not found.");
  const pay = clean(b.razorpay_payment_id, 60), sig = clean(b.razorpay_signature, 200);
  const msg = o.billing === "one-time" ? o.rzp_order_id + "|" + pay : pay + "|" + o.rzp_subscription_id;
  const good = !!pay && safeEqual(await hmacHex(cfg.razorpay_key_secret || "", msg), sig);
  if (!good) throw new HttpError(400, "We couldn't confirm this payment. If money was deducted, please contact us with your order number " + o.order_no + ".");
  const upd = await markPaid(cfg, o, pay, o.total_amount || o.price + o.setup_fee);
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
  } else if (e === "payment_link.paid" && P.payment_link && P.payment_link.entity) {
    const pl = P.payment_link.entity;
    const o = (await orderBy("pay_link_id", pl.id)) || (pl.reference_id ? await orderBy("order_no", pl.reference_id) : null);
    if (o && pay) await markPaid(cfg, o, pay.id, pay.amount);
  } else if ((e === "payment_link.expired" || e === "payment_link.cancelled") && P.payment_link && P.payment_link.entity) {
    const o = await orderBy("pay_link_id", P.payment_link.entity.id);
    if (o && o.status === "created") await patchOrder(o.id, { status: "cancelled" });
  } else if (e === "payment.failed" && pay) {
    const o = pay.order_id ? await orderBy("rzp_order_id", pay.order_id) : null;
    if (o && o.status === "created") await patchOrder(o.id, { status: "failed" });
  } else if (e === "refund.processed" && P.refund && P.refund.entity) {
    const o = await orderBy("rzp_payment_id", P.refund.entity.payment_id);
    if (o) await patchOrder(o.id, { status: "refunded" });
  }
  return { ok: true };
}


/* ---------- payment links (any amount, created from the admin panel) ---------- */
async function teamOnly(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const r = await fetch(SB_URL + "/rest/v1/rpc/is_team_member", { method: "POST", headers: { apikey: SB_ANON || SB_SERVICE, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: "{}" });
  if (!r.ok || (await r.json()) !== true) throw new HttpError(403, "Only your team can create payment links.");
}
export async function payLink(req: Request, cfg: Cfg) {
  await teamOnly(req);
  if (!keysReady(cfg)) throw new HttpError(400, "Add your Razorpay keys under Store → Payments & email first.");
  const b = await req.json().catch(() => ({}));
  const c = b.customer || {};
  const cust = { name: clean(c.name, 120), email: clean(c.email, 160).toLowerCase(), phone: clean(c.phone, 30), business: clean(c.business, 160), gstin: clean(c.gstin, 20).toUpperCase().replace(/\s/g, ""), city: clean(c.city, 80), state: clean(c.state, 2) };
  if (!cust.name) throw new HttpError(400, "Add the customer's name.");
  const digits = cust.phone.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length < 10) throw new HttpError(400, "Add the customer's 10-digit mobile number.");
  if (cust.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cust.email)) throw new HttpError(400, "That email doesn't look right. Leave it empty if you don't have one.");
  if (cust.gstin && !GSTIN_RE.test(cust.gstin)) throw new HttpError(400, "That GSTIN doesn't look right. It has 15 characters, e.g. 22ABCDE1234F1Z5.");
  if (cust.gstin) cust.state = cust.gstin.slice(0, 2);
  const desc = clean(b.description, 200);
  if (!desc) throw new HttpError(400, "Say what the payment is for, e.g. Website design – 50% advance.");
  const amt = paise(Number(b.amount));
  if (!(amt >= 100) || amt > paise(1000000)) throw new HttpError(400, "Enter an amount between ₹1 and ₹10,00,000.");
  const mode = ["add", "included", "none"].includes(b.gst) ? b.gst : "add";
  const useGst = gstOn(cfg) && mode !== "none", rate = useGst ? Number(cfg.gst_rate) : 0, incl = mode === "included";
  const sellerState = useGst ? cfg.seller_gstin.slice(0, 2) : "";
  if (!STATES[cust.state]) cust.state = sellerState || "";
  if (useGst && !STATES[cust.state]) throw new HttpError(400, "Choose the customer's state for GST.");
  const g = gstOf(amt, rate, incl, sellerState === cust.state);
  const days = Math.min(30, Math.max(1, Math.round(Number(b.days) || 7)));
  const expires = Date.now() + days * 864e5;
  const leadId = /^[0-9a-f-]{36}$/.test(String(b.leadId || "")) ? b.leadId : null;
  const no = orderNo();
  const row = (await db("/rest/v1/orders", { method: "POST", prefer: "return=representation", body: JSON.stringify({
    order_no: no, product_slug: "payment-link", product_name: desc, plan_name: "", billing: "one-time", price: amt, setup_fee: 0,
    customer_name: cust.name, email: cust.email, phone: cust.phone, business: cust.business, gstin: cust.gstin, city: cust.city,
    gst_rate: rate, gst_inclusive: incl, buyer_state: cust.state, seller_state: sellerState,
    taxable_amount: g.taxable, tax_amount: g.tax, total_amount: g.total, lead_id: leadId, notes: clean(b.note, 500),
  }) }))[0];
  const site = await siteInfo();
  const link = await razorpay(cfg, "/payment_links", {
    amount: g.total, currency: "INR", accept_partial: false, reference_id: no, expire_by: Math.floor(expires / 1000),
    description: (desc + " – " + site.brand).slice(0, 2048),
    customer: { name: cust.name, contact: "+91" + digits.slice(-10), ...(cust.email ? { email: cust.email } : {}) },
    notify: { sms: !!b.notifySms, email: !!(b.notifyEmail && cust.email) }, reminder_enable: true,
    notes: { order_no: no }, callback_url: site.url + "/?paid=" + no, callback_method: "get",
  });
  await patchOrder(row.id, { pay_link_id: link.id, pay_link_url: link.short_url, pay_link_expires_at: new Date(expires).toISOString() });
  return { order_no: no, url: link.short_url, amount: amt, taxable: g.taxable, tax: g.tax, total: g.total, rate, expires_at: new Date(expires).toISOString(), test: /^rzp_test_/.test(cfg.razorpay_key_id) };
}
async function cancelPayLink(req: Request, cfg: Cfg) {
  await teamOnly(req);
  const b = await req.json().catch(() => ({}));
  const o = await orderBy("order_no", clean(b.order_no, 40));
  if (!o || o.product_slug !== "payment-link" || !o.pay_link_id) throw new HttpError(404, "Payment link not found.");
  if (o.status !== "created") throw new HttpError(400, "This link is already " + (o.status === "paid" ? "paid" : "closed") + ".");
  await razorpay(cfg, "/payment_links/" + o.pay_link_id + "/cancel", {});
  await patchOrder(o.id, { status: "cancelled" });
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

/* ---------- GST invoice ---------- */
async function invoice(req: Request, cfg: Cfg) {
  const u = new URL(req.url), id = clean(u.searchParams.get("id"), 40), k = clean(u.searchParams.get("k"), 64);
  const pays = /^[0-9a-f-]{36}$/.test(id) ? await db("/rest/v1/order_payments?select=*&id=eq." + id) : [];
  const pay = pays && pays[0];
  if (!pay || !safeEqual(pay.view_key, k)) return new Response("Invoice not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  const o = await orderBy("id", pay.order_id), site = await siteInfo();
  const r = Number(pay.gst_rate), gst = r > 0, same = !pay.igst;
  const sellerGstin = o.seller_state ? cfg.seller_gstin || "" : "";
  const date = new Date(pay.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  const desc = o.product_name + (o.plan_name ? " – " + o.plan_name : "") + (pay.kind === "renewal" ? " (renewal)" : o.setup_fee && pay.kind === "first" ? " (incl. one-time setup)" : "") + (o.billing !== "one-time" ? ", " + o.billing + " plan" : "");
  const th = (t: string) => '<th style="text-align:left;padding:8px;border-bottom:2px solid #241517;font-size:12px;text-transform:uppercase;letter-spacing:.04em">' + t + "</th>";
  const td = (t: string, right = false) => '<td style="padding:8px;border-bottom:1px solid #EADFDA;' + (right ? "text-align:right;white-space:nowrap" : "") + '">' + t + "</td>";
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + (gst ? "Tax Invoice " : "Invoice ") + esc(pay.invoice_no) + '</title>' +
    '<style>body{font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#241517;background:#FBF7F4;margin:0;padding:24px 12px}.inv{max-width:820px;margin:0 auto;background:#fff;border:1px solid #EADFDA;border-radius:12px;padding:32px}table{width:100%;border-collapse:collapse;font-size:14px}.muted{color:#6B5A5C}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0}.btn{display:inline-block;background:#F7941D;color:#1C0F04;font-weight:700;padding:10px 18px;border-radius:999px;border:0;cursor:pointer;font-size:15px}@media print{body{background:#fff;padding:0}.inv{border:0;padding:0}.noprint{display:none}}@media (max-width:600px){.grid{grid-template-columns:1fr}.inv{padding:20px}}</style></head><body>' +
    '<p class="noprint" style="max-width:820px;margin:0 auto 12px;text-align:right"><button class="btn" onclick="print()">Download / Print</button></p><div class="inv">' +
    '<div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start;border-bottom:3px solid #F7941D;padding-bottom:16px"><img src="' + esc(site.url) + '/assets/brand/logo.png" alt="' + esc(site.brand) + '" style="height:56px">' +
    '<div style="text-align:right"><div style="font-size:22px;font-weight:800">' + (gst ? "TAX INVOICE" : "INVOICE") + '</div><div class="muted">Invoice no. <b style="color:#241517">' + esc(pay.invoice_no) + '</b></div><div class="muted">Date: ' + esc(date) + '</div><div class="muted">Order: ' + esc(o.order_no) + "</div></div></div>" +
    '<div class="grid"><div><div class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.06em">From</div><b>' + esc(cfg.seller_name || site.brand) + '</b><div style="white-space:pre-line">' + esc(cfg.seller_address || "") + "</div>" +
      (sellerGstin ? "<div>GSTIN: <b>" + esc(sellerGstin) + "</b></div><div>State: " + esc(STATES[o.seller_state] || "") + " (" + esc(o.seller_state) + ")</div>" : "") + (site.email ? "<div>" + esc(site.email) + "</div>" : "") + (site.phone ? "<div>" + esc(site.phone) + "</div>" : "") + "</div>" +
    '<div><div class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.06em">Bill to</div><b>' + esc(o.business || o.customer_name) + "</b>" + (o.business ? "<div>" + esc(o.customer_name) + "</div>" : "") + (o.city ? "<div>" + esc(o.city) + "</div>" : "") +
      (o.gstin ? "<div>GSTIN: <b>" + esc(o.gstin) + "</b></div>" : "") + (o.buyer_state ? "<div>State: " + esc(STATES[o.buyer_state] || "") + " (" + esc(o.buyer_state) + ")</div>" : "") + "<div>" + esc(o.email) + "</div><div>" + esc(o.phone) + "</div>" +
      (gst ? '<div style="margin-top:6px">Place of supply: <b>' + esc(STATES[o.buyer_state] || "") + "</b></div>" : "") + "</div></div>" +
    "<table><thead><tr>" + th("Description") + (gst ? th("SAC") : "") + th(gst ? "Taxable value" : "Amount") + (gst ? (same ? th("CGST " + r / 2 + "%") + th("SGST " + r / 2 + "%") : th("IGST " + r + "%")) : "") + th("Total") + "</tr></thead><tbody><tr>" +
      td(esc(desc)) + (gst ? td(esc(cfg.sac_code || "–")) : "") + td(rupees(pay.taxable), true) + (gst ? (same ? td(rupees(pay.cgst), true) + td(rupees(pay.sgst), true) : td(rupees(pay.igst), true)) : "") + td("<b>" + rupees(pay.amount) + "</b>", true) + "</tr></tbody></table>" +
    '<table style="margin-top:12px;max-width:360px;margin-left:auto"><tbody>' + (gst ? "<tr>" + td("Taxable value") + td(rupees(pay.taxable), true) + "</tr>" + (same ? "<tr>" + td("CGST @ " + r / 2 + "%") + td(rupees(pay.cgst), true) + "</tr><tr>" + td("SGST @ " + r / 2 + "%") + td(rupees(pay.sgst), true) + "</tr>" : "<tr>" + td("IGST @ " + r + "%") + td(rupees(pay.igst), true) + "</tr>") : "") +
      '<tr><td style="padding:10px 8px;font-weight:800;font-size:16px">Total paid</td><td style="padding:10px 8px;font-weight:800;font-size:16px;text-align:right">' + rupees(pay.amount) + "</td></tr></tbody></table>" +
    '<p style="margin-top:16px"><span class="muted">Amount in words:</span> <b>' + esc(inWords(pay.amount)) + "</b></p>" +
    '<p class="muted" style="font-size:13px">Paid online via Razorpay · Payment ID ' + esc(pay.rzp_payment_id) + (gst ? " · Tax payable on reverse charge: No" : "") + "</p>" +
    '<p class="muted" style="font-size:12px;margin-top:24px;border-top:1px solid #EADFDA;padding-top:12px">This is a computer-generated invoice and does not need a signature.</p></div></body></html>';
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
}

/* ---------- router ---------- */
export async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const route = new URL(req.url).pathname.replace(/^.*\/store/, "") || "/";
  try {
    const cfg: Cfg = (await internal("config")) || {};
    if (route === "/status" && req.method === "GET") return json({ store: storeReady(cfg), test: /^rzp_test_/.test(cfg.razorpay_key_id || ""), gst_note: cfg.gst_note || "",
      gst: gstOn(cfg) ? { rate: Number(cfg.gst_rate), inclusive: !!cfg.gst_inclusive, seller_state: cfg.seller_gstin.slice(0, 2) } : null });
    if (route === "/invoice" && req.method === "GET") return await invoice(req, cfg);
    if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
    if (route === "/checkout") return json(await checkout(req, cfg));
    if (route === "/verify") return json(await verify(req, cfg));
    if (route === "/webhook") return json(await webhook(req, cfg));
    if (route === "/lead-mail") return json(await leadMail(req, cfg));
    if (route === "/test-mail") return json(await testMail(req, cfg));
    if (route === "/pay-link") return json(await payLink(req, cfg));
    if (route === "/pay-link/cancel") return json(await cancelPayLink(req, cfg));
    throw new HttpError(404, "Not found");
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(e);
    return json({ error: status === 500 ? "Something went wrong. Please try again or contact us." : (e as Error).message }, status);
  }
}

Deno.serve(handle);
