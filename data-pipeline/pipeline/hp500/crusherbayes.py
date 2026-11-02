"""CrusherBayes: a Bayesian calibration of the crusher engine with a structural discrepancy, held out on the ten HP500
surveys (the product's own proposed method; SDD ``## Beyond the state of the art``, BS-2).

WHAT IT IS. The engine's fitted scalars on the HP500 lane (``Hp500Scalars``: the capacity base QT, the Bond work index
Wi, the power form zeta and Pn, the K1 and K2 multipliers, K3 and the t10 constant) get a weakly informative prior around
their Table 4 and 5 values (``PRIORS``, each with its source). The measured throughput and power of a survey are the engine
at those scalars plus a discrepancy that is linear in the standardized closed-side setting and f80 (a constant and two
slopes per target, a Gaussian prior, the low-order form of Kennedy and O'Hagan 2001, https://doi.org/10.1111/1467-9868.00294)
plus Gaussian noise. The discrepancy and the noise are Gaussian given the engine scalars, so the discrepancy is integrated
out exactly: y ~ N(f(theta), sigma^2 I + tau^2 X X^T), and the sampler (a differential-evolution ensemble sampler,
Goodman and Weare 2010, ``emcee`` 3.1.6, gradient free) explores the engine scalars and the two noise scales only; the
discrepancy coefficients are drawn afterwards from their exact Gaussian conditional. The engine is its own simulator
(about 1.3 ms per evaluation), so there is no emulator.

PROTOCOL. Strict leave-one-survey-out as CrusherCal (``loo.fold_indices``): one posterior per fold from the nine training
surveys, the held-out survey enters only the prediction; one more posterior from all ten for the contraction table. Per
held-out survey the posterior predictive mean and its 80 percent interval. Scores: MAPE, RMSE, the mean log predictive
density, the 80 percent coverage and the mean width, beside B-lin, M0, M2 and the CrusherCal band (the comparators are
scored on the same ten surveys, their band the nested one of ``loo.nested_band_coverage``). The kill criterion of the SDD is
evaluated by ``kill_criterion`` into a verdict from the numbers alone.

HONESTY. A chain that fails its convergence diagnostic (chain length below 50 integrated autocorrelation times) is recorded
as not converged in the document, never kept silently. Nothing is asserted: every number comes from the sampler. P80 is not
measured and is never a target. CI never runs the sampler (ADR-0074): the bake writes the document, CI validates it.

Run:  python data-pipeline/run.py hp500        # the offline bake runs the sampler; the contract tests validate the file
"""
from __future__ import annotations

import hashlib
import math
import os
from concurrent.futures import Future, ProcessPoolExecutor, ThreadPoolExecutor
from dataclasses import dataclass
from typing import NamedTuple

import numpy as np

from ..model.crusher import evaluate, operating_from_survey
from ..model.crusher.hp500 import Hp500Scalars
from . import loo as loo_mod
from .surveys import SOURCE

SCHEMA = "chancadem.hp500.crusherbayes/v1"
SEED = 42
SAMPLER_NAME = "emcee"
SAMPLER_VERSION = "3.1.6"
SAMPLER_MOVE = ("DEMove 0.8 and DESnookerMove 0.2 (ter Braak 2006, https://doi.org/10.1007/s11222-006-8769-1; ter Braak and "
                "Vrugt 2008, https://doi.org/10.1007/s11222-008-9104-9)")
TAU_FACTOR = 50          # converged when the post-burn chain is at least this many integrated autocorrelation times long
MARGIN_MAPE_PTS = 3.0    # the SDD margin (a difference below about 3 MAPE points is noise at n = 10)
COVERAGE_BAND = (0.7, 0.9)
TARGETS = ("tph", "kW")


@dataclass(frozen=True)
class Config:
    """The sampler's size. The committed document is baked with ``DEFAULT_CONFIG``; tests use a tiny one."""
    walkers: int = 20    # twice the sampled dimension (ten)
    steps: int = 7000    # sized to convergence: the stretch move kept tau above 100 and growing (no fold converged at
                         # 7000 steps), the DE moves give about 50 at 3000 steps on the same posterior
    burn: int = 1000
    thin: int = 10
    draws: int = 20      # predictive draws per retained posterior sample (the interval is their quantile)


