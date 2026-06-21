# 06 — Model evaluation

## The held-out protocol

The surrogate is measured against an **independent second Latin-hypercube draw** of the engine (seed 67890), NOT a
row-split of the training sweep — a row-split would leak the stratified LHS design. `evaluate.py` reports per-output
**R²** and **MAPE** in original units (sizes inverse-transformed from log-space), across all 10 outputs
(P80/P50/P20, %-passing at {1,4,8,16,32} mm, throughput, power). The committed `surrogate_metrics.json` carries the
real numbers (e.g. P80 R² 0.9935 / MAPE 4.74%).

## The monotonicity gate

A physics surrogate must respect physics: **P80 must rise with CSS** (a wider closed-side-setting → coarser
product). `evaluate.py` probes the surrogate over a CSS grid {12,20,32,50,80} mm at a fixed operating point and
asserts the predicted P80 is non-decreasing (`p80MonotoneVsCss`). This is a manifest CI gate — a surrogate that
learned a non-monotone artifact is rejected, not shipped.

## The denoising AE = the OOD guard

The AE trains on the product-gradation signature of the VALID sweep points; its reconstruction error is an
operating-anomaly score that doubles as the surrogate's **out-of-distribution guard**: a query far from the trained
manifold (e.g. a gyratory at a 32 mm CSS) reconstructs poorly → "the surrogate is extrapolating, distrust it". The
threshold is the **p99** of the reconstruction error over the training signature (`ae_threshold.json`).

## Honest controls

CP1 (pass-through: CSS wider than F80) must show ~zero reduction; CI1 (CSS > feed top) must FLAG invalidity
(conditioning / mass-closure), not render silent garbage; CK1 anchors absolute numbers to published cone data
(Duarte et al. 2021). These are in the case matrix as deliberate negative/invalid/calibration controls.
