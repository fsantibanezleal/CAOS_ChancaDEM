"""Contract hp500-crusherbayes 1.0.0: CrusherBayes, the Bayesian calibration of the engine with a structural discrepancy
(data/derived/hp500/crusherbayes.json, written by the offline bake; CI never runs the sampler, ADR-0074, it validates the
committed document). Producer side: the committed document and a document built by the same code validate against the
schema, equal the provider tree and obey the rules the schema cannot state. Consumer side: a reader that takes the verdict,
the scores and the convergence flag from the committed document. Adversarial: planted documents that break the schema or
the cross-field rules are rejected."""
from __future__ import annotations

import copy
import json
from typing import Any

import contract_schemas as cs
import numpy as np
import pytest
from pipeline.hp500 import backbone, crusherbayes as cb, loo
from pipeline.hp500.surveys import SURVEYS_CSV, read_surveys

VERSION = (cs.ROOT / "VERSION").read_text(encoding="utf-8").strip()
FIXTURE = cs.FIXTURE_ROOT / "data" / "derived" / "hp500" / "crusherbayes.json"
COMMITTED = cs.ROOT / "data" / "derived" / "hp500" / "crusherbayes.json"
TINY = cb.Config(walkers=20, steps=10, burn=3, thin=1, draws=2)


def cross_field_errors(doc: dict) -> list[str]:
    """The rules the schema cannot state (the catalog row and the schema description)."""
    found: list[str] = []
    n = doc["n"]
    for t in cb.TARGETS:
        for key in ("measured", "pred_mean", "lo80", "hi80"):
            if len(doc["loo"][t][key]) != n:
                found.append(f"loo/{t}/{key}: not {n} values")
        if any(lo > hi for lo, hi in zip(doc["loo"][t]["lo80"], doc["loo"][t]["hi80"])):
            found.append(f"loo/{t}: an interval with lo80 above hi80")
    folds = doc["convergence"]["folds"]
    if [f["fold"] for f in folds] != [*range(1, n + 1), "all"]:
        found.append("convergence/folds: not one entry per survey and one for all")
    if doc["convergence"]["all_converged"] != all(f["converged"] for f in folds):
        found.append("convergence/all_converged: disagrees with the fold entries")
    for f in folds:
        if f["converged"] != (f["chain_over_tau"] >= doc["convergence"]["tau_factor"]):
            found.append(f"convergence/folds/{f['fold']}: converged disagrees with chain_over_tau")
    k = doc["kill_criterion"]
    again = cb.kill_criterion(
        power_mape=k["power_mape_pct"], power_mape_blin=k["power_mape_blin_pct"], tph_mape=k["tph_mape_pct"],
        tph_mape_m0=k["tph_mape_m0_pct"], coverage=k["coverage"], width=k["mean_width"], width_crushercal=k["mean_width_crushercal"])
    if again["verdict"] != k["verdict"] or again["a_holds"] != k["a_holds"] or again["b_holds"] != k["b_holds"]:
        found.append("kill_criterion: the verdict is not the criterion applied to the numbers it carries")
    for t in cb.TARGETS:
        s = doc["loo"][t]["scores"]
        if k["coverage"][t] != s["coverage_80"] or k["mean_width"][t] != s["mean_width"]:
            found.append(f"kill_criterion: {t} coverage or width differs from loo/{t}/scores")
        if k["mean_width_crushercal"][t] != doc["comparators"][t]["M0"]["mean_width"]:
            found.append(f"kill_criterion: the CrusherCal width of {t} is not the M0 band of the comparators")
    if k["power_mape_pct"] != doc["loo"]["kW"]["scores"]["mape_pct"] or k["tph_mape_pct"] != doc["loo"]["tph"]["scores"]["mape_pct"]:
        found.append("kill_criterion: a MAPE differs from loo/*/scores")
    if k["power_mape_blin_pct"] != doc["comparators"]["kW"]["B_lin"]["mape_pct"] or k["tph_mape_m0_pct"] != doc["comparators"]["tph"]["M0"]["mape_pct"]:
        found.append("kill_criterion: a comparator MAPE differs from comparators")
    return found


@pytest.fixture(scope="module")
def committed() -> dict:
    return cs.load_json(COMMITTED)


@pytest.fixture(scope="module")
def built() -> dict:
    bb = backbone.build(read_surveys(SURVEYS_CSV).accepted, VERSION)
    return cb.build(bb, loo.build(bb, VERSION), VERSION, config=TINY, workers=4)


def test_crusherbayes_validates(committed: dict) -> None:
    errors = cs.errors("hp500-crusherbayes", committed)
    assert not errors, errors
    assert committed["n"] == 10 and committed["engine_version"] == VERSION and committed["seed"] == cb.SEED
    assert cross_field_errors(committed) == []
    assert committed["method"]["sampler_version"] == cb.SAMPLER_VERSION
    assert committed["method"]["walkers"] == cb.DEFAULT_CONFIG.walkers and committed["method"]["steps"] == cb.DEFAULT_CONFIG.steps
    assert [r["name"] for r in committed["contraction"]][:8] == [p.name for p in cb.PRIORS]


