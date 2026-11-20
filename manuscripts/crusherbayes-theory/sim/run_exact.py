#!/usr/bin/env python3
"""The exact-route study of the CrusherBayes theory: on virtual plants with a known truth, how the closed-form predictors
(CrusherBayes given its scalars, its linearized variants, least squares, the engine alone) predict held-out points, beside
the theory's expected squared error for each replicate's design.

Cells (``cell_list``, sorted by name, the index of a cell in that list is its seed index): the plants V0 (both outputs),
V1(alpha, kappa) (power), V2 (both outputs, oracle scalars by the L2 projection of Tuo and Wu 2015) and C-cap (V2's
throughput with the analytic engines "affine", "rocha", "rocha_half"), each on the designs real (n = 10), surveys, wide and
extrapolation (n in 10, 20, 40, 80, 160). Per replicate (seed ``SeedSequence([20261119, cell_index, replicate])``): the
training points and ``--n-test`` test points from the pools (``pools.draw_design``), the observations, every predictor's
mean and band at the test points, its squared and absolute percentage errors, band hits and widths, and the theory's
expected squared error of cb_oracle, cb_nominal, ls and line. Per cell a summary ``<out>/exact/<cell>.json`` (schema
``chancadem.cbt.exact/v1``) and the per-replicate arrays (float32 .npz) under ``<cache>/exact/``. Resumable: a cell whose
summary exists is skipped unless ``--force``. The results do not depend on the worker count or the completion order.

Run:  .venv-pipeline/Scripts/python.exe manuscripts/crusherbayes-theory/sim/run_exact.py --reps 1900 \
          --out manuscripts/crusherbayes-theory/data --cache D:/_Training/cbt [--workers 24] [--only CELL ...] [--force]
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import engines  # noqa: E402
import inputs  # noqa: E402
import plants  # noqa: E402
import pools  # noqa: E402
import predictors as pr  # noqa: E402
import theory  # noqa: E402
from pipeline.hp500 import crusherbayes as cb  # noqa: E402

SCHEMA = "chancadem.cbt.exact/v1"
SEED_ROOT = 20261119
NS = (10, 20, 40, 80, 160)
MAX_WORKERS = 24
POOL_SIZE = pools.POOL_SIZE
CHUNK = 50                    # replicates per task
IN_FLIGHT = 4                 # cells submitted ahead of the one being written
PRODUCT_PREDICTORS = ("cb_oracle", "cb_nominal", "cb_ko", "cb_orth", "cb_scaled", "ls", "line", "engine_nominal",
                      "engine_oracle", "engine_refit", "constant")
CCAP_PREDICTORS = ("cb_oracle", "cb_nominal", "cb_ko", "ls", "line", "engine_nominal", "engine_oracle", "engine_refit",
                   "constant")
THEORY_PREDICTORS = ("cb_oracle", "cb_nominal", "ls", "line")
METRICS = ("se", "ape", "hit", "width")
PRIOR_SD = np.array([p.sd for p in cb.PRIORS])
GN_MAX_IT, GN_RTOL = 20, 1e-6


@dataclass(frozen=True)
class Cell:
    name: str
    plant: str            # a key of plants.PLANTS ("V2" for C-cap)
    engine: str           # "product" or an analytic engine
    design: str
    n: int
    outputs: tuple
    predictors: tuple


def cell_list() -> list[Cell]:
    designs = [("real", 10)] + [(d, n) for d in ("surveys", "wide", "extrapolation") for n in NS]
    cells = []
    for plant, spec in plants.PLANTS.items():
        for d, n in designs:
            cells.append(Cell(f"{plant}-{d}-n{n}", plant, "product", d, n, spec["outputs"], PRODUCT_PREDICTORS))
    for kind in engines.ANALYTIC:
        for d, n in designs:
            cells.append(Cell(f"Ccap_{kind}-{d}-n{n}", "V2", kind, d, n, ("tph",), CCAP_PREDICTORS))
    return sorted(cells, key=lambda c: c.name)


def cell_index(name: str) -> int:
    return [c.name for c in cell_list()].index(name)


def pool_label(pool: str, size: int) -> str:
    return "real" if pool == "real" else f"{pool}-s{pools.POOL_SEEDS[pool]}-N{size}"


def oracle_label(cell: Cell) -> str:
    return f"l2_{pools.train_window(cell.design)}" if cell.plant == "V2" else "theta0"


@dataclass
class Context:
    """Everything a replicate needs, built once: pools, engine values and Jacobians, plant means, oracles."""
    pool_size: int
    fit: inputs.Fit
    zref: tuple
    pools: dict = field(default_factory=dict)
    eng: dict = field(default_factory=dict)
    thetas: dict = field(default_factory=dict)
    plant_means: dict = field(default_factory=dict)
    v1_basis: dict = field(default_factory=dict)
    l2: dict = field(default_factory=dict)
    q_l2: dict = field(default_factory=dict)
    pool_records: dict = field(default_factory=dict)
    extrap_idx: np.ndarray | None = None

    @classmethod
    def build(cls, cells: list[Cell], cache: Path | str, workers: int = 1, pool_size: int = POOL_SIZE) -> "Context":
        fit = inputs.load_fit()
        ctx = cls(pool_size, fit, inputs.reference_standardization())
        ctx.thetas = {"nom": cb.nominal_theta()[:cb.N_ENGINE], "theta0": fit.theta0}
        needed = set()
        for c in cells:
            needed |= {pools.train_pool(c.design), pools.test_pool(c.design), pools.train_window(c.design)}
        ex = None
        if workers > 1:
            engines._blas_one_thread()
            ex = ProcessPoolExecutor(max_workers=min(workers, MAX_WORKERS))
        try:
            for name in sorted(needed):
                raw = pools.survey_points() if name == "real" else pools.window_points(name, pool_size)
                # the Jacobian is needed at the nominal scalars only (the linearized predictors); theta_0 gives values
                evs = {lab: engines.product_cached(pool_label(name, pool_size), raw, ctx.thetas[lab], cache, workers,
                                                   jac=(lab == "nom"), executor=ex)
                       for lab in ("nom", "theta0")}
                ok = evs["nom"]["ok"] & evs["theta0"]["ok"]
                removed = int((~ok).sum())
                ctx.pool_records[name] = {"size": int(raw.shape[0]), "seed": pools.POOL_SEEDS.get(name), "removed": removed}
                if removed > 0.01 * raw.shape[0] or (name == "real" and removed):
                    raise ArithmeticError(f"pool {name}: the engine failed at {removed} of {raw.shape[0]} points")
                ctx.pools[name] = raw[ok]
                for lab, ev in evs.items():
                    ctx.eng[(name, lab)] = {k: v[ok] for k, v in ev.items()}
                ctx._raw_ok = getattr(ctx, "_raw_ok", {}) | {name: (raw, ok)}
            for w in ("surveys", "wide"):
                if w in ctx.pools:
                    zr = pools.design_matrix(ctx.pools[w], *ctx.zref)
                    ctx.v1_basis[w] = plants.V1Basis.fit(ctx.eng[(w, "theta0")]["kW"], zr)
            # the L2 projection of V2 onto the product engine, per training window that a V2 product cell uses
            for w in sorted({pools.train_window(c.design) for c in cells if c.plant == "V2" and c.engine == "product"}):
                m = plants.plant_mean("V2", ctx.pools[w], ctx.eng[(w, "theta0")], None, fit, None)
                theta, rec = l2_projection(ctx.pools[w], m, fit.sigma, ctx.thetas["nom"], pool_label(w, pool_size),
                                           cache, workers, ex)
                ctx.thetas[f"l2_{w}"], ctx.l2[w] = theta, rec
            for c in cells:
                lab = oracle_label(c)
                if c.engine != "product" or lab == "theta0":
                    continue
                for name in {pools.train_pool(c.design), pools.test_pool(c.design), pools.train_window(c.design)}:
                    if (name, lab) not in ctx.eng:
                        raw, ok = ctx._raw_ok[name]
                        ev = engines.product_cached(pool_label(name, pool_size), raw, ctx.thetas[lab], cache, workers,
                                                    jac=False, executor=ex)
                        if not np.all(ev["ok"][ok]):
                            raise ArithmeticError(f"pool {name}: the engine failed at the oracle scalars {lab}")
                        ctx.eng[(name, lab)] = {k: v[ok] for k, v in ev.items()}
        finally:
            if ex is not None:
                ex.shutdown()
        del ctx._raw_ok
        for c in cells:
            w = pools.train_window(c.design)
            for name in {pools.train_pool(c.design), pools.test_pool(c.design), w}:
                key = (c.plant, w, name)
                if key not in ctx.plant_means:
                    zr = pools.design_matrix(ctx.pools[name], *ctx.zref)
                    m = plants.plant_mean(c.plant, ctx.pools[name], ctx.eng[(name, "theta0")], zr, fit, ctx.v1_basis.get(w))
                    for k, t in enumerate(inputs.TARGETS):
                        if t in plants.PLANTS[c.plant]["outputs"] and not np.all(m[k] > 0):
                            raise ArithmeticError(f"plant {c.plant} on pool {name}: a non-positive true mean of {t}")
                    ctx.plant_means[key] = m
            if c.engine != "product" and (c.engine, w) not in ctx.q_l2:
                g = engines.analytic_shape(c.engine, ctx.pools[w])
                m = ctx.plant_means[("V2", w, w)][0]
                ctx.q_l2[(c.engine, w)] = float(m @ g / (g @ g))
        if "wide" in ctx.pools:
            ctx.extrap_idx = np.flatnonzero(~pools.in_box(ctx.pools["wide"]))
        return ctx

    def engine_on(self, cell: Cell, pool: str, t: str, which: str) -> tuple[np.ndarray, np.ndarray]:
        """(values, Jacobian) of the cell's engine on a pool for output t: ``which`` "nom" or "oracle"."""
        pts = self.pools[pool]
        if cell.engine == "product":
            lab = "nom" if which == "nom" else oracle_label(cell)
            ev = self.eng[(pool, lab)]
            return ev[t], ev.get(f"jac_{t}")
        q = engines.Q_NOM if which == "nom" else self.q_l2[(cell.engine, pools.train_window(cell.design))]
        f = engines.analytic(cell.engine, pts, q)
        return f, f[:, None]

    def prior_sd(self, cell: Cell) -> np.ndarray:
        return PRIOR_SD if cell.engine == "product" else np.array([engines.LNQ_PRIOR_SD])


