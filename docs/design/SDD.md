# Software design document: ChancaDEM

ChancaDEM is a crusher-comminution studio: a reader picks a crushing case, a synthetic circuit case or one of ten
measured industrial surveys of a secondary cone crusher, and reads the product size, the throughput and the power from a
population-balance, capacity and power engine that re-runs in the browser, beside two learned models and the measured
values. This document states what the product builds and how each statement is checked (ADR-0075); the guard
`scripts/check_sdd.py` holds every requirement to a gate that exists. It was written for release 0.10.000, the product's
re-instantiation on CAOS_PRODUCT_TEMPLATE 0.11.002 and the shared shell 0.19.2; the product itself has shipped since
release 0.01.000 (2026-06-20, `CHANGELOG.md`).

## Problem and non-goals

Problem: crushing is the first stage of comminution, and its setting decides how much work the grinding mill downstream
must do. Four coupled levers, the closed-side setting, the eccentric throw, the eccentric speed and the feed size
distribution, set three outcomes a plant measures, the product size P80, the throughput and the power, through a
non-linear chain: a tighter setting gives a finer product and less capacity, the capacity rises with speed up to an
optimum and falls past it, and a wider throw coarsens the product at a fixed setting. ChancaDEM makes that chain visible
and quantified for one crushing case at a time, with the physics of the Whiten population balance, the Evertsson
capacity model and the Bond energy law, and holds it against ten measured surveys of a Metso HP500 secondary cone
(Rocha et al. 2024) with a leave-one-survey-out validation.

Non-goals, each something a reader could reasonably assume:

- A sizing or selection tool for a real crusher, or a digital twin of a measured plant. The synthetic machines' constants
  are illustrative of their class; only the HP500 lane is calibrated, and to one machine on one ore.
- A discrete-element simulation. The 3D chamber is a kinematic view of the chamber geometry, its motion and the engine's
  gradation; industrial DEM with breakage needs hours per second of operation and runs offline in the state of the art
  (Methodology, the population-balance topic). The product's earlier work-in-progress 2-D DEM tracer was removed in
  0.10.000 and is a backlog item, not a method of this release.
- A grinding model. Grinding and SAG milling are another product's lane (ChargeCascade); ChancaDEM stops at the crusher
  product.
- A backend. `app/` is a dormant read-only API; the product is a static site.

## Executive brief

The executive view of the Introduction is data, kept apart from this document: one file frames crushing and comminution
as an industry problem for a decision maker (a landing block, five sub-tabs, three illustrations and a linked source for
every figure), in English and Spanish, written from the problem-context research before the development of this release
and valid against the shell's executive schema. The product lands on it; the header order stays App, Introduction,
Methodology, Implementation, Experiments, Benchmark. The standard is
[`docs/guides/06_executive-brief.md`](../guides/06_executive-brief.md).

Data file: content/executive.json

## Research basis

The research was done before each plan and persisted with the product's coordination records (the engineering dossiers
of 2026-06-20 to 2026-07-11, the problem-context dossier of 2026-10-26). The decisions it carried, claim by claim:

