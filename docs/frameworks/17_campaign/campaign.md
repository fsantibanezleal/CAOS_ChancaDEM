# Method, the campaign view: hours until the product leaves its P80 target (M13)

## What it is

The Campaign sub-view of the Performance group answers one question about a drifting setting: as liner wear opens the
closed-side setting, how many operating hours remain before the P80 of the product reaches a target? It plots those hours
against the drift rate of the setting on log axes (0.01 to 1 mm/h), with the target as a control that opens at the case's P80
plus 10 percent (a control value, not a claim) and one reference line, the 45 h re-set interval of one plant.

## The method

The engine gives the P80 of the product as a function of the closed-side setting, rising with it. The opening a target allows is

$$\Delta\mathrm{CSS} = \mathrm{CSS}^{*} - \mathrm{CSS}_0, \qquad P_{80}(\mathrm{CSS}^{*}) = P_{80}^{\mathrm{target}}, \qquad t_{\mathrm{out}} = \frac{\Delta\mathrm{CSS}}{d}$$

with $\mathrm{CSS}_0$ the current setting, $d$ the drift rate of the setting in mm/h and $t_{out}$ the operating hours.
`css_at_p80_target(op, p80_target_mm, css_max_mm)` finds $\mathrm{CSS}^{*}$ and `hours_to_target(delta_css_mm, drift_mm_per_h)` divides.

## The functions, as the code has them

- Python (canonical): `data-pipeline/pipeline/model/crusher/campaign.py`; TypeScript port:
  `frontend/src/engine/campaign.ts`; the view: `frontend/src/views/campaign.tsx`.
- `css_at_p80_target` returns the current setting when its P80 is already at or above the target (zero hours). Otherwise it
  samples the engine on 64 settings from the current one to `css_max_mm`, stops at the first setting the engine marks not
  valid (for example a pass-through feed), requires that P80 never falls over the valid samples, and bisects 60 times
  between the current setting and the last valid sample. It returns `None` (`null`) when the point or an input is invalid,
  when the ceiling is not above the current setting, when P80 is not monotone over the bracket, or when the target is not
  reached at a valid setting: never a guess.
- `css_max_mm` is the upper bound of the machine's training range (`sweep.RANGES`, `css_mm`): 90 mm for the secondary
  cone, 22 tertiary cone, 16 short-head cone, 160 jaw, 240 gyratory. The TypeScript port carries the same numbers
  (`CSS_MAX_MM`), held to `sweep.RANGES` by a test.
- `hours_to_target` returns `None` for a drift that is not positive and 0 when no opening remains. No function and no
  control of the view has a default drift rate.
- The calibrated lane uses the same engine call (the calibrated engine); the view says that the projection is the
  calibrated model's.

## What is sourced and what is not

Research report `r-liner-wear-2026-10-27` (coordination repository):

- Sourced: the form of a cone-liner wear model, the shear-augmented Archard law of Lindqvist and Evertsson as extended with a
  time term by Ma, Fan and He (Applied Sciences 2016, 6(12), 404,
  [doi:10.3390/app6120404](https://doi.org/10.3390/app6120404), eq. 6 and 7, p. 7); and one practice, the manual CSS re-set
  every 45 h at the plant of that paper (p. 3), drawn as the reference line.
- Not found in any reachable source: the parameters of that model, a liner wear rate in g/t, a liner life in hours for a
  cone, or a CSS drift in mm/h. They are not filled from memory. The drift rate is the user's to measure, for example from the
  movement of the adjustment ring between liner changes that the Metso HP guide describes (p. 10).

## Tests

- `tests/test_campaign.py` and `frontend/src/engine/campaign.test.ts`: the shared table
  `tests/fixtures/campaign-reference.json` (45 rows, nine operating points including the calibrated lane) reproduced to
  1e-6 mm on both sides; the P80 of the engine at each returned setting equals the target (does not use the table); the
  target already exceeded, never reached, the ceiling at or below the setting, invalid inputs and a non-monotone P80 (a
  patched engine) all return the stated value; no parameter has a default.
- `frontend/src/views/campaign.test.tsx`: the model of the figure, the 45 h reference line with its label, the log axes, the
  statements in both languages, and a source scan that finds no drift value written as a default.

## What it is not

- Not a wear model: nothing here predicts how fast a setting drifts.
- Not a plant set point: the 10 percent default of the target is a control value.
- Not a guarantee of the P80 beyond the engine: the projection is the engine's (or the calibrated engine's) P80 at the opened
  setting, with the limits of the other views, and it ignores profile distortion of the worn liners and work hardening.

## References

- Ma, Fan and He, Appl. Sci. 2016, 6(12), 404, [doi:10.3390/app6120404](https://doi.org/10.3390/app6120404).
- Lindqvist and Evertsson, Wear 261(3-4), 435-442 (2006), [doi:10.1016/j.wear.2005.12.010](https://doi.org/10.1016/j.wear.2005.12.010), read at abstract level only.
- Metso, Nordberg HP Series wear parts application guide (code 2602), p. 10.
