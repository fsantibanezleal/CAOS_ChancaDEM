# 01 — Overview

ChancaDEM is split into a heavy **offline engine** (`data-pipeline/chancalab/`) and a **frontend SPA**
(`frontend/`), bound by two data contracts. The committed compact artifacts under `data/derived/` are the offline
engine's real outputs and the SPA's replay payload.

```
operating points (CONTRACT 1) ──► LHS sweep via the TS engine (sweep/gen_sweep.mjs, Node) ──► labels (jsonl)
                                                                                                 │
                                                          torch train (stages/train.py) ────────►├─► surrogate.onnx, psd-ae.onnx  ┐
                                                          held-out evaluate (stages/evaluate) ──►├─► scaler/ae_scaler/ae_threshold │ data/derived/
                                                                                                 ├─► surrogate_metrics.json        │ (committed)
                                                  17 cases baked by the TS engine (bake_cases) ──┴─► case-results.json             ┘
                                                                                                 │
per-case replay (pipeline, numpy) ──(CONTRACT 2: core/manifest.py)─► data/derived/<case>/trace.json + manifests/
                                                                                                 │
frontend (copy-data.mjs overlays data/derived) ──► the TS engine + onnxruntime-web run LIVE in the browser
```

## Packages

* **`data-pipeline/chancalab/`** — the offline engine: `io/` (contracts, formats), `core/` (rng, trace, manifest,
  gate), `model/` (surrogate, psd_ae), `stages/` (the named pipeline + the offline 2-D DEM tracer `dem.py`),
  `cases/` + `registry.py` (the 17 cases by category), `sweep/` (the Node sweep + the case bake), `pipeline.py`
  (orchestrator + CLI), `live.py` (dormant Pyodide).
* **`frontend/`** — the React/Vite SPA: `src/physics/` (the TS Whiten/Evertsson/Bond engine), `src/lib/ort.ts`
  (onnxruntime-web), `src/viz/` (the visualizations), `src/pages/` (the 6 standard pages), `src/state/store.ts`
  (zustand), `src/lib/contract.types.ts` (the Contract-2 mirror).
* **`app/`** — a dormant FastAPI backend (ChancaDEM is static-first).

## The two lanes of the pipeline

* **Default (numpy-only):** `python -m chancalab.pipeline all` rebuilds every per-case replay trace + manifest from
  the committed `case-results.json` + `surrogate_metrics.json` — no torch, no Node. A clone replays immediately.
* **Heavy (`--retrain`, two-language):** Node runs the LHS sweep of the TS engine → torch trains the surrogate + AE
  → exports ONNX + metrics → re-bakes `case-results.json`. Needs the `--precompute` setup (torch) + Node 20+.
