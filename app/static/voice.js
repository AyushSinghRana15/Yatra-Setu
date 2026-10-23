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
    ["crowd", "Crowd forecast", ["crowd", "forecast", "rush", "footfall", "भीड़", "भीड", "अनुमान"]],
    ["route", "Route risk", ["route", "road", "map", "risk", "रास्ता", "रास्ते", "मार्ग", "सड़क", "रूट", "नक्शा"]],
    ["health", "Health check", ["health", "fitness", "medical check", "स्वास्थ्य", "सेहत", "हेल्थ"]],
    ["alerts", "Trip alerts", ["alert", "subscribe", "notification", "अलर्ट", "सूचना"]],
    ["about", "About", ["about", "architecture", "project structure", "diagram", "परिचय", "के बारे में"]],
    ["home", "Home", ["home", "homepage", "main page", "होम", "मुख्य पृष्ठ"]],
    ["assistant", "Assistant", ["assistant", "chat", "सहायक", "चैट"]],
  ];
  // English commands start with the verb ("open crowd"); Hindi puts it last ("भीड़ दिखाओ").
  const NAV = /^(please |can you |could you )?(open|go to|goto|go|show|take me|navigate|switch to|display|launch|check)\b|खोलो|खोलें|खोलिए|दिखाओ|दिखाएं|दिखाइए|जाओ|चलो|ले चलो/;
  const EMERGENCY = /\b(sos|emergency|help me|save me)\b|बचाओ|आपातकाल|आपात|मदद करो|इमरजेंसी/;
  const STOP = /^(stop|quiet|silence|be quiet|stop reading)\b|^रुको|^बंद करो|^चुप/;
  const READ = /^(read|speak|repeat|say that again)\b|पढ़ो|सुनाओ|पढ़कर/;
  const CLEAR = /\bclear (the )?(chat|conversation)\b|चैट साफ|बातचीत साफ/;
  const HELP = /^(help|commands|voice commands|what can (you|i) (do|say))\b|^कमांड/;

  const norm = s => s.toLowerCase().replace(/[.,!?।"'“”]/g, " ").replace(/\s+/g, " ").trim();
  const findShrine = t => Object.keys(SHRINE_WORDS).find(id => SHRINE_WORDS[id].some(w => t.includes(w)));
  const findPage = t => PAGE_WORDS.find(([, , ws]) => ws.some(w => t.includes(w)));

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
  const langCode = () => {
    const v = $("#lang").value;
    if (v) return v === "hi" ? "hi-IN" : "en-IN";
    return (navigator.language || "").startsWith("hi") ? "hi-IN" : "en-IN";
  };
  const setMics = on => MICS.forEach(m => m.classList.toggle("listening", on));
  function openOverlay() {
    const hi = langCode() === "hi-IN";
    $("#vo-title").textContent = hi ? "सुन रहा हूँ…" : "Listening…";
    $("#vo-text").textContent = hi ? "अब बोलिए" : "Speak now";
    $("#vo-hint").textContent = hi ? "उदाहरण: “केदारनाथ में भीड़ कैसी है?” या “रास्ता दिखाओ”"
      : `Listening in English (India). Choose हिन्दी in the language menu to speak Hindi. Try “Open route risk”.`;
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
    rec.lang = langCode(); rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
    rec.onstart = () => { listening = true; setMics(true); openOverlay(); };
    rec.onresult = e => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      $("#vo-text").textContent = (finalText + " " + interim).trim() || "…";
    };
    rec.onerror = e => {
      if (e.error === "aborted") return;
      const msg = ERRORS[e.error] || `Voice input stopped (${e.error}).`;
      showNote("⚠️ " + msg); YS.toast(msg, 5000);
    };
    rec.onend = () => {
      listening = false; setMics(false); closeOverlay();
      const said = finalText.trim();
      if (said) { hideNote(); handle(said); }
    };
    try { rec.start(); } catch (err) { showNote("⚠️ Could not start voice input: " + err.message); }
  }
  $("#vo-cancel").onclick = () => { finalText = ""; rec && rec.abort(); closeOverlay(); };
  overlay.addEventListener("click", e => { if (e.target === overlay) $("#vo-cancel").click(); });
  MICS.forEach(m => m.addEventListener("click", e => { e.preventDefault(); start(); }));

  // ---------- read-aloud ----------
  let voices = [];
  const loadVoices = () => { voices = synth ? synth.getVoices() : []; };
  if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }
  const clean = s => String(s).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/\s+/g, " ").trim();
  function speak(text, lang) {
    if (!synth) { YS.toast("Read-aloud is not supported in this browser"); return; }
    synth.cancel();
    const hi = lang === "hi" || /[ऀ-ॿ]/.test(text);
    const u = new SpeechSynthesisUtterance(clean(text));
    u.lang = hi ? "hi-IN" : "en-IN"; u.rate = 0.97;
    const v = voices.find(x => x.lang === u.lang) || voices.find(x => x.lang.replace("_", "-").startsWith(hi ? "hi" : "en-IN"))
      || (hi ? null : voices.find(x => x.lang.startsWith("en")));
    if (v) u.voice = v;
    else if (hi) YS.toast("No Hindi voice is installed on this device, so a default voice may be used.", 4500);
    synth.speak(u);
  }
  const say = (text, lang) => { try { speak(text, lang); } catch { /* ignore */ } };
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

  window.YSVoice = { speak, stop: stopSpeaking, start, handle, replyToVoice: true, supported: !!(SR && secure) };
})();
