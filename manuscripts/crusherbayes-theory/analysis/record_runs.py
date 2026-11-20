#!/usr/bin/env python3
"""Record the environment and the measured wall times of the theory study's runs in
``manuscripts/crusherbayes-theory/data/run_times.json``, which ``figures/make_figs.py`` reads for the Reproducibility section.

The environment (processor count, platform, Python and package versions) is read from the interpreter this script runs in,
which must be the study's ``.venv-pipeline``. A run's wall time is given on the command line as it was measured by the shell
that ran it (``time`` or the harness's own log), with the number of worker processes and where the measurement is recorded;
a later call adds or replaces runs and keeps the others.

Run:  .venv-pipeline/Scripts/python.exe manuscripts/crusherbayes-theory/analysis/record_runs.py \
          --run exact 1237 22 "harness report s1-theory-harness-2026-11-19, D3"
"""
from __future__ import annotations

import argparse
import importlib.metadata as md
import json
import os
import platform
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "data" / "run_times.json"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--run", nargs=4, action="append", default=[], metavar=("NAME", "SECONDS", "WORKERS", "SOURCE"),
                    help="a run's name, measured wall time in seconds, worker processes and where it is recorded")
    a = ap.parse_args()
    doc = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {"schema": "chancadem.cbt.run-times/v1", "runs": {}}
    doc["environment"] = {"cpu_count": os.cpu_count(), "platform": platform.platform(), "python": platform.python_version(),
                          "numpy": md.version("numpy"), "emcee": md.version("emcee"), "interpreter": Path(sys.executable).parent.parent.name}
    for name, seconds, workers, source in a.run:
        doc["runs"][name] = {"wall_seconds": float(seconds), "workers": int(workers), "source": source}
    OUT.write_bytes((json.dumps(doc, indent=1) + "\n").encode("utf-8"))
    print(json.dumps(doc, indent=1))


if __name__ == "__main__":
    main()
