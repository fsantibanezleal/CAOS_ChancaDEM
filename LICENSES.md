# Third-party licenses

ChancaDEM depends on the following open-source components. Each retains its own license.

## Data and derived files

| File family | Licence | Source |
|---|---|---|
| `data/examples/hp500-surveys.csv` | CC BY 4.0 | Table A1 of Rocha, Campos, Silva and Tavares (2024), Minerals 14(9), 919, https://doi.org/10.3390/min14090919 |
| `data/derived/hp500/*.json` (backbone, CrusherCal validation) | CC BY 4.0 (derived from the survey table) | the same paper; attribution in `ATTRIBUTION.md` |
| `data/derived/manifests/HP500-*.json`, `data/derived/HP500-*/trace.json` (ten real cases) | CC BY 4.0 (derived from the survey table) | the same paper; attribution in `ATTRIBUTION.md` |
| `data/examples/params.csv`, `data/examples/operating.csv`, synthetic cases and their traces | MIT | the product's own work |
| `models/` (surrogate and autoencoder trained on the engine sweeps) | MIT | the product's own work |
| code, notebooks and documentation | MIT | `LICENSE` |

## Offline lane (Python, `requirements*.txt`)

| Package | License |
|---|---|
| numpy | BSD-3-Clause |
| torch (PyTorch) | BSD-3-Clause (+ third-party notices) |
| onnx | Apache-2.0 |
| onnxruntime | MIT |
| ruff | MIT |
| pytest | MIT |

The offline sweep + the case bake run on **Node.js** (the SAME TypeScript engine the browser uses, via `tsx`).

## Frontend (npm, `frontend/package.json`)

| Package | License |
|---|---|
| react / react-dom | MIT |
| react-router-dom | MIT |
| onnxruntime-web | MIT |
| three | MIT |
| uplot | MIT |
| katex | MIT |
| lucide-react | ISC |
| zustand | MIT |
| vite / @vitejs/plugin-react | MIT |
| typescript | Apache-2.0 |
| @fasl-work/caos-app-shell | © Felipe Santibáñez-Leal (CAOS shared shell) |

Versions are pinned in `requirements*.txt` and `frontend/package-lock.json`.
