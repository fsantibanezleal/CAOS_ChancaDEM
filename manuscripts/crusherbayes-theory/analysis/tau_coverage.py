#!/usr/bin/env python3
"""Two theoretical companions of the closed-form study, computed with the harness's own modules on the study's pools:

1. The risk of the calibrated predictor with its scalars at the virtual plant's truth (theta_0) as a function of the
   discrepancy scale tau, on the power of V0 (the plant fitted to the ten surveys), for n = 10, 20, 40 and 160 training
   surveys drawn from the surveys window: the expected squared error of Theorem thm:risk averaged over the test points of
   each design and over 400 designs, beside least squares on the three regressors and the setting-only line; and the
   per-eigendirection risk-optimal scale |delta_k| of eq:taustar from the fixed-design decomposition on the window's pool.
2. The exact coverage of the 80 percent band of the same predictor (Corollary cor:coverage) on the power of V0 and of
   V1(alpha, 0), alpha in {-1, 0, 0.5, 1, 2}, for the designs real, surveys, wide and extrapolation at n = 10 and 160: per
   test point Phi((q - m)/sqrt(v)) + Phi((q + m)/sqrt(v)) - 1 with q = 1.2816 s, s^2 = sigma^2 (1 + z^T A z) the model's
   predictive variance, m and v the error's mean and variance of the theorem; averaged over the test points and 400 designs.

The plant's noise scale is the model's (the posterior mean of the fit to all ten surveys), as in the closed-form study.
Writes ``manuscripts/crusherbayes-theory/data/tau_coverage.json``. Deterministic (seeded designs).
Run:  .venv-pipeline/Scripts/python.exe manuscripts/crusherbayes-theory/analysis/tau_coverage.py --cache <training root>/cbt
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
SIM = HERE.parent / "sim"
sys.path.insert(0, str(SIM))
sys.path.insert(0, str(SIM.parents[2] / "data-pipeline"))

import inputs  # noqa: E402
import engines  # noqa: E402
import plants  # noqa: E402
import pools  # noqa: E402
import theory  # noqa: E402
from pipeline.hp500 import crusherbayes as cb  # noqa: E402

OUT = HERE.parent / "data" / "tau_coverage.json"
SEED = 20261120
DESIGNS = 400
N_TEST = 200
TAUS = [float(x) for x in np.logspace(np.log10(4.0), np.log10(400.0), 41)]
NS_TAU = (10, 20, 40, 160)
ALPHAS = (-1.0, 0.0, 0.5, 1.0, 2.0)
K80 = 1.2815515655446004


def phi(x: np.ndarray) -> np.ndarray:
    return 0.5 * (1.0 + np.vectorize(math.erf)(x / math.sqrt(2.0)))


def label(pool: str) -> str:
    return "real" if pool == "real" else f"{pool}-s{pools.POOL_SEEDS[pool]}-N{pools.POOL_SIZE}"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--cache", required=True)
    ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args()
    fit = inputs.load_fit()
    mu_ref, sd_ref = inputs.reference_standardization()
    sigma = fit.sigma["kW"]
    tau0 = cb.DISCREPANCY_SD["kW"]
    pts = {"real": pools.survey_points(), "surveys": pools.window_points("surveys"), "wide": pools.window_points("wide")}
    f0 = {}
    zref = {}
    for k, p in pts.items():
        ev = engines.product_cached(label(k), p, fit.theta0, a.cache, workers=a.workers, jac=False)
        f0[k] = {"tph": ev["tph"], "kW": ev["kW"]}
        zref[k] = pools.design_matrix(p, mu_ref, sd_ref)
    basis = {w: plants.V1Basis.fit(f0[w]["kW"], zref[w]) for w in ("surveys", "wide")}

    def mean_kw(alpha: float, pool: str, window: str) -> np.ndarray:
        if alpha == 1.0:                                     # V1(1, 0) is V0
            return f0[pool]["kW"] + zref[pool] @ fit.d0["kW"]
        return basis[window].mean(alpha, 0.0, f0[pool]["kW"], zref[pool], fit.d0["kW"])

    rng = np.random.default_rng(SEED)
    # 1. risk against tau on V0 power, surveys window
    out_tau = {"taus": TAUS, "tau_product": tau0, "sigma": sigma, "by_n": {}}
    mu_s = mean_kw(1.0, "surveys", "surveys")
    fs = f0["surveys"]["kW"]
    for n in NS_TAU:
        risk = np.zeros(len(TAUS))
        ls = line = 0.0
        for _ in range(DESIGNS):
            tr, te, _ = pools.draw_design(rng, "surveys", n, N_TEST, pts["surveys"], np.arange(pools.POOL_SIZE))
            m_, s_ = pools.standardization(pts["surveys"][tr])
            Z = pools.design_matrix(pts["surveys"][tr], m_, s_)
            Zh = pools.design_matrix(pts["surveys"][te], m_, s_)
            for i, tau in enumerate(TAUS):
                risk[i] += theory.expected_sq_error(Z, mu_s[tr], fs[tr], Zh, mu_s[te], fs[te], sigma,
                                                    sigma ** 2 / tau ** 2).mean()
            ls += theory.expected_sq_error_ls(Z, mu_s[tr], Zh, mu_s[te], sigma).mean()
            line += theory.expected_sq_error_ls(Z[:, :2], mu_s[tr], Zh[:, :2], mu_s[te], sigma).mean()
        Zp = pools.design_matrix(pts["surveys"], *pools.standardization(pts["surveys"]))
        fd = theory.fixed_design_terms(Zp, mu_s, fs, sigma, sigma ** 2 / tau0 ** 2, n)
        risk /= DESIGNS
        out_tau["by_n"][str(n)] = {
            "rmse_cb": [float(math.sqrt(v)) for v in risk], "rmse_ls": float(math.sqrt(ls / DESIGNS)),
            "rmse_line": float(math.sqrt(line / DESIGNS)),
            "tau_best": TAUS[int(np.argmin(risk))], "rmse_cb_best": float(math.sqrt(risk.min())),
            "rmse_cb_at_product_tau": float(math.sqrt(np.interp(math.log(tau0), np.log(TAUS), risk))),
            "abs_delta_k": [abs(float(x)) for x in fd["delta_k"]], "g_k": fd["g"]}

    # 2. exact coverage of the 80 percent band of the oracle predictor
    lam = sigma ** 2 / tau0 ** 2
    cov = {}
    for alpha in ALPHAS:
        for design, ns in (("real", (10,)), ("surveys", (10, 160)), ("wide", (10, 160)), ("extrapolation", (10, 160))):
            trp, tep, w = pools.train_pool(design), pools.test_pool(design), pools.train_window(design)
            mu_tr, mu_te = mean_kw(alpha, trp, w), mean_kw(alpha, tep, w)
            cand = np.arange(pts[tep].shape[0])
            if design == "extrapolation":
                cand = cand[~pools.in_box(pts["wide"])]
            for n in ns:
                c_sum = w_sum = 0.0
                for _ in range(DESIGNS if design != "real" else 50):
                    tr, te, _ = pools.draw_design(rng, design, n, N_TEST, pts[trp], cand)
                    m_, s_ = pools.standardization(pts[trp][tr])
                    Z = pools.design_matrix(pts[trp][tr], m_, s_)
                    Zh = pools.design_matrix(pts[tep][te], m_, s_)
                    G = Z.T @ Z
                    A = np.linalg.inv(G + lam * np.eye(3))
                    beta = np.linalg.solve(G, Z.T @ mu_tr[tr])
                    b = np.linalg.solve(G, Z.T @ f0[trp]["kW"][tr])
                    m = (mu_te[te] - Zh @ beta) - (f0[tep]["kW"][te] - Zh @ b) - lam * (Zh @ (A @ (b - beta)))
                    v = sigma ** 2 * (1 + np.einsum("ij,jk,ik->i", Zh, A @ G @ A, Zh))
                    q = K80 * sigma * np.sqrt(1 + np.einsum("ij,jk,ik->i", Zh, A, Zh))
                    c_sum += float(np.mean(phi((q - m) / np.sqrt(v)) + phi((q + m) / np.sqrt(v)) - 1))
                    w_sum += float(np.mean(2 * q))
                k = DESIGNS if design != "real" else 50
                cov[f"alpha{alpha:g}-{design}-n{n}"] = {"coverage80_exact": c_sum / k, "width_exact": w_sum / k}
    doc = {"schema": "chancadem.cbt.tau-coverage/v1", "output": "kW", "designs": DESIGNS, "n_test": N_TEST,
           "inputs_sha256": inputs.digests(), "code_commit": inputs.code_commit(), "tau": out_tau, "coverage": cov}
    OUT.write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8")
    for n in NS_TAU:
        r = out_tau["by_n"][str(n)]
        print(n, "tau_best", round(r["tau_best"], 1), "rmse best", round(r["rmse_cb_best"], 2), "at 36:",
              round(r["rmse_cb_at_product_tau"], 2), "ls", round(r["rmse_ls"], 2), "line", round(r["rmse_line"], 2),
              "|delta_k|", [round(x, 1) for x in r["abs_delta_k"]])
    for k, v in cov.items():
        print(k, round(v["coverage80_exact"], 3), round(v["width_exact"], 1))


if __name__ == "__main__":
    main()
