#!/usr/bin/env python3
"""The full CrusherBayes posterior (the product's own sampler, ``crusherbayes.fit_inline``) for the theory study, in two
modes, plus a ``summarize`` subcommand.

sbc     Simulation-based calibration (Talts et al. 2018; the joint test quantity of Modrak et al. 2023): N posteriors (default
        200) at the ten surveys' design. Per posterior: theta drawn from the truncated priors (rejection), ln sigma_t from the
        truncated noise prior, d_t ~ N(0, tau_t^2 I) in the ten surveys' standardization, data from the model (a draw at
        which the engine fails is redrawn and counted); the fit at Config(walkers=20, steps=4000, burn=1000, thin=10,
        draws=20), held None; the ranks of the 10 sampled parameters and the 6 discrepancy coefficients among L = 99 evenly
        spaced retained draws (ties broken at random), and the rank of the marginal log likelihood at the true parameters
        among its values at those draws; the convergence fields and the wall time. One JSON per posterior.
verify  The cells V0-real-n10, V2-real-n10 and V0-surveys-n10, 50 replicates each by default, with the replicate data of
        ``run_exact`` (the same seed, the first ``--n-test`` of its 200 test points); the fit at the same Config, held None;
        the predictive at the test points from 200 evenly spaced retained draws (the engine at the test points per draw, the
        exact conditional of the discrepancy, 20 predictive draws per sample, the band from the mixture quantiles as
        ``crusherbayes._fit`` does); per replicate the squared errors, coverage and width beside the exact-route predictors
        on the same test points. One JSON per posterior.
summarize  Gathers ``<out>/sbc`` and ``<out>/verify`` into ``<data>/sbc.json`` and ``<data>/verify.json``.

Both modes: ``--workers`` (default 24, at most 24) processes, one posterior each, BLAS threads set to 1; ``--chunk K`` stops
after K new posteriors; existing results are skipped; ``--pilot`` runs one posterior and prints its wall time, tau_max and
convergence. A posterior costs about 20 x 4000 x 10 engine evaluations plus the predictive (see README.md for the measured
wall time).

Run:  .venv-pipeline/Scripts/python.exe manuscripts/crusherbayes-theory/sim/run_sampler.py sbc --out D:/_Training/cbt/sampler --chunk 24
      .venv-pipeline/Scripts/python.exe manuscripts/crusherbayes-theory/sim/run_sampler.py verify --out D:/_Training/cbt/sampler \
          --cache D:/_Training/cbt --chunk 24
      .venv-pipeline/Scripts/python.exe manuscripts/crusherbayes-theory/sim/run_sampler.py summarize --out D:/_Training/cbt/sampler \
          --data manuscripts/crusherbayes-theory/data
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from dataclasses import asdict
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
from pipeline.model.crusher import operating_from_survey  # noqa: E402

SCHEMA_SBC_POST = "chancadem.cbt.sbc-posterior/v1"
SCHEMA_VER_POST = "chancadem.cbt.verify-posterior/v1"
SCHEMA_SBC = "chancadem.cbt.sbc/v1"
SCHEMA_VER = "chancadem.cbt.verify/v1"
L_DRAWS = 99
BINS = 10
VERIFY_CELLS = ("V0-real-n10", "V2-real-n10", "V0-surveys-n10")
SBC_CODE, SBC_RANK_CODE, VERIFY_CODE, VERIFY_PRED_CODE = 7000, 7001, 8000, 8001
PARAM_NAMES = [p.name for p in cb.PRIORS] + [f"log_sigma_{t}" for t in cb.TARGETS]
D_NAMES = [f"discrepancy_{t}_{term}" for t in cb.TARGETS for term in cb.DISCREPANCY_TERMS]
MAX_WORKERS = 24


def _seed(*codes: int) -> int:
    return int(np.random.SeedSequence([run_exact.SEED_ROOT, *codes]).generate_state(1)[0])


def _config(a) -> cb.Config:
    return cb.Config(walkers=a.walkers, steps=a.steps, burn=a.burn, thin=a.thin, draws=a.draws)


def _convergence(res: dict) -> dict:
    return {k: res[k] for k in ("converged", "tau_max", "ratio", "acceptance", "samples", "post_burn_steps")}


def _evenly(S: int, L: int) -> np.ndarray:
    return np.linspace(0, S - 1, L).round().astype(int)


def _truncnorm(rng, mu, sd, lo, hi) -> float:
    while True:
        x = rng.normal(mu, sd)
        if lo <= x <= hi:
            return float(x)


# ---- sbc ----
def sbc_truth(k: int) -> dict:
    """The true parameters and the data of SBC posterior k at the ten surveys' design; engine failures redrawn."""
    css, f80, _, _ = inputs.load_surveys()
    ops = [operating_from_survey(float(c), float(f)) for c, f in zip(css, f80)]
    Z = cb.design(css, f80, np.array([css.mean(), f80.mean()]), np.array([css.std(), f80.std()]))
    rng = np.random.default_rng(np.random.SeedSequence([run_exact.SEED_ROOT, SBC_CODE, k]))
    redraws = 0
    while True:
        theta = np.array([_truncnorm(rng, p.mu, p.sd, p.lo, p.hi) for p in cb.PRIORS]
                         + [_truncnorm(rng, math.log(cb.NOISE_MEDIAN[t]), cb.NOISE_LOG_SD, *cb.NOISE_LOG_BOUNDS)
                            for t in cb.TARGETS])
        d = {t: cb.DISCREPANCY_SD[t] * rng.standard_normal(3) for t in cb.TARGETS}
        eps = rng.standard_normal((2, css.size))
        try:
            tph, kw = cb.simulate(ops, cb.scalars_of(theta))
        except (ArithmeticError, ValueError):
            redraws += 1
            continue
        if not (np.all(np.isfinite(tph)) and np.all(np.isfinite(kw))):
            redraws += 1
            continue
        f = {"tph": tph, "kW": kw}
        y = {t: f[t] + Z @ d[t] + math.exp(theta[cb.N_ENGINE + j]) * eps[j] for j, t in enumerate(cb.TARGETS)}
        return {"css": css, "f80": f80, "theta": theta, "d": d, "y": y, "redraws": redraws}


