# Method, CrusherBayes: a Bayesian calibration of the engine with a structural discrepancy (BS-2)

## Hypothesis

The calibration of Rocha et al. (2024) is a point fit. A posterior over the engine's fitted scalars, together with an
explicit model-form discrepancy per target, gives a predictive distribution that is better calibrated and sharper than the
residual band of CrusherCal, and shows which scalars the ten surveys identify and which stay at their prior. The criterion
that would drop it was written before the run (SDD, `## Beyond the state of the art`) and is applied by code
(`kill_criterion` in `data-pipeline/pipeline/hp500/crusherbayes.py`).

## Method

The engine is its own simulator (about 1.3 ms to 3 ms per evaluation, so no emulator). For survey $i$ and target $t$
(throughput in t/h, power in kW; $P_{80}$ is not measured and is never a target):

$$y_{t,i} = f_t(\theta;\,\mathrm{CSS}_i, f_{80,i}) + \delta_t(z_i) + \varepsilon_{t,i}, \qquad \delta_t(z) = d_{t0} + d_{t1}\,z_{\mathrm{CSS}} + d_{t2}\,z_{f_{80}}, \qquad \varepsilon \sim N(0, \sigma_t^2)$$

with $z$ the setting and the feed $f_{80}$ standardized on the training surveys, $d_{tj} \sim N(0, \tau_t^2)$ the discrepancy in
the low-order form of Kennedy and O'Hagan (2001,
[doi:10.1111/1467-9868.00294](https://doi.org/10.1111/1467-9868.00294)), $\tau$ = 140 t/h and 36 kW (about 12 percent of the typical
level), and $\theta$ the engine scalars below. The discrepancy and the noise are Gaussian given $\theta$, so the discrepancy is
integrated out exactly, $y_t \sim N\!\left(f_t(\theta),\ \sigma_t^2 I + \tau_t^2 Z Z^\top\right)$, and the sampler explores the eight
engine scalars and the two noise scales (ten dimensions); the coefficients $d$ are drawn afterwards from their exact Gaussian
conditional (`test_the_discrepancy_marginal_is_the_exact_gaussian` checks the marginal against a Monte Carlo of the model).

Sampler: the affine-invariant ensemble sampler of Goodman and Weare
([doi:10.2140/camcos.2010.5.65](https://doi.org/10.2140/camcos.2010.5.65)) as `emcee` 3.1.6 (`StretchMove`, the latest
release on PyPI on 2026-10-30, MIT, pinned in `requirements-precompute.txt`), 20 walkers, 3000 steps, 600 discarded, thinned
by 10, seeded. The engine takes the scalars through one optional keyword (`evaluate(op, Hp500Scalars(...))`), whose defaults are
the shipped values; the TypeScript port and the shared reference are untouched.

## Priors (truncated normal around the engine's own values)

| Scalar | Unit | Nominal | Prior width | Source of the nominal |
|---|---|---|---|---|
| `q_ref_tph` (capacity base QT) | t/h | 647 | log sd 0.25 | Rocha et al. 2024, Table 4 |
| `wi_kwh_t` (Bond work index of the blend) | kWh/t | 9.0 | log sd 0.17 | blend of the compact (7.2) and supercompact (10.6) itabirite bands, Rocha et al. 2024, Table 1 |
| `zeta` (slope of $P_c = \zeta P_d + P_n$) | - | 1.30 | log sd 0.23 | Rocha et al. 2024, Table 5 |
| `pn_kw` (no-load power) | kW | 110 | sd 50 | Rocha et al. 2024, Table 5 |
| `k1_scale` (multiplier of $K_1$) | - | 1.0 | log sd 0.15 | $K_1 = 0.23\,\mathrm{CSS} + 0.30\,f_{80}$, Table 5 |
| `k2_scale` (multiplier of $K_2$) | - | 1.0 | log sd 0.15 | $K_2 = 12.0 + 0.55\,\mathrm{CSS} + 0.40\,f_{80}$, Table 5 |
| `k3` | - | 2.3 | sd 0.5 | Table 5; the cone models of the engine run 2.0 to 2.7 (Napier-Munn et al. 1996) |
| `t10_shift_pct` (shift of the constant 64) | t10 points | 0 | sd 4 | $t_{10} = 64 - 0.12\,\mathrm{CSS} - 0.23\,f_{80}$, Table 5 |

The nominal values are the paper's. The widths are weakly informative choices that bracket the quoted spans; no published
range of these fitted scalars for this ore was found (UNVERIFIED), so the widths are the author's, stated here and in the
document's `priors`. The noise has $\ln\sigma_t \sim N(\ln 60\ \mathrm{t/h},\ 1)$ and $N(\ln 15\ \mathrm{kW},\ 1)$ (5 percent of the
typical level).

## Evaluation

Strict leave-one-survey-out as CrusherCal: one posterior per fold from nine surveys, the held-out survey only in the
prediction (`test_loo_refits_without_the_held_out_survey` plants an absurd survey and shows the other folds move and its own
does not); one more from all ten for the contraction. Held out, per target: MAPE of the posterior predictive mean, RMSE, the
mean log predictive density, the share of surveys inside their 80 percent interval and the mean width, beside B-lin, the Bond
backbone M0 (whose nested band is the CrusherCal band) and the free-form M2.

