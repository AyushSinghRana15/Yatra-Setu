// Officials' dashboard
const $ = s => document.querySelector(s);
let TOKEN = sessionStorage.getItem("ys_token") || "", ROLE = sessionStorage.getItem("ys_role") || "", USER = sessionStorage.getItem("ys_user") || "";
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const badge = t => `<span class="badge b-${String(t).split(" ")[0]}">${esc(t)}</span>`;
async function api(url, body) {
  const r = await fetch(url, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", "X-Token": TOKEN },
    body: body ? JSON.stringify(body) : undefined });
  const j = await r.json(); if (!r.ok) throw new Error(j.detail || r.statusText); return j;
}

$("#login-go").onclick = async () => {
  try {
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: $("#u").value, password: $("#p").value }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.detail);
    TOKEN = j.token; ROLE = j.role; USER = j.username;
    sessionStorage.setItem("ys_token", TOKEN); sessionStorage.setItem("ys_role", ROLE); sessionStorage.setItem("ys_user", USER);
    start();
  } catch (e) { $("#login-err").innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
};

document.querySelectorAll("nav.tabs button").forEach(b => b.onclick = () => {
  document.querySelectorAll("nav.tabs button").forEach(x => x.classList.remove("active"));
  document.querySelectorAll("section.tab").forEach(x => x.classList.remove("active"));
  b.classList.add("active"); $("#tab-" + b.dataset.tab).classList.add("active"); refresh(b.dataset.tab);
});

async function start() {
  try { await api("/api/admin/analytics"); } catch { sessionStorage.clear(); return; }
  $("#login").style.display = "none"; $("#app").style.display = "block";
  $("#who").innerHTML = `Signed in as <b>${esc(USER)}</b> (${esc(ROLE)}) · <a href="#" id="logout">Sign out</a>`;
  $("#logout").onclick = () => { sessionStorage.clear(); location.reload(); };
  const net = await api("/api/risk/network");
  const opts = net.segments.map(s => `<option value="${s.id}">${esc(s.from)} → ${esc(s.to)} (${esc(s.district)})</option>`).join("");
  $("#a-seg").innerHTML = opts; $("#r-seg").innerHTML = opts;
  $("#a-seg").value = "guptkashi_sonprayag"; $("#r-seg").value = "guptkashi_sonprayag";
  const v = new Date(); v.setDate(v.getDate() + 2); $("#a-valid").value = v.toISOString().slice(0, 10);
  const shrines = await api("/api/shrines");
  $("#m-shrine").innerHTML = shrines.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
  $("#m-shrine").onchange = () => refresh("model");
  refresh("overview");
}

