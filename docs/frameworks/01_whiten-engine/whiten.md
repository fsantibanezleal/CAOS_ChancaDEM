# Engine — Whiten population balance + Evertsson capacity + Bond power

**Provenance:** Whiten (1972) the crusher population-balance model; the JKMRC drop-weight t10 → Austin appearance
function for progeny distribution; Evertsson (2000) cone-crusher capacity; Bond's comminution law for power.
**Calibration anchor:** Duarte et al. 2021 (Minerals 11(11):1256, DOI 10.3390/min11111256).

**What:** the live, analytic, deterministic physics — the SOURCE OF TRUTH the surrogate emulates. Pure TypeScript
(`frontend/src/physics/`), so the SAME engine runs live in the browser AND generates the offline sweep labels (via
`node --import tsx`), which is why no Python re-port exists (a re-port would diverge).

## The model

The product PSD on a geometric sieve grid is the Whiten solve

```
p = (I − C)·(I − B·C)⁻¹·f
```

* **f** — the feed PSD (Rosin–Rammler from `feedX63Mm`, `feedM`).
* **C** — the classification/selection diagonal: the probability a particle in each size class is captured + broken
  per pass (rises with size relative to the CSS). `classification.ts`.
* **B** — the breakage/appearance matrix (strictly lower-triangular, column-conserved mass): the JKMRC t10 → Austin
  distribution of progeny. `breakage.ts`.
* **capacity** — Evertsson's throughput "hump" vs eccentric speed; **power** — Bond from the work index + reduction.

## Why it fits

A population-balance + capacity + power engine is the standard analytic comminution model — cheap, differentiable
enough to run live, and physically interpretable (mass closure + a conditioning estimate of `(I − B·C)` guard every
result). It is calibrated to published cone data and honestly labelled as a model, not a plant.

## Applying to other data

Any operating point that passes Contract 1 is evaluable; a bring-your-own feed PSD (descending sieve edges, monotone
passing) is validated by `io.contract.validate_psd`. The engine has no CWRU-style dataset dependency — it is physics.