DEFAULT_CONFIG = Config()


class Prior(NamedTuple):
    """A truncated normal prior in the sampled space (``log`` parameters are sampled as their natural log)."""
    name: str
    unit: str
    nominal: float       # the engine's shipped value, natural scale
    log: bool            # sampled as ln(value)
    mu: float            # sampled space
    sd: float            # sampled space
    lo: float            # sampled space bound
    hi: float
    source: str


_ROCHA = "Rocha et al. 2024, https://doi.org/10.3390/min14090919"
PRIORS: tuple[Prior, ...] = (
    Prior("q_ref_tph", "t/h", 647.0, True, math.log(647.0), 0.25, math.log(300.0), math.log(1400.0),
          f"nominal: {_ROCHA}, Table 4 (QT about 647 t/h); width: weakly informative, a log standard deviation of 0.25 "
          "(plus or minus 28 percent); the surveys span 813 to 1639 t/h"),
    Prior("wi_kwh_t", "kWh/t", 9.0, True, math.log(9.0), 0.17, math.log(5.0), math.log(14.0),
          f"nominal: the blend Wi of the engine; the compact and supercompact itabirite bands are 7.2 and 10.6 kWh/t ({_ROCHA}, "
          "Table 1, as HP500_ORE); width: weakly informative, a log standard deviation of 0.17 (plus or minus 18 percent, 7.6 to 10.7 kWh/t)"),
    Prior("zeta", "-", 1.30, True, math.log(1.30), 0.23, math.log(0.5), math.log(2.5),
          f"nominal: the slope of Pc = zeta Pd + Pn, {_ROCHA}, Table 5; width: weakly informative, a log standard deviation of 0.23 (plus or minus 26 percent)"),
    Prior("pn_kw", "kW", 110.0, False, 110.0, 50.0, 0.0, 300.0,
          f"nominal: the no-load power of Pc = zeta Pd + Pn, {_ROCHA}, Table 5; width: weakly informative, standard deviation "
          "50 kW; the measured power spans 187 to 355 kW"),
    Prior("k1_scale", "-", 1.0, True, 0.0, 0.15, math.log(0.5), math.log(2.0),
          f"multiplier of K1 = 0.23 CSS + 0.30 f80 ({_ROCHA}, Table 5); width: a log standard deviation of 0.15 "
          "(plus or minus 16 percent)"),
    Prior("k2_scale", "-", 1.0, True, 0.0, 0.15, math.log(0.5), math.log(2.0),
          f"multiplier of K2 = 12.0 + 0.55 CSS + 0.40 f80 ({_ROCHA}, Table 5); width: a log standard deviation of 0.15"),
    Prior("k3", "-", 2.3, False, 2.3, 0.5, 1.0, 4.0,
          f"nominal: {_ROCHA}, Table 5; the typical K3 of the cone models of the engine runs 2.0 to 2.7 (Napier-Munn et al. "
          "1996, Mineral Comminution Circuits, JKMRC); width: standard deviation 0.5"),
    Prior("t10_shift_pct", "t10 percentage points", 0.0, False, 0.0, 4.0, -15.0, 15.0,
          f"shift of the constant 64 of t10 (%) = 64 - 0.12 CSS - 0.23 f80 ({_ROCHA}, Table 5); width: standard deviation "
          "4 points of t10 (the engine caps t10 at 44 percent)"),
)
N_ENGINE = len(PRIORS)

# noise scale per target: ln sigma ~ N(ln median, 1); the median is 5 percent of the typical survey level
NOISE_MEDIAN = {"tph": 60.0, "kW": 15.0}     # t/h and kW (a typical level of 1,200 t/h and 300 kW)
NOISE_LOG_SD = 1.0
NOISE_LOG_BOUNDS = (math.log(1.0), math.log(1000.0))
# discrepancy: constant and two slopes on standardized [CSS, f80], each N(0, tau^2), tau about 12 percent of the typical level
DISCREPANCY_SD = {"tph": 140.0, "kW": 36.0}  # t/h and kW per standardized unit
DISCREPANCY_TERMS = ("constant", "css", "f80")
N_THETA = N_ENGINE + len(TARGETS)


