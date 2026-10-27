"""CONTRACT 2, artifact (pipeline -> web). The manifest is the authoritative, versioned record of a baked case: its
operating point, seed, engine and version, the trace pointer with its byte size and sha256, the measured lane/gate
verdict, the flags as stable codes, the result metrics, which model answered per slot, the expected ranges and the case
context. The web loads ONLY manifests, traces and the files the index lists; frontend/src/lib/contract.gen.ts is
generated from the schemas, so a drift fails the build. A flat index.json inventories every case and the further files.
"""
from __future__ import annotations

from typing import Any

from .. import __version__
from ..model.crusher import CrusherResult, Operating
from .trace import TRACE_SCHEMA

MANIFEST_SCHEMA = "chancadem.manifest/v1"
INDEX_SCHEMA = "chancadem.index/v1"
ENGINE_MODEL = ("Whiten population balance with Andersen classification, JKMRC t10 and Austin appearance breakage, "
                "Evertsson capacity and Bond power")
CALIBRATED_NOTE = " (HP500 calibration of Rocha et al. 2024)"

# the engine's flag texts to the stable codes of the manifest schema (the envelope codes are already codes)
FLAG_CODES = {
    "CSS ≥ feed top size, nothing is gripped": "css_ge_feed_top",
    "CSS ≥ F80, little size reduction (pass-through regime)": "pass_through",
    "reduction ratio ≈ 1, negligible breakage": "negligible_reduction",
    "ill-conditioned breakage matrix near choke": "ill_conditioned",
}


def flag_codes(r: CrusherResult) -> list[str]:
    """The stable codes of the engine's flags and envelope codes, in the engine's order."""
    out: list[str] = []
    for f in r.flags:
        code = FLAG_CODES.get(f, f)
        if code not in out:
            out.append(code)
    return out


def build_case_manifest(
    *,
    case: Any,
    op: Operating,
    seed: int,
    artifact_rel: str,
    trace_bytes: int,
    trace_sha256: str,
    gate: dict,
    flags: list[str],
    metrics: dict,
    models: dict[str, str],
    expect: dict,
) -> dict:
    # Deterministic: a pure function of (operating point, seed). No wall-clock here (it would dirty git on re-run); the
    # lane verdict and the budgets carry the lane decision, the measured time is judged and not stored.
    doc = {
        "schema": MANIFEST_SCHEMA,
        "case_id": case.id,
        "title": case.title,
        "category": case.category,
        "stage": case.stage,
        "control": case.control,
        "real_or_synthetic": case.real_or_synthetic,
        "expected_band": case.expected_band,
        "context": case.context,
        "engine": {"package": "pipeline.model.crusher", "version": __version__,
                   "model": ENGINE_MODEL + (CALIBRATED_NOTE if op.calibrated else "")},
        "params": {"machine": op.machine, "css_mm": float(op.css_mm), "throw_mm": float(op.throw_mm),
                   "speed_rpm": float(op.speed_rpm), "feed_x63_mm": float(op.feed_x63_mm),
                   "feed_m": float(op.feed_m), "ore_axb": float(op.ore_axb), "ore_wi": float(op.ore_wi),
                   "calibrated": op.calibrated},
        "seed": seed,
        "artifact": {"path": artifact_rel, "format": "json", "trace_schema": TRACE_SCHEMA, "bytes": trace_bytes,
                     "sha256": trace_sha256},
        "lane": gate["lane"],
        "gate": gate,
        "flags": flags,
        "metrics": metrics,
        "models": models,  # per model slot: "real" (the released bundle) or "baseline" answered
        "expect": expect,
        "source": case.source,
    }
    if case.measured is not None:
        doc["measured"] = case.measured
    return doc


def index_entry(case: Any) -> dict:
    return {"case_id": case.id, "title": case.title, "category": case.category,
            "real_or_synthetic": case.real_or_synthetic, "manifest_path": f"manifests/{case.id}.json"}


def build_index(entries: list[dict], default_case: str, files: list[str]) -> dict:
    """entries: [{case_id, title, category, real_or_synthetic, manifest_path}] -> the flat authoritative inventory, with the
    case the App opens on and the further files the site serves."""
    if default_case not in {e["case_id"] for e in entries}:
        raise ValueError(f"default case {default_case!r} is not among the baked cases")
    return {
        "schema": INDEX_SCHEMA,
        "engine_version": __version__,
        "n_cases": len(entries),
        "default_case": default_case,
        "cases": sorted(entries, key=lambda e: e["case_id"]),
        "files": list(files),
    }
