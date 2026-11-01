"""Contracts hp500-backbone 1.0.0 and hp500-loo 1.2.0: the documents the pipeline builds from the survey
table validate against their schemas, are computed by the canonical engine, are deterministic and equal the
provider tree (the documents of release 0.09.003 mapped to the new field names) within 1e-9 relative."""
from __future__ import annotations

import copy
import math
from typing import Any

import contract_schemas as cs
import pytest
from pipeline.hp500 import backbone, loo
from pipeline.hp500.surveys import SURVEYS_CSV, read_surveys
from pipeline.model.crusher import evaluate, operating_from_survey
from pipeline.model.crusher.capacity import bond_power, calibrated_power

VERSION = (cs.ROOT / "VERSION").read_text(encoding="utf-8").strip()
FIXTURE = cs.FIXTURE_ROOT / "data" / "derived" / "hp500"
COMMITTED = cs.ROOT / "data" / "derived" / "hp500"


@pytest.fixture(scope="module")
def bb() -> dict:
    return backbone.build(read_surveys(SURVEYS_CSV).accepted, VERSION)


@pytest.fixture(scope="module")
def lo(bb: dict) -> dict:
    return loo.build(bb, VERSION)


def assert_close(a: Any, b: Any, path: str = "", worst: list[float] | None = None) -> None:
    """Equal structure, equal text, numbers within 1e-9 relative; engine_version and the backbone note (rewritten for the Python engine) are
    the free fields."""
    if isinstance(a, dict):
        assert isinstance(b, dict) and a.keys() == b.keys(), path
        for k in a:
            if k != "engine_version" and f"{path}/{k}" != "backbone/note":
                assert_close(a[k], b[k], f"{path}/{k}", worst)
    elif isinstance(a, list):
        assert isinstance(b, list) and len(a) == len(b), path
        for i, (x, y) in enumerate(zip(a, b)):
            assert_close(x, y, f"{path}[{i}]", worst)
    elif isinstance(a, (int, float)) and not isinstance(a, bool):
        assert isinstance(b, (int, float)), path
        rel = abs(a - b) / max(abs(b), 1e-300) if a != b else 0.0
        if worst is not None:
            worst.append(rel)
        assert rel <= 1e-9 or math.isclose(a, b, abs_tol=1e-12), (path, a, b)
    else:
        assert a == b, path


def test_backbone_validates(bb: dict) -> None:
    errors = list(cs.validator("hp500-backbone").iter_errors(bb))
    assert not errors, errors
    assert bb["n"] == len(bb["surveys"]) == 10
    assert [s["n"] for s in bb["surveys"]] == list(range(1, 11))
    assert [s["id"] for s in bb["surveys"]] == [f"HP500-{i:02d}" for i in range(1, 11)]
    assert bb["engine_version"] == VERSION
    assert "TypeScript" in bb["note"] and "engine-reference.json" in bb["note"] and "Table 5" in bb["note"]


def test_backbone_is_the_engine(bb: dict) -> None:
    """Must refute a backbone that is not the engine: survey 1 recomputed with the engine."""
    r = evaluate(operating_from_survey(54, 88))
    s1 = bb["surveys"][0]["backbone"]
    assert s1["throughput_tph"] == round(r.throughput_tph, 2)
    assert s1["p80_mm"] == round(r.p80, 2)
    assert s1["f80_model_mm"] == round(r.f80, 2)
    pd = bond_power(r.throughput_tph, r.f80, r.p80, 9.0)
    assert s1["bond_power_kw"] == round(pd, 2)
    assert s1["calibrated_power_kw"] == round(calibrated_power(pd), 2) == round(r.power_kw, 2)
    assert s1["throughput_tph"] == 1208.87
    assert bb["surveys"][0]["measured"] == {"css_mm": 54, "f80_mm": 88, "feed_tph": 1639, "power_kw": 209}


def test_backbone_empty_set_raises() -> None:
    with pytest.raises(ValueError, match="no accepted survey"):
        backbone.build([], VERSION)


def test_backbone_equals_the_provider_tree(bb: dict) -> None:
    worst: list[float] = []
    assert_close(bb, cs.load_json(FIXTURE / "backbone.json"), "backbone", worst)
    assert max(worst) <= 1e-9


