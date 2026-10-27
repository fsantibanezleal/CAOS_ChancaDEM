# Method, CrusherCal: leave-one-survey-out validation with controls and a predictive band (M10)

## What it is

The protocol behind the claim that the calibrated engine is held out of sample. The [HP500 fit](../16_hp500-calibration/hp500-calibration.md)
is evaluated on ten surveys by leave-one-survey-out (LOO) with identical folds for several models, negative controls and
an 80 percent predictive band. Every number is computed offline by `data-pipeline/pipeline/hp500/loo.py` (numpy,
seeded) from the committed backbone and written to `data/derived/hp500/loo.json` (`chancadem.hp500.loo/v1`); none is
asserted.

## The models, on the two measured targets (t/h and kW)

For survey $i$ the models are fitted on the other nine:

- **M0, calibrated backbone.** The engine with its global scalar refit on the nine: for throughput
  $Q = Q_T \cdot s_i$, with $s_i$ the engine's capacity factor and $Q_T$ the least-squares scalar
  $Q_T = \sum s m / \sum s^2$; for power the paper's form $P_c = \zeta P_d + P_n$ with $(\zeta, P_n)$ refit by ordinary
  least squares.
- **M1, backbone plus a bounded residual.** A ridge regression ($\lambda = 1$) of the residual on the standardised
  setting and $f_{80}$, clipped to $\pm 20$ percent of the backbone value, added to M0.
- **M2, free-form.** Ordinary least squares on setting and $f_{80}$ predicting the raw target, with no physics.

The controls: a **constant-mean** baseline (the mean of the nine); a **label-shuffle** (M1 trained on permuted residual
targets, seeded) that must not beat the backbone; and a **leaky** variant (fit on all ten) beside the strict one, to show
the optimism gap. P80 is reported as a self-consistency target only. The 80 percent band is
$M_0 \pm 1.2816\,\sigma$, with $\sigma$ the sample standard deviation of the strict held-out residual of M0; with ten
surveys its empirical coverage is a coarse estimate. Constants: `RESID_CLIP_FRAC` 0.20, `RIDGE_LAMBDA` 1.0, seed 42.

## The results

From `data/derived/hp500/loo.json` (MAPE in percent), strict folds:

| Target | M0 backbone | M1 residual | M2 free-form | constant mean | M1 label-shuffle |
|---|---|---|---|---|---|
| t/h | 12.09 | 13.45 | 12.18 | 18.29 | 25.04 |
| kW | 25.94 | 25.37 | 14.03 | 24.48 | 40.19 |

Leaky folds (fit on all ten): t/h 10.95, 8.51 and 8.24 for M0, M1 and M2; kW 19.28, 12.00 and 9.46.

The band: t/h half-width 238.5 t/h (20.8 percent of the mean); kW half-width 105.1 kW (36.5 percent). Coverage against the
0.80 nominal is measured two ways: in sample (sigma from the same ten residuals it is checked against) 0.90 on t/h and kW;
nested out of sample (each survey's sigma from the other nine folds' residuals) 0.80 on t/h and 0.90 on kW.

What this says, as the data stand:

- **t/h, a genuine win over the baseline.** The strict LOO MAPE of the backbone, 12.09 percent, beats the
  constant mean (18.29) and the label-shuffle control (25.04); no comparison with an error band of the paper is claimed,
  because the repository holds no source for one. The in-sample figure is 11.55 percent, so the held-out
  number is not an in-sample artifact. The free-form model M2 is equally good on throughput (12.18); the backbone matches
  a two-parameter regression with one fitted scalar and a physical shape.
- **kW, an honest negative for the backbone.** The strict MAPE of M0, 25.94 percent, is no better than the constant mean
  (24.48). The free-form model M2, at 14.03 percent, does better on power, against the expectation written in the
  protocol that M2 is the strawman that loses; it is reported as it came out. The reason the engine's power does not carry
  the signal is in the [power card](../09_power_model/power-model.md).
- **M1, a null.** The bounded residual does not beat the backbone out of sample (13.45 against 12.09 on t/h, 25.37 against
  25.94 on kW, marginal), and its large leaky-versus-strict gap (t/h 8.51 against 13.45) is the overfitting that ten
  surveys invite. The product ships the backbone with its empirical band, not the residual, and says so.
- The in-sample coverage of 0.90 flatters the band; the nested coverage, 0.80 on t/h, is the honest figure, and with ten
  points either one moves by ten points per survey. Both are reported, not tuned.

## Where it runs

Offline (`run.py hp500` or the bake); the browser draws the documents in the Validation group and the Benchmark page and
shows the measured value beside the model on the real-survey gauges, with the band when the document is present.

On the synthetic secondary-cone (`cone-sec`) cases the same document gives a band of a different kind, drawn the same way
and labelled in both languages as a lower bound: at least `band_rel_pct` of the engine's value for the target shown
(`uq.band_rel_pct` of the strict folds, read at run time from `loo.json`, never copied into code), the held-out error of
the same model family once calibrated on the ten surveys; an uncalibrated case cannot be more accurate. The other
machines (`cone-tert`, `cone-short-head`, `jaw`, `gyratory`) have no measured data, so they show no band and say why;
when the document is missing the case shows no band and the readiness message.

## Tests

`tests/test_hp500_loo.py`: `test_label_shuffle_control_does_not_beat_backbone`, `test_tph_backbone_has_real_skill`,
`test_overfit_optimism_gap_is_exposed` (the gates of M10); `tests/contracts/test_hp500_validation.py::test_loo_validates`.

## What it is not

- Not a claim of lower error than the paper's in-sample fit or than DEM. The contribution is the out-of-sample
  validation, the controls and the predictive band, delivered in the browser.
- Not a significance test: ten surveys of one machine and one ore.

## Reproduce

```
python data-pipeline/run.py hp500                       # backbone.json and loo.json from the survey table
python data-pipeline/pipeline/hp500/loo.py --out <dir>  # the same two documents into a sandbox, with a printed summary
python -m pytest tests/test_hp500_loo.py tests/contracts/test_hp500_validation.py
```

## References

- Rocha et al. 2024, [doi:10.3390/min14090919](https://doi.org/10.3390/min14090919) (the data and the fit)
- Johansson et al. 2017, [doi:10.1016/j.mineng.2016.09.015](https://doi.org/10.1016/j.mineng.2016.09.015) (the DEM versus
  experiment validation the design mirrors)
