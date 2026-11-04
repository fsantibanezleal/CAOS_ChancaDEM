# Notebooks / Notebooks

The didactic layer of ChancaDEM: the notebooks in English and their Spanish mirror, in eight topics, that teach how the
crusher model works, step by step and on the product's own committed data. Each one answers a question of the product's
problem, runs the product's pipeline, and reads its figures. They import the product's methods and never define one: the
engine, the oracles, the HP500 lane and the model bundles live in `data-pipeline/pipeline/`, which the notebooks import by
path because the product publishes no package. The rule is CAOS_MANAGE `conventions/product-notebooks.md`, carried by the
template (guide: [`docs/guides/08_notebooks.md`](../docs/guides/08_notebooks.md)).

La capa didáctica de ChancaDEM: los notebooks en inglés y su espejo en español, en ocho temas, que enseñan cómo funciona el
modelo del chancador, paso a paso y con los datos versionados del propio producto. Cada uno responde una pregunta del
problema del producto, corre el pipeline del producto y lee sus figuras. Importan los métodos del producto y nunca definen
uno: el motor, los oráculos, la vía HP500 y los paquetes de modelos viven en `data-pipeline/pipeline/`, que los notebooks
importan por su ruta porque el producto no publica un paquete.

## The two trees / Los dos árboles

| Language | Index | Folder |
|---|---|---|
| English | [en/README.md](en/README.md) | [en/](en/) |
| Español | [es/README.md](es/README.md) | [es/](es/) |

The two trees hold the same notebooks at the same relative paths (the slugs are English, so the mirror is checkable); each
notebook is written wholly in its tree's language. Topics run from simple to complex and notebooks inside a topic by level:
1 fundamentals, 2 the method in practice, 3 comparison with published methods, 4 the product's proposed methods.

Los dos árboles tienen los mismos notebooks en las mismas rutas relativas (los nombres están en inglés, así que el espejo
se puede comprobar); cada notebook está escrito entero en el idioma de su árbol.

## The topics / Los temas

| Topic | What it teaches / Qué enseña |
|---|---|
| `01-getting-started` | the operating point, one engine run, the 27 cases and the replay / el punto de operación, una corrida del motor, los 27 casos y la repetición |
| `02-size-distributions` | the Rosin-Rammler feed, the sieve grid, interpolation and the oracle at x63 / la alimentación de Rosin-Rammler, la malla de tamices, la interpolación y el oráculo en x63 |
| `03-breakage-and-classification` | t10, the appearance function, classification, the Whiten solve and the discrete-element literature / t10, la función de aparición, la clasificación, el cálculo de Whiten y la literatura de elementos discretos |
| `04-capacity-and-power` | the capacity hump, the setting and the throw, Bond's law and its oracle, and Morrell's size-specific energy against Bond / la joroba de capacidad, la abertura y la carrera, la ley de Bond y su oráculo, y la energía específica por tamaño de Morrell frente a Bond |
| `05-real-surveys` | the ten HP500 surveys, measured against modelled, and the paper's in-sample fit / los diez muestreos del HP500, medido frente a modelado, y el ajuste dentro de la muestra del artículo |
| `06-crushercal` | leave-one-survey-out validation, the controls and the held-out validation of the calibrated model / la validación dejando un muestreo fuera, los controles y la validación con retención del modelo calibrado |
| `07-learned-models` | the surrogate and the autoencoder through onnxruntime, against the engine and against the plant / el sustituto y el autoencoder con onnxruntime, frente al motor y frente a la planta |
| `08-crusherbayes` | the Bayesian calibration of the engine with a structural discrepancy: priors, the sampler run live on one fold, and the held-out evidence with its kill criterion / la calibración bayesiana del motor con una discrepancia estructural: a priori, el muestreador corrido en vivo sobre un pliegue, y la evidencia con retención con su criterio de descarte |

Every notebook of level 2 and above has a third-level section on where its method changes or breaks and one on using it
on the reader's own data, and every method states its equations (CAOS_MANAGE `conventions/notebook-content-bar.md`).

Todo notebook de nivel 2 o superior tiene una sección de tercer nivel sobre dónde cambia o se quiebra su método y otra
sobre usarlo con los datos propios del lector, y todo método declara sus ecuaciones.

## Coverage of the tool / Cobertura de la herramienta

[`coverage.json`](coverage.json) maps every part of the product to the notebooks that teach it, by paths relative to a
language tree (present in both): the sixteen methods of the SDD's method ladder (each at level 2 or above), the thirteen
contracts of `docs/contracts/catalog.md` and the five stages of `data-pipeline/pipeline/stages/`. `product.json` declares
no method package, so the `packages` map is empty. The ids are internal and never appear in a notebook; the map is checked
by CAOS_MANAGE `tools/notebooks/check_notebook_depth.py`.

[`coverage.json`](coverage.json) asigna cada parte del producto a los notebooks que la enseñan: los dieciséis métodos de la
escala de métodos del SDD, los trece contratos del catálogo y las cinco etapas del pipeline.

## Run them / Correrlos

```bash
./scripts/setup.sh --notebooks             # .venv-notebooks from notebooks/requirements.txt (setup.ps1 -Notebooks on Windows)
python scripts/run_notebooks.py            # executes every notebook top to bottom in a fresh kernel and writes the outputs in place
python scripts/run_notebooks.py --check --tmp <temp root>   # executes copies under the temp root, writes nothing else, fails on any error or stale output
                                                            # (CAOS_TEMP_ROOT=<temp root> works too; with neither it stops with exit 2; a local release gate, never CI)
python scripts/check_notebooks.py          # the static check: layout, mirror, levels, anatomy, metadata, clean, pins (CI and local)
python scripts/check_notebooks.py --pypi   # also reads PyPI for the pin of each method package (opt-in, needs the network, never CI)
```

The longest notebook is the live CrusherBayes notebook of topic 08 (`08-crusherbayes/02`), which samples one fold and the
all-surveys posterior with short chains: about four and a half minutes per language measured on 2026-11-04, with its fold cell
taking about three minutes on its own, and longer on a loaded machine, where the runner's per-cell timeout of 600 seconds can be
reached. The held-out draw of topic 07 labels 2400 operating points with the Python engine. Every random draw is seeded, so a
second run writes the same bytes.

Only the runner writes a notebook's outputs; the committed notebooks are the runner's output. To read one, open it on
GitHub or in any Jupyter client (select the `.venv-notebooks` kernel to run it).

## The environment / El entorno

`requirements.txt` pins the notebook environment exactly: numpy and matplotlib for every notebook, onnxruntime and
jsonschema for topic 07 (the released models run in onnxruntime, and the pipeline's loader validates their contracts), then the
runtime that executes the notebooks. `product.json` declares `method_packages: []`: the methods are the pipeline's, not a
package's, so there is no package pin to install.

`requirements.txt` fija exactamente el entorno: numpy y matplotlib para todos los notebooks, onnxruntime y jsonschema para el
tema 07, y luego el entorno que ejecuta los notebooks. `product.json` declara `method_packages: []`: los métodos son los del
pipeline, no los de un paquete, así que no hay pin de paquete que instalar.
