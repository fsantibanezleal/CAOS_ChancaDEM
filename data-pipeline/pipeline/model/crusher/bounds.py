"""Sourced setting and reduction-ratio warnings. Counterpart of ``frontend/src/engine/bounds.ts``.

Two checks run in ``evaluate`` after the envelope gate, on the operating point and the computed reduction ratio
F80 / P80. A breach is a warning, never an invalidity: the vendors call the minimum setting soft ("the minimum setting
is that at which the crusher will operate without causing ring bounce", Metso HP guide p. 6; "smaller closed side
settings may be possible", Metso C Series brochure p. 11), and the reduction ratios are typical ranges, not hard
maxima. Both bounds are strict: a setting exactly at the minimum, or a ratio exactly at the ceiling, does not warn.
The result's ``valid`` is never touched. The codes are stable; their bilingual text is presentation and stays in the
TypeScript layer (``flags.ts``).

Sources (the research report ``r-min-css-2026-10-27`` of the coordination repository holds the pages read):

* S1: Metso, "Nordberg HP Series cone crushers, Wear parts application guide" (code 2602): chamber selection table
  p. 6 (minimum setting "A": 16 mm for the HP500 standard liners, 6 mm for the HP500 short head); reduction ratio of
  the HP standard chamber 3 to 5 and of the short head chamber 2 to 4, p. 2.
* S4: Metso, "Nordberg C Series jaw crushers" brochure 4226-04-24, 2024: technical specifications p. 11 (minimum
  closed side setting from 40 mm for the C80, the smallest of the series, up to 175 mm for the C200).
* S7: Metso, "Basics in Minerals Processing", 8th ed. 2011, p. 3:2: reduction ratio jaw 3 to 4, gyratory 3 to 4.
"""
from __future__ import annotations

CSS_BELOW_VENDOR_MINIMUM = "css_below_vendor_minimum"
REDUCTION_RATIO_ABOVE_TYPICAL = "reduction_ratio_above_typical"
BOUND_CODES = (CSS_BELOW_VENDOR_MINIMUM, REDUCTION_RATIO_ABOVE_TYPICAL)

# Minimum closed-side setting [mm] below which the vendor's smallest model of the engine's machine type no longer
# operates. cone-sec: HP500 standard liners, S1 p. 6 (smallest minimum "A" over the standard chambers). cone-tert and
# cone-short-head: HP500 short head, S1 p. 6. jaw: the smallest minimum of the C Series, the C80, S4 p. 11, so a
# setting below it is below every C-series jaw's minimum. gyratory: no source found (the Metso Superior MKIII
# brochures tabulate capacity from an open-side setting of 152 mm only), so the check is skipped, never guessed.
MIN_VENDOR_CSS_MM: dict[str, float] = {
    "cone-sec": 16,
    "cone-tert": 6,
    "cone-short-head": 6,
    "jaw": 40,
}

# Upper end of the typical reduction ratio F80 / P80 of one stage. cone-sec: HP standard chamber 3 to 5, S1 p. 2.
# cone-tert and cone-short-head: HP short head chamber 2 to 4, S1 p. 2. jaw and gyratory: 3 to 4, S7 p. 3:2.
MAX_TYPICAL_REDUCTION_RATIO: dict[str, float] = {
    "cone-sec": 5,
    "cone-tert": 4,
    "cone-short-head": 4,
    "jaw": 4,
    "gyratory": 4,
}


def check_bounds(machine: str, css_mm: float, reduction_ratio: float) -> tuple[str, ...]:
    """The warning codes of a setting and a reduction ratio, in a fixed order (setting, then ratio)."""
    codes: list[str] = []
    minimum = MIN_VENDOR_CSS_MM.get(machine)
    if minimum is not None and css_mm < minimum:
        codes.append(CSS_BELOW_VENDOR_MINIMUM)
    ceiling = MAX_TYPICAL_REDUCTION_RATIO.get(machine)
    if ceiling is not None and reduction_ratio > ceiling:
        codes.append(REDUCTION_RATIO_ABOVE_TYPICAL)
    return tuple(codes)
