# PyTorch (`torch==2.12.1`, CPU)

## What and why

PyTorch trains the two learned models of the product, the surrogate MLP and the denoising autoencoder, and exports
them to ONNX. The learned tier gives an instant what-if and an extrapolation score in the browser, which the engine's
closed form does not give as a single differentiable forward pass. Training is small: 6430 labelled points per model, a
network of a few thousand parameters, full-batch, on the CPU. It never runs in CI and never in the browser (ADR-0074).

Lane: offline, the heavy precompute lane only (`requirements-precompute.txt`). The default bake `run.py all` never
imports torch.

## Install

```
pip install torch==2.12.1 --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements-precompute.txt
```

`scripts/setup.sh` and `scripts/setup.ps1` build `.venv-pipeline` from `requirements-precompute.txt` and
`requirements-dev.txt`; the file pins `torch==2.12.1`, `onnx==1.22.0` and `onnxruntime==1.27.0`. The environment
documenting this page reports Python 3.13.14 and torch 2.12.1+cpu.

## Usage

```
python data-pipeline/run.py models                      # train both slots, evaluate them held-out, refresh the index and readiness
python data-pipeline/run.py models --output <sandbox>   # the same into a sandbox (use this to try it)
```

`stages/train.py` (`run`) does, in order:

1. `torch.set_num_threads(1)` and `torch.manual_seed(12345)` (the seed is a parameter), so the run is deterministic;
2. draws 1400 Latin-hypercube points per machine with the seeded generator of `model/sweep.py` and labels them with the
   canonical engine, dropping the degenerate draws (6430 remain), plus an independent held-out draw (seed 67890,
   480 points per machine, 2196 remain);
3. standardises inputs and outputs with statistics of the training draw only, stored as float32;
4. trains the surrogate (Adam, learning rate $2 \times 10^{-3}$, weight decay $10^{-5}$, 500 full-batch epochs, MSE in
   standardised space) and the autoencoder (the same optimiser, 400 epochs, MSE of the reconstruction of the input
   noised by Gaussian noise of standard deviation 0.05);
5. exports both with `torch.onnx.export(..., opset_version=17, dynamo=False)` and a dynamic batch axis, and the
   dynamically quantised int8 surrogate with `onnxruntime.quantization.quantize_dynamic`;
6. measures the export parity (the trained module against the float32 graph, on the held-out draw) before the module is
   discarded, and writes the contracts `surrogate.json` and `psd-ae.json` with the graphs' sha256.

Measured on 2026-10-27 on the documenting workstation, `run.py models` into a sandbox (train and evaluate together)
took 76 s, and its metrics equal the committed `data/derived/model-metrics.json` for the fields compared (P80 R2 and
MAPE, the detection rate), so the run reproduces.

## Applying to other data

Change the operating envelopes (`RANGES` in `model/sweep.py`) or the engine, then rerun `run.py models`: the networks are
retrained on a freshly labelled sweep. The 11-input and 10-output encoding is the contract (catalog rows
`surrogate-model` and `anomaly-model`); nothing in it is plant specific. See [guide 03](../../guides/03_gpu-lane.md).

## Caveats

- The labels come from the engine, so a retrained model emulates the engine, not a plant.
- Full-batch Adam on the CPU is deterministic for a seed on one machine; a different torch build may differ in the last
  digits, which is why the committed contracts record the sha256 of the graphs they describe.
