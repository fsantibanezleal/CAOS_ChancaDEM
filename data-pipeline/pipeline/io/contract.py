"""CONTRACT 1, ingestion (raw -> pipeline). The *bring-your-own-data* gate of the crusher operating point
(catalog row params-record, docs/contracts/schemas/params-record.schema.json).

The table ``data/examples/params.csv`` holds one operating point per row. Values arrive as text and are parsed, never
coerced. A row outside the bounds of the schema, with a missing or non-numeric cell, an unknown machine, a malformed or a
duplicate case id is REJECTED with a reason. A physically meaningful but unusual row is ACCEPTED and FLAGGED with the
engine's own codes: ``pass_through`` when the closed-side setting is at or above the feed's 80 percent passing size, and
``css_ge_feed_top`` when it is at or above the 256 mm feed top size of the engine's sieve grid; the bounds are wide on
purpose so the negative control (CP1) and the invalid control (CI1) are baked, never dropped. Documented in data/README.md.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..model.crusher import grid_edges
from ..model.crusher.feed import make_feed
from ..model.crusher.sieve import size_at_passing
from .formats import read_csv_rows
from .schema import ParamsRecord

REPO_ROOT = Path(__file__).resolve().parents[3]
PARAMS_CSV = REPO_ROOT / "data" / "examples" / "params.csv"

COLUMNS: tuple[str, ...] = ("case_id", "machine", "css_mm", "throw_mm", "speed_rpm", "feed_x63_mm", "feed_m", "ore_axb", "ore_wi")
MACHINES: tuple[str, ...] = ("cone-sec", "cone-tert", "cone-short-head", "gyratory", "jaw")
CASE_ID = re.compile(r"^[A-Z][A-Z0-9-]{1,15}$")

# name -> (low, high, low_is_exclusive). The schema's bounds, which a contract test compares; units in the schema.
BOUNDS: dict[str, tuple[float, float, bool]] = {
    "css_mm": (0.0, 600.0, True),          # mm
    "throw_mm": (1.0, 100.0, False),       # mm
    "speed_rpm": (50.0, 1000.0, False),    # rev/min
    "feed_x63_mm": (0.0, 2000.0, True),    # mm
    "feed_m": (0.3, 4.0, False),           # dimensionless
    "ore_axb": (10.0, 1000.0, False),      # dimensionless
    "ore_wi": (2.0, 40.0, False),          # kWh/t
}
TOP_SIZE_MM = grid_edges()[0]   # the engine's feed top size [mm]


@dataclass
class ContractReport:
    accepted: list[ParamsRecord] = field(default_factory=list)
    rejected: list[dict[str, Any]] = field(default_factory=list)   # {row, case_id, reason}
    flagged: list[dict[str, str]] = field(default_factory=list)    # {case_id, flag}

    @property
    def ok(self) -> bool:
        return len(self.accepted) > 0

    def summary(self) -> str:
        return f"{len(self.accepted)} accepted, {len(self.rejected)} rejected, {len(self.flagged)} flagged"


def _number(name: str, text: Any) -> float:
    if text is None or not str(text).strip():
        raise ValueError(f"{name} is missing or empty")
    try:
        value = float(str(text).strip())
    except ValueError:
        raise ValueError(f"{name} {str(text)!r} is not a number") from None
    if not math.isfinite(value):
        raise ValueError(f"{name} {str(text)!r} is not a finite number")
    return value


def _parse(row: dict[str, Any]) -> ParamsRecord:
    for name in COLUMNS:
        if name not in row:
            raise ValueError(f"column {name} is missing")
    case_id = str(row["case_id"] or "").strip()
    if not CASE_ID.match(case_id):
        raise ValueError(f"case_id {case_id!r} does not match {CASE_ID.pattern}")
    machine = str(row["machine"] or "").strip()
    if machine not in MACHINES:
        raise ValueError(f"machine {machine!r} is not one of {', '.join(MACHINES)}")
    values: dict[str, float] = {}
    for name, (low, high, low_exclusive) in BOUNDS.items():
        v = _number(name, row[name])
        ok_low = v > low if low_exclusive else v >= low
        if not (ok_low and v <= high):
            raise ValueError(f"{name} {v:g} is outside {'(' if low_exclusive else '['}{low:g}, {high:g}]")
        values[name] = v
    return ParamsRecord(case_id=case_id, machine=machine, **values)


def feed_f80_mm(feed_x63_mm: float, feed_m: float) -> float:
    """The 80 percent passing size of the Rosin-Rammler feed on the engine's sieve grid, as the engine computes it [mm]."""
    return size_at_passing(make_feed(grid_edges(), feed_x63_mm, feed_m), 0.8)


def flags_of(rec: ParamsRecord) -> list[str]:
    """The flag codes of an accepted record, in the engine's order."""
    codes: list[str] = []
    if rec.css_mm >= feed_f80_mm(rec.feed_x63_mm, rec.feed_m):
        codes.append("pass_through")
    if rec.css_mm >= TOP_SIZE_MM:
        codes.append("css_ge_feed_top")
    return codes


def validate_rows(raw_rows: list[dict[str, Any]]) -> ContractReport:
    """Apply CONTRACT 1 to raw rows (for example from a CSV). Pure and deterministic; no I/O."""
    report = ContractReport()
    seen: set[str] = set()
    for i, row in enumerate(raw_rows):
        cid = str(row.get("case_id") or f"row{i}")
        try:
            rec = _parse(row)
            if rec.case_id in seen:
                raise ValueError(f"duplicate case_id {rec.case_id}")
        except ValueError as exc:
            report.rejected.append({"row": i, "case_id": cid, "reason": str(exc)})
            continue
        seen.add(rec.case_id)
        report.accepted.append(rec)
        report.flagged.extend({"case_id": rec.case_id, "flag": code} for code in flags_of(rec))
    return report


def read_params(path: Path = PARAMS_CSV) -> ContractReport:
    """Read and validate the params table at ``path``."""
    return validate_rows(read_csv_rows(path))
