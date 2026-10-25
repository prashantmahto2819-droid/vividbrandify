// Cloudflare Pages advanced-mode worker for the Vivid Brandify site.
// Renders the home page and blog posts with their content and SEO tags already filled in,
// reading content from Supabase. Every other request (CSS, JS, admin panel) is served as a static file.
// If Supabase can't be reached, it falls back to the static page, which loads content in the browser.

const SB_URL = "https://twyrrvncbpzmgzkyhdei.supabase.co";
const SB_KEY = "sb_publishable_dOKrZHex5JvjDOwn8OlV7A_y5vMotAm";
const OBJECTS = ["settings", "theme", "seo", "widget", "code", "bizcrt", "legal"];
const LISTS = ["sections", "slides", "services", "steps", "testimonials", "posts", "faqs", "offers", "products", "work"];

async function loadContent() {
  const res = await fetch(SB_URL + "/rest/v1/site_content?select=key,value", {
    headers: { apikey: SB_KEY },
    cf: { cacheTtlByStatus: { "200-299": 10, "300-599": 0 }, cacheEverything: true },
  });
  if (!res.ok) throw new Error("Supabase returned " + res.status);
  const c = {};
  for (const row of await res.json()) c[row.key] = row.value;
  OBJECTS.forEach(k => { if (!c[k] || typeof c[k] !== "object" || Array.isArray(c[k])) c[k] = {}; });
  LISTS.forEach(k => { if (!Array.isArray(c[k])) c[k] = []; });
  if (!c.widget.mode) c.widget.mode = "off";
  c.seo.siteUrl = c.seo.siteUrl || "";
  c.posts = c.posts.map(p => Object.assign({ body: "", excerpt: "", date: "" }, p));
  c.offers = c.offers.map(o => Object.assign({ title: "", subtitle: "", slug: "", image: "", endDate: "", startDate: "" }, o));
  c.products = c.products.map(x => Object.assign({ name: "", slug: "", tagline: "", summary: "", image: "", plans: "" }, x));
  return c;
}

const BIZ_Q = {
  plans: "plans?select=name,description,price_month_paise,price_year_paise,price_lifetime_paise,limits,features,highlight,is_free,sort&reseller_id=is.null&custom_org=is.null&is_active=eq.true&order=sort",
  modules: "plan_modules?select=key,name,name_en,description,description_en,price_month_paise,required,sort&is_active=eq.true&order=sort",
  addons: "plan_addons?select=key,name,name_en,price_month_paise,sort&is_active=eq.true&order=sort",
};
// Live plans, module prices and add-ons straight from the BizCRT tables (public, read-only), so prices stay in step with the app.
async function loadBizLive() {
  const get = q => fetch(SB_URL + "/rest/v1/" + q, { headers: { apikey: SB_KEY }, cf: { cacheTtlByStatus: { "200-299": 60, "300-599": 0 }, cacheEverything: true } })
    .then(r => r.ok ? r.json() : []).catch(() => []);
  const [plans, modules, addons] = await Promise.all([get(BIZ_Q.plans), get(BIZ_Q.modules), get(BIZ_Q.addons)]);
  return { plans, modules, addons };
}

// Our apps (Vividora, BizCRT, Vivid Relay, Drishti...). The list ships with the site in /assets/apps.json;
// once it is edited in the admin (Store → Our apps) the saved copy in site_content wins.
async function withApps(c, env, origin) {
  if (Array.isArray(c.apps)) return c;
  try { const r = await env.ASSETS.fetch(new Request(origin + "/assets/apps.json")); c.apps = r.ok ? await r.json() : []; } catch (_) { c.apps = []; }
  if (!Array.isArray(c.apps)) c.apps = [];
  return c;
}
const liveApps = c => (c.apps || []).filter(a => a && a.published !== false && a.slug && a.name);

async function loadTemplate(env, origin) {
  const res = await env.ASSETS.fetch(new Request(origin + "/", { method: "GET" }));
  if (!res.ok) throw new Error("Template missing");
  return res.text();
}

