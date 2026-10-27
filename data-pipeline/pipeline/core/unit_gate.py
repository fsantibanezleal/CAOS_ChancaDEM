"""CONTRACT 3, the units gate (CAOS_MANAGE conventions/units-gate.md): every prediction of a case lives in the units of
its observable.

Per case and observable, a prediction must be finite and lie inside the observable's range widened by one full range on
each side. For a real case the range of the three measured observables is the measured values across the ten HP500
surveys; for every other observable of a real case, and for every observable of a synthetic case, it is the physical
domain the engine declares in ``PHYSICAL_DOMAIN`` below (each entry states its unit and why).

The gate is about units, not accuracy. It must never become an accuracy gate: an honest but poor prediction inside the
widened range passes, and that is intended. Known limit, stated so nobody mistakes the gate for more: when two
observables overlap numerically (kW and t/h on an HP500 range) a swap between them is not caught here; the expected
ranges of every case (core/expect.py) and the cross-case test are what refuse it.

Run inside the bake (pipeline.precompute) and again over the shipped artifacts by scripts/check_artifacts.py. Standard
library only, so the artifact check runs in CI without installing anything.
"""
from __future__ import annotations

import math
from typing import Any

from ..model.crusher.capacity import CAP
from ..model.crusher.engine import TOP_MM, grid_edges

RANGE_SLACK = 1.0   # one full observed range of slack on each side (a multiple of the range, dimensionless)

# observable -> (low, high, unit, why). The physical domain the engine declares for it.
PHYSICAL_DOMAIN: dict[str, tuple[float, float, str, str]] = {
    "p80_mm": (0.0, float(TOP_MM), "mm", "a product size cannot exceed the 256 mm top size of the engine's sieve grid"),
    "p50_mm": (0.0, float(TOP_MM), "mm", "as p80_mm"),
    "p20_mm": (0.0, float(TOP_MM), "mm", "as p80_mm"),
    "f80_mm": (0.0, float(TOP_MM), "mm", "the feed 80 percent passing size is read on the same grid"),
    "reduction_ratio": (1.0, grid_edges()[0] / grid_edges()[-1], "dimensionless",
                        "F80 over P80: at least about one, at most the ratio of the grid's top edge to its finest edge"),
    "throughput_tph": (0.0, 10.0 * max(m.q_ref for m in CAP.values()), "t/h",
                       "ten times the largest reference capacity of the engine's machines (gyratory 4500 t/h), the open-gap factor reaches about eight"),
    "power_kw": (0.0, 3000.0, "kW", "the largest crusher drives are of the order of 1 to 2 MW"),
    "specific_energy_kwh_t": (0.0, 20.0, "kWh/t", "the energy applied per tonne by a crusher is below a few kWh/t; 20 is a unit-error ceiling"),
}
# the observables a survey measures: observable -> survey column
MEASURED = {"throughput_tph": "feed_tph", "power_kw": "power_kw", "f80_mm": "f80_mm"}


class UnitGateError(ValueError):
    """A prediction is not in the units of its observable (a blocking violation)."""


def throughput_domain(machine: str) -> tuple[float, float]:
    """The physical throughput domain of a machine [t/h]: zero up to ten times its reference capacity."""
    return 0.0, 10.0 * CAP[machine].q_ref


def ranges_for(machine: str, measured: list[dict[str, Any]] | None) -> dict[str, tuple[float, float]]:
    """The observable ranges of a case: the physical domain of every observable (throughput by machine), replaced by the
    measured range across ``measured`` surveys where the observable is measured (a real case, ``measured`` not None)."""
    out = {name: (lo, hi) for name, (lo, hi, _unit, _why) in PHYSICAL_DOMAIN.items()}
    out["throughput_tph"] = throughput_domain(machine)
    if measured:
        for name, column in MEASURED.items():
            values = [float(row[column]) for row in measured]
            out[name] = (min(values), max(values))
    return out


def check_units(case_id: str, predictions: dict[str, float], ranges: dict[str, tuple[float, float]]) -> list[dict]:
    """The violations (empty means pass). Each is {case_id, observable, violation, blocking, detail}."""
    problems: list[dict] = []
    for name in sorted(predictions):
        value = predictions[name]
        if name not in ranges:
            problems.append({"case_id": case_id, "observable": name, "violation": "no_declared_range", "blocking": True,
                             "detail": f"{name} has no declared range; declare its unit and domain in PHYSICAL_DOMAIN"})
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            problems.append({"case_id": case_id, "observable": name, "violation": "non_finite_prediction", "blocking": True,
                             "detail": f"{name}={value!r} is not a finite number"})
            continue
        lo, hi = ranges[name]
        span = hi - lo
        wide_lo, wide_hi = lo - RANGE_SLACK * span, hi + RANGE_SLACK * span
        if not wide_lo <= value <= wide_hi:
            problems.append({"case_id": case_id, "observable": name, "violation": "prediction_outside_observable", "blocking": True,
                             "detail": (f"{name}={value:.6g} lies outside {wide_lo:.6g} to {wide_hi:.6g}, the observable's range "
                                        f"{lo:.6g} to {hi:.6g} widened by a full range: it is a different quantity or unit")})
    return problems


def blocking(problems: list[dict]) -> list[dict]:
    return [p for p in problems if p.get("blocking", True)]


def enforce(case_id: str, predictions: dict[str, float], ranges: dict[str, tuple[float, float]]) -> None:
    """Raise ``UnitGateError`` naming every blocking violation."""
    bad = blocking(check_units(case_id, predictions, ranges))
    if bad:
        raise UnitGateError(f"{case_id}: " + "; ".join(p["detail"] for p in bad))
