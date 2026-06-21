# Changelog

All notable changes to ChancaDEM are documented here. Versions follow `MAJOR.MINOR.PATCH` as
`X.XX.XXX`. The project stays on `0.x` while the physics constants are illustrative / pending calibration to
open industrial data.

## [0.03.001] — 2026-06-21

### Fixed
- **App design rule: the "Surrogate vs physics" parity scatter moved out of the App → into the Benchmark page.** It
  is an aggregate, case-independent view (it samples its own 54 operating points), so per the archetype rule (every
  App tab must react to the case selector; cross-case/aggregate views belong in Benchmark) it now sits under
  Benchmark §1 next to the held-out R²/MAPE table it visualizes. The App's remaining 11 tabs all react to the case
  selector + sliders. Cross-references (Experiments) updated.

## [0.03.000] — 2026-06-21

Refactor onto the CAOS product-repo archetype (ADR-0057) — the science core is unchanged; the repo is now a real,
contract-bounded, staged offline pipeline + a frontend SPA.

### Changed
- **`tools/` → `data-pipeline/chancalab/`** — the sweep (`sweep/gen_sweep.mjs`, the SAME TS engine — no Python
  re-port), the surrogate + denoising-AE training, and the offline 2-D DEM tracer split into the six named stages +
  `model/`. Bodies unchanged.
- **`src/` → `frontend/src/`**; `public/*.onnx` + scalers + metrics → **`data/derived/`** (the canonical artifact
  home). `frontend/copy-data.mjs` overlays them back into `public/` at build (the SPA's fetch paths are unchanged).
- The default pipeline is **numpy-only**: `python -m chancalab.pipeline all` rebuilds every per-case replay trace +
  manifest from the committed `case-results.json` (the 17 cases baked by the TS engine) + `surrogate_metrics.json`.
  `--retrain` regenerates everything (Node sweep → torch train → ONNX → re-bake).

### Added
- **Two data contracts**: Contract 1 (`io/contract.py` — operating-point schema + per-machine envelopes + outlier
  policy + a PSD guard) and Contract 2 (`core/manifest.py` `chancadem.manifest/v2` + `core/trace.py`
  `chancadem.trace/v1`), with a TS mirror (`frontend/src/lib/contract.types.ts`) that fails `tsc` on drift.
- **Cases by category** (`cases/circuit_cases.py`): the 17-case circuit matrix (primary gyratory/jaw · secondary
  cone · tertiary cone/short-head · negative/invalid/calibration controls).
- The client-side **lane gate**, two venvs + per-lane requirements, cross-platform `scripts/`, `tests/`
  (contract/manifest/smoke), CI (`ci.yml`) + `deploy-pages.yml`, a `docs/` wiki (ADR-0056), and a dormant `app/`
  FastAPI + VPS deploy templates. Brand/version housekeeping (caos-trizar → caos-chancadem; 0.02 → 0.03).
- Verified running: ruff clean · pytest 9/9 · pipeline 17 cases · CONTRACT 2 OK · deterministic re-run ·
  `tsc + vite build` green · physics node tests 10/10.

## [0.02.000] — 2026-06-20

The full studio: the 12-tab App workbench, the two learned ONNX models running live, and the six deepened
documentation pages.

### Added
- **Learned tier (real, honest)**: a population-balance **surrogate MLP** (9→64→64→32→10) and a **denoising
  autoencoder** (14→16→6→16→14) trained offline on a Latin-hypercube sweep of the live engine and exported to
  ONNX. Held-out (independent 2nd LHS): P80 R² 0.9975 / MAPE 3.23%, throughput 2.38%, power 4.93%; P80-vs-CSS
  monotonicity verified; PyTorch↔onnxruntime parity 6e-7. Both run live in-browser via onnxruntime-web.
- **12-tab App workbench** on a zustand store, all reactive to the case + sliders: 3D chamber (three.js,
  kinematic, orbit), 2D chamber slice + live nip, feed-vs-product gradation, value-banded gauges, capacity
  envelope (the hump), surrogate what-if (live ONNX vs engine), surrogate-vs-physics parity (live ONNX scatter),
  breakage t10 + t-family, nip-angle diagram, anomaly score (live autoencoder), operating-map heatmap (canvas),
  mass-balance Sankey + physics-asserts.
- **Decision layer**: inverse target-P80 → recommended CSS (bisection on the monotone engine), bottleneck
  diagnosis (capacity/power/nip), RAG verdict.
- **Deepened docs**: Methodology now has an SVG diagram per sub-tab; Introduction has the model-chain overview
  SVG; Benchmark loads the real held-out metrics from the committed artifact; Experiments documents the
  leakage-safe protocol.

### Fixed
- Gradation log x-axis labelled minor ticks as "null" → label decades only.
- The 2D chamber slice read as random diverging lines → rewrote as a clear concave bowl + central mantle cone.
- The t10 curve disagreed with the t-family table (Austin γ=0.62 capped t10 at ~24% and clamped φ) → γ=0.35 +
  t10 cap 0.44, so the displayed t10 matches the breakage matrix. Surrogate retrained on the corrected engine.

## [0.01.000] — 2026-06-20

Initial scaffold + live physics core.

### Added
- Project scaffold on the proven shared stack (Vite + React 19 + TS, `@fasl-work/caos-app-shell`, uPlot, three,
  onnxruntime-web, zustand) with the six standard pages and SPA 404 fallback.
- **Live pure-TypeScript crusher-physics engine**: the Whiten classification–breakage population balance
  `p = (I − C)(I − B·C)⁻¹·f`, the JKMRC t10 → Austin appearance function for the breakage matrix B, the Evertsson
  reduced-form capacity hump, and Bond power. Sub-millisecond, no Pyodide.
- 10 invariant unit tests (mass closure, monotone classification, strictly-lower breakage with column-conserved
  mass, CSS↓⇒finer, the capacity hump, pass-through / invalid guards).
- 14-case matrix (cone secondary/tertiary + jaw, hardness/feed/regime spread) including a pass-through negative
  control and a CSS>F80 invalid control.
- Initial App workbench wired to the engine (case + sliders → live KPIs + feed-vs-product gradation + decision/
  validity card) and the six documentation pages (Methodology carries the full model equations).
- DOI-verified citation ledger (the adversarial research pass corrected several venues/DOIs and removed a
  phantom-author reference).

### Pending (next build stages)
- Offline `.venv` pipeline: coarse-grained reduced-N DEM tracer traces + the Latin-hypercube sweep over the
  population-balance engine.
- The two learned ONNX models (population-balance surrogate MLP + denoising-autoencoder anomaly score) + held-out
  metrics + the PyTorch↔onnxruntime-web parity test.
- The full multi-tab runtime (3D chamber replay, capacity envelope, surrogate what-if, anomaly score, operating-
  map heatmap, …) and the deepened Experiments/Benchmark pages with real plotted results.