| decision | what the research found | source |
|---|---|---|
| The live core is the Whiten classification-breakage population balance, p = (I - C)(I - B C)^-1 f | The crusher model that represents a crushing chamber by a classification function C and a breakage function B solved for the product | Whiten 1972, https://www.saimm.co.za/Conferences/Apcom72/317-Whiten.pdf |
| The classification uses the K1, K2, K3 form; K2 tracks the open-side setting, so a wider throw coarsens the product | The Andersen and Napier-Munn parameterisation and the flow model in which a larger throw lets larger particles escape | Andersen and Napier-Munn 1988, https://www.semanticscholar.org/paper/Power-prediction-for-cone-crushers-Andersen-Napier-Munn/2c60e81b909b65cba85b44583354dc8e310ec2f8; Evertsson 1999, https://doi.org/10.1016/S0892-6875(99)00136-3 |
| The capacity rises with eccentric speed to an optimum and falls past it | The Evertsson cone-crusher flow and capacity model | Evertsson 2000, https://research.chalmers.se/en/publication/759 |
| The breakage matrix comes from the JKMRC t10 energy-fineness relation and the Austin appearance function | The t10 family and the ore's A times b as the breakage descriptors | Napier-Munn et al. 1996, https://search.worldcat.org/title/37081193 |
| Power and specific energy from the Bond third theory | W = 10 Wi (1 / sqrt(P80) - 1 / sqrt(F80)) | Bond 1952, https://onemine.org/documents/the-third-theory-of-comminution |
| The real lane is ten measured surveys of a Metso HP500 secondary cone, with their Andersen-Whiten fit, under CC BY 4.0 | Table A1 (measured CSS, f80, feed rate, power) and Table 5 (the fit) of the paper | Rocha, Campos, Silva and Tavares 2024, https://doi.org/10.3390/min14090919 |
| Industrial DEM of crushers is the state of the art and runs offline; the population balance is its fast approximation | Particle-replacement DEM of compression crushers and its validation needs | Cleary and Sinnott 2015, https://doi.org/10.1016/j.mineng.2014.10.021; Quist and Evertsson 2016, https://doi.org/10.1016/j.mineng.2015.11.004 |
| A learned surrogate of a phenomenological comminution model is the state of the art for fast what-ifs; it emulates the model, not the plant | A deep network surrogate of a comminution circuit's phenomenological models | Koh et al. 2021, https://doi.org/10.1016/j.mineng.2021.107026 |
| The executive view's sector figures: concentrators took 55.7 percent of Chilean copper-mining electricity in 2024, and electricity per tonne of fine copper rose 46.2 percent from 2010 while the ore grade fell from 0.75 to 0.62 percent | Cochilco's energy-consumption report for 2024 | Cochilco 2025, https://www.cochilco.cl/web/download/991/2025/15151/consumo-de-energia-en-la-mineria-del-cobre-actualizacion-ano-2024.pdf |
| Requirements are written in EARS form, each with its gate | The five EARS patterns | Mavin et al. 2009, https://doi.org/10.1109/RE.2009.9 |

UNVERIFIED: the global shares of world electricity attributed to comminution (figures of 1.8, 3 or 4 percent circulate)
could not be traced to a study opened during the problem-context research and are not used anywhere in the product; two
print-only society papers (Narayanan and Whiten 1988; Karra 1982) have no open landing page, so the product cites the
linked works that reproduce their methods (Napier-Munn et al. 1996, Tavares 2022, Evertsson 2000) instead.

## Sizing and contracts

The design rests on the two artifacts of contract-first parallel delivery (ADR-0080): the sizing, kept with the product's
coordination records (the repositories, components, modules with their owner units, eleven boundaries, the technology
versions verified on primary sources, the machine limits and the parallel units with disjoint write scopes), and the
contract catalog, kept here, [`docs/contracts/catalog.md`](../contracts/catalog.md). Every boundary is a catalog row with
one schema file, an example, a test on each side, its missing-data behavior, a provider and a swap test.

