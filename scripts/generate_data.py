"""Generate the SYNTHETIC daily footfall history used to train the prototype forecast model.

Why synthetic? Shrine-wise daily counts are published by the state only as daily press
figures; a machine-readable history needs a data-sharing MoU (see report, Feasibility).
This generator reproduces the documented *shape* of the yatra so the full pipeline can be
built and evaluated now, and swapped for real data later without code changes:

* season totals calibrated to approximate published yatra totals (2025: ~51 lakh)
* opening-day surge (e.g. Kedarnath ~30k on opening day 2025), May-June peak,
  monsoon trough with landslide disruption days, post-monsoon recovery
* weekend / holiday uplift and random variation

Opening/closing dates are approximate. Output: app/data/footfall_history.csv
"""
from datetime import date, timedelta
from pathlib import Path
import json

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "app" / "data"

SEASONS = {  # year: (opening date, closing date, approx. total pilgrims across 5 shrines)
    2022: (date(2022, 5, 6), date(2022, 11, 2), 4_600_000),
    2023: (date(2023, 4, 25), date(2023, 11, 14), 5_600_000),
    2024: (date(2024, 5, 10), date(2024, 11, 3), 4_800_000),
    2025: (date(2025, 5, 2), date(2025, 10, 23), 5_100_000),
}
FIXED_HOLIDAYS = [(1, 26), (8, 15), (10, 2)]


def is_holiday(d: date) -> int:
    summer = date(d.year, 5, 15) <= d <= date(d.year, 6, 30)
    return int((d.month, d.day) in FIXED_HOLIDAYS or summer)


def seasonal_profile(d: date, opening: date) -> float:
    k = (d - opening).days
    surge = 1.0 + 1.1 * np.exp(-k / 6.0)            # opening surge decays over ~2 weeks
    month_factor = {4: 0.9, 5: 1.0, 6: 0.95, 7: 0.35, 8: 0.28, 9: 0.55, 10: 0.65, 11: 0.35}[d.month]
    return surge * month_factor


def rainfall(d: date, rng) -> float:
    mean = {4: 2, 5: 3, 6: 9, 7: 22, 8: 24, 9: 12, 10: 2, 11: 1}[d.month]
    return float(rng.gamma(0.8, mean / 0.8))


def alert_level(rain_mm: float) -> int:
    return 3 if rain_mm >= 115 else 2 if rain_mm >= 65 else 1 if rain_mm >= 35 else 0


def main(seed: int = 42):
    rng = np.random.default_rng(seed)
    shrines = json.loads((DATA / "shrines.json").read_text(encoding="utf-8"))["shrines"]
    records = []
    for year, (opening, closing, total) in SEASONS.items():
        days = [opening + timedelta(i) for i in range((closing - opening).days + 1)]
        raw = {}
        for s in shrines:
            # Hemkund Sahib opens ~3 weeks later and closes ~10 Oct
            s_open = opening + timedelta(21) if s["id"] == "hemkund" else opening
            s_close = date(year, 10, 10) if s["id"] == "hemkund" else closing
            for d in days:
                if not (s_open <= d <= s_close):
                    continue
                rain = rainfall(d, rng)
                lvl = alert_level(rain)
                w = seasonal_profile(d, s_open)
                w *= 1.15 if d.weekday() >= 5 else 1.0
                w *= 1.15 if is_holiday(d) else 1.0
                w *= float(rng.lognormal(0, 0.10))
                disrupted = 0
                if lvl == 3 or (lvl == 2 and rng.random() < 0.35):
                    w *= 0.0 if rng.random() < 0.5 else 0.15    # route closure / yatra halted
                    disrupted = 1
                raw[(s["id"], d)] = (w, rain, lvl, disrupted, s_open, s_close)
        for s in shrines:
            keys = [k for k in raw if k[0] == s["id"]]
            wsum = sum(raw[k][0] for k in keys)
            for k in keys:
                w, rain, lvl, dis, s_open, s_close = raw[k]
                visitors = int(round(total * s["season_share"] * w / wsum))
                d = k[1]
                records.append({
                    "date": d.isoformat(), "year": year, "shrine": s["id"], "visitors": visitors,
                    "day_of_season": (d - s_open).days, "days_to_close": (s_close - d).days,
                    "month": d.month, "weekday": d.weekday(), "is_weekend": int(d.weekday() >= 5),
                    "is_holiday": is_holiday(d), "rain_mm": round(rain, 1), "alert_level": lvl,
                    "disrupted": dis,
                })
    df = pd.DataFrame(records).sort_values(["shrine", "date"])
    out = DATA / "footfall_history.csv"
    df.to_csv(out, index=False)
    summary = df.groupby("year")["visitors"].sum()
    print(f"Wrote {len(df)} rows to {out}")
    print("Season totals:", summary.to_dict())
    print("Max single day:", df.loc[df.visitors.idxmax(), ["date", "shrine", "visitors"]].to_dict())


if __name__ == "__main__":
    main()
