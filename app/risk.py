"""Route-risk scoring (SF-3: FR-12 to FR-17).

Each route segment receives a 0-100 risk score combining:
  * the live IMD/USDMA district alert level and forecast rainfall,
  * the official road status entered by district officials,
  * static susceptibility: slope class and number of past landslide events.
The score is transparent (every factor is shown to the user), which matters for safety
advice. Thresholds map the score to Green / Yellow / Orange / Red.
"""
import json

from . import db
from .config import DATA_DIR

ROUTES = json.loads((DATA_DIR / "routes.json").read_text(encoding="utf-8"))
SEGMENTS = {s["id"]: s for s in ROUTES["segments"]}
NODES = ROUTES["nodes"]
TRIPS = ROUTES["trips"]

ALERT_POINTS = {"None": 0, "Yellow": 15, "Orange": 30, "Red": 45}
STATUS_POINTS = {"Open": 0, "Restricted": 20, "Closed": 100}
LEVELS = [(25, "Green"), (45, "Yellow"), (65, "Orange"), (101, "Red")]


def level(score: float) -> str:
    for limit, name in LEVELS:
        if score < limit:
            return name
    return "Red"


def score_segment(seg: dict, alert: str = "None", rain_mm: float = 0.0, status: str = "Open"):
    """Return (score, level, factors). Pure function, unit-tested."""
    factors = []
    s = 0.0
    a = ALERT_POINTS.get(alert, 0)
    if a:
        factors.append(f"IMD {alert} alert in {seg['district']} (+{a})")
    s += a
    r = min(rain_mm, 150) / 150 * 20                      # up to +20 for very heavy rain
    if r >= 1:
        factors.append(f"Forecast rain {rain_mm:.0f} mm (+{r:.0f})")
    s += r
    susc = (seg["slope"] - 1) * 5 + min(seg["slide_history"], 10) * 1.5   # up to +25
    # susceptibility only matters when it is raining or an alert is active
    weight = 1.0 if (a or rain_mm >= 20) else 0.4
    s += susc * weight
    factors.append(f"Terrain susceptibility (slope class {seg['slope']}, {seg['slide_history']} past slides) (+{susc * weight:.0f})")
    st = STATUS_POINTS.get(status, 0)
    if st:
        factors.append(f"Road status: {status} (+{st})")
    s += st
    s = min(round(s), 100)
    lvl = "Red" if status == "Closed" else level(s)
    return s, lvl, factors


def current_conditions():
    alerts = {r["district"]: r for r in db.rows("SELECT * FROM weather_alerts")}
    status = {r["segment_id"]: r for r in db.rows("SELECT * FROM road_status")}
    return alerts, status


def network_risk():
    alerts, status = current_conditions()
    out = []
    for sid, seg in SEGMENTS.items():
        al = alerts.get(seg["district"], {})
        st = status.get(sid, {})
        score, lvl, factors = score_segment(seg, al.get("level", "None"), al.get("rain_mm", 0) or 0, st.get("status", "Open"))
        out.append({"id": sid, "from": NODES[seg["from"]]["name"], "to": NODES[seg["to"]]["name"],
                    "from_id": seg["from"], "to_id": seg["to"], "km": seg["km"], "mode": seg["mode"],
                    "district": seg["district"], "score": score, "level": lvl, "factors": factors,
                    "status": st.get("status", "Open"), "reason": st.get("reason"), "eta": st.get("eta")})
    return out


def safe_halt(segment_id: str):
    """FR-17: the nearest town with stay + medical facilities on the traveller's side of the blockage."""
    seg = SEGMENTS[segment_id]
    # walk back along any trip that contains this segment
    for trip in TRIPS.values():
        if segment_id in trip:
            idx = trip.index(segment_id)
            for back in reversed(trip[: idx + 1]):
                node = SEGMENTS[back]["from"]
                f = NODES[node]["facilities"]
                if "stay" in f and ("medical" in f or "hospital" in f):
                    return {"node": node, "name": NODES[node]["name"], "facilities": f}
    n = NODES[seg["from"]]
    return {"node": seg["from"], "name": n["name"], "facilities": n["facilities"]}


def trip_risk(shrine: str):
    net = {s["id"]: s for s in network_risk()}
    segs = [net[s] for s in TRIPS[shrine]]
    worst = max(segs, key=lambda s: s["score"])
    advice = None
    if worst["level"] in ("Orange", "Red"):
        halt = safe_halt(worst["id"])
        advice = {"segment": f"{worst['from']} to {worst['to']}", "halt": halt["name"], "facilities": halt["facilities"]}
    return {"shrine": shrine, "segments": segs, "worst": worst, "advice": advice,
            "total_km": sum(s["km"] for s in segs)}
