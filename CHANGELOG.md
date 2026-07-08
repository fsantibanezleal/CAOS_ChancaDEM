# Changelog

All notable changes to ChancaDEM are documented here. Versions follow `MAJOR.MINOR.PATCH` as
`X.XX.XXX`. The project stays on `0.x` while the physics constants are illustrative / pending calibration to
open industrial data.

## [0.06.000], 2026-07-07

### Added
- **CrusherCal: a leave-one-survey-out (LOO) validation of the calibrated HP500 backbone, with honest results.**
  The novel-beyond-SOTA contribution is methodological, held-out (LOO) parity + calibrated uncertainty on OPEN
  industrial data, running live in the browser. It is NOT a claim of lower error than the DEM / phenomenological
  SOTA, and every number is computed from the 10 real Rocha et al. 2024 surveys (none asserted).
  - New offline validator `data-pipeline/chancalab/hp500/loo.py` (numpy-only, deterministic, seeded) grades three
    models on identical LOO folds for the measured targets t/h and kW (P80 is a model output, reported as
    self-consistency): M0 calibrated backbone (global scalars refit per fold), M1 backbone + bounded ridge
    residual (the CrusherCal proposal), M2 free-form OLS (the overfit strawman). Strict AND leaky folds expose the
    optimism gap; negative controls (label-shuffle, constant-mean) and an 80% predictive-interval coverage check
    are included. Traces committed to `data/derived/hp500/loo.json`.
  - New Node bridge `data-pipeline/chancalab/sweep/bake_hp500.mjs` runs the SAME live TypeScript engine on the 10
    surveys and writes `data/derived/hp500/backbone.json` (the physics stays the single source of truth). Wired
    into `chancalab.pipeline` (light lane rebuilds the LOO from the committed backbone; `--retrain` re-bridges).
  - Tests `tests/test_hp500_loo.py`: determinism, the label-shuffle control not beating the backbone, the t/h
    backbone beating the constant-mean baseline, and the leaky-vs-strict overfitting gap being exposed.
- **Benchmark: real power-parity + LOO parity panels (live).** New `PowerParity` and `LooParity` views read the
  committed traces and render measured-vs-modeled scatters with the honest metrics and the pre-registered null.
- **Prediction bands on the App gauges (Real lane).** t/h and kW gauges show the LOO-derived 80% predictive
  interval; the null on the residual net is stated in-panel (we ship the backbone + empirical band, not an
  overfit residual).
- **Envelope gate (negative control).** `frontend/src/physics/envelope.ts` flags implausible / out-of-validated
  inputs (f80 < CSS, CSS <= 0, negative feed, f80 outside the calibrated [47,140] mm on the real lane) so a view
  says "out of validated envelope" instead of emitting a confident number.
- **Deeper docs + Methodology.** New Methodology sub-tabs (DEM / SOTA landscape; Calibration & UQ) with the
  term-by-term math and verified DOIs; new `docs/frameworks/07_dem_pbm_landscape`, `08_calibration_validation`,
  `09_power_model` wiki units; new theme-aware SVGs; new verified citations (Cleary/Delaney/Quist/Johansson/Koh
  DEM + surrogate SOTA, Rocha 2024).

