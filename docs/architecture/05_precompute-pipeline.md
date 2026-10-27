# The precompute pipeline

`data-pipeline/pipeline/pipeline.py` orchestrates the named stages, invoked by path (`python data-pipeline/run.py`); the
product declares no package. It runs in `.venv-pipeline`, on a workstation, never in CI and never in the browser (ADR-0074).

## The stages

| Stage | Module | Does |
|---|---|---|
| preprocess | `stages/preprocess.py` | reads the params table and applies contract 1 (`io/contract.py`); the survey table is read by `hp500/surveys.py` |
| infer | `stages/infer.py` | runs the canonical engine (`model/crusher`) at an operating point |
| export | `stages/export.py` | builds the trace and the manifest (contract 2), with the lane verdict, byte size and sha256 |
| train | `stages/train.py` | fits the surrogate and the autoencoder on a Latin-hypercube sweep and exports the ONNX graphs (heavy lane) |
| evaluate | `stages/evaluate.py` | the held-out evaluation of the two model slots into `model-metrics.json` (heavy lane) |

Around them: `registry.py` (the cases by category and the default case S01), `cases/` (`circuit_cases.py`, 17 authored
cases with bilingual text, bands and expected ranges; `hp500_cases.py`, the 10 surveys), `core/expect.py` (the expected
ranges, checked at bake time), `core/unit_gate.py` (the units gate), `core/readiness.py`, `hp500/backbone.py` and
`hp500/loo.py`, `model/bundles.py` (which model slots are released), `oracles.py` (closed forms independent of the
engine, for tests and notebooks).

## The commands

| Command | What it does |
|---|---|
| `run.py` or `run.py all` | the release bake: the 27 cases, the two HP500 documents, the index, the readiness; never trains (about 5 s) |
| `run.py <case>` | one case, for instance `run.py S01` |
| `run.py readiness` | recompute `data/derived/readiness.json` from the catalog and the repository, no bake |
| `run.py hp500` | the two HP500 documents |
| `run.py models` | the heavy lane: train and evaluate the two models, refresh the index and the readiness (needs torch, onnx, onnxruntime) |
| `run.py fixtures` | regenerate the provider tree `docs/contracts/fixtures/data` from this code |

Every command takes `--output <sandbox>` (tests and smoke runs must pass it, so they cannot change committed evidence),
`--params` and `--surveys` to read other source tables, and `--seed`. `scripts/precompute.sh` and `.ps1` call `run.py`.

## What `all` does, in order

1. `load_inputs`: apply contract 1 to the params table (`data/examples/params.csv`) and the survey contract to
   `data/examples/hp500-surveys.csv`. A missing params table bakes the registry's 17 cases; a rejected row drops its case; a
   missing survey table or no accepted survey bakes no real case and no HP500 document (the catalog's missing-data
   behavior; readiness says so).
2. For each case: run the engine, compute the metrics (a real case adds `throughput_err_pct` and `power_err_pct` against
   its survey), check them against the case's expected ranges (`core/expect.py`; a result outside its range fails the
   bake), enforce the units gate (`core/unit_gate.py`), time the engine for the lane gate, and export the trace and the
   manifest.
3. The HP500 documents: the backbone from the accepted surveys and CrusherCal from the backbone.
4. The index, with the case the App opens on and the further files the site serves (the model contracts and graphs, the
   HP500 documents and the metrics, each when present), then the readiness document.

Which model slots answer is read from `data/derived/models/` as it stands (`model/bundles.py`): a valid bundle is
`real`, anything else `baseline`, recorded per case in the manifest. `all` never trains.

## The heavy lane

`run.py models` calls `train.run` then `evaluate.run`, then refreshes the index `files` and the readiness
([architecture 06](06_model-evaluation.md)). Measured on 2026-10-27 into a sandbox it took 76 s on the CPU. The GPU lane is
dormant ([guide 03](../guides/03_gpu-lane.md)).

## The gates on the output

`scripts/check_artifacts.py` (contracts 2 and 3 over the shipped files: agreement of index, manifests and traces, sizes,
sha256, lanes, expected ranges, units), `scripts/check_unit_constants.py` (every float literal of the engine declares its
unit), `scripts/check_readiness.py`, `scripts/check_documents.py`, `scripts/check_contracts.py`. Commands to run them are in
[guide 01](../guides/01_precompute-pipeline.md).

Engines are pinned in the requirements files and each has a card in [frameworks](../frameworks.md). No hand-rolled
substitute stands in for an engine the research prescribed.
