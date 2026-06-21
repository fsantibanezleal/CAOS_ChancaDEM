# ONNX / onnxruntime / onnxruntime-web

**What:** the portable model format (`onnx==1.22.0`) + the runtimes — `onnxruntime==1.27.0` (offline parity +
the int8 quantization for the honest size/latency table) and `onnxruntime-web^1.27.0` (the live in-browser
inference).
**Why binding:** ONNX is the contract between the heavy torch training lane and the light client-side lane. The
exported `surrogate.onnx` (input `x:[N,11] → y:[N,10]`) and `psd-ae.onnx` (input `x:[N,14] → xr:[N,14]`) are small
and committed under `data/derived/models/`. `surrogate.int8.onnx` is a dynamic-int8 variant kept ONLY for the honest
size/latency comparison — its slightly-worse MAPE is reported, never silently used.

## The version pin (load-bearing)

`frontend/src/lib/ort.ts` pins both the npm package AND the WASM CDN to the SAME version:
```ts
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
ort.env.wasm.numThreads = 1;
```
A drift between the npm version and the `wasmPaths` CDN silently breaks the JS/WASM contract → no prediction. The
export opset (17) is compatible with onnxruntime-web 1.27.0.

## The #1 deployment bug it guards against

A train/serve scaling mismatch. The frozen `scaler.json` (input z-scoring + the one-hot order) and `ae_scaler.json`
are written offline and applied IDENTICALLY in the browser (`physics/surrogate.ts`); a PyTorch↔onnxruntime parity
check on fixed vectors (`assert parity < 1e-4`) guards the export.
