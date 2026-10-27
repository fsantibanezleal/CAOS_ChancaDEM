# Contract catalog: ChancaDEM

Phase 2 of contract-first parallel delivery (ADR-0080; rule 11 sections 11 to 20 in CAOS_MANAGE). One row per
boundary and per model slot. Each schema file is the single source of its contract: the Python producers and
consumers validate against it in their tests, and the TypeScript types are generated from it
(`frontend/src/lib/contract.gen.ts`, from `docs/contracts/api.openapi.json`, whose components reference the schema
files). A change to a contract bumps its row's version and updates both sides in one pull request.

Checks: `python scripts/check_contracts.py docs/contracts/catalog.md --repo-root .` (every field, every path) and
`python scripts/check_skeleton.py docs/contracts/catalog.md` (exit 2 lists the rows still served by a provider;
allowed while a product is being built, never at a release). The readiness document
(`data/derived/readiness.json`) is computed from this file; editing the catalog makes it stale until
`python data-pipeline/run.py readiness` runs again (`scripts/check_readiness.py` fails meanwhile).

Versions and history: a contract's version moves with its schema, by semver (a removed or renamed field, a narrowed
type or a new required field is major; a new optional field is minor; a description or example change is patch), and
every version has a row in the History section below, whose `kind` is the semver step from the contract's previous row
(the first row is `initial`). `docs/contracts/versions.lock.json` holds each schema's version and digest (line endings
normalised to LF); `python scripts/check_contract_versions.py` fails when a schema changed under the same version, when
a version went down, when the lock is not current with the catalog, or when a row has no History entry for its current
version. After a deliberate bump and its History row, run `python scripts/check_contract_versions.py --update` and
commit the lock with the schema and both sides in one pull request.

The lock alone is trusted by that offline check, so a schema change with the lock edited by hand passes it. CI therefore
also runs `python scripts/check_contract_versions.py --base <ref>` (the push's `before` SHA, or `origin/develop`, on a
checkout with `fetch-depth: 0`; a ref it cannot resolve fails, it never passes silently). Against the schemas and the
catalog at that ref it fails when a schema changed and its version is not above the ref's, when the version goes down,
when a change that is breaking by the mechanical floor did not take a major step, and when a contract that had a schema
at the ref has none now without a `major` History row that records the removal. A contract with no row at the ref is a
first release. The mechanical floor is a minimal JSON Schema diff: a removed property, definition or enum value, a
property newly required, a changed const, a narrowed type, an added or tightened bound, pattern or format,
`additionalProperties` turned false or constrained, an added constraint on `items`, `not` or `$ref`, a removed `anyOf` or
`oneOf` alternative, an added `allOf` member, and for the OpenAPI file a removed path, operation, response or component.
It is the floor and not the judgement: a reviewer still decides the semantic breaks it cannot see (a changed meaning, a
unit, a default value), and a pull request that changes a contract states its step in the review.

The `documents` column (template 0.09.000) says which committed files a row's schema governs, so that
`scripts/check_documents.py` names no document and a product takes it verbatim. A cell is `-` (a contract with no committed
document, for example one only exchanged at run time) or one or more globs relative to the repository root, separated by `, `:
Python `pathlib` glob semantics (`*` within one path segment, `**` for any depth, so use it only where a depth varies); a glob
starting with `!` excludes what the row's other globs match (`data/derived/manifests/*.json, !data/derived/manifests/index.json`);
on a row whose schema file is the OpenAPI document each glob is written `path#ComponentName` and the files validate against
that component. The globs under `data/` and `models/` apply twice, at the repository root and in the provider tree
`docs/contracts/fixtures/`. The row's `example` cell is validated too when it is a file under `docs/contracts/examples/`. The
guard fails on a file two rows govern, on a JSON file under `data/derived` or `models` that no row covers (it would pass
unvalidated), and on a path outside the repository; `check_contracts.py` checks the cells. A glob that matches nothing is not an
error (`check_artifacts.py` and `check_readiness.py` judge absence), except that a row whose missing-data behavior begins
`missing:` and whose cell is one fixed path (the index) reports that path when it is absent.

## Contracts