def scalars_of(theta: np.ndarray) -> Hp500Scalars:
    """The engine scalars of a sampled vector (the first ``N_ENGINE`` entries, ``log`` ones exponentiated)."""
    v = [math.exp(theta[i]) if PRIORS[i].log else float(theta[i]) for i in range(N_ENGINE)]
    return Hp500Scalars(*v)


def nominal_theta() -> np.ndarray:
    """The prior centre: the engine as shipped and the median noise."""
    return np.array([p.mu for p in PRIORS] + [math.log(NOISE_MEDIAN[t]) for t in TARGETS])


def log_prior(theta: np.ndarray) -> float:
    """Truncated-normal log prior (up to a constant); minus infinity outside a bound or for a non-finite entry."""
    if not np.all(np.isfinite(theta)):
        return -math.inf
    lp = 0.0
    for i, p in enumerate(PRIORS):
        if not p.lo <= theta[i] <= p.hi:
            return -math.inf
        lp -= 0.5 * ((theta[i] - p.mu) / p.sd) ** 2
    for k, t in enumerate(TARGETS):
        ls = theta[N_ENGINE + k]
        if not NOISE_LOG_BOUNDS[0] <= ls <= NOISE_LOG_BOUNDS[1]:
            return -math.inf
        lp -= 0.5 * ((ls - math.log(NOISE_MEDIAN[t])) / NOISE_LOG_SD) ** 2
    return lp


def prior_sd_natural(p: Prior, n: int = 400_000, seed: int = 7) -> float:
    """Standard deviation of a prior on its natural scale, by seeded rejection sampling from its truncated normal."""
    rng = np.random.default_rng(seed)
    x = rng.normal(p.mu, p.sd, n)
    x = x[(x >= p.lo) & (x <= p.hi)]
    return float(np.std(np.exp(x) if p.log else x))


def simulate(ops: list, scalars: Hp500Scalars) -> tuple[np.ndarray, np.ndarray]:
    """The engine at ``scalars`` on each operating point: (throughput [t/h], power [kW])."""
    res = [evaluate(op, scalars) for op in ops]
    return np.array([r.throughput_tph for r in res]), np.array([r.power_kw for r in res])


def design(css: np.ndarray, f80: np.ndarray, mu: np.ndarray, sd: np.ndarray) -> np.ndarray:
    """The discrepancy design matrix [1, CSS_z, f80_z] with the training mean and standard deviation ``mu``, ``sd``."""
    return np.column_stack([np.ones(css.size), (css - mu[0]) / sd[0], (f80 - mu[1]) / sd[1]])


def _gaussian_terms(r: np.ndarray, X: np.ndarray, sigma: float, tau: float):
    """Log marginal density of the residual r ~ N(0, sigma^2 I + tau^2 X X^T) and the inverse covariance."""
    n = r.size
    C = sigma ** 2 * np.eye(n) + tau ** 2 * (X @ X.T)
    try:
        L = np.linalg.cholesky(C)
    except np.linalg.LinAlgError:
        return -math.inf, None
    z = np.linalg.solve(L, r)
    ll = -0.5 * float(z @ z) - float(np.sum(np.log(np.diag(L)))) - 0.5 * n * math.log(2 * math.pi)
    return ll, np.linalg.inv(C)


