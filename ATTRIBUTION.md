# Attribution — models & methods

## Physics models (DOI-verified — see `frontend/src/data/citations.ts`)

| Model | Reference |
|---|---|
| Crusher population balance | Whiten (1972), *The simulation of crushing plants with models developed using multiple spline regression* |
| Breakage / appearance (t10 → progeny) | JKMRC drop-weight t10; Austin appearance function |
| Cone-crusher capacity | Evertsson (2000), *Cone Crusher Performance* (Chalmers) |
| Comminution power | Bond's third theory of comminution |
| **Calibration anchor** | **Duarte, Pereira, et al. 2021**, Minerals 11(11):1256 — DOI 10.3390/min11111256 |

## Data / honesty

ChancaDEM uses **no real plant data**. The physics engine (Whiten/Evertsson/Bond) is the source of truth; it is
calibrated to the published cone data above (the CK1 control anchors absolute numbers). The learned tier (a surrogate
MLP + a denoising autoencoder) is trained on a Latin-hypercube **sweep of that engine** — so the surrogate honestly
emulates the calibrated physics model, NOT a plant. The held-out surrogate metrics are vs an independent 2nd LHS draw
of the engine. The 3D chamber is a kinematic animation (honestly labelled); the offline 2-D DEM tracer is the
documented next increment. No fabricated benchmark numbers.
