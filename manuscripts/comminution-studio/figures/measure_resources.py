#!/usr/bin/env python3
"""Record the measured resources of the product's stages for the technical report (data/resources.json).

Two kinds of measurement, both of the release in the working tree:

* the stage runs, measured outside this script by a process-tree monitor that polls the peak memory of the command and every
  descendant (CAOS_MANAGE ``tools/audit/measure_command.py --json``, one JSON object per stage, on the last line of its output),
  each pointed at a sandbox output root so the committed artifacts are not rewritten; pass them as ``--stage FILE``;
* the canonical engine time per case, measured here: after one warm-up run, the median of seven runs of ``evaluate`` at the
  committed parameters of each of the baked cases, and the median and the largest of those medians.

``make_tables.py`` generates the resources table from the document this script writes; the numbers are time-dependent and are
therefore recorded once, never recomputed by the table script.

Run:  python manuscripts/comminution-studio/figures/measure_resources.py --stage bake.json --stage hp500.json ...
"""
from __future__ import annotations

import argparse
import json
import platform
import statistics
import sys
import time
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DER = ROOT / "data" / "derived"
OUT = HERE.parent / "data" / "resources.json"
sys.path.insert(0, str(ROOT / "data-pipeline"))

from pipeline.model.crusher import evaluate  # noqa: E402
from pipeline.model.crusher.types import Operating  # noqa: E402


def engine_times(runs: int = 7) -> dict:
    index = json.loads((DER / "manifests" / "index.json").read_text(encoding="utf-8"))
    medians = {}
    for c in index["cases"]:
        params = json.loads((DER / "manifests" / f"{c['case_id']}.json").read_text(encoding="utf-8"))["params"]
        op = Operating(**params)
        evaluate(op)                                     # warm-up
        t = []
        for _ in range(runs):
            t0 = time.perf_counter()
            evaluate(op)
            t.append(time.perf_counter() - t0)
        medians[c["case_id"]] = statistics.median(t) * 1000.0
    return {"cases": len(medians), "runs_per_case": runs, "median_of_medians_ms": round(statistics.median(medians.values()), 3),
            "max_median_ms": round(max(medians.values()), 3), "per_case_median_ms": {k: round(v, 3) for k, v in medians.items()}}


def site_sizes() -> dict:
    """The built site (frontend/dist, after the measured npm run build): its bytes and those of the WebAssembly runtime."""
    dist = ROOT / "frontend" / "dist"
    files = [f for f in dist.rglob("*") if f.is_file()]
    return {"bytes": sum(f.stat().st_size for f in files), "files": len(files),
            "wasm_bytes": sum(f.stat().st_size for f in files if f.suffix == ".wasm")}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--stage", action="append", type=Path, default=[], help="the --json output of measure_command.py for one stage")
    ap.add_argument("--note", action="append", default=[], help="label=text, a note on one stage (for example its test count)")
    ap.add_argument("--disk", action="append", default=[], help="label=bytes, the bytes a stage wrote to its sandbox root")
    args = ap.parse_args()
    notes = dict(n.split("=", 1) for n in args.note)
    disk = {k: int(v) for k, v in (d.split("=", 1) for d in args.disk)}
    stages = []
    for f in args.stage:
        last = [ln for ln in f.read_text(encoding="utf-8", errors="replace").splitlines() if ln.startswith("{")][-1]
        rec = json.loads(last)
        rec["command"] = [Path(c).name if ("/" in c or "\\" in c) and Path(c).suffix == ".exe" else c for c in rec["command"]]
        rec["command"] = ["<sandbox>" if "_Temp" in c else c for c in rec["command"]]
        rec.pop("cwd", None)
        if rec["label"] in disk:
            rec["sizes"]["output"] = {"bytes": disk[rec["label"]]}
        if rec["label"] in notes:
            rec["note"] = notes[rec["label"]]
        stages.append(rec)
    doc = {"schema": "chancadem.report.resources/v1",
           "product_version": (ROOT / "VERSION").read_text(encoding="utf-8").strip(),
           "measured_on": date.today().isoformat(),
           "host": {"os": f"{platform.system()} {platform.release()}", "python": platform.python_version(),
                    "processor_threads": __import__("os").cpu_count()},
           "monitor": "process-tree peak memory polled every 20 ms (CAOS_MANAGE tools/audit/measure_command.py)",
           "stages": stages, "engine": engine_times(), "site": site_sizes()}
    OUT.write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8")
    print(f"resources -> {OUT}: {len(stages)} stages, engine median {doc['engine']['median_of_medians_ms']} ms")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
