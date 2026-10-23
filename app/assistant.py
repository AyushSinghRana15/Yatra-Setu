"""Conversation orchestrator for the multilingual assistant (SF-1: FR-01 to FR-07).

Pipeline: language detection -> (optional Bhashini translation) -> intent classification
with emergency override -> retrieval over approved knowledge -> live-data enrichment
(crowd forecast / route risk) -> grounded answer (LLM or extractive) -> guardrails -> log.
"""
import json
from datetime import date, datetime

from . import db, llm
from .config import CONTENT_THRESHOLD, RETRIEVAL_THRESHOLD, TOP_K
from .forecast import forecaster
from .intent import classifier
from .knowledge_base import kb
from .language import LANG_NAMES, bhashini, detect_language
from .risk import trip_risk

T = {  # UI strings for live-data and fallback messages
    "en": {
        "emergency": "This sounds like an emergency. Call 112 now (108 for an ambulance). Use the SOS button to share your "
                     "location with your family. If someone has chest pain or breathlessness, stop climbing, keep them warm and "
                     "seated, and get them to the nearest medical relief post.",
        "fallback": "I could not find a verified answer to that. Please check the official Uttarakhand Tourism portal or call "
                    "the official tourist helpline. In an emergency dial 112.",
        "crowd": "Crowd outlook for {name} (next 7 days): {days}. Lightest day: {best}.",
        "crowd_closed": "{name} is closed for the season on these dates.",
        "route_ok": "Route to {name} ({km} km): all segments are currently {lvl} or better. Highest risk: {seg} ({score}/100).",
        "route_bad": "Caution on the route to {name}: {seg} is {lvl} ({score}/100). Suggested safe halt: {halt}.",
        "health_age": "As you are {age}, health screening is mandatory for you. Try the Health check tab for a readiness plan.",
        "other_lang": "(Answering in English; enable Bhashini to reply in {lang}.)",
    },
    "hi": {
        "emergency": "यह आपात स्थिति लगती है। तुरंत 112 पर कॉल करें (एम्बुलेंस के लिए 108)। SOS बटन से अपने परिवार के साथ लोकेशन "
                     "साझा करें। सीने में दर्द या सांस फूलने पर चढ़ाई रोकें, व्यक्ति को गर्म और बैठा कर रखें और नजदीकी चिकित्सा राहत केंद्र ले जाएं।",
        "fallback": "मुझे इसका सत्यापित उत्तर नहीं मिला। कृपया उत्तराखंड पर्यटन का आधिकारिक पोर्टल देखें या आधिकारिक पर्यटक हेल्पलाइन पर कॉल करें। आपात स्थिति में 112 डायल करें।",
        "crowd": "{name} में अगले 7 दिनों का भीड़ अनुमान: {days}। सबसे कम भीड़: {best}।",
        "crowd_closed": "इन तिथियों में {name} के कपाट बंद हैं।",
        "route_ok": "{name} का मार्ग ({km} किमी): सभी हिस्से अभी {lvl} या बेहतर हैं। सबसे अधिक जोखिम: {seg} ({score}/100)।",
        "route_bad": "{name} मार्ग पर सावधानी: {seg} पर जोखिम {lvl} ({score}/100) है। सुझाया गया सुरक्षित पड़ाव: {halt}।",
        "health_age": "आपकी आयु {age} वर्ष है, इसलिए स्वास्थ्य जांच अनिवार्य है। तैयारी योजना के लिए 'स्वास्थ्य जांच' टैब देखें।",
        "other_lang": "",
    },
}
INTENT_TOPICS = {"crowd": {"crowd"}, "route": {"route", "weather", "advisory"}, "health": {"health"}}
BAND_HI = {"Low": "कम", "Moderate": "मध्यम", "High": "अधिक", "Over capacity": "क्षमता से अधिक", "Closed": "बंद"}
LEVEL_HI = {"Green": "हरा", "Yellow": "पीला", "Orange": "नारंगी", "Red": "लाल"}


def _fmt_day(d_iso, lang):
    d = datetime.fromisoformat(d_iso)
    return d.strftime("%a %d %b") if lang == "en" else d.strftime("%d/%m")


def _crowd_line(shrine, lang):
    fc = forecaster.forecast(shrine, date.today(), 7)
    s = forecaster.shrines[shrine]
    name = s["name"] if lang == "en" else s["name_hi"]
    open_days = [d for d in fc["days"] if d["open"]]
    if not open_days:
        return T[lang]["crowd_closed"].format(name=name), fc
    band = (lambda b: b) if lang == "en" else (lambda b: BAND_HI[b])
    days = ", ".join(f"{_fmt_day(d['date'], lang)} {band(d['band'])} (~{d['visitors']:,})" for d in open_days)
    best = min(open_days, key=lambda d: d["ratio"])
    return T[lang]["crowd"].format(name=name, days=days, best=_fmt_day(best["date"], lang)), fc


