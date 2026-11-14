"""Language detection and the Bhashini adapter.

Offline mode supports English and Hindi end to end (the knowledge base is bilingual).
When Bhashini credentials are configured, other Indian languages are translated to
English for retrieval and the answer is translated back (FR-01, FR-02, NFR-07).
"""
from .config import BHASHINI_API_KEY, BHASHINI_USER_ID

# Unicode block ranges for scripts used by Indian languages
SCRIPTS = [
    ("hi", 0x0900, 0x097F),  # Devanagari (Hindi, Marathi, Nepali...)
    ("bn", 0x0980, 0x09FF),  # Bengali
    ("pa", 0x0A00, 0x0A7F),  # Gurmukhi
    ("gu", 0x0A80, 0x0AFF),  # Gujarati
    ("or", 0x0B00, 0x0B7F),  # Odia
    ("ta", 0x0B80, 0x0BFF),  # Tamil
    ("te", 0x0C00, 0x0C7F),  # Telugu
    ("kn", 0x0C80, 0x0CFF),  # Kannada
    ("ml", 0x0D00, 0x0D7F),  # Malayalam
]

LANG_NAMES = {"en": "English", "hi": "Hindi", "bn": "Bengali", "pa": "Punjabi", "gu": "Gujarati",
              "or": "Odia", "ta": "Tamil", "te": "Telugu", "kn": "Kannada", "ml": "Malayalam"}


def detect_language(text: str) -> str:
    """Detect language from the dominant Unicode script; Latin script defaults to English."""
    counts = {}
    for ch in text:
        cp = ord(ch)
        for code, lo, hi in SCRIPTS:
            if lo <= cp <= hi:
                counts[code] = counts.get(code, 0) + 1
                break
    if not counts:
        return "en"
    return max(counts, key=counts.get)


# Hindi typed or dictated in Latin letters ("Kedarnath ka rasta khula hai kya"). Speech recognition set to
# English produces exactly this, so the assistant must understand it rather than fall back.
HINGLISH = {
    "bheed": "भीड़", "bhid": "भीड़", "bhir": "भीड़", "kitni": "कितनी", "kitna": "कितनी", "kitne": "कितनी", "hai": "है", "hain": "है",
    "kya": "क्या", "kaise": "कैसे", "kaisa": "कैसा", "kaisi": "कैसी", "kab": "कब", "kahan": "कहां", "kaha": "कहां", "mein": "में",
    "ka": "का", "ki": "की", "ke": "के", "ko": "को", "se": "से", "rasta": "रास्ता", "raasta": "रास्ता", "raste": "रास्ता", "sadak": "सड़क",
    "marg": "मार्ग", "khula": "खुला", "khuli": "खुला", "khule": "खुला", "band": "बंद", "kal": "कल", "aaj": "आज", "abhi": "अभी",
    "panjikaran": "पंजीकरण", "registration": "रजिस्ट्रेशन", "zaroori": "जरूरी", "jaruri": "जरूरी", "zaruri": "जरूरी",
    "helicopter": "हेलीकॉप्टर", "ticket": "टिकट", "book": "बुक", "booking": "बुकिंग", "karein": "करें", "kare": "करें", "karna": "करें",
    "karu": "करें", "mausam": "मौसम", "barish": "बारिश", "baarish": "बारिश", "saman": "सामान", "samaan": "सामान", "kapde": "कपड़े",
    "kapat": "कपाट", "khulte": "खुलते", "swasthya": "स्वास्थ्य", "sehat": "स्वास्थ्य", "jaanch": "जांच", "janch": "जांच",
    "doctor": "डॉक्टर", "medical": "मेडिकल", "camp": "कैंप", "pitaji": "पिताजी", "pita": "पिताजी", "mataji": "माताजी", "saal": "साल",
    "chadhai": "चढ़ाई", "yatra": "यात्रा", "darshan": "दर्शन", "din": "दिन", "kam": "कम", "zyada": "ज्यादा", "jyada": "ज्यादा",
    "door": "दूर", "dur": "दूर", "ghoda": "घोड़ा", "palki": "पालकी", "hotel": "होटल", "dikhao": "दिखाओ", "batao": "बताओ",
    "bataiye": "बताओ", "chahiye": "चाहिए", "dastavez": "दस्तावेज़", "kaun": "कौन", "kaunsa": "कौन सा", "sabse": "सबसे",
    "accha": "अच्छा", "achha": "अच्छा", "bhuskhalan": "भूस्खलन", "jana": "जाना", "sakte": "सकते", "sakta": "सकते",
    "nazdeeki": "नजदीकी", "bujurg": "बुजुर्ग", "saath": "साथ", "hoga": "होगा", "hogi": "होगी", "rahegi": "रहेगी", "nahi": "नहीं",
    "nahin": "नहीं", "bp": "बीपी", "unchai": "ऊंचाई", "padav": "पड़ाव", "ruk": "रुक", "surakshit": "सुरक्षित",
}
_MARKERS = {"hai", "hain", "kya", "kaise", "kaisa", "kaisi", "kitni", "kitna", "kitne", "kab", "kahan", "kaha", "mein", "ka", "ki", "ke",
            "ko", "se", "nahi", "nahin", "aaj", "kal", "abhi", "batao", "bataiye", "dikhao", "chahiye", "hoga", "hogi", "kaun", "sabse"}