def test_loo_validates(lo: dict) -> None:
    errors = list(cs.validator("hp500-loo").iter_errors(lo))
    assert not errors, errors
    n = lo["n"]
    assert n == 10 and lo["engine_version"] == VERSION and lo["seed"] == 42
    for target in ("tph", "kW", "p80"):
        t = lo["loo"][target]
        assert len(t["measured"]) == n
        for tag in ("strict", "leaky"):
            for m in ("M0", "M1", "M2"):
                assert len(t[tag]["pred"][m]) == n, (target, tag, m)
    strict = lo["loo"]["tph"]["strict"]
    assert strict["M1_label_shuffle"]["mape_pct"] > strict["M0_backbone"]["mape_pct"]
    assert len(lo["power_parity"]["per_survey"]) == len(lo["tph_parity"]["per_survey"]) == n
    for target, models in (("tph", ("B_lin",)), ("kW", ("B_lin", "Morrell", "Morrell_noload"))):
        for tag in ("strict", "leaky"):
            for m in models:
                assert m in lo["loo"][target][tag] and len(lo["loo"][target][tag]["pred"][m]) == n, (target, tag, m)
    assert "B_lin" not in lo["loo"]["p80"]["strict"] and "Morrell" not in lo["loo"]["tph"]["strict"]
    fit = lo["loo"]["kW"]["strict"]["morrell_fit"]
    assert all(len(fit[k]) == n for k in fit)
    assert lo["config"]["morrell"]["k_s"] == 55 and "fitted" in lo["config"]["morrell"]


def test_adversarial_a_loo_document_that_breaks_the_new_fields_is_rejected(lo: dict) -> None:
    """hp500-loo 1.2.0: the new models are typed; a wrong shape is refused."""
    assert not cs.errors("hp500-loo", lo)
    bad = copy.deepcopy(lo)
    bad["loo"]["kW"]["strict"]["Morrell"] = {"mape_pct": "high"}
    assert cs.errors("hp500-loo", bad)
    bad = copy.deepcopy(lo)
    bad["loo"]["kW"]["strict"]["pred"]["B_lin"] = "no"
    assert cs.errors("hp500-loo", bad)
    bad = copy.deepcopy(lo)
    bad["loo"]["kW"]["strict"]["morrell_fit"].pop("no_load_kw")
    assert cs.errors("hp500-loo", bad)
    bad = copy.deepcopy(lo)
    bad["loo"]["kW"]["strict"]["Morrell_free"] = bad["loo"]["kW"]["strict"]["Morrell"]
    assert cs.errors("hp500-loo", bad)


def test_loo_carries_the_nested_out_of_sample_coverage_beside_the_in_sample_one(lo: dict) -> None:
    """hp500-loo 1.1.0: each strict uq block holds the in-sample coverage unchanged and the nested one: one verdict and one
    sigma per survey, sigma taken from the other surveys' held-out residuals only."""
    for target in ("tph", "kW", "p80"):
        t = lo["loo"][target]
        uq = t["strict"]["uq"]
        resid = [m - p for m, p in zip(t["measured"], t["strict"]["pred"]["M0"])]
        assert len(uq["nested_covered"]) == len(uq["nested_sigma"]) == lo["n"], target
        assert uq["nested_coverage"] == pytest.approx(sum(uq["nested_covered"]) / lo["n"], abs=1e-3), target
        for i in range(lo["n"]):
            others = [r for k, r in enumerate(resid) if k != i]
            mean = sum(others) / len(others)
            sigma = math.sqrt(sum((r - mean) ** 2 for r in others) / (len(others) - 1))
            assert uq["nested_sigma"][i] == pytest.approx(sigma, abs=0.01), (target, i)
        assert "in sample" in uq["nested_note"] and "out of sample" in uq["nested_note"]


def test_loo_equals_the_provider_tree(lo: dict) -> None:
    worst: list[float] = []
    assert_close(lo, cs.load_json(FIXTURE / "loo.json"), "loo", worst)
    assert max(worst) <= 1e-9


def test_committed_documents_equal_the_provider_tree() -> None:
    for name in ("backbone", "loo"):
        committed = cs.load_json(COMMITTED / f"{name}.json")
        assert not list(cs.validator(f"hp500-{name}").iter_errors(committed))
        assert_close(committed, cs.load_json(FIXTURE / f"{name}.json"), name)


def test_main_writes_only_to_the_given_root(tmp_path) -> None:
    assert loo.main(["--out", str(tmp_path), "--version", VERSION]) == 0
    assert sorted(p.name for p in tmp_path.iterdir()) == ["backbone.json", "loo.json"]
