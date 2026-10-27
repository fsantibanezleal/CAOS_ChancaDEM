# data/, the data contracts and layout

This folder is governed by the data contracts of ADR-0057, written as schemas in `docs/contracts/schemas/` and listed in
`docs/contracts/catalog.md`. The pipeline reads two source tables, applies their ingestion contracts, and writes the
committed artifacts the web replays.

## Layout

| Path | What | Git |
|---|---|---|
| `raw/` | private or large source inputs | git-ignored (never committed) |
| `examples/params.csv` | the 17 circuit cases as operating points: the table contract 1 validates | committed |
| `examples/hp500-surveys.csv` | the ten measured HP500 surveys, Table A1 of Rocha et al. 2024 (CC BY 4.0) | committed |
| `derived/manifests/` | per-case `<case>.json` (contract 2) and the flat `index.json` inventory | committed |
| `derived/<case>/trace.json` | the replay artifact of each of the 27 cases | committed |
| `derived/hp500/` | `backbone.json` (the calibrated engine on each survey) and `loo.json` (CrusherCal, leave-one-survey-out) | committed |
| `derived/models/`, `derived/model-metrics.json` | the two released model slots (contracts and ONNX graphs) and their held-out evaluation | committed |
| `derived/readiness.json` | what is real in this build, row by row, computed from the catalog | committed |

## CONTRACT 1, ingestion (raw to pipeline), the bring-your-own-data gate

Defined in `data-pipeline/pipeline/io/contract.py` against `docs/contracts/schemas/params-record.schema.json`. A row of
`examples/params.csv` is **accepted** iff it satisfies the schema; **rejected** with a reason otherwise (never coerced);
a physically unusual row is **accepted and flagged** with the engine's own code, so the controls are baked and shown.

| Column | Unit | Bounds | Notes |
|---|---|---|---|
| `case_id` | n/a | `^[A-Z][A-Z0-9-]{1,15}$` | unique in the table |
| `machine` | n/a | `cone-sec`, `cone-tert`, `cone-short-head`, `gyratory`, `jaw` | selects the engine's per-machine constants |
| `css_mm` | mm | (0, 600] | closed-side setting |
| `throw_mm` | mm | [1, 100] | eccentric throw |
| `speed_rpm` | rev/min | [50, 1000] | eccentric or gyration speed |
| `feed_x63_mm` | mm | (0, 2000] | Rosin-Rammler characteristic size of the feed |
| `feed_m` | dimensionless | [0.3, 4] | Rosin-Rammler uniformity exponent |
| `ore_axb` | dimensionless | [10, 1000] | JKMRC drop-weight A times b; lower is harder |
| `ore_wi` | kWh/t | [2, 40] | Bond work index |

Flags (accepted rows): `pass_through` when `css_mm` is at or above the feed's 80 percent passing size; `css_ge_feed_top`
when it is at or above the 256 mm feed top size. The cases CP1 (160 mm) and CI1 (280 mm) are the controls that carry them.

The survey table has its own contract (`hp500-survey`, `data-pipeline/pipeline/hp500/surveys.py`): five numeric columns
(`survey`, `f80_mm`, `css_mm`, `feed_tph`, `power_kw`) with bounds, whole numbers 1 to n without a gap.

Missing data: no params table, the registry's 17 cases are baked and readiness says `missing`; a rejected row drops its
case and readiness is `partial` with the case id; no survey table, the ten real cases and the two HP500 documents are not
baked and readiness says `missing` for those three rows. The states are the table in `docs/contracts/catalog.md`.

## CONTRACT 2, artifact (pipeline to web)

Each bake writes a trace (`derived/<case>/trace.json`, `chancadem.trace/v1`) and a manifest
(`derived/manifests/<case>.json`, `chancadem.manifest/v1`) with the operating point, seed, engine and version, the trace
bytes and sha256, the measured lane and gate verdict, the flags as stable codes, the metrics, which model answered per slot,
the expected ranges and the case context; and `derived/manifests/index.json` (`chancadem.index/v1`) listing the cases and
the further files. `frontend/src/lib/contract.gen.ts` is generated from the schemas, so a drift fails the web build.

## CONTRACT 3, the units gate

Run inside the bake and again over the shipped artifacts by `scripts/check_artifacts.py` (`pipeline/core/unit_gate.py`): a
prediction must be finite and lie inside its observable's range widened by a full range on each side, where the range is
the measured values across the ten surveys for a real case's measured observables and the engine's declared physical
domain otherwise. It judges units, not accuracy. `scripts/check_unit_constants.py` is the author-time half: every float
literal of the engine declares the quantity it is measured in.

## Provenance and license

The 17 circuit cases are synthetic outputs of the canonical engine. The ten surveys are measured data from Rocha, Campos,
Silva and Tavares, "Fit-for-Purpose Model of HP500 Cone Crusher in Size Reduction of Itabirite Iron Ore", Minerals 2024,
14(9), 919, https://doi.org/10.3390/min14090919, licensed CC BY 4.0 (`ATTRIBUTION.md`). The derived artifacts are public.
