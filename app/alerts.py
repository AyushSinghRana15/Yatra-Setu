"""Trip subscriptions, advisories with human approval, and alert dispatch (FR-15, FR-16, FR-23 to FR-25).

WhatsApp and SMS gateways are simulated by writing to the `outbox` table, so the full flow
(approval -> matching -> channel fallback -> delivery report) can be demonstrated offline.
"""
import hashlib
import json
from datetime import date

from . import db
from .knowledge_base import kb
from .risk import SEGMENTS, TRIPS, safe_halt, network_risk

SALT = "yatrasetu-demo-salt"   # use a secret from the vault in production (NFR-11)


def hash_phone(phone: str) -> str:
    return hashlib.sha256((SALT + phone).encode()).hexdigest()


def mask_phone(phone: str) -> str:
    return phone[:2] + "*" * max(0, len(phone) - 4) + phone[-2:]


def subscribe(phone: str, language: str, shrine: str, start: str, end: str, group_size: int, consent: bool):
    if not consent:
        raise ValueError("Explicit consent is required to store trip details (DPDP Act 2023).")
    if shrine not in TRIPS:
        raise ValueError("Unknown shrine")
    sid = db.execute(
        "INSERT INTO subscriptions(phone_hash, display_phone, language, shrine, segments, start_date, end_date, group_size, consent, created_at)"
        " VALUES (?,?,?,?,?,?,?,?,?,?)",
        (hash_phone(phone), mask_phone(phone), language, shrine, json.dumps(TRIPS[shrine]), start, end, group_size, 1, db.now()))
    return {"id": sid, "segments": TRIPS[shrine]}


def unsubscribe(sub_id: int):
    db.execute("DELETE FROM subscriptions WHERE id=?", (sub_id,))


def _affected(segments: list[str]):
    today = date.today().isoformat()
    subs = db.rows("SELECT * FROM subscriptions WHERE end_date >= ?", (today,))
    return [s for s in subs if set(json.loads(s["segments"])) & set(segments)]


def _send(sub, advisory_id, text):
    """Simulated gateway: numbers whose masked form ends in '0' fail on WhatsApp to demo SMS fallback."""
    ok = not sub["display_phone"].endswith("0")
    db.execute("INSERT INTO outbox(subscription_id, advisory_id, channel, message, status, created_at) VALUES (?,?,?,?,?,?)",
               (sub["id"], advisory_id, "whatsapp", text, "delivered" if ok else "failed", db.now()))
    if not ok:  # FR-16: SMS fallback
        db.execute("INSERT INTO outbox(subscription_id, advisory_id, channel, message, status, created_at) VALUES (?,?,?,?,?,?)",
                   (sub["id"], advisory_id, "sms", text[:300], "delivered", db.now()))
    return ok


def compose(adv, sub):
    seg_id = json.loads(adv["segments"])[0] if adv["segments"] else None
    halt = safe_halt(seg_id) if seg_id else None
    if sub["language"] == "hi" and adv.get("body_hi"):
        msg = f"यात्रासेतु चेतावनी: {adv['body_hi']}"
        if halt:
            msg += f" सुरक्षित पड़ाव: {halt['name']}।"
        msg += " आपात स्थिति में 112 डायल करें।"
    else:
        msg = f"YatraSetu alert: {adv['title']}. {adv['body_en']}"
        if halt:
            msg += f" Safe halt: {halt['name']} ({', '.join(halt['facilities'])})."
        msg += " Emergency: dial 112."
    return msg


def create_advisory(title, body_en, body_hi, category, segments, valid_until, author):
    for s in segments:
        if s not in SEGMENTS:
            raise ValueError(f"Unknown segment {s}")
    aid = db.execute(
        "INSERT INTO advisories(title, body_en, body_hi, category, segments, valid_until, status, author, created_at)"
        " VALUES (?,?,?,?,?,?,?,?,?)",
        (title, body_en, body_hi, category, json.dumps(segments), valid_until, "pending", author, db.now()))
    db.audit(author, "create_advisory", {"id": aid, "title": title})
    return aid


def approve_advisory(aid: int, approver: str):
    adv = db.rows("SELECT * FROM advisories WHERE id=?", (aid,))
    if not adv:
        raise ValueError("Advisory not found")
    adv = adv[0]
    if adv["status"] != "pending":
        raise ValueError("Advisory already processed")
    if adv["author"] == approver:
        raise PermissionError("Four-eyes rule: the author cannot approve their own advisory")
    db.execute("UPDATE advisories SET status='published', approver=?, published_at=? WHERE id=?", (approver, db.now(), aid))
    adv = db.rows("SELECT * FROM advisories WHERE id=?", (aid,))[0]
    kb.add_advisory(adv)                                  # FR-25: knowledge base updated
    sent = failed = 0
    for sub in _affected(json.loads(adv["segments"])):    # FR-25: broadcast to affected subscribers
        if _send(sub, aid, compose(adv, sub)):
            sent += 1
        else:
            failed += 1
    db.audit(approver, "publish_advisory", {"id": aid, "whatsapp_delivered": sent, "sms_fallback": failed})
    return {"id": aid, "recipients": sent + failed, "whatsapp_delivered": sent, "sms_fallback": failed}


def set_road_status(segment_id, status, reason, eta, user):
    if segment_id not in SEGMENTS:
        raise ValueError("Unknown segment")
    db.execute("INSERT INTO road_status(segment_id, status, reason, eta, updated_by, updated_at) VALUES (?,?,?,?,?,?) "
               "ON CONFLICT(segment_id) DO UPDATE SET status=excluded.status, reason=excluded.reason, eta=excluded.eta, "
               "updated_by=excluded.updated_by, updated_at=excluded.updated_at",
               (segment_id, status, reason, eta, user, db.now()))
    db.audit(user, "road_status", {"segment": segment_id, "status": status})
    seg = next(s for s in network_risk() if s["id"] == segment_id)
    notified = 0
    if seg["level"] in ("Orange", "Red"):                 # FR-16: risk change Orange or above
        adv = {"title": f"{seg['from']} - {seg['to']}: {status}", "segments": json.dumps([segment_id]),
               "body_en": f"Road {status.lower()} between {seg['from']} and {seg['to']}" + (f" due to {reason}" if reason else "")
                          + (f". Expected reopening: {eta}" if eta else "") + ".",
               "body_hi": None}
        for sub in _affected([segment_id]):
            _send(sub, None, compose(adv, sub))
            notified += 1
    return {"segment": seg, "notified": notified}


def set_weather(district, level, rain_mm, user="imd-feed"):
    db.execute("INSERT INTO weather_alerts(district, level, rain_mm, updated_at) VALUES (?,?,?,?) "
               "ON CONFLICT(district) DO UPDATE SET level=excluded.level, rain_mm=excluded.rain_mm, updated_at=excluded.updated_at",
               (district, level, rain_mm, db.now()))
    db.audit(user, "weather_alert", {"district": district, "level": level, "rain_mm": rain_mm})