def romanized_hindi(text: str) -> str | None:
    """If `text` is Hindi in Latin letters, return its key words in Devanagari (to add to the query); else None."""
    words = [w for w in "".join(c.lower() if c.isalnum() else " " for c in text).split() if w.isascii()]
    known = [w for w in words if w in HINGLISH]
    markers = sum(w in _MARKERS for w in words)
    if markers >= 2 or (markers >= 1 and len(known) >= 2) or (len(known) >= 2 and len(known) >= len(words) / 2):
        return " ".join(HINGLISH[w] for w in known)
    return None


class BhashiniClient:
    """Thin client for the Bhashini (ULCA / Dhruva) inference pipeline.

    Only used when BHASHINI_API_KEY and BHASHINI_USER_ID are set. The prototype does not
    call it in offline tests; see README for how to obtain credentials.
    """
    CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
    PIPELINE_ID = "64392f96daac500b55c543cd"  # public MeitY pipeline id (verify in Bhashini docs)

    def __init__(self):
        self.enabled = bool(BHASHINI_API_KEY and BHASHINI_USER_ID)
        self._cache = {}

    def _pipeline(self, task, src, tgt=None):
        import requests
        lang = {"sourceLanguage": src}
        if tgt:
            lang["targetLanguage"] = tgt
        body = {"pipelineTasks": [{"taskType": task, "config": {"language": lang}}],
                "pipelineRequestConfig": {"pipelineId": self.PIPELINE_ID}}
        r = requests.post(self.CONFIG_URL, json=body, timeout=15,
                          headers={"userID": BHASHINI_USER_ID, "ulcaApiKey": BHASHINI_API_KEY})
        r.raise_for_status()
        cfg = r.json()
        ep = cfg["pipelineInferenceAPIEndPoint"]
        service_id = cfg["pipelineResponseConfig"][0]["config"][0]["serviceId"]
        return ep["callbackUrl"], ep["inferenceApiKey"]["value"], service_id

    def translate(self, text: str, src: str, tgt: str) -> str:
        if not self.enabled or src == tgt:
            return text
        key = (text, src, tgt)
        if key in self._cache:
            return self._cache[key]
        import requests
        url, auth, sid = self._pipeline("translation", src, tgt)
        body = {"pipelineTasks": [{"taskType": "translation", "config": {
            "language": {"sourceLanguage": src, "targetLanguage": tgt}, "serviceId": sid}}],
            "inputData": {"input": [{"source": text}]}}
        r = requests.post(url, json=body, timeout=20, headers={"Authorization": auth})
        r.raise_for_status()
        out = r.json()["pipelineResponse"][0]["output"][0]["target"]
        self._cache[key] = out
        return out


bhashini = BhashiniClient()
