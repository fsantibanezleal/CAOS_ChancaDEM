# Adversarial validation: The showcase: the six views of the visualization catalog, the story mode and the App's stage

For each requirement of [`requirements.md`](requirements.md), the check that tries to break it: what was planted or refuted, and the adversarial test that plants it. A row is evidence that the requirement can fail, not only that it passes.

| requirement | adversarial check | gate |
|---|---|---|
| SH-001 | a seventh tab, or a catalog view with no App placement, is refused | `frontend/src/App.test.tsx` |
| SH-002 | a stream value that differs from the case manifest is refused; selecting a stage with no case of its machine is refused rather than loading the wrong case | `frontend/src/views/circuit.test.tsx` |
| SH-003 | under a planted reduced-motion preference no animation frame is requested | `frontend/src/views/circuit.test.tsx` |
| SH-004 | a planted change of one entry of B moves p_n away from the replay and fails the closed-form equality | `frontend/src/views/passes.test.tsx` |
| SH-005 | a headline with no number, or of more than 12 words, fails; a step whose artifact is absent shows the missing state | `frontend/src/pages/Story.test.tsx`, `frontend/scripts/check_story_mode.mjs` |
| SH-006 | autoplay that continues after a planted key press fails; an exit that lands on another case fails | `frontend/src/pages/Story.test.tsx` |
| SH-007 | a stage with two callouts, or a callout without a unit, fails | `frontend/src/pages/Story.test.tsx` |
| SH-008 | a selection made in the panel that the scene does not show fails, and the reverse | `frontend/src/views/linked.test.tsx` |
| SH-009 | a planted ordering where the recommended method is not the lowest held-out MAPE fails | `frontend/src/views/compare.test.tsx` |
| SH-010 | a story headline in hours, or a default drift rate presented as measured, fails | `frontend/src/pages/Story.test.tsx` |
