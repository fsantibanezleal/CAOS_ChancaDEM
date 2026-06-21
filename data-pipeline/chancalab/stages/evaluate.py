"""Stage 5 — evaluate (the TEST stage, heavy lane): held-out per-output R2 + MAPE in ORIGINAL units, the P80
monotone-vs-CSS gate, and the frozen inference contract (scalers + AE threshold). Held-out = an independent 2nd
LHS draw (seed 67890), NOT a row-split. Requires numpy (+ torch only for the monotone probe)."""
from __future__ import annotations

import numpy as np


def run(train_out: dict, te_rows: list[dict], pred: np.ndarray) -> tuple[dict, dict]:
    import torch

    from .feature_extraction import AE_FEATS, CONT, MACHINES, NM, OUTS, enc_out

    Yte = enc_out(te_rows)
    # inverse-transform the held-out truths for the log outputs (pred is already in original units from infer)
    log = [k in {"p80", "p50", "p20"} for k in OUTS]
    truth = Yte.copy()
    for j, is_log in enumerate(log):
        if is_log:
            truth[:, j] = np.power(10.0, truth[:, j])

    metrics_per = {}
    for j, name in enumerate(OUTS):
        p, t = pred[:, j], truth[:, j]
        ss_res = float(np.sum((p - t) ** 2))
        ss_tot = float(np.sum((t - t.mean()) ** 2))
        r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
        nz = np.abs(t) > 1e-6
        mape = float(np.mean(np.abs((p[nz] - t[nz]) / t[nz])) * 100) if nz.any() else 0.0
        metrics_per[name] = {"r2": round(r2, 4), "mape_pct": round(mape, 3)}

    # monotonicity probe: P80 must rise with CSS (manifest CI gate)
    sur = train_out["surrogate"]
    xmu, xsd, ymu, ysd = train_out["xmu"], train_out["xsd"], train_out["ymu"], train_out["ysd"]
    base = {"machine": "cone-sec", "cssMm": 16, "throwMm": 30, "speedRpm": 360, "feedX63Mm": 90, "feedM": 1.2, "oreAxb": 55}

    def p80_at(css):
        x = np.zeros((1, NM + len(CONT)), np.float32)
        x[0, MACHINES.index(base["machine"])] = 1.0
        op = {**base, "cssMm": css}
        for j, k in enumerate(CONT):
            x[0, NM + j] = op[k]
        x[:, NM:] = (x[:, NM:] - xmu) / xsd
        with torch.no_grad():
            z = sur(torch.tensor(x)).numpy()[0]
        return float(10 ** (z * ysd + ymu)[0])

    p80s = [p80_at(c) for c in (12, 20, 32, 50, 80)]
    mono = all(p80s[i] >= p80s[i - 1] - 1e-3 for i in range(1, len(p80s)))

    metrics = {"nTrain": train_out.get("nTrain", 0), "nTest": len(te_rows), "perOutput": metrics_per,
               "p80MonotoneVsCss": mono,
               "note": "Surrogate emulates the calibrated cheap physics engine, NOT a real plant. Held-out = an "
                       "independent 2nd LHS draw (seed 67890), not a row-split."}
    scalers = {
        "scaler": {"inputOrder": [*(f"machine_{m}" for m in MACHINES), *CONT], "inMean": xmu.tolist(),
                   "inStd": xsd.tolist(), "outputOrder": OUTS, "outLog": log,
                   "outMean": ymu.tolist(), "outStd": ysd.tolist()},
        "ae_scaler": {"featOrder": AE_FEATS, "mean": train_out["amu"].tolist(), "std": train_out["asd"].tolist()},
        "ae_threshold": {"threshold_p99": round(train_out["thr"], 5), "trainReconMean": round(train_out["rec_mean"], 5)},
    }
    return metrics, scalers
