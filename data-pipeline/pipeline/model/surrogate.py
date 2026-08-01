"""The population-balance SURROGATE MLP: operating parameters (5 machine one-hots + 6 continuous = 11) -> 10 outputs
(P80/P50/P20, %-passing at {1,4,8,16,32} mm, throughput, power). It emulates the cheap analytic Whiten/Evertsson/
Bond engine in a single differentiable forward pass (an instant what-if the closed-form grid cannot give live).
Requires torch (the heavy precompute lane only); the deployed live lane runs the EXPORTED ONNX in onnxruntime-web."""
from __future__ import annotations

import torch.nn as nn

NIN = 11   # 5 machine one-hots + 6 continuous (z-scored)
NOUT = 10


class Surrogate(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(NIN, 64), nn.GELU(), nn.Linear(64, 64), nn.GELU(),
                                 nn.Linear(64, 32), nn.GELU(), nn.Linear(32, NOUT))

    def forward(self, x):
        return self.net(x)
