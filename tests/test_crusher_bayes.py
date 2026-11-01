"""CrusherBayes (BS-2): the engine's scalar path keeps the shipped engine, the priors are the engine's nominals, the folds
never see their held-out survey, the sampler is seeded, the convergence diagnostic is recorded and the kill criterion
of the SDD is applied as written. The committed document is baked offline with the full sampler (ADR-0074: CI never
trains); these tests run the same code with a tiny chain, which is too short to converge and is recorded as such."""
from __future__ import annotations

import copy
import json
import math
from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest

from pipeline.hp500 import backbone, crusherbayes as cb, loo
from pipeline.hp500.surveys import SURVEYS_CSV, read_surveys
from pipeline.model.crusher import evaluate, operating_from_survey
from pipeline.model.crusher.hp500 import Hp500Scalars

VERSION = (Path(__file__).resolve().parents[1] / "VERSION").read_text(encoding="utf-8").strip()
TINY = cb.Config(walkers=20, steps=10, burn=3, thin=1, draws=2)


@pytest.fixture(scope="module")
def bb() -> dict:
    return backbone.build(read_surveys(SURVEYS_CSV).accepted, VERSION)


@pytest.fixture(scope="module")
def lo(bb: dict) -> dict:
    return loo.build(bb, VERSION)


@pytest.fixture(scope="module")
def doc(bb: dict, lo: dict) -> dict:
    return cb.build(bb, lo, VERSION, config=TINY, workers=4)


def _job(bb: dict, held: int | None, seed: int = 11) -> dict:
    s = bb["surveys"]
    return {"css": [x["measured"]["css_mm"] for x in s], "f80": [x["measured"]["f80_mm"] for x in s],
            "tph": [x["measured"]["feed_tph"] for x in s], "kW": [x["measured"]["power_kw"] for x in s],
            "held": held, "seed": seed, "config": TINY.__dict__}


# ---- the engine path and the priors --------------------------------------------------------------------------------
def test_the_default_scalars_are_the_shipped_engine() -> None:
    for css, f80 in ((54, 88), (38, 140), (48, 47)):
        op = operating_from_survey(css, f80)
        a, b = evaluate(op), evaluate(op, Hp500Scalars())
        assert (a.throughput_tph, a.power_kw, a.p80) == (b.throughput_tph, b.power_kw, b.p80)


def test_a_scalar_moves_the_engine_and_a_synthetic_point_refuses_scalars() -> None:
    op = operating_from_survey(46, 100)
    base = evaluate(op)
    assert evaluate(op, Hp500Scalars(q_ref_tph=700)).throughput_tph > base.throughput_tph
    assert evaluate(op, Hp500Scalars(pn_kw=150)).power_kw == pytest.approx(base.power_kw + 40)
    assert evaluate(op, Hp500Scalars(k3=3.0)).p80 != base.p80
    assert evaluate(op, Hp500Scalars(t10_shift_pct=-6)).p80 > base.p80          # less breakage, a coarser product
    with pytest.raises(ValueError, match="calibrated"):
        evaluate(replace(op, calibrated=False), Hp500Scalars())


def test_every_prior_is_centred_on_the_engines_own_value_with_a_source() -> None:
    fields = Hp500Scalars._fields
    assert [p.name for p in cb.PRIORS] == list(fields)
    for p, name in zip(cb.PRIORS, fields):
        assert p.nominal == getattr(Hp500Scalars(), name), name
        centre = math.exp(p.mu) if p.log else p.mu
        assert centre == pytest.approx(p.nominal), name
        assert p.lo < p.mu < p.hi and p.sd > 0 and len(p.source) > 20, name
    assert cb.scalars_of(cb.nominal_theta()) == pytest.approx(Hp500Scalars())


