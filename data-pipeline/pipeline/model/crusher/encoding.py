"""The feature encodings of the learned tier. Counterpart of ``frontend/src/engine/surrogate.ts`` without any ONNX
call.

``surrogate.ts`` reproduces ``train.py``'s feature encoding byte for byte against the frozen scalers: the surrogate
input is 5 one-hot machine columns (order ``cone-sec, cone-tert, jaw, cone-short-head, gyratory``) plus 6 standardized
continuous columns (CSS, throw, speed, feed x63, feed m, ore A*b), stored as float32; the autoencoder input is the 14
features of a result (log10 sizes, passing fractions, throughput, power, reduction ratio, log10 f80, Ecs, feed m),
standardized and stored as float32. Float32 rounding is done in numpy; every other operation is a double operation.
"""
from __future__ import annotations

import math

import numpy as np

from .jsmath import jdiv, jmax
from .types import CrusherResult, Operating

MACHINES = ("cone-sec", "cone-tert", "jaw", "cone-short-head", "gyratory")
_CONT = ("css_mm", "throw_mm", "speed_rpm", "feed_x63_mm", "feed_m", "ore_axb")
AE_FEATURES = 14


def _f32(x: float) -> float:
    with np.errstate(over="ignore", invalid="ignore"):
        return float(np.float32(x))


def encode_input(op: Operating, in_mean: list[float], in_std: list[float]) -> list[float]:
    """The 11-D surrogate input: one-hot machine then the standardized continuous features (float32 values)."""
    x = [0.0] * (len(MACHINES) + len(_CONT))
    idx = MACHINES.index(op.machine) if op.machine in MACHINES else -1
    if idx >= 0:
        x[idx] = 1.0
    for j, name in enumerate(_CONT):
        x[len(MACHINES) + j] = _f32(jdiv(getattr(op, name) - in_mean[j], in_std[j]))
    return x


def _log10(x: float) -> float:
    m = jmax(x, 1e-6)
    return math.nan if m != m else math.log10(m)


def ae_feats(r: CrusherResult) -> list[float]:
    """The 14 raw autoencoder features of a result, in the order of ``train.py`` ``AE_FEATS``."""
    p = r.pct_passing
    return [
        _log10(r.p80), _log10(r.p50), _log10(r.p20), p[1], p[4], p[8], p[16], p[32],
        r.throughput_tph, r.power_kw, r.reduction_ratio, _log10(r.f80), r.specific_energy_kwh_t, r.op.feed_m,
    ]


def ae_input(feats: list[float], mean: list[float], std: list[float]) -> list[float]:
    """The standardized autoencoder input (float32 values)."""
    return [_f32(jdiv(feats[i] - mean[i], std[i])) for i in range(AE_FEATURES)]
