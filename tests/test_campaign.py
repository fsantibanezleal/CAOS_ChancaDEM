"""The campaign view's two engine functions (BL-004, unit I3), held to the TypeScript port by a shared table.

``tests/fixtures/campaign-reference.json`` lists operating points with a P80 target and a setting ceiling, and the expected
``css_at_p80_target`` (a number, or null). ``frontend/src/engine/campaign.test.ts`` reads the same file, so the two engines
cannot disagree unnoticed. Regenerate it from this engine with ``CHANCADEM_WRITE_CAMPAIGN_REFERENCE=1 pytest tests/test_campaign.py``;
every row is then re-checked against the engine itself (P80 at the returned setting equals the target), which does not use the file.
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path

import pytest

from pipeline.model import sweep
from pipeline.model.crusher import Operating, evaluate
from pipeline.model.crusher import campaign
from pipeline.model.crusher.campaign import css_at_p80_target, hours_to_target

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "campaign-reference.json"
SCHEMA = "chancadem.campaign-reference/v1"
TOL_MM = 1e-6

BASE = Operating("cone-sec", 32, 30, 360, 90, 1.2, 55, 14)

# [id, machine, css, throw, speed, x63, m, axb, wi, calibrated, target factor on the point's own P80 or an absolute target]
POINTS = [
    ("S01", "cone-sec", 32, 30, 360, 90, 1.2, 55, 14, False),
    ("S02", "cone-sec", 40, 32, 300, 120, 1.0, 80, 11, False),
    ("S05", "cone-sec", 16, 26, 360, 55, 1.6, 55, 14, False),
    ("T01", "cone-tert", 8, 16, 400, 28, 1.5, 55, 14, False),
    ("H01", "cone-short-head", 6, 14, 500, 22, 1.6, 55, 14, False),
    ("J02", "jaw", 80, 36, 280, 300, 1.0, 55, 14, False),
    ("G01", "gyratory", 165, 30, 150, 600, 0.8, 40, 16, False),
    ("CK1", "cone-sec", 25, 30, 350, 80, 1.15, 52, 15, False),
    ("CAL", "cone-sec", 45, 34, 360, 100, 0.9, 677.3, 9.0, True),
]


def _op(row) -> Operating:
    _, machine, css, throw, speed, x63, m, axb, wi, cal = row
    return Operating(machine, css, throw, speed, x63, m, axb, wi, cal)


def _css_max(machine: str) -> float:
    return sweep.RANGES[machine]["css_mm"][1]


def _rows() -> list[dict]:
    rows = []
    for row in POINTS:
        op = _op(row)
        p80 = evaluate(op).p80
        cmax = _css_max(op.machine)
        for label, target in (("plus3", round(p80 * 1.03, 4)), ("plus10", round(p80 * 1.1, 4)), ("plus30", round(p80 * 1.3, 4)), ("exceeded", round(p80 * 0.8, 4)), ("never", 1.0e6)):
            rows.append({"id": f"{row[0]}-{label}", "op": dict(zip(("machine", "css_mm", "throw_mm", "speed_rpm", "feed_x63_mm", "feed_m", "ore_axb", "ore_wi", "calibrated"), row[1:])),
                         "p80_target_mm": target, "css_max_mm": cmax, "css_target_mm": css_at_p80_target(op, target, cmax)})
    return rows


def _op_of(d: dict) -> Operating:
    return Operating(d["machine"], d["css_mm"], d["throw_mm"], d["speed_rpm"], d["feed_x63_mm"], d["feed_m"], d["ore_axb"], d["ore_wi"], d["calibrated"])


if os.environ.get("CHANCADEM_WRITE_CAMPAIGN_REFERENCE") == "1":
    FIXTURE.write_text(json.dumps({"schema": SCHEMA, "rows": _rows()}, indent=1) + "\n", encoding="utf-8")


def _table() -> list[dict]:
    doc = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert doc["schema"] == SCHEMA
    return doc["rows"]


def test_the_shared_table_is_reproduced_to_1e6_mm():
    rows = _table()
    assert len(rows) >= 30
    for r in rows:
        got = css_at_p80_target(_op_of(r["op"]), r["p80_target_mm"], r["css_max_mm"])
        if r["css_target_mm"] is None:
            assert got is None, r["id"]
        else:
            assert got is not None and abs(got - r["css_target_mm"]) <= TOL_MM, (r["id"], got, r["css_target_mm"])


def test_the_table_has_each_kind_of_row():
    rows = _table()
    nones = [r for r in rows if r["css_target_mm"] is None]
    held = [r for r in rows if r["css_target_mm"] is not None and abs(r["css_target_mm"] - r["op"]["css_mm"]) <= TOL_MM]
    opened = [r for r in rows if r["css_target_mm"] is not None and r["css_target_mm"] > r["op"]["css_mm"] + 1e-3]
    assert nones and held and opened


def test_the_engine_p80_at_the_returned_setting_is_the_target():
    n = 0
    for r in _table():
        op = _op_of(r["op"])
        css = css_at_p80_target(op, r["p80_target_mm"], r["css_max_mm"])
        if css is None or css <= op.css_mm + TOL_MM:
            continue
        n += 1
        assert abs(evaluate(Operating(**{**op.__dict__, "css_mm": css})).p80 - r["p80_target_mm"]) <= 1e-5, r["id"]
    assert n >= 10


def test_a_target_above_the_current_p80_gives_a_setting_above_the_current_one():
    p80 = evaluate(BASE).p80
    css = css_at_p80_target(BASE, p80 * 1.1, 90.0)
    assert css is not None and css > BASE.css_mm


def test_a_target_already_exceeded_returns_the_current_setting():
    p80 = evaluate(BASE).p80
    assert css_at_p80_target(BASE, p80 * 0.9, 90.0) == BASE.css_mm
    assert hours_to_target(0.0, 0.1) == 0.0


def test_a_target_never_reached_below_the_ceiling_is_none():
    assert css_at_p80_target(BASE, 1.0e6, 90.0) is None


def test_a_ceiling_at_or_below_the_current_setting_is_none():
    assert css_at_p80_target(BASE, evaluate(BASE).p80 * 1.1, BASE.css_mm) is None
    assert css_at_p80_target(BASE, evaluate(BASE).p80 * 1.1, 10.0) is None


def test_an_invalid_point_is_none():
    bad = Operating("cone-sec", 0, 30, 360, 90, 1.2, 55, 14)
    assert css_at_p80_target(bad, 30.0, 90.0) is None
    assert css_at_p80_target(BASE, float("nan"), 90.0) is None
    assert css_at_p80_target(BASE, -5.0, 90.0) is None
    assert css_at_p80_target(BASE, 30.0, float("inf")) is None


def test_a_non_monotone_p80_gives_none_and_never_a_guess(monkeypatch):
    real = campaign.evaluate

    def wavy(op):
        r = real(op)
        bump = 4.0 * math.sin(op.css_mm * 1.3)
        return type("R", (), {"p80": r.p80 + bump, "valid": r.valid})()

    monkeypatch.setattr(campaign, "evaluate", wavy)
    assert css_at_p80_target(BASE, evaluate(BASE).p80 * 1.3, 90.0) is None


def test_the_calibrated_lane_uses_the_same_engine_call():
    op = Operating("cone-sec", 45, 34, 360, 100, 0.9, 677.3, 9.0, True)
    p80 = evaluate(op).p80
    css = css_at_p80_target(op, p80 * 1.1, 90.0)
    assert css is not None and css > 45
    assert abs(evaluate(Operating(**{**op.__dict__, "css_mm": css})).p80 - p80 * 1.1) <= 1e-5


def test_hours_to_target_is_the_opening_over_the_drift():
    assert hours_to_target(2.0, 0.04) == pytest.approx(50.0)
    assert hours_to_target(1.0, 1.0) == pytest.approx(1.0)
    assert hours_to_target(-0.5, 0.1) == 0.0


def test_hours_to_target_refuses_a_drift_that_is_not_positive():
    assert hours_to_target(2.0, 0.0) is None
    assert hours_to_target(2.0, -0.1) is None
    assert hours_to_target(2.0, float("nan")) is None
    assert hours_to_target(float("nan"), 0.1) is None


def test_no_drift_rate_has_a_default():
    import inspect

    for fn in (hours_to_target, css_at_p80_target):
        for p in inspect.signature(fn).parameters.values():
            assert p.default is inspect.Parameter.empty, (fn.__name__, p.name)


def test_the_ceiling_table_of_the_port_is_the_training_range_upper_bound():
    import re

    src = (Path(__file__).resolve().parents[1] / "frontend" / "src" / "engine" / "campaign.ts").read_text(encoding="utf-8")
    block = re.search(r"CSS_MAX_MM[^{]*\{(.*?)\};", src, re.S).group(1)
    got = {m.group(1).strip("'"): float(m.group(2)) for m in re.finditer(r"('?[\w-]+'?):\s*([\d.]+)", block)}
    assert got == {m: sweep.RANGES[m]["css_mm"][1] for m in sweep.RANGES}
