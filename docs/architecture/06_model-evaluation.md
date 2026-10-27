# Model evaluation (the held-out stage)

`stages/evaluate.py` reports the held-out metrics of the two released model slots into `data/derived/model-metrics.json`
(`chancadem.model-metrics/v1`, catalog row `model-metrics`). It is the honest part of the learned tier, in three rules.

1. **Held out means a disjoint draw.** The holdout is an independent second Latin-hypercube draw (seed 67890, 480 points per
   machine, the degenerate draws dropped, 2196 remain), never a split of the 6430 training points.
2. **The shipped graphs are what is scored.** Every number is computed through onnxruntime on the graphs the site serves
   (the float32 one, and the int8 one for its MAPE), against the canonical Python engine. Torch is not used. A slot whose
   bundle is invalid is refused with a `ValueError` naming the file; nothing is written then.
3. **"Accurate" means agrees with the engine, not matches a plant.** The surrogate emulates a cheap calibrated physics
   model. The document's `note` says so, and the Benchmark page carries it.

## What is reported

Surrogate: per output the R2 and the MAPE in original units (MAPE only where the truth is not near zero), the MAPE of the
int8 graph, the parity of the trained torch module against the float32 graph (measured by the train stage right after export
and carried in the surrogate contract) and of float32 against int8 (maximum absolute difference of the standardised
outputs), and the monotonicity of $P_{80}$ in the closed-side setting: per machine, at the 25, 50 and 75 percent points of the
other inputs, 16 settings across the range, 15 curves; $P_{80}$ may not fall by more than 0.001 mm as the setting opens.
The values are in the [surrogate card](../frameworks/05_surrogate/surrogate.md).

Autoencoder: the false-alarm rate on the held-out points and the detection rate on planted off-manifold points (one per
held-out point, its inputs moved outside that machine's training range by half the range width, then run through the
engine), beside the envelope gate's rates on the same points. The values and the reading are in the
[autoencoder card](../frameworks/06_denoising-ae/denoising-ae.md).

The CrusherCal validation of the HP500 lane is a separate document with its own controls
([card](../frameworks/08_calibration_validation/calibration-validation.md)); it needs no training.

## Determinism and checks

A rerun on the same graphs reproduces the document byte for byte; on 2026-10-27 a full retrain into a sandbox reproduced the
committed metrics for the fields compared. The gates are `tests/contracts/test_models.py` (the metrics validate against the
schema, report the anomaly comparison and the planted points, and the two adversarial swap tests that put the baseline in
place of the released model and keep the contract), the units gate on every baked case, and the web's contract test over the
committed metrics.

Calibration anchors stay disjoint from validation: the surveys never enter the training sweep, and CrusherCal refits every
fitted scalar without the held-out survey.
