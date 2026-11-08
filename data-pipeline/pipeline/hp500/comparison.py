"""The paired comparison of the held-out methods on the ten HP500 surveys (catalog row hp500-comparison 1.0.0).

Reads hp500-loo (CrusherCal and its comparators, strict leave-one-survey-out) and, when present, hp500-crusherbayes, and
writes, per measured target, which method is recommended (the lowest held-out MAPE among the methods that are not controls,
the rule the web's comparison applies), the runner-up, and for every method with per-survey predictions its paired
difference against the recommended one: d_i = APE_i(method) - APE_i(recommended), in percentage points (positive: the method
is worse), its mean, its 95 percent percentile bootstrap interval, the surveys the recommended method wins and the share of
resamples in which it is better. The bootstrap is the CrusherBayes manuscript's (manuscripts/crusherbayes/figures/
make_figs.py): numpy.random.default_rng(42).integers(0, n, size=(20000, n)), the mean of d over each resample, the 2.5 and
97.5 percent quantiles; with the same predictions the two print the same interval. The constant mean of a fold is the mean
of its nine training surveys, as the manuscript computes it. Nothing is fitted here: every prediction is the documents'.
"""
from __future__ import annotations

from typing import Any

import numpy as np

SCHEMA = "chancadem.hp500.comparison/v1"
TARGETS = ("tph", "kW")
BOOT_RESAMPLES = 20000
BOOT_SEED = 42
QUANTILES = (2.5, 97.5)
CRUSHERBAYES = "crusherbayes"
CONSTANT_MEAN = "constant_mean"
LABEL_SHUFFLE = "M1_label_shuffle"
CONTROLS = (CONSTANT_MEAN, LABEL_SHUFFLE)
# the hp500-loo rows in the order the web lists them, with the key of their per-survey predictions in the strict block
LOO_ROWS = (("M0_backbone", "M0"), ("M1_residual", "M1"), ("M2_freeform", "M2"), ("B_lin", "B_lin"), ("Morrell", "Morrell"),
            ("Morrell_noload", "Morrell_noload"), (CONSTANT_MEAN, None), (LABEL_SHUFFLE, None))
BOOT_METHOD = ("percentile bootstrap over the surveys of the mean paired difference, the resampling of the CrusherBayes "
               "manuscript (numpy.random.default_rng(seed).integers(0, n, size=(resamples, n)))")
NO_CRUSHERBAYES = {
    "en": "CrusherBayes is not in this comparison: its document (hp500/crusherbayes.json) is not in this build, so only the "
          "CrusherCal methods are compared.",
    "es": "CrusherBayes no está en esta comparación: su documento (hp500/crusherbayes.json) no está en esta versión, así que solo "
          "se comparan los métodos de CrusherCal.",
}

MISMATCHED_CRUSHERBAYES = {
    "en": "CrusherBayes is not in this comparison: its document was sampled on another set of surveys than the CrusherCal "
          "document, so its errors cannot be paired; only the CrusherCal methods are compared.",
    "es": "CrusherBayes no está en esta comparación: su documento se muestreó sobre otro conjunto de muestreos que el de "
          "CrusherCal, así que sus errores no se pueden parear; solo se comparan los métodos de CrusherCal.",
}


def _r(x: float) -> float:
    return round(float(x), 6)


def _ape(pred: np.ndarray, measured: np.ndarray) -> np.ndarray:
    return 100.0 * np.abs(pred - measured) / measured


def _methods(loo: dict, cb: dict | None, target: str) -> list[tuple[str, bool, float, np.ndarray | None]]:
    """(id, control, document MAPE, held-out predictions or None) for every method of a target, in the web's order."""
    block = loo["loo"][target]
    strict = block["strict"]
    measured = np.array(block["measured"], dtype=float)
    out: list[tuple[str, bool, float, np.ndarray | None]] = []
    for rid, key in LOO_ROWS:
        if rid not in strict:
            continue
        pred = None
        if key is not None and key in strict["pred"]:
            pred = np.array(strict["pred"][key], dtype=float)
        elif rid == CONSTANT_MEAN:   # the constant mean of each fold: the mean of the nine training surveys
            pred = np.array([np.mean(np.delete(measured, i)) for i in range(len(measured))])
        out.append((rid, rid in CONTROLS, float(strict[rid]["mape_pct"]), pred))
    if cb is not None:
        c = cb["loo"][target]
        out.append((CRUSHERBAYES, False, float(c["scores"]["mape_pct"]), np.array(c["pred_mean"], dtype=float)))
    return out