// Builds the public HTML page from the template and the current content.

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const jsonForScript = o => JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function publicContent(c) {
  return {
    settings: c.settings, theme: c.theme, sections: c.sections,
    slides: c.slides.filter(s => s.active),
    services: c.services, steps: c.steps, testimonials: c.testimonials,
    posts: c.posts.filter(p => p.published).sort((a, b) => b.date.localeCompare(a.date)),
    faqs: c.faqs,
    offers: c.offers.filter(o => o.published),
    products: c.products.filter(x => x.published),
    bizcrt: c.bizcrt.published ? Object.assign({}, c.bizcrt, { live: c.bizLive || null }) : null,
    work: c.work.filter(x => x.active),
    legal: c.legal.published ? c.legal : null,
    apps: liveApps(c),
    widget: c.widget.mode === 'built-in' ? { ...c.widget, customCode: undefined } : { mode: c.widget.mode },
  };
}

const siteBase = (c, origin) => (c.seo.siteUrl || origin || '').replace(/\/$/, '');
const absUrl = (base, p) => !p ? '' : /^https?:\/\//.test(p) ? p : base + p;

// Legal pages: /legal/<slug>. Titles double as the page <title> and the footer link text.
const LEGAL_PAGES = { terms: "Terms and conditions", privacy: "Privacy policy", refunds: "Refund and cancellation policy", delivery: "Delivery policy", business: "Business and GST details" };
const LEGAL_KEY = { terms: "legalTerms", privacy: "legalPrivacy", refunds: "legalRefunds", delivery: "legalDelivery" };

