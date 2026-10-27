# The live lane

The live lane re-runs a case in the reader's browser with the reader's values: the six knobs of the rail (closed-side
setting, throw, speed, feed $x_{63}$, feed $m$, ore $A \times b$) and the chosen variant (the canonical setting, a tight
setting 15 percent lower, an open setting 15 percent higher). It is a TypeScript port of the pipeline's engine,
`frontend/src/engine/`, written module for module: `engine.ts`, `feed.ts`, `sieve.ts`, `breakage.ts`,
`classification.ts`, `whiten.ts`, `linalg.ts`, `capacity.ts`, `envelope.ts`, `machines.ts`, `types.ts`.

## One engine, two languages

The Python package `data-pipeline/pipeline/model/crusher/` is canonical: the bake, the sweep that trains the models and
the HP500 validation call it. The TypeScript engine is the one the product shipped since its first releases and is its
live port. They are held equal in three places:

| Gate | What it compares | Where |
|---|---|---|
| The shared reference | 121 operating points (each machine's reference point and its setting, throw, speed and ore variations, the 17 circuit cases, the ten surveys, and calibrated-lane edge and implausible points): every result field and every feature vector, within $10^{-9}$ relative | `tests/fixtures/engine-reference.json`; `tests/test_crusher_engine.py::test_python_engine_reproduces_the_reference` and `frontend/src/engine/reference.test.ts` |
| Parity with the traces | the TypeScript engine at each manifest's point against the committed trace and manifest metrics, to the six digits the trace is written with | `frontend/src/engine/crusher.parity.test.ts`, over `data/derived` and the provider tree |
| The comparison is itself tested | a one percent change of one passing value fails the parity test; a perturbation of the reference fails the Python comparison | `crusher.parity.test.ts`; `tests/test_crusher_engine.py::test_adversarial_reference_comparison_detects_a_perturbation` |

Measured on 2026-10-27 the largest relative difference between the Python engine and the fixture, over its 121 points, is
$2.3 \times 10^{-12}$. The fixture is written by the TypeScript side
(`CHANCADEM_WRITE_REFERENCE=1 npx vitest run src/engine/reference.test.ts` in `frontend/`), so it is the TypeScript
engine's output that the Python port reproduces; a deliberate change of the engine regenerates the fixture on that side
and the Python test then fails until its port is updated, which is the point.

The port's one delicate rule is arithmetic semantics: `model/crusher/jsmath.py` gives Python the JavaScript results where
they differ (NaN for a negative base to a fractional power, infinity on overflow, signed infinity on division by zero), and
the LU solve is ported as written rather than replaced by a library call, so the order of floating-point operations is
the same. An out-of-domain operating point returns a flagged result in both languages and never raises
(`tests/test_crusher_engine.py::test_out_of_domain_points_return_a_result_and_never_raise`).

## What runs where

- The live engine computes only what the reader changes: a case's result with other knob values, a variant, and the sweeps
  of the views. Everything baked stays baked; the replay curves are drawn dashed beside the live ones.
- The two ONNX models run in the browser through onnxruntime-web 1.27.0 (single-threaded WASM served by the site). They
  load only when the Learned group opens, and each answer is labelled with the model that gave it
  ([framework card](../frameworks/03_onnx-onnxruntime/onnx.md)). The inverse "target $P_{80}$ to a setting" is a bisection on
  the engine, not on a model (`recommendCss` in `frontend/src/engine/surrogate.ts`).
- Every view shows its lane, live (computed in the browser) or replay (read from an artifact), and its provenance,
  synthetic or real. A view still showing an earlier selection is overlaid as recomputing, through the selection key.
- The flags of a live point are mapped from the engine's sentences and envelope codes to the manifest's stable codes and
  to bilingual text (`frontend/src/engine/flags.ts`); a sentence the map does not know is an error, never a flag that
  quietly disappears.

The legacy module `frontend/src/engine/surrogate.ts` still carries the 0.09.003 learned-tier code (it reads the earlier
scaler files); the current model path is `frontend/src/lib/ort.ts` with the contracts. Which of the two the Learned views
use for each function is not restated here (UNVERIFIED beyond `recommendCss`).