def l2_projection(points, m, sigma, theta_start, label, cache, workers, executor):
    """argmin_theta sum_t sum_pool (m_t - f_t(theta))^2 / sigma_t^2 by damped Gauss-Newton (Levenberg-Marquardt damping on
    the diagonal) from ``theta_start``, inside the prior bounds; at most 20 iterations, relative tolerance 1e-6 on the
    objective. Returns theta and the record of every iteration."""
    lo = np.array([p.lo for p in cb.PRIORS])
    hi = np.array([p.hi for p in cb.PRIORS])
    sig = np.array([sigma["tph"], sigma["kW"]])

    def obj(ev):
        return float(np.sum(((m[0] - ev["tph"]) / sig[0]) ** 2) + np.sum(((m[1] - ev["kW"]) / sig[1]) ** 2))

    theta = np.array(theta_start, float)
    ev = engines.product_cached(label, points, theta, cache, workers, executor=executor)
    S = obj(ev)
    damp = 1e-3
    rec = {"start": theta.tolist(), "objective_start": S, "iterations": [], "converged": False,
           "max_iterations": GN_MAX_IT, "rtol": GN_RTOL}
    for it in range(GN_MAX_IT):
        r = np.concatenate([(m[0] - ev["tph"]) / sig[0], (m[1] - ev["kW"]) / sig[1]])
        Jw = np.vstack([ev["jac_tph"] / sig[0], ev["jac_kW"] / sig[1]])
        H, g = Jw.T @ Jw, Jw.T @ r
        accepted = False
        for _ in range(15):
            D = np.diag(np.diag(H) + 1e-12 * np.max(np.diag(H)))
            cand = np.clip(theta + np.linalg.solve(H + damp * D, g), lo, hi)
            evc = engines.product_cached(label, points, cand, cache, workers, jac=False, executor=executor)
            if np.all(evc["ok"]) and obj(evc) < S:
                accepted = True
                break
            damp *= 10.0
        if not accepted:
            rec["converged"] = True
            rec["stop"] = "no damped step decreases the objective"
            break
        S_new = obj(evc)
        rel = (S - S_new) / S
        theta = cand
        ev = engines.product_cached(label, points, theta, cache, workers, executor=executor)
        rec["iterations"].append({"iteration": it + 1, "objective": S_new, "relative_decrease": rel, "damping": damp,
                                  "theta": theta.tolist()})
        S = S_new
        damp = max(damp / 10.0, 1e-9)
        if rel < GN_RTOL:
            rec["converged"] = True
            rec["stop"] = "relative decrease below the tolerance"
            break
    else:
        rec["stop"] = "iteration cap"
    rec["objective"] = S
    rec["theta"] = theta.tolist()
    rec["theta_natural"] = {p.name: (math.exp(theta[i]) if p.log else float(theta[i])) for i, p in enumerate(cb.PRIORS)}
    return theta, rec


