"""The offline pipeline orchestrator + CLI (ADR-0057). Per case it applies CONTRACT 1, builds the compact per-case
trace from the REAL committed engine outputs (case-results.json) + the surrogate metrics, runs the lane gate, and
writes the manifest + a flat index (CONTRACT 2). The committed ONNX + metrics + case-results ARE the heavy lane's
real outputs, so the DEFAULT path is light (numpy/stdlib, no torch/node) and deterministic. `--retrain` first
regenerates those artifacts (Node sweep of the TS engine -> torch train) and re-bakes case-results.

    python -m chancalab.pipeline                # rebuild all replay traces + manifests from committed artifacts
    python -m chancalab.pipeline S01            # one case
    python -m chancalab.pipeline all --retrain  # node sweep + torch train, then rebuild
"""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

from . import registry
from .core.manifest import build_index
from .io.contract import validate_records
from .io.formats import read_json, write_json
from .stages import export

REPO_ROOT = Path(__file__).resolve().parents[2]
DERIVED = REPO_ROOT / "data" / "derived"
MANIFESTS = DERIVED / "manifests"
SWEEP_DIR = Path(__file__).resolve().parent / "sweep"

STAGES = ("preprocess", "feature_extraction", "train", "infer", "evaluate", "export")


def _load_artifacts() -> tuple[dict, dict]:
    need = ["case-results.json", "surrogate_metrics.json"]
    missing = [n for n in need if not (DERIVED / n).exists()]
    if missing:
        raise SystemExit(
            f"missing committed artifacts in {DERIVED}: {missing}. case-results.json is baked by the TS engine "
            f"(sweep/bake_cases.mjs); surrogate_metrics.json is the heavy lane's output — run --retrain to regenerate."
        )
    return read_json(DERIVED / "case-results.json"), read_json(DERIVED / "surrogate_metrics.json")


def _contract_flags() -> list[dict]:
    """Apply CONTRACT 1 to the 18 cases' operating points — proves the ingestion gate, carries flags (e.g. the
    pass-through / invalid controls)."""
    rows = [{"case_id": c.id, "machine": c.machine, "cssMm": c.cssMm, "throwMm": c.throwMm, "speedRpm": c.speedRpm,
             "feedX63Mm": c.feedX63Mm, "feedM": c.feedM, "oreAxb": c.oreAxb} for c in registry.list_cases()]
    rep = validate_records(rows)
    return rep.flagged


def precompute(case_id: str, seed: int = 42,
               artifacts: tuple[dict, dict] | None = None, flags: list[dict] | None = None) -> dict:
    case = registry.get_case(case_id)
    case_results, surrogate_metrics = artifacts if artifacts is not None else _load_artifacts()
    return export.build_replay(
        case, derived_dir=str(DERIVED), manifests_dir=str(MANIFESTS),
        case_results=case_results, surrogate_metrics=surrogate_metrics,
        contract_flags=(flags if flags is not None else _contract_flags()), seed=seed,
    )


def _node(*args: str) -> None:
    subprocess.run(["node", "--import", "tsx", *args], check=True, cwd=str(REPO_ROOT))


def retrain(seed: int = 42) -> None:
    """HEAVY lane: Node sweep (the TS engine) -> torch train -> export ONNX/metrics; re-bake case-results."""
    from .stages import evaluate, infer, preprocess, train

    print("[retrain] node sweep (train + held-out test) ...", flush=True)
    _node(str(SWEEP_DIR / "gen_sweep.mjs"), "12345", "cz-sweep", "1400")
    _node(str(SWEEP_DIR / "gen_sweep.mjs"), "67890", "cz-sweep-test", "480")
    pre = preprocess.run(str(SWEEP_DIR))
    print(f"  {pre['report'].summary()}; train {len(pre['train'])} | test {len(pre['test'])}", flush=True)
    tout = train.run(pre["train"])
    tout["nTrain"] = len(pre["train"])
    pred = infer.run(tout, pre["test"])
    metrics, scalers = evaluate.run(tout, pre["test"], pred)
    export.export_models(train_out=tout, eval_metrics=metrics, scalers=scalers, derived_dir=str(DERIVED))
    print("[retrain] re-bake case-results (TS engine over the 18 cases) ...", flush=True)
    _node(str(SWEEP_DIR / "bake_cases.mjs"))
    print(f"[retrain] wrote ONNX + scalers + metrics + case-results -> {DERIVED}", flush=True)


def run_all(seed: int = 42) -> list[dict]:
    artifacts = _load_artifacts()
    flags = _contract_flags()
    entries = []
    for c in registry.list_cases():
        precompute(c.id, seed=seed, artifacts=artifacts, flags=flags)
        entries.append({"case_id": c.id, "category": c.category, "stage": c.stage,
                        "manifest_path": f"manifests/{c.id}.json"})
    write_json(MANIFESTS / "index.json", build_index(entries))
    return entries


def main() -> None:
    ap = argparse.ArgumentParser(prog="chancalab.pipeline")
    ap.add_argument("case", nargs="?", default="all", help="a case id, or 'all'")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--retrain", action="store_true",
                    help="regenerate the ONNX/metrics/case-results (Node sweep + torch) before rebuilding the replay")
    args = ap.parse_args()
    if args.retrain:
        retrain(args.seed)
    if args.case == "all":
        entries = run_all(args.seed)
        print(f"precomputed {len(entries)} cases -> {DERIVED}")
        for e in entries:
            print(f"  {e['case_id']:6s} [{e['category']}]")
        print(f"index -> {MANIFESTS / 'index.json'}")
    else:
        m = precompute(args.case, args.seed)
        print(f"precomputed {args.case}: lane={m['lane']} bytes={m['artifact']['bytes']} "
              f"metrics={m['metrics']} -> {DERIVED / m['artifact']['path']}")


if __name__ == "__main__":
    main()
