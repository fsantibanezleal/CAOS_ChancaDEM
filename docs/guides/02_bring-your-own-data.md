# Guide, bring your own operating point or survey table

The door is contract 1: `data-pipeline/pipeline/io/contract.py` for crusher operating points (catalog row
`params-record`) and `data-pipeline/pipeline/hp500/surveys.py` for HP500 survey tables (row `hp500-survey`). The columns,
units and bounds are in [`data/README.md`](../../data/README.md). Raw or private inputs go under `data/raw/`, which git
ignores.

## 1. Check an operating point table

A table needs the columns `case_id,machine,css_mm,throw_mm,speed_rpm,feed_x63_mm,feed_m,ore_axb,ore_wi`; `machine` is one
of `cone-sec`, `cone-tert`, `cone-short-head`, `gyratory`, `jaw`. From the repository root:

```python
import sys
sys.path.insert(0, "data-pipeline")
from pathlib import Path
from pipeline.io.contract import read_params
from pipeline.core.manifest import flag_codes
from pipeline.model.crusher import evaluate

report = read_params(Path("my-points.csv"))
print(report.summary())            # for instance: 2 accepted, 1 rejected, 1 flagged
print(report.rejected)             # each row with its reason, for instance css_mm -5 is outside (0, 600]
print(report.flagged)              # accepted but unusual rows: pass_through, css_ge_feed_top
for rec in report.accepted:
    r = evaluate(rec.operating())  # the canonical engine
    print(rec.case_id, round(r.p80, 2), round(r.throughput_tph, 1), round(r.power_kw, 1), r.regime, flag_codes(r))
```

A row is rejected with its reason when it breaks the schema or a bound, accepted and flagged when plausible but unusual,
accepted otherwise; nothing is coerced. Run it with `.venv-pipeline/bin/python -I` (`Scripts/python.exe` on Windows) so
the interpreter loads no code from the working folder.

## 2. Bake through the pipeline

`python data-pipeline/run.py all --params my-points.csv --output build/mine` applies the same contract and bakes into a
sandbox. Two rules of the current pipeline, stated because they surprise:

- The table changes the operating point of the cases the registry already has. A row whose `case_id` is one of the 17
  circuit cases (`G01` to `CK1`) replaces that case's point; a registry case with no accepted row in the table is not
  baked (a rejected row also makes readiness `partial`, listing the case id); a row whose id the registry does not know is validated but not baked as a new case.
  Adding a brand new case means adding it to `data-pipeline/pipeline/cases/circuit_cases.py` with its context and its
  numeric expected ranges, and to `data/examples/params.csv`.
- Every case states the ranges a reader should see (`core/expect.py`) and the bake fails when a result leaves them. A
  moved operating point can therefore fail the bake until the ranges are re-authored from engineering relations, never from
  the engine's own value.

Without the table the registry's cases are baked and readiness says `missing` for that row.

## 3. Bring a survey table

`data/examples/hp500-surveys.csv` has the columns `survey,f80_mm,css_mm,feed_tph,power_kw`. The contract keeps whole survey
numbers 1 to n without a gap, values inside the bounds in `data/README.md`, and rejects a duplicate. A rejected row drops its
real case (readiness `partial` lists the survey number); with no accepted survey the ten real cases and the two HP500
documents are not baked (readiness `missing`). The calibrated lane is the fit of one machine and one ore: a table from
another machine bakes, but its calibrated results are outside the support the fit was made for, and the
[envelope gate](../frameworks/15_envelope-gate/envelope.md) says so (`css_outside_calibrated`, `f80_outside_calibrated`). A
CrusherCal run needs more than a handful of surveys to mean anything. Run `python data-pipeline/run.py hp500 --surveys
my-surveys.csv --output build/mine` to rebuild the two documents from your table.

## 4. Without a bake

The web's live engine re-runs any case with the reader's six values, so a reader exploring a parameter set needs no bake at
all. If your data do not fit the contract, extend it deliberately (schema file, code bound, the test that holds them equal,
the catalog History row); never loosen it to let bad data through.
