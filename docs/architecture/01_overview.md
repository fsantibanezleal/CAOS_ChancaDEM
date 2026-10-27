# Architecture, overview

ChancaDEM is an instance of the CAOS product archetype (ADR-0057): the science runs offline, its results are committed,
and a static web workbench replays them and re-runs what is light enough, live. The base (the layout, the contracts, the
stage names, the lanes, the guards, the shared shell) is carried by the template and the shell; the product's own part is
the crusher engine, the 27 cases, the HP500 validation, the two learned models and the content.

The question it answers: for one crushing case, how do the closed-side setting, the eccentric throw, the eccentric speed
and the feed size distribution set the product size $P_{80}$, the throughput and the power, and how far can that answer
be trusted against ten measured surveys of an HP500 secondary cone. What it is and is not is stated in
[design/SDD.md](../design/SDD.md) (Problem and non-goals): a studio and a validation, not a sizing tool, not a
discrete-element simulator, not a grinding model, not a backend.

## The lanes

| Lane | Where | What runs |
|---|---|---|
| Offline | `data-pipeline/`, in `.venv-pipeline` | the canonical Python engine; the bake of the 27 cases; the HP500 documents; the training and the evaluation of the two models |
| Replay | `data/derived/`, copied into the site | the committed artifacts, read as they are |
| Live | `frontend/src/engine/` | the TypeScript port of the engine, re-run with the reader's values; the two ONNX models through onnxruntime-web |
| API | `app/` | dormant; a read-only layer over `data/derived` |

```
raw tables (data/examples/*.csv)
  contract 1 (params-record, hp500-survey)            data-pipeline/pipeline/io, hp500/surveys.py
  canonical engine, per case                          data-pipeline/pipeline/model/crusher/
  expected ranges and the units gate                  core/expect.py, core/unit_gate.py
  contract 2 (index, manifests, traces)               core/manifest.py, core/trace.py
  HP500 documents (backbone, CrusherCal)              hp500/backbone.py, hp500/loo.py
  models (train, evaluate)                            stages/train.py, stages/evaluate.py   [run.py models]
  readiness                                           core/readiness.py
committed into data/derived/
  copied exactly as declared into the site            frontend/scripts/copy-data.mjs
  replayed, plus the live engine and the models       frontend/src/
```

Each step reads the output of the one before. The lane gate ([architecture 03](03_the-gate.md)) decides by measurement
which cases are light enough to re-run live; in the committed bake all 27 are.

## The method ladder

Twelve methods, classical to learned, each with an acceptance criterion and a gate (the table is in the SDD,
Method ladder): the Rosin-Rammler feed on the sieve grid (M1), the JKMRC $t_{10}$ and Austin breakage (M2), the Andersen
and Napier-Munn classification (M3), the Whiten population balance (M4), the Evertsson capacity (M5), the regimes and
nip angle (M6), Bond power (M7), the HP500 calibration (M8), the envelope gate (M9), CrusherCal (M10), the surrogate
MLP (M11) and the denoising autoencoder (M12). Each has a card in [frameworks](../frameworks.md).

## The workbench

A single App route on the shell's `CaseWorkbench`: a rail with the case, the closed-side variant and six knobs (setting,
throw, speed, feed $x_{63}$, feed $m$, ore $A \times b$), and an instrument with the groups Chamber, Product,
Performance, Learned, Validation and the case's Context. Every view states whether it is live or replayed and whether its
data are synthetic or real. The header order is App, Introduction, Methodology, Implementation, Experiments, Benchmark.
The five diagrams of the in-app Architecture modal are in `frontend/src/architecture/` (the app, the lanes, the web
flow, the science, the data contracts).

## What holds it

- The pipeline tests run in a sandbox that fails the session if a committed artifact changes (`tests/conftest.py`).
- The contract tests validate every document the pipeline writes, the provider tree and every API response against the
  schema files; the web's contract test reads every committed artifact against the web's declaration in both directions.
- The shared engine reference and the parity tests hold the two engines equal ([architecture 04](04_live-lane.md)).
- The bake fails when a result leaves its case's expected range or a prediction leaves its observable's units.
- The measured gate (`npm run gate`) walks the built site at five sizes, in both themes and both languages.
- The SDD names the gate of every requirement; `scripts/check_sdd.py` checks each named gate exists.

## Where to read next

[Determinism and the trace](02_determinism-and-trace.md), [the lane gate](03_the-gate.md), [the live lane](04_live-lane.md),
[the precompute pipeline](05_precompute-pipeline.md), [model evaluation](06_model-evaluation.md),
[deploy](07_deploy.md), [the data contracts](08_data-contracts.md).
