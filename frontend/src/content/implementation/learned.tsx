// The two engine topics that go beyond the classical core: the two learned models in the browser (their encoding, their
// training sweep and their runtime), and CrusherCal, the leave-one-survey-out validation. Constants are those of the
// training stage, the sweep, the browser runtime and the HP500 modules; the metrics themselves are on the Benchmark page.
import { Callout, Cite, DocSection, Equation, Figure, useFormat } from '@fasl-work/caos-app-shell';
import { P, useT } from '../bi';
import { StepsFigure } from './figures';

// [machine, CSS mm, throw mm, speed rpm, feed x63 mm, feed m, ore A times b], each a [low, high] range: the training envelope of each machine.
type Range = [number, number];
const NAMES: Record<string, [string, string]> = {
  'cone-sec': ['Secondary cone', 'Cono secundario'],
  'cone-tert': ['Tertiary cone', 'Cono terciario'],
  jaw: ['Jaw', 'Mandíbula'],
  'cone-short-head': ['Short-head cone', 'Cono de cabeza corta'],
  gyratory: ['Gyratory', 'Giratoria'],
};
const SWEEP: [string, Range, Range, Range, Range, Range, Range][] = [
  ['cone-sec', [6, 90], [16, 44], [180, 560], [40, 200], [0.7, 2.0], [30, 110]],
  ['cone-tert', [4, 22], [10, 26], [220, 600], [15, 55], [0.9, 2.0], [30, 110]],
  ['jaw', [50, 160], [24, 50], [180, 380], [180, 500], [0.7, 1.6], [35, 110]],
  ['cone-short-head', [4, 16], [10, 22], [380, 600], [15, 45], [0.9, 2.0], [30, 110]],
  ['gyratory', [120, 240], [22, 40], [100, 200], [300, 800], [0.7, 1.4], [30, 110]],
];

