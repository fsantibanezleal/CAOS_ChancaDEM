"""The campaign view's two functions. Counterpart of ``frontend/src/engine/campaign.ts``.

As the closed-side setting drifts open with liner wear, the engine's P80 rises with it. ``css_at_p80_target`` finds the
setting at which the engine's P80 reaches a target; the opening allowed before the product leaves its target is that setting
minus the current one, and ``hours_to_target`` divides it by a drift rate the user supplies. The product models no wear and
asserts no drift rate: nothing here has a default for it (research report ``r-liner-wear-2026-10-27``: no primary source for a
liner wear rate or a CSS drift rate in mm/h; the only sourced practice is the re-set every 45 h of Ma, Fan and He, Appl. Sci.
2016, doi:10.3390/app6120404, p. 3).

The caller passes the setting ceiling ``css_max_mm``: the app uses the upper bound of the machine's training range
(``sweep.RANGES``, ``css_mm``). The search runs over the settings the engine answers as a valid point, from the current
setting up to the ceiling, on a fixed grid of ``GRID_POINTS`` settings; a P80 that falls over that grid is reported as no
answer (``None``), never as a guess.
"""
from __future__ import annotations

import math

from .engine import evaluate
from .types import Operating

# The settings sampled to confirm that P80 rises with the setting over the bracket, and the bisection steps (a fixed count,
# so the two engines run the same iterations).
GRID_POINTS = 64
BISECTION_STEPS = 60
# P80 may fall by this many floating-point steps (ulps) between two grid settings before the bracket counts as not monotone.
MONOTONE_SLACK_ULPS = 4


def _p80_if_valid(op: Operating) -> float | None:
    r = evaluate(op)
    p80 = r.p80
    if not r.valid or not math.isfinite(p80) or p80 <= 0:
        return None
    return p80


def css_at_p80_target(op: Operating, p80_target_mm: float, css_max_mm: float) -> float | None:
    """The smallest closed-side setting at or above the current one at which the engine's P80 reaches ``p80_target_mm``.

    Returns ``op.css_mm`` when the current P80 is already at or above the target, and ``None`` when the point or an input is
    invalid, when ``css_max_mm`` is not above the current setting, when P80 is not monotone over the bracket, or when the
    target is not reached at a valid setting at or below ``css_max_mm``.
    """
    if not (math.isfinite(p80_target_mm) and p80_target_mm > 0 and math.isfinite(css_max_mm) and math.isfinite(op.css_mm)):
        return None
    if not (op.css_mm > 0 and css_max_mm > op.css_mm):
        return None
    p0 = _p80_if_valid(op)
    if p0 is None:
        return None
    if p0 >= p80_target_mm:
        return float(op.css_mm)

    def at(css: float) -> float | None:
        return _p80_if_valid(Operating(**{**op.__dict__, "css_mm": css}))

    # the valid prefix of the bracket, checked for monotonicity
    last_css, last_p80, prev = op.css_mm, p0, p0
    for i in range(1, GRID_POINTS):
        css = op.css_mm + (css_max_mm - op.css_mm) * i / (GRID_POINTS - 1)
        p = at(css)
        if p is None:
            break
        if p < prev - MONOTONE_SLACK_ULPS * math.ulp(prev):
            return None
        prev = p
        last_css, last_p80 = css, p
    if last_p80 < p80_target_mm:
        return None
    lo, hi = op.css_mm, last_css
    for _ in range(BISECTION_STEPS):
        mid = (lo + hi) / 2
        pm = at(mid)
        if pm is None or pm >= p80_target_mm:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


def hours_to_target(delta_css_mm: float, drift_mm_per_h: float) -> float | None:
    """Operating hours until the setting has opened by ``delta_css_mm`` at ``drift_mm_per_h``; 0 when nothing remains to open.

    ``None`` when either number is not finite or the drift is not positive: a setting that does not drift never leaves its target.
    """
    if not (math.isfinite(delta_css_mm) and math.isfinite(drift_mm_per_h)) or drift_mm_per_h <= 0:
        return None
    # nothing left to open is zero hours (a negative opening counts as none)
    return max(delta_css_mm, 0) / drift_mm_per_h
