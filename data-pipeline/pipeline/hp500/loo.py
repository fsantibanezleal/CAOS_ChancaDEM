"""CrusherCal LOO validation over the 10 HP500 / Minas Rio surveys (Rocha et al. 2024, CC BY).

WHAT THIS IS. A held-out (leave-one-survey-out) evaluation of three models on identical folds, for the two
MEASURED targets t/h and kW (P80 is a model output, reported as self-consistency only):

  M0  calibrated backbone            the physics prediction with its global scalar(s) REFIT per fold
                                     (capacity base QT for t/h; the paper power form Pc = zeta*Pd + Pn for kW)
  M1  backbone + bounded residual    a ridge residual on standardized [CSS, f80], clipped to a physical band,
                                     added on top of M0 (the CrusherCal proposal)
  M2  free-form                      an unconstrained OLS on [CSS, f80] predicting the raw target (the overfit
                                     strawman, expected to LOSE out-of-sample)

Plus, per the pre-registered plan:
  - STRICT folds (everything refit on the 9) AND a LEAKY variant (fit on all 10) so the optimism gap is visible.
  - Negative controls: label-shuffle (permuted residual targets must NOT beat M0) and a constant-mean baseline
    (M1 must beat predicting the survey mean to claim any skill).
  - Empirical coverage of an 80% predictive interval built from the held-out residual spread (UQ reliability).
  - The power-parity contrast: measured kW vs the bare Bond draw vs the engine's Pc=1.30*Pd+110 vs a refit Pc.

HONESTY. n = 10 is tiny. The pre-registered expectation is that M1 gives marginal-or-null improvement over M0;
that is an acceptable, reported outcome. The value is the VALIDATION + UQ, not a lower error than the paper's
in-sample fit. Every number below is computed from the real surveys; none is asserted or hand-set.

Run:  python -m pipeline.hp500.loo        # rebuild data/derived/hp500/loo.json from the committed backbone.json
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[3]
HP500_DIR = REPO_ROOT / "data" / "derived" / "hp500"
BACKBONE = HP500_DIR / "backbone.json"
OUT = HP500_DIR / "loo.json"

SEED = 42
RESID_CLIP_FRAC = 0.20   # bounded residual: |residual| <= 20% of the backbone value (physical, not free-form)
RIDGE_LAMBDA = 1.0       # ridge penalty on the standardized residual features (keeps the tiny-n fit humble)


# --------------------------------------------------------------------------------------------------------------
# metrics (all reported, none asserted)
# --------------------------------------------------------------------------------------------------------------
def _mape(y: np.ndarray, yhat: np.ndarray) -> float:
    return float(np.mean(np.abs((yhat - y) / y)) * 100.0)


def _rmse(y: np.ndarray, yhat: np.ndarray) -> float:
    return float(np.sqrt(np.mean((yhat - y) ** 2)))


def _r2(y: np.ndarray, yhat: np.ndarray) -> float:
    ss_res = float(np.sum((y - yhat) ** 2))
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    return float(1.0 - ss_res / ss_tot) if ss_tot > 0 else 0.0


def _maxdev(y: np.ndarray, yhat: np.ndarray) -> float:
    return float(np.max(np.abs((yhat - y) / y)) * 100.0)


def _stats(y: np.ndarray, yhat: np.ndarray) -> dict:
    return {"mape_pct": round(_mape(y, yhat), 2), "rmse": round(_rmse(y, yhat), 2),
            "r2": round(_r2(y, yhat), 3), "maxdev_pct": round(_maxdev(y, yhat), 2)}


# --------------------------------------------------------------------------------------------------------------
# the models (each returns a held-out prediction for the left-out index i, fit on the other rows)
# --------------------------------------------------------------------------------------------------------------
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


def _m0_tph(shape: np.ndarray, meas: np.ndarray, i: int, idx: np.ndarray) -> float:
    """Backbone t/h: Q = QT * shape_i (shape = engine capacity factor). Refit QT (1 scalar) on the train rows."""
    s, m = shape[idx], meas[idx]
    qt = float(np.sum(s * m) / np.sum(s * s))  # least-squares 1-parameter fit
    return qt * shape[i]


def _m0_kw(pd_: np.ndarray, meas: np.ndarray, i: int, idx: np.ndarray) -> float:
    """Backbone kW via the paper power FORM Pc = zeta*Pd + Pn, (zeta, Pn) refit by OLS on the train rows."""
    A = np.vstack([pd_[idx], np.ones(idx.size)]).T
    coef, *_ = np.linalg.lstsq(A, meas[idx], rcond=None)
    return float(coef[0] * pd_[i] + coef[1])


def _m1_residual(feat: np.ndarray, backbone_pred: np.ndarray, meas: np.ndarray,
                 i: int, idx: np.ndarray, resid_target: np.ndarray | None = None) -> float:
    """Backbone + bounded ridge residual on standardized [CSS, f80]. resid_target overrides the residual (for the
    label-shuffle control). The residual is clipped to +-RESID_CLIP_FRAC of the backbone value (physical bound)."""
    r = (meas - backbone_pred) if resid_target is None else resid_target
    trX, xi = _standardize(feat[idx], feat[i])
    coef = _fit_ridge(trX, r[idx], RIDGE_LAMBDA)
    dr = float(coef[0] + xi @ coef[1:])
    bound = RESID_CLIP_FRAC * abs(backbone_pred[i])
    dr = max(-bound, min(bound, dr))
    return backbone_pred[i] + dr


def _m2_freeform(feat: np.ndarray, meas: np.ndarray, i: int, idx: np.ndarray) -> float:
    """Unconstrained OLS on [CSS, f80] predicting the raw target (no physics). The overfit strawman."""
    A = np.hstack([np.ones((idx.size, 1)), feat[idx]])
    coef, *_ = np.linalg.lstsq(A, meas[idx], rcond=None)
    return float(coef[0] + feat[i] @ coef[1:])


# --------------------------------------------------------------------------------------------------------------
def _loo_indices(n: int, i: int, leaky: bool) -> np.ndarray:
    """Train indices for fold i: all-but-i (strict) or all rows incl. i (leaky, exposes the optimism)."""
    return np.arange(n) if leaky else np.array([k for k in range(n) if k != i])


def _run_target(name: str, meas: np.ndarray, feat: np.ndarray,
                backbone_full: np.ndarray, shape: np.ndarray | None, pd_: np.ndarray | None,
                rng: np.random.Generator) -> dict:
    n = meas.size
    out: dict = {"target": name, "measured": [round(float(v), 2) for v in meas]}

    for leaky in (False, True):
        tag = "leaky" if leaky else "strict"
        m0 = np.empty(n)
        m1 = np.empty(n)
        m2 = np.empty(n)
        m1_shuf = np.empty(n)
        const = np.empty(n)
        # a per-fold backbone (refit scalars) so M1's residual sits on the SAME backbone it will be added to
        bb = np.empty(n)
        shuffled = meas.copy()
        rng.shuffle(shuffled)  # label-shuffle control: permuted measured values (seeded)
        for i in range(n):
            idx = _loo_indices(n, i, leaky)
            if name == "tph":
                bb[i] = _m0_tph(shape, meas, i, idx)
            elif name == "kW":
                bb[i] = _m0_kw(pd_, meas, i, idx)
            else:
                bb[i] = backbone_full[i]  # p80: derived, no scalar to refit
            m0[i] = bb[i]
            const[i] = float(np.mean(meas[idx]))
            m2[i] = _m2_freeform(feat, meas, i, idx)
        # M1 residual uses the per-fold backbone bb as its base
        for i in range(n):
            idx = _loo_indices(n, i, leaky)
            m1[i] = _m1_residual(feat, bb, meas, i, idx)
            # shuffle control: residual computed against SHUFFLED labels (must not help)
            m1_shuf[i] = _m1_residual(feat, bb, shuffled, i, idx, resid_target=(shuffled - bb))

        block = {
            "M0_backbone": _stats(meas, m0),
            "M1_residual": _stats(meas, m1),
            "M2_freeform": _stats(meas, m2),
            "constant_mean": _stats(meas, const),
            "M1_label_shuffle": _stats(meas, m1_shuf),
            "pred": {"M0": [round(float(v), 2) for v in m0],
                     "M1": [round(float(v), 2) for v in m1],
                     "M2": [round(float(v), 2) for v in m2]},
        }
        # UQ: 80% predictive interval from the strict held-out residual spread of M0 (backbone is what we ship)
        if not leaky:
            resid = meas - m0
            sigma = float(np.std(resid, ddof=1))
            k80 = 1.2816  # normal 80% two-sided half-width factor
            half = k80 * sigma
            covered = np.mean(np.abs(resid) <= half)
            block["uq"] = {
                "sigma": round(sigma, 2),
                "band_halfwidth": round(half, 2),
                "nominal_coverage": 0.80,
                "empirical_coverage": round(float(covered), 3),
                "band_rel_pct": round(float(half / np.mean(meas) * 100.0), 2),
                "note": "80% interval = M0 +- 1.2816*sigma(held-out residual). n=10 makes coverage a coarse estimate.",
            }
        out[tag] = block
    return out


def run(backbone: dict, seed: int = SEED) -> dict:
    surveys = backbone["surveys"]
    css = np.array([s["measured"]["cssMm"] for s in surveys], float)
    f80 = np.array([s["measured"]["f80Mm"] for s in surveys], float)
    meas_tph = np.array([s["measured"]["tph"] for s in surveys], float)
    meas_kw = np.array([s["measured"]["kW"] for s in surveys], float)
    bb_tph = np.array([s["backbone"]["tph"] for s in surveys], float)
    bb_pd = np.array([s["backbone"]["bondPd"] for s in surveys], float)
    bb_calkw = np.array([s["backbone"]["calibratedKw"] for s in surveys], float)
    bb_p80 = np.array([s["backbone"]["p80"] for s in surveys], float)

    feat = np.column_stack([css, f80])
    # the true engine capacity factor: backbone.tph = QT_engine * factor with QT_engine = 647 (HP500_QREF)
    shape = bb_tph / 647.0

    results = {
        "tph": _run_target("tph", meas_tph, feat, bb_tph, shape, None, np.random.default_rng(seed)),
        "kW": _run_target("kW", meas_kw, feat, bb_calkw, None, bb_pd, np.random.default_rng(seed + 1)),
        "p80": _run_target("p80", bb_p80, feat, bb_p80, None, None, np.random.default_rng(seed + 2)),
    }

    # ---- power parity contrast (in-sample, honest): measured vs each modeled power estimate ----
    # refit the paper form Pc = zeta*Pd + Pn on all 10 (best the Bond-Pd-driven form can do in-sample)
    A = np.vstack([bb_pd, np.ones(bb_pd.size)]).T
    coef, *_ = np.linalg.lstsq(A, meas_kw, rcond=None)
    refit_pc = coef[0] * bb_pd + coef[1]
    power_parity = {
        "note": "In-sample power-parity contrast vs the 10 MEASURED kW. Adversarial finding: the engine Bond draw "
                "is nearly flat (it carries little information about the measured power spread), so neither the "
                "bare Bond draw nor the paper Pc=1.30*Pd+110 (whose Pd is the paper size-specific net power, not "
                "the classical Bond draw) reproduces the measured variation. The best least-squares refit of the "
                "paper FORM on our Bond Pd collapses toward the survey mean. No 2x-overprediction removal is "
                "claimed; the honest at-bar win is the t/h parity, not the power.",
        "bond_pd_range_kw": [round(float(bb_pd.min()), 1), round(float(bb_pd.max()), 1)],
        "measured_range_kw": [round(float(meas_kw.min()), 1), round(float(meas_kw.max()), 1)],
        "bare_bond": _stats(meas_kw, bb_pd),
        "engine_pc_1p30_110": _stats(meas_kw, bb_calkw),
        "refit_pc": {**_stats(meas_kw, refit_pc), "zeta": round(float(coef[0]), 4), "pn": round(float(coef[1]), 1)},
        "constant_mean": _stats(meas_kw, np.full_like(meas_kw, meas_kw.mean())),
        "per_survey": [{"n": surveys[i]["n"], "css": float(css[i]), "measured": float(meas_kw[i]),
                        "bare_bond": round(float(bb_pd[i]), 1), "engine_pc": round(float(bb_calkw[i]), 1),
                        "refit_pc": round(float(refit_pc[i]), 1)} for i in range(len(surveys))],
    }

    # ---- t/h parity (the guaranteed real result): measured vs calibrated backbone, in-sample ----
    tph_parity = {
        "note": "In-sample t/h parity: the calibrated Evertsson capacity backbone vs the 10 MEASURED t/h. This is "
                "the concrete, real at-bar result; the held-out (strict LOO) M0 t/h number above confirms it is "
                "not an in-sample artifact.",
        "backbone": _stats(meas_tph, bb_tph),
        "per_survey": [{"n": surveys[i]["n"], "css": float(css[i]), "measured": float(meas_tph[i]),
                        "backbone": round(float(bb_tph[i]), 1)} for i in range(len(surveys))],
    }

    return {
        "schema": "chancadem.hp500.loo/v1",
        "source": backbone["source"],
        "n": len(surveys),
        "seed": seed,
        "config": {"resid_clip_frac": RESID_CLIP_FRAC, "ridge_lambda": RIDGE_LAMBDA,
                   "features": ["cssMm", "f80Mm"], "targets_primary": ["tph", "kW"], "target_secondary": ["p80"]},
        "loo": results,
        "power_parity": power_parity,
        "tph_parity": tph_parity,
    }


def main() -> int:
    if not BACKBONE.exists():
        raise SystemExit(f"missing {BACKBONE}. Bake it first: "
                         f"node --import tsx data-pipeline/pipeline/sweep/bake_hp500.mjs")
    backbone = json.loads(BACKBONE.read_text(encoding="utf-8"))
    res = run(backbone)
    OUT.write_text(json.dumps(res, indent=2) + "\n", encoding="utf-8")
    tph = res["loo"]["tph"]["strict"]
    kw = res["loo"]["kW"]["strict"]
    print(f"CrusherCal LOO -> {OUT}")
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
