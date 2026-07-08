"""CrusherCal LOO invariants: the held-out validation must be reproducible and its negative controls must
behave (a control that 'wins' would signal leakage). No accuracy threshold is asserted as a pass/fail claim,
only the STRUCTURE the honesty argument depends on."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from chancalab.hp500 import loo

ROOT = Path(__file__).resolve().parents[1]
BACKBONE = ROOT / "data" / "derived" / "hp500" / "backbone.json"


@pytest.fixture(scope="module")
def backbone() -> dict:
    if not BACKBONE.exists():
        pytest.skip("backbone.json not baked (run bake_hp500.mjs)")
    return json.loads(BACKBONE.read_text(encoding="utf-8"))


def test_backbone_has_ten_surveys(backbone: dict) -> None:
    assert backbone["n"] == 10
    assert len(backbone["surveys"]) == 10
    for s in backbone["surveys"]:
        assert s["measured"]["kW"] > 0 and s["measured"]["tph"] > 0


def test_loo_is_deterministic(backbone: dict) -> None:
    a = loo.run(backbone, seed=42)
    b = loo.run(backbone, seed=42)
    assert a == b


def test_label_shuffle_control_does_not_beat_backbone(backbone: dict) -> None:
    """A model trained on SHUFFLED labels must not beat the real backbone; if it did, we would have leakage."""
    res = loo.run(backbone)
    for target in ("tph", "kW"):
        strict = res["loo"][target]["strict"]
        assert strict["M1_label_shuffle"]["mape_pct"] > strict["M0_backbone"]["mape_pct"], target


def test_tph_backbone_has_real_skill(backbone: dict) -> None:
    """The t/h capacity backbone must beat the constant-mean baseline out-of-sample (genuine, not memorization)."""
    strict = loo.run(backbone)["loo"]["tph"]["strict"]
    assert strict["M0_backbone"]["mape_pct"] < strict["constant_mean"]["mape_pct"]


def test_overfit_optimism_gap_is_exposed(backbone: dict) -> None:
    """The free-form / residual models must look better LEAKY than STRICT (the overfitting the LOO is there to
    expose); the calibrated backbone must be far more stable across the two."""
    res = loo.run(backbone)
    tph = res["loo"]["tph"]
    m2_gap = tph["strict"]["M2_freeform"]["mape_pct"] - tph["leaky"]["M2_freeform"]["mape_pct"]
    m0_gap = tph["strict"]["M0_backbone"]["mape_pct"] - tph["leaky"]["M0_backbone"]["mape_pct"]
    assert m2_gap > m0_gap  # free-form is more optimistic in-sample than the physics backbone


def test_uq_coverage_present_and_reasonable(backbone: dict) -> None:
    uq = loo.run(backbone)["loo"]["tph"]["strict"]["uq"]
    assert 0.0 <= uq["empirical_coverage"] <= 1.0
    assert uq["band_halfwidth"] > 0
