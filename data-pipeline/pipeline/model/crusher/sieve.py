"""The geometric sieve grid and PSD utilities. Counterpart of ``frontend/src/engine/sieve.ts``.

The grid is the square-root-of-two series (the standard lab sieve progression). Classes are ordered coarse to fine
(descending edges) to match the strictly lower-triangular breakage matrix: progeny is always finer, so the lower
class index appears later and B is lower-triangular in this ordering. Size-at-passing interpolates log-linearly in
size between edges; passing-at-size interpolates linearly in the log of the size.
"""
from __future__ import annotations

import math

from .jsmath import jexp, jlog, jsqrt, or_one
from .types import PSD


def make_grid(top_mm: float = 256, k: int = 28, ratio: float = math.sqrt(2)) -> list[float]:
    """Descending geometric sieve grid from ``top_mm`` by ``ratio`` for ``k`` classes (k + 1 edges)."""
    edges: list[float] = []
    v = float(top_mm)
    for _ in range(k + 1):
        edges.append(v)
        v /= ratio
    return edges


def mid_sizes(edges: list[float]) -> list[float]:
    """Geometric mid-size of each class from its edges."""
    return [jsqrt(edges[i] * edges[i + 1]) for i in range(len(edges) - 1)]


def cumulative_passing(_edges: list[float], mass: list[float]) -> list[float]:
    """Cumulative passing at each edge from per-class mass (mass[i] lies between edge i and i + 1)."""
    k = len(mass)
    passing = [0.0] * (k + 1)
    acc = 0.0
    for i in range(k - 1, -1, -1):
        acc += mass[i]
        passing[i] = acc
    passing[k] = 0.0
    tot = or_one(passing[0])   # normalize defensively
    for i in range(k + 1):
        passing[i] /= tot
    return passing


def to_psd(edges: list[float], mass: list[float]) -> PSD:
    """Assemble a PSD from a grid and per-class mass, renormalized to a sum of 1."""
    total = 0.0
    for m in mass:
        total += m
    tot = or_one(total)
    norm = [m / tot for m in mass]
    return PSD(
        edges_mm=tuple(edges),
        mid_mm=tuple(mid_sizes(edges)),
        mass=tuple(norm),
        passing=tuple(cumulative_passing(edges, norm)),
    )


def size_at_passing(psd: PSD, frac: float) -> float:
    """Size at a given cumulative passing fraction (0.8 gives P80), log-interpolated on the passing curve."""
    e, p = psd.edges_mm, psd.passing
    for i in range(len(p) - 1):
        hi, lo = p[i], p[i + 1]
        if frac <= hi and frac >= lo:
            if hi == lo:
                return e[i]
            t = (frac - lo) / (hi - lo)
            return jexp(jlog(e[i + 1]) + t * (jlog(e[i]) - jlog(e[i + 1])))
    return e[0] if frac > p[0] else e[len(e) - 1]


def passing_at_size(psd: PSD, size_mm: float) -> float:
    """Linear-interpolated fraction passing at an arbitrary size [mm] (the 1, 4, 8, 16, 32 mm readouts)."""
    e, p = psd.edges_mm, psd.passing
    if size_mm >= e[0]:
        return 1.0
    if size_mm <= e[len(e) - 1]:
        return 0.0
    for i in range(len(e) - 1):
        hi_e, lo_e = e[i], e[i + 1]
        if size_mm <= hi_e and size_mm >= lo_e:
            t = (jlog(size_mm) - jlog(lo_e)) / (jlog(hi_e) - jlog(lo_e))
            return p[i + 1] + t * (p[i] - p[i + 1])
    return 0.0
