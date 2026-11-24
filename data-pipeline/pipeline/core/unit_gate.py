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


# --- the laboratory jaw crusher (catalog row dem-run, DM-009) -------------------------------------------------------------------
# The domain of the laboratory machine of Barrios et al. 2020 (Table 2, p. 3), from its nameplate and geometry and never from a
# measured result: observable kind -> (low, high, unit, why). The same widening by one full range applies (the gate is about units).
LAB_NOMINAL_KG_H = 300.0        # the nameplate's nominal throughput [kg/h] (Table 2)
LAB_MOTOR_KW = 2.2              # the nameplate's motor power [kW] (Table 2)
LAB_GAPE_MM = 90.0              # the feed opening across the jaws, the gape [mm] (Table 2)
LAB_FINEST_SIEVE_MM = 1.0       # the finest sieve of the document, the coarsest bound of a reduction ratio's denominator [mm]
LAB_DOMAIN: dict[str, tuple[float, float, str, str]] = {
    "throughput_kg_h": (0.0, 10.0 * LAB_NOMINAL_KG_H, "kg/h", "ten times the nameplate's nominal 300 kg/h: a laboratory jaw never passes more"),
    "net_power_kw": (0.0, LAB_MOTOR_KW, "kW", "the 2.2 kW motor of the nameplate bounds the net power at the shaft"),
    "size_mm": (0.0, LAB_GAPE_MM, "mm", "no particle or product size exceeds the 90 mm gape"),
    "specific_energy_kwh_t": (0.0, 20.0, "kWh/t", "the engine's unit-error ceiling for the energy a crusher applies per tonne"),
    "reduction_ratio": (1.0, LAB_GAPE_MM / LAB_FINEST_SIEVE_MM, "dimensionless", "F80 over P80: at least one, at most the gape over the finest sieve"),
}


def _lab_kind(field: str) -> str | None:
    if field.startswith("throughput_kg_h") or field.startswith("throughput_whole_run_kg_h"):
        return "throughput_kg_h"
    if field.startswith("net_power_kw") or field.startswith("net_power_whole_run_kw"):
        return "net_power_kw"
    if field.startswith("specific_energy_kwh_t"):
        return "specific_energy_kwh_t"
    if field.startswith("reduction_ratio"):
        return "reduction_ratio"
    if field.endswith("_mm"):
        return "size_mm"
    return None


def lab_observables(doc: dict) -> dict[str, tuple[str, Any]]:
    """Every simulated and predicted value of a dem-run document that has a unit of the laboratory domain: label -> (kind, value).
    A value that is absent (None) is not a unit error and is left out."""
    out: dict[str, tuple[str, Any]] = {}

    def take(label: str, field: str, value: Any) -> None:
        kind = _lab_kind(field)
        if kind is not None and value is not None:
            out[label] = (kind, value)

    for p in doc.get("points", []):
        pid = p.get("id", "?")
        sim = p.get("simulation", {})
        for field in ("throughput_kg_h", "throughput_whole_run_kg_h", "net_power_kw", "net_power_whole_run_kw", "specific_energy_kwh_t",
                      "p80_mm", "p50_mm", "largest_product_mm", "reduction_ratio"):
            take(f"{pid}.simulation.{field}", field, sim.get(field))
        pb = p.get("population_balance", {})
        for field in ("throughput_kg_h", "f80_mm", "p80_mm", "p50_mm", "reduction_ratio", "specific_energy_kwh_t"):
            take(f"{pid}.population_balance.{field}", field, pb.get(field))
        for field, pair in (pb.get("band") or {}).items():
            if isinstance(pair, list) and field in ("p80_mm", "p50_mm", "reduction_ratio"):
                for i, v in enumerate(pair):
                    take(f"{pid}.population_balance.band.{field}[{i}]", field, v)
    return out


def check_lab_units(doc: dict) -> list[dict]:
    """The units-gate violations of a dem-run document (empty means pass), by the same rule as ``check_units``."""
    observed = lab_observables(doc)
    ranges = {label: LAB_DOMAIN[kind][:2] for label, (kind, _v) in observed.items()}
    return check_units("dem-run", {label: v for label, (_k, v) in observed.items()}, ranges)


def enforce_lab(doc: dict) -> None:
    """Raise ``UnitGateError`` naming every blocking violation of a dem-run document."""
    bad = blocking(check_lab_units(doc))
    if bad:
        raise UnitGateError("dem-run: " + "; ".join(p["detail"] for p in bad))
