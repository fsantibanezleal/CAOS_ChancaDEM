"""The canonical Python crusher engine against the TypeScript engine.

The fixture ``tests/fixtures/engine-reference.json`` is written by ``frontend/src/engine/reference.test.ts`` from the
live TypeScript engine (schema ``chancadem.engine-reference/v1``). Every point of it, every field of the result and
every feature vector must be reproduced by ``pipeline.model.crusher`` under the Equal rule:

* numbers: ``abs(py - ts) <= 1e-9 * max(1, abs(ts))``;
* strings, booleans and lists of strings: exact;
* a non-finite TypeScript number is the string ``"Infinity"``, ``"-Infinity"`` or ``"NaN"`` and is compared as that.

The invariants of ``frontend/src/engine/physics.test.ts`` are ported one to one with the same thresholds.
"""
from __future__ import annotations

import copy
import json
import math
from pathlib import Path
from typing import Any

import pytest

from pipeline.model.crusher import (
    CrusherResult,
    Operating,
    evaluate,
    grid_edges,
    grid_mid,
    operating_from_survey,
)
from pipeline.model.crusher import encoding
from pipeline.model.crusher.breakage import breakage_matrix, phi_from_t10
from pipeline.model.crusher.capacity import throughput
from pipeline.model.crusher.classification import classification_params, classify
from pipeline.model.crusher.feed import make_feed

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "engine-reference.json"
REL_TOL = 1e-9

BASE = Operating("cone-sec", 32, 30, 360, 90, 1.1, 55, 14)


# ---- the Equal rule -----------------------------------------------------------------------------------------------


def _json_number(x: float) -> Any:
    """A float as the fixture writes it: a non-finite number becomes its string."""
    if math.isnan(x):
        return "NaN"
    if math.isinf(x):
        return "Infinity" if x > 0 else "-Infinity"
    return x


def _psd_json(p) -> dict[str, Any]:
    return {
        "edgesMm": [_json_number(v) for v in p.edges_mm],
        "midMm": [_json_number(v) for v in p.mid_mm],
        "mass": [_json_number(v) for v in p.mass],
        "passing": [_json_number(v) for v in p.passing],
    }


def result_json(r: CrusherResult) -> dict[str, Any]:
    """A Python result in the camelCase shape of the TypeScript result (without ``op``)."""
    n = _json_number
    return {
        "feed": _psd_json(r.feed),
        "product": _psd_json(r.product),
        "f80": n(r.f80), "p80": n(r.p80), "p50": n(r.p50), "p20": n(r.p20),
        "reductionRatio": n(r.reduction_ratio),
        "pctPassing": {str(k): n(v) for k, v in r.pct_passing.items()},
        "throughputTph": n(r.throughput_tph), "powerKw": n(r.power_kw),
        "specificEnergyKwhT": n(r.specific_energy_kwh_t),
        "ossMm": n(r.oss_mm), "nipAngleDeg": n(r.nip_angle_deg), "nipLimitDeg": n(r.nip_limit_deg),
        "regime": r.regime, "valid": r.valid, "flags": list(r.flags),
        "outOfEnvelope": r.out_of_envelope, "implausible": r.implausible, "envelopeCodes": list(r.envelope_codes),
        "massClosure": n(r.mass_closure), "condEstimate": n(r.cond_estimate),
    }


def operating_of(op: dict[str, Any]) -> Operating:
    return Operating(
        machine=op["machine"], css_mm=op["cssMm"], throw_mm=op["throwMm"], speed_rpm=op["speedRpm"],
        feed_x63_mm=op["feedX63Mm"], feed_m=op["feedM"], ore_axb=op["oreAxb"], ore_wi=op["oreWi"],
        calibrated=bool(op.get("calibrated", False)),
    )


def features_json(op: Operating, r: CrusherResult, scaler: dict[str, list[float]]) -> dict[str, list[Any]]:
    ae = encoding.ae_feats(r)
    return {
        "input": [_json_number(v) for v in encoding.encode_input(op, scaler["inMean"], scaler["inStd"])],
        "ae": [_json_number(v) for v in ae],
        "aeInput": [_json_number(v) for v in encoding.ae_input(ae, scaler["aeMean"], scaler["aeStd"])],
    }


