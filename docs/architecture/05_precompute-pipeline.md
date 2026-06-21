# 05 — The staged precompute pipeline (two-language)

`data-pipeline/chancalab/stages/` — six named, seeded, typed stages. The offline lane is **two-language**: a Node
sweep generates the labels by running the SAME TypeScript engine (no Python re-port — the lesson from the sibling
products is that a re-port diverges from the live engine), then Python fits the ONNX models.

| Stage | What it does | Deps | Skippable? |
|---|---|---|---|
| `preprocess` | load the LHS sweep (jsonl) + apply CONTRACT 1 over the operating points | numpy/stdlib | no |
| `feature_extraction` | encode inputs (5 one-hots + 6 continuous = 11), outputs (10, log-space sizes), AE signature (14) | numpy | no |
| `train` | fit the surrogate MLP (Adam 2e-3, 500 ep) + the denoising AE (Adam 2e-3, 400 ep) | torch | **yes** — reuse the committed ONNX if present |
| `infer` | run the surrogate over the held-out rows + inverse-transform to original units | torch | no |
| `evaluate` | held-out per-output R²/MAPE + the **P80-monotone-vs-CSS** gate + the AE p99 threshold; emits the frozen scalers | torch | no |
| `export` | CONTRACT 2: write surrogate.onnx + psd-ae.onnx (opset 17) + scalers + metrics; then build the per-case replay traces + manifests | torch (models) / numpy (replay) | replay path always runs |
| `dem` | the offline 2-D DEM tracer (`dem.py`) — the documented next-increment 3D-replay upgrade | numpy | WIP |

`pipeline.py` orchestrates them. The **default** invocation only runs the light replay path (`export.build_replay`)
over the committed `case-results.json`; `--retrain` runs the Node sweep + the heavy stages first, then re-bakes
`case-results.json` (`sweep/bake_cases.mjs`, the TS engine over the 17 cases).

## The labels come from the engine, not a plant

The sweep is a Latin-hypercube over each machine's REAL operating envelope (a gyratory never runs a 6 mm CSS), each
point evaluated by the live TS engine — so the surrogate learns each machine's true regime, and honestly emulates the
calibrated physics, NOT a real plant. Held-out = an independent 2nd LHS draw (seed 67890), not a row-split.
