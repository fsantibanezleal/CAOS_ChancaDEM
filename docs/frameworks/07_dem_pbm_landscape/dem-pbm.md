# Method, the DEM landscape (and why ChancaDEM is not a DEM solver)

## What this card is

The reference frontier ChancaDEM positions against, with its sources, and an explicit statement of what the engine is and
is not. The engine is a population balance (PBM) with capacity and power relations, re-run live in the browser; the
discrete element method (DEM) is the mechanism frontier the product cites and does not run.

## The two DEM families for crushers

The state of the art for the mechanism of a cone or gyratory crusher is DEM: flowing, colliding, breaking particles
resolved by contact laws. Two families appear in the literature:

- **Particle replacement.** A particle that reaches a breakage criterion is deleted and replaced by a set of smaller
  progeny. Cleary and Sinnott (2015) develop it for compression crushers
  ([doi:10.1016/j.mineng.2014.10.021](https://doi.org/10.1016/j.mineng.2014.10.021)); Delaney et al. (2015) model an
  industrial-scale cone with non-spherical (super-quadric) particles whose progeny are sized by the JKMRC drop-weight
  $t_{10}$ ([doi:10.1016/j.mineng.2015.01.013](https://doi.org/10.1016/j.mineng.2015.01.013)). That last point is the
  bridge to the PBM: both size breakage progeny with the same $t_{10}$ appearance family (see the
  [breakage card](../11_breakage-function/breakage.md)).
- **Bonded-particle rock.** A rock is a bonded assembly of sub-particles; bonds break under load, so fracture emerges from
  the contact model rather than a replacement rule. Quist and Evertsson (2016) calibrate this to single-particle
  breakage for a cone ([doi:10.1016/j.mineng.2015.11.004](https://doi.org/10.1016/j.mineng.2015.11.004)).

Validation of DEM against physical experiments is itself a research task: Johansson et al. (2017) evaluate cone
performance with DEM against laboratory experiments
([doi:10.1016/j.mineng.2016.09.015](https://doi.org/10.1016/j.mineng.2016.09.015)), the template the leave-one-survey-out
design of [CrusherCal](../08_calibration_validation/calibration-validation.md) mirrors (predict held-out, do not grade
only in sample).

## The fast-prediction frontier

For fast prediction, not mechanism, the state of the art is a neural surrogate of a phenomenological model. Koh et al.
(2021) train a deep network to approximate a comminution-circuit model for faster simulation
([doi:10.1016/j.mineng.2021.107026](https://doi.org/10.1016/j.mineng.2021.107026)). Two gaps remain in the work the
product cites, and they are the space ChancaDEM occupies:

1. it is a surrogate of a model, not of real surveys, and reports no uncertainty;
2. none of the DEM or PBM industrial fits in the cited set (Quist 2016, Delaney 2015, Johansson 2017, the HP500 fit of
   Rocha 2024, the cone fit of Duarte 2021) reports a held-out validation with a calibrated uncertainty and an open
   browser deployment, to the extent the cited papers were read for this claim (UNVERIFIED as an exhaustive literature
   statement; the Methodology page of the app carries the same positioning).

## What ChancaDEM is and is not

- **Is:** a population balance (Whiten classification and breakage) with a reduced Evertsson capacity and Bond power,
  written in Python (canonical) and TypeScript (live port), run in the browser in milliseconds, calibrated on one machine
  to open industrial data (Rocha 2024), validated leave-one-survey-out with predictive bands.
- **Is not:** a DEM solver. The 3D chamber of the workbench (`frontend/src/engine/chamber.ts`) is a kinematic view of
  the liner geometry, its motion and the engine's gradation, not a particle simulation. The product's earlier
  work-in-progress 2-D DEM tracer was removed in release 0.10.000 and is a backlog item, not a method of this release.
  Industrial DEM with breakage needs hours per second of operation and runs offline.

## Caveats

- DEM results in the literature are for specific machines and ores; their absolute numbers do not transfer to the HP500
  itabirite case without their own calibration.
- The $t_{10}$ bridge makes breakage trends comparable, not absolute progeny distributions.

## References

- Cleary and Sinnott 2015, [doi:10.1016/j.mineng.2014.10.021](https://doi.org/10.1016/j.mineng.2014.10.021)
- Delaney et al. 2015, [doi:10.1016/j.mineng.2015.01.013](https://doi.org/10.1016/j.mineng.2015.01.013)
- Quist and Evertsson 2016, [doi:10.1016/j.mineng.2015.11.004](https://doi.org/10.1016/j.mineng.2015.11.004)
- Johansson et al. 2017, [doi:10.1016/j.mineng.2016.09.015](https://doi.org/10.1016/j.mineng.2016.09.015)
- Koh et al. 2021, [doi:10.1016/j.mineng.2021.107026](https://doi.org/10.1016/j.mineng.2021.107026)
