# 01 — Regenerate the models (`--retrain`, two-language)

The heavy lane reproduces `surrogate.onnx`, `psd-ae.onnx`, the scalers, `surrogate_metrics.json`, and re-bakes
`case-results.json` — from the SAME TS engine the browser runs. Local-only (CI never retrains). Deterministic.

```bash
# 1) install the heavy engine (torch CPU + onnx) into .venv-pipeline (also needs Node 20+ for the sweep)
./scripts/setup.sh --precompute        # (PowerShell:  ./scripts/setup.ps1 -Precompute)

# 2) Node sweep of the TS engine -> torch train -> export ONNX/metrics -> re-bake case-results -> rebuild replay
./scripts/precompute.sh all --retrain
```

What runs (`pipeline.retrain`):
1. `node --import tsx sweep/gen_sweep.mjs 12345 cz-sweep 1400` (train) + `... 67890 cz-sweep-test 480` (held-out) —
   a Latin-hypercube over each machine's real envelope, evaluated by the live TS engine.
2. `preprocess` (Contract 1) → `feature_extraction` → `train` (surrogate 500 ep + AE 400 ep) → `infer` → `evaluate`
   (per-output R²/MAPE + the P80-monotone-vs-CSS gate + the AE p99) → `export` (ONNX + scalers + metrics).
3. `node --import tsx sweep/bake_cases.mjs` — the 17 cases through the engine → `case-results.json`.

Expect the held-out surrogate metrics + the monotone gate to match the committed `surrogate_metrics.json`
(determinism). CPU-fast (seconds + the sweep). No GPU (see `docs/frameworks/02_pytorch`).
