# ChancaDEM

https://chancadem.fasl-work.com

[![CI](https://img.shields.io/github/actions/workflow/status/fsantibanezleal/CAOS_ChancaDEM/ci.yml?branch=main&label=CI)](https://github.com/fsantibanezleal/CAOS_ChancaDEM/actions)
[![License](https://img.shields.io/github/license/fsantibanezleal/CAOS_ChancaDEM)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/fsantibanezleal/CAOS_ChancaDEM?label=version&sort=semver)](https://github.com/fsantibanezleal/CAOS_ChancaDEM/tags)
[![Live](https://img.shields.io/badge/site-live-2ea44f)](https://chancadem.fasl-work.com)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21518356.svg)](https://doi.org/10.5281/zenodo.21518356)

A crusher-comminution studio: set the machine, the closed-side setting and the feed, and read the product size, the
throughput and the power. The core is a Whiten population balance with Andersen classification, a JKMRC t10 and Austin
appearance breakage, an Evertsson capacity and a Bond power, calibrated to ten measured surveys of an industrial HP500 cone
crusher and validated out of sample, with two released learned models (a surrogate and an autoencoder) beside it. It runs
in the reader's browser; the committed artifacts are baked offline by a seeded pipeline.

*Un estudio de chancado: ajuste la máquina, la abertura de descarga y la alimentación, y lea el tamaño del producto, la capacidad y la potencia. El núcleo es un balance poblacional de Whiten con clasificación de Andersen, quiebre t10 de JKMRC y aparición de Austin, capacidad de Evertsson y potencia de Bond, calibrado con diez muestreos medidos de un chancador de cono HP500 industrial y validado fuera de la muestra, con dos modelos aprendidos publicados (un sustituto y un autoencoder) a su lado.*

## Areas

The repository by area: its folder, whether the area is active or dormant, and what it holds.

| Area | Folder | Status | What it holds |
|---|---|---|---|
| Web | [`frontend/`](frontend/) | active | The workbench (`/app`) and the five documentation routes, Introduction, Methodology, Implementation, Experiments and Benchmark, on the shared shell `@fasl-work/caos-app-shell` 0.19.2, with the engine ported to TypeScript and onnxruntime-web for the learned models. Build and test: `cd frontend && npm ci && npm run build && npm test && npm run gate`. |
| API | [`app/`](app/) | dormant: this solution does not require it at the moment | A FastAPI layer that would serve the committed documents read-only (`/api/cases`, `/api/artifacts/{path}`, `/health`). Activation is [guide 04](docs/guides/04_run-the-api.md). |
| Core pipelines | [`data-pipeline/`](data-pipeline/) | active | The canonical Python crusher engine (`pipeline/model/crusher/`), the oracles, the HP500 lane with CrusherCal (`pipeline/hp500/`), the model bundles and the stages (`preprocess`, `train`, `evaluate`, `export`, `infer`). Bake: `./scripts/precompute.sh`, about 5 s. See [data-pipeline/README.md](data-pipeline/README.md). |
| Packages | (PyPI) [numpy](https://pypi.org/project/numpy/) | active: consumes published libraries, publishes none | No package of its own: the methods live in the pipeline folder. It consumes [numpy 2.4.6](https://pypi.org/project/numpy/) ([repository](https://github.com/numpy/numpy)), and for the learned models [torch 2.12.1](https://pypi.org/project/torch/) ([repository](https://github.com/pytorch/pytorch)), [onnx 1.22.0](https://pypi.org/project/onnx/) ([repository](https://github.com/onnx/onnx)) and [onnxruntime 1.27.0](https://pypi.org/project/onnxruntime/) ([repository](https://github.com/microsoft/onnxruntime)); the notebooks and the contract checks add [jsonschema 4.26.0](https://pypi.org/project/jsonschema/) ([repository](https://github.com/python-jsonschema/jsonschema)). |
| Notebooks | [`notebooks/`](notebooks/) | active | Notebooks in English and Spanish, by topic and from level 1 to level 4, executed on the committed data through the pipeline: the first run and the 27 cases, size distributions, breakage and classification, capacity and power, the ten real surveys, CrusherCal (claim BS-1) and the learned models. Run: `./scripts/setup.sh --notebooks`, then `python scripts/run_notebooks.py`. See [notebooks/README.md](notebooks/README.md) and [guide 08](docs/guides/08_notebooks.md). |
| Data | [`data/`](data/) | active | The 17 authored circuit cases and the ten HP500 surveys (Table A1 of Rocha et al. 2024, https://doi.org/10.3390/min14090919, licence CC BY 4.0), the committed derived artifacts (manifests, traces, the backbone and CrusherCal documents, the two models) and the sources with their licence classes. See [data/README.md](data/README.md). |
| Contracts | [`docs/contracts/`](docs/contracts/) | active | The contract catalog, one row per boundary and per model slot, and the JSON schemas that the pipeline and the web are both held to. See [catalog.md](docs/contracts/catalog.md). |
| Documentation | [`docs/`](docs/) | active | The SDD ([docs/design/SDD.md](docs/design/SDD.md)), the [guides](docs/guides.md), the case pages, the framework cards and the architecture diagrams. |
| Tests and gates | [`tests/`](tests/), [`scripts/`](scripts/) | active | `python -m pytest` for the pipeline, `npm test` for the web, and the guards `scripts/check_*.py` (artifacts, contracts, notebooks, README areas, SDD, content standards). See [scripts/README.md](scripts/README.md). |
| Deploy | [`deploy/`](deploy/) | active: deployed to GitHub Pages | A static site on GitHub Pages at https://chancadem.fasl-work.com, built and deployed by `deploy-pages.yml` after CI succeeds on `main`; never credentials. See [deploy/pages.md](deploy/pages.md). |

## Technical report

The manuscript, ChancaDEM: A Crusher-Comminution Studio Coupling Whiten, Evertsson and Bond, with a Physics-Faithful
Learned Surrogate, is in [`manuscripts/comminution-studio/`](manuscripts/comminution-studio/) (LaTeX source, figures and the
compiled PDF). Its concept DOI, which always resolves to the latest version, is
[10.5281/zenodo.21518356](https://doi.org/10.5281/zenodo.21518356).

## Run it

```bash
./scripts/setup.sh                      # the pipeline environment (.venv-pipeline); setup.ps1 on Windows
./scripts/precompute.sh                 # the canonical bake into data/derived (a release operation)
.venv-pipeline/bin/python -m pytest     # the pipeline tests, sandboxed
./scripts/setup.sh --notebooks          # the notebook environment (.venv-notebooks); setup.ps1 -Notebooks on Windows
python scripts/run_notebooks.py --check --tmp <temp root>   # every notebook runs top to bottom (a local release gate, never CI)
cd frontend && npm ci && npm run build && npm test && npm run gate
```

## Documentation

- [docs/design/SDD.md](docs/design/SDD.md): the design, every requirement with its gate.
- [docs/](docs/README.md): architecture, guides, cases and frameworks.

Licensed under the MIT License (see [LICENSE](LICENSE)). Deployed to pages at https://chancadem.fasl-work.com.
