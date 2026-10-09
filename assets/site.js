/* Vivid Brandify public site. Renders everything from window.__SITE__ (injected by the server). */
function vbStart() {
  "use strict";
  const S = window.__SITE__;
  if (!S) return;
  const st = S.settings;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TICK = '<svg class="ticks" viewBox="0 0 18 11" aria-hidden="true"><path d="M1 6l3.5 3.5L11 2"/><path d="M7 9.5L15.5 1"/></svg>';
  const TICK1 = '<svg class="ticks" viewBox="0 0 18 11" aria-hidden="true"><path d="M4 6l3.5 3.5L14 2"/></svg>';
  const WA_ICON = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.7a10.7 10.7 0 0 1-5.5-1.5l-.4-.2-3.9 1 1-3.8-.2-.4A10.7 10.7 0 1 1 16 26.7zm5.9-8c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.8 8.8 0 0 1-4.4-3.8c-.3-.6.3-.5 1-1.7.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3 14.4 14.4 0 0 0 5.5 4.9c2 .9 2.8.9 3.9.8a3.3 3.3 0 0 0 2.1-1.5 2.7 2.7 0 0 0 .2-1.5c-.1-.2-.3-.2-.7-.4z"/></svg>';
  const ICONS = {
    chat: '<svg viewBox="0 0 24 24"><path d="M4 19l1.4-3.6A8 8 0 1 1 8.7 18.6z"/><path d="M9 10h6M9 13h4"/></svg>',
    voice: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
    software: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M7 13v-3M11 13V8M15 13v-5"/></svg>',
    video: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="13" height="14" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg>',
    growth: '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
    web: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M6.5 6.5h.01M9.5 6.5h.01M7 13h6M7 16h4"/></svg>',
    crm: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/></svg>',
    app: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7M14 17.5h7"/></svg>',
    bot: '<svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5"/></svg>'
  };
  const lines = t => String(t || "").split("\n").map(l => l.trim()).filter(Boolean);
  const safeUrl = u => /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(u || "") ? u : "#";
  const waNumber = n => String(n || "").replace(/\D/g, "");
  function waLink(text, number) {
    const n = waNumber(number || st.whatsapp);
    return n ? "https://wa.me/" + n + (text ? "?text=" + encodeURIComponent(text) : "") : "";
  }

  /* ---------- live visuals ---------- */
  function visual(kind, item) {
    const brand = esc(st.brand || "Brand");
    if (kind === "image" && item.image) return '<img class="img-visual" src="' + esc(item.image) + '" alt="" loading="lazy">';
    if (kind === "voice") return '<div class="panel"><div class="panel-h"><span>Voice broadcast · 00:32</span><span class="pill live">Live</span></div><div class="wave">' + Array.from({ length: 32 }, (_, i) => '<i style="height:' + (20 + Math.round(Math.abs(Math.sin(i * 1.7)) * 80)) + '%;animation-delay:-' + (i % 7) * .17 + 's"></i>').join("") + '</div><div class="ivr"><div class="hit"><kbd>1</kbd>Talk to sales now</div><div><kbd>2</kbd>Request a callback</div><div><kbd>3</kbd>Stop these calls</div></div></div>';
    if (kind === "software") return '<div class="panel"><div class="panel-h"><span>Festive offer · 2,400 contacts</span><span class="pill">Example</span></div><div class="funnel"><div class="frow"><span>Sent</span><span class="bar"><b style="width:100%"></b></span><span>2,400</span></div><div class="frow"><span>Delivered</span><span class="bar"><b style="width:94%"></b></span><span>2,256</span></div><div class="frow"><span>Read</span><span class="bar"><b style="width:71%"></b></span><span>1,704</span></div><div class="frow"><span>Replied</span><span class="bar"><b style="width:18%"></b></span><span>432</span></div></div><div class="small-note">Sample dashboard view. Figures are illustrative.</div></div>';
    if (kind === "video") return '<div class="vid"><div class="vid-screen"><span class="pill vid-tag">9:16 · Hindi VO</span><div class="presenter"></div><div class="vid-cap">Flat 20% off this weekend only</div></div><div class="vid-tl"><span>Hook</span><span class="on">Offer</span><span>Proof</span><span>CTA</span></div></div>';
    if (kind === "website") return '<div class="browser"><div class="browser-bar"><i></i><i></i><i></i><span>' + esc((st.brand || "yourbusiness").toLowerCase().replace(/[^a-z0-9]+/g, "")) + '.com</span></div>' +
      '<div class="browser-page"><div class="bp-nav"><b></b><span></span><span></span><span></span><em></em></div>' +
      '<div class="bp-hero"><div><span class="l1"></span><span class="l2"></span><span class="l3"></span><em>Book now</em></div><div class="bp-img"></div></div>' +
      '<div class="bp-cards"><span></span><span></span><span></span></div></div>' +
      '<div class="browser-chip">' + TICK + ' Admin panel · changes saved</div></div>';
    if (kind === "crm") {
      const col = (name, n, cards) => '<div class="crm-col"><div class="crm-h"><span>' + name + '</span><b>' + n + '</b></div>' + cards.map(c => '<div class="crm-card"><b>' + c[0] + '</b><span class="crm-src s-' + c[1].toLowerCase() + '">' + c[1] + '</span><small>' + c[2] + '</small></div>').join("") + '</div>';
      return '<div class="panel crm"><div class="panel-h"><span>Leads pipeline</span><span class="pill">Example</span></div><div class="crm-board">' +
        col("New", 12, [["Ritu, Salon", "WhatsApp", "Reply today"], ["Arjun, Clinic", "Website", "Call 4 pm"]]) +
        col("Follow-up", 8, [["Meera, School", "Call", "Send quote"], ["Kabir, Gym", "WhatsApp", "Demo Fri"]]) +
        col("Won", 3, [["Sana, Bakery", "Website", "Onboarding"]]) +
        '</div><div class="small-note">Sample board. Names and numbers are illustrative.</div></div>';
    }
    if (kind === "growth") return '<div class="panel"><div class="panel-h"><span>Leads by channel</span><span class="pill">Example</span></div><div class="bars"><div><b style="height:78px"></b>Search</div><div><b style="height:112px"></b>WhatsApp</div><div><b style="height:60px"></b>Social</div><div><b style="height:92px"></b>Ads</div></div><div class="small-note">Illustrative figures.</div></div>';
    const ini = esc((st.brand || "V").trim().charAt(0));
    return '<div class="phone"><div class="phone-top"><span class="av">' + ini + '</span><span>' + brand + '<small>Business account</small></span></div><div class="thread">' +
      '<div class="bub out pop">Hi Priya 👋 Your festive offer is ready: 20% off all orders this week.<span class="tpl-btn">View offer</span><span class="meta">10:02 ' + TICK + '</span></div>' +
      '<div class="bub pop">Is it valid on combos too?<span class="meta">10:04</span></div>' +
      '<div class="bub out pop">Yes, on every combo. Want me to reserve one for pickup?<span class="meta">10:04 ' + TICK + '</span></div>' +
      '<div class="bub pop">Yes please, 2 of them 🙌<span class="meta">10:05</span></div></div></div>';
  }

  /* ---------- header, nav, sections ---------- */
  const sectionById = Object.fromEntries(S.sections.map(s => [s.id, s]));
  function renderChrome() {
    $("logo").innerHTML = (st.logo ? '<img src="' + esc(st.logo) + '" alt="">' : '<span class="logo-mark">' + TICK + '</span>') +
      '<span>' + esc(st.brand) + (st.logoSub ? '<small>' + esc(st.logoSub) + '</small>' : '') + '</span>';
    const navLinks = S.sections.filter(s => s.visible && s.inNav && sectionHasContent(s.id)).map(s => '<a href="/#' + esc(s.id) + '" data-sec="' + esc(s.id) + '">' + esc(s.label) + '</a>');
    const contact = sectionById.contact;
    if (st.navCta && contact && contact.visible) navLinks.push('<a class="btn btn-accent btn-small" href="/#contact" data-sec="contact">' + esc(st.navCta) + '</a>');
    $("nav").innerHTML = navLinks.join("");

    // order + visibility + headings
    const wrap = $("sections");
    S.sections.forEach(sec => {
      const el = wrap.querySelector('[data-section="' + sec.id + '"]');
      if (!el) return;
      wrap.appendChild(el);
      el.hidden = !sec.visible || !sectionHasContent(sec.id);
      const head = el.querySelector(".sec-head");
      if (head) head.innerHTML = '<div>' + (sec.eyebrow ? '<div class="eyebrow">' + esc(sec.eyebrow) + '</div>' : '') + '<h2>' + esc(sec.heading) + '</h2></div><p>' + esc(sec.intro) + '</p>';
    });
    if (contact) {
      $("ctEyebrow").textContent = contact.eyebrow; $("ctHeading").textContent = contact.heading; $("ctText").textContent = contact.intro;
    }
    // first visible block after the stats strip gets top spacing only
  }
  function sectionHasContent(id) {
    return ({ stats: lines(st.stats).length, services: S.services.length, process: S.steps.length, reviews: S.testimonials.length, blog: S.posts.length, faq: S.faqs.length, contact: 1 })[id] > 0;
  }

  /* ---------- hero slider ---------- */
  let cur = 0, timer = null;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function slideHref(s) {
    if (s.target === "custom link") return safeUrl(s.link);
    if (s.target === "whatsapp") return waLink(S.widget.prefill || "Hi, I'd like to know more about your services.") || "/#contact";
    return "/#" + (s.target || "contact");
  }
  function renderHero() {
    const slides = S.slides;
    $("slides").innerHTML = slides.length ? slides.map((s, i) => {
      const href = slideHref(s), ext = /^https?:/.test(href);
      return '<div class="slide' + (i === 0 ? " on" : "") + '" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' of ' + slides.length + '"' + (i === 0 ? "" : ' aria-hidden="true"') + '>' +
        '<div class="slide-copy">' + (s.eyebrow ? '<div class="eyebrow">' + esc(s.eyebrow) + '</div>' : '') + (i === 0 ? '<h1>' : '<h2 class="h1">') + esc(s.title) + (i === 0 ? '</h1>' : '</h2>') + '<p>' + esc(s.text) + '</p>' +
        '<div class="slide-ctas">' + (s.cta ? '<a class="btn btn-accent" href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(s.cta) + ' →</a>' : '') +
        (s.cta2 ? '<a class="btn btn-ghost" href="/#services">' + esc(s.cta2) + '</a>' : '') + '</div></div>' +
        '<div class="slide-visual">' + visual(s.visual, s) + '</div></div>';
    }).join("") : '<div class="slide on"><div class="slide-copy"><h1>' + esc(st.tagline) + '</h1></div></div>';
    $("dots").innerHTML = slides.map((s, i) => '<button class="dot' + (i === 0 ? " on" : "") + '" role="tab" aria-selected="' + (i === 0) + '" data-i="' + i + '">' + (i === 0 ? TICK : TICK1) + '<span class="lbl">' + esc(s.eyebrow || ("Slide " + (i + 1))) + '</span></button>').join("");
    $("heroFoot").hidden = slides.length < 2;
    $("heroNote").textContent = st.heroNote || "";
  }
  function go(i) {
    const n = S.slides.length; if (!n) return;
    cur = (i + n) % n;
    document.querySelectorAll(".slide").forEach((el, k) => { el.classList.toggle("on", k === cur); k === cur ? el.removeAttribute("aria-hidden") : el.setAttribute("aria-hidden", "true"); });
    document.querySelectorAll(".dot").forEach((el, k) => { el.classList.toggle("on", k === cur); el.setAttribute("aria-selected", k === cur); el.firstElementChild.outerHTML = k === cur ? TICK : TICK1; });
    const on = document.querySelector(".slide.on");
    if (on) on.querySelectorAll(".bub.pop").forEach(b => { b.style.animation = "none"; void b.offsetWidth; b.style.animation = ""; });
  }
  const startAuto = () => { stopAuto(); if (!reduce && S.slides.length > 1) timer = setInterval(() => go(cur + 1), 6500); };
  const stopAuto = () => { if (timer) clearInterval(timer); timer = null; };

  /* ---------- sections ---------- */
  function renderSections() {
    const stats = lines(st.stats).map(l => l.split("|"));
    $("stats").innerHTML = stats.map(p => '<div class="stat"><b>' + esc(p[0].trim()) + '</b><span>' + esc((p[1] || "").trim()) + '</span></div>').join("");

    $("svcGrid").innerHTML = S.services.map(v => {
      const pts = lines(v.points).map(p => '<li>' + TICK + '<span>' + esc(p) + '</span></li>').join("");
      const body = '<div class="svc-ic">' + (ICONS[v.icon] || ICONS.star) + '</div><div class="tag">' + esc(v.tag) + '</div><h3>' + esc(v.name) + '</h3><p>' + esc(v.summary) + '</p><ul>' + pts + '</ul>';
      return v.featured
        ? '<article class="svc featured"><div class="svc-body">' + body + (v.cta ? '<div><a class="btn btn-accent btn-small" href="/#contact" data-service="' + esc(v.name) + '">' + esc(v.cta) + ' →</a></div>' : '') + '</div>' + visual(({ web: "website", crm: "crm", app: "growth", bot: "chat", star: "software" })[v.icon] || v.icon, v) + '</article>'
        : '<article class="svc">' + body + '</article>';
    }).join("");

    $("steps").innerHTML = S.steps.map(p => '<div class="step"><div class="stage">' + TICK + esc(p.stage) + '</div><h3>' + esc(p.title) + '</h3><p>' + esc(p.text) + '</p></div>').join("");
    setStepCols();

    $("quotes").innerHTML = S.testimonials.map(t => {
      const ini = (t.name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
      const stars = t.rating ? '<div class="stars" aria-label="' + esc(t.rating) + ' out of 5 stars">' + "★".repeat(+t.rating) + "☆".repeat(5 - t.rating) + '</div>' : '';
      return '<figure class="quote" style="margin:0">' + (t.sample ? '<span class="sample-chip">Sample · replace with a real review</span>' : '') + stars +
        '<blockquote>“' + esc(t.quote) + '”</blockquote><footer>' + (t.photo ? '<img class="quote-photo" src="' + esc(t.photo) + '" alt="" loading="lazy">' : '<span class="av">' + esc(ini) + '</span>') +
        '<div><b>' + esc(t.name) + '</b><span>' + esc(t.role) + '</span></div></footer></figure>';
    }).join("");

    $("posts").innerHTML = S.posts.map(p => '<a class="post" href="/blog/' + esc(p.slug) + '" data-post="' + esc(p.slug) + '" style="text-decoration:none">' + cover(p) +
      '<div class="post-body"><div class="meta-line"><span>' + esc(p.category) + '</span><span>' + fmtDate(p.date) + '</span><span>' + esc(p.readTime) + '</span></div><h3>' + esc(p.title) + '</h3><p>' + esc(p.excerpt) + '</p></div></a>').join("");

    $("faqList").innerHTML = S.faqs.map(f => '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join("");

    const ls = [];
    if (st.whatsapp) ls.push(["WhatsApp", "+" + waNumber(st.whatsapp), waLink(S.widget.prefill || "")]);
    if (st.phone) ls.push(["Call", st.phone, "tel:" + st.phone.replace(/[^\d+]/g, "")]);
    if (st.email) ls.push(["Email", st.email, "mailto:" + st.email]);
    if (st.hours) ls.push(["Hours", st.hours]);
    if (st.address) ls.push(["Address", st.address]);
    $("ctLines").innerHTML = ls.map(l => '<div class="cline"><span class="k">' + esc(l[0]) + '</span>' + (l[2] ? '<a class="v" href="' + esc(l[2]) + '"' + (/^https/.test(l[2]) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(l[1]) + '</a>' : '<span class="v">' + esc(l[1]).replace(/\n/g, "<br>") + '</span>') + '</div>').join("");
    $("fSvc").innerHTML = S.services.map(v => '<option>' + esc(v.name) + '</option>').join("") + '<option>Not sure yet</option>';
    $("fSubmit").textContent = st.contactButton || "Send my enquiry";

    const social = lines(st.social).map(l => l.split("|")).filter(p => p[1]);
    $("foot").innerHTML = '<div style="display:grid;gap:6px;max-width:44ch"><b style="color:var(--ink);font-family:var(--display);font-size:18px">' + esc(st.brand) + '</b><span>' + esc(st.footer) + '</span><span>© ' + new Date().getFullYear() + ' ' + esc(st.brand) + '</span></div>' +
      '<div style="display:grid;gap:12px;justify-items:end"><nav aria-label="Footer">' + S.sections.filter(s => s.visible && s.inNav && sectionHasContent(s.id)).map(s => '<a href="/#' + esc(s.id) + '" data-sec="' + esc(s.id) + '">' + esc(s.label) + '</a>').join("") + (sectionById.contact && sectionById.contact.visible ? '<a href="/#contact" data-sec="contact">Contact</a>' : '') + '</nav>' +
      (social.length ? '<div class="social">' + social.map(p => '<a href="' + esc(safeUrl(p[1].trim())) + '" target="_blank" rel="noopener">' + esc(p[0].trim()) + '</a>').join("") + '</div>' : '') + '</div>';
  }
  function setStepCols() { $("steps").style.gridTemplateColumns = window.innerWidth > 860 && S.steps.length ? "repeat(" + S.steps.length + ",1fr)" : ""; }
  function cover(p) {
    if (p.cover) return '<div class="post-cover"><img src="' + esc(p.cover) + '" alt="" loading="lazy"></div>';
    return '<div class="post-cover"><span class="glyph">' + (ICONS[p.visual] || ICONS.star).replace("<svg ", '<svg style="width:54px;height:54px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round" ') + TICK + '</span></div>';
  }
  function fmtDate(d) { if (!d) return ""; const x = new Date(d + "T00:00:00"); return isNaN(x) ? esc(d) : x.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  function inline(t) {
    return esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => '<a href="' + esc(safeUrl(url.replace(/&amp;/g, "&"))) + '"' + (/^https?:/.test(url) ? ' target="_blank" rel="noopener"' : '') + '>' + txt + '</a>');
  }
  function mdLite(t) {
    return String(t || "").split(/\n\s*\n/).map(b => {
      b = b.trim(); if (!b) return "";
      if (b.startsWith("## ")) return "<h2>" + inline(b.slice(3)) + "</h2>";
      if (b.split("\n").every(l => l.trim().startsWith("- "))) return "<ul>" + b.split("\n").map(l => "<li>" + inline(l.trim().slice(2)) + "</li>").join("") + "</ul>";
      return "<p>" + inline(b).replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }

  /* ---------- blog article view (real URLs: /blog/slug) ---------- */
  const homeTitle = document.title;
  function showPost(slug, push) {
    const p = S.posts.find(x => x.slug === slug);
    if (!p) return false;
    $("article").innerHTML = '<a class="btn btn-ghost btn-small back" href="/#blog" data-sec="blog">← All posts</a><div class="meta-line"><span>' + esc(p.category) + '</span><span>' + fmtDate(p.date) + '</span><span>' + esc(p.readTime) + ' read</span></div><h1>' + esc(p.title) + '</h1><p class="lede">' + esc(p.excerpt) + '</p>' + (p.author ? '<p class="by">By ' + esc(p.author) + '</p>' : '') +
      '<div class="article-cover">' + cover(p) + '</div><div class="article-body">' + mdLite(p.body) + '</div>' +
      '<div class="contact" style="margin-top:24px;grid-template-columns:1fr;padding:32px"><h2 style="font-size:28px">Want this set up for your business?</h2><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-accent" href="/#contact" data-sec="contact">Talk to us →</a>' + (st.whatsapp ? '<a class="btn btn-ghost" href="' + esc(waLink("Hi, I just read \"" + p.title + "\" and want to know more.")) + '" target="_blank" rel="noopener">Chat on WhatsApp</a>' : '') + '</div></div>';
    $("homeView").hidden = true; $("offerView").hidden = true; $("articleView").hidden = false;
    document.title = p.title + " | " + st.brand;
    if (push) history.pushState({ post: slug }, "", "/blog/" + slug);
    window.scrollTo(0, 0); stopAuto();
    return true;
  }
  function showHome(sectionId, push) {
    const wasArticle = !$("articleView").hidden || !$("offerView").hidden;
    $("articleView").hidden = true; $("offerView").hidden = true; $("homeView").hidden = false; document.title = homeTitle;
    if (push) history.pushState({}, "", "/" + (sectionId ? "#" + sectionId : ""));
    if (wasArticle || push) startAuto();
    const el = sectionId && document.getElementById(sectionId);
    if (el) el.scrollIntoView(); else if (wasArticle) window.scrollTo(0, 0);
  }
  window.addEventListener("popstate", () => {
    const m = /^\/blog\/([\w-]+)/.exec(location.pathname), mo = /^\/offer\/([\w-]+)/.exec(location.pathname);
    if (m) showPost(m[1], false); else if (mo) showOffer(mo[1], false); else showHome(location.hash.slice(1), false);
  });

  /* ---------- enquiry forms (contact section and offer pages) ---------- */
  async function saveLead(data) {
    if (data.website) return; // the hidden "website" field is a spam trap; bots fill it, people don't
    const C = window.VB_SUPABASE;
    const lead = { name: String(data.name || "").trim().slice(0, 120), phone: String(data.phone || "").trim().slice(0, 30), email: String(data.email || "").trim().slice(0, 160), business: String(data.business || "").trim().slice(0, 160), service: String(data.service || "").slice(0, 120), message: String(data.message || "").trim().slice(0, 3000), source: String(data.source || "").slice(0, 200), opt_in: data.opt_in === "yes" };
    const r = await fetch(C.url + "/rest/v1/leads", { method: "POST", headers: { apikey: C.key, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(lead) });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(/too many/i.test(j.message || "") ? j.message : "We couldn't send your enquiry.");
    }
  }
  function bindLeadForm(form, opts) {
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const out = form.querySelector(".form-out"), btn = form.querySelector("button[type=submit]"), label = btn.textContent;
      const data = Object.fromEntries(new FormData(form).entries());
      data.source = location.pathname;
      if (opts.service) data.service = opts.service;
      if (!String(data.name || "").trim()) { out.innerHTML = '<p class="err">Please add your name.</p>'; form.querySelector("[name=name]").focus(); return; }
      if (!String(data.phone || "").trim() && !String(data.email || "").trim()) { out.innerHTML = '<p class="err">Add a phone number or email so we can reply.</p>'; form.querySelector("[name=phone]").focus(); return; }
      btn.disabled = true; btn.textContent = "Sending…";
      try {
        await saveLead(data);
        const text = "Hi " + st.brand + ", I'm " + data.name + (data.business ? " from " + data.business : "") + ". I'm interested in " + data.service + "." + (data.message ? "\n\n" + data.message : "");
        const wl = waLink(text);
        out.innerHTML = '<div class="ok"><p>' + esc(opts.success || st.contactSuccess || "Thanks! We'll be in touch soon.") + '</p>' + (wl ? '<div><a class="btn btn-accent btn-small" href="' + esc(wl) + '" target="_blank" rel="noopener">Also message us on WhatsApp →</a></div>' : '') + '</div>';
        form.reset();
      } catch (err) {
        out.innerHTML = '<p class="err">' + esc(err.message) + ' Please try again' + (st.whatsapp ? ' or message us on WhatsApp.' : '.') + '</p>';
      } finally { btn.disabled = false; btn.textContent = label; }
    });
  }
  bindLeadForm($("leadForm"), {});

  /* ---------- festival offers ---------- */
  const OFFERS = S.offers || [];
  const FEST = { diwali: "🪔", holi: "🎨", navratri: "🔱", eid: "🌙", christmas: "🎄", "new-year": "🎆", "independence-day": "🇮🇳", general: "✨" };
  const todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  function offerState(o) {
    const t = todayStr();
    if (o.startDate && t < o.startDate) return "upcoming";
    if (o.endDate && t > o.endDate) return "ended";
    return "live";
  }
  const liveOffers = () => OFFERS.filter(o => o.showOnHome && offerState(o) === "live");
  function countdown(o) {
    if (!o.endDate) return "";
    const end = new Date(o.endDate + "T23:59:59"), ms = end - Date.now();
    if (ms <= 0) return "Offer ended";
    const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
    return "Ends in " + (d ? d + (d === 1 ? " day " : " days ") : "") + h + " hr" + (d ? "" : " " + m + " min");
  }
  function renderOffers() {
    const live = liveOffers();
    const bar = $("offerBar");
    if (live.length) {
      const o = live.slice().sort((a, b) => (a.endDate || "9999").localeCompare(b.endDate || "9999"))[0];
      bar.innerHTML = '<div class="wrap offer-bar-row"><span class="ob-ic" aria-hidden="true">' + (FEST[o.festival] || "✨") + '</span><span class="ob-text"><b>' + esc(o.barText || o.title) + '</b>' + (o.discount ? ' · ' + esc(o.discount) : '') + (o.endDate ? '<span class="ob-end"> · ' + esc(countdown(o)) + '</span>' : '') + '</span><a class="ob-link" href="/offer/' + esc(o.slug) + '" data-offer="' + esc(o.slug) + '">View offer →</a></div>';
      bar.dataset.fest = o.festival; bar.hidden = false;
    } else bar.hidden = true;
    const strip = $("offers");
    if (live.length) {
      strip.innerHTML = '<div class="sec-head"><div><div class="eyebrow">Festival offers</div><h2>Offers running now</h2></div><p>Limited-time packages for the festive season. Tap an offer to see what is included and enquire.</p></div><div class="offer-cards">' +
        live.map(o => '<a class="offer-card" data-fest="' + esc(o.festival) + '" href="/offer/' + esc(o.slug) + '" data-offer="' + esc(o.slug) + '"><span class="oc-badge">' + (FEST[o.festival] || "✨") + ' ' + esc(o.badge || "Festival offer") + '</span><h3>' + esc(o.title) + '</h3>' + (o.discount ? '<b class="oc-disc">' + esc(o.discount) + '</b>' : '') + '<p>' + esc(o.subtitle) + '</p><span class="oc-foot"><span>' + esc(o.endDate ? "Valid till " + fmtDate(o.endDate) : "Limited period") + '</span><span class="oc-go">View offer →</span></span></a>').join("") + '</div>';
      strip.hidden = false;
    } else strip.hidden = true;
  }
  let offerTimer = null;
  function showOffer(slug, push) {
    const o = OFFERS.find(x => x.slug === slug);
    if (!o) return false;
    const state = offerState(o);
    const callNum = st.phone ? st.phone.replace(/[^\d+]/g, "") : "";
    const wa = waLink("Hi " + st.brand + ", I'm interested in your " + o.title + (o.discount ? " (" + o.discount + ")" : "") + ".");
    const pts = lines(o.points);
    $("offerView").innerHTML =
      '<section class="offer-hero" data-fest="' + esc(o.festival) + '"><div class="wrap offer-hero-grid"><div class="offer-copy">' +
        '<a class="offer-back" href="/" data-sec="top">← ' + esc(st.brand) + '</a>' +
        '<span class="oc-badge">' + (FEST[o.festival] || "✨") + ' ' + esc(o.badge || "Festival offer") + '</span>' +
        '<h1>' + esc(o.headline || o.title) + '</h1>' + (o.subtitle ? '<p class="offer-sub">' + esc(o.subtitle) + '</p>' : '') +
        (state === "ended" ? '<div class="offer-note">This offer has ended. Ask us about our current offers.</div>' : state === "upcoming" ? '<div class="offer-note">This offer starts on ' + esc(fmtDate(o.startDate)) + '.</div>' : '') +
        '<div class="offer-meta">' + (o.endDate ? '<span>Valid till <b>' + esc(fmtDate(o.endDate)) + '</b></span>' : '') + (state === "live" && o.endDate ? '<span class="offer-count" id="offerCount">' + esc(countdown(o)) + '</span>' : '') + '</div>' +
        '<div class="offer-ctas"><a class="btn btn-accent" href="#offerForm" data-jump="offerForm">' + esc(o.ctaLabel || "Claim this offer") + ' →</a>' +
          (callNum ? '<a class="btn btn-ghost" href="tel:' + esc(callNum) + '">Call now</a>' : '') +
          (wa ? '<a class="btn btn-ghost" href="' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp us</a>' : '') + '</div>' +
        (callNum ? '<p class="offer-callline">Or call <b class="sel">' + esc(st.phone) + '</b></p>' : '') +
      '</div><div class="offer-visual">' + (o.image ? '<img src="' + esc(o.image) + '" alt="' + esc(o.title) + '">' : '<div class="offer-poster"><span>' + (FEST[o.festival] || "✨") + '</span><b>' + esc(o.discount || o.title) + '</b>' + (o.priceNote ? '<small>' + esc(o.priceNote) + '</small>' : '') + '</div>') + '</div></div></section>' +
      '<div class="wrap offer-body"><div class="offer-main">' +
        (o.priceNote && o.image ? '<p class="offer-price">' + esc(o.priceNote) + '</p>' : '') +
        (pts.length ? '<h2>What you get</h2><ul class="offer-points">' + pts.map(x => '<li>' + TICK + '<span>' + esc(x) + '</span></li>').join("") + '</ul>' : '') +
        (o.details ? '<div class="article-body offer-details">' + mdLite(o.details) + '</div>' : '') +
        '<div class="offer-about"><h2>Know more about ' + esc(st.brand) + '</h2><p>' + esc(st.tagline) + '</p><div class="offer-links"><a class="btn btn-small btn-ghost-dark" href="/#services" data-sec="services">Our services</a><a class="btn btn-small btn-ghost-dark" href="/#process" data-sec="process">How we work</a><a class="btn btn-small btn-ghost-dark" href="/#blog" data-sec="blog">Read our blog</a><a class="btn btn-small btn-ghost-dark" href="/" data-sec="top">Visit website</a></div></div>' +
      '</div><aside class="offer-side"><form class="offer-form" id="offerForm" novalidate><h2>' + esc(o.formHeading || "Get this offer") + '</h2><p class="help-dark">Share your details and our team will call you back.</p>' +
        '<label for="ofName">Your name<input id="ofName" name="name" type="text" autocomplete="name" required></label>' +
        '<label for="ofPhone">Phone / WhatsApp<input id="ofPhone" name="phone" type="tel" inputmode="tel" autocomplete="tel"></label>' +
        '<label for="ofEmail">Email (optional)<input id="ofEmail" name="email" type="email" autocomplete="email"></label>' +
        '<label for="ofBiz">Business name<input id="ofBiz" name="business" type="text" autocomplete="organization"></label>' +
        '<label for="ofMsg">Anything we should know?<textarea id="ofMsg" name="message" rows="3"></textarea></label>' +
        '<label class="optin" for="ofOptin"><input type="checkbox" id="ofOptin" name="opt_in" value="yes"> Send me offers and reminders on WhatsApp</label>' +
        '<label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>' +
        '<button class="btn btn-accent" type="submit">' + esc(o.ctaLabel || "Claim this offer") + '</button><div class="form-out" aria-live="polite"></div></form></aside></div>';
    bindLeadForm($("offerForm"), { service: ("Offer: " + o.title).slice(0, 120), success: "Thanks! We've received your request for " + o.title + ". Our team will contact you shortly." });
    $("homeView").hidden = true; $("articleView").hidden = true; $("offerView").hidden = false;
    document.title = o.title + " | " + st.brand;
    if (push) history.pushState({ offer: slug }, "", "/offer/" + slug);
    window.scrollTo(0, 0); stopAuto();
    clearInterval(offerTimer);
    if (state === "live" && o.endDate) offerTimer = setInterval(() => { const c = $("offerCount"); if (c) c.textContent = countdown(o); else clearInterval(offerTimer); }, 30000);
    return true;
  }

  /* ---------- built-in WhatsApp widget ---------- */
  function renderWidget() {
    const w = S.widget;
    if (!w || w.mode !== "built-in") return;
    const agents = lines(w.agents).map(l => l.split("|").map(x => x.trim())).filter(a => waNumber(a[1]));
    if (!agents.length && !waNumber(st.whatsapp)) return; // nothing to connect to yet
    const root = $("waWidget");
    root.className = "wa " + (w.position === "left" ? "left" : "right") + (w.showMobile ? "" : " hide-m") + (w.showDesktop ? "" : " hide-d");
    if (w.color) root.style.setProperty("--wa", w.color);
    let open = false;
    const bubbles = String(w.greeting || "").split(/\n\s*\n/).filter(x => x.trim());
    const time = new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    function draw() {
      const avatar = w.agentPhoto ? '<img src="' + esc(w.agentPhoto) + '" alt="">' : '<span class="av">' + esc((w.agentName || st.brand || "V").charAt(0)) + '</span>';
      root.innerHTML = (open ? '<div class="wa-card" role="dialog" aria-label="Chat on WhatsApp">' +
        '<div class="wa-head">' + avatar + '<div><b>' + esc(w.agentName || st.brand) + '</b><small>' + esc(w.status) + '</small></div><button type="button" data-wa="close" aria-label="Close chat">×</button></div>' +
        '<div class="wa-body">' + bubbles.map(b => '<div class="bub">' + esc(b).replace(/\n/g, "<br>") + '<span class="meta">' + time + '</span></div>').join("") + '</div>' +
        (agents.length ? '<div class="wa-agents">' + agents.map(a => '<a class="wa-agent" href="' + esc(waLink(a[2] || w.prefill, a[1])) + '" target="_blank" rel="noopener">' + WA_ICON + esc(a[0]) + '</a>').join("") + '</div>'
          : '<form class="wa-input" data-wa="form"><input id="waText" type="text" aria-label="Your message" value="' + esc(w.prefill) + '"><button type="submit" aria-label="Open in WhatsApp"><svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg></button></form>') +
        '<div class="wa-foot">Opens WhatsApp</div></div>' : '') +
        '<button type="button" class="wa-btn' + (w.buttonLabel ? '' : ' round') + '" data-wa="toggle" aria-expanded="' + open + '" aria-label="' + esc(w.buttonLabel || "Chat on WhatsApp") + '">' + WA_ICON + (w.buttonLabel ? '<span class="lbl">' + esc(w.buttonLabel) + '</span>' : '') + (!open && !seen() ? '<span class="badge">1</span>' : '') + '</button>';
    }
    const seen = () => { try { return sessionStorage.getItem("vb_wa_seen") === "1"; } catch (_) { return false; } };
    const markSeen = () => { try { sessionStorage.setItem("vb_wa_seen", "1"); } catch (_) {} };
    root.addEventListener("click", e => {
      const t = e.target.closest("[data-wa]"); if (!t) return;
      if (t.dataset.wa === "toggle") { open = !open; markSeen(); draw(); if (open) { const i = $("waText"); if (i) i.focus(); } }
      if (t.dataset.wa === "close") { open = false; draw(); }
    });
    root.addEventListener("submit", e => {
      e.preventDefault();
      const link = waLink($("waText").value.trim() || w.prefill);
      window.open(link, "_blank", "noopener");
    });
    setTimeout(() => {
      draw();
      if (+w.autoOpen > 0 && !seen()) setTimeout(() => { if (!open) { open = true; markSeen(); draw(); } }, +w.autoOpen * 1000);
    }, Math.max(0, +w.delay || 0) * 1000);
  }

  /* ---------- events ---------- */
  document.addEventListener("click", e => {
    const a = e.target.closest("a");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
    if (a.dataset.post) { e.preventDefault(); showPost(a.dataset.post, true); return; }
    if (a.dataset.offer) { e.preventDefault(); showOffer(a.dataset.offer, true); return; }
    if (a.dataset.jump) { e.preventDefault(); const el = document.getElementById(a.dataset.jump); if (el) { el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); const f = el.querySelector("input"); if (f) setTimeout(() => f.focus({ preventScroll: true }), 400); } return; }
    if (a.dataset.sec === "top") { e.preventDefault(); showHome("", true); window.scrollTo(0, 0); return; }
    if (a.dataset.sec || (a.getAttribute("href") || "").startsWith("/#")) {
      e.preventDefault();
      const id = a.dataset.sec || a.getAttribute("href").slice(2);
      if (!$("articleView").hidden || !$("offerView").hidden) showHome(id, true);
      else { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); history.replaceState({}, "", "/#" + id); }
      if (a.dataset.service) { const o = [...$("fSvc").options].find(x => x.value === a.dataset.service); if (o) $("fSvc").value = o.value; }
      $("nav").classList.remove("open"); $("menuBtn").setAttribute("aria-expanded", "false");
    }
  });
  $("menuBtn").addEventListener("click", () => { const o = $("nav").classList.toggle("open"); $("menuBtn").setAttribute("aria-expanded", o); });
  $("dots").addEventListener("click", e => { const d = e.target.closest(".dot"); if (d) { go(+d.dataset.i); startAuto(); } });
  $("prev").addEventListener("click", () => { go(cur - 1); startAuto(); });
  $("next").addEventListener("click", () => { go(cur + 1); startAuto(); });
  const hero = document.querySelector(".hero");
  hero.addEventListener("mouseenter", stopAuto); hero.addEventListener("mouseleave", startAuto);
  hero.addEventListener("focusin", stopAuto);
  hero.addEventListener("keydown", e => { if (e.key === "ArrowLeft") go(cur - 1); if (e.key === "ArrowRight") go(cur + 1); });
  let sx = null;
  hero.addEventListener("pointerdown", e => { sx = e.clientX; });
  hero.addEventListener("pointerup", e => { if (sx != null && Math.abs(e.clientX - sx) > 50) { go(cur + (e.clientX < sx ? 1 : -1)); startAuto(); } sx = null; });
  $("qPrev").addEventListener("click", () => $("quotes").scrollBy({ left: -$("quotes").clientWidth * .8, behavior: "smooth" }));
  $("qNext").addEventListener("click", () => $("quotes").scrollBy({ left: $("quotes").clientWidth * .8, behavior: "smooth" }));
  window.addEventListener("resize", setStepCols);

  /* ---------- boot ---------- */
  renderChrome(); renderHero(); renderSections(); renderOffers(); renderWidget();
  if (window.__POST__ && showPost(window.__POST__, false)) { /* article view */ }
  else if (window.__OFFER__ && showOffer(window.__OFFER__, false)) { /* offer page */ }
  else { startAuto(); if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) setTimeout(() => el.scrollIntoView(), 50); } }
}

if (window.__SITE__) vbStart();
else if (window.VBContent) window.VBContent.load().then(data => { window.__SITE__ = data; vbStart(); }).catch(err => {
  console.error(err);
  const m = document.getElementById("slides");
  if (m) m.innerHTML = '<div class="slide on"><div class="slide-copy"><h1>We\'ll be right back</h1><p>The site couldn\'t load its content. Please refresh the page in a moment.</p></div></div>';
});
