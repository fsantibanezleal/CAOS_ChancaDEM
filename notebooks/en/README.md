# Notebooks, English

The index of the English tree. Topics run from simple to complex; inside a topic the reading order is the notebook
number and the level never goes down. The Spanish counterpart of every notebook is at the same path under
[`../es/`](../es/README.md). How to run them is in [`../README.md`](../README.md).

Levels: 1 fundamentals, 2 the method in practice, 3 comparison with published methods, 4 the product's proposed methods.

Every notebook answers one question of the product's problem, runs the product's own pipeline on its committed data, and
reads its figures in the text that follows them. ChancaDEM publishes no package: the notebooks import the engine, the
oracles, the HP500 lane and the model bundles from `data-pipeline/pipeline/` by path and never define a method of their own.

## Topics

A topic without a level 3 notebook says why on its row.

| Topic | Needs | Level 3 |
|---|---|---|
| [01-getting-started](01-getting-started/) | none, this is the entry topic | No level 3: the topic teaches the engine's inputs and the case matrix, and the published methods that the research basis names are the subject of topics 03 and 07 |
| [02-size-distributions](02-size-distributions/) | topic 01-getting-started | No level 3: the Rosin-Rammler law and the sieve interpolation are textbook methods, and the research basis names no rival to them |
| [03-breakage-and-classification](03-breakage-and-classification/) | topic 02-size-distributions | No level 3: the published method for the chamber is discrete-element simulation, which is not a method of this release (SDD, section Method ladder), and the repository holds neither a discrete-element code nor its data to run; the level 2 notebook 03 shows the balance as the expectation of the particle-replacement rule those models use |
| [04-capacity-and-power](04-capacity-and-power/) | topic 03-breakage-and-classification | No level 3: the dossiers name Morrell's size-specific energy as the alternative to Bond, but its source is outside the SDD's research basis and the product runs no implementation of it |
| [05-real-surveys](05-real-surveys/) | topics 01-getting-started and 04-capacity-and-power | No level 3: the in-sample fit of the source paper is the published method that CrusherCal is compared with, which topic 06 teaches, and the calibrated engine of this topic has no other rival in the research basis; it is run as level 3 of topic 06 |
| [06-crushercal](06-crushercal/) | topic 05-real-surveys | [03-the-in-sample-fit-of-the-paper](06-crushercal/03-the-in-sample-fit-of-the-paper.ipynb), [04-held-out-validation-of-the-calibrated-model](06-crushercal/04-held-out-validation-of-the-calibrated-model.ipynb) |
| [07-learned-models](07-learned-models/) | topics 01-getting-started and 05-real-surveys | [03-the-surrogate-against-the-plant](07-learned-models/03-the-surrogate-against-the-plant.ipynb) |

## Notebooks

