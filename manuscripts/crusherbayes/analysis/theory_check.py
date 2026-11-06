#!/usr/bin/env python3
"""The numerical checks of the theory of CrusherBayes, computed with the product's engine on the ten HP500 surveys.

Three checks, each a direct consequence of the propositions of the paper:

1. The throughput of the engine is affine in the closed-side setting: the vector of capacity factors lies in the column
   space of the discrepancy design [1, z_CSS, z_f80]. Reported: the relative norm of its component outside that space.
2. The information the surveys carry about each sampled scalar, from the Jacobian of the engine at the posterior mean of
   the fit to all ten surveys (central finite differences in the sampled scale), split into the part inside the column
   space of the design (discounted by the discrepancy) and the part outside it. From the linearized model, the Laplace
   approximation of the posterior gives a predicted ratio of posterior to prior standard deviation for every scalar and
   every discrepancy coefficient, set beside the ratio the sampler measured. The sampler's ratio is on the natural scale
   (``crusherbayes.build``: the standard deviation of exp(theta) over the natural-scale prior standard deviation), so the
   linearized standard deviation of a log-sampled scalar is mapped to the natural scale by the delta method,
   sd_natural = x_hat * sd_log with x_hat the posterior mean, before it is divided by the same natural-scale prior
   standard deviation. Both ratios are written: ``predicted_ratio`` (sampled scale) and ``predicted_ratio_natural``.
3. The predictive mean given the scalars is a ridge regression of the survey on the standardized setting and feed size,
   shrunk toward the engine's best affine approximation, plus the engine's non-affine remainder. With the scalars at their
   nominal value and the noise at the posterior mean of the fit to all ten surveys, the leave-one-survey-out MAPE of that
   closed form is computed over a range of the shrinkage lambda = sigma^2 / tau^2, from ordinary least squares (lambda = 0)
   to the engine line (lambda large); the value at the tau of the method is marked.

Also written: the prior mean of each engine scalar on the natural scale (seeded rejection sampling of its truncated prior,
the procedure and seed of ``crusherbayes.prior_sd_natural``), and the feed F80 the engine evaluates on its sieve grid for
every survey (``engine.grid_f80``), beside the measured f80.

Writes ``manuscripts/crusherbayes/data/theory.json``. Deterministic: no random numbers.
Run:  python manuscripts/crusherbayes/analysis/theory_check.py
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "data-pipeline"))

from pipeline.hp500 import crusherbayes as cb  # noqa: E402
from pipeline.model.crusher import operating_from_survey  # noqa: E402
from pipeline.model.crusher.engine import grid_f80  # noqa: E402

DER = ROOT / "data" / "derived" / "hp500"
OUT = HERE.parent / "data" / "theory.json"
STEP = 1e-3        # finite-difference step in the sampled scale
LAMBDAS = [0.0] + [float(x) for x in np.logspace(-2, 3, 41)]


def load():
    doc = json.loads((DER / "crusherbayes.json").read_text(encoding="utf-8"))
    bb = json.loads((DER / "backbone.json").read_text(encoding="utf-8"))
    css = np.array([s["measured"]["css_mm"] for s in bb["surveys"]], float)
    f80 = np.array([s["measured"]["f80_mm"] for s in bb["surveys"]], float)
    y = {"tph": np.array([s["measured"]["feed_tph"] for s in bb["surveys"]], float),
         "kW": np.array([s["measured"]["power_kw"] for s in bb["surveys"]], float)}
    return doc, css, f80, y


def engine(theta_s: np.ndarray, ops) -> dict[str, np.ndarray]:
    full = np.concatenate([theta_s, [0.0, 0.0]])
    tph, kw = cb.simulate(ops, cb.scalars_of(full))
    return {"tph": tph, "kW": kw}


def to_sampled(name: str, value: float) -> float:
    p = next(q for q in cb.PRIORS if q.name == name)
    return math.log(value) if p.log else value


def prior_mean_natural(p, n: int = 400_000, seed: int = 7) -> float:
    """Mean of a prior on its natural scale; the sampling of ``crusherbayes.prior_sd_natural`` (same n and seed)."""
    rng = np.random.default_rng(seed)
    x = rng.normal(p.mu, p.sd, n)
    x = x[(x >= p.lo) & (x <= p.hi)]
    return float(np.mean(np.exp(x) if p.log else x))


def main() -> int:
    doc, css, f80, y = load()
    n = css.size
    ops = [operating_from_survey(float(c), float(f)) for c, f in zip(css, f80)]
    post = {r["name"]: r for r in doc["contraction"]}
    theta_hat = np.array([to_sampled(p.name, post[p.name]["posterior_mean"]) for p in cb.PRIORS])
    theta_nom = np.array([p.mu for p in cb.PRIORS])
    sigma = {t: post[f"sigma_{t}"]["posterior_mean"] for t in cb.TARGETS}
    tau = dict(cb.DISCREPANCY_SD)
    mu = np.array([css.mean(), f80.mean()])
    sd = np.array([css.std(), f80.std()])
    Z = cb.design(css, f80, mu, sd)
    U, S, _ = np.linalg.svd(Z, full_matrices=False)
    P = U @ U.T

    # 1. throughput is affine in the setting
    f_nom = engine(theta_nom, ops)
    shape = f_nom["tph"] / cb.PRIORS[0].nominal
    out_of_span = float(np.linalg.norm(shape - P @ shape) / np.linalg.norm(shape))
    css_affine = float(np.max(np.abs(shape - (css + 17.0) / 38.0)))

    # 2. Jacobian at the posterior mean, information split, linearized posterior
    f0 = engine(theta_hat, ops)
    J = {t: np.zeros((n, cb.N_ENGINE)) for t in cb.TARGETS}
    for j in range(cb.N_ENGINE):
        e = np.zeros(cb.N_ENGINE)
        e[j] = STEP
        fp, fm = engine(theta_hat + e, ops), engine(theta_hat - e, ops)
        for t in cb.TARGETS:
            J[t][:, j] = (fp[t] - fm[t]) / (2 * STEP)
    rows = []
    for j, p in enumerate(cb.PRIORS):
        row = {"name": p.name, "prior_sd_sampled": p.sd}
        for t in cb.TARGETS:
            col = J[t][:, j]
            tot = float(col @ col)
            inside = float(col @ P @ col)
            u = U.T @ col
            info = float((col @ col - u @ u) / sigma[t] ** 2 + np.sum(u ** 2 / (sigma[t] ** 2 + tau[t] ** 2 * S ** 2)))
            row[t] = {"sensitivity_norm": math.sqrt(tot), "fraction_in_span": inside / tot if tot > 0 else None,
                      "information": info, "information_if_no_discrepancy": tot / sigma[t] ** 2}
        rows.append(row)
    # the joint linearized model: [theta (8), d_tph (3), d_kW (3)]
    k = cb.N_ENGINE + 6
    F = np.zeros((k, k))
    for b, t in enumerate(cb.TARGETS):
        A = np.zeros((n, k))
        A[:, :cb.N_ENGINE] = J[t]
        A[:, cb.N_ENGINE + 3 * b:cb.N_ENGINE + 3 * b + 3] = Z
        F += A.T @ A / sigma[t] ** 2
    prior_sd = np.array([p.sd for p in cb.PRIORS] + [tau["tph"]] * 3 + [tau["kW"]] * 3)
    cov = np.linalg.inv(np.diag(1 / prior_sd ** 2) + F)
    names = [p.name for p in cb.PRIORS] + [f"discrepancy_{t}_{term}" for t in cb.TARGETS for term in cb.DISCREPANCY_TERMS]
    laplace = []
    for i, nm in enumerate(names):
        sd_lin = math.sqrt(cov[i, i])
        if i < cb.N_ENGINE:
            p = cb.PRIORS[i]
            sd_nat = math.exp(theta_hat[i]) * sd_lin if p.log else sd_lin   # delta method for a log-sampled scalar
            ratio_nat = sd_nat / post[nm]["prior_sd"]                        # the natural-scale prior SD of the sampler
        else:
            ratio_nat = sd_lin / prior_sd[i]                                 # discrepancy coefficients: one scale
        laplace.append({"name": nm, "predicted_ratio": float(sd_lin / prior_sd[i]),
                        "predicted_ratio_natural": float(ratio_nat), "sampler_ratio": post[nm]["contraction"]})
    iw, iz = names.index("wi_kwh_t"), names.index("zeta")
    corr_wz = float(cov[iw, iz] / math.sqrt(cov[iw, iw] * cov[iz, iz]))
    dlog = J["kW"][:, iw] - J["kW"][:, iz]
    ridge_ratio = float(np.linalg.norm(dlog) / np.linalg.norm(J["kW"][:, iw]))

    # 3. the closed form of the predictive mean over lambda, scalars at nominal, held out
    def loo_closed_form(t: str, lam: float) -> np.ndarray:
        pred = np.empty(n)
        for i in range(n):
            tr = np.array([q for q in range(n) if q != i])
            m_ = np.array([css[tr].mean(), f80[tr].mean()])
            s_ = np.array([css[tr].std(), f80[tr].std()])
            Zt = cb.design(css[tr], f80[tr], m_, s_)
            xh = cb.design(css[[i]], f80[[i]], m_, s_)[0]
            G = Zt.T @ Zt
            r = y[t][tr] - f_nom[t][tr]
            d = np.linalg.solve(G + lam * np.eye(3), Zt.T @ r)
            pred[i] = f_nom[t][i] + xh @ d
        return pred

    sweep = {}
    for t in cb.TARGETS:
        lam_method = sigma[t] ** 2 / tau[t] ** 2
        curve = []
        for lam in LAMBDAS + [lam_method]:
            p_ = loo_closed_form(t, lam)
            curve.append({"lambda": lam, "mape_pct": float(np.mean(np.abs(p_ - y[t]) / y[t]) * 100)})
        G_all = Z.T @ Z
        sweep[t] = {"lambda_method": lam_method, "curve": curve[:-1], "at_method": curve[-1],
                    "engine_weight_at_method": float(lam_method / (np.mean(np.diag(G_all)) + lam_method)),
                    "cb_mape_pct": doc["loo"][t]["scores"]["mape_pct"]}
    # the affine approximation of the engine power and its slope sign
    b_kw = np.linalg.lstsq(Z, f_nom["kW"], rcond=None)[0]
    b_y = np.linalg.lstsq(Z, y["kW"], rcond=None)[0]
    prior_means = {p.name: prior_mean_natural(p) for p in cb.PRIORS}
    feed_grid = [{"survey": i + 1, "f80_measured_mm": float(f80[i]), "f80_engine_grid_mm": float(grid_f80(ops[i]))}
                 for i in range(n)]
    res = {
        "schema": "chancadem.crusherbayes.theory/v1",
        "note": "computed by manuscripts/crusherbayes/analysis/theory_check.py with the product's engine",
        "throughput_shape_out_of_span_rel": out_of_span,
        "throughput_shape_max_dev_from_css_plus_17_over_38": css_affine,
        "design_singular_values": S.tolist(),
        "sigma_used": sigma, "tau": tau, "step": STEP,
        "information": rows, "laplace": laplace, "prior_mean_natural": prior_means, "feed_f80": feed_grid,
        "laplace_corr_wi_zeta": corr_wz, "kw_jacobian_wi_minus_zeta_rel": ridge_ratio,
        "shrinkage": sweep,
        "engine_power_affine_coef": b_kw.tolist(), "measured_power_affine_coef": b_y.tolist(),
    }
    OUT.write_text(json.dumps(res, indent=1) + "\n", encoding="utf-8")
    print(json.dumps({"out_of_span": out_of_span, "css_affine": css_affine, "corr_wz": corr_wz, "ridge_ratio": ridge_ratio,
                      "laplace": [(r["name"], round(r["predicted_ratio_natural"], 3), r["sampler_ratio"]) for r in laplace],
                      "prior_mean_natural": prior_means, "feed_f80": feed_grid,
                      "frac_in_span_kW": [(r["name"], round(r["kW"]["fraction_in_span"] or 0, 3)) for r in rows],
                      "at_method": {t: sweep[t]["at_method"] for t in sweep},
                      "lambda": {t: sweep[t]["lambda_method"] for t in sweep},
                      "ols": {t: sweep[t]["curve"][0] for t in sweep}, "big": {t: sweep[t]["curve"][-1] for t in sweep},
                      "b_kw": b_kw.tolist(), "b_y": b_y.tolist()}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
