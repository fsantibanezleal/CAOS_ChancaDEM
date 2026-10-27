# Method, the validated-envelope gate (M9)

## What it is

A rule check that flags inputs a model should not answer confidently: physically implausible points on any lane, and
points outside the calibrated support on the HP500 lane. The principle is that an empirical model must flag
implausible or out-of-calibration inputs and never emit a confident number for them. It is also the baseline of the
anomaly model slot (the catalog row `anomaly-model`).

## Rules, as `envelope.py` applies them

| Code | Fires when | Effect |
|---|---|---|
| `css_nonpositive` | CSS is not above 0 | implausible, invalid |
| `feed_nonpositive` | $x_{63}$ is not above 0 | implausible, invalid |
| `f80_lt_css` | $F_{80} > 0$ and CSS is at or above $F_{80}$ | implausible, invalid |
| `css_outside_calibrated` | calibrated cone-sec lane and CSS outside 38 to 55 mm | extrapolating |
| `f80_outside_calibrated` | calibrated cone-sec lane and $F_{80}$ outside 47 to 140 mm | extrapolating |

The calibrated support is the range of the ten surveys of Rocha et al. 2024 on itabirite iron ore
(`HP500_ENVELOPE_CSS_MM`, `HP500_ENVELOPE_F80_MM`). An implausible code makes the result invalid; an extrapolation code
sets `out_of_envelope` and nothing else. The bilingual text of the codes is presentation and stays in
`frontend/src/engine/envelope.ts`.

## Committed behaviour

- The controls CI1 and CP1 and the cases G02 and HP500-03 carry `f80_lt_css` in their manifests. HP500-03 is a survey
  whose measured $f_{80}$ is 47 mm against a setting of 48 mm; the engine's feed on the grid gives $F_{80} = 47.1$ mm, so
  the point is flagged and invalid (`data/derived/manifests/HP500-03.json`). It is read as a limit of the calibrated
  lane; see [cases](../../cases/README.md).
- Against the autoencoder on planted off-manifold points, the gate detects 13.9 percent and the autoencoder 28.0
  percent, with false-alarm rates of 0.0 and 1.0 percent (`data/derived/model-metrics.json`, `anomaly`). The gate flags
  only implausible inputs on the synthetic lane, so a plausible point outside the training range passes it; the
  autoencoder scores distance from the training manifold, the complementary check.

## Where it runs

Both lanes: `envelope.py` offline, `frontend/src/engine/envelope.ts` live.

## Tests

- `tests/test_crusher_engine.py::test_envelope_gate_an_implausible_point_is_flagged_and_marked_invalid`
- `tests/test_crusher_engine.py::test_envelope_gate_calibrated_lane_flags_out_of_support_as_extrapolating`
- `tests/test_crusher_engine.py::test_envelope_gate_a_valid_in_support_point_is_inside_the_envelope`
- `tests/test_crusher_engine.py::test_envelope_gate_the_ten_real_hp500_surveys_are_physically_plausible` (it runs the
  surveys with $x_{63} = 1.4 f_{80}$ as a proxy; the baked HP500-03 shows the engine's own $F_{80}$ can differ)

## What it is not

- Not a data-quality model: it knows five rules, not the distribution of the data.
- Not a guarantee inside the support: a point passing the gate is not thereby accurate.

## References

- Rocha et al. 2024, [doi:10.3390/min14090919](https://doi.org/10.3390/min14090919), for the support.
