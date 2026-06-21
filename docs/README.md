# ChancaDEM — documentation wiki

The navigable wiki for ChancaDEM (ADR-0056), authored as the product is built. ChancaDEM is a public, didactic
**crusher-comminution studio**: set the machine, eccentric speed, throw, closed-side-setting (CSS) and feed size
distribution on a cone / jaw / gyratory crusher and watch the product gradation, throughput and power form — a
pure-TypeScript **Whiten population-balance + Evertsson capacity + Bond power** engine runs live, with a learned
**surrogate MLP** (instant differentiable what-if) and a **denoising autoencoder** (operating-anomaly / OOD score),
both running in the browser via onnxruntime-web.

## What it is / what it is NOT

* **Is:** a real, interactive comminution sandbox — pick one of 17 circuit cases (primary gyratory/jaw, secondary
  cone, tertiary cone/short-head, + negative/invalid/calibration controls), move the sliders, and every view reacts;
  the surrogate gives an instant what-if and the AE flags when you steer off the trained manifold.
* **Is NOT:** a plant control system. The physics **engine is the source of truth and the surrogate emulates IT**,
  NOT a real plant; the engine is calibrated to published cone data (Duarte et al. 2021). The 3D chamber is a
  kinematic animation; the offline 2-D DEM tracer is the documented next increment. No real plant data is used.

## Map

| Folder | What it answers |
|---|---|
| [`architecture/`](architecture/README.md) | the two data contracts, the staged offline pipeline (two-language), the lane gate, determinism, model evaluation, deploy |
| [`frameworks/`](frameworks/README.md) | the binding engines (the Whiten/Evertsson/Bond TS engine, PyTorch, ONNX/onnxruntime, NumPy) + the method cards (surrogate MLP, denoising AE) |
| [`cases/`](cases/README.md) | the 17-case circuit matrix by category + the controls + the honesty |
| [`guides/`](guides/README.md) | run the pipeline, regenerate the models (Node sweep + torch), bring your own operating point |
| [`../data/README.md`](../data/README.md) | the data contract (Contract 1 schema + outlier policy; Contract 2 artifact layout) |

## The three lanes (at a glance)

1. **Offline (precompute, heavy, two-language)** — a Node sweep of the TS engine (`sweep/gen_sweep.mjs`) produces the
   labels; torch trains the surrogate + AE and exports ONNX. Local-only (`--retrain`); outputs committed under
   `data/derived/`.
2. **Live (client-side)** — the TS Whiten/Evertsson/Bond engine + onnxruntime-web (surrogate + AE), in the browser.
3. **Replay (static)** — the committed per-case traces + metrics; the default (numpy-only) pipeline rebuilds them.
