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
