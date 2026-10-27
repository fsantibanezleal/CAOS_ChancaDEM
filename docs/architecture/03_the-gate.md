# The lane gate

`data-pipeline/pipeline/core/gate.py` (`classify_lane`) decides, per case and by measurement, whether the case is light
enough to be re-run live in the browser. A case is `live` when all of these hold, and `precompute` otherwise:

- the engine is light: pure Python, with its wheels inside the allowed set (`LIVE_WHEELS`, only numpy), a proxy for an
  engine small enough to port or to run client side; the crusher engine is pure Python with no wheel, and the export stage
  passes `pure_python=True, wheels=set()`;
- one run finishes within `RUN_MS_GATE`, 1500 ms;
- the committed trace is within `TRACE_BYTES_GATE`, 256 KiB (262144 bytes).

Otherwise the case is `precompute`: the pipeline bakes it and the web only replays it. Either way a committed artifact
exists, so the site shows every case on first load.

## What is measured

The run time the gate judges is the engine's, measured in the bake (`_engine_ms` in `pipeline.py`): one warm-up run, then
the median of five runs. Timing the whole case, validation and the cold start included, once made the verdict depend on
the order of the bake (found 2026-10-04: the first case baked was labelled precompute while the engine runs in
microseconds), which is why the engine alone is timed. On the documenting workstation, 2026-10-27, the median engine time of
the 17 circuit cases is 1.5 to 2.9 ms (S01: 2.3 ms) against the 1500 ms budget; the traces are 3904 to 4127 bytes against
262144. All 27 committed manifests carry `lane: live`.

The raw time is used for the decision and deliberately not stored: the manifest must be a pure function of the operating
point and the seed, and a wall-clock value would dirty git on every rebake. The manifest stores the verdict and the
budgets: `gate` holds `lane`, `pure_python`, `wheels`, `trace_bytes`, `run_ms_budget`, `trace_bytes_budget` and the
`reasons` (empty for a live case).

## What enforces it

`scripts/check_artifacts.py` fails when a manifest's `lane` disagrees with its gate, so a heavy case cannot be labelled
live; `tests/test_manifest.py::test_every_case_is_live_whatever_its_place_in_the_bake` and
`test_the_lane_follows_the_gate_budgets` hold the rule. The Benchmark page measures the live engine again in the reader's
browser against the same run budget.

This is the pipeline's gate. The web has its own, measured on the built site: `npm run gate` (`caos-shell-gate`, see
[07, deploy](07_deploy.md)).
