#!/usr/bin/env python3
"""The reach of the study's simulation-based calibration: the power of its rank test against a posterior of the wrong width or
location, written to ``manuscripts/crusherbayes-theory/data/sbc_power.json`` for ``figures/make_figs.py``.

The test is the one ``sim/run_sampler.py summarize`` runs: the ranks of N posteriors among L draws, binned into B equal bins of
the L + 1 ranks, chi-square against uniform (``theory.rank_uniformity``), at the 5 percent level and at the Bonferroni level over
the quantities tested. N, L, B and the number of quantities are read from ``data/sbc.json``, so the power is that of the test the
paper reports.

The alternative, per scenario: the true parameter is a draw from the true posterior, standardized to N(0, 1); the sampler returns
draws from N(shift, scale^2) in the same units, a posterior ``scale`` times as wide and shifted by ``shift`` posterior standard
deviations. Given the true value z, the rank among L draws is Binomial(L, Phi((z - shift) / scale)), drawn exactly. Each scenario
repeats the whole test ``--reps`` times; the power is the share of repetitions with p below the level, with its binomial
standard error.

Run:  .venv-pipeline/Scripts/python.exe manuscripts/crusherbayes-theory/analysis/sbc_power.py
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "data"
sys.path.insert(0, str(HERE.parent / "sim"))
import run_exact  # noqa: E402
import theory  # noqa: E402

SCALES = (0.5, 0.6, 0.7, 0.8, 0.9, 1.25, 1.5, 2.0)
SHIFTS = (0.25, 0.5, 1.0)
SEED = 20261120


def power(scale: float, shift: float, n: int, L: int, bins: int, levels: dict[str, float], reps: int,
          rng: np.random.Generator) -> dict:
    z = rng.standard_normal((reps, n))
    p_below = 0.5 * np.vectorize(math.erfc)(-((z - shift) / scale) / math.sqrt(2.0))
    ranks = rng.binomial(L, p_below)
    pvals = np.array([theory.rank_uniformity(r, L, bins)[1] for r in ranks])
    out = {}
    for name, a in levels.items():
        share = float(np.mean(pvals < a))
        out[name] = {"power": share, "se": math.sqrt(share * (1 - share) / reps)}
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--reps", type=int, default=20000)
    a = ap.parse_args(argv)
    sbc = json.loads((DATA / "sbc.json").read_text(encoding="utf-8"))
    n, L, bins, quantities = sbc["n_posteriors"], sbc["L"], sbc["bins"], len(sbc["ranks"])
    levels = {"nominal": 0.05, "bonferroni": 0.05 / quantities}
    rng = np.random.default_rng(SEED)
    scenarios = [{"scale": 1.0, "shift": 0.0}] + [{"scale": s, "shift": 0.0} for s in SCALES] \
        + [{"scale": 1.0, "shift": d} for d in SHIFTS]
    for sc in scenarios:
        sc.update(power(sc["scale"], sc["shift"], n, L, bins, levels, a.reps, rng))
    doc = {"schema": "chancadem.cbt.sbc-power/v1", "n_posteriors": n, "L": L, "bins": bins, "quantities": quantities,
           "levels": levels, "reps": a.reps, "seed": SEED,
           "alternative": "true value ~ N(0, 1); sampler draws ~ N(shift, scale^2); rank ~ Binomial(L, Phi((z - shift) / scale))",
           "scenarios": scenarios}
    run_exact.write_json(DATA / "sbc_power.json", doc)
    for sc in scenarios:
        print(f"scale {sc['scale']:.2f} shift {sc['shift']:.2f}: power {sc['nominal']['power']:.3f} at 0.05, "
              f"{sc['bonferroni']['power']:.3f} at {levels['bonferroni']:.4f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
