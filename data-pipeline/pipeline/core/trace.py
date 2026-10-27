"""The TRACE = the web-replay artifact of one case (catalog row trace, docs/contracts/schemas/trace.schema.json): the feed
and product gradations on the engine's sieve grid, the classification at the class mid-sizes, the appearance t10, the
result scalars and two 31-point sweeps around the operating point (the capacity against the eccentric speed, and the
product size and capacity against the closed-side setting). Part of CONTRACT 2; a pure function of the operating point.

Every number is written to six significant digits as a float, so a re-bake on the same engine is byte-identical and the
committed trace stays small.
"""
from __future__ import annotations

import math
from dataclasses import replace

from ..model.crusher import CrusherResult, Operating, evaluate, grid_edges, grid_mid
from ..model.crusher.breakage import specific_energy, t10_calibrated, t10_of
from ..model.crusher.classification import classification_params, classify
from ..model.crusher.machines import REF_THROW_MM

TRACE_SCHEMA = "chancadem.trace/v1"
SWEEP_POINTS = 31            # points of each sweep
SWEEP_SPAN = (0.5, 1.5)      # the sweeps run from half to one and a half times the case's value (dimensionless)


def r6(x: float) -> float:
    """Six significant digits, as a float; a non-finite value stays non-finite (the caller decides)."""
    return float(f"{x:.6g}") if math.isfinite(x) else float(x)


def _series(a: float, b: float, n: int = SWEEP_POINTS) -> list[float]:
    return [r6(a + (b - a) * i / (n - 1)) for i in range(n)]


def _finite(x: float) -> float:
    """A sweep value must be a JSON number: a point the engine cannot evaluate is written as 0."""
    return r6(x) if math.isfinite(x) else 0.0


def metrics_of(r: CrusherResult) -> dict[str, float]:
    """The result scalars of a case (the manifest's metrics)."""
    return {"p80_mm": r6(r.p80), "p50_mm": r6(r.p50), "p20_mm": r6(r.p20), "f80_mm": r6(r.f80),
            "reduction_ratio": r6(r.reduction_ratio), "throughput_tph": r6(r.throughput_tph),
            "power_kw": r6(r.power_kw), "specific_energy_kwh_t": r6(r.specific_energy_kwh_t)}


def build_trace(case_id: str, op: Operating, r: CrusherResult) -> dict:
    """The trace of ``r``, the engine result at ``op``."""
    cp = classification_params(op.machine, op.css_mm, f80_mm=r.f80, calibrated=op.calibrated, throw_mm=op.throw_mm)
    ecs = specific_energy(op.speed_rpm, REF_THROW_MM[op.machine])
    t10 = t10_calibrated(op.css_mm, r.f80) if op.calibrated else t10_of(ecs, op.ore_axb)
    speeds = _series(SWEEP_SPAN[0] * op.speed_rpm, SWEEP_SPAN[1] * op.speed_rpm)
    csss = _series(max(1.0, SWEEP_SPAN[0] * op.css_mm), SWEEP_SPAN[1] * op.css_mm)
    sp = [evaluate(replace(op, speed_rpm=v)) for v in speeds]
    cs = [evaluate(replace(op, css_mm=v)) for v in csss]
    cond = r.cond_estimate
    return {
        "schema": TRACE_SCHEMA,
        "case_id": case_id,
        "sieve_mm": [r6(x) for x in grid_edges()],
        "mid_mm": [r6(x) for x in grid_mid()],
        "feed_passing": [r6(x) for x in r.feed.passing],
        "product_passing": [r6(x) for x in r.product.passing],
        "feed_mass": [r6(x) for x in r.feed.mass],
        "product_mass": [r6(max(0.0, x)) for x in r.product.mass],
        "classification": [r6(classify(d, cp)) for d in grid_mid()],
        "appearance_t10": r6(t10),
        "summary": {
            "f80_mm": r6(r.f80), "p80_mm": r6(r.p80), "p50_mm": r6(r.p50), "p20_mm": r6(r.p20),
            "reduction_ratio": r6(r.reduction_ratio),
            "pct_passing": {str(k): r6(v) for k, v in r.pct_passing.items()},
            "throughput_tph": r6(r.throughput_tph), "power_kw": r6(r.power_kw),
            "specific_energy_kwh_t": r6(r.specific_energy_kwh_t), "oss_mm": r6(r.oss_mm),
            "nip_angle_deg": r6(r.nip_angle_deg), "nip_limit_deg": r6(r.nip_limit_deg), "regime": r.regime,
            "valid": r.valid, "out_of_envelope": r.out_of_envelope, "implausible": r.implausible,
            "mass_closure": r6(abs(r.mass_closure)), "cond_estimate": r6(cond) if math.isfinite(cond) else "Infinity",
        },
        "speed_sweep": {"speed_rpm": speeds, "throughput_tph": [_finite(x.throughput_tph) for x in sp],
                        "power_kw": [_finite(x.power_kw) for x in sp]},
        "css_sweep": {"css_mm": csss, "p80_mm": [_finite(x.p80) for x in cs],
                      "throughput_tph": [_finite(x.throughput_tph) for x in cs], "power_kw": [_finite(x.power_kw) for x in cs]},
    }
