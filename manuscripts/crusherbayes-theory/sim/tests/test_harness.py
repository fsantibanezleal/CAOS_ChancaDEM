"""Tests a to k of the brief (Spec 1): the closed forms against the product, the theory against Monte Carlo, the plants,
the analytic engines, the information gain, the rank statistic and the Student-t quantile."""
from __future__ import annotations

import math

import numpy as np
import pytest

import engines
import inputs
import plants
import pools
import predictors as pr
import special
import theory
from conftest import SIM as SIM_DIR
from pipeline.hp500 import crusherbayes as cb


def _rel(a, b) -> float:
    a, b = np.asarray(a, float), np.asarray(b, float)
    return float(np.max(np.abs(a - b)) / max(np.max(np.abs(b)), 1e-300))


@pytest.fixture(scope="module")
def surveys_nom(cache_dir):
    pts = pools.survey_points()
    ev = engines.product_cached("real", pts, cb.nominal_theta()[:8], cache_dir, workers=1)
    return pts, ev


# ---- a. cb_oracle at the nominal theta reproduces the product's predictive, fold by fold ----
def test_a_cb_oracle_equals_product_predict(surveys_nom):
    pts, ev = surveys_nom
    css, f80, tph, kw = inputs.load_surveys()
    y = {"tph": tph, "kW": kw}
    theta = cb.nominal_theta()
    outside = 0
    for held in range(css.size):
        train = np.array([k for k in range(css.size) if k != held])
        prob = cb._Problem(css, f80, y, train)
        ref = prob.predict(theta, held)
        mu, sd = pools.standardization(pts[train])
        Z, zh = pools.design_matrix(pts[train], mu, sd), pools.design_matrix(pts[[held]], mu, sd)
        # must refute: at least one fold holds a survey outside the training range
        if not (css[train].min() <= css[held] <= css[train].max() and f80[train].min() <= f80[held] <= f80[train].max()):
            outside += 1
        for t in cb.TARGETS:
            sigma = cb.NOISE_MEDIAN[t]
            m, half, var = pr.cb_fixed(Z, y[t][train], ev[t][train], zh, ev[t][[held]], sigma, cb.DISCREPANCY_SD[t])
            assert _rel(m, [ref[t][0]]) < 1e-9, (held, t)
            assert _rel(var, [ref[t][1]]) < 1e-9, (held, t)
            assert _rel(half, pr.K80 * np.sqrt(var)) < 1e-12
    assert outside >= 2


# ---- b. the prop:ridge identity ----
def test_b_ridge_identity(surveys_nom):
    pts, ev = surveys_nom
    _, _, tph, kw = inputs.load_surveys()
    y = {"tph": tph, "kW": kw}
    train, test = np.arange(7), np.arange(7, 10)
    mu, sd = pools.standardization(pts[train])
    Z, Zh = pools.design_matrix(pts[train], mu, sd), pools.design_matrix(pts[test], mu, sd)
    for t in cb.TARGETS:
        sigma, tau = 40.0, cb.DISCREPANCY_SD[t]
        m, _, _ = pr.cb_fixed(Z, y[t][train], ev[t][train], Zh, ev[t][test], sigma, tau)
        ident = theory.ridge_identity_mean(Z, y[t][train], ev[t][train], Zh, ev[t][test], sigma ** 2 / tau ** 2)
        assert _rel(m, ident) < 1e-10


# ---- c. the expected-error formulas against Monte Carlo ----
def test_c_expected_error_matches_monte_carlo():
    rng = np.random.default_rng(3)
    n, m, R, sigma, tau = 8, 5, 200_000, 2.0, 1.5
    pts = np.column_stack([rng.uniform(38, 55, n + m), rng.uniform(47, 140, n + m), np.full(n + m, 360.0)])
    mu_s, sd_s = pools.standardization(pts[:n])
    X = pools.design_matrix(pts, mu_s, sd_s)
    Z, Zh = X[:n], X[n:]
    mu_all = 3.0 + 1.5 * X[:, 1] - X[:, 2] + 0.8 * X[:, 1] ** 2 + 0.3 * np.sin(3 * X[:, 2])
    f_all = 2.0 + 1.0 * X[:, 1] - 0.5 * X[:, 2] + 0.4 * X[:, 2] ** 2
    mu, muh, f, fh = mu_all[:n], mu_all[n:], f_all[:n], f_all[n:]
    Y = mu[:, None] + sigma * rng.standard_normal((n, R))
    Yh = muh[:, None] + sigma * rng.standard_normal((m, R))
    lam = sigma ** 2 / tau ** 2
    m_cb, _, _ = pr.cb_fixed(Z, Y, f, Zh, fh, sigma, tau)
    m_ls, _, _ = pr.least_squares(Z, Y, Zh)
    m_ln, _, _ = pr.least_squares(Z[:, :2], Y, Zh[:, :2])
    checks = [(m_cb, theory.expected_sq_error(Z, mu, f, Zh, muh, fh, sigma, lam)),
              (m_ls, theory.expected_sq_error_ls(Z, mu, Zh, muh, sigma)),
              (m_ln, theory.expected_sq_error_ls(Z[:, :2], mu, Zh[:, :2], muh, sigma))]
    for pred, expect in checks:
        se = (pred - Yh) ** 2
        mc, mcse = se.mean(axis=1), se.std(axis=1) / math.sqrt(R)
        assert np.all(np.abs(mc - expect) < 4 * mcse), (mc, expect, mcse)


