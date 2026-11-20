"""The theory quantities of the CrusherBayes study, for a fixed design: true mean mu (training) and muh (test), engine f and
fh, noise sigma, lambda = sigma^2/tau^2.

beta = G^-1 Z^T mu, r = mu - Z beta, r_h = muh - zh^T beta (the plant's departure from its best plane);
b = G^-1 Z^T f, e = f - Z b, e_h = fh - zh^T b (the engine's departure from its best plane); delta = b - beta;
A = (G + lambda I)^-1.

- Expected squared prediction error at a test point (over training and test noise): CrusherBayes given the scalars,
  (r_h - e_h - lambda zh^T A delta)^2 + sigma^2 zh^T A G A zh + sigma^2; least squares, r_h^2 + sigma^2 zh^T G^-1 zh + sigma^2.
- The fixed-design decomposition over the training points (held points = training points, new noise): the MSE of
  CrusherBayes minus that of least squares is -C + sum_k plane_k with C = mean of e (2 r - e) and, per eigen-direction k of
  G (eigenvalue g_k, delta_k = V^T delta), plane_k = (lambda^2 g_k delta_k^2 - sigma^2 (2 lambda g_k + lambda^2)) /
  (n (g_k + lambda)^2), minimized at lambda_k* = sigma^2/delta_k^2 with minimum -sigma^4/(n (g_k delta_k^2 + sigma^2));
  phi^2 is the mean square of the projection of mu on the feed regressor orthogonalized against (1, z_c), and the line
  minus least squares in-sample MSE is phi^2 - sigma^2/n; the crossing size n* = sigma^2/(phi^2 + C) when positive.
- The expected information gain of a linear Gaussian design (Rainforth et al. 2024, Eq. 2, closed form):
  0.5 log det(I + L^T (sum_t J_t^T Sigma_t^-1 J_t) L), L = diag(prior sd), and the posterior-to-prior sd ratios.
- The simulation-based-calibration rank (Talts et al. 2018; ties broken at random) and its chi-square uniformity test.
"""
from __future__ import annotations

import math

import numpy as np

import special


