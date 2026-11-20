"""The engines of the CrusherBayes theory study on sets of operating points.

Product engine: ``pipeline.model.crusher.evaluate`` at the eight HP500 scalars of a sampled vector (``crusherbayes.
scalars_of``), on the operating point ``operating_from_survey(CSS, f80)`` with its speed replaced by the point's speed. Per
point: throughput (t/h), power (kW), P80 (mm), and, with ``jac=True``, their Jacobians in the sampled scale by central
differences with step ``STEP`` = 1e-3 (as ``manuscripts/crusherbayes/analysis/theory_check.py``): 17 evaluations per
point. An evaluation that raises ArithmeticError or ValueError, or returns a non-finite value, marks the point not ``ok``
(the caller removes it from its pool and counts it). The evaluation is spread over at most ``workers`` processes in fixed
contiguous chunks, so the values do not depend on the worker count. ``product_cached`` keeps each result as an .npz under a
cache directory, keyed by the point set's label and content, the theta, the Jacobian flag, the step and the engine version
(the product's ``VERSION``); a missing cache is recomputed.

Analytic throughput engines (the capacity study), one parameter q sampled as ln q with the product's ``q_ref_tph`` prior
N(ln 647, 0.25): "affine" f = q (CSS + 17)/38 (the product's throughput at 360 rpm with throw 34 mm); "rocha" f = q
rocha_shape(CSS, f80, 9.0)/647 (Rocha et al. 2024, Eq. 10 without lambda, imported from ``heldout_uq.py``); "rocha_half"
the same with the setting and feed exponents halved, computed from the constants ``heldout_uq.ROCHA`` exposes. The identity
shape_half = 647 sqrt(shape/647) is NOT used: the shape also carries the constant factors (rho_a/1600) and (16/Wi)^eta,
which the square root would halve as well. The Jacobian of every analytic engine in ln q is f itself.
"""
from __future__ import annotations

import dataclasses
import hashlib
import math
import os
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

import inputs  # noqa: F401  (puts data-pipeline and the comminution-studio figures on sys.path)
from heldout_uq import ROCHA, WI_BLEND, rocha_shape
from pipeline.hp500 import crusherbayes as cb
from pipeline.model.crusher import evaluate, operating_from_survey

N_ENGINE = cb.N_ENGINE
STEP = 1e-3
OUTS = ("tph", "kW", "p80")
Q_NOM = 647.0
LNQ_PRIOR_SD = 0.25
ANALYTIC = ("affine", "rocha", "rocha_half")


def _one(point: np.ndarray, theta8: np.ndarray) -> tuple[float, float, float]:
    op = operating_from_survey(float(point[0]), float(point[1]))
    if float(point[2]) != op.speed_rpm:
        op = dataclasses.replace(op, speed_rpm=float(point[2]))
    try:
        r = evaluate(op, cb.scalars_of(np.concatenate([theta8, [0.0, 0.0]])))
        v = (float(r.throughput_tph), float(r.power_kw), float(r.p80))
    except (ArithmeticError, ValueError):
        return (math.nan, math.nan, math.nan)
    return v if all(math.isfinite(x) for x in v) else (math.nan, math.nan, math.nan)


def _chunk(args: tuple[np.ndarray, np.ndarray, bool]) -> tuple[np.ndarray, np.ndarray]:
    """Values (m, 3) and, with jac, Jacobians (m, 3, 8) of one chunk of points."""
    points, theta8, jac = args
    vals = np.array([_one(p, theta8) for p in points]).reshape(-1, 3)
    J = np.full((points.shape[0], 3, N_ENGINE), np.nan) if jac else np.zeros((points.shape[0], 3, 0))
    if jac:
        for j in range(N_ENGINE):
            e = np.zeros(N_ENGINE)
            e[j] = STEP
            fp = np.array([_one(p, theta8 + e) for p in points]).reshape(-1, 3)
            fm = np.array([_one(p, theta8 - e) for p in points]).reshape(-1, 3)
            J[:, :, j] = (fp - fm) / (2 * STEP)
    return vals, J


def _blas_one_thread() -> None:
    for var in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
        os.environ[var] = "1"


