"""Model slots surrogate-model 1.0.0 and anomaly-model 1.0.0, and the document model-metrics 1.0.0 (producer side,
unit M1): the contracts of the two learned models, their ONNX graphs, their held-out metrics, and the swap to the
baseline when a bundle is invalid. The tests use the COMMITTED graphs and never train (ADR-0074: training and
evaluation are local release operations); each bundle test runs against the bake (``data/derived/models``) and the
provider tree (``docs/contracts/fixtures/data/derived/models``, which carries the 0.09.003 graphs)."""
from __future__ import annotations

import hashlib
import inspect
import json
import shutil
import subprocess
from pathlib import Path

import numpy as np
import onnxruntime as ort
import pytest
from contract_schemas import DERIVED_ROOTS, ROOT, errors
from pipeline.model import bundles, sweep
from pipeline.model.crusher import Operating, evaluate
from pipeline.model.crusher.encoding import encode_input
from pipeline.stages import evaluate as evaluate_stage
from pipeline.stages import train as train_stage

MODEL_DIRS = {name: base / "models" for name, base in DERIVED_ROOTS.items()}
BAKE = MODEL_DIRS["bake"]
METRICS = DERIVED_ROOTS["bake"] / "model-metrics.json"
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
SLOTS = {"surrogate-model": "surrogate.json", "anomaly-model": "psd-ae.json"}
SCHEMA = {"surrogate-model": "surrogate-model", "anomaly-model": "anomaly-model"}

# the case of the production-path check: engine P80 27.7 mm
CASE = Operating("cone-sec", 32, 30, 360, 90, 1.2, 55, 14)
OUT_KEYS = ("p80_mm", "p50_mm", "p20_mm", "pass_1", "pass_4", "pass_8", "pass_16", "pass_32", "throughput_tph", "power_kw")

# gen_sweep.mjs of release 0.09.003 (git show origin/develop:data-pipeline/pipeline/sweep/gen_sweep.mjs), lines 41 to 47,
# RANGE: [css, throwMm, speed, x63, m, axb] per machine.
FROZEN_RANGE = {
    "cone-sec": [(6, 90), (16, 44), (180, 560), (40, 200), (0.7, 2.0), (30, 110)],
    "cone-tert": [(4, 22), (10, 26), (220, 600), (15, 55), (0.9, 2.0), (30, 110)],
    "jaw": [(50, 160), (24, 50), (180, 380), (180, 500), (0.7, 1.6), (35, 110)],
    "cone-short-head": [(4, 16), (10, 22), (380, 600), (15, 45), (0.9, 2.0), (30, 110)],
    "gyratory": [(120, 240), (22, 40), (100, 200), (300, 800), (0.7, 1.4), (30, 110)],
}


def _json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _graphs(slot: str, bundle: dict) -> list[dict]:
    return [bundle["graphs"]["float32"], bundle["graphs"]["int8"]] if slot == "surrogate-model" else [bundle["graph"]]


def _copy_tree(src_models: Path, tmp_path: Path) -> Path:
    """A copy of a models directory at ``<tmp>/derived/models`` (a bundle's graph paths are relative to derived)."""
    dst = tmp_path / "derived" / "models"
    shutil.copytree(src_models, dst)
    return dst


@pytest.fixture(scope="module")
def heldout_results():
    """The engine's results for the held-out draw, the one the committed metrics were computed on."""
    metrics = _json(METRICS)
    return sweep.label(sweep.draw(480, metrics["surrogate"]["test_seed"]))


# ---------------------------------------------------------------- the producer tests the catalog names

@pytest.mark.parametrize("root", sorted(MODEL_DIRS))
def test_surrogate_bundle_validates(root):
    bundle = _json(MODEL_DIRS[root] / "surrogate.json")
    assert errors("surrogate-model", bundle) == []
    assert len(bundle["in_mean"]) == len(bundle["input_order"]) == 6
    assert len(bundle["out_mean"]) == len(bundle["out_std"]) == len(bundle["output_order"]) == len(bundle["out_log"]) == 10
    assert all(s > 0 for s in bundle["in_std"] + bundle["out_std"])
    assert bundles.released_slots(MODEL_DIRS[root])["surrogate-model"] is True


