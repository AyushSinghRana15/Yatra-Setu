"""Crowd forecasting (SF-2: FR-08 to FR-11).

Model: scikit-learn HistGradientBoostingRegressor (a LightGBM-style histogram gradient
boosting model) on log(1 + visitors), using features that are known in advance for a
7-day horizon: shrine, position in the season, calendar effects, and forecast rainfall
/ alert level. Trained on past seasons; evaluated on the latest held-out season.
"""
import json
from datetime import date, timedelta

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from .config import CROWD_BANDS, DATA_DIR

FEATURES = ["shrine_code", "day_of_season", "days_to_close", "month", "weekday", "is_weekend",
            "is_holiday", "rain_mm", "alert_level"]
FIXED_HOLIDAYS = [(1, 26), (8, 15), (10, 2)]
# Approximate opening / closing dates used for future seasons (configurable by admins)
SEASON_DATES = {2026: (date(2026, 4, 22), date(2026, 11, 11)), 2027: (date(2027, 5, 9), date(2027, 11, 1))}
MONTH_RAIN = {4: 2, 5: 3, 6: 9, 7: 22, 8: 24, 9: 12, 10: 2, 11: 1}


def band(ratio: float) -> str:
    for limit, name in CROWD_BANDS:
        if ratio < limit:
            return name
    return CROWD_BANDS[-1][1]


def mape(y_true, y_pred) -> float:
    y_true, y_pred = np.asarray(y_true, float), np.asarray(y_pred, float)
    return float(np.mean(np.abs(y_true - y_pred) / y_true) * 100)


class CrowdForecaster:
    def __init__(self):
        self.shrines = {s["id"]: s for s in json.loads((DATA_DIR / "shrines.json").read_text(encoding="utf-8"))["shrines"]}
        self.codes = {sid: i for i, sid in enumerate(self.shrines)}
        self.df = pd.read_csv(DATA_DIR / "footfall_history.csv", parse_dates=["date"])
        self.df["shrine_code"] = self.df["shrine"].map(self.codes)
        self.metrics = self._evaluate()
        self.model = self._fit(self.df)

    def _fit(self, df):
        m = HistGradientBoostingRegressor(max_iter=400, learning_rate=0.05, max_leaf_nodes=31,
                                          categorical_features=[0], random_state=7)
        m.fit(df[FEATURES], np.log1p(df["visitors"]))
        return m

    def _evaluate(self):
        """Train on all seasons except the last, test on the last (NFR-13)."""
        test_year = int(self.df["year"].max())
        train, test = self.df[self.df.year < test_year], self.df[self.df.year == test_year]
        m = self._fit(train)
        pred = np.expm1(m.predict(test[FEATURES]))
        normal = (test["disrupted"] == 0) & (test["visitors"] >= 200)
        per_shrine = {}
        for sid in self.shrines:
            mask = normal & (test["shrine"] == sid)
            per_shrine[sid] = round(mape(test.loc[mask, "visitors"], pred[mask.values]), 1)
        # Band accuracy: does the predicted crowd band match the actual band?
        cap = test["shrine"].map(lambda s: self.shrines[s]["capacity"])
        band_ok = [band(p / c) == band(a / c) for p, a, c in zip(pred, test["visitors"], cap)]
        return {
            "test_season": test_year, "train_rows": int(len(train)), "test_rows": int(len(test)),
            "mape_normal_days": round(mape(test.loc[normal, "visitors"], pred[normal.values]), 1),
            "mape_by_shrine": per_shrine,
            "band_accuracy": round(100 * float(np.mean(band_ok)), 1),
            "test_frame": test.assign(predicted=pred.round()),
        }

    def _season(self, sid, d: date):
        opening, closing = SEASON_DATES.get(d.year, (date(d.year, 5, 1), date(d.year, 11, 1)))
        if sid == "hemkund":
            opening, closing = opening + timedelta(21), date(d.year, 10, 10)
        return opening, closing

    def features_for(self, sid, d: date, rain_mm=None, alert_level=0):
        opening, closing = self._season(sid, d)
        summer = date(d.year, 5, 15) <= d <= date(d.year, 6, 30)
        return {
            "shrine_code": self.codes[sid], "day_of_season": (d - opening).days, "days_to_close": (closing - d).days,
            "month": d.month, "weekday": d.weekday(), "is_weekend": int(d.weekday() >= 5),
            "is_holiday": int((d.month, d.day) in FIXED_HOLIDAYS or summer),
            "rain_mm": MONTH_RAIN.get(d.month, 2) if rain_mm is None else rain_mm, "alert_level": alert_level,
        }, opening <= d <= closing

    def forecast(self, sid: str, start: date, days: int = 7, weather=None):
        """weather: optional {date_iso: (rain_mm, alert_level)} from the live IMD feed."""
        weather = weather or {}
        cap = self.shrines[sid]["capacity"]
        out = []
        for i in range(days):
            d = start + timedelta(i)
            rain, lvl = weather.get(d.isoformat(), (None, 0))
            feats, open_ = self.features_for(sid, d, rain, lvl)
            if not open_:
                out.append({"date": d.isoformat(), "open": False, "visitors": 0, "ratio": 0, "band": "Closed"})
                continue
            v = float(np.expm1(self.model.predict(pd.DataFrame([feats])[FEATURES])[0]))
            out.append({"date": d.isoformat(), "open": True, "visitors": int(round(v, -1)),
                        "ratio": round(v / cap, 2), "band": band(v / cap), "alert_level": lvl})
        return {"shrine": sid, "name": self.shrines[sid]["name"], "capacity": cap, "days": out}

    def suggest(self, sid: str, d: date):
        """FR-11: if the day is High/Over capacity, suggest two lighter dates and an alternative shrine."""
        window = self.forecast(sid, d - timedelta(3), 10)["days"]
        target = next((x for x in window if x["date"] == d.isoformat()), None)
        if not target or target["band"] not in ("High", "Over capacity"):
            return {"needed": False, "target": target}
        options = sorted([x for x in window if x["open"] and x["date"] >= date.today().isoformat()
                          and x["date"] != d.isoformat()], key=lambda x: x["ratio"])[:2]
        alt = []
        for other in self.shrines:
            if other == sid:
                continue
            f = self.forecast(other, d, 1)["days"][0]
            if f["open"]:
                alt.append({"shrine": self.shrines[other]["name"], **f})
        alt = sorted(alt, key=lambda x: x["ratio"])[:1]
        return {"needed": True, "target": target, "better_dates": options, "alternative": alt}


forecaster = CrowdForecaster()