def compare(expected: Any, actual: Any, path: str = "$") -> list[str]:
    """The Equal rule; one line per difference, naming the path of the field."""
    if isinstance(expected, bool) or isinstance(actual, bool):
        return [] if expected is actual else [f"{path}: {actual!r} != {expected!r}"]
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        ok = abs(actual - expected) <= REL_TOL * max(1.0, abs(expected))
        return [] if ok else [f"{path}: {actual!r} != {expected!r}"]
    if isinstance(expected, list) and isinstance(actual, list):
        if len(expected) != len(actual):
            return [f"{path}: length {len(actual)} != {len(expected)}"]
        return [d for i, (e, a) in enumerate(zip(expected, actual)) for d in compare(e, a, f"{path}[{i}]")]
    if isinstance(expected, dict) and isinstance(actual, dict):
        if sorted(expected) != sorted(actual):
            return [f"{path}: keys {sorted(actual)} != {sorted(expected)}"]
        return [d for k in sorted(expected) for d in compare(expected[k], actual[k], f"{path}.{k}")]
    return [] if expected == actual else [f"{path}: {actual!r} != {expected!r}"]


def python_point(point: dict[str, Any], scaler: dict[str, list[float]]) -> dict[str, Any]:
    op = operating_of(point["op"])
    r = evaluate(op)
    return {"result": result_json(r), "features": features_json(op, r, scaler)}


@pytest.fixture(scope="module")
def reference() -> dict[str, Any]:
    ref = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert ref["schema"] == "chancadem.engine-reference/v1"
    return ref


def test_python_engine_reproduces_the_reference(reference: dict[str, Any]) -> None:
    """Every point, every result field, every feature vector. The message names the point id and the field."""
    assert len(reference["points"]) >= 60
    failures: list[str] = []
    worst = 0.0
    for point in reference["points"]:
        got = python_point(point, reference["scaler"])
        want = {"result": point["result"], "features": point["features"]}
        for diff in compare(want, got):
            failures.append(f"point {point['id']}: {diff}")
        worst = max(worst, _worst_rel(want, got))
    assert not failures, f"{len(failures)} differences; first: {failures[:8]}"
    assert worst <= REL_TOL


def _worst_rel(expected: Any, actual: Any) -> float:
    """The largest relative difference over the numeric fields (the figure the report quotes)."""
    if isinstance(expected, bool) or isinstance(actual, bool):
        return 0.0
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        return abs(actual - expected) / max(1.0, abs(expected))
    if isinstance(expected, list):
        return max((_worst_rel(e, a) for e, a in zip(expected, actual)), default=0.0)
    if isinstance(expected, dict):
        return max((_worst_rel(expected[k], actual[k]) for k in expected), default=0.0)
    return 0.0


def test_the_fixture_ids_are_unique_and_the_ops_round_trip(reference: dict[str, Any]) -> None:
    ids = [p["id"] for p in reference["points"]]
    assert len(ids) == len(set(ids))
    for p in reference["points"]:
        op = operating_of(p["op"])
        assert op.machine == p["op"]["machine"]


def test_adversarial_reference_comparison_detects_a_perturbation(reference: dict[str, Any]) -> None:
    """The comparison is not vacuous: p80 off by 1e-6 relative, or a flag string removed, is caught."""
    idx = next(i for i, p in enumerate(reference["points"]) if p["id"] == "case:S01")
    point = reference["points"][idx]
    got = python_point(point, reference["scaler"])
    want = {"result": point["result"], "features": point["features"]}
    assert compare(want, got) == []

    shifted = copy.deepcopy(want)
    shifted["result"]["p80"] *= 1 + 1e-6
    found = compare(shifted, got)
    assert len(found) == 1 and "result.p80" in found[0]

    flagged = next(p for p in reference["points"] if p["result"]["flags"])
    want_f = {"result": flagged["result"], "features": flagged["features"]}
    got_f = python_point(flagged, reference["scaler"])
    assert compare(want_f, got_f) == []
    got_f["result"]["flags"] = got_f["result"]["flags"][:-1]
    assert compare(want_f, got_f), "a removed flag string must be reported"

    got_f2 = python_point(flagged, reference["scaler"])
    got_f2["result"]["regime"] = "choke" if got_f2["result"]["regime"] != "choke" else "invalid"
    assert compare(want_f, got_f2), "a changed regime string must be reported"


def test_operating_from_survey_matches_the_store(reference: dict[str, Any]) -> None:
    """Survey 1 (f80 88 mm, CSS 54 mm) is the fixture's HP500 point."""
    point = next(p for p in reference["points"] if p["id"] == "hp500:01")
    assert operating_from_survey(54, 88) == operating_of(point["op"])
    assert operating_from_survey(54, 88).calibrated is True
    assert operating_from_survey(54, 88).machine == "cone-sec"