class _Problem:
    """The training rows of one fold: operating points, targets and the discrepancy design."""

    def __init__(self, css: np.ndarray, f80: np.ndarray, y: dict[str, np.ndarray], train: np.ndarray) -> None:
        self.css, self.f80 = css, f80
        self.train = train
        self.mu = np.array([css[train].mean(), f80[train].mean()])
        sd = np.array([css[train].std(), f80[train].std()])
        self.sd = np.where(sd == 0, 1.0, sd)
        self.ops = [operating_from_survey(float(c), float(f)) for c, f in zip(css, f80)]
        self.X = design(css[train], f80[train], self.mu, self.sd)
        self.y = {t: y[t][train] for t in TARGETS}

    def log_prob(self, theta: np.ndarray) -> float:
        lp = log_prior(theta)
        if not math.isfinite(lp):
            return -math.inf
        try:
            tph, kw = simulate([self.ops[i] for i in self.train], scalars_of(theta))
        except (ArithmeticError, ValueError):
            return -math.inf
        fit = {"tph": tph, "kW": kw}
        ll = 0.0
        for k, t in enumerate(TARGETS):
            if not np.all(np.isfinite(fit[t])):
                return -math.inf
            term, _ = _gaussian_terms(self.y[t] - fit[t], self.X, math.exp(theta[N_ENGINE + k]), DISCREPANCY_SD[t])
            ll += term
        return lp + ll if math.isfinite(ll) else -math.inf

    def conditional(self, theta: np.ndarray, held: int | None) -> dict[str, tuple[float, float, np.ndarray, np.ndarray]]:
        """Per target at one posterior sample: the engine at the survey ``held`` (None: no survey), and the exact Gaussian
        conditional of the three discrepancy coefficients given theta, as (engine value, noise variance, mean, covariance)."""
        rows = (*self.train, held) if held is not None else tuple(self.train)
        tph_all, kw_all = simulate([self.ops[i] for i in rows], scalars_of(theta))
        fits = {"tph": tph_all, "kW": kw_all}
        out = {}
        for k, t in enumerate(TARGETS):
            sigma, tau = math.exp(theta[N_ENGINE + k]), DISCREPANCY_SD[t]
            r = self.y[t] - fits[t][:len(self.train)]
            _, Ci = _gaussian_terms(r, self.X, sigma, tau)
            if Ci is None:
                raise ArithmeticError("covariance not positive definite")
            d_mean = tau ** 2 * (self.X.T @ (Ci @ r))
            d_cov = tau ** 2 * np.eye(3) - tau ** 4 * (self.X.T @ Ci @ self.X)
            out[t] = (float(fits[t][-1]) if held is not None else math.nan, sigma ** 2, d_mean, d_cov)
        return out

    def predict(self, theta: np.ndarray, held: int) -> dict[str, tuple[float, float]]:
        """Per target, the posterior predictive mean and variance of the survey ``held`` at one posterior sample: the engine
        there plus the discrepancy and the noise."""
        xh = design(self.css[[held]], self.f80[[held]], self.mu, self.sd)[0]
        return {t: (engine + float(xh @ d_mean), noise + float(xh @ d_cov @ xh))
                for t, (engine, noise, d_mean, d_cov) in self.conditional(theta, held).items()}


# ---- the worker side: every process builds the eleven problems once and answers log-probability and predictive tasks ----
_SPECS: list[dict] = []
_PROBLEMS: dict[int, _Problem] = {}


def _init_worker(specs: list[dict]) -> None:
    global _SPECS, _PROBLEMS
    _SPECS, _PROBLEMS = specs, {}


def _problem(job: int) -> _Problem:
    if job not in _PROBLEMS:
        s = _SPECS[job]
        css, f80 = np.array(s["css"]), np.array(s["f80"])
        n = css.size
        train = np.array([k for k in range(n) if k != s["held"]])
        _PROBLEMS[job] = _Problem(css, f80, {t: np.array(s[t]) for t in TARGETS}, train)
    return _PROBLEMS[job]


class _LogProb:
    """The picklable log-probability of one job: a worker looks the problem up, the theta is the only thing sent."""

    def __init__(self, job: int) -> None:
        self.job = job

    def __call__(self, theta: np.ndarray) -> float:
        return _problem(self.job).log_prob(theta)


def _task_predict(args: tuple[int, np.ndarray]):
    job, theta = args
    try:
        return _problem(job).predict(theta, _SPECS[job]["held"])
    except (ArithmeticError, ValueError):
        return None


def _task_discrepancy(args: tuple[int, np.ndarray]):
    job, theta = args
    try:
        return {t: (m, c) for t, (_, _, m, c) in _problem(job).conditional(theta, None).items()}
    except (ArithmeticError, ValueError):
        return None


class _InlineExecutor:
    """An executor that runs each task at once in this process (one worker: the tests, a one-core machine)."""

    def submit(self, fn, *args):
        future: Future = Future()
        future.set_result(fn(*args))
        return future


class _PoolMap:
    """The ``pool`` of an emcee sampler: ``map`` sends each theta to the shared executor, so the walkers of every fit run in
    parallel on every core and the order of the results is the order of the walkers."""

    def __init__(self, executor) -> None:
        self.executor = executor

    def map(self, fn, iterable):
        return [f.result() for f in [self.executor.submit(fn, x) for x in iterable]]


