"""CONTRACT 2 — artifact (pipeline -> web). The manifest is the authoritative, versioned record of a baked case:
its category/stage, seed, engine+version, the shared learned-tier artifacts, the compact per-case trace pointer +
byte size, the lane/gate verdict, the CONTRACT-1 flags, and the case metrics. The web loads ONLY manifests + traces
+ the shared artifacts; frontend/src/lib/contract.types.ts mirrors this schema so a drift fails the build. The
committed ONNX + metrics ARE the heavy lane's real outputs; the manifest records that provenance honestly."""
from __future__ import annotations

from typing import Any

from .. import __version__
from .trace import TRACE_SCHEMA

MANIFEST_SCHEMA = "chancadem.manifest/v2"
INDEX_SCHEMA = "chancadem.index/v1"

ENGINE_NOTE = ("Whiten population balance + Evertsson capacity + Bond power (pure-TS, runs live); a surrogate MLP "
               "emulates that engine, a denoising AE scores operating anomaly/OOD. The surrogate is held-out vs an "
               "independent 2nd LHS draw of the engine (NOT a real plant); the engine itself is calibrated to "
               "published cone data (Duarte et al. 2021).")
HONESTY = ("The physics engine is the source of truth and the surrogate emulates IT (not a real plant). The 3D "
           "chamber is a kinematic animation; the offline 2-D DEM tracer is the documented next increment. "
           "Negative/invalid controls (pass-through, CSS>feed-top) must show ~zero reduction / flag invalidity.")


def shared_artifacts() -> dict:
    return {
        "models": [
            {"id": "surrogate", "file": "models/surrogate.onnx", "opset": 17, "input": [1, 11]},
            {"id": "psd_ae", "file": "models/psd-ae.onnx", "opset": 17, "input": [1, 14]},
        ],
        "scaler": "scaler.json",
        "ae_scaler": "ae_scaler.json",
        "ae_threshold": "ae_threshold.json",
        "surrogate_metrics": "surrogate_metrics.json",
    }


def build_case_manifest(*, case: Any, seed: int, artifact_rel: str, trace_bytes: int,
                        gate: dict, flags: list[dict], metrics: dict) -> dict:
    return {
        "schema": MANIFEST_SCHEMA,
        "case_id": case.id,
        "name": case.name,
        "category": case.category,
        "stage": case.stage,
        "control": case.control,
        "machine": case.machine,
        "real_or_synthetic": case.real_or_synthetic,
        "expected_band": case.expected_band,
        "validation_anchor": case.validation_anchor,
        "engine": {"package": "chancalab", "version": __version__, "model": ENGINE_NOTE},
        "seed": seed,
        "shared": shared_artifacts(),
        "artifact": {"path": artifact_rel, "format": "json", "trace_schema": TRACE_SCHEMA, "bytes": trace_bytes},
        "lane": gate["lane"],
        "gate": gate,
        "flags": flags,
        "metrics": metrics,
        "honesty": HONESTY,
    }


def build_index(entries: list[dict]) -> dict:
    return {
        "schema": INDEX_SCHEMA,
        "engine_version": __version__,
        "n_cases": len(entries),
        "cases": sorted(entries, key=lambda e: e["case_id"]),
    }
