"""Contract 1 (catalog row params-record): the records `validate_rows` accepts validate against
docs/contracts/schemas/params-record.schema.json, and the records the schema admits are accepted. The source tables
are the repository's own and the provider's (the swap)."""
from __future__ import annotations

import csv
from dataclasses import asdict
from pathlib import Path
from typing import Any

import contract_schemas as cs
from pipeline.io.contract import BOUNDS, COLUMNS, MACHINES, validate_rows

REPO_CSV = cs.ROOT / "data" / "examples" / "params.csv"
FIXTURE_CSV = cs.FIXTURE_ROOT / "data" / "examples" / "params.csv"
EXAMPLE = cs.CONTRACTS / "examples" / "params-record.json"
FIELDS = tuple(BOUNDS)


def rows_of(path: Path) -> list[dict[str, Any]]:
    assert path.is_file(), f"missing source table {path}"
    with path.open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def as_text(record: dict[str, Any]) -> dict[str, str]:
    """A record as a CSV cell dictionary: every value is text."""
    return {k: repr(v) if isinstance(v, float) else str(v) for k, v in record.items()}


def good_row(**over: Any) -> dict[str, str]:
    base = {"case_id": "PROBE", "machine": "cone-sec", "css_mm": "32", "throw_mm": "30", "speed_rpm": "360",
            "feed_x63_mm": "90", "feed_m": "1.2", "ore_axb": "55", "ore_wi": "14"}
    return {**base, **{k: str(v) for k, v in over.items()}}


def accepted(row: dict[str, str]) -> bool:
    return len(validate_rows([row]).accepted) == 1


def schema_admits(row: dict[str, str]) -> bool:
    """The schema's verdict on the typed record of a text row."""
    rec: dict[str, Any] = {"case_id": row["case_id"], "machine": row["machine"], **{k: float(row[k]) for k in FIELDS}}
    return cs.errors("params-record", rec) == []


def test_accepted_records_match_the_schema() -> None:
    report = validate_rows(rows_of(REPO_CSV))
    assert len(report.accepted) == 17 and not report.rejected, "the repository's example table is the 17 circuit cases"
    for p in report.accepted:
        assert cs.errors("params-record", asdict(p)) == [], p.case_id


def test_adversarial_schema_valid_records_are_accepted() -> None:
    schema = cs.load_json(cs.SCHEMAS / "params-record.schema.json")
    assert list(schema["required"]) == list(COLUMNS)
    assert set(schema["properties"]["machine"]["enum"]) == set(MACHINES)
    # the schema's bounds are the contract's BOUNDS
    for name, (low, high, low_exclusive) in BOUNDS.items():
        prop = schema["properties"][name]
        assert prop["maximum"] == high, name
        assert (prop.get("exclusiveMinimum") == low) if low_exclusive else (prop.get("minimum") == low), name
    # the committed example, given as text as a CSV would, is accepted with equal values
    example = cs.load_json(EXAMPLE)
    assert cs.errors("params-record", example) == []
    report = validate_rows([as_text(example)])
    assert len(report.accepted) == 1 and asdict(report.accepted[0]) == example
    # each bound, one step inside and one step outside: the schema and validate_rows agree
    for name, (low, high, low_exclusive) in BOUNDS.items():
        for value, inside in ((low, not low_exclusive), (high, True), (low - 0.01 if low > 0.5 else -1.0, False), (high * 1.01, False)):
            row = good_row(**{name: repr(float(value))})
            assert accepted(row) == inside, f"{name}={value}: validate_rows"
            assert schema_admits(row) == inside, f"{name}={value}: schema"
    # an unknown machine or a malformed id is refused by both
    assert not accepted(good_row(machine="hammer")) and not accepted(good_row(case_id="s01"))
    assert cs.errors("params-record", {**asdict(validate_rows([good_row()]).accepted[0]), "machine": "hammer"})


def test_swap_fixture_and_example_sources() -> None:
    for label, path in (("repository", REPO_CSV), ("fixture", FIXTURE_CSV)):
        rows = rows_of(path)
        report = validate_rows(rows)
        for p in report.accepted:
            assert cs.errors("params-record", asdict(p)) == [], f"{label} {p.case_id}"
    fixture = validate_rows(rows_of(FIXTURE_CSV))
    assert len(fixture.accepted) == len(rows_of(FIXTURE_CSV)) and not fixture.rejected
