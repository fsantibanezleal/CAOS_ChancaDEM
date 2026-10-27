# Adversarial validation: The real lane: the HP500 surveys, the calibrated backbone and CrusherCal

For each requirement of [`requirements.md`](requirements.md), the check that tries to break it: what was planted or refuted, and the adversarial test that plants it. A row is evidence that the requirement can fail, not only that it passes.

| requirement | adversarial check | gate |
|---|---|---|
| CC-001 | rows with a text value, a zero, a missing column, a duplicate survey and an out-of-bounds value are each rejected with their own reason | `tests/contracts/test_hp500.py::test_adversarial_survey_rows_are_rejected_with_reasons` |
| CC-002 | the label-shuffle control of CrusherCal, run on the same backbone, must not beat it: a backbone unrelated to the surveys would not pass | `tests/test_hp500_loo.py::test_adversarial_the_label_shuffle_control_does_not_beat_the_backbone` |
| CC-003 | the leaky folds score better than the strict ones on the overfit models: the gap is exposed, not hidden | `tests/test_hp500_loo.py::test_adversarial_the_leaky_folds_expose_the_optimism_gap` |
| CC-004 | the label-shuffle control does not beat the backbone | `tests/test_hp500_loo.py::test_adversarial_the_label_shuffle_control_does_not_beat_the_backbone` |
