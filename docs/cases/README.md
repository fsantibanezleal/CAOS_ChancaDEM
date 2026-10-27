# Cases, taxonomy and coverage matrix

`data-pipeline/pipeline/cases/` defines 27 cases in five categories: 17 authored circuit cases (`circuit_cases.py`, the
same operating points as `data/examples/params.csv`) and the 10 measured surveys of an HP500 secondary cone
(`hp500_cases.py`, from `data/examples/hp500-surveys.csv`). The workbench shows **one selected case**; Experiments and
Benchmark show **cross-case summaries by category**. Every synthetic result is an output of the calibrated physics model
(the canonical engine `pipeline.model.crusher`), not of a real plant; the ten real cases are the same engine run on the
calibrated lane at a measured setting and feed size, beside the measured throughput and power.

| Category | Case ids | What they exercise |
|---|---|---|
| Primary crushing | G01, G02, J01, J02 | coarse run-of-mine feed, wide settings, slow; gyratory and jaw |
| Secondary cone | S01 to S06 | the workhorse; S01 is the reference choke optimum (the default case); soft and hard ore, coarse and fine feed, under and over the capacity hump |
| Tertiary crushing | T01, T02, H01, H02 | fine feed, tight settings, fast; the short-head cone gives the finest product |
| Controls | CP1, CI1, CK1 | CP1 pass-through (negative), CI1 setting above the feed top size (invalid), CK1 absolute-number control (the absolute anchor is the calibrated HP500 lane) |
| Real surveys: Metso HP500 at Minas Rio | HP500-01 to HP500-10 | the ten measured surveys of Table A1 of Rocha et al. 2024 (CC BY 4.0) |

## The 17 circuit cases

Speed regime compares the case's speed with the machine's capacity optimum (`optimal_speed` of the engine): within 5
percent is "at the optimum". The setting column also gives CSS over the feed's F80 as the engine computes it.

