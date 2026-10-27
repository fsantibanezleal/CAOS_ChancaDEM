# Guide, run the pipeline and the environments

Everything offline runs in `.venv-pipeline`, built by the setup script; nothing here runs in CI.

## Set up

```bash
./scripts/setup.sh              # or scripts/setup.ps1: builds .venv-pipeline from requirements-precompute.txt and requirements-dev.txt
./scripts/setup.sh --notebooks  # or scripts/setup.ps1 -Notebooks: builds .venv-notebooks from notebooks/requirements.txt instead
```

`requirements-precompute.txt` pins the heavy lane (torch 2.12.1 from the CPU index, onnx, onnxruntime) on top of
`data-pipeline/requirements.txt` (numpy). The scripts create no global install and are idempotent. The torch wheel comes from
its own index; the install line is in the [PyTorch card](../frameworks/02_pytorch/pytorch.md). On the default device the
environments are directory junctions into the venvs root; the scripts do not care.

## The bake

```bash
./scripts/precompute.sh                 # all: the 27 cases, the HP500 documents, the index, the readiness (about 5 s, never trains)
./scripts/precompute.sh S01             # one case
./scripts/precompute.sh S01 --output build/smoke   # into a sandbox; tests and smoke runs must pass --output
./scripts/precompute.sh readiness       # recompute data/derived/readiness.json from the catalog, no bake
./scripts/precompute.sh hp500           # the two HP500 documents
./scripts/precompute.sh models          # train and evaluate the two models (the heavy lane, about a minute on the CPU)
./scripts/precompute.sh fixtures        # regenerate the provider tree docs/contracts/fixtures/data
```

`scripts/precompute.ps1` is the same on Windows. Both call `data-pipeline/run.py` in `.venv-pipeline`. A bake without
`--output` writes the committed evidence in `data/derived/`: do it only as a deliberate release operation, then review
the diff. Stages and what each command does: [architecture 05](../architecture/05_precompute-pipeline.md).

## Check

```bash
.venv-pipeline/bin/python -m pytest             # (Scripts/python.exe on Windows) the pipeline tests, sandboxed
./scripts/smoke.sh                              # contract 2 and 3 over the committed artifacts, and the engine's unit constants
.venv-pipeline/bin/python scripts/check_readiness.py
.venv-pipeline/bin/python scripts/check_contracts.py docs/contracts/catalog.md --repo-root .
```

The pipeline tests run in a sandbox that fails the session if a committed artifact changes. The site and the web tests are
in `frontend/` (`npm ci`, `npm run dev`, `npm run build`, `npm test`, `npm run gate`; `npm run dev` copies the declared
artifacts first). `scripts/dev.sh` and `scripts/dev.ps1` start the frontend (and the API only when it is activated).

## The notebook environment

`.venv-notebooks` holds the notebook stack (`notebooks/requirements.txt`, exact pins). `python scripts/run_notebooks.py
--check` executes the notebooks on copies and writes nothing; `python scripts/check_notebooks.py` checks them statically.
The notebooks themselves and their conventions are guide 08.

The run is deterministic for a seed and an operating point; see [architecture 02](../architecture/02_determinism-and-trace.md).