def replicate_data(ctx: Context, cell: Cell, idx: int, rep: int, n_test: int) -> dict:
    """The training and test points and observations of one replicate (shared with run_sampler verify)."""
    rng = np.random.default_rng(np.random.SeedSequence([SEED_ROOT, idx, rep]))
    trp, tsp, w = pools.train_pool(cell.design), pools.test_pool(cell.design), pools.train_window(cell.design)
    cand = ctx.extrap_idx if cell.design == "extrapolation" else np.arange(ctx.pools[tsp].shape[0])
    train, test, redraws = pools.draw_design(rng, cell.design, cell.n, n_test, ctx.pools[trp], cand)
    sig = np.array([ctx.fit.sigma["tph"], ctx.fit.sigma["kW"]])
    m_tr = ctx.plant_means[(cell.plant, w, trp)][:, train]
    m_te = ctx.plant_means[(cell.plant, w, tsp)][:, test]
    y_train = m_tr + sig[:, None] * rng.standard_normal((2, train.size))
    y_test = m_te + sig[:, None] * rng.standard_normal((2, test.size))
    return {"train_idx": train, "test_idx": test, "redraws": redraws, "train_pool": trp, "test_pool": tsp,
            "train_pts": ctx.pools[trp][train], "test_pts": ctx.pools[tsp][test],
            "mu_train": m_tr, "mu_test": m_te, "y_train": y_train, "y_test": y_test}


