/* Loads site content straight from Supabase when the page wasn't pre-filled by the server (_worker.js). */
(function () {
  "use strict";
  const CFG = window.VB_SUPABASE;
  const OBJECTS = ["settings", "theme", "seo", "widget", "code", "bizcrt", "legal"];
  const LISTS = ["sections", "slides", "services", "steps", "testimonials", "posts", "faqs", "offers", "products", "work"];

  function normalize(rows) {
    const c = {};
    (rows || []).forEach(r => { c[r.key] = r.value; });
    OBJECTS.forEach(k => { if (!c[k] || typeof c[k] !== "object" || Array.isArray(c[k])) c[k] = {}; });
    LISTS.forEach(k => { if (!Array.isArray(c[k])) c[k] = []; });
    if (!c.widget.mode) c.widget.mode = "off";
    return c;
  }

  function toPublic(c) {
    return {
      settings: c.settings, theme: c.theme, sections: c.sections,
      slides: c.slides.filter(s => s.active),
      services: c.services, steps: c.steps, testimonials: c.testimonials,
      posts: c.posts.filter(p => p.published).sort((a, b) => String(b.date).localeCompare(String(a.date))),
      faqs: c.faqs,
      offers: c.offers.filter(o => o.published),
      products: c.products.filter(x => x.published),
      bizcrt: c.bizcrt.published ? Object.assign({}, c.bizcrt, { live: c.bizLive || null }) : null,
      work: c.work.filter(x => x.active),
      legal: c.legal.published ? c.legal : null,
      widget: c.widget.mode === "built-in" ? Object.assign({}, c.widget, { customCode: undefined }) : { mode: c.widget.mode },
    };
  }

  async function fetchContent() {
    const r = await fetch(CFG.url + "/rest/v1/site_content?select=key,value", { headers: { apikey: CFG.key } });
    if (!r.ok) throw new Error("Content request failed (" + r.status + ")");
    return normalize(await r.json());
  }

  // Adds pasted HTML (analytics, widget snippets) so that its <script> tags actually run.
  function injectHtml(html, target) {
    if (!html) return;
    const t = document.createElement("template");
    t.innerHTML = html;
    Array.from(t.content.childNodes).forEach(n => {
      if (n.nodeName === "SCRIPT") {
        const s = document.createElement("script");
        Array.from(n.attributes).forEach(a => s.setAttribute(a.name, a.value));
        s.textContent = n.textContent;
        target.appendChild(s);
      } else target.appendChild(n);
    });
  }
  function setMeta(attr, name, value) {
    if (!value) return;
    let m = document.head.querySelector("meta[" + attr + '="' + name + '"]');
    if (!m) { m = document.createElement("meta"); m.setAttribute(attr, name); document.head.appendChild(m); }
    m.setAttribute("content", value);
  }

  const BIZ_Q = {
    plans: "plans?select=name,description,price_month_paise,price_year_paise,price_lifetime_paise,limits,features,highlight,is_free,sort&reseller_id=is.null&custom_org=is.null&is_active=eq.true&order=sort",
    modules: "plan_modules?select=key,name,name_en,description,description_en,price_month_paise,required,sort&is_active=eq.true&order=sort",
    addons: "plan_addons?select=key,name,name_en,price_month_paise,sort&is_active=eq.true&order=sort",
  };
  async function load() {
    const c = await fetchContent();
    if (c.bizcrt.published && c.bizcrt.livePricing !== false) {
      const get = q => fetch(CFG.url + "/rest/v1/" + q, { headers: { apikey: CFG.key } }).then(r => r.ok ? r.json() : []).catch(() => []);
      const [plans, modules, addons] = await Promise.all([get(BIZ_Q.plans), get(BIZ_Q.modules), get(BIZ_Q.addons)]);
      c.bizLive = { plans, modules, addons };
    }
    const { theme, seo, code, widget, settings } = c;
    const vars = [];
    if (theme.accent) vars.push("--accent:" + theme.accent + "!important");
    if (theme.hero) vars.push("--hero:" + theme.hero + "!important");
    if (theme.tick) vars.push("--tick:" + theme.tick + "!important");
    const st = document.createElement("style");
    st.textContent = (vars.length ? ":root{" + vars.join(";") + "}" : "") + (code.css ? "\n" + code.css : "");
    document.head.appendChild(st);
    if (seo.title) document.title = seo.title;
    setMeta("name", "description", seo.description);
    setMeta("property", "og:title", seo.title);
    setMeta("property", "og:description", seo.description);
    if (seo.noindex) setMeta("name", "robots", "noindex,nofollow");
    if (settings.favicon) { const l = document.createElement("link"); l.rel = "icon"; l.href = settings.favicon; document.head.appendChild(l); }
    injectHtml(code.head, document.head);
    injectHtml(code.bodyEnd, document.body);
    if (widget.mode === "custom code") injectHtml(widget.customCode, document.body);
    const m = /^\/blog\/([\w-]+)\/?$/.exec(location.pathname);
    window.__POST__ = m ? m[1] : null;
    const mo = /^\/offer\/([\w-]+)\/?$/.exec(location.pathname);
    window.__OFFER__ = mo ? mo[1] : null;
    const mp = /^\/product\/([\w-]+)\/?$/.exec(location.pathname);
    window.__PRODUCT__ = mp ? mp[1] : null;
    window.__BIZ__ = /^\/bizcrt\/?$/i.test(location.pathname);
    const ml = /^\/legal\/(terms|privacy|refunds|delivery|business)\/?$/.exec(location.pathname);
    window.__LEGAL__ = ml ? ml[1] : null;
    return toPublic(c);
  }

  window.VBContent = { load, fetchContent, normalize, toPublic };
})();
