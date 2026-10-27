# Frameworks and methods

The research made binding: every engine ChancaDEM depends on is pinned (`requirements-precompute.txt`,
`data-pipeline/requirements.txt`, `frontend/package.json`) and documented here. Engine cards cover what, why, install and
use; method cards cover the algorithm and its provenance, in the form: what it is, theory and equations, constants as the
code has them, where it runs, tests, what it is not, references.

## Engines

| Card | Pin | Lane |
|---|---|---|
| [Whiten / Evertsson / Bond engine, Python and TypeScript](01_whiten-engine/whiten.md) | `data-pipeline/pipeline/model/crusher/` (canonical), `frontend/src/engine/` (live port) | offline and live |
| [PyTorch](02_pytorch/pytorch.md) | `torch==2.12.1` (CPU) | offline (train) |
| [ONNX, onnxruntime, onnxruntime-web](03_onnx-onnxruntime/onnx.md) | `onnx==1.22.0`, `onnxruntime==1.27.0`, `onnxruntime-web` 1.27.0 | offline export and evaluation, live inference |
| [NumPy](04_numpy/numpy.md) | `numpy==2.4.6` | offline |

## Methods

| Card | Ladder | Provenance |
|---|---|---|
| [Feed and sieve grid](10_feed-and-sieve-grid/feed-sieve.md) | M1 | Rosin and Rammler 1933 |
| [Breakage function](11_breakage-function/breakage.md) | M2 | JKMRC t10 (Napier-Munn et al. 1996), Austin et al. 1984 |
| [Classification](12_classification/classification.md) | M3 | Whiten 1972, Andersen and Napier-Munn 1988 |
| [Whiten population balance](01_whiten-engine/whiten.md) | M4 | Whiten 1972 |
| [Capacity](13_capacity/capacity.md) | M5 | Evertsson 2000 |
| [Regimes and nip angle](14_regimes-and-nip-angle/regimes.md) | M6 | the engine's rules |
| [Power model](09_power_model/power-model.md) | M7 | Bond 1952; the paper's form; a documented negative |
| [HP500 calibration](16_hp500-calibration/hp500-calibration.md) | M8 | Rocha et al. 2024 |
| [Envelope gate](15_envelope-gate/envelope.md) | M9 | the engine's rules, the HP500 support |
| [CrusherCal](08_calibration_validation/calibration-validation.md) | M10 | leave-one-survey-out, controls, predictive band |
| [Surrogate MLP](05_surrogate/surrogate.md) | M11 | a population-balance emulator (Koh et al. 2021 as the state of the art) |
| [Denoising autoencoder](06_denoising-ae/denoising-ae.md) | M12 | reconstruction error as an extrapolation score |
| [DEM landscape](07_dem_pbm_landscape/dem-pbm.md) | frontier | Cleary and Sinnott 2015, Delaney et al. 2015, Quist and Evertsson 2016 |

Real-data calibration and validation anchor: Rocha et al. 2024 (Minerals 14(9):919,
[doi:10.3390/min14090919](https://doi.org/10.3390/min14090919), CC BY 4.0), the ten HP500 surveys; second cone anchor,
Duarte et al. 2021 ([doi:10.3390/min11111256](https://doi.org/10.3390/min11111256)). The citations the site shows are in
`frontend/src/content/citations/core.ts`. Two print-only society papers the earlier cards named (Narayanan and Whiten 1988,
Karra 1982) have no open landing page and are not cited; the linked works that reproduce their methods are.
