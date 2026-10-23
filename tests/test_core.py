"""Unit and API tests. Run with:  pytest -q"""
import os
import tempfile

os.environ["YATRASETU_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")

from datetime import date, datetime, timedelta  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

from app import alerts, db, llm  # noqa: E402
from app.forecast import band, forecaster  # noqa: E402
from app.health import assess  # noqa: E402
from app.intent import classifier  # noqa: E402
from app.language import detect_language  # noqa: E402
from app.llm import numbers_grounded, redact  # noqa: E402
from app.main import app  # noqa: E402
from app.risk import NIGHT_END, NIGHT_START, SEGMENTS, plan_trip, safe_halt, score_parts, score_segment  # noqa: E402

client = TestClient(app)


# ---------- language & intent ----------
def test_language_detection():
    assert detect_language("Is Kedarnath open?") == "en"
    assert detect_language("केदारनाथ खुला है?") == "hi"
    assert detect_language("કેદારનાથ ખુલ્લું છે?") == "gu"


def test_emergency_override_is_deterministic():
    assert classifier.classify("my father has chest pain")[0] == "emergency"
    assert classifier.classify("हम फंस गए हैं")[0] == "emergency"
    assert classifier.classify("how do I register")[0] != "emergency"


def test_shrine_and_age_extraction():
    assert classifier.shrine("is kedar crowded") == "kedarnath"
    assert classifier.shrine("बद्रीनाथ का रास्ता") == "badrinath"
    assert classifier.age("my father is 68 years old") == 68


# ---------- crowd forecast ----------
def test_crowd_bands():
    assert band(0.4) == "Low" and band(0.7) == "Moderate" and band(0.9) == "High" and band(1.3) == "Over capacity"


def test_forecast_shape_and_accuracy():
    f = forecaster.forecast("kedarnath", date(2027, 5, 20), 7)
    assert len(f["days"]) == 7 and all(d["visitors"] > 0 for d in f["days"])
    assert forecaster.metrics["mape_normal_days"] <= 20          # NFR-13 target


def test_forecast_closed_out_of_season():
    f = forecaster.forecast("kedarnath", date(2027, 1, 10), 3)
    assert all(d["band"] == "Closed" for d in f["days"])


# ---------- route risk ----------
def test_closed_road_is_always_red():
    score, lvl, _ = score_segment(SEGMENTS["guptkashi_sonprayag"], "None", 0, "Closed")
    assert lvl == "Red" and score == 100


def test_risk_increases_with_alert_and_rain():
    seg = SEGMENTS["chamoli_joshimath"]
    calm = score_segment(seg, "None", 0, "Open")[0]
    storm = score_segment(seg, "Red", 140, "Open")[0]
    assert storm > calm and score_segment(seg, "Red", 140, "Open")[1] in ("Orange", "Red")


def test_safe_halt_has_stay_and_medical():
    h = safe_halt("sonprayag_gaurikund")
    assert "stay" in h["facilities"] and ({"medical", "hospital"} & set(h["facilities"]))


def test_score_parts_add_up_and_are_bilingual():
    score, _, en, hi, parts = score_parts(SEGMENTS["chamoli_joshimath"], "Orange", 90, "Restricted")
    assert abs(sum(parts.values()) - score) <= 1 and len(en) == len(hi) == 4
    assert score_segment(SEGMENTS["chamoli_joshimath"], "Orange", 90, "Restricted")[0] == score


def test_plan_halts_overnight_instead_of_night_driving():
    db.init_db()
    p = plan_trip("kedarnath", depart=datetime(2026, 5, 20, 18, 0))
    assert p["halts"] and p["arrive_at"]
    for leg in p["legs"]:
        if leg["mode"] == "road":   # no road leg starts or ends inside the night window
            for t in (leg["depart_at"], leg["arrive_at"]):
                h = datetime.fromisoformat(t).hour
                assert not (h >= NIGHT_START or h < NIGHT_END)


