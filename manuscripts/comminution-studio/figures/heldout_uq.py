#!/usr/bin/env python3
"""Uncertainty of the held-out errors on the ten HP500 surveys, and the published throughput model of Rocha et al. run on them.

Two computations of the technical report that no product artifact stores, both from the COMMITTED artifacts:

1. ``rocha_throughput``: the maximum-throughput model of Rocha, Campos, Silva and Tavares (Minerals 14, 919, 2024), their
   Equations 10 to 15 with the parameters of their Table 4,

       Q_max = lambda * Q_T * alpha * beta * gamma * delta * Psi,
       alpha = rho_a / 1600,  beta = (16 / Wi)^eta,  gamma = (100 / f80)^eps,  delta = 1 (moisture below 1 %),
       Psi = (CSS / 38)^nu,   Q_T = 647 t/h,  eta = 0.15, eps = 0.26, nu = 1.27, lambda = 0.84,

   with the bulk density rho_a = 2088 kg/m3 of their Section 3.1 and the blend impact work index of the product (9.0 kWh/t;
   the paper prints 7.2 and 10.6 for the two itabirites and no blend value). The moisture of each survey is not printed, so
   delta = 1 is an assumption. Two variants: lambda as published, and lambda refit by least squares on the nine training
   surveys of each strict fold (the one scalar the paper fits, refit the way the product refits its capacity base).

2. ``heldout_errors`` and ``bootstrap``: the absolute percentage error of every predictor at every held-out survey (from
   ``loo.json`` strict predictions, ``crusherbayes.json`` predictive means, the constant mean and the label-shuffle control
   recomputed with the product's own functions and checked against the committed MAPE), and a nonparametric bootstrap over
   the ten surveys (``B`` resamples of the survey indices with replacement, seed ``BOOT_SEED``): the 95 % percentile interval
   of every MAPE, and of the paired difference of two predictors' MAPE on the same resampled surveys.

Imported by make_tables.py; run alone it prints the numbers.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
HP = ROOT / "data" / "derived" / "hp500"
sys.path.insert(0, str(ROOT / "data-pipeline"))

from pipeline.hp500 import loo  # noqa: E402

# Rocha et al. 2024, Equations 10 to 15 and Table 4; Section 3.1 for the bulk density; Section 2 for the base case
ROCHA = {"q_t": 647.0, "lam": 0.84, "eta": 0.15, "eps": 0.26, "nu": 1.27, "rho_a": 2088.0, "rho_base": 1600.0,
         "wi_base": 16.0, "f80_base": 100.0, "css_base": 38.0}
WI_BLEND = 9.0          # the product's blend value (HP500_NOMINAL); the paper prints 7.2 and 10.6
WI_BOUNDS = (7.2, 10.6)  # Table 1 of the paper: compact and supercompact itabirite
B = 20000
BOOT_SEED = 20261104
LEVEL = 0.95


def _json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def rocha_shape(css: np.ndarray, f80: np.ndarray, wi: float = WI_BLEND) -> np.ndarray:
    """Q_T * alpha * beta * gamma * delta * Psi of Rocha's Equation 10 without lambda, in t/h (delta = 1)."""
    r = ROCHA
    return (r["q_t"] * (r["rho_a"] / r["rho_base"]) * (r["wi_base"] / wi) ** r["eta"]
            * (r["f80_base"] / f80) ** r["eps"] * (css / r["css_base"]) ** r["nu"])


def rocha_throughput(css: np.ndarray, f80: np.ndarray, meas: np.ndarray, wi: float = WI_BLEND) -> dict:
    """The published model (lambda = 0.84) and the strict held-out variant with lambda refit per fold."""
    g = rocha_shape(css, f80, wi)
    n = meas.size
    lam = np.array([float(np.sum(g[idx] * meas[idx]) / np.sum(g[idx] ** 2))
                    for idx in (loo.fold_indices(n, i, leaky=False) for i in range(n))])
    return {"published": ROCHA["lam"] * g, "refit": lam * g, "lam_fold": lam,
            "lam_all": float(np.sum(g * meas) / np.sum(g ** 2))}


def _label_shuffle_strict(meas: np.ndarray, feat: np.ndarray, base: np.ndarray, seed: int) -> np.ndarray:
    """The label-shuffle control of loo.py recomputed with its own functions and its seed (one permutation per target)."""
    shuffled = meas.copy()
    np.random.default_rng(seed).shuffle(shuffled)
    n = meas.size
    return np.array([base[i] + loo.fit_residual(feat, base, shuffled, loo.fold_indices(n, i, False), i,
                                                resid_target=shuffled - base).clipped for i in range(n)])


