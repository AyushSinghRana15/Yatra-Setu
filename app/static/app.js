// YatraSetu traveller web app (PWA front-end): router, home, assistant, tools and About page.
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const api = async (url, body, method) => {
  const r = await fetch(url, body ? { method: method || "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const j = await r.json(); if (!r.ok) throw new Error(j.detail ? JSON.stringify(j.detail) : r.statusText); return j;
};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const badge = t => `<span class="badge b-${String(t).split(" ")[0]}">${esc(t)}</span>`;
const iso = d => d.toISOString().slice(0, 10);
const store = {  // per-browser conveniences only; the app works without storage
  get(k, d) { try { const v = localStorage.getItem("ys_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("ys_" + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
function toast(msg, ms = 3200) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), ms);
}

const IMG = {  // Wikimedia Commons thumbnails, credited on the About page
  kedarnath: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Kedarnath_Temple.jpg/960px-Kedarnath_Temple.jpg",
  badrinath: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Badrinath_Temple%2C_Uttarakhand_%28Photo-_Vishwanath_Negi%29.jpg/960px-Badrinath_Temple%2C_Uttarakhand_%28Photo-_Vishwanath_Negi%29.jpg",
  gangotri: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Gangotri_Temple_2.jpg/960px-Gangotri_Temple_2.jpg",
  yamunotri: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Yamunotri_temple_under_the_glacier.jpg/960px-Yamunotri_temple_under_the_glacier.jpg",
  hemkund: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Hemkund_Sahib_and_Lokpal_Lake.jpg/960px-Hemkund_Sahib_and_Lokpal_Lake.jpg",
};
const CREDITS = [
  ["Kedarnath Temple", "Kedarnath_Temple.jpg", "Shaq774 at English Wikipedia", "Public domain"],
  ["Badrinath Temple", "Badrinath_Temple,_Uttarakhand_(Photo-_Vishwanath_Negi).jpg", "Vishwanath Negi", "CC BY 4.0"],
  ["Gangotri Temple", "Gangotri_Temple_2.jpg", "Arupamdas", "CC BY-SA 4.0"],
  ["Yamunotri temple under the glacier", "Yamunotri_temple_under_the_glacier.jpg", "Anurag.vq", "CC BY-SA 4.0"],
  ["Hemkund Sahib and Lokpal Lake", "Hemkund_Sahib_and_Lokpal_Lake.jpg", "Harshit SR", "CC BY-SA 4.0"],
  ["Chaukhamba from Madhyamaheshwar", "Chaukhamba_from_Madhyamaheshwar.jpg", "Abhishek.ghosh1984", "CC BY-SA 4.0"],
  ["Chaukhamba, Uttarakhand", "Chaukhamba_Uttarakhand_India_November_2013.jpg", "Paul Hamilton", "CC BY-SA 2.0"],
  ["Chandrashila peak from Tungnath", "Chandrashila_peak_from_Tungnath_Temple.jpg", "Navdeep Gusain", "CC BY-SA 4.0"],
  ["Valley of Flowers National Park", "Valley_of_flowers_national_park,_Uttarakhand,_India.jpg", "Rohit Sharma", "CC BY-SA 4.0"],
];

// ---------- router ----------
const PAGES = ["home", "assistant", "crowd", "route", "health", "alerts", "about"];
const ALIASES = { chat: "assistant", sos: "alerts" };
const onEnter = {};          // page -> init function, run each time the page is shown
let current = null;

function parseHash() {
  const [p, q] = location.hash.replace(/^#/, "").split("?");
  const page = ALIASES[p] || p;
  return { page: PAGES.includes(page) ? page : (p ? null : "home"), params: new URLSearchParams(q || ""), raw: p };
}
function goto(page, params) {
  const q = params ? "?" + new URLSearchParams(params).toString() : "";
  const h = "#" + page + q;
  if (location.hash === h) route(); else location.hash = h;
}
function route() {
  const { page, params, raw } = parseHash();
  if (!page) {  // an in-page anchor such as #why-anchor
    const el = document.getElementById(raw); if (el) { if (current !== "home") show("home"); setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 30); }
    return;
  }
  show(page, params);
}
function show(page, params = new URLSearchParams()) {
  const changed = page !== current;
  if (changed) {
    $$(".page").forEach(p => p.classList.remove("active"));
    $("#page-" + page).classList.add("active");
    $$(".nav-links a[data-page]").forEach(a => a.classList.toggle("active", a.dataset.page === page));
    document.body.dataset.page = page;
    document.title = `${$("#page-" + page).dataset.title} · YatraSetu AI`;
    window.scrollTo({ top: 0, behavior: "instant" });
    current = page;
    observeReveals();
  }
  closeMenu();
  if (onEnter[page]) onEnter[page](params, changed);
}
window.addEventListener("hashchange", route);

// mobile menu + navbar shadow
const burger = $("#burger");
function closeMenu() { $("#nav-links").classList.remove("open"); burger.setAttribute("aria-expanded", "false"); }
burger.onclick = () => { const o = $("#nav-links").classList.toggle("open"); burger.setAttribute("aria-expanded", String(o)); };
window.addEventListener("scroll", () => $("#nav").classList.toggle("scrolled", scrollY > 10), { passive: true });
document.addEventListener("click", e => {
  if (e.target.closest("[data-sos]")) setTimeout(flashSos, 80);
  if (!e.target.closest(".nav")) closeMenu();
});
function flashSos() {
  const c = $("#sos-card"); if (!c) return;
  c.scrollIntoView({ behavior: "smooth", block: "center" });
  c.classList.remove("flash"); void c.offsetWidth; c.classList.add("flash");
}

// scroll reveal
const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}), { threshold: 0.12 }) : null;
function observeReveals() {
  $$(".page.active .reveal:not(.in), .page.active .why-card:not(.in)").forEach(el => io ? io.observe(el) : el.classList.add("in"));
  $$(".page.active [data-count]:not(.counted)").forEach(el => io2 ? io2.observe(el) : (el.textContent = el.dataset.count));
}
const io2 = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  const el = e.target, to = +el.dataset.count, dec = +(el.dataset.dec || 0), t0 = performance.now();
  el.classList.add("counted"); io2.unobserve(el);
  const tick = t => { const k = Math.min(1, (t - t0) / 1400), v = to * (1 - Math.pow(1 - k, 3));
    el.textContent = v.toFixed(dec); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}), { threshold: 0.4 }) : null;

