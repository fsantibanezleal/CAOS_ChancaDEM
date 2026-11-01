# Method, the power model: Bond, the paper's form, and an honest negative (M7)

## What it is

The power path of the engine, and the finding that the calibrated power form does not reproduce the measured power of
the ten HP500 surveys. The card exists so the negative is documented, not buried.

## Bond's law, the classical draw

`bond_power` in `capacity.py` computes the Bond net comminution draw (Bond 1952), with sizes in micrometres:

$$W = 10\,W_i\left(\frac{1}{\sqrt{P_{80}}} - \frac{1}{\sqrt{F_{80}}}\right)\ [\mathrm{kWh/t}], \qquad P = W\,Q\ [\mathrm{kW}]$$

with $W_i$ the work index and $Q$ the throughput; the draw is floored at 0. On the synthetic lane this is the power. At
case S01 it gives 287.4 kW (`data/derived/manifests/S01.json`). Bond's law was developed for grinding and is a poor
descriptor of coarse crushing duty; Morrell's size-specific energy ($M_{ic}$,
[doi:10.1016/j.mineng.2009.01.005](https://doi.org/10.1016/j.mineng.2009.01.005)) is the documented alternative; it is implemented
and held out on the ten surveys (card [Morrell](../18_morrell-size-specific-energy/morrell.md), M14), where it does not beat the setting-only line.

## The paper's calibrated form

On the calibrated lane `calibrated_power` applies $P_c = 1.30\,P_d + 110$ kW with $P_d$ the Bond draw, the engine's
reading of the current-based form of Rocha et al. (2024). In the paper $P_d$ is a size-specific net power from the
paper's own model, not the classical Bond draw, so the constants 1.30 and 110 do not transfer (the backbone document says
so in its `note`; the paper's own text was not re-read in this unit, UNVERIFIED).

## The finding, measured over the ten surveys

In sample, against the ten measured values (187 to 355 kW), from `data/derived/hp500/loo.json`, `power_parity`:

| Power estimate | MAPE (percent) | R2 | What it shows |
|---|---|---|---|
| bare Bond draw | 26.88 | -1.29 | nearly flat, 196 to 237 kW; it does not track the measured spread |
| $P_c = 1.30\,P_d + 110$ on the Bond $P_d$ | 47.58 | -3.64 | overshoots: the paper's constants are for the paper's $P_d$ |
| refit $P_c = \zeta P_d + P_n$ on the ten | 19.28 | 0.21 | the best the form can do; the fit has $\zeta = -2.41$ and $P_n = 828.6$ kW, a negative slope that collapses toward the mean |
| constant mean | 22.03 | 0.00 | the baseline |

Out of sample the picture is the same (strict LOO, kW: backbone 25.94 percent against the constant mean 24.48; see the
[CrusherCal card](../08_calibration_validation/calibration-validation.md)). The Bond draw carries little information about
the measured power variation: an explanation recorded in earlier releases (not re-derived here) is that the measured power
tracks the setting more than the draw does, because as the setting tightens the finer product raises kWh/t while the
lower throughput cancels it in tonnes. So:

- no overprediction removal is claimed anywhere;
- on the real lane the App shows the measured power as the reference, and does not present the modelled kW as a
  prediction of that survey;
- the genuine result is the throughput parity, not the power.

## Where it runs

Both lanes (`capacity.py`, `frontend/src/engine/capacity.ts`). The units gate bounds power at 0 to 3000 kW as a unit-error
ceiling (`core/unit_gate.py`), not as an accuracy claim.

## Tests

- `tests/test_crusher_engine.py::test_throughput_and_power_are_positive_and_finite_for_a_valid_point` and
  `tests/contracts/test_hp500_validation.py::test_loo_validates` (the gates of M7).

## What it is not

- Not a validated power model. Reconstructing the paper's size-specific $P_d$ so that its constants apply would be the next step
  (the size-specific energy model of Morrell was tried and does not beat the setting-only line); until then power is a documented
  limitation.

## References

- Bond 1952, *The third theory of comminution*, [OneMine](https://onemine.org/documents/the-third-theory-of-comminution)
- Napier-Munn et al. 1996, [WorldCat](https://search.worldcat.org/title/37081193)
- Morrell 2009, [doi:10.1016/j.mineng.2009.01.005](https://doi.org/10.1016/j.mineng.2009.01.005)
- Rocha et al. 2024, [doi:10.3390/min14090919](https://doi.org/10.3390/min14090919)
- Gröndahl et al. 2018, [doi:10.1016/j.mineng.2018.07.008](https://doi.org/10.1016/j.mineng.2018.07.008) (real power-draw signatures)
