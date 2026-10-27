"""Validate CONTRACT 2 and CONTRACT 3 on disk (the pipeline -> web artifact contract) for ChancaDEM.

For every case of the index: the manifest exists; the trace it names exists, is non-empty, and its byte size and sha256
match the manifest; the lane equals the lane the gate's budgets give (the measured engine time is judged in the bake and
not stored, so the check recomputes what the stored numbers decide); every metric lies inside the case's expected range;
and the units gate (CONTRACT 3, core/unit_gate.py) holds over the shipped metrics, so a cell baked before the gate existed
cannot survive. The files the index lists must exist. A declared-partial bake builds: an absent manifest, trace or file is
a warning only when readiness.json lists it in the ``missing`` of a ``partial`` row.

Standard library plus the pipeline's pure-Python modules (no numpy): runs in CI without installing the product.
Exit non-zero on any drift. Usage: python scripts/check_artifacts.py [repo_root]"""
from __future__ import annotations

import csv
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE / "data-pipeline"))

from pipeline.core import unit_gate  # noqa: E402
from pipeline.core.gate import RUN_MS_GATE, TRACE_BYTES_GATE  # noqa: E402

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else HERE
DERIVED = ROOT / "data" / "derived"
MANIFESTS = DERIVED / "manifests"
SURVEYS = ROOT / "data" / "examples" / "hp500-surveys.csv"


def declared_absent() -> set[str]:
    """The paths the readiness document declares absent: the ``missing`` of every row whose state is ``partial``
    (catalog, Missing-data states). Empty when the document is absent or unreadable: nothing is tolerated then."""
    try:
        rows = json.loads((DERIVED / "readiness.json").read_text(encoding="utf-8")).get("contracts", [])
        return {m for r in rows if isinstance(r, dict) and r.get("state") == "partial"
                for m in r.get("missing", []) if isinstance(m, str)}
    except (OSError, ValueError, AttributeError):
        return set()


def read_surveys(path: Path) -> list[dict]:
    try:
        with path.open(newline="", encoding="utf-8-sig") as fh:
            return [{k: float(v) for k, v in row.items()} for row in csv.DictReader(fh)]
    except (OSError, ValueError):
        return []


def survey_rows(manifests: list[dict]) -> list[dict]:
    """The measured surveys the units gate takes its ranges from: the ten published surveys. Those of this tree's survey
    table, completed by the repository's own table for a survey number the tree does not have (the provider tree carries a
    two-row sample), and the surveys the real manifests carry when there is no table at all."""
    rows = {int(r["survey"]): r for r in read_surveys(HERE / "data" / "examples" / "hp500-surveys.csv")}
    rows.update({int(r["survey"]): r for r in read_surveys(SURVEYS)})
    if not rows:
        rows = {int(m["measured"]["survey"]): m["measured"] for m in manifests if isinstance(m.get("measured"), dict)}
    return [rows[k] for k in sorted(rows)]


def lane_errors(case_id: str, m: dict, size: int) -> list[str]:
    """The lane must be what the gate's stored numbers decide (core/gate.py classify_lane, without the unstored time)."""
    gate = m.get("gate") or {}
    errs = []
    if gate.get("run_ms_budget") != RUN_MS_GATE or gate.get("trace_bytes_budget") != TRACE_BYTES_GATE:
        errs.append(f"{case_id}: the gate budgets {gate.get('run_ms_budget')}/{gate.get('trace_bytes_budget')} are not the "
                    f"gate's {RUN_MS_GATE}/{TRACE_BYTES_GATE}")
    if gate.get("trace_bytes") != size:
        errs.append(f"{case_id}: gate.trace_bytes {gate.get('trace_bytes')} differs from the file size {size}")
    must_precompute = (not gate.get("pure_python", False)) or bool(set(gate.get("wheels", [])) - {"numpy"}) or size > TRACE_BYTES_GATE
    if must_precompute and gate.get("lane") != "precompute":
        errs.append(f"{case_id}: the stored numbers decide precompute, the gate says {gate.get('lane')}")
    if gate.get("lane") == "live" and gate.get("reasons"):
        errs.append(f"{case_id}: lane live with reasons {gate.get('reasons')}")
    if gate.get("lane") == "precompute" and not gate.get("reasons"):
        errs.append(f"{case_id}: lane precompute without a reason")
    if m.get("lane") != gate.get("lane"):
        errs.append(f"lane/gate mismatch: {case_id}: lane {m.get('lane')!r}, gate.lane {gate.get('lane')!r}")
    return errs


