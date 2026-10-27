# Method, the denoising autoencoder as an extrapolation score (M12)

## What it is

An autoencoder over a 14-feature signature of an engine result. Its reconstruction error is an anomaly score: a result
far from the manifold the models were trained on reconstructs badly, which says "the learned surrogate is
extrapolating, distrust it". Its slot in the catalog is the row `anomaly-model`; its baseline, the answer when no valid
bundle is released, is the [envelope gate](../15_envelope-gate/envelope.md).

## Architecture and training

`model/psd_ae.py`, 14-16-6-16-14 with GELU:

- encoder: Linear(14, 16), GELU, Linear(16, 6), GELU;
- decoder: Linear(6, 16), GELU, Linear(16, 14).

The 14 features, in the order of the contract: $\log_{10}P_{80}$, $\log_{10}P_{50}$, $\log_{10}P_{20}$, the percent
passing at 1, 4, 8, 16 and 32 mm, throughput, power, reduction ratio, $\log_{10}F_{80}$, specific energy and the feed
$m$, standardised by the means and deviations of the training draw.

Training (`stages/train.py`): the same 6430 labelled points as the surrogate, Adam at $2 \times 10^{-3}$, weight decay
$10^{-5}$, 400 full-batch epochs, mean squared error between the reconstruction of the input noised by Gaussian noise
(standard deviation 0.05) and the clean input. The alarm threshold is the 99th percentile of the training scores,
0.24454 in the committed contract (mean training score 0.05181); a score above it, or a non-finite score, is an alarm.
The score is the mean squared error over the 14 standardised values.

## Held-out evaluation

From `data/derived/model-metrics.json`, `anomaly`, on the held-out draw of 2196 points:

| Quantity | Autoencoder | Envelope gate |
|---|---|---|
| false-alarm rate on held-out points | 0.0100 | 0.0000 |
| detection rate on 2196 planted off-manifold points | 0.2796 | 0.1389 |

A planted point is the held-out point with its inputs moved outside that machine's training range (one input above its
upper bound by half the range width, or below its lower bound at half the bound, or two neighbours in opposite
directions, cycling over 18 patterns), then run through the engine. The gate flags only implausible inputs on the
synthetic lane, so most plausible but out-of-range points pass it; the autoencoder scores distance from the manifold. The
detection rate of 28 percent is also modest: the score does not catch most of the planted points, so it is a
complement to the gate, not a replacement.

## Where it runs

Training and evaluation offline; the score in the browser through onnxruntime-web, from the Learned group, computed on
the live engine result of the current selection.

## Tests

- `tests/contracts/test_models.py::test_metrics_report_the_anomaly_comparison_and_the_planted_points` and
  `test_adversarial_swap_envelope_baseline_and_autoencoder` (the gates of M12).

## What it is not

- Not a fault detector for a plant: the training data are engine outputs, so it detects distance from the engine's
  sampled envelope, not a mechanical anomaly.
- Not a threshold with a guaranteed false-alarm rate on new data: 1 percent is measured on one held-out draw.

## References

- Gröndahl, Asbjörnsson, Hulthén and Evertsson 2018, [doi:10.1016/j.mineng.2018.07.008](https://doi.org/10.1016/j.mineng.2018.07.008),
  for the real power-draw signatures of feed segregation that motivate an anomaly view.
