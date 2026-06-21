# 02 — Bring your own operating point / feed PSD

ChancaDEM is not limited to the 17 baked cases — Contract 1 is the gate that lets it evaluate a NEW operating point.

## 1. Describe the operating point (Contract 1)

A row needs: `machine ∈ {cone-sec, cone-tert, cone-short-head, gyratory, jaw}`, `cssMm`, `throwMm`, `speedRpm`,
`feedX63Mm`, `feedM`, `oreAxb` (and optional `oreWi`). See `data/examples/operating.csv` for passing rows.

```python
from chancalab.io.contract import validate_records, validate_psd
rep = validate_records([{ "case_id": "mine", "machine": "cone-sec", "cssMm": 28, "throwMm": 30,
                          "speedRpm": 360, "feedX63Mm": 95, "feedM": 1.2, "oreAxb": 50 }])
print(rep.summary())   # accepted / rejected (with reason) / flagged
ok, reason = validate_psd([32, 16, 8, 4, 1], [1.0, 0.8, 0.5, 0.3, 0.1])   # a bring-your-own feed PSD
```

`cssMm > 2.5× feedX63Mm` is **rejected** (CSS wider than the feed top); `cssMm ≥ feedX63Mm` is **flagged**
(pass-through); an out-of-machine-envelope value is **flagged** (the surrogate is extrapolating — the deep-AE
anomaly score is the live guard); a bad machine / non-numeric / non-positive is **rejected with a reason**.

## 2. Evaluate it

Live: the browser's TS Whiten engine computes the full result for any accepted operating point (move the sliders);
the surrogate gives the instant what-if and the AE flags if you steer off the trained manifold. Offline: feed the
operating point into the engine (the sweep generator is the worked example). The honesty caveat stands — the engine
is a calibrated model, not a real plant (see `docs/cases/README.md`).
