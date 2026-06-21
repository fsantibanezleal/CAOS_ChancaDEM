"""The compact per-case TRACE = the web-replay artifact. Part of CONTRACT 2: its shape is mirrored by
frontend/src/lib/contract.types.ts, so a drift fails the web build. Each trace is built deterministically from the
REAL committed engine outputs (case-results.json, produced by the SAME TS Whiten engine the browser runs) + the
surrogate's held-out metrics (surrogate_metrics.json). It references the shared ONNX, never copies them."""
from __future__ import annotations

from typing import Any

TRACE_SCHEMA = "chancadem.trace/v1"


def build_trace(case: Any, *, case_result: dict, surrogate_metrics: dict) -> dict:
    op = {k: getattr(case, k) for k in ("machine", "cssMm", "throwMm", "speedRpm", "feedX63Mm", "feedM", "oreAxb", "oreWi")}
    return {
        "schema": TRACE_SCHEMA,
        "case_id": case.id,
        "category": case.category,
        "stage": case.stage,
        "control": case.control,
        "real_or_synthetic": case.real_or_synthetic,
        "expected_band": case.expected_band,
        "operating": op,
        "result": {
            "p80": case_result["p80"], "p50": case_result["p50"], "p20": case_result["p20"],
            "pctPassing": case_result["pctPassing"],
            "tph": case_result["tph"], "kW": case_result["kW"],
            "reduction": case_result["reduction"], "ecs": case_result["ecs"],
            "regime": case_result["regime"], "valid": case_result["valid"],
        },
        # the learned-tier accuracy this engine is emulated by (held-out, global) — referenced, not recomputed
        "surrogate": {
            "p80": surrogate_metrics["perOutput"].get("p80"),
            "tph": surrogate_metrics["perOutput"].get("tph"),
            "kW": surrogate_metrics["perOutput"].get("kW"),
            "p80MonotoneVsCss": surrogate_metrics.get("p80MonotoneVsCss"),
        },
    }
