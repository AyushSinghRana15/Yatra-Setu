"""Route-risk scoring and trip planning (SF-3: FR-12 to FR-17).

Each route segment receives a 0-100 risk score combining:
  * the live IMD/USDMA district alert level and forecast rainfall,
  * the official road status entered by district officials,
  * static susceptibility: slope class and number of past landslide events.
The score is transparent (every factor is shown to the user), which matters for safety
advice. Thresholds map the score to Green / Yellow / Orange / Red.

On top of the score, ``plan_trip`` turns a route into a timed itinerary: drive and trek
times per segment, a night-driving window, overnight halts in towns with a stay, and a
stop at the last safe halt before a closed road.
"""
import json
from datetime import date, datetime, timedelta
from math import asin, cos, radians, sin, sqrt

from . import db
from .config import DATA_DIR

ROUTES = json.loads((DATA_DIR / "routes.json").read_text(encoding="utf-8"))
SEGMENTS = {s["id"]: s for s in ROUTES["segments"]}
NODES = ROUTES["nodes"]
TRIPS = ROUTES["trips"]

ALERT_POINTS = {"None": 0, "Yellow": 15, "Orange": 30, "Red": 45}
STATUS_POINTS = {"Open": 0, "Restricted": 20, "Closed": 100}
LEVELS = [(25, "Green"), (45, "Yellow"), (65, "Orange"), (101, "Red")]
LEVEL_HI = {"None": "कोई नहीं", "Green": "हरा", "Yellow": "पीला", "Orange": "नारंगी", "Red": "लाल"}
STATUS_HI = {"Open": "खुली", "Restricted": "प्रतिबंधित", "Closed": "बंद"}

# Trip-planning assumptions (illustrative values for the prototype; tune with local data).
SPEED_KMH = {"road": {1: 35, 2: 30, 3: 24}, "trek": {1: 3.2, 2: 2.8, 3: 2.3}}   # Gaurikund-Kedarnath 16 km ~ 7 h
VEHICLE_FACTOR = {"car": 1.0, "bus": 1.2, "two_wheeler": 0.95}
NIGHT_START, NIGHT_END = 22, 4      # no hill-road driving 22:00-04:00 (yatra practice; verify locally)
TREK_LATEST_START = 14              # do not start a trek after 14:00
TREK_DARK_HOUR = 19                 # warn when a trek would finish after dark
RESUME_HOUR = 5                     # next-morning start after an overnight halt


def level(score: float) -> str:
    for limit, name in LEVELS:
        if score < limit:
            return name
    return "Red"


def haversine_km(lat1, lon1, lat2, lon2):
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 6371 * 2 * asin(sqrt(a))


# ---------- scoring ----------
def score_parts(seg: dict, alert: str = "None", rain_mm: float = 0.0, status: str = "Open"):
    """Return (score, level, factors_en, factors_hi, parts). Pure function; ``parts`` splits the score by factor."""
    en, hi = [], []
    a = ALERT_POINTS.get(alert, 0)
    if a:
        en.append(f"IMD {alert} alert in {seg['district']} (+{a})")
        hi.append(f"{seg['district']} में IMD {LEVEL_HI.get(alert, alert)} अलर्ट (+{a})")
    r = min(rain_mm, 150) / 150 * 20                      # up to +20 for very heavy rain
    if r >= 1:
        en.append(f"Forecast rain {rain_mm:.0f} mm (+{r:.0f})")
        hi.append(f"वर्षा का अनुमान {rain_mm:.0f} मिमी (+{r:.0f})")
    susc = (seg["slope"] - 1) * 5 + min(seg["slide_history"], 10) * 1.5   # up to +25
    # susceptibility only matters when it is raining or an alert is active
    weight = 1.0 if (a or rain_mm >= 20) else 0.4
    t = susc * weight
    en.append(f"Terrain susceptibility (slope class {seg['slope']}, {seg['slide_history']} past slides) (+{t:.0f})")
    hi.append(f"भू-भाग संवेदनशीलता (ढलान श्रेणी {seg['slope']}, {seg['slide_history']} पुराने भूस्खलन) (+{t:.0f})")
    st = STATUS_POINTS.get(status, 0)
    if st:
        en.append(f"Road status: {status} (+{st})")
        hi.append(f"सड़क की स्थिति: {STATUS_HI.get(status, status)} (+{st})")
    s = min(round(a + r + t + st), 100)
    lvl = "Red" if status == "Closed" else level(s)
    parts = {"alert": a, "rain": round(r, 1), "terrain": round(t, 1), "road": st}
    return s, lvl, en, hi, parts