| Target | CrusherBayes | M0 | B-lin | M2 |
|---|---|---|---|---|
| throughput MAPE (percent) | 11.99 | 12.09 | 13.67 | 12.18 |
| throughput coverage, mean width (t/h) | 0.80, 442.6 | 0.80, 473.8 | 0.80, 478.8 | 0.80, 468.5 |
| power MAPE (percent) | 14.31 | 25.94 | 12.78 | 14.03 |
| power coverage, mean width (kW) | 0.90, 118.2 | 0.90, 209.8 | 0.80, 119.6 | 0.80, 129.8 |

Read with $n = 10$, where a difference below about 3 points is noise: on throughput CrusherBayes ties the backbone; on power it
is far better than the Bond backbone and about 1.5 points worse than the setting-only line, which is within the noise and
not a gain. Its power band is 44 percent narrower than the CrusherCal band at the same coverage and equals B-lin's.

## Kill criterion, as written and as evaluated

Dropped as a predictor if (a) its power MAPE is not below B-lin's by at least 3 points and its throughput MAPE does not beat M0's by
at least 3 points, and (b) on either target its coverage lies outside 0.7 to 0.9 or its mean band is wider than the CrusherCal band. The
document carries every term. Here (a) holds (power -1.53 points against B-lin, throughput +0.10 points against M0) and (b)
does not (coverage 0.80 and 0.90, both inside, and both bands narrower), so the verdict is **kept**. That is a verdict on the rule as
written, not a claim of skill over B-lin: the method calibrates its band and does not beat the line.

## What the ten surveys identify (the contraction table)

Posterior over prior standard deviation on the fit to all ten surveys (`contraction` in the document):

| Parameter | Contraction | Reading |
|---|---|---|
| `q_ref_tph` | 0.45 | identified by the measured throughput |
| noise $\sigma$ (t/h, kW) | 0.30, 0.33 | identified |
| discrepancy slopes on CSS and on $f_{80}$ | 0.35 to 0.38 | identified; the CSS slopes are large (+99 t/h and -57 kW per standardized unit) |
| `zeta`, `wi_kwh_t`, `pn_kw` | 0.70, 0.84, 0.83 | weakly; `zeta` and `wi_kwh_t` enter power only as a product |
| `k1_scale`, `k2_scale`, `k3`, `t10_shift_pct`, discrepancy constants | 0.88 to 1.02 | not identified: they stay at their prior |

The scalars that set the product size (the classification and breakage ones) are not identified because the two measured
targets carry the product size only through the Bond term of power, and power follows the setting, not the product size. That is
the result the method is worth: ten surveys with no measured product size cannot calibrate the population balance.

## Convergence, recorded and not hidden

The diagnostic is the chain length over the integrated autocorrelation time (`emcee`'s `get_autocorr_time`, the largest over
the parameters): a posterior is converged when the post-burn chain is at least 50 autocorrelation times long. In the committed
document every posterior is **not converged**: the autocorrelation time is 97 to 123 steps and the chains are 2400 steps, 20 to 25
times it. The bake's budget (eleven posteriors in about 20 minutes) does not allow 50 times; the document says so
(`convergence.all_converged` is false). Evidence that the numbers are stable nonetheless: a shorter run of 1200 steps with 400
discarded gave a power MAPE of 14.25 against 14.31 and a throughput MAPE of 11.95 against 11.99, and the same coverages, and the
effective sample size is about 20 walkers x 2400 steps / 100 = 480 per posterior. The verdict must be read with that flag.

## Where it runs

Offline only (ADR-0074): `data-pipeline/run.py` (the `hp500` step of the bake) runs the sampler and writes
`data/derived/hp500/crusherbayes.json` (contract hp500-crusherbayes 1.0.0); CI and the test suite validate the committed document and
run the same code with a tiny chain. The bake's sampler spreads the walkers of the eleven posteriors over every core.

## Tests

`tests/test_crusher_bayes.py` (the default scalars are the shipped engine; each prior centred on the engine's value with a source;
the prior bounds; the folds never see their held-out survey; the seed; a document byte-identical and independent of the worker
count; a short chain recorded as not converged; the discrepancy marginal; the kill criterion applied as written in every
combination) and `tests/contracts/test_hp500_crusherbayes.py` (schema, provider tree, cross-field rules, planted bad documents).

## What it is not

- Not shown to predict better than B-lin on power or the Bond backbone on throughput beyond noise.
- Not a converged posterior at the bake's size (see above).
- Not an identification of the population-balance scalars: the table says they are not identified.
- The closest published work is general Bayesian calibration with discrepancy (Kennedy and O'Hagan 2001); the searches of 2026-10-28
  found no Bayesian calibration with discrepancy of a cone-crusher population-balance model evaluated held out (not exhaustive: Scopus
  and Web of Science were not searched).

## References

- Kennedy and O'Hagan 2001, J. R. Statist. Soc. B 63(3), 425-464, [doi:10.1111/1467-9868.00294](https://doi.org/10.1111/1467-9868.00294).
- Goodman and Weare 2010, Commun. Appl. Math. Comput. Sci. 5(1), 65-80, [doi:10.2140/camcos.2010.5.65](https://doi.org/10.2140/camcos.2010.5.65).
- Foreman-Mackey, Hogg, Lang and Goodman 2013, PASP 125, 306, `emcee`, [doi:10.1086/670067](https://doi.org/10.1086/670067).
- Rocha et al. 2024, [doi:10.3390/min14090919](https://doi.org/10.3390/min14090919).
- Napier-Munn et al. 1996, *Mineral Comminution Circuits*, JKMRC, [WorldCat](https://search.worldcat.org/title/37081193).