def test_the_prior_is_proper_and_bounded() -> None:
    theta = cb.nominal_theta()
    assert math.isfinite(cb.log_prior(theta))
    for i, p in enumerate(cb.PRIORS):
        for bad in (p.lo - 1e-6, p.hi + 1e-6, math.nan):
            t = theta.copy()
            t[i] = bad
            assert cb.log_prior(t) == -math.inf, (p.name, bad)
    t = theta.copy()
    t[-1] = 99.0
    assert cb.log_prior(t) == -math.inf


# ---- the folds ----------------------------------------------------------------------------------------------------
def test_loo_refits_without_the_held_out_survey(bb: dict) -> None:
    """Plant an absurd throughput and power in survey k: the posterior predictive of fold k does not move (the survey is
    held out), the one of a fold that trains on survey k does."""
    k, other = 3, 6
    planted = copy.deepcopy(bb)
    planted["surveys"][k]["measured"].update(feed_tph=99999, power_kw=9999)

    def pred(doc_: dict, held: int) -> dict:
        return cb.fit_inline(_job(doc_, held))["pred"]

    base_k, planted_k = pred(bb, k), pred(planted, k)
    base_o, planted_o = pred(bb, other), pred(planted, other)
    for t in cb.TARGETS:
        assert base_k[t]["mean"] == planted_k[t]["mean"], t
        assert base_o[t]["mean"] != planted_o[t]["mean"], t


def test_a_fold_is_a_function_of_its_seed_alone(bb: dict) -> None:
    a, b, c = (cb.fit_inline(_job(bb, 2, seed=s)) for s in (5, 5, 6))
    assert a["pred"] == b["pred"] and a["tau_max"] == b["tau_max"]
    assert a["pred"] != c["pred"]


def test_the_document_is_byte_identical_and_independent_of_the_worker_count(bb: dict, lo: dict, doc: dict) -> None:
    again = cb.build(bb, lo, VERSION, config=TINY, workers=2)
    assert json.dumps(again, separators=(",", ":")) == json.dumps(doc, separators=(",", ":"))


# ---- the document -------------------------------------------------------------------------------------------------
def test_a_short_chain_is_recorded_as_not_converged_never_kept_silently(doc: dict) -> None:
    conv = doc["convergence"]
    assert len(conv["folds"]) == doc["n"] + 1 and conv["folds"][-1]["fold"] == "all"
    assert [f["fold"] for f in conv["folds"][:-1]] == list(range(1, doc["n"] + 1))
    assert not any(f["converged"] for f in conv["folds"])          # 7 post-burn steps cannot be 50 autocorrelation times
    assert conv["all_converged"] is False
    assert all(f["chain_over_tau"] < conv["tau_factor"] for f in conv["folds"])


def test_the_document_carries_every_comparator_and_the_whole_contraction_table(doc: dict) -> None:
    for t in cb.TARGETS:
        assert set(doc["comparators"][t]) == {"M0", "B_lin", "M2"}
        assert len(doc["loo"][t]["pred_mean"]) == len(doc["loo"][t]["lo80"]) == len(doc["loo"][t]["hi80"]) == doc["n"]
    names = [r["name"] for r in doc["contraction"]]
    assert names[:8] == [p.name for p in cb.PRIORS] and "sigma_tph" in names and "sigma_kW" in names
    assert sum(n.startswith("discrepancy_") for n in names) == 6
    assert "p80" not in doc["loo"]                                    # P80 is not measured and never a target


def test_the_comparators_are_the_loo_documents_numbers(doc: dict, lo: dict) -> None:
    for t in cb.TARGETS:
        assert doc["comparators"][t]["M0"]["mape_pct"] == lo["loo"][t]["strict"]["M0_backbone"]["mape_pct"]
        assert doc["comparators"][t]["B_lin"]["mape_pct"] == lo["loo"][t]["strict"]["B_lin"]["mape_pct"]
        assert doc["comparators"][t]["M2"]["mape_pct"] == lo["loo"][t]["strict"]["M2_freeform"]["mape_pct"]


