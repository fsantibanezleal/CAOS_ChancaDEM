"""Stage 6 — export (CONTRACT 2). Two paths:

* build_replay (LIGHT, numpy/stdlib): the default pipeline path. Builds the compact per-case trace from the REAL
  committed engine outputs (case-results.json, produced by the SAME TS engine the browser runs) + the surrogate's
  held-out metrics, runs the lane gate, and writes the manifest. No torch/node — so the contract + replay regenerate
  deterministically anywhere, and CI stays fast.
* export_models (HEAVY, torch): the --retrain path. Writes surrogate.onnx + psd-ae.onnx (opset 17, dynamic batch),
  the frozen scalers, and surrogate_metrics.json — the artifacts the LIGHT path then consumes.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from ..core.gate import classify_lane
from ..core.manifest import build_case_manifest
from ..core.trace import build_trace
from ..io.formats import write_json

_RUN_MS = 8.0   # deterministic Whiten-solve + ONNX-forward budget for the gate DECISION (not a measured wall-clock)
_RUNTIMES = {"ts-engine", "onnxruntime-web"}


def build_replay(case: Any, *, derived_dir: str, manifests_dir: str,
                 case_results: dict, surrogate_metrics: dict, contract_flags: list[dict], seed: int) -> dict:
    cr = case_results["cases"][case.id]
    trace = build_trace(case, case_result=cr, surrogate_metrics=surrogate_metrics)
    artifact_rel = f"{case.id}/trace.json"
    trace_bytes = write_json(Path(derived_dir) / artifact_rel, trace)
    gate = classify_lane(client_side=True, runtimes=_RUNTIMES, run_ms=_RUN_MS, trace_bytes=trace_bytes)
    metrics = {"p80": cr["p80"], "tph": cr["tph"], "kW": cr["kW"], "reduction": cr["reduction"]}
    manifest = build_case_manifest(
        case=case, seed=seed, artifact_rel=artifact_rel, trace_bytes=trace_bytes,
        gate=gate, flags=contract_flags, metrics=metrics,
    )
    write_json(Path(manifests_dir) / f"{case.id}.json", manifest)
    return manifest


def export_models(*, train_out: dict, eval_metrics: dict, scalers: dict, derived_dir: str) -> None:
    """HEAVY: write the ONNX models + the frozen scalers + the learned-metrics JSON."""
    import json

    import torch

    from ..model.psd_ae import N_FEAT
    from ..model.surrogate import NIN

    derived = Path(derived_dir)
    (derived / "models").mkdir(parents=True, exist_ok=True)
    sur, ae = train_out["surrogate"], train_out["ae"]

    import os
    os.environ["PYTHONIOENCODING"] = "utf-8"
    torch.onnx.export(sur, torch.zeros(2, NIN), str(derived / "models" / "surrogate.onnx"), dynamo=False,
                      input_names=["x"], output_names=["y"], dynamic_axes={"x": {0: "n"}, "y": {0: "n"}}, opset_version=17)
    torch.onnx.export(ae, torch.zeros(2, N_FEAT), str(derived / "models" / "psd-ae.onnx"), dynamo=False,
                      input_names=["x"], output_names=["xr"], dynamic_axes={"x": {0: "n"}, "xr": {0: "n"}}, opset_version=17)

    (derived / "scaler.json").write_text(json.dumps(scalers["scaler"], indent=0), encoding="utf-8")
    (derived / "ae_scaler.json").write_text(json.dumps(scalers["ae_scaler"], indent=0), encoding="utf-8")
    (derived / "ae_threshold.json").write_text(json.dumps(scalers["ae_threshold"], indent=0), encoding="utf-8")
    (derived / "surrogate_metrics.json").write_text(json.dumps(eval_metrics, indent=2), encoding="utf-8")