def test_plan_stops_at_safe_halt_before_closed_road():
    db.init_db()
    alerts.set_road_status("barkot_uttarkashi", "Closed", "landslide", "Tomorrow", "test")
    try:
        p = plan_trip("gangotri", depart=datetime(2026, 5, 20, 6, 0))
        assert p["blocked"] and p["arrive_at"] is None
        assert all(leg["id"] != "barkot_uttarkashi" for leg in p["legs"])
        assert p["blocked"]["halt"] == "Barkot" and p["legs"][-1]["to"] == "Barkot"
    finally:
        alerts.set_road_status("barkot_uttarkashi", "Open", None, None, "test")


def test_route_risk_api():
    db.init_db()
    s = client.get("/api/risk/summary").json()
    assert sum(s["by_level"].values()) == s["segments"] == len(SEGMENTS)
    cmp = client.get("/api/risk/compare").json()
    assert len(cmp) == 5 and cmp == sorted(cmp, key=lambda r: (r["closed"], r["max_score"]))
    seg = client.get("/api/risk/segment/rudraprayag_guptkashi").json()
    assert seg["ends"][0]["name"] == "Rudraprayag" and "kedarnath" in seg["trips"]
    assert client.get("/api/risk/segment/nowhere").status_code == 404
    plan = client.get("/api/risk/plan/kedarnath?start=guptkashi&depart=2026-05-20T06:00&vehicle=bus").json()
    assert plan["legs"][0]["from"] == "Guptkashi" and plan["legs"][-1]["to"] == "Kedarnath"
    assert client.get("/api/risk/plan/kedarnath?start=badrinath").status_code == 400
    assert client.get("/api/risk/plan/kedarnath?vehicle=plane").status_code == 422
    assert client.get("/api/risk/plan/kedarnath?depart=tomorrow").status_code == 422
    near = client.get("/api/risk/nearby?lat=30.66&lon=79.03").json()
    assert near["node"]["name"] == "Gaurikund" and near["segments"]
    assert isinstance(client.get("/api/risk/advisories").json(), list)


# ---------- health ----------
def test_health_red_flag_blocks_trek():
    assert assess(45, [], ["chest_pain"], "high", "kedarnath")["category"] == "Do not trek now"


def test_health_senior_with_conditions():
    r = assess(68, ["bp", "heart"], [], "medium", "kedarnath")
    assert r["category"] == "Consult doctor first"
    assert "Sonprayag" in r["screening_points"]


# ---------- guardrail ----------
def test_numeric_guardrail():
    p = ["The trek is about 16 km and takes 6 to 8 hours."]
    assert numbers_grounded("It is about 16 km.", p)
    assert not numbers_grounded("It is about 22 km.", p)


# ---------- LangChain + OpenRouter integration ----------
def test_pii_redaction_before_llm_call():
    assert redact("call 9876543210 or mail me@example.com") == "call [PHONE] or mail [EMAIL]"


def test_generation_degrades_offline_without_key(monkeypatch):
    monkeypatch.setattr(llm, "provider_config", lambda: None)
    assert not llm.enabled()
    assert llm.generate("How long is the trek?", ["The trek is 16 km."]) is None


def test_langchain_chain_accepts_grounded_answer(monkeypatch):
    from langchain_core.runnables import RunnableLambda

    cfg = {"provider": "openrouter", "base_url": "https://openrouter.ai/api/v1", "model": "test/model"}
    monkeypatch.setattr(llm, "provider_config", lambda: cfg)
    monkeypatch.setattr(llm, "_chain_for", lambda _cfg: RunnableLambda(lambda _in: "The trek is 16 km [1]."))
    llm.reset_cache()
    assert llm.generate("How long is the trek?", ["The trek from Gaurikund is 16 km."]) == "The trek is 16 km [1]."


