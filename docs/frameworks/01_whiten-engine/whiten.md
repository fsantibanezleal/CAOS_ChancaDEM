# Engine, Whiten population balance + Evertsson capacity + Bond power

**Provenance:** Whiten (1972) the crusher population-balance model; the JKMRC drop-weight t10 → Austin appearance
function for progeny distribution; Evertsson (2000) cone-crusher capacity; Bond's comminution law for power.
**Calibration anchor:** Duarte et al. 2021 (Minerals 11(11):1256, DOI 10.3390/min11111256).

**What:** the live, analytic, deterministic physics, the source of truth the surrogate emulates. Pure TypeScript
(`frontend/src/physics/`), so the same engine runs live in the browser and generates the offline sweep labels (via
`node --import tsx`), which is why no Python re-port exists (a re-port would diverge).

## The model

The product PSD on a geometric sieve grid is the Whiten solve

```
p = (I − C)·(I − B·C)⁻¹·f
```

* **f**, the feed PSD (Rosin–Rammler from `feedX63Mm`, `feedM`).
* **C**, the classification/selection diagonal: the probability a particle in each size class is captured + broken
  per pass (Whiten K1/K2/K3, Andersen & Napier-Munn). `classification.ts`. K1 (the always-escape threshold) tracks
  the closed-side gap CSS; **K2 (the always-broken threshold) tracks the open-side gap OSS = CSS + throw**, so a
  larger eccentric throw opens the chamber wider, lets larger particles escape in the open phase, and yields a
  coarser product at fixed CSS with a higher capacity (Evertsson 1999, DOI 10.1016/S0892-6875(99)00136-3). Throw
  therefore acts on the product through the capture window, not through the per-nip energy.
* **B**, the breakage/appearance matrix (strictly lower-triangular, column-conserved mass): the JKMRC t10 → Austin
  distribution of progeny. `breakage.ts`. The per-nip specific energy is driven by the gyration rate and the
  machine design stroke (a per-machine constant, `machines.ts`), not the live throw, precisely so that throw
  coarsens (via C) rather than wrongly fining the product (via more energy).
* **capacity**, Evertsson's throughput "hump" vs eccentric speed; **power**, Bond from the work index + reduction.

## Why it fits

A population-balance + capacity + power engine is the standard analytic comminution model, cheap, differentiable
enough to run live, and physically interpretable (mass closure + a conditioning estimate of `(I − B·C)` guard every
result). Its constants are illustrative (they reproduce the correct trends), pending calibration to published cone
data (Duarte et al. 2021), and it is honestly labelled as a model, not a plant.

## Applying to other data

Any operating point that passes Contract 1 is evaluable; a bring-your-own feed PSD (descending sieve edges, monotone
passing) is validated by `io.contract.validate_psd`. The engine has no CWRU-style dataset dependency, it is physics.
