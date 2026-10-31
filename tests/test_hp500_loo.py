"""CrusherCal LOO invariants: the held-out validation must be reproducible and its negative controls must
behave (a control that 'wins' would signal leakage). No accuracy threshold is asserted as a pass/fail claim,
only the STRUCTURE the honesty argument depends on. The documents are built in memory from the survey table;
nothing is written under data/."""
from __future__ import annotations

import copy
from pathlib import Path

import pytest

from pipeline.hp500 import backbone, loo
from pipeline.hp500.surveys import SURVEYS_CSV, read_surveys

VERSION = (Path(__file__).resolve().parents[1] / "VERSION").read_text(encoding="utf-8").strip()


@pytest.fixture(scope="module")
def bb() -> dict:
    return backbone.build(read_surveys(SURVEYS_CSV).accepted, VERSION)


def test_backbone_has_ten_surveys(bb: dict) -> None:
    assert bb["n"] == 10
    assert len(bb["surveys"]) == 10
    for s in bb["surveys"]:
        assert s["measured"]["power_kw"] > 0 and s["measured"]["feed_tph"] > 0


def test_loo_is_deterministic(bb: dict) -> None:
    assert loo.build(bb, VERSION, seed=42) == loo.build(bb, VERSION, seed=42)


def test_adversarial_the_label_shuffle_control_does_not_beat_the_backbone(bb: dict) -> None:
    """A model trained on SHUFFLED labels must not beat the real backbone; if it did, we would have leakage."""
    res = loo.build(bb, VERSION)
    for target in ("tph", "kW"):
        strict = res["loo"][target]["strict"]
        assert strict["M1_label_shuffle"]["mape_pct"] > strict["M0_backbone"]["mape_pct"], target


def test_tph_backbone_has_real_skill(bb: dict) -> None:
    """The t/h capacity backbone must beat the constant-mean baseline out-of-sample (genuine, not memorization)."""
    strict = loo.build(bb, VERSION)["loo"]["tph"]["strict"]
    assert strict["M0_backbone"]["mape_pct"] < strict["constant_mean"]["mape_pct"]


def test_adversarial_the_leaky_folds_expose_the_optimism_gap(bb: dict) -> None:
    """The free-form model must look better LEAKY than STRICT (the overfitting the LOO is there to expose); the
    calibrated backbone must be far more stable across the two."""
    tph = loo.build(bb, VERSION)["loo"]["tph"]
    m2_gap = tph["strict"]["M2_freeform"]["mape_pct"] - tph["leaky"]["M2_freeform"]["mape_pct"]
    m0_gap = tph["strict"]["M0_backbone"]["mape_pct"] - tph["leaky"]["M0_backbone"]["mape_pct"]
    assert m2_gap > m0_gap


def test_uq_coverage_present_and_reasonable(bb: dict) -> None:
    uq = loo.build(bb, VERSION)["loo"]["tph"]["strict"]["uq"]
    assert 0.0 <= uq["empirical_coverage"] <= 1.0
    assert uq["band_halfwidth"] > 0


def test_build_does_not_touch_the_input(bb: dict) -> None:
    before = copy.deepcopy(bb)
    loo.build(bb, VERSION)
    assert bb == before


# ---- release 0.12.000: B-lin and Morrell on the same folds (hp500-loo 1.2.0) ----------------------------------------
def test_b_lin_reproduces_the_dossier_numbers(bb: dict) -> None:
    """Section 1.4 of the beyond-SOTA dossier: the CSS-only line scores 12.78 percent on power and 13.67 on throughput."""
    res = loo.build(bb, VERSION)["loo"]
    assert res["kW"]["strict"]["B_lin"]["mape_pct"] == 12.78
    assert res["tph"]["strict"]["B_lin"]["mape_pct"] == 13.67
    assert "B_lin" not in res["p80"]["strict"]                       # p80 is not measured, so no line is fitted to it
    assert len(res["kW"]["strict"]["pred"]["B_lin"]) == len(res["tph"]["leaky"]["pred"]["B_lin"]) == 10


def test_b_lin_leaky_is_no_worse_than_strict(bb: dict) -> None:
    kw = loo.build(bb, VERSION)["loo"]["kW"]
    assert kw["leaky"]["B_lin"]["mape_pct"] <= kw["strict"]["B_lin"]["mape_pct"]


def test_morrell_variants_report_the_numbers_as_they_come(bb: dict) -> None:
    """G1 of the dossier measured 38.08 percent without and 15.21 with the no-load term; both are worse than B-lin."""
    kw = loo.build(bb, VERSION)["loo"]["kW"]["strict"]
    assert kw["Morrell"]["mape_pct"] == 38.08
    assert kw["Morrell_noload"]["mape_pct"] == 15.21
    assert kw["Morrell"]["mape_pct"] > kw["B_lin"]["mape_pct"] and kw["Morrell_noload"]["mape_pct"] > kw["B_lin"]["mape_pct"]
    fit = kw["morrell_fit"]
    assert len(fit["m_ic_kwh_t"]) == len(fit["no_load_kw"]) == len(fit["noload_variant_m_ic_positive"]) == 10
    assert all(m > 0 for m in fit["m_ic_kwh_t"])
    assert not any(fit["noload_variant_m_ic_positive"])               # the no-load variant fits a negative M_ic: not Morrell's physics
    assert "Morrell" not in loo.build(bb, VERSION)["loo"]["tph"]["strict"]


def test_adversarial_a_fold_never_sees_its_held_out_survey(bb: dict) -> None:
    """Plant an absurd measured power in survey k: the held-out prediction of fold k does not move for any model, and the
    predictions of the other folds (which train on survey k) do."""
    k = 4
    base = loo.build(bb, VERSION)["loo"]["kW"]["strict"]["pred"]
    planted = copy.deepcopy(bb)
    planted["surveys"][k]["measured"]["power_kw"] = 9999
    moved = loo.build(planted, VERSION)["loo"]["kW"]["strict"]["pred"]
    for model in ("M0", "M2", "B_lin", "Morrell", "Morrell_noload"):
        assert moved[model][k] == base[model][k], model
        assert all(moved[model][i] != base[model][i] for i in range(10) if i != k), model