def product_eval(points: np.ndarray, theta8: np.ndarray, workers: int = 1, jac: bool = True,
                 executor: ProcessPoolExecutor | None = None) -> dict[str, np.ndarray]:
    """The product engine on every point: ``tph``, ``kW``, ``p80`` (N,), ``jac_<out>`` (N, 8) with ``jac``, and ``ok``."""
    theta8 = np.asarray(theta8, float)[:N_ENGINE]
    size = max(1, math.ceil(points.shape[0] / 96))           # fixed chunks: independent of the worker count
    chunks = [(points[i:i + size], theta8, jac) for i in range(0, points.shape[0], size)]
    if executor is not None:
        parts = list(executor.map(_chunk, chunks))
    elif workers <= 1:
        parts = [_chunk(c) for c in chunks]
    else:
        _blas_one_thread()
        with ProcessPoolExecutor(max_workers=min(workers, 24)) as ex:
            parts = list(ex.map(_chunk, chunks))
    vals = np.vstack([p[0] for p in parts]) if parts else np.zeros((0, 3))
    J = np.concatenate([p[1] for p in parts]) if parts else np.zeros((0, 3, N_ENGINE if jac else 0))
    ok = np.all(np.isfinite(vals), axis=1) & (np.all(np.isfinite(J.reshape(J.shape[0], -1)), axis=1))
    out = {o: vals[:, k] for k, o in enumerate(OUTS)}
    if jac:
        out |= {f"jac_{o}": J[:, k, :] for k, o in enumerate(OUTS)}
    out["ok"] = ok
    return out


def cache_key(label: str, points: np.ndarray, theta8: np.ndarray, jac: bool) -> str:
    h = hashlib.sha256()
    h.update(label.encode())
    h.update(np.ascontiguousarray(points, dtype=np.float64).tobytes())
    h.update(np.ascontiguousarray(np.asarray(theta8, float)[:N_ENGINE]).tobytes())
    h.update(repr((jac, STEP, inputs.engine_version())).encode())
    return h.hexdigest()[:24]


def product_cached(label: str, points: np.ndarray, theta8: np.ndarray, cache: Path | str, workers: int = 1,
                   jac: bool = True, executor: ProcessPoolExecutor | None = None) -> dict[str, np.ndarray]:
    """``product_eval`` behind an .npz cache under ``<cache>/engine/``; the label names the point set (window, seed and
    size), and the key also hashes the points themselves."""
    path = Path(cache) / "engine" / f"{label}-{cache_key(label, points, theta8, jac)}.npz"
    if path.exists():
        with np.load(path) as z:
            return {k: z[k] for k in z.files}
    out = product_eval(points, theta8, workers=workers, jac=jac, executor=executor)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp.npz")
    np.savez(tmp, **out)
    os.replace(tmp, path)
    return out


def rocha_half_shape(css: np.ndarray, f80: np.ndarray, wi: float = WI_BLEND) -> np.ndarray:
    """Rocha's Eq. 10 shape (t/h, without lambda) with the feed and setting exponents halved, from ``ROCHA``'s constants."""
    r = ROCHA
    return (r["q_t"] * (r["rho_a"] / r["rho_base"]) * (r["wi_base"] / wi) ** r["eta"]
            * (r["f80_base"] / f80) ** (r["eps"] / 2) * (css / r["css_base"]) ** (r["nu"] / 2))


def analytic_shape(kind: str, points: np.ndarray) -> np.ndarray:
    """g(x) with f = q g(x) for the analytic engine ``kind``."""
    css, f80 = points[:, 0], points[:, 1]
    if kind == "affine":
        return (css + 17.0) / 38.0
    if kind == "rocha":
        return rocha_shape(css, f80, WI_BLEND) / Q_NOM
    if kind == "rocha_half":
        return rocha_half_shape(css, f80, WI_BLEND) / Q_NOM
    raise ValueError(f"unknown analytic engine {kind!r}")


def analytic(kind: str, points: np.ndarray, q: float) -> np.ndarray:
    """The analytic throughput engine at q (t/h); its Jacobian in ln q is this same vector."""
    return q * analytic_shape(kind, points)


def bond_specific_energy(f_kw: np.ndarray, f_tph: np.ndarray, zeta: float, pn_kw: float) -> np.ndarray:
    """The engine's Bond specific energy W (kWh/t) recovered from its power and throughput: (P - Pn)/(zeta Q)."""
    return (f_kw - pn_kw) / (zeta * f_tph)