- Ingestion (params-record, contract 1, `data-pipeline/pipeline/io/contract.py`): the operating point of each synthetic
  case (machine, closed-side setting, throw, speed, Rosin-Rammler feed, ore A times b and work index) is validated before
  a run; a value the schema refuses is rejected with its reason, never coerced; a physically unusual point (a setting at
  or above the feed's f80 or its top size) is accepted and flagged, so the controls are baked.
- Real data (hp500-survey, `data-pipeline/pipeline/hp500/surveys.py`): the ten surveys of Table A1, transcribed, validated
  the same way.
- Artifacts (case-index, case-manifest, trace, contract 2): the index of the 27 cases, one manifest per case (operating
  point, the measured survey of a real case, the lane verdict, metrics, expected ranges, the case's context and source)
  and one trace per case (the gradations on the sieve grid, the classification curve, the result scalars, the speed and
  setting sweeps). The web's types are generated from the schema files.
- The validation documents (hp500-backbone, hp500-loo): the calibrated engine on each survey, and CrusherCal, its
  leave-one-survey-out validation with controls and predictive bands.
- The model slots (surrogate-model, anomaly-model) and their held-out evaluation (model-metrics): the surrogate's
  baseline is the engine itself, the autoencoder's is the envelope gate; each slot answers with its baseline, labelled,
  when its released bundle is invalid.
- Readiness: what is real in this build, row by row, in one of six declared states, shown on every view.
- The dormant API (api): GET only; 503 with the declared state when a document is absent.

## Technology and versions

Every pinned dependency of `requirements-precompute.txt` (through `data-pipeline/requirements.txt`), `requirements-dev.txt`,
`notebooks/requirements.txt` and `frontend/package.json`, with the version installed; `scripts/check_tech_matrix.py` fails when a
pin and this table disagree. A package.json range is recorded at the version `frontend/package-lock.json` resolves it to. The
versions were read at the package registries on 2026-10-26 (the sizing record lists the sources). Runtimes: Python 3.13
(the workstation; CI uses the template's Python 3.12) and Node 24 (the workstation; CI uses the template's Node 22).

| component | package | version | use | alternative considered |
|---|---|---|---|---|
| engine | numpy | 2.4.6 | the canonical crusher engine (the Whiten solve, the sieve grid, the capacity and power), the bake, CrusherCal and the notebooks | scipy.linalg for the solve, rejected: the engine ports the TypeScript LU line for line so the two engines agree to 2.3e-12 |
| models | torch | 2.12.1 | trains the surrogate MLP and the denoising autoencoder on the CPU (`data-pipeline/run.py models`, local only) | scikit-learn MLP, rejected: no ONNX export of the same network with its standardisation and seeds |
| models | onnx | 1.22.0 | writes the two networks as ONNX graphs and quantises the surrogate to int8 | TorchScript, rejected: the browser runs ONNX, not TorchScript |
| models | onnxruntime | 1.27.0 | evaluates the shipped graphs held out and checks the export parity; the same release as the web's onnxruntime-web | evaluating in torch, rejected: the metrics must come from the graphs the site runs |
| notebooks | matplotlib | 3.11.2 | the figures of the notebooks | none: the notebooks need a plotting library, and the web's charts run in the browser only |
| notebooks | nbclient | 0.11.0 | executes a notebook top to bottom in a fresh kernel (`scripts/run_notebooks.py`) | nbconvert --execute, rejected: a heavier install for the same execution |
| notebooks | nbformat | 5.11.1 | reads and writes the notebook format | none: the format's own library |
| notebooks | ipykernel | 7.4.0 | the Python kernel the notebooks run in | none: nbclient needs a kernel |
| tests | pytest | 9.1.1 | the engine, pipeline, contract, guard and adversarial tests | unittest, rejected: no parametrisation or fixtures |
| lint | ruff | 0.15.18 | lint of data-pipeline, tests, scripts and app | flake8 plus isort, rejected: two tools for one |
| contracts | jsonschema | 4.26.0 | validates every committed document against its schema file | fastjsonschema, rejected: no support for the draft the schemas declare |
| contracts | openapi-spec-validator | 0.9.0 | validates `docs/contracts/api.openapi.json` | none: the maintained validator for OpenAPI 3.1 |
| API | fastapi | 0.143.0 | the dormant `app/`, run by the API contract tests | flask, rejected: no response models to compare with the OpenAPI document |
| API | httpx | 0.28.1 | the test client of the dormant `app/` | requests, rejected: FastAPI's test client needs httpx |
| shell | @fasl-work/caos-app-shell | 0.19.2 | the shared app shell, its workbench, charts, gate (pinned exactly, ADR-0078) | a hand-rolled shell, forbidden by ADR-0078 |
| web | react | 19.3.0 | the UI | none: the shell requires it |
| web | react-dom | 19.3.0 | the UI renderer | none: the shell requires it |
| web | react-router | 8.4.0 | the routes and the forward of the old focus links | none: the shell requires it |
| web | zustand | 5.0.15 | the store the template's workbench pattern uses | redux, rejected: a store of a few keys |
| web | katex | 0.19.1 | typeset equations on the pages | MathJax, rejected: heavier and slower to render |
| web | lucide-react | 1.52.0 | icons | the shell's own set where it has one |
| web | uplot | 1.6.32 | the interactive curves under the shell's `UPlotChart` | a static SVG, rejected: no hover, zoom or data table (G20) |
| web | onnxruntime-web | 1.27.0 | runs the two ONNX graphs in the browser (WASM, single thread, the WASM served by the site) | TensorFlow.js, rejected: the models are exported to ONNX and the release must match the Python onnxruntime |
| web | three | 0.186.1 | the 3D chamber view (a kinematic view of the chamber geometry) | a 2D drawing only, rejected: the chamber is a surface of revolution whose gap changes around the mantle; the 2D section is kept beside it |
| build | vite | 8.3.5 | bundler and dev server | webpack, rejected: slower and needs more configuration |
| build | @vitejs/plugin-react | 6.1.1 | the React transform for vite | none |
| build | typescript | 5.9.3 | type check of the web and the generated contract types | none |
| build | openapi-typescript | 7.13.0 | generates `contract.gen.ts` from the OpenAPI document | hand-written types, rejected: they drift (the build checks them) |
| build | @types/node | 24.19.1 | types of the build scripts and the reference writer | none |
| build | @types/react | 19.3.0 | types of React | none |
| build | @types/react-dom | 19.3.0 | types of React DOM | none |
| build | @types/three | 0.186.0 | types of three.js | none |
| tests | vitest | 5.0.3 | the web unit tests: contracts both ways, engine reference and parity, the model encodings, the views | jest, rejected: needs a transform for the vite config |
| gate | playwright | 1.63.0 | the measured UI gate (`npm run gate`), local only | cypress, rejected: heavier install |

## Resources

What each stage needs on the development workstation (Windows 11, Python 3.13, Node 24.14.1; measured 2026-10-27 with
`tools/audit/measure_command.py` of CAOS_MANAGE on a `git archive` copy of the release branch: the wall time, the peak memory
of the whole process tree polled every 20 ms, and the bytes left). The commands and the raw output are in
[`measured-resources.md`](measured-resources.md). No stage needs a GPU or a network after the install.

| stage | memory | disk | time | where it runs |
|---|---|---|---|---|
| bake (`data-pipeline/run.py all`: 27 cases, the HP500 backbone and CrusherCal, the index, readiness) | 67 MB peak | 286 KB of artifacts in `data/derived/` (285,678 bytes, 65 files) | 7.3 s | workstation, never CI |
| training (`data-pipeline/run.py models`: the LHS sweeps of the engine, the surrogate and the autoencoder, ONNX export, held-out evaluation) | 453 MB peak | 58 KB of graphs and contracts in `data/derived/models/` (58,120 bytes, 5 files) | 48 s on the CPU | workstation, never CI |
| tests (pytest, the whole suite) | 268 MB peak | temporary trees under the temp root (`--basetemp`), removed after | 962 s | workstation; the planted-defect suite `tests/adversarial` also runs in CI |
| install (`npm ci`) | 644 MB peak | 328 MB in `node_modules` (11,422 files) | 25 s | workstation and CI web job |
| build (`npm run build`) | 567 MB peak | 16.8 MB in `frontend/dist` (16,820,928 bytes, 159 files), of which 13.5 MB is the ONNX Runtime WASM | 12 s | workstation and CI web job |
| web unit tests (`npm test`, 309 tests) | 1951 MB peak (vitest's worker pool) | none | 10 s | workstation and CI web job |
| deploy payload (GitHub Pages) | none | 16.8 MB uploaded | one Pages deploy | CI after main |

## Lanes

- Offline: `data-pipeline/run.py` bakes the 27 cases on the canonical Python engine (`data-pipeline/pipeline/model/crusher/`),
  checks each against its expected ranges and the units gate, and writes the HP500 validation documents; the models are
  trained and evaluated by `data-pipeline/run.py models` (torch on the CPU). All of it runs on a workstation, never in CI
  and never in the browser (ADR-0074).
- Replay: the committed artifacts, copied into the site by `frontend/scripts/copy-data.mjs` (exactly the files the index
  declares) and drawn as the dashed replay curves and the Validation views.
- Live: `frontend/src/engine/`, the TypeScript engine the product shipped since 0.02.000, held to the Python engine by
  the shared reference `tests/fixtures/engine-reference.json` (121 operating points, the largest relative difference
  2.3e-12) and to the baked traces by `frontend/src/engine/crusher.parity.test.ts`; the two ONNX models run in the
  browser through onnxruntime-web 1.27.0 with its WASM served by the site. The basis for the live lane is measured: the
  lane gate (`data-pipeline/pipeline/core/gate.py`) judges each case's engine time against 1500 ms and its trace against
  256 KiB, and every case is live-eligible (the canonical engine evaluates a case in 1.34 ms, the median over the 27 cases of the median of seven warmed runs, at most 2.03 ms; the largest trace is 4,127 bytes; [`measured-resources.md`](measured-resources.md)).

## Method ladder

Classical to learned, each method with its acceptance criterion and the gate that fails it (ADR-0069). The engine is one
vertical implementation in two languages: the Python package `data-pipeline/pipeline/model/crusher/` is canonical, and every
criterion below holds in the TypeScript port because the shared reference holds the two equal
(`tests/test_crusher_engine.py::test_python_engine_reproduces_the_reference`, `frontend/src/engine/reference.test.ts`).

| # | method | kind | acceptance criterion | gate |
|---|---|---|---|---|
| M1 | Rosin-Rammler feed on a square-root-of-two sieve grid (Rosin and Rammler 1933), P80 by interpolation | classical | the feed masses sum to 1 and the coarsest edge passes 100 percent | `tests/test_crusher_engine.py::test_feed_psd_normalizes_and_f80_is_sensible` |
| M2 | JKMRC t10 energy-fineness relation and the Austin appearance function (Napier-Munn et al. 1996) | classical | the breakage matrix is strictly lower triangular and every column conserves mass | `tests/test_crusher_engine.py::test_breakage_matrix_is_strictly_lower_triangular_and_columns_conserve_mass` |
| M3 | Andersen and Napier-Munn classification K1, K2, K3, with K2 tracking the open-side setting | classical | C(d) is monotone, 0 below K1 and 1 above K2; a wider throw coarsens the product at a fixed setting and is neutral at the design throw | `tests/test_crusher_engine.py::test_classification_is_monotone_non_decreasing_c_small_zero_c_large_one`, `tests/test_crusher_engine.py::test_more_throw_widens_oss_and_gives_a_coarser_product_with_higher_capacity` |
| M4 | The Whiten population balance p = (I - C)(I - B C)^-1 f (Whiten 1972), with its conditioning proxy | classical | mass closure and a product finer than the feed; a tighter setting gives a finer product | `tests/test_crusher_engine.py::test_whiten_solve_conserves_mass_and_product_normalizes`, `tests/test_crusher_engine.py::test_tighter_css_gives_a_finer_product` |
| M5 | Evertsson capacity with eccentric speed (Evertsson 2000) | classical | the capacity is unimodal in speed | `tests/test_crusher_engine.py::test_capacity_is_unimodal_in_speed` |
| M6 | Nip angle against its grip limit, and the regimes | classical | the pass-through and invalid regimes are flagged at a setting at or above the feed's F80 and top size | `tests/test_crusher_engine.py::test_pass_through_and_invalid_guard_fires_when_css_ge_feed_top_size` |
| M7 | Bond power (Bond 1952) and the current-based power form of Rocha et al. 2024 | classical | positive and finite at every valid point; the honest negative of the current-based form on the engine's Bond draw is reported, not hidden | `tests/test_crusher_engine.py::test_throughput_and_power_are_positive_and_finite_for_a_valid_point`, `tests/contracts/test_hp500_validation.py::test_loo_validates` |
| M8 | The Andersen-Whiten fit calibrated to the ten HP500 surveys (Rocha et al. 2024 Table 5) | classical, calibrated | the calibrated engine at each survey equals the backbone document; the surveys are physically plausible | `tests/contracts/test_hp500_validation.py::test_backbone_is_the_engine`, `tests/test_crusher_engine.py::test_envelope_gate_the_ten_real_hp500_surveys_are_physically_plausible` |
| M9 | The envelope gate: implausible and out-of-calibrated-support inputs flagged, never answered with a confident number | classical | an implausible point is flagged and invalid; a calibrated point outside the HP500 support is flagged as extrapolating | `tests/test_crusher_engine.py::test_envelope_gate_an_implausible_point_is_flagged_and_marked_invalid`, `tests/test_crusher_engine.py::test_envelope_gate_calibrated_lane_flags_out_of_support_as_extrapolating` |
| M10 | CrusherCal: leave-one-survey-out validation of the backbone (M0), a bounded ridge residual (M1) and a free-form fit (M2), with a constant-mean baseline, a label-shuffle control and an 80 percent predictive band | classical, validation | the label-shuffle control does not beat the backbone; the backbone beats the constant mean on throughput; the leaky-strict optimism gap is exposed; the band's coverage is reported | `tests/test_hp500_loo.py::test_adversarial_the_label_shuffle_control_does_not_beat_the_backbone`, `tests/test_hp500_loo.py::test_tph_backbone_has_real_skill`, `tests/test_hp500_loo.py::test_adversarial_the_leaky_folds_expose_the_optimism_gap` |
| M11 | The surrogate MLP 11-64-64-32-10 trained on a Latin-hypercube sweep of the engine; baseline: the engine itself | learned | held out on an independent draw, every output's R2 is computed from the shipped graph through onnxruntime; P80 monotone in CSS on every machine; with an invalid bundle the engine answers, labelled | `tests/contracts/test_models.py::test_metrics_validate`, `tests/contracts/test_models.py::test_adversarial_swap_engine_baseline_and_surrogate` |
| M12 | The denoising autoencoder 14-16-6-16-14 as an extrapolation score; baseline: the envelope gate | learned | false-alarm and detection rates on the held-out draw and on planted off-manifold points, beside the envelope gate's on the same points | `tests/contracts/test_models.py::test_metrics_report_the_anomaly_comparison_and_the_planted_points`, `tests/contracts/test_models.py::test_adversarial_swap_envelope_baseline_and_autoencoder` |

Not a method of this release: discrete-element simulation with breakage (the state of the art the population balance
approximates, Cleary and Sinnott 2015; Quist and Evertsson 2016), stated on the Methodology page as the frontier.

## Cases

27 cases in five categories (`data-pipeline/pipeline/cases/`; the coverage matrix is [`docs/cases/README.md`](../cases/README.md)):

- Primary crushing: G01 and G02 (gyratory, hard run-of-mine and soft high-tonnage), J01 and J02 (jaw, hard run-of-mine and
  a trickle-fed medium ore).
- Secondary cone: S01 (the reference point, choke-fed at the capacity optimum; the default case), S02 (soft and coarse,
  below the optimum speed), S03 (hard, past the optimum: the throughput falls), S04 (hard run-of-mine at a wide setting), S05
  (fines-heavy, tight setting), S06 (trickle-fed, tight setting).
- Tertiary crushing: T01 and T02 (tertiary cone, fine feed; hard and closed), H01 and H02 (short-head, the finest product;
  hard and choke-fed).
- Controls: CP1 (pass-through: a setting wider than the feed's F80, a reduction ratio near 1, flagged), CI1 (invalid: a
  setting wider than the feed top size, flagged and marked invalid, never a confident number), CK1 (the calibration anchor
  for the Duarte et al. 2021 industrial data; synthetic, its fit not executed in this release, and labelled so).
- Real surveys: HP500-01 to HP500-10, the ten measured surveys of a Metso HP500 secondary cone at Minas Rio (Rocha et al.
  2024, CC BY 4.0), each at its measured setting and feed f80, scored against its measured throughput and power.

Every case states numeric expected ranges, enforced by `data-pipeline/pipeline/core/expect.py`, and its context (the
problem, the variables, how to read the views). Variants, computed live: the canonical setting, a tight setting (15 percent
lower) and an open setting (15 percent higher).

## Oracles

- Closed forms independent of the engine's numerics (`data-pipeline/pipeline/oracles.py`, `tests/test_oracles.py`): the
  Rosin-Rammler passing at the characteristic size equals 1 - 1/e; the Bond energy of a reduction from F80 to P80 by its
  closed form; the mass of every baked product sums to the feed's within the solver's closure.
- Parity: the Python engine is the reference of the TypeScript engine, point for point, to 1e-9 relative
  (`tests/test_crusher_engine.py`, `frontend/src/engine/reference.test.ts`).
- The measured surveys: the HP500 cases are scored against the measured throughput and power, out of sample, by
  CrusherCal (`data-pipeline/pipeline/hp500/loo.py`), with a constant-mean baseline and a label-shuffle control.
None of these is a model judging a model.

## Beyond the state of the art

- BS-1, CrusherCal: an out-of-sample validation of a calibrated crusher model on open industrial survey data, with a
  calibrated predictive band and pre-registered controls, run in the reader's browser. The state of the art it goes
  beyond: the HP500 model of Rocha et al. 2024 is fitted and judged in sample on the same ten surveys
  (https://doi.org/10.3390/min14090919), and the learned surrogates of comminution models (Koh et al. 2021,
  https://doi.org/10.1016/j.mineng.2021.107026) report no held-out industrial parity and no uncertainty. Evidence, from the
  committed `data/derived/hp500/loo.json`: the calibrated capacity backbone reproduces the measured throughput with a strict
  leave-one-survey-out error inside the paper's own band and below the constant-mean baseline, the label-shuffle control
  does not beat it, the 80 percent band's empirical coverage is reported, and the bounded residual's failure to beat the
  backbone out of sample is reported as the pre-registered null it is. Covered by a level 4 notebook in each language
  (`notebooks/*/06-crushercal/`).

## Deploy driver

GitHub Pages at chancadem.fasl-work.com: a static site with every artifact committed, no secret and no server, for a public
repository. The measurement behind it is the lane gate (every case is live-eligible) and the site size (16.8 MB of site files, 13.5 MB of it the self-hosted ONNX Runtime WASM, and 286 KB of artifacts, [`measured-resources.md`](measured-resources.md)).
The target is written in `deploy/TARGET` and checked by `scripts/check_deploy_place.py`.

## Risks and kill criteria

- Risk: the two engines drift. Kill: the shared reference fails on either side (`tests/test_crusher_engine.py`,
  `frontend/src/engine/reference.test.ts`), and the parity test fails against the baked traces.
- Risk: a learned model is read as measured reality. Kill: every learned view is labelled with the model that answered and
  that it emulates the engine, the Benchmark reports its held-out error from the committed metrics, and the anomaly slot
  stands beside the rule-based envelope gate.
- Risk: the calibration leaks into the validation. Kill: CrusherCal refits every fitted scalar without the held-out survey
  (strict folds), reports the leaky folds beside it, and its label-shuffle control must not beat the backbone.
- Risk: an answer in the wrong units. Kill: the units gate (CONTRACT 3) in the bake and over the shipped artifacts, and
  `scripts/check_unit_constants.py` (CONTRACT 3b) over the engine's constants.
- Risk: a test rewrites the committed artifacts. Kill: the session guard in `tests/conftest.py` fails the run.
- Risk: the site looks right and is not (a blank drawing, a dead control, a broken deep link). Kill: the measured gate
  (`npm run gate`) fails before a deploy.
- Risk: a provider ships as if it were the product. Kill: readiness labels it on every view, and `scripts/check_skeleton.py`
  lists every row still on a provider.
- Kill criterion for the HP500 lane: if a re-transcription of Table A1 disagrees with the committed table, the lane is
  withdrawn from the release until the table is corrected.

## ADR fit

| ADR | Rule | Carried by |
|---|---|---|
| ADR-0054 | the committed artifacts are the evidence; the web replays them and re-runs only a light engine live | `data-pipeline/`, `docs/contracts/catalog.md`, the lane gate |
| ADR-0057 | two contracts, named stages, lanes; the product declares no package | `data-pipeline/`, `docs/contracts/catalog.md`; `product.json` `method_packages` is `[]` |
| ADR-0058 | architecture modal, five themed bilingual tabs | `frontend/src/architecture/`, validated by the shell on mount |
| ADR-0069 | every promised method one vertical implementation with its acceptance criterion | the Method ladder above, each criterion with its gate; the DEM is not promised in this release |
| ADR-0070 | Focus mode for the App: the workbench opens the open group of a case in the full viewport; `?focus=1`, Escape or the exit button returns to the same case, group and sub-view | `frontend/src/workbench/Workbench.tsx` (`focus`), `npm run gate` with `--require-focus` (G18); the App is a workbench (`product.json` has no `app` field) |
| ADR-0071 | the page is the viewport; one tab row; the instrument at least half the App route | the shell's `CaseWorkbench`; the gate (G5, G6) |
| ADR-0074 | CI runs cheap checks only; training and the bake are local | `.github/workflows/ci.yml`, `scripts/check_ci_budget.py` |
| ADR-0075 | every requirement names its gate | `docs/design/features/`, `scripts/check_sdd.py` |
| ADR-0078 | rules live in the base | shell 0.19.2 (pinned exactly) over template 0.11.002; no product re-implements them |
| ADR-0080 | contract-first parallel delivery | `docs/contracts/`, `tests/contracts/`, `frontend/src/readiness/`, `scripts/check_contracts.py`, `scripts/check_readiness.py` |
