# ONNX, onnxruntime and onnxruntime-web

## What and why

ONNX is the portable model format between the offline training lane and the browser. Three pinned packages carry it:
`onnx==1.22.0` (writes and inspects the graphs), `onnxruntime==1.27.0` (offline: the held-out evaluation runs the shipped
graphs through it, and `quantize_dynamic` produces the int8 graph) and `onnxruntime-web` `1.27.0` (the live
in-browser inference), all from `requirements-precompute.txt` and `frontend/package.json`.

The committed graphs, under `data/derived/models/`:

| File | Bytes | Input | Output |
|---|---|---|---|
| `surrogate.onnx` | 32449 | `x`: float32 [n, 11] | `y`: float32 [n, 10] |
| `surrogate.int8.onnx` | 15880 | `x`: float32 [n, 11] | `y`: float32 [n, 10] |
| `psd-ae.onnx` | 5859 | `x`: float32 [n, 14] | `xr`: float32 [n, 14] |

The int8 graph is dynamically quantised weights. Its held-out error is reported beside the float32 one, never silently
used: its worst standardised difference from the float32 graph is 0.235, and its MAPE stays within about half a point
(`data/derived/model-metrics.json`, `surrogate.parity` and `per_output`).

## The contract that binds the two sides

Each model has a JSON contract (`surrogate.json`, `psd-ae.json`; catalog rows `surrogate-model` and `anomaly-model`)
that carries everything the graph's meaning depends on: the order of the machines and of the inputs, the means and
standard deviations, which outputs are log10, the feature order of the autoencoder, its threshold, and the sha256 and
the size of each graph. `data-pipeline/pipeline/model/bundles.py` decides a slot is released only when the contract
validates against its schema and every graph exists with that sha256 and size; otherwise the slot answers with its
baseline (the engine itself for the surrogate, the envelope gate for the autoencoder) and readiness says `training`.

The web side, `frontend/src/lib/ort.ts`, takes the encoding and decoding entirely from the contract, so a retrained model
ships by replacing its contract and its graph. The runtime is single-threaded WASM (a static host has no COOP and COEP
headers for threaded WASM); the WASM binary is bundled from the npm package, the same release as the JavaScript, and served
from the site, so no CDN is asked at run time. Calls to one model are serialised, because onnxruntime-web forbids
concurrent runs on one session.

## The bug this guards against

A train and serve mismatch. The Python encodings (`model/crusher/encoding.py`) reproduce the browser's feature encoding
byte for byte against the frozen contract values (float32 rounding included), and `frontend/src/lib/ort.test.ts` checks
the browser functions against `tests/fixtures/engine-reference.json`. The export itself is checked twice: the maximum
absolute difference between the trained torch module and the float32 graph on the held-out draw is recorded by the train
stage ($1.7 \times 10^{-6}$ in the committed contract), and the evaluation recomputes every metric through onnxruntime on the
shipped graphs.

## Opset

Both graphs are exported with opset 17 (`OPSET` in `stages/train.py`, recorded in each contract). The exact
compatibility of opset 17 with onnxruntime-web 1.27.0 is demonstrated by the browser tests passing on the shipped
graphs; no compatibility table was consulted for this page (UNVERIFIED as a vendor statement).

## Caveats

- ONNX is a transport, not a validity statement: what the model answers is judged by the held-out metrics, see the
  [surrogate card](../05_surrogate/surrogate.md).
- Raising the onnxruntime pin requires raising the onnxruntime-web pin with it, and re-running the model evaluation.
