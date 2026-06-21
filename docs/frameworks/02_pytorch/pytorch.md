# PyTorch (`torch==2.12.1`, CPU)

**What:** trains the surrogate MLP + the denoising AE on the sweep and exports them to ONNX.
**Why binding:** the learned tier (an instant differentiable what-if + the OOD score) is what the closed-form grid
cannot give live. Training is tiny (a small MLP + AE over a few thousand sweep points, seconds on CPU) — no GPU.

**Lane:** offline only (`stages/{train,infer,evaluate,export}.py`). Never shipped to the browser.

## Install

```
pip install torch==2.12.1 --index-url https://download.pytorch.org/whl/cpu
```
(or `./scripts/setup.sh --precompute`, which installs it + `requirements-precompute.txt`). Also needs Node 20+ for
the sweep.

## Usage

```
./scripts/precompute.sh all --retrain   # node sweep -> train -> infer -> evaluate -> export ONNX -> re-bake cases
```

`train.run` seeds `torch.manual_seed(0)`; `export.export_models` calls `torch.onnx.export(..., opset_version=17,
dynamo=False, dynamic_axes={0:'n'})` for both models, then writes the frozen scalers + `surrogate_metrics.json`.

## Applying to other data

Re-run `--retrain` to re-fit on a re-generated sweep (e.g. after extending the operating envelopes or adding a
machine). The 11-D input + 10-D output encoding is the contract; nothing is plant-specific.