def exact_predictions(ctx: Context, cell: Cell, data: dict, t: str) -> dict[str, tuple]:
    """Every predictor of the cell for output t on one replicate: name -> (mean, half-width, variance)."""
    k = inputs.TARGETS.index(t)
    tr, te = data["train_idx"], data["test_idx"]
    mu, sd = pools.standardization(data["train_pts"])
    Z, Zh = pools.design_matrix(data["train_pts"], mu, sd), pools.design_matrix(data["test_pts"], mu, sd)
    y = data["y_train"][k]
    sigma, tau = ctx.fit.sigma[t], cb.DISCREPANCY_SD[t]
    fn_tr, Jn_tr = ctx.engine_on(cell, data["train_pool"], t, "nom")
    fn_te, Jn_te = ctx.engine_on(cell, data["test_pool"], t, "nom")
    fo_tr, _ = ctx.engine_on(cell, data["train_pool"], t, "oracle")
    fo_te, _ = ctx.engine_on(cell, data["test_pool"], t, "oracle")
    fn, Jn, fnh, Jnh = fn_tr[tr], Jn_tr[tr], fn_te[te], Jn_te[te]
    fo, foh = fo_tr[tr], fo_te[te]
    psd = ctx.prior_sd(cell)
    out = {"cb_oracle": pr.cb_fixed(Z, y, fo, Zh, foh, sigma, tau),
           "cb_nominal": pr.cb_fixed(Z, y, fn, Zh, fnh, sigma, tau),
           "cb_ko": pr.cb_linear(Z, y, fn, Jn, Zh, fnh, Jnh, sigma, tau, psd, kind="ko")}
    if "cb_orth" in cell.predictors:
        out["cb_orth"] = pr.cb_linear(Z, y, fn, Jn, Zh, fnh, Jnh, sigma, tau, psd, kind="orth")
        out["cb_scaled"] = pr.cb_linear(Z, y, fn, Jn, Zh, fnh, Jnh, sigma, tau, psd, kind="scaled")
    out["ls"] = pr.least_squares(Z, y, Zh)
    out["line"] = pr.least_squares(Z[:, :2], y, Zh[:, :2])
    out["engine_nominal"] = pr.engine_band(fnh, sigma)
    out["engine_oracle"] = pr.engine_band(foh, sigma)
    out["engine_refit"] = pr.engine_refit(Jn, y, fn, Jnh, fnh, sigma, psd)
    out["constant"] = pr.constant(y, Zh.shape[0])
    theo = {"cb_oracle": theory.expected_sq_error(Z, data["mu_train"][k], fo, Zh, data["mu_test"][k], foh, sigma,
                                                  sigma ** 2 / tau ** 2),
            "cb_nominal": theory.expected_sq_error(Z, data["mu_train"][k], fn, Zh, data["mu_test"][k], fnh, sigma,
                                                   sigma ** 2 / tau ** 2),
            "ls": theory.expected_sq_error_ls(Z, data["mu_train"][k], Zh, data["mu_test"][k], sigma),
            "line": theory.expected_sq_error_ls(Z[:, :2], data["mu_train"][k], Zh[:, :2], data["mu_test"][k], sigma)}
    return {p: out[p] for p in cell.predictors}, theo


