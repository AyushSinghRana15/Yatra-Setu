// Minimal dependency-free charts (canvas) and the route-risk map (SVG).
const COLORS = { teal: "#1f4e5f", saff: "#d9731e", grey: "#9db7c0", red: "#c0392b", rule: "#d6dee2", ink: "#1b2a33" };
const LEVEL_COLORS = { Green: "#2e8b57", Yellow: "#d4a017", Orange: "#e07a1f", Red: "#c0392b" };

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h); ctx.font = "12px system-ui, sans-serif";
  return { ctx, w, h };
}

function barChart(canvas, labels, values, opts = {}) {
  const { ctx, w, h } = setupCanvas(canvas);
  const pad = { l: 46, r: 10, t: 14, b: 34 };
  const max = Math.max(...values, opts.line || 0) * 1.15 || 1;
  const bw = (w - pad.l - pad.r) / values.length;
  ctx.strokeStyle = COLORS.rule; ctx.fillStyle = "#6b7780";
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (h - pad.t - pad.b) * i / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillText(Math.round(max * (1 - i / 4)).toLocaleString("en-IN"), 4, y + 4);
  }
  values.forEach((v, i) => {
    const bh = (h - pad.t - pad.b) * v / max;
    ctx.fillStyle = (opts.colors && opts.colors[i]) || COLORS.teal;
    ctx.fillRect(pad.l + i * bw + bw * 0.18, h - pad.b - bh, bw * 0.64, bh);
    ctx.fillStyle = "#6b7780"; ctx.textAlign = "center";
    ctx.fillText(labels[i], pad.l + i * bw + bw / 2, h - pad.b + 16);
    ctx.textAlign = "left";
  });
  if (opts.line) {
    const y = h - pad.b - (h - pad.t - pad.b) * opts.line / max;
    ctx.strokeStyle = COLORS.red; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); ctx.setLineDash([]);
    const lbl = opts.lineLabel || ""; const tw = ctx.measureText(lbl).width;
    ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(pad.l + 4, y - 19, tw + 10, 16);
    ctx.fillStyle = COLORS.red; ctx.fillText(lbl, pad.l + 9, y - 7);
  }
}

function lineChart(canvas, labels, series, opts = {}) {
  const { ctx, w, h } = setupCanvas(canvas);
  const pad = { l: 50, r: 12, t: 26, b: 30 };
  const all = series.flatMap(s => s.values).concat(opts.line ? [opts.line] : []);
  const max = Math.max(...all) * 1.1 || 1;
  const x = i => pad.l + (w - pad.l - pad.r) * i / (labels.length - 1);
  const y = v => h - pad.b - (h - pad.t - pad.b) * v / max;
  ctx.strokeStyle = COLORS.rule; ctx.fillStyle = "#6b7780";
  for (let i = 0; i <= 4; i++) {
    const yy = pad.t + (h - pad.t - pad.b) * i / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
    ctx.fillText(Math.round(max * (1 - i / 4)).toLocaleString("en-IN"), 4, yy + 4);
  }
  const step = Math.ceil(labels.length / 8);
  labels.forEach((l, i) => { if (i % step === 0) ctx.fillText(l, x(i) - 18, h - 10); });
  if (opts.line) {
    ctx.strokeStyle = COLORS.red; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(pad.l, y(opts.line)); ctx.lineTo(w - pad.r, y(opts.line)); ctx.stroke(); ctx.setLineDash([]);
  }
  series.forEach(s => {
    ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 1.6; ctx.beginPath();
    s.values.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)))); ctx.stroke();
  });
  let lx = pad.l;
  series.concat(opts.line ? [{ name: opts.lineLabel, color: COLORS.red }] : []).forEach(s => {
    ctx.fillStyle = s.color; ctx.fillRect(lx, 8, 12, 4); ctx.fillStyle = COLORS.ink; ctx.fillText(s.name, lx + 16, 13);
    lx += ctx.measureText(s.name).width + 40;
  });
}

function routeMap(svg, data, highlight = []) {
  const ns = "http://www.w3.org/2000/svg";
  svg.innerHTML = "";
  svg.setAttribute("viewBox", "0 0 900 470");
  const el = (tag, attrs, text) => { const e = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); if (text) e.textContent = text; svg.appendChild(e); return e; };
  el("rect", { x: 0, y: 0, width: 900, height: 470, fill: "#f3f7f8", rx: 10 });
  data.segments.forEach(s => {
    const a = data.nodes[s.from_id], b = data.nodes[s.to_id];
    const hl = highlight.length === 0 || highlight.includes(s.id);
    const line = el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: LEVEL_COLORS[s.level],
      "stroke-width": hl ? 7 : 3, "stroke-linecap": "round", opacity: hl ? 1 : 0.35,
      "stroke-dasharray": s.mode === "trek" ? "2 9" : "none" });
    const t = document.createElementNS(ns, "title");
    t.textContent = `${s.from} → ${s.to}: ${s.level} (${s.score}/100)\n${s.factors.join("\n")}`; line.appendChild(t);
    if (s.status !== "Open") el("text", { x: (a.x + b.x) / 2 + 6, y: (a.y + b.y) / 2 - 6, fill: COLORS.red, "font-size": 12, "font-weight": 700 }, s.status.toUpperCase());
  });
  Object.entries(data.nodes).forEach(([id, n]) => {
    el("circle", { cx: n.x, cy: n.y, r: 6, fill: "#fff", stroke: COLORS.teal, "stroke-width": 2.5 });
    const right = n.x > 760;
    el("text", { x: right ? n.x - 9 : n.x + 9, y: n.y + 4, "font-size": 12.5, fill: COLORS.ink,
      "text-anchor": right ? "end" : "start" }, n.name);
  });
  let lx = 20;
  ["Green", "Yellow", "Orange", "Red"].forEach(l => {
    el("rect", { x: lx, y: 445, width: 22, height: 6, fill: LEVEL_COLORS[l], rx: 3 });
    el("text", { x: lx + 28, y: 452, "font-size": 12, fill: COLORS.ink }, l); lx += 90;
  });
  el("line", { x1: lx, y1: 448, x2: lx + 24, y2: 448, stroke: COLORS.grey, "stroke-width": 4, "stroke-dasharray": "2 6" });
  el("text", { x: lx + 30, y: 452, "font-size": 12, fill: COLORS.ink }, "Trek (on foot)");
}
