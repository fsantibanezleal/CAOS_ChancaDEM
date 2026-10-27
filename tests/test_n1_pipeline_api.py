"""N1: the public step functions the notebooks run (CrusherCal folds, fits, metrics and the nested band; the held-out
evaluation helpers; the Whiten chamber assembly and the replacement walk), each on a small hand-checked input, and the
document composed from them equal to the committed one."""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pytest
from pipeline.hp500 import backbone, loo
from pipeline.hp500.surveys import SURVEYS_CSV, read_surveys
from pipeline.model import sweep
from pipeline.model.crusher import Operating, evaluate, grid_edges, operating_from_survey
from pipeline.model.crusher.feed import make_feed
from pipeline.model.crusher.whiten import assemble_chamber, replacement_walk, whiten_solve
from pipeline.stages import evaluate as evaluate_stage
from pipeline.stages import train as train_stage

ROOT = Path(__file__).resolve().parents[1]
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
S01 = Operating("cone-sec", 32, 30, 360, 90, 1.2, 55, 14)


@pytest.fixture(scope="module")
def bb() -> dict:
    return backbone.build(read_surveys(SURVEYS_CSV).accepted, VERSION)


@pytest.fixture(scope="module")
def doc(bb: dict) -> dict:
    return loo.build(bb, VERSION)


# ---- folds, fits and predictions ------------------------------------------------------------------------------------


def test_fold_indices_strict_drops_the_held_out_row_and_leaky_keeps_all() -> None:
    assert loo.fold_indices(5, 2, leaky=False).tolist() == [0, 1, 3, 4]
    assert loo.fold_indices(5, 2, leaky=True).tolist() == [0, 1, 2, 3, 4]


def test_capacity_base_is_the_least_squares_scalar() -> None:
    shape, meas = np.array([1.0, 2.0, 3.0]), np.array([2.0, 4.0, 9.0])
    qt = loo.fit_capacity_base(shape, meas, np.array([0, 1]))        # (1*2 + 2*4) / (1 + 4) = 2
    assert qt == pytest.approx(2.0)
    assert loo.predict_capacity(qt, shape, 2) == pytest.approx(6.0)


def test_freeform_recovers_an_exact_plane() -> None:
    feat = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0], [2.0, 1.0], [3.0, 5.0]])
    meas = 1.0 + 2.0 * feat[:, 0] + 3.0 * feat[:, 1]
    coef = loo.fit_freeform(feat, meas, np.array([0, 1, 2, 3]))
    assert coef == pytest.approx([1.0, 2.0, 3.0])
    assert loo.predict_freeform(coef, feat[4]) == pytest.approx(meas[4])


def test_power_form_recovers_an_exact_line() -> None:
    pd = np.array([100.0, 200.0, 300.0, 400.0])
    zeta, pn = loo.fit_power_form(pd, 1.5 * pd + 10.0, np.array([0, 1, 2]))
    assert (zeta, pn) == (pytest.approx(1.5), pytest.approx(10.0))


def test_residual_is_clipped_to_the_physical_band_and_the_raw_value_is_kept() -> None:
    feat = np.array([[1.0, 1.0], [2.0, 1.0], [3.0, 2.0], [4.0, 2.0], [5.0, 3.0]])
    bbp = np.full(5, 100.0)
    meas = bbp + 1000.0 * feat[:, 0]                                  # a residual far beyond 20 % of the backbone
    fit = loo.fit_residual(feat, bbp, meas, np.array([0, 1, 2, 3]), 4)
    assert abs(fit.raw) > loo.RESID_CLIP_FRAC * 100.0
    assert fit.clipped == pytest.approx(loo.RESID_CLIP_FRAC * 100.0)
    assert fit.coef.shape == (3,)


def test_residual_inside_the_band_is_not_clipped() -> None:
    feat = np.array([[1.0, 1.0], [2.0, 1.0], [3.0, 2.0], [4.0, 2.0], [5.0, 3.0]])
    bbp = np.full(5, 100.0)
    fit = loo.fit_residual(feat, bbp, bbp + 0.5, np.array([0, 1, 2, 3]), 4)
    assert fit.clipped == fit.raw


# ---- metrics ----------------------------------------------------------------------------------------------------------


def test_metrics_on_a_hand_checked_pair() -> None:
    y, yhat = np.array([100.0, 200.0]), np.array([110.0, 180.0])
    assert loo.mape(y, yhat) == pytest.approx(10.0)
    assert loo.r2(y, y) == 1.0
    assert loo.r2(y, np.full(2, 150.0)) == pytest.approx(0.0)
    s = loo.stats(y, yhat)
    assert s == {"mape_pct": 10.0, "rmse": 15.81, "r2": round(1 - 500 / 5000, 3), "maxdev_pct": 10.0}


# ---- the predictive band and its nested coverage -------------------------------------------------------------------------


def test_predictive_band_is_z_times_the_sample_sigma() -> None:
    band = loo.predictive_band(np.array([1.0, -1.0, 1.0, -1.0]))
    sigma = math.sqrt(4.0 / 3.0)
    assert band["sigma"] == pytest.approx(sigma)
    assert band["halfwidth"] == pytest.approx(1.2816 * sigma)
    wide = loo.predictive_band(np.array([1.0, -1.0, 1.0, -1.0]), level=0.95)
    assert wide["halfwidth"] == pytest.approx(1.96 * sigma, rel=1e-3)


