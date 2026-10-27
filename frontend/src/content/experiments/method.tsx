// The three areas of the Experiments page that say how the answers are judged: the metrics with their real constants, the held-out protocol
// with the shortcut it forbids (a figure), and the datasets with their redistribution class and status (a table). The constants are those
// of data-pipeline/pipeline/hp500/loo.py, of frontend/src/engine/capacity.ts and of this page's own sweep readings (content/experiments/data.ts).
import { Callout, Cite, DocSection, Equation, Figure } from '@fasl-work/caos-app-shell';
import type { ReactNode } from 'react';
import { P, useT } from '../bi';
import { useBundle } from './context';
import { ProtocolFigure } from './figures';

export function Metrics() {
  const t = useT();
  return (
    <DocSection title={{ en: 'The metrics', es: 'Las métricas' }} area="metrics" refs={['rocha2024', 'bond1952']}>
      <P
        en={<>Every error on this page is computed by the four functions of the validation module, <code>_mape</code>, <code>_rmse</code>, <code>_r2</code> and <code>_maxdev</code> of <code>data-pipeline/pipeline/hp500/loo.py</code>, over the ten surveys of the open dataset <Cite id="rocha2024" />, with y the measured value and the hat the prediction. The mean absolute percentage error is the headline, since the targets, throughput and power, are far from zero; the largest deviation names the worst survey; the root mean squared error keeps the unit of the target; and R squared compares the model with predicting the mean, so it is negative when a model does worse than the mean, and the code sets it to zero when all the measured values are equal. The committed document rounds the percentages and the root mean squared error to two decimals and R squared to three.</>}
        es={<>Cada error de esta página lo calculan las cuatro funciones del módulo de validación, <code>_mape</code>, <code>_rmse</code>, <code>_r2</code> y <code>_maxdev</code> de <code>data-pipeline/pipeline/hp500/loo.py</code>, sobre los diez muestreos del conjunto de datos abierto <Cite id="rocha2024" />, con y el valor medido y el acento circunflejo la predicción. El error porcentual absoluto medio es el titular, pues los objetivos, capacidad y potencia, están lejos de cero; la mayor desviación nombra al peor muestreo; la raíz del error cuadrático medio conserva la unidad del objetivo; y R cuadrado compara el modelo con predecir la media, de modo que es negativo cuando un modelo lo hace peor que la media, y el código lo fija en cero cuando todos los valores medidos son iguales. El documento comprometido redondea los porcentajes y la raíz del error cuadrático medio a dos decimales y R cuadrado a tres.</>}
      />
      <Equation
        tex={String.raw`\mathrm{MAPE} = \frac{100}{n}\sum_{i=1}^{n}\left|\frac{\hat y_i - y_i}{y_i}\right|, \qquad \mathrm{MaxDev} = 100\,\max_{i}\left|\frac{\hat y_i - y_i}{y_i}\right|`}
        caption={t(
          'The mean absolute percentage error and the largest deviation, both in percent: y_i is the measured value of survey i (t/h or kW), the hat y_i is the prediction for it, and n is the number of surveys (ten).',
          'El error porcentual absoluto medio y la mayor desviación, ambos en por ciento: y_i es el valor medido del muestreo i (t/h o kW), la y con acento es la predicción para él, y n es el número de muestreos (diez).',
        )}
      />
      <Equation
        tex={String.raw`\mathrm{RMSE} = \sqrt{\frac{1}{n}\sum_{i=1}^{n}\left(\hat y_i - y_i\right)^2}, \qquad R^2 = 1 - \frac{\sum_{i}\left(y_i - \hat y_i\right)^2}{\sum_{i}\left(y_i - \bar y\right)^2}`}
        caption={t(
          'The root mean squared error, in the unit of the target, and the coefficient of determination, dimensionless: the bar y is the mean of the measured values, and the code returns zero for R squared when the denominator is zero.',
          'La raíz del error cuadrático medio, en la unidad del objetivo, y el coeficiente de determinación, sin dimensión: la y con barra es la media de los valores medidos, y el código entrega cero para R cuadrado cuando el denominador es cero.',
        )}
      />
      <P
        en="The predictive band is built from the strict held-out residuals of the backbone. The half-width is a factor times the sample standard deviation of those ten residuals, with n minus 1 degrees of freedom, and the factor is 1.2816, the two-sided 80 percent quantile of the normal law as the code writes it (the variable k80 in loo.py). The empirical coverage is the share of the surveys whose residual is inside the half-width, to be compared with the nominal 0.80; it is an in-sample figure, because the spread that sets the half-width comes from the very residuals it is checked against. The nested coverage is its out-of-sample counterpart: for each survey the spread is taken from the held-out residuals of the other nine only, and the survey counts as covered when its own residual is inside 1.2816 times that spread. With ten surveys either coverage can only be a multiple of 0.1, so one survey moves it by that much, and the band is a normal approximation from a small sample. The relative width reported with it is the half-width over the mean of the measured values."
        es="La banda predictiva se construye con los residuos retenidos estrictos del esqueleto. La semianchura es un factor por la desviación estándar muestral de esos diez residuos, con n menos 1 grados de libertad, y el factor es 1,2816, el cuantil bilateral del 80 por ciento de la ley normal tal como lo escribe el código (la variable k80 en loo.py). La cobertura empírica es la fracción de los muestreos cuyo residuo está dentro de la semianchura, para compararla con el 0,80 nominal; es una cifra dentro de la muestra, porque la dispersión que fija la semianchura sale de los mismos residuos contra los que se verifica. La cobertura anidada es su contraparte fuera de la muestra: para cada muestreo la dispersión se toma solo de los residuos retenidos de los otros nueve, y el muestreo cuenta como cubierto cuando su propio residuo está dentro de 1,2816 veces esa dispersión. Con diez muestreos cualquiera de las dos coberturas solo puede ser un múltiplo de 0,1, así que un muestreo la mueve en esa cantidad, y la banda es una aproximación normal a partir de una muestra pequeña. El ancho relativo que se informa con ella es la semianchura sobre la media de los valores medidos."
      />
      <Equation
        tex={String.raw`r_i = y_i - \hat y_i^{(-i)}, \qquad h = 1.2816\,\sigma_r, \qquad \sigma_r = \sqrt{\frac{1}{n-1}\sum_{i}\left(r_i - \bar r\right)^2}, \qquad c = \frac{1}{n}\,\#\left\{ i : \lvert r_i \rvert \le h \right\}`}
        caption={t(
          'The 80 percent predictive interval and its coverage: the hat y_i with the exponent (-i) is the prediction for survey i by the model fitted without it, r_i the held-out residual, the bar r its mean, sigma_r the sample standard deviation, h the half-width of the band, in the unit of the target, and c the empirical coverage, in sample because sigma_r comes from the same residuals, to be read against 0.80.',
          'El intervalo predictivo del 80 por ciento y su cobertura: la y con acento y exponente (-i) es la predicción del muestreo i por el modelo ajustado sin él, r_i el residuo retenido, la r con barra su media, sigma_r la desviación estándar muestral, h la semianchura de la banda, en la unidad del objetivo, y c la cobertura empírica, dentro de la muestra porque sigma_r sale de los mismos residuos, para leer frente a 0,80.',
        )}
      />
      <P
        en="On the synthetic secondary-cone cases of the App the same document gives a band, but of a different kind and labelled as such: at least the relative half-width of this band for the target shown (the held-out error of the same model family once calibrated on the ten surveys), because an uncalibrated case cannot be more accurate. It is a lower bound, not a band of the case. The other machine types have no measured data, so they show no band and say why."
        es="En los casos sintéticos de cono secundario de la App el mismo documento da una banda, pero de otra clase y rotulada como tal: al menos la semianchura relativa de esta banda para la magnitud que se muestra (el error reservado de la misma familia de modelos una vez calibrada con los diez muestreos), porque un caso sin calibrar no puede ser más preciso. Es una cota inferior, no una banda del caso. Los demás tipos de máquina no tienen datos medidos, así que no muestran banda y dicen por qué."
      />
      <Equation
        tex={String.raw`\hat q_i = Q_T^{(-i)}\, s_i, \quad Q_T^{(-i)} = \frac{\sum_{k \ne i} s_k\, m_k}{\sum_{k \ne i} s_k^{2}}, \qquad P_d = 10\,W_i\left(\frac{1}{\sqrt{P_{80}}} - \frac{1}{\sqrt{F_{80}}}\right) Q, \qquad P_c = \zeta\,P_d + P_n`}
        caption={t(
          'The two backbones that are scored: s_k is the capacity factor of the engine for survey k, the capacity of the engine over its base of 647 t/h (HP500_QREF in capacity.ts), m_k the measured throughput, Q_T the base refitted without survey i; P_d is the Bond draw, with W_i the work index in kWh/t, the sizes in micrometres and Q the throughput in t/h, and P_c the power in kW, with zeta 1.30 and the no-load power P_n of 110 kW in the engine (calibratedPower in capacity.ts), or refitted by least squares in the held-out fold.',
          'Los dos esqueletos que se evalúan: s_k es el factor de capacidad del motor para el muestreo k, la capacidad del motor sobre su base de 647 t/h (HP500_QREF en capacity.ts), m_k la capacidad medida, Q_T la base reajustada sin el muestreo i; P_d es el consumo de Bond, con W_i el índice de trabajo en kWh/t, los tamaños en micrómetros y Q la capacidad en t/h, y P_c la potencia en kW, con zeta 1,30 y la potencia en vacío P_n de 110 kW en el motor (calibratedPower en capacity.ts), o reajustadas por mínimos cuadrados en el pliegue retenido.',
        )}
      />
      <P
        en="The experiments on the sweeps use two readings of their own, computed in the page from the committed traces and not by the validation module. The elasticity of a response with respect to the setting is the least-squares slope of the logarithm of the response on the logarithm of the setting over the whole sweep, dimensionless. The apex of a speed sweep is the vertex of the parabola through its highest sample and the two neighbouring ones, and a case runs past its optimum when its speed is more than 1 percent above the apex. A table of these numbers sits above each chart, and the page tests them against the committed artifacts."
        es="Los experimentos sobre los barridos usan dos lecturas propias, calculadas en la página a partir de las trazas comprometidas y no por el módulo de validación. La elasticidad de una respuesta respecto de la abertura es la pendiente de mínimos cuadrados del logaritmo de la respuesta sobre el logaritmo de la abertura en todo el barrido, sin dimensión. El ápice de un barrido de velocidad es el vértice de la parábola por su muestra más alta y las dos vecinas, y un caso opera pasado de su óptimo cuando su velocidad está más de 1 por ciento sobre el ápice. Una tabla con estos números va sobre cada gráfico, y la página los prueba contra los artefactos comprometidos."
      />
      <Equation
        tex={String.raw`\varepsilon = \frac{\sum_j \left(\ln x_j - \overline{\ln x}\right)\left(\ln y_j - \overline{\ln y}\right)}{\sum_j \left(\ln x_j - \overline{\ln x}\right)^2}, \qquad \frac{n_{\mathrm{case}}}{n_{\mathrm{apex}}} > 1.01`}
        caption={t(
          'The elasticity of the response y (P80 or throughput) with respect to the setting x over the points j of the sweep, dimensionless, and the criterion for a case past its optimum: n_case is the speed of the case and n_apex the vertex of the speed sweep, both in rpm, and 1.01 is the 1 percent tolerance of the page (PAST_TOLERANCE in content/experiments/data.ts).',
          'La elasticidad de la respuesta y (P80 o capacidad) respecto de la abertura x sobre los puntos j del barrido, sin dimensión, y el criterio de un caso pasado de su óptimo: n_case es la velocidad del caso y n_apex el vértice del barrido de velocidad, ambos en rpm, y 1,01 es la tolerancia de 1 por ciento de la página (PAST_TOLERANCE en content/experiments/data.ts).',
        )}
      />
    </DocSection>
  );
}