function render(TEMPLATE, c, { post = null, offer = null, product = null, biz = false, legal = null, app = null, origin = '' } = {}) {
  const data = publicContent(c);
  const { seo, settings, theme, code, widget } = c;
  const base = siteBase(c, origin);

  const B = c.bizcrt;
  const title = app ? `${app.name}: ${app.category || app.tagline} | ${settings.brand}` : legal ? `${LEGAL_PAGES[legal]} | ${settings.brand}` : biz ? `${B.name || 'BizCRT'}: ${B.tagline || 'business app'} | ${settings.brand}` : product ? `${product.name} | ${settings.brand}` : offer ? `${offer.title} | ${settings.brand}` : post ? `${post.title} | ${settings.brand}` : (seo.title || settings.brand || 'Vivid Brandify');
  const desc = app ? (app.tagline + (app.summary ? ' ' + app.summary : '')).slice(0, 300) : legal ? `${LEGAL_PAGES[legal]} of ${settings.brand}${c.legal.legalName ? ', a trade name of ' + c.legal.legalName : ''}${c.legal.gstin ? '. GSTIN ' + c.legal.gstin : ''}.` : biz ? (B.intro || seo.description) : product ? (product.tagline || product.summary || seo.description) : offer ? (offer.subtitle || offer.headline || seo.description) : post ? post.excerpt : seo.description;
  const img = absUrl(base, app && (app.screenshot || app.logo) ? (app.screenshot || app.logo) : biz && (B.screenshot || B.logo) ? (B.screenshot || B.logo) : product && product.image ? product.image : offer && offer.image ? offer.image : post && post.cover ? post.cover : seo.ogImage);
  const canonical = base + (app ? '/apps/' + app.slug : legal ? '/legal/' + legal : biz ? '/bizcrt' : product ? '/product/' + product.slug : offer ? '/offer/' + offer.slug : post ? '/blog/' + post.slug : '/');

  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    seo.noindex ? '<meta name="robots" content="noindex,nofollow">' : '',
    `<link rel="canonical" href="${esc(canonical)}">`,
    `<meta property="og:type" content="${post ? 'article' : 'website'}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:site_name" content="${esc(settings.brand)}">`,
    `<meta property="og:url" content="${esc(canonical)}">`,
    img ? `<meta property="og:image" content="${esc(img)}"><meta name="twitter:card" content="summary_large_image">` : '',
    settings.favicon ? `<link rel="icon" href="${esc(settings.favicon)}">` : '',
    `<script type="application/ld+json">${jsonForScript(app ? appLd(app, c, canonical, img) : biz ? bizLd(c, canonical, img) : product ? {
      '@context': 'https://schema.org', '@type': 'Product', name: product.name, description: product.tagline || product.summary, image: img || undefined, url: canonical,
      brand: { '@type': 'Brand', name: settings.brand },
      offers: lowestPrice(product) ? { '@type': 'Offer', priceCurrency: 'INR', price: lowestPrice(product), availability: 'https://schema.org/InStock', url: canonical } : undefined,
    } : post ? {
      '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, description: post.excerpt,
      datePublished: post.date, author: { '@type': 'Organization', name: post.author || settings.brand },
      publisher: { '@type': 'Organization', name: settings.brand }, image: img || undefined, mainEntityOfPage: canonical,
    } : {
      '@context': 'https://schema.org', '@type': 'ProfessionalService', name: settings.brand, description: seo.description,
      url: base || undefined, telephone: settings.phone || undefined, email: settings.email || undefined,
      address: settings.address || undefined, image: img || undefined,
      legalName: c.legal.published && c.legal.legalName ? c.legal.legalName : undefined, taxID: c.legal.published && c.legal.gstin ? c.legal.gstin : undefined,
    })}</script>`,
  ].filter(Boolean).join('\n');

  const vars = [];
  if (theme.accent) vars.push(`--accent:${theme.accent}!important`);
  if (theme.hero) vars.push(`--hero:${theme.hero}!important`);
  if (theme.tick) vars.push(`--tick:${theme.tick}!important`);
  const themeCss = `<style>${vars.length ? ':root{' + vars.join(';') + '}' : ''}${code.css ? '\n' + code.css.replace(/<\/style/gi, '') : ''}</style>`;
  const dataScript = `<script>window.__SITE__=${jsonForScript(data)};window.__POST__=${jsonForScript(post ? post.slug : null)};window.__OFFER__=${jsonForScript(offer ? offer.slug : null)};window.__PRODUCT__=${jsonForScript(product ? product.slug : null)};window.__BIZ__=${biz};window.__LEGAL__=${jsonForScript(legal)};window.__APP__=${jsonForScript(app ? app.slug : null)};</script>`;

  const L = c.legal;
  const noscript = legal
    ? `<noscript><article class="wrap article"><h1>${esc(LEGAL_PAGES[legal])}</h1>${legal === 'business'
        ? `<p>${esc(L.tradeName)} is a trade name of ${esc(L.legalName)} (${esc(L.constitution)}). GSTIN ${esc(L.gstin)}. ${esc(L.address)}.</p>`
        : String(L[legal] || '').split(/\n\s*\n/).map(p => `<p>${esc(p.replace(/^##\s+|^-\s+/gm, '').replace(/\*\*|\[|\]\([^)]*\)/g, ''))}</p>`).join('') + liveApps(c).filter(a => a[LEGAL_KEY[legal]]).map(a => `<h2>${esc(a.name)}</h2><p>${esc(a[LEGAL_KEY[legal]])}</p>`).join('')}</article></noscript>`
    : app
    ? `<noscript><article class="wrap article"><h1>${esc(app.name)}: ${esc(app.tagline)}</h1><p>${esc(app.summary)}</p><ul>${String(app.features || '').split('\n').filter(Boolean).map(f => `<li>${esc(f)}</li>`).join('')}</ul><ul>${String(app.plans || '').split('\n').filter(Boolean).map(l => `<li>${esc(l.split('|').slice(0, 4).map(x => x.trim()).filter(Boolean).join(' · '))}</li>`).join('')}</ul></article></noscript>`
    : post
    ? `<noscript><article class="wrap article"><h1>${esc(post.title)}</h1><p class="lede">${esc(post.excerpt)}</p>${post.body.split(/\n\s*\n/).map(p => `<p>${esc(p.replace(/^##\s+|^-\s+/gm, ''))}</p>`).join('')}</article></noscript>`
    : `<noscript><div class="wrap"><h1>${esc(settings.brand)}</h1><p>${esc(settings.tagline)}</p><ul>${data.posts.map(p => `<li><a href="/blog/${esc(p.slug)}">${esc(p.title)}</a></li>`).join('')}</ul></div></noscript>`;

  const bodyEnd = [code.bodyEnd || '', widget.mode === 'custom code' ? widget.customCode || '' : ''].join('\n');

  return TEMPLATE
    .replace(/<!--SEO-->[\s\S]*?<!--\/SEO-->/, () => head)
    .replace('<!--THEME-->', () => themeCss)
    .replace('<!--HEAD_CODE-->', () => code.head || '')
    .replace('<!--DATA-->', () => dataScript)
    .replace('<!--NOSCRIPT-->', () => noscript)
    .replace('<!--BODY_END-->', () => bodyEnd)
    .replace('<div class="offer-bar" id="offerBar" hidden></div>', () => offerBar(c) || '<div class="offer-bar" id="offerBar" hidden></div>');
}

// The festival offer bar is drawn on the server too, so the page doesn't jump down when the script adds it.
const FEST = { diwali: "🪔", holi: "🎨", navratri: "🔱", eid: "🌙", christmas: "🎄", "new-year": "🎆", "independence-day": "🇮🇳", general: "✨" };
function offerBar(c) {
  const t = new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10); // India date
  const live = c.offers.filter(o => o.published && o.showOnHome && (!o.startDate || t >= o.startDate) && (!o.endDate || t <= o.endDate))
    .sort((a, b) => (a.endDate || "9999").localeCompare(b.endDate || "9999"));
  const o = live[0];
  if (!o) return '';
  let end = '';
  if (o.endDate) {
    const ms = Date.parse(o.endDate + "T23:59:59+05:30") - Date.now(), d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
    end = '<span class="ob-end">' + (ms <= 0 ? 'Offer ended' : 'Ends in ' + (d ? d + (d === 1 ? ' day ' : ' days ') : '') + h + ' hr' + (d ? '' : ' ' + m + ' min')) + '</span>';
  }
  return `<div class="offer-bar" id="offerBar" data-fest="${esc(o.festival)}"><div class="wrap offer-bar-row"><span class="ob-ic" aria-hidden="true">${FEST[o.festival] || "✨"}</span><span class="ob-text"><b>${esc(o.barText || o.title)}</b>${o.discount ? '<span class="ob-disc">' + esc(o.discount) + '</span>' : ''}${end}</span><a class="ob-link" href="/offer/${esc(o.slug)}" data-offer="${esc(o.slug)}">View offer</a></div></div>`;
}

function bizLd(c, url, img) {
  const B = c.bizcrt, plans = (c.bizLive && c.bizLive.plans) || [];
  const prices = plans.map(p => Math.round((p.price_month_paise || 0) / 100));
  return {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: B.name || 'BizCRT', applicationCategory: 'BusinessApplication', operatingSystem: 'Web, Android, iOS (browser)',
    description: B.intro, url, image: img || undefined, publisher: { '@type': 'Organization', name: c.settings.brand },
    offers: prices.length ? { '@type': 'AggregateOffer', priceCurrency: 'INR', lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: prices.length } : undefined,
  };
}

function appLd(a, c, url, img) {
  const prices = String(a.plans || '').split('\n').map(l => String(l.split('|')[1] || '').trim()).filter(p => /^[₹\s\d,.]+$/.test(p) && /\d/.test(p)).map(p => Number(p.replace(/[^\d.]/g, '')));
  return {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: a.name, applicationCategory: 'BusinessApplication', description: a.tagline, url, image: img || undefined,
    publisher: { '@type': 'Organization', name: c.settings.brand, legalName: c.legal.published && c.legal.legalName ? c.legal.legalName : undefined },
    offers: prices.length ? { '@type': 'AggregateOffer', priceCurrency: 'INR', lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: prices.length } : undefined,
  };
}

function lowestPrice(prod) {
  const prices = String(prod.plans || '').split('\n').map(l => Number(String(l.split('|')[1] || '').replace(/[^\d.]/g, ''))).filter(n => n > 0);
  return prices.length ? Math.min(...prices) : 0;
}

function sitemap(c, origin) {
  const base = siteBase(c, origin);
  const urls = [`<url><loc>${esc(base)}/</loc></url>`].concat(c.bizcrt.published ? [`<url><loc>${esc(base)}/bizcrt</loc></url>`] : [])
    .concat(c.posts.filter(p => p.published).map(p => `<url><loc>${esc(base)}/blog/${esc(p.slug)}</loc><lastmod>${p.date}</lastmod></url>`))
    .concat(c.products.filter(x => x.published && x.slug).map(x => `<url><loc>${esc(base)}/product/${esc(x.slug)}</loc></url>`))
    .concat(liveApps(c).filter(a => !(a.page === '/bizcrt' || a.slug === 'bizcrt')).map(a => `<url><loc>${esc(base)}/apps/${esc(a.slug)}</loc></url>`))
    .concat(c.legal.published ? Object.keys(LEGAL_PAGES).map(k => `<url><loc>${esc(base)}/legal/${k}</loc></url>`) : [])
    .concat(c.offers.filter(o => o.published && (!o.endDate || o.endDate >= new Date().toISOString().slice(0, 10))).map(o => `<url><loc>${esc(base)}/offer/${esc(o.slug)}</loc></url>`));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;
}


/* ---------- quotations: the customer's page at /q/<id>?k=<key> ---------- */
const STATE_NAMES = { "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory" };
const inrP = p => "₹" + (Number(p || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: Number(p) % 100 ? 2 : 0, maximumFractionDigits: 2 });
function inWords(paiseAmt) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = n => n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  const three = n => (n >= 100 ? ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " : "") : "") + (n % 100 ? two(n % 100) : "");
  const words = n => { if (!n) return "Zero"; const parts = []; const cr = Math.floor(n / 1e7); n %= 1e7; const lk = Math.floor(n / 1e5); n %= 1e5; const th = Math.floor(n / 1000); n %= 1000;
    if (cr) parts.push(words(cr) + " Crore"); if (lk) parts.push(two(lk) + " Lakh"); if (th) parts.push(two(th) + " Thousand"); if (n) parts.push(three(n)); return parts.join(" "); };
  const r = Math.floor(paiseAmt / 100), p = paiseAmt % 100;
  return "Rupees " + words(r) + (p ? " and " + two(p) + " Paise" : "") + " Only";
}
async function loadQuote(id, key) {
  const r = await fetch(SB_URL + "/rest/v1/rpc/quote_public", { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_id: id, p_key: key }) });
  if (!r.ok) return null;
  return r.json();
}
function quotePage(q, c, id, key) {
  const st = c.settings || {}, brand = st.brand || "Vivid Brandify", s = q.seller || {}, cu = q.customer || {};
  const date = d => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const today = new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10);
  const expired = q.valid_until && q.valid_until < today, gst = Number(q.gst_rate) > 0, same = !q.igst;
  const wa = String(st.whatsapp || "").replace(/\D/g, ""), waText = encodeURIComponent("Hi, I have a question about quotation " + q.quote_no + ".");
  const items = (q.items || []).map((it, i) => '<tr><td class="n">' + (i + 1) + '</td><td><b>' + esc(it.name) + '</b>' + (it.description ? '<div class="d">' + esc(it.description) + '</div>' : '') + '</td><td class="r">' + esc(it.qty) + (it.unit ? ' ' + esc(it.unit) : '') + '</td><td class="r">' + inrP(it.rate) + '</td><td class="r">' + inrP(Math.round(Number(it.qty) * Number(it.rate))) + '</td></tr>').join("");
  const row = (k, v, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + k + '</td><td class="r">' + v + '</td></tr>';
  const status = q.status === "accepted" ? '<span class="pill ok">Accepted ' + (q.accepted_at ? date(q.accepted_at) : '') + '</span>' : q.status === "declined" ? '<span class="pill">Declined</span>' : expired ? '<span class="pill warn">Expired</span>' : '';
  const canAccept = q.status === "sent" && !expired;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Quotation ${esc(q.quote_no)} | ${esc(brand)}</title><link rel="icon" href="/assets/brand/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap">
<style>
:root{--ink:#241517;--muted:#6B5A5C;--line:#EADFDA;--bg:#FBF7F4;--accent:#F7941D;--ok:#15803D}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 Figtree,"Segoe UI",system-ui,sans-serif;padding:24px 14px 60px}
.doc{max-width:860px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:16px;padding:36px;position:relative;overflow:hidden}
.doc::before{content:"";position:absolute;left:0;right:0;top:0;height:4px;background:linear-gradient(90deg,#E2352B,#F7941D 55%,#FFC53D)}
.top{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start;padding-bottom:20px;border-bottom:1px solid var(--line)}
.top img{height:64px}.top h1{font:800 28px/1 "Bricolage Grotesque",sans-serif;letter-spacing:-.02em;margin:0 0 8px;text-align:right}
.meta{text-align:right;color:var(--muted);font-size:14px}.meta b{color:var(--ink)}
.pill{display:inline-block;margin-top:8px;font-weight:700;font-size:13px;border-radius:999px;padding:4px 12px;background:#F3ECE8;color:var(--muted)}.pill.ok{background:#DCFCE7;color:var(--ok)}.pill.warn{background:#FEF3C7;color:#B45309}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:22px 0}
.k{font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.02em;margin-bottom:4px}
.parties b{font-size:16px}.pre{white-space:pre-line}
table{width:100%;border-collapse:collapse}
.items th{font-size:12.5px;font-weight:700;color:var(--muted);text-align:left;padding:10px 8px;border-bottom:2px solid var(--ink)}
.items td{padding:12px 8px;border-bottom:1px solid var(--line);vertical-align:top}.items .d{color:var(--muted);font-size:13.5px;white-space:pre-line;margin-top:2px}
.r{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.items th.r{text-align:right}.legal a{color:inherit}.n{color:var(--muted);width:28px}
.sum{width:min(360px,100%);margin:14px 0 0 auto}.sum td{padding:6px 8px}.sum .tot td{border-top:2px solid var(--ink);font:800 20px "Bricolage Grotesque",sans-serif;padding-top:10px}
.words{margin:10px 0 0;color:var(--muted);font-size:13.5px;text-align:right}.words b{color:var(--ink)}
.block{margin-top:24px;padding-top:16px;border-top:1px solid var(--line)}.block h2{font-size:15px;margin:0 0 6px}
.acts{max-width:860px;margin:18px auto 0;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}
.btn{display:inline-flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 22px;font:700 15px Figtree,sans-serif;cursor:pointer;text-decoration:none}
.btn-p{background:var(--accent);color:#1C0F04}.btn-g{background:#fff;color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--line)}
.accept{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.accept input{border:1.5px solid var(--line);border-radius:999px;padding:11px 16px;font:15px Figtree,sans-serif;min-width:200px}
.done{max-width:860px;margin:18px auto 0;background:#DCFCE7;color:#14532D;border-radius:14px;padding:16px 20px;font-weight:600}
.legal{max-width:860px;margin:14px auto 0;color:var(--muted);font-size:12.5px;text-align:center}
@media (max-width:640px){.doc{padding:22px 16px}.parties{grid-template-columns:1fr}.top h1,.meta{text-align:left}.items th:nth-child(1),.items td:nth-child(1){display:none}}
@media print{body{background:#fff;padding:0}.doc{border:0;padding:0}.doc::before{display:none}.acts,.done,.legal{display:none}}
</style></head><body>
<div class="doc">
<div class="top"><img src="${esc(st.logo || "/assets/brand/logo.png")}" alt="${esc(brand)}"><div><h1>Quotation</h1><div class="meta">No. <b>${esc(q.quote_no)}</b><br>Date: ${date(q.created_at)}${q.valid_until ? "<br>Valid till: <b>" + date(q.valid_until + "T00:00:00+05:30") + "</b>" : ""}</div>${status ? '<div class="meta">' + status + '</div>' : ''}</div></div>
<div class="parties"><div><div class="k">From</div><b>${esc(s.name || brand)}</b><div class="pre">${esc(s.address || st.address || "")}</div>${s.gstin ? "<div>GSTIN: <b>" + esc(s.gstin) + "</b></div>" : ""}${st.phone ? "<div>" + esc(st.phone) + "</div>" : ""}${st.email ? "<div>" + esc(st.email) + "</div>" : ""}</div>
<div><div class="k">Prepared for</div><b>${esc(cu.business || cu.name || "")}</b>${cu.business && cu.name ? "<div>" + esc(cu.name) + "</div>" : ""}${cu.city ? "<div>" + esc(cu.city) + "</div>" : ""}${cu.gstin ? "<div>GSTIN: <b>" + esc(cu.gstin) + "</b></div>" : ""}${gst && q.buyer_state ? "<div>Place of supply: " + esc(STATE_NAMES[q.buyer_state] || q.buyer_state) + "</div>" : ""}${cu.phone ? "<div>" + esc(cu.phone) + "</div>" : ""}</div></div>
<table class="items"><thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${items}</tbody></table>
<table class="sum"><tbody>${row("Subtotal", inrP(q.subtotal))}${q.discount ? row("Discount", "− " + inrP(q.discount)) : ""}${gst ? row(q.gst_mode === "included" ? "Taxable value (GST included in prices)" : "Taxable value", inrP(q.taxable)) + (same ? row("CGST " + Number(q.gst_rate) / 2 + "%", inrP(q.cgst)) + row("SGST " + Number(q.gst_rate) / 2 + "%", inrP(q.sgst)) : row("IGST " + Number(q.gst_rate) + "%", inrP(q.igst))) : ""}${row("Total", inrP(q.total), "tot")}</tbody></table>
<p class="words">Amount in words: <b>${esc(inWords(Number(q.total)))}</b></p>
${gst && s.sac ? '<p class="words">SAC: ' + esc(s.sac) + '</p>' : ''}
${q.notes ? '<div class="block"><h2>Notes</h2><div class="pre">' + esc(q.notes) + '</div></div>' : ''}
${q.terms ? '<div class="block"><h2>Terms</h2><div class="pre">' + esc(q.terms) + '</div></div>' : ''}
</div>
<div class="acts">${canAccept ? '<form class="accept" id="acc"><input name="n" placeholder="Your name (optional)" aria-label="Your name" maxlength="80"><button class="btn btn-p" type="submit">Accept this quotation</button></form>' : '<span></span>'}
<span style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-g" type="button" onclick="print()">Download / Print</button>${wa ? '<a class="btn btn-g" href="https://wa.me/' + wa + '?text=' + waText + '" target="_blank" rel="noopener">Ask on WhatsApp</a>' : ''}</span></div>
<div class="done" id="done" hidden></div>
<p class="legal">${esc(brand)}${c.legal && c.legal.published ? ' · <a href="/legal/terms">Terms</a> · <a href="/legal/refunds">Refund policy</a>' : ''}</p>
${canAccept ? `<script>document.getElementById("acc").addEventListener("submit",async e=>{e.preventDefault();const b=e.target.querySelector("button");b.disabled=true;b.textContent="Saving…";
try{const r=await fetch(${JSON.stringify(SB_URL + "/rest/v1/rpc/quote_accept")},{method:"POST",headers:{apikey:${JSON.stringify(SB_KEY)},"Content-Type":"application/json"},body:JSON.stringify({p_id:${JSON.stringify(id)},p_key:${JSON.stringify(key)},p_name:e.target.n.value})});const j=await r.json();
const d=document.getElementById("done");if(j&&j.ok){e.target.remove();d.textContent="Thank you! Your acceptance is recorded. We'll contact you shortly with the next steps and the payment link.";d.hidden=false}else{b.disabled=false;b.textContent="Accept this quotation";alert((j&&j.error)||"Couldn't save. Please try again or message us on WhatsApp.")}}
catch(_){b.disabled=false;b.textContent="Accept this quotation";alert("Couldn't save. Please check your connection and try again.")}});</script>` : ''}
</body></html>`;
}

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    const isGet = request.method === "GET" || request.method === "HEAD";
    // repository files that are not part of the website
    if (/^\/(README\.md|\.gitignore|docs(\/|$)|supabase(\/|$)|\.git)/i.test(p)) return new Response("Not found", { status: 404 });
    const blog = /^\/blog\/([\w-]+)\/?$/.exec(p);
    const offerM = /^\/offer\/([\w-]+)\/?$/.exec(p);
    const prodM = /^\/product\/([\w-]+)\/?$/.exec(p);
    const bizM = /^\/bizcrt\/?$/i.test(p);
    const legalM = /^\/legal\/(terms|privacy|refunds|delivery|business)\/?$/.exec(p);
    const appM = /^\/apps\/([\w-]+)\/?$/.exec(p);
    const isPage = isGet && (p === "/" || !!blog || !!offerM || !!prodM || bizM || !!legalM || !!appM);

    const quoteM = /^\/q\/([0-9a-f-]{36})\/?$/.exec(p);
    if (isGet && quoteM) {
      const key = (url.searchParams.get("k") || "").replace(/[^0-9a-f]/g, "").slice(0, 64);
      const headers = { ...HTML_HEADERS, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
      try {
        const [q, c] = await Promise.all([key ? loadQuote(quoteM[1], key) : null, loadContent()]);
        if (!q) return new Response("<!doctype html><meta charset=utf-8><title>Quotation not found</title><p style=\"font-family:sans-serif;padding:40px\">This quotation link isn't valid. Please ask us for a fresh link.</p>", { status: 404, headers });
        return new Response(quotePage(q, c, quoteM[1], key), { headers });
      } catch (err) { console.error(err); return new Response("Quotation temporarily unavailable. Please try again in a minute.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }); }
    }
    if (isGet && p === "/robots.txt") {
      try {
        const c = await loadContent();
        const base = siteBase(c, url.origin);
        return new Response(c.seo.noindex ? "User-agent: *\nDisallow: /\n" : "User-agent: *\nDisallow: /admin\nSitemap: " + base + "/sitemap.xml\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      } catch (_) { return new Response("User-agent: *\nDisallow: /admin\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } }); }
    }
    if (isGet && p === "/sitemap.xml") {
      try { return new Response(sitemap(await withApps(await loadContent(), env, url.origin), url.origin), { headers: { "Content-Type": "application/xml; charset=utf-8" } }); }
      catch (_) { return new Response("Sitemap temporarily unavailable", { status: 503 }); }
    }
    if (isPage) {
      try {
        const [c, tpl] = await Promise.all([loadContent().then(x => withApps(x, env, url.origin)), loadTemplate(env, url.origin)]);
        if ((p === "/" || bizM) && c.bizcrt.published && c.bizcrt.livePricing !== false) c.bizLive = await loadBizLive();
        if (bizM) {
          if (c.bizcrt.published) return new Response(render(tpl, c, { biz: true, origin: url.origin }), { headers: HTML_HEADERS });
          return new Response(render(tpl, c, { origin: url.origin }), { status: 404, headers: HTML_HEADERS });
        }
        if (legalM) {
          if (c.legal.published) return new Response(render(tpl, c, { legal: legalM[1], origin: url.origin }), { headers: HTML_HEADERS });
          return new Response(render(tpl, c, { origin: url.origin }), { status: 404, headers: HTML_HEADERS });
        }
        if (appM) {
          const app = liveApps(c).find(a => a.slug === appM[1]);
          if (app && (app.page === '/bizcrt' || app.slug === 'bizcrt') && c.bizcrt.published) return Response.redirect(url.origin + '/bizcrt', 301);
          if (app) return new Response(render(tpl, c, { app, origin: url.origin }), { headers: HTML_HEADERS });
          return new Response(render(tpl, c, { origin: url.origin }), { status: 404, headers: HTML_HEADERS });
        }
        if (prodM) {
          const product = c.products.find(x => x.slug === prodM[1] && x.published);
          if (product) return new Response(render(tpl, c, { product, origin: url.origin }), { headers: HTML_HEADERS });
          return new Response(render(tpl, c, { origin: url.origin }), { status: 404, headers: HTML_HEADERS });
        }
        if (offerM) {
          const offer = c.offers.find(x => x.slug === offerM[1] && x.published);
          if (offer) return new Response(render(tpl, c, { offer, origin: url.origin }), { headers: HTML_HEADERS });
          return new Response(render(tpl, c, { origin: url.origin }), { status: 404, headers: HTML_HEADERS });
        }
        if (blog) {
          const post = c.posts.find(x => x.slug === blog[1] && x.published);
          if (post) return new Response(render(tpl, c, { post, origin: url.origin }), { headers: HTML_HEADERS });
          return new Response(render(tpl, c, { origin: url.origin }), { status: 404, headers: HTML_HEADERS });
        }
        return new Response(render(tpl, c, { origin: url.origin }), { headers: HTML_HEADERS });
      } catch (err) {
        console.error(err);
        return env.ASSETS.fetch(blog || offerM || prodM || bizM || legalM || appM ? new Request(url.origin + "/", request) : request);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