| Id | Title | Machine | Stage | CSS mm | Speed rpm | Feed | Ore | Control | Real or synthetic | What it shows |
|---|---|---|---|---|---|---|---|---|---|---|
| G01 | Gyratory primary, hard ore, run-of-mine feed | gyratory | primary | 165 (0.92 of F80) | 150 (at the optimum) | x63 600, m 0.8 | A*b 40, Wi 16 | no | synthetic | Very high tonnage and a modest reduction: P80 between 115 and 182 mm, between 3500 and 5500 t/h and a reduction ratio between 1.05 and 1.5. |
| G02 | Gyratory primary, soft ore, high tonnage | gyratory | primary | 195 (1.05 of F80) | 160 (above the optimum) | x63 700, m 0.85 | A*b 78, Wi 12 | no | synthetic | The widest setting of the primary cases sits at the feed's F80, so the feed is barely touched: P80 between 140 and 200 mm, a reduction ratio between 1 and 1.3 and the highest tonnage of the matrix, between 4500 and 6500 t/h. |
| J01 | Jaw primary, hard ore, run-of-mine feed | jaw | primary | 125 (0.68 of F80) | 300 (at the optimum) | x63 400, m 0.9 | A*b 42, Wi 16 | no | synthetic | A near-setting product at a wide opening: P80 between 90 and 140 mm, between 700 and 1100 t/h and a reduction ratio between 1.2 and 1.8. |
| J02 | Jaw primary, medium ore, trickle feed | jaw | primary | 80 (0.43 of F80) | 280 (below the optimum) | x63 300, m 1 | A*b 55, Wi 14 | no | synthetic | A tighter jaw gives a finer product at lower tonnage: P80 between 56 and 90 mm, between 450 and 800 t/h and a reduction ratio between 1.8 and 2.8. |
| S01 | Cone secondary, medium ore, choke feed | cone-sec | secondary | 32 (0.25 of F80) | 360 (at the optimum) | x63 90, m 1.2 | A*b 55, Wi 14 | no | synthetic | The reference point: a well-graded choke feed at the capacity optimum gives a P80 between 22 and 35 mm, between 520 and 780 t/h and a reduction ratio between 3.5 and 5.5. |
| S02 | Cone secondary, soft ore, coarse feed | cone-sec | secondary | 40 (0.27 of F80) | 300 (below the optimum) | x63 120, m 1 | A*b 80, Wi 11 | no | synthetic | A wider setting and a soft ore lift the capacity above S01 even below the optimum speed: P80 between 28 and 44 mm, between 660 and 900 t/h and a reduction ratio between 3.3 and 5. |
| S03 | Cone secondary, hard ore, over-speed | cone-sec | secondary | 50 (0.33 of F80) | 470 (above the optimum) | x63 130, m 1 | A*b 38, Wi 17 | no | synthetic | Past the capacity hump the tonnage falls as the speed rises: between 650 and 1100 t/h, below what the same machine gives at its optimum speed, with P80 between 35 and 55 mm and a reduction ratio between 3 and 4.5. |
| S04 | Cone secondary, hard ore, run-of-mine feed | cone-sec | secondary | 80 (0.49 of F80) | 360 (at the optimum) | x63 180, m 0.9 | A*b 40, Wi 16 | no | synthetic | A heavy-duty secondary on a coarse feed at the optimum: P80 between 56 and 88 mm, between 1000 and 1700 t/h and a reduction ratio between 1.8 and 3. |
| S05 | Cone secondary, fines-heavy feed | cone-sec | secondary | 16 (0.21 of F80) | 360 (at the optimum) | x63 55, m 1.6 | A*b 55, Wi 14 | no | synthetic | A tight setting on a fine feed gives a high reduction and a fine product, finer than S01: P80 between 11 and 18 mm, between 300 and 500 t/h and a reduction ratio between 4.5 and 7. |
| S06 | Cone secondary, trickle feed | cone-sec | secondary | 12 (0.14 of F80) | 360 (at the optimum) | x63 60, m 1.2 | A*b 55, Wi 14 | no | synthetic | The tightest secondary setting gives a product near the setting and a very high reduction, far finer than the reference case: P80 between 7 and 13 mm, between 230 and 420 t/h and a reduction ratio between 7 and 12. |
| T01 | Cone tertiary, fine feed | cone-tert | tertiary | 8 (0.21 of F80) | 400 (at the optimum) | x63 28, m 1.5 | A*b 55, Wi 14 | no | synthetic | A fine feed and a tight setting at the tertiary optimum speed: P80 between 5.5 and 9 mm, between 180 and 320 t/h and a reduction ratio between 4.2 and 7. |
| T02 | Cone tertiary, hard ore, closed setting | cone-tert | tertiary | 10 (0.22 of F80) | 410 (at the optimum) | x63 32, m 1.4 | A*b 38, Wi 18 | no | synthetic | Hard ore at a closed setting reaches the fine end with a high energy: P80 between 7 and 11 mm, between 220 and 360 t/h and a reduction ratio between 3.8 and 6. |
| H01 | Short-head tertiary, fine product | cone-short-head | tertiary | 6 (0.20 of F80) | 500 (at the optimum) | x63 22, m 1.6 | A*b 55, Wi 14 | no | synthetic | The finest product of the matrix at the fastest speed: P80 between 3.5 and 6.6 mm, between 160 and 280 t/h and a reduction ratio between 5 and 8.5. |
| H02 | Short-head tertiary, hard ore, choke feed | cone-short-head | tertiary | 10 (0.24 of F80) | 470 (at the optimum) | x63 30, m 1.5 | A*b 36, Wi 18 | no | synthetic | Choke feed on hard ore gives the tightest classification and a high specific energy: P80 between 6.5 and 11 mm, between 230 and 370 t/h and a reduction ratio between 4 and 6.2. |
| CP1 | Pass-through, negative control | cone-sec | control | 160 (1.27 of F80) | 360 (at the optimum) | x63 90, m 1.2 | A*b 55, Wi 14 | negative | synthetic | A setting wider than the F80: the material passes mostly ungripped, with P80 between 100 and 126 mm, a reduction ratio between 1 and 1.3 and between 1900 and 2900 t/h. |
| CI1 | Setting above the feed top size, invalid control | cone-sec | control | 280 (2.22 of F80) | 360 (at the optimum) | x63 90, m 1.2 | A*b 55, Wi 14 | invalid | synthetic | A setting wider than the 256 mm top size of the feed is physically meaningless: P80 between 120 and 130 mm and a reduction ratio between 0.95 and 1.05. |
| CK1 | Absolute-number control, HP-class cone | cone-sec | control | 25 (0.22 of F80) | 350 (at the optimum) | x63 80, m 1.15 | A*b 52, Wi 15 | calibration | synthetic | A synthetic control at a typical operating point of an HP-class secondary cone, kept to check absolute numbers: P80 between 17 and 28 mm, between 450 and 650 t/h and a reduction ratio between 4 and 6.5. |

## The 10 real cases

Each real case is a measured survey of a Metso HP500 secondary cone at Minas Rio, run through the calibrated lane at the
measured closed-side setting and feed f80 with the HP500 nominal throw (34 mm) and speed (360 rpm). The expected
throughput is the measured feed rate widened by 29 percent, the strict leave-one-survey-out maximum deviation of CrusherCal
(28.84 percent, `data/derived/hp500/loo.json`) rounded up; the expected P80 is 0.35 to 1.1 times the setting and the
expected reduction ratio 1.8 to 4. The measured power is shown with the case and compared on the Benchmark page.

