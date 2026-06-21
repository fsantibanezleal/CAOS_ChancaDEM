# ChancaDEM — Crusher-Comminution Studio

> Set the machine, eccentric speed, throw, closed-side-setting (CSS) and feed size distribution on a cone, jaw or
> gyratory crusher and watch the product gradation, throughput and power form — and understand *why*. A didactic
> comminution sandbox, not a plant control system. Part of the **Faena** mining-analytics hub.

Live: **https://chancadem.fasl-work.com**

## What it is

ChancaDEM couples three cited comminution models, all running **live in pure TypeScript**:

- **Whiten classification–breakage** population balance — product `p = (I − C)(I − B·C)⁻¹·f`, with the breakage
  matrix `B` built from the JKMRC **t10** energy→fineness curve and the **Austin** appearance function.
- **Evertsson** flow-capacity model — the unimodal capacity hump vs eccentric speed.
- **Bond** power.

On top, two **learned ONNX models** run in-browser (trained offline on the population-balance engine): a
population-balance **surrogate MLP** for instant what-ifs and a **denoising autoencoder** operating-anomaly score
that also flags when the surrogate is extrapolating. The 3D view replays **DEM** particle traces precomputed
offline (industrial DEM is infeasible in a browser).

## Architecture

Instantiated from the CAOS product-repo archetype (ADR-0057): a heavy **offline engine** + a **frontend SPA**, bound
by two data contracts. See [`STRUCTURE.md`](STRUCTURE.md) and the [`docs/`](docs/README.md) wiki.

```
OFFLINE  data-pipeline/chancalab/ (Node sweep + torch)   LIVE  frontend/src/ (browser, TypeScript)
  sweep/gen_sweep.mjs  LHS over the TS engine               physics/  Whiten + Evertsson + Bond engine (<1 ms)
  stages/train.py      surrogate MLP + denoising AE         lib/ort.ts onnxruntime-web (surrogate + AE)
  stages/evaluate.py   held-out R²/MAPE + P80-monotone gate viz/      three.js + uPlot, zustand store
        │  --retrain regenerates the artifacts
        ▼
  data/derived/  models/*.onnx · scaler/ae_scaler/ae_threshold · surrogate_metrics.json · case-results.json
        │  (the committed compact artifacts = the offline lane's real outputs)
        ▼
  pipeline (numpy) → data/derived/<case>/trace.json + manifests/  (CONTRACT 2; copy-data overlays into frontend/public)
```

The default pipeline is **numpy-only** (rebuilds the replay layer from the committed artifacts), so a clone replays
without torch or Node. Heavy work (the Node sweep of the TS engine + torch training) is the local-only `--retrain`.

## Develop

```bash
./scripts/setup.sh            # venvs + light deps + editable pkg (numpy+ruff+pytest)   [.ps1 on Windows]
./scripts/precompute.sh       # python -m chancalab.pipeline all  (rebuild the replay layer, numpy-only)
.venv-pipeline/bin/python -m pytest    # 9 passed     ·     ./scripts/smoke.sh   # CONTRACT 2 OK
./scripts/dev.sh              # cd frontend && npm install && npm run dev (vite + live TS engine + ONNX)
cd frontend && npm run build  # tsc --noEmit && vite build (+ copy-data overlay + SPA 404.html)

# regenerate the models from the engine (local-only, torch + Node 20+):
./scripts/setup.sh --precompute && ./scripts/precompute.sh all --retrain
```

## Honesty

The K1/K2/K3 classification constants and the operating-energy coupling are **illustrative** — they reproduce the
correct trends (CSS↓ ⇒ finer product; the capacity hump), not a specific plant's absolute numbers, pending
calibration to open industrial data (Duarte et al. 2021, CC-BY). Synthetic numbers are labelled as such; no
benchmark numbers are fabricated.

## License

Source-available for review. © Felipe Santibáñez-Leal.
