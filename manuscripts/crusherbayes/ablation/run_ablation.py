#!/usr/bin/env python3
"""Run the CrusherBayes ablation and seed replicates with the product's own code, and write one document per variant.

Each variant (``cb_ablation_variants.VARIANTS``) changes one component of CrusherBayes; everything else is the committed
method: the ten HP500 surveys, the strict leave-one-survey-out folds, 20 walkers, 7000 steps, 1000 discarded, thinned by 10,
and the seed 42 unless the variant names another. The comparators of every document are the committed CrusherCal folds
(``data/derived/hp500/loo.json``). The committed method itself is ``data/derived/hp500/crusherbayes.json`` and is not re-run.

Writes ``manuscripts/crusherbayes/data/ablation/<variant>.json``: the ``chancadem.hp500.crusherbayes/v1`` document of the
variant plus ``variant`` (its name and its change), ``wall_seconds`` (the wall time of the run on the machine that ran it)
and ``machine`` (the processor count, the platform, the Python version and the number of worker processes).
A variant whose document exists is skipped, so an interrupted run resumes.

Run (from anywhere):  python manuscripts/crusherbayes/ablation/run_ablation.py [--only NAME ...] [--workers N]
"""
from __future__ import annotations

import argparse
import functools
import json
import platform
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "data-pipeline"))
sys.path.insert(0, str(HERE))

import cb_ablation_variants as variants  # noqa: E402
from pipeline.hp500 import crusherbayes as cb  # noqa: E402

DER = ROOT / "data" / "derived" / "hp500"
OUT = HERE.parent / "data" / "ablation"


def run(name: str, workers: int | None) -> dict:
    variants.apply(name)
    cb._init_worker = functools.partial(variants.init_worker, name)
    backbone = json.loads((DER / "backbone.json").read_text(encoding="utf-8"))
    loo_doc = json.loads((DER / "loo.json").read_text(encoding="utf-8"))
    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    seed = variants.VARIANTS[name].get("seed", cb.SEED)
    t0 = time.perf_counter()
    doc = cb.build(backbone, loo_doc, version, seed=seed, workers=workers)
    wall = time.perf_counter() - t0
    doc["variant"] = {"name": name, "change": variants.VARIANTS[name]}
    doc["wall_seconds"] = round(wall, 1)
    cpus = __import__("os").cpu_count()
    doc["machine"] = {"cpu_count": cpus, "platform": platform.platform(), "python": platform.python_version(),
                      "workers": max(1, workers if workers is not None else (cpus or 1))}   # as cb.build resolves it
    return doc


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--only", nargs="*", default=None, help="the variants to run (default: all)")
    ap.add_argument("--workers", type=int, default=None, help="processes (default: the CPU count)")
    a = ap.parse_args(argv)
    OUT.mkdir(parents=True, exist_ok=True)
    names = a.only or list(variants.VARIANTS)
    for name in names:
        path = OUT / f"{name}.json"
        if path.exists():
            print(f"{name}: exists, skipped", flush=True)
            continue
        print(f"{name}: running", flush=True)
        doc = run(name, a.workers)
        path.write_text(json.dumps(doc, separators=(",", ":")) + "\n", encoding="utf-8")
        s = doc["loo"]
        print(f"{name}: done in {doc['wall_seconds']} s; tph MAPE {s['tph']['scores']['mape_pct']}, kW MAPE "
              f"{s['kW']['scores']['mape_pct']}, all converged {doc['convergence']['all_converged']}", flush=True)
        # every variant restores the module before the next one is applied
        cb.PRIORS = variants.ORIGINAL_PRIORS
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
