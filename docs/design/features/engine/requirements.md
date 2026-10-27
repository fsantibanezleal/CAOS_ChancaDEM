# Requirements: The crusher engine, canonical in Python and live in TypeScript

EARS (Mavin et al., RE'09, https://doi.org/10.1109/RE.2009.9). Every requirement names the gate that fails when it is violated.

| ID | Requirement | Gate |
|---|---|---|
| EN-001 | THE canonical Python engine SHALL reproduce, for every point of the shared engine reference, every result field of the TypeScript engine within 1e-9 relative, and every flag, regime and envelope code exactly. | `tests/test_crusher_engine.py::test_python_engine_reproduces_the_reference` |
| EN-002 | THE TypeScript engine SHALL reproduce the committed engine reference, so a change to it without a regenerated reference fails the web tests. | `frontend/src/engine/reference.test.ts::adversarial: the TypeScript engine reproduces the committed engine reference` |
| EN-003 | THE live engine SHALL reproduce every baked trace (the summary, both gradations and both sweeps) at the manifest's parameters within the trace's six significant digits. | `frontend/src/engine/crusher.parity.test.ts::adversarial: a one percent change of one product passing value fails the comparison, naming the value` |
| EN-004 | THE Whiten solve SHALL conserve mass and give a product finer than its feed at every valid point. | `tests/test_crusher_engine.py::test_whiten_solve_conserves_mass_and_product_normalizes` |
| EN-005 | WHEN the closed-side setting tightens on one machine, THE engine SHALL give a finer product; WHEN the throw widens at a fixed setting, a coarser product with a higher capacity. | `tests/test_crusher_engine.py::test_tighter_css_gives_a_finer_product`, `tests/test_crusher_engine.py::test_more_throw_widens_oss_and_gives_a_coarser_product_with_higher_capacity` |
| EN-006 | IF the closed-side setting reaches the feed's F80 or its top size, or an input is physically impossible, THEN THE engine SHALL flag the point and never return an unflagged confident result. | `tests/test_crusher_engine.py::test_pass_through_and_invalid_guard_fires_when_css_ge_feed_top_size`, `tests/test_crusher_engine.py::test_envelope_gate_an_implausible_point_is_flagged_and_marked_invalid` |