def run_replicate(ctx: Context, cell: Cell, idx: int, rep: int, n_test: int) -> dict:
    data = replicate_data(ctx, cell, idx, rep, n_test)
    no, npred = len(cell.outputs), len(cell.predictors)
    mean = np.empty((no, npred, n_test))
    half = np.empty((no, npred, n_test))
    metrics = np.empty((no, npred, len(METRICS)))
    theo = np.empty((no, len(THEORY_PREDICTORS)))
    nonpos = 0
    for a, t in enumerate(cell.outputs):
        k = inputs.TARGETS.index(t)
        preds, th = exact_predictions(ctx, cell, data, t)
        yt = data["y_test"][k]
        nonpos += int(np.sum(yt <= 0))
        for b, p in enumerate(cell.predictors):
            m, h, _ = preds[p]
            mean[a, b], half[a, b] = m, h
            metrics[a, b] = [np.mean((m - yt) ** 2), np.mean(100.0 * np.abs(m - yt) / np.abs(yt)),
                             np.mean((yt >= m - h) & (yt <= m + h)), np.mean(2 * h)]
        theo[a] = [np.mean(th[p]) for p in THEORY_PREDICTORS]
    return {"train_idx": data["train_idx"], "test_idx": data["test_idx"], "redraws": data["redraws"],
            "y_train": data["y_train"], "y_test": data["y_test"], "mu_test": data["mu_test"],
            "mean": mean, "half": half, "metrics": metrics, "theory": theo, "nonpositive_y": nonpos}


# ---- worker side ----
_CTX: Context | None = None


def _init_worker(ctx: Context) -> None:
    global _CTX
    engines._blas_one_thread()
    _CTX = ctx


F32 = ("y_train", "y_test", "mu_test", "mean", "half")


def stack(reps: list[dict]) -> dict:
    """Replicate dicts to arrays with a leading replicate axis (per-test arrays float32, metrics float64)."""
    out = {"train_idx": np.stack([r["train_idx"] for r in reps]).astype(np.int32),
           "test_idx": np.stack([r["test_idx"] for r in reps]).astype(np.int32),
           "redraws": np.array([r["redraws"] for r in reps], np.int32),
           "nonpositive_y": np.array([r["nonpositive_y"] for r in reps], np.int32),
           "metrics": np.stack([r["metrics"] for r in reps]), "theory": np.stack([r["theory"] for r in reps])}
    for k in F32:
        out[k] = np.stack([r[k] for r in reps]).astype(np.float32)
    return out


def concat(parts: list[dict]) -> dict:
    return {k: np.concatenate([p[k] for p in parts]) for k in parts[0]}


def _task(args: tuple[str, int, int, int]) -> dict:
    name, lo, hi, n_test = args
    cell = next(c for c in cell_list() if c.name == name)
    idx = cell_index(name)
    return stack([run_replicate(_CTX, cell, idx, r, n_test) for r in range(lo, hi)])


def replicate_cache_path(cache: Path | str, name: str, reps: int, n_test: int, pool_size: int) -> Path:
    return Path(cache) / "exact" / f"{name}__r{reps}_t{n_test}_p{pool_size}.npz"


def _mean_mcse(v: np.ndarray) -> tuple[float, float]:
    v = np.asarray(v, float)
    return float(v.mean()), float(v.std(ddof=1) / math.sqrt(v.size)) if v.size > 1 else math.nan