def test_every_survey_matches_its_fixture_point(reference: dict[str, Any]) -> None:
    surveys = [(1, 88, 54), (2, 84, 54), (3, 47, 48), (4, 88, 48), (5, 62, 48), (6, 79, 40), (7, 140, 38), (8, 123, 44),
               (9, 81, 40), (10, 81, 55)]
    by_id = {p["id"]: p for p in reference["points"]}
    for n, f80, css in surveys:
        assert operating_from_survey(css, f80) == operating_of(by_id[f"hp500:{n:02d}"]["op"]), n


# ---- the physics invariants of frontend/src/engine/physics.test.ts, one to one ------------------------------------


def test_feed_psd_normalizes_and_f80_is_sensible() -> None:
    feed = make_feed(grid_edges(), 90, 1.1)
    assert abs(sum(feed.mass) - 1) < 1e-9
    assert feed.passing[0] >= 0.99


def test_classification_is_monotone_non_decreasing_c_small_zero_c_large_one() -> None:
    cp = classification_params("cone-sec", 32)
    for d in grid_mid():
        assert 0 <= classify(d, cp) <= 1
    assert classify(cp.k1 * 0.5, cp) == 0
    assert classify(cp.k2 * 2, cp) == 1
    prev = -1.0
    for d in sorted(grid_mid()):
        c = classify(d, cp)
        assert c >= prev - 1e-12
        prev = c


def test_breakage_matrix_is_strictly_lower_triangular_and_columns_conserve_mass() -> None:
    edges, mid = grid_edges(), grid_mid()
    n = len(mid)
    b = breakage_matrix(edges, mid, phi_from_t10(0.35))
    for j in range(n):
        col = 0.0
        for i in range(n):
            if i <= j:
                assert b[i * n + j] == 0, f"strictly lower: B[{i}][{j}]"
            col += b[i * n + j]
        if j < n - 1:
            assert abs(col - 1) < 1e-9, f"column {j} sums to 1 (got {col})"


def test_whiten_solve_conserves_mass_and_product_normalizes() -> None:
    r = evaluate(BASE)
    assert r.mass_closure < 1e-6
    assert abs(sum(r.product.mass) - 1) < 1e-9
    assert math.isfinite(r.cond_estimate)


def test_product_is_finer_than_feed() -> None:
    r = evaluate(BASE)
    assert r.p80 < r.f80
    assert r.reduction_ratio > 1


def test_tighter_css_gives_a_finer_product() -> None:
    p80s = [evaluate(_with(BASE, css_mm=css)).p80 for css in (16, 24, 32, 50, 80)]
    for i in range(1, len(p80s)):
        assert p80s[i] >= p80s[i - 1] - 1e-9, p80s


def test_more_throw_widens_oss_and_gives_a_coarser_product_with_higher_capacity() -> None:
    lo = evaluate(_with(BASE, throw_mm=16))
    hi = evaluate(_with(BASE, throw_mm=44))
    assert hi.p80 >= lo.p80 - 1e-9
    assert hi.reduction_ratio <= lo.reduction_ratio + 1e-9
    assert hi.throughput_tph >= lo.throughput_tph - 1e-9
    assert abs(hi.oss_mm - (BASE.css_mm + 44)) < 1e-9


def test_throw_is_neutral_at_the_machine_design_throw() -> None:
    cp_design = classification_params("cone-sec", 32, throw_mm=30)
    cp_none = classification_params("cone-sec", 32)
    assert abs(cp_design.k2 - cp_none.k2) < 1e-9


def test_capacity_is_unimodal_in_speed() -> None:
    q = [throughput("cone-sec", 32, 30, s) for s in (180, 270, 360, 450, 540)]
    peak = q.index(max(q))
    assert 0 < peak < len(q) - 1, q
    for i in range(1, peak + 1):
        assert q[i] >= q[i - 1]
    for i in range(peak + 1, len(q)):
        assert q[i] <= q[i - 1]


def test_pass_through_and_invalid_guard_fires_when_css_ge_feed_top_size() -> None:
    r = evaluate(_with(BASE, css_mm=300))
    assert r.valid is False
    assert len(r.flags) > 0
    assert r.regime == "invalid"


def test_throughput_and_power_are_positive_and_finite_for_a_valid_point() -> None:
    r = evaluate(BASE)
    assert r.throughput_tph > 0 and math.isfinite(r.throughput_tph)
    assert r.power_kw > 0 and math.isfinite(r.power_kw)


def test_envelope_gate_a_valid_in_support_point_is_inside_the_envelope() -> None:
    r = evaluate(BASE)
    assert r.out_of_envelope is False
    assert r.implausible is False
    assert len(r.envelope_codes) == 0


