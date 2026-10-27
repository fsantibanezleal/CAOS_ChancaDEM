"""Contract 1 (catalog row hp500-survey): the survey table data/examples/hp500-surveys.csv, read by
pipeline.hp500.surveys, validates against docs/contracts/schemas/hp500-survey.schema.json; a row outside the
schema's bounds, with a missing or non-numeric cell, or with a duplicate survey number is rejected with its own
reason; the published table equals Table A1 of Rocha et al. (2024) as the shipped app transcribed it."""
from __future__ import annotations

import subprocess
from dataclasses import asdict

import contract_schemas as cs
from pipeline.hp500 import surveys
from pipeline.hp500.surveys import BOUNDS, Survey, read_surveys, validate_rows

REPO_CSV = cs.ROOT / "data" / "examples" / "hp500-surveys.csv"
FIXTURE_CSV = cs.FIXTURE_ROOT / "data" / "examples" / "hp500-surveys.csv"
SCHEMA = cs.SCHEMAS / "hp500-survey.schema.json"
TS_SOURCE = "origin/develop:frontend/src/data/real/hp500-minasrio.ts"

# Table A1 (survey, f80 mm, CSS mm, feed t/h, power kW) as RAW in hp500-minasrio.ts of release 0.09.003
TABLE_A1 = [
    (1, 88, 54, 1639, 209), (2, 84, 54, 1267, 212), (3, 47, 48, 1240, 262), (4, 88, 48, 1034, 349),
    (5, 62, 48, 1124, 325), (6, 79, 40, 813, 355), (7, 140, 38, 1050, 306), (8, 123, 44, 1138, 325),
    (9, 81, 40, 820, 350), (10, 81, 55, 1334, 187),
]
COLUMNS = ("survey", "f80_mm", "css_mm", "feed_tph", "power_kw")


def good(**over: object) -> dict[str, str]:
    base = dict(zip(COLUMNS, ("3", "47", "48", "1240", "262")))
    return {**base, **{k: str(v) for k, v in over.items()}}


def as_text(s: Survey) -> dict[str, str]:
    return {k: repr(v) if isinstance(v, float) else str(v) for k, v in asdict(s).items()}


def test_survey_table_validates() -> None:
    assert REPO_CSV.is_file(), f"missing {REPO_CSV}"
    assert REPO_CSV.read_bytes().count(b"\r") == 0, "LF line endings"
    report = read_surveys(REPO_CSV)
    assert report.rejected == []
    assert [s.survey for s in report.accepted] == list(range(1, 11)), "surveys 1 to 10 without a gap"
    v = cs.validator("hp500-survey")
    for s in report.accepted:
        errors = list(v.iter_errors(asdict(s)))
        assert not errors, errors
    assert surveys.SURVEYS_CSV == REPO_CSV
    assert surveys.SOURCE["doi"] == "10.3390/min14090919" and surveys.SOURCE["license"] == "CC BY 4.0"
    assert "10.3390/min14090919" in surveys.CITATION and "Minerals" in surveys.CITATION


def test_table_equals_the_paper_transcription() -> None:
    """Must refute a survey table that drifts from the paper: the CSV equals the RAW rows of the shipped app."""
    got = [(s.survey, s.f80_mm, s.css_mm, s.feed_tph, s.power_kw) for s in read_surveys(REPO_CSV).accepted]
    assert got == TABLE_A1
    ts = subprocess.run(["git", "-C", str(cs.ROOT), "show", TS_SOURCE], capture_output=True, text=True)
    if ts.returncode == 0:  # the shipped source is the ground truth when the ref is reachable
        raw = ts.stdout.split("const RAW", 1)[1].split("];", 1)[0]
        rows = [tuple(int(x) for x in line.strip().strip("[],").split(",")) for line in raw.splitlines()
                if line.strip().startswith("[") and len(line.strip()) > 2 and line.strip()[1].isdigit()]
        assert rows == TABLE_A1


def test_adversarial_survey_rows_are_rejected_with_reasons() -> None:
    cases = {
        "css_mm of abc": (good(css_mm="abc"), "css_mm"),
        "css_mm of zero": (good(css_mm="0"), "css_mm"),
        "css_mm above its bound": (good(css_mm="201"), "css_mm"),
        "negative power": (good(power_kw="-5"), "power_kw"),
        "not a number": (good(feed_tph="nan"), "feed_tph"),
        "infinite": (good(f80_mm="inf"), "f80_mm"),
        "empty cell": (good(f80_mm=""), "f80_mm"),
        "survey 0": (good(survey="0"), "survey"),
        "survey 11": (good(survey="11"), "survey"),
        "fractional survey": (good(survey="3.5"), "survey"),
    }
    reasons = set()
    for name, (row, column) in cases.items():
        r = validate_rows([row])
        assert r.accepted == [] and len(r.rejected) == 1, name
        raw, reason = r.rejected[0]
        assert raw == row and column in reason, (name, reason)
        reasons.add(reason)
    assert len(reasons) == len(cases), "each rejection has its own reason"
    # a missing column
    missing = {k: v for k, v in good().items() if k != "css_mm"}
    r = validate_rows([missing])
    assert r.accepted == [] and "css_mm" in r.rejected[0][1] and "missing" in r.rejected[0][1]
    # a duplicate survey 3: the first is kept, the second is rejected with its reason
    r = validate_rows([good(), good(f80_mm="50"), good(survey="1"), good(survey="2")])
    assert [s.survey for s in r.accepted] == [3, 1, 2]
    assert len(r.rejected) == 1 and "duplicate survey 3" in r.rejected[0][1]
    # a gap: the survey numbers are not 1 to n, so every row is reported with the reason
    r = validate_rows([good(survey="1"), good(survey="2"), good(survey="5")])
    assert r.accepted == [] and len(r.rejected) == 3
    assert all("without a gap" in why for _, why in r.rejected)
    # a rejected row only drops its own survey (partial), the others are kept
    rows = [dict(zip(COLUMNS, map(str, t))) for t in TABLE_A1]
    rows[2]["css_mm"] = "abc"
    r = validate_rows(rows)
    assert [s.survey for s in r.accepted] == [1, 2, 4, 5, 6, 7, 8, 9, 10] and len(r.rejected) == 1
    # an empty table has nothing to accept
    assert validate_rows([]).accepted == []


def test_bounds_equal_the_schema() -> None:
    props = cs.load_json(SCHEMA)["properties"]
    for name, (low, high) in BOUNDS.items():
        assert props[name].get("exclusiveMinimum", props[name].get("minimum")) == low, name
        assert props[name]["maximum"] == high, name


def test_swap_fixture_and_published_tables() -> None:
    """The provider's two-row table and the published ten-row table read through the same code."""
    for path, n in ((FIXTURE_CSV, 2), (REPO_CSV, 10)):
        assert path.is_file(), f"missing {path}"
        assert path.read_text(encoding="utf-8").splitlines()[0] == ",".join(COLUMNS)
        report = read_surveys(path)
        assert report.rejected == [] and len(report.accepted) == n
    fixture = read_surveys(FIXTURE_CSV).accepted
    published = read_surveys(REPO_CSV).accepted
    assert fixture == published[:2]
    assert validate_rows([as_text(s) for s in published]).accepted == published, "the text round trip"
