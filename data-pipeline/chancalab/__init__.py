"""chancalab — the offline+live engine for ChancaDEM (instantiated from the CAOS product-repo archetype, ADR-0057).

The CORE is real and SOTA-pinned: a pure-TypeScript Whiten population-balance + Evertsson capacity + Bond power
engine runs live in the browser; a surrogate MLP (emulating that engine) and a denoising autoencoder (operating
anomaly / OOD score) are trained OFFLINE on a Latin-hypercube sweep of the engine and exported to ONNX. The base
around it (the two data contracts, the staged pipeline, the lane gate, the manifest/trace, the cases-by-category
registry) is the FROZEN archetype — instantiated here, not redesigned.

Offline lane is two-language: a Node sweep (`sweep/gen_sweep.mjs`, the SAME TS engine — no Python re-port) produces
the labels; Python (`stages/train.py`) fits the ONNX models. The default pipeline is numpy-only and rebuilds the
per-case replay from the committed artifacts.
"""

__version__ = "0.03.000"  # display X.XX.XXX; PEP 440 form in pyproject.toml (0.3.0)
