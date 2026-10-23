"""YatraSetu AI - FastAPI application (API gateway + static web app).

Run:  uvicorn app.main:app --reload    then open http://127.0.0.1:8000
"""
import secrets
from datetime import date
from urllib.parse import quote

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import alerts, db, health
from .assistant import respond
from .config import ADMIN_USERS, BASE_DIR
from .forecast import forecaster
from .risk import NODES, TRIPS, network_risk, trip_risk

db.init_db()
for adv in db.rows("SELECT * FROM advisories WHERE status='published'"):
    from .knowledge_base import kb
    kb.add_advisory(adv)

app = FastAPI(title="YatraSetu AI", version="1.0.0",
              description="AI-powered multilingual safe-travel and crowd advisory assistant for Uttarakhand")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
TOKENS: dict[str, dict] = {}


def haversine_km(lat1, lon1, lat2, lon2):
    from math import asin, cos, radians, sin, sqrt
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 6371 * 2 * asin(sqrt(a))


# ---------- models ----------
class ChatIn(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    language: str | None = None


class SubscribeIn(BaseModel):
    phone: str = Field(pattern=r"^\+?\d{10,13}$")
    language: str = "en"
    shrine: str
    start_date: str
    end_date: str
    group_size: int = Field(1, ge=1, le=60)
    consent: bool


class HealthIn(BaseModel):
    age: int = Field(ge=1, le=110)
    conditions: list[str] = []
    red_flags: list[str] = []
    fitness: str = "medium"
    shrine: str = "kedarnath"


class SosIn(BaseModel):
    lat: float
    lon: float
    name: str = "A pilgrim"
    contacts: list[str] = []


class LoginIn(BaseModel):
    username: str
    password: str


class AdvisoryIn(BaseModel):
    title: str
    body_en: str
    body_hi: str | None = None
    category: str = "road"
    segments: list[str]
    valid_until: str


class RoadIn(BaseModel):
    segment_id: str
    status: str = Field(pattern="^(Open|Restricted|Closed)$")
    reason: str | None = None
    eta: str | None = None


class WeatherIn(BaseModel):
    district: str
    level: str = Field(pattern="^(None|Yellow|Orange|Red)$")
    rain_mm: float = 0


# ---------- auth (FR-23) ----------
def user(x_token: str = Header(default="")):
    if x_token not in TOKENS:
        raise HTTPException(401, "Login required")
    return TOKENS[x_token]


def require(role):
    def dep(u=Depends(user)):
        if u["role"] != role:
            raise HTTPException(403, f"Only {role}s can do this")
        return u
    return dep


# ---------- public endpoints ----------
@app.get("/", include_in_schema=False)
def home():
    return FileResponse(BASE_DIR / "static" / "index.html")


@app.get("/admin", include_in_schema=False)
def admin_page():
    return FileResponse(BASE_DIR / "static" / "admin.html")


@app.post("/api/chat")
def chat(body: ChatIn):
    return respond(body.text.strip(), body.language)


@app.get("/api/shrines")
def shrines():
    return list(forecaster.shrines.values())


@app.get("/api/forecast/{shrine}")
def forecast(shrine: str, start: str | None = None, days: int = 7):
    if shrine not in forecaster.shrines:
        raise HTTPException(404, "Unknown shrine")
    d = date.fromisoformat(start) if start else date.today()
    return forecaster.forecast(shrine, d, min(max(days, 1), 14))


@app.get("/api/forecast/{shrine}/suggest")
def suggest(shrine: str, on: str):
    return forecaster.suggest(shrine, date.fromisoformat(on))


@app.get("/api/model/metrics")
def model_metrics(shrine: str = "kedarnath"):
    m = dict(forecaster.metrics)
    tf = m.pop("test_frame")
    s = tf[tf.shrine == shrine]
    m["backtest"] = {"dates": s["date"].dt.strftime("%Y-%m-%d").tolist(), "actual": s["visitors"].tolist(),
                     "predicted": s["predicted"].astype(int).tolist(), "capacity": forecaster.shrines[shrine]["capacity"]}
    return m


@app.get("/api/risk/network")
def risk_network():
    return {"nodes": NODES, "segments": network_risk()}


@app.get("/api/risk/trip/{shrine}")
def risk_trip(shrine: str):
    if shrine not in TRIPS:
        raise HTTPException(404, "Unknown shrine")
    return trip_risk(shrine)


@app.post("/api/subscribe")
def subscribe(body: SubscribeIn):
    try:
        return alerts.subscribe(body.phone, body.language, body.shrine, body.start_date, body.end_date,
                                body.group_size, body.consent)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.delete("/api/subscribe/{sub_id}")
def unsubscribe(sub_id: int):
    alerts.unsubscribe(sub_id)
    return {"ok": True}


@app.post("/api/health/check")
def health_check(body: HealthIn):
    return health.assess(body.age, body.conditions, body.red_flags, body.fitness, body.shrine)


@app.post("/api/sos")
def sos(body: SosIn):
    maps = f"https://maps.google.com/?q={body.lat:.5f},{body.lon:.5f}"
    msg = f"SOS from {body.name} via YatraSetu. Location: {maps}. Please call me or 112."
    help_nodes = [n for n in NODES.values() if {"medical", "hospital"} & set(n["facilities"])]
    nearest = min(help_nodes, key=lambda n: haversine_km(body.lat, body.lon, n["lat"], n["lon"]))
    dist = haversine_km(body.lat, body.lon, nearest["lat"], nearest["lon"])
    db.audit("public", "sos", {"lat": body.lat, "lon": body.lon})
    return {"message": msg, "dial": "tel:112", "whatsapp_share": f"https://wa.me/?text={quote(msg)}",
            "sms_links": [f"sms:{c}?body={quote(msg)}" for c in body.contacts], "nearest_help": nearest["name"], "nearest_km": round(dist, 1),
            "nearest_facilities": nearest["facilities"]}


# ---------- WhatsApp Business Cloud API webhook (simulated reply) ----------
@app.get("/webhook/whatsapp", response_class=PlainTextResponse)
def wa_verify(request: Request):
    p = request.query_params
    if p.get("hub.mode") == "subscribe" and p.get("hub.verify_token") == "yatrasetu-verify":
        return p.get("hub.challenge", "")
    raise HTTPException(403)


@app.post("/webhook/whatsapp")
async def wa_inbound(request: Request):
    payload = await request.json()
    try:
        msg = payload["entry"][0]["changes"][0]["value"]["messages"][0]
        text = msg["text"]["body"]
    except (KeyError, IndexError):
        return {"status": "ignored"}
    reply = respond(text)
    # In production: POST reply["answer"] to the Graph API /messages endpoint for msg["from"]
    return {"status": "ok", "to": msg.get("from"), "reply": reply["answer"]}


# ---------- officials' dashboard (SF-6) ----------
@app.post("/api/admin/login")
def login(body: LoginIn):
    u = ADMIN_USERS.get(body.username)
    if not u or not secrets.compare_digest(u["password"], body.password):
        raise HTTPException(401, "Invalid credentials")
    tok = secrets.token_urlsafe(24)
    TOKENS[tok] = {"username": body.username, "role": u["role"]}
    db.audit(body.username, "login", "dashboard")
    return {"token": tok, "role": u["role"], "username": body.username}


@app.get("/api/admin/advisories")
def list_advisories(u=Depends(user)):
    return db.rows("SELECT * FROM advisories ORDER BY id DESC")


@app.post("/api/admin/advisories")
def new_advisory(body: AdvisoryIn, u=Depends(require("editor"))):
    try:
        aid = alerts.create_advisory(body.title, body.body_en, body.body_hi, body.category, body.segments,
                                     body.valid_until, u["username"])
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"id": aid, "status": "pending"}


