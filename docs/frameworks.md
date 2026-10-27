# Frameworks and methods

The research made binding: every engine the product depends on is pinned in a requirements file or `frontend/package.json`
and has a card, and every method of the SDD's method ladder has a card with its equations, the constants as the code has
them, where it runs, its tests and what it is not. The full index, with the pins, is [frameworks/README.md](frameworks/README.md).

## Methods (the ladder of the SDD)

| Card | Method |
|---|---|
| [10, feed and sieve grid](frameworks/10_feed-and-sieve-grid/feed-sieve.md) | M1 Rosin-Rammler feed on the square-root-of-two grid |
| [11, breakage function](frameworks/11_breakage-function/breakage.md) | M2 JKMRC t10 and the Austin appearance function |
| [12, classification](frameworks/12_classification/classification.md) | M3 Andersen and Napier-Munn K1, K2, K3 |
| [01, Whiten engine](frameworks/01_whiten-engine/whiten.md) | M4 the population balance, and the engine as a whole |
| [13, capacity](frameworks/13_capacity/capacity.md) | M5 the Evertsson capacity hump |
| [14, regimes and nip angle](frameworks/14_regimes-and-nip-angle/regimes.md) | M6 |
| [09, power](frameworks/09_power_model/power-model.md) | M7 Bond and the current-based form, with the honest negative |
| [16, HP500 calibration](frameworks/16_hp500-calibration/hp500-calibration.md) | M8 the Andersen-Whiten fit |
| [15, envelope gate](frameworks/15_envelope-gate/envelope.md) | M9 |
| [08, CrusherCal](frameworks/08_calibration_validation/calibration-validation.md) | M10 leave-one-survey-out validation |
| [05, surrogate MLP](frameworks/05_surrogate/surrogate.md) | M11 |
| [06, denoising autoencoder](frameworks/06_denoising-ae/denoising-ae.md) | M12 |
| [07, DEM landscape](frameworks/07_dem_pbm_landscape/dem-pbm.md) | the frontier, not a method of the product |

## Engines

[02, PyTorch](frameworks/02_pytorch/pytorch.md), [03, ONNX and onnxruntime](frameworks/03_onnx-onnxruntime/onnx.md),
[04, NumPy](frameworks/04_numpy/numpy.md).

[00, card TEMPLATE](frameworks/00_TEMPLATE.md) is the form for a new engine card, copied to
`frameworks/<NN>_<tool>/<tool>.md`.