def sbc_posterior(k: int, cfg: cb.Config) -> dict:
    t0 = time.perf_counter()
    tr = sbc_truth(k)
    spec = {"css": tr["css"].tolist(), "f80": tr["f80"].tolist(), "tph": tr["y"]["tph"].tolist(),
            "kW": tr["y"]["kW"].tolist(), "held": None, "seed": _seed(SBC_CODE, k, 1), "config": asdict(cfg)}
    res = cb.fit_inline(spec)
    chain = np.array(res["theta"])
    S = chain.shape[0]
    idx = _evenly(S, L_DRAWS)
    rng = np.random.default_rng(np.random.SeedSequence([run_exact.SEED_ROOT, SBC_RANK_CODE, k]))
    ranks = {nm: theory.sbc_rank(tr["theta"][j], chain[idx, j], rng) for j, nm in enumerate(PARAM_NAMES)}
    for t in cb.TARGETS:
        ds = np.array(res["d_samples"][t])
        di = idx if ds.shape[0] == S else _evenly(ds.shape[0], L_DRAWS)
        for j, term in enumerate(cb.DISCREPANCY_TERMS):
            ranks[f"discrepancy_{t}_{term}"] = theory.sbc_rank(tr["d"][t][j], ds[di, j], rng)
    prob = cb._Problem(tr["css"], tr["f80"], tr["y"], np.arange(tr["css"].size))

    def loglik(th):
        return prob.log_prob(th) - cb.log_prior(th)
    ll_true = loglik(tr["theta"])
    ll_draws = np.array([loglik(chain[i]) for i in idx])
    return {"schema": SCHEMA_SBC_POST, "posterior": k, "config": asdict(cfg), "L": L_DRAWS,
            "truth": {"theta": dict(zip(PARAM_NAMES, tr["theta"].tolist())),
                      "discrepancy": {t: tr["d"][t].tolist() for t in cb.TARGETS}},
            "redraws_engine_failure": tr["redraws"], "ranks": ranks,
            "rank_loglik": theory.sbc_rank(ll_true, ll_draws, rng), "loglik_true": ll_true,
            "d_samples_aligned": all(len(res["d_samples"][t]) == S for t in cb.TARGETS),
            "convergence": _convergence(res), "wall_seconds": time.perf_counter() - t0}