// ---------- shared data ----------
let SHRINES = [];
const ready = (async () => {
  SHRINES = await api("/api/shrines");
  ["#c-shrine", "#r-shrine", "#h-shrine", "#s-shrine"].forEach(sel =>
    $(sel).innerHTML = SHRINES.map(s => `<option value="${s.id}">${s.name} (${s.altitude_m.toLocaleString("en-IN")} m)</option>`).join(""));
  $("#c-pills").innerHTML = SHRINES.map(s => `<button data-id="${s.id}" role="tab">${esc(s.name)}</button>`).join("");
  $$("#c-pills button").forEach(b => b.onclick = () => { $("#c-shrine").value = b.dataset.id; loadForecast(); });
  const t = new Date(); $("#c-date").value = iso(t); $("#s-from").value = iso(t);
  const e = new Date(t); e.setDate(e.getDate() + 5); $("#s-to").value = iso(e);
})();
const shrineName = id => (SHRINES.find(s => s.id === id) || {}).name || id;

// ================= HOME =================
const WHY = [
  { i: "🎯", t: "Answers, not PDFs", old: "Scroll through notices and PDFs to find one detail.",
    neu: "Ask in plain words and get a short answer with its source and date.", go: "assistant" },
  { i: "🗣️", t: "Speak your language", old: "Mostly English-only pages and forms.",
    neu: "Hindi and English, typed or spoken, with replies read aloud.", go: "assistant" },
  { i: "📈", t: "Know the crowd before you go", old: "You find out about the rush when you are already in the queue.",
    neu: "A 7-day forecast against carrying capacity, with lighter dates.", go: "crowd" },
  { i: "🛣️", t: "One view of the road", old: "Weather, road and landslide updates are spread over many sites.",
    neu: "Each segment scored from IMD alerts, road status and terrain, with reasons.", go: "route" },
  { i: "🔔", t: "Alerts come to you", old: "You have to keep checking back for changes.",
    neu: "WhatsApp alerts for your own route segments, with SMS fallback.", go: "alerts" },
  { i: "📶", t: "Works on weak networks", old: "Heavy pages that fail without a signal.",
    neu: "A light offline PWA, an emergency card and SOS with the nearest medical post.", go: "alerts" },
];
$("#why-grid").innerHTML = WHY.map((w, k) => `
  <button class="why-card" data-go="${w.go}" style="--d:${(k % 3) * 0.12 + Math.floor(k / 3) * 0.18}s;--fd:${6 + (k % 3)}s;--fo:${-k * 0.9}s">
    <div class="wi">${w.i}</div><h3>${esc(w.t)}</h3>
    <div class="vs"><div class="old">${esc(w.old)}</div><div class="new">${esc(w.neu)}</div></div>
    <div class="peek">Hover or tap to compare →</div>
  </button>`).join("");
