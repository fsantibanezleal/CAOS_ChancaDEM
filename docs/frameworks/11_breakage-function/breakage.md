# Method, the breakage function: JKMRC t10 and the Austin appearance function (M2)

## What it is

The breakage matrix $B$ says where the mass of a broken particle goes. It is built from two cited relations: how much
energy makes how much fines (the $t_{10}$ relation), and how the progeny spread over the finer sizes (the Austin
appearance function).

## Theory

**Energy to fineness.** The JKMRC drop-weight relation (Napier-Munn et al. 1996) ties the fraction of progeny passing a
tenth of the parent size, $t_{10}$, to the specific comminution energy $E_{cs}$ [kWh/t]:

$$t_{10} = A\,\bigl(1 - e^{-b\,E_{cs}}\bigr)$$

with $A$ and $b$ the ore competence parameters, whose product $A \times b$ is the single hardness number the product
takes (lower is harder). The engine fixes $A = 60$ percent and sets $b = (A \times b)/A$ (`t10_of`), and caps $t_{10}$
at 0.44 so that the appearance function below can represent it.

**Specific energy.** `specific_energy` gives $E_{cs} = 0.033\,T_{ref}\,(N / 350)$, with $T_{ref}$ the machine's design
throw and $N$ the speed [rpm]. It deliberately uses the design throw, not the throw slider: a larger throw coarsens the
product through the classification window (see the [classification card](../12_classification/classification.md)), it
does not add energy.

**Appearance function.** The cumulative breakage distribution for a relative size $u = x/y \in (0,1]$ of a parent $y$
(Austin, Klimpel and Luckie 1984) is

$$B(u) = \varphi\,u^{\gamma} + (1 - \varphi)\,u^{\beta}, \qquad B(1) = 1$$

$\gamma$ sets the fines slope and $\beta$ the coarse slope. $\varphi$ is solved so that the curve passes through
$(u = 1/10,\, B = t_{10})$: $\varphi = (t_{10} - 0.1^{\beta}) / (0.1^{\gamma} - 0.1^{\beta})$, clamped to 0.02 to 0.98
(`phi_from_t10`). At $u = 1/10$ the largest reachable value ($\varphi = 1$) is $0.1^{\gamma}$, which is why $\gamma = 0.35$
gives a maximum $t_{10}$ of about 0.447 and the cap is 0.44.

**The matrix.** `breakage_matrix` fills $B_{ij}$, the mass fraction of broken class-$j$ material reporting to the finer
class $i > j$, as the difference of $B(u)$ at the class edges (the upper edge capped at the parent size), and
renormalises every column to exactly 1, so broken mass is conserved. Strictly lower triangular, as the solve needs.

## The constants as the code has them

| Constant | Value | Unit | File |
|---|---|---|---|
| $\gamma$ (`GAMMA`) | 0.35 | - | `breakage.py` |
| $\beta$ (`BETA`) | 4.2 | - | `breakage.py` |
| $A$ | 60 | percent | `breakage.py` (`t10_of`) |
| energy coefficient | 0.033 | kWh/t per mm of throw at 350 rpm | `breakage.py` (`specific_energy`) |
| reference speed | 350 | rpm | `breakage.py` |
| $t_{10}$ cap | 0.44 | fraction | `breakage.py` |
| $\varphi$ clamp | 0.02 to 0.98 | - | `breakage.py` |
| design throw | cone-sec 30, cone-tert 16, cone-short-head 16, gyratory 30, jaw 38 | mm | `machines.py` |

The code describes $\beta$ as illustrative, within 3 to 6. At the reference case S01 the energy is
$0.033 \times 30 \times 360/350 = 1.018$ kWh/t (`data/derived/manifests/S01.json`, `specific_energy_kwh_t`). On the
calibrated lane $t_{10}$ is not computed from energy; see the [calibration card](../16_hp500-calibration/hp500-calibration.md).

## Where it runs

Both lanes: `breakage.py` and `machines.py` offline, `frontend/src/engine/breakage.ts` and `machines.ts` live. The trace
carries the $t_{10}$ of the case (`appearance_t10`).

## Tests

- `tests/test_crusher_engine.py::test_breakage_matrix_is_strictly_lower_triangular_and_columns_conserve_mass` (the gate
  of M2).
- `tests/test_crusher_engine.py::test_more_throw_widens_oss_and_gives_a_coarser_product_with_higher_capacity`: the
  throw does not enter the energy.
- `frontend/src/engine/physics.test.ts` and `reference.test.ts`: the same relations on the TypeScript side.

## What it is not

- Not an ore characterisation: no drop-weight test is run; $A \times b$ is a case input. The progeny shape ($\gamma$,
  $\beta$) is one fixed shape for every ore.
- Not a size-dependent breakage rate: the probability of breakage is the classification, not this function.

## References

- Napier-Munn, Morrell, Morrison and Kojovic 1996, [WorldCat](https://search.worldcat.org/title/37081193)
- Austin, Klimpel and Luckie 1984, *Process Engineering of Size Reduction: Ball Milling*, [WorldCat](https://search.worldcat.org/title/11603131)
