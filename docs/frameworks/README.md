# Frameworks & methods

The research made binding: every engine ChancaDEM depends on is pinned (`requirements-precompute.txt` /
`frontend/package.json`) and documented here. Engine cards cover what/why/install/use; method cards cover the
algorithm + its provenance.

## Engines

| Card | Pin | Lane |
|---|---|---|
| [Whiten / Evertsson / Bond TS engine](01_whiten-engine/whiten.md) | `frontend/src/physics/` | live + the offline label source |
| [PyTorch](02_pytorch/pytorch.md) | `torch==2.12.1` (CPU) | offline (train) |
| [ONNX / onnxruntime / onnxruntime-web](03_onnx-onnxruntime/onnx.md) | `onnx==1.22.0`, `onnxruntime==1.27.0`, `onnxruntime-web^1.27.0` | offline export + live inference |
| [NumPy](04_numpy/numpy.md) | `numpy==2.4.6` | both lanes (light replay) |

## Methods

| Card | Provenance |
|---|---|
| [Whiten population balance + breakage](01_whiten-engine/whiten.md) | Whiten 1972; JKMRC t10→Austin appearance; Evertsson 2000 (capacity); Bond (power) |
| [Surrogate MLP](05_surrogate/surrogate.md) | population-balance emulator (operating params → product PSD/throughput/power) |
| [Denoising AE / OOD score](06_denoising-ae/denoising-ae.md) | reconstruction-error operating-anomaly + surrogate OOD guard |

Calibration anchor: **Duarte et al. 2021** (Minerals 11(11):1256, DOI 10.3390/min11111256). DOI-verified citations
are in `frontend/src/data/citations.ts` and surfaced in the Methodology page.
