# Changelog

All notable changes to Trizar (ChancaDEM) are documented here. Versions follow `MAJOR.MINOR.PATCH` as
`X.XX.XXX`. The project stays on `0.x` while the physics constants are illustrative / pending calibration to
open industrial data.

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
