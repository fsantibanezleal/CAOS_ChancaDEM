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
| [DEM / SOTA landscape](07_dem_pbm_landscape/dem-pbm.md) | the mechanism frontier ChancaDEM is not (PRM Cleary/Delaney; bonded-particle Quist; DNN surrogate Koh) |
| [CrusherCal, calibration + LOO + UQ](08_calibration_validation/calibration-validation.md) | Rocha 2024 HP500 fit; leave-one-survey-out validation; negative controls; uncertainty |
| [Power model, Bond vs calibrated (honest negative)](09_power_model/power-model.md) | Bond 1952; the paper power form; the documented measured-vs-modeled negative |

Real-data calibration + validation anchor: **Rocha et al. 2024** (Minerals 14(9):919, DOI 10.3390/min14090919,
CC BY), the 10 HP500 surveys; second cone anchor **Duarte et al. 2021** (Minerals 11(11):1256, DOI
10.3390/min11111256). DOI-verified citations are in `frontend/src/data/citations.ts` and surfaced in the
Methodology + Benchmark pages.