| Id | Survey | CSS mm | f80 mm | Measured t/h | Measured kW | Expected t/h | Expected P80 mm |
|---|---|---|---|---|---|---|---|
| HP500-01 | 1 | 54 | 88 | 1639 | 209 | 1164 to 2114 | 18.9 to 59.4 |
| HP500-02 | 2 | 54 | 84 | 1267 | 212 | 900 to 1634 | 18.9 to 59.4 |
| HP500-03 | 3 | 48 | 47 | 1240 | 262 | 880 to 1600 | 16.8 to 52.8 |
| HP500-04 | 4 | 48 | 88 | 1034 | 349 | 734 to 1334 | 16.8 to 52.8 |
| HP500-05 | 5 | 48 | 62 | 1124 | 325 | 798 to 1450 | 16.8 to 52.8 |
| HP500-06 | 6 | 40 | 79 | 813 | 355 | 577 to 1049 | 14 to 44 |
| HP500-07 | 7 | 38 | 140 | 1050 | 306 | 746 to 1354 | 13.3 to 41.8 |
| HP500-08 | 8 | 44 | 123 | 1138 | 325 | 808 to 1468 | 15.4 to 48.4 |
| HP500-09 | 9 | 40 | 81 | 820 | 350 | 582 to 1058 | 14 to 44 |
| HP500-10 | 10 | 55 | 81 | 1334 | 187 | 947 to 1721 | 19.25 to 60.5 |

## How the expectations are built

Every case carries `expected_band` (words and numbers, both languages) and `expect` (the same numbers as ranges the bake
checks). A range is never the engine's own value padded by a percentage: it rests on a stated relation, namely that a
choke-fed crusher delivers a P80 of about 0.7 to 1.1 times its closed-side setting (Napier-Munn et al. 1996), that
capacity scales with the discharge opening and peaks at the optimum speed (Evertsson 2000), that a setting at or above the
feed's F80 leaves the feed nearly untouched, and, for the real cases, the measurement with its validated deviation. Tests
that hold the cases to this: `tests/test_cases.py` (every band states its numbers; the cross-case trends such as a tighter
setting giving a finer product, the over-speed case sitting past its capacity optimum, the negative control reducing
nothing and the invalid control being flagged; a planted change of the setting term fails the bake).

## The controls (must not render silent garbage)

* **CP1 (negative, pass-through):** the setting (160 mm) is wider than F80 (126 mm), so the engine must show a reduction
  ratio near one and flag `pass_through`, not a pretty plot.
* **CI1 (invalid):** the setting (280 mm) is wider than the 256 mm feed top size, so the engine must flag the point
  invalid (`css_ge_feed_top`). Contract 1 accepts and flags it so it is baked and shown.
* **CK1 (absolute-number control):** a synthetic operating point of an HP-class secondary cone. The product's absolute
  anchor is the calibrated HP500 lane (Rocha et al. 2024, CrusherCal, the ten measured surveys), not this point, and CK1 is
  not fitted to it; its ranges come from the crushing relation of the setting. Duarte et al. 2021 (DOI
  10.3390/min11111256) cannot serve as the anchor: the paper gives only the setting, throughput and feed F80 of seven
  points of an HP400 and a CH660 (Table 1, p. 9), with no eccentric throw, speed, ore properties or power, and its feed
  and product size distributions are plots only (Figures 4 to 9, pp. 10 to 16). CK1 reduction ratio (5.35) is above the
  typical ceiling of 5 for one secondary-cone stage, so it carries the warning `reduction_ratio_above_typical`.

The sourced setting and reduction-ratio warnings (`css_below_vendor_minimum`, `reduction_ratio_above_typical`; bounds and
sources in the [envelope card](../frameworks/15_envelope-gate/envelope.md)) never make a case invalid. Of the 17 synthetic
cases, CK1 (ratio 5.35), S05 (5.51), S06 (9.80), T01 (5.48), T02 (4.67), H01 (6.55) and H02 (4.86) carry
`reduction_ratio_above_typical`, and S06 (setting 12 mm against a 16 mm minimum) also carries `css_below_vendor_minimum`;
the ten HP500 surveys (ratios 2.2 to 3.2) carry neither.

G02 is not a control but sits at the same edge: its setting (195 mm) is at the feed's F80, so the engine flags it
`pass_through` and its band says so.

## Honesty and limits

* The engine is the source of truth; the surrogate emulates it, not a plant. The held-out model metrics are against an
  independent second draw of the engine.
* No plant data is used beyond the ten published HP500 surveys.
* The per-case numbers are in `data/derived/manifests/<case>.json`; the replay is `data/derived/<case>/trace.json`.
