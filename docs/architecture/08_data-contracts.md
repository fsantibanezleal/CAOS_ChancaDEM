# The data contracts

A product is real when its data flow through enforced contracts. Every boundary of ChancaDEM is a row of
[`docs/contracts/catalog.md`](../contracts/catalog.md) (ADR-0080): its owner, its version, one language-neutral schema
file, a sample document, a test on each side, its missing-data behavior, a provider that serves it until the real producer
exists, and a swap test that runs the same consumer assertions against both. This page says what the boundaries are for
and how they are held; **the rows themselves (owners, schema paths, tests, behaviors) live only in the catalog and are
not copied here**, so there is one place to change.

## The boundaries

| Group | Contracts (catalog ids) | What crosses |
|---|---|---|
| Ingestion | `params-record`, `hp500-survey` | the operating point of a synthetic case; one measured HP500 survey |
| Artifacts | `case-index`, `case-manifest`, `trace` | the inventory of the 27 cases, one manifest per case, one replay trace per case |
| Validation | `hp500-backbone`, `hp500-loo` | the calibrated engine on each survey; CrusherCal with its controls and bands |
| Model slots | `surrogate-model`, `anomaly-model`, `model-metrics` | the inference contract and graphs of the two learned models, and their held-out evaluation |
| State | `readiness` | what is real in this build, row by row |
| Service | `api` | the dormant read-only API |

The schema files are the single source: Python validates against them in its tests, and the TypeScript types are generated
from them (`frontend/src/lib/contract.gen.ts`, from `docs/contracts/api.openapi.json`, whose components reference the
schema files; `frontend/scripts/gen-contract-types.mjs`, and the web build fails when it is not current). Contract versions
follow semver with a History entry per version and a lock file, checked by `scripts/check_contract_versions.py`, also
against the base branch in CI.

## Contract 1, ingestion

`data-pipeline/pipeline/io/contract.py` (params) and `data-pipeline/pipeline/hp500/surveys.py` (surveys) parse a source
table, `data/examples/params.csv` and `data/examples/hp500-surveys.csv`. Values arrive as text and are parsed, never
coerced. A row is **rejected with its reason** when a column is missing, a cell is empty, non-numeric, NaN or infinite, a
value is outside its bounds, the machine is unknown, the case id is malformed or duplicated, or (surveys) a survey number is
repeated or the numbers are not 1 to n without a gap. A physically unusual but plausible row is **accepted and flagged** with
the engine's own code (`pass_through` when the setting is at or above the feed's $F_{80}$, `css_ge_feed_top` when it is
at or above the 256 mm top size), so the controls CP1 and CI1 are baked and shown, never dropped. The bounds and units of
every column are in `data/README.md`, and a test holds the schema's bounds equal to the code's. This is the door through
which a reader's own data enter ([guide 02](../guides/02_bring-your-own-data.md)).

## Contract 2, artifacts

`core/manifest.py` and `core/trace.py` write the index (`chancadem.index/v1`), the manifests (`chancadem.manifest/v1`) and
the traces (`chancadem.trace/v1`) into `data/derived/`: parameters, seed, engine and version, the artifact with its byte
size and sha256, the lane verdict and its budgets, the flags as stable codes, the metrics and the model that produced each
slot's answer (released or baseline), the expected ranges, the case context in both languages, the source, and for a real
case the measured survey. The trace is described in [architecture 02](02_determinism-and-trace.md).

## Contract 3, the units gate

Not a catalog row: `core/unit_gate.py` checks, in the bake and again over the shipped artifacts, that every prediction is
finite and lies in its observable's range widened by one full range on each side (the measured values across the ten
surveys for a real case's measured observables, the engine's declared physical domain otherwise). It judges units, not
accuracy. `scripts/check_unit_constants.py` is the author-time half: every float literal of the engine declares the
quantity it is measured in.

## The model slots

The surrogate and the autoencoder are released as a JSON contract plus ONNX graphs, valid only when the contract passes
its schema and each graph has the recorded sha256 and size (`model/bundles.py`). When a slot is not valid, the baseline
answers and says so: the engine itself for the surrogate (it answers every query exactly, at its own cost), the envelope
gate for the autoencoder. A swap test per slot runs the same assertions against the baseline and the released model.

## Missing data is a declared state

Every row has one of six states, computed by `core/readiness.py` from the catalog and the repository and written to
`data/derived/readiness.json`: `available`, `partial` (what is absent is listed), `stale` (an older bake answered),
`provider` (the row's provider answered), `training` (a model slot answered with its baseline while no valid release
exists) and `missing`. The rules, in order, with their bilingual reasons, are the catalog's section Missing-data states.
The site labels every view a provider, a stale bake or a baseline serves, and shows "not available yet" with the reason for
what is missing; the dormant API answers 503 with the state and the reason instead of an empty body that looks like data.
The readiness document carries the product version and the catalog's SHA-256 instead of a time.

## The walking skeleton

`docs/contracts/fixtures/data/derived/` is a provider tree in the layout of `data/derived/`: two cases (FX01, at the
operating point of S01, and FX02, at HP500 survey 1), their manifests and traces, the index, the HP500 documents, the model
contracts with their graphs, the metrics and a readiness document that says `provider` for every row but the dormant API.
`python data-pipeline/run.py fixtures` regenerates it from the code. The site builds on it
(`CAOS_DATA_ROOT=docs/contracts/fixtures/data/derived npm run build`) and the API serves it
(`DATA_DIR=docs/contracts/fixtures/data/derived`), so the frontend and the API are checked before a first real bake, and
every contract test runs against it and against the bake with the same assertions.

## How they are held

- The bake fails when a result lies outside its case's expected range (`core/expect.py`) or a prediction leaves its units.
- `tests/contracts/` validates every document the pipeline writes (a fresh sandbox bake and the committed one), the provider
  tree, the model slots and every API response against the schema files and the OpenAPI document.
- `frontend/src/lib/contract.test.ts` reads every committed document and the provider tree against the web's descriptors in
  both directions.
- `scripts/check_artifacts.py` (index, manifests and artifacts agree, byte sizes included, lanes match gates),
  `scripts/check_readiness.py` (the committed readiness is current), `scripts/check_contracts.py` (every catalog row is
  complete and every path it names exists), `scripts/check_documents.py` (every committed document is valid against the
  schema its row names) and `scripts/check_skeleton.py` (lists rows still served by a provider: allowed while a product is
  built, never at a release).
- `frontend/scripts/copy-data.mjs` copies exactly the declared files into the site, the readiness document included, and
  fails on a missing one unless readiness lists it in a `partial` row; the web fetches them with the version in the address
  and refuses an answer that is not JSON.