def test_the_discrepancy_marginal_is_the_exact_gaussian() -> None:
    """The marginal likelihood integrates the linear discrepancy out: against a brute-force Monte Carlo of the same model."""
    rng = np.random.default_rng(0)
    X = np.column_stack([np.ones(9), rng.standard_normal(9), rng.standard_normal(9)])
    sigma, tau = 0.7, 1.3
    r = rng.standard_normal(9)
    exact, _ = cb._gaussian_terms(r, X, sigma, tau)
    d = rng.standard_normal((400_000, 3)) * tau
    resid = r[None, :] - d @ X.T
    mc = math.log(np.mean(np.exp(-0.5 * np.sum(resid ** 2, axis=1) / sigma ** 2) / ((2 * math.pi * sigma ** 2) ** 4.5)))
    assert exact == pytest.approx(mc, abs=0.05)


# ---- the kill criterion, as written -------------------------------------------------------------------------------
BASE = dict(power_mape=12.0, power_mape_blin=12.78, tph_mape=12.0, tph_mape_m0=12.09,
            coverage={"tph": 0.8, "kW": 0.8}, width={"tph": 300.0, "kW": 80.0}, width_crushercal={"tph": 350.0, "kW": 90.0})


def test_kill_criterion_is_applied_as_written() -> None:
    # (a) holds (no margin of 3 points on either target) but (b) does not (coverage inside, bands narrower): kept
    k = cb.kill_criterion(**BASE)
    assert k["a_holds"] and not k["b_holds"] and k["verdict"] == "kept"
    # both hold: dropped, by a coverage outside 0.7 to 0.9 on either target ...
    for t in cb.TARGETS:
        for bad in (0.6, 1.0):
            cov = {**BASE["coverage"], t: bad}
            assert cb.kill_criterion(**{**BASE, "coverage": cov})["verdict"] == "dropped as a predictor", (t, bad)
    # ... or by a band wider than the CrusherCal band
    wide = {**BASE["width"], "kW": 95.0}
    assert cb.kill_criterion(**{**BASE, "width": wide})["verdict"] == "dropped as a predictor"
    # the edges of the band belong to it
    assert cb.kill_criterion(**{**BASE, "coverage": {"tph": 0.7, "kW": 0.9}})["verdict"] == "kept"
    # (a) fails when either margin of 3 points is met, whatever (b) says
    bad_b = {**BASE, "coverage": {"tph": 0.2, "kW": 0.2}}
    assert cb.kill_criterion(**{**bad_b, "power_mape": 12.78 - 3.0})["verdict"] == "kept"       # power 3 points under B-lin
    assert cb.kill_criterion(**{**bad_b, "tph_mape": 12.09 - 3.0})["verdict"] == "kept"         # throughput 3 points under M0
    assert cb.kill_criterion(**{**bad_b, "power_mape": 12.78 - 2.99})["verdict"] == "dropped as a predictor"
    assert cb.kill_criterion(**{**bad_b, "tph_mape": 12.09 - 2.99})["verdict"] == "dropped as a predictor"


def test_the_verdict_agrees_with_its_own_numbers_in_every_combination() -> None:
    for pm in (5.0, 11.0, 15.0):
        for tm in (5.0, 11.0, 15.0):
            for cov in (0.5, 0.8, 1.0):
                for w in (80.0, 100.0):
                    k = cb.kill_criterion(power_mape=pm, power_mape_blin=12.78, tph_mape=tm, tph_mape_m0=12.09,
                                          coverage={"tph": cov, "kW": 0.8}, width={"tph": 300.0, "kW": w},
                                          width_crushercal={"tph": 350.0, "kW": 90.0})
                    a = (12.78 - pm < 3) and (12.09 - tm < 3)
                    b = cov < 0.7 or cov > 0.9 or w > 90.0
                    assert k["a_holds"] is a and k["b_holds"] is b
                    assert k["verdict"] == ("dropped as a predictor" if a and b else "kept")
