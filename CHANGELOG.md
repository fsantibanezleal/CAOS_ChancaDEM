# Changelog

All notable changes to ChancaDEM are documented here. Versions follow `MAJOR.MINOR.PATCH` as
`X.XX.XXX`. The project stays on `0.x` while the physics constants are illustrative / pending calibration to
open industrial data.

## [0.13.000] · 2026-11-08

### Added

- The showcase of ADR-0082 (requirements SH-001 to SH-010). The circuit view: the three-stage crushing circuit as a flowsheet, each
  stage named by its machine, the selected case's streams labelled with throughput, F80, P80, power and setting from its manifest and
  committed trace, the flow moving at a speed proportional to the throughput and still under reduced motion; selecting another stage
  loads its first case. The population-balance view: the Whiten solve as its Neumann series, computed from the live engine's B, C and
  f, drawn pass by pass on the size-distribution axes against the closed form (equal to 1e-9 after as many passes as size classes),
  with the residual and the mass sent back per class. The campaign view: P80 against operating hours at the reader's drift rate,
  the target crossed, the 45 h reference line and the now line; no drift rate is set or asserted by the product. The comparison
  view: the held-out MAPE of every method of the HP500 validation and of CrusherBayes for throughput and power, the ten per-survey
  errors beside each method, the predictive bands, and the method with the lowest held-out error marked as recommended with its
  reason.
- The guided story at `/story/measure`, `/story/inside`, `/story/solve`, `/story/compare` and `/story/operate`, on the shell's story
  frame: each headline a number read from the committed documents or computed by the live engine from them, the missing state with
  its reason when a document is absent, three anchored callouts with value, unit and source on every stage, deep links, the keys,
  play and pause, and an exit to the App on the step's case and group.
- Linked selection on the shell's linked-view store: a size class, a stream, a stage, a method, the pass count and the hours cursor
  shown by every view of the catalog row that reads them, both ways.
- `src/pages/story.browser.mjs`, run by `npm run check:story` after the base's story check: the product's own browser checks of the
  story (callouts, exits, the pause on a key press, the two-way selection, the survey scrubber, reduced motion).
- Contract `hp500-comparison` 1.0.0 (`data/derived/hp500/comparison.json`, written by `data-pipeline/pipeline/hp500/comparison.py`,
  `python data-pipeline/run.py comparison` or within `hp500` and `all`): per target, the recommended method, the runner-up and the paired
  difference of every method against the recommended one over the ten surveys, with its 95 percent bootstrap interval (the CrusherBayes
  manuscript's resampling: its power row against the setting-only line equals the manuscript's 1.54 points, -1.11 to 4.10), its wins
  and p_better; readiness says missing when it is absent and stale when its engine version differs; schema, fixture, catalog row,
  producer tests and the web's descriptor test (CT-043, CT-044).
- The comparison view and the Compare step open on the runner-up, draw its paired gap to the recommended method as an interval mark,
  make that gap the third callout and say in the takeaway how sure the ranking is with ten surveys (on power, the setting-only line
  is 1.26 points below the free-form fit, interval -1.91 to 5.27, lower on 5 of 10 surveys: ten surveys do not settle the ranking)
  (SH-009, SH-011).
- The Measure step draws the ten surveys' feed rates on its stage, linked to the survey scrubber, so 813 to 1,639 t/h is readable at
  its opening state (SH-013).

### Changed

- The App's groups are System (the circuit, then the chamber: the 3D cutaway beside the section with its callouts), Product (the size
  distribution with its callouts and the classification curve, then the population balance), Performance (the campaign first),
  Learned and Validation (the methods compared first), with the Context tab: six tabs, each group opening on one stage; the rail is
  184 px and the tab rows compact so the stage keeps 60 percent of the screen.
- Every reader-facing name of a method is its name, in both languages (the calibrated backbone, the bounded residual, the free-form
  fit, the setting-only line), never its ladder id; the documents' keys are unchanged.
- The Implementation and Methodology pages describe the App's views and the story; the App's architecture figure names the System
  group and the story.
