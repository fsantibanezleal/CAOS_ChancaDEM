# STRUCTURE — ChancaDEM on the CAOS product-repo archetype (ADR-0057)

```
CAOS_ChancaDEM/
├─ README.md · CHANGELOG.md (X.XX.XXX) · LICENSE · LICENSES.md · ATTRIBUTION.md · STRUCTURE.md
├─ pyproject.toml (chancalab) · .env.example · .gitignore · .gitattributes · .vscode/
├─ requirements.txt (live-thin numpy) · -dev · -precompute (torch/onnx) · -gpu (dormant) · -api (dormant)
├─ data-pipeline/
│  ├─ README.md
│  └─ chancalab/                    # the offline engine + staged pipeline
│     ├─ __init__.py (version) · pipeline.py (orchestrator+CLI) · registry.py (cases by CATEGORY) · live.py (dormant)
│     ├─ io/      contract.py (CONTRACT 1) · schema.py · formats.py
│     ├─ core/    rng.py · trace.py (CONTRACT 2 trace) · manifest.py (CONTRACT 2) · gate.py (lane gate)
│     ├─ model/   surrogate.py · psd_ae.py (torch)
│     ├─ stages/  preprocess · feature_extraction · train · infer · evaluate · export · dem.py (offline 2-D DEM, WIP)
│     ├─ cases/   circuit_cases.py (17 cases, 4 categories)
│     └─ sweep/   gen_sweep.mjs (LHS over the TS engine, Node) · bake_cases.mjs (the 17 cases → case-results.json)
├─ data/
│  ├─ examples/operating.csv (passes CONTRACT 1)
│  ├─ derived/  models/*.onnx · scaler/ae_scaler/ae_threshold.json · surrogate_metrics.json · case-results.json
│  │            <case>/trace.json · manifests/<case>.json + index.json   (CONTRACT 2, committed)
│  └─ README.md (the data contract)
├─ frontend/                        # the React/Vite SPA
│  ├─ index.html · package.json · vite.config.ts · tsconfig.json · copy-data.mjs
│  ├─ public/ (CNAME · favicon; the data overlay is git-ignored)
│  ├─ test/physics.test.ts (node --test)
│  └─ src/  pages/ (App/Introduction/Methodology/Implementation/Experiments/Benchmark) · physics/ (the engine) · viz/ ·
│           lib/ort.ts (onnxruntime-web) · lib/contract.types.ts (CONTRACT-2 mirror) · state/store.ts · data/
├─ app/                             # OPTIONAL FastAPI backend — DORMANT (static-first)
├─ scripts/  setup · precompute · dev · smoke {.sh,.ps1} · check_artifacts.py
├─ deploy/   pages.md (default) · fasl-slug.service · domain.nginx (VPS, dormant)
├─ docs/     README · architecture/ · frameworks/ · cases/ · guides/   (the wiki, ADR-0056)
├─ tests/    test_contract · test_manifest · test_pipeline_smoke · conftest
└─ .github/workflows/  ci.yml (ruff+pytest+pipeline+check_artifacts+guards) · deploy-pages.yml
```

**The base is frozen** — edits land only in the CORE (the engine in `frontend/src/physics/`, the surrogate/AE in
`model/` + `stages/`, the visualizations, and the cases/content), never in the structure, contracts, env, or deploy.
The offline lane is two-language by design: the Node sweep runs the SAME TS engine the browser does (no re-port).
