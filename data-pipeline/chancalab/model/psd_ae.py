"""The denoising AUTOENCODER over the product-gradation signature (14 features). Its reconstruction error is an
operating-anomaly score that DOUBLES as the surrogate's out-of-distribution guard: a query far from the training
manifold reconstructs poorly -> "the surrogate is extrapolating, distrust it". Requires torch (the heavy precompute
lane only); the deployed live lane runs the EXPORTED ONNX in onnxruntime-web."""
from __future__ import annotations

import torch.nn as nn

N_FEAT = 14   # the product-gradation signature (p80L/p50L/p20L, %-passing×5, tph, kW, reduction, f80L, ecs, feedM)


class AE(nn.Module):
    def __init__(self):
        super().__init__()
        self.enc = nn.Sequential(nn.Linear(N_FEAT, 16), nn.GELU(), nn.Linear(16, 6), nn.GELU())
        self.dec = nn.Sequential(nn.Linear(6, 16), nn.GELU(), nn.Linear(16, N_FEAT))

    def forward(self, x):
        return self.dec(self.enc(x))
