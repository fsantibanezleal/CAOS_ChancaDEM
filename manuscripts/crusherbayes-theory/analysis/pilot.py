"""Pilot for the CrusherBayes theory plan: on the ten HP500 surveys, the engine's departure from the plane of the discrepancy
regressors (intercept, setting, feed size) against the plant's. By the ridge proposition of CrusherBayes 0.02 the method can
beat a regression on those regressors only through the engine's departure e at the predicted survey; this measures e and the
plant's departure r (which includes the measurement noise) and their correlation. Writes manuscripts/crusherbayes-theory/data/pilot.json.
Run:  python manuscripts/crusherbayes-theory/analysis/pilot.py"""
import csv
import json
import sys
from pathlib import Path

import numpy as np

root = Path(__file__).resolve().parents[3]
out = {}
rows = list(csv.DictReader(open(root / "data/examples/hp500-surveys.csv", encoding="utf-8")))
css = np.array([float(r["css_mm"]) for r in rows])
f80 = np.array([float(r["f80_mm"]) for r in rows])
y = {"tph": np.array([float(r["feed_tph"]) for r in rows]), "kW": np.array([float(r["power_kw"]) for r in rows])}
loo = json.loads((root / "data/derived/hp500/loo.json").read_text(encoding="utf-8"))
eng = {"tph": np.array([s["backbone"] for s in loo["tph_parity"]["per_survey"]], float)}
pp = loo.get("power_parity", {})
key = next(k for k in pp["per_survey"][0] if k.startswith("engine"))
eng["kW"] = np.array([s[key] for s in pp["per_survey"]], float)
Z = np.column_stack([np.ones(10), (css - css.mean()) / css.std(), (f80 - f80.mean()) / f80.std()])
H = Z @ np.linalg.pinv(Z)


def dep(v):
    r = v - H @ v
    return r


for t in ("tph", "kW"):
    e, r = dep(eng[t]), dep(y[t])
    out[t] = {"plant_departure_sd": round(float(r.std()), 2), "engine_departure_sd": round(float(e.std()), 3),
              "corr": round(float(np.corrcoef(e, r)[0, 1]), 3), "engine_key": "backbone" if t == "tph" else key}
    print(f"{t}: plant range {y[t].min():.0f} to {y[t].max():.0f}; plant departure sd {r.std():.1f}; engine departure sd {e.std():.2f}; "
          f"corr(e, r) {np.corrcoef(e, r)[0, 1]:.2f}; setting range {css.min():.0f} to {css.max():.0f} mm, feed {f80.min():.0f} to {f80.max():.0f} mm")

(root / "manuscripts/crusherbayes-theory/data/pilot.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
