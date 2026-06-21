"""CONTRACT 2 (artifact) tests: a manifest points to a real trace with the recorded byte size, the lane verdict is
consistent with the gate, and the schema is the ChancaDEM one. Uses the committed case-results (no torch/node)."""
from chancalab import pipeline


def test_manifest_matches_artifact_and_gate():
    m = pipeline.precompute("S01", seed=7)
    artifact = pipeline.DERIVED / m["artifact"]["path"]
    assert artifact.exists(), "manifest points to a non-existent trace"
    assert artifact.stat().st_size == m["artifact"]["bytes"], "manifest byte size drifted from the trace"
    assert m["schema"].startswith("chancadem.manifest/")
    assert m["lane"] == m["gate"]["lane"]
    # the Whiten solve + ONNX forward are client-side + tiny => must be classified LIVE
    assert m["lane"] == "live", f"expected live lane, got {m['lane']} ({m['gate']['reasons']})"
    assert m["machine"] == "cone-sec"


def test_control_case_trace():
    import json

    m = pipeline.precompute("CP1", seed=7)
    trace = json.loads((pipeline.DERIVED / m["artifact"]["path"]).read_text(encoding="utf-8"))
    assert trace["control"] == "negative"
    # the pass-through control must show ~no reduction, not a pretty plot
    assert trace["result"]["reduction"] < 1.5
