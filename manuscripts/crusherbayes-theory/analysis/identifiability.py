#!/usr/bin/env python3
"""The information ceiling of the capacity base (Proposition `prop:bound` of the CrusherBayes theory manuscript), checked
against the contraction the sampler measured on the ten HP500 surveys, and the contraction of every scalar as the number of
surveys grows, at the machine's fixed speed and with the speed varied.

What it computes, in the model of CrusherBayes linearized at the posterior mean theta_0 of the fit to all ten surveys
(``data/derived/hp500/crusherbayes.json``), with the discrepancy of each output integrated out exactly
(Sigma_t = sigma_t^2 I + tau_t^2 Z Z^T, sigma_t at the posterior means, tau_t the product's ``DISCREPANCY_SD``):

1. On the ten surveys: the Fisher information of the throughput about ln Q_ref, exactly (j^T Sigma^-1 j) and its ceiling
   ||c||^2 / tau^2 with j = Z c; the linearized posterior-to-prior standard-deviation ratio of every scalar (both outputs,
   sampled scale) beside the ratio the sampler measured (natural scale, mapped to the sampled scale of a log scalar by the
   delta method sd_log = sd_nat / posterior mean, the procedure of manuscripts/crusherbayes/analysis/theory_check.py).
2. The floor of the ln Q_ref ratio for any number of surveys at the fixed speed, from the structure of the engine: throughput
   informs ln Q_ref at most ||c||^2 / tau^2; power depends on ln Q_ref, ln W_i and ln zeta only through their sum, so with
   the sum known exactly the priors of ln W_i and ln zeta add 1 / (s_Wi^2 + s_zeta^2) to the precision of ln Q_ref.
3. The ratio of every scalar for n = 10 to 640 surveys drawn uniformly in the surveys window (CSS 38 to 55 mm, f80 47 to
   140 mm), averaged over 50 designs: at the fixed speed (360 rpm) and with the speed cycled over 324, 360 and 396 rpm.

Writes ``manuscripts/crusherbayes-theory/data/identifiability.json``. Deterministic (seeded designs).
Run:  .venv-pipeline/Scripts/python.exe manuscripts/crusherbayes-theory/analysis/identifiability.py [--workers N]
"""
from __future__ import annotations

import argparse
import dataclasses
import json
import math
import os
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "data-pipeline"))

from pipeline.hp500 import crusherbayes as cb  # noqa: E402
from pipeline.model.crusher import evaluate, operating_from_survey  # noqa: E402

OUT = HERE.parent / "data" / "identifiability.json"
STEP = 1e-3
SPEEDS = (324.0, 360.0, 396.0)
N_GRID = (10, 20, 40, 80, 160, 320, 640)
DESIGNS = 50
POOL = 2000
SEED = 20261119


def theta0_and_sigma() -> tuple[np.ndarray, dict, dict]:
    doc = json.loads((ROOT / "data/derived/hp500/crusherbayes.json").read_text(encoding="utf-8"))
    rows = {c["name"]: c for c in doc["contraction"]}
    theta = []
    for p in cb.PRIORS:
        if p.name not in rows:
            raise KeyError(f"crusherbayes.json has no contraction row {p.name}")
        v = rows[p.name]["posterior_mean"]
        theta.append(math.log(v) if p.log else v)
    sigma = {"tph": rows["sigma_tph"]["posterior_mean"], "kW": rows["sigma_kW"]["posterior_mean"]}
    measured = {p.name: rows[p.name] for p in cb.PRIORS}
    return np.array(theta), sigma, measured


def outputs(args) -> np.ndarray:
    """Engine (tph, kW) at one operating point and speed for theta and its 16 central-difference neighbours."""
    css, f80, speed, theta = args
    op = dataclasses.replace(operating_from_survey(float(css), float(f80)), speed_rpm=float(speed))
    out = np.empty((1 + 2 * cb.N_ENGINE, 2))
    pts = [theta]
    for i in range(cb.N_ENGINE):
        for s in (+1, -1):
            t = theta.copy()
            t[i] += s * STEP
            pts.append(t)
    for k, t in enumerate(pts):
        r = evaluate(op, cb.scalars_of(t))
        out[k] = (r.throughput_tph, r.power_kw)
    return out


def jacobians(css, f80, speed, theta, workers) -> tuple[dict, dict]:
    """Values and Jacobians (n x 8, sampled scale) of both outputs at the points."""
    args = [(c, f, s, theta) for c, f, s in zip(css, f80, speed)]
    if workers > 1:
        with ProcessPoolExecutor(max_workers=workers) as ex:
            res = list(ex.map(outputs, args, chunksize=16))
    else:
        res = [outputs(a) for a in args]
    res = np.array(res)                                   # n x 17 x 2
    val = {"tph": res[:, 0, 0], "kW": res[:, 0, 1]}
    jac = {}
    for k, t in enumerate(("tph", "kW")):
        plus, minus = res[:, 1::2, k], res[:, 2::2, k]
        jac[t] = (plus - minus) / (2 * STEP)
    return val, jac


def design(css, f80) -> np.ndarray:
    return np.column_stack([np.ones(css.size), (css - css.mean()) / css.std(), (f80 - f80.mean()) / f80.std()])


def sigma_inv(Z: np.ndarray, sigma: float, tau: float) -> np.ndarray:
    """(sigma^2 I + tau^2 Z Z^T)^-1 by the Woodbury identity."""
    n = Z.shape[0]
    lam = sigma ** 2 / tau ** 2
    return (np.eye(n) - Z @ np.linalg.solve(Z.T @ Z + lam * np.eye(3), Z.T)) / sigma ** 2


