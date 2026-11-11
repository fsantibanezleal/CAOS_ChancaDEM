"""Tests of the published model of Rocha et al. (Minerals 14, 919, 2024) as the CrusherBayes manuscript runs it.

Run:  python -m pytest -p no:cacheprovider manuscripts/crusherbayes/figures/test_rocha_published.py
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import rocha_published as rp  # noqa: E402

CSV = HERE.parents[2] / "data" / "examples" / "hp500-surveys.csv"


def _surveys() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    with CSV.open(encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    col = lambda k: np.array([float(r[k]) for r in rows])  # noqa: E731
    return col("css_mm"), col("f80_mm"), col("feed_tph")


def test_published_throughput_reproduces_the_fit_the_paper_prints():
    """Rocha et al., Section 4.3: Eq. (10) fits the ten surveys with a sum of squared relative deviations of 0.23."""
    css, f80, q = _surveys()
    pub = rp.throughput(css, f80, q)["published"]
    assert round(rp.relative_ssq(q, pub), 2) == rp.PRINTED_FIT_SSQ == 0.23


def test_published_throughput_uses_the_constants_of_table_4():
    css, f80, q = _surveys()
    r = rp.throughput(css, f80, q)
    assert np.allclose(r["published"], 0.84 * rp.shape(css, f80))
    assert rp.TABLE4 == {"eta": 0.15, "eps": 0.26, "nu": 1.27, "lam": 0.84}


def test_strict_variant_never_sees_the_held_out_survey():
    """Changing the measured throughput of survey h leaves the strict prediction of h unchanged and moves another fold's."""
    css, f80, q = _surveys()
    base = rp.throughput(css, f80, q)["refit"]
    for h in range(q.size):
        planted = q.copy()
        planted[h] *= 10.0
        moved = rp.throughput(css, f80, planted)["refit"]
        assert moved[h] == base[h]
        other = (h + 1) % q.size
        assert moved[other] != base[other]


def test_power_needs_values_the_paper_does_not_print():
    """Eq. (8) needs the energy matrix at each survey's t10; Table A2 stops at 30 percent, and Eq. (5) with Table 5 gives
    27.2 to 47.4 percent on the ten surveys, above the table on nine of them."""
    css, f80, _ = _surveys()
    b = rp.power_blockers(css, f80)
    assert b["t10_table_max_pct"] == 30.0
    assert round(b["t10_min_pct"], 1) == 27.2 and round(b["t10_max_pct"], 1) == 47.4
    assert b["surveys_above_table"] == 9
    assert b["feed_distribution_printed"] is False
