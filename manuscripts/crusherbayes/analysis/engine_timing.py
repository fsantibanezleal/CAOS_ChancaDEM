#!/usr/bin/env python3
"""The wall time of one evaluation of the product's engine on the HP500 lane, measured on the machine that runs this.

The engine (``pipeline.model.crusher.evaluate``) is evaluated at the shipped scalars on each of the ten surveys, in
``REPEATS`` rounds after one warm-up round; the per-evaluation time of each round is its wall time over the ten calls. The
median and the range over the rounds are written, with the machine, so that the number quoted in the paper is a measured
fact of a stated machine and not a constant carried from elsewhere. A wall time depends on the machine and its load:
it is reported, never asserted by a test.

Writes ``manuscripts/crusherbayes/data/engine_timing.json``.
Run:  python manuscripts/crusherbayes/analysis/engine_timing.py
"""
from __future__ import annotations

import json
import os
import platform
import statistics
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "data-pipeline"))

from pipeline.model.crusher import evaluate, operating_from_survey  # noqa: E402
from pipeline.model.crusher.hp500 import Hp500Scalars  # noqa: E402

DER = ROOT / "data" / "derived" / "hp500"
OUT = HERE.parent / "data" / "engine_timing.json"
REPEATS = 30


def main() -> int:
    bb = json.loads((DER / "backbone.json").read_text(encoding="utf-8"))
    ops = [operating_from_survey(float(s["measured"]["css_mm"]), float(s["measured"]["f80_mm"])) for s in bb["surveys"]]
    scalars = Hp500Scalars()
    for op in ops:                       # warm-up round, not timed
        evaluate(op, scalars)
    per_call = []
    for _ in range(REPEATS):
        t0 = time.perf_counter()
        for op in ops:
            evaluate(op, scalars)
        per_call.append((time.perf_counter() - t0) / len(ops) * 1e3)
    res = {
        "schema": "chancadem.crusherbayes.engine-timing/v1",
        "note": "computed by manuscripts/crusherbayes/analysis/engine_timing.py with the product's engine",
        "evaluations": REPEATS * len(ops), "rounds": REPEATS,
        "ms_per_evaluation_median": statistics.median(per_call),
        "ms_per_evaluation_min": min(per_call), "ms_per_evaluation_max": max(per_call),
        "machine": {"cpu_count": os.cpu_count(), "platform": platform.platform(), "python": platform.python_version(),
                    "processor": platform.processor()},
    }
    OUT.write_text(json.dumps(res, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(res, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
