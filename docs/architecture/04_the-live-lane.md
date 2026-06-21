# 04 — The live lane (client-side)

ChancaDEM's live lane is a **pure-TypeScript physics engine + onnxruntime-web**, not Pyodide. The archetype permits
either ("Pyodide + lightweight wheels, OR a small TS engine") — ChancaDEM's engine is the SAME physics the offline
sweep uses, so the live lane is faithful, not a toy surrogate.

## The physics engine (`frontend/src/physics/`)

* **Whiten population balance** — `p = (I−C)(I−B·C)⁻¹·f`: a classification/selection matrix `C` (probability a
  particle is broken per pass) and a breakage/appearance matrix `B` (the JKMRC t10→Austin distribution of progeny),
  solved on a geometric sieve grid. `whiten.ts`, `breakage.ts`, `classification.ts`, `sieve.ts`, `linalg.ts`.
* **Evertsson capacity** — the throughput "hump" vs eccentric speed (`capacity.ts`).
* **Bond power** — specific energy from the work index and the F80→P80 reduction (`engine.ts`).
* **Validity guards** — mass closure `|Σproduct − Σfeed| ≈ 0`, a conditioning estimate of `(I − B·C)`, and the
  pass-through / invalid regime flags (`types.ts` `CrusherResult`).

## Inference (`frontend/src/lib/ort.ts` + `physics/surrogate.ts`)

```ts
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
ort.env.wasm.numThreads = 1;   // Pages has no COOP/COEP for threaded WASM
```

* `surrogate(x11)` → 10 outputs (the instant differentiable what-if).
* `psdAE(x14)` → reconstruction (its error = the operating-anomaly / OOD score).

The 11-D input one-hot order and the z-scoring are read from the committed `scaler.json` (and `ae_scaler.json`) — the
SAME encoding `feature_extraction.py` produces offline, so the in-browser surrogate matches the held-out evaluation
byte-for-byte. The onnxruntime-web npm version and the `wasmPaths` CDN are pinned to the SAME version (1.27).

## Live-vs-offline parity (the thing to guard)

The browser must reproduce the offline numbers: the one-hot index order (`physics/surrogate.ts` MACHINES ==
`scaler.json` inputOrder == `feature_extraction.MACHINES`) and the z-scoring must match exactly, or the surrogate
predicts garbage. The surrogate emulates the engine, so the live "surrogate-vs-engine" parity is the headline check.