| id | version | owner | schema file | example | documents | producer test | consumer test | missing-data behavior | provider | model io | swap test | status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| params-record | 1.0.0 | data-pipeline/pipeline/io/contract.py | docs/contracts/schemas/params-record.schema.json | docs/contracts/examples/params-record.json | - | tests/contracts/test_params_record.py::test_accepted_records_match_the_schema | tests/contracts/test_params_record.py::test_adversarial_schema_valid_records_are_accepted, tests/test_contract.py | partial: a rejected row is dropped with its reason and the bake goes on with the accepted rows; readiness lists the rejected case ids. missing: no source table; readiness says missing and the bake uses the registry's cases | fixture:docs/contracts/fixtures/data/examples/params.csv | - | tests/contracts/test_params_record.py::test_swap_fixture_and_example_sources | real |
| hp500-survey | 1.0.0 | data-pipeline/pipeline/hp500/surveys.py | docs/contracts/schemas/hp500-survey.schema.json | docs/contracts/examples/hp500-survey.json | - | tests/contracts/test_hp500.py::test_survey_table_validates | tests/contracts/test_hp500.py::test_adversarial_survey_rows_are_rejected_with_reasons | missing: data/examples/hp500-surveys.csv is absent; readiness says missing, the bake skips the ten real cases and the two HP500 documents, the selector lists no real survey and the survey views on Experiments and Benchmark say not available yet with the reason. partial: a rejected row is dropped with its reason, its case is not baked and readiness lists the survey number | fixture:docs/contracts/fixtures/data/examples/hp500-surveys.csv | - | tests/contracts/test_hp500.py::test_swap_fixture_and_published_tables | real |
| case-index | 1.0.0 | data-pipeline/pipeline/core/manifest.py | docs/contracts/schemas/case-index.schema.json | docs/contracts/fixtures/data/derived/manifests/index.json | data/derived/manifests/index.json | tests/contracts/test_documents.py::test_index_validates | frontend/src/lib/contract.test.ts | missing: the site build stops at copy-data (no site without an inventory), the API answers 503 missing, readiness says missing. stale: engine_version older than VERSION; readiness says stale with both versions and the views show it | fixture:docs/contracts/fixtures/data/derived/manifests/index.json | - | frontend/src/lib/contract.test.ts, tests/contracts/test_documents.py::test_fixture_tree_validates | real |
| case-manifest | 1.0.0 | data-pipeline/pipeline/core/manifest.py | docs/contracts/schemas/case-manifest.schema.json | docs/contracts/fixtures/data/derived/manifests/FX01.json | data/derived/manifests/*.json, !data/derived/manifests/index.json | tests/contracts/test_documents.py::test_manifests_validate | frontend/src/lib/contract.test.ts | partial: a manifest the index lists is absent; readiness lists its path, the case selector marks the case not available yet and the other cases work, the API answers 404 for it. stale: as case-index | fixture:docs/contracts/fixtures/data/derived/manifests/FX01.json | - | frontend/src/lib/contract.test.ts, tests/contracts/test_documents.py::test_fixture_tree_validates | real |
| trace | 1.0.0 | data-pipeline/pipeline/core/trace.py | docs/contracts/schemas/trace.schema.json | docs/contracts/fixtures/data/derived/FX01/trace.json | data/derived/*/trace.json | tests/contracts/test_documents.py::test_traces_validate | frontend/src/lib/contract.test.ts, frontend/src/engine/crusher.parity.test.ts | partial: an artifact a manifest names is absent; readiness lists its path and that case's replay views show not available yet with the reason (the live lane still runs from the manifest's params), the API answers 404 for it. stale: as case-index | fixture:docs/contracts/fixtures/data/derived/FX01/trace.json | - | frontend/src/lib/contract.test.ts, tests/contracts/test_documents.py::test_fixture_tree_validates | real |
| hp500-backbone | 1.0.0 | data-pipeline/pipeline/hp500/backbone.py | docs/contracts/schemas/hp500-backbone.schema.json | docs/contracts/fixtures/data/derived/hp500/backbone.json | data/derived/hp500/backbone.json | tests/contracts/test_hp500_validation.py::test_backbone_validates | frontend/src/lib/contract.test.ts | missing: the document is absent (no survey table, or the bake skipped it); readiness says missing and the survey views on Experiments and Benchmark say not available yet with the reason; the ten real cases still replay their own manifests. stale: engine_version older than VERSION; readiness says stale | fixture:docs/contracts/fixtures/data/derived/hp500/backbone.json | - | tests/contracts/test_documents.py::test_fixture_tree_validates | real |
| hp500-loo | 1.0.0 | data-pipeline/pipeline/hp500/loo.py | docs/contracts/schemas/hp500-loo.schema.json | docs/contracts/fixtures/data/derived/hp500/loo.json | data/derived/hp500/loo.json | tests/contracts/test_hp500_validation.py::test_loo_validates | frontend/src/lib/contract.test.ts | missing: the document is absent; readiness says missing, the real-survey gauges show the measured values without a predictive band and say why, and the Benchmark validation views say not available yet with the reason. stale: as hp500-backbone | fixture:docs/contracts/fixtures/data/derived/hp500/loo.json | - | tests/contracts/test_documents.py::test_fixture_tree_validates | real |
| surrogate-model | 1.0.0 | data-pipeline/pipeline/stages/train.py | docs/contracts/schemas/surrogate-model.schema.json | docs/contracts/examples/surrogate-model.json | data/derived/models/surrogate.json, data/derived/models/surrogate.onnx, data/derived/models/surrogate.int8.onnx | tests/contracts/test_models.py::test_surrogate_bundle_validates | tests/contracts/test_models.py::test_onnx_graphs_match_their_contract, frontend/src/lib/ort.test.ts | training: the contract or a graph is absent, fails its schema or its sha256; readiness says training with provenance baseline, the what-if view answers with the engine itself (labelled: the baseline answers) and the Benchmark labels the metrics with the model that answered | baseline:data-pipeline/pipeline/model/crusher/engine.py | in: x float32 [1, 11]: the machine one-hot in machine_order (cone-sec, cone-tert, jaw, cone-short-head, gyratory), then css_mm, throw_mm, speed_rpm, feed_x63_mm, feed_m, ore_axb standardised by in_mean and in_std; out: y float32 [1, 10]: p80_mm, p50_mm, p20_mm, pass_1, pass_4, pass_8, pass_16, pass_32, throughput_tph, power_kw, standardised, then 10 to the power where out_log; trained on an LHS sweep of the engine inside the bounds its training block records (training.input_ranges, per machine and input); it answers only an operating point that is not calibrated and lies inside those ranges, otherwise the engine answers, labelled calibrated_case or outside_training_range; monotone in css_mm for P80 (model-metrics) | tests/contracts/test_models.py::test_adversarial_swap_engine_baseline_and_surrogate | real |
| anomaly-model | 1.0.0 | data-pipeline/pipeline/stages/train.py | docs/contracts/schemas/anomaly-model.schema.json | docs/contracts/examples/anomaly-model.json | data/derived/models/psd-ae.json, data/derived/models/psd-ae.onnx | tests/contracts/test_models.py::test_anomaly_bundle_validates | tests/contracts/test_models.py::test_onnx_graphs_match_their_contract, frontend/src/lib/ort.test.ts | training: the contract or the graph is absent, fails its schema or its sha256; readiness says training with provenance baseline and the anomaly view answers with the envelope gate (labelled: the baseline answers) | baseline:data-pipeline/pipeline/model/crusher/envelope.py | in: x float32 [1, 14]: the features of feature_order from an engine result, standardised by mean and std; out: xr float32 [1, 14], the reconstruction; score = mean squared error over the 14 values, anomalous above threshold_p99; scores only an operating point that is not calibrated and lies inside training.input_ranges, otherwise the envelope gate answers, labelled calibrated_case or outside_training_range | tests/contracts/test_models.py::test_adversarial_swap_envelope_baseline_and_autoencoder | real |
| model-metrics | 1.0.0 | data-pipeline/pipeline/stages/evaluate.py | docs/contracts/schemas/model-metrics.schema.json | docs/contracts/fixtures/data/derived/model-metrics.json | data/derived/model-metrics.json | tests/contracts/test_models.py::test_metrics_validate | frontend/src/lib/contract.test.ts | missing: the document is absent; readiness says missing and the Benchmark model views say not available yet with the reason, never a number from an older bake. stale: engine_version older than VERSION; readiness says stale | fixture:docs/contracts/fixtures/data/derived/model-metrics.json | - | tests/contracts/test_documents.py::test_fixture_tree_validates | real |
| readiness | 1.0.0 | data-pipeline/pipeline/core/readiness.py | docs/contracts/schemas/readiness.schema.json | docs/contracts/fixtures/data/derived/readiness.json | data/derived/readiness.json | tests/contracts/test_readiness.py::test_committed_readiness_is_current | frontend/src/readiness/readiness.test.ts | missing: the site build stops at copy-data; if the document cannot be loaded at run time the views keep working and each says readiness unknown; the API answers 503 missing | fixture:docs/contracts/fixtures/data/derived/readiness.json | - | frontend/src/readiness/readiness.test.ts | real |
| api | 1.0.1 | app/ | docs/contracts/api.openapi.json | docs/contracts/examples/api-unavailable.json | docs/contracts/examples/api-unavailable.json#UnavailableBody | tests/contracts/test_api.py::test_responses_match_the_openapi_document | frontend/src/lib/api.contract.test.ts | missing: a document the route serves is absent, the API answers 503 with state missing and the reason (never an empty body); an unknown case or artifact is 404. The static readiness says missing for this row while the API lane is dormant; /api/readiness says available | fixture:docs/contracts/fixtures/data/derived | - | tests/contracts/test_api.py::test_swap_fixture_tree_and_bake | real |

