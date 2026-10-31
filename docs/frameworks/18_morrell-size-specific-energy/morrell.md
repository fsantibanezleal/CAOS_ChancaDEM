# Method, Morrell's size-specific crusher energy (M14), and the setting-only line it is held against (B-lin)

## What it is

Morrell's method gives the specific energy of a conventional crusher from the feed and product sizes and one ore
property, the crushing work index $M_{ic}$. It is the documented alternative to Bond's law for coarse crushing duty (card
[power model](../09_power_model/power-model.md)), implemented in `data-pipeline/pipeline/model/crusher/morrell.py` and held out
on the ten HP500 surveys by [CrusherCal](../08_calibration_validation/calibration-validation.md) next to Bond's draw, the
setting-only line B-lin and the free-form fit.

## Theory, the equations as the guideline prints them

Source: the GMSG guideline *Morrell Method for Determining Comminution Circuit Specific Energy and Assessing Energy
Utilization Efficiency of Existing Circuits*, Annex B, section B.2.2 (Conventional Crushers), equations B4 and B5, on printed
pages 6 and 7 (pages 11 and 12 of the PDF), read on 2026-10-30
([smctesting.com](https://www.smctesting.com/documents/Morrell_method_for_determining_comminution_circuit_specific_energy_and_assessing_energy_utilization_efficiency_of_existing_circuits.pdf)).
The primary paper is Morrell 2009, Minerals Engineering 22(6),
[doi:10.1016/j.mineng.2009.01.005](https://doi.org/10.1016/j.mineng.2009.01.005); it was not opened, the guideline is the
source of the equations.

$$W_c = S_c\,K_2\,M_{ic}\,4\left(x_2^{f(x_2)} - x_1^{f(x_1)}\right)\ [\mathrm{kWh/t}], \qquad f(x) = -\left(0.295 + \frac{x}{1\,000\,000}\right)$$

$$S_c = K_s\,(x_1 x_2)^{-0.2},\quad K_s = 55 \quad\text{(applied when } S_c < 1\text{, taken as } 1 \text{ when } S_c > 1\text{)}$$

$x_1$ and $x_2$ are the $P_{80}$ of the feed and of the product in micrometres, $K_2 = 1.0$ for a crusher in closed circuit with a
classifying screen and $1.19$ in open circuit, $M_{ic}$ the work index of the SMC Test in kWh/t. Units: $x^{f(x)}$ is a
size in micrometres raised to a small negative power, a pure number, so $W_c$ carries the unit of $M_{ic}$, kWh/t, and the
power is $W_c\,[\mathrm{kWh/t}] \times Q\,[\mathrm{t/h}]$ in kW. The guideline defines the net power as the motor power less the no-load power.

## The fit on the HP500 surveys, and what is fitted

$M_{ic}$ of the Minas Rio itabirite is not published, so it is a fitted scalar, and so is the no-load power: both are
refit on the nine training surveys of every fold and the held-out survey never enters (`pipeline/hp500/morrell_fit.py`).
The design column of a survey is $W_c(M_{ic}=1) \times Q$ with the measured $f_{80}$ as $x_1$, the backbone's $P_{80}$ as
$x_2$ (a model output used as an input, never as a target) and the measured feed rate as $Q$. Two variants, both closed
circuit:

| Variant | Model | Held-out MAPE (percent) |
|---|---|---|
| Morrell | $\mathrm{kW} = M_{ic}\,g$ | 38.08 |
| Morrell with a no-load term | $\mathrm{kW} = M_{ic}\,g + P_{noload}$ | 15.21 |

For reference the same folds give B-lin 12.78, the free-form M2 14.03, the Bond backbone M0 25.94 and the constant mean
24.48 (`data/derived/hp500/loo.json`, strict, power).

## The negative, as it comes

- Without the no-load term the fit is one positive scalar ($M_{ic}$ between 3.7 and 4.2 kWh/t across the folds) and the
  error is the largest of the size-aware models: the physics alone does not track the measured power of these surveys.
- With the no-load term the error falls to 15.21 percent, but the fit is not Morrell's physics: in every fold the fitted
  $M_{ic}$ is negative (-6.3 to -4.2 kWh/t) with a no-load power of 590 to 730 kW, about twice the largest measured power. The measured
  power falls as the throughput rises (correlation -0.85) and the design column rises with it, so the least-squares line
  has a negative slope. The document says so (`morrell_fit.noload_variant_m_ic_positive` is false in all ten folds) and the
  variant is reported as a descriptive line on that column, never as an estimate of $M_{ic}$.
- Both variants are worse than the setting-only line B-lin, so the size-specific energy adds nothing on these ten surveys.
  With $n = 10$ a difference below about 3 points is noise; 15.21 against 12.78 is within it, 38.08 is not.
- The plant's $M_{ic}$ and its no-load power are not available (an SMC Test of the ore and a no-load reading would settle
  the fit). Until then Morrell is a held-out comparison, not a predictor shipped to the App.

## B-lin, the baseline

$\mathrm{target} = a + b\,\mathrm{CSS}$, ordinary least squares refit on each fold (`pipeline/hp500/blin.py`), for throughput
and power. It reaches 13.67 percent on throughput and 12.78 percent on power held out, the bar every method meets. It has no
physics: its value is that the claim of any other method is the margin over it.

## Where it runs

Offline only: the module is a pure function library, `pipeline/hp500/loo.py` calls the fits in the bake and writes the
numbers into `data/derived/hp500/loo.json` (contract hp500-loo 1.2.0). The TypeScript engine does not carry it.

## Tests

- `tests/test_morrell.py`: equation B4 against a hand computation, the unit of the result (linear in $M_{ic}$, kWh/t, times
  t/h gives kW), the rule on $S_c$ (applied below 1, dropped above), non-positive sizes refused, the fits recover a planted
  $M_{ic}$ and no-load.
- `tests/test_hp500_loo.py::test_b_lin_reproduces_the_dossier_numbers`,
  `tests/test_hp500_loo.py::test_morrell_variants_report_the_numbers_as_they_come`,
  `tests/test_hp500_loo.py::test_adversarial_a_fold_never_sees_its_held_out_survey` (an absurd power planted in one survey
  moves every other fold and not its own).

## What it is not

- Not a validated crusher power model for this ore, and not a replacement of the Bond draw in the engine.
- Not Morrell's full method: no tumbling-mill terms, no open-circuit $K_2$ in the fit (it is absorbed by the fitted $M_{ic}$),
  no size-distribution correction $W_s$ (B.2.4).

## References

- GMSG, Morrell method guideline, Annex B, equations B4 and B5 (link above).
- Morrell 2009, [doi:10.1016/j.mineng.2009.01.005](https://doi.org/10.1016/j.mineng.2009.01.005).
- Rocha et al. 2024, [doi:10.3390/min14090919](https://doi.org/10.3390/min14090919), the ten surveys.