@pytest.mark.parametrize("root", sorted(MODEL_DIRS))
def test_anomaly_bundle_validates(root):
    bundle = _json(MODEL_DIRS[root] / "psd-ae.json")
    assert errors("anomaly-model", bundle) == []
    assert len(bundle["mean"]) == len(bundle["std"]) == len(bundle["feature_order"]) == 14
    assert all(s > 0 for s in bundle["std"])
    assert bundles.released_slots(MODEL_DIRS[root])["anomaly-model"] is True


@pytest.mark.parametrize("root", sorted(MODEL_DIRS))
@pytest.mark.parametrize("slot", sorted(SLOTS))
def test_onnx_graphs_match_their_contract(root, slot):
    models = MODEL_DIRS[root]
    bundle = _json(models / SLOTS[slot])
    width_in, width_out = (11, 10) if slot == "surrogate-model" else (14, 14)
    for g in _graphs(slot, bundle):
        path = models.parent / g["path"]
        raw = path.read_bytes()
        assert len(raw) == g["bytes"] and hashlib.sha256(raw).hexdigest() == g["sha256"]
        assert g["opset"] >= 13
        sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        (i,), (o,) = sess.get_inputs(), sess.get_outputs()
        assert (i.name, o.name) == (g["input"], g["output"])
        assert i.type == o.type == "tensor(float)"
        assert len(i.shape) == 2 and i.shape[1] == width_in and o.shape[1] == width_out
        assert i.shape[0] in (1, "n") and o.shape[0] == i.shape[0]
        y = sess.run(None, {i.name: np.zeros((1, width_in), np.float32)})[0]
        assert y.shape == (1, width_out) and y.dtype == np.float32 and np.isfinite(y).all()


def test_metrics_validate(heldout_results):
    doc = _json(METRICS)
    assert errors("model-metrics", doc) == []
    surrogate = _json(BAKE / "surrogate.json")
    assert doc["engine_version"] == surrogate["engine_version"] == _json(BAKE / "psd-ae.json")["engine_version"]
    assert doc["surrogate"]["n_train"] == surrogate["training"]["n_train"]
    assert doc["surrogate"]["n_test"] == surrogate["training"]["n_test"] == len(heldout_results)
    # the numbers come from the SHIPPED graph through onnxruntime, not from torch: recompute one output's R2 from it
    sess = ort.InferenceSession(str(BAKE.parent / surrogate["graphs"]["float32"]["path"]), providers=["CPUExecutionProvider"])
    x = np.array([encode_input(r.op, surrogate["in_mean"], surrogate["in_std"]) for r in heldout_results], np.float32)
    z = sess.run(None, {"x": x})[0].astype(np.float64)
    j = surrogate["output_order"].index("p80_mm")
    pred = np.power(10.0, z[:, j] * surrogate["out_std"][j] + surrogate["out_mean"][j])
    truth = np.array([r.p80 for r in heldout_results])
    r2 = 1.0 - float(np.sum((pred - truth) ** 2)) / float(np.sum((truth - truth.mean()) ** 2))
    assert round(r2, 4) == doc["surrogate"]["per_output"]["p80_mm"]["r2"]
    assert doc["surrogate"]["parity"]["torch_vs_float32_max_abs"] < 1e-4
    assert doc["surrogate"]["p80_monotone_vs_css"] is True


@pytest.mark.parametrize("root", sorted(MODEL_DIRS))
def test_adversarial_swap_engine_baseline_and_surrogate(root, tmp_path):
    models = _copy_tree(MODEL_DIRS[root], tmp_path)
    assert bundles.released_slots(models)["surrogate-model"] is True
    truth = evaluate(CASE)
    value, provenance = bundles.surrogate_predict(CASE, models)
    assert provenance == "real" and set(value) == set(OUT_KEYS)
    assert value["p80_mm"] != truth.p80   # the network answered, not the engine
    assert abs(value["p80_mm"] / truth.p80 - 1) < 0.10
    assert abs(value["throughput_tph"] / truth.throughput_tph - 1) < 0.10
    # alter the bytes of the float32 graph: the slot is no longer released and the engine answers, exactly
    graph = models.parent / _json(models / "surrogate.json")["graphs"]["float32"]["path"]
    graph.write_bytes(graph.read_bytes() + b"\x00")
    assert bundles.released_slots(models)["surrogate-model"] is False
    assert bundles.released_slots(models)["anomaly-model"] is True   # the other slot is untouched
    value, provenance = bundles.surrogate_predict(CASE, models)
    assert provenance == "baseline"
    assert value == bundles.engine_outputs(truth)
    assert value["p80_mm"] == truth.p80 and value["power_kw"] == truth.power_kw


