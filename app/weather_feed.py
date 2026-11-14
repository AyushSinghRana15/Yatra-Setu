"""Live rain forecast for the yatra districts (Open-Meteo: free, no API key).

Only the forecast rainfall is updated. The alert level stays whatever officials entered from the
IMD bulletin, because issuing a colour-coded warning is IMD's call, not ours.
"""
import requests

from . import alerts, db

# district headquarters (latitude, longitude)
DISTRICTS = {"Rudraprayag": (30.28, 78.98), "Chamoli": (30.40, 79.32), "Uttarkashi": (30.73, 78.44),
             "Tehri Garhwal": (30.38, 78.48), "Pauri Garhwal": (30.15, 78.78)}
URL = "https://api.open-meteo.com/v1/forecast"


def refresh(user: str = "open-meteo") -> list[dict]:
    """Fetch tomorrow's rainfall for every district and store it; returns what changed."""
    names = list(DISTRICTS)
    r = requests.get(URL, timeout=10, params={
        "latitude": ",".join(str(DISTRICTS[n][0]) for n in names), "longitude": ",".join(str(DISTRICTS[n][1]) for n in names),
        "daily": "precipitation_sum", "forecast_days": 2, "timezone": "Asia/Kolkata"})
    r.raise_for_status()
    data = r.json()
    data = data if isinstance(data, list) else [data]
    current = {w["district"]: w["level"] for w in db.rows("SELECT district, level FROM weather_alerts")}
    out = []
    for name, place in zip(names, data):
        rain = round(float(place["daily"]["precipitation_sum"][-1] or 0), 1)
        alerts.set_weather(name, current.get(name, "None"), rain, user)
        out.append({"district": name, "rain_mm": rain, "level": current.get(name, "None")})
    return out
