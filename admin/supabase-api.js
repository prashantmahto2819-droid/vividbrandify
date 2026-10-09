/* Admin data layer: maps the admin panel's actions onto Supabase (Auth, database and Storage).
   Security is enforced by Supabase row-level security; this file only calls the APIs. */
(function () {
  "use strict";
  const CFG = window.VB_SUPABASE;
  const { SCHEMA, sanitize } = window.VBSchema;
  const BUCKET = "media";
  const LS_KEY = "vb_admin_session";
  const DELETE_SETUP_MSG = "Deleting needs one more Supabase step. In Supabase, open SQL Editor and run the \"Turn on delete\" SQL from the setup guide once, then try again.";

  class ApiError extends Error { constructor(status, message, extra) { super(message); this.status = status; Object.assign(this, extra || {}); } }

  let session = null;
  try { session = JSON.parse(localStorage.getItem(LS_KEY)); } catch (_) { session = null; }
  function saveSession(s) {
    session = s && s.access_token ? s : null;
    try { session ? localStorage.setItem(LS_KEY, JSON.stringify(session)) : localStorage.removeItem(LS_KEY); } catch (_) {}
  }

  const FRIENDLY = [
    [/invalid login credentials/i, "That email and password don't match."],
    [/email not confirmed/i, "Confirm your email first: open the link Supabase emailed you, then sign in."],
    [/password should be at least/i, "Use a password of at least 8 characters."],
    [/rate limit/i, "Too many attempts. Wait a few minutes and try again."],
    [/row-level security|permission denied/i, "Your account doesn't have admin rights for this action."],
    [/jwt expired|invalid jwt|jwt/i, "Your session ended. Please sign in again."],
    [/failed to fetch|networkerror|load failed/i, "Couldn't reach Supabase. Check your internet connection and try again."],
  ];
  function friendly(msg) { for (const [re, txt] of FRIENDLY) if (re.test(msg)) return txt; return msg; }
  function errText(data, status) {
    if (data && typeof data === "object") return data.msg || data.message || data.error_description || data.error || ("Request failed (" + status + ")");
    return typeof data === "string" && data ? data : "Request failed (" + status + ")";
  }

  async function raw(path, opts) {
    opts = opts || {};
    const headers = Object.assign({ apikey: CFG.key }, opts.headers || {});
    if (opts.auth !== false && session) headers.Authorization = "Bearer " + session.access_token;
    let body = opts.body;
    if (body !== undefined && !(body instanceof Blob)) { headers["Content-Type"] = "application/json"; body = JSON.stringify(body); }
    let r;
    try { r = await fetch(CFG.url + path, { method: opts.method || "GET", headers, body }); }
    catch (e) { throw new ApiError(0, friendly(String(e && e.message || e))); }
    const txt = await r.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (_) { data = txt; }
    return { r, data };
  }
  async function refresh() {
    if (!session || !session.refresh_token) return false;
    const { r, data } = await raw("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: session.refresh_token }, auth: false });
    if (!r.ok) { saveSession(null); return false; }
    saveSession(data); return true;
  }
  async function req(path, opts) {
    opts = opts || {};
    if (opts.auth !== false && session && session.expires_at && session.expires_at * 1000 - Date.now() < 60000) await refresh();
    let { r, data } = await raw(path, opts);
    if (r.status === 401 && opts.auth !== false && session && await refresh()) ({ r, data } = await raw(path, opts));
    if (!r.ok) {
      const msg = errText(data, r.status);
      const expired = r.status === 401 && opts.auth !== false && /jwt|token/i.test(msg);
      throw new ApiError(expired ? 401 : r.status, friendly(msg));
    }
    return data;
  }
  const rpc = (fn, args, auth) => req("/rest/v1/rpc/" + fn, { method: "POST", body: args || {}, auth });
  const publicUser = u => u && { id: u.id, email: u.email, name: (u.user_metadata && u.user_metadata.name) || "" };
  const mediaUrl = name => CFG.url + "/storage/v1/object/public/" + BUCKET + "/" + encodeURIComponent(name);

  /* ---------- content ---------- */
  let cache = null;
  async function getContent() {
    const rows = await req("/rest/v1/site_content?select=key,value");
    const c = {};
    rows.forEach(r => { c[r.key] = r.value; });
    for (const k of Object.keys(SCHEMA)) {
      if (c[k] === undefined) c[k] = SCHEMA[k].kind === "list" ? [] : sanitize(k, {});
      else if (SCHEMA[k].kind === "object") c[k] = Object.assign(sanitize(k, {}), c[k]);
    }
    cache = c;
    return c;
  }
  async function saveRows(rows) {
    const out = await req("/rest/v1/site_content?on_conflict=key", {
      method: "POST", body: rows.map(r => ({ key: r.key, value: r.value, updated_at: new Date().toISOString() })),
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    });
    if (!Array.isArray(out) || out.length !== rows.length) throw new ApiError(403, "Your account doesn't have admin rights, so the change wasn't saved.");
    return out;
  }

  /* ---------- leads ---------- */
  const mapLead = l => ({ id: l.id, name: l.name, phone: l.phone, email: l.email, business: l.business, service: l.service, message: l.message, source: l.source, status: l.status, notes: l.notes, createdAt: l.created_at, optIn: !!l.opt_in, lastMessageAt: l.last_message_at || "", followUpOn: l.follow_up_on || "" });

  /* ---------- media ---------- */
  const EXT = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif", "image/x-icon": ".ico", "image/vnd.microsoft.icon": ".ico" };
  async function listMedia() {
    const items = await req("/storage/v1/object/list/" + BUCKET, { method: "POST", body: { prefix: "", limit: 1000, offset: 0, sortBy: { column: "created_at", order: "desc" } } });
    return (items || []).filter(i => i.id && !i.name.startsWith(".")).map(i => ({ id: i.name, url: mediaUrl(i.name), name: i.name.replace(/^[a-z0-9]+-[a-f0-9]{4}-/, ""), size: (i.metadata && i.metadata.size) || 0, createdAt: i.created_at }));
  }

  /* ---------- auth helpers ---------- */
  async function signIn(email, password) {
    const s = await req("/auth/v1/token?grant_type=password", { method: "POST", body: { email: String(email).trim(), password }, auth: false });
    saveSession(s);
    const role = await rpc("my_role", {}).catch(() => null);
    if (role !== "admin" && role !== "staff") { saveSession(null); throw new ApiError(403, "This account doesn't have access to this panel. Ask an admin to add you to the team."); }
    return Object.assign(publicUser(s.user), { role });
  }
  async function signUp(email, password, name) {
    try {
      await req("/auth/v1/signup?redirect_to=" + encodeURIComponent(location.origin + "/admin/"), { method: "POST", body: { email: String(email).trim(), password, data: { name: name || "" } }, auth: false });
    } catch (e) {
      // carry on if the account already exists or only the confirmation email failed
      if (!/already registered|already exists|sending.*email|confirmation email/i.test(e.message)) throw e;
    }
  }

  /* ---------- router used by admin.js ---------- */
  async function call(method, path, body) {
    const parts = path.split("/");
    const route = method + " " + parts[0];
    const id = parts[1] ? decodeURIComponent(parts[1]) : null;

    switch (route) {
      case "GET state": {
        const needsSetup = await rpc("admin_setup_needed", {}, false);
        let user = null;
        if (session) {
          try {
            const role = await rpc("my_role", {});
            if (role === "admin" || role === "staff") user = Object.assign(publicUser(session.user), { role }); else saveSession(null);
          }
          catch (_) { saveSession(null); }
        }
        return { needsSetup, user };
      }
      case "POST setup": {
        if (String(body.password || "").length < 8) throw new ApiError(400, "Use a password of at least 8 characters.");
        await signUp(body.email, body.password, body.name);
        await rpc("claim_first_admin", { p_email: String(body.email).trim(), p_code: String(body.setupCode || "").trim() }, false);
        try { return { user: await signIn(body.email, body.password) }; }
        catch (e) {
          if (/confirm your email/i.test(e.message)) throw new ApiError(403, "Admin access is set up. Supabase has emailed a confirmation link to " + String(body.email).trim() + ". Open it, then sign in here.", { showLogin: true });
          throw e;
        }
      }
      case "POST login": return { user: await signIn(body.email, body.password) };
      case "POST logout": { try { await req("/auth/v1/logout", { method: "POST" }); } catch (_) {} saveSession(null); return { ok: true }; }

      case "GET schema": return SCHEMA;
      case "GET content": return getContent();
      case "PUT content": {
        if (!SCHEMA[id]) throw new ApiError(404, "Unknown section");
        if (!cache) await getContent();
        let value;
        try { value = sanitize(id, body.value, cache[id]); } catch (e) { throw new ApiError(400, e.message); }
        await saveRows([{ key: id, value }]);
        cache[id] = value;
        return { value };
      }
      case "GET dashboard": {
        const c = cache || await getContent();
        let media = 0;
        try { media = (await listMedia()).length; } catch (_) {}
        return {
          counts: { slides: c.slides.length, services: c.services.length, posts: c.posts.length, reviews: c.testimonials.length, faqs: c.faqs.length, media },
          checklist: {
            whatsapp: !!c.settings.whatsapp, email: !!c.settings.email, siteUrl: !!c.seo.siteUrl,
            samples: c.testimonials.filter(t => t.sample).length, ogImage: !!c.seo.ogImage, indexed: !c.seo.noindex,
          },
        };
      }

      case "GET leads": return (await req("/rest/v1/leads?select=*&order=created_at.desc&limit=1000")).map(mapLead);
      case "PATCH leads": {
        const patch = {};
        if (["new", "contacted", "won", "lost"].includes(body.status)) patch.status = body.status;
        if (typeof body.notes === "string") patch.notes = body.notes.slice(0, 5000);
        if (body.followUpOn !== undefined) patch.follow_up_on = /^\d{4}-\d{2}-\d{2}$/.test(body.followUpOn || "") ? body.followUpOn : null;
        if (body.messaged === true) patch.last_message_at = new Date().toISOString();
        if (!Object.keys(patch).length) throw new ApiError(400, "Nothing to update.");
        const out = await req("/rest/v1/leads?id=eq." + encodeURIComponent(id), { method: "PATCH", body: patch, headers: { Prefer: "return=representation" } });
        if (!out.length) throw new ApiError(404, "Lead not found");
        return mapLead(out[0]);
      }
      case "DELETE leads": {
        const out = await req("/rest/v1/leads?id=eq." + encodeURIComponent(id), { method: "DELETE", headers: { Prefer: "return=representation" } });
        if (!out || !out.length) throw new ApiError(403, DELETE_SETUP_MSG);
        return { ok: true };
      }

      case "GET media": return listMedia();
      case "POST upload": {
        const blob = body.blob;
        const ext = EXT[blob.type];
        if (!ext) throw new ApiError(415, "Upload a PNG, JPG, WebP, GIF or ICO image.");
        if (blob.size > 8e6) throw new ApiError(413, "Images must be under 8 MB.");
        const base = String(body.name || "image").toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "image";
        const name = Date.now().toString(36) + "-" + Math.random().toString(16).slice(2, 6) + "-" + base + ext;
        await req("/storage/v1/object/" + BUCKET + "/" + encodeURIComponent(name), { method: "POST", body: blob, headers: { "Content-Type": blob.type, "x-upsert": "false", "cache-control": "31536000" } });
        return { id: name, url: mediaUrl(name), name: base + ext, size: blob.size, createdAt: new Date().toISOString() };
      }
      case "DELETE media": {
        const out = await req("/storage/v1/object/" + BUCKET, { method: "DELETE", body: { prefixes: [id] } });
        if (!Array.isArray(out) || !out.length) throw new ApiError(403, DELETE_SETUP_MSG);
        return { ok: true };
      }

      case "POST password": {
        if (String(body.next || "").length < 8) throw new ApiError(400, "Use a new password of at least 8 characters.");
        const email = session && session.user && session.user.email;
        try { saveSession(await req("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password: body.current }, auth: false })); }
        catch (_) { throw new ApiError(400, "Your current password is incorrect."); }
        await req("/auth/v1/user", { method: "PUT", body: { password: body.next } });
        return { ok: true };
      }
      case "GET users": return await rpc("list_team", {});
      case "POST users": {
        const email = String(body.email || "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "Enter a valid email address.");
        if (String(body.password || "").length < 8) throw new ApiError(400, "Use a password of at least 8 characters.");
        const role = body.role === "admin" ? "admin" : "staff";
        await signUp(email, body.password, body.name);
        await rpc("add_team_member", { p_email: email, p_role: role });
        return { email, name: body.name || email, role };
      }
      case "PATCH users": {
        const ok = await rpc("set_team_member_access", { p_user_id: id, p_role: body.role === "admin" ? "admin" : "staff", p_active: body.active !== false });
        if (ok !== true) throw new ApiError(404, "Team member not found.");
        return { ok: true };
      }

      case "GET automation": return (await rpc("get_automation", {})) || {};
      case "PUT automation": return await rpc("save_automation", { p: body });
      case "POST automation-sample": return { requestId: await rpc("send_automation_sample", { p_kind: body.kind, p_phone: body.phone }) };
      case "GET automation-log": return (await rpc("automation_log", { p_limit: 50 })) || [];
      case "POST reminders": return { sent: await rpc("send_offer_reminders", { p_lead_ids: body.ids, p_offer_slug: body.offer }) };

      case "GET backup": {
        const [content, leads, media] = await Promise.all([getContent(), call("GET", "leads"), listMedia().catch(() => [])]);
        return { content, leads, media, exportedAt: new Date().toISOString() };
      }
      case "POST restore": {
        if (!body.content || typeof body.content !== "object") throw new ApiError(400, "That file is not a site backup.");
        const cur = cache || await getContent();
        const rows = [];
        try {
          for (const k of Object.keys(SCHEMA)) if (body.content[k] !== undefined) rows.push({ key: k, value: sanitize(k, body.content[k], cur[k]) });
        } catch (e) { throw new ApiError(400, "Backup could not be restored: " + e.message); }
        if (!rows.length) throw new ApiError(400, "That file is not a site backup.");
        await saveRows(rows);
        cache = null;
        return { ok: true };
      }
    }
    throw new ApiError(404, "Not found");
  }

  window.VBApi = { call };
})();
