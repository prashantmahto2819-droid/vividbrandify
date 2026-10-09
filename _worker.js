// Cloudflare Pages advanced-mode worker for the Vivid Brandify site.
// Renders the home page and blog posts with their content and SEO tags already filled in,
// reading content from Supabase. Every other request (CSS, JS, admin panel) is served as a static file.
// If Supabase can't be reached, it falls back to the static page, which loads content in the browser.

const SB_URL = "https://twyrrvncbpzmgzkyhdei.supabase.co";
const SB_KEY = "sb_publishable_dOKrZHex5JvjDOwn8OlV7A_y5vMotAm";
const OBJECTS = ["settings", "theme", "seo", "widget", "code"];
const LISTS = ["sections", "slides", "services", "steps", "testimonials", "posts", "faqs", "offers"];

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
  return c;
}

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
    widget: c.widget.mode === 'built-in' ? { ...c.widget, customCode: undefined } : { mode: c.widget.mode },
  };
}

const siteBase = (c, origin) => (c.seo.siteUrl || origin || '').replace(/\/$/, '');
const absUrl = (base, p) => !p ? '' : /^https?:\/\//.test(p) ? p : base + p;

function render(TEMPLATE, c, { post = null, offer = null, origin = '' } = {}) {
  const data = publicContent(c);
  const { seo, settings, theme, code, widget } = c;
  const base = siteBase(c, origin);

  const title = offer ? `${offer.title} | ${settings.brand}` : post ? `${post.title} | ${settings.brand}` : (seo.title || settings.brand || 'Vivid Brandify');
  const desc = offer ? (offer.subtitle || offer.headline || seo.description) : post ? post.excerpt : seo.description;
  const img = absUrl(base, offer && offer.image ? offer.image : post && post.cover ? post.cover : seo.ogImage);
  const canonical = base + (offer ? '/offer/' + offer.slug : post ? '/blog/' + post.slug : '/');

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
    `<script type="application/ld+json">${jsonForScript(post ? {
      '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, description: post.excerpt,
      datePublished: post.date, author: { '@type': 'Organization', name: post.author || settings.brand },
      publisher: { '@type': 'Organization', name: settings.brand }, image: img || undefined, mainEntityOfPage: canonical,
    } : {
      '@context': 'https://schema.org', '@type': 'ProfessionalService', name: settings.brand, description: seo.description,
      url: base || undefined, telephone: settings.phone || undefined, email: settings.email || undefined,
      address: settings.address || undefined, image: img || undefined,
    })}</script>`,
  ].filter(Boolean).join('\n');

  const vars = [];
  if (theme.accent) vars.push(`--accent:${theme.accent}!important`);
  if (theme.hero) vars.push(`--hero:${theme.hero}!important`);
  if (theme.tick) vars.push(`--tick:${theme.tick}!important`);
  const themeCss = `<style>${vars.length ? ':root{' + vars.join(';') + '}' : ''}${code.css ? '\n' + code.css.replace(/<\/style/gi, '') : ''}</style>`;
  const dataScript = `<script>window.__SITE__=${jsonForScript(data)};window.__POST__=${jsonForScript(post ? post.slug : null)};window.__OFFER__=${jsonForScript(offer ? offer.slug : null)};</script>`;

  const noscript = post
    ? `<noscript><article class="wrap article"><h1>${esc(post.title)}</h1><p class="lede">${esc(post.excerpt)}</p>${post.body.split(/\n\s*\n/).map(p => `<p>${esc(p.replace(/^##\s+|^-\s+/gm, ''))}</p>`).join('')}</article></noscript>`
    : `<noscript><div class="wrap"><h1>${esc(settings.brand)}</h1><p>${esc(settings.tagline)}</p><ul>${data.posts.map(p => `<li><a href="/blog/${esc(p.slug)}">${esc(p.title)}</a></li>`).join('')}</ul></div></noscript>`;

  const bodyEnd = [code.bodyEnd || '', widget.mode === 'custom code' ? widget.customCode || '' : ''].join('\n');

  return TEMPLATE
    .replace(/<!--SEO-->[\s\S]*?<!--\/SEO-->/, () => head)
    .replace('<!--THEME-->', () => themeCss)
    .replace('<!--HEAD_CODE-->', () => code.head || '')
    .replace('<!--DATA-->', () => dataScript)
    .replace('<!--NOSCRIPT-->', () => noscript)
    .replace('<!--BODY_END-->', () => bodyEnd);
}

function sitemap(c, origin) {
  const base = siteBase(c, origin);
  const urls = [`<url><loc>${esc(base)}/</loc></url>`]
    .concat(c.posts.filter(p => p.published).map(p => `<url><loc>${esc(base)}/blog/${esc(p.slug)}</loc><lastmod>${p.date}</lastmod></url>`))
    .concat(c.offers.filter(o => o.published && (!o.endDate || o.endDate >= new Date().toISOString().slice(0, 10))).map(o => `<url><loc>${esc(base)}/offer/${esc(o.slug)}</loc></url>`));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;
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
    const isPage = isGet && (p === "/" || !!blog || !!offerM);

    if (isGet && p === "/robots.txt") {
      try {
        const c = await loadContent();
        const base = siteBase(c, url.origin);
        return new Response(c.seo.noindex ? "User-agent: *\nDisallow: /\n" : "User-agent: *\nDisallow: /admin\nSitemap: " + base + "/sitemap.xml\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      } catch (_) { return new Response("User-agent: *\nDisallow: /admin\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } }); }
    }
    if (isGet && p === "/sitemap.xml") {
      try { return new Response(sitemap(await loadContent(), url.origin), { headers: { "Content-Type": "application/xml; charset=utf-8" } }); }
      catch (_) { return new Response("Sitemap temporarily unavailable", { status: 503 }); }
    }
    if (isPage) {
      try {
        const [c, tpl] = await Promise.all([loadContent(), loadTemplate(env, url.origin)]);
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
        return env.ASSETS.fetch(blog || offerM ? new Request(url.origin + "/", request) : request);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
