# Notebooks, English

The index of the English tree. Topics run from simple to complex; inside a topic the reading order is the notebook
number and the level never goes down. The Spanish counterpart of every notebook is at the same path under
[`../es/`](../es/README.md). How to run them is in [`../README.md`](../README.md).

Levels: 1 fundamentals, 2 the method in practice, 3 state of the art, 4 beyond the state of the art.

## Topics

A topic without a level 3 notebook says why on its row.

| Topic | Needs | Level 3 |
|---|---|---|
| [01-getting-started](01-getting-started/) | none, this is the entry topic | No level 3: the topic teaches the engine itself, and the state of the art that the research basis names is the subject of topic 02 |
| [02-threshold-and-final-size](02-threshold-and-final-size/) | topic 01-getting-started | [03-next-generation-matrix-and-final-size-derivation](02-threshold-and-final-size/03-next-generation-matrix-and-final-size-derivation.ipynb) |

## Notebooks

| Notebook | Level | What it teaches |
|---|---|---|
| [01-getting-started/01-the-problem-and-the-data.ipynb](01-getting-started/01-the-problem-and-the-data.ipynb) | 1 | the epidemic problem, the committed index, manifests and traces, the SIR equations, a first run of the pipeline's engine checked against the committed trace |
| [01-getting-started/02-the-method-step-by-step.ipynb](01-getting-started/02-the-method-step-by-step.ipynb) | 2 | one Forward Euler step by hand, R0 = beta / gamma as the threshold, the final-size relation as an oracle, first-order convergence in the step |
| [02-threshold-and-final-size/01-the-threshold.ipynb](02-threshold-and-final-size/01-the-threshold.ipynb) | 1 | R0 and the herd threshold 1 - 1/R0 on the baked cases, and the engine run with part of the population immunised |
| [02-threshold-and-final-size/02-the-final-size.ipynb](02-threshold-and-final-size/02-the-final-size.ipynb) | 2 | solving z = 1 - exp(-R0 z), placing the baked cases on its curve, and a final size that does not depend on the time course |
| [02-threshold-and-final-size/03-next-generation-matrix-and-final-size-derivation.ipynb](02-threshold-and-final-size/03-next-generation-matrix-and-final-size-derivation.ipynb) | 3 | R0 by the next-generation matrix (van den Driessche and Watmough, 2002) and the derivation of the final size (Miller, 2012), compared with level 2 on the same cases |

## Beyond the state of the art

None claimed: the example is a teaching model, so it has no level 4 notebook. A product that claims a component beyond
the state of the art lists it in its SDD and covers it with a level 4 notebook in each language
([`docs/guides/08_notebooks.md`](../../docs/guides/08_notebooks.md)).
