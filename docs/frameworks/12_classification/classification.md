# Method, the Andersen and Napier-Munn classification K1, K2, K3 (M3)

## What it is

The classification function $C(d)$ is the probability that a particle of size $d$ entering the chamber is nipped and
broken instead of passing straight through. It is the diagonal of $C$ in the [Whiten solve](../01_whiten-engine/whiten.md).

## Theory

With three parameters (Whiten 1972; the $K_1, K_2, K_3$ form of Andersen and Napier-Munn 1988; Napier-Munn et al. 1996):

$$C(d) = \begin{cases} 0 & d \le K_1 \\ 1 - \left(\dfrac{K_2 - d}{K_2 - K_1}\right)^{K_3} & K_1 < d < K_2 \\ 1 & d \ge K_2 \end{cases}$$

Below $K_1$ every particle escapes, above $K_2$ every particle is broken, and $K_3$ shapes the rise between. On the
synthetic machines $K_1$ is linear in the closed-side setting and $K_2$ is linear in the setting and in the throw
(`classification_params`):

$$K_1 = a_1 + b_1\,\mathrm{CSS}, \qquad K_2 = a_2 + b_2\,\mathrm{CSS} + b_2\,\tfrac12\,(T - T_{ref})$$

with $T$ the throw and $T_{ref}$ the machine's design throw. $K_2$ therefore tracks the open-side setting
$\mathrm{OSS} = \mathrm{CSS} + T$: a wider throw lets larger particles escape in the open phase and coarsens the product
at a fixed setting, and at the design throw the term vanishes (the Evertsson direction, Evertsson 1999). $K_2$ is
floored at $1.05\,K_1$ so the window never inverts.

## The constants as the code has them

`KMODEL` in `classification.py`; the throw fraction `K2_THROW_FRAC` is 0.5.

| Machine | $a_1$ | $b_1$ | $a_2$ | $b_2$ | $K_3$ |
|---|---|---|---|---|---|
| cone-sec | 0.2 | 0.90 | 6.0 | 1.95 | 2.3 |
| cone-tert | 0.1 | 0.85 | 3.0 | 1.75 | 2.5 |
| cone-short-head | 0.1 | 0.82 | 2.4 | 1.65 | 2.7 |
| gyratory | 0.6 | 0.95 | 10.0 | 2.10 | 2.0 |
| jaw | 2.0 | 0.95 | 20.0 | 2.30 | 2.1 |

The per-machine slopes are provisional literature-typical values (the code says so); they are illustrative, not
vendor data. The calibrated HP500 lane replaces them by the fitted form in the [calibration card](../16_hp500-calibration/hp500-calibration.md).
At the reference case S01 (cone-sec, CSS 32 mm, design throw): $K_1 = 29.0$ mm, $K_2 = 68.4$ mm, $K_3 = 2.3$.

## Where it runs

Both lanes: `classification.py` offline, `frontend/src/engine/classification.ts` live. The trace carries $C$ at the
class mid-sizes (`classification`), which the Product view draws.

## Tests

- `tests/test_crusher_engine.py::test_classification_is_monotone_non_decreasing_c_small_zero_c_large_one`
- `tests/test_crusher_engine.py::test_more_throw_widens_oss_and_gives_a_coarser_product_with_higher_capacity`
- `tests/test_crusher_engine.py::test_throw_is_neutral_at_the_machine_design_throw`

## What it is not

- Not a measurement of a real chamber's classification. The synthetic machines' parameters reproduce the trends
  (tighter gives finer, wider throw gives coarser), not absolute sizes.
- Not size-by-size breakage energy: that is the [breakage function](../11_breakage-function/breakage.md).

## References

- Whiten 1972, [SAIMM archive](https://www.saimm.co.za/Conferences/Apcom72/317-Whiten.pdf)
- Andersen and Napier-Munn 1988, *Power prediction for cone crushers*, [Semantic Scholar](https://www.semanticscholar.org/paper/Power-prediction-for-cone-crushers-Andersen-Napier-Munn/2c60e81b909b65cba85b44583354dc8e310ec2f8)
- Napier-Munn et al. 1996, [WorldCat](https://search.worldcat.org/title/37081193)
- Evertsson 1999, *Modelling of flow in cone crushers*, [doi:10.1016/S0892-6875(99)00136-3](https://doi.org/10.1016/S0892-6875(99)00136-3)
