"""The calibrated HP500 backbone: the canonical Python crusher engine on each survey of the HP500 table.

Contract hp500-backbone (``chancadem.hp500.backbone/v1``). Pure: the survey list in, the document out, no file I/O.
"""
from __future__ import annotations

import math

from ..model.crusher import evaluate, operating_from_survey
from ..model.crusher.capacity import bond_power, calibrated_power
from ..model.crusher.hp500 import HP500_BLEND_WI_KWH_T
from .surveys import SOURCE, Survey

NOTE = (
    "Backbone = the canonical Python crusher engine (pipeline.model.crusher, a port of the TypeScript "
    "Whiten/Evertsson/Bond engine held to tests/fixtures/engine-reference.json) with the HP500 calibration of "
    "Rocha et al. 2024, Table 5, run at each survey's measured closed-side setting and f80 with the HP500 nominal "
    "throw (34 mm) and speed (360 rpm). Measured t/h and kW are ground truth; P80 is a model output (the paper PSD "
    "curves are figure-only), graded as self-consistency. The paper power constants zeta=1.30, Pn=110 apply to the "
    "paper size-specific Pd, NOT the classical Bond draw here."
)


def _r2(x: float) -> float:
    """Round to two decimals the way the shipped TypeScript bake did (Math.round: ties go up)."""
    return math.floor(x * 100 + 0.5) / 100


def _num(x: float) -> float | int:
    return int(x) if float(x).is_integer() else x


def build(surveys: list[Survey], version: str) -> dict:
    if not surveys:
        raise ValueError("no accepted survey: the backbone needs at least one HP500 survey")
    rows = []
    for s in surveys:
        op = operating_from_survey(s.css_mm, s.f80_mm)
        r = evaluate(op)
        pd = bond_power(r.throughput_tph, r.f80, r.p80, HP500_BLEND_WI_KWH_T)
        rows.append({
            "id": f"HP500-{s.survey:02d}",
            "n": s.survey,
            "measured": {"css_mm": _num(s.css_mm), "f80_mm": _num(s.f80_mm),
                         "feed_tph": _num(s.feed_tph), "power_kw": _num(s.power_kw)},
            "backbone": {
                "p80_mm": _r2(r.p80),
                "throughput_tph": _r2(r.throughput_tph),
                "bond_power_kw": _r2(pd),
                "calibrated_power_kw": _r2(calibrated_power(pd)),
                "f80_model_mm": _r2(r.f80),
            },
        })
    return {
        "schema": "chancadem.hp500.backbone/v1",
        "source": dict(SOURCE),
        "engine_version": version,
        "note": NOTE,
        "n": len(rows),
        "surveys": rows,
    }
