(function () {
  const $ = (id) => document.getElementById(id);
  const form = $("form"), titleEl = $("title"), whenEl = $("when"), whoEl = $("who"), textEl = $("text");
  const saveBtn = $("save"), cancelBtn = $("cancel"), statusEl = $("status");
  const listEl = $("stories"), emptyEl = $("empty"), countEl = $("count"), searchEl = $("search");
  const homeEl = $("home"), detailEl = $("detail");

  let stories = [], busy = false, editingId = null, openId = null, confirming = false, activeTag = null;

  // ---- Anmeldung -------------------------------------------------------
  const LOGIN_KEY = "mehmoiren-login";
  let login = null;
  try { login = localStorage.getItem(LOGIN_KEY); } catch (e) {}
  const encode = (user, pass) => btoa(unescape(encodeURIComponent(user + ":" + pass)));

  async function api(method, body) {
    const res = await fetch("/api/stories", {
      method,
      headers: { "x-mehmoiren-login": login || "", ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { logout("Bitte melde dich an."); throw new Error("login"); }
    if (!res.ok) throw new Error(data.error || "Da ist etwas schiefgelaufen. Bitte nochmal versuchen.");
    return data;
  }

  function setStories(list) {
    stories = (Array.isArray(list) ? list : []).filter((s) => s && s.id).map((s) => ({
      id: String(s.id), title: String(s.title || ""), when: String(s.when || ""), who: String(s.who || ""),
      text: String(s.text || ""), createdAt: Number(s.createdAt) || 0,
    })).sort((a, b) => b.createdAt - a.createdAt);
    if (openId) renderDetail(); else renderList();
  }

  function showApp() { $("gate").hidden = true; $("app").hidden = false; }
  function logout(msg) {
    login = null;
    try { localStorage.removeItem(LOGIN_KEY); } catch (e) {}
    $("app").hidden = true; $("gate").hidden = false;
    const err = $("login-error");
    err.textContent = msg || ""; err.hidden = !msg;
  }
  $("logout").onclick = () => logout("");

  async function enter() {
    showApp();
    $("empty").hidden = true;
    const loading = document.createElement("p"); loading.className = "loading"; loading.textContent = "Geschichten werden geladen …";
    listEl.appendChild(loading);
    try { setStories((await api("GET")).stories); }
    catch (e) { if (e.message !== "login") setStatus(e.message); }
    finally { loading.remove(); if (!stories.length) renderList(); }
  }

  $("gate-arms").src = document.querySelector("header img").src;
  $("login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("login-error");
    login = encode($("login-user").value.trim(), $("login-pass").value);
    try {
      const data = await api("GET");
      try { localStorage.setItem(LOGIN_KEY, login); } catch (x) {}
      err.hidden = true; $("login-pass").value = "";
      showApp(); setStories(data.stories);
    } catch (x) {
      err.textContent = x.message === "login" ? "Anmeldename oder Passwort stimmt nicht. Bitte nochmal versuchen." : x.message;
      err.hidden = false;
      $("login-pass").value = ""; $("login-pass").focus();
    }
  });
  if (login) enter();

  // ---- Entwurf bleibt im Browser, bis er gespeichert ist ---------------
  const DRAFT = "mehmoiren-draft";
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT) || "null");
    if (d) { titleEl.value = d.title || ""; whenEl.value = d.when || ""; whoEl.value = d.who || ""; textEl.value = d.text || ""; }
  } catch (e) {}
  function saveDraft() {
    if (editingId) return;
    try { localStorage.setItem(DRAFT, JSON.stringify({ title: titleEl.value, when: whenEl.value, who: whoEl.value, text: textEl.value })); } catch (e) {}
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT); } catch (e) {} }
  [titleEl, whenEl, whoEl, textEl].forEach((el) => el.addEventListener("input", saveDraft));

  function setStatus(msg) { statusEl.textContent = msg; }

  function fmtDate(ms) {
    try { return new Date(ms).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" }); }
    catch (e) { return ""; }
  }
  function metaInto(el, s) {
    el.textContent = "";
    if (s.when) { const w = document.createElement("span"); w.className = "when"; w.textContent = s.when; el.appendChild(w); }
    if (s.createdAt) { const d = document.createElement("span"); d.textContent = "aufgeschrieben am " + fmtDate(s.createdAt); el.appendChild(d); }
  }

  // ---- Namens-Tags und Filter ------------------------------------------
  // "Dustin, Manni und DP" -> ["Dustin", "Manni", "DP"]
  function names(who) {
    return who.split(/\s*(?:,|;|&|\/|\bund\b)\s*/i).map((n) => n.trim()).filter(Boolean);
  }
  function setTag(t) { activeTag = t; renderList(); }
  function tagButton(label, key, count) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "tag";
    b.setAttribute("aria-pressed", String(activeTag === key));
    b.textContent = label;
    if (count != null) { const n = document.createElement("span"); n.className = "n"; n.textContent = " " + count; b.appendChild(n); }
    b.onclick = () => setTag(activeTag === key ? null : key);
    return b;
  }
  function renderFilters() {
    const el = $("filters"); el.textContent = "";
    const all = new Map();
    for (const s of stories) for (const n of names(s.who)) {
      const k = n.toLowerCase();
      const cur = all.get(k) || { label: n, count: 0 };
      cur.count++; all.set(k, cur);
    }
    if (activeTag && !all.has(activeTag)) activeTag = null;
    el.hidden = all.size === 0;
    if (!all.size) return;
    const lab = document.createElement("span"); lab.className = "label"; lab.textContent = "Filtern:";
    el.append(lab, tagButton("Alle", null, stories.length));
    [...all.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label, "de"))
      .forEach(([k, v]) => el.appendChild(tagButton(v.label, k, v.count)));
  }

  // ---- Übersicht -------------------------------------------------------
  function renderList() {
    renderFilters();
    const q = searchEl.value.trim().toLowerCase();
    const shown = stories.filter((s) =>
      (!activeTag || names(s.who).some((n) => n.toLowerCase() === activeTag)) &&
      (!q || (s.title + " " + s.when + " " + s.who + " " + s.text).toLowerCase().includes(q)));
    countEl.textContent = stories.length ? "· " + stories.length : "";
    listEl.querySelectorAll(".entry, .nomatch").forEach((a) => a.remove());
    emptyEl.hidden = stories.length > 0;
    if (stories.length && !shown.length) {
      const p = document.createElement("p"); p.className = "status nomatch";
      p.textContent = q ? "Keine Geschichte passt zu „" + searchEl.value.trim() + "“." : "Keine Geschichte mit diesem Namen.";
      listEl.appendChild(p);
      return;
    }
    for (const s of shown) {
      const e = document.createElement("div"); e.className = "entry";
      const h = document.createElement("h3"); h.textContent = s.title || "Ohne Titel";
      const b = document.createElement("button"); b.type = "button"; b.className = "read"; b.textContent = "Inhalt lesen";
      b.onclick = () => openStory(s.id);
      e.appendChild(h);
      const ns = names(s.who);
      if (ns.length) {
        const row = document.createElement("div"); row.className = "tags";
        ns.forEach((n) => row.appendChild(tagButton(n, n.toLowerCase())));
        e.appendChild(row);
      }
      e.appendChild(b);
      listEl.appendChild(e);
    }
  }

  // ---- Ganze Geschichte ------------------------------------------------
  function renderDetail() {
    const s = stories.find((x) => x.id === openId);
    if (!s) { showHome(); return; }
    metaInto($("d-meta"), s);
    $("d-title").textContent = s.title || "Ohne Titel";
    $("d-who").textContent = s.who ? "Mit dabei: " + s.who : "";
    $("d-who").hidden = !s.who;
    $("d-body").textContent = s.text;
    const tools = $("d-tools"); tools.textContent = "";
    const edit = document.createElement("button"); edit.type = "button"; edit.className = "ghost"; edit.textContent = "Bearbeiten";
    edit.onclick = () => startEdit(s);
    tools.appendChild(edit);
    if (confirming) {
      const c = document.createElement("span"); c.className = "confirm";
      c.append("Wirklich löschen?");
      const yes = document.createElement("button"); yes.type = "button"; yes.className = "danger"; yes.textContent = "Löschen";
      yes.disabled = busy;
      yes.onclick = () => remove(s.id);
      const no = document.createElement("button"); no.type = "button"; no.className = "ghost"; no.textContent = "Behalten";
      no.onclick = () => { confirming = false; renderDetail(); };
      c.append(yes, no); tools.appendChild(c);
    } else {
      const del = document.createElement("button"); del.type = "button"; del.className = "quiet"; del.textContent = "Löschen";
      del.onclick = () => { confirming = true; renderDetail(); };
      tools.appendChild(del);
    }
  }

  function openStory(id) {
    openId = id; confirming = false;
    homeEl.hidden = true; detailEl.hidden = false;
    renderDetail();
    window.scrollTo(0, 0);
    $("back").focus({ preventScroll: true });
  }
  function showHome() {
    const was = openId;
    openId = null; confirming = false;
    detailEl.hidden = true; homeEl.hidden = false;
    renderList();
    if (was) window.scrollTo(0, 0);
  }
  $("back").onclick = showHome;

  // ---- Schreiben, Bearbeiten, Löschen ----------------------------------
  function startEdit(s) {
    showHome();
    editingId = s.id;
    titleEl.value = s.title; whenEl.value = s.when; whoEl.value = s.who; textEl.value = s.text;
    $("form-title").textContent = "Geschichte bearbeiten";
    saveBtn.textContent = "Änderungen speichern";
    cancelBtn.hidden = false; setStatus("");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    textEl.focus({ preventScroll: true });
  }
  function resetForm() {
    editingId = null; form.reset();
    $("form-title").textContent = "Neue Geschichte";
    saveBtn.textContent = "Geschichte speichern";
    cancelBtn.hidden = true;
  }
  cancelBtn.onclick = () => { resetForm(); clearDraft(); setStatus(""); };

  form.hidden = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const text = textEl.value.trim();
    if (!text) { setStatus("Schreib zuerst etwas in das Feld „Geschichte“."); textEl.focus(); return; }
    const story = { title: titleEl.value.trim(), when: whenEl.value.trim(), who: whoEl.value.trim(), text };
    const wasEdit = !!editingId;
    busy = true; saveBtn.disabled = true; setStatus("Wird gespeichert …");
    try {
      const data = await api("POST", wasEdit ? { op: "update", id: editingId, story } : { op: "add", story });
      resetForm(); clearDraft();
      setStories(data.stories);
      setStatus(wasEdit ? "Änderungen gespeichert." : "Gespeichert. Schön, dass du sie aufgeschrieben hast.");
    } catch (err) {
      if (err.message !== "login") setStatus(err.message + " Dein Text ist noch da.");
    } finally { busy = false; saveBtn.disabled = false; }
  });

  async function remove(id) {
    if (busy) return;
    busy = true; renderDetail();
    try {
      const data = await api("POST", { op: "delete", id });
      showHome(); setStories(data.stories); setStatus("Geschichte gelöscht.");
    } catch (err) {
      if (err.message !== "login") setStatus(err.message);
    } finally { busy = false; if (openId) renderDetail(); }
  }

  searchEl.addEventListener("input", renderList);
})();
