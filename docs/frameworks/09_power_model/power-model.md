# Method, the power model, Bond vs the calibrated form, and an honest negative

**What this card is:** the power path, and the adversarial finding that the calibrated power model does not
reproduce the measured power on the 10 HP500 surveys. This card exists so the negative is documented, not buried.

## Bond's law (the classical draw)

The engine computes the Bond net comminution draw (`capacity.ts`, `bondPower`):

```
W = 10·Wi·(1/√P80 − 1/√F80)   [kWh/t]   (sizes in micrometres)
draw [kW] = W · Q [t/h]
```

with Wi the Bond work index and Q the throughput. Bond's law is calibrated for grinding, and is known to be a
poor descriptor of coarse crushing duty; Morrell's size-specific energy (Mic, [doi:10.1016/j.mineng.2009.01.005](https://doi.org/10.1016/j.mineng.2009.01.005))
is the documented SOTA alternative.

## The paper's calibrated form (Rocha 2024, Table 5)

The paper reports a linear power model `Pc = ζ·Pd + Pn` with ζ = 1.30 and a no-load Pn = 110 kW, where **Pd is a
size-specific net power from the paper's own model**, not the classical Bond draw.

## The honest finding (measured over the 10 surveys)

Grading each power estimate against the measured kW (from `data/derived/hp500/loo.json`, `power_parity`):

| power estimate | MAPE vs measured | what it shows |
|---|---|---|
| bare Bond draw | ~27% | nearly flat (~196 to 237 kW); does not track the measured 187 to 355 kW spread |
| `Pc = 1.30·Pd + 110` on our Bond Pd | ~48% | overshoots; the paper's ζ,Pn are for the paper's Pd, not the Bond draw |
| refit `Pc = ζ·Pd + Pn` on our Pd | ~19% | best the form can do; collapses toward the survey mean |
| constant-mean baseline | ~24% | the Bond backbone is no better than this |

**Conclusion.** The engine's Bond draw carries little information about the measured power variation (the
measured power tracks CSS more than the Bond draw, because as CSS tightens the finer product raises kWh/t while
the lower throughput cancels it in tonnes). So:

- the dossier's premise that the calibrated model "removes a Bond ~2x coarse-duty overprediction" is **not
  supported** by the engine's numbers, and is reported as a corrected finding;
- no 2x-overprediction removal is claimed anywhere;
- on the App's real lane the **measured** power is the shown reference (the mis-scaled model kW is never surfaced
  as a prediction);
- the genuine at-bar result is the t/h parity (see the calibration/validation card), not the power.

## What this is and is not

- **Is:** an honest, transparent contrast of three power estimates against measured data, with the negative
  stated plainly and the corrected finding recorded.
- **Is not:** a validated power surrogate. Reconstructing the paper's size-specific Pd (to apply ζ,Pn correctly)
  or digitizing the paper's PSD figures for an independent P80 would be the next step; until then the power path
  is documented as a known limitation, not a result.

## References (DOI-verified)

- Bond 1952 (pre-DOI), [open on OneMine](https://onemine.org/documents/the-third-theory-of-comminution); Napier-Munn et al. 1996 (JKMRC monograph), [WorldCat](https://search.worldcat.org/title/37081193)
- Morrell 2009, [doi:10.1016/j.mineng.2009.01.005](https://doi.org/10.1016/j.mineng.2009.01.005)
- Rocha et al. 2024, [doi:10.3390/min14090919](https://doi.org/10.3390/min14090919)
- Gröndahl et al. 2018, [doi:10.1016/j.mineng.2018.07.008](https://doi.org/10.1016/j.mineng.2018.07.008) (real power-draw signatures)
