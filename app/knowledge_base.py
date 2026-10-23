"""Bilingual knowledge base and hybrid TF-IDF retriever (the 'R' in RAG).

Each document has an English and a Hindi view. Two TF-IDF vectorisers are combined:
a word-level model (captures exact terms) and a character n-gram model (robust to
spelling variants, inflections and transliteration). A document's score is the best
score over its language views. Published advisories are added to the index at run time.
"""
import json
import re
from dataclasses import dataclass, field
from datetime import date

import numpy as np
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .config import DATA_DIR

# Tokens are runs of non-space, non-punctuation characters, so Devanagari words keep their vowel signs.
TOKEN = r"[^\s.,!?।:;()\"'/\-]+"
HINDI_STOP = {"क्या", "है", "हैं", "के", "की", "का", "में", "से", "को", "और", "कैसे", "कब", "कहां", "कितना", "कितनी",
              "लिए", "पर", "यह", "कि", "हो", "करें", "साथ", "सबसे", "जा", "सकते", "मैं", "हम", "आप", "मेरे", "मेरी"}
STOP = list(ENGLISH_STOP_WORDS | HINDI_STOP)


@dataclass
class Doc:
    id: str
    title: str
    topic: str
    source: str
    updated: str
    text: dict = field(default_factory=dict)      # {"en": "...", "hi": "..."}
    valid_until: str | None = None                 # advisories expire (freshness rule)


def split_sentences(text: str):
    parts = re.split(r"(?<=[.!?।])\s+", text.strip())
    return [p for p in parts if p]


class KnowledgeBase:
    def __init__(self):
        self.docs: list[Doc] = []
        self._load_static()
        self.build()

    def _load_static(self):
        raw = json.loads((DATA_DIR / "knowledge_base.json").read_text(encoding="utf-8"))
        for d in raw["documents"]:
            self.docs.append(Doc(d["id"], d["title"], d["topic"], d["source"], d["updated"],
                                 {"en": d["en"], "hi": d["hi"]}))

    def add_advisory(self, adv: dict):
        """Insert or replace a published advisory so the assistant can answer from it."""
        doc_id = f"adv-{adv['id']}"
        self.docs = [d for d in self.docs if d.id != doc_id]
        text = {"en": f"{adv['title']}. {adv['body_en']}"}
        if adv.get("body_hi"):
            text["hi"] = adv["body_hi"]
        self.docs.append(Doc(doc_id, adv["title"], "advisory", "District Administration (approved advisory)",
                             (adv.get("published_at") or "")[:10], text, adv.get("valid_until")))
        self.build()

    def active_docs(self):
        today = date.today().isoformat()
        return [d for d in self.docs if not d.valid_until or d.valid_until >= today]

    def build(self):
        self.views = []  # (doc_index, lang, text)
        active = self.active_docs()
        self._active = active
        for i, d in enumerate(active):
            for lang, t in d.text.items():
                self.views.append((i, lang, f"{d.title}. {t}"))
        corpus = [v[2] for v in self.views]
        self.word_vec = TfidfVectorizer(analyzer="word", token_pattern=r"(?u)\b\w+\b", sublinear_tf=True)
        # content-word model (stop words removed) used as an out-of-domain gate (FR-04)
        self.gate_vec = TfidfVectorizer(analyzer="word", token_pattern=TOKEN, stop_words=STOP, sublinear_tf=True)
        self.Xg = self.gate_vec.fit_transform(corpus)
        self.char_vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True)
        self.Xw = self.word_vec.fit_transform(corpus)
        self.Xc = self.char_vec.fit_transform(corpus)

    def search(self, query: str, k: int = 3, alpha: float = 0.5):
        """Return [(doc, lang_of_best_view, score)] sorted by score."""
        sw = cosine_similarity(self.word_vec.transform([query]), self.Xw)[0]
        sc = cosine_similarity(self.char_vec.transform([query]), self.Xc)[0]
        s = alpha * sw + (1 - alpha) * sc
        best = {}
        for vi, score in enumerate(s):
            di, lang, _ = self.views[vi]
            if di not in best or score > best[di][1]:
                best[di] = (lang, float(score))
        ranked = sorted(best.items(), key=lambda kv: kv[1][1], reverse=True)[:k]
        return [(self._active[di], lang, score) for di, (lang, score) in ranked]

    def content_overlap(self, query: str) -> float:
        """Max similarity on content words only; ~0 for questions unrelated to the yatra."""
        return float(cosine_similarity(self.gate_vec.transform([query]), self.Xg).max())

    def best_sentences(self, doc: Doc, lang: str, query: str, n: int = 3):
        """Extractive summarisation: keep the n sentences most similar to the query, in original order."""
        text = doc.text.get(lang) or doc.text["en"]
        sents = split_sentences(text)
        if len(sents) <= n:
            return " ".join(sents)
        vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5)).fit(sents + [query])
        sims = cosine_similarity(vec.transform([query]), vec.transform(sents))[0]
        keep = sorted(np.argsort(sims)[::-1][:n])
        return " ".join(sents[i] for i in keep)


kb = KnowledgeBase()