$$(".why-card").forEach(c => {
  c.addEventListener("pointermove", e => { const r = c.getBoundingClientRect();
    c.style.setProperty("--mx", `${e.clientX - r.left}px`); c.style.setProperty("--my", `${e.clientY - r.top}px`); });
  c.onclick = () => {  // first tap on touch screens reveals the comparison, second tap opens the feature
    if (matchMedia("(hover: none)").matches && !c.classList.contains("open")) { c.classList.add("open"); return; }
    goto(c.dataset.go);
  };
});

const HERO_CHIPS = ["Is Kedarnath crowded this week?", "Is the road to Badrinath open?", "How do I register for the yatra?", "केदारनाथ में कल कितनी भीड़ होगी?"];
$("#hero-chips").innerHTML = HERO_CHIPS.map(q => `<button type="button">${esc(q)}</button>`).join("");
$$("#hero-chips button").forEach(b => b.onclick = () => askFromAnywhere(b.textContent));
$("#hero-ask").onsubmit = e => { e.preventDefault(); const v = $("#hero-q").value.trim(); if (v) { askFromAnywhere(v); $("#hero-q").value = ""; } };

let homeLoaded = false;
async function loadHome() {
  if (homeLoaded) return; homeLoaded = true;
  await ready;
  const today = iso(new Date());
  const cards = await Promise.all(SHRINES.map(async s => {
    const [f, t] = await Promise.all([api(`/api/forecast/${s.id}?start=${today}&days=1`).catch(() => null),
                                      api(`/api/risk/trip/${s.id}`).catch(() => null)]);
    const d = f && f.days[0];
    return `<div class="shrine-card reveal" style="--img:url('${IMG[s.id] || ""}')">
      <div class="ph"></div>
      <h3>${esc(s.name)} <small style="opacity:.8;font-weight:400">${esc(s.name_hi)}</small></h3>
      <div class="alt">⛰️ ${s.altitude_m.toLocaleString("en-IN")} m · ${esc(s.district)}</div>
      <div class="st"><span>👥 Crowd today</span>${d ? badge(d.band) : "–"}</div>
      <div class="st"><span>🛣️ Route</span>${t ? badge(t.worst.level) : "–"}</div>
      <div class="acts"><button data-act="crowd" data-id="${s.id}">Forecast</button><button data-act="route" data-id="${s.id}">Route</button></div>
    </div>`;
  }));
  $("#shrine-grid").innerHTML = cards.join("");
  $$("#shrine-grid [data-act]").forEach(b => b.onclick = () => goto(b.dataset.act, { shrine: b.dataset.id }));
  observeReveals();
}
onEnter.home = () => loadHome();

// ================= ASSISTANT =================
const QUICK = ["Is Kedarnath crowded this week?", "Is the road to Kedarnath open?", "How do I register for the yatra?",
  "My father is 68 with BP, can he do the trek?", "What should I pack for Hemkund Sahib?", "केदारनाथ में कल कितनी भीड़ होगी?", "हेलीकॉप्टर टिकट कैसे बुक करें?"];
QUICK.forEach(q => { const b = document.createElement("button"); b.type = "button"; b.textContent = q; b.onclick = () => ask(q); $("#quick").appendChild(b); });

const FOLLOW = {  // next questions worth asking after each intent
  crowd: s => [`Which day is least crowded at ${s}?`, `Is the road to ${s} open?`],
  route: s => [`Is ${s} crowded this week?`, "Where can I halt safely on the way?"],
  health: () => ["Where are the medical posts on the route?", "What should I carry for high altitude?"],
  registration: () => ["Is registration free?", "Which documents do I need?"],
};
let HISTORY = store.get("chat", []);
let lastAnswer = null;

