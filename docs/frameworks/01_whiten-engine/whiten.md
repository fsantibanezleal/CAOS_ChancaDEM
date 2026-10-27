# Engine, the crusher model and its two implementations (M4, the Whiten population balance)

ChancaDEM computes the product of a crusher with one vertical engine written twice: the Python package
`data-pipeline/pipeline/model/crusher/` is canonical, and the TypeScript port `frontend/src/engine/` is its live copy.
The reference fixture `tests/fixtures/engine-reference.json` holds the two equal. This card describes the engine as a
whole and its core, the Whiten classification-breakage solve; the pieces each have a card of their own:
[feed and sieve grid](../10_feed-and-sieve-grid/feed-sieve.md), [breakage](../11_breakage-function/breakage.md),
[classification](../12_classification/classification.md), [capacity](../13_capacity/capacity.md),
[regimes and nip angle](../14_regimes-and-nip-angle/regimes.md), [envelope gate](../15_envelope-gate/envelope.md),
[power](../09_power_model/power-model.md) and the [HP500 calibration](../16_hp500-calibration/hp500-calibration.md).

## What it is

`evaluate(op)` in `engine.py` takes one operating point (`Operating`: the machine, the closed-side setting CSS, the
eccentric throw, the speed, the Rosin-Rammler feed $x_{63}$ and $m$, the ore competence $A \times b$, the Bond work index
$W_i$, and the `calibrated` switch) and returns a `CrusherResult`: the feed and product gradations on the sieve grid,
$F_{80}$, $P_{80}$, $P_{50}$, $P_{20}$, the reduction ratio, the percent passing at 1, 4, 8, 16 and 32 mm, the
throughput, the power, the specific energy, the open-side setting, the nip angle, the regime, the validity, the flags,
the envelope codes, the mass closure and a conditioning proxy. Units are millimetres, tonnes per hour, kilowatts and
kWh per tonne.

The order of one evaluation, as `engine.py` runs it:

1. the feed on the grid (Rosin-Rammler), and its $F_{80}$;
2. the classification parameters $K_1, K_2, K_3$ and the vector $C$ at the class mid-sizes;
3. the specific energy $E_{cs}$, the fineness $t_{10}$, the Austin shape $\varphi$ and the breakage matrix $B$;
4. the Whiten solve for the product;
5. $P_{80}$, $P_{50}$, $P_{20}$ and the readouts by interpolation on the product curve;
6. the throughput, then the Bond power (on the calibrated lane, the HP500 current-based form);
7. the nip angle, the regimes, the validity flags and the envelope gate.

## The Whiten solve

The chamber is one breakage zone. A particle of size class $j$ is nipped and broken with probability $c_j$ (the
classification, a diagonal matrix $C$), and its progeny report to finer classes through the breakage matrix $B$.
The internal balance of the zone is $x = f + B C x$, and the product is the part that was not selected for breakage,
$p = (I - C)\,x$, hence (Whiten 1972; Napier-Munn et al. 1996)

$$p = (I - C)\,(I - B C)^{-1} f$$

where $f$ is the feed mass per class (sum 1) and $p$ the product mass per class. In `whiten.py` the inverse is never
formed: $M = I - BC$ is built, $M x = f$ is solved by LU decomposition with partial pivoting (`linalg.py`), then
$(I - C)$ is applied. $B$ is strictly lower triangular (progeny are always finer), so $BC$ has a zero diagonal, $M$ has a
unit diagonal and a determinant of 1, and the system is never singular; a conditioning proxy (the ratio of the largest to
the smallest absolute row sum of $M$) is kept for the near-choke regime and the engine flags a point whose proxy exceeds
$10^6$ (`ill_conditioned`). The mass closure $|\sum p - \sum f|$ is reported before the product is renormalised to a
sum of 1.

## The constants as the code has them

| Constant | Value | Unit | File |
|---|---|---|---|
| sieve top size `TOP_MM` | 256 | mm | `engine.py` |
| sieve classes `K` | 28 | - | `engine.py` |
| grid ratio | $\sqrt 2$ | - | `sieve.py` |
| readout sizes `READOUT_SIZES` | 1, 4, 8, 16, 32 | mm | `engine.py` |
| ill-conditioning threshold | $10^6$ | - | `engine.py` |
| reduction ratio flagged as negligible | below 1.05 | - | `engine.py` |
| equality tolerance, Python against TypeScript | $10^{-9}$ relative | - | `tests/test_crusher_engine.py` |

The finest class edge is $256 / 2^{14} = 0.015625$ mm.

## Where it runs

| Lane | Where | What it does |
|---|---|---|
| Offline | `data-pipeline/pipeline/model/crusher/` | labels the 27 cases, the Latin-hypercube sweep of the two learned models, the HP500 backbone |
| Live | `frontend/src/engine/` | re-runs a case in the browser with the reader's six knobs |

Both are pure arithmetic on IEEE doubles. `jsmath.py` reproduces the JavaScript semantics where Python differs (a
negative base with a fractional exponent is NaN, an exponent overflow is infinity, a division by zero is signed
infinity), so an out-of-domain point returns a flagged result in both languages instead of raising. This is the only
place the two languages differ by construction. See [architecture 04](../../architecture/04_live-lane.md).

## Tests

- `tests/test_crusher_engine.py::test_python_engine_reproduces_the_reference`: every one of the 121 reference points,
  every result field and every feature vector, within $10^{-9}$ relative. Measured on 2026-10-27 the largest relative
  difference over the fixture is $2.3 \times 10^{-12}$.
- `frontend/src/engine/reference.test.ts`: the TypeScript engine against the same file.
- `tests/test_crusher_engine.py::test_whiten_solve_conserves_mass_and_product_normalizes` and
  `test_tighter_css_gives_a_finer_product`: the acceptance criteria of M4.
- `frontend/src/engine/crusher.parity.test.ts`: the TypeScript engine against the baked traces, to the six significant
  digits they are written with.

## What it is not

- Not a plant model: one breakage zone with a classification function, no spatial resolution of the chamber, no
  wear, no feed segregation. See the [DEM landscape](../07_dem_pbm_landscape/dem-pbm.md).
- Not calibrated on the synthetic machines: their constants are illustrative of their class and reproduce trends, not a
  vendor's numbers. Only the HP500 cone lane is calibrated (see the [calibration card](../16_hp500-calibration/hp500-calibration.md)).
- Not a package: the product declares none (`product.json` carries no `method_packages` key); the engine is a module folder
  of the pipeline run by path.

## References

- Whiten 1972, [open PDF in the SAIMM archive](https://www.saimm.co.za/Conferences/Apcom72/317-Whiten.pdf)
- Napier-Munn, Morrell, Morrison and Kojovic 1996, *Mineral Comminution Circuits*, [WorldCat](https://search.worldcat.org/title/37081193)