| Notebook | Level | What it teaches |
|---|---|---|
| [01-getting-started/01-first-run.ipynb](01-getting-started/01-first-run.ipynb) | 1 | an operating point of eight numbers, one engine run on the reference secondary cone S01, the sieve grid, the ten HP500 surveys and the engine at one of them, and the refusals of the engine's envelope gate for a setting past the feed and a survey outside the calibrated range |
| [01-getting-started/02-case-matrix-and-replay.ipynb](01-getting-started/02-case-matrix-and-replay.ipynb) | 2 | the 27 cases by stage and machine, the regimes and refusals of the live engine, the setting variants, the expectation gate, a 15 percent setting variant across all clean cases and a reproduction check against the stored metrics, the setting that a product P80 target needs, and the walk of a gyratory G01 to the setting where the engine refuses |
| [02-size-distributions/01-rosin-rammler-feed.ipynb](02-size-distributions/01-rosin-rammler-feed.ipynb) | 1 | the Rosin-Rammler feed, x63 and m, F80 by interpolation, and why the engine's F80 differs from the textbook one |
| [02-size-distributions/02-grid-interpolation-and-the-oracle.ipynb](02-size-distributions/02-grid-interpolation-and-the-oracle.ipynb) | 2 | the square-root-of-two grid, class masses to a passing curve, the interpolation error against grid fineness and the oracle at x63, with the engine's feed constructor checked against a hand-built feed |
| [03-breakage-and-classification/01-breakage-and-classification-curves.ipynb](03-breakage-and-classification/01-breakage-and-classification-curves.ipynb) | 1 | the energy per nip, the JKMRC t10 relation, the Austin appearance function and the K1, K2, K3 classification curve |
| [03-breakage-and-classification/02-whiten-solve-step-by-step.ipynb](03-breakage-and-classification/02-whiten-solve-step-by-step.ipynb) | 2 | the breakage matrix, the chamber balance, its solution as circulating mass and nip events, the product, and the recirculation against the setting |
| [03-breakage-and-classification/03-population-balance-as-the-expectation-of-replacement.ipynb](03-breakage-and-classification/03-population-balance-as-the-expectation-of-replacement.ipynb) | 2 | the particle-replacement rule of the discrete-element crusher literature (Cleary and Sinnott, Quist and Evertsson), the proof that the Whiten product is its expectation, and the parcels its sampling needs, run with the pipeline's replacement walk on the product's own selection and breakage |
| [04-capacity-and-power/01-capacity-hump-and-nip-geometry.ipynb](04-capacity-and-power/01-capacity-hump-and-nip-geometry.ipynb) | 1 | the Evertsson capacity law and its speed hump, the response of throughput, power and P80 to speed, and the nip angle against the grip limit |
| [04-capacity-and-power/02-setting-throw-and-the-bond-oracle.ipynb](04-capacity-and-power/02-setting-throw-and-the-bond-oracle.ipynb) | 2 | Bond's law and its closed-form oracle, the setting and the throw as two levers, and the best combination for a required P80 |
| [05-real-surveys/01-the-ten-surveys-and-the-calibrated-engine.ipynb](05-real-surveys/01-the-ten-surveys-and-the-calibrated-engine.ipynb) | 1 | the ten HP500 surveys, what the calibrated lane takes from them, the engine's throughput at each, what it does with the f80 and the support of the calibration |
| [05-real-surveys/02-measured-against-modelled.ipynb](05-real-surveys/02-measured-against-modelled.ipynb) | 2 | the expectation gate of the real cases, the throughput residuals, the power that does not follow the plant, what calibrating changes and the specific energy, scored with R squared and MAPE against a constant-at-the-mean yardstick |
| [06-crushercal/01-holding-a-survey-out.ipynb](06-crushercal/01-holding-a-survey-out.ipynb) | 1 | the leave-one-survey-out fold, the refitted capacity base, the held-out throughput of the calibrated model against the mean of the other nine, and the free-form regression held out beside them |
| [06-crushercal/02-held-out-models-and-the-controls.ipynb](06-crushercal/02-held-out-models-and-the-controls.ipynb) | 2 | the four models held out on both targets, the constant-mean baseline, the bounded residual followed through its clip as a pre-registered null, and the label-shuffle control over 200 seeds, which tests the residual and not the skill of the model |
| [06-crushercal/03-the-in-sample-fit-of-the-paper.ipynb](06-crushercal/03-the-in-sample-fit-of-the-paper.ipynb) | 3 | the source paper's in-sample protocol run with the CrusherCal functions and set beside the held-out protocol on the same ten surveys: the models fitted on all ten rows, a power coefficient of the wrong sign, and the optimism per model and target |
| [06-crushercal/04-held-out-validation-of-the-calibrated-model.ipynb](06-crushercal/04-held-out-validation-of-the-calibrated-model.ipynb) | 3 | the held-out validation of the calibrated model against the in-sample protocol of the paper: two conclusions of the in-sample fit reversed, the skill over all 120 subsets of seven surveys, and the 80 percent predictive band measured in sample and nested out of sample |
| [07-learned-models/01-the-surrogate-against-the-engine.ipynb](07-learned-models/01-the-surrogate-against-the-engine.ipynb) | 1 | the released surrogate through onnxruntime: bundle validation, encoding, decoding, the error per output, the sweep and the labelled baseline answer |
| [07-learned-models/02-held-out-draw-and-the-anomaly-guard.ipynb](07-learned-models/02-held-out-draw-and-the-anomaly-guard.ipynb) | 2 | the independent held-out draw, R squared and MAPE per output, the 8-bit graph, monotonicity, and the autoencoder against the envelope gate on planted points |
| [07-learned-models/03-the-surrogate-against-the-plant.ipynb](07-learned-models/03-the-surrogate-against-the-plant.ipynb) | 3 | the learned-surrogate approach against the plant: the surrogate at the ten surveys, its extrapolation outside the training range, the autoencoder's blindness to it on the uncalibrated sweep, and what its alarms at the surveys respond to |