def test_nested_coverage_takes_sigma_from_the_other_folds_only() -> None:
    r = np.array([0.0, 0.0, 0.0, 0.0, 10.0])
    out = loo.nested_band_coverage(r)
    # held-out 4: sigma of [0,0,0,0] is 0, so |10| is outside; every other fold sees the 10 in its sigma (5.0)
    assert out["covered"] == [True, True, True, True, False]
    assert out["coverage"] == pytest.approx(0.8)
    assert out["sigma"][4] == 0.0
    assert out["sigma"][0] == pytest.approx(5.0)


def test_nested_coverage_differs_from_the_in_sample_one_when_a_survey_is_an_outlier() -> None:
    r = np.array([1.0, -1.0, 1.0, -1.0, 1.5])
    in_sample = float(np.mean(np.abs(r) <= 1.2816 * np.std(r, ddof=1)))
    assert loo.nested_band_coverage(r)["coverage"] < in_sample


def test_document_carries_the_nested_coverage_beside_the_in_sample_one(doc: dict) -> None:
    for target in ("tph", "kW", "p80"):
        block = doc["loo"][target]["strict"]
        uq = block["uq"]
        resid = np.array(doc["loo"][target]["measured"]) - np.array(block["pred"]["M0"])
        assert "nested_coverage" in uq and "nested_covered" in uq and "nested_note" in uq
        assert len(uq["nested_covered"]) == doc["n"] == len(uq["nested_sigma"])
        assert uq["nested_coverage"] == pytest.approx(sum(uq["nested_covered"]) / doc["n"], abs=1e-3)
        assert "in sample" in uq["nested_note"] and "out of sample" in uq["nested_note"]
        assert len(resid) == doc["n"]


# ---- build() composed from the public functions -------------------------------------------------------------------------


def test_build_equals_the_fold_by_fold_composition_of_the_public_functions(doc: dict, bb: dict) -> None:
    surveys = bb["surveys"]
    css = np.array([s["measured"]["css_mm"] for s in surveys], float)
    f80 = np.array([s["measured"]["f80_mm"] for s in surveys], float)
    meas = np.array([s["measured"]["feed_tph"] for s in surveys], float)
    shape = np.array([s["backbone"]["throughput_tph"] for s in surveys], float) / 647.0
    feat = np.column_stack([css, f80])
    n = meas.size
    m0, m2 = np.empty(n), np.empty(n)
    for i in range(n):
        idx = loo.fold_indices(n, i, leaky=False)
        m0[i] = loo.predict_capacity(loo.fit_capacity_base(shape, meas, idx), shape, i)
        m2[i] = loo.predict_freeform(loo.fit_freeform(feat, meas, idx), feat[i])
    m1 = np.array([m0[i] + loo.fit_residual(feat, m0, meas, loo.fold_indices(n, i, False), i).clipped for i in range(n)])
    pred = doc["loo"]["tph"]["strict"]["pred"]
    assert pred["M0"] == [round(float(v), 2) for v in m0]
    assert pred["M1"] == [round(float(v), 2) for v in m1]
    assert pred["M2"] == [round(float(v), 2) for v in m2]
    assert doc["loo"]["tph"]["strict"]["M0_backbone"] == loo.stats(meas, m0)
    nested = loo.nested_band_coverage(meas - m0)
    assert doc["loo"]["tph"]["strict"]["uq"]["nested_covered"] == nested["covered"]


def test_build_equals_the_committed_document(doc: dict) -> None:
    committed = json.loads((ROOT / "data" / "derived" / "hp500" / "loo.json").read_text(encoding="utf-8"))
    assert doc == committed


# ---- the held-out evaluation helpers --------------------------------------------------------------------------------------


def test_r2_mape_on_a_hand_checked_pair() -> None:
    r2, mape = evaluate_stage.r2_mape(np.array([110.0, 180.0]), np.array([100.0, 200.0]))
    assert r2 == pytest.approx(1 - 500 / 5000)
    assert mape == pytest.approx(10.0)
    assert evaluate_stage.r2_mape(np.array([1.0, 2.0]), np.array([3.0, 3.0]))[0] == 0.0   # constant truth: no variance


def test_target_vector_is_the_ten_outputs_with_the_sizes_in_log10() -> None:
    r = evaluate(S01)
    v = train_stage.target_vector(r)
    assert len(v) == 10
    assert v[0] == pytest.approx(math.log10(r.p80))
    assert v[3] == r.pct_passing[1] and v[8] == r.throughput_tph and v[9] == r.power_kw


def test_planted_points_move_one_input_outside_the_machine_range() -> None:
    results = [evaluate(S01)] * 18
    pts = evaluate_stage.planted_points(results)
    assert len(pts) == 18
    lo, hi = sweep.RANGES["cone-sec"]["css_mm"]
    assert pts[0].css_mm == pytest.approx(hi + 0.5 * (hi - lo))          # pattern 0: CSS above its upper bound
    assert pts[6].css_mm == pytest.approx(0.5 * lo)                      # pattern 6: CSS below its lower bound
    assert pts[12].css_mm > hi and pts[12].throw_mm < sweep.RANGES["cone-sec"]["throw_mm"][0]   # pattern 12: two inputs