function addMsg(html, cls) {
  const d = document.createElement("div"); d.className = "msg " + cls; d.innerHTML = html;
  $("#chat").appendChild(d); $("#chat").scrollTop = 1e6; return d;
}
const GREETING = "Namaste! 🙏 I am YatraSetu. Ask me about crowds, routes, registration, health or safety on the Char Dham yatra, in English or हिन्दी. You can also tap 🎙️ and speak.";

function miniForecast(fc) {
  const days = (fc.days || []).slice(0, 7); if (!days.length) return "";
  const max = Math.max(fc.capacity || 0, ...days.map(d => d.visitors)) || 1;
  const col = r => r > 1 ? "var(--red)" : r > .85 ? "var(--orange)" : r > .6 ? "var(--yellow)" : "var(--green)";
  return `<div class="mini-fc-wrap"><div class="mini-fc" title="7-day forecast">${days.map((d, k) =>
    `<div style="height:${Math.max(4, 100 * d.visitors / max)}%;background:${d.open ? col(d.ratio) : "#c9d3d7"};animation-delay:${k * 60}ms"
      title="${esc(d.date)}: ${d.open ? d.visitors.toLocaleString("en-IN") + " · " + esc(d.band) : "closed"}"><span>${esc(d.date.slice(8))}</span></div>`).join("")}</div></div>`;
}

function renderBot(r, el) {
  const name = r.shrine ? shrineName(r.shrine) : "";
  const src = (r.sources || []).map(s => `<span class="src">📄 ${esc(s.title)} · ${esc(s.updated)}</span>`).join("");
  const acts = [];
  if (r.sos) acts.push(`<a class="btn red sm" href="tel:112">📞 Call 112</a>`, `<button class="act" data-go="alerts" data-sos>🚨 Open SOS</button>`);
  if (r.intent === "crowd" && r.shrine) acts.push(`<button class="act" data-go="crowd" data-shrine="${r.shrine}">📊 Full forecast for ${esc(name)}</button>`);
  if (r.intent === "route" && r.shrine) acts.push(`<button class="act" data-go="route" data-shrine="${r.shrine}">🛣️ Show on route map</button>`);
  if (r.intent === "health") acts.push(`<button class="act" data-go="health" ${r.shrine ? `data-shrine="${r.shrine}"` : ""}>❤️ Open health check</button>`);
  const follow = (FOLLOW[r.intent] ? FOLLOW[r.intent](name || "Kedarnath") : []).filter(() => r.language !== "hi");
  el.classList.toggle("sos", !!r.sos);
  el.innerHTML = `${esc(r.answer).replace(/\n/g, "<br>")}
    ${r.live && r.live.forecast ? miniForecast(r.live.forecast) : ""}
    ${src ? `<div class="meta">${src}</div>` : ""}
    <div class="msg-tools">
      <button data-tool="speak" title="Read aloud">🔊 Listen</button><button data-tool="copy" title="Copy answer">📋 Copy</button>
      ${acts.join("")}
    </div>
    ${follow.length ? `<div class="quick" style="margin:8px 0 0">${follow.map(f => `<button type="button" data-follow>${esc(f)}</button>`).join("")}</div>` : ""}`;
  el.querySelector('[data-tool="speak"]').onclick = () => window.YSVoice && YSVoice.speak(r.answer, r.language);
  el.querySelector('[data-tool="copy"]').onclick = () => navigator.clipboard?.writeText(r.answer).then(() => toast("Answer copied"), () => toast("Copy is not available here"));
  el.querySelectorAll("[data-go]").forEach(b => b.onclick = () => goto(b.dataset.go, b.dataset.shrine ? { shrine: b.dataset.shrine } : null));
  el.querySelectorAll("[data-follow]").forEach(b => b.onclick = () => ask(b.textContent));
}

function renderHistory() {
  $("#chat").innerHTML = "";
  addMsg(esc(GREETING), "bot");
  HISTORY.forEach(h => {
    if (h.role === "user") addMsg((h.voice ? `<span class="via">🎙️ spoken</span>` : "") + esc(h.text), "user");
    else { const el = addMsg("", "bot"); renderBot(h.r, el); lastAnswer = h.r; }
  });
}
function saveHistory() { store.set("chat", HISTORY.slice(-30)); }
renderHistory();
$("#clear-chat").onclick = () => { HISTORY = []; saveHistory(); lastAnswer = null; renderHistory(); $("#details").textContent = "Ask a question to see the intent, confidence and sources."; markPipe(null); };

