# Requirements: The bake of the 27 cases, contract 1 and contract 2

EARS (Mavin et al., RE'09, https://doi.org/10.1109/RE.2009.9). Every requirement names the gate that fails when it is violated.

| ID | Requirement | Gate |
|---|---|---|
| BK-001 | WHEN an operating-point row is missing a cell, non-numeric or outside the schema's bounds, THE pipeline SHALL reject it with its reason, never coerce it, and bake the other rows. | `tests/test_contract.py::test_adversarial_bad_rows_rejected_not_coerced` |
| BK-002 | THE pipeline SHALL accept and flag, never reject, the negative and invalid control points, so they are baked and shown flagged. | `tests/test_contract.py::test_controls_are_accepted_and_flagged_with_the_engine_codes` |
| BK-003 | WHEN the bake runs a case, THE pipeline SHALL fail if a result metric lies outside the range the case declares, naming the metric. | `tests/test_expect.py::test_a_value_outside_its_range_is_named` |
| BK-004 | THE case matrix SHALL hold the 17 authored cases and the 10 measured HP500 surveys, each with a bilingual title, category, expected band stating its numbers, context and source. | `tests/test_cases.py::test_the_matrix_is_27_cases_17_synthetic_and_10_real_with_unique_ids`, `tests/test_cases.py::test_every_case_is_authored_completely`, `tests/test_cases.py::test_the_band_states_its_numbers` |
| BK-005 | THE pipeline SHALL write identical artifacts for the same cases and seed. | `tests/test_pipeline_smoke.py::test_adversarial_same_seed_bakes_identical_bytes_and_a_changed_byte_of_equal_size_is_seen` |
| BK-006 | THE committed manifests SHALL name artifacts whose bytes and sha256 hash they state, with the lane the gate decides, and the shipped bake SHALL pass the artifact check. | `tests/test_check_artifacts.py::test_the_shipped_bake_passes` |
| BK-007 | THE bake and the artifact check SHALL fail a prediction that is not finite or lies outside its observable's range widened by a full range (the units gate, CONTRACT 3), and THE constants of the engine SHALL each declare their unit (CONTRACT 3b). | `tests/test_unit_gate.py::test_the_bake_runs_the_gate_and_refuses_a_wrong_unit`, `tests/test_unit_gate.py::test_constants_gate_passes_on_the_repository` |
| BK-008 | EVERY committed document SHALL be valid against its schema file, and the web SHALL read exactly the keys the pipeline writes, in the bake and in the provider tree. | `tests/contracts/test_documents.py::test_manifests_validate`, `tests/contracts/test_documents.py::test_traces_validate`, `frontend/src/lib/contract.test.ts` |