## Missing-data states

One vocabulary for every row (ADR-0080 decision 3). `data-pipeline/pipeline/core/readiness.py` computes each row's
state from this catalog and the repository; the frontend and the API show it. Rules, applied in this order, first
match wins:

| Row kind | Condition | state | provenance | reason en | reason es |
|---|---|---|---|---|---|
| any | the catalog `status` is `active` | `provider` | the provider kind | Served by its provider ({provider}); the real producer is not built yet. | Lo sirve su proveedor ({provider}); el productor real aún no está construido. |
| case-index, case-manifest, trace | `data/derived/manifests/index.json` is absent | `missing` | null | The pipeline has not baked this build. | El pipeline no ha generado esta versión. |
| case-manifest | a manifest the index lists is absent | `partial` | `real` | {n} of {total} manifests are absent. | Faltan {n} de {total} manifiestos. |
| trace | an artifact a present manifest names is absent | `partial` | `real` | {n} of {total} artifacts are absent. | Faltan {n} de {total} artefactos. |
| case-index, case-manifest, trace | the index `engine_version` differs from `VERSION` | `stale` | `real` | Baked by {engine_version}; the product is {version}. | Generado por {engine_version}; el producto es {version}. |
| params-record | `data/examples/params.csv` is absent | `missing` | null | No source table; the bake uses the registry's cases. | No hay tabla de origen; la generación usa los casos del registro. |
| params-record | contract 1 rejects some rows | `partial` | `real` | {n} of {total} rows rejected by contract 1. | {n} de {total} filas rechazadas por el contrato 1. |
| hp500-survey | `data/examples/hp500-surveys.csv` is absent | `missing` | null | No survey table; the real HP500 cases are not baked. | No hay tabla de mediciones; los casos reales HP500 no se generan. |
| hp500-survey | the survey contract rejects some rows | `partial` | `real` | {n} of {total} surveys rejected by the survey contract. | {n} de {total} mediciones rechazadas por el contrato de mediciones. |
| hp500-backbone, hp500-loo | the document is absent | `missing` | null | The HP500 validation was not baked in this build. | La validación HP500 no se generó en esta versión. |
| hp500-backbone, hp500-loo, model-metrics | the document's `engine_version` differs from `VERSION` | `stale` | `real` | Baked by {engine_version}; the product is {version}. | Generado por {engine_version}; el producto es {version}. |
| surrogate-model | `data/derived/models/surrogate.json` or a graph it names is absent, fails its schema or its sha256 | `training` | `baseline` | No released surrogate; the engine itself answers. | No hay un sustituto publicado; responde el propio motor. |
| anomaly-model | `data/derived/models/psd-ae.json` or its graph is absent, fails its schema or its sha256 | `training` | `baseline` | No released autoencoder; the envelope gate answers. | No hay un autocodificador publicado; responde la compuerta de envolvente. |
| model-metrics | the document is absent | `missing` | null | The models were not evaluated in this build. | Los modelos no se evaluaron en esta versión. |
| api | always, in the static document | `missing` | null | The API lane is dormant; the site reads the committed documents. | La API está inactiva; el sitio lee los documentos versionados. |
| any | otherwise | `available` | `real` | null | null |