### Results (held-out, honest, from the 10 surveys)
- **t/h (genuine at-bar win):** the calibrated Evertsson capacity backbone reproduces the measured throughput at
  ~12% strict-LOO MAPE (within the paper's ~15% band), beating the constant-mean baseline (~18%) and passing the
  label-shuffle control. Real calibrated-capacity skill.
- **kW (honest negative):** the classical Bond draw computed by the engine is nearly flat (~196 to 237 kW) and
  carries little information about the measured 187 to 355 kW spread, so the backbone (~26% MAPE) is no better than
  predicting the survey mean (~24%). The engine's `Pc = 1.30*Pd + 110` (the paper form on our Bond Pd) is a
  miscalibration (~48%) because the paper's Pd is a size-specific net power, not the classical Bond draw. The
  dossier's "removes the Bond ~2x overprediction" premise is NOT supported by the engine and is reported as a
  corrected finding; no 2x-removal is claimed.
- **M1 residual (pre-registered null):** the bounded residual does not beat the backbone out-of-sample (t/h ~13%
  vs ~12%; kW marginal), and its leaky-vs-strict gap confirms overfitting at n=10. We ship the backbone with
  empirical uncertainty bands, not an overfit residual ONNX, and say so in-app.

## [0.05.000], 2026-07-07

### Added
- **The Synthetic | Real Source lane on real HP500 data.** A first-level Source selector at the top of the App
  sidebar switches the workbench between the synthetic simulator and a real industrial artifact. Real sample =
  10 surveys of a Metso HP500 secondary cone crusher at Minas Rio (Anglo American), itabirite iron ore, from
  Rocha, Campos, Silva & Tavares, Minerals 2024, 14(9), 919 (DOI 10.3390/min14090919, CC BY 4.0). In Real mode
  the sim sliders disable, a survey picker (#1 to #10) appears, and the exact same pure-TypeScript engine runs
  on the survey's MEASURED closed-side setting and feed f80.
  - New `frontend/src/data/real/hp500-minasrio.ts`: the 10 survey rows (Table A1, verbatim), the source
    provenance, the itabirite drop-weight A,b / Bond Wi bands (Table 1), and the Rosin-Rammler f80 to x63 feed
    reconstruction (documented assumption).
  - The `cone-sec` machine is now calibrated to the Andersen-Whiten fit of those surveys (Table 5): the Whiten
    classification is linear in CSS AND f80 (`K1 = 0.23·CSS + 0.30·f80`, `K2 = 12 + 0.55·CSS + 0.40·f80`,
    `K3 = 2.3`), t10 = `64 - 0.12·CSS - 0.23·f80`, the capacity base is re-anchored to the HP500 QT (about
    647 t/h so the modeled curve overlays the measured 813-1639 t/h band), and power uses the paper current-based
    model `Pc = 1.30·Pd + 110 kW`. Synthetic behaviour is unchanged (the calibrated paths activate only on the
    Real lane).
  - Every App tab is badged by provenance: gradation, gauges, capacity, breakage/t10, operating map and mass
    balance run on the real survey (REAL / CALIBRATED); the 3 geometry tabs are STRUCTURE-REAL; the ONNX
    surrogate and anomaly autoencoder are labelled SYNTHETIC-MODEL on real input (retrain is out of scope). The
    operating map overlays all 10 surveys as the real feed-rate x CSS envelope (coloured by f80), the selected
    one ringed. Each real view carries the in-panel citation. Honesty caveats stated: the full feed/product PSD
    curves are figure-only in the paper (feed is f80-reconstructed) and power is a current-based estimate.
  - On the Real lane the gauges report only MEASURED energy: the specific-energy gauge shows the real
    measured power / feed rate (about 0.13 kWh/t on survey 1), and the derived line no longer prints a
    Bond-basis "model power" (Bond's third theory overpredicts coarse crushing duty by ~2x, so a model number
    next to the real 209 kW would mislead). The faithful calibrated outputs (P80, reduction ratio) stay; the
    measured power and throughput are the real reference.

## [0.04.001], 2026-07-07

### Fixed
- Version drift: the in-app footer read `0.03.001` while the package, CHANGELOG and latest tag were at
  `0.04.000`. The shell version now derives from `frontend/package.json` (padded to the `X.XX.XXX` display
  form in `main.tsx`), so the footer can no longer drift from the manifest. Added a root `VERSION` file so
  all four sources agree.

## [0.04.000], 2026-07-04

### Changed
- **Chamber3D no longer autoplays** (no-compute-bomb rule, ADR-0059 / the feedback rule). The 3D crusher-
  chamber animation was an uncontrolled `requestAnimationFrame` loop that started on landing and ran
  forever, burning CPU on an unattended tab. It now mounts through the shared `usePausedViz` hook
  (`@fasl-work/caos-app-shell` bumped to `^0.3.0`): **default paused**, an explicit **Play/Pause** button,
  `loop: true` (the mantle gyration / jaw swing is a continuous dynamics view), and the rAF **halts when
  the tab is hidden**. A static frame is drawn on mount so the paused chamber is visible (not a blank
  canvas), and orbiting while paused still re-renders via a `controls.change` listener. Screenshot-verified:
  Play button present, 0 console errors.
- Bumped `@fasl-work/caos-app-shell` `^0.2.0` -> `^0.3.0`.

## [0.03.002], 2026-07-04

### Changed
- Content standards (ADR-0067): removed every em-dash from tracked content (replaced with commas, or
  "n/a" in table cells). No behaviour change. Added `scripts/check_content_standards.py` + wired it
  into the CI `guards` job so the repo cannot regress on em-dashes or emojis.

## [0.03.001], 2026-06-21

### Fixed
- **App design rule: the "Surrogate vs physics" parity scatter moved out of the App → into the Benchmark page.** It
  is an aggregate, case-independent view (it samples its own 54 operating points), so per the archetype rule (every
  App tab must react to the case selector; cross-case/aggregate views belong in Benchmark) it now sits under
  Benchmark §1 next to the held-out R²/MAPE table it visualizes. The App's remaining 11 tabs all react to the case
  selector + sliders. Cross-references (Experiments) updated.

## [0.03.000], 2026-06-21

Refactor onto the CAOS product-repo archetype (ADR-0057), the science core is unchanged; the repo is now a real,
contract-bounded, staged offline pipeline + a frontend SPA.

### Changed
- **`tools/` → `data-pipeline/chancalab/`**, the sweep (`sweep/gen_sweep.mjs`, the SAME TS engine, no Python
  re-port), the surrogate + denoising-AE training, and the offline 2-D DEM tracer split into the six named stages +
  `model/`. Bodies unchanged.
- **`src/` → `frontend/src/`**; `public/*.onnx` + scalers + metrics → **`data/derived/`** (the canonical artifact
  home). `frontend/copy-data.mjs` overlays them back into `public/` at build (the SPA's fetch paths are unchanged).
- The default pipeline is **numpy-only**: `python -m chancalab.pipeline all` rebuilds every per-case replay trace +
  manifest from the committed `case-results.json` (the 17 cases baked by the TS engine) + `surrogate_metrics.json`.
  `--retrain` regenerates everything (Node sweep → torch train → ONNX → re-bake).

### Added
- **Two data contracts**: Contract 1 (`io/contract.py`, operating-point schema + per-machine envelopes + outlier
  policy + a PSD guard) and Contract 2 (`core/manifest.py` `chancadem.manifest/v2` + `core/trace.py`
  `chancadem.trace/v1`), with a TS mirror (`frontend/src/lib/contract.types.ts`) that fails `tsc` on drift.
- **Cases by category** (`cases/circuit_cases.py`): the 17-case circuit matrix (primary gyratory/jaw · secondary
  cone · tertiary cone/short-head · negative/invalid/calibration controls).
- The client-side **lane gate**, two venvs + per-lane requirements, cross-platform `scripts/`, `tests/`
  (contract/manifest/smoke), CI (`ci.yml`) + `deploy-pages.yml`, a `docs/` wiki (ADR-0056), and a dormant `app/`
  FastAPI + VPS deploy templates. Brand/version housekeeping (caos-trizar → caos-chancadem; 0.02 → 0.03).
- Verified running: ruff clean · pytest 9/9 · pipeline 17 cases · CONTRACT 2 OK · deterministic re-run ·
  `tsc + vite build` green · physics node tests 10/10.

## [0.02.000], 2026-06-20

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

## [0.01.000], 2026-06-20

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
