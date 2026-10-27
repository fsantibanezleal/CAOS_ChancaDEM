"""The 27 cases: authored fields, numeric expectations that can fail, and the cross-case reference trends read from
the baked manifests and traces."""
from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest
from pipeline import pipeline, registry
from pipeline.cases.hp500_cases import CATEGORY as REAL_CATEGORY
from pipeline.core import expect as expectations
from pipeline.hp500.surveys import read_surveys
from pipeline.io.contract import read_params
from pipeline.model.crusher import Operating

CASES = registry.list_cases(read_surveys().accepted)
SYNTHETIC = [c for c in CASES if c.real_or_synthetic == "synthetic"]
REAL = [c for c in CASES if c.real_or_synthetic == "real"]


def test_the_matrix_is_27_cases_17_synthetic_and_10_real_with_unique_ids() -> None:
    assert (len(CASES), len(SYNTHETIC), len(REAL)) == (27, 17, 10)
    assert len({c.id for c in CASES}) == 27 and registry.default_case() == "S01"
    assert [c.id for c in REAL] == [f"HP500-{i:02d}" for i in range(1, 11)]
    assert {c.category["en"] for c in SYNTHETIC} == {"Primary crushing", "Secondary cone", "Tertiary crushing", "Controls"}
    assert {c.category["en"] for c in REAL} == {REAL_CATEGORY["en"]} == {"Real surveys: Metso HP500 at Minas Rio"}
    assert REAL_CATEGORY["es"] == "Muestreos reales: Metso HP500 en Minas Rio"


@pytest.mark.parametrize("case", CASES, ids=lambda c: c.id)
def test_every_case_is_authored_completely(case) -> None:
    for text in (case.title, case.expected_band, *case.context.values()):
        assert set(text) == {"en", "es"} and text["en"].strip() and text["es"].strip()
        joined = text["en"] + text["es"]
        assert "·" not in joined and "—" not in joined and "→" not in joined
    assert set(case.context) == {"problem", "variables", "reading"}
    for part in case.context.values():
        for lang in ("en", "es"):
            assert part[lang].count(". ") >= 1 and part[lang].rstrip().endswith("."), (case.id, lang)  # two sentences
    assert len(case.expect) >= 2 and set(case.expect) <= set(expectations.METRICS)
    assert all(lo < hi for lo, hi in case.expect.values())
    assert case.expected_band["en"] != case.expected_band["es"]
    assert case.stage in ("primary", "secondary", "tertiary", "control")


def shown(v: float, lang: str) -> str:
    text = str(int(v)) if float(v).is_integer() else repr(round(v, 2))
    return text if lang == "en" else text.replace(".", ",")


@pytest.mark.parametrize("case", CASES, ids=lambda c: c.id)
def test_the_band_states_its_numbers(case) -> None:
    """The prose says the same as the ranges: every range bound appears in the band text, in both languages."""
    for name, (lo, hi) in case.expect.items():
        for lang in ("en", "es"):
            for v in (lo, hi):
                assert shown(v, lang) in case.expected_band[lang], (case.id, name, v, lang)


@pytest.mark.parametrize("case", REAL, ids=lambda c: c.id)
def test_real_cases_carry_the_survey_and_the_publication(case) -> None:
    assert case.measured is not None and case.source["kind"] == "publication" and case.source["license"] == "CC BY 4.0"
    assert "muestreo" in (case.title["es"] + case.expected_band["es"] + case.context["problem"]["es"]).lower()
    lo, hi = case.expect["throughput_tph"]
    assert lo == pytest.approx(case.measured["feed_tph"] * 0.71, abs=1) and hi == pytest.approx(case.measured["feed_tph"] * 1.29, abs=1)


def test_the_registry_points_are_the_params_table() -> None:
    table = read_params()
    assert not table.rejected
    assert {r.case_id: r.operating() for r in table.accepted} == {c.id: c.op for c in SYNTHETIC}


@pytest.fixture(scope="module")
def bake(tmp_path_factory: pytest.TempPathFactory) -> Path:
    root = tmp_path_factory.mktemp("cases-bake")
    pipeline.run_all(output_root=root)
    return root


def manifest(root: Path, case_id: str) -> dict:
    return json.loads((root / "manifests" / f"{case_id}.json").read_text(encoding="utf-8"))


def trace(root: Path, case_id: str) -> dict:
    return json.loads((root / case_id / "trace.json").read_text(encoding="utf-8"))


def test_every_case_meets_its_expected_ranges_in_the_bake(bake: Path) -> None:
    for c in CASES:
        m = manifest(bake, c.id)
        for name, (lo, hi) in c.expect.items():
            assert lo <= m["metrics"][name] <= hi, (c.id, name)
            assert m["expect"][name] == [lo, hi]


def test_cross_case_reference_trends(bake: Path) -> None:
    by_id = {c.id: c for c in CASES}
    p80 = lambda i: manifest(bake, i)["metrics"]["p80_mm"]  # noqa: E731
    # a tighter setting gives a finer product on the same machine, and the bands say so
    assert p80("S06") < p80("S05") < p80("S01") < p80("S04")
    assert p80("H01") < p80("T01") < p80("T02")
    assert by_id["S06"].expect["p80_mm"][1] < by_id["S01"].expect["p80_mm"][0]
    assert by_id["S05"].expect["p80_mm"][1] < by_id["S01"].expect["p80_mm"][0]
    assert by_id["S01"].expect["p80_mm"][1] < by_id["S04"].expect["p80_mm"][0]
    # the over-speed case sits past the capacity optimum of its own speed sweep; the reference case sits on it
    for cid, past in (("S03", True), ("S01", False)):
        sweep = trace(bake, cid)["speed_sweep"]
        best = sweep["speed_rpm"][max(range(len(sweep["throughput_tph"])), key=sweep["throughput_tph"].__getitem__)]
        speed = by_id[cid].op.speed_rpm
        assert (speed > best * 1.05) if past else (abs(speed - best) <= 0.05 * speed), (cid, speed, best)
    # the controls
    assert manifest(bake, "CP1")["metrics"]["reduction_ratio"] < 1.3
    assert 0.9 <= manifest(bake, "CI1")["metrics"]["reduction_ratio"] <= 1.1
    assert "css_ge_feed_top" in manifest(bake, "CI1")["flags"] and trace(bake, "CI1")["summary"]["valid"] is False
    assert "pass_through" in manifest(bake, "CP1")["flags"]


def test_a_planted_change_of_the_css_term_fails_the_bake(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """The ranges can fail: an engine whose product ignores the setting is refused by at least one case."""
    from pipeline.stages import infer

    real = infer.run

    def blind(op: Operating):
        return real(replace(op, css_mm=32.0 if op.machine == "cone-sec" and not op.calibrated else op.css_mm))

    monkeypatch.setattr(infer, "run", blind)
    with pytest.raises(expectations.ExpectationError):
        pipeline.run_all(output_root=tmp_path / "blind")
