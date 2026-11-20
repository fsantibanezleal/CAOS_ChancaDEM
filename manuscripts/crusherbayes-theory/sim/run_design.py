#!/usr/bin/env python3
"""The design-information study of the CrusherBayes theory (hypothesis H5 of the plan): how much a survey design tells about
the engine's eight scalars, in the model linearized at theta_0 (the posterior mean of the fit to all ten surveys).

Per design and output t: J_t the Jacobian of the engine at theta_0 on the design's points (central differences, step 1e-3 in
the sampled scale), Sigma_t = sigma_t^2 I + tau_t^2 Z Z^T with Z the design's rows (1, z_c, z_f) in its own standardization
(the discrepancy integrated out). Reported: the expected information gain 0.5 log det(I + L^T (sum_t J_t^T Sigma_t^-1 J_t) L)
(Rainforth et al. 2024, Eq. 2, closed form for a linear Gaussian model; L = diag(prior sd)) and the posterior-to-prior
standard-deviation ratio of each scalar.

Designs: D0 the ten surveys, throughput and power; D1 D0 plus the product size P80 as a third output (its own linear
discrepancy, tau = 12 percent of the mean P80 over the design, noise sigma at 2, 5 and 10 percent of that mean); D2 the ten
surveys with the speed set cyclically to 324, 360 and 396 rpm (the discrepancy still on the setting and feed only); D3 twenty
points of the surveys window and D4 ten points of the wide window (each the mean and spread over 200 random designs from the
pools of run_exact, ill-conditioned designs redrawn and counted); D5 D1 and D2 together.

Writes ``<out>/design.json`` (schema ``chancadem.cbt.design/v1``).
Run:  .venv-pipeline/Scripts/python.exe manuscripts/crusherbayes-theory/sim/run_design.py \
          --out manuscripts/crusherbayes-theory/data --cache D:/_Training/cbt [--workers 24]
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import engines  # noqa: E402
import inputs  # noqa: E402
import pools  # noqa: E402
import run_exact  # noqa: E402
import theory  # noqa: E402
from pipeline.hp500 import crusherbayes as cb  # noqa: E402

SCHEMA = "chancadem.cbt.design/v1"
SPEEDS = (324.0, 360.0, 396.0)
P80_TAU_FRAC = 0.12
P80_SIGMA_FRACS = (0.02, 0.05, 0.10)
N_RANDOM = 200
PRIOR_SD = np.array([p.sd for p in cb.PRIORS])
NAMES = [p.name for p in cb.PRIORS]


def information(points: np.ndarray, ev: dict, fit: inputs.Fit, p80_sigma_frac: float | None) -> dict:
    """EIG and contraction ratios of one design from the engine's values and Jacobians at theta_0 on its points."""
    Z = pools.design_matrix(points, *pools.standardization(points))
    ZZ = Z @ Z.T
    Js, Ss = [], []
    for t in inputs.TARGETS:
        Js.append(ev[f"jac_{t}"])
        Ss.append(fit.sigma[t] ** 2 * np.eye(Z.shape[0]) + cb.DISCREPANCY_SD[t] ** 2 * ZZ)
    extra = {}
    if p80_sigma_frac is not None:
        mean_p80 = float(np.mean(ev["p80"]))
        tau_p, sig_p = P80_TAU_FRAC * mean_p80, p80_sigma_frac * mean_p80
        Js.append(ev["jac_p80"])
        Ss.append(sig_p ** 2 * np.eye(Z.shape[0]) + tau_p ** 2 * ZZ)
        extra = {"p80_mean_mm": mean_p80, "p80_tau_mm": tau_p, "p80_sigma_mm": sig_p}
    ratio = theory.posterior_sd_ratio(Js, Ss, PRIOR_SD)
    return {"eig_nats": theory.eig_linear(Js, Ss, PRIOR_SD), "contraction": dict(zip(NAMES, ratio.tolist())), **extra}


def _spread(rows: list[dict]) -> dict:
    def stats(v):
        v = np.asarray(v, float)
        return {"mean": float(v.mean()), "sd": float(v.std(ddof=1)), "q10": float(np.quantile(v, 0.1)),
                "median": float(np.median(v)), "q90": float(np.quantile(v, 0.9))}
    return {"eig_nats": stats([r["eig_nats"] for r in rows]),
            "contraction": {nm: stats([r["contraction"][nm] for r in rows]) for nm in NAMES}}


