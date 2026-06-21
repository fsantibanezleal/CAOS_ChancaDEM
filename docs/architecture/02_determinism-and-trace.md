# 02 — Determinism & the replay trace

## Determinism

Every run is a pure function of `(case, seed)`. The TS engine is analytic (no RNG), so `case-results.json` is fully
deterministic; the LHS sweep uses a seeded mulberry32 (seed 12345 train / 67890 held-out); torch training seeds
`torch.manual_seed(0); np.random.seed(0)`. Consequence: re-running the default pipeline produces **byte-identical**
traces + manifests (the CI determinism guard) — no wall-clock in any committed artifact.

## The compact trace (`chancadem.trace/v1`)

`core/trace.py` builds one small JSON per case from the committed engine outputs (`case-results.json`) + the
surrogate's held-out metrics. The payload carries the case's operating point + the engine result (P80/P50/P20, the
%-passing grid at {1,4,8,16,32} mm, throughput, power, reduction ratio, specific energy, regime, validity) + the
surrogate's accuracy on the key outputs (referenced from `surrogate_metrics.json`, not recomputed).

The frontend mirrors this shape in `frontend/src/lib/contract.types.ts` (`CaseTrace` / `CaseResult` /
`OperatingPoint`), so a drift between the Python trace and the TS reader **fails `tsc`**.
