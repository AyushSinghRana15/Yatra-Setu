// One icon set for the whole site. Emoji render differently on every device and never line up with text,
// so every emoji in the page (static HTML, text built by app.js, translated text and toasts) is swapped
// for an inline SVG icon drawn on the same 24px grid. The source text is left untouched: each run of
// text that held an emoji is wrapped in <span class="icz" data-src="original text">, which i18n.js reads.
(() => {
  const c = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
  const p = d => `<path d="${d}"/>`;
  const r = (x, y, w, h, rx) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;
  const ICONS = {
    home: p("M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"),
    chat: p("M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z") + p("M8.5 12h.01M12 12h.01M15.5 12h.01"),
    chart: p("M5 20v-8M11 20V5M17 20V9M3 20h18"),
    trend: p("M3 17l6-6 4 4 8-8M15 7h6v6"),
    road: p("M8 3L4 21M16 3l4 18M12 4v3M12 10.5v3M12 17v3"),
    heart: p("M12 20.5s-8-4.8-8-10.6A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8 2.7c0 5.8-8 10.6-8 10.6z"),
    bell: p("M6 16v-5a6 6 0 0 1 12 0v5l2 2.5H4zM10 21a2 2 0 0 0 4 0"),
    compass: c(12, 12, 9) + p("M15.5 8.5l-2 5-5 2 2-5z"),
    landmark: p("M3 21h18M5 21V10M9.5 21V10M14.5 21V10M19 21V10M2.5 10L12 3.5l9.5 6.5z"),
    mic: r(9, 2.5, 6, 11.5, 3) + p("M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4.5M8.5 21.5h7"),
    siren: p("M6 18v-5a6 6 0 0 1 12 0v5M4 21h16v-3H4zM12 2v2M4.2 5.2l1.4 1.4M19.8 5.2l-1.4 1.4"),
    volume: p("M4 9.5v5h3.5l4.5 4v-13l-4.5 4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"),
    mute: p("M4 9.5v5h3.5l4.5 4v-13l-4.5 4zM16 9.5l5 5M21 9.5l-5 5"),
    pin: p("M12 21.5s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z") + c(12, 10.5, 2.3),
    warn: p("M12 3.5L2.5 20h19zM12 10v4.5M12 17.3v.2"),
    folder: p("M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"),
    ok: c(12, 12, 9) + p("M8 12.3l2.8 2.8 5.4-5.6"),
    temple: p("M12 2v3M8 21v-9l4-7 4 7v9M4 21h16M10.5 21v-4h3v4M6 21v-5h2M18 21v-5h-2"),
    phone: p("M5 3.5h4l1.5 5-2.2 1.6a12 12 0 0 0 5.6 5.6l1.6-2.2 5 1.5v4a1.5 1.5 0 0 1-1.5 1.5A15.5 15.5 0 0 1 3.5 5 1.5 1.5 0 0 1 5 3.5z"),
    clipboard: r(5, 4.5, 14, 17, 2) + p("M9 4.5V3h6v1.5M9 11h6M9 15h6"),
    file: p("M6 2.5h8L18.5 7v13a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V4A1.5 1.5 0 0 1 6 2.5zM14 2.5V7h4.5M8.5 13h7M8.5 17h7"),
    trash: p("M4 6.5h16M9 6.5V4h6v2.5M6.5 6.5l1 14h9l1-14M10 11v6M14 11v6"),
    target: c(12, 12, 9) + c(12, 12, 5) + c(12, 12, 1.2),
    voice: c(9, 8, 3.5) + p("M3 20a6 6 0 0 1 12 0M17.5 8.5a4 4 0 0 1 0 5M20 6a8 8 0 0 1 0 10"),
    users: c(9, 8, 3.5) + p("M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M17.5 14.2a6.5 6.5 0 0 1 4 5.8"),
    hospital: r(4, 4, 16, 16, 2.5) + p("M12 8v8M8 12h8"),
    medical: c(12, 12, 9) + p("M12 8v8M8 12h8"),
    walk: c(13, 4.5, 1.8) + p("M10 21l2-6-2.5-2.5 1-5 4 3 3 1M9.5 9.5L7 12.5M12.5 15l3 2 1 4"),
    car: p("M4 16v-3.5l2-5h12l2 5V16M3 16h18v2.5H3zM6.5 18.5V20M17.5 18.5V20M7.5 13h.01M16.5 13h.01"),
    tools: p("M14.5 6.5a4.5 4.5 0 0 0-5.9 5.9L3 18l3 3 5.6-5.6a4.5 4.5 0 0 0 5.9-5.9l-3 3-3-3z"),
    gauge: p("M4 18a9 9 0 1 1 16 0M12 13l4-5") + c(12, 13, 1),
    camera: p("M4 8h3.5L9 5.5h6L16.5 8H20a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z") + c(12, 13.5, 3.5),
    globe: c(12, 12, 9) + p("M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"),
    bot: r(4.5, 8, 15, 11, 3) + p("M12 8V4.5M12 4.5h.01M9 13v1.5M15 13v1.5M2.5 13v3M21.5 13v3"),
    ban: c(12, 12, 9) + p("M5.7 5.7l12.6 12.6"),
    megaphone: p("M4 10v4h3l8 4.5v-13L7 10zM18 9.5a4 4 0 0 1 0 5M7 14l1 5h2.5"),
    map: p("M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5zM9 4v13.5M15 6.5V20"),
    book: p("M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2zM4 20a2 2 0 0 0 2 1.5h13V18"),
    sparkle: p("M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"),
    signal: p("M4 20v-3M9 20v-7M14 20V9M19 20V4"),
    mountain: p("M2.5 19.5L9 7.5l4 6.5 2.5-3.5 6 9zM7 11.2l2 1.3 1.6-2.3"),
    lock: r(5, 10.5, 14, 10, 2) + p("M8 10.5v-3a4 4 0 0 1 8 0v3"),
    bed: p("M3 18.5V6M3 14.5h18v4M21 14.5V12a3 3 0 0 0-3-3h-7v5.5") + c(7, 11, 1.8),
    fuel: p("M5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h6A1.5 1.5 0 0 1 14 5v15.5M3.5 20.5h12M7.5 7h4v4h-4zM14 10h2.5a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 0 3 0V8.5l-3-3"),
    shield: p("M12 2.8l7.5 2.7v6c0 4.8-3.2 8.3-7.5 9.7-4.3-1.4-7.5-4.9-7.5-9.7v-6z"),
    tent: p("M12 4L2.5 20h19zM12 20v-7l-3 7M12 13l3 7"),
    barrier: p("M3 9h18v6H3zM6 15v5M18 15v5M7 9l-3 6M12.5 9l-3 6M18 9l-3 6"),
    rain: p("M7 15a4.5 4.5 0 0 1 .6-9 5.5 5.5 0 0 1 10.6 1.5 3.8 3.8 0 0 1-.7 7.5zM8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5"),
    flag: p("M5 21.5v-18M5 4.5h12l-2.5 4 2.5 4H5"),
    moon: p("M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"),
    dot: `<circle cx="12" cy="12" r="6" fill="currentColor"/>`,
    user: c(12, 8, 4) + p("M4.5 20.5a7.5 7.5 0 0 1 15 0"),
    mobile: r(7, 2.5, 10, 19, 2.5) + p("M11 18h2"),
    link: p("M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"),
    bolt: p("M13 2.5l-8.5 11H11l-1 8 8.5-11H13z"),
    database: `<ellipse cx="12" cy="5.5" rx="7.5" ry="3"/>` + p("M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"),
    cloud: p("M7 18.5a4.5 4.5 0 0 1 .6-9 5.5 5.5 0 0 1 10.6 1.5 3.8 3.8 0 0 1-.7 7.5z"),
    mail: r(3, 5, 18, 14, 2) + p("M3.5 7l8.5 6.5L20.5 7"),
    radio: c(12, 12, 2) + p("M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 19A10 10 0 0 1 5 5M19 5a10 10 0 0 1 0 14"),
    gear: c(12, 12, 3) + p("M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"),
    box: p("M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5L12 12l8.5-4.5M12 12v9"),
    flask: p("M9.5 3h5M10.5 3v6L5 19a1.5 1.5 0 0 0 1.3 2.2h11.4A1.5 1.5 0 0 0 19 19L13.5 9V3M7.5 15h9"),
    image: r(3, 4.5, 18, 15, 2) + c(8.5, 10, 1.6) + p("M21 16l-5-5-8.5 8.5"),
    text: p("M4 19L10 5l6 14M6.2 14h7.6M17 19l2.5-6 2.5 6M17.9 17h3.2"),
    menu: p("M4 7h16M4 12h16M4 17h16"),
  };
  const EMOJI = {
    "🏠": "home", "💬": "chat", "📊": "chart", "📈": "trend", "🛣": "road", "❤": "heart", "🔔": "bell", "🧭": "compass", "🏛": "landmark",
    "🎙": "mic", "🚨": "siren", "🔊": "volume", "🔇": "mute", "📍": "pin", "⚠": "warn", "📁": "folder", "✅": "ok", "🙏": "temple", "🛕": "temple",
    "📞": "phone", "📋": "clipboard", "🐍": "file", "📄": "file", "🧾": "file", "🗑": "trash", "🎯": "target", "🗣": "voice", "👥": "users",
    "🏥": "hospital", "🩺": "medical", "🚑": "medical", "🥾": "walk", "🚗": "car", "🧰": "tools", "📏": "gauge", "📷": "camera", "🌐": "globe",
    "🤖": "bot", "⛔": "ban", "📢": "megaphone", "🗺": "map", "📚": "book", "🧠": "sparkle", "📶": "signal", "⛰": "mountain", "🏔": "mountain",
    "🔒": "lock", "🛏": "bed", "⛽": "fuel", "👮": "shield", "⛺": "tent", "🚧": "barrier", "🌧": "rain", "🚩": "flag", "🌙": "moon", "🟢": "dot",
    "🧑‍🦳": "user", "📱": "mobile", "🔗": "link", "⚡": "bolt", "🗄": "database", "☁": "cloud", "📨": "mail", "📡": "radio", "⚙": "gear",
    "📦": "box", "🧪": "flask", "🖼": "image",
  };
  const NS = "http://www.w3.org/2000/svg";
  document.body.insertAdjacentHTML("afterbegin", `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${
    Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join("")}</svg>`);

  const alts = Object.keys(EMOJI).sort((a, b) => b.length - a.length).join("|");
  const RE = new RegExp(`(${alts})\\uFE0F?`, "gu"), HAS = new RegExp(`(?:${alts})`, "u");
  const SKIP = "script,style,textarea,svg,select,title,.icz,[contenteditable]";

  function icon(name) {
    const s = document.createElementNS(NS, "svg"), u = document.createElementNS(NS, "use");
    s.setAttribute("class", `ic ic-${name}`); s.setAttribute("aria-hidden", "true");
    u.setAttribute("href", `#i-${name}`); s.append(u); return s;
  }
  // Fill a wrapper with `text`, drawing an icon wherever the text has an emoji.
  function render(span, text) {
    span.dataset.src = text; span.textContent = "";
    let last = 0;
    for (const m of text.matchAll(RE)) {
      if (m.index > last) span.append(text.slice(last, m.index));
      span.append(icon(EMOJI[m[1]])); last = m.index + m[0].length;
    }
    if (last < text.length) span.append(text.slice(last));
  }
  function wrap(node) {
    if (!node.parentElement || node.parentElement.closest(SKIP) || !HAS.test(node.nodeValue)) return;
    const span = document.createElement("span"); span.className = "icz";
    render(span, node.nodeValue); node.replaceWith(span);
  }
  function iconize(root) {
    if (root.nodeType === 3) return wrap(root);
    if (root.nodeType !== 1 || root.closest(SKIP)) return;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), found = [];
    let n; while ((n = walk.nextNode())) if (HAS.test(n.nodeValue)) found.push(n);
    found.forEach(wrap);
  }
  new MutationObserver(ms => ms.forEach(m => m.type === "characterData" ? iconize(m.target) : m.addedNodes.forEach(iconize)))
    .observe(document.body, { childList: true, subtree: true, characterData: true });
  iconize(document.body);
  window.YSIcons = { iconize, render, icon };
})();
