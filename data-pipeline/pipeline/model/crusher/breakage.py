"""The breakage (appearance) function B. Counterpart of ``frontend/src/engine/breakage.ts``.

Two cited models are composed:

1. Energy to fineness (JKMRC drop-weight, Narayanan and Whiten 1988): t10 = A (1 - exp(-b Ecs)), where t10 is the
   fraction of progeny passing 1/10 of the parent size, Ecs the specific comminution energy [kWh/t], and A, b the
   ore-competence parameters (their product A*b is the single-number hardness index).
2. Progeny shape (Austin, Klimpel and Luckie 1984, Process Engineering of Size Reduction): the cumulative
   breakage distribution B(u) = phi u^gamma + (1 - phi) u^beta for relative size u = x / y in (0, 1], with
   B(1) = 1. phi is fixed by t10, gamma and beta set the fines and coarse slopes.

The matrix B[i][j] (mass fraction of broken class-j material reporting to finer class i) is strictly lower
triangular, so B*C has a zero diagonal, (I - B*C) has a unit diagonal, det = 1 and the Whiten solve is always
non-singular. Each column is renormalized to exactly 1 so broken mass is conserved. The matrix is returned
row-major as a flat list of n * n floats.
"""
from __future__ import annotations

from .jsmath import jexp, jmax, jmin, jpow

# Austin slopes. gamma lets the appearance function represent the full t10 range it is asked to pass through: at
# u = 1/10 the maximum reachable value (phi = 1) is 0.1^gamma, so gamma = 0.35 gives a maximum t10 of about 0.447.
GAMMA = 0.35
BETA = 4.2   # coarse-end slope, within 3 to 6


def specific_energy(speed_rpm: float, ref_throw_mm: float, speed_ref: float = 350) -> float:
    """Specific comminution energy Ecs [kWh/t] per nip, driven by the design throw and the gyration rate (not by
    the live throw slider: more throw coarsens the product through K2, it does not add energy)."""
    return 0.033 * ref_throw_mm * (speed_rpm / speed_ref)


def t10_of(ecs_kwh_t: float, ore_axb: float, a: float = 60) -> float:
    """JKMRC t10 [fraction 0 to 1] from specific energy and ore competence A*b (A about 60; b = A*b / A). Capped at
    0.44 so it stays representable by the Austin function (max 0.1^gamma, about 0.447)."""
    b = ore_axb / a
    return jmax(0.0, jmin(0.44, (a * (1 - jexp(-b * ecs_kwh_t))) / 100))


def t10_calibrated(css_mm: float, f80_mm: float) -> float:
    """HP500 secondary-cone t10 [fraction] calibrated to the Minas Rio surveys (Rocha et al. 2024, Table 5):
    t10 (%) = 64 - 0.12 CSS - 0.23 f80, capped at 0.44 like the synthetic path."""
    return jmax(0.0, jmin(0.44, (64 - 0.12 * css_mm - 0.23 * f80_mm) / 100))


def appearance_cum(u: float, phi: float) -> float:
    """Austin cumulative breakage: fraction of progeny from a parent finer than relative size u = x / y."""
    if u <= 0:
        return 0.0
    if u >= 1:
        return 1.0
    return phi * jpow(u, GAMMA) + (1 - phi) * jpow(u, BETA)


def phi_from_t10(t10: float) -> float:
    """Solve phi so the appearance function passes through (u = 1/10, B = t10), clamped to a valid (0, 1) shape."""
    ug = jpow(0.1, GAMMA)
    ub = jpow(0.1, BETA)
    phi = (t10 - ub) / (ug - ub)
    return jmax(0.02, jmin(0.98, phi))


def t_family(t10: float) -> list[tuple[int, float]]:
    """The JKMRC t-family (tn = fraction passing 1/n of the parent) for a given t10."""
    phi = phi_from_t10(t10)
    return [(n, appearance_cum(1 / n, phi)) for n in (2, 4, 10, 25, 50, 75)]


def breakage_matrix(edges: list[float], mid: list[float], phi: float) -> list[float]:
    """The strictly lower-triangular breakage matrix B on a sieve grid, row-major (n * n). Edges descend; mid[j] is
    the parent mid-size of class j; progeny reports only to strictly finer classes i > j."""
    n = len(mid)
    b = [0.0] * (n * n)
    for j in range(n):
        y = mid[j]
        col_sum = 0.0
        col = [0.0] * n
        for i in range(j + 1, n):                 # strictly finer classes only
            upper = jmin(edges[i], y)             # upper edge of class i, capped at the parent size
            lower = edges[i + 1]                  # lower edge of class i
            frac = appearance_cum(upper / y, phi) - appearance_cum(lower / y, phi)
            v = jmax(0.0, frac)
            col[i] = v
            col_sum += v
        if col_sum > 0:
            for i in range(j + 1, n):
                b[i * n + j] = col[i] / col_sum   # conserve broken mass
    return b
