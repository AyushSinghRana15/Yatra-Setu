// Voice commands and read-aloud for the traveller app, built on the browser's Web Speech API.
// SpeechRecognition: Chrome, Edge, Safari (not Firefox). It needs a secure context (localhost/HTTPS)
// and microphone permission. Chrome sends the audio to its cloud speech service, so it needs a network.
(() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  const secure = window.isSecureContext !== false;
  const MICS = ["#nav-mic", "#hero-mic", "#chat-mic", "#fab-mic"].map(s => document.querySelector(s)).filter(Boolean);
  const overlay = $("#voice-overlay");

  // ---------- command grammar (English + Hindi) ----------
  const SHRINE_WORDS = {
    kedarnath: ["kedarnath", "kedar nath", "kedar", "केदारनाथ", "केदार"],
    badrinath: ["badrinath", "badri nath", "badri", "बद्रीनाथ", "बदरीनाथ", "बद्री"],
    gangotri: ["gangotri", "गंगोत्री"],
    yamunotri: ["yamunotri", "यमुनोत्री"],
    hemkund: ["hemkund", "hemkunt", "hem kund", "हेमकुंड"],
  };
  const PAGE_WORDS = [
    ["crowd", "Crowd forecast", ["crowd", "forecast", "rush", "footfall", "भीड़", "भीड", "अनुमान", "bheed", "bhid", "bhir"]],
    ["route", "Route risk", ["route", "road", "map", "risk", "रास्ता", "रास्ते", "मार्ग", "सड़क", "रूट", "नक्शा", "rasta", "raasta", "raste", "sadak", "naksha"]],
    ["health", "Health check", ["health", "fitness", "medical check", "स्वास्थ्य", "सेहत", "हेल्थ", "sehat", "swasthya"]],
    ["alerts", "Trip alerts", ["alert", "subscribe", "notification", "अलर्ट", "सूचना", "suchna"]],
    ["about", "About", ["about", "architecture", "project structure", "diagram", "परिचय", "के बारे में", "parichay"]],
    ["home", "Home", ["home", "homepage", "main page", "होम", "मुख्य पृष्ठ"]],
    ["assistant", "Assistant", ["assistant", "chat", "सहायक", "चैट"]],
  ];
  // English commands start with the verb ("open crowd"); Hindi puts it last ("भीड़ दिखाओ").
  const NAV = /^(please |can you |could you )?(open|go to|goto|go|show|take me|navigate|switch to|display|launch|check)\b|खोलो|खोलें|खोलिए|दिखाओ|दिखाएं|दिखाइए|जाओ|चलो|ले चलो|\b(kholo|kholiye|khol do|dikhao|dikhaao|dikhaiye|dikha do|chalo|le chalo)\b/;
  const EMERGENCY = /\b(sos|emergency|help me|save me)\b|बचाओ|आपातकाल|आपात|मदद करो|इमरजेंसी|\b(bachao|bachaao|madad karo|madad chahiye)\b/;
  const STOP = /^(stop|quiet|silence|be quiet|stop reading)\b|^रुको|^बंद करो|^चुप|^(ruko|ruk jao|band karo|chup)\b/;
  const READ = /^(read|speak|repeat|say that again)\b|पढ़ो|सुनाओ|पढ़कर|\b(padho|padhiye|sunao|sunaiye)\b/;
  const CLEAR = /\bclear (the )?(chat|conversation)\b|चैट साफ|बातचीत साफ/;
  const HELP = /^(help|commands|voice commands|what can (you|i) (do|say))\b|^कमांड/;

  const norm = s => s.toLowerCase().replace(/[.,!?।"'“”]/g, " ").replace(/\s+/g, " ").trim();
  const findShrine = t => Object.keys(SHRINE_WORDS).find(id => SHRINE_WORDS[id].some(w => t.includes(w)));
  const findPage = t => PAGE_WORDS.find(([, , ws]) => ws.some(w => t.includes(w)));

  // Speech services often mishear Himalayan place names ("cedar north", "buddy nath"). Repair the usual
  // slips first, then snap any remaining near-miss (one or two letters off) to the known name.
  const PLACES = ["Kedarnath", "Badrinath", "Gangotri", "Yamunotri", "Hemkund", "Rishikesh", "Haridwar", "Joshimath", "Guptkashi", "Sonprayag",
    "Gaurikund", "Rudraprayag", "Devprayag", "Karnaprayag", "Uttarkashi", "Barkot", "Govindghat", "Chamoli", "Srinagar"];
  const SLIPS = [
    [/\b(cedar|kedar|kidar|ketar|kedhar|kader)\s?(nath|naath|not|north|nat|net|knot)\b/gi, "Kedarnath"],
    [/\b(badri|badree|badhri|bodri|buddy|body|badly)\s?(nath|naath|not|north|nat|knot)\b/gi, "Badrinath"],
    [/\b(gang|ganga|gango|gung)\s?(o\s)?(tree|tri|three|try|thri)\b/gi, "Gangotri"],
    [/\b(yamuna|yamuno|yamun|jamuna|jamno)\s?(o\s)?(tree|tri|three|try)\b/gi, "Yamunotri"],
    [/\b(hem|him|ham|hame|hemp)\s?(kund|kunt|kand|khand|cond|coond|could)\b/gi, "Hemkund"],
    [/\b(rishi|rishy|richie)\s?(kesh|cash|case|kash|cage)\b/gi, "Rishikesh"],
    [/\b(joshi|josh|jyoti)\s?(math|mat|mutt|mart)\b/gi, "Joshimath"],
    [/\bchar\s?(dham|dam|dhaam|damn|them)\b/gi, "Char Dham"],
    [/\b(yathra|jatra|yatara|yatura)\b/gi, "yatra"],
  ];
  function editDistance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function fixWords(text) {
    let s = SLIPS.reduce((acc, [re, to]) => acc.replace(re, to), text);
    return s.replace(/[A-Za-z]{6,}/g, w => {
      const lw = w.toLowerCase();
      const hit = PLACES.find(p => { const lp = p.toLowerCase(); return lp === lw || (Math.abs(lp.length - lw.length) <= 2 && lp[0] === lw[0] && editDistance(lp, lw) <= 2); });
      return hit || w;
    });
  }
  // Among the recogniser's guesses, prefer the one that talks about the yatra rather than the first one.
  const DOMAIN = /kedarnath|badrinath|gangotri|yamunotri|hemkund|yatra|char dham|crowd|road|route|register|helicopter|trek|weather|darshan|केदारनाथ|बद्रीनाथ|गंगोत्री|यमुनोत्री|हेमकुंड|यात्रा|भीड़|रास्ता|सड़क|पंजीकरण|मौसम/gi;
  const HINGLISH = /\b(hai|hain|kitna|kitni|kitne|kya|kaise|kaisa|kab|kahan|mein|nahi|nahin|bheed|rasta|raasta|khula|chahiye|kaun|abhi|aaj|kal)\b/gi;
  function bestGuess(result) {
    let best = "", top = -1;
    for (let k = 0; k < result.length; k++) {
      const text = fixWords(result[k].transcript);
      const score = (text.match(DOMAIN) || []).length * 2 + (result[k].confidence || 0) - k * 0.05;
      if (score > top) { top = score; best = text; }
    }
    return best;
  }

  function handle(raw) {
    const t = norm(raw);
    if (!t) return;
    if (EMERGENCY.test(t)) {
      YS.goto("alerts"); setTimeout(YS.flashSos, 150);
      say(/[ऀ-ॿ]/.test(t) ? "SOS खुल गया है। आपात स्थिति में तुरंत 112 पर कॉल करें।" : "Opening SOS. In an emergency, call 112 now.",
          /[ऀ-ॿ]/.test(t) ? "hi" : "en");
      YS.toast("🚨 SOS opened. Press the SOS button or call 112.");
      return;
    }
    if (STOP.test(t)) { stopSpeaking(); YS.toast("🔇 Stopped"); return; }
    if (READ.test(t)) { const a = YS.lastAnswer; a ? speak(a.answer, a.language) : YS.toast("There is no answer to read yet"); return; }
    if (CLEAR.test(t)) { YS.clearChat(); YS.toast("🗑️ Chat cleared"); return; }
    if (HELP.test(t)) { YS.goto("assistant"); YS.toast("Voice commands are listed next to the chat"); return; }
    const words = t.split(" ").length, page = findPage(t), shrine = findShrine(t);
    if (page && words <= 9 && (NAV.test(t) || words <= 2)) {
      const [id, label] = page;
      if (shrine && ["crowd", "route", "health"].includes(id)) YS.goto(id, { shrine }); else YS.goto(id);
      YS.toast(`🎙️ Opening ${label}${shrine && id !== "home" ? " · " + YS.shrines().find(s => s.id === shrine)?.name : ""}`);
      return;
    }
    YS.askFromAnywhere(raw, { voice: true });     // not a command: treat it as a question
  }

  // ---------- speech recognition ----------
  let rec = null, listening = false, finalText = "";
  // The site language decides the listening language; in Auto, the listener's last choice on the sheet does.
  const langCode = () => {
    const v = $("#lang").value;
    if (v) return v === "hi" ? "hi-IN" : "en-IN";
    return YS.store.get("voicelang", (navigator.language || "").startsWith("hi") ? "hi-IN" : "en-IN");
  };
  const setMics = on => MICS.forEach(m => m.classList.toggle("listening", on));
  function openOverlay() {
    const hi = langCode() === "hi-IN";
    $("#vo-title").textContent = hi ? "सुन रहा हूँ…" : "Listening…";
    $("#vo-text").textContent = hi ? "अब बोलिए" : "Speak now";
    $("#vo-hint").textContent = hi ? "धीरे और साफ़ बोलें। उदाहरण: “केदारनाथ में भीड़ कैसी है?” या “रास्ता दिखाओ”"
      : "Speak slowly and clearly. Try “Is Kedarnath crowded this week?” or “Open route risk”.";
    $("#vo-cancel").textContent = hi ? "रद्द करें" : "Cancel";
    $$(".vo-lang button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.vl === langCode())));
    overlay.hidden = false;
  }
  const closeOverlay = () => { overlay.hidden = true; };

  const ERRORS = {
    "not-allowed": "Microphone permission is blocked. Allow the microphone for this site in your browser settings and try again.",
    "service-not-allowed": "This browser does not allow speech recognition here. Use Chrome, Edge or Safari on localhost or HTTPS.",
    "no-speech": "I didn't hear anything. Tap 🎙️ and try again.",
    "audio-capture": "No microphone was found on this device.",
    "network": "Voice recognition could not reach the browser's speech service. It needs an internet connection, and some embedded or privacy browsers block it. Please type your question instead.",
    "language-not-supported": "This browser cannot recognise the selected language. Try English, or use Chrome.",
  };

  function start() {
    if (!SR || !secure) { explainUnsupported(true); return; }
    if (listening) { rec && rec.stop(); return; }
    stopSpeaking();
    finalText = "";
    rec = new SR();
    rec.lang = langCode(); rec.interimResults = true; rec.maxAlternatives = 5; rec.continuous = false;
    rec.onstart = () => { listening = true; setMics(true); openOverlay(); };
    rec.onresult = e => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += bestGuess(r) + " "; else interim += r[0].transcript;
      }
      $("#vo-text").textContent = (finalText + " " + interim).trim() || "…";
    };
    rec.onerror = e => {
      if (e.error === "aborted") return;
      const msg = ERRORS[e.error] || `Voice input stopped (${e.error}).`;
      showNote("⚠️ " + msg); YS.toast(msg, 5000);
    };
    rec.onend = () => {
      listening = false; setMics(false);
      if (switching) { switching = false; start(); return; }   // the listener picked the other language
      closeOverlay();
      const said = finalText.trim();
      // Hindi spoken while listening in English comes out garbled ("Kedarnath" -> "Bekaar Mach"): listen in Hindi next time.
      if (said && rec.lang === "en-IN" && !$("#lang").value && (said.match(HINGLISH) || []).length >= 2) {
        YS.store.set("voicelang", "hi-IN");
        YS.toast("हिन्दी में बोल रहे हैं? अगली बार मैं हिन्दी में सुनूँगा। Next time I will listen in Hindi.", 6000);
      }
      if (said) { hideNote(); handle(said); }
    };
    try { rec.start(); } catch (err) { showNote("⚠️ Could not start voice input: " + err.message); }
  }
  $("#vo-cancel").onclick = () => { finalText = ""; rec && rec.abort(); closeOverlay(); };
  let switching = false;
  $$(".vo-lang button").forEach(b => b.onclick = () => {
    if (b.dataset.vl === langCode()) return;
    YS.store.set("voicelang", b.dataset.vl);
    if ($("#lang").value) { $("#lang").value = ""; $("#lang").dispatchEvent(new Event("change")); }   // Auto: answers follow the language spoken
    finalText = ""; switching = true;
    if (listening && rec) rec.abort(); else { switching = false; start(); }
  });
  overlay.addEventListener("click", e => { if (e.target === overlay) $("#vo-cancel").click(); });
  MICS.forEach(m => m.addEventListener("click", e => { e.preventDefault(); start(); }));

  // ---------- read-aloud ----------
  let voices = [];
  const loadVoices = () => { voices = synth ? synth.getVoices() : []; };
  if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }
  const clean = s => String(s).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/\s+/g, " ").trim();
  // Answers are written to be read on screen. Turn their shorthand into words a voice can say naturally.
  function forSpeech(text, hi) {
    const date = (m, y, mo, d) => new Date(+y, mo - 1, +d).toLocaleDateString(hi ? "hi-IN" : "en-IN", { day: "numeric", month: "long", year: "numeric" });
    return clean(text)
      .replace(/(\d{4})-(\d{2})-(\d{2})/g, date)
      .replace(/(\d+)\s*\/\s*100\b/g, hi ? "100 में से $1" : "$1 out of 100")
      .replace(/~\s*(?=\d)/g, hi ? "लगभग " : "about ")
      .replace(/किमी/g, "किलोमीटर").replace(/मिमी/g, "मिलीमीटर")
      .replace(/(\d)\s*km\b/gi, hi ? "$1 किलोमीटर" : "$1 kilometres")
      .replace(/(\d)\s*mm\b/g, hi ? "$1 मिलीमीटर" : "$1 millimetres")
      .replace(/(\d)\s*m\b/g, hi ? "$1 मीटर" : "$1 metres")
      .replace(/(\d)\s*h\b/g, hi ? "$1 घंटे" : "$1 hours")
      .replace(/(\d)\s*min\b/g, hi ? "$1 मिनट" : "$1 minutes")
      .replace(/\s*(→|->)\s*/g, hi ? " से " : " to ")
      .replace(/(\p{L})\s+[-–—]\s+(\p{L})/gu, hi ? "$1 से $2" : "$1 to $2")
      .replace(/\s*&\s*/g, hi ? " और " : " and ")
      .replace(/\s*[·•|]\s*/g, ", ").replace(/\s*[()\[\]]\s*/g, ", ")
      .replace(/\s*:\s+/g, ": ").replace(/(\s*,)+/g, ",").replace(/,\s*([.!?।])/g, "$1").replace(/\s+/g, " ").replace(/^,\s*|,\s*$/g, "").trim();
  }
  // One sentence per utterance: natural pauses, and long answers are no longer cut off part-way by the browser.
  function sentences(s) {
    const parts = s.replace(/([.!?।])\s+/g, "$1\u0001").split("\u0001").filter(Boolean), out = [];
    parts.forEach(p => { if (out.length && out[out.length - 1].length < 28) out[out.length - 1] += " " + p; else out.push(p); });
    return out;
  }
  // Prefer the most natural voice the device has, not simply the first one for the language.
  function pickVoice(hi) {
    const grade = v => {
      const l = v.lang.replace("_", "-").toLowerCase(), n = v.name;
      if (!l.startsWith(hi ? "hi" : "en")) return -1;
      let s = l === (hi ? "hi-in" : "en-in") ? 15 : l === "en-gb" ? 10 : l === "en-us" ? 8 : 4;
      if (/natural|neural/i.test(n)) s += 40; else if (/online|google/i.test(n)) s += 25; else if (/premium|enhanced|siri/i.test(n)) s += 20;
      if (/compact|espeak|eloquence/i.test(n)) s -= 10;
      return s;
    };
    return voices.map(v => [grade(v), v]).filter(([g]) => g >= 0).sort((a, b) => b[0] - a[0])[0]?.[1] || null;
  }
  const voicesReady = () => voices.length || !synth ? Promise.resolve() : new Promise(res => {
    const done = () => { loadVoices(); res(); };
    synth.addEventListener("voiceschanged", done, { once: true }); setTimeout(done, 700);
  });
  async function speak(text, lang) {
    if (!synth) { YS.toast("Read-aloud is not supported in this browser"); return; }
    synth.cancel();
    await voicesReady();
    const hi = lang === "hi" || /[ऀ-ॿ]/.test(text);
    const v = pickVoice(hi);
    if (!v && hi) YS.toast("No Hindi voice is installed on this device, so a default voice may be used.", 4500);
    sentences(forSpeech(text, hi)).forEach(part => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = v ? v.lang.replace("_", "-") : hi ? "hi-IN" : "en-IN";
      if (v) u.voice = v;
      u.rate = hi ? 0.9 : 0.94; u.pitch = 1;
      synth.speak(u);
    });
  }
  const say = (text, lang) => { speak(text, lang).catch(() => { /* ignore */ }); };
  function stopSpeaking() { if (synth) synth.cancel(); }

  // ---------- support notes ----------
  const note = $("#voice-note");
  function showNote(html) { note.innerHTML = html; note.hidden = false; }
  function hideNote() { note.hidden = true; }
  function explainUnsupported(fromClick) {
    const why = !SR ? "This browser has no speech recognition (Web Speech API). Firefox and some embedded browsers do not support it."
      : "Voice input needs a secure page. Open the app on http://127.0.0.1:8000 (localhost) or over HTTPS.";
    const msg = `⚠️ <b>Voice commands are not available here.</b> ${why} Use Chrome, Edge or Safari. You can still type${synth ? ", and 🔊 Listen reads answers aloud" : ""}.`;
    showNote(msg);
    if (fromClick) { YS.toast("Voice input is not supported in this browser", 4000); if (YS.page !== "assistant") YS.goto("assistant"); }
  }
  const support = $("#voice-support");
  function renderSupport() {
    const hi = I18N.lang === "hi";
    if (SR && secure) {
      support.innerHTML = hi
        ? `✅ <b>आवाज़ इनपुट उपलब्ध है।</b> हिन्दी चुनी गई है, इसलिए हिन्दी (hi-IN) में बोलें। बोले गए प्रश्नों के उत्तर पढ़कर सुनाए जाते हैं।
          <br><span class="muted">नोट: आपकी आवाज़ ब्राउज़र की स्पीच सेवा पर प्रोसेस होती है, इसलिए इंटरनेट चाहिए। अन्य भारतीय भाषाएँ अभी उपलब्ध नहीं हैं (भाषिणी से जोड़ने की योजना)।</span>`
        : `✅ <b>Voice input is available.</b> Speak English (en-IN), or pick <b>हिन्दी</b> in the language menu for Hindi.
          Spoken questions are answered aloud. <br><span class="muted">Note: your browser's speech service processes the audio, so voice input needs a network.
          Other Indian languages are not supported yet (planned through Bhashini).</span>`;
    } else {
      support.innerHTML = hi
        ? `⚠️ <b>इस ब्राउज़र में आवाज़ इनपुट उपलब्ध नहीं है।</b> ${!SR ? "Chrome, Edge या Safari इस्तेमाल करें।" : "ऐप को localhost या HTTPS पर खोलें।"}
          ${synth ? "पढ़कर सुनाना (🔊 सुनें) फिर भी काम करता है।" : "पढ़कर सुनाना भी उपलब्ध नहीं है।"}`
        : `⚠️ <b>Voice input is not supported in this browser.</b> ${!SR ? "Use Chrome, Edge or Safari." : "Open the app on localhost or HTTPS."}
          ${synth ? "Read-aloud (🔊 Listen) still works." : "Read-aloud is also unavailable."}`;
    }
  }
  renderSupport();
  document.addEventListener("ys:lang", renderSupport);
  if (!(SR && secure)) MICS.forEach(m => { m.classList.add("unsupported"); m.title = "Voice input is not supported in this browser"; });

  window.YSVoice = { speak, stop: stopSpeaking, start, handle, replyToVoice: true, supported: !!(SR && secure),
    forSpeech, sentences, fixWords, pickVoice };
})();