# ---- verify ----
def verify_context(cells, cache, workers: int = 1, pool_size: int = pools.POOL_SIZE) -> run_exact.Context:
    objs = [c for c in run_exact.cell_list() if c.name in set(cells)]
    return run_exact.Context.build(objs, cache, workers, pool_size)


def verify_replicate(ctx: run_exact.Context, name: str, rep: int, n_test: int = 50, n_test_exact: int = 200) -> dict:
    """run_exact's replicate ``rep`` of the cell, its test points cut to the first ``n_test``."""
    cell = next(c for c in run_exact.cell_list() if c.name == name)
    data = run_exact.replicate_data(ctx, cell, run_exact.cell_index(name), rep, n_test_exact)
    for k in ("test_idx", "test_pts"):
        data[k] = data[k][:n_test]
    for k in ("y_test", "mu_test"):
        data[k] = data[k][:, :n_test]
    return data


def verify_posterior(ctx, name: str, rep: int, cfg: cb.Config, n_test: int, n_test_exact: int, pred_draws: int) -> dict:
    t0 = time.perf_counter()
    cell = next(c for c in run_exact.cell_list() if c.name == name)
    data = verify_replicate(ctx, name, rep, n_test, n_test_exact)
    css, f80 = data["train_pts"][:, 0], data["train_pts"][:, 1]
    y = {t: data["y_train"][j] for j, t in enumerate(cb.TARGETS)}
    spec = {"css": css.tolist(), "f80": f80.tolist(), "tph": y["tph"].tolist(), "kW": y["kW"].tolist(), "held": None,
            "seed": _seed(VERIFY_CODE, run_exact.cell_index(name), rep), "config": asdict(cfg)}
    res = cb.fit_inline(spec)
    chain = np.array(res["theta"])
    prob = cb._Problem(css, f80, y, np.arange(css.size))
    tp = data["test_pts"]
    Zh = cb.design(tp[:, 0], tp[:, 1], prob.mu, prob.sd)
    ops = [operating_from_survey(float(c), float(f)) for c, f in tp[:, :2]]
    rng = np.random.default_rng(np.random.SeedSequence([run_exact.SEED_ROOT, VERIFY_PRED_CODE, run_exact.cell_index(name), rep]))
    means = {t: [] for t in cb.TARGETS}
    draws = {t: [] for t in cb.TARGETS}
    failed = 0
    for i in _evenly(chain.shape[0], pred_draws):
        th = chain[i]
        try:
            cond = prob.conditional(th, None)
            tph, kw = cb.simulate(ops, cb.scalars_of(th))
        except (ArithmeticError, ValueError):
            failed += 1
            continue
        fh = {"tph": tph, "kW": kw}
        for t in cb.TARGETS:
            _, noise, d_mean, d_cov = cond[t]
            m = fh[t] + Zh @ d_mean
            v = noise + np.einsum("ij,jk,ik->i", Zh, d_cov, Zh)
            means[t].append(m)
            draws[t].append(m[None, :] + np.sqrt(v)[None, :] * rng.standard_normal((cfg.draws, m.size)))
    outputs = {}
    for j, t in enumerate(cb.TARGETS):
        yt = data["y_test"][j]
        mean = np.mean(means[t], axis=0)
        mix = np.concatenate(draws[t], axis=0)
        lo, hi = np.quantile(mix, 0.1, axis=0), np.quantile(mix, 0.9, axis=0)
        row = {"y_test": yt.tolist(), "mu_test": data["mu_test"][j].tolist(),
               "sampler": {"mean": mean.tolist(), "lo80": lo.tolist(), "hi80": hi.tolist(),
                           "mse": float(np.mean((mean - yt) ** 2)), "coverage80": float(np.mean((yt >= lo) & (yt <= hi))),
                           "width": float(np.mean(hi - lo)), "mape_pct": float(np.mean(100 * np.abs(mean - yt) / np.abs(yt)))},
               "exact": {}}
        if t in cell.outputs:
            preds, _ = run_exact.exact_predictions(ctx, cell, data, t)
            for p, (m, h, _) in preds.items():
                row["exact"][p] = {"mse": float(np.mean((m - yt) ** 2)),
                                   "coverage80": float(np.mean((yt >= m - h) & (yt <= m + h))),
                                   "width": float(np.mean(2 * h)), "mape_pct": float(np.mean(100 * np.abs(m - yt) / np.abs(yt)))}
        outputs[t] = row
    return {"schema": SCHEMA_VER_POST, "cell": name, "replicate": rep, "n": int(css.size), "n_test": int(tp.shape[0]),
            "config": asdict(cfg), "pred_draws": pred_draws, "pred_draws_failed": failed,
            "convergence": _convergence(res), "outputs": outputs, "wall_seconds": time.perf_counter() - t0}


