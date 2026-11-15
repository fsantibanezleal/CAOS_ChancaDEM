#!/usr/bin/env python3
"""The published model of Rocha, Campos, Silva and Tavares (Minerals 14, 919, 2024, doi 10.3390/min14090919, CC BY) run on
the ten HP500 surveys for the CrusherBayes comparison.

Throughput. Their Equations 10 to 15 with the parameters of their Table 4,

    Q_max = lambda * Q_T * (rho_a / 1600) * (16 / Wi)^eta * (100 / f80)^eps * delta * (CSS / 38)^nu,
    Q_T = 647 t/h (Bruno base case), eta = 0.15, eps = 0.26, nu = 1.27, lambda = 0.84, rho_a = 2088 kg/m3,

are implemented once, by ``rocha_throughput`` of the technical report's ``manuscripts/comminution-studio/figures/heldout_uq.py``,
and imported here (never copied). Two inputs are not printed by the paper and are the ones that module states: the work index
of the blend (the product's 9.0 kWh/t, between the 7.2 and 10.6 of their Table 1) and the moisture of each survey (delta = 1,
moisture below 1 percent). Two variants are scored:

- published: lambda = 0.84, which the authors fitted on survey 10 (their Section 4.3); eta, eps and nu come from Bruno
  simulations and crusher manuals, not from the surveys. Its constants were set with the surveys at hand, so it fits nothing
  inside the folds and is never a held-out figure;
- strict: lambda refit by least squares on the nine training surveys of each fold, the one scalar the paper fits.

The check of the published variant against a number the paper prints: Section 4.3 reports that Equation 10 fits the surveys
with "a mean sum of squares of the absolute relative deviations of 0.23"; the sum over the ten surveys of the squared relative
deviations of the published variant is 0.228 at the blend work index (0.216 at 7.2 and 0.249 at 10.6 kWh/t).

Power. Their Equations 7 and 8, P_c = zeta * P_d + P_n with P_d = Q * sum_i Ecs_t10,i * C_i * w_i, zeta = 1.30 (fitted) and
P_n = 110 kW (a third of the installed power), cannot be run from the paper, because two of its inputs are not printed:

1. w_i, the mass fraction of each size class in the crusher: Table A1 prints only the f80 of each survey; the feed and
   product size distributions are figures;
2. Ecs at the t10 of each survey: Table A2 gives the specific energy at t10 = 10, 20 and 30 percent only, while their
   Equation 5 with Table 5 gives t10 = 27.2 to 47.4 percent on the ten surveys, above 30 percent on nine of them; the paper
   gives no rule to extend the table.

``power_blockers`` computes the second from the paper's own numbers so the manuscript can quote it. No value is guessed.

Run:  python manuscripts/crusherbayes/figures/rocha_published.py   (prints the numbers)
Test: python -m pytest -p no:cacheprovider manuscripts/crusherbayes/figures/test_rocha_published.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "manuscripts" / "comminution-studio" / "figures"))

from heldout_uq import ROCHA, WI_BLEND, WI_BOUNDS, rocha_shape, rocha_throughput  # noqa: E402

# Rocha et al. 2024, Section 4.3: the printed fit of Equation 10 to the ten surveys
PRINTED_FIT_SSQ = 0.23
TABLE4 = {k: ROCHA[k] for k in ("eta", "eps", "nu", "lam")}
# Table 5, Equation 5: t10 = D0 - D1 CSS + D3 f80 (percent; CSS and f80 in mm)
TABLE5_T10 = {"D0": 64.0, "D1": 0.12, "D3": -0.23}
# Table A2: specific energy (kWh/t) to reach t10 = 10, 20, 30 percent, equal over the 22.4 to 63.0 mm classes
TABLE_A2_ECS = {10.0: 0.046, 20.0: 0.099, 30.0: 0.168}
# Table A1 prints the f80 of each survey and not its size distribution
FEED_DISTRIBUTION_PRINTED = False


def shape(css: np.ndarray, f80: np.ndarray, wi: float = WI_BLEND) -> np.ndarray:
    """Q_T times the correction factors of Equation 10, without lambda (t/h)."""
    return rocha_shape(css, f80, wi)


def throughput(css: np.ndarray, f80: np.ndarray, meas: np.ndarray, wi: float = WI_BLEND) -> dict:
    """The published variant (lambda = 0.84) and the strict variant (lambda refit without the held-out survey)."""
    return rocha_throughput(css, f80, meas, wi)


def relative_ssq(meas: np.ndarray, pred: np.ndarray) -> float:
    """Sum over the surveys of the squared relative deviation of a prediction from the measurement."""
    return float(np.sum(((pred - meas) / meas) ** 2))


def t10_eq5(css: np.ndarray, f80: np.ndarray) -> np.ndarray:
    """t10 (percent) of Equation 5 with the parameters of Table 5."""
    p = TABLE5_T10
    return p["D0"] - p["D1"] * css + p["D3"] * f80


def power_blockers(css: np.ndarray, f80: np.ndarray) -> dict:
    """The inputs of Equation 8 that the paper does not print, measured on the surveys."""
    t10 = t10_eq5(css, f80)
    top = max(TABLE_A2_ECS)
    return {"t10_min_pct": float(t10.min()), "t10_max_pct": float(t10.max()), "t10_table_max_pct": top,
            "surveys_above_table": int(np.sum(t10 > top)), "feed_distribution_printed": FEED_DISTRIBUTION_PRINTED}


if __name__ == "__main__":
    import csv

    with (ROOT / "data" / "examples" / "hp500-surveys.csv").open(encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    css, f80, q = (np.array([float(r[k]) for r in rows]) for k in ("css_mm", "f80_mm", "feed_tph"))
    for wi in (WI_BOUNDS[0], WI_BLEND, WI_BOUNDS[1]):
        r = throughput(css, f80, q, wi)
        print(f"Wi {wi}: sum of squared relative deviations {relative_ssq(q, r['published']):.3f} "
              f"(printed {PRINTED_FIT_SSQ}); MAPE published {100 * np.mean(np.abs(r['published'] - q) / q):.2f}, "
              f"strict {100 * np.mean(np.abs(r['refit'] - q) / q):.2f}")
    print(power_blockers(css, f80))
