"""Feed particle-size distribution generator. Counterpart of ``frontend/src/engine/feed.ts``.

The Rosin-Rammler (Weibull) model is the standard description of crushed-rock feed: cumulative passing
R(x) = 1 - exp[-(x / x63)^m], where x63 is the size at 63.2% passing and m is the uniformity exponent (higher m
gives a more uniform feed). Reference: Rosin and Rammler 1933. Gaudin-Schuhmann is the alternative power-law fit.
"""
from __future__ import annotations

from .jsmath import jdiv, jexp, jmax, jpow
from .sieve import to_psd
from .types import PSD


def rosin_rammler_passing(x_mm: float, x63: float, m: float) -> float:
    """Rosin-Rammler cumulative fraction passing size x."""
    if x_mm <= 0:
        return 0.0
    return 1 - jexp(-jpow(jdiv(x_mm, x63), m))


def make_feed(edges: list[float], x63: float, m: float) -> PSD:
    """Discretize a Rosin-Rammler feed onto a sieve grid, giving per-class mass (sum = 1)."""
    k = len(edges) - 1
    mass = [0.0] * k
    for i in range(k):
        up = rosin_rammler_passing(edges[i], x63, m)      # passing at the upper edge
        lo = rosin_rammler_passing(edges[i + 1], x63, m)  # passing at the lower edge
        mass[i] = jmax(0.0, up - lo)
    return to_psd(edges, mass)


def gaudin_schuhmann_passing(x_mm: float, k_mm: float, a: float) -> float:
    """Gaudin-Schuhmann passing, R(x) = (x / k)^a for x < k."""
    if x_mm <= 0:
        return 0.0
    if x_mm >= k_mm:
        return 1.0
    return jpow(jdiv(x_mm, k_mm), a)
