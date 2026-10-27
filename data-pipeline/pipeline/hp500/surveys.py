"""Contract 1 (catalog row hp500-survey): the HP500 survey table and its reader.

The table ``data/examples/hp500-surveys.csv`` holds the ten industrial surveys of a Metso HP500 secondary cone crusher
at the Minas Rio operation, transcribed verbatim from Table A1 of Rocha, Campos, Silva and Tavares (2024), Minerals
14(9), 919, https://doi.org/10.3390/min14090919, licensed CC BY 4.0. Values arrive as text and are parsed, never
coerced. A row outside the bounds of ``docs/contracts/schemas/hp500-survey.schema.json``, with a missing or
non-numeric cell, or with a survey number already taken is rejected with a reason; the others are kept (a partial
table). When the accepted survey numbers are not 1 to n without a gap (n the number of rows), the table is not the
published one and every row is reported with that reason.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path

from ..io.formats import read_csv_rows

REPO_ROOT = Path(__file__).resolve().parents[3]
SURVEYS_CSV = REPO_ROOT / "data" / "examples" / "hp500-surveys.csv"

SOURCE = {
    "paper": "Rocha, Campos, Silva & Tavares 2024",
    "doi": "10.3390/min14090919",
    "license": "CC BY 4.0",
    "table": "A1 (measured) + 5 (fit)",
}
CITATION = (
    "Rocha, B.K.N.d.; Campos, T.M.; Silva, J.; Tavares, L.M. Fit-for-Purpose Model of HP500 Cone Crusher in Size "
    "Reduction of Itabirite Iron Ore. Minerals 2024, 14(9), 919. https://doi.org/10.3390/min14090919 "
    "(CC BY 4.0)."
)

COLUMNS = ("survey", "f80_mm", "css_mm", "feed_tph", "power_kw")
# (exclusive lower bound, inclusive upper bound) of each measured column; survey is an integer 1 to 10 (inclusive).
# They repeat docs/contracts/schemas/hp500-survey.schema.json, which a contract test compares.
BOUNDS = {
    "survey": (1, 10),
    "f80_mm": (0, 400),
    "css_mm": (0, 200),
    "feed_tph": (0, 5000),
    "power_kw": (0, 1000),
}


@dataclass(frozen=True)
class Survey:
    survey: int
    f80_mm: float
    css_mm: float
    feed_tph: float
    power_kw: float


@dataclass
class SurveyReport:
    accepted: list[Survey] = field(default_factory=list)
    rejected: list[tuple[dict, str]] = field(default_factory=list)   # the raw row and its reason


def _number(name: str, text: str | None) -> float:
    if text is None or not str(text).strip():
        raise ValueError(f"{name} is missing or empty")
    try:
        value = float(str(text).strip())
    except ValueError:
        raise ValueError(f"{name} {str(text)!r} is not a number") from None
    if not math.isfinite(value):
        raise ValueError(f"{name} {str(text)!r} is not a finite number")
    return value


def _parse(row: dict[str, str]) -> Survey:
    for name in COLUMNS:
        if name not in row or row[name] is None:
            raise ValueError(f"column {name} is missing")
    survey = _number("survey", row["survey"])
    low, high = BOUNDS["survey"]
    if survey != int(survey):
        raise ValueError(f"survey {row['survey']!r} is not a whole number")
    if not low <= survey <= high:
        raise ValueError(f"survey {int(survey)} is outside {low} to {high}")
    values: dict[str, float] = {}
    for name in COLUMNS[1:]:
        value = _number(name, row[name])
        low, high = BOUNDS[name]
        if not low < value <= high:
            raise ValueError(f"{name} {value:g} is outside ({low}, {high}]")
        values[name] = value
    return Survey(survey=int(survey), **values)


def validate_rows(rows: list[dict[str, str]]) -> SurveyReport:
    """Parse every row, reject the invalid ones with a reason, keep the first of a duplicated survey number."""
    report = SurveyReport()
    taken: list[tuple[dict, Survey]] = []
    seen: set[int] = set()
    for row in rows:
        try:
            s = _parse(row)
            if s.survey in seen:
                raise ValueError(f"duplicate survey {s.survey}")
        except ValueError as e:
            report.rejected.append((row, str(e)))
            continue
        seen.add(s.survey)
        taken.append((row, s))
    n = len(rows)
    if any(s.survey > n for _, s in taken):
        why = (f"the survey numbers {sorted(seen)} are not 1 to {n} without a gap")
        report.rejected.extend((row, why) for row, _ in taken)
        return report
    report.accepted = [s for _, s in taken]
    return report


def read_surveys(path: Path = SURVEYS_CSV) -> SurveyReport:
    return validate_rows(read_csv_rows(path))
