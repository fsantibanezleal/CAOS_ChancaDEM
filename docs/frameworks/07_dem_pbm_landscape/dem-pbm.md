# Method, the DEM / SOTA landscape (and why ChancaDEM is not a DEM solver)

**What this card is:** the reference frontier ChancaDEM positions against, with DOI-verified provenance, and an
explicit statement of what our engine is and is not. ChancaDEM runs a population-balance (PBM) / empirical model
live in the browser; DEM is the mechanism frontier it cites, not what runs client-side.

## The two DEM families for crushers

The state of the art for the *mechanism* of a cone/gyratory crusher is the discrete element method (DEM):
flowing, colliding, breaking particles resolved by contact laws. Two families appear in the literature:

- **Particle replacement (PRM).** A particle that reaches a breakage criterion is deleted and replaced by a set
  of smaller progeny. Cleary and Sinnott (2015) develop it for compression crushers ([doi:10.1016/j.mineng.2014.10.021](https://doi.org/10.1016/j.mineng.2014.10.021)); Delaney et al. (2015) model an industrial-scale cone with non-spherical
  (super-quadric) particles whose progeny are sized by the **JKMRC drop-weight t10** ([doi:10.1016/j.mineng.2015.01.013](https://doi.org/10.1016/j.mineng.2015.01.013)). That last point is the bridge to our PBM: both size breakage progeny with the
  same t10-tn appearance family.
- **Bonded-particle rock.** A rock is a bonded assembly of sub-particles; bonds break under load, so fracture
  emerges from the contact model rather than a replacement rule. Quist and Evertsson (2016) calibrate this to
  single-particle breakage for a cone ([doi:10.1016/j.mineng.2015.11.004](https://doi.org/10.1016/j.mineng.2015.11.004)).

Validation of DEM against physical experiments is itself a research task: Johansson et al. (2017) evaluate cone
performance with DEM against laboratory experiments ([doi:10.1016/j.mineng.2016.09.015](https://doi.org/10.1016/j.mineng.2016.09.015)), the template our LOO
plan mirrors (predict held-out, do not grade only in-sample).

## The fast-prediction frontier

For fast *prediction* (not mechanism), the SOTA is a neural surrogate of a phenomenological model: Koh et al.
(2021) train a DNN to approximate a comminution-circuit model, about 3363x faster, with sub-percent test errors
([doi:10.1016/j.mineng.2021.107026](https://doi.org/10.1016/j.mineng.2021.107026)). Two honest gaps remain in that work, and they are exactly the space
ChancaDEM occupies:

1. it is a surrogate of a *model*, not of *real surveys*, and reports no uncertainty;
2. no DEM/PBM industrial fit in the cited set (Quist 2016; Delaney 2015; Johansson 2017; the HP500 fit Rocha
   2024; the cone fit Duarte 2021) reports a held-out validation, a calibrated uncertainty, or an open
   browser deployment.

## What ChancaDEM is and is not

- **Is:** a population-balance (Whiten classification + breakage) + Evertsson capacity + Bond power model in pure
  TypeScript, sub-millisecond, live in the browser, calibrated to open industrial data (Rocha 2024), validated
  leave-one-survey-out, with calibrated prediction bands.
- **Is not:** a DEM solver. An industrial DEM step is GPU-hours; it does not run client-side. DEM is the frontier
  we cite and compare *trends* against (via the shared t10 appearance), not the engine in the browser.

## Caveats

- DEM results in the literature are for specific machines/ores; their absolute numbers are not transferable to
  the HP500/itabirite case without their own calibration.
- The t10 bridge makes *breakage trends* comparable, not absolute progeny distributions.

## References (DOI-verified)

- Cleary & Sinnott 2015, [doi:10.1016/j.mineng.2014.10.021](https://doi.org/10.1016/j.mineng.2014.10.021)
- Delaney et al. 2015, [doi:10.1016/j.mineng.2015.01.013](https://doi.org/10.1016/j.mineng.2015.01.013)
- Quist & Evertsson 2016, [doi:10.1016/j.mineng.2015.11.004](https://doi.org/10.1016/j.mineng.2015.11.004)
- Johansson et al. 2017, [doi:10.1016/j.mineng.2016.09.015](https://doi.org/10.1016/j.mineng.2016.09.015)
- Koh et al. 2021, [doi:10.1016/j.mineng.2021.107026](https://doi.org/10.1016/j.mineng.2021.107026)
