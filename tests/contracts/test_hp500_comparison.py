"""Contract hp500-comparison 1.0.0: the paired comparison of the held-out methods on the ten HP500 surveys
(data/derived/hp500/comparison.json, written by data-pipeline/pipeline/hp500/comparison.py from hp500-loo and
hp500-crusherbayes). Producer side: the committed document and the provider tree validate against the schema, equal what
the producer builds from their own inputs and obey the rules the schema cannot state; the paired interval is the
CrusherBayes manuscript's resampling, and its CrusherBayes-against-the-setting-only-line power row equals the manuscript's
printed paired difference. The consumer side is frontend/src/lib/contract.test.ts and frontend/src/views/compare.test.tsx.
Adversarial: planted documents that break the schema or the cross-field rules are rejected."""
from __future__ import annotations

import copy
import json
import re

import contract_schemas as cs
import numpy as np
import pytest
from pipeline.hp500 import comparison

VERSION = (cs.ROOT / "VERSION").read_text(encoding="utf-8").strip()
COMMITTED = cs.ROOT / "data" / "derived" / "hp500"
FIXTURE = cs.FIXTURE_ROOT / "data" / "derived" / "hp500"
NUMBERS_TEX = cs.ROOT / "manuscripts" / "crusherbayes" / "tex" / "generated" / "numbers.tex"


def _inputs(folder):
    loo = cs.load_json(folder / "loo.json")
    cb_path = folder / "crusherbayes.json"
    return loo, (cs.load_json(cb_path) if cb_path.is_file() else None)


def cross_field_errors(doc: dict) -> list[str]:
    """The rules the schema cannot state (the schema description and the catalog row)."""
    found: list[str] = []
    n = doc["n"]
    for t, block in doc["targets"].items():
        if len(block["measured"]) != n:
            found.append(f"{t}/measured: not {n} values")
        ids = [m["id"] for m in block["methods"]]
        scored = {m["id"]: m for m in block["methods"]}
        for m in block["methods"]:
            if m["ape_pct"] is not None and len(m["ape_pct"]) != n:
                found.append(f"{t}/{m['id']}: not {n} errors")
        free = sorted((m for m in block["methods"] if not m["control"]), key=lambda m: m["mape_pct"])
        if block["recommended"] not in ids or scored[block["recommended"]]["control"]:
            found.append(f"{t}: recommended is not a scored method that is not a control")
        elif free and scored[block["recommended"]]["mape_pct"] != free[0]["mape_pct"]:
            found.append(f"{t}: recommended does not have the lowest MAPE")
        if block["runner_up"] not in ids or block["runner_up"] == block["recommended"] or scored[block["runner_up"]]["control"]:
            found.append(f"{t}: runner_up is not a second method that is not a control")
        elif len(free) > 1 and scored[block["runner_up"]]["mape_pct"] != free[1]["mape_pct"]:
            found.append(f"{t}: runner_up does not have the next lowest MAPE")
        for p in block["paired"]:
            if p["against"] != block["recommended"]:
                found.append(f"{t}/{p['method']}: paired against {p['against']}, not the recommended method")
            lo, hi = p["ci95"]
            if not lo <= p["mean_diff_pts"] <= hi:
                found.append(f"{t}/{p['method']}: the mean is outside its interval")
            if p["wins"] > n:
                found.append(f"{t}/{p['method']}: more wins than surveys")
    cb_rows = [m for b in doc["targets"].values() for m in b["methods"] if m["id"] == comparison.CRUSHERBAYES]
    if doc["crusherbayes"]["included"] != bool(cb_rows):
        found.append("crusherbayes.included disagrees with the methods")
    if not doc["crusherbayes"]["included"] and doc["crusherbayes"]["note"] is None:
        found.append("crusherbayes: absent without a note that says so")
    return found


@pytest.mark.parametrize("folder", [COMMITTED, FIXTURE], ids=["committed", "fixture"])
def test_comparison_validates(folder) -> None:
    doc = cs.load_json(folder / "comparison.json")
    assert cs.errors("hp500-comparison", doc) == []
    assert cross_field_errors(doc) == []


@pytest.mark.parametrize("folder", [COMMITTED, FIXTURE], ids=["committed", "fixture"])
def test_the_document_is_the_producer_applied_to_its_inputs(folder) -> None:
    loo, cb = _inputs(folder)
    built = comparison.build(loo, cb, VERSION)
    assert built == cs.load_json(folder / "comparison.json")
    # byte-identical for the same inputs
    assert json.dumps(comparison.build(loo, cb, VERSION)) == json.dumps(built)


def test_the_resampling_is_the_manuscripts() -> None:
    loo, cb = _inputs(COMMITTED)
    doc = comparison.build(loo, cb, VERSION)
    assert doc["bootstrap"] == {"method": doc["bootstrap"]["method"], "resamples": 20000, "seed": 42, "quantiles": [2.5, 97.5]}
    # recompute one row from scratch, with numpy.random.default_rng(42).integers(0, 10, size=(20000, 10)) as make_figs.py draws it
    idx = np.random.default_rng(42).integers(0, 10, size=(20000, 10))
    kw = doc["targets"]["kW"]
    m = np.array(loo["loo"]["kW"]["measured"])
    ape = lambda p: 100.0 * np.abs(np.array(p) - m) / m  # noqa: E731
    d = ape(loo["loo"]["kW"]["strict"]["pred"]["M2"]) - ape(loo["loo"]["kW"]["strict"]["pred"]["B_lin"])
    s = d[idx].mean(axis=1)
    row = next(p for p in kw["paired"] if p["method"] == "M2_freeform")
    assert kw["recommended"] == "B_lin"
    assert row["mean_diff_pts"] == pytest.approx(d.mean(), abs=1e-6)
    assert row["ci95"] == pytest.approx([np.quantile(s, 0.025), np.quantile(s, 0.975)], abs=1e-6)
    assert row["p_better"] == pytest.approx(float(np.mean(s > 0)), abs=1e-6)
    assert row["wins"] == int(np.sum(d > 0))


