"""CONTRACT 2 (artifact) tests: the manifest points to a real artifact with the recorded byte size and sha256, the lane
verdict is the gate's, the flags are stable codes and the models record which slot answered."""
from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

import pytest
from pipeline import pipeline
from pipeline.core import gate

ROOT = Path(__file__).resolve().parents[1]


def test_manifest_matches_artifact_and_gate() -> None:
    m = pipeline.precompute("S01", seed=7)
    artifact = pipeline.DERIVED / m["artifact"]["path"]
    raw = artifact.read_bytes()
    assert len(raw) == m["artifact"]["bytes"] and hashlib.sha256(raw).hexdigest() == m["artifact"]["sha256"]
    assert m["schema"] == "chancadem.manifest/v1" and m["seed"] == 7
    assert m["gate"]["lane"] == m["lane"] == "live"      # the engine is pure Python and light: it is live
    assert m["gate"]["run_ms_budget"] == gate.RUN_MS_GATE == 1500.0 and m["gate"]["trace_bytes_budget"] == gate.TRACE_BYTES_GATE == 262144
    assert m["gate"]["wheels"] == [] and m["gate"]["pure_python"] is True and m["gate"]["trace_bytes"] == len(raw)
    assert '"run_ms"' not in json.dumps(m)                  # judged, never stored


def test_every_case_is_live_whatever_its_place_in_the_bake(tmp_path: Path) -> None:
    # the lane gate times the engine alone, warmed up; the first case baked is judged like the others
    entries = pipeline.run_all(output_root=tmp_path / "derived")
    lanes = {e["case_id"]: json.loads((tmp_path / "derived" / e["manifest_path"]).read_text(encoding="utf-8"))["lane"] for e in entries}
    assert all(v == "live" for v in lanes.values()), [k for k, v in lanes.items() if v != "live"]


def test_the_lane_follows_the_gate_budgets(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """A slow engine run (over the time budget) makes the case precompute, with the reason; the time is not stored."""
    monkeypatch.setattr(pipeline, "_engine_ms", lambda op, repeats=5: gate.RUN_MS_GATE + 1.0)
    m = pipeline.precompute("S01", output_root=tmp_path / "slow")
    assert m["lane"] == m["gate"]["lane"] == "precompute" and m["gate"]["reasons"]
    assert str(gate.RUN_MS_GATE + 1.0) not in json.dumps(m)


def test_flags_are_stable_codes_and_models_record_the_baseline_without_bundles(tmp_path: Path) -> None:
    m = pipeline.precompute("CI1", output_root=tmp_path / "ci1")
    assert m["flags"][:2] == ["css_ge_feed_top", "f80_lt_css"] or {"css_ge_feed_top", "f80_lt_css"} <= set(m["flags"])
    assert all(f.isascii() and " " not in f for f in m["flags"])
    assert m["models"] == {"surrogate-model": "baseline", "anomaly-model": "baseline"}     # nothing released in a bare sandbox


def test_models_record_real_when_the_released_bundles_are_in_the_sandbox(tmp_path: Path) -> None:
    out = tmp_path / "with-models"
    shutil.copytree(ROOT / "data" / "derived" / "models", out / "models")
    m = pipeline.precompute("S01", output_root=out)
    assert m["models"] == {"surrogate-model": "real", "anomaly-model": "real"}


def test_an_invalid_slot_is_recorded_as_baseline(tmp_path: Path) -> None:
    out = tmp_path / "broken"
    shutil.copytree(ROOT / "data" / "derived" / "models", out / "models")
    graph = out / "models" / "psd-ae.onnx"
    graph.write_bytes(graph.read_bytes() + b"\x00")       # the sha256 and the byte size no longer match
    m = pipeline.precompute("S01", output_root=out)
    assert m["models"] == {"surrogate-model": "real", "anomaly-model": "baseline"}


def test_a_real_case_carries_the_survey_and_its_errors(tmp_path: Path) -> None:
    m = pipeline.precompute("HP500-01", output_root=tmp_path / "hp")
    assert m["real_or_synthetic"] == "real" and m["params"]["calibrated"] is True
    assert m["measured"] == {"survey": 1, "f80_mm": 88.0, "css_mm": 54.0, "feed_tph": 1639.0, "power_kw": 209.0}
    assert {"throughput_err_pct", "power_err_pct"} <= set(m["metrics"]) and m["source"]["kind"] == "publication"
    assert "measured" not in pipeline.precompute("S01", output_root=tmp_path / "s")


def test_an_unknown_case_is_named(tmp_path: Path) -> None:
    with pytest.raises(KeyError, match="NOPE"):
        pipeline.precompute("NOPE", output_root=tmp_path / "x")