def summarize_cell(ctx: Context, cell: Cell, arr: dict, n_test: int) -> dict:
    metrics = arr["metrics"]                                  # (R, outputs, predictors, 4)
    theo = arr["theory"]                                      # (R, outputs, 4)
    R = metrics.shape[0]
    w = pools.train_window(cell.design)
    doc: dict = {"schema": SCHEMA, "cell": cell.name, "cell_index": cell_index(cell.name), "plant": cell.plant,
                 "engine": cell.engine, "design": cell.design, "n": cell.n, "outputs": list(cell.outputs),
                 "predictors": list(cell.predictors), "reps": R, "n_test": n_test, "train_window": w,
                 "train_pool": pools.train_pool(cell.design), "test_pool": pools.test_pool(cell.design),
                 "pool_size": ctx.pool_size, "pools": {k: ctx.pool_records[k] for k in sorted(ctx.pool_records)
                                                       if k in {pools.train_pool(cell.design), pools.test_pool(cell.design), w}},
                 "seed": f"numpy.random.SeedSequence([{SEED_ROOT}, cell_index, replicate])",
                 "redraws_ill_conditioned": int(arr["redraws"].sum()),
                 "nonpositive_measured_test_values": int(arr["nonpositive_y"].sum()),
                 "sigma": {t: ctx.fit.sigma[t] for t in cell.outputs},
                 "tau": {t: cb.DISCREPANCY_SD[t] for t in cell.outputs},
                 "engine_version": inputs.engine_version(), "inputs_sha256": inputs.digests(),
                 "code_commit": inputs.code_commit(), "predictors_summary": {}, "paired": {}, "theory": {},
                 "theory_z": {}, "fixed_design": {}}
    for a, t in enumerate(cell.outputs):
        ps, pair, th = {}, {}, {}
        for b, p in enumerate(cell.predictors):
            se, ape, hit, width = (metrics[:, a, b, j] for j in range(4))
            mse, mse_se = _mean_mcse(se)
            rmse = math.sqrt(mse)
            ps[p] = {"mse": mse, "mse_mcse": mse_se, "rmse": rmse, "rmse_mcse": mse_se / (2 * rmse),
                     "mape_pct": _mean_mcse(ape)[0], "mape_mcse": _mean_mcse(ape)[1],
                     "coverage80": _mean_mcse(hit)[0], "coverage80_mcse": _mean_mcse(hit)[1],
                     "width": _mean_mcse(width)[0], "width_mcse": _mean_mcse(width)[1]}
            pair[p] = {}
            for ref in ("ls", "line"):
                d = se - metrics[:, a, cell.predictors.index(ref), 0]
                m_, s_ = _mean_mcse(d)
                pair[p][f"vs_{ref}"] = {"mean": m_, "mcse": s_}
        for j, p in enumerate(THEORY_PREDICTORS):
            sim = metrics[:, a, cell.predictors.index(p), 0]
            d = sim - theo[:, a, j]
            m_, s_ = _mean_mcse(d)
            z = m_ / s_ if s_ > 0 else 0.0
            th[p] = {"theory_mse": float(theo[:, a, j].mean()), "sim_mse": float(sim.mean()), "diff_mean": m_,
                     "diff_mcse": s_, "z": z}
            doc["theory_z"][f"{t}/{p}"] = z
        doc["predictors_summary"][t] = ps
        doc["paired"][t] = pair
        doc["theory"][t] = th
        # the fixed-design terms on the training window's pool (its own standardization) with n the cell's n
        Zp = pools.design_matrix(ctx.pools[w], *pools.standardization(ctx.pools[w]))
        mu_p = ctx.plant_means[(cell.plant, w, w)][inputs.TARGETS.index(t)]
        sigma, lam = ctx.fit.sigma[t], ctx.fit.sigma[t] ** 2 / cb.DISCREPANCY_SD[t] ** 2
        doc["fixed_design"][t] = {which: theory.fixed_design_terms(Zp, mu_p, ctx.engine_on(cell, w, t, which)[0], sigma,
                                                                    lam, cell.n)
                                  for which in ("oracle", "nom")}
    if cell.engine == "product":
        lab = oracle_label(cell)
        th = ctx.thetas[lab]
        doc["oracle"] = {"label": lab, "theta_sampled": {p.name: float(th[i]) for i, p in enumerate(cb.PRIORS)},
                         "theta_natural": {p.name: (math.exp(th[i]) if p.log else float(th[i])) for i, p in enumerate(cb.PRIORS)},
                         "l2_projection": ctx.l2.get(w) if cell.plant == "V2" else None}
    else:
        doc["oracle"] = {"label": "q_l2", "q_l2": ctx.q_l2[(cell.engine, w)], "q_nominal": engines.Q_NOM,
                         "l2_projection": "closed form <m, g>/<g, g> over the training window's pool"}
    return doc