def _fit(spec: dict, job: int, executor) -> dict:
    """One posterior (a fold, or all ten surveys when ``held`` is None): sample, diagnose, predict the held-out survey. The
    engine runs in the executor's workers; this function runs the sampler's bookkeeping."""
    import emcee

    held, seed, cfg = spec["held"], spec["seed"], Config(**spec["config"])
    rng = np.random.default_rng(seed)
    p0 = nominal_theta() + 0.05 * np.array([p.sd for p in PRIORS] + [NOISE_LOG_SD, NOISE_LOG_SD]) * rng.standard_normal((cfg.walkers, N_THETA))
    sampler = emcee.EnsembleSampler(cfg.walkers, N_THETA, _LogProb(job), pool=_PoolMap(executor), moves=[(emcee.moves.DEMove(), 0.8), (emcee.moves.DESnookerMove(), 0.2)])
    sampler.random_state = np.random.RandomState(seed % (2 ** 32)).get_state()
    sampler.run_mcmc(p0, cfg.steps, progress=False)
    tau = sampler.get_autocorr_time(discard=cfg.burn, tol=0, quiet=True)
    tau_max = float(np.nanmax(tau))
    post_steps = cfg.steps - cfg.burn
    converged = bool(np.isfinite(tau_max) and post_steps >= TAU_FACTOR * tau_max)
    chain = sampler.get_chain(discard=cfg.burn, thin=cfg.thin, flat=True)
    result: dict = {
        "held": held, "converged": converged, "tau_max": tau_max, "post_burn_steps": post_steps,
        "ratio": float(post_steps / tau_max) if np.isfinite(tau_max) and tau_max > 0 else 0.0,
        "acceptance": float(np.mean(sampler.acceptance_fraction)), "samples": int(chain.shape[0]),
    }
    pred_rng = np.random.default_rng(seed + 1)
    if held is None:
        # all ten: the engine scalars (for the contraction table) and a draw of the discrepancy coefficients per sample
        futures = [executor.submit(_task_discrepancy, (job, theta)) for theta in chain]
        d_samples: dict[str, list] = {t: [] for t in TARGETS}
        for f in futures:
            cond = f.result()
            if cond is None:
                continue
            for t in TARGETS:
                d_samples[t].append(pred_rng.multivariate_normal(*cond[t]).tolist())
        result["theta"] = chain.tolist()
        result["d_samples"] = d_samples
        return result
    # a fold: the predictive of the held-out survey at every retained posterior sample
    means = {t: [] for t in TARGETS}
    variances = {t: [] for t in TARGETS}
    draws = {t: [] for t in TARGETS}
    for f in [executor.submit(_task_predict, (job, theta)) for theta in chain]:
        pr = f.result()
        if pr is None:
            continue
        for t in TARGETS:
            m, v = pr[t]
            means[t].append(m)
            variances[t].append(v)
            draws[t].append(m + math.sqrt(v) * pred_rng.standard_normal(cfg.draws))
    result["pred"] = {t: {"mean": float(np.mean(means[t])), "means": means[t], "variances": variances[t],
                          "lo80": float(np.quantile(np.concatenate(draws[t]), 0.1)),
                          "hi80": float(np.quantile(np.concatenate(draws[t]), 0.9))} for t in TARGETS}
    return result


def fit_inline(spec: dict) -> dict:
    """One posterior in this process alone (a single job, no pool): the unit the tests exercise."""
    _init_worker([spec])
    return _fit(spec, 0, _InlineExecutor())


