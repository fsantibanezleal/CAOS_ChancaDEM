# Method, CrusherCal, calibration + held-out (LOO) validation + uncertainty

**What this card is:** the protocol behind the "physics is real" claim. The engine is calibrated to open
industrial data, and that calibration is validated OUT OF SAMPLE (leave-one-survey-out) with negative controls
and a calibrated uncertainty band. Every number is computed offline (`data-pipeline/chancalab/hp500/loo.py`,
numpy-only, seeded) from the committed backbone bridge and surfaced in the Benchmark page. None is asserted.

## The calibration (Rocha et al. 2024, Table 5)

The `cone-sec` machine is calibrated to 10 real surveys of a Metso HP500 secondary cone at Minas Rio (itabirite
iron ore), via the published Andersen-Whiten fit, linear in CSS and the feed f80 (both mm):

```
K1 = 0.23·CSS + 0.30·f80
K2 = 12 + 0.55·CSS + 0.40·f80
K3 = 2.3
t10[%] = 64 - 0.12·CSS - 0.23·f80        (capped at the Austin appearance max, 0.1^γ ≈ 0.447)
QT ≈ 647 t/h                              (capacity base, so the curve overlays the measured 813-1639 t/h band)
Pc = 1.30·Pd + 110 kW                     (the paper's current-based power FORM; see the honest finding below)
```

Provenance: Rocha, Campos, Silva & Tavares (2024), *Fit-for-Purpose Model of HP500 Cone Crusher in Size Reduction
of Itabirite Iron Ore*, Minerals 14(9):919, DOI `10.3390/min14090919` (CC BY 4.0). Table A1 = the 10 measured
surveys; Table 5 = the fit; Table 1 = the ore drop-weight A,b and Bond Wi.

## The held-out validation (leave-one-survey-out)

For the two MEASURED targets t/h and kW (P80 is a model output, reported as self-consistency only), for each
survey i we predict from the other 9, refitting the backbone's global scalars per fold. Three models on identical
folds:

- **M0, calibrated backbone.** The physics with its scalar(s) refit on the 9 (capacity base QT for t/h; the
  paper power form `Pc = ζ·Pd + Pn` refit by OLS for kW).
- **M1, backbone + bounded residual (the CrusherCal proposal).** A ridge residual on standardized `[CSS, f80]`,
  clipped to ±20% of the backbone value (a physical bound, not a free-form fit), added on top of M0.
- **M2, free-form.** An unconstrained OLS on `[CSS, f80]` predicting the raw target, the overfit strawman.

Reported for each: MAPE, RMSE, R², max deviation, in STRICT folds and in a LEAKY variant (fit on all 10) so the
optimism gap is visible.

## Negative controls (all must pass, or the result is void)

1. **Label-shuffle.** Train M1 on permuted residual targets; it must NOT beat M0. If it did, there is leakage.
2. **Constant-mean.** M0 must beat predicting the survey mean to claim any skill.
3. **Leaky vs strict fold.** The free-form models must look better leaky than strict (the overfitting the LOO
   exposes); the calibrated backbone must be stable across both.
4. **Envelope gate.** Implausible inputs (f80 < CSS, CSS ≤ 0, feed ≤ 0) or points outside the calibrated support
   (CSS 38-55 mm, f80 47-140 mm) are FLAGGED, never answered with a confident number (`physics/envelope.ts`).

## Uncertainty (UQ)

An 80% predictive interval is built from the held-out residual spread, `M0 ± 1.2816·σ`, and its empirical
coverage is checked against the 80% nominal. With n=10 the coverage estimate is coarse; that is stated. The band
is shown on the App's real-lane t/h and kW gauges.

## The results (honest, from the 10 surveys)

- **t/h, a genuine at-bar win.** The calibrated capacity backbone reproduces the measured throughput at about 12%
  strict-LOO MAPE, inside the paper's ~15% band, beating the constant-mean baseline (~18%) and passing the
  label-shuffle control. Real calibrated-capacity skill.
- **kW, an honest negative.** The engine's classical Bond draw is nearly flat (about 196 to 237 kW) and carries
  little information about the measured 187 to 355 kW spread, so the backbone (~26% MAPE) is no better than the
  survey mean (~24%). See the power-model card for why.
- **M1 residual, a pre-registered null.** The bounded residual does not beat the backbone out-of-sample (t/h ~13%
  vs ~12%; kW marginal), and its large leaky-vs-strict gap confirms overfitting at n=10. We ship the backbone
  with empirical bands, NOT an overfit residual, and say so in-app.

## What this IS and IS NOT

- **IS:** a held-out (LOO), uncertainty-quantified recalibration of an open industrial cone model, delivered live
  in the browser, a validation + UQ + delivery combination absent from the DEM / phenomenological SOTA.
- **IS NOT:** a claim of lower error than the DEM or the paper's in-sample fit. The novelty is methodological.

## Reproduce

```
node --import tsx data-pipeline/chancalab/sweep/bake_hp500.mjs   # bridge the TS engine -> backbone.json
python -m chancalab.hp500.loo                                    # -> data/derived/hp500/loo.json
python -m chancalab.pipeline all                                 # rebuilds loo.json from the committed backbone
pytest tests/test_hp500_loo.py                                   # invariants + negative-control behaviour
```

## References (DOI-verified)

- Rocha et al. 2024, `10.3390/min14090919` (the real data + fit)
- Duarte et al. 2021, `10.3390/min11111256` (second cone anchor)
- Johansson et al. 2017, `10.1016/j.mineng.2016.09.015` (the DEM-vs-experiment validation template)
