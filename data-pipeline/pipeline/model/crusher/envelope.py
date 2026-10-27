"""Validated-envelope gate. Counterpart of ``frontend/src/engine/envelope.ts``.

An empirical model must flag implausible or out-of-calibration inputs, never emit a confident number for them. Two
layers: (1) physically implausible on any lane: f80 below CSS (the feed is finer than the setting, nothing is
gripped), CSS at or below 0, or a non-positive feed size; (2) out of the calibrated envelope on the calibrated
HP500 lane: the Rocha et al. 2024 fit is supported only for CSS in [38, 55] mm and f80 in [47, 140] mm on itabirite
iron ore. The gate returns stable codes; the bilingual UI text of the codes (``envelopeText``) is presentation and
stays in the TypeScript layer.
"""
from __future__ import annotations

from dataclasses import dataclass

from .types import Operating

# The calibrated support of the HP500 secondary-cone fit (the 10-survey range).
HP500_ENVELOPE_CSS_MM = (38, 55)
HP500_ENVELOPE_F80_MM = (47, 140)

ENVELOPE_CODES = (
    "f80_lt_css",
    "css_nonpositive",
    "feed_nonpositive",
    "css_outside_calibrated",
    "f80_outside_calibrated",
)


@dataclass(frozen=True)
class EnvelopeCheck:
    in_envelope: bool            # every check passes
    implausible: bool            # a physically-implausible input was found
    codes: tuple[str, ...]


def check_envelope(op: Operating, f80_mm: float, declared_f80_mm: float | None = None) -> EnvelopeCheck:
    """Gate an operating point. ``f80_mm`` is the engine-computed feed 80%-passing size [mm], read on the 256 mm grid,
    which truncates a coarse feed. ``declared_f80_mm`` is the F80 the feed declares (the untruncated Rosin-Rammler law of
    ``feed_x63_mm`` and ``feed_m``); the calibrated-support check tests it, because the support is a range of declared
    feed sizes (the surveys' measured f80). It defaults to ``f80_mm``."""
    declared = f80_mm if declared_f80_mm is None else declared_f80_mm
    codes: list[str] = []
    implausible = False

    if not (op.css_mm > 0):
        codes.append("css_nonpositive")
        implausible = True
    if not (op.feed_x63_mm > 0):
        codes.append("feed_nonpositive")
        implausible = True
    if f80_mm > 0 and op.css_mm >= f80_mm:
        codes.append("f80_lt_css")
        implausible = True

    # calibrated-support checks apply only on the calibrated cone-sec lane
    if op.calibrated and op.machine == "cone-sec":
        c_lo, c_hi = HP500_ENVELOPE_CSS_MM
        f_lo, f_hi = HP500_ENVELOPE_F80_MM
        if op.css_mm < c_lo or op.css_mm > c_hi:
            codes.append("css_outside_calibrated")
        if declared > 0 and (declared < f_lo or declared > f_hi):
            codes.append("f80_outside_calibrated")

    return EnvelopeCheck(in_envelope=len(codes) == 0, implausible=implausible, codes=tuple(codes))
