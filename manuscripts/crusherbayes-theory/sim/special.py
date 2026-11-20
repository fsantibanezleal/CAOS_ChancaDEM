"""The special functions the harness needs, in numpy and the standard library only (the environment has no scipy):
the regularized incomplete beta and gamma functions (continued fractions and series of Press et al., Numerical Recipes,
3rd ed., sections 6.2 and 6.4), the Student-t distribution function and quantile, and the chi-square survival function.
Each is tested against tabulated values (tests/test_harness.py, test k)."""
from __future__ import annotations

import math

_EPS = 1e-15
_TINY = 1e-300


def _betacf(a: float, b: float, x: float) -> float:
    """The continued fraction of the incomplete beta function (modified Lentz)."""
    qab, qap, qam = a + b, a + 1.0, a - 1.0
    c, d = 1.0, 1.0 - qab * x / qap
    d = 1.0 / (d if abs(d) > _TINY else _TINY)
    h = d
    for m in range(1, 10_000):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        d = 1.0 / (d if abs(d) > _TINY else _TINY)
        c = 1.0 + aa / c
        c = c if abs(c) > _TINY else _TINY
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        d = 1.0 / (d if abs(d) > _TINY else _TINY)
        c = 1.0 + aa / c
        c = c if abs(c) > _TINY else _TINY
        de = d * c
        h *= de
        if abs(de - 1.0) < _EPS:
            return h
    raise ArithmeticError("incomplete beta continued fraction did not converge")


def betainc(a: float, b: float, x: float) -> float:
    """The regularized incomplete beta function I_x(a, b)."""
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    lbt = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log1p(-x)
    if x < (a + 1.0) / (a + b + 2.0):
        return math.exp(lbt) * _betacf(a, b, x) / a
    return 1.0 - math.exp(lbt) * _betacf(b, a, 1.0 - x) / b


def t_cdf(t: float, df: float) -> float:
    """The Student-t distribution function with ``df`` degrees of freedom."""
    tail = 0.5 * betainc(df / 2.0, 0.5, df / (df + t * t))
    return 1.0 - tail if t >= 0 else tail


def t_ppf(p: float, df: float) -> float:
    """The Student-t quantile, by bisection on the distribution function to machine precision."""
    if not 0.0 < p < 1.0:
        raise ValueError("p must lie in (0, 1)")
    if p < 0.5:
        return -t_ppf(1.0 - p, df)
    lo, hi = 0.0, 1.0
    while t_cdf(hi, df) < p:
        hi *= 2.0
    for _ in range(200):
        mid = 0.5 * (lo + hi)
        if t_cdf(mid, df) < p:
            lo = mid
        else:
            hi = mid
        if hi - lo < 1e-14 * max(1.0, hi):
            break
    return 0.5 * (lo + hi)


def gammaincc(a: float, x: float) -> float:
    """The regularized upper incomplete gamma function Q(a, x): the series below a + 1, the continued fraction above."""
    if x <= 0.0:
        return 1.0
    gln = math.lgamma(a)
    if x < a + 1.0:
        ap, s = a, 1.0 / a
        delta = s
        for _ in range(100_000):
            ap += 1.0
            delta *= x / ap
            s += delta
            if abs(delta) < abs(s) * _EPS:
                break
        return 1.0 - s * math.exp(-x + a * math.log(x) - gln)
    b = x + 1.0 - a
    c, d = 1.0 / _TINY, 1.0 / b
    h = d
    for i in range(1, 100_000):
        an = -i * (i - a)
        b += 2.0
        d = an * d + b
        d = 1.0 / (d if abs(d) > _TINY else _TINY)
        c = b + an / c
        c = c if abs(c) > _TINY else _TINY
        de = d * c
        h *= de
        if abs(de - 1.0) < _EPS:
            break
    return math.exp(-x + a * math.log(x) - gln) * h


def chi2_sf(x: float, k: float) -> float:
    """The chi-square survival function P(X > x) with ``k`` degrees of freedom."""
    return gammaincc(k / 2.0, x / 2.0)
