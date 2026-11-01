"""CrusherCal LOO validation over the 10 HP500 / Minas Rio surveys (Rocha et al. 2024, CC BY).

WHAT THIS IS. A held-out (leave-one-survey-out) evaluation of three models on identical folds, for the two
MEASURED targets t/h and kW (P80 is a model output, reported as self-consistency only):

  M0  calibrated backbone            the physics prediction with its global scalar(s) REFIT per fold
                                     (capacity base QT for t/h; the paper power form Pc = zeta*Pd + Pn for kW)
  M1  backbone + bounded residual    a ridge residual on standardized [CSS, f80], clipped to a physical band,
                                     added on top of M0 (the CrusherCal proposal)
  M2  free-form                      an unconstrained OLS on [CSS, f80] predicting the raw target (the overfit
                                     strawman, expected to LOSE out-of-sample)

Added in release 0.12.000, held out on the same folds (hp500-loo 1.2.0):
  B_lin           the setting-only OLS line on CSS (``blin``), for t/h and kW: the classical baseline of the dossier
  Morrell         Morrell's size-specific crusher energy (GMSG B4 and B5, ``model.crusher.morrell``), kW only, M_ic refit
                  per fold (never published for this ore), through the origin
  Morrell_noload  the same with a refit no-load term

Plus, per the pre-registered plan:
  - STRICT folds (everything refit on the 9) AND a LEAKY variant (fit on all 10) so the optimism gap is visible.
  - Negative controls: label-shuffle (permuted residual targets must NOT beat M0) and a constant-mean baseline
    (M1 must beat predicting the survey mean to claim any skill).
  - Empirical coverage of an 80% predictive interval built from the held-out residual spread (UQ reliability).
  - The power-parity contrast: measured kW vs the bare Bond draw vs the engine's Pc=1.30*Pd+110 vs a refit Pc.

HONESTY. n = 10 is tiny. The pre-registered expectation is that M1 gives marginal-or-null improvement over M0;
that is an acceptable, reported outcome. The value is the VALIDATION + UQ, not a lower error than the paper's
in-sample fit. Every number below is computed from the real surveys; none is asserted or hand-set.

Run:  python data-pipeline/pipeline/hp500/loo.py [--out DIR] [--version X.XX.XXX]
      # rebuild backbone.json and loo.json from data/examples/hp500-surveys.csv (default DIR: data/derived/hp500)
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from statistics import NormalDist
from typing import NamedTuple

import numpy as np

if __package__ in (None, ""):   # run by path (ADR-0057): make the pipeline importable
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from pipeline.hp500 import backbone as backbone_mod
from pipeline.hp500 import blin, morrell_fit
from pipeline.model.crusher import morrell
from pipeline.hp500.surveys import REPO_ROOT, SURVEYS_CSV, read_surveys
from pipeline.io.formats import write_json

HP500_DIR = REPO_ROOT / "data" / "derived" / "hp500"

SEED = 42
RESID_CLIP_FRAC = 0.20   # bounded residual: |residual| <= 20% of the backbone value (physical, not free-form)
RIDGE_LAMBDA = 1.0       # ridge penalty on the standardized residual features (keeps the tiny-n fit humble)


K80 = 1.2816   # normal 80% two-sided half-width factor (the constant of the committed document)


# --------------------------------------------------------------------------------------------------------------
# metrics (all reported, none asserted). Public: the notebooks and the stages call these, not private copies.
# --------------------------------------------------------------------------------------------------------------
def mape(y: np.ndarray, yhat: np.ndarray) -> float:
    """Mean absolute percentage error [%] of ``yhat`` against ``y``."""
    return float(np.mean(np.abs((yhat - y) / y)) * 100.0)


def rmse(y: np.ndarray, yhat: np.ndarray) -> float:
    return float(np.sqrt(np.mean((yhat - y) ** 2)))


def r2(y: np.ndarray, yhat: np.ndarray) -> float:
    """Coefficient of determination; 0 when ``y`` has no variance."""
    ss_res = float(np.sum((y - yhat) ** 2))
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    return float(1.0 - ss_res / ss_tot) if ss_tot > 0 else 0.0


def maxdev(y: np.ndarray, yhat: np.ndarray) -> float:
    """Largest absolute percentage deviation [%]."""
    return float(np.max(np.abs((yhat - y) / y)) * 100.0)


def stats(y: np.ndarray, yhat: np.ndarray) -> dict:
    """The four scores of the document: MAPE [%], RMSE, R squared and the largest deviation [%]."""
    return {"mape_pct": round(mape(y, yhat), 2), "rmse": round(rmse(y, yhat), 2),
            "r2": round(r2(y, yhat), 3), "maxdev_pct": round(maxdev(y, yhat), 2)}


# --------------------------------------------------------------------------------------------------------------
# the folds and the models. Each ``fit_*`` fits on the train rows; each ``predict_*`` (or the fit that returns the
# held-out value) gives the prediction for the left-out row.
# --------------------------------------------------------------------------------------------------------------
def fold_indices(n: int, i: int, leaky: bool) -> np.ndarray:
    """Train indices for fold i: all-but-i (strict) or all rows incl. i (leaky, exposes the optimism)."""
    return np.arange(n) if leaky else np.array([k for k in range(n) if k != i])


def _fit_ridge(X: np.ndarray, y: np.ndarray, lam: float) -> np.ndarray:
    """Ridge on standardized features with an unpenalized intercept. Returns coefficients incl. intercept."""
    n, d = X.shape
    Xa = np.hstack([np.ones((n, 1)), X])
    reg = lam * np.eye(d + 1)
    reg[0, 0] = 0.0  # do not penalize the intercept
    return np.linalg.solve(Xa.T @ Xa + reg, Xa.T @ y)


def _standardize(train_X: np.ndarray, x: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    mu = train_X.mean(axis=0)
    sd = train_X.std(axis=0)
    sd[sd == 0] = 1.0
    return (train_X - mu) / sd, (x - mu) / sd


def fit_capacity_base(shape: np.ndarray, measured: np.ndarray, train_idx: np.ndarray) -> float:
    """Backbone t/h, M0: Q = QT * shape (shape = the engine capacity factor). QT, the one scalar, is the least-squares fit
    on the train rows: QT = sum(s m) / sum(s s)."""
    s, m = shape[train_idx], measured[train_idx]
    return float(np.sum(s * m) / np.sum(s * s))


def predict_capacity(qt: float, shape: np.ndarray, i: int) -> float:
    """The capacity backbone for row i: QT * shape_i."""
    return qt * shape[i]


def fit_power_form(pd: np.ndarray, measured: np.ndarray, train_idx: np.ndarray) -> tuple[float, float]:
    """Backbone kW, M0, via the paper power FORM Pc = zeta*Pd + Pn: (zeta, Pn) by OLS on the train rows."""
    A = np.vstack([pd[train_idx], np.ones(train_idx.size)]).T
    coef, *_ = np.linalg.lstsq(A, measured[train_idx], rcond=None)
    return float(coef[0]), float(coef[1])


def fit_freeform(features: np.ndarray, measured: np.ndarray, train_idx: np.ndarray) -> np.ndarray:
    """M2: unconstrained OLS on [CSS, f80] predicting the raw target (no physics), the overfit strawman. Returns the
    coefficients, the intercept first."""
    A = np.hstack([np.ones((train_idx.size, 1)), features[train_idx]])
    coef, *_ = np.linalg.lstsq(A, measured[train_idx], rcond=None)
    return coef


def predict_freeform(coef: np.ndarray, x: np.ndarray) -> float:
    """The free-form prediction for one feature row: intercept + x . slopes."""
    return float(coef[0] + x @ coef[1:])


class ResidualFit(NamedTuple):
    """The ridge residual of M1 for one fold: its coefficients on the standardized features (intercept first), the residual
    it predicts for the left-out row and the same residual clipped to the physical band."""
    coef: np.ndarray
    raw: float
    clipped: float


def fit_residual(features: np.ndarray, backbone_pred: np.ndarray, measured: np.ndarray, train_idx: np.ndarray, i: int,
                 resid_target: np.ndarray | None = None) -> ResidualFit:
    """M1: a ridge regression of the residual on standardized [CSS, f80] fitted on the train rows, evaluated at row i.
    ``resid_target`` overrides the residual (the label-shuffle control). The residual is clipped to +-RESID_CLIP_FRAC of the
    backbone value at row i (a physical bound); M1 is ``backbone_pred[i] + clipped``."""
    r = (measured - backbone_pred) if resid_target is None else resid_target
    trX, xi = _standardize(features[train_idx], features[i])
    coef = _fit_ridge(trX, r[train_idx], RIDGE_LAMBDA)
    raw = float(coef[0] + xi @ coef[1:])
    bound = RESID_CLIP_FRAC * abs(backbone_pred[i])
    return ResidualFit(coef, raw, max(-bound, min(bound, raw)))


# --------------------------------------------------------------------------------------------------------------
# the 80% predictive band and its coverage
# --------------------------------------------------------------------------------------------------------------
def band_factor(level: float = 0.8) -> float:
    """The two-sided normal factor of a central ``level`` (1.2816 at 0.8), to four decimals as the document carries it."""
    return K80 if level == 0.8 else round(NormalDist().inv_cdf(0.5 + level / 2.0), 4)


def predictive_band(residuals: np.ndarray, level: float = 0.8) -> dict:
    """The band M0 +- halfwidth from a set of held-out residuals: ``sigma`` their sample standard deviation (ddof 1) and
    ``halfwidth`` = factor(level) * sigma."""
    sigma = float(np.std(residuals, ddof=1))
    return {"sigma": sigma, "halfwidth": band_factor(level) * sigma}


def nested_band_coverage(residuals: np.ndarray, level: float = 0.8) -> dict:
    """The out-of-sample coverage of the band: for each survey i, sigma comes from the held-out residuals of the OTHER
    surveys only, and survey i is covered when its own residual lies within factor(level) * sigma_i. The in-sample
    coverage of the document checks the residuals against a sigma computed from the very same residuals. Returns the
    per-survey ``sigma``, the per-survey ``covered`` verdicts and the ``coverage`` fraction."""
    residuals = np.asarray(residuals, dtype=float)
    n = residuals.size
    sigmas, covered = [], []
    for i in range(n):
        band = predictive_band(residuals[fold_indices(n, i, leaky=False)], level)
        sigmas.append(band["sigma"])
        covered.append(bool(abs(residuals[i]) <= band["halfwidth"]))
    return {"sigma": sigmas, "covered": covered, "coverage": float(np.mean(covered))}


NESTED_NOTE = ("empirical_coverage is in sample: sigma comes from the same ten held-out residuals it is checked against. "
               "nested_coverage is out of sample: for each survey, sigma comes from the held-out residuals of the other nine "
               "surveys only, and the survey is covered when its residual lies within 1.2816 times that sigma. n=10 makes "
               "both coarse: one survey moves a coverage by 0.1.")


# --------------------------------------------------------------------------------------------------------------
# the names of the first release, kept as thin aliases so its notebooks still run until they call the public ones
# --------------------------------------------------------------------------------------------------------------
_mape, _r2, _stats, _loo_indices = mape, r2, stats, fold_indices


def _m0_tph(shape: np.ndarray, meas: np.ndarray, i: int, idx: np.ndarray) -> float:
    return predict_capacity(fit_capacity_base(shape, meas, idx), shape, i)


def _m2_freeform(feat: np.ndarray, meas: np.ndarray, i: int, idx: np.ndarray) -> float:
    return predict_freeform(fit_freeform(feat, meas, idx), feat[i])


def _run_target(name: str, meas: np.ndarray, feat: np.ndarray,
                backbone_full: np.ndarray, shape: np.ndarray | None, pd_: np.ndarray | None,
                rng: np.random.Generator, morrell_g: np.ndarray | None = None) -> dict:
    n = meas.size
    out: dict = {"target": name, "measured": [round(float(v), 2) for v in meas]}

    for leaky in (False, True):
        tag = "leaky" if leaky else "strict"
        m0 = np.empty(n)
        m1 = np.empty(n)
        m2 = np.empty(n)
        m1_shuf = np.empty(n)
        const = np.empty(n)
        lin = np.empty(n)
        mor, mor_nl = np.empty(n), np.empty(n)
        fit_m, fit_m_nl, fit_p_nl = np.empty(n), np.empty(n), np.empty(n)
        # a per-fold backbone (refit scalars) so M1's residual sits on the SAME backbone it will be added to
        bb = np.empty(n)
        shuffled = meas.copy()
        rng.shuffle(shuffled)  # label-shuffle control: permuted measured values (seeded)
        for i in range(n):
            idx = fold_indices(n, i, leaky)
            if name == "tph":
                bb[i] = predict_capacity(fit_capacity_base(shape, meas, idx), shape, i)
            elif name == "kW":
                zeta, pn = fit_power_form(pd_, meas, idx)
                bb[i] = zeta * pd_[i] + pn
            else:
                bb[i] = backbone_full[i]  # p80: derived, no scalar to refit
            m0[i] = bb[i]
            const[i] = float(np.mean(meas[idx]))
            m2[i] = predict_freeform(fit_freeform(feat, meas, idx), feat[i])
            if name in ("tph", "kW"):
                lin[i] = blin.predict_line(blin.fit_line(feat[:, 0], meas, idx), feat[i, 0])
            if name == "kW" and morrell_g is not None:
                fit_m[i] = morrell_fit.fit_through_origin(morrell_g, meas, idx)
                fit_m_nl[i], fit_p_nl[i] = morrell_fit.fit_with_no_load(morrell_g, meas, idx)
                mor[i] = fit_m[i] * morrell_g[i]
                mor_nl[i] = fit_m_nl[i] * morrell_g[i] + fit_p_nl[i]
        # M1 residual uses the per-fold backbone bb as its base
        for i in range(n):
            idx = fold_indices(n, i, leaky)
            m1[i] = bb[i] + fit_residual(feat, bb, meas, idx, i).clipped
            # shuffle control: residual computed against SHUFFLED labels (must not help)
            m1_shuf[i] = bb[i] + fit_residual(feat, bb, shuffled, idx, i, resid_target=(shuffled - bb)).clipped

        block = {
            "M0_backbone": stats(meas, m0),
            "M1_residual": stats(meas, m1),
            "M2_freeform": stats(meas, m2),
            "constant_mean": stats(meas, const),
            "M1_label_shuffle": stats(meas, m1_shuf),
            "pred": {"M0": [round(float(v), 2) for v in m0],
                     "M1": [round(float(v), 2) for v in m1],
                     "M2": [round(float(v), 2) for v in m2]},
        }
        if name in ("tph", "kW"):
            block["B_lin"] = stats(meas, lin)
            block["pred"]["B_lin"] = [round(float(v), 2) for v in lin]
        if name == "kW" and morrell_g is not None:
            block["Morrell"] = stats(meas, mor)
            block["Morrell_noload"] = stats(meas, mor_nl)
            block["pred"]["Morrell"] = [round(float(v), 2) for v in mor]
            block["pred"]["Morrell_noload"] = [round(float(v), 2) for v in mor_nl]
            block["morrell_fit"] = {"m_ic_kwh_t": [round(float(v), 4) for v in fit_m],
                                    "m_ic_noload_kwh_t": [round(float(v), 4) for v in fit_m_nl],
                                    "no_load_kw": [round(float(v), 2) for v in fit_p_nl],
                                    "noload_variant_m_ic_positive": [bool(v > 0) for v in fit_m_nl]}
        # UQ: 80% predictive interval from the strict held-out residual spread of M0 (backbone is what we ship)
        if not leaky:
            resid = meas - m0
            band = predictive_band(resid)
            sigma, half = band["sigma"], band["halfwidth"]
            covered = np.mean(np.abs(resid) <= half)
            nested = nested_band_coverage(resid)
            block["uq"] = {
                "sigma": round(sigma, 2),
                "band_halfwidth": round(half, 2),
                "nominal_coverage": 0.80,
                "empirical_coverage": round(float(covered), 3),
                "band_rel_pct": round(float(half / np.mean(meas) * 100.0), 2),
                "note": "80% interval = M0 +- 1.2816*sigma(held-out residual). n=10 makes coverage a coarse estimate.",
                "nested_coverage": round(nested["coverage"], 3),
                "nested_covered": nested["covered"],
                "nested_sigma": [round(v, 2) for v in nested["sigma"]],
                "nested_note": NESTED_NOTE,
            }
        out[tag] = block
    return out


def build(backbone: dict, version: str, seed: int = SEED) -> dict:
    """The ``chancadem.hp500.loo/v1`` document from a ``chancadem.hp500.backbone/v1`` document. Pure: no file I/O."""
    surveys = backbone["surveys"]
    css = np.array([s["measured"]["css_mm"] for s in surveys], float)
    f80 = np.array([s["measured"]["f80_mm"] for s in surveys], float)
    meas_tph = np.array([s["measured"]["feed_tph"] for s in surveys], float)
    meas_kw = np.array([s["measured"]["power_kw"] for s in surveys], float)
    bb_tph = np.array([s["backbone"]["throughput_tph"] for s in surveys], float)
    bb_pd = np.array([s["backbone"]["bond_power_kw"] for s in surveys], float)
    bb_calkw = np.array([s["backbone"]["calibrated_power_kw"] for s in surveys], float)
    bb_p80 = np.array([s["backbone"]["p80_mm"] for s in surveys], float)

    feat = np.column_stack([css, f80])
    morrell_g = morrell_fit.design_column(f80, bb_p80, meas_tph)   # kW per kWh/t of M_ic: measured f80 and t/h, backbone P80
    # the true engine capacity factor: backbone.tph = QT_engine * factor with QT_engine = 647 (HP500_QREF)
    shape = bb_tph / 647.0

    results = {
        "tph": _run_target("tph", meas_tph, feat, bb_tph, shape, None, np.random.default_rng(seed)),
        "kW": _run_target("kW", meas_kw, feat, bb_calkw, None, bb_pd, np.random.default_rng(seed + 1), morrell_g=morrell_g),
        "p80": _run_target("p80", bb_p80, feat, bb_p80, None, None, np.random.default_rng(seed + 2)),
    }

    # ---- power parity contrast (in-sample, honest): measured vs each modeled power estimate ----
    # refit the paper form Pc = zeta*Pd + Pn on all 10 (best the Bond-Pd-driven form can do in-sample)
    zeta, pn = fit_power_form(bb_pd, meas_kw, np.arange(meas_kw.size))
    refit_pc = zeta * bb_pd + pn
    power_parity = {
        "note": "In-sample power-parity contrast vs the 10 MEASURED kW. Adversarial finding: the engine Bond draw "
                "is nearly flat (it carries little information about the measured power spread), so neither the "
                "bare Bond draw nor the paper Pc=1.30*Pd+110 (whose Pd is the paper size-specific net power, not "
                "the classical Bond draw) reproduces the measured variation. The best least-squares refit of the "
                "paper FORM on our Bond Pd collapses toward the survey mean. No 2x-overprediction removal is "
                "claimed; the honest at-bar win is the t/h parity, not the power.",
        "bond_pd_range_kw": [round(float(bb_pd.min()), 1), round(float(bb_pd.max()), 1)],
        "measured_range_kw": [round(float(meas_kw.min()), 1), round(float(meas_kw.max()), 1)],
        "bare_bond": stats(meas_kw, bb_pd),
        "engine_pc_1p30_110": stats(meas_kw, bb_calkw),
        "refit_pc": {**stats(meas_kw, refit_pc), "zeta": round(zeta, 4), "pn": round(pn, 1)},
        "constant_mean": stats(meas_kw, np.full_like(meas_kw, meas_kw.mean())),
        "per_survey": [{"n": surveys[i]["n"], "css": float(css[i]), "measured": float(meas_kw[i]),
                        "bare_bond": round(float(bb_pd[i]), 1), "engine_pc": round(float(bb_calkw[i]), 1),
                        "refit_pc": round(float(refit_pc[i]), 1)} for i in range(len(surveys))],
    }

    # ---- t/h parity (the guaranteed real result): measured vs calibrated backbone, in-sample ----
    tph_parity = {
        "note": "In-sample t/h parity: the calibrated Evertsson capacity backbone vs the 10 MEASURED t/h. This is "
                "the concrete, real at-bar result; the held-out (strict LOO) M0 t/h number above confirms it is "
                "not an in-sample artifact.",
        "backbone": stats(meas_tph, bb_tph),
        "per_survey": [{"n": surveys[i]["n"], "css": float(css[i]), "measured": float(meas_tph[i]),
                        "backbone": round(float(bb_tph[i]), 1)} for i in range(len(surveys))],
    }

    return {
        "schema": "chancadem.hp500.loo/v1",
        "source": backbone["source"],
        "engine_version": version,
        "n": len(surveys),
        "seed": seed,
        "config": {"resid_clip_frac": RESID_CLIP_FRAC, "ridge_lambda": RIDGE_LAMBDA,
                   "features": ["cssMm", "f80Mm"], "targets_primary": ["tph", "kW"], "target_secondary": ["p80"],
                   "morrell": {"k_s": morrell.K_S_CRUSHER, "k2": morrell.K2_CLOSED, "circuit": "closed",
                               "inputs": "measured f80, measured feed t/h and the backbone P80 (a model output used as an input)",
                               "fitted": "M_ic and the no-load power are fitted per fold on the training surveys: the ore's "
                                         "M_ic is not published"}},
        "loo": results,
        "power_parity": power_parity,
        "tph_parity": tph_parity,
    }


def main(argv: list[str] | None = None) -> int:
    """Manual rebuild of both documents from the survey table into an output root."""
    ap = argparse.ArgumentParser(description="Rebuild the HP500 backbone and CrusherCal LOO documents.")
    ap.add_argument("--out", type=Path, default=HP500_DIR, help="output root (default data/derived/hp500)")
    ap.add_argument("--version", default=(REPO_ROOT / "VERSION").read_text(encoding="utf-8").strip())
    ap.add_argument("--surveys", type=Path, default=SURVEYS_CSV)
    args = ap.parse_args(argv)
    report = read_surveys(args.surveys)
    for row, why in report.rejected:
        print(f"rejected survey row {row}: {why}", file=sys.stderr)
    bb = backbone_mod.build(report.accepted, args.version)
    res = build(bb, args.version)
    args.out.mkdir(parents=True, exist_ok=True)
    for name, doc in (("backbone.json", bb), ("loo.json", res)):
        write_json(args.out / name, doc)   # compact, the committed form of the artifacts
    tph = res["loo"]["tph"]["strict"]
    kw = res["loo"]["kW"]["strict"]
    print(f"CrusherCal LOO -> {args.out}")
    print(f"  t/h  strict LOO  M0={tph['M0_backbone']['mape_pct']}%  M1={tph['M1_residual']['mape_pct']}%  "
          f"M2={tph['M2_freeform']['mape_pct']}%  const={tph['constant_mean']['mape_pct']}%")
    print(f"  kW   strict LOO  M0={kw['M0_backbone']['mape_pct']}%  M1={kw['M1_residual']['mape_pct']}%  "
          f"M2={kw['M2_freeform']['mape_pct']}%  const={kw['constant_mean']['mape_pct']}%")
    print(f"  power parity  bare_Bond={res['power_parity']['bare_bond']['mape_pct']}%  "
          f"engine_Pc={res['power_parity']['engine_pc_1p30_110']['mape_pct']}%  "
          f"refit_Pc={res['power_parity']['refit_pc']['mape_pct']}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
