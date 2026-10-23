"""Offline evaluation of the AI components (used in the project report, Chapter 6).

* Retrieval: top-1 and top-3 accuracy on a bilingual gold set of 40 questions
* Intent classifier: accuracy on the same set (it was NOT trained on these questions)
* Emergency override: recall on emergency phrasings and false-alarm rate on normal questions
* Forecast: MAPE and crowd-band accuracy on the held-out season
Writes docs/evaluation_results.json
"""
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.forecast import forecaster  # noqa: E402
from app.intent import classifier  # noqa: E402
from app.knowledge_base import kb  # noqa: E402

EMERGENCIES = ["My father has chest pain near Linchauli", "we are stuck after a landslide near Sonprayag", "there was an accident on the road",
               "my mother is unconscious", "help me please, I am lost", "SOS we are trapped", "मेरे पिताजी के सीने में दर्द है",
               "हम भूस्खलन के बाद फंस गए हैं", "सड़क दुर्घटना हो गई है", "मदद करो, बचाओ"]


OFF_TOPIC = ["What is the GDP of Brazil in 1990?", "Who won the cricket world cup?", "Recommend a good movie",
             "what is python", "Write a poem about the sea", "What is the capital of France?", "Explain quantum physics",
             "share market tips for today", "भारत का प्रधानमंत्री कौन है?", "मुझे एक फिल्म बताओ"]


def answered(q):
    hits = kb.search(q, k=1)
    from app.config import CONTENT_THRESHOLD, RETRIEVAL_THRESHOLD
    return hits[0][2] >= RETRIEVAL_THRESHOLD and kb.content_overlap(q) >= CONTENT_THRESHOLD


def main():
    gold = json.loads((ROOT / "tests" / "gold_set.json").read_text(encoding="utf-8"))
    top1 = top3 = intent_ok = 0
    by_lang = {"en": [0, 0], "hi": [0, 0]}
    t0 = time.perf_counter()
    for g in gold:
        hits = kb.search(g["q"], k=3)
        ids = [h[0].id for h in hits]
        lang = "hi" if any("ऀ" <= ch <= "ॿ" for ch in g["q"]) else "en"
        ok1 = ids[0] == g["doc"]
        top1 += ok1; top3 += g["doc"] in ids
        by_lang[lang][0] += ok1; by_lang[lang][1] += 1
        intent_ok += classifier.classify(g["q"])[0] == g["intent"]
    ms = (time.perf_counter() - t0) / len(gold) * 1000
    normal_false_alarm = sum(classifier.is_emergency(g["q"]) for g in gold)
    res = {
        "gold_questions": len(gold),
        "retrieval_top1_accuracy": round(100 * top1 / len(gold), 1),
        "retrieval_top3_accuracy": round(100 * top3 / len(gold), 1),
        "retrieval_top1_by_language": {k: round(100 * v[0] / v[1], 1) for k, v in by_lang.items()},
        "intent_accuracy": round(100 * intent_ok / len(gold), 1),
        "emergency_recall": round(100 * sum(classifier.is_emergency(e) for e in EMERGENCIES) / len(EMERGENCIES), 1),
        "emergency_false_alarms_on_gold": normal_false_alarm,
        "in_domain_answer_rate": round(100 * sum(answered(g["q"]) for g in gold) / len(gold), 1),
        "off_topic_rejection_rate": round(100 * sum(not answered(q) for q in OFF_TOPIC) / len(OFF_TOPIC), 1),
        "avg_retrieval_plus_intent_ms": round(ms, 2),
        "forecast": {k: v for k, v in forecaster.metrics.items() if k != "test_frame"},
    }
    (ROOT / "docs").mkdir(exist_ok=True)
    (ROOT / "docs" / "evaluation_results.json").write_text(json.dumps(res, indent=2, ensure_ascii=False))
    print(json.dumps(res, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
