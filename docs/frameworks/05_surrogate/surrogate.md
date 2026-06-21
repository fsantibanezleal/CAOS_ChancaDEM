# Method — population-balance surrogate MLP

**What:** a small MLP that emulates the (cheap, analytic) Whiten/Evertsson/Bond engine in a single differentiable
forward pass: operating parameters → product P80/P50/P20, %-passing at {1,4,8,16,32} mm, throughput, power. It gives
an instant, differentiable what-if the closed-form grid cannot give live, and an honest benchmark (it emulates the
physics it is measured against, NOT a real plant).

## Architecture (`model/surrogate.py`)

```
Linear(11→64) → GELU → Linear(64→64) → GELU → Linear(64→32) → GELU → Linear(32→10)
```
Input = 5 machine one-hots (frozen order) + 6 continuous (CSS, throw, speed, feed F63, feed modulus, ore A·b),
z-scored by the committed `scaler.json`. Sizes are predicted in **log10-space** (positivity + lower MAPE over ~a
decade), then z-scored; inverse-transformed at read time.

## Training & honest evaluation

Adam (lr 2e-3, weight-decay 1e-5), MSE in z-space, 500 epochs, seeded. Held-out = an independent 2nd LHS draw (seed
67890). Reported: per-output R²/MAPE in original units + the **P80-monotone-vs-CSS** physics gate (a manifest CI
gate). The surrogate is the source of the live "surrogate-vs-engine" parity scatter.

## Why it fits

The engine is cheap but not differentiable end-to-end; the surrogate gives a differentiable, instant emulator for
the inverse what-if (target-P80 → CSS) and the parity benchmark, with the deep-AE as its OOD guard.