# ---- worker side ----
_CTX = None


def _init(ctx) -> None:
    global _CTX
    engines._blas_one_thread()
    _CTX = ctx


def _job(args: tuple) -> dict:
    mode, key, path, opts = args
    cfg = cb.Config(**opts["config"])
    if mode == "sbc":
        doc = sbc_posterior(key, cfg)
    else:
        name, rep = key
        doc = verify_posterior(_CTX, name, rep, cfg, opts["n_test"], opts["n_test_exact"], opts["pred_draws"])
    run_exact.write_json(Path(path), doc)
    return {"path": path, "wall_seconds": doc["wall_seconds"], **{k: doc["convergence"][k] for k in ("tau_max", "converged")}}


def run_mode(a) -> int:
    cfg = _config(a)
    out = Path(a.out) / a.mode
    if a.mode == "sbc":
        keys = list(range(a.n))
        path_of = {k: out / f"sbc-{k:04d}.json" for k in keys}
    else:
        cells = a.cells or list(VERIFY_CELLS)
        keys = [(c, r) for c in cells for r in range(a.reps)]
        path_of = {k: out / f"{k[0]}-r{k[1]:04d}.json" for k in keys}
    todo = [k for k in keys if not path_of[k].exists()]
    if a.pilot:
        todo = todo[:1]
    elif a.chunk is not None:
        todo = todo[:a.chunk]
    print(f"{a.mode}: {len(keys) - len([k for k in keys if not path_of[k].exists()])} done, {len(todo)} to run", flush=True)
    if not todo:
        return 0
    ctx = None
    workers = max(1, min(a.workers, MAX_WORKERS, len(todo)))
    # set before any worker process is spawned, so each one starts with one BLAS thread (an initializer runs after the
    # worker has imported numpy, too late for the thread pool)
    engines._blas_one_thread()
    if a.mode == "verify":
        if not a.cache:
            raise SystemExit("verify needs --cache (the exact route's pools)")
        ctx = verify_context(sorted({k[0] for k in todo}), a.cache, workers, a.pool_size)
    opts = {"config": asdict(cfg), "n_test": a.n_test, "n_test_exact": a.n_test_exact, "pred_draws": a.pred_draws}
    jobs = [(a.mode, k, str(path_of[k]), opts) for k in todo]
    t0 = time.perf_counter()
    if workers == 1:
        _init(ctx)
        done = [_job(j) for j in jobs]
    else:
        with ProcessPoolExecutor(max_workers=workers, initializer=_init, initargs=(ctx,)) as ex:
            done = list(ex.map(_job, jobs))
    wall = time.perf_counter() - t0
    for d in done:
        print(f"{Path(d['path']).name}: {d['wall_seconds']:.1f} s, tau_max {d['tau_max']:.1f}, converged {d['converged']}",
              flush=True)
    print(f"{a.mode}: {len(done)} posteriors in {wall:.1f} s on {workers} workers", flush=True)
    return 0


