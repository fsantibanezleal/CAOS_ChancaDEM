# Attribution, models & methods

## Physics models (DOI-verified, see `frontend/src/data/citations.ts`)

| Model | Reference |
|---|---|
| Crusher population balance | Whiten (1972), *The simulation of crushing plants with models developed using multiple spline regression* |
| Breakage / appearance (t10 to progeny) | JKMRC drop-weight t10; Austin appearance function |
| Cone-crusher capacity | Evertsson (2000), *Cone Crusher Performance* (Chalmers) |
| Comminution power | Bond's third theory of comminution |
| **Calibration anchor** | **Duarte, Pereira, et al. 2021**, Minerals 11(11):1256, DOI 10.3390/min11111256 |

## Data / honesty

### Real data: the HP500 surveys (CC BY 4.0)

The real lane of ChancaDEM uses the ten industrial surveys of a Metso HP500 secondary cone crusher at the Minas Rio
operation (itabirite iron ore), published as Table A1 of:

> Rocha, B.K.N.d.; Campos, T.M.; Silva, J.; Tavares, L.M. Fit-for-Purpose Model of HP500 Cone Crusher in Size
> Reduction of Itabirite Iron Ore. *Minerals* 2024, 14(9), 919. https://doi.org/10.3390/min14090919

The paper is open access under the Creative Commons Attribution 4.0 International licence (CC BY 4.0,
https://creativecommons.org/licenses/by/4.0/). The calibration constants (Table 5), the ore drop-weight and Bond work
index values (Table 1) and the capacity base (Table 4) come from the same paper.

Files that carry the data or derive from it, each under CC BY 4.0 with this attribution:

- `data/examples/hp500-surveys.csv`: the ten survey rows (f80, closed-side setting, feed rate, power).
- `data/derived/hp500/backbone.json` and `data/derived/hp500/loo.json`: the calibrated backbone at each survey and the
  CrusherCal leave-one-survey-out validation.
- `data/derived/manifests/HP500-*.json` and `data/derived/HP500-*/trace.json`: the ten real case manifests and traces.

What was changed from the source: the survey values were transcribed verbatim from Table A1; the feed size
distribution was reconstructed from the measured f80 with a Rosin-Rammler band (m = 0.9), because the paper publishes
its curves as figures only; the power is the paper's estimate from the measured current; the backbone is the product's
engine with the paper's Table 5 calibration run at each survey; the validation models are fitted by the product.
No endorsement by the authors, the operation or the publisher is implied.

### Own work (MIT)

The synthetic cases, the Latin-hypercube sweeps of the engine and the learned models trained on the engine (a
surrogate MLP and a denoising autoencoder) are the product's own work under the MIT licence of this repository. The
learned tier emulates the physics engine, NOT a plant; the held-out surrogate metrics are against an independent second
draw of the engine. The physics engine (Whiten/Evertsson/Bond) is the source of truth and its non-calibrated constants
are illustrative. The 3D chamber is a kinematic animation (honestly labelled). No fabricated benchmark numbers.