class _Session:
    """A stand-in for the onnxruntime session: P80 (standardised) follows the CSS column, up or down."""

    def __init__(self, sign: float) -> None:
        self.sign = sign

    def run(self, _names, feed):
        x = feed["x"]
        z = np.zeros((x.shape[0], 10), np.float32)
        z[:, 0] = self.sign * x[:, 5]
        return [z]


_BUNDLE = {"in_mean": [0.0] * 6, "in_std": [1.0] * 6, "out_mean": [0.0] * 10, "out_std": [1.0] * 10, "out_log": [False] * 10}


def test_monotonicity_check_accepts_a_p80_that_rises_with_css_and_rejects_one_that_falls() -> None:
    ok, curves = evaluate_stage.monotonicity_check(_BUNDLE, _Session(+1.0))
    assert ok is True and curves == 15
    bad, _ = evaluate_stage.monotonicity_check(_BUNDLE, _Session(-1.0))
    assert bad is False


# ---- the Whiten chamber and the replacement walk -------------------------------------------------------------------------


def test_assemble_chamber_gives_the_c_and_b_the_engine_solves() -> None:
    c, B = assemble_chamber(S01)
    k = len(grid_edges()) - 1
    assert c.shape == (k,) and B.shape == (k, k)
    assert np.all(np.triu(B) == 0)                                       # strictly lower triangular
    feed = make_feed(grid_edges(), S01.feed_x63_mm, S01.feed_m)
    out = whiten_solve(c.tolist(), B.ravel().tolist(), list(feed.mass), k)
    assert out.product == pytest.approx(list(evaluate(S01).product.mass), abs=1e-12)


def test_assemble_chamber_follows_the_calibrated_lane() -> None:
    op = operating_from_survey(48, 88)
    c, B = assemble_chamber(op)
    feed = make_feed(grid_edges(), op.feed_x63_mm, op.feed_m)
    out = whiten_solve(c.tolist(), B.ravel().tolist(), list(feed.mass), len(c))
    assert out.product == pytest.approx(list(evaluate(op).product.mass), abs=1e-12)


def test_replacement_walk_is_deterministic_and_converges_on_the_whiten_product() -> None:
    c, B = assemble_chamber(S01)
    feed = np.array(make_feed(grid_edges(), S01.feed_x63_mm, S01.feed_m).mass)
    a = replacement_walk(c, B, feed, 20_000, 7)
    b = replacement_walk(c, B, feed, 20_000, 7)
    assert np.array_equal(a[0], b[0]) and a[1] == b[1]
    reference = np.array(whiten_solve(c.tolist(), B.ravel().tolist(), feed.tolist(), len(c)).product)
    assert a[0].sum() == pytest.approx(1.0)
    assert 0.5 * np.abs(a[0] - reference).sum() < 0.05
    assert a[1] > 0                                                      # nips per parcel


def test_replacement_walk_with_nothing_nipped_returns_the_feed() -> None:
    k = 3
    feed = np.array([0.5, 0.3, 0.2])
    product, nips = replacement_walk(np.zeros(k), np.zeros((k, k)), feed, 10_000, 1)
    assert nips == 0.0
    assert np.abs(product - feed).max() < 0.03


# ---- BS-1 of the SDD quotes what the committed document measures ------------------------------------------------------------


def test_sdd_bs1_quotes_the_committed_numbers_and_claims_no_band_of_the_paper() -> None:
    sdd = (ROOT / "docs" / "design" / "SDD.md").read_text(encoding="utf-8")
    start = sdd.index("- BS-1, CrusherCal")
    bs1 = " ".join(sdd[start:sdd.index("## Deploy driver", start)].split())
    doc = json.loads((ROOT / "data" / "derived" / "hp500" / "loo.json").read_text(encoding="utf-8"))
    tph, kw = doc["loo"]["tph"]["strict"], doc["loo"]["kW"]["strict"]
    quoted = {
        "strict MAPE": f"{tph['M0_backbone']['mape_pct']:.2f} percent",
        "in-sample MAPE of the same backbone": f"{doc['tph_parity']['backbone']['mape_pct']:.2f} percent",
        "constant mean": f"{tph['constant_mean']['mape_pct']:.2f} percent",
        "label shuffle": f"{tph['M1_label_shuffle']['mape_pct']:.2f} percent",
        "bounded residual": f"{tph['M1_residual']['mape_pct']:.2f} percent",
        "in-sample coverage": f"{tph['uq']['empirical_coverage']:.2f} on throughput",
        "nested coverage, throughput": f"{tph['uq']['nested_coverage']:.2f} on throughput",
        "nested coverage, power": f"{kw['uq']['nested_coverage']:.2f} on power",
    }
    for what, text in quoted.items():
        assert text in bs1, (what, text)
    assert "inside the paper's own band" not in bs1