def test_langchain_guardrail_rejects_invented_number(monkeypatch):
    from langchain_core.runnables import RunnableLambda

    cfg = {"provider": "openrouter", "base_url": "https://openrouter.ai/api/v1", "model": "test/model"}
    monkeypatch.setattr(llm, "provider_config", lambda: cfg)
    monkeypatch.setattr(llm, "_chain_for", lambda _cfg: RunnableLambda(lambda _in: "The trek is 22 km [1]."))
    llm.reset_cache()
    assert llm.generate("How long is the trek?", ["The trek from Gaurikund is 16 km."]) is None


def test_langchain_answers_in_selected_language(monkeypatch):
    from langchain_core.runnables import RunnableLambda

    seen = {}
    cfg = {"provider": "openrouter", "base_url": "https://openrouter.ai/api/v1", "model": "test/model"}
    monkeypatch.setattr(llm, "provider_config", lambda: cfg)
    monkeypatch.setattr(llm, "_chain_for", lambda _cfg: RunnableLambda(lambda inp: seen.update(inp) or "ट्रेक 16 किमी है [1]।"))
    llm.reset_cache()
    assert llm.generate("How long is the trek?", ["ट्रेक 16 किमी है।"], "hi") == "ट्रेक 16 किमी है [1]।"
    assert seen["language"].startswith("Hindi")   # English question, Hindi chosen -> Hindi answer


def test_ai_status_endpoint_hides_secrets():
    r = client.get("/api/ai/status").json()
    assert r["framework"].startswith("LangChain")
    assert "api_key" not in r and "api_key" not in str(r)


# ---------- API ----------
def test_chat_answer_is_grounded_with_source():
    r = client.post("/api/chat", json={"text": "How do I register for the yatra?"}).json()
    assert r["grounded"] and r["sources"] and "registration" in r["sources"][0]["title"].lower()


def test_chat_hindi_reply_in_hindi():
    r = client.post("/api/chat", json={"text": "यात्रा का पंजीकरण कैसे करें?"}).json()
    assert r["language"] == "hi" and any("ऀ" <= ch <= "ॿ" for ch in r["answer"])


def test_unknown_question_falls_back():
    r = client.post("/api/chat", json={"text": "What is the GDP of Brazil in 1990?"}).json()
    assert r["mode"] == "fallback" and "112" in r["answer"]


def test_subscription_requires_consent():
    body = {"phone": "9876500000", "shrine": "kedarnath", "start_date": date.today().isoformat(),
            "end_date": (date.today() + timedelta(3)).isoformat(), "consent": False}
    assert client.post("/api/subscribe", json=body).status_code == 400


def test_four_eyes_and_broadcast_with_sms_fallback():
    db.init_db()
    today = date.today().isoformat()
    alerts.subscribe("9876543210", "hi", "kedarnath", today, today, 2, True)   # masked number ends in 0 -> SMS fallback
    alerts.subscribe("9811122233", "en", "kedarnath", today, today, 2, True)
    ed = client.post("/api/admin/login", json={"username": "editor", "password": "editor123"}).json()["token"]
    ap = client.post("/api/admin/login", json={"username": "approver", "password": "approver123"}).json()["token"]
    adv = {"title": "Road closed", "body_en": "Debris near Sonprayag.", "body_hi": "सोनप्रयाग के पास मलबा।",
           "segments": ["guptkashi_sonprayag"], "valid_until": today}
    # approver cannot draft; editor cannot approve
    assert client.post("/api/admin/advisories", json=adv, headers={"X-Token": ap}).status_code == 403
    aid = client.post("/api/admin/advisories", json=adv, headers={"X-Token": ed}).json()["id"]
    assert client.post(f"/api/admin/advisories/{aid}/approve", headers={"X-Token": ed}).status_code == 403
    r = client.post(f"/api/admin/advisories/{aid}/approve", headers={"X-Token": ap}).json()
    assert r["recipients"] == 2 and r["sms_fallback"] == 1
    # the published advisory is now retrievable by the assistant
    ans = client.post("/api/chat", json={"text": "Is there debris near Sonprayag?"}).json()
    assert any("Road closed" in s["title"] for s in ans["sources"])


def test_admin_requires_login():
    assert client.get("/api/admin/analytics").status_code == 401