- The base: CAOS_PRODUCT_TEMPLATE 0.15.005 (from 0.14.001) and `@fasl-work/caos-app-shell` 0.25.0 (from 0.19.9), each pinned exactly.
  The story steps are declared in `product.json` (`showcase.story_routes`) and the base's gate, story check and route pages read
  them; the local workflow keeps its environments outside the repository; the internal-names guard fails a method's ladder id
  anywhere a reader sees it and passes the keys of the committed documents; the base tests under `frontend/src` are taken verbatim; a stage is validated without the documents of a contract the
  product declares missing or in training, and the build reads a case's manifest from `manifest_path` or `path`. The shell shows
  every callout's state as a word with a glyph, measures the story's callout geometry at every size, theme and language, lays out
  header callouts on their measured heights in the order of their anchors (0.24.0), and keeps a chart's readout still when the page
  scrolls under a resting pointer (0.25.0).
  The shell brings the story frame, the anchored callouts, the linked-view store and gates G6, G18 and G21, and keeps the story's
  step row at its height under a tall panel.
- The release generation (`scripts/local/02_generate-data --release`) trains the learned models (`data-pipeline/run.py models`)
  before the bake, so every stamped document of a release carries its version; the models and their metrics are no longer
  carried into the stage as inputs (the 0.13.000 bake refused a carried `model-metrics.json` of 0.12.001 as mixed).
- The technical report covers the paired comparison contract, the paired differences against the recommended method, the
  drift response as the secant over the drawn range with the cause of its bend, and the App's six views and guided story;
  its tables, macros and figures are regenerated from the 0.13.000 bake.

### Fixed