# ---- summarize ----
def _mean_mcse(v) -> dict:
    v = np.asarray(v, float)
    return {"mean": float(v.mean()), "mcse": float(v.std(ddof=1) / math.sqrt(v.size)) if v.size > 1 else None}


def summarize(a) -> int:
    out, data = Path(a.out), Path(a.data)
    sbc_docs = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((out / "sbc").glob("sbc-*.json"))]
    ver_docs = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((out / "verify").glob("*-r*.json"))]
    meta = {"engine_version": inputs.engine_version(), "inputs_sha256": inputs.digests(), "code_commit": inputs.code_commit()}
    def rank_tests(docs: list[dict]) -> dict:
        params = {}
        for nm in PARAM_NAMES + D_NAMES + ["loglik"]:
            ranks = np.array([d["rank_loglik"] if nm == "loglik" else d["ranks"][nm] for d in docs], int)
            if ranks.size == 0:
                continue
            chi2, p = theory.rank_uniformity(ranks, L_DRAWS, a.bins)
            params[nm] = {"histogram": theory.rank_histogram(ranks, L_DRAWS, a.bins).tolist(), "chi2": chi2, "p_value": p}
        return params
    params = rank_tests(sbc_docs)
    # the chains that met the convergence criterion, tested on their own: a check that the shorter-than-criterion chains do not
    # carry the result (a subset chosen by a property of the data, so it is a check, not the test)
    params_converged = rank_tests([d for d in sbc_docs if d["convergence"]["converged"]])
    taus = [d["convergence"]["tau_max"] for d in sbc_docs]
    sbc = {"schema": SCHEMA_SBC, "n_posteriors": len(sbc_docs), "L": L_DRAWS, "bins": a.bins,
           "config": sbc_docs[0]["config"] if sbc_docs else None,
           "converged": int(sum(d["convergence"]["converged"] for d in sbc_docs)),
           "redraws_engine_failure": int(sum(d["redraws_engine_failure"] for d in sbc_docs)),
           "wall_seconds_mean": float(np.mean([d["wall_seconds"] for d in sbc_docs])) if sbc_docs else None,
           "tau_max_max": float(max(taus)) if taus else None,
           "tau_max_median": float(np.median(taus)) if taus else None,
           "ranks": params, "ranks_converged": params_converged,
           "test": f"chi-square of the {a.bins}-bin rank histogram against uniform (special.chi2_sf)", **meta}
    cells = {}
    for name in sorted({d["cell"] for d in ver_docs}):
        docs = [d for d in ver_docs if d["cell"] == name]
        row = {"n_posteriors": len(docs), "converged": int(sum(d["convergence"]["converged"] for d in docs)),
               "wall_seconds_mean": float(np.mean([d["wall_seconds"] for d in docs])), "outputs": {}}
        for t in cb.TARGETS:
            docs_t = [d for d in docs if d["outputs"][t]["exact"]]
            if not docs_t:
                continue
            s_mse = [d["outputs"][t]["sampler"]["mse"] for d in docs_t]
            o = {"sampler": {k: _mean_mcse([d["outputs"][t]["sampler"][k] for d in docs_t])
                             for k in ("mse", "coverage80", "width", "mape_pct")},
                 "exact": {p: {k: _mean_mcse([d["outputs"][t]["exact"][p][k] for d in docs_t])
                               for k in ("mse", "coverage80", "width", "mape_pct")}
                           for p in docs_t[0]["outputs"][t]["exact"]},
                 "paired_mse": {f"sampler_minus_{p}": _mean_mcse(np.array(s_mse)
                                                                  - np.array([d["outputs"][t]["exact"][p]["mse"] for d in docs_t]))
                                for p in ("cb_oracle", "cb_ko", "ls")},
                 # the band against the one built with the true scalars and the true noise scale, on the same replicates
                 "paired_coverage80": {"sampler_minus_cb_oracle": _mean_mcse(np.array(
                     [d["outputs"][t]["sampler"]["coverage80"] - d["outputs"][t]["exact"]["cb_oracle"]["coverage80"]
                      for d in docs_t]))},
                 "width_ratio": {"sampler_over_cb_oracle": _mean_mcse(np.array(
                     [d["outputs"][t]["sampler"]["width"] / d["outputs"][t]["exact"]["cb_oracle"]["width"] for d in docs_t]))}}
            row["outputs"][t] = o
        cells[name] = row
    # pooled over every verification posterior: each posterior's average over its outputs, so the two outputs of one posterior
    # (fitted together) count as one observation in the Monte Carlo standard error
    def pooled(fn) -> dict:
        vals = [np.mean([fn(d["outputs"][t]) for t in cb.TARGETS if d["outputs"][t]["exact"]]) for d in ver_docs]
        return _mean_mcse(np.array(vals))
    pool = {"coverage80_sampler": pooled(lambda o: o["sampler"]["coverage80"]),
            "coverage80_cb_oracle": pooled(lambda o: o["exact"]["cb_oracle"]["coverage80"]),
            "coverage80_sampler_minus_cb_oracle": pooled(lambda o: o["sampler"]["coverage80"]
                                                         - o["exact"]["cb_oracle"]["coverage80"]),
            "width_ratio_sampler_over_cb_oracle": pooled(lambda o: o["sampler"]["width"] / o["exact"]["cb_oracle"]["width"])} \
        if ver_docs else None
    ver = {"schema": SCHEMA_VER, "n_posteriors": len(ver_docs), "cells": cells, "pooled": pool,
           "config": ver_docs[0]["config"] if ver_docs else None, **meta}
    run_exact.write_json(data / "sbc.json", sbc)
    run_exact.write_json(data / "verify.json", ver)
    print(f"summarized {len(sbc_docs)} SBC and {len(ver_docs)} verification posteriors", flush=True)
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="mode", required=True)
    for mode in ("sbc", "verify"):
        p = sub.add_parser(mode)
        p.add_argument("--out", required=True, help="results go to <out>/<mode>/")
        p.add_argument("--workers", type=int, default=MAX_WORKERS)
        p.add_argument("--chunk", type=int, default=None)
        p.add_argument("--pilot", action="store_true")
        p.add_argument("--walkers", type=int, default=20)
        p.add_argument("--steps", type=int, default=4000)
        p.add_argument("--burn", type=int, default=1000)
        p.add_argument("--thin", type=int, default=10)
        p.add_argument("--draws", type=int, default=20)
        p.add_argument("--cache", default=None)
        p.add_argument("--pool-size", type=int, default=pools.POOL_SIZE)
        p.add_argument("--n", type=int, default=200, help="sbc: the number of posteriors")
        p.add_argument("--cells", nargs="*", default=None, help="verify: the cells")
        p.add_argument("--reps", type=int, default=50, help="verify: replicates per cell")
        p.add_argument("--n-test", type=int, default=50, help="verify: test points per replicate")
        p.add_argument("--n-test-exact", type=int, default=200, help="verify: run_exact's test points per replicate")
        p.add_argument("--pred-draws", type=int, default=200, help="verify: retained draws for the predictive")
    s = sub.add_parser("summarize")
    s.add_argument("--out", required=True)
    s.add_argument("--data", required=True)
    s.add_argument("--bins", type=int, default=BINS, help="rank-histogram bins; must divide L + 1 = 100 (Talts et al.: N/bins of 20 or more)")
    a = ap.parse_args(argv)
    if a.mode == "summarize":
        return summarize(a)
    return run_mode(a)


if __name__ == "__main__":
    raise SystemExit(main())