def heldout_errors() -> dict:
    """Per target, the held-out prediction of every predictor at each survey and the measured values."""
    bb = _json(HP / "backbone.json")["surveys"]
    L = _json(HP / "loo.json")
    cb = _json(HP / "crusherbayes.json")
    css = np.array([s["measured"]["css_mm"] for s in bb], float)
    f80 = np.array([s["measured"]["f80_mm"] for s in bb], float)
    feat = np.column_stack([css, f80])
    out = {}
    for t, off in (("tph", 0), ("kW", 1)):
        st = L["loo"][t]["strict"]
        meas = np.array(L["loo"][t]["measured"], float)
        n = meas.size
        pred = {k: np.array(v, float) for k, v in st["pred"].items()}
        pred["constant_mean"] = np.array([np.mean(meas[loo.fold_indices(n, i, False)]) for i in range(n)])
        # the per-fold backbone at full precision (the committed predictions are rounded to two decimals)
        if t == "tph":
            shape = np.array([s["backbone"]["throughput_tph"] for s in bb], float) / 647.0
            base = np.array([loo.predict_capacity(loo.fit_capacity_base(shape, meas, loo.fold_indices(n, i, False)), shape, i)
                             for i in range(n)])
        else:
            pd_ = np.array([s["backbone"]["bond_power_kw"] for s in bb], float)
            base = np.empty(n)
            for i in range(n):
                zeta, pn = loo.fit_power_form(pd_, meas, loo.fold_indices(n, i, False))
                base[i] = zeta * pd_[i] + pn
        pred["label_shuffle"] = _label_shuffle_strict(meas, feat, base, L["seed"] + off)
        pred["CrusherBayes"] = np.array(cb["loo"][t]["pred_mean"], float)
        if t == "tph":
            r = rocha_throughput(css, f80, meas)
            pred["Rocha_published"], pred["Rocha_refit"] = r["published"], r["refit"]
        # every recomputed or rounded prediction reproduces the committed MAPE of its document
        committed = {"M0": st["M0_backbone"], "M1": st["M1_residual"], "M2": st["M2_freeform"], "B_lin": st["B_lin"],
                     "constant_mean": st["constant_mean"], "label_shuffle": st["M1_label_shuffle"],
                     "CrusherBayes": cb["loo"][t]["scores"]}
        if t == "kW":
            committed |= {"Morrell": st["Morrell"], "Morrell_noload": st["Morrell_noload"]}
        for k, doc in committed.items():
            got = round(loo.mape(meas, pred[k]), 2)
            if abs(got - doc["mape_pct"]) > 0.011:
                raise SystemExit(f"{t} {k}: recomputed MAPE {got} differs from the committed {doc['mape_pct']}")
        mape = {k: doc["mape_pct"] for k, doc in committed.items()}
        out[t] = {"measured": meas, "pred": pred, "mape": mape}
    return out


def ape(meas: np.ndarray, pred: np.ndarray) -> np.ndarray:
    return 100.0 * np.abs((pred - meas) / meas)


def bootstrap(errs: dict) -> dict:
    """Per target and predictor: MAPE, its percentile interval, and the paired difference to each reference with its
    interval. One set of resampled survey indices serves every predictor, so the differences are paired."""
    rng = np.random.default_rng(BOOT_SEED)
    lo_q, hi_q = 100 * (1 - LEVEL) / 2, 100 * (1 + LEVEL) / 2
    out = {}
    for t, e in errs.items():
        n = e["measured"].size
        idx = rng.integers(0, n, size=(B, n))
        a = {k: ape(e["measured"], p) for k, p in e["pred"].items()}
        boot = {k: v[idx].mean(axis=1) for k, v in a.items()}
        refs = ("B_lin", "M0")
        res = {}
        for k, v in a.items():
            point = e["mape"].get(k, round(float(v.mean()), 2))   # the committed MAPE where a document holds one
            row = {"mape": point, "lo": float(np.percentile(boot[k], lo_q)), "hi": float(np.percentile(boot[k], hi_q))}
            for r in refs:
                d = boot[k] - boot[r]
                row["d_" + r] = point - e["mape"][r]
                row["d_" + r + "_lo"] = float(np.percentile(d, lo_q))
                row["d_" + r + "_hi"] = float(np.percentile(d, hi_q))
            res[k] = row
        out[t] = res
    return out


if __name__ == "__main__":
    errs = heldout_errors()
    for t, rows in bootstrap(errs).items():
        for k, r in rows.items():
            print(f"{t:4s} {k:16s} {r['mape']:6.2f} [{r['lo']:6.2f}, {r['hi']:6.2f}]  vs line {r['d_B_lin']:+6.2f} "
                  f"[{r['d_B_lin_lo']:+6.2f}, {r['d_B_lin_hi']:+6.2f}]  vs backbone {r['d_M0']:+6.2f} "
                  f"[{r['d_M0_lo']:+6.2f}, {r['d_M0_hi']:+6.2f}]")
    bb = _json(HP / "backbone.json")["surveys"]
    css = np.array([s["measured"]["css_mm"] for s in bb], float)
    f80 = np.array([s["measured"]["f80_mm"] for s in bb], float)
    q = np.array([s["measured"]["feed_tph"] for s in bb], float)
    for wi in (WI_BOUNDS[0], WI_BLEND, WI_BOUNDS[1]):
        r = rocha_throughput(css, f80, q, wi)
        print(f"Rocha Wi={wi}: published MAPE {loo.mape(q, r['published']):.2f}  refit {loo.mape(q, r['refit']):.2f}  "
              f"lambda all {r['lam_all']:.3f}  folds {r['lam_fold'].min():.3f}..{r['lam_fold'].max():.3f}  "
              f"survey 10 {r['published'][9]:.1f}")
