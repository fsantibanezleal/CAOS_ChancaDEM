"""Morrell's crusher energy as an HP500 power model: the fit of M_ic and the no-load term per fold.

The Minas Rio M_ic is not published, so it is a fitted scalar, and so is the no-load power; both are refit on the
training surveys of every fold and the held-out survey never enters (the module has no other input). The design column
of a survey is ``g = W_c(M_ic = 1) x throughput`` [kW per kWh/t], with W_c from ``pipeline.model.crusher.morrell``
(GMSG B4 and B5), the feed P80 the measured f80, the product P80 the backbone's P80 (a model output, used as an input
and never as a target) and the throughput the measured feed t/h (the plant's feed rate is an input of the power
model, as in the dossier section 2 G1). Two variants:

    Morrell            kW = M_ic g                    one scalar, through the origin
    Morrell_noload     kW = M_ic g + P_noload         two scalars, the guideline's net power plus a no-load term

Reported as they come: 38.08 and 15.21 percent held-out MAPE on the ten surveys.
"""
from __future__ import annotations

import numpy as np

from ..model.crusher import morrell


def design_column(f80_mm: np.ndarray, p80_mm: np.ndarray, feed_tph: np.ndarray, closed_circuit: bool = True) -> np.ndarray:
    """g [kW per kWh/t] for each survey: the W_c of M_ic = 1 kWh/t, from f80 and P80 in mm, times the t/h."""
    return np.array([morrell.crusher_power_kw(float(f) * 1000.0, float(p) * 1000.0, 1.0, float(t), 0.0, closed_circuit)
                     for f, p, t in zip(f80_mm, p80_mm, feed_tph)])


def fit_through_origin(g: np.ndarray, kw: np.ndarray, train_idx: np.ndarray) -> float:
    """M_ic [kWh/t] of kW = M_ic g on the rows ``train_idx``: sum(g kW) / sum(g g)."""
    gt, yt = g[train_idx], kw[train_idx]
    return float(gt @ yt / (gt @ gt))


def fit_with_no_load(g: np.ndarray, kw: np.ndarray, train_idx: np.ndarray) -> tuple[float, float]:
    """(M_ic [kWh/t], no-load [kW]) of kW = M_ic g + no-load by least squares on the rows ``train_idx``."""
    A = np.column_stack([g[train_idx], np.ones(train_idx.size)])
    coef, *_ = np.linalg.lstsq(A, kw[train_idx], rcond=None)
    return float(coef[0]), float(coef[1])
