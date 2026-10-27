# Method, the capacity hump: a reduced Evertsson flow model (M5)

## What it is

Throughput as a function of the setting, the throw and the eccentric speed. It rises with speed to an optimum and
falls past it, because the gyrating head obstructs free fall faster than gravity clears the material.

## Theory

A reduced parametric form of the Evertsson cone-crusher flow model (Evertsson 2000), implemented in `capacity.py`
(`throughput`):

$$Q = Q_{ref}\;\frac{\mathrm{CSS} + T/2}{g_{ref}}\;s\,e^{\,1 - s}, \qquad s = \frac{N}{N_{opt}}$$

The factor $s\,e^{1-s}$ peaks at $s = 1$ with value 1 (the hump); the opening factor is proportional to the mean
discharge gap $\mathrm{CSS} + T/2$. The result is floored at 0. Absolute numbers are illustrative per machine; the shape
(unimodal in speed, increasing in setting and throw) is the claim. `optimal_speed` returns $N_{opt}$.

## The constants as the code has them

`CAP` in `capacity.py`:

| Machine | $Q_{ref}$ [t/h] | $N_{opt}$ [rpm] | $g_{ref}$ [mm] |
|---|---|---|---|
| cone-sec | 520 | 360 | 38 |
| cone-tert | 240 | 400 | 16 |
| cone-short-head | 200 | 480 | 12 |
| gyratory | 4500 | 150 | 175 |
| jaw | 700 | 300 | 110 |

On the calibrated cone-sec lane $Q_{ref}$ is `HP500_QREF` = 647 t/h (the code attributes it to Table 4 of Rocha et al.
2024; UNVERIFIED here, the paper page returned HTTP 403 to the documenting session). At the reference case S01
(CSS 32 mm, throw 30 mm, 360 rpm) the formula gives $520 \times 47/38 = 643.16$ t/h, the value in
`data/derived/manifests/S01.json`.

## Where it runs

Both lanes: `capacity.py` offline, `frontend/src/engine/capacity.ts` live. The trace carries a 31-point speed sweep
(0.5 to 1.5 times the case speed) of throughput and power, drawn by the Performance view.

## Tests

- `tests/test_crusher_engine.py::test_capacity_is_unimodal_in_speed` (the gate of M5).
- `tests/test_crusher_engine.py::test_throughput_and_power_are_positive_and_finite_for_a_valid_point`.
- Case S03 of the matrix sits past the hump on purpose: its throughput falls as the speed rises.

## What it is not

- Not the full Evertsson model: no cavity-level material balance, no feed-segregation or choke-level dynamics. It is the
  hump and the gap dependence.
- Not a vendor capacity table. The synthetic references are illustrative; only the HP500 base is anchored to data, and
  the held-out result is in the [CrusherCal card](../08_calibration_validation/calibration-validation.md).

## References

- Evertsson 2000, *Cone Crusher Performance*, PhD thesis, [Chalmers](https://research.chalmers.se/en/publication/759)
- Evertsson 1999, [doi:10.1016/S0892-6875(99)00136-3](https://doi.org/10.1016/S0892-6875(99)00136-3)
