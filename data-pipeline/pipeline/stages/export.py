"""Stage 3, export (CONTRACT 2): write the compact trace artifact and the case manifest. The manifest records the
measured lane/gate verdict, the artifact byte size and sha256, the flags, the metrics and which model answered."""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from ..core.gate import classify_lane
from ..core.manifest import build_case_manifest
from ..core.trace import build_trace
from ..io.formats import write_json
from ..model.crusher import CrusherResult


def run(
    *,
    case: Any,
    result: CrusherResult,
    seed: int,
    run_ms: float,
    flags: list[str],
    metrics: dict,
    models: dict[str, str],
    expect: dict,
    derived_dir: str,
    manifests_dir: str,
) -> dict:
    trace = build_trace(case.id, case.op, result)
    artifact_rel = f"{case.id}/trace.json"
    path = Path(derived_dir) / artifact_rel
    trace_bytes = write_json(path, trace)
    sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
    gate = classify_lane(pure_python=True, wheels=set(), run_ms=run_ms, trace_bytes=trace_bytes)
    manifest = build_case_manifest(
        case=case, op=case.op, seed=seed, artifact_rel=artifact_rel, trace_bytes=trace_bytes, trace_sha256=sha256,
        gate=gate, flags=flags, metrics=metrics, models=models, expect=expect)
    write_json(Path(manifests_dir) / f"{case.id}.json", manifest)
    return manifest
