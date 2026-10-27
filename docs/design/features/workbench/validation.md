# Adversarial validation: The App: one crushing case at a time on the shell's workbench

For each requirement of [`requirements.md`](requirements.md), the check that tries to break it: what was planted or refuted, and the adversarial test that plants it. A row is evidence that the requirement can fail, not only that it passes.

| requirement | adversarial check | gate |
|---|---|---|
| WK-001 | the Introduction-first order of shell 0.13.0 is refused; the root alone never renders the workbench | `frontend/src/App.test.tsx::adversarial: the Introduction-first order of shell 0.13.0 is refused, the landing does not move the tabs`, `frontend/src/App.test.tsx::adversarial: the root alone does not render the workbench` |
| WK-002 | a planted difference above 1e-6 between the live engine and the replay is shown as a defect, never rounded away | `frontend/src/workbench/model.test.ts::adversarial: a planted difference above 1e-6 is a defect, never rounded away; one below it passes` |
| WK-003 | a planted difference above 1e-6 fails, one below passes; the parity test fails on a planted one percent change | `frontend/src/workbench/model.test.ts::adversarial: a planted difference above 1e-6 is a defect, never rounded away; one below it passes`, `frontend/src/engine/crusher.parity.test.ts::adversarial: a one percent change of one product passing value fails the comparison, naming the value` |
| WK-004 | a flag sentence the App does not know is refused rather than shown as nothing (the gate itself carries its own planted-defect suite in the shell) | `frontend/src/workbench/flags.test.ts::adversarial: a flag sentence the map does not know is refused, not shown as nothing` |