@app.post("/api/admin/advisories/{aid}/approve")
def approve(aid: int, u=Depends(require("approver"))):
    try:
        return alerts.approve_advisory(aid, u["username"])
    except (ValueError, PermissionError) as e:
        raise HTTPException(400, str(e))


@app.post("/api/admin/road-status")
def road_status(body: RoadIn, u=Depends(user)):
    try:
        return alerts.set_road_status(body.segment_id, body.status, body.reason, body.eta, u["username"])
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/admin/weather")
def weather(body: WeatherIn, u=Depends(user)):
    alerts.set_weather(body.district, body.level, body.rain_mm, u["username"])
    return {"ok": True}


@app.get("/api/admin/analytics")
def analytics(u=Depends(user)):
    q = db.rows("SELECT language, intent, grounded FROM query_log")
    by = lambda k: {v: sum(1 for r in q if r[k] == v) for v in sorted({r[k] for r in q})}
    out = db.rows("SELECT channel, status, COUNT(*) n FROM outbox GROUP BY channel, status")
    return {
        "queries": len(q), "grounded_rate": round(100 * sum(r["grounded"] for r in q) / len(q), 1) if q else 0,
        "by_intent": by("intent"), "by_language": by("language"),
        "subscriptions": db.rows("SELECT COUNT(*) n FROM subscriptions")[0]["n"],
        "outbox": out, "pending_advisories": db.rows("SELECT COUNT(*) n FROM advisories WHERE status='pending'")[0]["n"],
    }


@app.get("/api/admin/outbox")
def outbox(u=Depends(user)):
    return db.rows("SELECT o.*, s.display_phone, s.language FROM outbox o LEFT JOIN subscriptions s ON s.id=o.subscription_id "
                   "ORDER BY o.id DESC LIMIT 50")


@app.get("/api/admin/audit")
def audit(u=Depends(user)):
    return db.rows("SELECT * FROM audit_log ORDER BY id DESC LIMIT 50")