const AUTO = $("#auto-speak");
AUTO.checked = store.get("autospeak", false);
AUTO.onchange = () => { store.set("autospeak", AUTO.checked); toast(AUTO.checked ? "Answers will be read aloud" : "Auto-read off"); };

// AI provider badge: OpenRouter + LangChain when configured, extractive otherwise.
api("/api/ai/status").then(s => {
  $("#ai-mode").textContent = s.enabled ? `${s.mode} · ${s.model}` : "offline extractive mode";
  $("#ai-status").innerHTML = s.enabled
    ? `🤖 <b>${esc(s.mode)}</b> · ${esc(s.provider)} / ${esc(s.model)} · ${esc(s.framework)}`
    : `🔒 <b>extractive</b> · offline mode. ${esc(s.detail)}`;
}).catch(() => { $("#ai-status").textContent = "AI status unavailable. Offline extractive mode still works."; $("#ai-mode").textContent = "offline"; });

function markPipe(r) {
  $$("#pipe-mini li").forEach(li => li.classList.remove("on", "skip"));
  if (!r) return;
  const on = ["lang", "intent"];
  if (r.intent === "emergency") { ["retrieve", "live", "answer"].forEach(s => $(`#pipe-mini [data-step=${s}]`).classList.add("skip")); }
  else {
    if ((r.sources || []).some(s => s.score != null)) on.push("retrieve"); else $("#pipe-mini [data-step=retrieve]").classList.add("skip");
    if (r.live && Object.keys(r.live).length) on.push("live"); else $("#pipe-mini [data-step=live]").classList.add("skip");
    on.push("answer");
  }
  on.forEach((s, k) => setTimeout(() => $(`#pipe-mini [data-step=${s}]`).classList.add("on"), k * 140));
}

let busy = false;
async function ask(text, opts = {}) {
  text = (text || "").trim();
  if (!text || busy) return;
  busy = true;
  addMsg((opts.voice ? `<span class="via">🎙️ spoken</span>` : "") + esc(text), "user"); $("#q").value = "";
  HISTORY.push({ role: "user", text, voice: !!opts.voice });
  const wait = addMsg(`<span class="typing"><i></i><i></i><i></i></span>`, "bot");
  try {
    const r = await api("/api/chat", { text, language: $("#lang").value || null });
    if (r.live && r.live.forecast) r.live = { forecast: { capacity: r.live.forecast.capacity, days: r.live.forecast.days.map(({ date, visitors, band, ratio, open }) => ({ date, visitors, band, ratio, open })) } };
    renderBot(r, wait); lastAnswer = r;
    HISTORY.push({ role: "bot", r }); saveHistory();
    $("#chat").scrollTop = 1e6;
    markPipe(r);
    $("#details").innerHTML = `<table class="t"><tr><th>Field</th><th>Value</th></tr>
      <tr><td>Language</td><td>${esc(r.language)}</td></tr><tr><td>Intent</td><td>${esc(r.intent)} (confidence ${r.confidence})</td></tr>
      <tr><td>Shrine detected</td><td>${esc(r.shrine ? shrineName(r.shrine) : "–")}</td></tr><tr><td>Answer mode</td><td>${esc(r.mode)}</td></tr>
      <tr><td>Grounded</td><td>${r.grounded ? "✅ yes" : "⚠️ no (fallback)"}</td></tr>
      <tr><td>Sources (similarity)</td><td>${r.sources.map(s => esc(s.title) + (s.score != null ? ` (${s.score})` : "")).join("<br>") || "–"}</td></tr></table>`;
    if (window.YSVoice && (AUTO.checked || (opts.voice && YSVoice.replyToVoice))) YSVoice.speak(r.answer, r.language);
  } catch (e) { wait.innerHTML = "Sorry, something went wrong: " + esc(e.message); }
  finally { busy = false; }
}
function askFromAnywhere(text, opts) { goto("assistant"); setTimeout(() => ask(text, opts), 60); }
$("#chatbar").onsubmit = e => { e.preventDefault(); ask($("#q").value); };
document.addEventListener("keydown", e => {
  if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); goto("assistant"); setTimeout(() => $("#q").focus(), 50); }
  if (e.key === "Escape") closeMenu();
});
onEnter.assistant = (_, changed) => { if (changed) setTimeout(() => { $("#chat").scrollTop = 1e6; if (matchMedia("(hover: hover)").matches) $("#q").focus({ preventScroll: true }); }, 100); };

