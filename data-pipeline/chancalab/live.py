"""LIVE lane entrypoint — DORMANT for ChancaDEM.

The archetype's reference live lane is Pyodide running this module in the browser. ChancaDEM instead implements its
live lane as the pure-TypeScript Whiten/Evertsson/Bond engine (frontend/src/physics/*) + onnxruntime-web running the
EXPORTED surrogate/AE ONNX directly in the browser — explicitly permitted by the archetype ("Pyodide + lightweight
wheels, OR a small TS engine"). That path is the same physics the offline sweep uses, so this Pyodide entrypoint is
present-but-dormant; the gate (core/gate.py) still classifies each case's lane."""
from __future__ import annotations


def run_trace_json(*_args, **_kwargs):  # pragma: no cover - dormant
    raise NotImplementedError(
        "ChancaDEM's live lane is the TS Whiten engine + onnxruntime-web (frontend/), not Pyodide. This entrypoint is dormant."
    )