def test_the_committed_document_was_sampled_from_the_committed_surveys(committed: dict) -> None:
    """The inputs digest is the survey table, the sampler size, the seed and the priors of the code that is here: a table, a
    prior or a sampler size changed without a rebake is caught."""
    s = read_surveys(SURVEYS_CSV).accepted
    css = np.array([x.css_mm for x in s], float)
    f80 = np.array([x.f80_mm for x in s], float)
    tph = np.array([x.feed_tph for x in s], float)
    kw = np.array([x.power_kw for x in s], float)
    cfg = cb.Config(committed["method"]["walkers"], committed["method"]["steps"], committed["method"]["burn_in_steps"],
                    committed["method"]["thin"], committed["method"]["predictive_draws_per_sample"])
    assert committed["inputs_sha256"] == cb.inputs_digest(css, f80, tph, kw, cfg, committed["seed"])


def test_a_document_built_by_the_same_code_validates(built: dict) -> None:
    errors = cs.errors("hp500-crusherbayes", built)
    assert not errors, errors
    assert cross_field_errors(built) == []
    assert built["convergence"]["all_converged"] is False             # a tiny chain: recorded, never kept silently


def test_the_committed_document_equals_the_provider_tree(committed: dict) -> None:
    assert not cs.errors("hp500-crusherbayes", cs.load_json(FIXTURE))
    fixture = cs.load_json(FIXTURE)
    assert {**fixture, "engine_version": committed["engine_version"]} == committed          # the provider tree has its own stamp


def test_the_measured_values_are_the_surveys(committed: dict) -> None:
    s = read_surveys(SURVEYS_CSV).accepted
    assert committed["loo"]["tph"]["measured"] == [float(x.feed_tph) for x in s]
    assert committed["loo"]["kW"]["measured"] == [float(x.power_kw) for x in s]


def test_the_consumer_reads_the_committed_document(committed: dict) -> None:
    """What the notebooks and the Benchmark read: the verdict, the convergence flag, the scores beside the comparators
    and the contraction table; every one is present and typed."""
    verdict = committed["kill_criterion"]["verdict"]
    assert verdict in ("kept", "dropped as a predictor")
    assert isinstance(committed["convergence"]["all_converged"], bool)
    for t in cb.TARGETS:
        row = {"CrusherBayes": committed["loo"][t]["scores"], **committed["comparators"][t]}
        assert set(row) == {"CrusherBayes", "M0", "B_lin", "M2"}
        assert all(isinstance(v["mape_pct"], float) and 0 <= v["coverage_80"] <= 1 for v in row.values())
    table = {r["name"]: r["contraction"] for r in committed["contraction"]}
    assert all(0 <= c for c in table.values()) and len(table) == len(cb.PRIORS) + 2 + 6


# ---- adversarial: planted documents that break the contract are rejected ---------------------------------------------
def _mut(doc: dict, edit) -> dict:
    out = copy.deepcopy(doc)
    edit(out)
    return out


def test_adversarial_documents_that_violate_the_schema_are_rejected(committed: dict) -> None:
    assert cs.errors("hp500-crusherbayes", committed) == []
    bad: dict[str, Any] = {
        "missing verdict": _mut(committed, lambda d: d["kill_criterion"].pop("verdict")),
        "a verdict outside the enum": _mut(committed, lambda d: d["kill_criterion"].update(verdict="maybe")),
        "a coverage above one": _mut(committed, lambda d: d["loo"]["kW"]["scores"].update(coverage_80=1.5)),
        "an unknown top-level field": _mut(committed, lambda d: d.update(p80=[1, 2, 3])),
        "too few surveys": _mut(committed, lambda d: d.update(n=2)),
        "a bad digest": _mut(committed, lambda d: d.update(inputs_sha256="abc")),
        "a wrong sampler": _mut(committed, lambda d: d["method"].update(sampler="mystery")),
        "a wrong schema tag": _mut(committed, lambda d: d.update(schema="chancadem.hp500.loo/v1")),
        "a missing convergence flag": _mut(committed, lambda d: d["convergence"]["folds"][0].pop("converged")),
        "a negative standard deviation": _mut(committed, lambda d: d["contraction"][0].update(posterior_sd=-1)),
        "a third target": _mut(committed, lambda d: d["loo"].update(p80=d["loo"]["tph"])),
        "a wrong unit-carrying key": _mut(committed, lambda d: d["kill_criterion"]["mean_width"].update(tph="wide")),
    }
    for why, doc in bad.items():
        assert cs.errors("hp500-crusherbayes", doc), why


def test_adversarial_documents_that_break_a_cross_field_rule_are_found(committed: dict) -> None:
    flipped = "dropped as a predictor" if committed["kill_criterion"]["verdict"] == "kept" else "kept"
    bad: dict[str, Any] = {
        "a verdict that disagrees with its numbers": _mut(committed, lambda d: d["kill_criterion"].update(verdict=flipped)),
        "a short per-survey list": _mut(committed, lambda d: d["loo"]["tph"]["pred_mean"].pop()),
        "an interval turned over": _mut(committed, lambda d: d["loo"]["kW"].update(lo80=d["loo"]["kW"]["hi80"], hi80=d["loo"]["kW"]["lo80"])),
        "all_converged claimed over an unconverged fold": _mut(
            committed, lambda d: (d["convergence"]["folds"][0].update(converged=False, chain_over_tau=1.0),
                                  d["convergence"].update(all_converged=True))),
        "a converged flag the diagnostic denies": _mut(
            committed, lambda d: d["convergence"]["folds"][0].update(converged=True, chain_over_tau=1.0)),
    }
    for why, doc in bad.items():
        assert cross_field_errors(doc), why
    assert json.loads(json.dumps(committed)) == committed