def kill_criterion(*, power_mape: float, power_mape_blin: float, tph_mape: float, tph_mape_m0: float,
                   coverage: dict[str, float], width: dict[str, float], width_crushercal: dict[str, float]) -> dict:
    """The kill criterion of the SDD (BS-2), as written, from numbers alone. CrusherBayes is dropped as a predictor when
    (a) its power LOO MAPE is not below B-lin's by at least 3 points AND it does not beat the backbone M0's throughput
    MAPE by at least 3 points, AND (b) on either target its coverage lies outside 0.7 to 0.9 OR its mean 80 percent band
    is wider than the CrusherCal band (the M0 band, nested). The 'at equal coverage' of the SDD is read as the direct
    comparison of the two mean widths, the coverages reported beside. Returns every term and the verdict."""
    power_gain = power_mape_blin - power_mape
    tph_gain = tph_mape_m0 - tph_mape
    a_power = power_gain >= MARGIN_MAPE_PTS
    a_tph = tph_gain >= MARGIN_MAPE_PTS
    a_holds = (not a_power) and (not a_tph)
    outside = {t: not (COVERAGE_BAND[0] <= coverage[t] <= COVERAGE_BAND[1]) for t in TARGETS}
    wider = {t: width[t] > width_crushercal[t] for t in TARGETS}
    b_holds = any(outside[t] or wider[t] for t in TARGETS)
    return {
        "rule": "dropped as a predictor if (a) power LOO MAPE is not below B-lin's by at least 3 points and the throughput LOO "
                "MAPE does not beat the backbone M0's by at least 3 points, and (b) on either target the coverage lies outside "
                "0.7 to 0.9 or the mean band is wider than the CrusherCal band",
        "margin_mape_pts": MARGIN_MAPE_PTS, "coverage_band": list(COVERAGE_BAND),
        "power_mape_pct": round(power_mape, 2), "power_mape_blin_pct": round(power_mape_blin, 2),
        "power_gain_over_blin_pts": round(power_gain, 2), "a_power_beats_blin_by_margin": bool(a_power),
        "tph_mape_pct": round(tph_mape, 2), "tph_mape_m0_pct": round(tph_mape_m0, 2),
        "tph_gain_over_m0_pts": round(tph_gain, 2), "a_tph_beats_m0_by_margin": bool(a_tph),
        "a_holds": bool(a_holds),
        "coverage": {t: round(coverage[t], 3) for t in TARGETS},
        "coverage_outside_band": {t: bool(outside[t]) for t in TARGETS},
        "mean_width": {t: round(width[t], 2) for t in TARGETS},
        "mean_width_crushercal": {t: round(width_crushercal[t], 2) for t in TARGETS},
        "band_wider_than_crushercal": {t: bool(wider[t]) for t in TARGETS},
        "b_holds": bool(b_holds),
        "verdict": "dropped as a predictor" if (a_holds and b_holds) else "kept",
    }


def _logmeanexp(a: np.ndarray) -> float:
    m = float(np.max(a))
    return m + math.log(float(np.mean(np.exp(a - m))))


def _score(y: np.ndarray, mean: np.ndarray, lpd: np.ndarray, lo: np.ndarray, hi: np.ndarray) -> dict:
    return {"mape_pct": round(loo_mod.mape(y, mean), 2), "rmse": round(loo_mod.rmse(y, mean), 2),
            "lpd_mean": round(float(np.mean(lpd)), 3), "coverage_80": round(float(np.mean((y >= lo) & (y <= hi))), 3),
            "mean_width": round(float(np.mean(hi - lo)), 2)}


def _comparator(y: np.ndarray, pred: np.ndarray) -> dict:
    """A residual-band model scored as CrusherBayes is: the nested 80 percent band (sigma of each survey from the other
    nine held-out residuals), the mean width 2 x 1.2816 sigma and the log density of the held-out value under N(pred, sigma^2)."""
    resid = y - pred
    nested = loo_mod.nested_band_coverage(resid)
    sigma = np.array(nested["sigma"])
    lpd = -0.5 * (resid / sigma) ** 2 - np.log(sigma) - 0.5 * math.log(2 * math.pi)
    return {"mape_pct": round(loo_mod.mape(y, pred), 2), "rmse": round(loo_mod.rmse(y, pred), 2),
            "lpd_mean": round(float(np.mean(lpd)), 3), "coverage_80": round(nested["coverage"], 3),
            "mean_width": round(float(np.mean(2 * loo_mod.K80 * sigma)), 2)}


def inputs_digest(css: np.ndarray, f80: np.ndarray, tph: np.ndarray, kw: np.ndarray, cfg: Config, seed: int) -> str:
    """A SHA-256 over what the document is a function of (the survey table, the sampler's size, the seed, the priors),
    so the document says which inputs it was sampled from."""
    h = hashlib.sha256()
    for a in (css, f80, tph, kw):
        h.update(np.asarray(a, dtype=float).tobytes())
    h.update(repr((cfg, seed, PRIORS, NOISE_MEDIAN, DISCREPANCY_SD, SAMPLER_VERSION)).encode("utf-8"))
    return h.hexdigest()