export function LearnedModels() {
  const t = useT();
  const f = useFormat();
  const span = ([lo, hi]: Range, decimals: number) => `${f(lo, { decimals })} ${t('to', 'a')} ${f(hi, { decimals })}`;
  return (
    <DocSection title={{ en: 'The surrogate and the autoencoder in the browser', es: 'El sustituto y el autocodificador en el navegador' }} area="engine" refs={['koh2021']}>
      <P
        en={<>Everything that decides what a graph sees or what its answer means comes from its contract and not from the web code: the order of the five machines (secondary cone, tertiary cone, jaw, short-head cone, gyratory) for the one-hot, the order of the six continuous inputs, their means and standard deviations, which outputs are logarithms, the order of the 14 autoencoder features and the threshold. The surrogate is an 11-64-64-32-10 network with GELU activations that emulates the engine: 11 inputs, the one-hot and the standardised setting, throw, speed, feed size, feed uniformity and ore A times b, and 10 outputs, P80, P50, P20, the passing at 1, 4, 8, 16 and 32 mm, the capacity and the power. It is fitted with Adam at 2e-3 and weight decay 1e-5 for 500 full-batch epochs on the mean squared error of the standardised outputs, with the three sizes fitted in log10 <Cite id="koh2021" />.</>}
        es={<>Todo lo que decide qué ve un grafo o qué significa su respuesta viene de su contrato y no del código de la web: el orden de las cinco máquinas (cono secundario, cono terciario, mandíbula, cono de cabeza corta, giratorio) para el one-hot, el orden de las seis entradas continuas, sus medias y desviaciones estándar, qué salidas son logaritmos, el orden de las 14 características del autocodificador y el umbral. El sustituto es una red 11-64-64-32-10 con activaciones GELU que emula el motor: 11 entradas, el one-hot y el ajuste, la carrera, la velocidad, el tamaño y la uniformidad del alimento y el A por b del mineral, estandarizados, y 10 salidas, P80, P50, P20, el pasante a 1, 4, 8, 16 y 32 mm, la capacidad y la potencia. Se ajusta con Adam a 2e-3 y decaimiento de pesos 1e-5 durante 500 épocas de lote completo sobre el error cuadrático medio de las salidas estandarizadas, con los tres tamaños ajustados en log10 <Cite id="koh2021" />.</>}
      />
      <table className="caos-table" data-state="ready">
        <caption>{t('The training envelope of the surrogate: each machine is sampled only over its own realistic ranges, 1400 Latin-hypercube points per machine, so it learns each regime and not a shared rectangle.', 'El rango de entrenamiento del sustituto: cada máquina se muestrea solo sobre sus propios rangos realistas, 1400 puntos de hipercubo latino por máquina, de modo que aprende cada régimen y no un rectángulo común.')}</caption>
        <thead>
          <tr>
            <th>{t('Machine', 'Máquina')}</th>
            <th>{t('CSS (mm)', 'CSS (mm)')}</th>
            <th>{t('Throw (mm)', 'Carrera (mm)')}</th>
            <th>{t('Speed (rpm)', 'Velocidad (rpm)')}</th>
            <th>{t('Feed x63 (mm)', 'x63 del alimento (mm)')}</th>
            <th>{t('Feed m', 'm del alimento')}</th>
            <th>{t('Ore A times b', 'A por b del mineral')}</th>
          </tr>
        </thead>
        <tbody>
          {SWEEP.map(([machine, ...ranges]) => (
            <tr key={machine}>
              <td>{t(NAMES[machine][0], NAMES[machine][1])}</td>
              {ranges.map((r, i) => (
                <td key={i}>{span(r, i === 4 ? 1 : 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <P
        en="The training points come from the canonical Python engine through a Latin-hypercube sweep with the mulberry32 generator, seed 12345, and a second independent draw of 480 points per machine, seed 67890, is held out for the metrics. A draw that the engine marks not valid, or that has a reduction ratio under 1.02 or a P80 that is not finite and positive, is dropped from both. The ore work index is not an input: it is a function of A times b, 8 plus 0.09 times the distance below 120, clamped to 8 to 20 kWh/t, so a case whose work index disagrees with that function is outside what the surrogate saw. The standardisation uses the training draw only. The autoencoder is a 14-16-6-16-14 denoising network trained for 400 epochs on its inputs noised by a Gaussian of standard deviation 0.05, and its threshold is the 99th percentile of its reconstruction error on the training draw, so about one percent of the training points are above it by construction."
        es="Los puntos de entrenamiento salen del motor canónico en Python mediante un barrido de hipercubo latino con el generador mulberry32, semilla 12345, y una segunda muestra independiente de 480 puntos por máquina, semilla 67890, se reserva para las métricas. Un punto que el motor marca como no válido, o que tiene una razón de reducción menor que 1,02 o un P80 no finito y positivo, se descarta de ambas muestras. El índice de trabajo del mineral no es una entrada: es función de A por b, 8 más 0,09 por la distancia bajo 120, acotado entre 8 y 20 kWh/t, así que un caso cuyo índice de trabajo discrepa de esa función queda fuera de lo que vio el sustituto. La estandarización usa solo la muestra de entrenamiento. El autocodificador es una red de eliminación de ruido 14-16-6-16-14 entrenada durante 400 épocas sobre sus entradas con ruido gaussiano de desviación estándar 0,05, y su umbral es el percentil 99 de su error de reconstrucción en la muestra de entrenamiento, de modo que cerca de un uno por ciento de los puntos de entrenamiento queda sobre él por construcción."
      />
      <Equation
        tex={String.raw`x_j = \frac{v_j - \mu_j}{\sigma_j}, \qquad \hat y_k = \begin{cases} 10^{\,y_k \sigma_k + \mu_k} & k \in \{P_{80}, P_{50}, P_{20}\} \\ y_k \sigma_k + \mu_k & \text{otherwise} \end{cases}, \qquad s = \frac{1}{14}\sum_{i=1}^{14}\bigl(x^{r}_i - x_i\bigr)^2 \;>\; \tau_{99}`}
        caption={t('The encoding, the decoding and the anomaly score: v_j is a raw input of the surrogate (mm, rpm or dimensionless) and x_j its standardised value with the training mean mu_j and standard deviation sigma_j, y_k a standardised output of the graph and hat y_k the answer in its unit, x_i the 14 standardised features of an engine result and x^r_i their reconstruction, s the mean squared error, dimensionless, and tau_99 the 99th percentile of the training error that sets the anomaly threshold.', 'La codificación, la decodificación y el puntaje de anomalía: v_j es una entrada cruda del sustituto (mm, rpm o sin dimensión) y x_j su valor estandarizado con la media de entrenamiento mu_j y la desviación estándar sigma_j, y_k una salida estandarizada del grafo y hat y_k la respuesta en su unidad, x_i las 14 características estandarizadas de un resultado del motor y x^r_i su reconstrucción, s el error cuadrático medio, sin dimensión, y tau_99 el percentil 99 del error de entrenamiento que fija el umbral de anomalía.')}
      />
      <Figure caption={t('From a result of the engine to the answer of a learned model; the standardising constants and the graph are read from the contract.', 'Desde un resultado del motor hasta la respuesta de un modelo aprendido; las constantes de estandarización y el grafo se leen del contrato.')}>
        <StepsFigure
          label={t('From the operating point to the learned answer', 'Del punto de operación a la respuesta aprendida')}
          boxes={[
            { title: t('Point', 'Punto'), line: t('engine result', 'resultado del motor') },
            { title: t('Encode', 'Codificar'), line: 'mu, sigma' },
            { title: 'ONNX', line: 'WASM, 1 thread' },
            { title: t('Decode', 'Decodificar'), line: t('10^y or score', '10^y o puntaje') },
            { title: t('View', 'Vista'), line: t('labelled model', 'modelo rotulado') },
          ]}
          arrows={['v', 'x', 'y', 'answer']}
        />
      </Figure>
      <P
        en="The runtime is the wasm-only build of onnxruntime-web 1.27.0, single-threaded because a static host cannot send the headers a threaded build needs, with its binary bundled from the package and served by the site, so the runtime is not asked from a CDN. The graphs, exported with opset 17 and a dynamic batch axis, are fetched with the product version in the address and kept as sessions, and a call to one model waits for the previous call to that model, since the runtime forbids two runs at once on one session. The contract records the size and the sha256 of every graph, an 8-bit quantised copy of the surrogate and the largest difference between the trained module and the exported graph on the held-out draw. When a contract or a graph is absent or fails its digest, the slot is declared in training and the engine answers for the surrogate, and the envelope gate for the autoencoder, each labelled as the baseline. The inverse question, the setting that gives a target P80, is a bisection of the engine over 3 to 200 mm, at most 40 halvings and stopping when the P80 is within 0.001 mm of the target, because the engine is monotone in the setting and exact."
        es="El entorno de ejecución es la compilación solo WASM de onnxruntime-web 1.27.0, de un solo hilo porque un anfitrión estático no puede enviar las cabeceras que exige una compilación con hilos, con su binario empaquetado desde el paquete y servido por el sitio, de modo que el entorno no se pide a una CDN. Los grafos, exportados con opset 17 y un eje de lote dinámico, se piden con la versión del producto en la dirección y se guardan como sesiones, y una llamada a un modelo espera la llamada anterior a ese modelo, pues el entorno prohíbe dos ejecuciones simultáneas en una sesión. El contrato registra el tamaño y el sha256 de cada grafo, una copia cuantizada a 8 bits del sustituto y la mayor diferencia entre el módulo entrenado y el grafo exportado en la muestra retenida. Cuando un contrato o un grafo falta o no cumple su huella, la ranura se declara entrenando y responde el motor por el sustituto, y la compuerta de envolvente por el autocodificador, cada uno rotulado como línea base. La pregunta inversa, el ajuste que da un P80 objetivo, es una bisección del motor entre 3 y 200 mm, a lo más 40 divisiones y deteniéndose cuando el P80 está a 0,001 mm del objetivo, porque el motor es monótono en el ajuste y exacto."
      />
      <Callout variant="note" title={t('Where it works and where it fails', 'Dónde funciona y dónde falla')}>
        {t(
          'The surrogate is accurate inside the envelope of its own machine and it emulates the engine, not the plant: where the engine is wrong, the surrogate is wrong in the same way, only faster. A model answers only where it applies: on a calibrated survey, or when an input lies outside its machine\'s row of the table above, the engine answers for the surrogate and the envelope gate for the autoencoder, and the reason is shown. Inside those ranges the autoencoder\'s score rises for a point off the training manifold, but a score under the threshold is not a proof that a point is safe. The held-out errors are on the Benchmark page, read from the committed metrics.',
          'El sustituto es preciso dentro del rango de su propia máquina y emula el motor, no la planta: donde el motor se equivoca, el sustituto se equivoca de la misma manera, solo que más rápido. Un modelo responde solo donde aplica: en un muestreo calibrado, o cuando una entrada queda fuera de la fila de su máquina en la tabla anterior, responde el motor por el sustituto y la compuerta de envolvente por el autocodificador, y se muestra la razón. Dentro de esos rangos el puntaje del autocodificador sube para un punto fuera de la variedad de entrenamiento, pero un puntaje bajo el umbral no prueba que un punto sea seguro. Los errores con datos retenidos están en la página Benchmark, leídos de las métricas comprometidas.',
        )}
      </Callout>
    </DocSection>
  );
}

export function CrusherCalProtocol() {
  const t = useT();
  return (
    <DocSection title={{ en: 'CrusherCal: the leave-one-survey-out protocol', es: 'CrusherCal: el protocolo de dejar un muestreo fuera' }} area="engine" refs={['rocha2024']}>
      <P
        en={<>The real lane is ten measured surveys of an HP500 secondary cone <Cite id="rocha2024" />. Each survey is run through the calibrated engine at its measured setting and feed F80, with the machine constants held fixed at a throw of 34 mm and a speed of 360 rpm. The feed is rebuilt from the measured F80 with a Rosin-Rammler law of uniformity 0.9, because at the F80 the passing is 0.8 and so the size x63 is the F80 divided by the natural logarithm of 5 to the power 1 over m. The ore competence is metadata only, since the calibrated t10 does not read it. The backbone document keeps the engine output per survey, and CrusherCal reads only that document: it is a pure function of the backbone, a version and a seed, with no file in the middle.</>}
        es={<>La vía real son diez muestreos medidos de un cono secundario HP500 <Cite id="rocha2024" />. Cada muestreo se corre por el motor calibrado en su ajuste medido y su F80 de alimento, con las constantes de la máquina fijas en una carrera de 34 mm y una velocidad de 360 rpm. El alimento se reconstruye desde el F80 medido con una ley de Rosin-Rammler de uniformidad 0,9, porque en el F80 el pasante es 0,8 y por lo tanto el tamaño x63 es el F80 dividido por el logaritmo natural de 5 elevado a 1 sobre m. La competencia del mineral es solo metadato, ya que el t10 calibrado no la lee. El documento del esqueleto guarda la salida del motor por muestreo, y CrusherCal lee solo ese documento: es una función pura del esqueleto, una versión y una semilla, sin archivo de por medio.</>}
      />
      <Equation
        tex={String.raw`\hat q_i = Q_T^{(-i)}\, s_i, \qquad Q_T^{(-i)} = \frac{\sum_{k \ne i} s_k\, m_k}{\sum_{k \ne i} s_k^{2}}, \qquad \tilde y_i = \hat y_i + \operatorname{clip}\bigl(r_i,\; \pm\, 0.20\,\lvert \hat y_i \rvert\bigr)`}
        caption={t('The backbone and the bounded residual: s_k is the engine capacity factor of survey k (its backbone capacity over the reference 647 t/h), m_k the measured throughput (t/h), Q_T the capacity base refitted without survey i, hat q_i the held-out prediction (t/h), r_i the ridge residual on the standardised setting and F80, and the clip keeps it within 20 percent of the backbone value; for the power the refitted scalars are the factor and the no-load power of the paper form.', 'El esqueleto y el residuo acotado: s_k es el factor de capacidad del motor del muestreo k (su capacidad de esqueleto sobre la referencia de 647 t/h), m_k la capacidad medida (t/h), Q_T la base de capacidad reajustada sin el muestreo i, hat q_i la predicción retenida (t/h), r_i el residuo de cresta sobre el ajuste y el F80 estandarizados, y el recorte lo mantiene dentro del 20 por ciento del valor del esqueleto; para la potencia los escalares reajustados son el factor y la potencia en vacío de la forma del artículo.')}
      />
      <P
        en="Three models are scored on identical folds for the two measured targets, throughput and power, with P80 reported only as self-consistency because the paper's size curves are figures. M0 is the backbone with its global scalar refitted in each fold, M1 adds a ridge residual with a penalty of 1.0 on the standardised setting and F80, clipped to 20 percent of the backbone value, and M2 is an unconstrained least-squares fit on the same two inputs, the overfit strawman. Each runs twice: strict folds refit everything on the nine other surveys, and leaky folds fit on all ten, so the optimism gap is visible. Two controls stand beside them, the constant mean of the training surveys, which M1 must beat to claim any skill, and a label-shuffle control with a seeded permutation of the measured values, which must not beat the backbone. Every metric, the mean absolute percentage error, the root mean squared error, R squared and the largest deviation, is computed and reported, none is asserted."
        es="Tres modelos se evalúan sobre pliegues idénticos para los dos objetivos medidos, capacidad y potencia, y P80 se informa solo como autoconsistencia porque las curvas de tamaño del artículo son figuras. M0 es el esqueleto con su escalar global reajustado en cada pliegue, M1 agrega un residuo de cresta con penalización 1,0 sobre el ajuste y el F80 estandarizados, recortado al 20 por ciento del valor del esqueleto, y M2 es un ajuste de mínimos cuadrados sin restricciones sobre las mismas dos entradas, el espantapájaros del sobreajuste. Cada uno corre dos veces: los pliegues estrictos reajustan todo con los otros nueve muestreos, y los pliegues con fuga ajustan con los diez, de modo que la brecha de optimismo queda a la vista. Dos controles los acompañan, la media constante de los muestreos de entrenamiento, que M1 debe superar para reclamar alguna habilidad, y un control de etiquetas barajadas con una permutación con semilla de los valores medidos, que no debe superar al esqueleto. Cada métrica, el error porcentual absoluto medio, la raíz del error cuadrático medio, R cuadrado y la mayor desviación, se calcula y se informa, ninguna se afirma."
      />
      <P
        en="The predictive band is built from the strict held-out residuals of the backbone: the 80 percent interval is the prediction plus or minus 1.2816 times the sample standard deviation of those residuals, and two coverages over the ten surveys are reported beside the nominal 0.80: the in-sample one, which checks the residuals against their own spread, and the nested one, which builds each survey's interval from the other nine surveys' residuals. The seed is 42, and the three targets use it, plus one and plus two, so the shuffles of the throughput, the power and P80 do not share a permutation. With ten surveys the coverage is a coarse estimate, and the pre-registered expectation that the residual adds marginal or null skill over the backbone is an acceptable outcome that the document reports as it is. The document also carries two in-sample contrasts, the power of the engine against the measured one and the throughput parity, which the Benchmark page reads."
        es="La banda predictiva se construye con los residuos retenidos estrictos del esqueleto: el intervalo de 80 por ciento es la predicción más o menos 1,2816 veces la desviación estándar muestral de esos residuos, y se informan dos coberturas sobre los diez muestreos junto al 0,80 nominal: la de dentro de muestra, que verifica los residuos contra su propia dispersión, y la anidada, que construye el intervalo de cada muestreo con los residuos de los otros nueve. La semilla es 42, y los tres objetivos la usan, más uno y más dos, de modo que las barajaduras de la capacidad, la potencia y P80 no comparten permutación. Con diez muestreos la cobertura es una estimación gruesa, y la expectativa preregistrada de que el residuo aporta habilidad marginal o nula sobre el esqueleto es un resultado aceptable que el documento informa tal como es. El documento también lleva dos contrastes dentro de muestra, la potencia del motor frente a la medida y la paridad de la capacidad, que lee la página Benchmark."
      />
      <Callout variant="note" title={t('Where it works and where it fails', 'Dónde funciona y dónde falla')}>
        {t(
          'The protocol is sound for what it can judge: a one-scalar capacity backbone, refitted without the held-out survey, scored against measured throughput. It cannot judge a model with many parameters, because ten surveys cannot support one; the band is a normal approximation from ten residuals; and the surveys vary only the setting and the feed F80, so nothing is learned about the throw, the speed or another ore. On this protocol the power backbone does not beat the constant mean, and it is reported as the negative it is.',
          'El protocolo es sólido para lo que puede juzgar: un esqueleto de capacidad de un escalar, reajustado sin el muestreo retenido, evaluado contra la capacidad medida. No puede juzgar un modelo con muchos parámetros, porque diez muestreos no lo sostienen; la banda es una aproximación normal a partir de diez residuos; y los muestreos varían solo el ajuste y el F80 del alimento, así que nada se aprende sobre la carrera, la velocidad u otro mineral. En este protocolo el esqueleto de potencia no supera a la media constante, y se informa como el negativo que es.',
        )}
      </Callout>
    </DocSection>
  );
}