def _macro(name: str) -> float:
    text = NUMBERS_TEX.read_text(encoding="utf-8")
    hit = re.search(r"\\newcommand\{\\" + name + r"\}\{([^}]*)\}", text)
    assert hit, f"{name} is not in {NUMBERS_TEX}"
    return float(hit.group(1).replace("$-$", "-").replace("{,}", ""))


def test_the_crusherbayes_power_row_equals_the_manuscripts_paired_difference() -> None:
    """make_figs.py prints dBlinKw = mean over surveys of APE(CrusherBayes) - APE(setting-only line), with its paired
    interval; here the method is CrusherBayes and the recommended method is the line, so the sign convention is the same."""
    doc = cs.load_json(COMMITTED / "comparison.json")
    kw = doc["targets"]["kW"]
    assert kw["recommended"] == "B_lin"
    row = next(p for p in kw["paired"] if p["method"] == comparison.CRUSHERBAYES)
    assert round(row["mean_diff_pts"], 2) == _macro("dBlinKw")
    assert round(row["ci95"][0], 2) == _macro("dBlinKwLo")
    assert round(row["ci95"][1], 2) == _macro("dBlinKwHi")
    # the manuscript counts the surveys where CrusherBayes is lower; here the wins are the line's
    ape = {m["id"]: np.array(m["ape_pct"]) for m in kw["methods"] if m["ape_pct"] is not None}
    ties = int(np.sum(ape[comparison.CRUSHERBAYES] == ape["B_lin"]))
    assert row["wins"] == doc["n"] - int(_macro("dBlinKwWins")) - ties


def test_without_crusherbayes_the_comparison_carries_crushercal_only_and_says_so() -> None:
    loo, _ = _inputs(COMMITTED)
    doc = comparison.build(loo, None, VERSION)
    assert cs.errors("hp500-comparison", doc) == []
    assert cross_field_errors(doc) == []
    assert doc["crusherbayes"]["included"] is False
    assert "CrusherBayes" in doc["crusherbayes"]["note"]["en"] and "CrusherBayes" in doc["crusherbayes"]["note"]["es"]
    assert doc["inputs"]["crusherbayes"] is None
    for block in doc["targets"].values():
        assert comparison.CRUSHERBAYES not in [m["id"] for m in block["methods"]]
        assert comparison.CRUSHERBAYES not in [p["method"] for p in block["paired"]]


def test_the_recommended_method_is_the_lowest_mape_that_is_not_a_control() -> None:
    loo, cb = _inputs(COMMITTED)
    doc = comparison.build(loo, cb, VERSION)
    for t, block in doc["targets"].items():
        free = sorted((m for m in block["methods"] if not m["control"]), key=lambda m: m["mape_pct"])
        assert block["recommended"] == free[0]["id"], t
        assert block["runner_up"] == free[1]["id"], t
        # the document MAPE, never a recomputation, and every per-survey mean agrees with it to the stored precision
        for m in block["methods"]:
            if m["ape_pct"] is not None:
                assert abs(float(np.mean(m["ape_pct"])) - m["mape_pct"]) < 0.02, (t, m["id"])
    assert {m["id"] for m in doc["targets"]["kW"]["methods"]} >= {"B_lin", "M2_freeform", "constant_mean", "M1_label_shuffle"}
    # the label shuffle has no predictions, so no paired row
    assert "M1_label_shuffle" not in [p["method"] for p in doc["targets"]["kW"]["paired"]]


def test_adversarial_drifted_documents_are_rejected() -> None:
    good = cs.load_json(COMMITTED / "comparison.json")
    planted = copy.deepcopy(good)
    del planted["targets"]["kW"]["runner_up"]
    assert any("runner_up" in e for e in cs.errors("hp500-comparison", planted))
    planted = copy.deepcopy(good)
    planted["targets"]["kW"]["paired"][0]["p_better"] = 1.5
    assert cs.errors("hp500-comparison", planted)
    planted = copy.deepcopy(good)
    planted["targets"]["kW"]["recommended"] = "M2_freeform"
    assert any("recommended" in e for e in cross_field_errors(planted))
    planted = copy.deepcopy(good)
    planted["targets"]["kW"]["paired"][0]["ci95"] = [50.0, 60.0]
    assert any("outside its interval" in e for e in cross_field_errors(planted))
    planted = copy.deepcopy(good)
    planted["crusherbayes"]["included"] = False
    assert any("crusherbayes.included" in e for e in cross_field_errors(planted))


def test_adversarial_a_crusherbayes_document_of_other_surveys_is_left_out_and_said_so() -> None:
    loo, cb = _inputs(COMMITTED)
    planted = copy.deepcopy(loo)
    for t in ("tph", "kW", "p80"):
        planted["loo"][t]["measured"] = planted["loo"][t]["measured"][:-1]
        for key, value in list(planted["loo"][t].get("strict", {}).get("pred", {}).items()):
            planted["loo"][t]["strict"]["pred"][key] = value[:-1]
    planted["n"] = loo["n"] - 1
    doc = comparison.build(planted, cb, VERSION)
    assert doc["crusherbayes"]["included"] is False
    assert "another set of surveys" in doc["crusherbayes"]["note"]["en"]
    assert cross_field_errors(doc) == []
