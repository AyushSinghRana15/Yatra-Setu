// YatraSetu traveller web app (PWA front-end)
const $ = s => document.querySelector(s);
const api = async (url, body, method) => {
  const r = await fetch(url, body ? { method: method || "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const j = await r.json(); if (!r.ok) throw new Error(j.detail ? JSON.stringify(j.detail) : r.statusText); return j;
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const badge = t => `<span class="badge b-${String(t).split(" ")[0]}">${esc(t)}</span>`;
const iso = d => d.toISOString().slice(0, 10);

// tabs
document.querySelectorAll("nav.tabs button").forEach(b => b.onclick = () => {
  document.querySelectorAll("nav.tabs button").forEach(x => x.classList.remove("active"));
  document.querySelectorAll("section.tab").forEach(x => x.classList.remove("active"));
  b.classList.add("active"); $("#tab-" + b.dataset.tab).classList.add("active");
  if (b.dataset.tab === "route") loadMap();
  if (b.dataset.tab === "crowd") loadForecast();
});

// ---------- chat ----------
const QUICK = ["Is Kedarnath crowded this week?", "Is the road to Kedarnath open?", "How do I register for the yatra?",
  "My father is 68 with BP, can he do the trek?", "केदारनाथ में कल कितनी भीड़ होगी?", "हेलीकॉप्टर टिकट कैसे बुक करें?"];
QUICK.forEach(q => { const b = document.createElement("button"); b.textContent = q; b.onclick = () => ask(q); $("#quick").appendChild(b); });

function addMsg(html, cls) { const d = document.createElement("div"); d.className = "msg " + cls; d.innerHTML = html; $("#chat").appendChild(d); $("#chat").scrollTop = 1e6; return d; }
addMsg("Namaste! 🙏 I am YatraSetu. Ask me about crowds, routes, registration, health or safety on the Char Dham yatra – in English or हिन्दी.", "bot");

async function ask(text) {
  if (!text.trim()) return;
  addMsg(esc(text), "user"); $("#q").value = "";
  const wait = addMsg("…", "bot");
  try {
    const r = await api("/api/chat", { text, language: $("#lang").value || null });
    const src = r.sources.map(s => `<span class="src">📄 ${esc(s.title)} · ${esc(s.updated)}</span>`).join("");
    wait.innerHTML = esc(r.answer) + (src ? `<div class="meta">${src}</div>` : "");
    if (r.sos) { wait.classList.add("sos"); wait.innerHTML += `<div class="meta"><a href="tel:112"><b>📞 Call 112</b></a></div>`; }
    $("#details").innerHTML = `<table class="t"><tr><th>Field</th><th>Value</th></tr>
      <tr><td>Language</td><td>${esc(r.language)}</td></tr><tr><td>Intent</td><td>${esc(r.intent)} (confidence ${r.confidence})</td></tr>
      <tr><td>Shrine detected</td><td>${esc(r.shrine || "–")}</td></tr><tr><td>Answer mode</td><td>${esc(r.mode)}</td></tr>
      <tr><td>Grounded</td><td>${r.grounded ? "✅ yes" : "⚠️ no (fallback)"}</td></tr>
      <tr><td>Sources (similarity)</td><td>${r.sources.map(s => esc(s.title) + (s.score != null ? ` (${s.score})` : "")).join("<br>") || "–"}</td></tr></table>`;
  } catch (e) { wait.innerHTML = "Sorry, something went wrong: " + esc(e.message); }
}
$("#send").onclick = () => ask($("#q").value);
$("#q").addEventListener("keydown", e => { if (e.key === "Enter") ask($("#q").value); });

// ---------- shrine selects ----------
let SHRINES = [];
(async () => {
  SHRINES = await api("/api/shrines");
  ["#c-shrine", "#r-shrine", "#h-shrine", "#s-shrine"].forEach(sel =>
    $(sel).innerHTML = SHRINES.map(s => `<option value="${s.id}">${s.name} (${s.altitude_m.toLocaleString("en-IN")} m)</option>`).join(""));
  const t = new Date(); $("#c-date").value = iso(t); $("#s-from").value = iso(t);
  const e = new Date(t); e.setDate(e.getDate() + 5); $("#s-to").value = iso(e);
})();

// ---------- crowd ----------
async function loadForecast() {
  const sid = $("#c-shrine").value || "kedarnath";
  const f = await api(`/api/forecast/${sid}?start=${$("#c-date").value}&days=7`);
  $("#c-days").innerHTML = f.days.map(d => `<div class="day">${new Date(d.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
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
  }
}
$("#c-go").onclick = loadForecast;

// ---------- route ----------
async function loadMap(highlight = []) { routeMap($("#map"), await api("/api/risk/network"), highlight); }
$("#r-go").onclick = async () => {
  const t = await api(`/api/risk/trip/${$("#r-shrine").value}`);
  loadMap(t.segments.map(s => s.id));
  $("#r-out").innerHTML = `<div class="result"><b>Total ${t.total_km} km</b> · worst segment: ${esc(t.worst.from)} → ${esc(t.worst.to)} ${badge(t.worst.level)}
     ${t.advice ? `<div class="notice">⚠️ Avoid ${esc(t.advice.segment)} for now. Suggested safe halt: <b>${esc(t.advice.halt)}</b>
       (${t.advice.facilities.join(", ")}).</div>` : ""}</div>
     <table class="t" style="margin-top:10px"><tr><th>Segment</th><th>km</th><th>Risk</th><th>Why</th></tr>
     ${t.segments.map(s => `<tr><td>${esc(s.from)} → ${esc(s.to)}${s.mode === "trek" ? " 🥾" : ""}</td><td>${s.km}</td>
       <td>${badge(s.level)} ${s.score}</td><td class="muted">${s.factors.map(esc).join("<br>")}</td></tr>`).join("")}</table>`;
};

// ---------- health ----------
$("#h-go").onclick = async () => {
  const conds = [...document.querySelectorAll("#tab-health .check input:not(.rf)")].filter(c => c.checked).map(c => c.value);
  const rfs = [...document.querySelectorAll("#tab-health .rf")].filter(c => c.checked).map(c => c.value);
  const r = await api("/api/health/check", { age: +$("#h-age").value, conditions: conds, red_flags: rfs, fitness: $("#h-fit").value, shrine: $("#h-shrine").value });
  $("#h-out").innerHTML = `<div style="font-size:18px;margin-bottom:8px">${badge(r.category)}</div>
    ${r.reasons.length ? `<h3>Why</h3><ul>${r.reasons.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    <h3>What to do</h3><ul>${r.actions.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
    <h3>On your route</h3><p>🩺 Screening: ${r.screening_points.join(", ") || "–"}<br>🏥 Medical posts: ${r.medical_posts.join(", ")}</p>
    <p class="muted"><i>${esc(r.disclaimer)}</i></p>`;
};

// ---------- subscribe & SOS ----------
$("#s-go").onclick = async () => {
  try {
    const r = await api("/api/subscribe", { phone: $("#s-phone").value, language: $("#s-lang").value, shrine: $("#s-shrine").value,
      start_date: $("#s-from").value, end_date: $("#s-to").value, group_size: +$("#s-group").value, consent: $("#s-consent").checked });
    $("#s-out").innerHTML = `<div class="result">✅ Subscribed (ID ${r.id}). You will get WhatsApp alerts (SMS fallback) for ${r.segments.length} route segments.</div>`;
  } catch (e) { $("#s-out").innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
};
$("#sos-go").onclick = async () => {
  const r = await api("/api/sos", { lat: +$("#sos-lat").value, lon: +$("#sos-lon").value, contacts: [$("#sos-contact").value] });
  $("#sos-out").innerHTML = `<div class="result"><b>Nearest help:</b> ${esc(r.nearest_help)} (~${r.nearest_km} km; ${r.nearest_facilities.join(", ")})<br>
    <a class="btn red" style="display:inline-block;margin-top:8px;text-decoration:none" href="${r.dial}">📞 Call 112</a>
    <a class="btn" style="display:inline-block;margin-top:8px;text-decoration:none" href="${r.whatsapp_share}">Share on WhatsApp</a>
    <p class="muted">${esc(r.message)}</p></div>`;
};

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/static/sw.js").catch(() => {});
