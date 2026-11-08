#!/usr/bin/env python3
"""ChancaDEM's readiness provider (scripts/local/workflow.json ``readiness_provider``; docs/guides/09_research-admission.md).

``validate(root)`` judges the tree at ``root`` by the product's own rules and never writes. What is judged comes from
``root``: its catalog (``docs/contracts/catalog.md``), its ``VERSION``, its two source tables (``data/examples/params.csv``
and ``data/examples/hp500-surveys.csv``) and its baked documents (``data/derived``), the same inputs the default path of
``scripts/check_readiness.py`` judges, so a checkout, a copy and a generation stage (which holds the catalog, VERSION and
the authored inputs) are judged alike. The rules come from this checkout: only the ``data-pipeline`` package beside this
script is imported, never code under ``root``. Two conditions:

1. the readiness document ``root/data/derived/readiness.json`` is, byte for byte, the one ``pipeline.core.readiness``
   computes from ``root``'s catalog, VERSION and source tables over that tree; a catalog the rules refuse (a status other
   than ``real`` or ``active``) is a refusal naming the row and the statuses allowed;
2. the case index lists each case ``root``'s two source tables bake exactly once and nothing else: the circuit cases of the
   registry whose params row is accepted (all of them without a params table) and one case per accepted HP500 survey.
   The readiness rules do not check this inventory, so a fresh readiness document cannot hide a case dropped from a bake.

A refusal raises ``ValueError`` naming each difference and the command that regenerates the tree. The rules need
jsonschema (``pipeline.model.bundles`` judges the model slots); numpy is never imported on this path, so the check runs
in CI without the pipeline's numerical dependencies (tests/contracts/test_readiness.py).

Usage: python scripts/local/readiness_provider.py [root]   (exit 0 current, 1 refused)"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
FIX = "python data-pipeline/run.py readiness (the checkout), or a new bake: scripts/local/02_generate-data"


def differences(fresh: dict, committed: dict) -> list[str]:
    out = []
    for key in ("schema", "product_version", "catalog_sha256"):
        if fresh.get(key) != committed.get(key):
            out.append(f"{key}: committed {committed.get(key)!r}, computed {fresh.get(key)!r}")
    old = {e.get("id"): e for e in committed.get("contracts", []) if isinstance(e, dict)}
    new = {e["id"]: e for e in fresh["contracts"]}
    for rid in sorted(old.keys() | new.keys(), key=str):
        if rid not in new:
            out.append(f"contracts/{rid}: committed, but not a catalog row")
        elif rid not in old:
            out.append(f"contracts/{rid}: a catalog row, but not committed")
        elif old[rid] != new[rid]:
            fields = sorted(k for k in old[rid].keys() | new[rid].keys() if old[rid].get(k) != new[rid].get(k))
            out.append(f"contracts/{rid}: {', '.join(fields)} differ (committed state {old[rid].get('state')!r}, "
                       f"computed {new[rid]['state']!r})")
    if not out and [e.get("id") for e in committed.get("contracts", []) if isinstance(e, dict)] != list(new):
        out.append("contracts: the order differs from the catalog's")
    return out


PARAMS_REL = Path("data") / "examples" / "params.csv"
SURVEYS_REL = Path("data") / "examples" / "hp500-surveys.csv"


def baked_case_ids(root: Path) -> list[str]:
    """The cases ``run.py all`` bakes from ``root``'s two source tables (pipeline.pipeline.load_inputs, without the
    engine: the ids only)."""
    sys.path.insert(0, str(REPO / "data-pipeline"))
    from pipeline import registry
    from pipeline.cases import hp500_cases
    from pipeline.hp500 import surveys as survey_contract
    from pipeline.stages import preprocess

    params_csv, surveys_csv = root / PARAMS_REL, root / SURVEYS_REL
    circuit = registry.circuit_cases()
    if params_csv.is_file():
        accepted = {row.case_id for row in preprocess.run(params_csv).accepted}
        ids = [case.id for case in circuit if case.id in accepted]
    else:
        ids = [case.id for case in circuit]
    surveys = survey_contract.read_surveys(surveys_csv).accepted if surveys_csv.is_file() else []
    return ids + [case.id for case in hp500_cases.build(surveys)]


def problems(root: Path) -> list[str]:
    sys.path.insert(0, str(REPO / "data-pipeline"))
    from pipeline.core import readiness

    derived = root / "data" / "derived"
    path = derived / "readiness.json"
    out: list[str] = []
    # computed first, as the default check does: a catalog the rules refuse is named before anything else
    try:
        fresh = readiness.compute(repo_root=root, derived_root=derived, models_dir=derived / "models",
                                  params_csv=root / PARAMS_REL, surveys_csv=root / SURVEYS_REL)
    except ValueError as exc:   # a catalog the rules do not accept: nothing can be published from it
        raise ValueError(f"readiness: invalid catalog\n  {exc}\n  allowed statuses: 'real' (the real producer) or "
                         f"'active' (served by its provider)") from None
    if not path.is_file():
        out.append(f"{path} is absent")
    else:
        committed_bytes = path.read_bytes()
        try:
            committed = json.loads(committed_bytes.decode("utf-8"))
        except ValueError as exc:
            committed = None
            out.append(f"{path} is not JSON: {exc}")
        if committed is not None:
            diffs = differences(fresh, committed)
            expected = json.dumps(fresh, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
            if not diffs and committed_bytes != expected:
                diffs = ["bytes: same content, different serialisation"]
            out.extend(diffs)
    index_path = derived / "manifests" / "index.json"
    if not index_path.is_file():
        out.append(f"{index_path} is absent")
    else:
        listed = [row.get("case_id") for row in json.loads(index_path.read_text(encoding="utf-8")).get("cases", [])]
        baked = baked_case_ids(root)
        if len(listed) != len(set(listed)):
            out.append("case index: a case is listed more than once")
        if set(listed) != set(baked):
            out.append(f"case index: lists {sorted(set(listed) - set(baked), key=str)} the source tables do not bake and "
                       f"misses {sorted(set(baked) - set(listed))}")
    return out


def validate(root) -> None:
    found = problems(Path(root).resolve())
    if found:
        raise ValueError("readiness: stale\n  " + "\n  ".join(found) + f"\n  fix: {FIX}")


def main() -> int:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO
    try:
        validate(root)
    except Exception as exc:  # a refusal is reported, never a traceback
        print(exc)
        return 1
    print("readiness: current")
    return 0


if __name__ == "__main__":
    sys.exit(main())
