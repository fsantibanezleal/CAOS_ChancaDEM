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
| `f80_outside_calibrated` | calibrated cone-sec lane and the declared feed $F_{80}$ (the untruncated Rosin-Rammler value, not the grid-truncated one) outside 47 to 140 mm | extrapolating |

The calibrated support is the range of the ten surveys of Rocha et al. 2024 on itabirite iron ore
(`HP500_ENVELOPE_CSS_MM`, `HP500_ENVELOPE_F80_MM`). An implausible code makes the result invalid; an extrapolation code
sets `out_of_envelope` and nothing else. The bilingual text of the codes is presentation and stays in
`frontend/src/engine/envelope.ts`.

## Sourced warnings, as `bounds.py` applies them

Two further stable codes sit beside the gate. They run after it, in both engines, on the operating point and the computed
reduction ratio $F_{80}/P_{80}$. A breach is a warning: it is written into the result flags and the manifest flag codes,
it does not set `out_of_envelope`, and it never changes `valid`, because the vendors call the minimum setting soft and the
ratios are typical ranges, not hard maxima. Both bounds are strict: a setting exactly at the minimum, or a ratio exactly at
the ceiling, does not warn.

| Machine | Minimum CSS (`css_below_vendor_minimum` fires below it) | Typical reduction-ratio ceiling (`reduction_ratio_above_typical` fires above it) |
|---|---|---|
| `cone-sec` | 16 mm (Metso HP500 standard liners) | 5 (HP standard chamber, 3 to 5) |
| `cone-tert`, `cone-short-head` | 6 mm (Metso HP500 short head) | 4 (HP short head chamber, 2 to 4) |
| `jaw` | 40 mm (the smallest minimum of the Metso Nordberg C Series, the C80) | 4 (3 to 4) |
| `gyratory` | none: no source found, so the check is skipped, never guessed | 4 (3 to 4) |

Sources: Metso, *Nordberg HP Series cone crushers, Wear parts application guide* (code 2602), chamber selection table p. 6
(minimum setting) and reduction ratios p. 2; Metso, *Nordberg C Series jaw crushers* brochure 4226-04-24 (2024), technical
specifications p. 11; Metso, *Basics in Minerals Processing* (8th ed., 2011), reduction ratios p. 3:2. The HP guide states
that the minimum setting is the one at which the crusher operates without ring bounce and that it can change with the rock.
The constants live in `data-pipeline/pipeline/model/crusher/bounds.py` and `frontend/src/engine/bounds.ts`, each with its
source in a comment. The 1 mm secondary cone with an $F_{80}$ of 126 mm, reported valid and unflagged before this card, now
carries both codes and stays valid. Of the 17 synthetic cases, CK1, S05, S06, T01, T02, H01 and H02 carry
`reduction_ratio_above_typical` (S06, at a setting of 12 mm, also `css_below_vendor_minimum`); the ten HP500 surveys carry
neither. The bilingual text is in `frontend/src/engine/flags.ts`.

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
- `tests/test_crusher_engine.py::test_i1_*` and `tests/contracts/test_flag_codes.py` (the sourced warnings, strict bounds,
  the gyratory skip, `valid` unchanged), and `physics.test.ts` "setting bounds" on the TypeScript side
- `tests/test_crusher_engine.py::test_envelope_gate_the_ten_real_hp500_surveys_are_physically_plausible` (it runs the
  surveys with $x_{63} = 1.4 f_{80}$ as a proxy; the baked HP500-03 shows the engine's own $F_{80}$ can differ)

## What it is not

- Not a data-quality model: it knows five rules (and the two sourced warnings), not the distribution of the data.
- Not a vendor selection tool: the minimum settings are those of one HP500 and the C Series, and a smaller model of the
  same type can sit lower.
- Not a guarantee inside the support: a point passing the gate is not thereby accurate.

## References

- Rocha et al. 2024, [doi:10.3390/min14090919](https://doi.org/10.3390/min14090919), for the support.
- The Metso documents of the sourced warnings, listed above (research report r-min-css-2026-10-27, coordination
  repository).