def score_segment(seg: dict, alert: str = "None", rain_mm: float = 0.0, status: str = "Open"):
    """Return (score, level, factors). Pure function, unit-tested."""
    s, lvl, factors, _, _ = score_parts(seg, alert, rain_mm, status)
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
        alert, rain = al.get("level", "None"), al.get("rain_mm", 0) or 0
        score, lvl, factors, factors_hi, parts = score_parts(seg, alert, rain, st.get("status", "Open"))
        out.append({"id": sid, "from": NODES[seg["from"]]["name"], "to": NODES[seg["to"]]["name"],
                    "from_id": seg["from"], "to_id": seg["to"], "km": seg["km"], "mode": seg["mode"],
                    "district": seg["district"], "score": score, "level": lvl, "factors": factors,
                    "factors_hi": factors_hi, "parts": parts, "alert": alert, "rain_mm": rain,
                    "slope": seg["slope"], "slide_history": seg["slide_history"],
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


# ---------- live feed ----------
def active_advisories():
    """Published advisories that are still valid, with readable segment names."""
    today = date.today().isoformat()
    out = []
    for a in db.rows("SELECT * FROM advisories WHERE status='published' AND valid_until >= ? ORDER BY published_at DESC", (today,)):
        segs = [s for s in json.loads(a["segments"]) if s in SEGMENTS]
        out.append({"id": a["id"], "title": a["title"], "body_en": a["body_en"], "body_hi": a["body_hi"],
                    "category": a["category"], "valid_until": a["valid_until"], "published_at": a["published_at"],
                    "segments": [{"id": s, "name": f"{NODES[SEGMENTS[s]['from']]['name']} → {NODES[SEGMENTS[s]['to']]['name']}"}
                                 for s in segs]})
    return out


def risk_summary():
    """Headline numbers for the route page: segments by level, closures, district alerts, advisories."""
    net = network_risk()
    by_level = {lv: sum(1 for s in net if s["level"] == lv) for lv in ("Green", "Yellow", "Orange", "Red")}
    road = [{"id": s["id"], "name": f"{s['from']} → {s['to']}", "status": s["status"], "reason": s["reason"],
             "eta": s["eta"], "level": s["level"]} for s in net if s["status"] != "Open"]
    weather = sorted((r for r in db.rows("SELECT * FROM weather_alerts") if r["level"] != "None"),
                     key=lambda r: -ALERT_POINTS.get(r["level"], 0))
    return {"segments": len(net), "by_level": by_level, "road_status": road, "weather_alerts": weather,
            "advisories": len(active_advisories()), "worst": max(net, key=lambda s: s["score"]),
            "updated_at": db.now()}


def segment_detail(segment_id: str):
    seg = next(s for s in network_risk() if s["id"] == segment_id)
    raw = SEGMENTS[segment_id]
    alerts, status = current_conditions()
    ends = []
    for nid in (raw["from"], raw["to"]):
        n = NODES[nid]
        ends.append({"id": nid, "name": n["name"], "facilities": n["facilities"], "lat": n["lat"], "lon": n["lon"]})
    return {**seg, "weather": alerts.get(raw["district"]), "road": status.get(segment_id), "ends": ends,
            "trips": [t for t, segs in TRIPS.items() if segment_id in segs],
            "advisories": [a for a in active_advisories() if any(s["id"] == segment_id for s in a["segments"])],
            "safe_halt": safe_halt(segment_id) if seg["level"] in ("Orange", "Red") else None}


def nearby(lat: float, lon: float):
    """Nearest point on the network to a location, and the risk of the segments that touch it."""
    nid, n = min(NODES.items(), key=lambda kv: haversine_km(lat, lon, kv[1]["lat"], kv[1]["lon"]))
    touching = [s for s in network_risk() if nid in (s["from_id"], s["to_id"])]
    help_nodes = [(k, v) for k, v in NODES.items() if {"medical", "hospital"} & set(v["facilities"])]
    hid, h = min(help_nodes, key=lambda kv: haversine_km(lat, lon, kv[1]["lat"], kv[1]["lon"]))
    return {"node": {"id": nid, "name": n["name"], "facilities": n["facilities"],
                     "km": round(haversine_km(lat, lon, n["lat"], n["lon"]), 1)},
            "segments": touching, "worst": max(touching, key=lambda s: s["score"]) if touching else None,
            "nearest_help": {"id": hid, "name": h["name"], "facilities": h["facilities"],
                             "km": round(haversine_km(lat, lon, h["lat"], h["lon"]), 1)}}


# ---------- trip planning ----------
def trip_nodes(shrine: str):
    """Ordered node ids along a shrine's route, from the trailhead city to the shrine."""
    segs = TRIPS[shrine]
    return [SEGMENTS[segs[0]]["from"]] + [SEGMENTS[s]["to"] for s in segs]


def segment_hours(seg: dict, vehicle: str = "car") -> float:
    """Planning time for one segment: hill-road or trek speed by slope, slower when restricted or under an alert."""
    hours = seg["km"] / SPEED_KMH[seg["mode"]].get(seg["slope"], SPEED_KMH[seg["mode"]][2])
    if seg["mode"] == "road":
        hours *= VEHICLE_FACTOR.get(vehicle, 1.0)
    if seg.get("status") == "Restricted":
        hours *= 1.3
    if seg.get("alert") in ("Orange", "Red"):
        hours *= 1.2
    return hours


def _in_night(t: datetime) -> bool:
    return t.hour >= NIGHT_START or t.hour < NIGHT_END


def _next_morning(t: datetime) -> datetime:
    day = t.date() if t.hour < NIGHT_END else t.date() + timedelta(days=1)
    return datetime.combine(day, datetime.min.time()).replace(hour=RESUME_HOUR)


def _note(en, hi):
    return {"en": en, "hi": hi}


def plan_trip(shrine: str, start: str | None = None, depart: datetime | None = None, vehicle: str = "car"):
    """Timed itinerary with risk per leg, overnight halts and a stop before any closed road."""
    nodes = trip_nodes(shrine)
    start = start or nodes[0]
    if start not in nodes[:-1]:
        raise ValueError("Start point is not on this route")
    if vehicle not in VEHICLE_FACTOR:
        raise ValueError("Unknown vehicle")
    net = {s["id"]: s for s in network_risk()}
    segs = [net[s] for s in TRIPS[shrine]][nodes.index(start):]
    t = depart or datetime.now().replace(second=0, microsecond=0)
    legs, halts, warnings, blocked = [], [], [], None

    for seg in segs:
        here = NODES[seg["from_id"]]
        if seg["status"] == "Closed":
            halt = safe_halt(seg["id"])
            blocked = {"segment": f"{seg['from']} → {seg['to']}", "reason": seg["reason"], "eta": seg["eta"],
                       "halt": halt["name"], "facilities": halt["facilities"]}
            warnings.append(_note(f"Road closed between {seg['from']} and {seg['to']}. Wait at {halt['name']} until it reopens.",
                                  f"{seg['from']} और {seg['to']} के बीच सड़क बंद है। सड़क खुलने तक {halt['name']} में रुकें।"))
            break
        hours = segment_hours(seg, vehicle)
        must_wait = (seg["mode"] == "road" and (_in_night(t) or _in_night(t + timedelta(hours=hours)))) or \
                    (seg["mode"] == "trek" and (t.hour >= TREK_LATEST_START or _in_night(t)))
        if must_wait:
            resume = _next_morning(t)
            why = (_note(f"Treks should start before {TREK_LATEST_START}:00", f"ट्रेक {TREK_LATEST_START}:00 से पहले शुरू करें")
                   if seg["mode"] == "trek" else
                   _note(f"No hill-road driving {NIGHT_START}:00–0{NIGHT_END}:00", f"{NIGHT_START}:00–0{NIGHT_END}:00 पहाड़ी सड़क पर यात्रा नहीं"))
            halts.append({"at": seg["from_id"], "name": here["name"], "from": t.isoformat(timespec="minutes"),
                          "until": resume.isoformat(timespec="minutes"), "reason": why,
                          "has_stay": "stay" in here["facilities"], "facilities": here["facilities"]})
            if "stay" not in here["facilities"]:
                warnings.append(_note(f"{here['name']} has no listed stay; plan to reach the previous town before dark.",
                                      f"{here['name']} में ठहरने की सुविधा नहीं है; अंधेरे से पहले पिछले शहर पहुँचें।"))
            t = resume
        notes = []
        if seg["level"] in ("Orange", "Red"):
            notes.append(_note("High risk: check the road status before you set off.", "अधिक जोखिम: निकलने से पहले सड़क की स्थिति जाँचें।"))
        if seg["status"] == "Restricted":
            notes.append(_note(f"Restricted: {seg['reason'] or 'expect delays'}.", f"प्रतिबंधित: {seg['reason'] or 'देरी संभव'}।"))
        if seg["mode"] == "trek":
            notes.append(_note("On foot: carry water, rain gear and warm layers.", "पैदल मार्ग: पानी, रेनकोट और गर्म कपड़े साथ रखें।"))
        arrive = t + timedelta(hours=hours)
        if seg["mode"] == "trek" and (arrive.hour >= TREK_DARK_HOUR or arrive.date() > t.date()):
            notes.append(_note("You may finish after dark: start earlier or break the trek at a shelter.",
                               "अंधेरा होने के बाद पहुँच सकते हैं: जल्दी निकलें या बीच में किसी आश्रय पर रुकें।"))
        legs.append({**seg, "depart_at": t.isoformat(timespec="minutes"), "arrive_at": arrive.isoformat(timespec="minutes"),
                     "hours": round(hours, 1), "notes": notes})
        t = arrive

    done = legs[-1]["arrive_at"] if legs else None
    start_t = depart or (datetime.fromisoformat(legs[0]["depart_at"]) if legs else datetime.now())
    worst = max(legs, key=lambda s: s["score"]) if legs else None
    return {"shrine": shrine, "shrine_name": NODES[shrine]["name"], "start": start, "start_name": NODES[start]["name"],
            "vehicle": vehicle, "depart_at": start_t.isoformat(timespec="minutes"), "arrive_at": None if blocked else done,
            "reached": legs[-1]["to"] if legs else NODES[start]["name"],
            "legs": legs, "halts": halts, "blocked": blocked, "warnings": warnings,
            "total_km": sum(s["km"] for s in legs), "drive_hours": round(sum(s["hours"] for s in legs), 1),
            "worst": worst, "start_points": [{"id": n, "name": NODES[n]["name"]} for n in nodes[:-1]],
            "note": _note("Conditions are as of now. Re-check before you leave; IMD alerts and road status change quickly.",
                          "स्थिति अभी की है। निकलने से पहले दोबारा जाँचें; IMD अलर्ट और सड़क की स्थिति जल्दी बदलती है।")}


def compare_routes():
    """All shrine routes side by side, safest first."""
    out = []
    for shrine in TRIPS:
        tr = trip_risk(shrine)
        hours = sum(segment_hours(s) for s in tr["segments"])
        out.append({"shrine": shrine, "name": NODES[shrine]["name"], "level": tr["worst"]["level"],
                    "max_score": tr["worst"]["score"], "avg_score": round(sum(s["score"] for s in tr["segments"]) / len(tr["segments"])),
                    "worst": f"{tr['worst']['from']} → {tr['worst']['to']}", "total_km": tr["total_km"],
                    "hours": round(hours, 1), "closed": any(s["status"] == "Closed" for s in tr["segments"]),
                    "levels": [s["level"] for s in tr["segments"]]})
    return sorted(out, key=lambda r: (r["closed"], r["max_score"]))
