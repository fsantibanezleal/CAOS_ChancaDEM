# Cuadernos, español

El índice del árbol en español. Los temas van de lo simple a lo complejo; dentro de un tema el orden de lectura es el
número del cuaderno y el nivel nunca baja. El equivalente en inglés de cada cuaderno está en la misma ruta bajo
[`../en/`](../en/README.md). Cómo correrlos está en [`../README.md`](../README.md).

Niveles: 1 fundamentos, 2 el método en la práctica, 3 estado del arte, 4 más allá del estado del arte.

## Temas

Un tema sin cuaderno de nivel 3 explica por qué en su fila.

| Tema | Requiere | Nivel 3 |
|---|---|---|
| [01-getting-started](01-getting-started/) | ninguno, es el tema de entrada | Sin nivel 3: el tema enseña el motor mismo, y el estado del arte que nombra la base de investigación es el asunto del tema 02 |
| [02-threshold-and-final-size](02-threshold-and-final-size/) | tema 01-getting-started | [03-next-generation-matrix-and-final-size-derivation](02-threshold-and-final-size/03-next-generation-matrix-and-final-size-derivation.ipynb) |

## Cuadernos

| Cuaderno | Nivel | Qué enseña |
|---|---|---|
| [01-getting-started/01-the-problem-and-the-data.ipynb](01-getting-started/01-the-problem-and-the-data.ipynb) | 1 | el problema epidémico, el índice, los manifiestos y las trazas versionados, las ecuaciones SIR, una primera corrida del motor del pipeline contrastada con la traza versionada |
| [01-getting-started/02-the-method-step-by-step.ipynb](01-getting-started/02-the-method-step-by-step.ipynb) | 2 | un paso de Euler hacia adelante a mano, R0 = beta / gamma como umbral, la relación del tamaño final como oráculo, convergencia de primer orden en el paso |
| [02-threshold-and-final-size/01-the-threshold.ipynb](02-threshold-and-final-size/01-the-threshold.ipynb) | 1 | R0 y el umbral de rebaño 1 - 1/R0 en los casos calculados, y el motor corrido con parte de la población inmunizada |
| [02-threshold-and-final-size/02-the-final-size.ipynb](02-threshold-and-final-size/02-the-final-size.ipynb) | 2 | resolver z = 1 - exp(-R0 z), ubicar los casos calculados en su curva, y un tamaño final que no depende del curso temporal |
| [02-threshold-and-final-size/03-next-generation-matrix-and-final-size-derivation.ipynb](02-threshold-and-final-size/03-next-generation-matrix-and-final-size-derivation.ipynb) | 3 | R0 por la matriz de la siguiente generación (van den Driessche y Watmough, 2002) y la derivación del tamaño final (Miller, 2012), comparados con el nivel 2 en los mismos casos |

## Más allá del estado del arte

Nada declarado: el ejemplo es un modelo didáctico, así que no tiene cuaderno de nivel 4. Un producto que declara un
componente más allá del estado del arte lo lista en su SDD y lo cubre con un cuaderno de nivel 4 en cada idioma
([`docs/guides/08_notebooks.md`](../../docs/guides/08_notebooks.md)).