# ---- d. the lambda -> 0 limit and the affine throughput ----
def test_d_limit_and_affine_throughput(small_ctx):
    pts = small_ctx.pools["surveys"]
    ev_nom = small_ctx.eng[("surveys", "nom")]
    train, test = np.arange(20), np.arange(20, 30)
    mu, sd = pools.standardization(pts[train])
    Z, Zh = pools.design_matrix(pts[train], mu, sd), pools.design_matrix(pts[test], mu, sd)
    y = ev_nom["kW"][train] + 7.0 * Z[:, 1] ** 2 + 3.0
    f, fh = ev_nom["kW"][train], ev_nom["kW"][test]
    m_cb, _, _ = pr.cb_fixed(Z, y, f, Zh, fh, 1.0, 1e9)
    m_ls, _, _ = pr.least_squares(Z, y, Zh)
    b = np.linalg.lstsq(Z, f, rcond=None)[0]
    e_h = fh - Zh @ b
    assert np.max(np.abs((m_cb - m_ls) - e_h)) < 1e-6 * np.max(np.abs(fh))
    full = pools.design_matrix(pts, *pools.standardization(pts))
    for f_all in (engines.analytic("affine", pts, 647.0), engines.analytic("affine", pts, 812.0)):
        e = f_all - full @ np.linalg.lstsq(full, f_all, rcond=None)[0]
        assert np.linalg.norm(e) / np.linalg.norm(f_all) < 1e-10
    rng = np.random.default_rng(5)
    thetas = [cb.nominal_theta()[:8], small_ctx.fit.theta0, cb.nominal_theta()[:8] + 0.1 * rng.standard_normal(8)]
    for k, th in enumerate(thetas):
        ev = engines.product_eval(pts, th, workers=1, jac=False)
        e = ev["tph"] - full @ np.linalg.lstsq(full, ev["tph"], rcond=None)[0]
        assert np.linalg.norm(e) / np.linalg.norm(ev["tph"]) < 1e-10, k


# ---- e. the orthogonal discrepancy equals Kennedy-O'Hagan under a flat prior on the scalars ----
def test_e_orthogonal_vs_ko(small_ctx):
    pts = small_ctx.pools["surveys"]
    ev = small_ctx.eng[("surveys", "nom")]
    train, test = np.arange(20), np.arange(20, 40)
    mu, sd = pools.standardization(pts[train])
    Z, Zh = pools.design_matrix(pts[train], mu, sd), pools.design_matrix(pts[test], mu, sd)
    prior_sd = np.array([p.sd for p in cb.PRIORS])
    y = small_ctx.plant_means[("V0", "surveys", "surveys")][1][train] + 30.0 * np.sin(np.arange(20))
    args = (Z, y, ev["kW"][train], ev["jac_kW"][train], Zh, ev["kW"][test], ev["jac_kW"][test], 38.8, 36.0, prior_sd)
    ko_flat = pr.cb_linear(*args, kind="ko", prior_scale=1e-12)[0]
    orth_flat = pr.cb_linear(*args, kind="orth", prior_scale=1e-12)[0]
    assert _rel(ko_flat, orth_flat) < 1e-6
    ko, orth = pr.cb_linear(*args, kind="ko")[0], pr.cb_linear(*args, kind="orth")[0]
    assert _rel(ko, orth) > 1e-6


# ---- f. the scaled prior without engine parameters is a generalized ridge ----
def test_f_scaled_is_generalized_ridge():
    rng = np.random.default_rng(11)
    n, m, sigma, tau = 12, 6, 3.0, 2.0
    Z = np.column_stack([np.ones(n), rng.standard_normal(n), rng.standard_normal(n)])
    Zh = np.column_stack([np.ones(m), rng.standard_normal(m), rng.standard_normal(m)])
    f, fh, y = rng.standard_normal(n), rng.standard_normal(m), rng.standard_normal(n) * 4
    G = Z.T @ Z
    pen = sigma ** 2 / tau ** 2 * (np.eye(3) + G / n)
    expect = fh + Zh @ np.linalg.solve(G + pen, Z.T @ (y - f))
    got = pr.cb_linear(Z, y, f, np.zeros((n, 0)), Zh, fh, np.zeros((m, 0)), sigma, tau, np.zeros(0), kind="scaled")[0]
    assert _rel(got, expect) < 1e-12