def test_envelope_gate_an_implausible_point_is_flagged_and_marked_invalid() -> None:
    r = evaluate(_with(BASE, css_mm=120, feed_x63_mm=40))
    assert r.implausible is True
    assert r.out_of_envelope is True
    assert r.valid is False
    assert "f80_lt_css" in r.envelope_codes


def test_envelope_gate_calibrated_lane_flags_out_of_support_as_extrapolating() -> None:
    r = evaluate(_with(BASE, css_mm=60, feed_x63_mm=120, calibrated=True))
    assert r.out_of_envelope is True
    assert "css_outside_calibrated" in r.envelope_codes
    assert r.implausible is False


def test_envelope_gate_the_ten_real_hp500_surveys_are_physically_plausible() -> None:
    surveys = [(54, 88), (54, 84), (48, 47), (48, 88), (48, 62), (40, 79), (38, 140), (44, 123), (40, 81), (55, 81)]
    for css, f80 in surveys:
        r = evaluate(_with(BASE, css_mm=css, feed_x63_mm=f80 * 1.4, calibrated=True))
        assert r.implausible is False, (css, f80)


def test_envelope_gate_tests_the_declared_untruncated_f80_not_the_grid_truncated_one() -> None:
    """N1: a calibrated point whose declared feed F80 is 180 mm is outside the HP500 support of 47 to 140 mm, although the
    256 mm grid truncates the engine's own F80 to about 136 mm (review 05-01 cell 25)."""
    from pipeline.model.crusher.feed import rosin_rammler_size_at

    op = operating_from_survey(48, 180)
    assert rosin_rammler_size_at(0.8, op.feed_x63_mm, op.feed_m) == pytest.approx(180.0, abs=1e-6)
    r = evaluate(op)
    assert r.f80 < 140.0, "the truncated grid F80 stays inside the support (the model's own value is kept)"
    assert "f80_outside_calibrated" in r.envelope_codes
    assert r.out_of_envelope is True and r.implausible is False


def test_envelope_gate_the_ten_surveys_keep_their_codes_with_the_declared_f80() -> None:
    """The declared F80 of a survey is its measured f80 (up to float noise): survey 7 sits exactly on the 140 mm edge of the
    support and must stay inside it; survey 3 (f80 47 against CSS 48) stays implausible."""
    surveys = [(54, 88), (54, 84), (48, 47), (48, 88), (48, 62), (40, 79), (38, 140), (44, 123), (40, 81), (55, 81)]
    for css, f80 in surveys:
        codes = evaluate(operating_from_survey(css, f80)).envelope_codes
        assert "f80_outside_calibrated" not in codes, (css, f80)
        assert ("f80_lt_css" in codes) == (css >= f80), (css, f80)


def test_check_envelope_takes_the_declared_f80_as_a_third_argument_defaulting_to_the_engine_one() -> None:
    from pipeline.model.crusher.envelope import check_envelope

    op = operating_from_survey(48, 88)
    assert check_envelope(op, 100.0).codes == ()
    assert check_envelope(op, 100.0, 180.0).codes == ("f80_outside_calibrated",)
    assert check_envelope(op, 100.0, 100.0).codes == ()


def test_rosin_rammler_size_at_inverts_the_passing_law() -> None:
    from pipeline.model.crusher.feed import rosin_rammler_passing, rosin_rammler_size_at

    for frac in (0.2, 0.5, 0.8):
        x = rosin_rammler_size_at(frac, 90.0, 1.2)
        assert rosin_rammler_passing(x, 90.0, 1.2) == pytest.approx(frac)


# ---- the port never raises where the TypeScript engine returns a flagged result -----------------------------------


@pytest.mark.parametrize(
    "changes",
    [
        {"feed_x63_mm": 0}, {"feed_x63_mm": -5}, {"css_mm": 0}, {"css_mm": -5}, {"feed_m": -1}, {"feed_m": 0},
        {"speed_rpm": -300000}, {"ore_axb": -1e5}, {"ore_wi": -5}, {"throw_mm": -200},
    ],
)
def test_out_of_domain_points_return_a_result_and_never_raise(changes: dict[str, float]) -> None:
    r = evaluate(_with(BASE, **changes))
    assert isinstance(r, CrusherResult)


def test_the_result_is_frozen_and_the_grid_matches() -> None:
    r = evaluate(BASE)
    with pytest.raises(Exception):
        r.p80 = 1.0  # type: ignore[misc]
    assert len(grid_edges()) == 29 and len(grid_mid()) == 28
    assert grid_edges()[0] == 256
    assert set(r.pct_passing) == {1, 4, 8, 16, 32}


def _with(op: Operating, **changes: Any) -> Operating:
    from dataclasses import replace

    return replace(op, **changes)