def _ranked(methods: list[tuple[str, bool, float, Any]]) -> list[str]:
    """The methods that are not controls, lowest MAPE first; a tie keeps the listing order (the web's strict comparison)."""
    free = [(mape, i, rid) for i, (rid, control, mape, _) in enumerate(methods) if not control]
    return [rid for _, _, rid in sorted(free)]


def paired(ape_method: np.ndarray, ape_best: np.ndarray, idx: np.ndarray) -> dict:
    """The paired difference of a method against the recommended one over the bootstrap resamples ``idx``."""
    d = ape_method - ape_best
    s = d[idx].mean(axis=1)
    lo, hi = np.quantile(s, QUANTILES[0] / 100.0), np.quantile(s, QUANTILES[1] / 100.0)
    return {"mean_diff_pts": _r(d.mean()), "ci95": [_r(lo), _r(hi)], "wins": int(np.sum(d > 0)), "p_better": _r(np.mean(s > 0))}


def _target(loo: dict, cb: dict | None, target: str, idx: np.ndarray) -> dict:
    measured = np.array(loo["loo"][target]["measured"], dtype=float)
    methods = _methods(loo, cb, target)
    ranked = _ranked(methods)
    if len(ranked) < 2:
        raise ValueError(f"{target}: fewer than two methods that are not controls; there is nothing to compare")
    best, runner = ranked[0], ranked[1]
    apes = {rid: (_ape(pred, measured) if pred is not None else None) for rid, _, _, pred in methods}
    rows = []
    for rid, _, _, _ in methods:
        if rid == best or apes[rid] is None:
            continue
        rows.append({"method": rid, "against": best, **paired(apes[rid], apes[best], idx)})
    return {
        "measured": [_r(v) for v in measured],
        "methods": [{"id": rid, "control": control, "mape_pct": mape,
                     "ape_pct": None if apes[rid] is None else [_r(v) for v in apes[rid]]} for rid, control, mape, _ in methods],
        "recommended": best,
        "runner_up": runner,
        "paired": rows,
    }


def _input(path: str, doc: dict) -> dict:
    return {"path": path, "schema": str(doc["schema"]), "engine_version": str(doc["engine_version"])}


def build(loo: dict, cb: dict | None, version: str) -> dict:
    """The comparison document from hp500-loo and hp500-crusherbayes (None when its document is absent)."""
    n = int(loo["n"])
    note = dict(NO_CRUSHERBAYES)
    if cb is not None and (int(cb["n"]) != n or any(cb["loo"][t]["measured"] != loo["loo"][t]["measured"] for t in TARGETS)):
        # a CrusherBayes document of another survey set (a survey rejected since it was sampled) is not paired: left out, said so
        cb, note = None, dict(MISMATCHED_CRUSHERBAYES)
    idx = np.random.default_rng(BOOT_SEED).integers(0, n, size=(BOOT_RESAMPLES, n))
    return {
        "schema": SCHEMA,
        "source": dict(loo["source"]),
        "engine_version": version,
        "n": n,
        "bootstrap": {"method": BOOT_METHOD, "resamples": BOOT_RESAMPLES, "seed": BOOT_SEED, "quantiles": list(QUANTILES)},
        "inputs": {"loo": _input("hp500/loo.json", loo), "crusherbayes": None if cb is None else _input("hp500/crusherbayes.json", cb)},
        "crusherbayes": {"included": cb is not None, "note": None if cb is not None else note},
        "targets": {t: _target(loo, cb, t, idx) for t in TARGETS},
    }
