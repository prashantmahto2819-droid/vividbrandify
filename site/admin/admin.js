/* Vivid Brandify admin panel (no framework). Data goes through supabase-api.js. */
(function () {
  "use strict";
  const app = document.getElementById("app");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const val = id => document.getElementById(id).value;
  const clone = o => JSON.parse(JSON.stringify(o));
  const TICK = '<svg viewBox="0 0 18 11"><path d="M1 6l3.5 3.5L11 2"/><path d="M7 9.5L15.5 1"/></svg>';

  const S = { user: null, schema: null, content: null, view: "dashboard", sel: null, draft: null, dirty: false, leads: [], media: [], dash: null, pendingDel: null, leadFilter: { q: "", status: "" } };

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
      '<div class="brandmark"><span class="mark">' + TICK + '</span>Vivid Brandify</div>' +
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
    const [schema, content, leads, media, dash] = await Promise.all([api("GET", "schema"), api("GET", "content"), api("GET", "leads"), api("GET", "media"), api("GET", "dashboard")]);
    Object.assign(S, { schema, content, leads, media, dash });
  }

  /* ---------- shell ---------- */
  const NAV = [
    ["", [["dashboard", "Dashboard"]]],
    ["Content", [["slides"], ["offers"], ["services"], ["steps"], ["testimonials"], ["posts"], ["faqs"]]],
    ["Layout", [["sections"]]],
    ["WhatsApp", [["widget", "Chat widget"], ["leads", "Leads"]]],
    ["Site", [["settings"], ["theme"], ["seo"]]],
    ["Advanced", [["code"], ["media", "Media library"], ["account", "Account & backup"]]],
  ];
  const isStaff = () => !!(S.user && S.user.role === "staff");
  const STAFF_NAV = [["", [["dashboard", "Dashboard"]]], ["Work", [["leads", "Leads"]]], ["You", [["account", "My account"]]]];
  const STAFF_VIEWS = ["dashboard", "leads", "account"];
  const labelOf = v => (isStaff() && v === "account") ? "My account" : baseLabel(v);
  const baseLabel = v => (S.schema[v] && S.schema[v].label) || ({ dashboard: "Dashboard", leads: "Leads", media: "Media library", account: "Account & backup", widget: "WhatsApp chat widget" })[v] || v;

  function renderShell() {
    const newLeads = S.leads.filter(l => l.status === "new").length;
    app.innerHTML = '<div class="shell"><aside class="side" id="side"><div class="brandmark"><span class="mark">' + TICK + '</span>' + esc((S.content.settings.brand || "Vivid Brandify")) + '</div>' +
      (isStaff() ? STAFF_NAV : NAV).map(([g, items]) => (g ? '<div class="grp">' + g + '</div>' : '') + items.map(([k, l]) => '<button data-nav="' + k + '" class="' + (S.view === k ? "on" : "") + '">' + esc(l || labelOf(k)) + (k === "leads" && newLeads ? '<span class="n">' + newLeads + '</span>' : '') + '</button>').join("")).join("") +
      '<div class="spacer"></div><div class="me">Signed in as ' + esc(S.user.email) + '<br><span class="pill" style="margin-top:6px;display:inline-block">' + (isStaff() ? "Staff" : "Admin") + '</span></div><button data-act="logout">Sign out</button></aside>' +
      '<div class="main"><div class="topbar"><button class="btn btn-g btn-sm menu-t" data-act="menu">Menu</button><h1>' + esc(labelOf(S.view)) + '</h1><div class="sp"></div><a class="btn btn-g btn-sm" id="viewSite" href="' + previewHref() + '" target="_blank" rel="noopener">View site ↗</a></div>' +
      '<div class="content" id="content"></div></div></div>' + '<div id="savebarSlot"></div>';
    renderView();
  }
  function previewHref() {
    if (S.view === "posts" && S.sel && S.draft) { const p = S.draft.find(x => x.id === S.sel); if (p && p.slug && p.published) return "/blog/" + encodeURIComponent(p.slug); }
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
    if (sc) {
      if (!S.draft) S.draft = clone(S.content[S.view]);
      if (sc.kind === "list") renderListEditor(c, sc); else renderObjectEditor(c, sc);
      renderSavebar();
    }
  }

  async function navigate(v) {
    if (S.dirty && !(await confirmLeave())) return;
    S.view = v; S.sel = null; S.draft = null; S.dirty = false; S.pendingDel = null;
    if (v === "dashboard") { S.dash = await api("GET", "dashboard").catch(() => S.dash); S.leads = await api("GET", "leads").catch(() => S.leads); }
    if (v === "leads") S.leads = await api("GET", "leads").catch(() => S.leads);
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
    if (S.view === "posts" && !it.published) tags += '<span class="tagp off">draft</span>';
    if (S.view === "testimonials" && it.sample) tags += '<span class="tagp warn">sample</span>';
    if (S.view === "sections" && !it.visible) tags += '<span class="tagp off">hidden</span>';
    if (S.view === "services" && it.featured) tags += '<span class="tagp warn">featured</span>';
    if (S.view === "offers") { const os = offerStatus(it); tags += '<span class="tagp ' + (os === "live" ? "live" : os === "draft" || os === "ended" ? "off" : "warn") + '">' + os + '</span>'; }
    return esc(t) + tags + (S.view === "posts" ? '<small>' + esc(it.date) + ' · /blog/' + esc(it.slug || "…") + '</small>' : S.view === "offers" ? '<small>' + esc(it.startDate || "now") + ' → ' + esc(it.endDate || "no end date") + ' · /offer/' + esc(it.slug || "…") + '</small>' : '');
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
    return "Website contact form";
  }
  const waNum = p => String(p || "").replace(/\D/g, "").replace(/^0+/, "").replace(/^(\d{10})$/, "91$1");
  function followUpsDue() {
    const t = todayStr();
    return S.leads.filter(l => l.followUpOn && l.followUpOn <= t && l.status !== "won" && l.status !== "lost").sort((a, b) => a.followUpOn.localeCompare(b.followUpOn));
  }
  function followUpCard() {
    const due = followUpsDue();
    return '<div class="card"><h2>Follow-ups due</h2>' + (due.length ? '<div class="check">' + due.slice(0, 8).map(l => '<div><span class="st st-' + (l.followUpOn < todayStr() ? "lost" : "contacted") + '">' + (l.followUpOn < todayStr() ? "overdue" : "today") + '</span><span style="flex:1;min-width:0"><b>' + esc(l.name) + '</b> · ' + esc(l.service) + '<br><span class="help" style="font-size:13px">' + esc(l.phone || l.email) + '</span></span>' + (l.phone ? '<a class="btn btn-g btn-sm" href="https://wa.me/' + waNum(l.phone) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + '</div>').join("") + '</div>' : '<p class="help">Nothing due. Set a follow-up date on a lead and it shows up here on that day.</p>') + '</div>';
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
  function renderDashboard(c) {
    if (isStaff()) return renderStaffDashboard(c);
    const d = S.dash, ck = d.checklist, weekAgo = Date.now() - 7 * 864e5;
    d.leads = { new: S.leads.filter(l => l.status === "new").length, week: S.leads.filter(l => Date.parse(l.createdAt) > weekAgo).length };
    d.recent = S.leads.slice(0, 5);
    const todo = [
      [ck.whatsapp, "Add your WhatsApp number", "settings"], [ck.email, "Add your contact email", "settings"],
      [ck.samples === 0, ck.samples ? "Replace " + ck.samples + " sample review" + (ck.samples > 1 ? "s" : "") + " with real ones" : "Reviews are real", "testimonials"],
      [ck.siteUrl, "Set your site address for Google", "seo"], [ck.ogImage, "Add a share image for WhatsApp and social links", "seo"],
      [ck.indexed, "Site is visible to search engines", "seo"],
    ];
    c.innerHTML = '<div class="grid4">' +
      kpi(d.leads.new, "New leads", "leads") + kpi(d.leads.week, "Leads this week", "leads") + kpi(d.counts.posts, "Blog posts", "posts") + kpi(d.counts.slides, "Slides", "slides") + '</div>' +
      '<div class="two"><div class="card"><h2>Setup checklist</h2><div class="check">' + todo.map(t => '<div><span class="dot ' + (t[0] ? "ok" : "warn") + '"></span><span style="flex:1">' + esc(t[1]) + '</span>' + (t[0] ? "" : '<button class="btn btn-g btn-sm" data-nav="' + t[2] + '">Fix</button>') + '</div>').join("") + '</div></div>' +
      '<div class="card"><h2>Latest leads</h2>' + (d.recent.length ? '<div class="check">' + d.recent.map(l => '<div><span class="st st-' + l.status + '">' + l.status + '</span><span style="flex:1;min-width:0"><b>' + esc(l.name) + '</b> · ' + esc(l.service) + '<br><span class="help" style="font-size:13px">' + new Date(l.createdAt).toLocaleString("en-IN") + '</span></span></div>').join("") + '</div><div style="margin-top:12px"><button class="btn btn-s btn-sm" data-nav="leads">All leads →</button></div>' : '<p class="help">No enquiries yet. They appear here when someone fills in the contact form.</p>') + '</div></div>' +
      followUpCard() +
      '<div class="card"><h2>Quick edits</h2><div style="display:flex;gap:8px;flex-wrap:wrap">' + ["offers", "slides", "posts", "widget", "sections", "settings"].map(k => '<button class="btn btn-s btn-sm" data-nav="' + k + '">' + esc(labelOf(k)) + '</button>').join("") + '</div></div>';
  }
  function renderStaffDashboard(c) {
    const weekAgo = Date.now() - 7 * 864e5, by = st => S.leads.filter(l => l.status === st).length;
    const recent = S.leads.slice(0, 8);
    c.innerHTML = '<p class="help">Hi ' + esc(S.user.name || S.user.email) + '. Here are the enquiries that need you.</p><div class="grid4">' +
      kpi(by("new"), "New leads", "leads") + kpi(S.leads.filter(l => Date.parse(l.createdAt) > weekAgo).length, "Leads this week", "leads") + kpi(by("contacted"), "Contacted", "leads") + kpi(by("won"), "Won", "leads") + '</div>' + followUpCard() +
      '<div class="card"><h2>Latest leads</h2>' + (recent.length ? '<div class="check">' + recent.map(l => '<div><span class="st st-' + l.status + '">' + l.status + '</span><span style="flex:1;min-width:0"><b>' + esc(l.name) + '</b> · ' + esc(l.service) + '<br><span class="help" style="font-size:13px">' + new Date(l.createdAt).toLocaleString("en-IN") + '</span></span></div>').join("") + '</div><div style="margin-top:12px"><button class="btn btn-p btn-sm" data-nav="leads">Open leads →</button></div>' : '<p class="help">No enquiries yet. New ones from the website appear here.</p>') + '</div>';
  }
  const kpi = (n, l, nav) => '<button class="card kpi" data-nav="' + nav + '" style="text-align:left;cursor:pointer"><b>' + n + '</b><span>' + esc(l) + '</span></button>';

  /* ---------- leads ---------- */
  function renderLeads(c) {
    const f = S.leadFilter, q = f.q.toLowerCase();
    const rows = S.leads.filter(l => (!f.status || l.status === f.status) && (!q || [l.name, l.phone, l.email, l.business, l.service, l.message].join(" ").toLowerCase().includes(q)));
    c.innerHTML = '<div class="filters"><input type="search" id="lq" placeholder="Search name, phone, message…" value="' + esc(f.q) + '" aria-label="Search leads"><select id="ls" aria-label="Filter by status"><option value="">All statuses</option>' + ["new", "contacted", "won", "lost"].map(s => '<option' + (f.status === s ? " selected" : "") + '>' + s + '</option>').join("") + '</select><span class="help">' + rows.length + ' of ' + S.leads.length + '</span><span style="flex:1"></span><button class="btn btn-p btn-sm" data-act="message">Message leads</button><button class="btn btn-s btn-sm" data-act="csv">Export CSV</button></div>' +
      (rows.length ? '<div class="tbl-wrap"><table><thead><tr><th>Received</th><th>Contact</th><th>Interested in</th><th>Message</th><th>Status</th><th>Follow-up</th><th>Notes</th><th></th></tr></thead><tbody>' + rows.map(l => {
        const wa = l.phone ? "https://wa.me/" + waNum(l.phone) : "";
        return '<tr><td><span style="font-variant-numeric:tabular-nums">' + new Date(l.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + '</span><div class="sub">' + new Date(l.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) + '</div></td>' +
          '<td><b>' + esc(l.name) + '</b>' + (l.business ? '<div class="sub">' + esc(l.business) + '</div>' : '') + (l.phone ? '<div class="sub"><a href="tel:' + esc(l.phone) + '">' + esc(l.phone) + '</a> · <a href="' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a></div>' : '') + (l.email ? '<div class="sub"><a href="mailto:' + esc(l.email) + '">' + esc(l.email) + '</a></div>' : '') + (l.optIn ? '<div><span class="tagp live" style="margin:4px 0 0">WhatsApp opt-in</span></div>' : '') + (l.lastMessageAt ? '<div class="sub">Messaged ' + new Date(l.lastMessageAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + '</div>' : '') + '</td>' +
          '<td>' + esc(l.service) + '<div class="sub">' + esc(leadSource(l)) + '</div></td><td><div class="msg">' + esc(l.message) + '</div></td>' +
          '<td><select class="st st-' + l.status + '" data-lstatus="' + l.id + '" aria-label="Status">' + ["new", "contacted", "won", "lost"].map(s => '<option' + (s === l.status ? " selected" : "") + '>' + s + '</option>').join("") + '</select></td>' +
          '<td><input type="date" class="lead-date" data-lfollow="' + l.id + '" value="' + esc(l.followUpOn) + '" aria-label="Follow-up date"></td>' +
          '<td><textarea class="lead-notes" data-lnotes="' + l.id + '" aria-label="Notes">' + esc(l.notes) + '</textarea></td>' +
          '<td>' + (isStaff() ? '' : S.pendingDel === l.id ? '<span class="confirm"><button class="btn btn-d btn-sm" data-ldelyes="' + l.id + '">Delete</button><button class="btn btn-g btn-sm" data-delno>Keep</button></span>' : '<button class="ib" data-ldel="' + l.id + '" aria-label="Delete lead">🗑</button>') + '</td></tr>';
      }).join("") + '</tbody></table></div>' : '<div class="empty">' + (S.leads.length ? "No leads match this filter." : "No enquiries yet. Leads from the website contact form appear here.") + '</div>');
  }
  function exportCsv() {
    const cols = ["createdAt", "name", "phone", "email", "business", "service", "message", "status", "notes", "source", "optIn", "followUpOn", "lastMessageAt"];
    const cell = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const csv = [cols.join(",")].concat(S.leads.map(l => cols.map(k => cell(l[k])).join(","))).join("\r\n");
    download(new Blob(["﻿" + csv], { type: "text/csv" }), "leads-" + new Date().toISOString().slice(0, 10) + ".csv");
  }
  function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

  /* ---------- message leads (offer reminders) ---------- */
  function openMessenger() {
    const offers = (S.content.offers || []).filter(o => o.published);
    const base = ((S.content.seo && S.content.seo.siteUrl) || location.origin).replace(/\/$/, "");
    const brand = (S.content.settings && S.content.settings.brand) || "us";
    const M = { audience: "optin", status: "", source: "", skipDays: "3", offer: "", text: "", sent: new Set() };
    const offerText = o => "Hi {name}, " + (o.badge ? o.badge + " from " + brand + ": " : "") + o.title + (o.discount ? " – " + o.discount : "") + "." + (o.endDate ? " Valid till " + new Date(o.endDate + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + "." : "") + "\nDetails: " + base + "/offer/" + o.slug + "\nReply YES and our team will call you.";
    const live = offers.find(o => offerStatus(o) === "live");
    if (live) { M.offer = live.slug; M.text = offerText(live); } else M.text = "Hi {name}, this is " + brand + ". ";
    const fill = (t, l) => t.replace(/\{name\}/g, (l.name || "").split(" ")[0] || "there").replace(/\{business\}/g, l.business || "your business");
    function recipients() {
      const cut = Date.now() - (+M.skipDays) * 864e5;
      return S.leads.filter(l => waNum(l.phone).length >= 11 && (M.audience === "all" || l.optIn) && (!M.status || l.status === M.status) &&
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
          '<div class="fld"><label for="mSkip">Skip leads messaged in the last</label><select id="mSkip">' + [["0", "Don't skip"], ["1", "1 day"], ["3", "3 days"], ["7", "7 days"], ["30", "30 days"]].map(([v, t]) => '<option value="' + v + '"' + (M.skipDays === v ? " selected" : "") + '>' + t + '</option>').join("") + '</select></div>' +
          '<div class="fld"><label for="mOffer">Start from an offer</label><select id="mOffer"><option value="">Write my own message</option>' + offers.map(o => '<option value="' + esc(o.slug) + '"' + (M.offer === o.slug ? " selected" : "") + '>' + esc(o.title) + ' (' + offerStatus(o) + ')</option>').join("") + '</select></div>' +
          '<div class="fld"><label for="mText">Message</label><textarea id="mText" rows="6">' + esc(M.text) + '</textarea><span class="hint">{name} becomes the lead\'s first name, {business} their business name.</span></div>' +
        '</div><div class="msg-list"><div class="msg-head"><b>' + list.length + ' lead' + (list.length === 1 ? "" : "s") + '</b><span>' + M.sent.size + ' sent</span><span style="flex:1"></span><button class="btn btn-s btn-sm" data-mcsv' + (list.length ? "" : " disabled") + '>Download CSV</button><button class="btn btn-g btn-sm" data-mcopy' + (list.length ? "" : " disabled") + '>Copy numbers</button></div>' +
          (list.length ? '<div class="msg-rows">' + list.map(l => '<div class="msg-row' + (M.sent.has(l.id) ? " done" : "") + '"><span><b>' + esc(l.name) + '</b><small>+' + esc(waNum(l.phone)) + (l.lastMessageAt ? ' · last messaged ' + new Date(l.lastMessageAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : '') + '</small></span>' +
            (M.sent.has(l.id) ? '<span class="tagp live">Sent ✓</span>' : '<a class="btn btn-p btn-sm" target="_blank" rel="noopener" data-msend="' + l.id + '" href="https://wa.me/' + waNum(l.phone) + '?text=' + encodeURIComponent(fill(M.text, l)) + '">Send on WhatsApp</a>') + '</div>').join("") + '</div>'
            : '<div class="empty">No leads match. ' + (M.audience === "optin" ? "Only leads who ticked the WhatsApp box on a form are included." : "") + '</div>') +
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
    if (t.id === "ls") { S.leadFilter.status = t.value; renderView(); return; }
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
