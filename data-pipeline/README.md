# data-pipeline/ — the offline engine (`chancalab`)

The staged, seeded, contract-bounded offline pipeline for ChancaDEM (ADR-0057). Install editable from the repo root
(`pip install -e .`); run with `python -m chancalab.pipeline`.

```
chancalab/
├─ __init__.py            # __version__ = "0.03.000"
├─ pipeline.py            # orchestrator + CLI (light replay by default; --retrain runs the heavy two-language lane)
├─ registry.py            # cases grouped by CATEGORY (primary / secondary / tertiary / controls)
├─ live.py                # Pyodide live-lane entrypoint — DORMANT (ChancaDEM's live lane is the TS engine + ONNX)
├─ io/      contract.py (CONTRACT 1: operating-point schema + envelopes + outlier policy + PSD guard) · schema · formats
├─ core/    rng · trace.py (CONTRACT 2 chancadem.trace/v1) · manifest.py (chancadem.manifest/v2) · gate.py (lane gate)
├─ model/   surrogate.py (MLP 11→…→10) · psd_ae.py (denoising AE 14→6→14) — torch
├─ stages/  preprocess · feature_extraction · train · infer · evaluate · export · dem.py (offline 2-D DEM tracer, WIP)
├─ cases/   circuit_cases.py (the 17-case circuit matrix)
└─ sweep/   gen_sweep.mjs (LHS over the op-space via the TS engine) · bake_cases.mjs (the 17 cases → case-results.json)
```

**Two lanes:**

* **Default (light, numpy-only)** — `python -m chancalab.pipeline all` rebuilds every per-case replay trace +
  manifest from the committed `case-results.json` + `surrogate_metrics.json`. No torch, no Node — a clone replays.
* **Heavy (`--retrain`)** — `pipeline all --retrain` runs the **Node sweep** of the TS Whiten engine
  (`sweep/gen_sweep.mjs`, no Python re-port) → torch trains the surrogate + AE → exports ONNX + metrics, then
  re-bakes `case-results.json`. Needs the `--precompute` setup (torch) + **Node 20+**. See
  `docs/guides/01_precompute-pipeline.md`.