The `status` column holds `real` or `active` only, in lower case; any other value fails the readiness computation (and so
`scripts/check_readiness.py`), because a status the rules do not know would be published as real. `{provider}` is
the row's provider cell (`kind:path`); `{n}`, `{total}`, `{engine_version}` and `{version}` are
filled from the repository. `missing` is a list of strings, non-empty exactly when the state is `partial`: the
absent paths relative to `data/derived/` (manifests, artifacts), the rejected case ids (params-record) or the rejected
survey numbers (hp500-survey), sorted.
`/api/readiness` returns the committed document with the `api` row set to status `real`, state `available`, provenance `real`, reason
null. What each surface does:

| state | the frontend shows | the API answers |
|---|---|---|
| `available` | the result | 200 |
| `partial` | the result for what exists; each absent case or artifact says not available yet | 200 for what exists, 404 for the absent paths |
| `stale` | the result and a note with the version that baked it | 200 |
| `provider` | the result and a note naming the provider kind | 200 |
| `training` | the result and a note naming the model that answered (the engine or the envelope gate, the slot's baseline) | 200 |
| `missing` | an explicit not available yet with the reason, never an empty chart | 503 with `{"detail": {"state": "missing", "reason": {...}}}` |

A `partial` bake builds: `frontend/scripts/copy-data.mjs` and `scripts/check_artifacts.py` accept an absent
manifest or artifact only when the readiness document lists it in the `missing` of a `partial` row (and the
readiness is current, `scripts/check_readiness.py`); any other absent file stops them.

## Providers

- `docs/contracts/fixtures/data/derived/`: a provider tree in the layout of `data/derived/`: two cases, `FX01` (a synthetic
  secondary cone at the operating point of case S01) and `FX02` (a real case at HP500 survey 1), their manifests and traces,
  the index, the two HP500 documents, the model contracts with their graphs, the model metrics and a readiness document that
  says `provider` for every row but `api`, which is dormant and so `missing`. The frontend builds on it with
  `CAOS_DATA_ROOT=docs/contracts/fixtures/data/derived` (a walking skeleton before any bake), the API serves it with
  `DATA_DIR=docs/contracts/fixtures/data/derived`, and the contract tests run against it and against `data/derived/` with the
  same assertions (the swap tests). Its numbers come from the canonical engine (`pipeline.model.crusher`), so they are
  correct for their points; it is still scaffolding, labelled as a provider on every surface.
- `docs/contracts/fixtures/data/examples/params.csv` and `hp500-surveys.csv`: two-row source tables for contract 1 and the
  survey contract.
- `data-pipeline/pipeline/model/crusher/engine.py`: the surrogate slot's baseline, the engine itself, which answers every
  query exactly at its own cost.
- `data-pipeline/pipeline/model/crusher/envelope.py`: the anomaly slot's baseline, the envelope gate, a rule check on the
  physical and calibrated envelope.

A provider is scaffolding: labelled on every surface by the readiness document, never counted as done for the unit
that owes the real producer.

## History

One row per version of every contract, newest last within a contract. `kind` is initial, major, minor or patch, per
the rules above. The contracts of ChancaDEM start at 1.0.0 on its re-instantiation on template 0.11.002 (release
0.10.000); the shapes the product shipped before (`chancadem.manifest/v2` and the trace of 0.06.000, the scaler files) are
not reconstructed.

| contract | version | date | change | kind |
|---|---|---|---|---|
| params-record | 1.0.0 | 2026-10-26 | the crusher operating point: machine, closed-side setting, throw, speed, Rosin-Rammler feed, ore A times b and work index, with the bounds of contract 1 | initial |
| hp500-survey | 1.0.0 | 2026-10-26 | one measured HP500 survey (Table A1 of Rocha et al. 2024): f80, closed-side setting, feed rate, power | initial |
| case-index | 1.0.0 | 2026-10-26 | the index of cases with bilingual titles, categories, the real or synthetic flag, the default case and the further files the site serves (`chancadem.index/v1`) | initial |
| case-manifest | 1.0.0 | 2026-10-26 | the per-case manifest with the operating point, the measured survey of a real case, the measured lane gate, metrics, expected ranges and the case context (`chancadem.manifest/v1`) | initial |
| trace | 1.0.0 | 2026-10-26 | the per-case replay: the gradations on the sieve grid, the classification curve, the result scalars, the speed and setting sweeps (`chancadem.trace/v1`) | initial |
| hp500-backbone | 1.0.0 | 2026-10-26 | the calibrated engine on each HP500 survey (`chancadem.hp500.backbone/v1`) | initial |
| hp500-loo | 1.0.0 | 2026-10-26 | CrusherCal, the leave-one-survey-out validation with its controls and predictive bands (`chancadem.hp500.loo/v1`) | initial |
| surrogate-model | 1.0.0 | 2026-10-26 | the surrogate MLP slot: its inference contract and ONNX graphs, the engine as its baseline (`chancadem.surrogate/v1`) | initial |
| anomaly-model | 1.0.0 | 2026-10-26 | the denoising autoencoder slot: its inference contract and ONNX graph, the envelope gate as its baseline (`chancadem.anomaly/v1`) | initial |
| model-metrics | 1.0.0 | 2026-10-26 | the held-out evaluation of the two model slots (`chancadem.model-metrics/v1`) | initial |
| readiness | 1.0.0 | 2026-10-26 | what is real in a build, row by row, in one of six declared states (`chancadem.readiness/v1`) | initial |
| api | 1.0.0 | 2026-10-26 | the dormant read-only API, GET only, 503 with the declared state when a document is absent | initial |
| api | 1.0.1 | 2026-10-27 | the artifact route's description names a ChancaDEM case path; no field, type or response changed | patch |