@pytest.mark.parametrize("root", sorted(MODEL_DIRS))
def test_adversarial_swap_int8_and_contract_also_release_the_slot(root, tmp_path):
    models = _copy_tree(MODEL_DIRS[root], tmp_path)
    int8 = models.parent / _json(models / "surrogate.json")["graphs"]["int8"]["path"]
    int8.write_bytes(b"not an onnx graph")
    assert bundles.released_slots(models)["surrogate-model"] is False
    models2 = _copy_tree(MODEL_DIRS[root], tmp_path / "b")
    (models2 / "surrogate.json").write_text("{", encoding="utf-8")
    assert bundles.released_slots(models2)["surrogate-model"] is False
    models3 = _copy_tree(MODEL_DIRS[root], tmp_path / "c")
    (models3 / "psd-ae.onnx").unlink()
    assert bundles.released_slots(models3) == {"surrogate-model": True, "anomaly-model": False}
    models4 = _copy_tree(MODEL_DIRS[root], tmp_path / "d")
    (models4 / "psd-ae.json").unlink()
    assert bundles.released_slots(models4)["anomaly-model"] is False


@pytest.mark.parametrize("root", sorted(MODEL_DIRS))
def test_adversarial_swap_envelope_baseline_and_autoencoder(root, tmp_path):
    models = _copy_tree(MODEL_DIRS[root], tmp_path)
    assert bundles.released_slots(models)["anomaly-model"] is True
    inside = evaluate(CASE)
    verdict, provenance = bundles.anomaly_score(inside, models)
    assert provenance == "real" and set(verdict) == {"score", "threshold", "is_anomaly"}
    assert verdict["score"] >= 0 and verdict["is_anomaly"] == (verdict["score"] > verdict["threshold"])
    assert verdict["is_anomaly"] is False
    # a point the envelope gate flags (CSS wider than the feed top: implausible)
    outside = evaluate(Operating("cone-sec", 200, 30, 360, 40, 1.2, 55, 14))
    assert outside.out_of_envelope is True
    graph = models.parent / _json(models / "psd-ae.json")["graph"]["path"]
    graph.write_bytes(graph.read_bytes()[:-1])
    assert bundles.released_slots(models)["anomaly-model"] is False
    for result in (inside, outside):
        verdict, provenance = bundles.anomaly_score(result, models)
        assert provenance == "baseline"
        assert verdict == {"is_anomaly": result.out_of_envelope}
    assert bundles.anomaly_score(outside, models)[0] == {"is_anomaly": True}


# ---------------------------------------------------------------- the sweep, the draws and the no-leak rule

def test_sweep_ranges_equal_the_node_script():
    assert set(sweep.RANGES) == set(FROZEN_RANGE) and tuple(sweep.RANGES) == sweep.MACHINES
    for machine, rows in FROZEN_RANGE.items():
        assert [sweep.RANGES[machine][k] for k in sweep.CONTINUOUS] == rows, machine


