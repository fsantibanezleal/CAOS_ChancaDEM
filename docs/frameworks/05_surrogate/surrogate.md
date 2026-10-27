# Method, the surrogate MLP (M11)

## What it is

A small multilayer perceptron that emulates the crusher engine in one differentiable forward pass: the operating point
in, the product sizes, the gradation readouts, the throughput and the power out. It gives the browser an instant what-if
and a learned model to compare with the engine. It emulates the engine, which is a cheap phenomenological model; it does
not emulate a plant. Its slot in the catalog is the row `surrogate-model`, and its baseline, the answer when no valid
bundle is released, is the engine itself.

## Architecture and training

`model/surrogate.py`, a 11-64-64-32-10 network with GELU activations:

$$\mathrm{Linear}(11,64) \to \mathrm{GELU} \to \mathrm{Linear}(64,64) \to \mathrm{GELU} \to \mathrm{Linear}(64,32) \to \mathrm{GELU} \to \mathrm{Linear}(32,10)$$

(layers applied left to right). Input: five machine one-hot columns in the order cone-sec, cone-tert, jaw,
cone-short-head, gyratory, then six standardised continuous columns (CSS, throw, speed, feed $x_{63}$, feed $m$,
$A \times b$). Output, in order: `p80_mm`, `p50_mm`, `p20_mm`, `pass_1`, `pass_4`, `pass_8`, `pass_16`, `pass_32`,
`throughput_tph`, `power_kw`; the three sizes are fitted in $\log_{10}$ and raised to the power of ten when read.

Training (`stages/train.py`, see the [PyTorch card](../02_pytorch/pytorch.md)): Latin-hypercube sweep of the canonical
engine, 1400 points per machine over that machine's own ranges (a gyratory never runs a 6 mm setting), degenerate draws
dropped (a setting at or above the feed top, an ill-conditioned matrix, a reduction ratio under 1.02, a non-positive
$P_{80}$), 6430 training points; Adam at $2 \times 10^{-3}$, weight decay $10^{-5}$, 500 full-batch epochs, mean squared
error in standardised space, seed 12345. The Bond work index of a sweep point follows the ore: $W_i = \mathrm{clamp}(8 +
(120 - A \times b) \times 0.09,\, 8,\, 20)$, so the model keeps six continuous inputs.

## Held-out evaluation

Held out is an independent second Latin-hypercube draw (seed 67890, 480 points per machine, 2196 remain), not a split of
the training draw. Every number is computed through onnxruntime on the shipped float32 graph against the canonical engine
(`stages/evaluate.py`). From `data/derived/model-metrics.json`:

| Output | R2 | MAPE (percent) | MAPE int8 (percent) |
|---|---|---|---|
| `p80_mm` | 0.9970 | 4.063 | 4.568 |
| `p50_mm` | 0.9947 | 5.732 | 6.125 |
| `p20_mm` | 0.9886 | 9.213 | 9.480 |
| `pass_1` | 0.9868 | 8.115 | 8.329 |
| `pass_4` | 0.9884 | 7.700 | 7.909 |
| `pass_8` | 0.9930 | 5.296 | 5.644 |
| `pass_16` | 0.9936 | 5.293 | 5.538 |
| `pass_32` | 0.9971 | 2.730 | 2.869 |
| `throughput_tph` | 0.9984 | 5.017 | 5.434 |
| `power_kw` | 0.9792 | 6.466 | 6.431 |

Also: $P_{80}$ does not fall by more than 0.001 mm as the setting opens, on 15 curves (16 settings across each machine's
range at 25, 50 and 75 percent of its other inputs): `p80_monotone_vs_css` is true. Export parity, the maximum absolute
difference of the standardised outputs: torch against float32 graph $1.7 \times 10^{-6}$, float32 against int8 0.235.

## Where it runs

Training and evaluation offline (`run.py models`); inference in the browser through onnxruntime-web (the
[ONNX card](../03_onnx-onnxruntime/onnx.md)), in the Learned group of the workbench, labelled with the model that
answered. Retrained models replace the contract and the graphs; nothing else changes.

## Tests

- `tests/contracts/test_models.py::test_metrics_validate` and `test_adversarial_swap_engine_baseline_and_surrogate` (the
  gates of M11): the metrics document validates, and swapping the engine baseline for the surrogate keeps the contract.
- `frontend/src/lib/ort.test.ts`: the browser encoding and decoding against the reference fixture.

## What it is not

- Not an emulator of a plant: "accurate" here means agrees with the engine on the training envelope.
- Not trusted outside that envelope: the autoencoder and the envelope gate exist for that, see the
  [autoencoder card](../06_denoising-ae/denoising-ae.md).
- Not an uncertainty model: it returns one value per output.

## References

- Koh, Amini, McLachlan and Beaton 2021, [doi:10.1016/j.mineng.2021.107026](https://doi.org/10.1016/j.mineng.2021.107026),
  the state of the art for a neural surrogate of a phenomenological comminution model.
