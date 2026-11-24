# Method, the discrete element method with particle replacement on a laboratory jaw (the package crushdem)

## What it is

The discrete element method (DEM) resolves a crusher chamber as flowing, colliding spheres under contact laws. Breakage is by
particle replacement: a sphere that meets its breakage criterion is removed and replaced by smaller spheres. ChancaDEM runs
it, offline, through the published package `crushdem` 0.6.0
([PyPI](https://pypi.org/project/crushdem/0.6.0/), a separate repository; the product declares no package of its own), on one
laboratory jaw crusher, and compares it there with the measurement and with the product's population balance. The result is
the document `data/derived/dem/jaw-lab.json` (catalog row `dem-run`), shown in the Particle simulation tab of the App's
Validation group and taught in the Methodology topic of the same name. It is not part of the live lane and it never runs in
CI or in the browser.

## The method

**Contact.** A Hertz normal spring with the Tsuji damping fitted to the coefficient of restitution, a Mindlin tangential
spring with history capped by Coulomb sliding, and a constant rolling-resistance torque (the contact document of `crushdem`):

$$F_n = \tfrac{4}{3}E^{*}\sqrt{R^{*}}\,\delta^{3/2} + \eta_n v_n,\qquad \eta_n = \alpha(e)\sqrt{m^{*}k_{nd}},\qquad k_t = 8G^{*}\sqrt{R^{*}\delta},\quad |\mathbf F_t| \le \mu\max(F_n,0)$$

Tsuji, Tanaka and Ishida 1992 ([doi:10.1016/0032-5910(92)88030-L](https://doi.org/10.1016/0032-5910(92)88030-L)) for the
damping, Mindlin 1949 ([doi:10.1115/1.4009973](https://doi.org/10.1115/1.4009973)) for the tangential force, Cundall and
Strack 1979 ([doi:10.1680/geot.1979.29.1.47](https://doi.org/10.1680/geot.1979.29.1.47)) for the method.

**Breakage.** The single-particle model of Tavares 2022 ([doi:10.14356/kona.2022012](https://doi.org/10.14356/kona.2022012),
equation numbers of that paper): the specific fracture energy $E$ (J/kg) is an upper-truncated lognormal with median
$E_{50}(d)$ (equations 7, 8 and 10), damage accumulates below it (equations 11 and 12), and the progeny follow the t10 family
(equations 16 and 20):

$$P(E) = \tfrac12\!\left[1+\operatorname{erf}\frac{\ln E^{*}-\ln E_{50}}{\sqrt{2\sigma^{2}}}\right],\quad E_{50}(d) = E_\infty\!\left[1+(d_0/d)^{\varphi}\right],\quad t_{10} = A\!\left[1-\exp\!\left(-b'\frac{e\,E_k}{E_{50b}}\right)\right]$$

Each sphere draws one uniform number when it appears, which fixes its fracture energy. The loading event of a sphere in a bed is
the compressive work of its contacts divided by its mass. The replacement conserves the parent's mass (the part below the
smallest kept sphere leaves as fines), conserves momentum, and bounds the Hertz energy that the placement leaves in the
overlaps.

**The ore.** Derived from the paper's single-particle tests (the sample median force of 30 particles per class, digitised) and
not calibrated to the jaw: $E_\infty$ and $d_0$ are fitted to the two coarse classes, and $\varphi$, $\sigma^2$, $\gamma$, $A$
and $b'$ are assumptions taken from one rock of Tavares 2022; the document's `ore.derivation` states each. No ore property
was tuned to reach a band, but two choices of the derivation were made by the package's authors after jaw results of the
package were known, as its validation record discloses: $\varphi$ was fixed and the finest class left out after a first
trial run, and the sample median replaced the median of a lognormal fit after an earlier set of jaw runs. The run with the
other statistic does not exist, so the sensitivity of the net power verdicts to that choice is not known. The contact is
that of Tables 3 and 4 of the paper, which its own Fig. 6a contradicts (the package's validation document finds it about six
times softer than the paper's calibrated sphere).

## The case

The laboratory jaw crusher of Barrios, Jimenez-Herrera, Fuentes-Torres and Tavares 2020 (Minerals 10(8):717,
[doi:10.3390/min10080717](https://doi.org/10.3390/min10080717), CC BY 4.0): feed opening 140 by 90 mm, closed side 7.5 mm,
throw 10 mm, swing jaw at 6.0 Hz, batches of about 6 kg of three narrow feed classes, 63/52, 31.5/26.5 and 16/13.2 mm, each with
a measured throughput, net power and product. The paper tabulates one power (0.34 kW, 63/52 mm); the other measured values are
digitised from its figures by the package. The population balance predicts the same points with the laboratory-jaw module
(card [20](../20_jaw-capacity-sastri/jaw-capacity.md)): the capacity model of Sastri, a first estimate of the classification
parameters with the ranges of King for Symons cone crushers as a sensitivity band, Bond's energy per unit of work index and no
power. The bands were set before any run: throughput within 10 percent, net power within 30 percent, the reduction ratio F80
over P80 within 15 percent.

## The result, read from the document

State `partial`. Of the 27 verdicts, 3 are met, 13 are not met and 11 are not compared.

| Feed (mm) | Throughput, kg/h (measured, particle simulation, population balance) | Net power, kW (measured, particle simulation) | Reduction ratio (measured, particle simulation, population balance) |
|---|---|---|---|
| 63/52 | 798.7, 2167.1 (error +171 percent, not met), 547.0 (-31 percent, not met) | 0.340, 0.301 (-11.5 percent, met, resolved) | 8.60, 4.17 (-51 percent, not met), 10.41 (+21 percent, not met) |
| 31.5/26.5 | 937.2, no result (run did not complete), 826.2 (-12 percent, not met) | 0.1656, no result | 4.02, no result, 4.39 (+9 percent, met) |
| 16/13.2 | 1220.4, 2464.1 (+102 percent, not met), 876.7 (-28 percent, not met) | 0.1346, 0.1108 (-17.7 percent, met, not resolved) | 1.99, 1.02 (-49 percent, not met), 1.50 (-24 percent, not met) |

- The 63/52 mm run completes at the second overlap limit (0.5 of the smaller radius; the first stopped in stroke 6) in 83
  strokes, with a steady window of strokes 37 to 65 (29 strokes), 1253 breakage events and 6107 progeny. The 16/13.2 mm run
  completes at the second limit in 54 strokes (window 15 to 39). The 31.5/26.5 mm run stops with the package's overlap error at
  both limits, in stroke 6 of the second attempt, after 0.306 kg had passed; the document records it as it stopped and states no
  window statistic for it.
- The particle simulation passes the batch 2.7 and 2.0 times faster than the measurement, and delivers 500 and 162 J/kg against
  the 1533 and 397 J/kg derived from the measured power over the measured throughput. The two met power verdicts are therefore
  the product of a fast machine that does little work per kilogram, not of a right energy balance. The product is coarser (P80
  14.7 and 15.2 mm against 7.1 and 7.8 mm); 9 spheres larger than the 17.5 mm open side passed in the 63/52 mm run (the largest,
  18.1 mm), and 18 of the 29 strokes of its window ran above the reference overlap of 0.3.
- The population balance is below the measured throughput at the three points and its reduction ratio is inside the band at the
  middle feed only; it states no power because no work index, A, b or fracture energy of the ore is published. Its energy per
  breakage event is the engine's own rule, 0.033 times the throw (mm) times the speed (rpm) over 350, in kWh/t (0.339 kWh/t
  here), written for the plant machines and applied unchanged.
- The result is about the particle simulation as `crushdem` 0.6.0 implements it, not a refutation of the published study: the
  paper reports very good agreement of its own simulation with its measurements (for the 63/52 mm feed 0.32 kW simulated against
  0.34 kW measured, page 10, which is 5.9 percent low; its simulated throughput curve of Fig. 14a reads about 890 kg/h there
  against 799 measured, about 11 percent high by a by-eye reading). That simulation breaks a particle at a threshold force and
  replaces it with a fixed progeny set that the paper fitted to the product of its own jaw tests (page 7), whereas `crushdem`
  uses the energy-based model
  of Tavares with an ore derived from the paper's single-particle tests. Which of the machine's assumptions (the contact
  stiffness, the harmonic swing law, the 20 degree nip angle, the flat smooth plates) accounts for the departure is not isolated
  by this document.

Reproduce: `python data-pipeline/run.py dem --runs <folder> --jobs 3` in `.venv-pipeline` (guide
[01](../../guides/01_precompute-pipeline.md)); the three runs took 2624, 375 and 4210 s of wall time on the bake's machine.

## Where it stops being valid

- One machine, one ore (derived, with assumed parameters), one seed and one realisation of each run: no spread over seeds.
- Spheres, not angular fragments; whole spheres pass the gap by diameter.
- The Tavares model was proposed for impact loading; in a confined bed the event energy is the compressive work of the
  contacts, a first-order rule that overstates the energy by about 5 percent at the default time step.
- The overlap limit of 0.5 is a large overlap for Hertz contacts, and the steady window of the 63/52 mm run lies mostly above the
  reference overlap.
- Two readings of the paper are ours: the throw is the horizontal opening of the swing plate's bottom edge (open side 17.5 mm),
  and the net power is the motor power less the no-load power; the DEM power is the work the swing plate delivers to the bed.

## What it is not

- Not bonded particles, not polyhedra, not wear, not an industrial cone or gyratory: the HP500 calibration and CrusherCal
  ([card 08](../08_calibration_validation/calibration-validation.md)) are untouched, and the HP500 geometry is not public.
- Not a calibration: no parameter of the ore, the preset or the settings was adjusted to the jaw's throughput, power or product.
- Not in the live lane: the 3D chamber of the workbench (`frontend/src/engine/chamber.ts`) is a kinematic view, not a particle
  simulation, and the browser reads the committed document and its replay files only.
- Not a claim of lower error than the paper or than any DEM study.

## Tests

`tests/test_dem_stage.py` (the stage takes the simulation from the package, the points read no measurement, a short run is
reproduced bit for bit, a run that does not complete is recorded as such), `tests/contracts/test_dem_run.py` (the schema, the
verdicts follow the bands, the population-balance block is the engine at the point), `frontend/src/content/methodology/demdata.test.ts`
(the topic's statements held to the document).

## References

- Barrios et al. 2020, [doi:10.3390/min10080717](https://doi.org/10.3390/min10080717)
- Tavares 2022, [doi:10.14356/kona.2022012](https://doi.org/10.14356/kona.2022012)
- Cleary and Sinnott 2015, [doi:10.1016/j.mineng.2014.10.021](https://doi.org/10.1016/j.mineng.2014.10.021) (particle replacement in compression crushers)
- Delaney et al. 2015, [doi:10.1016/j.mineng.2015.01.013](https://doi.org/10.1016/j.mineng.2015.01.013) (non-spherical particles, t10 progeny)
- Quist and Evertsson 2016, [doi:10.1016/j.mineng.2015.11.004](https://doi.org/10.1016/j.mineng.2015.11.004) (bonded particles, a cone)
- Johansson et al. 2017, [doi:10.1016/j.mineng.2016.09.015](https://doi.org/10.1016/j.mineng.2016.09.015) (DEM against laboratory experiments)
- Tsuji et al. 1992, Mindlin 1949, Cundall and Strack 1979 (above)
- `crushdem` 0.6.0, [pypi.org/project/crushdem/0.6.0](https://pypi.org/project/crushdem/0.6.0/)
