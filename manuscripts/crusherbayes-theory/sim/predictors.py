"""The predictors of the CrusherBayes theory study, per output, each returning (mean, half-width of the 80 percent band,
predictive variance) at the test rows. ``y`` may be one training vector (n,) or a matrix of replicates (n, R); the
results then have shape (m, R).

Notation: Z (n, 3) training rows (1, z_c, z_f) in the training standardization, Zh (m, 3) the test rows; f, fh the engine
at the training and test points; J (n, p), Jh (m, p) its Jacobian in the sampled scale; sigma the true noise scale; tau
the discrepancy prior scale (``crusherbayes.DISCREPANCY_SD``); lambda = sigma^2/tau^2; G = Z^T Z. Gaussian bands are
mean +- 1.2816 sd (``loo.K80``); least-squares bands are Student-t prediction intervals.

1. ``cb_fixed``: CrusherBayes given the scalars (cb_oracle, cb_nominal): mean fh + Zh (G + lambda I)^-1 Z^T (y - f);
   variance sigma^2 + sigma^2 zh^T (G + lambda I)^-1 zh. This is the product's ``_Problem.predict`` in closed form.
2. ``cb_linear``: the scalars learned in the model linearized at the engine's expansion point, u ~ N(0, diag(prior sd^2)),
   d ~ N(0, K_d^-1): kind "ko" (Kennedy and O'Hagan 2001, K_d = tau^-2 I), "orth" (the orthogonal discrepancy of Plumlee
   2017 in its empirical form, Z replaced by (I - J J^+) Z and zh by zh - jh^T J^+ Z), "scaled" (the scaled prior of Gu
   and Wang 2018 in its linear form, K_d = tau^-2 (I + G/n)). ``prior_scale`` multiplies the scalars' prior precisions.
3. ``least_squares`` (ls on Z, line on (1, z_c)), ``engine_band``, ``engine_refit``, ``constant``.
"""
from __future__ import annotations

from functools import lru_cache

import numpy as np

import special

K80 = 1.2816           # normal 80 percent two-sided half-width factor (loo.K80, the product's constant)


@lru_cache(maxsize=None)
def t90(dof: int) -> float:
    return special.t_ppf(0.9, dof)


def _resid(y: np.ndarray, f: np.ndarray) -> np.ndarray:
    return y - (f if y.ndim == 1 else f[:, None])


def _shift(fh: np.ndarray, d: np.ndarray) -> np.ndarray:
    return fh + d if d.ndim == 1 else fh[:, None] + d


def _gauss(mean: np.ndarray, var: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    if mean.ndim == 2 and var.ndim == 1:
        var = np.broadcast_to(var[:, None], mean.shape)
    return mean, K80 * np.sqrt(var), var


def cb_fixed(Z, y, f, Zh, fh, sigma, tau):
    lam = sigma ** 2 / tau ** 2
    A = np.linalg.inv(Z.T @ Z + lam * np.eye(Z.shape[1]))
    mean = _shift(fh, Zh @ (A @ (Z.T @ _resid(y, f))))
    var = sigma ** 2 * (1.0 + np.einsum("ij,jk,ik->i", Zh, A, Zh))
    return _gauss(mean, var)


def cb_linear(Z, y, f, J, Zh, fh, Jh, sigma, tau, prior_sd, kind="ko", prior_scale=1.0):
    n, k = Z.shape
    p = J.shape[1]
    if kind == "orth":
        Jp = np.linalg.pinv(J, rcond=1e-10) if p else np.zeros((0, n))
        Zt, Zht = Z - J @ (Jp @ Z), Zh - Jh @ (Jp @ Z)
        Kd = np.eye(k) / tau ** 2
    elif kind == "ko":
        Zt, Zht = Z, Zh
        Kd = np.eye(k) / tau ** 2
    elif kind == "scaled":
        Zt, Zht = Z, Zh
        Kd = (np.eye(k) + Z.T @ Z / n) / tau ** 2
    else:
        raise ValueError(f"unknown kind {kind!r}")
    W, Wh = np.hstack([J, Zt]), np.hstack([Jh, Zht])
    prior = np.zeros((p + k, p + k))
    prior[:p, :p] = np.diag(prior_scale / np.asarray(prior_sd, float) ** 2)
    prior[p:, p:] = Kd
    P = W.T @ W / sigma ** 2 + prior
    mean = _shift(fh, Wh @ np.linalg.solve(P, W.T @ _resid(y, f)) / sigma ** 2)
    var = sigma ** 2 + np.einsum("ij,ji->i", Wh, np.linalg.solve(P, Wh.T))
    return _gauss(mean, var)


def least_squares(X, y, Xh):
    """Least squares on the columns of X with the Student-t 80 percent prediction interval (n - p degrees of freedom)."""
    n, p = X.shape
    G = X.T @ X
    beta = np.linalg.solve(G, X.T @ y)
    resid = y - X @ beta
    s2 = np.sum(resid ** 2, axis=0) / (n - p)
    lev = 1.0 + np.einsum("ij,ji->i", Xh, np.linalg.solve(G, Xh.T))
    var = np.multiply.outer(lev, s2) if y.ndim == 2 else lev * s2
    return Xh @ beta, t90(n - p) * np.sqrt(var), var


def engine_band(fh, sigma):
    return _gauss(np.asarray(fh, float), np.full(len(fh), sigma ** 2))


def engine_refit(J, y, f, Jh, fh, sigma, prior_sd):
    """The engine alone, its scalars learned in the model linearized at the expansion point (no discrepancy)."""
    P = J.T @ J / sigma ** 2 + np.diag(1.0 / np.asarray(prior_sd, float) ** 2)
    mean = _shift(fh, Jh @ np.linalg.solve(P, J.T @ _resid(y, f)) / sigma ** 2)
    var = sigma ** 2 + np.einsum("ij,ji->i", Jh, np.linalg.solve(P, Jh.T))
    return _gauss(mean, var)


def constant(y, m: int):
    """The training mean with the Student-t 80 percent prediction interval (n - 1 degrees of freedom)."""
    n = y.shape[0]
    ybar = y.mean(axis=0)
    s2 = y.var(axis=0, ddof=1)
    var = s2 * (1.0 + 1.0 / n)
    if y.ndim == 1:
        return np.full(m, ybar), np.full(m, t90(n - 1) * np.sqrt(var)), np.full(m, var)
    ones = np.ones((m, 1))
    return ones * ybar, ones * (t90(n - 1) * np.sqrt(var)), ones * var