def build(backbone: dict, loo_doc: dict, version: str, seed: int = SEED, config: Config = DEFAULT_CONFIG,
          workers: int | None = None) -> dict:
    """The ``chancadem.hp500.crusherbayes/v1`` document from the backbone and the CrusherCal LOO documents (the comparators
    are read from the latter). Runs the sampler: eleven independent posteriors, spread over ``workers`` processes (default
    the CPU count); the document does not depend on the worker count."""
    surveys = backbone["surveys"]
    n = len(surveys)
    css = np.array([s["measured"]["css_mm"] for s in surveys], float)
    f80 = np.array([s["measured"]["f80_mm"] for s in surveys], float)
    y = {"tph": np.array([s["measured"]["feed_tph"] for s in surveys], float),
         "kW": np.array([s["measured"]["power_kw"] for s in surveys], float)}
    seeds = [int(c.generate_state(1)[0]) for c in np.random.SeedSequence(seed).spawn(n + 1)]
    specs = [{"css": css.tolist(), "f80": f80.tolist(), "tph": y["tph"].tolist(), "kW": y["kW"].tolist(), "held": h,
              "seed": seeds[k], "config": config.__dict__} for k, h in enumerate([*range(n), None])]
    for var in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
        os.environ[var] = "1"    # the matrices are 9 by 9: one BLAS thread per process, the walkers run in parallel
    nworkers = max(1, workers if workers is not None else (os.cpu_count() or 1))
    if nworkers == 1:
        _init_worker(specs)
        inline = _InlineExecutor()
        fits = [_fit(s, k, inline) for k, s in enumerate(specs)]
    else:
        with ProcessPoolExecutor(max_workers=nworkers, initializer=_init_worker, initargs=(specs,)) as pool, \
                ThreadPoolExecutor(max_workers=len(specs)) as drivers:
            fits = [f.result() for f in [drivers.submit(_fit, s, k, pool) for k, s in enumerate(specs)]]
    folds, full = fits[:n], fits[n]

    models = {}
    for t in TARGETS:
        mean = np.array([f["pred"][t]["mean"] for f in folds])
        lo = np.array([f["pred"][t]["lo80"] for f in folds])
        hi = np.array([f["pred"][t]["hi80"] for f in folds])
        lpd = np.array([_logmeanexp(-0.5 * (y[t][i] - np.array(f["pred"][t]["means"])) ** 2 / np.array(f["pred"][t]["variances"])
                                    - 0.5 * np.log(2 * math.pi * np.array(f["pred"][t]["variances"])))
                        for i, f in enumerate(folds)])
        models[t] = {"measured": [round(float(v), 2) for v in y[t]], "pred_mean": [round(float(v), 2) for v in mean],
                     "lo80": [round(float(v), 2) for v in lo], "hi80": [round(float(v), 2) for v in hi],
                     "scores": _score(y[t], mean, lpd, lo, hi)}
    strict = {t: loo_doc["loo"][t]["strict"] for t in TARGETS}
    comparators = {}
    for t in TARGETS:
        pred = strict[t]["pred"]
        comparators[t] = {"M0": _comparator(y[t], np.array(pred["M0"])), "B_lin": _comparator(y[t], np.array(pred["B_lin"])),
                          "M2": _comparator(y[t], np.array(pred["M2"]))}
    verdict = kill_criterion(
        power_mape=models["kW"]["scores"]["mape_pct"], power_mape_blin=comparators["kW"]["B_lin"]["mape_pct"],
        tph_mape=models["tph"]["scores"]["mape_pct"], tph_mape_m0=comparators["tph"]["M0"]["mape_pct"],
        coverage={t: models[t]["scores"]["coverage_80"] for t in TARGETS}, width={t: models[t]["scores"]["mean_width"] for t in TARGETS},
        width_crushercal={t: comparators[t]["M0"]["mean_width"] for t in TARGETS})

    theta = np.array(full["theta"])
    contraction = []
    for i, p in enumerate(PRIORS):
        v = np.exp(theta[:, i]) if p.log else theta[:, i]
        psd = prior_sd_natural(p)
        contraction.append({"name": p.name, "unit": p.unit, "nominal": p.nominal, "prior_sd": round(psd, 4),
                            "posterior_mean": round(float(np.mean(v)), 4), "posterior_sd": round(float(np.std(v)), 4),
                            "contraction": round(float(np.std(v) / psd), 3)})
    for k, t in enumerate(TARGETS):
        v = np.exp(theta[:, N_ENGINE + k])
        median = NOISE_MEDIAN[t]
        lognormal_sd = median * math.sqrt((math.exp(NOISE_LOG_SD ** 2) - 1) * math.exp(NOISE_LOG_SD ** 2))
        contraction.append({"name": f"sigma_{t}", "unit": "t/h" if t == "tph" else "kW", "nominal": median,
                            "prior_sd": round(lognormal_sd, 4), "posterior_mean": round(float(np.mean(v)), 4),
                            "posterior_sd": round(float(np.std(v)), 4), "contraction": round(float(np.std(v) / lognormal_sd), 3)})
    for t in TARGETS:
        d = np.array(full["d_samples"][t])
        for j, term in enumerate(DISCREPANCY_TERMS):
            contraction.append({"name": f"discrepancy_{t}_{term}", "unit": "t/h" if t == "tph" else "kW",
                                "nominal": 0.0, "prior_sd": DISCREPANCY_SD[t], "posterior_mean": round(float(d[:, j].mean()), 4),
                                "posterior_sd": round(float(d[:, j].std()), 4), "contraction": round(float(d[:, j].std() / DISCREPANCY_SD[t]), 3)})

    def conv(f: dict, name: object) -> dict:
        return {"fold": name, "converged": f["converged"], "tau_max": round(f["tau_max"], 1),
                "post_burn_steps": f["post_burn_steps"], "chain_over_tau": round(min(f["ratio"], 1e6), 1),
                "acceptance_fraction": round(f["acceptance"], 3), "samples": f["samples"]}

    return {
        "schema": SCHEMA,
        "source": dict(SOURCE),
        "engine_version": version,
        "n": n,
        "seed": seed,
        "inputs_sha256": inputs_digest(css, f80, y["tph"], y["kW"], config, seed),
        "method": {
            "sampler": SAMPLER_NAME, "sampler_version": SAMPLER_VERSION, "move": SAMPLER_MOVE,
            "walkers": config.walkers, "steps": config.steps, "burn_in_steps": config.burn, "thin": config.thin,
            "predictive_draws_per_sample": config.draws,
            "likelihood": "Gaussian on the measured throughput [t/h] and power [kW]: engine(theta) + discrepancy + noise, the "
                          "discrepancy (a constant and slopes on standardized CSS and f80, N(0, tau^2) each) integrated out exactly",
            "discrepancy_prior_sd": {t: DISCREPANCY_SD[t] for t in TARGETS},
            "noise_prior": {"family": "ln sigma ~ N(ln median, 1)", "median": dict(NOISE_MEDIAN), "log_sd": NOISE_LOG_SD},
            "p80": "not a target: it is not measured",
            "interval_80": "the 10th and 90th percentiles of the posterior predictive draws of the held-out survey",
        },
        "priors": [p._asdict() for p in PRIORS],
        "convergence": {
            "criterion": f"converged when the post-burn chain is at least {TAU_FACTOR} integrated autocorrelation times long "
                         "(emcee get_autocorr_time, largest over the parameters); a failing posterior is recorded as not converged",
            "tau_factor": TAU_FACTOR,
            "folds": [conv(f, i + 1) for i, f in enumerate(folds)] + [conv(full, "all")],
            "all_converged": all(f["converged"] for f in fits),
        },
        "loo": models,
        "comparators": comparators,
        "comparators_note": "scored on the same ten surveys: B_lin, M0 (the CrusherCal band) and M2 with the nested 80 percent band "
                            "of loo.nested_band_coverage (sigma of each survey from the other nine held-out residuals)",
        "contraction": contraction,
        "contraction_note": "posterior over prior standard deviation on the fit to all ten surveys; below 0.5 the surveys identify "
                            "the parameter, near 1 it stays at its prior; the discrepancy rows are the exact conditional of the "
                            "coefficients given the engine scalars",
        "kill_criterion": verdict,
    }
