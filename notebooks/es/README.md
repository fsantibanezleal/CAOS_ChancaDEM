# Notebooks, español

El índice del árbol en español. Los temas van de lo simple a lo complejo; dentro de un tema el orden de lectura es el
número del notebook y el nivel nunca baja. La contraparte en inglés de cada notebook está en la misma ruta bajo
[`../en/`](../en/README.md). Cómo correrlos está en [`../README.md`](../README.md).

Niveles: 1 fundamentos, 2 el método en la práctica, 3 estado del arte, 4 más allá del estado del arte.

Cada notebook responde una pregunta del problema del producto, corre el pipeline propio del producto sobre sus datos
versionados, y lee sus figuras en el texto que las sigue. ChancaDEM no publica un paquete: los notebooks importan el motor,
los oráculos, la vía HP500 y los paquetes de modelos desde `data-pipeline/pipeline/` por su ruta y nunca definen un método
propio.

## Temas

Un tema sin un notebook de nivel 3 dice por qué en su fila.

| Tema | Requiere | Nivel 3 |
|---|---|---|
| [01-getting-started](01-getting-started/) | ninguno, es el tema de entrada | Sin nivel 3: el tema enseña las entradas del motor y la matriz de casos, y el estado del arte que nombra la base de investigación es el asunto de los temas 03 y 07 |
| [02-size-distributions](02-size-distributions/) | tema 01-getting-started | Sin nivel 3: la ley de Rosin-Rammler y la interpolación de tamices son métodos de texto, y la base de investigación no nombra un rival para ellos |
| [03-breakage-and-classification](03-breakage-and-classification/) | tema 02-size-distributions | Sin nivel 3: el estado del arte de la cámara es la simulación de elementos discretos, que no es un método de este lanzamiento (SDD, sección Method ladder), y el repositorio no tiene ni un código de elementos discretos ni sus datos para ejecutar; el notebook 03, de nivel 2, muestra el balance como la esperanza de la regla de reemplazo de partículas que usan esos modelos |
| [04-capacity-and-power](04-capacity-and-power/) | tema 03-breakage-and-classification | Sin nivel 3: los dossiers nombran la energía específica por tamaño de Morrell como alternativa a Bond, pero su fuente queda fuera de la base de investigación del SDD y el producto no corre ninguna implementación de ella |
| [05-real-surveys](05-real-surveys/) | temas 01-getting-started y 04-capacity-and-power | [03-the-in-sample-fit-of-the-paper](05-real-surveys/03-the-in-sample-fit-of-the-paper.ipynb) |
| [06-crushercal](06-crushercal/) | tema 05-real-surveys | Sin nivel 3: el estado del arte que correría, el ajuste dentro de la muestra del artículo, es el nivel 3 del tema 05, y el notebook de nivel 4 de aquí lo contrasta con el protocolo de datos retenidos |
| [07-learned-models](07-learned-models/) | temas 01-getting-started y 05-real-surveys | [03-the-surrogate-against-the-plant](07-learned-models/03-the-surrogate-against-the-plant.ipynb) |

## Notebooks

