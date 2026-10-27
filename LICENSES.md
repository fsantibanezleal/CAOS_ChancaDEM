# Third-party licenses

ChancaDEM depends on the following open-source components. Each retains its own license.

## Data and derived files

| File family | Licence | Source |
|---|---|---|
| `data/examples/hp500-surveys.csv` | CC BY 4.0 | Table A1 of Rocha, Campos, Silva and Tavares (2024), Minerals 14(9), 919, https://doi.org/10.3390/min14090919 |
| `data/derived/hp500/*.json` (backbone, CrusherCal validation) | CC BY 4.0 (derived from the survey table) | the same paper; attribution in `ATTRIBUTION.md` |
| `data/derived/manifests/HP500-*.json`, `data/derived/HP500-*/trace.json` (ten real cases) | CC BY 4.0 (derived from the survey table) | the same paper; attribution in `ATTRIBUTION.md` |
| `data/examples/params.csv`, the synthetic cases and their traces | MIT | the product's own work |
| `data/derived/models/` and `data/derived/model-metrics.json` (the surrogate and the autoencoder trained on the engine sweeps) | MIT | the product's own work |
| code, notebooks and documentation | MIT | `LICENSE` |

## Offline lane (Python, `requirements*.txt` and `notebooks/requirements.txt`)

The licence each package declares in its installed metadata (read on 2026-10-27).

| Package | Licence |
|---|---|
| numpy | BSD-3-Clause (with 0BSD, MIT, Zlib and CC0-1.0 parts) |
| torch (PyTorch) | BSD-3-Clause |
| onnx | Apache-2.0 |
| onnxruntime | MIT |
| pytest | MIT |
| ruff | MIT |
| jsonschema | MIT |
| openapi-spec-validator | Apache-2.0 |
| fastapi | MIT |
| httpx | BSD-3-Clause |
| matplotlib | the Matplotlib licence (PSF-based) |
| nbclient | BSD-3-Clause |
| nbformat | BSD-3-Clause |
| ipykernel | BSD-3-Clause |

The bake, the HP500 validation and the training of the models all run on the canonical Python engine; no Node step is
part of the offline lane.

## Frontend (npm, `frontend/package.json`)

| Package | Licence |
|---|---|
| react / react-dom | MIT |
| react-router | MIT |
| onnxruntime-web | MIT |
| three | MIT |
| uplot | MIT |
| katex | MIT |
| lucide-react | ISC |
| zustand | MIT |
| vite / @vitejs/plugin-react | MIT |
| typescript | Apache-2.0 |
| vitest | MIT |
| playwright | Apache-2.0 |
| openapi-typescript | MIT |
| @fasl-work/caos-app-shell | MIT |

Versions are pinned in `requirements*.txt`, `notebooks/requirements.txt` and `frontend/package-lock.json`.
