# Method, the Rosin-Rammler feed on the square-root-of-two sieve grid (M1)

## What it is

Every gradation the engine handles, the feed, the product and the classification, lives on one fixed sieve grid, and
the feed is the discretisation of a Rosin-Rammler (Weibull) distribution on it. The grid and the feed are the input
side of the [Whiten engine](../01_whiten-engine/whiten.md).

## Theory

Cumulative passing of crushed rock is described by the Rosin-Rammler law (Rosin and Rammler 1933)

$$R(x) = 1 - \exp\!\left[-\left(\frac{x}{x_{63}}\right)^{m}\right]$$

where $x_{63}$ is the size at 63.2 percent passing and $m$ the uniformity exponent: the higher $m$, the narrower the
feed. The mass of class $i$ between the upper edge $e_i$ and the lower edge $e_{i+1}$ is
$f_i = \max(0,\; R(e_i) - R(e_{i+1}))$, and the vector is renormalised to a sum of 1 (`feed.py`, `make_feed`). The
80 percent passing size follows from $R(F_{80}) = 0.8$, which fixes $x_{63} = F_{80} / (\ln 5)^{1/m}$ (used to rebuild
the feed of a real survey from its measured $f_{80}$, see the [calibration card](../16_hp500-calibration/hp500-calibration.md)).

The grid is the standard laboratory square-root-of-two series, descending from the coarsest edge: edge $k$ is
$256 / (\sqrt 2)^{k}$ mm for $k = 0 \ldots 28$, that is 28 classes (`sieve.py`, `make_grid`). Classes run coarse to
fine so the breakage matrix is lower triangular. Two interpolations read a gradation:

- size at a passing fraction (for $P_{80}$, $P_{50}$, $P_{20}$): linear in the logarithm of the size between the two
  edges that bracket the fraction (`size_at_passing`);
- passing at a size (the 1, 4, 8, 16 and 32 mm readouts): linear in the logarithm of the size between edges
  (`passing_at_size`), 1 above the top edge and 0 below the finest.

`feed.py` also holds the Gaudin-Schuhmann power law $R(x) = (x/k)^a$ for $x < k$, an alternative fit; the engine does
not call it.

## The constants as the code has them

| Constant | Value | Unit | File |
|---|---|---|---|
| top size | 256 | mm | `engine.py` |
| classes | 28 (29 edges) | - | `engine.py` |
| ratio | $\sqrt 2$ | - | `sieve.py` |
| bounds of $x_{63}$ accepted by contract 1 | above 0 up to 2000 | mm | `io/contract.py` |
| bounds of $m$ accepted by contract 1 | 0.3 to 4 | - | `io/contract.py` |
| feed uniformity of a reconstructed survey feed | 0.9 | - | `model/crusher/hp500.py` |

## Where it runs

Both lanes: `feed.py` and `sieve.py` offline, `frontend/src/engine/feed.ts` and `sieve.ts` live. The grid edges and
mid-sizes are written into every trace (`sieve_mm`, `mid_mm`), so the web draws curves on the grid the engine used.

## Tests

- `tests/test_crusher_engine.py::test_feed_psd_normalizes_and_f80_is_sensible`: the masses sum to 1 and the coarsest edge
  passes 100 percent (the gate of M1).
- `tests/test_oracles.py`: the closed form independent of the engine, the passing at the characteristic size equals
  $1 - 1/e$ (`data-pipeline/pipeline/oracles.py`).

## What it is not

- A claim that a real feed is Rosin-Rammler. It is the standard parametric description; a feed measured on a belt is
  better served by its own table, which the engine does not take (a new feed shape would be a new method).
- A fit: the product never fits $x_{63}$ and $m$ to data; the reader or the case supplies them.

## References

- Rosin and Rammler 1933, *The laws governing the fineness of powdered coal*, [CiNii](https://cir.nii.ac.jp/crid/1572543024341127296)
