// YatraSetu traveller web app (PWA front-end): router, home, assistant, tools and About page.
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const api = async (url, body, method) => {
  const r = await fetch(url, body ? { method: method || "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const j = await r.json(); if (!r.ok) throw new Error(j.detail ? JSON.stringify(j.detail) : r.statusText); return j;
};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tr = s => I18N.tr(s);                       // UI text in the chosen language (i18n.js)
const isHi = () => I18N.lang === "hi";
const badge = t => `<span class="badge b-${String(t).split(" ")[0]}">${esc(tr(t))}</span>`;  // colour keyed on the English value
const iso = d => d.toISOString().slice(0, 10);
const store = {  // per-browser conveniences only; the app works without storage
  get(k, d) { try { const v = localStorage.getItem("ys_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("ys_" + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
function toast(msg, ms = 3200) {
  const t = $("#toast"); t.textContent = tr(msg); t.classList.add("show");
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
  renderShrineOptions();
  const t = new Date(); $("#c-date").value = iso(t); $("#s-from").value = iso(t);
  const e = new Date(t); e.setDate(e.getDate() + 5); $("#s-to").value = iso(e);
})();
const shrineName = id => { const s = SHRINES.find(x => x.id === id); return s ? (isHi() ? s.name_hi : s.name) : id; };
function renderShrineOptions() {
  const m = isHi() ? "मी" : "m";
  ["#c-shrine", "#r-shrine", "#h-shrine", "#s-shrine"].forEach(sel => {
    const keep = $(sel).value;
    $(sel).innerHTML = SHRINES.map(s => `<option value="${s.id}">${esc(shrineName(s.id))} (${s.altitude_m.toLocaleString("en-IN")} ${m})</option>`).join("");
    if (keep) $(sel).value = keep;
  });
  const on = $("#c-shrine").value;
  $("#c-pills").innerHTML = SHRINES.map(s => `<button data-id="${s.id}" role="tab" class="${s.id === on ? "on" : ""}">${esc(shrineName(s.id))}</button>`).join("");
  $$("#c-pills button").forEach(b => b.onclick = () => { $("#c-shrine").value = b.dataset.id; loadForecast(); });
}

// ================= HOME =================
const WHY = [
  { i: "🎯", t: "Answers, not PDFs", old: "Scroll through notices and PDFs to find one detail.",
    neu: "Ask in plain words and get a short answer with its source and date.", go: "assistant",
    hi: ["जवाब, PDF नहीं", "एक जानकारी के लिए ढेरों सूचनाएँ और PDF पढ़ने पड़ते हैं।", "सीधे शब्दों में पूछें, स्रोत और तारीख के साथ छोटा उत्तर पाएँ।"] },
  { i: "🗣️", t: "Speak your language", old: "Mostly English-only pages and forms.",
    neu: "Hindi and English, typed or spoken, with replies read aloud.", go: "assistant",
    hi: ["अपनी भाषा में बोलें", "ज़्यादातर पेज और फ़ॉर्म सिर्फ़ अंग्रेज़ी में।", "हिन्दी और अंग्रेज़ी, लिखकर या बोलकर, उत्तर पढ़कर सुनाए जाते हैं।"] },
  { i: "📈", t: "Know the crowd before you go", old: "You find out about the rush when you are already in the queue.",
    neu: "A 7-day forecast against carrying capacity, with lighter dates.", go: "crowd",
    hi: ["जाने से पहले भीड़ जानें", "भीड़ का पता तब चलता है जब आप कतार में खड़े होते हैं।", "धारण क्षमता की तुलना में 7 दिन का अनुमान, कम भीड़ वाली तारीखों के साथ।"] },
  { i: "🛣️", t: "One view of the road", old: "Weather, road and landslide updates are spread over many sites.",
    neu: "Each segment scored from IMD alerts, road status and terrain, with reasons.", go: "route",
    hi: ["सड़क की पूरी तस्वीर एक जगह", "मौसम, सड़क और भूस्खलन की खबरें कई साइटों पर बिखरी हैं।", "IMD अलर्ट, सड़क की स्थिति और भू-भाग से हर हिस्से का जोखिम, कारण सहित।"] },
  { i: "🔔", t: "Alerts come to you", old: "You have to keep checking back for changes.",
    neu: "WhatsApp alerts for your own route segments, with SMS fallback.", go: "alerts",
    hi: ["अलर्ट आप तक पहुँचते हैं", "बदलाव जानने के लिए बार-बार साइट देखनी पड़ती है।", "आपके मार्ग के हिस्सों के लिए WhatsApp अलर्ट, SMS विकल्प के साथ।"] },
  { i: "📶", t: "Works on weak networks", old: "Heavy pages that fail without a signal.",
    neu: "A light offline PWA, an emergency card and SOS with the nearest medical post.", go: "alerts",
    hi: ["कमज़ोर नेटवर्क पर भी", "भारी पेज जो सिग्नल न होने पर खुलते ही नहीं।", "हल्का ऑफ़लाइन PWA, आपात कार्ड और नज़दीकी चिकित्सा केंद्र के साथ SOS।"] },
];
function renderWhy() {
  const shown = $$("#why-grid .why-card.in").length > 0;   // keep cards visible when re-rendering for a language change
  $("#why-grid").innerHTML = WHY.map((w, k) => {
    const [t, old, neu] = isHi() ? w.hi : [w.t, w.old, w.neu];
    return `<button class="why-card${shown ? " in" : ""}" data-go="${w.go}" style="--d:${(k % 3) * 0.12 + Math.floor(k / 3) * 0.18}s;--fd:${6 + (k % 3)}s;--fo:${-k * 0.9}s">
      <div class="wi">${w.i}</div><h3>${esc(t)}</h3>
      <div class="vs"><div class="old">${esc(old)}</div><div class="new">${esc(neu)}</div></div>
      <div class="peek">${esc(tr("Hover or tap to compare →"))}</div>
    </button>`;
  }).join("");
  bindWhy();
}
const bindWhy = () => $$(".why-card").forEach(c => {
  c.addEventListener("pointermove", e => { const r = c.getBoundingClientRect();
    c.style.setProperty("--mx", `${e.clientX - r.left}px`); c.style.setProperty("--my", `${e.clientY - r.top}px`); });
  c.onclick = () => {  // first tap on touch screens reveals the comparison, second tap opens the feature
    if (matchMedia("(hover: none)").matches && !c.classList.contains("open")) { c.classList.add("open"); return; }
    goto(c.dataset.go);
  };
});
renderWhy();

const HERO_CHIPS = ["Is Kedarnath crowded this week?", "Is the road to Badrinath open?", "How do I register for the yatra?", "केदारनाथ में कल कितनी भीड़ होगी?"];
function renderHeroChips() {
  $("#hero-chips").innerHTML = (isHi() ? I18N.list("hero") : HERO_CHIPS).map(q => `<button type="button">${esc(q)}</button>`).join("");
  $$("#hero-chips button").forEach(b => b.onclick = () => askFromAnywhere(b.textContent));
}
renderHeroChips();
$("#hero-ask").onsubmit = e => { e.preventDefault(); const v = $("#hero-q").value.trim(); if (v) { askFromAnywhere(v); $("#hero-q").value = ""; } };

let homeLoaded = false;
async function loadHome(force) {
  if (homeLoaded && !force) return; homeLoaded = true;
  await ready;
  const today = iso(new Date());
  const cards = await Promise.all(SHRINES.map(async s => {
    const [f, t] = await Promise.all([api(`/api/forecast/${s.id}?start=${today}&days=1`).catch(() => null),
                                      api(`/api/risk/trip/${s.id}`).catch(() => null)]);
    const d = f && f.days[0];
    return `<div class="shrine-card reveal" style="--img:url('${IMG[s.id] || ""}')">
      <div class="ph"></div>
      <h3>${esc(isHi() ? s.name_hi : s.name)} <small style="opacity:.8;font-weight:400">${esc(isHi() ? s.name : s.name_hi)}</small></h3>
      <div class="alt">⛰️ ${s.altitude_m.toLocaleString("en-IN")} ${isHi() ? "मी" : "m"} · ${esc(s.district)}</div>
      <div class="st"><span>${tr("👥 Crowd today")}</span>${d ? badge(d.band) : "–"}</div>
      <div class="st"><span>${tr("🛣️ Route")}</span>${t ? badge(t.worst.level) : "–"}</div>
      <div class="acts"><button data-act="crowd" data-id="${s.id}">${tr("Forecast")}</button><button data-act="route" data-id="${s.id}">${tr("Route")}</button></div>
    </div>`;
  }));
  $("#shrine-grid").innerHTML = cards.join("");
  if (force) $$("#shrine-grid .reveal").forEach(el => el.classList.add("in"));
  $$("#shrine-grid [data-act]").forEach(b => b.onclick = () => goto(b.dataset.act, { shrine: b.dataset.id }));
  observeReveals();
}
onEnter.home = () => loadHome();

// ================= ASSISTANT =================
const QUICK = ["Is Kedarnath crowded this week?", "Is the road to Kedarnath open?", "How do I register for the yatra?",
  "My father is 68 with BP, can he do the trek?", "What should I pack for Hemkund Sahib?", "केदारनाथ में कल कितनी भीड़ होगी?", "हेलीकॉप्टर टिकट कैसे बुक करें?"];
function renderQuick() {
  $("#quick").innerHTML = "";
  (isHi() ? I18N.list("quick") : QUICK).forEach(q => { const b = document.createElement("button"); b.type = "button"; b.textContent = q; b.onclick = () => ask(q); $("#quick").appendChild(b); });
}
renderQuick();

const FOLLOW = {  // next questions worth asking after each intent
  crowd: s => [`Which day is least crowded at ${s}?`, `Is the road to ${s} open?`],
  route: s => [`Is ${s} crowded this week?`, "Where can I halt safely on the way?"],
  health: () => ["Where are the medical posts on the route?", "What should I carry for high altitude?"],
  registration: () => ["Is registration free?", "Which documents do I need?"],
};
const FOLLOW_HI = {
  crowd: s => [`${s} में किस दिन सबसे कम भीड़ है?`, `क्या ${s} का रास्ता खुला है?`],
  route: s => [`इस हफ्ते ${s} में भीड़ कैसी है?`, "रास्ते में सुरक्षित पड़ाव कहाँ है?"],
  health: () => ["मार्ग पर चिकित्सा केंद्र कहाँ हैं?", "ऊँचाई के लिए क्या साथ ले जाएँ?"],
  registration: () => ["क्या पंजीकरण निःशुल्क है?", "कौन से दस्तावेज़ चाहिए?"],
};
let HISTORY = store.get("chat", []);
let lastAnswer = null;

function addMsg(html, cls) {
  const d = document.createElement("div"); d.className = "msg " + cls; d.innerHTML = html;
  $("#chat").appendChild(d); $("#chat").scrollTop = 1e6; return d;
}
const GREETING_EN = "Namaste! 🙏 I am YatraSetu. Ask me about crowds, routes, registration, health or safety on the Char Dham yatra, in English or हिन्दी. You can also tap 🎙️ and speak.";

function miniForecast(fc) {
  const days = (fc.days || []).slice(0, 7); if (!days.length) return "";
  const max = Math.max(fc.capacity || 0, ...days.map(d => d.visitors)) || 1;
  const col = r => r > 1 ? "var(--red)" : r > .85 ? "var(--orange)" : r > .6 ? "var(--yellow)" : "var(--green)";
  return `<div class="mini-fc-wrap"><div class="mini-fc" title="7-day forecast">${days.map((d, k) =>
    `<div style="height:${Math.max(4, 100 * d.visitors / max)}%;background:${d.open ? col(d.ratio) : "#c9d3d7"};animation-delay:${k * 60}ms"
      title="${esc(d.date)}: ${d.open ? d.visitors.toLocaleString("en-IN") + " · " + esc(d.band) : "closed"}"><span>${esc(d.date.slice(8))}</span></div>`).join("")}</div></div>`;
}

const greeting = () => isHi() ? I18N.list("greeting") : GREETING_EN;
function renderBot(r, el) {
  const name = r.shrine ? shrineName(r.shrine) : "";
  const src = (r.sources || []).map(s => `<span class="src">📄 ${esc(s.title)} · ${esc(s.updated)}</span>`).join("");
  const acts = [];
  if (r.sos) acts.push(`<a class="btn red sm" href="tel:112">${tr("📞 Call 112")}</a>`, `<button class="act" data-go="alerts" data-sos>${tr("🚨 Open SOS")}</button>`);
  if (r.intent === "crowd" && r.shrine) acts.push(`<button class="act" data-go="crowd" data-shrine="${r.shrine}">📊 ${esc(isHi() ? `${name} का पूरा अनुमान` : `Full forecast for ${name}`)}</button>`);
  if (r.intent === "route" && r.shrine) acts.push(`<button class="act" data-go="route" data-shrine="${r.shrine}">${tr("🛣️ Show on route map")}</button>`);
  if (r.intent === "health") acts.push(`<button class="act" data-go="health" ${r.shrine ? `data-shrine="${r.shrine}"` : ""}>${tr("❤️ Open health check")}</button>`);
  const fl = isHi() ? FOLLOW_HI : FOLLOW;
  const follow = fl[r.intent] ? fl[r.intent](name || shrineName("kedarnath")) : [];
  el.classList.toggle("sos", !!r.sos);
  el.innerHTML = `${esc(r.answer).replace(/\n/g, "<br>")}
    ${r.live && r.live.forecast ? miniForecast(r.live.forecast) : ""}
    ${src ? `<div class="meta">${src}</div>` : ""}
    <div class="msg-tools">
      <button data-tool="speak" title="${tr("Read aloud")}">${tr("🔊 Listen")}</button><button data-tool="copy" title="${tr("Copy answer")}">${tr("📋 Copy")}</button>
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
  addMsg(esc(greeting()), "bot");
  HISTORY.forEach(h => {
    if (h.role === "user") addMsg((h.voice ? `<span class="via">${tr("🎙️ spoken")}</span>` : "") + esc(h.text), "user");
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
  addMsg((opts.voice ? `<span class="via">${tr("🎙️ spoken")}</span>` : "") + esc(text), "user"); $("#q").value = "";
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
  $("#c-days").innerHTML = f.days.map((d, k) => `<div class="day" style="animation-delay:${k * 50}ms">${new Date(d.date).toLocaleDateString(isHi() ? "hi-IN" : "en-IN", { weekday: "short", day: "numeric", month: "short" })}
     <b>${d.open ? d.visitors.toLocaleString("en-IN") : "–"}</b>${badge(d.band)}</div>`).join("");
  const colors = f.days.map(d => d.ratio > 1 ? "#c0392b" : d.ratio > 0.85 ? "#e07a1f" : d.ratio > 0.6 ? "#d4a017" : "#2e8b57");
  barChart($("#c-chart"), f.days.map(d => d.date.slice(5)), f.days.map(d => d.visitors),
    { colors, line: f.capacity, lineLabel: isHi() ? `धारण क्षमता ${f.capacity.toLocaleString("en-IN")}/दिन` : `Carrying capacity ${f.capacity.toLocaleString("en-IN")}/day` });
  const peak = f.days.filter(d => d.open).sort((a, b) => b.ratio - a.ratio)[0];
  $("#c-suggest").innerHTML = "";
  if (peak) {
    const s = await api(`/api/forecast/${sid}/suggest?on=${peak.date}`);
    const dates = (s.better_dates || []).map(d => `${d.date} (${esc(tr(d.band))}, ~${d.visitors.toLocaleString("en-IN")})`).join(", ");
    const alt = s.alternative && s.alternative.length ? s.alternative[0] : null;
    if (s.needed) $("#c-suggest").innerHTML = isHi()
      ? `<div class="notice"><b>${peak.date}</b> को भीड़ <b>${esc(tr(peak.band))}</b> रहने का अनुमान है। आस-पास कम भीड़ वाली तारीखें: ${dates}।
         ${alt ? `विकल्प: <b>${esc(alt.shrine)}</b> (${esc(tr(alt.band))})।` : ""}</div>`
      : `<div class="notice"><b>${peak.date}</b> is forecast as <b>${peak.band}</b>. Lighter dates nearby: ${dates}.
         ${alt ? `Alternative: <b>${esc(alt.shrine)}</b> (${esc(alt.band)}).` : ""}</div>`;
  } else {
    $("#c-suggest").innerHTML = `<div class="notice">${isHi() ? `इन तिथियों में ${esc(shrineName(sid))} के कपाट बंद हैं। मई–नवंबर के यात्रा सीज़न की कोई तारीख चुनें।`
      : `${esc(shrineName(sid))} is closed for the season on these dates. Try a date in the May–November yatra season.`}</div>`;
  }
}
$("#c-go").onclick = loadForecast;
$("#c-shrine").onchange = loadForecast;
onEnter.crowd = async params => { await ready; if (params.get("shrine")) $("#c-shrine").value = params.get("shrine"); loadForecast(); };
window.addEventListener("resize", () => { if (current === "crowd" && $("#c-days").children.length) loadForecast(); });

// ================= ROUTE =================
const RK = { net: null, selected: null, highlight: [], plan: null };
const LVC = { Green: "var(--green)", Yellow: "var(--yellow)", Orange: "var(--orange)", Red: "var(--red)" };
const FAC = { stay: "🛏️", hospital: "🏥", medical: "🩺", fuel: "⛽", police: "👮", screening: "📋", shelter: "⛺" };
const L = n => (isHi() ? n.hi : n.en);                       // bilingual {en, hi} notes from the API
const factorsOf = s => (isHi() && s.factors_hi ? s.factors_hi : s.factors);
const facChips = f => f.map(x => `<span class="fac">${FAC[x] || "•"} ${esc(tr(x))}</span>`).join("");
const fmtTime = v => new Date(v).toLocaleString(isHi() ? "hi-IN" : "en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const fmtClock = v => new Date(v).toLocaleTimeString(isHi() ? "hi-IN" : "en-IN", { hour: "2-digit", minute: "2-digit" });
const hrs = h => { const m = Math.round(h * 60); return isHi() ? `${Math.floor(m / 60)} घं ${m % 60} मि` : `${Math.floor(m / 60)} h ${m % 60} min`; };
const localInput = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);

function redrawMap() { if (RK.net) routeMap($("#map"), RK.net, RK.highlight, { onSelect: id => showSegment(id), selected: RK.selected }); }
async function drawMap() { RK.net = await api("/api/risk/network"); redrawMap(); }

async function loadRiskOverview() {
  const [s, adv, cmp] = await Promise.all([api("/api/risk/summary"), api("/api/risk/advisories"), api("/api/risk/compare")]);
  const H = isHi(), seg = H ? "हिस्से" : "segments";
  const tiles = ["Green", "Yellow", "Orange", "Red"].map(l => [s.by_level[l], H ? `${seg} (${tr(l)})` : `${l} ${seg}`, LVC[l]])
    .concat([[s.road_status.length, H ? "सड़क बंद / प्रतिबंधित" : "Closures & restrictions", "var(--night)"],
             [s.weather_alerts.length, H ? "IMD ज़िला अलर्ट" : "IMD district alerts", "#3b82c4"],
             [s.advisories, H ? "सक्रिय परामर्श" : "Active advisories", "var(--saff)"]]);
  $("#rk-kpis").innerHTML = tiles.map(([v, l, c], k) => `<div class="rk-kpi" style="--c:${c};animation-delay:${k * 50}ms"><b>${v}</b><span>${esc(l)}</span></div>`).join("");
  $("#rk-updated").textContent = (H ? "अपडेट: " : "Updated ") + fmtTime(s.updated_at);

  const items = [];
  s.road_status.forEach(r => items.push(`<button class="feed-item" data-seg="${r.id}"><span class="fi-ic">${r.status === "Closed" ? "⛔" : "🚧"}</span>
    <div><b>${esc(r.name)}</b> ${badge(r.status === "Closed" ? "Closed" : r.level)}
    <small>${esc(tr(r.status))}${r.reason ? " · " + esc(r.reason) : ""}${r.eta ? ` · ${H ? "खुलने का अनुमान" : "Reopening"}: ${esc(r.eta)}` : ""}</small></div></button>`));
  s.weather_alerts.forEach(w => items.push(`<div class="feed-item"><span class="fi-ic">🌧️</span>
    <div><b>${esc(w.district)}</b> ${badge(w.level)}<small>${H ? `IMD ${tr(w.level)} अलर्ट · वर्षा ${w.rain_mm} मिमी` : `IMD ${w.level} alert · ${w.rain_mm} mm rain forecast`}</small></div></div>`));
  adv.forEach(a => items.push(`<div class="feed-item"><span class="fi-ic">📢</span>
    <div><b>${esc(a.title)}</b><small>${esc(H && a.body_hi ? a.body_hi : a.body_en)}</small>
    <small>${a.segments.map(x => esc(x.name)).join(", ")} · ${H ? "मान्य" : "valid until"} ${esc(a.valid_until)}</small></div></div>`));
  $("#rk-feed").innerHTML = items.join("") || `<p class="muted">✅ ${H ? "अभी कोई सड़क बंद, IMD अलर्ट या परामर्श नहीं है।" : "No closures, IMD alerts or advisories right now."}</p>`;
  $$("#rk-feed [data-seg]").forEach(b => b.onclick = () => showSegment(b.dataset.seg, true));

  $("#rk-compare").innerHTML = cmp.map((c, k) => `<button class="cmp-row" data-shrine="${c.shrine}">
    <span class="cmp-rank">${k + 1}</span>
    <div class="cmp-main"><b>${esc(shrineName(c.shrine))}</b><div class="cmp-strip">${c.levels.map(l => `<i style="background:${LVC[l]}" title="${esc(tr(l))}"></i>`).join("")}</div>
      <small>${c.total_km} ${H ? "किमी" : "km"} · ~${hrs(c.hours)} · ${H ? "सबसे जोखिम" : "worst"}: ${esc(c.worst)}</small></div>
    ${badge(c.closed ? "Closed" : c.level)}</button>`).join("");
  $$("#rk-compare .cmp-row").forEach(b => b.onclick = () => { $("#r-shrine").value = b.dataset.shrine; $("#r-start").innerHTML = ""; planTrip(true); });
}

async function showSegment(id, scroll) {
  RK.selected = id; redrawMap();
  const d = await api(`/api/risk/segment/${id}`), H = isHi(), P = d.parts;
  const scale = Math.max(100, P.alert + P.rain + P.terrain + P.road);
  const PARTS = [["alert", "IMD alert", "var(--red)"], ["rain", "Rain", "#3b82c4"], ["terrain", "Terrain", "#9a6b3f"], ["road", "Road status", "var(--night)"]];
  const box = $("#seg-detail");
  box.className = "seg-full";
  box.innerHTML = `
    <div class="seg-head"><div><b>${esc(d.from)} → ${esc(d.to)}</b>
      <small>${esc(d.district)} · ${d.km} ${H ? "किमी" : "km"} · ${d.mode === "trek" ? "🥾 " + tr("On foot") : "🚗 " + tr("Road")}</small></div>
      <div class="seg-score" style="--c:${LVC[d.level]}"><b>${d.score}</b><span>/100</span>${badge(d.level)}</div></div>
    <div class="score-bar" role="img" aria-label="${esc(factorsOf(d).join("; "))}">${PARTS.map(([k, , c]) => P[k] ? `<i style="width:${100 * P[k] / scale}%;background:${c}"></i>` : "").join("")}</div>
    <div class="score-legend">${PARTS.map(([k, l, c]) => `<span><i style="background:${c}"></i>${esc(tr(l))} +${Math.round(P[k])}</span>`).join("")}</div>
    <ul class="reasons">${factorsOf(d).map(f => `<li>${esc(f)}</li>`).join("")}</ul>
    <div class="facts">
      <div><span>${tr("IMD alert")}</span><b>${d.alert === "None" ? tr("None") : badge(d.alert)}</b>${d.weather ? `<small>${d.weather.rain_mm} ${H ? "मिमी" : "mm"} · ${fmtTime(d.weather.updated_at)}</small>` : ""}</div>
      <div><span>${tr("Road status")}</span><b>${esc(tr(d.status))}</b>${d.road && (d.road.reason || d.road.eta) ? `<small>${esc(d.road.reason || "")}${d.road.eta ? ` · ${esc(d.road.eta)}` : ""}</small>` : ""}</div>
      <div><span>${tr("Terrain")}</span><b>${H ? `ढलान श्रेणी ${d.slope}` : `Slope class ${d.slope}`}</b><small>${d.slide_history} ${H ? "पुराने भूस्खलन" : "past slides"}</small></div>
    </div>
    ${d.safe_halt ? `<div class="notice">⚠️ ${H ? "सुझाया गया सुरक्षित पड़ाव" : "Suggested safe halt"}: <b>${esc(d.safe_halt.name)}</b></div>` : ""}
    ${d.advisories.map(a => `<div class="notice">📢 <b>${esc(a.title)}</b>: ${esc(H && a.body_hi ? a.body_hi : a.body_en)}</div>`).join("")}
    <div class="ends">${d.ends.map(e => `<div><b>📍 ${esc(e.name)}</b><div class="facs">${facChips(e.facilities)}</div></div>`).join("")}</div>
    <div class="seg-acts">${d.trips.map(t => `<button class="chip-btn" data-plan="${t}">🧭 ${esc(H ? `${shrineName(t)} यात्रा की योजना` : `Plan ${shrineName(t)} trip`)}</button>`).join("")}
      <button class="chip-btn" data-near>📍 ${esc(tr("Near me"))}</button></div>`;
  box.querySelectorAll("[data-plan]").forEach(b => b.onclick = () => { $("#r-shrine").value = b.dataset.plan; $("#r-start").innerHTML = ""; planTrip(true); });
  box.querySelector("[data-near]").onclick = nearMe;
  if (scroll) $("#seg-card").scrollIntoView({ behavior: "smooth", block: "center" });
}

function nearMe() {
  const fallback = () => showNearby(+$("#sos-lat").value, +$("#sos-lon").value, true);
  if (!navigator.geolocation) { toast(isHi() ? "लोकेशन उपलब्ध नहीं; SOS फ़ॉर्म के निर्देशांक इस्तेमाल हो रहे हैं।" : "Location is unavailable; using the coordinates from the SOS form."); return fallback(); }
  toast("Finding your location…");
  navigator.geolocation.getCurrentPosition(p => showNearby(p.coords.latitude, p.coords.longitude),
    () => { toast(isHi() ? "लोकेशन नहीं मिली; SOS फ़ॉर्म के निर्देशांक इस्तेमाल हो रहे हैं।" : "Could not get your location; using the coordinates from the SOS form.", 4500); fallback(); },
    { timeout: 8000 });
}
async function showNearby(lat, lon, approx) {
  const n = await api(`/api/risk/nearby?lat=${lat}&lon=${lon}`), H = isHi();
  RK.highlight = n.segments.map(s => s.id); RK.selected = null; redrawMap();
  const box = $("#seg-detail");
  box.className = "seg-full";
  box.innerHTML = `
    <div class="seg-head"><div><b>📍 ${H ? "आपके पास" : "Near you"}: ${esc(n.node.name)}</b>
      <small>${n.node.km} ${H ? "किमी दूर" : "km away"} · ${lat.toFixed(3)}, ${lon.toFixed(3)}${approx ? (H ? " (SOS फ़ॉर्म से)" : " (from the SOS form)") : ""}</small></div>
      ${n.worst ? `<div class="seg-score" style="--c:${LVC[n.worst.level]}"><b>${n.worst.score}</b><span>/100</span></div>` : ""}</div>
    <div class="feed">${n.segments.map(s => `<button class="feed-item" data-seg="${s.id}"><span class="fi-ic">${s.mode === "trek" ? "🥾" : "🚗"}</span>
      <div><b>${esc(s.from)} → ${esc(s.to)}</b> ${badge(s.level)}<small>${s.score}/100 · ${esc(factorsOf(s)[0])}</small></div></button>`).join("")}</div>
    <div class="notice">🏥 ${H ? "नज़दीकी चिकित्सा सहायता" : "Nearest medical help"}: <b>${esc(n.nearest_help.name)}</b> (~${n.nearest_help.km} ${H ? "किमी" : "km"})
      <div class="facs">${facChips(n.nearest_help.facilities)}</div></div>
    <a class="btn red sm" href="#alerts" data-sos>🚨 SOS</a> <a class="btn ghost sm" href="tel:112">${tr("📞 Call 112")}</a>`;
  box.querySelectorAll("[data-seg]").forEach(b => b.onclick = () => showSegment(b.dataset.seg));
}

async function planTrip(scroll) {
  await ready;
  const q = new URLSearchParams({ vehicle: $("#r-vehicle").value });
  if ($("#r-start").value) q.set("start", $("#r-start").value);
  if ($("#r-depart").value) q.set("depart", $("#r-depart").value);
  let p;
  try { p = await api(`/api/risk/plan/${$("#r-shrine").value}?${q}`); }
  catch (e) { $("#r-out").innerHTML = `<div class="notice">${esc(e.message)}</div>`; return; }
  RK.plan = p;
  $("#r-start").innerHTML = p.start_points.map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join("");
  $("#r-start").value = p.start;
  RK.highlight = p.legs.map(l => l.id); RK.selected = null; redrawMap();
  const H = isHi();
  const items = [`<li class="tl-stop"><span class="dot">🚩</span><div><b>${esc(p.start_name)}</b><small>${H ? "प्रस्थान" : "Depart"} ${fmtTime(p.depart_at)}</small></div></li>`];
  p.legs.forEach((l, k) => {
    const h = p.halts.find(x => x.at === l.from_id && x.until === l.depart_at);
    if (h) items.push(`<li class="tl-halt"><span class="dot">🌙</span><div><b>${H ? "रात्रि विश्राम" : "Overnight halt"}: ${esc(h.name)}</b>
      <small>${fmtTime(h.from)} → ${fmtTime(h.until)} · ${esc(L(h.reason))}</small><div class="facs">${facChips(h.facilities)}</div></div></li>`);
    items.push(`<li class="tl-leg" data-seg="${l.id}" style="--c:${LVC[l.level]};animation-delay:${k * 60}ms"><span class="dot"></span><div>
      <div class="tl-top"><b>${l.mode === "trek" ? "🥾" : "🚗"} ${esc(l.from)} → ${esc(l.to)}</b>${badge(l.level)}</div>
      <small>${fmtClock(l.depart_at)} → ${fmtClock(l.arrive_at)} · ${l.km} ${H ? "किमी" : "km"} · ${hrs(l.hours)} · ${H ? "जोखिम" : "risk"} ${l.score}/100</small>
      ${l.notes.map(n => `<div class="tl-note">${esc(L(n))}</div>`).join("")}</div></li>`);
  });
  items.push(p.blocked
    ? `<li class="tl-stop blocked"><span class="dot">⛔</span><div><b>${H ? "सड़क बंद" : "Road closed"}: ${esc(p.blocked.segment)}</b>
        <small>${H ? "यहाँ रुकें" : "Wait at"} ${esc(p.blocked.halt)}${p.blocked.reason ? ` · ${esc(p.blocked.reason)}` : ""}${p.blocked.eta ? ` · ${H ? "खुलने का अनुमान" : "Reopening"}: ${esc(p.blocked.eta)}` : ""}</small></div></li>`
    : `<li class="tl-stop end"><span class="dot">🛕</span><div><b>${esc(shrineName(p.shrine))}</b><small>${H ? "पहुँच" : "Arrive"} ${fmtTime(p.arrive_at)}</small></div></li>`);
  $("#r-out").innerHTML = `
    <div class="plan-sum">
      <div><span>${H ? "दूरी" : "Distance"}</span><b>${p.total_km} ${H ? "किमी" : "km"}</b></div>
      <div><span>${H ? "यात्रा समय" : "Travel time"}</span><b>${hrs(p.drive_hours)}</b></div>
      <div><span>${H ? "रात्रि विश्राम" : "Overnight halts"}</span><b>${p.halts.length}</b></div>
      <div><span>${p.blocked ? (H ? "यहाँ तक" : "Reach") : (H ? "पहुँच" : "Arrive")}</span><b>${p.blocked ? esc(p.reached) : fmtTime(p.arrive_at)}</b></div>
    </div>
    ${p.warnings.map(w => `<div class="notice">⚠️ ${esc(L(w))}</div>`).join("")}
    <ol class="timeline">${items.join("")}</ol>
    <p class="muted">ℹ️ ${esc(L(p.note))}</p>`;
  $$("#r-out [data-seg]").forEach(li => li.onclick = () => showSegment(li.dataset.seg, true));
  if (scroll) $("#planner").scrollIntoView({ behavior: "smooth", block: "start" });
}
$("#r-go").onclick = () => planTrip();
$("#r-shrine").onchange = () => { $("#r-start").innerHTML = ""; planTrip(); };
$("#r-start").onchange = $("#r-vehicle").onchange = $("#r-depart").onchange = () => planTrip();
$("#rk-near").onclick = nearMe;
$("#rk-refresh").onclick = async () => {
  await drawMap(); await loadRiskOverview();
  if (RK.selected) showSegment(RK.selected);
  if (RK.plan) planTrip();
  toast(isHi() ? "मार्ग डेटा अपडेट हुआ" : "Route data refreshed");
};
function refreshRouteText() {  // re-render generated route text after a language change
  if (!RK.net) return;
  loadRiskOverview(); if (RK.plan) planTrip(); if (RK.selected) showSegment(RK.selected);
}
onEnter.route = async params => {
  await ready;
  if (!$("#r-depart").value) { const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(6, 0, 0, 0); $("#r-depart").value = localInput(t); }
  const sh = params.get("shrine");
  if (sh) { $("#r-shrine").value = sh; $("#r-start").innerHTML = ""; }
  await drawMap();
  loadRiskOverview();
  if (sh || !RK.plan) planTrip(!!sh);
};

// ================= HEALTH =================
$("#h-go").onclick = async () => {
  const conds = $$("#health-form .check input:not(.rf)").filter(c => c.checked).map(c => c.value);
  const rfs = $$("#health-form .rf").filter(c => c.checked).map(c => c.value);
  const r = await api("/api/health/check", { age: +$("#h-age").value, conditions: conds, red_flags: rfs, fitness: $("#h-fit").value, shrine: $("#h-shrine").value });
  $("#h-out").innerHTML = `<div class="result" style="margin-top:0"><div style="font-size:18px;margin-bottom:8px">${badge(r.category)}</div>
    ${r.reasons.length ? `<h3>${tr("Why")}</h3><ul>${r.reasons.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    <h3>${tr("What to do")}</h3><ul>${r.actions.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
    <h3>${tr("On your route")}</h3><p>🩺 ${tr("Screening")}: ${r.screening_points.join(", ") || "–"}<br>🏥 ${tr("Medical posts")}: ${r.medical_posts.join(", ")}</p>
    <p class="muted"><i>${esc(r.disclaimer)}</i></p></div>`;
};
onEnter.health = async params => { await ready; if (params.get("shrine")) $("#h-shrine").value = params.get("shrine"); };

// ================= ALERTS & SOS =================
$("#s-go").onclick = async () => {
  try {
    const r = await api("/api/subscribe", { phone: $("#s-phone").value, language: $("#s-lang").value, shrine: $("#s-shrine").value,
      start_date: $("#s-from").value, end_date: $("#s-to").value, group_size: +$("#s-group").value, consent: $("#s-consent").checked });
    $("#s-out").innerHTML = `<div class="result">✅ ${isHi() ? `सदस्यता हो गई (ID ${r.id})। आपको मार्ग के ${r.segments.length} हिस्सों के लिए WhatsApp अलर्ट (SMS विकल्प) मिलेंगे।`
      : `Subscribed (ID ${r.id}). You will get WhatsApp alerts (SMS fallback) for ${r.segments.length} route segments.`}</div>`;
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
  $("#sos-out").innerHTML = `<div class="result"><b>${tr("Nearest help:")}</b> ${esc(r.nearest_help)} (~${r.nearest_km} ${isHi() ? "किमी" : "km"}; ${r.nearest_facilities.join(", ")})<br>
    <a class="btn red" style="margin-top:8px" href="${r.dial}">${tr("📞 Call 112")}</a>
    <a class="btn" style="margin-top:8px" href="${r.whatsapp_share}" target="_blank" rel="noopener">${tr("Share on WhatsApp")}</a>
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

// ---------- language switch: answers, voice and the whole UI follow the picker ----------
function setLanguage(v, announce) {
  store.set("lang", v);
  I18N.apply(v);
  renderWhy(); renderHeroChips(); renderQuick(); renderHistory();
  if (SHRINES.length) renderShrineOptions();
  if (homeLoaded) loadHome(true);
  if (current === "crowd" && $("#c-days").children.length) loadForecast();
  refreshRouteText();
  if ($("#h-out .result")) $("#h-go").click();
  document.dispatchEvent(new CustomEvent("ys:lang", { detail: I18N.lang }));
  if (announce) toast(v === "hi" ? "भाषा: हिन्दी। उत्तर और वेबसाइट अब हिन्दी में हैं।" : v === "en" ? "Language: English" : "Language: Auto (answers follow the language you write in)");
}
$("#lang").value = store.get("lang", "");
$("#lang").onchange = () => setLanguage($("#lang").value, true);
setLanguage($("#lang").value, false);

route();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/static/sw.js").catch(() => {});
