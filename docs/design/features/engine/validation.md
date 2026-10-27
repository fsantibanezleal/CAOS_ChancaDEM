# Adversarial validation: The crusher engine, canonical in Python and live in TypeScript

For each requirement of [`requirements.md`](requirements.md), the check that tries to break it: what was planted or refuted, and the adversarial test that plants it. A row is evidence that the requirement can fail, not only that it passes.

| requirement | adversarial check | gate |
|---|---|---|
| EN-001 | one point's P80 changed by 1e-6 relative, and one flag removed, each make the comparison fail and name the point and the field | `tests/test_crusher_engine.py::test_adversarial_reference_comparison_detects_a_perturbation` |
| EN-002 | a 1e-6 relative change of one P80 and a removed flag each fail the comparison function the check uses | `frontend/src/engine/reference.test.ts::adversarial: the comparison is not vacuous (a 1e-6 relative change of one p80 or a removed flag fails it)` |
| EN-003 | a one percent change of one product passing value fails and names it; a change in the fifth significant digit fails while one in the seventh passes; a changed flag, regime or sweep value fails | `frontend/src/engine/crusher.parity.test.ts::adversarial: a change in the seventh significant digit passes, in the fifth fails`, `frontend/src/engine/crusher.parity.test.ts::adversarial: a changed flag, regime or sweep value fails` |
| EN-004 | the reference comparison fails on a perturbed product, so a solve that loses mass cannot match the reference | `tests/test_crusher_engine.py::test_adversarial_reference_comparison_detects_a_perturbation` |
| EN-005 | a planted change of the setting term in the engine makes at least one case of the bake fall outside its expected range | `tests/test_cases.py::test_adversarial_a_planted_change_of_the_css_term_fails_the_bake` |
| EN-006 | every flag code the manifest schema allows has a sentence in both languages, and a flag the web does not know is refused, never shown as nothing | `frontend/src/workbench/flags.test.ts::adversarial: a flag sentence the map does not know is refused, not shown as nothing` |
