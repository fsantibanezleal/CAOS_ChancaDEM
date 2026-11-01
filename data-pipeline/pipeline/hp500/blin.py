"""B-lin: the setting-only power line, a classical baseline every other HP500 method is held to.

Ordinary least squares with an intercept of one target on the closed-side setting alone,

    y = a + b CSS            (y: feed t/h or motor kW; CSS in mm; b in t/h per mm or kW per mm)

refit on the training surveys of each fold. It carries no physics and no engine; on the ten Minas Rio surveys it is
already at 12.78 percent held-out MAPE on power and 13.67 on throughput (the dossier CAOS_MANAGE
wip/chancadem/beyond-sota-research-2026-10-28.md section 1.4), the bar the free-form M2, Morrell and CrusherBayes meet.
Pure numpy, no I/O.
"""
from __future__ import annotations

import numpy as np


def fit_line(css: np.ndarray, y: np.ndarray, train_idx: np.ndarray) -> tuple[float, float]:
    """The intercept ``a`` and slope ``b`` of y = a + b CSS by least squares on the rows ``train_idx``."""
    x = np.asarray(css, dtype=float)[train_idx]
    A = np.column_stack([np.ones(x.size), x])
    coef, *_ = np.linalg.lstsq(A, np.asarray(y, dtype=float)[train_idx], rcond=None)
    return float(coef[0]), float(coef[1])


def predict_line(coef: tuple[float, float], css_mm: float) -> float:
    """a + b CSS at one setting [mm]."""
    return coef[0] + coef[1] * css_mm
