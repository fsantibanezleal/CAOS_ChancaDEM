"""The numeric expectations of a case, checked at bake time.

An expectation written only as prose can be wrong for months without anyone noticing. Every case therefore states its
expected range for named result metrics; the bake fails on a value outside its range, and the manifest carries the ranges
so the web can judge a live run against them too. The ranges are authored from engineering relations and measurements
(cases/circuit_cases.py, cases/hp500_cases.py), never taken from the engine's own value.
"""
from __future__ import annotations

METRICS = ("p80_mm", "p50_mm", "p20_mm", "f80_mm", "reduction_ratio", "throughput_tph", "power_kw", "specific_energy_kwh_t")


class ExpectationError(ValueError):
    """A baked result fell outside the range its case declares."""


def check(case_id: str, expect: dict[str, tuple[float, float]], metrics: dict[str, float]) -> dict[str, list[float]]:
    """Return the ranges as written to the manifest; raise ExpectationError naming every metric out of range."""
    if not expect:
        raise ExpectationError(f"{case_id}: no expected range declared (every case states what a reader should see)")
    ranges: dict[str, list[float]] = {}
    bad: list[str] = []
    for name in sorted(expect):
        if name not in METRICS:
            raise ExpectationError(f"{case_id}: unknown expected metric {name!r} (known: {', '.join(METRICS)})")
        lo, hi = expect[name]
        if lo > hi:
            raise ExpectationError(f"{case_id}: empty range for {name}: [{lo}, {hi}]")
        ranges[name] = [float(lo), float(hi)]
        v = metrics[name]
        if not lo <= v <= hi:
            bad.append(f"{name}={v:.6g} outside [{lo}, {hi}]")
    if bad:
        raise ExpectationError(f"{case_id}: " + "; ".join(bad))
    return ranges