# ---- g. V1(1, 0) is V0, and q is orthogonal with unit RMS ----
def test_g_v1_plant(small_ctx):
    v0 = small_ctx.plant_means[("V0", "surveys", "surveys")]
    v1 = small_ctx.plant_means[("V1_a1_k0", "surveys", "surveys")]
    assert _rel(v1[1], v0[1]) < 1e-10
    basis = small_ctx.v1_basis["surveys"]
    pts = small_ctx.pools["surveys"]
    zr = pools.design_matrix(pts, *small_ctx.zref)
    f0 = small_ctx.eng[("surveys", "theta0")]["kW"]
    q = basis.q(f0, zr)
    e0 = basis.e0(f0, zr)
    M = np.column_stack([zr, e0])
    assert np.max(np.abs(M.T @ q)) / q.size < 1e-10 * np.max(np.abs(M))
    assert abs(math.sqrt(np.mean(q ** 2)) - 1.0) < 1e-12


# ---- h. the affine analytic engine at q = 647 is the product throughput at the nominal theta ----
def test_h_affine_equals_product(small_ctx):
    pts = small_ctx.pools["surveys"]
    assert _rel(engines.analytic("affine", pts, 647.0), small_ctx.eng[("surveys", "nom")]["tph"]) < 1e-12


def test_h_rocha_engines():
    pts = pools.survey_points()
    from heldout_uq import rocha_shape
    assert _rel(engines.analytic("rocha", pts, 647.0), rocha_shape(pts[:, 0], pts[:, 1], 9.0)) < 1e-14
    half = engines.analytic("rocha_half", pts, 647.0)
    # halving the setting and feed exponents: the ratio of two points is the square root of the full shape's ratio
    full = rocha_shape(pts[:, 0], pts[:, 1], 9.0)
    assert _rel(half / half[0], np.sqrt(full / full[0])) < 1e-12


# ---- i. the closed-form information gain against nested Monte Carlo ----
def test_i_eig_closed_form_vs_nested_mc():
    rng = np.random.default_rng(17)
    A = np.array([[1.0, 0.2], [0.3, 0.8], [0.5, -0.4]])
    prior_sd = np.array([0.6, 0.9])
    Sigma = 0.5 * np.eye(3) + 0.2 * np.ones((3, 3))
    closed = theory.eig_linear([A], [Sigma], prior_sd)
    est, se = theory.eig_nested_mc(A, Sigma, prior_sd, n_outer=3000, n_inner=3000, rng=rng)
    assert abs(est - closed) < 4 * se + 2e-3, (est, closed, se)


# ---- j. the simulation-based-calibration rank is uniform on a conjugate toy ----
def test_j_sbc_rank_uniform():
    rng = np.random.default_rng(23)
    L, N = 99, 2000
    ranks = np.empty(N, int)
    for k in range(N):
        th = rng.standard_normal()
        y = th + rng.standard_normal()
        draws = y / 2 + math.sqrt(0.5) * rng.standard_normal(L)
        ranks[k] = theory.sbc_rank(th, draws, rng)
    assert ranks.min() >= 0 and ranks.max() <= L
    chi2, p = theory.rank_uniformity(ranks, L, bins=L + 1)
    assert p > 0.01, (chi2, p)
    # ties are broken at random: a truth equal to every draw gets every rank
    tie = [theory.sbc_rank(1.0, np.ones(L), rng) for _ in range(4000)]
    assert min(tie) == 0 and max(tie) == L
    assert theory.rank_uniformity(np.array(tie), L, bins=10)[1] > 0.01


# ---- k. the Student-t quantile ----
@pytest.mark.parametrize("df,expect", [(7, 1.4149), (8, 1.3968), (17, 1.3334), (157, 1.2869)])
def test_k_student_t_quantile(df, expect):
    assert abs(special.t_ppf(0.9, df) - expect) < 1e-4


def test_k_chi2_survival():
    # tabulated upper quantiles: chi2_{0.05, 9} = 16.919, chi2_{0.01, 99} = 134.642
    assert abs(special.chi2_sf(16.919, 9) - 0.05) < 1e-4
    assert abs(special.chi2_sf(134.642, 99) - 0.01) < 1e-4


# ---- the reach of the rank test (analysis/sbc_power.py) ----
def test_sbc_power_holds_its_level_under_the_null_and_detects_a_posterior_half_as_wide():
    import importlib.util
    path = SIM_DIR.parent / "analysis" / "sbc_power.py"
    spec = importlib.util.spec_from_file_location("sbc_power", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    rng = np.random.default_rng(7)
    null = mod.power(1.0, 0.0, 96, 99, 4, {"nominal": 0.05}, 4000, rng)["nominal"]["power"]
    assert abs(null - 0.05) < 4 * math.sqrt(0.05 * 0.95 / 4000)
    assert mod.power(0.5, 0.0, 96, 99, 4, {"nominal": 0.05}, 2000, rng)["nominal"]["power"] > 0.95
    assert mod.power(1.0, 1.0, 96, 99, 4, {"nominal": 0.05}, 2000, rng)["nominal"]["power"] > 0.95