async function refresh(tab) {
  if (tab === "overview") {
    const a = await api("/api/admin/analytics");
    const delivered = a.outbox.filter(o => o.status === "delivered").reduce((s, o) => s + o.n, 0);
    $("#kpis").innerHTML = [[a.queries, "Questions answered"], [a.grounded_rate + "%", "Grounded answers"],
      [a.subscriptions, "Trips subscribed for alerts"], [delivered, "Alerts delivered"]]
      .map(([v, l]) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");
    const k = Object.keys(a.by_intent); barChart($("#ch-intent"), k, k.map(x => a.by_intent[x]));
    routeMap($("#map"), await api("/api/risk/network"));
  }
  if (tab === "adv") {
    const list = await api("/api/admin/advisories");
    $("#adv-list").innerHTML = list.length ? `<table class="t"><tr><th>#</th><th>Advisory</th><th>Status</th><th></th></tr>${list.map(a =>
      `<tr><td>${a.id}</td><td><b>${esc(a.title)}</b><br><span class="muted">by ${esc(a.author)}${a.approver ? " · approved by " + esc(a.approver) : ""}
       · valid until ${esc(a.valid_until)}</span></td><td>${badge(a.status)}</td>
       <td>${a.status === "pending" && ROLE === "approver" ? `<button class="btn saff" onclick="approve(${a.id})">Approve &amp; send</button>` : ""}</td></tr>`).join("")}</table>`
      : `<p class="muted">No advisories yet.</p>`;
  }
  if (tab === "outbox") {
    const o = await api("/api/admin/outbox");
    $("#ob").innerHTML = `<table class="t"><tr><th>Time</th><th>To</th><th>Channel</th><th>Status</th><th>Message</th></tr>${o.map(x =>
      `<tr><td>${esc(x.created_at.replace("T", " "))}</td><td>${esc(x.display_phone)}</td><td>${esc(x.channel)}</td><td>${badge(x.status)}</td>
       <td class="muted">${esc(x.message)}</td></tr>`).join("")}</table>`;
  }
  if (tab === "model") {
    const m = await api("/api/model/metrics?shrine=" + ($("#m-shrine").value || "kedarnath"));
    const sid = $("#m-shrine").value || "kedarnath";
    $("#m-kpis").innerHTML = [[m.mape_normal_days + "%", "MAPE, all shrines (normal days)"], [m.mape_by_shrine[sid] + "%", "MAPE, this shrine"],
      [m.band_accuracy + "%", "Crowd-band accuracy"], [m.train_rows + " / " + m.test_rows, "Train / test rows"]]
      .map(([v, l]) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");
    const b = m.backtest;
    lineChart($("#ch-bt"), b.dates.map(d => d.slice(5)), [
      { name: "Actual", values: b.actual, color: "#1f4e5f", width: 1.8 },
      { name: "Predicted", values: b.predicted, color: "#d9731e", width: 1.8 }], { line: b.capacity, lineLabel: "Carrying capacity" });
  }
  if (tab === "audit") {
    const a = await api("/api/admin/audit");
    $("#au").innerHTML = `<table class="t"><tr><th>Time</th><th>Actor</th><th>Action</th><th>Details</th></tr>${a.map(x =>
      `<tr><td>${esc(x.created_at.replace("T", " "))}</td><td>${esc(x.actor)}</td><td>${esc(x.action)}</td><td class="muted">${esc(x.object)}</td></tr>`).join("")}</table>`;
  }
}

$("#a-go").onclick = async () => {
  try {
    const r = await api("/api/admin/advisories", { title: $("#a-title").value, body_en: $("#a-en").value, body_hi: $("#a-hi").value,
      category: "road", segments: [$("#a-seg").value], valid_until: $("#a-valid").value });
    $("#a-out").innerHTML = `<div class="result">Advisory #${r.id} submitted. Waiting for an approver (four-eyes rule).</div>`; refresh("adv");
  } catch (e) { $("#a-out").innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
};
window.approve = async id => {
  try { const r = await api(`/api/admin/advisories/${id}/approve`, {});
    await refresh("adv");
    $("#adv-list").insertAdjacentHTML("afterbegin", `<div class="result" style="margin-bottom:10px">✅ Advisory #${id} published and added to the
      assistant's knowledge base. Recipients: <b>${r.recipients}</b> (WhatsApp ${r.whatsapp_delivered}, SMS fallback ${r.sms_fallback}).</div>`);
  } catch (e) { $("#adv-list").insertAdjacentHTML("afterbegin", `<div class="notice">${esc(e.message)}</div>`); }
};
$("#r-go").onclick = async () => {
  try { const r = await api("/api/admin/road-status", { segment_id: $("#r-seg").value, status: $("#r-status").value, reason: $("#r-reason").value, eta: $("#r-eta").value });
    $("#r-out").innerHTML = `<div class="result">Segment now ${badge(r.segment.level)} (${r.segment.score}/100). Travellers notified: <b>${r.notified}</b>.</div>`;
  } catch (e) { $("#r-out").innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
};
$("#w-go").onclick = async () => {
  await api("/api/admin/weather", { district: $("#w-d").value, level: $("#w-l").value, rain_mm: +$("#w-mm").value });
  $("#w-out").innerHTML = `<div class="result">Alert saved. Route-risk scores updated for ${esc($("#w-d").value)}.</div>`;
};
if (TOKEN) start();
