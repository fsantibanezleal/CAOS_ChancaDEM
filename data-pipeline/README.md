# data-pipeline/, the offline engine

The scripts of the product's science, invoked by path (`python data-pipeline/run.py`); the product declares no package of
its own. They run in `.venv-pipeline` (`scripts/setup.sh` or `scripts/setup.ps1`), on a workstation, never in CI.

## Commands

| Command | What it does |
|---|---|
| `run.py` or `run.py all` | the release bake: the 27 cases, the HP500 documents, the index and the readiness; never trains (about 5 s) |
| `run.py <case>` | one case, for example `run.py S01` |
| `run.py readiness` | recompute `data/derived/readiness.json` from the catalog and the repository, no bake |
| `run.py hp500` | the two HP500 documents (backbone and CrusherCal leave-one-survey-out) |
| `run.py models` | the heavy lane: train the surrogate and the autoencoder on the canonical engine, evaluate them held-out (needs torch, onnx, onnxruntime) |
| `run.py fixtures` | regenerate the provider tree `docs/contracts/fixtures/data` from this code |

Every command takes `--output <sandbox>` (tests and smoke runs must), and `--params` and `--surveys` to read other source
tables. `scripts/precompute.sh` and `.ps1` call `run.py`.

## Layout

- `pipeline/pipeline.py`: the orchestrator and its CLI, and the engine time the lane gate judges
- `pipeline/registry.py`: the cases, grouped by category, and the default case (S01)
- `pipeline/cases/`: `circuit_cases.py` (17 authored cases: bilingual title, band, context and expected ranges) and
  `hp500_cases.py` (the 10 measured surveys)
- `pipeline/io/`: `contract.py` (contract 1: the params table), `formats.py` (readers and writers), `schema.py` (types)
- `pipeline/core/`: `trace.py` and `manifest.py` (contract 2), `gate.py` (the lane gate), `expect.py` (expected ranges),
  `unit_gate.py` (contract 3), `readiness.py` (the readiness document), `rng.py` (seeded determinism)
- `pipeline/model/crusher/`: the canonical Python engine (Whiten population balance, Evertsson capacity, Bond power, the
  HP500 calibration), held to the TypeScript engine by `tests/fixtures/engine-reference.json`; `bundles.py` decides which
  model slots are released
- `pipeline/hp500/`: the survey contract, the calibrated backbone and CrusherCal
- `pipeline/stages/`: preprocess, infer, export (per case), train and evaluate (the heavy lane)
- `pipeline/oracles.py`: independent closed-form checks (Rosin-Rammler, Bond, mass closure) the tests and notebooks import

## Gates

`scripts/check_artifacts.py` (contracts 2 and 3 over the shipped artifacts), `scripts/check_unit_constants.py` (contract
3b over the engine's constants), `scripts/check_readiness.py`, `scripts/check_documents.py`, `scripts/check_contracts.py`.
The bake fails when a result leaves its case's expected range or a prediction leaves its observable's units.

See [../docs/architecture/05_precompute-pipeline.md](../docs/architecture/05_precompute-pipeline.md).
