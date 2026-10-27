# Method, the Andersen-Whiten fit calibrated to ten HP500 surveys (M8)

## What it is

The one calibrated lane of the product. The synthetic machines are illustrative; the cone-sec machine, run with
`calibrated = True`, uses the Andersen-Whiten fit that Rocha et al. (2024) published for a Metso HP500 secondary cone
crushing itabirite iron ore at the Minas Rio operation, and is run at the ten measured surveys of their Table A1. The
fit is then judged out of sample by [CrusherCal](../08_calibration_validation/calibration-validation.md).

## The data

The ten surveys are transcribed into `data/examples/hp500-surveys.csv` (columns `survey`, `f80_mm`, `css_mm`, `feed_tph`,
`power_kw`) from Table A1, licensed CC BY 4.0, and validated by contract `hp500-survey`
(`data-pipeline/pipeline/hp500/surveys.py`): each value parsed, never coerced, inside its bounds, survey numbers 1 to n
without a gap. Measured ranges: feed rate 813 to 1639 t/h, power 187 to 355 kW, setting 38 to 55 mm, feed $f_{80}$ 47
to 140 mm (`data/derived/hp500/backbone.json`).

## The fit, as the code has it

On the calibrated lane the surveys vary only the setting and the feed $f_{80}$; the throw (34 mm) and the speed (360 rpm)
are machine constants (`HP500_NOMINAL`), the feed is rebuilt from the measured $f_{80}$ as a Rosin-Rammler distribution
with $m = 0.9$ and $x_{63} = f_{80}/(\ln 5)^{1/m}$ (`operating_from_survey`), the ore competence is the compact itabirite
$A \times b = 677.3$ (metadata only: the calibrated $t_{10}$ does not use it) and the blend work index is 9.0 kWh/t. The
engine then replaces three synthetic relations by the fit, with sizes in millimetres:

$$K_1 = 0.23\,\mathrm{CSS} + 0.30\,f_{80}, \qquad K_2 = 12.0 + 0.55\,\mathrm{CSS} + 0.40\,f_{80}, \qquad K_3 = 2.3$$

($K_2$ floored at $1.05\,K_1$; independent of the throw),

$$t_{10}\,[\%] = 64 - 0.12\,\mathrm{CSS} - 0.23\,f_{80}$$

(as a fraction, capped at 0.44, see the [breakage card](../11_breakage-function/breakage.md)), the capacity base
$Q_{ref} = 647$ t/h, and the power form $P_c = 1.30\,P_d + 110$ kW with $P_d$ the Bond draw (see the
[power card](../09_power_model/power-model.md)). The constants are in `classification.py` (`hp500_params`), `breakage.py`
(`t10_calibrated`), `capacity.py` (`HP500_QREF`, `calibrated_power`) and `model/crusher/hp500.py`. The values were
carried from the code and the cards of earlier releases; the paper itself could not be opened by the documenting session
(HTTP 403 from the publisher), so the correspondence of these numbers to Table 1, Table 4 and Table 5 of the paper is
UNVERIFIED in this unit.

## The backbone

`hp500/backbone.py` runs the engine at each survey and writes `data/derived/hp500/backbone.json`
(`chancadem.hp500.backbone/v1`): the measured values and, per survey, the modelled $P_{80}$, throughput, Bond power,
calibrated power and the engine's own $F_{80}$. The paper reports the particle size distributions only as figures, so the
$P_{80}$ is a model output and is judged by a physical relation (0.35 to 1.1 times the setting) rather than by a
measurement. The in-sample throughput agreement of the backbone with the ten measured values is a MAPE of 11.55 percent
(`data/derived/hp500/loo.json`, `tph_parity.backbone`).

## Where it runs

Offline, in the bake (`run.py all` and `run.py hp500`); the browser runs the same fit on the calibrated cases through the
TypeScript engine, and the replay of the backbone is drawn in the Validation group.

## Tests

- `tests/contracts/test_hp500_validation.py::test_backbone_is_the_engine` (the gate of M8): the calibrated engine at each
  survey equals the committed backbone document.
- `tests/contracts/test_hp500.py`: the survey table validates, adversarial rows are rejected with reasons.
- `tests/test_crusher_engine.py::test_envelope_gate_the_ten_real_hp500_surveys_are_physically_plausible`, with the caveat
  in the [envelope card](../15_envelope-gate/envelope.md).

## What it is not

- Not a calibration the product performed: the fit is the paper's. The product holds it to ten surveys out of sample.
- Not transferable: one machine, one ore, a setting range of 38 to 55 mm. Outside it the envelope gate flags
  extrapolation.
- Not a power model, see the [power card](../09_power_model/power-model.md).

## References

- Rocha, Campos, Silva and Tavares 2024, *Fit-for-Purpose Model of HP500 Cone Crusher in Size Reduction of Itabirite Iron
  Ore*, Minerals 14(9), 919, [doi:10.3390/min14090919](https://doi.org/10.3390/min14090919) (CC BY 4.0)
- Duarte, Yamashita, da Silva, Cota and Euzebio 2021, [doi:10.3390/min11111256](https://doi.org/10.3390/min11111256), a second
  industrial cone calibration. It cannot anchor the absolute numbers: it has no throw, speed, ore properties or power, its machines
  are an HP400 and a CH660 and its size data are plots only (Table 1, p. 9; Figures 4 to 9). The case CK1 is a synthetic
  control, and the anchor is the HP500 lane of Rocha et al. 2024.
