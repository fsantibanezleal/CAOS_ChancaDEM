"""The Whiten crusher solve. Counterpart of ``frontend/src/engine/whiten.ts``.

The chamber is one breakage zone with classification C (which particles are nipped) and breakage B (how the nipped
ones distribute to finer sizes). The internal balance x = f + B C x gives the product p = (I - C)(I - B C)^-1 f,
with (I - C) on the left of the inverse (Whiten 1972; Napier-Munn et al. 1996). The inverse is never formed: the
system (I - B C) x = f is LU-solved, then (I - C) is applied. B is strictly lower triangular, so (I - B C) is
unit-diagonal and non-singular; a conditioning guard is kept for the near-choke regime.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from .jsmath import jmax
from .linalg import SingularMatrixError, cond_proxy, solve_lu


@dataclass(frozen=True)
class WhitenOut:
    product: list[float]
    mass_closure: float
    cond: float


def whiten_solve(c: list[float], b: list[float], f: list[float], n: int) -> WhitenOut:
    """Solve the Whiten model. ``c``: classification per class; ``b``: strictly lower-triangular breakage matrix
    (row-major n * n); ``f``: feed mass per class (sum = 1). Returns the product mass per class."""
    # M = I - B C ; C diagonal, so (B C)[i][j] = B[i][j] c[j]
    m = [0.0] * (n * n)
    for i in range(n):
        for j in range(n):
            m[i * n + j] = (1 if i == j else 0) - b[i * n + j] * c[j]
    cond = cond_proxy(m, n)
    try:
        x = solve_lu(m, list(f), n)
    except SingularMatrixError:
        # singular (should not happen with strictly-lower B): feed unchanged so the caller flags it
        return WhitenOut(product=list(f), mass_closure=0.0, cond=math.inf)
    # p = (I - C) x
    product = [0.0] * n
    total = 0.0
    for i in range(n):
        v = jmax(0.0, (1 - c[i]) * x[i])
        product[i] = v
        total += v
    feed_sum = 0.0
    for v in f:
        feed_sum += v
    # exact in exact arithmetic; report the residual before renormalizing for display
    closure = abs(total - feed_sum)
    if total > 0:
        for i in range(n):
            product[i] /= total   # renormalize to a clean PSD (sum = 1)
    return WhitenOut(product=product, mass_closure=closure, cond=cond)


def assemble_chamber(op):
    """The chamber of one operating point as the engine builds it: the classification ``c`` (a vector of K values) and the
    breakage matrix ``B`` (K by K, strictly lower triangular), for the grid of the engine. ``whiten_solve`` of this ``c``
    and ``B`` and the feed of ``op`` is the product ``evaluate(op)`` returns. Same rules as ``evaluate``: the classification
    window tracks the feed F80, the setting and the throw; the breakage comes from the specific energy and the ore A*b, or
    from the HP500 fit on the calibrated lane."""
    import numpy as np

    from .breakage import breakage_matrix, phi_from_t10, specific_energy, t10_calibrated, t10_of
    from .classification import classification_params, classify
    from .engine import grid_edges, grid_f80, grid_mid
    from .machines import REF_THROW_MM

    edges, mid = grid_edges(), grid_mid()
    f80 = grid_f80(op)
    params = classification_params(op.machine, op.css_mm, f80_mm=f80, calibrated=op.calibrated, throw_mm=op.throw_mm)
    c = np.array([classify(d, params) for d in mid], dtype=float)
    ecs = specific_energy(op.speed_rpm, REF_THROW_MM[op.machine])
    t10 = t10_calibrated(op.css_mm, f80) if op.calibrated else t10_of(ecs, op.ore_axb)
    k = len(mid)
    return c, np.array(breakage_matrix(edges, mid, phi_from_t10(t10)), dtype=float).reshape(k, k)


def replacement_walk(c, b, feed, parcels, seed):
    """The particle-replacement rule of discrete-element crusher models, run on counts of parcels per class: ``parcels``
    parcels enter with the feed proportions; in each pass a class-j parcel is nipped with probability ``c[j]`` (binomial),
    the ones not nipped leave as product, and the nipped ones of class j are re-distributed by the column ``b[:, j]``
    (multinomial) and enter the next pass, until none is inside. Seeded. Returns ``(product, nips_per_parcel)``: the
    product class fractions and the mean number of nips a parcel suffers. Its expectation is the Whiten product
    ``(I - C)(I - B C)^-1 f``, so it measures the sampling error of a walk of that many parcels, not a different model."""
    import numpy as np

    c, b, feed = np.asarray(c, dtype=float), np.asarray(b, dtype=float), np.asarray(feed, dtype=float)
    k = feed.size
    rng = np.random.default_rng(seed)
    inside = rng.multinomial(parcels, feed)
    product = np.zeros(k, dtype=np.int64)
    nips = 0
    while inside.sum() > 0:
        nipped = rng.binomial(inside, c)
        product += inside - nipped
        nips += nipped.sum()
        inside = np.zeros(k, dtype=np.int64)
        for j in np.nonzero(nipped)[0]:
            inside += rng.multinomial(nipped[j], b[:, j])
    return product / product.sum(), nips / parcels