def _jsonable(o):
    if isinstance(o, dict):
        return {str(k): _jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_jsonable(v) for v in o]
    if isinstance(o, (np.floating, float)):
        f = float(o)
        return f if math.isfinite(f) else None
    if isinstance(o, (np.integer,)):
        return int(o)
    return o


def write_json(path: Path, doc: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(_jsonable(doc), indent=1) + "\n", encoding="utf-8", newline="\n")
    os.replace(tmp, path)


def save_arrays(path: Path, arr: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.stem + ".tmp.npz")
    np.savez(tmp, **{k: (v.astype(np.float32) if k in ("metrics", "theory") else v) for k, v in arr.items()})
    os.replace(tmp, path)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--reps", type=int, default=1900)
    ap.add_argument("--n-test", type=int, default=200)
    ap.add_argument("--out", required=True, help="the data root: summaries go to <out>/exact/<cell>.json")
    ap.add_argument("--cache", required=True, help="engine caches and per-replicate arrays")
    ap.add_argument("--workers", type=int, default=MAX_WORKERS)
    ap.add_argument("--pool-size", type=int, default=pools.POOL_SIZE)
    ap.add_argument("--only", nargs="*", default=None, help="cell names (default: every cell)")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args(argv)
    workers = max(1, min(a.workers, MAX_WORKERS))
    out = Path(a.out) / "exact"
    every = cell_list()
    if a.only:
        unknown = set(a.only) - {c.name for c in every}
        if unknown:
            raise SystemExit(f"unknown cells: {sorted(unknown)}")
    cells = [c for c in every if (a.only is None or c.name in a.only)]
    todo = [c for c in cells if a.force or not (out / f"{c.name}.json").exists()]
    for c in cells:
        if c not in todo:
            print(f"{c.name}: exists, skipped", flush=True)
    if not todo:
        return 0
    t0 = time.perf_counter()
    ctx = Context.build(todo, a.cache, workers, a.pool_size)
    t_ctx = time.perf_counter() - t0
    print(f"context built in {t_ctx:.1f} s (pools {ctx.pool_records})", flush=True)
    tasks = {c.name: [(c.name, lo, min(lo + CHUNK, a.reps), a.n_test) for lo in range(0, a.reps, CHUNK)] for c in todo}
    if workers == 1:
        _init_worker(ctx)
        for c in todo:
            _finish(ctx, c, concat([_task(t) for t in tasks[c.name]]), a, out)
    else:
        # a bounded window of cells in flight, so finished results never pile up in memory
        with ProcessPoolExecutor(max_workers=workers, initializer=_init_worker, initargs=(ctx,)) as ex:
            pending: list = []
            queue = list(todo)
            while queue or pending:
                while queue and len(pending) < IN_FLIGHT:
                    c = queue.pop(0)
                    pending.append((c, [ex.submit(_task, t) for t in tasks[c.name]]))
                c, futs = pending.pop(0)
                _finish(ctx, c, concat([f.result() for f in futs]), a, out)
    wall = time.perf_counter() - t0
    print(f"{len(todo)} cells in {wall:.1f} s ({workers} workers)", flush=True)
    log = Path(a.cache) / "exact" / "run_log.jsonl"
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps({"cells": len(todo), "reps": a.reps, "n_test": a.n_test, "workers": workers,
                             "pool_size": a.pool_size, "context_seconds": round(t_ctx, 1), "wall_seconds": round(wall, 1),
                             "time": time.strftime("%Y-%m-%dT%H:%M:%S")}) + "\n")
    return 0


def _finish(ctx: Context, cell: Cell, arr: dict, a, out: Path) -> None:
    save_arrays(replicate_cache_path(a.cache, cell.name, a.reps, a.n_test, a.pool_size), arr)
    doc = summarize_cell(ctx, cell, arr, a.n_test)
    write_json(out / f"{cell.name}.json", doc)
    zmax = max(abs(z) for z in doc["theory_z"].values())
    print(f"{cell.name}: done, max |z| {zmax:.2f}", flush=True)


if __name__ == "__main__":
    raise SystemExit(main())
