"""Small dense linear algebra on flat row-major lists. Counterpart of ``frontend/src/engine/linalg.ts``.

The live crusher math is a small dense solve; the LU with partial pivoting is ported as written (not
``numpy.linalg.solve``) so the order of the floating-point operations is the TypeScript order, and the conditioning
proxy is the TypeScript row-sum ratio. All matrices are row-major flat lists of length n * n.
"""
from __future__ import annotations

import math


class SingularMatrixError(ValueError):
    """A zero pivot, the TypeScript ``solveLU: singular matrix (zero pivot)`` throw."""


def solve_lu(a_in: list[float], b: list[float], n: int) -> list[float]:
    """Solve A x = b by LU decomposition with partial pivoting. Raises ``SingularMatrixError`` on a zero pivot."""
    a = list(a_in)           # working copy (the elimination overwrites it)
    piv = list(range(n))

    for k in range(n):
        # partial pivot: largest |a[i][k]| in column k at or below the diagonal
        p = k
        mx = abs(a[k * n + k])
        for i in range(k + 1, n):
            v = abs(a[i * n + k])
            if v > mx:
                mx = v
                p = i
        if mx == 0:
            raise SingularMatrixError("solve_lu: singular matrix (zero pivot)")
        if p != k:
            for j in range(n):
                a[k * n + j], a[p * n + j] = a[p * n + j], a[k * n + j]
            piv[k], piv[p] = piv[p], piv[k]
        akk = a[k * n + k]
        for i in range(k + 1, n):
            f = a[i * n + k] / akk
            a[i * n + k] = f
            for j in range(k + 1, n):
                a[i * n + j] -= f * a[k * n + j]

    # forward solve L z = P b
    z = [0.0] * n
    for i in range(n):
        s = b[piv[i]]
        for j in range(i):
            s -= a[i * n + j] * z[j]
        z[i] = s
    # back solve U x = z
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        s = z[i]
        for j in range(i + 1, n):
            s -= a[i * n + j] * x[j]
        x[i] = s / a[i * n + i]
    return x


def cond_proxy(m: list[float], n: int) -> float:
    """Cheap conditioning proxy of M = I - B*C: the ratio of the largest to the smallest absolute row sum."""
    lo = math.inf
    hi = 0.0
    for i in range(n):
        s = 0.0
        for j in range(n):
            s += abs(m[i * n + j])
        if s < lo:
            lo = s
        if s > hi:
            hi = s
    return hi / lo if lo > 0 else math.inf
