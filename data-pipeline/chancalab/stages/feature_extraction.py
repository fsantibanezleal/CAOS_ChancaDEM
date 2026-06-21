"""Stage 2 — feature_extraction (heavy lane): encode the sweep rows into the surrogate's inputs/outputs and the
deep-AE's product-gradation signature. This encoding is the SINGLE SOURCE OF TRUTH the web app reproduces
(frontend/src/lib/ort.ts). The machine one-hot ORDER is frozen to the committed ONNX's order. NumPy only."""
from __future__ import annotations

import math

import numpy as np

# one-hot order MUST match the committed surrogate.onnx (gen_sweep/train.py order) — do NOT reorder.
MACHINES = ["cone-sec", "cone-tert", "jaw", "cone-short-head", "gyratory"]
NM = len(MACHINES)                                                    # 5
CONT = ["cssMm", "throwMm", "speedRpm", "feedX63Mm", "feedM", "oreAxb"]
NIN = NM + len(CONT)                                                  # 11
OUTS = ["p80", "p50", "p20", "pass1", "pass4", "pass8", "pass16", "pass32", "tph", "kW"]
LOG_OUT = {"p80", "p50", "p20"}
AE_FEATS = ["p80L", "p50L", "p20L", "pass1", "pass4", "pass8", "pass16", "pass32", "tph", "kW",
            "reduction", "f80L", "ecs", "feedM"]


def enc_in(rows: list[dict]) -> np.ndarray:
    X = np.zeros((len(rows), NIN), np.float32)
    for i, r in enumerate(rows):
        X[i, MACHINES.index(r["machine"])] = 1.0
        for j, k in enumerate(CONT):
            X[i, NM + j] = r[k]
    return X


def enc_out(rows: list[dict]) -> np.ndarray:
    Y = np.zeros((len(rows), len(OUTS)), np.float32)
    for i, r in enumerate(rows):
        for j, k in enumerate(OUTS):
            v = r[k]
            Y[i, j] = math.log10(max(v, 1e-6)) if k in LOG_OUT else v
    return Y


def enc_ae(rows: list[dict]) -> np.ndarray:
    A = np.zeros((len(rows), len(AE_FEATS)), np.float32)
    for i, r in enumerate(rows):
        A[i] = [math.log10(max(r["p80"], 1e-6)), math.log10(max(r["p50"], 1e-6)), math.log10(max(r["p20"], 1e-6)),
                r["pass1"], r["pass4"], r["pass8"], r["pass16"], r["pass32"], r["tph"], r["kW"],
                r["reduction"], math.log10(max(r["f80"], 1e-6)), r["ecs"], r["feedM"]]
    return A
