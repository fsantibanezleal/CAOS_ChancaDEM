# 03 — The lane gate

`core/gate.py::classify_lane` is the **measured** decision of whether a case runs live in the browser or is replayed
from a committed artifact (ADR-0054). For ChancaDEM the SIR-template's "Pyodide-safe wheels" become **client-side
runtimes**: the live lane is the TypeScript Whiten/Evertsson/Bond engine (`ts-engine`) + `onnxruntime-web` (the
surrogate + AE).

A case is classified **live** iff:

1. it is **client-side** (no server needed), AND
2. its runtimes ⊆ `{ts-engine, onnxruntime-web}` (the deployed client set), AND
3. a single evaluation fits the interaction budget (`run_ms ≤ 1500`), AND
4. its replay trace is small (`trace_bytes ≤ 256 KB`).

A Whiten dense solve `p = (I−C)(I−B·C)⁻¹·f` over the small geometric sieve grid + an ONNX forward pass is
sub-millisecond, and the traces are small, so **every** ChancaDEM case passes the gate. The verdict + the
deterministic budgets are stamped into each manifest; `scripts/check_artifacts.py` (CI) fails if a manifest's `lane`
disagrees with its `gate.lane`. The gate is a MEASUREMENT of a real property, never a hand-wave.
