"""CONTRACT 1 (ingestion) tests: good rows validate, bad rows are rejected with a reason and never coerced, physically
unusual rows are accepted and flagged with the engine's codes (so the controls CP1 and CI1 are baked)."""
from __future__ import annotations

import pytest
from pipeline.io.contract import BOUNDS, COLUMNS, validate_rows
from pipeline.io.schema import ParamsRecord
from pipeline.model.crusher import Operating

GOOD = {"case_id": "S01", "machine": "cone-sec", "css_mm": "32", "throw_mm": "30", "speed_rpm": "360",
        "feed_x63_mm": "90", "feed_m": "1.2", "ore_axb": "55", "ore_wi": "14"}


def row(**over: str) -> dict[str, str]:
    return {**GOOD, **over}


def test_good_row_is_accepted_and_maps_to_the_engine_operating_point() -> None:
    rep = validate_rows([row()])
    assert rep.ok and not rep.rejected and not rep.flagged
    rec = rep.accepted[0]
    assert isinstance(rec, ParamsRecord) and rec.case_id == "S01"
    assert rec.operating() == Operating("cone-sec", 32.0, 30.0, 360.0, 90.0, 1.2, 55.0, 14.0)


@pytest.mark.parametrize("name,bad", [
    ("css_mm", "nan"), ("css_mm", "0"), ("css_mm", "-5"), ("css_mm", "601"), ("css_mm", "wide"),
    ("throw_mm", "0.5"), ("throw_mm", "101"), ("speed_rpm", "49"), ("speed_rpm", "1001"),
    ("feed_x63_mm", "0"), ("feed_x63_mm", "2001"), ("feed_m", "0.2"), ("feed_m", "4.5"),
    ("ore_axb", "9"), ("ore_axb", "1001"), ("ore_wi", "1"), ("ore_wi", "41"), ("ore_wi", "inf"),
    ("machine", "hammer"), ("machine", ""), ("case_id", "s01"), ("case_id", "A"), ("case_id", ""),
])
def test_adversarial_bad_rows_rejected_not_coerced(name: str, bad: str) -> None:
    rep = validate_rows([row(**{name: bad})])
    assert not rep.accepted and len(rep.rejected) == 1
    assert rep.rejected[0]["reason"] and name in rep.rejected[0]["reason"]


def test_missing_column_and_missing_cell_are_rejected() -> None:
    without = {k: v for k, v in GOOD.items() if k != "ore_wi"}
    assert len(validate_rows([without]).rejected) == 1
    assert len(validate_rows([row(ore_wi="")]).rejected) == 1
    assert len(validate_rows([row(ore_wi=None)]).rejected) == 1  # type: ignore[arg-type]


def test_a_duplicate_case_id_is_rejected_and_the_first_is_kept() -> None:
    rep = validate_rows([row(), row(css_mm="40")])
    assert [r.css_mm for r in rep.accepted] == [32.0] and "duplicate" in rep.rejected[0]["reason"]


def test_bounds_are_inclusive_where_the_schema_says_so() -> None:
    assert COLUMNS[0] == "case_id" and set(BOUNDS) == {"css_mm", "throw_mm", "speed_rpm", "feed_x63_mm", "feed_m",
                                                      "ore_axb", "ore_wi"}
    for name, (lo, hi, lo_exclusive) in BOUNDS.items():
        assert validate_rows([row(**{name: repr(hi)})]).ok, name
        assert validate_rows([row(**{name: repr(lo)})]).ok is (not lo_exclusive), name


def test_controls_are_accepted_and_flagged_with_the_engine_codes() -> None:
    cp1 = validate_rows([row(case_id="CP1", css_mm="160")])
    assert cp1.ok and cp1.flagged == [{"case_id": "CP1", "flag": "pass_through"}]
    ci1 = validate_rows([row(case_id="CI1", css_mm="280")])
    assert ci1.ok and [f["flag"] for f in ci1.flagged] == ["pass_through", "css_ge_feed_top"]
    assert not validate_rows([row()]).flagged