def info_matrix(Z, jac, sigma) -> np.ndarray:
    F = np.zeros((cb.N_ENGINE, cb.N_ENGINE))
    for t in ("tph", "kW"):
        Si = sigma_inv(Z, sigma[t], cb.DISCREPANCY_SD[t])
        F += jac[t].T @ Si @ jac[t]
    return F


def ratios(F: np.ndarray) -> np.ndarray:
    lam = np.array([1 / p.sd ** 2 for p in cb.PRIORS])
    cov = np.linalg.inv(np.diag(lam) + F)
    return np.sqrt(np.diag(cov) * lam)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--workers", type=int, default=min(24, os.cpu_count() or 1))
    a = ap.parse_args()
    theta0, sigma, measured = theta0_and_sigma()
    names = [p.name for p in cb.PRIORS]
    iq = names.index("q_ref_tph")
    lam = np.array([1 / p.sd ** 2 for p in cb.PRIORS])

    import csv
    rows = list(csv.DictReader(open(ROOT / "data/examples/hp500-surveys.csv", encoding="utf-8")))
    css = np.array([float(r["css_mm"]) for r in rows])
    f80 = np.array([float(r["f80_mm"]) for r in rows])
    val, jac = jacobians(css, f80, np.full(css.size, 360.0), theta0, a.workers)
    Z = design(css, f80)
    tau_t = cb.DISCREPANCY_SD["tph"]
    jq = jac["tph"][:, iq]
    c, *_ = np.linalg.lstsq(Z, jq, rcond=None)
    out_of_span = float(np.linalg.norm(jq - Z @ c) / np.linalg.norm(jq))
    info_exact = float(jq @ sigma_inv(Z, sigma["tph"], tau_t) @ jq)
    ceiling = float(c @ c / tau_t ** 2)
    # the power sensitivities to ln Q_ref, ln W_i and ln zeta coincide (they enter as a product)
    jk = jac["kW"]
    product_rel = float(max(np.linalg.norm(jk[:, iq] - jk[:, names.index(n)]) / np.linalg.norm(jk[:, iq])
                            for n in ("wi_kwh_t", "zeta")))
    s_wi, s_ze = cb.PRIORS[names.index("wi_kwh_t")].sd, cb.PRIORS[names.index("zeta")].sd
    floor_precision = lam[iq] + ceiling + 1 / (s_wi ** 2 + s_ze ** 2)
    floor_ratio = float(math.sqrt(lam[iq] / floor_precision))
    tph_only_ratio = float(math.sqrt(lam[iq] / (lam[iq] + info_exact)))
    lin_ten = ratios(info_matrix(Z, jac, sigma))

    measured_ratio = {}
    for k, p in enumerate(cb.PRIORS):
        m = measured[p.name]
        sd_nat, mean = m["posterior_sd"], m["posterior_mean"]
        sd_samp = sd_nat / mean if p.log else sd_nat
        measured_ratio[p.name] = round(float(sd_samp / p.sd), 4)

    rng = np.random.default_rng(SEED)
    pool_c = rng.uniform(38, 55, POOL)
    pool_f = rng.uniform(47, 140, POOL)
    pool = {}
    for s in SPEEDS:
        pool[s] = jacobians(pool_c, pool_f, np.full(POOL, s), theta0, a.workers)[1]
    sweep = {"fixed_speed": {}, "varied_speed": {}}
    for n in N_GRID:
        fixed, varied = [], []
        for d in range(DESIGNS):
            idx = rng.choice(POOL, size=n, replace=False)
            Zd = design(pool_c[idx], pool_f[idx])
            jf = {t: pool[360.0][t][idx] for t in ("tph", "kW")}
            fixed.append(ratios(info_matrix(Zd, jf, sigma)))
            spd = np.array([SPEEDS[k % 3] for k in range(n)])
            jv = {t: np.array([pool[s][t][i] for s, i in zip(spd, idx)]) for t in ("tph", "kW")}
            varied.append(ratios(info_matrix(Zd, jv, sigma)))
        sweep["fixed_speed"][str(n)] = {nm: round(float(np.mean(np.array(fixed)[:, k])), 4) for k, nm in enumerate(names)}
        sweep["varied_speed"][str(n)] = {nm: round(float(np.mean(np.array(varied)[:, k])), 4) for k, nm in enumerate(names)}

    doc = {
        "schema": "chancadem.cbt.identifiability/v1",
        "theta0": {nm: float(v) for nm, v in zip(names, theta0)},
        "sigma": sigma, "tau": dict(cb.DISCREPANCY_SD),
        "ten_surveys": {
            "tph_lnq_out_of_span_rel": out_of_span,
            "tph_lnq_info_exact": round(info_exact, 3), "tph_lnq_ceiling": round(ceiling, 3),
            "lnq_prior_precision": round(float(lam[iq]), 3),
            "tph_only_ratio_lnq": round(tph_only_ratio, 4),
            "power_product_sensitivity_rel_diff": product_rel,
            "floor_ratio_lnq_any_n_fixed_speed": round(floor_ratio, 4),
            "linearized_ratio": {nm: round(float(v), 4) for nm, v in zip(names, lin_ten)},
            "measured_ratio_sampled_scale": measured_ratio,
        },
        "sweep": {"n": list(N_GRID), "designs": DESIGNS, "pool": POOL, "speeds_rpm": list(SPEEDS), **sweep},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(doc["ten_surveys"], indent=1))
    print("lnQ ratio fixed:", {n: sweep["fixed_speed"][str(n)]["q_ref_tph"] for n in N_GRID})
    print("lnQ ratio varied:", {n: sweep["varied_speed"][str(n)]["q_ref_tph"] for n in N_GRID})


if __name__ == "__main__":
    main()