// ================= CROWD =================
async function loadForecast() {
  await ready;
  const sid = $("#c-shrine").value || "kedarnath";
  $$("#c-pills button").forEach(b => b.classList.toggle("on", b.dataset.id === sid));
  const f = await api(`/api/forecast/${sid}?start=${$("#c-date").value}&days=7`);
  $("#c-days").innerHTML = f.days.map((d, k) => `<div class="day" style="animation-delay:${k * 50}ms">${new Date(d.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
     <b>${d.open ? d.visitors.toLocaleString("en-IN") : "–"}</b>${badge(d.band)}</div>`).join("");
  const colors = f.days.map(d => d.ratio > 1 ? "#c0392b" : d.ratio > 0.85 ? "#e07a1f" : d.ratio > 0.6 ? "#d4a017" : "#2e8b57");
  barChart($("#c-chart"), f.days.map(d => d.date.slice(5)), f.days.map(d => d.visitors),
    { colors, line: f.capacity, lineLabel: `Carrying capacity ${f.capacity.toLocaleString("en-IN")}/day` });
  const peak = f.days.filter(d => d.open).sort((a, b) => b.ratio - a.ratio)[0];
  $("#c-suggest").innerHTML = "";
  if (peak) {
    const s = await api(`/api/forecast/${sid}/suggest?on=${peak.date}`);
    if (s.needed) $("#c-suggest").innerHTML = `<div class="notice"><b>${peak.date}</b> is forecast as <b>${peak.band}</b>.
      Lighter dates nearby: ${s.better_dates.map(d => `${d.date} (${d.band}, ~${d.visitors.toLocaleString("en-IN")})`).join(", ")}.
      ${s.alternative.length ? `Alternative: <b>${s.alternative[0].shrine}</b> (${s.alternative[0].band}).` : ""}</div>`;
  } else {
    $("#c-suggest").innerHTML = `<div class="notice">${esc(shrineName(sid))} is closed for the season on these dates. Try a date in the May–November yatra season.</div>`;
  }
}
$("#c-go").onclick = loadForecast;
$("#c-shrine").onchange = loadForecast;
onEnter.crowd = async params => { await ready; if (params.get("shrine")) $("#c-shrine").value = params.get("shrine"); loadForecast(); };
window.addEventListener("resize", () => { if (current === "crowd" && $("#c-days").children.length) loadForecast(); });

// ================= ROUTE =================
async function loadMap(highlight = []) { routeMap($("#map"), await api("/api/risk/network"), highlight); }
async function checkRoute() {
  const t = await api(`/api/risk/trip/${$("#r-shrine").value}`);
  loadMap(t.segments.map(s => s.id));
  $("#r-out").innerHTML = `<div class="result"><b>Total ${t.total_km} km</b> · worst segment: ${esc(t.worst.from)} → ${esc(t.worst.to)} ${badge(t.worst.level)}
     ${t.advice ? `<div class="notice">⚠️ Avoid ${esc(t.advice.segment)} for now. Suggested safe halt: <b>${esc(t.advice.halt)}</b>
       (${t.advice.facilities.join(", ")}).</div>` : ""}</div>
     <div style="overflow-x:auto"><table class="t" style="margin-top:10px"><tr><th>Segment</th><th>km</th><th>Risk</th><th>Why</th></tr>
     ${t.segments.map(s => `<tr><td>${esc(s.from)} → ${esc(s.to)}${s.mode === "trek" ? " 🥾" : ""}</td><td>${s.km}</td>
       <td>${badge(s.level)} ${s.score}</td><td class="muted">${s.factors.map(esc).join("<br>")}</td></tr>`).join("")}</table></div>`;
}
$("#r-go").onclick = checkRoute;
onEnter.route = async params => { await ready; if (params.get("shrine")) { $("#r-shrine").value = params.get("shrine"); checkRoute(); } else loadMap(); };