| Notebook | Nivel | Qué enseña |
|---|---|---|
| [01-getting-started/01-first-run.ipynb](01-getting-started/01-first-run.ipynb) | 1 | un punto de operación de ocho números, una ejecución del motor en el cono secundario de referencia S01, la malla de tamices, los diez muestreos del HP500 y el motor en uno de ellos |
| [01-getting-started/02-case-matrix-and-replay.ipynb](01-getting-started/02-case-matrix-and-replay.ipynb) | 2 | los 27 casos por etapa y máquina, los regímenes y las negativas del motor vivo, las variantes de la abertura, el filtro de expectativas, una variante de 15 por ciento de la abertura en todos los casos limpios y una comprobación de reproducción frente a las métricas almacenadas |
| [02-size-distributions/01-rosin-rammler-feed.ipynb](02-size-distributions/01-rosin-rammler-feed.ipynb) | 1 | la alimentación de Rosin-Rammler, x63 y m, el F80 por interpolación, y por qué el F80 del motor difiere del de los textos |
| [02-size-distributions/02-grid-interpolation-and-the-oracle.ipynb](02-size-distributions/02-grid-interpolation-and-the-oracle.ipynb) | 2 | la malla de raíz de dos, de masas de clase a una curva de pasante, el error de interpolación frente a la finura de la malla y el oráculo en x63 |
| [03-breakage-and-classification/01-breakage-and-classification-curves.ipynb](03-breakage-and-classification/01-breakage-and-classification-curves.ipynb) | 1 | la energía por apriete, la relación t10 de JKMRC, la función de aparición de Austin y la curva de clasificación K1, K2, K3 |
| [03-breakage-and-classification/02-whiten-solve-step-by-step.ipynb](03-breakage-and-classification/02-whiten-solve-step-by-step.ipynb) | 2 | la matriz de quiebre, el balance de la cámara, su solución como masa circulante y eventos de apriete, el producto, y la recirculación frente a la abertura |
| [03-breakage-and-classification/03-population-balance-as-the-expectation-of-replacement.ipynb](03-breakage-and-classification/03-population-balance-as-the-expectation-of-replacement.ipynb) | 2 | la regla de reemplazo de partículas de la literatura de chancadores de elementos discretos (Cleary y Sinnott, Quist y Evertsson), la demostración de que el producto de Whiten es su esperanza, y las parcelas que pide su muestreo, con la caminata de reemplazo del pipeline sobre la selección y el quiebre propios del producto |
| [04-capacity-and-power/01-capacity-hump-and-nip-geometry.ipynb](04-capacity-and-power/01-capacity-hump-and-nip-geometry.ipynb) | 1 | la ley de capacidad de Evertsson y su joroba de velocidad, la respuesta de capacidad, potencia y P80 a la velocidad, y el ángulo de apriete frente al límite de agarre |
| [04-capacity-and-power/02-setting-throw-and-the-bond-oracle.ipynb](04-capacity-and-power/02-setting-throw-and-the-bond-oracle.ipynb) | 2 | la ley de Bond y su oráculo de forma cerrada, la abertura y la carrera como dos palancas, y la mejor combinación para un P80 requerido |
| [05-real-surveys/01-the-ten-surveys-and-the-calibrated-engine.ipynb](05-real-surveys/01-the-ten-surveys-and-the-calibrated-engine.ipynb) | 1 | los diez muestreos del HP500, qué toma de ellos la vía calibrada, la capacidad del motor en cada uno, qué hace con el f80 y el soporte de la calibración |
| [05-real-surveys/02-measured-against-modelled.ipynb](05-real-surveys/02-measured-against-modelled.ipynb) | 2 | la compuerta de expectativas de los casos reales, los residuos de capacidad, la potencia que no sigue a la planta, qué cambia la calibración y la energía específica |
| [05-real-surveys/03-the-in-sample-fit-of-the-paper.ipynb](05-real-surveys/03-the-in-sample-fit-of-the-paper.ipynb) | 3 | el protocolo dentro de la muestra del artículo fuente corrido con el código CrusherCal: tres modelos juzgados con los muestreos a los que se ajustaron, y un coeficiente de potencia con el signo equivocado |
| [06-crushercal/01-holding-a-survey-out.ipynb](06-crushercal/01-holding-a-survey-out.ipynb) | 1 | el pliegue de dejar un muestreo fuera, la capacidad retenida de la columna vertebral, y el optimismo del juicio dentro de la muestra |
| [06-crushercal/02-strict-against-leaky-and-the-controls.ipynb](06-crushercal/02-strict-against-leaky-and-the-controls.ipynb) | 2 | el optimismo por modelo y objetivo, la línea base de media constante, el control de barajado con 200 semillas y el residuo acotado como un nulo preregistrado |
| [06-crushercal/03-held-out-validation-beyond-the-in-sample-fit.ipynb](06-crushercal/03-held-out-validation-beyond-the-in-sample-fit.ipynb) | 4 | la afirmación BS-1 medida: dos conclusiones del protocolo dentro de la muestra revertidas, robustez sobre subconjuntos aleatorios y la calibración de la banda predictiva de 80 por ciento |
| [07-learned-models/01-the-surrogate-against-the-engine.ipynb](07-learned-models/01-the-surrogate-against-the-engine.ipynb) | 1 | el sustituto publicado con onnxruntime: validación del paquete, codificación, decodificación, el error por salida, la barrida y la respuesta de línea base rotulada |
| [07-learned-models/02-held-out-draw-and-the-anomaly-guard.ipynb](07-learned-models/02-held-out-draw-and-the-anomaly-guard.ipynb) | 2 | la muestra retenida independiente, R cuadrado y MAPE por salida, el grafo de 8 bits, la monotonía, y el autoencoder frente a la compuerta de envolvente con puntos plantados |
| [07-learned-models/03-the-surrogate-against-the-plant.ipynb](07-learned-models/03-the-surrogate-against-the-plant.ipynb) | 3 | el enfoque del sustituto aprendido frente a la planta: el sustituto en los diez muestreos, su extrapolación fuera del rango de entrenamiento y la ceguera del autoencoder ante ella |

## Más allá del estado del arte

El SDD lista una afirmación, BS-1, CrusherCal: validación con datos retenidos de un modelo de chancador calibrado con datos de
muestreos industriales abiertos, con una banda predictiva calibrada y controles preregistrados. Su notebook de nivel 4 es
[06-crushercal/03-held-out-validation-beyond-the-in-sample-fit](06-crushercal/03-held-out-validation-beyond-the-in-sample-fit.ipynb),
que la mide: los números retenidos, los controles, la robustez sobre subconjuntos y la calibración de la banda.