def test_sweep_ranges_equal_the_node_script_on_origin_develop():
    """The same numbers, read from the 0.09.003 generator in the repository history when it is available."""
    try:
        text = subprocess.run(["git", "show", "origin/develop:data-pipeline/pipeline/sweep/gen_sweep.mjs"], cwd=ROOT,
                              capture_output=True, text=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        pytest.skip("origin/develop is not available in this checkout; the frozen copy is checked above")
    import re
    found = {}
    for m in re.finditer(r"'([a-z-]+)':\s*\{ css: \[([^\]]+)\], throwMm: \[([^\]]+)\], speed: \[([^\]]+)\], x63: \[([^\]]+)\], "
                         r"m: \[([^\]]+)\], axb: \[([^\]]+)\] \}", text):
        found[m.group(1)] = [tuple(float(v) for v in g.split(",")) for g in m.groups()[1:]]
    assert found == {k: [tuple(float(v) for v in r) for r in rows] for k, rows in FROZEN_RANGE.items()}


def test_mulberry32_equals_the_node_generator():
    """Values printed by Node for gen_sweep.mjs's mulberry32 (seed 12345, first five; seed 67890, the 100001st)."""
    r = sweep.Mulberry32(12345)
    assert [r() for _ in range(5)] == [0.9797282677609473, 0.3067522644996643, 0.484205421525985, 0.817934412509203,
                                       0.5094283693470061]
    r = sweep.Mulberry32(67890)
    for _ in range(100000):
        r()
    assert r() == 0.8300018415320665


def test_draw_is_deterministic_inside_the_ranges_and_gives_the_wi_rule():
    a, b = sweep.draw(40, 7), sweep.draw(40, 7)
    assert a == b and len(a) == 5 * 40 and a != sweep.draw(40, 8)
    for op in a:
        for k in sweep.CONTINUOUS:
            lo, hi = sweep.RANGES[op.machine][k]
            assert lo <= getattr(op, k) <= hi
        assert op.ore_wi == max(8.0, min(20.0, 8.0 + (120.0 - op.ore_axb) * 0.09)) and not op.calibrated
    # Latin hypercube: one point per stratum in every continuous dimension of every machine
    for machine in sweep.MACHINES:
        pts = [p for p in a if p.machine == machine]
        for k in sweep.CONTINUOUS:
            lo, hi = sweep.RANGES[machine][k]
            cells = sorted(int((getattr(p, k) - lo) / (hi - lo) * 40) if getattr(p, k) < hi else 39 for p in pts)
            assert cells == list(range(40))


def test_the_draw_reproduces_the_0_09_003_counts():
    """Same generator and same physics: the Python engine keeps the 6430 of 7000 and 2196 of 2400 points that the
    TypeScript engine kept in release 0.09.003 (cz-sweep-meta.json, cz-sweep-test-meta.json)."""
    assert len(sweep.label(sweep.draw(1400, 12345))) == 6430
    assert len(sweep.label(sweep.draw(480, 67890))) == 2196


def test_train_and_test_draws_do_not_overlap():
    surrogate = _json(BAKE / "surrogate.json")
    metrics = _json(METRICS)
    train_seed, test_seed = surrogate["training"]["seed"], metrics["surrogate"]["test_seed"]
    assert train_seed != test_seed
    train = sweep.draw(1400, train_seed)
    test = sweep.draw(480, test_seed)
    key = lambda o: (o.machine, o.css_mm, o.throw_mm, o.speed_rpm, o.feed_x63_mm, o.feed_m, o.ore_axb)  # noqa: E731
    assert not ({key(o) for o in train} & {key(o) for o in test})
    # the held-out draw is not a split of the training draw: it is not a prefix, a suffix or a subsample of it
    assert [key(o) for o in train[:len(test)]] != [key(o) for o in test]
    sig = inspect.signature(evaluate_stage.run)
    assert sig.parameters["test_seed"].default == 67890 and sig.parameters["n_per_machine"].default == 480


def test_train_signature_is_the_interface():
    sig = inspect.signature(train_stage.run)
    assert list(sig.parameters)[:1] == ["models_dir"]
    assert sig.parameters["seed"].default == 12345 and sig.parameters["n_per_machine"].default == 1400
    assert sig.parameters["version"].kind is inspect.Parameter.KEYWORD_ONLY and sig.parameters["version"].default is inspect.Parameter.empty


# ---------------------------------------------------------------- the evaluate stage

def test_evaluate_reproduces_the_committed_metrics_byte_for_byte(tmp_path):
    version = _json(BAKE / "surrogate.json")["engine_version"]
    out = tmp_path / "model-metrics.json"
    doc = evaluate_stage.run(BAKE, out, version=version)
    assert out.read_bytes() == METRICS.read_bytes()
    assert doc == _json(METRICS)


def test_evaluate_refuses_a_slot_whose_bundle_is_invalid(tmp_path):
    models = _copy_tree(BAKE, tmp_path)
    graph = models / "surrogate.onnx"
    graph.write_bytes(graph.read_bytes() + b"\x00")
    with pytest.raises(ValueError, match="surrogate.json"):
        evaluate_stage.run(models, tmp_path / "m.json", version="0.10.000")
    assert not (tmp_path / "m.json").exists()
    models = _copy_tree(BAKE, tmp_path / "b")
    (models / "psd-ae.json").unlink()
    with pytest.raises(ValueError, match="psd-ae.json"):
        evaluate_stage.run(models, tmp_path / "m2.json", version="0.10.000")


def test_metrics_report_the_anomaly_comparison_and_the_planted_points():
    doc = _json(METRICS)["anomaly"]
    assert doc["n_planted"] > 100 and doc["n_heldout"] > 100
    assert 0 <= doc["false_alarm_rate"] <= 0.05   # the threshold is the 99th percentile of the training scores
    assert doc["detection_rate"] > doc["false_alarm_rate"]
    assert "training range" in doc["planted"] or "training bounds" in doc["planted"]
