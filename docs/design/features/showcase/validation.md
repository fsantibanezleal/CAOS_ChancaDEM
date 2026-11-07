# Adversarial validation: The showcase: the six views of the visualization catalog, the story mode and the App's stage

For each requirement of [`requirements.md`](requirements.md), the check that tries to break it: what was planted or refuted, and the adversarial test that plants it. A row is evidence that the requirement can fail, not only that it passes.

| requirement | adversarial check | gate |
|---|---|---|
| SH-001 | a seventh tab, or a catalog view with no App placement, is refused | `frontend/src/App.test.tsx::adversarial: a seventh tab, or a catalog view with no App placement, is refused` |
| SH-002 | a stream value that differs from the case manifest is refused; selecting a stage with no case of its machine is refused rather than loading the wrong case | `frontend/src/views/circuit.test.tsx::adversarial: a stream value that differs from the case manifest is caught`, `frontend/src/views/circuit.test.tsx::adversarial: a stage with no case of its machine is refused rather than loading the wrong case` |
| SH-003 | under a planted reduced-motion preference no animation frame is requested | `frontend/src/views/circuit.test.tsx::adversarial: under a planted reduced-motion preference the flow stops and no animation frame is requested` |
| SH-004 | a planted change of one entry of B moves p_n away from the replay and fails the closed-form equality | `frontend/src/views/passes.test.tsx::adversarial: a planted change of one entry of B moves p_n away from the replay and fails the closed-form equality` |
| SH-005 | a headline with no number, or of more than 12 words, fails; a step whose artifact is absent shows the missing state | `frontend/src/pages/Story.test.tsx::adversarial: a headline with no number, or of 13 words, is refused`, `frontend/src/pages/Story.test.tsx::adversarial: a step whose document is absent says so, with the reason, instead of a placeholder` |
| SH-006 | autoplay that continues after a planted key press fails; an exit that lands on another case fails | `frontend/src/pages/Story.test.tsx::adversarial: an exit that lands on another case is caught` |
| SH-007 | a stage with two callouts, or a callout without a unit, fails | `frontend/src/pages/Story.test.tsx::adversarial: a stage with two callouts, or a callout without a unit, is refused` |
| SH-008 | a selection made in the panel that the scene does not show fails, and the reverse | `frontend/src/views/linked.test.tsx::adversarial: a selection made in the panel that the scene does not show is caught, and the reverse` |
| SH-009 | a planted ordering where the recommended method is not the lowest held-out MAPE fails | `frontend/src/views/compare.test.tsx::adversarial: a planted ordering where another method is the lowest moves the recommendation to it` |
| SH-010 | a story headline in hours, or a default drift rate presented as measured, fails | `frontend/src/pages/Story.test.tsx::adversarial: an Operate headline in hours, or without P80 per millimetre, is refused`, `frontend/src/views/campaign.test.tsx::adversarial: no default drift rate exists anywhere the view reads it from` |
