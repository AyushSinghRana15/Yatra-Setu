"""Intent classification and entity extraction.

A small supervised model (TF-IDF character n-grams + logistic regression) trained on
labelled English/Hindi utterances, with a deterministic safety override for emergencies
(FR-04): emergency messages must never depend on a probabilistic model.
"""
import json
import re

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

from .config import DATA_DIR

TRAINING = {
    "crowd": [
        "is kedarnath crowded tomorrow", "how much rush at badrinath this weekend", "best day to visit kedarnath",
        "crowd forecast for gangotri", "will there be heavy rush on sunday", "which day has less crowd",
        "how many pilgrims are expected", "is it a good time to go to yamunotri", "least crowded day next week",
        "केदारनाथ में कल कितनी भीड़ होगी", "बद्रीनाथ में भीड़ कैसी है", "किस दिन कम भीड़ रहेगी",
        "दर्शन के लिए सबसे अच्छा दिन कौन सा है", "गंगोत्री में भीड़ का पूर्वानुमान", "रविवार को कितनी भीड़ होगी",
    ],
    "route": [
        "is the road to kedarnath open", "road status rudraprayag to gaurikund", "is there a landslide on the badrinath highway",
        "can I drive to sonprayag today", "route closed near joshimath", "how far is the trek from gaurikund",
        "how to reach hemkund sahib", "is it safe to travel in rain", "how do I reach yamunotri",
        "केदारनाथ का रास्ता खुला है क्या", "रुद्रप्रयाग से गौरीकुंड सड़क की स्थिति", "बद्रीनाथ हाईवे पर भूस्खलन",
        "क्या आज सोनप्रयाग जा सकते हैं", "गौरीकुंड से केदारनाथ कितनी दूर है", "हेमकुंड साहिब कैसे पहुंचें", "बारिश में यात्रा सुरक्षित है क्या",
    ],
    "health": [
        "my father is 68 can he do the trek", "is health checkup required", "what about altitude sickness",
        "I have blood pressure can I go", "medical screening for senior citizens", "breathing problem at high altitude",
        "where is the nearest medical camp", "how to acclimatise",
        "मेरे पिताजी 68 साल के हैं क्या वे चढ़ाई कर सकते हैं", "स्वास्थ्य जांच जरूरी है क्या", "ऊंचाई पर सांस की तकलीफ",
        "बीपी के मरीज यात्रा कर सकते हैं", "नजदीकी मेडिकल कैंप कहां है", "बुजुर्गों के लिए मेडिकल जांच",
    ],
    "registration": [
        "how to register for char dham yatra", "is registration mandatory", "registration documents needed",
        "where is the offline registration counter", "lost my registration qr code",
        "चारधाम यात्रा का पंजीकरण कैसे करें", "रजिस्ट्रेशन जरूरी है क्या", "पंजीकरण के लिए कौन से दस्तावेज चाहिए",
        "ऑफलाइन रजिस्ट्रेशन कहां होता है",
    ],
    "booking": [
        "how to book helicopter for kedarnath", "helicopter ticket price", "is this helicopter booking site genuine",
        "book pony at gaurikund", "hotel booking in guptkashi",
        "केदारनाथ हेलीकॉप्टर टिकट कैसे बुक करें", "हेलीकॉप्टर बुकिंग असली वेबसाइट", "घोड़ा पालकी बुकिंग",
    ],
    "general": [
        "what should I carry", "what clothes to pack", "when do the temples open", "is plastic allowed",
        "what is the weather like in october", "can I pay by upi",
        "क्या सामान साथ ले जाएं", "कपाट कब खुलते हैं", "अक्टूबर में मौसम कैसा रहता है", "प्लास्टिक ले जा सकते हैं क्या",
    ],
}

EMERGENCY_PATTERNS = [
    r"chest pain", r"heart attack", r"unconscious", r"not breathing", r"can'?t breathe", r"bleeding",
    r"accident", r"stuck|stranded|trapped", r"injur", r"help me", r"\bsos\b", r"emergency", r"lost my (child|son|daughter|mother|father)",
    r"सीने में दर्द", r"बेहोश", r"सांस नहीं", r"दुर्घटना", r"फंस", r"घायल", r"मदद करो", r"बचाओ", r"आपात",
]


class IntentClassifier:
    def __init__(self):
        X, y = [], []
        for label, examples in TRAINING.items():
            X += examples
            y += [label] * len(examples)
        self.model = make_pipeline(
            TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), sublinear_tf=True),
            LogisticRegression(max_iter=2000, C=8.0),
        )
        self.model.fit(X, y)
        shrines = json.loads((DATA_DIR / "shrines.json").read_text(encoding="utf-8"))["shrines"]
        self.shrine_terms = {}
        for s in shrines:
            for term in {s["id"], s["name"].lower(), s["name_hi"], s["name"].split()[0].lower()}:
                self.shrine_terms[term] = s["id"]
        self.shrine_terms.update({"kedar": "kedarnath", "badri": "badrinath", "hemkund": "hemkund",
                                  "केदार": "kedarnath", "बद्री": "badrinath", "बदरीनाथ": "badrinath"})

    def is_emergency(self, text: str) -> bool:
        t = text.lower()
        return any(re.search(p, t) for p in EMERGENCY_PATTERNS)

    def classify(self, text: str):
        if self.is_emergency(text):
            return "emergency", 1.0
        proba = self.model.predict_proba([text.lower()])[0]
        i = proba.argmax()
        return self.model.classes_[i], float(proba[i])

    def shrine(self, text: str):
        t = text.lower()
        for term, sid in sorted(self.shrine_terms.items(), key=lambda kv: -len(kv[0])):
            if term in t:
                return sid
        return None

    def age(self, text: str):
        m = re.search(r"\b([1-9][0-9])\s*(?:years?|yrs?|साल|वर्ष)?\b", text)
        return int(m.group(1)) if m else None


classifier = IntentClassifier()
