# Requirements: The real lane: the HP500 surveys, the calibrated backbone and CrusherCal

EARS (Mavin et al., RE'09, https://doi.org/10.1109/RE.2009.9). Every requirement names the gate that fails when it is violated.

| ID | Requirement | Gate |
|---|---|---|
| CC-001 | THE survey table SHALL hold the ten surveys of Table A1 of Rocha et al. 2024 as published, and WHEN a survey row is malformed THE contract SHALL reject it with its reason. | `tests/contracts/test_hp500.py::test_table_equals_the_paper_transcription`, `tests/contracts/test_hp500.py::test_survey_table_validates` |
| CC-002 | THE backbone SHALL be the canonical engine, calibrated, at each survey's measured setting and feed size. | `tests/contracts/test_hp500_validation.py::test_backbone_is_the_engine` |
| CC-003 | CrusherCal SHALL refit every fitted scalar without the held-out survey (strict folds) and report the leaky folds beside them, so the optimism of an in-sample fit is visible. | `tests/test_hp500_loo.py::test_loo_is_deterministic` |
| CC-004 | THE throughput backbone SHALL beat the constant-mean baseline out of sample, and its 80 percent predictive band SHALL report its empirical coverage. | `tests/test_hp500_loo.py::test_tph_backbone_has_real_skill`, `tests/test_hp500_loo.py::test_uq_coverage_present_and_reasonable` |