def random_designs(window: str, n: int, k: int, fit, cache, workers, pool_size, n_designs) -> dict:
    pts = pools.window_points(window, pool_size)
    ev = engines.product_cached(run_exact.pool_label(window, pool_size), pts, fit.theta0, cache, workers)
    ok = ev["ok"]
    pts, ev = pts[ok], {kk: v[ok] for kk, v in ev.items()}
    rng = np.random.default_rng(np.random.SeedSequence([run_exact.SEED_ROOT, 900, k]))
    rows, redraws = [], 0
    while len(rows) < n_designs:
        idx = rng.choice(pts.shape[0], size=n, replace=False)
        if not pools.conditioned(pts[idx]):
            redraws += 1
            continue
        rows.append(information(pts[idx], {kk: v[idx] for kk, v in ev.items()}, fit, None))
    return {"window": window, "n": n, "designs": n_designs, "redraws_ill_conditioned": redraws,
            "pool": {"size": int(ok.size), "seed": pools.POOL_SEEDS[window], "removed": int((~ok).sum())},
            **_spread(rows)}


def build(cache, workers: int, pool_size: int, n_designs: int) -> dict:
    fit = inputs.load_fit()
    surveys = pools.survey_points()
    ev0 = engines.product_cached("real", surveys, fit.theta0, cache, workers)
    speed = surveys.copy()
    speed[:, 2] = [SPEEDS[i % 3] for i in range(speed.shape[0])]
    ev2 = engines.product_cached("real-speeds", speed, fit.theta0, cache, workers)
    for lab, ev in (("D0", ev0), ("D2", ev2)):
        if not np.all(ev["ok"]):
            raise ArithmeticError(f"{lab}: the engine failed at a survey point")
    designs = {"D0": {"description": "the ten surveys, throughput and power", **information(surveys, ev0, fit, None)}}
    designs["D1"] = {"description": "D0 plus P80 as a third output (tau 12 percent of the mean P80; sigma 2, 5, 10 percent)",
                     "variants": {f"sigma_{int(round(100 * s))}pct": information(surveys, ev0, fit, s) for s in P80_SIGMA_FRACS}}
    designs["D2"] = {"description": "the ten surveys at speeds 324, 360, 396 rpm cyclically; discrepancy on setting and feed",
                     "speeds_rpm": speed[:, 2].tolist(), **information(speed, ev2, fit, None)}
    designs["D3"] = {"description": "twenty points of the surveys window, 200 random designs",
                     **random_designs("surveys", 20, 3, fit, cache, workers, pool_size, n_designs)}
    designs["D4"] = {"description": "ten points of the wide window, 200 random designs",
                     **random_designs("wide", 10, 4, fit, cache, workers, pool_size, n_designs)}
    designs["D5"] = {"description": "D1 and D2 together: P80 as a third output and the cyclic speeds",
                     "variants": {f"sigma_{int(round(100 * s))}pct": information(speed, ev2, fit, s) for s in P80_SIGMA_FRACS}}
    return {"schema": SCHEMA, "linearized_at": "theta_0, the posterior mean of the fit to all ten surveys",
            "theta0_sampled": dict(zip(NAMES, fit.theta0.tolist())), "prior_sd_sampled": dict(zip(NAMES, PRIOR_SD.tolist())),
            "sigma": fit.sigma, "tau": dict(cb.DISCREPANCY_SD), "jacobian_step": engines.STEP,
            "eig": "0.5 log det(I + L^T (sum_t J_t^T Sigma_t^-1 J_t) L), nats; Sigma_t = sigma_t^2 I + tau_t^2 Z Z^T",
            "contraction": "sqrt(diag((Lambda + sum_t J_t^T Sigma_t^-1 J_t)^-1)) / prior sd, sampled scale",
            "designs": designs, "engine_version": inputs.engine_version(), "inputs_sha256": inputs.digests(),
            "code_commit": inputs.code_commit()}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", required=True)
    ap.add_argument("--cache", required=True)
    ap.add_argument("--workers", type=int, default=run_exact.MAX_WORKERS)
    ap.add_argument("--pool-size", type=int, default=pools.POOL_SIZE)
    ap.add_argument("--n-designs", type=int, default=N_RANDOM)
    a = ap.parse_args(argv)
    t0 = time.perf_counter()
    doc = build(a.cache, max(1, min(a.workers, run_exact.MAX_WORKERS)), a.pool_size, a.n_designs)
    run_exact.write_json(Path(a.out) / "design.json", doc)
    print(f"design study in {time.perf_counter() - t0:.1f} s", flush=True)
    for k, d in doc["designs"].items():
        if "variants" in d:
            for v, r in d["variants"].items():
                print(f"{k} {v}: EIG {r['eig_nats']:.3f}", flush=True)
        else:
            e = d["eig_nats"]
            print(f"{k}: EIG {e if isinstance(e, float) else e['mean']:.3f}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