def _plane(X: np.ndarray, v: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    coef = np.linalg.solve(X.T @ X, X.T @ v)
    return coef, v - X @ coef


def expected_sq_error(Z, mu, f, Zh, muh, fh, sigma, lam):
    """Per test point, the expected squared prediction error of CrusherBayes given the scalars (engine f, fh)."""
    G = Z.T @ Z
    beta, _ = _plane(Z, mu)
    b, _ = _plane(Z, f)
    r_h, e_h, delta = muh - Zh @ beta, fh - Zh @ b, b - beta
    A = np.linalg.inv(G + lam * np.eye(G.shape[0]))
    bias = r_h - e_h - lam * (Zh @ (A @ delta))
    var = sigma ** 2 * np.einsum("ij,jk,ik->i", Zh, A @ G @ A, Zh) + sigma ** 2
    return bias ** 2 + var


def expected_sq_error_ls(X, mu, Xh, muh, sigma):
    """Per test point, the expected squared prediction error of least squares on the columns of X."""
    beta, _ = _plane(X, mu)
    r_h = muh - Xh @ beta
    lev = np.einsum("ij,ji->i", Xh, np.linalg.solve(X.T @ X, Xh.T))
    return r_h ** 2 + sigma ** 2 * lev + sigma ** 2


def ridge_identity_mean(Z, y, f, Zh, fh, lam):
    """The predictive mean of Proposition prop:ridge: zh^T (G + lambda I)^-1 (Z^T y + lambda b) + e_h."""
    b, _ = _plane(Z, f)
    G = Z.T @ Z
    return Zh @ np.linalg.solve(G + lam * np.eye(G.shape[0]), Z.T @ y + lam * b) + (fh - Zh @ b)


def fixed_design_terms(Z, mu, f, sigma, lam, n):
    """The fixed-design decomposition on a pool (rows Z in the pool's standardization, population moments), with the
    design matrix scaled to n points: G_n = n Z^T Z / N."""
    N = Z.shape[0]
    beta, r = _plane(Z, mu)
    b, e = _plane(Z, f)
    delta = b - beta
    C = float(np.mean(e * (2 * r - e)))
    g, V = np.linalg.eigh(n * (Z.T @ Z) / N)
    dk = V.T @ delta
    plane = (lam ** 2 * g * dk ** 2 - sigma ** 2 * (2 * lam * g + lam ** 2)) / (n * (g + lam) ** 2)
    with np.errstate(divide="ignore"):
        lam_star = np.where(dk != 0, sigma ** 2 / dk ** 2, np.inf)
    plane_min = -sigma ** 4 / (n * (g * dk ** 2 + sigma ** 2))
    X1 = Z[:, :2]
    _, zf = _plane(X1, Z[:, 2])
    proj = (zf @ mu) / (zf @ zf) * zf
    phi2 = float(np.mean(proj ** 2))
    denom = phi2 + C
    return {"n": int(n), "lambda": float(lam), "sigma": float(sigma), "C": C, "g": g.tolist(), "delta_k": dk.tolist(),
            "plane": plane.tolist(), "plane_sum": float(plane.sum()), "lambda_star": lam_star.tolist(),
            "plane_min": plane_min.tolist(), "phi2": phi2,
            "cb_minus_ls_in_sample": float(-C + plane.sum()), "line_minus_ls_in_sample": float(phi2 - sigma ** 2 / n),
            "n_star": float(sigma ** 2 / denom) if denom > 0 else None,
            "r_rms": float(math.sqrt(np.mean(r ** 2))), "e_rms": float(math.sqrt(np.mean(e ** 2)))}


def _information(J_list, Sigma_list) -> np.ndarray:
    return sum(J.T @ np.linalg.solve(S, J) for J, S in zip(J_list, Sigma_list))


def eig_linear(J_list, Sigma_list, prior_sd) -> float:
    """The expected information gain of a linear Gaussian design, in nats."""
    L = np.diag(np.asarray(prior_sd, float))
    sign, logdet = np.linalg.slogdet(np.eye(L.shape[0]) + L @ _information(J_list, Sigma_list) @ L)
    if sign <= 0:
        raise ArithmeticError("I + L F L is not positive definite")
    return 0.5 * float(logdet)


def posterior_sd_ratio(J_list, Sigma_list, prior_sd) -> np.ndarray:
    """sqrt(diag((Lambda + F)^-1)) / prior sd, Lambda = diag(prior sd^-2)."""
    sd = np.asarray(prior_sd, float)
    cov = np.linalg.inv(np.diag(1.0 / sd ** 2) + _information(J_list, Sigma_list))
    return np.sqrt(np.diag(cov)) / sd


def eig_nested_mc(A, Sigma, prior_sd, n_outer, n_inner, rng):
    """Nested Monte Carlo estimate of the information gain of y = A u + N(0, Sigma), u ~ N(0, diag(prior_sd^2)), and its
    Monte Carlo standard error (Rainforth et al. 2018 estimator; its bias is O(1/n_inner))."""
    p = A.shape[1]
    Lc = np.linalg.cholesky(Sigma)
    u = rng.standard_normal((n_outer, p)) * prior_sd
    y = u @ A.T + rng.standard_normal((n_outer, A.shape[0])) @ Lc.T
    w = np.linalg.solve(Lc, y.T).T
    a_out = np.linalg.solve(Lc, (u @ A.T).T).T
    loglik = -0.5 * np.sum((w - a_out) ** 2, axis=1)
    v = rng.standard_normal((n_inner, p)) * prior_sd
    a_in = np.linalg.solve(Lc, (v @ A.T).T).T
    quad = np.sum(w ** 2, axis=1)[:, None] - 2 * w @ a_in.T + np.sum(a_in ** 2, axis=1)[None, :]
    ll = -0.5 * quad
    m = ll.max(axis=1, keepdims=True)
    logmarg = (m + np.log(np.mean(np.exp(ll - m), axis=1, keepdims=True)))[:, 0]
    g = loglik - logmarg
    return float(g.mean()), float(g.std(ddof=1) / math.sqrt(n_outer))


def sbc_rank(truth: float, draws: np.ndarray, rng: np.random.Generator) -> int:
    """The number of draws below the truth, ties broken uniformly at random: a rank on 0..L for L draws."""
    draws = np.asarray(draws)
    less = int(np.sum(draws < truth))
    ties = int(np.sum(draws == truth))
    return less + int(rng.integers(0, ties + 1))


def rank_histogram(ranks: np.ndarray, L: int, bins: int) -> np.ndarray:
    if (L + 1) % bins:
        raise ValueError("bins must divide L + 1")
    return np.bincount(np.asarray(ranks, int) // ((L + 1) // bins), minlength=bins)


def rank_uniformity(ranks: np.ndarray, L: int, bins: int = 10) -> tuple[float, float]:
    """Chi-square statistic and p value of the ranks' histogram (``bins`` equal bins of 0..L) against uniform."""
    counts = rank_histogram(ranks, L, bins)
    E = len(ranks) / bins
    chi2 = float(np.sum((counts - E) ** 2) / E)
    return chi2, special.chi2_sf(chi2, bins - 1)