- The shell pin test reads 0.25.0, the version the product pins.
- The 0.13.000 visualization review's findings on numbers and words. The Operate headline stated the local slope over the first
  0.5 mm (0.267 mm per mm) as the drift response; it now states the drift drawn on the stage ("P80 reaches the 35.8 mm target after
  22 mm of setting drift" on survey 1), and the P80-per-mm callout is the secant of the drawn curve (0.148). The Methodology names the
  cause of the bend: the escape size K1 of the calibrated classification crosses the 38.05 mm mid-size of a class at a setting of
  54.77 mm. The Compare headline stated a mean error as a bound; it now says "on average" ("en promedio") (SH-010, SH-011).
- The exits keep the step's state: Look inside opens the chamber, Solve the population balance and Operate the campaign with the
  story's target; the App and the story open the target by one rule, the case's P80 plus 10 percent, where the App rounded the
  P80 (SH-006, SH-010).
- The measured and the model F80 are told apart: a real survey's F80 is labelled measured in the Measure step, the case tables and the
  rail, and the engine's F80 in the size distribution and the Look inside panel is labelled the model's, reconstructed from the
  measured feed (SH-012).
- Solve and the population-balance view open at the pass the Solve headline names (6 on survey 1) instead of pass 1 and pass 28;
  one pass is singular; the second quantity beside the residual is the mass sent back at the pass; a round-off residual reads below
  machine precision; the Spanish drift axis reads "Desplazamiento de la abertura" (SH-013, SH-014).
- The 0.13.000 visualization review's findings on geometry, motion and visuals. The chart callouts' leaders end on the points they
  name at every size and with the reduced-motion preference: each anchor is the point on the scale uPlot rendered, measured in the
  callout layer's own pixels and re-measured after every render, where the band that moved the chart without resizing it left the
  anchors 46 px off at 390 px (SH-015). A story step change is staged: the subject changes first (Solve plays its passes up to the
  headline's pass, Compare grows the methods' dots one by one, Operate draws the drift curve out to the crossing, Measure and Look
  inside move their drawing in), then the subject is highlighted, the callouts enter one at a time and the panel builds with its
  numbers counting; under reduced motion the first frame is the final one (SH-016). No callout eyebrow or value is cut at 390 or
  1280 px in either language: shorter eyebrows and units, with the speed, the interval and the machine-precision note in the source
  (SH-017). The chamber section draws the nip angle at the engine's value with the grip limit as a second wedge, and the NIP ANGLE
  callout is anchored inside it (SH-018). The 3D chamber names its mantle, concave, gap and feed, each selectable by its label or a
  click, linked both ways to the section and its callouts, on a ground with soft shadows lit by the shell's scene environment of the
  theme (SH-019). The population balance and the comparison open on one chart, their secondary charts a second view; the comparison
  numbers its methods below 640 px and its method buttons wrap; the chamber's table header is whole; a story panel that scrolls shows
  a "more below" cue; the Spanish Compare headline keeps "reservado" (SH-020, SH-011).
- The views reserve the callout band the shell measures
  (`onLayout({ bandHeight })`) instead of the nominal card sizes, so no two callout cards overlap and no two leaders cross at 390
  and 1280 px in either language (M1, M3; SH-021). The story's staged entry keeps its state in a provider of its own, so a step of
  the entry re-renders only what reads it. On a phone the story stage is 800 px tall and a story chart keeps 34rem, so the
  taller cards of 0.24.0 leave the plot its room; the comparison's reason and certainty open the docked panel's note.
- `src/views/showcase.browser.mjs`, run by `npm run check:story`: the drawings measured in a browser (each chart leader within 4 px of
  the drawn ink at 390 and 1280 px with and without reduced motion, the frame sequence of every step change, cut eyebrows and values,
  touching method labels, one chart per view, the table header, the panel's scroll cue, the 3D parts selected both ways).
- The findings of the 0.13.000 visualization re-check (N1 to N9, the rest of B3 and M7, M9's browser check). The drift margin's
  state follows its meaning: alarm only at or past the target, warning under a quarter of the setting's remaining training range,
  normal otherwise (HP500 survey 1, 22 mm of 36 mm: normal; S01, 3.21 mm of 58 mm: warning; SH-010). The story's Compare stage opens
  its note with the certainty sentence of the App's takeaway (the interval includes zero, so ten surveys do not settle the ranking),
  and the paired gap's 95 percent interval is a bracket in a colour of its own beside the selected method's dot with its end values
  (SH-009). A callout band never takes more than its host's height less 160 px, and a swing through a band reported while the layer
  had collapsed (a full-page capture, a viewport resize) holds the band that leaves the chart its room, so a chart at 390 px is never
  left without its canvas. The phone story stage is the viewport less the header above it, its chart's host fitted to the free
  height, and the Operate controls and the Compare target switch moved to the docked panel, so no lane pill covers the target and
  the plot keeps its height. The staged entry is hidden from the render that mounts the step: no frame shows the final card before
  the entry. SENT BACK is the mass sent back over the passes so far (45.4 percent of the feed at HP500 survey 1's opening pass, never
  a vacuous 0), every MAPE has one decimal (the Compare headline 12.8%, SELECTED 14.0), and the chamber table gives the grip limit
  with two decimals (38.58). The browser checks measure each chart leader against the point it names on the scales uPlot rendered
  (its axes' tick labels), never against any drawn pixel, and catch a planted 16 px miss; they add 20 fresh loads per language of
  App V4 and the story's Compare at 390 px each with a full-page capture, the pills over a card's controls, the certainty clause on
  the stage, every frame of a step change before its entry, and the 3D parts and their callouts selected both ways at 1280 and
  390 px.
- The full Python suite passes on the release head. The `hp500-comparison` contract has its lesson in notebook 03 of topic 08
  (en and es): the paired difference against the recommended method with its equations, one 95 percent interval recomputed from
  the held-out predictions and tied to the document, how far ten surveys back the recommendation (dropping one survey changes the
  throughput recommendation in 8 of 10 cases), the readiness reason when the document is absent, and `notebooks/coverage.json`
  maps the contract to it. The readiness-provider tests build their stage as `scripts/local/workflow.py` `generate()` does (VERSION,
  the contract catalog, the source tables), with a new plant that a stage stamped with another version is refused. The provider
  tree is regenerated by `data-pipeline/run.py fixtures` (version stamps only). The gate-runner plant expects the base runner's
  current refusal and still proves that no gate runs, naming every story step product.json declares.

## [0.12.001] · 2026-11-02

### Fixed

- The App's case context printed the source's DOI URL and licence twice, and the licence with a decimal point on the Spanish
  page: the citation now drops what the paragraph prints beside it, and the licence reads in the reader's language.

## [0.12.000] · 2026-10-31

### Added

- CrusherBayes, the method this product proposes: a Bayesian calibration of the engine's fitted scalars with a structural
  discrepancy term per target (Kennedy and O'Hagan 2001), sampled with the differential-evolution moves of ter Braak 2006 and ter
  Braak and Vrugt 2008, held out survey by survey on the ten HP500 surveys. Held out it reaches 12.00 percent on throughput and
  14.31 percent on power, with coverage 0.80 and 0.90; it does not beat the setting-only line on power (12.78 percent). The surveys
  identify the capacity base, the noise and the setting slopes of the discrepancy, not K1, K2, K3 or the t10 shift.
- B-lin, the line of power on the closed-side setting alone, and Morrell's size-specific energy with its fitted index and no-load
  power stated as fitted, on the same protocol. Contracts hp500-loo 1.2.0 and hp500-crusherbayes 1.0.0.
- The Benchmark rows, the CrusherBayes section, the Morrell and CrusherBayes Methodology topics and the report and preprint DOIs on
  the Introduction; framework cards 18 and 19.
- Notebooks: Morrell against Bond, and a CrusherBayes topic of three notebooks, in English and Spanish (44 notebooks in all).
- The technical report at 0.12.000 and the CrusherBayes preprint on Zenodo; the README names the three records of the app.

### Changed

- Template 0.14.001 and shell 0.19.9. The tier names are internal: notebook sections, the app and the README name each method.
- The nip-angle label sits under the apex, clear of the particle's arrow.

## [0.11.000] · 2026-10-27

### Added

- The Performance group has a fifth sub-view, Campaign (BL-004): for the selected case it plots the operating hours until
  the product's P80 leaves a target as the closed-side setting drifts open with liner wear, against the drift rate of the
  setting (log axis, 0.01 to 1 mm/h), with the P80 target as a control (default: the case's P80 plus 10 percent) and the
  45 h re-set interval of one plant (Ma et al. 2016) as the only reference line. The product models no wear and asserts no
  wear rate: the drift rate is the reader's to measure, and the view says so in both languages.
- Two engine functions on both sides, held equal by a shared table of 45 rows to 1e-6 mm: `css_at_p80_target` (the setting
  at which the engine's P80 reaches a target; none when the point is invalid, the target is never reached or P80 is not
  monotone) and `hours_to_target`.
- A framework card for the campaign view (M13), the Methodology and Implementation text, and the SDD method-ladder line.
- The synthetic secondary-cone (`cone-sec`) cases of the App now show a band on the throughput and power charts: at least the
  relative half-width of CrusherCal's held-out 80 percent band (`uq.band_rel_pct`, read at run time from `hp500/loo.json`),
  labelled in both languages as a lower bound from the calibrated model family. The other machine types show no band and say
  that no measured data exist for them; a missing document gives no band and the readiness message (BL-017, completes BL-005).
- Methodology, Experiments, Benchmark, the CrusherCal card and the SDD state the new band and its limit.

### Changed

- The engine, in Python and in TypeScript, now warns with two stable codes that never make a point invalid: `css_below_vendor_minimum`
  (a closed-side setting below the vendor minimum of the machine type: secondary cone 16 mm, tertiary and short-head cone 6 mm, jaw
  40 mm; no bound for the gyratory, no source found) and `reduction_ratio_above_typical` (F80/P80 above the typical ceiling of one
  stage: secondary cone 5, tertiary and short-head cone, jaw and gyratory 4). The constants cite the Metso HP application guide, the
  Metso C Series brochure and Metso Basics in Minerals Processing. A secondary cone at 1 mm with an F80 of 126 mm, reported valid and
  unflagged before, now carries both codes and stays valid.
- Contract `case-manifest` 1.1.0 (minor): the two codes join the `flags` enum. Seven of the 17 synthetic cases gain a code (S06 both;
  CK1, S05, T01, T02, H01 and H02 the ratio code); the ten HP500 surveys gain none. The bilingual flag texts name each bound and its source.
- CK1 is relabelled "Absolute-number control, HP-class cone": the product's absolute anchor is the calibrated HP500 lane (Rocha et al.
  2024), and Duarte et al. 2021 cannot serve because it gives no throw, speed, ore properties or power and its size data are plots only.
- The notebooks 01-02 and 03-02, in both languages, count the two advisory warnings apart from the refusals and print the
  bounds and the reduction ratio they quote from the engine's own tables; reviewed again before the release.

## [0.10.000] · 2026-10-27

### Changed - the product re-instantiated on CAOS_PRODUCT_TEMPLATE 0.11.005 and the shared shell 0.19.3

- The repository is an instance of the product template 0.11.005 (`.template-version`, `product.json`): its pipeline, its data
  contracts and the contract catalog, the lanes and the lane gate, the readiness document, the documentation tree, the
  notebooks, the guards and the measured gate. The shell is pinned exactly at 0.19.3 (it was the range `^0.3.0`).
- The canonical engine is a Python port of the shipped TypeScript engine (`data-pipeline/pipeline/model/crusher/`); the two are
  held to each other by one committed reference of operating points (`tests/fixtures/engine-reference.json`), checked on both
  sides. The Node bridges that ran the TypeScript engine offline are retired.
- The HP500 real lane runs on the Python engine: the ten surveys of Rocha et al. 2024 are a contract of their own
  (`data/examples/hp500-surveys.csv`), and the calibrated backbone and CrusherCal are rebuilt from it with the same numbers.
- The surrogate and the anomaly autoencoder are retrained on a Latin-hypercube sweep of the Python engine and evaluated held out
  through the shipped ONNX graphs (`data/derived/model-metrics.json`).
- The offline pipeline is ChancaDEM's own on the template's structure: contract 1 for the crusher operating point
  (`data/examples/params.csv`, 17 cases), 27 cases (17 authored circuit cases and the 10 measured HP500 surveys) each with a
  bilingual title, band, context and numeric expected ranges that fail the bake, and the bake of contract 2 (index, manifests
  with trace sha256, traces with the capacity and setting sweeps) with the measured lane gate. `run.py` commands: `all` (the
  release bake, never trains), `<case>`, `readiness`, `hp500`, `models` (train then evaluate), `fixtures`.

### Added

- The executive view of the Introduction: crushing and comminution as an industry problem in copper mining, with sector figures
  read at their sources and three illustrations, the landing of the site.
- The App as a case workbench with Focus: groups Chamber (with a 3D chamber view framed per machine), Product, Performance,
  Learned, Validation and Context over the 27 cases and their variants.
- The documentation pages rewritten for this product: Introduction (technical view), Methodology, Implementation (with the
  architecture diagrams), Experiments and Benchmark; the wiki of framework cards under `docs/frameworks/`.
- Contracts: twelve catalog rows with their schemas, providers, tests on both sides and a declared missing-data behavior.
- Two units gates (CAOS_MANAGE `conventions/units-gate.md`): CONTRACT 3 at run time and over the shipped artifacts
  (`pipeline/core/unit_gate.py`, run by the bake and by `scripts/check_artifacts.py`), and CONTRACT 3b at author time
  (`scripts/check_unit_constants.py` with the reviewed `scripts/.unit_constants_allow.json`).
- `pipeline/oracles.py` (Rosin-Rammler, Bond energy and power, mass closure) with its tests, and the coverage matrix of the 27
  cases in `docs/cases/README.md`.
- Public pipeline functions for the steps the notebooks teach: `pipeline.hp500.loo` (`fold_indices`, `fit_capacity_base`,
  `predict_capacity`, `fit_freeform`, `predict_freeform`, `fit_residual`, `fit_power_form`, `mape`, `r2`, `stats`,
  `predictive_band`, `nested_band_coverage`), `pipeline.stages.evaluate` (`r2_mape`, `monotonicity_check`, `planted_points`),
  `pipeline.stages.train` (`target_vector`) and `pipeline.model.crusher.whiten` (`assemble_chamber`, `replacement_walk`).
- The notebooks: 18 per language in seven topics, worked lessons that run the product's methods through those public functions,
  reviewed against the notebook bar by a reviewer other than their writer; the README states the repository by areas.

### Changed

- The learned models answer only where they apply. Both model contracts record the training ranges (`training.input_ranges`),
  and one rule decides in `pipeline.model.bundles.applicability` and `frontend/src/lib/ort.ts`: a model applies when the point
  is not calibrated and every continuous input lies inside its machine's range; otherwise the slot's baseline answers (the
  engine, the envelope gate), labelled with the reason, in both languages. A shared table of 155 points gives the same verdicts
  on both sides. The Benchmark no longer grades the surrogate on the measured surveys.
- CrusherCal's 80 percent band is measured out of sample too (contract `hp500-loo` 1.1.0): beside the in-sample coverage (0.90
  on throughput, sigma from the same ten residuals) the nested coverage takes each survey's sigma from the other nine (0.80 on
  throughput, 0.90 on power). Every page and card says which coverage each figure is.
- The design document's BS-1 states what is measured (held-out MAPE 12.09 percent, in sample 11.55, constant mean 18.29) and
  no longer claims a band of the paper, for which the repository holds no source.

### Removed

- The template's epidemic example (model, stages, cases, data, tests), the dormant Pyodide entrypoint, the work-in-progress 2-D
  DEM tracer (the DEM is the documented frontier on the Methodology page), the Node sweep bridges and the 0.09.003 root
  documents (scaler, autoencoder scaler and threshold, surrogate metrics, case results).

### Fixed

- The envelope gate tests the F80 the feed declares (the untruncated Rosin-Rammler value) for the calibrated support, not the F80
  read on the 256 mm grid, on both engines; a calibrated point with a declared F80 of 180 mm is flagged `f80_outside_calibrated`.
- The version surfaces agree (VERSION, CHANGELOG, the manifests, the tag), closing issue #44; the tests read the version from
  VERSION.
- The executive view states the digital-twin adoption in processing as its source shows it (28 percent), does not claim the
  product models liner wear, and its Spanish carries the same content as its English.
- The shell scripts are executable; the attribution states the real data the product uses.

## [0.09.003] · 2026-08-25

### Fixed

- Give the content routes real files, so a shared link answers 200
- Cap the App-route notes and the caption blocks the paragraph rule could not reach
- Cap the reading measure on the content routes
- fix: remove the last lab-name residue from scripts and docs
- fix(guards): untrack the sweep .jsonl outputs
- refactor: a product declares no package of its own

## [0.09.002] · 2026-07-31

### Fixed - the docs routes were clipping content with no way to reach it

The ADR-0071 UI floor put `height: 100dvh; overflow: hidden` on the WHOLE shell. That is correct for the
workbench route, where the instrument should own the viewport, and wrong for the prose routes, which are
legitimately taller than the screen: `overflow: hidden` deleted the overflow instead of scrolling it, and no
inner scroller existed to recover it. Measured on production at 1600x900: /experiments hid 255px and /benchmark hid 3700px. No user gesture reached
that content - mouse wheel and the End key both left `scrollY` at 0.

ADR-0071 rule 1 says scrolling belongs INSIDE the container that owns long content. The floor had implemented
the "not on the document" half and skipped the "inside the container" half.

`main.page:has(> .page-body:not(.<app-layout>)) { overflow-y: auto; min-height: 0 }` gives the prose routes
their own scroll while leaving the workbench route locked. Fixed at source in
`tools/ui-floor/apply_ui_floor.py` (now v2) so it cannot be reapplied wrong, and the reachability gate now
sweeps EVERY route: its previous single-route check passed because the two document-scroll equalities it
asserted are TRUE BECAUSE the shell clips. A page that hides what did not fit satisfies them.

## [0.09.001] · 2026-07-31

### Fixed
- Focus deep links answered **HTTP 404**. GitHub Pages serves `404.html` for an unknown path, so
  `/focus/gyratory` LOADED through the SPA fallback while reporting 404. ADR-0070 requires the focus route
  to be shareable, and a shared link that reports 404 is a real gap: link checkers, chat unfurls and
  anything reading the status code see a broken URL. `prerender-focus.mjs` now materializes a real
  `index.html` per machine at build time, parsing the ids from `physics/types.ts` so a new crusher gets a
  shareable URL for free.

## [0.09.000] · 2026-07-31

### Fixed - the layout was clipping content with no way to reach it

Measured on production at 1600x900: `.app-shell` was 900px tall with `overflow: hidden` while its content
was **1033px**, and both grid columns were **960px tall inside a 773px row**. TEN controls were clipped
and unreachable: speed, rock size, Fracture on, Reset view, apply, Target P80 and the Mass balance tab.

The ADR-0071 floor had been applied to the SHELL but never to the inner containers, which is worse than
not applying it: `.tz-layout` stayed `display: grid` with `align-items: start`, so both columns sized to
their CONTENT and the shell's `overflow: hidden` then hid whatever did not fit. "No scrollbar" was being
read as "everything fits". It meant the page was hiding what did not.

- Grid rows are `minmax(0, 1fr)` with `align-items: stretch`, so the columns are sized by the ROW.
- `Chamber3D` no longer sizes itself with `clamp(460px, 74vh, 900px)`. A viewport-relative height ignores
  the panel it is placed in: 74vh is 666px on a 900px screen, forced into a 555px tab panel. It now fills
  its parent when asked to.
- Every container fits exactly: shell 900/900, rail 741/741, tab panel 555/555. **0 unreachable elements.**

### Changed - tabs regularized per ADR-0071, and the rail is sectioned

- Eleven flat tabs wrapped onto a second row. They are now FIVE groups on ONE 45px row (Chamber, Product,
  Performance, Balance, Learned), with the sub-views revealed on hover from the same tab.
- The rail held 1036px of stacked cards in 741px, so a NAVIGATION panel had to be scrolled before anything
  could be touched. Split into Setup and Operate; each fits.
- Machine is a dropdown, not five wrapping chips, matching the Case control above it.
- The camera fits on whichever FOV half-angle binds. Using the vertical FOV alone on a 1206x480 panel left
  the chamber a small object in a field of white.

### Added - ADR-0070 focus mode

A full-viewport view of the SELECTED crusher: stage at 80% of the viewport, the operating state named in
one plain sentence, KPIs as a HUD rather than cards, and a visible return. Reachable from a control in the
App rail, carrying the selected machine, so it is not an orphan route.

### Verification

`_tz-gate.mjs` 10/10 and `_reach.mjs`, both driving the browser: one tab row, hover menus, every rail and
tab control hit-tested with `elementFromPoint`, focus stage share, and zero clipped-and-unreachable
elements. The first focus attempt shipped a stage where the canvas collapsed to zero height and the chrome
piled over the HUD, because the component root was not a flex column; that is what looking at the render
caught and a passing route test would not have.

## [0.08.001] · 2026-07-30

### Fixed
- **Version coherence.** `conventions/versioning.md` requires `VERSION`, the manifests, the CHANGELOG and
  the git tag to move together on every release; they had drifted apart here (VERSION 0.06.000, frontend 0.8.0 and pipeline 0.6.0 all disagreeing, with the latest tag at v0.08.000). A line-wide sweep on
  2026-07-30 found 79 tags across 9 CAOS repos pointing at commits that declare a different version, the
  result of releases being tagged and deployed without a bump. The user-visible cost is that the app footer
  reads its version from a manifest, so a deployed app reported a version older than the release it was
  running, and the tag stopped being usable to answer "what is live right now".
- Every version source in this repo now declares the same number. Historical tags are left untouched: a
  published tag is the accurate record of a release that happened, so the drift is fixed by moving the files
  forward, never by rewriting or deleting the tag.
- Guarded going forward by `tools/version-audit/check_version_coherence.py` in CAOS_MANAGE, which fails when
  the manifests disagree with each other, with the CHANGELOG, or when the declared version is behind the
  latest tag.

## [0.08.000], 2026-07-11

### Changed (physics fidelity: eccentric throw)
- Corrected the direction of eccentric THROW on product size. The engine previously routed throw through the
  per-nip specific energy (`more stroke => finer`), which INVERTED the crusher literature. Throw now acts through
  the Whiten classification window: K2 (the always-broken threshold) tracks the open-side gap OSS = CSS + throw,
  so a larger throw opens the chamber wider, larger particles escape in the open phase, and the product is
  COARSER at fixed CSS with a higher capacity and a lower reduction ratio. This is the Evertsson 1999
  (doi:10.1016/S0892-6875(99)00136-3) / Andersen and Napier-Munn 1988 direction. Verified: at CSS 32 mm on the
  cone-sec, throw 16 to 50 mm moves P80 25.0 to 31.7 mm (coarser) and capacity 547 to 780 t/h.
- The per-nip breakage energy Ecs is now driven by the gyration rate and the machine DESIGN stroke (a per-machine
  reference in the new `physics/machines.ts`), not the live throw, so throw coarsens via classification rather
  than wrongly fining via energy. The classification throw term is centered on the design throw, so the reference
  cases and the calibrated lane are unchanged (S01 P80 stays 27.70 mm, bit-identical).
- The calibrated HP500 (Real) lane is untouched: `t10Calibrated` and `hp500Params` have no throw term (Rocha et
  al. did not vary throw), so the held-out LOO benchmark and the backbone are byte-identical.
- Surrogate + denoising-AE re-baked on the corrected engine (independent LHS held-out): P80 R2 0.995, t/h R2
  0.998, monotone-vs-CSS preserved, so the ONNX still honestly emulates the engine.
- Methodology (Classification) + the docs Whiten-engine card now state K2 tracks OSS = CSS + throw (throw
  coarsens); added the verified Evertsson 1999 flow-model reference.

## [0.07.002], 2026-07-11

### Changed
- 3D chamber now fills the available workbench height instead of a fixed 360px box: the mount uses a responsive
  `clamp(460px, 74vh, 900px)` and the renderer reads the actual rendered height, staying in sync on window
  resize (the ResizeObserver now tracks height as well as width). The bottom viz controls are compact, so the
  view is far larger on a normal screen. The fit-all camera already accounts for aspect/fov, so centering is
  preserved at the taller size.

## [0.07.001], 2026-07-11

### Fixed
- Reference integrity (ADR-0017 §4): every on-page citation now carries a real, checkable `doi` or `url`. The
  nine pre-DOI references that previously rendered as bare, non-clickable text now link to an authoritative open
  archive (Whiten 1972 on SAIMM; Evertsson 2000 on Chalmers Research; Bond 1952 on OneMine; Rosin & Rammler 1933
  on CiNii) or an authoritative catalog record (Napier-Munn 1996, Austin 1984 on WorldCat). Andersen & Napier-Munn
  1988 links to its Semantic Scholar record.
- Corrected a conflated Karra reference: the vibrating-screen title (Karra 1979, CIM Bulletin) was wrongly merged
  with the 1982 IMPC venue. The engine uses the cone-crusher capacity paper, now cited correctly as Karra (1982),
  "A process performance model for cone crushers", 14th IMPC.
- Corrected the Evertsson (2000) thesis ISBN checksum digit (91-7197-856-7 became 91-7197-856-9, per the Chalmers
  record).
- `docs/` wiki references are now clickable: DOIs render as `doi.org` links (in the reference lists and inline
  prose) and the pre-DOI works carry their open-archive/catalog links, matching the app.

### Note
- Two genuinely print-only society papers (Narayanan & Whiten 1988, Trans. IMM Sec. C; Karra 1982, 14th IMPC)
  have no open landing page and are explicitly marked as such in the citation text (never a fabricated link);
  their method is corroborated by linked references (Napier-Munn 1996, Tavares 2022).

## [0.07.000], 2026-07-10

### Changed
- 3D chamber viz upgrade: the camera now FITS + centers the chamber (cone/gyratory revolution and jaw), and the
  point-of-view PERSISTS across operating-point/machine/theme changes (only Reset view re-fits), so orbiting is
  no longer lost on every option change.
- Rocks are now low-poly instanced meshes coloured by size; on crossing the break zone a rock shrinks and, with
  Fracture on, SHATTERS into scattering shards, so the crushing reads visually.

### Added
- Bottom viz controls under the 3D chamber: animation speed (0.25-4x), rock size (0.5-2.5x), Fracture on/off,
  Reset view.
- Autoplay on load (usePausedViz autoStart) for visual impact; the rAF still halts on a hidden tab (ADR-0059).

## [0.06.000], 2026-07-07

### Added
- **CrusherCal: a leave-one-survey-out (LOO) validation of the calibrated HP500 backbone, with honest results.**
  The novel-beyond-SOTA contribution is methodological, held-out (LOO) parity + calibrated uncertainty on OPEN
  industrial data, running live in the browser. It is NOT a claim of lower error than the DEM / phenomenological
  SOTA, and every number is computed from the 10 real Rocha et al. 2024 surveys (none asserted).
  - New offline validator `data-pipeline/pipeline/hp500/loo.py` (numpy-only, deterministic, seeded) grades three
    models on identical LOO folds for the measured targets t/h and kW (P80 is a model output, reported as
    self-consistency): M0 calibrated backbone (global scalars refit per fold), M1 backbone + bounded ridge
    residual (the CrusherCal proposal), M2 free-form OLS (the overfit strawman). Strict AND leaky folds expose the
    optimism gap; negative controls (label-shuffle, constant-mean) and an 80% predictive-interval coverage check
    are included. Traces committed to `data/derived/hp500/loo.json`.
  - New Node bridge `data-pipeline/pipeline/sweep/bake_hp500.mjs` runs the SAME live TypeScript engine on the 10
    surveys and writes `data/derived/hp500/backbone.json` (the physics stays the single source of truth). Wired
    into `pipeline.pipeline` (light lane rebuilds the LOO from the committed backbone; `--retrain` re-bridges).
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
- **`tools/` → `data-pipeline/pipeline/`**, the sweep (`sweep/gen_sweep.mjs`, the SAME TS engine, no Python
  re-port), the surrogate + denoising-AE training, and the offline 2-D DEM tracer split into the six named stages +
  `model/`. Bodies unchanged.
- **`src/` → `frontend/src/`**; `public/*.onnx` + scalers + metrics → **`data/derived/`** (the canonical artifact
  home). `frontend/copy-data.mjs` overlays them back into `public/` at build (the SPA's fetch paths are unchanged).
- The default pipeline is **numpy-only**: `python data-pipeline/run.py all` rebuilds every per-case replay trace +
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
