/* Vivid Brandify admin panel (no framework). Data goes through supabase-api.js. */
(function () {
  "use strict";
  const app = document.getElementById("app");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const val = id => document.getElementById(id).value;
  const clone = o => JSON.parse(JSON.stringify(o));
  const TICK = '<svg viewBox="0 0 18 11"><path d="M1 6l3.5 3.5L11 2"/><path d="M7 9.5L15.5 1"/></svg>';

  const S = { user: null, schema: null, content: null, view: "dashboard", sel: null, draft: null, dirty: false, leads: [], media: [], dash: null, pendingDel: null, leadFilter: { q: "", status: "", stage: "", type: "", service: "", priority: "", owner: "" } };

  /* ---------- API ---------- */
  async function api(method, path, body) {
    try { return await window.VBApi.call(method, path, body); }
    catch (e) {
      if (e.status === 401 && path !== "login" && path !== "state") { S.user = null; renderAuth(false); throw new Error("Your session ended. Please sign in again."); }
      throw e;
    }
  }
  let toastT;
  function toast(msg, err) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.className = "toast" + (err ? " err" : ""); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, err ? 5000 : 2200);
  }

  /* ---------- auth screens ---------- */
  async function boot() {
    try {
      const st = await api("GET", "state");
      if (st.user) { S.user = st.user; await loadAll(); renderShell(); }
      else renderAuth(st.needsSetup);
    } catch (e) { app.innerHTML = '<div class="boot">Couldn\'t reach the server: ' + esc(e.message) + '</div>'; }
  }
  function renderAuth(setup) {
    app.innerHTML = '<div class="auth"><form class="auth-card" id="authForm">' +
      '<img class="auth-logo" src="/assets/brand/logo.png" alt="Vivid Brandify" width="140" height="90">' +
      (setup ? '<h1>Create the admin account</h1><p>First-time setup. Enter the setup code you were given, then choose the email and password you will sign in with.</p>' +
        fld("setupCode", "Setup code", '<input id="setupCode" type="text" autocomplete="off" required>') +
        fld("name", "Your name", '<input id="name" type="text" autocomplete="name">') : '<h1>Sign in</h1><p>Manage the website, blog, leads and WhatsApp widget.</p>') +
      fld("email", "Email", '<input id="email" type="email" autocomplete="username" required>') +
      fld("password", "Password", '<input id="password" type="password" autocomplete="' + (setup ? "new-password" : "current-password") + '" required minlength="8">' + (setup ? '<span class="hint">At least 8 characters</span>' : '')) +
      '<div class="err-text" id="authErr" aria-live="polite"></div>' +
      '<button class="btn btn-p" type="submit">' + (setup ? "Create account" : "Sign in") + '</button></form></div>';
    document.getElementById("authForm").addEventListener("submit", async e => {
      e.preventDefault();
      const v = id => (document.getElementById(id) || {}).value || "";
      try {
        const r = setup ? await api("POST", "setup", { setupCode: v("setupCode"), name: v("name"), email: v("email"), password: v("password") })
          : await api("POST", "login", { email: v("email"), password: v("password") });
        S.user = r.user; await loadAll(); renderShell();
      } catch (err) {
        if (err.showLogin) renderAuth(false);
        document.getElementById("authErr").textContent = err.message;
      }
    });
  }
  function fld(id, label, input) { return '<div class="fld"><label for="' + id + '">' + esc(label) + '</label>' + input + '</div>'; }

  async function loadAll() {
    const [schema, content, leads, media, dash, orders, payments] = await Promise.all([api("GET", "schema"), api("GET", "content"), api("GET", "leads"), api("GET", "media"), api("GET", "dashboard"), api("GET", "orders").catch(() => []), api("GET", "order-payments").catch(() => [])]);
    Object.assign(S, { schema, content, leads, media, dash, orders, payments });
    [S.team, S.crm] = await Promise.all([api("GET", "team-directory").catch(() => []), api("GET", "crm-settings").catch(() => ({}))]);
  }

  /* ---------- shell ---------- */
  const NAV = [
    ["", [["dashboard", "Dashboard"]]],
    ["Content", [["slides"], ["offers"], ["services"], ["steps"], ["testimonials"], ["posts"], ["faqs"]]],
    ["Store", [["bizcrt"], ["products"], ["orders", "Orders"], ["payments", "Payments & email"]]],
    ["Layout", [["sections"]]],
    ["WhatsApp", [["widget", "Chat widget"], ["leads", "Leads"], ["automation", "Automation"]]],
    ["Site", [["settings"], ["legal"], ["theme"], ["seo"]]],
    ["Advanced", [["code"], ["media", "Media library"], ["account", "Account & backup"]]],
  ];
  const isStaff = () => !!(S.user && S.user.role === "staff");
  const STAFF_NAV = [["", [["dashboard", "Dashboard"]]], ["Work", [["leads", "Leads"], ["orders", "Orders"]]], ["You", [["account", "My account"]]]];
  const STAFF_VIEWS = ["dashboard", "leads", "orders", "account"];
  const labelOf = v => (isStaff() && v === "account") ? "My account" : baseLabel(v);
  const baseLabel = v => (S.schema[v] && S.schema[v].label) || ({ dashboard: "Dashboard", leads: "Leads", media: "Media library", account: "Account & backup", widget: "WhatsApp chat widget", automation: "WhatsApp automation", orders: "Orders", payments: "Payments & email" })[v] || v;

  function renderShell() {
    const newLeads = S.leads.filter(l => l.status === "new").length;
    app.innerHTML = '<div class="shell"><aside class="side" id="side"><div class="brandmark"><img class="mark-img" src="/assets/brand/favicon.png" alt="" width="36" height="36">' + esc((S.content.settings.brand || "Vivid Brandify")) + '</div>' +
      (isStaff() ? STAFF_NAV : NAV).map(([g, items]) => (g ? '<div class="grp">' + g + '</div>' : '') + items.map(([k, l]) => '<button data-nav="' + k + '" class="' + (S.view === k ? "on" : "") + '">' + esc(l || labelOf(k)) + (k === "leads" && newLeads ? '<span class="n">' + newLeads + '</span>' : '') + '</button>').join("")).join("") +
      '<div class="spacer"></div><div class="me">Signed in as ' + esc(S.user.email) + '<br><span class="pill" style="margin-top:6px;display:inline-block">' + (isStaff() ? "Staff" : "Admin") + '</span></div><button data-act="logout">Sign out</button></aside>' +
      '<div class="main"><div class="topbar"><button class="btn btn-g btn-sm menu-t" data-act="menu">Menu</button><h1>' + esc(labelOf(S.view)) + '</h1><div class="sp"></div><a class="btn btn-g btn-sm" id="viewSite" href="' + previewHref() + '" target="_blank" rel="noopener">View site ↗</a></div>' +
      '<div class="content" id="content"></div></div></div>' + '<div id="savebarSlot"></div>';
    renderView();
  }
  function previewHref() {
    if (S.view === "posts" && S.sel && S.draft) { const p = S.draft.find(x => x.id === S.sel); if (p && p.slug && p.published) return "/blog/" + encodeURIComponent(p.slug); }
    if (S.view === "products" && S.sel && S.draft) { const o = S.draft.find(x => x.id === S.sel); if (o && o.slug && o.published) return "/product/" + encodeURIComponent(o.slug); }
    if (S.view === "orders" || S.view === "payments") return "/#store";
    if (S.view === "bizcrt") return "/bizcrt";
    if (S.view === "legal") return "/legal/business";
    if (S.view === "offers" && S.sel && S.draft) { const o = S.draft.find(x => x.id === S.sel); if (o && o.slug && o.published) return "/offer/" + encodeURIComponent(o.slug); }
    const map = { services: "services", steps: "process", testimonials: "reviews", posts: "blog", faqs: "faq" };
    return "/" + (map[S.view] ? "#" + map[S.view] : "");
  }

  function renderView() {
    const c = document.getElementById("content");
    if (isStaff() && !STAFF_VIEWS.includes(S.view)) S.view = "dashboard";
    document.getElementById("savebarSlot").innerHTML = "";
    const sc = S.schema[S.view];
    if (S.view === "dashboard") return renderDashboard(c);
    if (S.view === "leads") return renderLeads(c);
    if (S.view === "media") return renderMedia(c);
    if (S.view === "account") return renderAccount(c);
    if (S.view === "automation") return renderAutomation(c);
    if (S.view === "orders") return renderOrders(c);
    if (S.view === "payments") return renderPayments(c);
    if (sc) {
      if (!S.draft) S.draft = clone(S.content[S.view]);
      if (sc.kind === "list") renderListEditor(c, sc); else renderObjectEditor(c, sc);
      renderSavebar();
    }
  }

  async function navigate(v) {
    if (S.dirty && !(await confirmLeave())) return;
    S.view = v; S.sel = null; S.draft = null; S.dirty = false; S.pendingDel = null; closeLead();
    if (v === "dashboard") { S.dash = await api("GET", "dashboard").catch(() => S.dash); S.leads = await api("GET", "leads").catch(() => S.leads); }
    if (v === "leads") S.leads = await api("GET", "leads").catch(() => S.leads);
    if (v === "orders" || v === "dashboard") { S.orders = await api("GET", "orders").catch(() => S.orders); S.payments = await api("GET", "order-payments").catch(() => S.payments); }
    renderShell();
    window.scrollTo(0, 0);
  }
  function confirmLeave() {
    return new Promise(res => {
      const m = document.createElement("div"); m.className = "modal";
      m.innerHTML = '<div class="box" style="width:min(440px,100%)"><header><h2>Unsaved changes</h2></header><p class="help">You changed "' + esc(labelOf(S.view)) + '" but haven\'t saved.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-p" data-r="save">Save and continue</button><button class="btn btn-d" data-r="discard">Discard changes</button><button class="btn btn-g" data-r="stay">Stay here</button></div></div>';
      document.body.appendChild(m);
      m.addEventListener("click", async e => {
        const r = e.target.dataset.r; if (!r) return;
        m.remove();
        if (r === "save") { const ok = await save(); res(ok); } else res(r === "discard");
      });
    });
  }
  window.addEventListener("beforeunload", e => { if (S.dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- savebar ---------- */
  function renderSavebar() {
    document.getElementById("savebarSlot").innerHTML = '<div class="savebar"><span class="msg' + (S.dirty ? " dirty" : "") + '" id="saveMsg">' + (S.dirty ? "Unsaved changes" : "All changes saved · live on the website") + '</span>' +
      '<button class="btn btn-g" data-act="discard"' + (S.dirty ? "" : " disabled") + '>Discard</button><button class="btn btn-p" data-act="save"' + (S.dirty ? "" : " disabled") + '>Save changes</button></div>';
  }
  function markDirty() {
    if (S.dirty) return; S.dirty = true;
    const m = document.getElementById("saveMsg"); if (m) { m.textContent = "Unsaved changes"; m.className = "msg dirty"; }
    document.querySelectorAll('[data-act="save"],[data-act="discard"]').forEach(b => b.disabled = false);
  }
  async function save() {
    try {
      const r = await api("PUT", "content/" + S.view, { value: S.draft });
      S.content[S.view] = r.value; S.draft = clone(r.value); S.dirty = false;
      toast("Saved. The website is updated.");
      renderShell();
      return true;
    } catch (e) { toast(e.message, true); return false; }
  }

  /* ---------- field rendering ---------- */
  function fieldVisible(view, key, obj) {
    if (view === "widget") {
      const m = obj.mode;
      if (m === "off") return key === "mode";
      if (m === "custom code") return key === "mode" || key === "customCode";
      return key !== "customCode";
    }
    return true;
  }
  function renderField(f, obj, idp) {
    const [k, type, label, opts = {}] = f;
    const v = obj[k]; const id = "f_" + idp + "_" + k; const hint = opts.hint ? '<span class="hint">' + esc(opts.hint) + '</span>' : '';
    if (!fieldVisible(S.view, k, obj)) return "";
    if (type === "check") return '<div class="fld"><label class="chk" for="' + id + '"><input type="checkbox" id="' + id + '" data-k="' + k + '"' + (v ? " checked" : "") + '><span>' + esc(label) + hint + '</span></label></div>';
    if (type === "select") return fld(id, label, '<select id="' + id + '" data-k="' + k + '">' + opts.choices.map(o => '<option value="' + esc(o) + '"' + (o === v ? " selected" : "") + '>' + esc(o || "None") + '</option>').join("") + '</select>' + hint);
    if (type === "textarea" || type === "lines") return fld(id, label, '<textarea id="' + id + '" data-k="' + k + '">' + esc(v) + '</textarea>' + hint);
    if (type === "tall") return fld(id, label, '<textarea class="tall" id="' + id + '" data-k="' + k + '">' + esc(v) + '</textarea>' + hint);
    if (type === "code") return fld(id, label, '<textarea class="code" spellcheck="false" id="' + id + '" data-k="' + k + '">' + esc(v) + '</textarea>' + hint);
    if (type === "color") return '<div class="fld"><span class="lb">' + esc(label) + '</span><div class="color"><input type="color" data-k="' + k + '" data-sync="' + id + '" value="' + esc(v || "#000000") + '" aria-label="' + esc(label) + '"><input type="text" id="' + id + '" data-k="' + k + '" value="' + esc(v) + '" placeholder="#RRGGBB"></div>' + hint + '</div>';
    if (type === "image") return '<div class="fld"><span class="lb">' + esc(label) + '</span><div class="img"><div class="prev" style="' + (v ? "background-image:url('" + esc(v) + "')" : "") + '">' + (v ? "" : "No image") + '</div>' +
      '<label class="btn btn-s btn-sm">Upload<input type="file" accept="image/*" hidden data-upload="' + k + '"></label><button type="button" class="btn btn-g btn-sm" data-pick="' + k + '">Choose from library</button>' + (v ? '<button type="button" class="btn btn-g btn-sm" data-clear="' + k + '">Remove</button>' : '') + '</div>' + hint + '</div>';
    if (type === "number") return fld(id, label, '<input type="number" min="0" id="' + id + '" data-k="' + k + '" value="' + esc(v) + '">' + hint);
    if (type === "date") return fld(id, label, '<input type="date" id="' + id + '" data-k="' + k + '" value="' + esc(v) + '">' + hint);
    return fld(id, label, '<input type="text" id="' + id + '" data-k="' + k + '" value="' + esc(v) + '">' + hint);
  }

  /* ---------- object editor ---------- */
  function renderObjectEditor(c, sc) {
    c.innerHTML = (sc.help ? '<p class="help">' + esc(sc.help) + '</p>' : '') +
      (S.view === "widget" ? widgetNote() : '') +
      '<div class="card"><div class="form" id="objForm">' + sc.fields.map(f => renderField(f, S.draft, "o")).join("") + '</div></div>';
  }
  function widgetNote() {
    const w = S.draft, hasNum = !!S.content.settings.whatsapp || !!(w.agents || "").trim();
    if (w.mode === "built-in" && !hasNum) return '<div class="card" style="border-color:var(--warn)"><b>The chat bubble is hidden until you add a WhatsApp number.</b><p class="help">Add it in Site → Brand & contact, or list departments below.</p></div>';
    if (w.mode === "custom code") return '<div class="card"><b>Paste your provider\'s widget code below.</b><p class="help">It is added to every page just before &lt;/body&gt;, exactly as pasted. Only paste code from a provider you trust.</p></div>';
    return "";
  }

  /* ---------- list editor ---------- */
  function itemTitle(sc, it) {
    const t = it[sc.titleField] || "(untitled)";
    let tags = "";
    if (S.view === "slides" && !it.active) tags += '<span class="tagp off">hidden</span>';
    if ((S.view === "posts" || S.view === "products") && !it.published) tags += '<span class="tagp off">draft</span>';
    if (S.view === "testimonials" && it.sample) tags += '<span class="tagp warn">sample</span>';
    if (S.view === "sections" && !it.visible) tags += '<span class="tagp off">hidden</span>';
    if (S.view === "services" && it.featured) tags += '<span class="tagp warn">featured</span>';
    if (S.view === "offers") { const os = offerStatus(it); tags += '<span class="tagp ' + (os === "live" ? "live" : os === "draft" || os === "ended" ? "off" : "warn") + '">' + os + '</span>'; }
    return esc(t) + tags + (S.view === "posts" ? '<small>' + esc(it.date) + ' · /blog/' + esc(it.slug || "…") + '</small>' : S.view === "offers" ? '<small>' + esc(it.startDate || "now") + ' → ' + esc(it.endDate || "no end date") + ' · /offer/' + esc(it.slug || "…") + '</small>' : S.view === "products" ? '<small>' + String(it.plans || "").split("\n").filter(l => l.trim()).length + ' plan(s) · /product/' + esc(it.slug || "…") + '</small>' : '');
  }
  const todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  function offerStatus(o) {
    if (!o.published) return "draft";
    const t = todayStr();
    if (o.startDate && t < o.startDate) return "scheduled";
    if (o.endDate && t > o.endDate) return "ended";
    return "live";
  }
  function leadSource(l) {
    const m = /^\/offer\/([\w-]+)/.exec(l.source || "");
    if (m) { const o = (S.content.offers || []).find(x => x.slug === m[1]); return "Offer page: " + (o ? o.title : m[1]); }
    if (/^\/blog\//.test(l.source || "")) return "Blog article";
    if (/^\/product\//.test(l.source || "")) return "Online purchase";
    if (/^\/bizcrt/.test(l.source || "")) return "BizCRT page";
    return "Website contact form";
  }
  const waNum = p => String(p || "").replace(/\D/g, "").replace(/^0+/, "").replace(/^(\d{10})$/, "91$1");
  function followUpsDue() {
    const t = todayStr();
    return S.leads.filter(l => l.followUpOn && l.followUpOn <= t && l.stage !== "won" && l.stage !== "lost").sort((a, b) => a.followUpOn.localeCompare(b.followUpOn));
  }
  function followUpCard() {
    const due = followUpsDue();
    return '<div class="card"><div class="d-card-h"><h2>Follow-ups due</h2>' + (due.length ? '<span class="tagp warn">' + due.length + '</span>' : '') + '</div>' + (due.length ? '<div class="check">' + due.slice(0, 8).map(l => '<div><span class="st st-' + (l.followUpOn < todayStr() ? "lost" : "contacted") + '">' + (l.followUpOn < todayStr() ? "overdue" : "today") + '</span><span style="flex:1;min-width:0"><b>' + esc(l.name) + '</b> · ' + esc(l.service) + '<br><span class="help" style="font-size:13px">' + esc(l.phone || l.email) + '</span></span>' + (l.phone ? '<a class="btn btn-g btn-sm" href="https://wa.me/' + waNum(l.phone) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + '</div>').join("") + '</div>' : '<p class="help">Nothing due. Set a follow-up date on a lead and it shows up here on that day.</p>') + '</div>';
  }
  function renderListEditor(c, sc) {
    const list = S.draft;
    if (!S.sel && list.length) S.sel = list[0].id;
    const it = list.find(x => x.id === S.sel);
    c.innerHTML = (sc.help ? '<p class="help">' + esc(sc.help) + '</p>' : '') +
      '<div class="editor"><div class="items" id="items">' +
      (list.length ? list.map((x, i) => '<div class="item' + (x.id === S.sel ? " sel" : "") + '"><button class="t" data-sel="' + esc(x.id) + '">' + itemTitle(sc, x) + '</button>' +
        '<button class="ib" data-mv="-1" data-id="' + esc(x.id) + '" aria-label="Move up"' + (i ? "" : " disabled") + '>↑</button><button class="ib" data-mv="1" data-id="' + esc(x.id) + '" aria-label="Move down"' + (i < list.length - 1 ? "" : " disabled") + '>↓</button>' +
        (sc.fixed ? "" : S.pendingDel === x.id ? '<span class="confirm"><button class="btn btn-d btn-sm" data-delyes="' + esc(x.id) + '">Delete</button><button class="btn btn-g btn-sm" data-delno>Keep</button></span>' : '<button class="ib" data-del="' + esc(x.id) + '" aria-label="Delete" title="Delete">🗑</button>') + '</div>').join("")
        : '<div class="empty">No ' + esc(sc.noun) + 's yet.</div>') +
      (sc.fixed ? "" : '<button class="btn btn-s" data-act="add">+ Add ' + esc(sc.noun) + '</button>') + '</div>' +
      '<div class="card">' + (it ? '<div class="form" id="objForm">' + sc.fields.map(f => renderField(f, it, it.id)).join("") + '</div>' : '<div class="empty">Select a ' + esc(sc.noun) + ' to edit it.</div>') + '</div></div>';
  }
  function currentObj() { const sc = S.schema[S.view]; return sc.kind === "list" ? S.draft.find(x => x.id === S.sel) : S.draft; }

  /* ---------- dashboard ---------- */
  const IC = {
    inbox: '<svg viewBox="0 0 24 24"><path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    trophy: '<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>',
    gift: '<svg viewBox="0 0 24 24"><path d="M3 9h18v4H3zM5 13h14v8H5zM12 9v12M12 9C9 9 7 4 10 4s2 5 2 5 0-5 2-5 1 5-2 5"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
    wa: '<svg viewBox="0 0 24 24"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.5 2 2.5 4 4.5 4.5l1.2-1.2 2 1-.5 1.7c-3.6.4-7.6-3.6-7.2-7.2l1.7-.5 1 2z"/></svg>',
  };
  const ico = k => '<span class="d-ic" aria-hidden="true">' + IC[k] + '</span>';
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const dayKey = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  function ago(iso) {
    const s = (Date.now() - Date.parse(iso)) / 1000;
    if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + " min ago"; if (s < 86400) return Math.floor(s / 3600) + " h ago";
    if (s < 172800) return "yesterday";
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }
  function greeting() { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; }
  function leadStats() {
    const L = S.leads, now = Date.now(), D = 864e5, t = todayStr();
    const inLast = (from, to) => L.filter(l => { const x = now - Date.parse(l.createdAt); return x >= from * D && x < to * D; }).length;
    const due = followUpsDue();
    return {
      total: L.length, fresh: L.filter(l => l.stage === "new").length,
      waiting: L.filter(l => waitInfo(l)), late: L.filter(l => { const w = waitInfo(l); return w && w.late; }).length,
      avgReply: (() => { const r = L.filter(l => l.firstResponseAt && now - Date.parse(l.createdAt) < 30 * D).map(l => (Date.parse(l.firstResponseAt) - Date.parse(l.createdAt)) / 6e4); return r.length ? Math.round(r.reduce((a, b) => a + b, 0) / r.length) : null; })(),
      openValue: L.filter(l => !["won", "lost"].includes(l.stage)).reduce((a, l) => a + (l.dealValue || 0), 0),
      wonValue: L.filter(l => l.stage === "won").reduce((a, l) => a + (l.dealValue || 0), 0),
      m30: inLast(0, 30), prev30: inLast(30, 60), today: L.filter(l => dayKey(new Date(l.createdAt)) === t).length,
      won: L.filter(l => l.stage === "won").length, lost: L.filter(l => l.stage === "lost").length,
      dueToday: due.filter(l => l.followUpOn === t).length, overdue: due.filter(l => l.followUpOn < t).length,
      optIn: L.filter(l => l.optIn).length,
    };
  }
  function delta(cur, prev) {
    if (!prev && !cur) return '<span class="d-delta flat">No leads yet in the last 60 days</span>';
    if (!prev) return '<span class="d-delta up">▲ New this month</span>';
    const p = Math.round((cur - prev) / prev * 100);
    return '<span class="d-delta ' + (p > 0 ? "up" : p < 0 ? "down" : "flat") + '">' + (p > 0 ? "▲ " : p < 0 ? "▼ " : "") + Math.abs(p) + '% vs previous 30 days</span>';
  }
  function trendChart() {
    const n = S.dashRange || 30, days = [], counts = {};
    S.leads.forEach(l => { const k = dayKey(new Date(l.createdAt)); counts[k] = (counts[k] || 0) + 1; });
    for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ d, k: dayKey(d), v: counts[dayKey(d)] || 0 }); }
    const total = days.reduce((a, x) => a + x.v, 0), peak = Math.max(...days.map(x => x.v));
    const top = Math.max(4, Math.ceil(peak / 4) * 4), every = n <= 7 ? 1 : window.innerWidth < 640 ? (n <= 30 ? 10 : 30) : n <= 30 ? 5 : 15;
    const fmt = d => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return '<div class="card d-chart"><div class="d-card-h"><div><h2>Enquiries</h2><p class="help"><b class="d-big">' + total + '</b> in the last ' + n + ' days' + (total ? ' · busiest day ' + peak : '') + '</p></div>' +
      '<div class="seg" role="group" aria-label="Date range">' + [7, 30, 90].map(r => '<button data-range="' + r + '" class="' + (r === n ? "on" : "") + '" aria-pressed="' + (r === n) + '">' + r + 'D</button>').join("") + '</div></div>' +
      '<div class="bars-wrap"><div class="y-axis">' + [top, top / 2, 0].map(v => '<span>' + v + '</span>').join("") + '</div>' +
      '<div class="bars' + (n > 30 ? " dense" : "") + '" role="img" aria-label="Enquiries per day for the last ' + n + ' days, ' + total + ' in total">' +
      days.map((x, i) => '<div class="bar-col" tabindex="0" data-tip="' + fmt(x.d) + ': ' + x.v + ' enquir' + (x.v === 1 ? "y" : "ies") + '"><i style="height:' + (x.v ? Math.max(3, x.v / top * 100) : 0) + '%"></i>' + ((n - 1 - i) % every === 0 ? '<small>' + (n <= 7 ? x.d.toLocaleDateString("en-IN", { weekday: "short" }) : fmt(x.d)) + '</small>' : '') + '</div>').join("") +
      '</div></div>' + (total ? '' : '<p class="help d-empty-note">New enquiries from your website and offer pages will appear here day by day.</p>') + '</div>';
  }
  function pipelineCard(s) {
    const st = STAGES.map(x => x[0]), lab = STAGE_LABEL;
    const by = k => S.leads.filter(l => l.stage === k).length;
    const closed = s.won + s.lost;
    return '<div class="card"><div class="d-card-h"><h2>Pipeline</h2><button class="btn btn-g btn-sm" data-nav="leads">Open leads</button></div>' +
      '<div class="pipe">' + st.map(k => { const v = by(k); return '<button class="pipe-row" data-lf="stage" data-lv="' + k + '"><span class="stg sg-' + k + '">' + lab[k] + '</span><span class="pipe-bar"><i class="pb-' + k + '" style="width:' + pct(v, s.total) + '%"></i></span><b>' + v + '</b></button>'; }).join("") + '</div>' +
      '<div class="d-foot"><span><b>' + (closed ? pct(s.won, closed) : 0) + '%</b> win rate</span><span><b>' + rs(s.openValue) + '</b> open deals</span><span><b>' + (s.avgReply == null ? "–" : s.avgReply < 60 ? s.avgReply + " min" : Math.round(s.avgReply / 60) + " h") + '</b> avg first reply</span></div></div>';
  }
  function breakdown(title, key, empty, filterKey) {
    const m = {};
    S.leads.forEach(l => { const v = (key === "city" ? String(l.city || "").trim().replace(/\b\w/g, c => c.toUpperCase()) : key === "source" ? leadSource(l).replace(/^Offer page: .*/, "Festival offer pages") : l[key]) || ""; if (v) m[v] = (m[v] || 0) + 1; });
    let rows = Object.entries(m).sort((a, b) => b[1] - a[1]);
    if (rows.length > 6) { const rest = rows.slice(5).reduce((a, r) => a + r[1], 0); rows = rows.slice(0, 5).concat([["Other", rest]]); }
    const max = Math.max(1, ...rows.map(r => r[1])), sum = rows.reduce((a, r) => a + r[1], 0);
    return '<div class="card"><h2>' + esc(title) + '</h2>' + (rows.length ? '<div class="hb">' + rows.map(([k, v]) => {
      const can = filterKey && k !== "Other";
      return '<' + (can ? 'button data-lf="' + filterKey + '" data-lv="' + esc(k) + '"' : 'div') + ' class="hb-row" title="' + esc(k) + ': ' + v + ' (' + pct(v, sum) + '%)"><span class="hb-k">' + esc(k) + '</span><span class="hb-bar"><i style="width:' + (v / max * 100) + '%"></i></span><b>' + v + '</b></' + (can ? 'button' : 'div') + '>';
    }).join("") + '</div>' : '<p class="help">' + esc(empty) + '</p>') + '</div>';
  }
  function latestCard(limit) {
    const recent = S.leads.slice(0, limit);
    return '<div class="card d-latest"><div class="d-card-h"><h2>Latest enquiries</h2><button class="btn btn-g btn-sm" data-nav="leads">View all</button></div>' +
      (recent.length ? '<div class="ll">' + recent.map(l => '<div class="ll-row" data-openrow="' + l.id + '"><span class="av">' + esc((l.name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase()) + '</span>' +
        '<span class="ll-main"><b>' + esc(l.name) + '</b><small>' + esc([l.businessType || l.business, l.city].filter(Boolean).join(" · ") || leadSource(l)) + '</small></span>' +
        '<span class="ll-svc">' + esc(l.service || "–") + '</span><span class="stg sg-' + l.stage + '">' + STAGE_LABEL[l.stage] + '</span><span class="ll-when">' + ago(l.createdAt) + '</span>' +
        (l.phone ? '<a class="ib wa-ib" href="https://wa.me/' + waNum(l.phone) + '" target="_blank" rel="noopener" aria-label="WhatsApp ' + esc(l.name) + '">' + IC.wa + '</a>' : '<span></span>') + '</div>').join("") + '</div>'
        : '<div class="d-empty">' + ico("inbox") + '<p>No enquiries yet. Share your website or a festival offer link on WhatsApp to get the first ones.</p></div>') + '</div>';
  }
  function offersCard() {
    const list = (S.content.offers || []).map(o => Object.assign({ st: offerStatus(o) }, o)).filter(o => o.st !== "ended").sort((a, b) => (a.st === "live" ? 0 : 1) - (b.st === "live" ? 0 : 1));
    const cnt = slug => S.leads.filter(l => (l.source || "").startsWith("/offer/" + slug)).length;
    const left = o => { if (!o.endDate) return "No end date"; const d = Math.ceil((Date.parse(o.endDate + "T23:59:59") - Date.now()) / 864e5); return o.st === "scheduled" ? "Starts " + new Date(o.startDate + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : d <= 0 ? "Ends today" : d + " day" + (d > 1 ? "s" : "") + " left"; };
    return '<div class="card"><div class="d-card-h"><h2>Festival offers</h2><button class="btn btn-g btn-sm" data-act="newoffer">+ New offer</button></div>' +
      (list.length ? '<div class="ofl">' + list.slice(0, 4).map(o => '<div class="ofl-row"><span class="tagp ' + (o.st === "live" ? "live" : o.st === "draft" ? "off" : "warn") + '">' + o.st + '</span><span class="ofl-main"><b>' + esc(o.title) + '</b><small>' + esc(left(o)) + ' · ' + cnt(o.slug) + ' lead' + (cnt(o.slug) === 1 ? "" : "s") + '</small></span>' +
        (o.st === "live" ? '<a class="btn btn-g btn-sm" href="/offer/' + encodeURIComponent(o.slug) + '" target="_blank" rel="noopener">View</a>' : '<button class="btn btn-g btn-sm" data-nav="offers">Edit</button>') + '</div>').join("") + '</div>'
        : '<div class="d-empty">' + ico("gift") + '<p>No offers running. Create one for the next festival and share its link.</p></div>') + '</div>';
  }
  function autoCard() {
    const a = S.autoCfg;
    const rows = [["welcome", "Welcome message to new leads"], ["alert", "New-lead alert to your team"], ["reminder", "Offer reminders"]];
    return '<div class="card" id="autoCard"><div class="d-card-h"><h2>WhatsApp automation</h2><button class="btn btn-g btn-sm" data-nav="automation">Set up</button></div>' +
      (a ? '<div class="auto-st">' + rows.map(([k, t]) => { const on = a[k + "_on"] && a[k + "_url"]; return '<div><span class="dot ' + (on ? "ok" : "off") + '"></span><span>' + t + '</span><b class="' + (on ? "on" : "") + '">' + (on ? "On" : "Off") + '</b></div>'; }).join("") + '</div>' : '<p class="help">Checking…</p>') + '</div>';
  }
  function healthCard() {
    const ck = S.dash.checklist;
    const todo = [
      [ck.whatsapp, "WhatsApp number added", "settings"], [ck.email, "Contact email added", "settings"],
      [ck.samples === 0, ck.samples ? "Replace " + ck.samples + " sample review" + (ck.samples > 1 ? "s" : "") + " with real ones" : "Reviews are real", "testimonials"],
      [ck.siteUrl, "Site address set for Google", "seo"], [ck.ogImage, "Share image for WhatsApp links", "seo"], [ck.indexed, "Visible to search engines", "seo"],
    ];
    const done = todo.filter(t => t[0]).length, p = pct(done, todo.length), C = 2 * Math.PI * 26;
    return '<div class="card"><div class="d-card-h"><h2>Website health</h2></div><div class="health"><div class="ring" role="img" aria-label="' + done + ' of ' + todo.length + ' done"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" class="r-bg"/><circle cx="32" cy="32" r="26" class="r-fg" stroke-dasharray="' + (C * p / 100).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg><b>' + done + '/' + todo.length + '</b></div>' +
      '<div class="check">' + todo.map(t => '<div><span class="dot ' + (t[0] ? "ok" : "warn") + '"></span><span style="flex:1">' + esc(t[1]) + '</span>' + (t[0] ? "" : '<button class="btn btn-g btn-sm" data-nav="' + t[2] + '">Fix</button>') + '</div>').join("") + '</div></div></div>';
  }
  function contentCard() {
    const c = S.dash.counts, items = [["slides", c.slides, "Slides"], ["services", c.services, "Services"], ["posts", c.posts, "Blog posts"], ["testimonials", c.reviews, "Reviews"], ["faqs", c.faqs, "FAQs"], ["media", c.media, "Images"]];
    return '<div class="card"><div class="d-card-h"><h2>Website content</h2><a class="btn btn-g btn-sm" href="/" target="_blank" rel="noopener">View site ↗</a></div><div class="cgrid">' + items.map(([k, v, l]) => '<button data-nav="' + k + '"><b>' + v + '</b><span>' + l + '</span></button>').join("") + '</div></div>';
  }
  function heroBand(s, staff) {
    const name = String(S.user.name || "").trim().split(/\s+/)[0] || "there";
    const bits = [];
    if (s.fresh) bits.push('<b>' + s.fresh + '</b> new enquir' + (s.fresh === 1 ? "y needs" : "ies need") + ' a reply');
    if (s.dueToday + s.overdue) bits.push('<b>' + (s.dueToday + s.overdue) + '</b> follow-up' + (s.dueToday + s.overdue === 1 ? "" : "s") + ' due');
    if (!bits.length) bits.push(s.total ? "You're all caught up." : "Your dashboard fills up as enquiries arrive.");
    return '<div class="d-hero"><div><span class="d-date">' + new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) + '</span><h2>' + greeting() + ', ' + esc(name) + '</h2><p>' + bits.join(" · ") + '</p></div>' +
      '<div class="d-actions"><button class="btn btn-p" data-act="message">' + IC.send + 'Message leads</button>' + (staff ? '<button class="btn btn-ghost-l" data-nav="leads">' + IC.inbox + 'Open leads</button>' : '<button class="btn btn-ghost-l" data-act="newoffer">' + IC.gift + 'New festival offer</button><button class="btn btn-ghost-l" data-nav="slides">' + IC.edit + 'Edit website</button>') + '</div></div>';
  }
  function kpiRow(s) {
    const k = (icon, tone, label, val, foot, nav, lf) => '<button class="card d-kpi tone-' + tone + '" data-' + (lf ? 'lf="stage" data-lv="' + lf + '"' : 'nav="' + nav + '"') + '>' + ico(icon) + '<span class="d-kl">' + label + '</span><b>' + val + '</b>' + foot + '</button>';
    return '<div class="d-kpis">' +
      k("inbox", "a", "Waiting for first reply", s.waiting.length, '<span class="d-delta ' + (s.late ? "down" : "flat") + '">' + (s.late ? s.late + " past the " + slaMin() + "-min target" : s.avgReply != null ? "Avg first reply " + (s.avgReply < 60 ? s.avgReply + " min" : Math.round(s.avgReply / 60) + " h") : s.today ? s.today + " arrived today" : "All caught up") + '</span>', "", "new") +
      k("chart", "b", "Leads, last 30 days", s.m30, delta(s.m30, s.prev30), "leads") +
      k("trophy", "c", "Won", s.won, '<span class="d-delta flat">' + (s.won + s.lost ? pct(s.won, s.won + s.lost) + "% win rate" + (s.wonValue ? " · " + rs(s.wonValue) : "") : "Mark leads won or lost to track this") + '</span>', "", "won") +
      k("bell", "d", "Follow-ups due", s.dueToday + s.overdue, '<span class="d-delta ' + (s.overdue ? "down" : "flat") + '">' + (s.overdue ? s.overdue + " overdue" : s.dueToday ? s.dueToday + " today" : "Nothing pending") + '</span>', "leads") + '</div>';
  }
  function replyNowCard(s) {
    const list = s.waiting.slice().sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)).slice(0, 6);
    if (!list.length) return "";
    return '<div class="card reply-now"><div class="d-card-h"><h2>Reply now</h2><span class="tagp ' + (s.late ? "bad" : "warn") + '">' + s.waiting.length + '</span></div><p class="help" style="font-size:13px;margin:-6px 0 10px">Leads answered within minutes are far more likely to convert.</p><div class="check">' +
      list.map(l => { const w = waitInfo(l); return '<div><span class="lc-wait' + (w.late ? " late" : "") + '">⏱ ' + w.txt + '</span><span style="flex:1;min-width:0"><b>' + esc(l.name) + '</b> · ' + esc(l.service) + '</span>' + (l.phone ? '<button class="btn btn-p btn-sm" data-quickwa="' + l.id + '">WhatsApp</button>' : '<button class="btn btn-g btn-sm" data-openlead="' + l.id + '">Open</button>') + '</div>'; }).join("") + '</div></div>';
  }
  function renderDashboard(c) {
    const staff = isStaff(), s = leadStats();
    c.classList.add("dash");
    c.innerHTML = heroBand(s, staff) + kpiRow(s) +
      '<div class="d-grid g-21">' + trendChart() + pipelineCard(s) + '</div>' +
      '<div class="d-grid g-21">' + latestCard(staff ? 8 : 6) + '<div class="d-stack">' + replyNowCard(s) + followUpCard() + ((S.orders || []).length || (S.content.products || []).length ? salesCard() : '') + (staff ? '' : offersCard()) + '</div></div>' +
      '<div class="d-grid ' + (s.lost ? "g-4" : "g-3") + '">' + breakdown("What they want", "service", "Services leads ask about will show here.", "service") + breakdown("Business categories", "businessType", "Leads pick a category on the enquiry form.", "type") + breakdown("Top cities", "city", "Cities from the enquiry form will show here.", "q") + (s.lost ? breakdown("Why leads were lost", "lostReason", "", "") : "") + '</div>' +
      (staff ? '' : '<div class="d-grid g-3">' + autoCard() + breakdown("Where leads come from", "source", "Sources will show here.", "") + healthCard() + '</div>' + contentCard());
    c.onclick = e => { const r = e.target.closest("[data-openrow]"); if (r && !e.target.closest("a,button")) openLead(r.dataset.openrow); };
    if (!staff && !S.autoCfg) api("GET", "automation").then(a => { S.autoCfg = a || {}; const el = document.getElementById("autoCard"); if (el && S.view === "dashboard") el.outerHTML = autoCard(); }).catch(() => { const el = document.getElementById("autoCard"); if (el) el.querySelector(".help").textContent = "Couldn't load automation settings."; });
  }

  /* ---------- store: orders ---------- */
  const inr = p => "₹" + (Number(p || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const ORDER_ST = { created: ["Not paid", "off"], paid: ["Paid", "live"], active: ["Active", "live"], failed: ["Failed", "bad"], cancelled: ["Cancelled", "off"], halted: ["Payment issue", "warn"], completed: ["Completed", "off"], refunded: ["Refunded", "warn"] };
  const isPaid = o => ["paid", "active", "cancelled", "completed", "halted"].includes(o.status) && o.amount_paid > 0;
  function salesStats() {
    const O = S.orders || [], m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
    const paid = O.filter(isPaid);
    return {
      revenue: paid.reduce((a, o) => a + o.amount_paid, 0),
      month: paid.filter(o => Date.parse(o.last_payment_at || o.created_at) >= m0.getTime()).reduce((a, o) => a + (Date.parse(o.created_at) >= m0.getTime() ? o.amount_paid : o.price), 0),
      subs: O.filter(o => o.status === "active").length,
      mrr: O.filter(o => o.status === "active").reduce((a, o) => a + (o.billing === "monthly" ? o.price : o.billing === "yearly" ? Math.round(o.price / 12) : 0), 0),
      orders: paid.length, pending: O.filter(o => o.status === "created").length,
    };
  }
  function renderOrders(c) {
    const f = S.orderFilter || (S.orderFilter = { q: "", status: "paid", product: "" }), q = f.q.toLowerCase(), O = S.orders || [];
    const st = salesStats();
    const rows = O.filter(o => (!f.status || (f.status === "paid" ? isPaid(o) : o.status === f.status)) && (!f.product || o.product_slug === f.product) &&
      (!q || [o.order_no, o.customer_name, o.email, o.phone, o.business, o.gstin, o.city].join(" ").toLowerCase().includes(q)));
    const products = [...new Map(O.map(o => [o.product_slug, o.product_name])).entries()];
    c.innerHTML = '<div class="d-kpis">' +
      '<div class="card d-kpi tone-c">' + ico("chart") + '<span class="d-kl">Total sales</span><b>' + inr(st.revenue) + '</b><span class="d-delta flat">' + st.orders + ' paid order' + (st.orders === 1 ? "" : "s") + '</span></div>' +
      '<div class="card d-kpi tone-a">' + ico("inbox") + '<span class="d-kl">This month</span><b>' + inr(st.month) + '</b><span class="d-delta flat">Since the 1st</span></div>' +
      '<div class="card d-kpi tone-b">' + ico("trophy") + '<span class="d-kl">Active subscriptions</span><b>' + st.subs + '</b><span class="d-delta flat">' + inr(st.mrr) + ' a month recurring</span></div>' +
      '<div class="card d-kpi tone-d">' + ico("bell") + '<span class="d-kl">Started, not paid</span><b>' + st.pending + '</b><span class="d-delta flat">Follow up: they left at checkout</span></div></div>' +
      '<div class="filters"><input type="search" id="oq" placeholder="Search order, name, phone, GSTIN…" value="' + esc(f.q) + '" aria-label="Search orders">' +
      '<select id="ost" aria-label="Filter by status"><option value="">All orders</option><option value="paid"' + (f.status === "paid" ? " selected" : "") + '>Paid orders</option>' + Object.entries(ORDER_ST).map(([k, v]) => '<option value="' + k + '"' + (f.status === k ? " selected" : "") + '>' + v[0] + '</option>').join("") + '</select>' +
      '<select id="oprod" aria-label="Filter by product"><option value="">All products</option>' + products.map(([k, v]) => '<option value="' + esc(k) + '"' + (f.product === k ? " selected" : "") + '>' + esc(v) + '</option>').join("") + '</select>' +
      '<span class="help">' + rows.length + ' of ' + O.length + '</span><span style="flex:1"></span><button class="btn btn-s btn-sm" data-act="ocsv"' + (rows.length ? "" : " disabled") + '>Export CSV</button>' +
      '<span class="gst-exp"><input type="month" id="gstMonth" value="' + new Date().toISOString().slice(0, 7) + '" aria-label="GST month"><button class="btn btn-s btn-sm" data-act="gstcsv"' + ((S.payments || []).length ? "" : " disabled") + '>GST register</button></span></div>' +
      (rows.length ? '<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Order</th><th>Customer</th><th>Product</th><th>Paid</th><th>Status</th><th>Notes</th></tr></thead><tbody>' + rows.map(o => {
        const s = ORDER_ST[o.status] || [o.status, "off"];
        return '<tr><td>' + new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + '<div class="sub">' + new Date(o.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) + '</div></td>' +
          '<td><b style="font-family:var(--mono);font-size:13px">' + esc(o.order_no) + '</b>' + (o.rzp_payment_id ? '<div class="sub">' + esc(o.rzp_payment_id) + '</div>' : '') + '</td>' +
          '<td><b>' + esc(o.customer_name) + '</b>' + (o.business ? '<div class="sub">' + esc(o.business) + (o.city ? " · " + esc(o.city) : "") + '</div>' : '') + '<div class="sub"><a href="tel:' + esc(o.phone) + '">' + esc(o.phone) + '</a> · <a href="https://wa.me/' + waNum(o.phone) + '" target="_blank" rel="noopener">WhatsApp</a></div><div class="sub"><a href="mailto:' + esc(o.email) + '">' + esc(o.email) + '</a></div>' + (o.gstin ? '<div class="sub">GSTIN ' + esc(o.gstin) + '</div>' : '') + '</td>' +
          '<td>' + esc(o.product_name) + '<div class="sub">' + esc(o.plan_name) + ' · ' + (o.billing === "one-time" ? "one-time" : o.billing) + '</div><div class="sub">' + inr(o.price) + (o.setup_fee ? " + " + inr(o.setup_fee) + " setup" : "") + '</div></td>' +
          '<td><b>' + inr(o.amount_paid) + '</b>' + (Number(o.gst_rate) ? '<div class="sub">incl. GST ' + Number(o.gst_rate) + '% · ' + (o.seller_state && o.seller_state === o.buyer_state ? "CGST+SGST" : "IGST") + '</div>' : '') + invoiceLinks(o) + (o.payments > 1 ? '<div class="sub">' + o.payments + ' payments</div>' : '') + (o.next_charge_at && o.status === "active" ? '<div class="sub">Next ' + new Date(o.next_charge_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + '</div>' : '') + '</td>' +
          '<td>' + (isStaff() ? '<span class="tagp ' + s[1] + '">' + s[0] + '</span>' : '<select class="st ost-' + s[1] + '" data-ostatus="' + o.id + '" aria-label="Order status">' + Object.entries(ORDER_ST).map(([k, v]) => '<option value="' + k + '"' + (k === o.status ? " selected" : "") + '>' + v[0] + '</option>').join("") + '</select>') + '</td>' +
          '<td>' + (isStaff() ? '<div class="msg">' + esc(o.notes) + '</div>' : '<textarea class="lead-notes" data-onotes="' + o.id + '" aria-label="Notes">' + esc(o.notes) + '</textarea>') + '</td></tr>';
      }).join("") + '</tbody></table></div>'
        : '<div class="empty">' + (O.length ? "No orders match this filter." : "No orders yet. When customers buy from your Software pages, their orders appear here. Set up payments under Store → Payments & email.") + '</div>');
  }
  const invUrl = p => window.VB_SUPABASE.url + "/functions/v1/store/invoice?id=" + p.id + "&k=" + p.view_key;
  function invoiceLinks(o) {
    const ps = (S.payments || []).filter(p => p.order_id === o.id);
    return ps.length ? '<div class="sub inv-links">' + ps.map(p => '<a href="' + esc(invUrl(p)) + '" target="_blank" rel="noopener">' + esc(p.invoice_no) + '</a>').join(" ") + '</div>' : '';
  }
  // GST register: one line per payment (invoice) in the chosen month, for your CA / GSTR-1
  function exportGst() {
    const mon = (document.getElementById("gstMonth") || {}).value || new Date().toISOString().slice(0, 7);
    const byId = new Map((S.orders || []).map(o => [o.id, o]));
    const rows = (S.payments || []).filter(p => String(p.created_at).slice(0, 7) === mon || new Date(p.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7) === mon).sort((a, b) => a.invoice_no.localeCompare(b.invoice_no));
    if (!rows.length) return toast("No payments in " + mon + ".", true);
    const cols = ["Invoice no", "Invoice date", "Customer", "Business", "Customer GSTIN", "Place of supply (state code)", "Type", "Description", "SAC", "Taxable value", "GST rate %", "CGST", "SGST", "IGST", "Invoice total", "Razorpay payment ID", "Order"];
    const cell = v => { const x = v == null ? "" : String(v); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    const r2 = n => (n / 100).toFixed(2);
    const lines = rows.map(p => { const o = byId.get(p.order_id) || {}; return [p.invoice_no, new Date(p.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }), o.customer_name, o.business, o.gstin, o.buyer_state, o.gstin ? "B2B" : "B2C", o.product_name + (o.plan_name ? " – " + o.plan_name : "") + (p.kind === "renewal" ? " (renewal)" : ""), S.storeSac || "", r2(p.taxable), Number(p.gst_rate), r2(p.cgst), r2(p.sgst), r2(p.igst), r2(p.amount), p.rzp_payment_id, o.order_no].map(cell).join(","); });
    download(new Blob(["\ufeff" + [cols.join(",")].concat(lines).join("\r\n")], { type: "text/csv" }), "gst-register-" + mon + ".csv");
  }
  function exportOrders() {
    const cols = ["created_at", "order_no", "status", "customer_name", "phone", "email", "business", "gstin", "city", "buyer_state", "product_name", "plan_name", "billing", "price", "setup_fee", "gst_rate", "taxable_amount", "tax_amount", "total_amount", "amount_paid", "payments", "rzp_payment_id", "rzp_subscription_id", "notes"];
    const cell = v => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const money = ["price", "setup_fee", "amount_paid", "taxable_amount", "tax_amount", "total_amount"];
    const csv = [cols.join(",")].concat((S.orders || []).map(o => cols.map(k => cell(money.includes(k) ? (o[k] / 100).toFixed(2) : o[k])).join(","))).join("\r\n");
    download(new Blob(["﻿" + csv], { type: "text/csv" }), "orders-" + new Date().toISOString().slice(0, 10) + ".csv");
  }

  /* ---------- store: payments & email settings ---------- */
  async function renderPayments(c) {
    c.innerHTML = '<div class="empty">Loading…</div>';
    let cfg, log;
    try { [cfg, log] = await Promise.all([api("GET", "store-settings"), api("GET", "mail-log").catch(() => [])]); S.storeSac = cfg.sac_code || ""; }
    catch (err) { c.innerHTML = '<div class="empty">' + esc(err.message) + '</div>'; return; }
    const hook = window.VB_SUPABASE.url + "/functions/v1/store/webhook";
    const mode = /^rzp_live_/.test(cfg.razorpay_key_id || "") ? ["Live mode", "live"] : /^rzp_test_/.test(cfg.razorpay_key_id || "") ? ["Test mode", "warn"] : ["Not set up", "off"];
    const sec = (id, label, set, hint) => '<div class="fld"><label for="' + id + '">' + label + (set ? ' <span class="tagp live">saved</span>' : '') + '</label><input type="password" id="' + id + '" autocomplete="off" placeholder="' + (set ? esc(cfg[id]) + "  (leave empty to keep)" : "Paste here") + '"><span class="hint">' + hint + '</span></div>';
    const chk = (id, label, hint) => '<label class="chk" for="' + id + '"><input type="checkbox" id="' + id + '"' + (cfg[id] ? " checked" : "") + '><span>' + label + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</span></label>';
    const txt = (id, label, ph, hint) => '<div class="fld"><label for="' + id + '">' + label + '</label><input type="text" id="' + id + '" value="' + esc(cfg[id] || "") + '" placeholder="' + esc(ph || "") + '">' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>';
    const area = (id, label, ph, rows) => '<div class="fld"><label for="' + id + '">' + label + '</label><textarea id="' + id + '" rows="' + (rows || 5) + '" placeholder="' + esc(ph) + '">' + esc(cfg[id] || "") + '</textarea></div>';
    c.innerHTML = '<div class="pay-grid">' +
      '<div class="card form"><div class="d-card-h"><h2>Razorpay payments</h2><span class="tagp ' + mode[1] + '">' + mode[0] + '</span></div>' +
        '<p class="help">Customers pay on your Software pages with UPI, cards, netbanking or wallets. Monthly and yearly plans renew automatically.</p>' +
        chk("store_on", "Take payments on the website", "When off, Buy buttons send people to the enquiry form instead") +
        txt("razorpay_key_id", "Key ID", "rzp_live_…", "Razorpay Dashboard → Account & Settings → API Keys. Start with a Test key, then switch to Live.") +
        sec("razorpay_key_secret", "Key Secret", cfg.razorpay_key_secret_set, "Shown once when you generate the key. Stored securely; it never reaches the website.") +
        sec("razorpay_webhook_secret", "Webhook secret", cfg.razorpay_webhook_secret_set, "The secret you type when adding the webhook below.") +
        '<div class="fld"><label>Webhook URL <button type="button" class="btn btn-g btn-sm" data-copy="' + esc(hook) + '">Copy</button></label><code class="codebox">' + esc(hook) + '</code>' +
          '<span class="hint">Razorpay → Account & Settings → Webhooks → Add new webhook. Paste this URL, set a secret, and tick: payment.captured, payment.failed, subscription.activated, subscription.charged, subscription.halted, subscription.cancelled, subscription.completed, refund.processed. This keeps renewals and cancellations in sync.</span></div>' +
        txt("gst_note", "Extra note under prices", "e.g. Setup within 2 working days", "Optional. Shown under the plans on every product page.") +
        '<p class="help" style="font-size:13px">Subscriptions need Razorpay Subscriptions turned on for your account (ask Razorpay support if plans fail to create).</p>' +
      '</div>' +
      '<div class="card form"><div class="d-card-h"><h2>Email automation</h2><span class="tagp ' + (cfg.resend_api_key_set && cfg.mail_from ? "live" : "off") + '">' + (cfg.resend_api_key_set && cfg.mail_from ? "Connected" : "Not set up") + '</span></div>' +
        '<p class="help">Emails are sent through Resend. Add and verify your domain in Resend first so emails land in the inbox, not spam.</p>' +
        sec("resend_api_key", "Resend API key", cfg.resend_api_key_set, "resend.com → API Keys → Create API key (Sending access).") +
        txt("mail_from", "Send from", "Vivid Brandify <hello@vividbrandify.com>", "Must use the domain you verified in Resend.") +
        txt("team_emails", "Team emails for alerts", "you@gmail.com, sales@vividbrandify.com", "Separate with commas.") +
        '<div class="chk-list">' + chk("mail_lead_reply_on", "Auto-reply to every enquiry", "Goes to the email the visitor typed in the form") +
        chk("mail_lead_alert_on", "Alert the team about new enquiries") + chk("mail_order_on", "Send a receipt to buyers", "After every successful payment") + chk("mail_order_alert_on", "Alert the team about new orders") + '</div>' +
        '<div class="fld"><label for="testTo">Send a test email</label><div style="display:flex;gap:8px"><input type="email" id="testTo" placeholder="you@example.com" value="' + esc(S.user.email) + '"><button type="button" class="btn btn-s btn-sm" data-act="testmail">Send test</button></div><span class="hint">Save first, then test.</span></div>' +
      '</div>' +
      '<div class="card form span2"><div class="d-card-h"><h2>GST billing</h2><span class="tagp ' + (cfg.gst_on ? "live" : "off") + '">' + (cfg.gst_on ? "GST on · " + (cfg.gst_rate || 18) + "%" : "GST off") + '</span></div>' +
        '<p class="help">Every payment gets a numbered GST tax invoice (CGST + SGST inside your state, IGST outside it), emailed to the buyer and listed in Orders. Check the rate and SAC code with your CA.</p>' +
        '<div class="two"><div>' + chk("gst_on", "Charge GST on online sales", "Needs your GSTIN") +
          '<div class="fld"><label for="gst_rate">GST rate (%)</label><input type="number" id="gst_rate" min="0" max="40" step="0.01" value="' + esc(cfg.gst_rate == null ? 18 : cfg.gst_rate) + '"><span class="hint">Most software and IT services are 18%.</span></div>' +
          '<div class="fld"><label>Your prices are</label><label class="chk" for="gst_excl"><input type="radio" name="gstmode" id="gst_excl"' + (cfg.gst_inclusive ? "" : " checked") + '><span>Before GST <span class="hint">GST is added at checkout: ₹999 + 18% = ₹1,178.82</span></span></label><label class="chk" for="gst_inclusive"><input type="radio" name="gstmode" id="gst_inclusive"' + (cfg.gst_inclusive ? " checked" : "") + '><span>Including GST <span class="hint">The buyer pays the listed price; the invoice shows the GST inside it</span></span></label></div>' +
          txt("sac_code", "SAC code", "998314", "Printed on invoices. Ask your CA which code fits your services.") + '</div>' +
        '<div>' + txt("seller_gstin", "Your GSTIN", "23ABCDE1234F1Z5", "The first two digits set your home state for CGST/SGST.") + txt("seller_name", "Legal business name", "Vivid Brandify", "As on your GST registration.") +
          area("seller_address", "Registered address", "Shop / office, street\nCity, State PIN", 3) + txt("invoice_prefix", "Invoice number prefix", "VB/", "Invoices are numbered per financial year: VB/26-27/0001, VB/26-27/0002…") + '</div></div>' +
      '</div>' +
      '<div class="card form span2"><h2>Email wording</h2><p class="help">Leave empty to use the built-in wording. You can use {name}, {brand}, {service}, {whatsapp}, {site}; in receipts also {product}, {plan}, {amount}, {order_no}. A blank line starts a new paragraph.</p>' +
        '<div class="two">' + '<div>' + txt("lead_reply_subject", "Enquiry auto-reply: subject", "Thanks for contacting {brand}") + area("lead_reply_body", "Enquiry auto-reply: message", "Hi {name},\n\nThanks for your enquiry about {service}. Our team will get back to you within one working day.\n\nIf it's urgent, message us on WhatsApp at {whatsapp}.") + '</div>' +
        '<div>' + txt("order_subject", "Payment receipt: subject", "Payment received: {product} ({order_no})") + area("order_body", "Payment receipt: message", "Hi {name},\n\nThank you for your purchase. We've received your payment and our team will contact you within one working day to get you set up.\n\nKeep this email as your receipt.") + '</div></div>' +
      '</div>' +
      '<div class="card span2"><h2>Recent emails</h2>' + (log.length ? '<div class="tbl-wrap"><table><thead><tr><th>When</th><th>Type</th><th>To</th><th>Subject</th><th>Result</th></tr></thead><tbody>' + log.map(l => '<tr><td>' + new Date(l.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) + '</td><td>' + esc(({ lead_reply: "Enquiry reply", lead_alert: "Enquiry alert", order_receipt: "Receipt", order_alert: "Order alert", test: "Test" })[l.kind] || l.kind) + '</td><td>' + esc(l.recipient) + '</td><td>' + esc(l.subject) + '</td><td>' + (l.ok ? '<span class="tagp live">Sent</span>' : '<span class="tagp warn" title="' + esc(l.error) + '">Failed</span><div class="sub">' + esc(l.error) + '</div>') + '</td></tr>').join("") + '</tbody></table></div>' : '<p class="help">No emails sent yet.</p>') + '</div>' +
      '</div>';
    const sb = document.getElementById("savebarSlot");
    sb.innerHTML = '<div class="savebar"><span>Payment and email settings</span><span style="flex:1"></span><button class="btn btn-p" data-act="savepay">Save settings</button></div>';
  }
  async function savePayments() {
    const v = id => (document.getElementById(id) || {}).value || "", ch = id => !!(document.getElementById(id) || {}).checked;
    const body = {};
    ["razorpay_key_id", "gst_note", "gst_rate", "seller_gstin", "seller_name", "seller_address", "sac_code", "invoice_prefix", "mail_from", "team_emails", "lead_reply_subject", "lead_reply_body", "order_subject", "order_body"].forEach(k => body[k] = v(k).trim());
    ["razorpay_key_secret", "razorpay_webhook_secret", "resend_api_key"].forEach(k => body[k] = v(k).trim());
    ["store_on", "gst_on", "gst_inclusive", "mail_lead_reply_on", "mail_lead_alert_on", "mail_order_on", "mail_order_alert_on"].forEach(k => body[k] = ch(k));
    if (body.store_on && !body.razorpay_key_id) return toast("Add your Razorpay Key ID before switching payments on.", true);
    body.seller_gstin = body.seller_gstin.toUpperCase();
    if (body.gst_on && !/^[0-9]{2}[A-Z0-9]{13}$/.test(body.seller_gstin)) return toast("Add your 15-character GSTIN to charge GST.", true);
    try { await api("PUT", "store-settings", body); toast("Settings saved."); renderView(); }
    catch (err) { toast(err.message, true); }
  }
  function salesCard() {
    const st = salesStats(), recent = (S.orders || []).filter(isPaid).slice(0, 4);
    return '<div class="card"><div class="d-card-h"><h2>Online sales</h2><button class="btn btn-g btn-sm" data-nav="orders">Orders</button></div>' +
      '<div class="sales-row"><div><b>' + inr(st.month) + '</b><span>This month</span></div><div><b>' + st.subs + '</b><span>Active plans</span></div><div><b>' + inr(st.mrr) + '</b><span>Monthly recurring</span></div></div>' +
      (recent.length ? '<div class="ofl" style="margin-top:12px">' + recent.map(o => '<div class="ofl-row"><span class="ofl-main"><b>' + esc(o.customer_name) + '</b><small>' + esc(o.product_name) + ' · ' + ago(o.created_at) + '</small></span><b>' + inr(o.amount_paid) + '</b></div>').join("") + '</div>'
        : '<p class="help" style="margin-top:10px">No sales yet. Add products under Store → Products & plans and switch on payments.</p>') + '</div>';
  }

  /* ---------- leads: pipeline board, list and detail panel ---------- */
  const STAGES = [["new", "New"], ["contacted", "Contacted"], ["qualified", "Qualified"], ["proposal", "Proposal sent"], ["negotiation", "Negotiation"], ["won", "Won"], ["lost", "Lost"]];
  const STAGE_LABEL = Object.fromEntries(STAGES);
  const STAGE_HINT = { new: "Not replied yet", contacted: "First reply sent", qualified: "Need, budget and timing confirmed", proposal: "Quote or proposal shared", negotiation: "Discussing price or scope", won: "Paid or signed", lost: "Closed without a sale" };
  const PRIO = { hot: "Hot", warm: "Warm", cold: "Cold" };
  const LOST_REASONS = ["Price too high", "Not the right time", "No budget", "Went with another agency", "No response", "Not a fit for us", "Other"];
  const ACT_LABEL = { created: "Enquiry received", stage: "Stage", owner: "Assigned to", priority: "Priority", value: "Deal value", note: "Note", call: "Call", whatsapp: "WhatsApp", email: "Email", meeting: "Meeting", task: "Task", followup: "Follow-up set" };
  const rs = n => "₹" + Number(n || 0).toLocaleString("en-IN");
  const ownerOf = id => (S.team || []).find(m => m.id === id);
  const initials = s => String(s || "?").trim().split(/[\s@._]+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const slaMin = () => +((S.crm && S.crm.reply_sla_minutes) || 30);
  function waitInfo(l) {
    if (l.firstResponseAt || l.stage !== "new") return null;
    const m = Math.floor((Date.now() - Date.parse(l.createdAt)) / 6e4);
    const txt = m < 60 ? m + " min" : m < 1440 ? Math.floor(m / 60) + "h " + (m % 60) + "m" : Math.floor(m / 1440) + "d";
    return { m, txt, late: m > slaMin() };
  }
  function replyTime(l) {
    if (!l.firstResponseAt) return "";
    const m = Math.max(0, Math.round((Date.parse(l.firstResponseAt) - Date.parse(l.createdAt)) / 6e4));
    return m < 60 ? m + " min" : m < 1440 ? Math.round(m / 60) + " h" : Math.round(m / 1440) + " days";
  }
  // Distinct values seen on leads, plus the categories offered on the website, so filters list every option.
  function leadValues(k) {
    const st = (S.content && S.content.settings) || {}, base = [];
    if (k === "businessType") String(st.businessTypes || "").split("\n").forEach(x => { x = x.trim(); if (x) base.push(x); });
    if (k === "service") (S.content.services || []).forEach(v => v.name && base.push(v.name));
    S.leads.forEach(l => { if (l[k]) base.push(l[k]); });
    return [...new Set(base)];
  }
  function filteredLeads(ignoreStage) {
    const f = S.leadFilter, q = (f.q || "").toLowerCase(), me = S.user && S.user.id;
    return S.leads.filter(l => (ignoreStage || !f.stage || l.stage === f.stage) && (!f.status || l.status === f.status) && (!f.type || l.businessType === f.type) && (!f.service || l.service === f.service) &&
      (!f.priority || l.priority === f.priority) && (!f.owner || (f.owner === "me" ? l.ownerId === me : f.owner === "none" ? !l.ownerId : l.ownerId === f.owner)) &&
      (!q || [l.name, l.phone, l.email, l.business, l.businessType, l.city, l.service, l.message, l.notes].join(" ").toLowerCase().includes(q)));
  }
  const leadView = () => { try { return localStorage.getItem("vb_lead_view") || "board"; } catch (_) { return "board"; } };
  function leadCard(l) {
    const w = waitInfo(l), o = ownerOf(l.ownerId);
    return '<article class="lcard pr-' + l.priority + '" draggable="true" data-lead="' + l.id + '" tabindex="0" aria-label="' + esc(l.name) + ', ' + esc(STAGE_LABEL[l.stage]) + '">' +
      '<div class="lc-top"><b>' + esc(l.name) + '</b><span class="prio p-' + l.priority + '">' + PRIO[l.priority] + '</span></div>' +
      '<div class="lc-sub">' + esc([l.business || l.businessType, l.city].filter(Boolean).join(" · ") || leadSource(l)) + '</div>' +
      '<div class="lc-svc">' + esc(l.service || "–") + '</div>' +
      '<div class="lc-foot">' + (l.dealValue ? '<span class="lc-val">' + rs(l.dealValue) + '</span>' : '') +
        (w ? '<span class="lc-wait' + (w.late ? " late" : "") + '" title="Waiting for first reply">⏱ ' + w.txt + '</span>' : l.followUpOn ? '<span class="lc-fu' + (l.followUpOn <= todayStr() ? " due" : "") + '">↻ ' + new Date(l.followUpOn + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + '</span>' : '') +
        (l.tags.includes("repeat") ? '<span class="lc-tag">repeat</span>' : '') + '<span style="flex:1"></span>' +
        (o ? '<span class="lc-own" title="' + esc(o.name) + '">' + esc(initials(o.name)) + '</span>' : '<span class="lc-own none" title="Unassigned">–</span>') + '</div></article>';
  }
  function renderLeads(c) {
    const f = S.leadFilter, view = leadView();
    const rows = filteredLeads(view === "board");
    const team = S.team || [];
    c.innerHTML = '<div class="filters lead-filters"><div class="seg" role="group" aria-label="View"><button data-lview="board" class="' + (view === "board" ? "on" : "") + '">Board</button><button data-lview="list" class="' + (view === "list" ? "on" : "") + '">List</button></div>' +
      '<input type="search" id="lq" placeholder="Search name, phone, city…" value="' + esc(f.q) + '" aria-label="Search leads">' +
      (view === "list" ? '<select id="ls" aria-label="Filter by stage"><option value="">All stages</option>' + STAGES.map(([k, v]) => '<option value="' + k + '"' + (f.stage === k ? " selected" : "") + '>' + v + '</option>').join("") + '</select>' : '') +
      '<select id="lprio" aria-label="Filter by priority"><option value="">Any priority</option>' + Object.entries(PRIO).map(([k, v]) => '<option value="' + k + '"' + (f.priority === k ? " selected" : "") + '>' + v + '</option>').join("") + '</select>' +
      '<select id="lowner" aria-label="Filter by owner"><option value="">Everyone\'s leads</option><option value="me"' + (f.owner === "me" ? " selected" : "") + '>My leads</option><option value="none"' + (f.owner === "none" ? " selected" : "") + '>Unassigned</option>' + team.map(m => '<option value="' + m.id + '"' + (f.owner === m.id ? " selected" : "") + '>' + esc(m.name) + '</option>').join("") + '</select>' +
      '<select id="ltype" aria-label="Filter by business category"><option value="">All categories</option>' + leadValues("businessType").map(v => '<option' + (f.type === v ? " selected" : "") + '>' + esc(v) + '</option>').join("") + '</select>' +
      '<select id="lsvc" aria-label="Filter by service"><option value="">All services</option>' + leadValues("service").map(v => '<option' + (f.service === v ? " selected" : "") + '>' + esc(v) + '</option>').join("") + '</select>' +
      '<span class="help">' + rows.length + ' of ' + S.leads.length + '</span><span style="flex:1"></span>' + (isStaff() ? '' : '<button class="btn btn-g btn-sm" data-act="leadsettings">Lead settings</button>') + '<button class="btn btn-p btn-sm" data-act="message">Message leads</button><button class="btn btn-s btn-sm" data-act="csv">Export CSV</button></div>' +
      (!S.leads.length ? '<div class="empty">No enquiries yet. Leads from the website, offer pages and purchases appear here.</div>' : view === "board" ? boardHtml(rows) : listHtml(rows));
    c.onclick = e => { const card = e.target.closest("[data-lead],[data-open]"); if (card && !e.target.closest("select,input,textarea,a,button:not([data-open])")) openLead(card.dataset.lead || card.dataset.open); };
    c.onkeydown = e => { if (e.key === "Enter" && e.target.dataset && e.target.dataset.lead) openLead(e.target.dataset.lead); };
    if (view === "board") bindBoard(c);
  }
  function boardHtml(rows) {
    const open = STAGES.filter(([k]) => k !== "won" && k !== "lost");
    const sortIn = (k, list) => list.sort((a, b) => k === "new" ? Date.parse(a.createdAt) - Date.parse(b.createdAt) : ({ hot: 0, warm: 1, cold: 2 })[a.priority] - ({ hot: 0, warm: 1, cold: 2 })[b.priority] || Date.parse(b.stageChangedAt) - Date.parse(a.stageChangedAt));
    const closed = k => { const list = rows.filter(l => l.stage === k), v = list.reduce((a, l) => a + (l.dealValue || 0), 0); return '<button class="bzone bz-' + k + '" data-drop="' + k + '" data-zone="' + k + '"><b>' + (k === "won" ? "✓ Won" : "✕ Lost") + '</b><span>' + list.length + ' lead' + (list.length === 1 ? '' : 's') + (v ? ' · ' + rs(v) : '') + '</span><small>Drop here to mark ' + k + ' · click to see them</small></button>'; };
    return '<div class="board">' + open.map(([k, label]) => {
      const list = sortIn(k, rows.filter(l => l.stage === k)), value = list.reduce((a, l) => a + (l.dealValue || 0), 0);
      return '<section class="bcol bc-' + k + '" data-drop="' + k + '" aria-label="' + label + '"><header><span class="bdot"></span><b>' + label + '</b><span class="bcount">' + list.length + '</span>' + (value ? '<small>' + rs(value) + '</small>' : '') + '</header><p class="bhint">' + STAGE_HINT[k] + '</p>' +
        '<div class="bbody">' + list.slice(0, 60).map(leadCard).join("") + (list.length > 60 ? '<p class="bmore">+' + (list.length - 60) + ' more · use List view</p>' : '') + (list.length ? '' : '<p class="bempty">Drop a lead here</p>') + '</div></section>';
    }).join("") + '</div><div class="bzones">' + closed("won") + closed("lost") + '</div>';
  }
  function listHtml(rows) {
    return rows.length ? '<div class="tbl-wrap"><table><thead><tr><th>Received</th><th>Contact</th><th>Interested in</th><th>Stage</th><th>Priority</th><th>Owner</th><th>Follow-up</th><th></th></tr></thead><tbody>' + rows.map(l => {
      const wa = l.phone ? "https://wa.me/" + waNum(l.phone) : "", w = waitInfo(l);
      return '<tr><td><span style="font-variant-numeric:tabular-nums">' + new Date(l.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + '</span><div class="sub">' + new Date(l.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) + '</div>' + (w ? '<div class="lc-wait' + (w.late ? " late" : "") + '">⏱ ' + w.txt + '</div>' : '') + '</td>' +
        '<td><button class="linkish" data-open="' + l.id + '">' + esc(l.name) + '</button>' + (l.business ? '<div class="sub">' + esc(l.business) + '</div>' : '') + (l.businessType || l.city ? '<div class="sub">' + esc([l.businessType, l.city].filter(Boolean).join(" · ")) + '</div>' : '') + (l.phone ? '<div class="sub"><a href="tel:' + esc(l.phone) + '">' + esc(l.phone) + '</a> · <a href="' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a></div>' : '') + (l.email ? '<div class="sub"><a href="mailto:' + esc(l.email) + '">' + esc(l.email) + '</a></div>' : '') + (l.optIn ? '<div><span class="tagp live" style="margin:4px 0 0">WhatsApp opt-in</span></div>' : '') + (l.tags.includes("repeat") ? '<div><span class="tagp warn" style="margin:4px 0 0">Repeat enquiry</span></div>' : '') + '</td>' +
        '<td>' + esc(l.service) + '<div class="sub">' + esc(leadSource(l)) + '</div>' + (l.dealValue ? '<div class="sub"><b>' + rs(l.dealValue) + '</b></div>' : '') + '</td>' +
        '<td><select class="st st-' + l.status + '" data-lstage="' + l.id + '" aria-label="Stage">' + STAGES.map(([k, v]) => '<option value="' + k + '"' + (k === l.stage ? " selected" : "") + '>' + v + '</option>').join("") + '</select>' + (l.stage === "lost" && l.lostReason ? '<div class="sub">' + esc(l.lostReason) + '</div>' : '') + '</td>' +
        '<td><span class="prio p-' + l.priority + '" title="Score ' + l.score + '/100">' + PRIO[l.priority] + '</span></td>' +
        '<td>' + esc((ownerOf(l.ownerId) || {}).name || "–") + '</td>' +
        '<td><input type="date" class="lead-date" data-lfollow="' + l.id + '" value="' + esc(l.followUpOn) + '" aria-label="Follow-up date"></td>' +
        '<td>' + (isStaff() ? '' : S.pendingDel === l.id ? '<span class="confirm"><button class="btn btn-d btn-sm" data-ldelyes="' + l.id + '">Delete</button><button class="btn btn-g btn-sm" data-delno>Keep</button></span>' : '<button class="ib" data-ldel="' + l.id + '" aria-label="Delete lead">🗑</button>') + '</td></tr>';
    }).join("") + '</tbody></table></div>' : '<div class="empty">No leads match this filter.</div>';
  }
  function bindBoard(c) {
    let dragId = null;
    c.querySelectorAll(".lcard").forEach(el => el.addEventListener("dragstart", e => { dragId = el.dataset.lead; e.dataTransfer.setData("text/plain", dragId); el.classList.add("dragging"); document.body.classList.add("dragging-lead"); }));
    c.querySelectorAll(".lcard").forEach(el => el.addEventListener("dragend", () => { el.classList.remove("dragging"); document.body.classList.remove("dragging-lead"); }));
    c.querySelectorAll("[data-drop]").forEach(col => {
      col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("over"); });
      col.addEventListener("dragleave", () => col.classList.remove("over"));
      col.addEventListener("drop", e => { e.preventDefault(); col.classList.remove("over"); const id = e.dataTransfer.getData("text/plain") || dragId; if (id) moveLead(id, col.dataset.drop); });
    });
  }
  async function moveLead(id, stage) {
    const l = S.leads.find(x => x.id === id);
    if (!l || l.stage === stage) return;
    let lostReason;
    if (stage === "lost") { lostReason = await pickLostReason(l); if (lostReason == null) return; }
    await patchLead(id, Object.assign({ stage }, lostReason != null ? { lostReason } : {}), "Moved to " + STAGE_LABEL[stage] + ".");
  }
  async function patchLead(id, body, msg) {
    try {
      const l = await api("PATCH", "leads/" + id, body);
      Object.assign(S.leads.find(x => x.id === id), l);
      if (msg) toast(msg);
      if (S.view === "leads") renderView();
      if (document.getElementById("leadDrawer")) openLead(id, true);
      return l;
    } catch (err) { toast(err.message, true); }
  }
  function pickLostReason(l) {
    return new Promise(res => {
      const m = document.createElement("div"); m.className = "modal";
      m.innerHTML = '<div class="box" style="max-width:420px"><header><h2>Why was ' + esc(l.name) + ' lost?</h2></header><p class="help">This helps you see where deals slip away.</p><div class="lr-list">' + LOST_REASONS.map(r => '<button class="btn btn-s" data-r="' + esc(r) + '">' + esc(r) + '</button>').join("") + '</div><div style="margin-top:12px;text-align:right"><button class="btn btn-g btn-sm" data-r="__cancel">Cancel</button></div></div>';
      document.body.appendChild(m);
      m.addEventListener("click", e => { const b = e.target.closest("[data-r]"); if (!b && e.target !== m) return; m.remove(); res(!b || b.dataset.r === "__cancel" ? null : b.dataset.r); });
    });
  }
  /* detail panel */
  async function openLead(id, keepScroll) {
    const l = S.leads.find(x => x.id === id); if (!l) return;
    let d = document.getElementById("leadDrawer");
    const top = d && keepScroll ? d.querySelector(".dr-body").scrollTop : 0;
    if (!d) { d = document.createElement("aside"); d.id = "leadDrawer"; d.className = "drawer"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "false"); document.body.appendChild(d); document.body.classList.add("drawer-open"); }
    const o = ownerOf(l.ownerId), w = waitInfo(l), wa = l.phone ? "https://wa.me/" + waNum(l.phone) : "";
    const field = (label, html) => '<div class="fld"><label>' + label + '</label>' + html + '</div>';
    d.innerHTML = '<header class="dr-head"><div><span class="prio p-' + l.priority + '">' + PRIO[l.priority] + ' · ' + l.score + '</span><h2>' + esc(l.name) + '</h2><p>' + esc([l.business, l.businessType, l.city].filter(Boolean).join(" · ") || leadSource(l)) + '</p></div><button class="ib" data-dr="close" aria-label="Close">✕</button></header>' +
      '<div class="dr-body">' +
        (w ? '<div class="dr-alert' + (w.late ? " late" : "") + '">⏱ Waiting ' + w.txt + ' for a first reply' + (w.late ? ' · past your ' + slaMin() + '-minute target' : '') + '</div>' : l.firstResponseAt ? '<div class="dr-ok">✓ First reply in ' + replyTime(l) + '</div>' : '') +
        '<div class="dr-actions">' + (l.phone ? '<a class="btn btn-s btn-sm" href="tel:' + esc(l.phone) + '" data-log="call">📞 Call</a><a class="btn btn-p btn-sm" href="' + esc(wa) + '?text=' + encodeURIComponent("Hi " + (l.name || "").split(" ")[0] + ", this is " + ((S.content.settings || {}).brand || "us") + ". Thanks for your enquiry about " + (l.service || "our services") + ".") + '" target="_blank" rel="noopener" data-log="whatsapp">WhatsApp</a>' : '') + (l.email ? '<a class="btn btn-s btn-sm" href="mailto:' + esc(l.email) + '" data-log="email">✉ Email</a>' : '') + '</div>' +
        '<div class="dr-grid">' +
          field("Stage", '<select data-df="stage">' + STAGES.map(([k, v]) => '<option value="' + k + '"' + (k === l.stage ? " selected" : "") + '>' + v + '</option>').join("") + '</select>') +
          field("Priority", '<select data-df="priority">' + Object.entries(PRIO).map(([k, v]) => '<option value="' + k + '"' + (k === l.priority ? " selected" : "") + '>' + v + '</option>').join("") + '</select>') +
          field("Owner", '<select data-df="ownerId"><option value="">Unassigned</option>' + (S.team || []).map(m => '<option value="' + m.id + '"' + (m.id === l.ownerId ? " selected" : "") + '>' + esc(m.name) + (m.id === S.user.id ? " (me)" : "") + '</option>').join("") + '</select>') +
          field("Deal value (₹)", '<input type="number" min="0" step="500" data-df="dealValue" value="' + (l.dealValue || "") + '" placeholder="0">') +
          field("Follow-up on", '<input type="date" data-df="followUpOn" value="' + esc(l.followUpOn) + '">') +
          field("Next step", '<input type="text" data-df="nextAction" maxlength="200" value="' + esc(l.nextAction) + '" placeholder="e.g. Send website quote">') +
          (l.stage === "lost" ? field("Lost because", '<select data-df="lostReason"><option value="">Choose…</option>' + LOST_REASONS.map(r => '<option' + (r === l.lostReason ? " selected" : "") + '>' + esc(r) + '</option>').join("") + '</select>') : '') +
        '</div>' +
        '<dl class="dr-info">' + [["Phone", l.phone], ["Email", l.email], ["Interested in", l.service], ["Came from", leadSource(l)], ["Message", l.message], ["Received", new Date(l.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })], ["WhatsApp opt-in", l.optIn ? "Yes" : "No"], ["Tags", (l.tags || []).join(", ")]].filter(x => x[1]).map(([k, v]) => '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>').join("") + '</dl>' +
        '<div class="fld"><label>Notes</label><textarea data-df="notes" rows="3" placeholder="Anything the team should know">' + esc(l.notes) + '</textarea></div>' +
        '<div class="dr-log"><select id="actKind" aria-label="Activity type"><option value="call">Call</option><option value="meeting">Meeting</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="task">Task done</option><option value="note">Note</option></select><input id="actText" type="text" maxlength="500" placeholder="What happened? e.g. Discussed budget, sending quote"><button class="btn btn-s btn-sm" data-dr="log">Add</button></div>' +
        '<h3 class="dr-h3">Timeline</h3><ol class="timeline" id="tl"><li class="help">Loading…</li></ol>' +
      '</div>';
    d.querySelector(".dr-body").scrollTop = top;
    d.onclick = async e => {
      const b = e.target.closest("[data-dr],[data-log]"); if (!b) return;
      if (b.dataset.dr === "close") return closeLead();
      if (b.dataset.log) { logActivity(l.id, b.dataset.log, b.dataset.log === "whatsapp" ? "Opened WhatsApp chat" : b.dataset.log === "call" ? "Called" : "Emailed", true); return; }
      if (b.dataset.dr === "log") { const t = document.getElementById("actText"); await logActivity(l.id, document.getElementById("actKind").value, t.value.trim() || "", false); t.value = ""; }
    };
    d.onchange = e => {
      const k = e.target.dataset.df; if (!k) return;
      if (k === "stage" && e.target.value === "lost") { moveLead(l.id, "lost").then(() => openLead(l.id, true)); return; }
      patchLead(l.id, { [k]: e.target.value }, "Saved.");
    };
    d.onkeydown = e => { if (e.key === "Enter" && e.target.id === "actText") d.querySelector('[data-dr="log"]').click(); };
    try {
      const acts = await api("GET", "lead-activity/" + l.id);
      const tl = document.getElementById("tl"); if (!tl) return;
      tl.innerHTML = acts.length ? acts.map(a => { const who = ownerOf(a.actor); return '<li class="tk-' + a.kind + '"><span class="tl-dot"></span><div><b>' + esc(ACT_LABEL[a.kind] || a.kind) + '</b>' + (a.detail ? ' · ' + esc(a.detail) : '') + '<small>' + new Date(a.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) + (who ? ' · ' + esc(who.name) : '') + '</small></div></li>'; }).join("") : '<li class="help">No activity yet.</li>';
    } catch (_) { const tl = document.getElementById("tl"); if (tl) tl.innerHTML = '<li class="help">Timeline unavailable.</li>'; }
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && document.getElementById("leadDrawer") && !document.querySelector(".modal")) closeLead(); });
  function closeLead() { const d = document.getElementById("leadDrawer"); if (d) d.remove(); document.body.classList.remove("drawer-open"); }
  async function logActivity(id, kind, detail, quiet) {
    try {
      await api("POST", "lead-activity", { leadId: id, kind, detail });
      const fresh = (await api("GET", "leads").catch(() => null)); if (fresh) S.leads = fresh;
      if (!quiet) toast("Added to the timeline.");
      if (S.view === "leads") renderView();
      openLead(id, true);
    } catch (err) { toast(err.message, true); }
  }
  async function leadSettings() {
    let cfg = {};
    try { cfg = await api("GET", "crm-settings"); } catch (err) { return toast(err.message, true); }
    const m = document.createElement("div"); m.className = "modal";
    m.innerHTML = '<div class="box" style="max-width:480px"><header><h2>Lead settings</h2><button class="btn btn-g btn-sm" data-x>Close</button></header>' +
      '<label class="chk" for="csAuto"><input type="checkbox" id="csAuto"' + (cfg.auto_assign ? " checked" : "") + '><span>Share new leads automatically<span class="hint">Each new enquiry goes to the next person in turn, so nobody waits for someone to pick it up</span></span></label>' +
      '<div class="fld" style="margin-top:10px"><label for="csTo">Share between</label><select id="csTo"><option value="staff"' + (cfg.assign_to !== "everyone" ? " selected" : "") + '>Staff only</option><option value="everyone"' + (cfg.assign_to === "everyone" ? " selected" : "") + '>Staff and admins</option></select></div>' +
      '<div class="fld"><label for="csSla">Reply within (minutes)</label><input type="number" id="csSla" min="5" max="1440" value="' + (cfg.reply_sla_minutes || 30) + '"><span class="hint">Leads waiting longer than this turn red on the board and dashboard</span></div>' +
      '<div style="text-align:right;margin-top:12px"><button class="btn btn-p" data-save>Save</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener("click", async e => {
      if (e.target === m || e.target.closest("[data-x]")) return m.remove();
      if (e.target.closest("[data-save]")) {
        try { S.crm = await api("PUT", "crm-settings", { auto_assign: m.querySelector("#csAuto").checked, assign_to: m.querySelector("#csTo").value, reply_sla_minutes: m.querySelector("#csSla").value }); toast("Lead settings saved."); m.remove(); renderView(); }
        catch (err) { toast(err.message, true); }
      }
    });
  }
  function exportCsv() {
    const cols = ["createdAt", "name", "phone", "email", "business", "businessType", "city", "service", "message", "stage", "priority", "score", "owner", "dealValue", "lostReason", "nextAction", "firstReplyMinutes", "notes", "source", "optIn", "followUpOn", "lastMessageAt", "tags"];
    const cell = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const val = (l, k) => k === "owner" ? (ownerOf(l.ownerId) || {}).name : k === "firstReplyMinutes" ? (l.firstResponseAt ? Math.round((Date.parse(l.firstResponseAt) - Date.parse(l.createdAt)) / 6e4) : "") : k === "tags" ? (l.tags || []).join(" ") : l[k];
    const csv = [cols.join(",")].concat(S.leads.map(l => cols.map(k => cell(val(l, k))).join(","))).join("\r\n");
    download(new Blob(["﻿" + csv], { type: "text/csv" }), "leads-" + new Date().toISOString().slice(0, 10) + ".csv");
  }
  function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

  /* ---------- WhatsApp automation (BotCommerce webhook workflows) ---------- */
  const AUTO_FIELDS = [["phone", "Who receives the message (digits with country code, no +)"], ["first_name", "Customer's first name"], ["name", "Customer's full name"], ["lead_phone", "Customer's WhatsApp number"], ["email", "Customer's email"], ["business", "Business name"], ["business_type", "Business category"], ["city", "City"], ["service", "What they asked about"], ["message", "Their message"], ["source", "Where the enquiry came from"], ["offer_title", "Offer name"], ["offer_discount", "Offer highlight (reminders)"], ["offer_valid_till", "Offer end date (reminders)"], ["offer_link", "Link to the offer page"], ["brand", "Your brand name"], ["site_url", "Your website address"], ["received_at", "When the enquiry arrived"]];
  const AUTO_KINDS = [
    { k: "welcome", title: "Welcome message to new leads", when: "Sent the moment someone submits a form on the website.", tpl: "Hi {{1}}, thanks for contacting {{2}}! We've received your enquiry about {{3}}. Our team will call you shortly.", vars: "{{1}} = first_name, {{2}} = brand, {{3}} = service" },
    { k: "alert", title: "New-lead alert to your team", when: "Sent to the numbers below whenever a new enquiry arrives.", tpl: "New enquiry: {{1}} ({{2}}) is interested in {{3}}. Source: {{4}}. Message: {{5}}", vars: "{{1}} = name, {{2}} = lead_phone, {{3}} = service, {{4}} = source, {{5}} = message" },
    { k: "reminder", title: "Offer reminders", when: "Sent from Leads → Message leads → Send via BotCommerce, only to leads who opted in.", tpl: "Hi {{1}}, {{2}} is on now: {{3}}. Valid till {{4}}. See details: {{5}}", vars: "{{1}} = first_name, {{2}} = offer_title, {{3}} = offer_discount, {{4}} = offer_valid_till, {{5}} = offer_link" },
  ];
  async function renderAutomation(c) {
    if (isStaff()) { c.innerHTML = '<div class="empty">Only admins can change automation.</div>'; return; }
    c.innerHTML = '<div class="boot">Loading…</div>';
    let cfg = {}, log = [];
    try { [cfg, log] = await Promise.all([api("GET", "automation"), api("GET", "automation-log").catch(() => [])]); }
    catch (err) { c.innerHTML = '<div class="empty">' + esc(err.message) + '</div>'; return; }
    const card = a => '<div class="card auto-card"><div class="auto-h"><h2>' + esc(a.title) + '</h2><label class="chk" for="a_' + a.k + '_on"><input type="checkbox" id="a_' + a.k + '_on"' + (cfg[a.k + "_on"] ? " checked" : "") + '><span>On</span></label></div><p class="help">' + esc(a.when) + '</p>' +
      '<div class="fld"><label for="a_' + a.k + '_url">BotCommerce Webhook Callback URL</label><input type="text" id="a_' + a.k + '_url" value="' + esc(cfg[a.k + "_url"] || "") + '" placeholder="https://…"></div>' +
      (a.k === "alert" ? '<div class="fld"><label for="a_alert_numbers">Team WhatsApp numbers</label><textarea id="a_alert_numbers" rows="2" placeholder="98765 43210, 91234 56789">' + esc(cfg.alert_numbers || "") + '</textarea><span class="hint">Separate numbers with a comma or a new line</span></div>' : '') +
      (a.k === "welcome" ? '<label class="chk" for="a_welcome_optin_only"><input type="checkbox" id="a_welcome_optin_only"' + (cfg.welcome_optin_only ? " checked" : "") + '><span>Only send to leads who ticked the WhatsApp box<span class="hint">Leave unticked to reply to every enquiry that has a phone number</span></span></label>' : '') +
      '<details class="auto-tpl"><summary>Suggested BotCommerce template</summary><div class="msg-preview">' + esc(a.tpl) + '</div><p class="help" style="font-size:13px">Map the variables: ' + esc(a.vars) + '. Map the recipient to <b>phone</b>.</p></details>' +
      '<div class="auto-sample"><input type="tel" id="a_' + a.k + '_test" placeholder="Your WhatsApp number" aria-label="Number to receive the sample"><button class="btn btn-s btn-sm" data-asample="' + a.k + '">Send sample</button></div></div>';
    c.innerHTML = '<div class="card"><h2>How this works</h2><ol class="auto-steps">' +
        '<li>In BotCommerce: <b>Bot Manager → Message Template</b>, create a template and get it approved by WhatsApp.</li>' +
        '<li>Open <b>Webhook Workflow</b>, choose your WhatsApp number and the template, click <b>Create Workflow</b> and copy the <b>Webhook Callback URL</b>.</li>' +
        '<li>Paste it below, tick <b>On</b> and click <b>Save</b>.</li>' +
        '<li>Click <b>Send sample</b>, then in BotCommerce click <b>Capture Webhook Response</b> and map <b>phone</b> and the template variables. Save the workflow.</li></ol>' +
        '<p class="help">Messages go from your server to BotCommerce, so the webhook links never appear on the website.</p></div>' +
      '<div class="auto-grid">' + AUTO_KINDS.map(card).join("") + '</div>' +
      '<div class="card"><div class="fld"><label for="a_site_url">Website address used in links</label><input type="text" id="a_site_url" value="' + esc(cfg.site_url || "") + '" placeholder="https://vividbrandify.com"><span class="hint">Leave empty to use the address from SEO & sharing</span></div><div style="margin-top:12px"><button class="btn btn-p" data-asave>Save automation</button></div></div>' +
      '<div class="card"><h2>Fields sent to BotCommerce</h2><div class="tbl-wrap"><table class="auto-fields"><tbody>' + AUTO_FIELDS.map(([k, d]) => '<tr><td><code>' + k + '</code></td><td>' + esc(d) + '</td></tr>').join("") + '</tbody></table></div></div>' +
      '<div class="card"><h2>Recent sends</h2>' + (log.length ? '<div class="tbl-wrap"><table><thead><tr><th>When</th><th>Type</th><th>To</th><th>Lead</th><th>Result</th></tr></thead><tbody>' + log.map(r => '<tr><td>' + new Date(r.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) + '</td><td>' + esc(r.kind) + '</td><td>+' + esc(r.phone) + '</td><td>' + esc(r.lead_name) + '</td><td>' + (r.status == null ? (r.error ? '<span class="tagp warn">' + esc(r.error.slice(0, 60)) + '</span>' : '<span class="tagp off">sending…</span>') : r.status < 300 ? '<span class="tagp live">delivered to BotCommerce</span>' : '<span class="tagp warn">error ' + r.status + '</span>') + '</td></tr>').join("") + '</tbody></table></div>' : '<p class="help">Nothing sent yet.</p>') + '</div>';
    const read = () => ({
      welcome_on: $c("a_welcome_on").checked, welcome_url: $c("a_welcome_url").value.trim(), welcome_optin_only: $c("a_welcome_optin_only").checked,
      alert_on: $c("a_alert_on").checked, alert_url: $c("a_alert_url").value.trim(), alert_numbers: $c("a_alert_numbers").value.trim(),
      reminder_on: $c("a_reminder_on").checked, reminder_url: $c("a_reminder_url").value.trim(), site_url: $c("a_site_url").value.trim(),
    });
    c.querySelector("[data-asave]").addEventListener("click", async () => {
      try { await api("PUT", "automation", read()); toast("Automation saved."); } catch (err) { toast(err.message, true); }
    });
    c.querySelectorAll("[data-asample]").forEach(b => b.addEventListener("click", async () => {
      const k = b.dataset.asample;
      try { await api("PUT", "automation", read()); await api("POST", "automation-sample", { kind: k, phone: $c("a_" + k + "_test").value }); toast("Sample sent. Now click Capture Webhook Response in BotCommerce."); setTimeout(() => renderAutomation(c), 4000); }
      catch (err) { toast(err.message, true); }
    }));
  }
  const $c = id => document.getElementById(id);

  /* ---------- message leads (offer reminders) ---------- */
  function openMessenger() {
    const offers = (S.content.offers || []).filter(o => o.published);
    const base = ((S.content.seo && S.content.seo.siteUrl) || location.origin).replace(/\/$/, "");
    const brand = (S.content.settings && S.content.settings.brand) || "us";
    const M = { audience: "optin", status: "", source: "", type: "", service: "", city: "", skipDays: "3", offer: "", text: "", sent: new Set() };
    const offerText = o => "Hi {name}, " + (o.badge ? o.badge + " from " + brand + ": " : "") + o.title + (o.discount ? " – " + o.discount : "") + "." + (o.endDate ? " Valid till " + new Date(o.endDate + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + "." : "") + "\nDetails: " + base + "/offer/" + o.slug + "\nReply YES and our team will call you.";
    const live = offers.find(o => offerStatus(o) === "live");
    if (live) { M.offer = live.slug; M.text = offerText(live); } else M.text = "Hi {name}, this is " + brand + ". ";
    const fill = (t, l) => t.replace(/\{name\}/g, (l.name || "").split(" ")[0] || "there").replace(/\{business\}/g, l.business || "your business").replace(/\{city\}/g, l.city || "your city");
    function recipients() {
      const cut = Date.now() - (+M.skipDays) * 864e5;
      return S.leads.filter(l => waNum(l.phone).length >= 11 && (M.audience === "all" || l.optIn) && (!M.status || l.status === M.status) &&
        (!M.type || l.businessType === M.type) && (!M.service || l.service === M.service) && (!M.city || (l.city || "").toLowerCase().includes(M.city.toLowerCase())) &&
        (!M.source || (M.source === "contact" ? !/^\/offer\//.test(l.source || "") : (l.source || "").startsWith("/offer/" + M.source))) &&
        (!(+M.skipDays) || !l.lastMessageAt || Date.parse(l.lastMessageAt) < cut));
    }
    const m = document.createElement("div"); m.className = "modal";
    document.body.appendChild(m);
    function draw() {
      const list = recipients();
      const optedIn = S.leads.filter(l => l.optIn).length;
      m.innerHTML = '<div class="box msgbox"><header><h2>Message leads</h2><button class="btn btn-g btn-sm" data-x>Close</button></header>' +
        '<p class="help">Send an offer or reminder on WhatsApp. Each message opens WhatsApp with the text ready and the lead\'s name filled in; you press send. For large lists, download the CSV and upload it to your WhatsApp marketing software.</p>' +
        '<div class="msg-grid"><div class="form">' +
          '<div class="fld"><label for="mAud">Who to message</label><select id="mAud"><option value="optin"' + (M.audience === "optin" ? " selected" : "") + '>Leads who opted in to WhatsApp (' + optedIn + ')</option><option value="all"' + (M.audience === "all" ? " selected" : "") + '>All leads with a phone number</option></select>' + (M.audience === "all" ? '<span class="hint warn-text">Only message people who expect to hear from you. Unwanted messages get numbers reported and blocked.</span>' : '') + '</div>' +
          '<div class="two"><div class="fld"><label for="mSt">Status</label><select id="mSt"><option value="">Any status</option>' + ["new", "contacted", "won", "lost"].map(x => '<option' + (M.status === x ? " selected" : "") + '>' + x + '</option>').join("") + '</select></div>' +
          '<div class="fld"><label for="mSrc">Came from</label><select id="mSrc"><option value="">Anywhere</option><option value="contact"' + (M.source === "contact" ? " selected" : "") + '>Website contact form</option>' + offers.map(o => '<option value="' + esc(o.slug) + '"' + (M.source === o.slug ? " selected" : "") + '>Offer page: ' + esc(o.title) + '</option>').join("") + '</select></div></div>' +
          '<div class="two"><div class="fld"><label for="mType">Business category</label><select id="mType"><option value="">Any category</option>' + leadValues("businessType").map(v => '<option' + (M.type === v ? " selected" : "") + '>' + esc(v) + '</option>').join("") + '</select></div>' +
          '<div class="fld"><label for="mSvc">Interested in</label><select id="mSvc"><option value="">Any service</option>' + leadValues("service").map(v => '<option' + (M.service === v ? " selected" : "") + '>' + esc(v) + '</option>').join("") + '</select></div></div>' +
          '<div class="fld"><label for="mCity">City</label><input id="mCity" type="text" placeholder="Any city" value="' + esc(M.city) + '"></div>' +
          '<div class="fld"><label for="mSkip">Skip leads messaged in the last</label><select id="mSkip">' + [["0", "Don't skip"], ["1", "1 day"], ["3", "3 days"], ["7", "7 days"], ["30", "30 days"]].map(([v, t]) => '<option value="' + v + '"' + (M.skipDays === v ? " selected" : "") + '>' + t + '</option>').join("") + '</select></div>' +
          '<div class="fld"><label for="mOffer">Start from an offer</label><select id="mOffer"><option value="">Write my own message</option>' + offers.map(o => '<option value="' + esc(o.slug) + '"' + (M.offer === o.slug ? " selected" : "") + '>' + esc(o.title) + ' (' + offerStatus(o) + ')</option>').join("") + '</select></div>' +
          '<div class="fld"><label for="mText">Message</label><textarea id="mText" rows="6">' + esc(M.text) + '</textarea><span class="hint">{name} becomes the lead\'s first name, {business} their business name, {city} their city.</span></div>' +
        '</div><div class="msg-list"><div class="msg-head"><b>' + list.length + ' lead' + (list.length === 1 ? "" : "s") + '</b><span>' + M.sent.size + ' sent</span><span style="flex:1"></span><button class="btn btn-s btn-sm" data-mcsv' + (list.length ? "" : " disabled") + '>Download CSV</button><button class="btn btn-g btn-sm" data-mcopy' + (list.length ? "" : " disabled") + '>Copy numbers</button></div>' +
          (list.length ? '<div class="msg-rows">' + list.map(l => '<div class="msg-row' + (M.sent.has(l.id) ? " done" : "") + '"><span><b>' + esc(l.name) + '</b><small>+' + esc(waNum(l.phone)) + (l.lastMessageAt ? ' · last messaged ' + new Date(l.lastMessageAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : '') + '</small></span>' +
            (M.sent.has(l.id) ? '<span class="tagp live">Sent ✓</span>' : '<a class="btn btn-p btn-sm" target="_blank" rel="noopener" data-msend="' + l.id + '" href="https://wa.me/' + waNum(l.phone) + '?text=' + encodeURIComponent(fill(M.text, l)) + '">Send on WhatsApp</a>') + '</div>').join("") + '</div>'
            : '<div class="empty">No leads match. ' + (M.audience === "optin" ? "Only leads who ticked the WhatsApp box on a form are included." : "") + '</div>') +
          (M.offer && list.length ? '<div class="bc-send"><b>Send automatically via BotCommerce</b><p class="help" style="font-size:13px">Uses your approved offer-reminder template. Goes only to the ' + list.filter(l => l.optIn).length + ' opted-in lead' + (list.filter(l => l.optIn).length === 1 ? '' : 's') + ' in this list.</p>' + (M.confirm ? '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-p btn-sm" data-bcgo>Yes, send now</button><button class="btn btn-g btn-sm" data-bcno>Cancel</button></div>' : '<button class="btn btn-s btn-sm" data-bcsend' + (list.some(l => l.optIn) ? '' : ' disabled') + '>Send to ' + list.filter(l => l.optIn).length + ' via BotCommerce</button>') + '</div>' : '') +
          (list.length ? '<p class="help" style="font-size:13px;margin-top:8px">Preview for ' + esc(list[0].name) + ':</p><div class="msg-preview">' + esc(fill(M.text, list[0])).replace(/\n/g, "<br>") + '</div>' : '') +
        '</div></div></div>';
    }
    draw();
    m.addEventListener("change", e => {
      const id = e.target.id;
      if (id === "mAud") M.audience = e.target.value;
      if (id === "mSt") M.status = e.target.value;
      if (id === "mSrc") M.source = e.target.value;
      if (id === "mSkip") M.skipDays = e.target.value;
      if (id === "mType") M.type = e.target.value;
      if (id === "mSvc") M.service = e.target.value;
      if (id === "mCity") M.city = e.target.value.trim();
      if (id === "mOffer") { M.offer = e.target.value; const o = offers.find(x => x.slug === M.offer); M.text = o ? offerText(o) : "Hi {name}, this is " + brand + ". "; }
      if (id !== "mText") draw();
    });
    let typing;
    m.addEventListener("input", e => { if (e.target.id === "mText") { M.text = e.target.value; clearTimeout(typing); typing = setTimeout(() => { const pos = e.target.selectionStart; draw(); const t = document.getElementById("mText"); t.focus(); t.setSelectionRange(pos, pos); }, 500); } });
    m.addEventListener("click", async e => {
      if (e.target === m || e.target.closest("[data-x]")) { m.remove(); if (S.view === "leads") renderView(); return; }
      const send = e.target.closest("[data-msend]");
      if (send) {
        const id = send.dataset.msend; M.sent.add(id);
        try { const l = await api("PATCH", "leads/" + id, { messaged: true }); Object.assign(S.leads.find(x => x.id === id), l); } catch (err) { toast(err.message, true); }
        setTimeout(draw, 300);
        return;
      }
      if (e.target.closest("[data-bcsend]")) { M.confirm = true; draw(); return; }
      if (e.target.closest("[data-bcno]")) { M.confirm = false; draw(); return; }
      if (e.target.closest("[data-bcgo]")) {
        const ids = recipients().filter(l => l.optIn).map(l => l.id);
        M.confirm = false;
        try {
          const r = await api("POST", "reminders", { ids, offer: M.offer });
          ids.forEach(id => { M.sent.add(id); const l = S.leads.find(x => x.id === id); if (l) l.lastMessageAt = new Date().toISOString(); });
          toast("Sent " + r.sent + " reminder" + (r.sent === 1 ? "" : "s") + " through BotCommerce.");
        } catch (err) { toast(err.message, true); }
        draw(); return;
      }
      if (e.target.closest("[data-mcsv]")) {
        const cell = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
        const rows = recipients().map(l => [l.name, "+" + waNum(l.phone), fill(M.text, l)].map(cell).join(","));
        download(new Blob(["﻿" + ["name,phone,message"].concat(rows).join("\r\n")], { type: "text/csv" }), "whatsapp-campaign-" + todayStr() + ".csv");
        return;
      }
      if (e.target.closest("[data-mcopy]")) {
        const nums = recipients().map(l => "+" + waNum(l.phone)).join("\n");
        try { await navigator.clipboard.writeText(nums); toast("Numbers copied."); } catch (_) { toast("Couldn't copy. Use Download CSV instead.", true); }
      }
    });
  }

  /* ---------- media ---------- */
  function mediaGrid(pick) {
    return S.media.length ? '<div class="media">' + S.media.map(m => '<div class="m' + (pick ? " pick" : "") + '"' + (pick ? ' data-choose="' + esc(m.url) + '"' : '') + '><div class="ph" style="background-image:url(\'' + esc(m.url) + '\')"></div><div class="meta"><span title="' + esc(m.name) + '">' + esc(m.name) + '</span>' +
      (pick ? '' : '<div class="row"><button class="btn btn-g btn-sm" data-copy="' + esc(m.url) + '">Copy link</button>' + (S.pendingDel === m.id ? '<button class="btn btn-d btn-sm" data-mdelyes="' + m.id + '">Delete</button>' : '<button class="ib" data-mdel="' + m.id + '" aria-label="Delete image">🗑</button>') + '</div>') + '</div></div>').join("") + '</div>'
      : '<div class="empty">No images yet.</div>';
  }
  function renderMedia(c) {
    c.innerHTML = '<p class="help">Every image you upload is stored here and can be reused anywhere on the site. Deleting an image that is still in use leaves a blank space where it was.</p>' +
      '<label class="drop" id="drop">Drop images here or <span class="btn btn-s btn-sm">Choose files<input type="file" accept="image/*" multiple hidden id="mediaFiles"></span></label>' + mediaGrid(false);
    const drop = document.getElementById("drop");
    drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", async e => { e.preventDefault(); drop.classList.remove("over"); await uploadMany(e.dataTransfer.files); });
    document.getElementById("mediaFiles").addEventListener("change", e => uploadMany(e.target.files));
  }
  async function uploadMany(files) {
    for (const f of files) { try { await upload(f); } catch (e) { toast(e.message, true); } }
    if (S.view === "media") renderView();
  }
  async function upload(file) {
    const data = await prepareImage(file);
    const blob = await (await fetch(data)).blob();
    const item = await api("POST", "upload", { name: file.name, blob });
    S.media.unshift(item);
    toast("Uploaded " + file.name);
    return item;
  }
  function prepareImage(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onerror = () => rej(new Error("Couldn't read " + file.name));
      r.onload = () => {
        const raw = r.result;
        if (/image\/(gif|x-icon|vnd.microsoft.icon)/.test(file.type) || (file.type === "image/png" && file.size < 1.5e6) || (file.type === "image/webp" && file.size < 1.5e6)) return res(raw);
        const img = new Image();
        img.onerror = () => rej(new Error(file.name + " is not an image this browser can read."));
        img.onload = () => {
          const max = 2000, sc = Math.min(1, max / Math.max(img.width, img.height));
          const cv = document.createElement("canvas"); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          res(file.type === "image/png" ? cv.toDataURL("image/png") : cv.toDataURL("image/jpeg", .85));
        };
        img.src = raw;
      };
      r.readAsDataURL(file);
    });
  }
  function pickFromLibrary() {
    return new Promise(res => {
      const m = document.createElement("div"); m.className = "modal";
      const draw = () => { m.innerHTML = '<div class="box"><header><h2>Choose an image</h2><label class="btn btn-s btn-sm">Upload new<input type="file" accept="image/*" hidden id="pickUp"></label><button class="btn btn-g btn-sm" data-x>Cancel</button></header>' + mediaGrid(true) + '</div>'; };
      draw(); document.body.appendChild(m);
      m.addEventListener("click", e => {
        if (e.target === m || e.target.closest("[data-x]")) { m.remove(); res(null); }
        const ch = e.target.closest("[data-choose]"); if (ch) { m.remove(); res(ch.dataset.choose); }
      });
      m.addEventListener("change", async e => { if (e.target.id === "pickUp" && e.target.files[0]) { try { const it = await upload(e.target.files[0]); m.remove(); res(it.url); } catch (err) { toast(err.message, true); } } });
    });
  }

  /* ---------- account ---------- */
  async function renderAccount(c) {
    const pwCard = '<form class="card form" id="pwForm"><h2>Change password</h2>' +
      fld("pwCur", "Current password", '<input type="password" id="pwCur" autocomplete="current-password" required>') +
      fld("pwNew", "New password", '<input type="password" id="pwNew" autocomplete="new-password" minlength="8" required><span class="hint">At least 8 characters</span>') +
      '<div><button class="btn btn-p" type="submit">Update password</button></div></form>';
    const bindPw = () => document.getElementById("pwForm").addEventListener("submit", async e => {
      e.preventDefault();
      try { await api("POST", "password", { current: val("pwCur"), next: val("pwNew") }); e.target.reset(); toast("Password updated."); } catch (err) { toast(err.message, true); }
    });
    if (isStaff()) {
      c.innerHTML = '<div class="two">' + pwCard + '<div class="card"><h2>Your access</h2><p class="help">You have a <b>Staff</b> login: you can see and update leads, add notes and export them. Website content and settings are managed by admins.</p></div></div>';
      bindPw(); return;
    }
    const users = await api("GET", "users").catch(() => []);
    c.innerHTML = '<div class="two"><form class="card form" id="pwForm"><h2>Change password</h2>' +
      fld("pwCur", "Current password", '<input type="password" id="pwCur" autocomplete="current-password" required>') +
      fld("pwNew", "New password", '<input type="password" id="pwNew" autocomplete="new-password" minlength="8" required><span class="hint">At least 8 characters</span>') +
      '<div><button class="btn btn-p" type="submit">Update password</button></div></form>' +
      '<div class="card"><h2>Team</h2><p class="help" style="margin-bottom:10px"><b>Admin</b> edits everything. <b>Staff</b> sees and updates leads only.</p><div class="users">' + users.map(u => '<div' + (u.active ? '' : ' style="opacity:.6"') + '><span><b>' + esc(u.name || u.email) + '</b><br><span class="help" style="font-size:13px">' + esc(u.email) + (u.active ? '' : ' · no access') + '</span></span>' +
        (u.id === S.user.id ? '<span class="pill">You · Admin</span>' : '<select class="st" data-urole="' + u.id + '" aria-label="Role"><option value="staff"' + (u.role === "staff" ? " selected" : "") + '>Staff</option><option value="admin"' + (u.role === "admin" ? " selected" : "") + '>Admin</option></select>' +
          '<button class="btn btn-g btn-sm" data-uaccess="' + u.id + '" data-role="' + esc(u.role) + '" data-on="' + (u.active ? "0" : "1") + '">' + (u.active ? "Remove access" : "Give access") + '</button>') + '</div>').join("") + '</div>' +
      '<form class="form" id="userForm" style="margin-top:16px"><h2 style="font-size:16px">Add a team member</h2><div class="two">' + fld("uName", "Name", '<input type="text" id="uName">') + fld("uEmail", "Email", '<input type="email" id="uEmail" required>') + '</div><div class="two">' + fld("uPw", "Temporary password", '<input type="text" id="uPw" minlength="8" required><span class="hint">Share it with them privately; they can change it after signing in</span>') + fld("uRole", "Role", '<select id="uRole"><option value="staff">Staff (leads only)</option><option value="admin">Admin (everything)</option></select>') + '</div><div><button class="btn btn-s" type="submit">Add to team</button></div></form></div></div>' +
      '<div class="card"><h2>Backup & restore</h2><p class="help">Download all site content and leads as one file. Supabase also keeps daily database backups on its side.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn btn-s" data-act="backup">Download backup</button><label class="btn btn-g">Restore from file<input type="file" accept="application/json,.json" hidden id="restoreFile"></label></div><p class="help" style="margin-top:8px;font-size:13px">Restoring replaces the sections included in the file. Anything not in the file, and all leads and users, stay as they are.</p></div>';
    bindPw();
    c.querySelectorAll("[data-urole]").forEach(sel => sel.addEventListener("change", async () => {
      try { await api("PATCH", "users/" + sel.dataset.urole, { role: sel.value, active: true }); toast("Role updated."); renderAccount(c); } catch (err) { toast(err.message, true); }
    }));
    c.querySelectorAll("[data-uaccess]").forEach(b => b.addEventListener("click", async () => {
      try { await api("PATCH", "users/" + b.dataset.uaccess, { role: b.dataset.role, active: b.dataset.on === "1" }); toast(b.dataset.on === "1" ? "Access given." : "Access removed."); renderAccount(c); } catch (err) { toast(err.message, true); }
    }));
    document.getElementById("userForm").addEventListener("submit", async e => {
      e.preventDefault();
      try { await api("POST", "users", { name: val("uName"), email: val("uEmail"), password: val("uPw"), role: val("uRole") }); toast("Team member added."); renderAccount(c); } catch (err) { toast(err.message, true); }
    });
    document.getElementById("restoreFile").addEventListener("change", async e => {
      const f = e.target.files[0]; if (!f) return;
      try { const j = JSON.parse(await f.text()); await api("POST", "restore", { content: j.content }); S.content = await api("GET", "content"); toast("Content restored."); }
      catch (err) { toast(err.message.startsWith("Unexpected") ? "That file isn't a valid backup." : err.message, true); }
    });
  }

  /* ---------- events ---------- */
  app.addEventListener("click", async e => {
    const b = e.target.closest("button, [data-nav]");
    if (!b || !S.schema) return;
    const d = b.dataset;
    if (d.nav) { document.getElementById("side") && document.getElementById("side").classList.remove("open"); return navigate(d.nav); }
    if (d.act === "menu") return document.getElementById("side").classList.toggle("open");
    if (d.act === "logout") { if (S.dirty && !(await confirmLeave())) return; S.dirty = false; await api("POST", "logout").catch(() => {}); S.user = null; return renderAuth(false); }
    if (d.act === "save") return save();
    if (d.act === "discard") { S.draft = clone(S.content[S.view]); S.dirty = false; S.pendingDel = null; renderView(); return; }
    if (d.act === "csv") return exportCsv();
    if (d.act === "message") return openMessenger();
    if (d.act === "ocsv") return exportOrders();
    if (d.act === "gstcsv") return exportGst();
    if (d.act === "savepay") return savePayments();
    if (d.act === "testmail") { const to = (document.getElementById("testTo") || {}).value || ""; b.disabled = true; try { await api("POST", "test-mail", { to }); toast("Test email sent to " + to + ". Check the inbox (and spam)."); } catch (err) { toast(err.message, true); } b.disabled = false; return; }
    if (d.copy) { try { await navigator.clipboard.writeText(d.copy); toast("Copied."); } catch (_) { toast("Couldn't copy. Select the text and copy it.", true); } return; }
    if (d.range) { S.dashRange = +d.range; const ch = document.querySelector(".d-chart"); if (ch) ch.outerHTML = trendChart(); return; }
    if (d.lf) { S.leadFilter = { q: "", status: "", stage: "", type: "", service: "", priority: "", owner: "" }; S.leadFilter[d.lf] = d.lv; if (d.lf === "stage" || d.lf === "status") { try { localStorage.setItem("vb_lead_view", "list"); } catch (_) {} } return navigate("leads"); }
    if (d.lview) { try { localStorage.setItem("vb_lead_view", d.lview); } catch (_) {} return renderView(); }
    if (d.act === "leadsettings") return leadSettings();
    if (d.zone) { S.leadFilter.stage = d.zone; try { localStorage.setItem("vb_lead_view", "list"); } catch (_) {} return renderView(); }
    if (d.openlead) return openLead(d.openlead);
    if (d.quickwa) {
      const l = S.leads.find(x => x.id === d.quickwa); if (!l) return;
      window.open("https://wa.me/" + waNum(l.phone) + "?text=" + encodeURIComponent("Hi " + (l.name || "").split(" ")[0] + ", this is " + ((S.content.settings || {}).brand || "us") + ". Thanks for your enquiry about " + (l.service || "our services") + "."), "_blank", "noopener");
      await api("POST", "lead-activity", { leadId: l.id, kind: "whatsapp", detail: "Replied on WhatsApp from the dashboard" }).catch(err => toast(err.message, true));
      S.leads = await api("GET", "leads").catch(() => S.leads); toast("Marked as replied."); return renderView();
    }
    if (d.open && S.view !== "leads") return;
    if (d.act === "newoffer") { await navigate("offers"); const add = document.querySelector('[data-act="add"]'); if (add) add.click(); return; }
    if (d.act === "backup") { try { const j = await api("GET", "backup"); return download(new Blob([JSON.stringify(j, null, 1)], { type: "application/json" }), "vivid-brandify-backup-" + new Date().toISOString().slice(0, 10) + ".json"); } catch (err) { return toast("Backup failed: " + err.message, true); } }

    const sc = S.schema[S.view];
    if (d.act === "add" && sc) {
      const n = Object.assign(clone(sc.blank), { id: S.view[0] + Date.now().toString(36) });
      if (S.view === "posts") n.date = new Date().toISOString().slice(0, 10);
      S.draft.push(n); S.sel = n.id; markDirty(); renderView(); const first = document.querySelector("#objForm input[type=text], #objForm textarea"); if (first) first.focus(); return;
    }
    if (d.sel) { S.sel = d.sel; S.pendingDel = null; renderView(); const v = document.getElementById("viewSite"); if (v) v.href = previewHref(); return; }
    if (d.mv) { const L = S.draft, i = L.findIndex(x => x.id === d.id), j = i + +d.mv; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; markDirty(); renderView(); return; }
    if (d.del) { S.pendingDel = d.del; renderView(); return; }
    if (d.delno !== undefined) { S.pendingDel = null; renderView(); return; }
    if (d.delyes) { S.draft = S.draft.filter(x => x.id !== d.delyes); if (S.sel === d.delyes) S.sel = null; S.pendingDel = null; markDirty(); renderView(); return; }
    if (d.pick) { const url = await pickFromLibrary(); if (url) { currentObj()[d.pick] = url; markDirty(); renderView(); } return; }
    if (d.clear) { currentObj()[d.clear] = ""; markDirty(); renderView(); return; }

    if (d.ldel) { S.pendingDel = d.ldel; renderView(); return; }
    if (d.ldelyes) { try { await api("DELETE", "leads/" + d.ldelyes); S.leads = S.leads.filter(l => l.id !== d.ldelyes); S.pendingDel = null; toast("Lead deleted."); renderShell(); } catch (err) { toast(err.message, true); } return; }
    if (d.mdel) { S.pendingDel = d.mdel; renderView(); return; }
    if (d.mdelyes) { try { await api("DELETE", "media/" + d.mdelyes); S.media = S.media.filter(m => m.id !== d.mdelyes); S.pendingDel = null; renderView(); toast("Image deleted."); } catch (err) { toast(err.message, true); } return; }
    if (d.copy) { const url = /^https?:/.test(d.copy) ? d.copy : location.origin + d.copy; try { await navigator.clipboard.writeText(url); toast("Link copied."); } catch (_) { toast(url); } return; }
  });

  app.addEventListener("input", e => {
    const t = e.target;
    if (t.id === "lq") { S.leadFilter.q = t.value; const pos = t.selectionStart; renderView(); const n = document.getElementById("lq"); n.focus(); n.setSelectionRange(pos, pos); return; }
    if (t.id === "oq") { S.orderFilter.q = t.value; const pos = t.selectionStart; renderView(); const n = document.getElementById("oq"); n.focus(); n.setSelectionRange(pos, pos); return; }
    const k = t.dataset.k; if (!k || !S.draft) return;
    const o = currentObj(); if (!o) return;
    o[k] = t.type === "checkbox" ? t.checked : t.type === "number" ? Number(t.value) : t.value;
    if (t.dataset.sync) { const txt = document.getElementById(t.dataset.sync); if (txt) txt.value = t.value; }
    else if (t.type === "text" && t.parentElement.classList.contains("color")) { const cp = t.parentElement.querySelector("input[type=color]"); if (cp && /^#[0-9a-f]{6}$/i.test(t.value)) cp.value = t.value; }
    markDirty();
    const sc = S.schema[S.view];
    if (sc.kind === "list") { const btn = document.querySelector('.item.sel .t'); if (btn) btn.innerHTML = itemTitle(sc, o); }
    if (S.view === "widget" && k === "mode") renderView();
  });
  app.addEventListener("change", async e => {
    const t = e.target;
    if (t.id === "ls") { S.leadFilter.stage = t.value; renderView(); return; }
    if (t.id === "lprio") { S.leadFilter.priority = t.value; renderView(); return; }
    if (t.id === "lowner") { S.leadFilter.owner = t.value; renderView(); return; }
    if (t.dataset.lstage) {
      if (t.value === "lost") { const id = t.dataset.lstage; moveLead(id, "lost").then(() => renderView()); return; }
      patchLead(t.dataset.lstage, { stage: t.value }, "Stage updated."); return;
    }
    if (t.id === "ltype") { S.leadFilter.type = t.value; renderView(); return; }
    if (t.id === "lsvc") { S.leadFilter.service = t.value; renderView(); return; }
    if (t.id === "ost") { S.orderFilter.status = t.value; renderView(); return; }
    if (t.id === "oprod") { S.orderFilter.product = t.value; renderView(); return; }
    if (t.dataset.ostatus) {
      try { const o = await api("PATCH", "orders/" + t.dataset.ostatus, { status: t.value }); Object.assign(S.orders.find(x => x.id === o.id), o); toast("Order updated."); renderView(); } catch (err) { toast(err.message, true); }
      return;
    }
    if (t.dataset.onotes) {
      try { await api("PATCH", "orders/" + t.dataset.onotes, { notes: t.value }); S.orders.find(x => x.id === t.dataset.onotes).notes = t.value; toast("Note saved."); } catch (err) { toast(err.message, true); }
      return;
    }
    if (t.dataset.lstatus) {
      try { const l = await api("PATCH", "leads/" + t.dataset.lstatus, { status: t.value }); Object.assign(S.leads.find(x => x.id === l.id), l); t.className = "st st-" + l.status; toast("Status updated."); } catch (err) { toast(err.message, true); }
      return;
    }
    if (t.dataset.lfollow) {
      try { const l = await api("PATCH", "leads/" + t.dataset.lfollow, { followUpOn: t.value }); Object.assign(S.leads.find(x => x.id === l.id), l); toast(t.value ? "Follow-up set for " + new Date(t.value + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + "." : "Follow-up cleared."); } catch (err) { toast(err.message, true); }
      return;
    }
    if (t.dataset.lnotes) {
      try { await api("PATCH", "leads/" + t.dataset.lnotes, { notes: t.value }); S.leads.find(x => x.id === t.dataset.lnotes).notes = t.value; toast("Note saved."); } catch (err) { toast(err.message, true); }
      return;
    }
    if (t.dataset.upload && t.files[0]) {
      try { const it = await upload(t.files[0]); currentObj()[t.dataset.upload] = it.url; markDirty(); renderView(); } catch (err) { toast(err.message, true); }
    }
  });
  // savebar lives outside #app's content but inside #app; clicks bubble to the handler above.

  boot();
})();
