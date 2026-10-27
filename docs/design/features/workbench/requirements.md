# Requirements: The App: one crushing case at a time on the shell's workbench

EARS (Mavin et al., RE'09, https://doi.org/10.1109/RE.2009.9). Every requirement names the gate that fails when it is violated.

| ID | Requirement | Gate |
|---|---|---|
| WK-001 | THE App SHALL be the shell's case workbench at `/app`, the leftmost route, with Focus mode for every case, and THE root SHALL land on the Introduction's executive view. | `frontend/src/App.test.tsx::the App route renders the workbench and not the executive view`, `frontend/scripts/gate.mjs` (G18, Focus required) |
| WK-002 | THE variants SHALL be the canonical setting, a tight one and an open one, applied live on the rail's values, and a real case SHALL say its variants are a calibrated what-if. | `frontend/src/workbench/model.test.ts` |
| WK-003 | THE Validation view SHALL hold the live engine against the committed replay and show the largest difference. | `frontend/src/workbench/model.test.ts` |
| WK-004 | THE App's routes SHALL be measured by the shell's gate at zero failures at every size, both themes, both languages and both font passes (the drawn views at least half the App route, every chart with Tier A). | `frontend/scripts/gate.mjs` |