def main() -> int:
    idx_path = MANIFESTS / "index.json"
    if not idx_path.exists():
        print(f"FAIL: missing {idx_path} (run scripts/precompute.sh first)")
        return 1
    index = json.loads(idx_path.read_text(encoding="utf-8"))
    errs: list[str] = []
    tolerated = declared_absent()
    n_art = 0
    n_declared_absent = 0

    def absent(rel: str, what: str, path: Path) -> None:
        """A declared-absent path is a warning (a partial bake builds); any other absence is drift."""
        nonlocal n_declared_absent
        if rel in tolerated:
            n_declared_absent += 1
            print(f"WARN: {what} {rel} is absent, as readiness.json declares (partial)")
        else:
            errs.append(f"missing {what}: {path}")

    ids = [c["case_id"] for c in index.get("cases", [])]
    if index.get("n_cases") != len(ids) or index.get("default_case") not in ids or ids != sorted(ids):
        errs.append("index: n_cases, default_case or the order of its entries is wrong")
    for rel in index.get("files", []) or []:
        f = DERIVED / rel
        if not f.is_file() or f.stat().st_size == 0:
            if rel in tolerated and not f.exists():
                n_declared_absent += 1
                print(f"WARN: file {rel} is absent, as readiness.json declares (partial)")
            else:
                errs.append(f"declared by the index but missing or empty: {f}")
    manifests: list[tuple[dict, dict]] = []
    for entry in index.get("cases", []):
        mp = DERIVED / entry["manifest_path"]
        if not mp.exists():
            absent(entry["manifest_path"], "manifest", mp)
            continue
        manifests.append((entry, json.loads(mp.read_text(encoding="utf-8"))))
    rows = survey_rows([m for _, m in manifests])
    for entry, m in manifests:
        cid = entry["case_id"]
        art_meta = m.get("artifact") or {}
        if not art_meta:
            errs.append(f"{cid}: the manifest names no artifact")
            continue
        n_art += 1
        art = DERIVED / art_meta["path"]
        if not art.exists():
            absent(art_meta["path"], "artifact", art)
            continue
        raw = art.read_bytes()
        if len(raw) != art_meta.get("bytes"):
            errs.append(f"byte drift {art}: manifest={art_meta.get('bytes')} disk={len(raw)}")
        if len(raw) == 0:
            errs.append(f"empty artifact: {art}")
        if hashlib.sha256(raw).hexdigest() != art_meta.get("sha256"):
            errs.append(f"sha256 drift {art}: the manifest does not describe the file")
        errs.extend(lane_errors(cid, m, len(raw)))
        metrics = m.get("metrics") or {}
        for name, bounds in (m.get("expect") or {}).items():
            v = metrics.get(name)
            if v is None or not bounds[0] <= v <= bounds[1]:
                errs.append(f"{cid}: {name}={v} outside its expected range {bounds}")
        machine = (m.get("params") or {}).get("machine", "cone-sec")
        real = m.get("real_or_synthetic") == "real"
        predictions = {k: v for k, v in metrics.items() if k in unit_gate.PHYSICAL_DOMAIN}
        for p in unit_gate.blocking(unit_gate.check_units(cid, predictions, unit_gate.ranges_for(machine, rows if real else None))):
            errs.append(f"units gate: {p['detail']}")
    if errs:
        print("CONTRACT 2/3 DRIFT:")
        for e in errs:
            print("  -", e)
        return 1
    print(f"CONTRACT 2/3 OK: {len(index.get('cases', []))} cases, {n_art} artifacts, manifests <-> artifacts consistent, "
          "expected ranges and units gate hold" + (f" ({n_declared_absent} declared absent)." if n_declared_absent else "."))
    return 0


if __name__ == "__main__":
    sys.exit(main())