export function Protocol() {
  const t = useT();
  return (
    <DocSection title={{ en: 'The protocol', es: 'El protocolo' }} area="protocol" noRefsReason={{ en: 'Describes the protocol of this build.', es: 'Describe el protocolo de esta compilación.' }}>
      <P
        en="Two protocols hold the held-out line of this product, and the figure shows each beside the shortcut it forbids. The validation of the calibrated engine is a strict leave-one-survey-out fold: each of the ten surveys is predicted by a model whose every scalar was refitted on the other nine, and the models are scored only on that prediction. The learned models are trained on one Latin-hypercube sweep of the operating space (seed 12345, 1400 points per machine, in stages/train.py) and scored on a second, independent draw (seed 67890, 480 points per machine, in stages/evaluate.py), never on a split of the rows of the training draw. The held-out draw never enters the fit, the standardisation or the choice of the threshold, so a number reported on it is leakage-safe and repeatable."
        es="Dos protocolos sostienen la línea de datos reservados de este producto, y la figura muestra cada uno junto al atajo que prohíbe. La validación del motor calibrado es un pliegue estricto que deja un muestreo fuera: cada uno de los diez muestreos se predice con un modelo cuyos escalares se reajustaron todos con los otros nueve, y los modelos se evalúan solo en esa predicción. Los modelos aprendidos se entrenan con un barrido de hipercubo latino del espacio de operación (semilla 12345, 1400 puntos por máquina, en stages/train.py) y se evalúan en un segundo sorteo independiente (semilla 67890, 480 puntos por máquina, en stages/evaluate.py), nunca en una partición de las filas del sorteo de entrenamiento. El sorteo reservado nunca entra al ajuste, a la estandarización ni a la elección del umbral, de modo que un número informado sobre él no tiene fuga y es repetible."
      />
      <Figure caption={t('The two held-out protocols, each beside the anti-pattern it forbids: fitting on the ten surveys and scoring on the same ten, and splitting the rows of one sweep, whose stratified design leaks into the test.', 'Los dos protocolos con datos reservados, cada uno junto al antipatrón que prohíbe: ajustar con los diez muestreos y evaluar en los mismos diez, y partir por filas un solo barrido, cuyo diseño estratificado se filtra a la prueba.')}>
        <ProtocolFigure />
      </Figure>
      <P
        en="Why the row split is forbidden. The training draw is a stratified Latin-hypercube design, and a random split of its rows would leak that design into the test: the test points would belong to the same stratification as the training points, so the score would measure how well the model reproduces its own design and not how it generalises. A second draw with another seed is independent of the training design, which is the property that a held-out score needs. For the surveys the argument is the same with n equal to ten: a model with free parameters reads better on the rows it was fitted on, and the gap between the leaky and the strict fold, which the Experiments report for every model, is the optimism of the shortcut."
        es="Por qué se prohíbe la partición por filas. El sorteo de entrenamiento es un diseño estratificado de hipercubo latino, y una partición aleatoria de sus filas filtraría ese diseño a la prueba: los puntos de prueba pertenecerían a la misma estratificación que los de entrenamiento, así que la nota mediría cuán bien el modelo reproduce su propio diseño y no cuánto generaliza. Un segundo sorteo con otra semilla es independiente del diseño de entrenamiento, que es la propiedad que necesita una nota con datos reservados. Para los muestreos el argumento es el mismo con n igual a diez: un modelo con parámetros libres se ve mejor en las filas con que se ajustó, y la brecha entre el pliegue con fuga y el estricto, que los Experimentos informan para cada modelo, es el optimismo del atajo."
      />
      <Callout variant="honest" title={t('The forbidden shortcut', 'El atajo prohibido')}>
        {t(
          'Scoring a model on the rows it was fitted on gives a flattering error that means nothing: a free-form fit with a few coefficients can match ten points. Only the held-out numbers are reported as results; the leaky fold is shown beside the strict one only to make the optimism visible.',
          'Evaluar un modelo en las filas con que se ajustó da un error halagador que no significa nada: un ajuste libre con pocos coeficientes puede igualar diez puntos. Solo los números con datos reservados se informan como resultados; el pliegue con fuga se muestra junto al estricto solo para hacer visible el optimismo.',
        )}
      </Callout>
    </DocSection>
  );
}

