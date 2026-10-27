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

TECHNOLOGY_TABLE

## Resources

RESOURCES_TABLE

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
  256 KiB, and every case is live-eligible (LANES_MEASURE).

## Method ladder

METHOD_LADDER

## Cases

CASES_SECTION

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

BEYOND_SECTION

## Deploy driver

GitHub Pages at chancadem.fasl-work.com: a static site with every artifact committed, no secret and no server, for a public
repository. The measurement behind it is the lane gate (every case is live-eligible) and the site size (DEPLOY_MEASURE).
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