def _route_line(shrine, lang):
    tr = trip_risk(shrine)
    s = forecaster.shrines[shrine]
    name = s["name"] if lang == "en" else s["name_hi"]
    w = tr["worst"]
    lvl = w["level"] if lang == "en" else LEVEL_HI[w["level"]]
    seg = f"{w['from']} - {w['to']}"
    if tr["advice"]:
        return T[lang]["route_bad"].format(name=name, seg=seg, lvl=lvl, score=w["score"], halt=tr["advice"]["halt"]), tr
    return T[lang]["route_ok"].format(name=name, km=tr["total_km"], lvl=lvl, seg=seg, score=w["score"]), tr


def respond(text: str, lang_override: str | None = None):
    lang = lang_override or detect_language(text)
    work_lang, note = lang, ""
    query = text
    if lang not in ("en", "hi"):
        if bhashini.enabled:
            query = bhashini.translate(text, lang, "en")
            work_lang = "en"
        else:
            work_lang = "en"
            note = T["en"]["other_lang"].format(lang=LANG_NAMES.get(lang, lang))
    intent, conf = classifier.classify(query)
    shrine = classifier.shrine(query)
    result = {"language": lang, "intent": intent, "confidence": round(conf, 2), "shrine": shrine,
              "sources": [], "live": {}, "grounded": False, "mode": "extractive"}

    if intent == "emergency":                      # FR-04: deterministic, never via the LLM
        result.update(answer=T[work_lang]["emergency"], grounded=True, mode="safety-template", sos=True)
        return _finish(result, lang, work_lang, note, 1.0)

    hits = kb.search(query, k=6)
    if shrine:  # shrine-aware re-ranking: prefer passages that mention the shrine the user asked about
        names = {forecaster.shrines[shrine]["name"], forecaster.shrines[shrine]["name_hi"]}
        def boost(d):
            if any(n in d.title for n in names):
                return 1.8
            return 1.1 if any(n in " ".join(d.text.values()) for n in names) else 1.0
        hits = sorted(((d, l, sc * boost(d)) for d, l, sc in hits), key=lambda h: -h[2])
    hits = hits[:TOP_K] if not (intent in INTENT_TOPICS) else hits
    top = hits[0][2] if hits else 0.0
    parts = []
    if intent == "crowd" and shrine:
        line, fc = _crowd_line(shrine, work_lang)
        parts.append(line); result["live"]["forecast"] = fc
    if intent == "route" and shrine:
        line, tr = _route_line(shrine, work_lang)
        parts.append(line); result["live"]["route"] = {"worst": tr["worst"], "advice": tr["advice"]}
    age = classifier.age(query)
    if intent == "health" and age and age >= 50:
        parts.append(T[work_lang]["health_age"].format(age=age))

    in_domain = kb.content_overlap(query) >= CONTENT_THRESHOLD
    if parts:
        # live data already answers the question: only add knowledge that matches the intent's topic
        topics = INTENT_TOPICS.get(intent, set())
        hits = [h for h in hits if h[0].topic in topics]
        top = hits[0][2] if hits else 0.0
    hits = hits[:TOP_K]
    if top >= RETRIEVAL_THRESHOLD and in_domain:
        doc, view_lang, _ = hits[0]
        passages = [h[0].text.get(work_lang) or h[0].text["en"] for h in hits if h[2] >= max(RETRIEVAL_THRESHOLD, 0.7 * top)]
        generated = llm.generate(query, passages)
        if generated:
            parts.append(generated); result["mode"] = "llm-rag"
        else:
            use_lang = work_lang if work_lang in doc.text else "en"
            parts.append(kb.best_sentences(doc, use_lang, query, n=3))
        result["grounded"] = True
        result["sources"] = [{"title": h[0].title, "source": h[0].source, "updated": h[0].updated, "score": round(h[2], 3)}
                             for h in hits if h[2] >= max(RETRIEVAL_THRESHOLD, 0.7 * top)]
    elif parts:
        result["grounded"] = True                 # answer built only from live, official data feeds
        result["sources"] = [{"title": "Live data", "source": "YatraSetu forecast / route-risk services",
                              "updated": date.today().isoformat(), "score": None}]
    else:
        parts.append(T[work_lang]["fallback"]); result["mode"] = "fallback"

    result["answer"] = " ".join(parts)
    return _finish(result, lang, work_lang, note, top)


def _finish(result, lang, work_lang, note, top):
    if lang != work_lang and bhashini.enabled:
        result["answer"] = bhashini.translate(result["answer"], work_lang, lang)
    elif note:
        result["answer"] = f"{note} {result['answer']}"
    db.execute("INSERT INTO query_log(language, intent, grounded, top_score, sources, created_at) VALUES (?,?,?,?,?,?)",
               (lang, result["intent"], int(result["grounded"]), float(top),
                json.dumps([s["title"] for s in result["sources"]], ensure_ascii=False), db.now()))
    return result