// ================= HEALTH =================
$("#h-go").onclick = async () => {
  const conds = $$("#health-form .check input:not(.rf)").filter(c => c.checked).map(c => c.value);
  const rfs = $$("#health-form .rf").filter(c => c.checked).map(c => c.value);
  const r = await api("/api/health/check", { age: +$("#h-age").value, conditions: conds, red_flags: rfs, fitness: $("#h-fit").value, shrine: $("#h-shrine").value });
  $("#h-out").innerHTML = `<div class="result" style="margin-top:0"><div style="font-size:18px;margin-bottom:8px">${badge(r.category)}</div>
    ${r.reasons.length ? `<h3>Why</h3><ul>${r.reasons.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    <h3>What to do</h3><ul>${r.actions.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
    <h3>On your route</h3><p>🩺 Screening: ${r.screening_points.join(", ") || "–"}<br>🏥 Medical posts: ${r.medical_posts.join(", ")}</p>
    <p class="muted"><i>${esc(r.disclaimer)}</i></p></div>`;
};
onEnter.health = async params => { await ready; if (params.get("shrine")) $("#h-shrine").value = params.get("shrine"); };

// ================= ALERTS & SOS =================
$("#s-go").onclick = async () => {
  try {
    const r = await api("/api/subscribe", { phone: $("#s-phone").value, language: $("#s-lang").value, shrine: $("#s-shrine").value,
      start_date: $("#s-from").value, end_date: $("#s-to").value, group_size: +$("#s-group").value, consent: $("#s-consent").checked });
    $("#s-out").innerHTML = `<div class="result">✅ Subscribed (ID ${r.id}). You will get WhatsApp alerts (SMS fallback) for ${r.segments.length} route segments.</div>`;
  } catch (e) { $("#s-out").innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
};
$("#sos-locate").onclick = () => {
  if (!navigator.geolocation) return toast("Location is not available in this browser");
  toast("Finding your location…");
  navigator.geolocation.getCurrentPosition(p => {
    $("#sos-lat").value = p.coords.latitude.toFixed(4); $("#sos-lon").value = p.coords.longitude.toFixed(4); toast("Location filled in");
  }, () => toast("Could not get your location. Enter it by hand."), { enableHighAccuracy: true, timeout: 10000 });
};
$("#sos-go").onclick = async () => {
  const r = await api("/api/sos", { lat: +$("#sos-lat").value, lon: +$("#sos-lon").value, contacts: [$("#sos-contact").value] });
  $("#sos-out").innerHTML = `<div class="result"><b>Nearest help:</b> ${esc(r.nearest_help)} (~${r.nearest_km} km; ${r.nearest_facilities.join(", ")})<br>
    <a class="btn red" style="margin-top:8px" href="${r.dial}">📞 Call 112</a>
    <a class="btn" style="margin-top:8px" href="${r.whatsapp_share}" target="_blank" rel="noopener">Share on WhatsApp</a>
    <p class="muted">${esc(r.message)}</p></div>`;
};

// ================= ABOUT =================
const NODE_INFO = {
  pilgrim: ["Pilgrims on the web", "Use the installable traveller PWA on phone or desktop: assistant, forecast, route risk, health check, alerts and SOS."],
  "wa-user": ["Pilgrims on WhatsApp", "Send questions to the WhatsApp Business number. The same assistant pipeline answers them."],
  official: ["District officials", "Draft and approve advisories (four-eyes rule), update road status and IMD alerts, and watch delivery and audit logs."],
  pwa: ["Traveller PWA", "<code>static/index.html</code>, <code>app.js</code>, <code>voice.js</code>, <code>charts.js</code>, <code>style.css</code>. No framework. A service worker (<code>sw.js</code>) keeps it working offline."],
  webhook: ["WhatsApp webhook", "<code>GET/POST /webhook/whatsapp</code> in <code>main.py</code> verifies Meta's challenge and passes inbound text to the assistant."],
  admin: ["Officials' dashboard", "<code>static/admin.html</code> + <code>admin.js</code>. Token login with editor and approver roles."],
  gateway: ["FastAPI gateway", "<code>app/main.py</code>: REST endpoints (<code>/api/chat</code>, <code>/api/forecast</code>, <code>/api/risk</code>, <code>/api/health</code>, <code>/api/sos</code>, <code>/api/admin/*</code>), pydantic validation, role checks, static files."],
  assistant: ["Assistant orchestrator", "<code>assistant.py</code>: language → intent (with emergency override) → retrieval → live data → grounded answer → log. Emergencies never reach the LLM."],
  forecast: ["Crowd forecast", "<code>forecast.py</code>: histogram gradient-boosting regressor on calendar and weather features, compared with carrying capacity. Suggests lighter dates and alternative shrines."],
  risk: ["Route risk", "<code>risk.py</code>: a transparent weighted score from IMD alert level, forecast rain, official road status and terrain susceptibility, plus a safe-halt search."],
  health: ["Health rules", "<code>health.py</code>: rule-based readiness triage (Ready / Caution / Consult / Do not travel) with screening points and medical posts. It does not diagnose."],
  alerts: ["Alerts & advisories", "<code>alerts.py</code>: consented trip subscriptions, a four-eyes advisory workflow, and dispatch over WhatsApp with SMS fallback."],
  language: ["Language detection", "<code>language.py</code>: script-based detection (Devanagari, Gujarati and others) and a Bhashini client for translation beyond English and Hindi."],
  intent: ["Intent classifier", "<code>intent.py</code>: TF-IDF + logistic regression, keyword emergency override, and shrine and age extraction."],
  kb: ["Retriever", "<code>knowledge_base.py</code>: bilingual knowledge base with hybrid word and character TF-IDF retrieval. Published advisories are added live."],
  llm: ["LLM + guardrails", "<code>llm.py</code>: LangChain LCEL chain (prompt → ChatOpenAI on OpenRouter → parser). Numeric grounding check, PII redaction, caching, offline fallback."],
  sqlite: ["SQLite", "<code>db.py</code>: subscriptions, advisories, road status, weather, outbox, query log and audit log."],
  kbjson: ["Knowledge base", "<code>data/knowledge_base.json</code>: approved bilingual passages with source and last-updated date."],
  geo: ["Shrines & routes", "<code>data/shrines.json</code> (altitude, capacity) and <code>data/routes.json</code> (nodes, segments, facilities, coordinates)."],
  history: ["Footfall history", "<code>data/footfall_history.csv</code>: synthetic daily footfall calibrated to published season totals, used to train the forecaster."],
  openrouter: ["OpenRouter", "Optional. Set <code>OPENROUTER_API_KEY</code> to turn on generative answers. Without it the app answers extractively."],
  bhashini: ["Bhashini", "Optional. Government of India language platform for translation into other Indian languages."],
  whatsapp: ["WhatsApp / SMS", "Delivery channels for trip alerts. In the prototype they are simulated through the outbox table."],
  speech: ["Web Speech API", "Runs in the browser: SpeechRecognition for voice commands and questions (en-IN, hi-IN), SpeechSynthesis to read answers. No server change is needed."],
};
$$("#arch .node").forEach(n => n.onclick = () => {
  $$("#arch .node").forEach(x => x.classList.remove("sel")); n.classList.add("sel");
  const [t, d] = NODE_INFO[n.dataset.node] || [n.textContent, ""];
  const box = $("#node-detail"); box.classList.remove("swap"); void box.offsetWidth; box.classList.add("swap");
  box.innerHTML = `<b>${esc(t)}</b><br>${d}`;
});
$$("#tree .leaf[data-file]").forEach(l => {
  const nodes = () => $$(`#arch .node[data-file="${l.dataset.file}"]`);
  l.onmouseenter = () => nodes().forEach(n => n.classList.add("hl"));
  l.onmouseleave = () => nodes().forEach(n => n.classList.remove("hl"));
  l.onclick = () => { const n = nodes()[0]; if (n) { n.click(); n.scrollIntoView({ behavior: "smooth", block: "center" }); } };
});
$("#play-pipe").onclick = () => {
  const steps = $$("#pipeline .pstep"); steps.forEach(s => s.classList.remove("on"));
  steps.forEach((s, k) => { setTimeout(() => s.classList.add("on"), k * 420); setTimeout(() => s.classList.remove("on"), k * 420 + 1100); });
};
$("#credits").innerHTML = CREDITS.map(([t, f, a, l]) =>
  `<li><a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f)}" target="_blank" rel="noopener">${esc(t)}</a> by ${esc(a)} · ${esc(l)}</li>`).join("");

// expose for voice.js
window.YS = { goto, ask, askFromAnywhere, toast, store, flashSos, get lastAnswer() { return lastAnswer; }, get page() { return current; },
  clearChat: () => $("#clear-chat").click(), shrines: () => SHRINES };

route();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/static/sw.js").catch(() => {});