/** A count read from the loaded cases, or null while they load: the table states the figure only when the artifact gives it. */
function useCounts(): { real: number; synthetic: number } | null {
  const b = useBundle();
  if (b.state !== 'ready') return null;
  const all = b.data.cases.map((c) => c.manifest.real_or_synthetic);
  return { real: all.filter((x) => x === 'real').length, synthetic: all.filter((x) => x === 'synthetic').length };
}

export function Datasets() {
  const t = useT();
  const n = useCounts();
  const live = t('live', 'en vivo');
  const roadmap = t('roadmap', 'hoja de ruta');
  const rows: { name: string; origin: string; redistribution: ReactNode; status: string }[] = [
    {
      name: n ? t(`The ${n.real} HP500 surveys`, `Los ${n.real} muestreos HP500`) : t('The HP500 surveys', 'Los muestreos HP500'),
      origin: t('Rocha et al. 2024, Table A1: Metso HP500 secondary cone at Minas Rio, itabirite iron ore', 'Rocha et al. 2024, Tabla A1: cono secundario Metso HP500 de Minas Rio, mineral de hierro itabirita'),
      redistribution: <><span translate="no">CC BY 4.0</span>{t(', redistributed with attribution; the derived documents carry the same licence', ', redistribuido con atribución; los documentos derivados llevan la misma licencia')}</>,
      status: live,
    },
    {
      name: n ? t(`The ${n.synthetic} authored synthetic cases`, `Los ${n.synthetic} casos sintéticos de autoría propia`) : t('The authored synthetic cases', 'Los casos sintéticos de autoría propia'),
      origin: t('Written by the product: parameters of the registry, run by the canonical engine', 'Escritos por el producto: parámetros del registro, corridos por el motor canónico'),
      redistribution: t('MIT, the product’s own work', 'MIT, trabajo propio del producto'),
      status: live,
    },
    {
      name: t('The Latin-hypercube sweeps of the engine', 'Los barridos de hipercubo latino del motor'),
      origin: t('Drawn by the pipeline from fixed seeds to train and to score the two models', 'Sorteados por el pipeline desde semillas fijas para entrenar y evaluar los dos modelos'),
      redistribution: t('MIT, the product’s own work; regenerable, not committed', 'MIT, trabajo propio del producto; regenerable, no comprometido'),
      status: live,
    },
    {
      name: t('Industrial cone data of two mines', 'Datos industriales de conos de dos minas'),
      origin: t('Duarte et al. 2021, Minerals 11(11), 1256: calibration and validation of a cone crusher model', 'Duarte et al. 2021, Minerals 11(11), 1256: calibración y validación de un modelo de chancador de cono'),
      redistribution: <><span translate="no">CC BY 4.0</span>{t(', open access; nothing of it is redistributed in this release', ', acceso abierto; nada de ello se redistribuye en esta versión')}</>,
      status: roadmap,
    },
  ];
  return (
    <DocSection title={{ en: 'The datasets', es: 'Los conjuntos de datos' }} area="datasets" refs={['rocha2024', 'duarte2021']}>
      <P
        en={<>Two kinds of data stand behind the experiments. The measured data are the ten surveys of an industrial HP500 secondary cone <Cite id="rocha2024" />, which the product redistributes with attribution under the licence of the paper; everything else is the product&apos;s own, written by it or drawn by its pipeline from fixed seeds. A second published source of industrial cone data <Cite id="duarte2021" /> is the calibration anchor named by the case CK1, and it is a roadmap item: its fit is not executed in this release, so the case reads its ranges from the crushing relation of the setting and not from that data, and the surveys above are the real check of the absolute numbers.</>}
        es={<>Dos clases de datos sostienen los experimentos. Los datos medidos son los diez muestreos de un cono secundario industrial HP500 <Cite id="rocha2024" />, que el producto redistribuye con atribución bajo la licencia del artículo; todo lo demás es propio del producto, escrito por él o sorteado por su pipeline desde semillas fijas. Una segunda fuente publicada de datos industriales de conos <Cite id="duarte2021" /> es el ancla de calibración que nombra el caso CK1, y es un elemento de la hoja de ruta: su ajuste no se ejecuta en esta versión, así que el caso toma sus rangos de la relación de chancado con la abertura y no de esos datos, y los muestreos de arriba son la verificación real de los números absolutos.</>}
      />
      <table className="caos-table" data-state="ready">
        <caption>{t('The datasets of the experiments, their origin, their redistribution class and their status in this release.', 'Los conjuntos de datos de los experimentos, su origen, su clase de redistribución y su estado en esta versión.')}</caption>
        <thead>
          <tr>
            <th>{t('Data', 'Datos')}</th>
            <th className="caos-col-text">{t('Origin', 'Origen')}</th>
            <th className="caos-col-text">{t('Redistribution', 'Redistribución')}</th>
            <th>{t('Status', 'Estado')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="caos-col-text">{r.name}</td>
              <td className="caos-col-text">{r.origin}</td>
              <td className="caos-col-text">{r.redistribution}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DocSection>
  );
}
