"""CrusherCal LOO invariants: the held-out validation must be reproducible and its negative controls must
behave (a control that 'wins' would signal leakage). No accuracy threshold is asserted as a pass/fail claim,
only the STRUCTURE the honesty argument depends on. The documents are built in memory from the survey table;
nothing is written under data/."""
from __future__ import annotations

import copy

import pytest

from pipeline.hp500 import backbone, loo
from pipeline.hp500.surveys import SURVEYS_CSV, read_surveys

VERSION = "0.09.003"


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
