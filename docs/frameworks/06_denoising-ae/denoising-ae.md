# Method — denoising autoencoder (operating-anomaly / OOD score)

**What:** an autoencoder over the 14-D product-gradation signature; its reconstruction error is an operating-anomaly
score that **doubles as the surrogate's out-of-distribution guard** — a query far from the training manifold (e.g. a
gyratory at a 32 mm CSS) reconstructs poorly → "the surrogate is extrapolating, distrust it".

## Architecture (`model/psd_ae.py`)

```
encoder: Linear(14→16) → GELU → Linear(16→6) → GELU
decoder: Linear(6→16)  → GELU → Linear(16→14)
```
Input: the product-gradation signature (P80/P50/P20 in log-space, %-passing×5, throughput, power, reduction, F80
log, specific energy, feed modulus), standardized by the committed `ae_scaler.json`.

## Training & threshold

Adam (lr 2e-3, weight-decay 1e-5), **denoising** (Gaussian noise added to the input each step), 400 epochs, seeded,
on the VALID sweep points only. The decision threshold is the **p99** of the reconstruction error over the training
signature (`ae_threshold.json`); the physically-invalid sweep draws (CSS ≥ feed top, ill-conditioned) form the
implicit negative set.

## Why it fits

The surrogate is only trustworthy on the manifold it was trained on; the AE gives a continuous, label-free signal for
when a live what-if has steered off that manifold — the honest companion to an instant emulator.
