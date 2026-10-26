// Topics 3 and 4 of the Methodology: the Whiten classification and population balance, and the calibrated HP500 lane.
import { Callout, Cite, DocSection, Equation, Figure, useFormat } from '@fasl-work/caos-app-shell';
import { P, useT } from '../bi';
import { CalibratedFigure, ClassificationFigure } from './figures';

export function Whiten() {
  const t = useT();
  const f = useFormat();
  // [machine, K1 intercept, K1 slope, K2 intercept, K2 slope, K3, design throw], read from the classification model of the engine.
  const rows: [string, number, number, number, number, number, number][] = [
    ['cone-sec', 0.2, 0.9, 6.0, 1.95, 2.3, 30],
    ['cone-tert', 0.1, 0.85, 3.0, 1.75, 2.5, 16],
    ['cone-short-head', 0.1, 0.82, 2.4, 1.65, 2.7, 16],
    ['gyratory', 0.6, 0.95, 10.0, 2.1, 2.0, 30],
    ['jaw', 2.0, 0.95, 20.0, 2.3, 2.1, 38],
  ];
  const names: Record<string, [string, string]> = {
    'cone-sec': ['Secondary cone', 'Cono secundario'],
    'cone-tert': ['Tertiary cone', 'Cono terciario'],
    'cone-short-head': ['Short-head cone', 'Cono de cabeza corta'],
    gyratory: ['Primary gyratory', 'Giratorio primario'],
    jaw: ['Primary jaw', 'Mandíbula primaria'],
  };
  return (
    <DocSection title={{ en: 'Whiten classification and the population balance', es: 'Clasificación de Whiten y balance poblacional' }} area="method" kind="classical" refs={['whiten1972', 'andersen1988', 'evertsson1999', 'napiermunn1996', 'cleary2015', 'delaney2015', 'quist2016']}>
      <P
        en={<>The chamber is modelled as one breakage zone with two operators. The classification C(d) is the probability that a particle of size d entering the chamber is nipped and broken instead of falling through; it is zero up to a size K1, one from a size K2 upward, and a smooth rise between them with the shape exponent K3 <Cite id="whiten1972" /> <Cite id="andersen1988" />. The classification is evaluated at the mid-size of each of the 28 classes and forms the diagonal of the matrix C.</>}
        es={<>La cámara se modela como una zona de fractura con dos operadores. La clasificación C(d) es la probabilidad de que una partícula de tamaño d que entra a la cámara sea mordida y rota en vez de caer de largo; vale cero hasta un tamaño K1, uno desde un tamaño K2 hacia arriba, y sube suavemente entre ambos con el exponente de forma K3 <Cite id="whiten1972" /> <Cite id="andersen1988" />. La clasificación se evalúa en el tamaño medio de cada una de las 28 clases y forma la diagonal de la matriz C.</>}
      />
      <Equation
        tex={String.raw`C(d) = \begin{cases} 0 & d \le K_1 \\[2pt] 1 - \left(\dfrac{K_2 - d}{K_2 - K_1}\right)^{K_3} & K_1 < d < K_2 \\[6pt] 1 & d \ge K_2 \end{cases}`}
        caption={t('The classification function: d is the particle size (mm), K1 the size below which a particle always escapes (mm), K2 the size above which it is always broken (mm) and K3 the dimensionless shape exponent.', 'La función de clasificación: d es el tamaño de partícula (mm), K1 el tamaño bajo el cual una partícula siempre escapa (mm), K2 el tamaño sobre el cual siempre se rompe (mm) y K3 el exponente de forma, sin dimensión.')}
      />
      <P
        en={<>K1 is linear in the closed-side setting: a tighter setting captures smaller particles. K2 is the open-side capture threshold, so it moves with the open-side setting OSS = CSS + throw: a larger throw opens the chamber wider and lets larger particles escape during the open phase, which gives a coarser product at a fixed CSS and a higher capacity <Cite id="evertsson1999" />. The code centres this term on the design throw, so the reference cases do not move, and it keeps K2 at least 5 percent above K1.</>}
        es={<>K1 es lineal en el lado cerrado: un ajuste más cerrado captura partículas más pequeñas. K2 es el umbral de captura del lado abierto, así que se mueve con el lado abierto OSS = CSS + carrera: una carrera mayor abre más la cámara y deja escapar partículas mayores durante la fase abierta, lo que da un producto más grueso a CSS fijo y una capacidad mayor <Cite id="evertsson1999" />. El código centra este término en la carrera de diseño, de modo que los casos de referencia no se mueven, y mantiene K2 al menos 5 por ciento sobre K1.</>}
      />
      <Equation
        tex={String.raw`K_1 = a_1 + b_1\,\mathrm{CSS}, \qquad K_2 = \max\!\Big(a_2 + b_2\,\mathrm{CSS} + \tfrac{1}{2}\, b_2\,(T - T_{\mathrm{ref}}),\ 1.05\,K_1\Big), \qquad \mathrm{OSS} = \mathrm{CSS} + T`}
        caption={t('The capture window of the synthetic machines: CSS is the closed-side setting (mm), T the live eccentric throw (mm), T_ref the design throw of the machine (mm), and a1, b1, a2, b2 and K3 the per-machine constants of the table below.', 'La ventana de captura de las máquinas sintéticas: CSS es el lado cerrado (mm), T la carrera excéntrica en uso (mm), T_ref la carrera de diseño de la máquina (mm), y a1, b1, a2, b2 y K3 las constantes por máquina de la tabla siguiente.')}
      />
      <table className="caos-table" data-state="ready">
        <caption>{t('The provisional per-machine constants of the synthetic classification (sizes in mm).', 'Las constantes provisionales por máquina de la clasificación sintética (tamaños en mm).')}</caption>
        <thead>
          <tr>
            <th>{t('Machine', 'Máquina')}</th>
            <th className="caos-col-text">K1</th>
            <th className="caos-col-text">K2</th>
            <th>K3</th>
            <th>T_ref</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([id, a1, b1, a2, b2, k3, tref]) => (
            <tr key={id}>
              <td>{t(names[id][0], names[id][1])}</td>
              <td>{`${f(a1, { decimals: 1 })} + ${f(b1, { decimals: 2 })} CSS`}</td>
              <td>{`${f(a2, { decimals: 1 })} + ${f(b2, { decimals: 2 })} CSS`}</td>
              <td>{f(k3, { decimals: 1 })}</td>
              <td>{f(tref, { decimals: 0 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Figure caption={t('The classification curve of the reference secondary cone (CSS 32 mm) at its design throw of 30 mm and at 46 mm, computed by the engine; the window K1 to K2 shifts toward coarser sizes with the throw, K1 does not move.', 'La curva de clasificación del cono secundario de referencia (CSS 32 mm) con su carrera de diseño de 30 mm y con 46 mm, calculada por el motor; la ventana K1 a K2 se desplaza hacia tamaños más gruesos con la carrera, K1 no se mueve.')}>
        <ClassificationFigure />
      </Figure>
      <P
        en={<>The internal balance of the zone is x = f + B C x: what is in the chamber is the feed plus the progeny of what was nipped. The product is what is not nipped, p = (I - C) x, and substituting gives the Whiten solution with the factor (I - C) to the left of the inverse <Cite id="whiten1972" /> <Cite id="napiermunn1996" />. The inverse is never formed: the engine solves (I - B C) x = f by LU decomposition with partial pivoting, applies (I - C), and renormalises the product to a clean distribution.</>}
        es={<>El balance interno de la zona es x = f + B C x: lo que hay en la cámara es el alimento más la progenie de lo que fue mordido. El producto es lo que no se muerde, p = (I - C) x, y al sustituir se obtiene la solución de Whiten con el factor (I - C) a la izquierda del inverso <Cite id="whiten1972" /> <Cite id="napiermunn1996" />. El inverso nunca se forma: el motor resuelve (I - B C) x = f por descomposición LU con pivoteo parcial, aplica (I - C) y renormaliza el producto a una distribución limpia.</>}
      />
      <Equation
        tex={String.raw`p = (I - C)\,(I - B\,C)^{-1} f, \qquad \varepsilon = \Big|\sum_i p_i - \sum_i f_i\Big|, \qquad \kappa = \frac{\max_i \sum_j |M_{ij}|}{\min_i \sum_j |M_{ij}|},\ \ M = I - B\,C`}
        caption={t('The Whiten solve and its guards: f is the feed vector, B the breakage matrix, C the diagonal classification matrix, p the product vector, epsilon the mass closure before renormalisation and kappa the conditioning proxy, the ratio of the largest to the smallest absolute row sum of M.', 'La solución de Whiten y sus resguardos: f es el vector de alimento, B la matriz de fractura, C la matriz diagonal de clasificación, p el vector de producto, epsilon el cierre de masa antes de renormalizar y kappa el indicador de condicionamiento, el cociente entre la mayor y la menor suma absoluta de fila de M.')}
      />
      <P
        en="Two guards keep the readout honest. The mass closure epsilon should be zero in exact arithmetic, and it is reported before the renormalisation hides it. The conditioning proxy rises when the classification approaches one across many classes, the choke regime, and a point whose proxy is not finite or exceeds one million is marked invalid, never given a confident number. If the factorisation meets a zero pivot, which a strictly lower-triangular breakage matrix should prevent, the engine returns the feed unchanged and flags the point."
        es="Dos resguardos mantienen honesta la lectura. El cierre de masa epsilon debería ser cero en aritmética exacta, y se informa antes de que la renormalización lo oculte. El indicador de condicionamiento sube cuando la clasificación se acerca a uno en muchas clases, el régimen de atoro, y un punto cuyo indicador no es finito o supera un millón se marca como inválido, sin darle nunca un número confiado. Si la factorización encuentra un pivote nulo, cosa que una matriz de fractura estrictamente triangular inferior debería impedir, el motor devuelve el alimento sin cambios y marca el punto."
      />
      <P
        en={<>The mechanism that this population balance approximates is resolved by the discrete element method with breakage, the state of the art for a crusher chamber. Particle-replacement models remove a particle that meets a breakage criterion and insert its progeny <Cite id="cleary2015" />, with progeny sized by the same JKMRC t10 family used here <Cite id="delaney2015" />, and bonded-particle models let fracture emerge from the contacts <Cite id="quist2016" />. An industrial step takes GPU-hours, so this build does not run it: it is the offline frontier the population balance is compared with, and the shared t10 makes the breakage trends comparable, not the absolute progeny.</>}
        es={<>El mecanismo que este balance poblacional aproxima se resuelve con el método de elementos discretos con fractura, el estado del arte para una cámara de chancado. Los modelos de reemplazo de partículas retiran una partícula que cumple un criterio de fractura e insertan su progenie <Cite id="cleary2015" />, con la progenie dimensionada por la misma familia t10 del JKMRC usada aquí <Cite id="delaney2015" />, y los modelos de partículas ligadas dejan que la fractura emerja de los contactos <Cite id="quist2016" />. Un paso industrial toma horas de GPU, así que esta versión no lo ejecuta: es la frontera fuera de línea con la que se compara el balance poblacional, y el t10 compartido hace comparables las tendencias de fractura, no la progenie absoluta.</>}
      />
      <Callout variant="honest" title={t('Exact and illustrative', 'Exacto e ilustrativo')}>
        {t('The solve, the guards and the shape of C are exact. The K1, K2 and K3 constants of the five synthetic machines are illustrative: they are typical of the literature and chosen to reproduce the trends (a tighter CSS gives a finer product, more throw a coarser one), not the absolute numbers of any plant. Only the HP500 lane of the next topic carries a published calibration, for one machine and one ore.', 'La solución, los resguardos y la forma de C son exactos. Las constantes K1, K2 y K3 de las cinco máquinas sintéticas son ilustrativas: son típicas de la literatura y se eligieron para reproducir las tendencias (un CSS más cerrado da un producto más fino, más carrera uno más grueso), no los números absolutos de una planta. Solo la vía HP500 del tema siguiente lleva una calibración publicada, para una máquina y un mineral.')}
      </Callout>
    </DocSection>
  );
}

export function Calibrated() {
  const t = useT();
  return (
    <DocSection title={{ en: 'The calibrated fit on measured HP500 surveys', es: 'El ajuste calibrado con encuestas medidas del HP500' }} area="method" kind="classical" refs={['rocha2024', 'andersen1988', 'duarte2021']}>
      <P
        en={<>The measured lane rests on one open-access paper: ten industrial surveys of a Metso HP500 secondary cone crushing itabirite iron ore at the Minas Rio operation <Cite id="rocha2024" />. The survey table gives, for each survey, the closed-side setting, the feed f80, the feed rate and the power drawn. In the ten surveys the setting runs from 38 to 55 mm and the feed f80 from 47 to 140 mm, and that range is the support inside which the calibration is a fit and outside which it is an extrapolation.</>}
        es={<>La vía medida se apoya en un solo artículo de acceso abierto: diez encuestas industriales de un cono secundario Metso HP500 que chanca mineral de hierro itabirita en la operación Minas Rio <Cite id="rocha2024" />. La tabla de encuestas entrega, para cada una, el lado cerrado, el f80 del alimento, la tasa de alimentación y la potencia consumida. En las diez encuestas el ajuste va de 38 a 55 mm y el f80 del alimento de 47 a 140 mm, y ese rango es el soporte dentro del cual la calibración es un ajuste y fuera del cual es una extrapolación.</>}
      />
      <Equation
        tex={String.raw`K_1 = 0.23\,\mathrm{CSS} + 0.30\,f_{80}, \qquad K_2 = \max\!\big(12.0 + 0.55\,\mathrm{CSS} + 0.40\,f_{80},\ 1.05\,K_1\big), \qquad K_3 = 2.3`}
        caption={t('The Andersen-Whiten fit of the paper, Table 5: CSS is the closed-side setting (mm), f80 the 80 % passing size of the feed (mm), K1 and K2 the escape and full-capture sizes (mm) and K3 the constant shape exponent; the throw does not appear because the paper did not vary it.', 'El ajuste de Andersen-Whiten del artículo, Tabla 5: CSS es el lado cerrado (mm), f80 el tamaño al 80 % pasante del alimento (mm), K1 y K2 los tamaños de escape y de captura total (mm) y K3 el exponente de forma constante; la carrera no aparece porque el artículo no la varió.')}
      />
      <P
        en={<>On this lane the classification is the published one: K1 and K2 are linear in both the setting and the feed f80, K3 is held at 2.3, and the classification no longer depends on the throw. The fineness of the progeny comes from a calibrated t10 instead of the energy path, and the capacity is anchored at 647 t/h so that the modelled curve sits inside the band of throughputs measured in the ten surveys. The power form of the paper is the subject of its own topic.</>}
        es={<>En esta vía la clasificación es la publicada: K1 y K2 son lineales en el ajuste y en el f80 del alimento, K3 se mantiene en 2,3 y la clasificación ya no depende de la carrera. La finura de la progenie sale de un t10 calibrado en vez de la ruta de energía, y la capacidad se ancla en 647 t/h para que la curva modelada quede dentro de la banda de capacidades medidas en las diez encuestas. La forma de potencia del artículo es el tema de su propio apartado.</>}
      />
      <Equation
        tex={String.raw`t_{10}\,[\%] = \min\!\big(44,\ \max(0,\ 64 - 0.12\,\mathrm{CSS} - 0.23\,f_{80})\big), \qquad x_{63} = \frac{f_{80}}{(\ln 5)^{1/m}},\ \ m = 0.9`}
        caption={t('The calibrated fineness and the feed reconstruction: t10 in percent from CSS and f80 (mm), capped at 44 % as in the synthetic path; x63 is the Rosin-Rammler size of the rebuilt feed (mm) and m its exponent, assumed 0.9, from R(f80) = 0.8.', 'La finura calibrada y la reconstrucción del alimento: t10 en porcentaje a partir de CSS y f80 (mm), con tope de 44 % como en la ruta sintética; x63 es el tamaño de Rosin-Rammler del alimento reconstruido (mm) y m su exponente, supuesto 0,9, a partir de R(f80) = 0,8.')}
      />
      <Figure caption={t('The calibrated t10 against the closed-side setting for three feed sizes, computed by the engine; the shaded band is the support of the ten surveys, and the itabirite surveys sit so high that the cap of the engine acts on the whole finest-feed curve.', 'El t10 calibrado frente al lado cerrado para tres tamaños de alimento, calculado por el motor; la banda sombreada es el soporte de las diez encuestas, y las encuestas de itabirita quedan tan alto que el tope del motor actúa sobre toda la curva del alimento más fino.')}>
        <CalibratedFigure />
      </Figure>
      <P
        en="The paper publishes the feed curves only as figures, so the engine rebuilds each feed from the measured f80 alone. Setting the Rosin-Rammler law equal to 0.8 at f80 and solving for x63 gives the second equation above, with an assumed uniformity exponent of 0.9, a value typical of a run-of-mine itabirite feed. The reconstructed feed matches the measured f80 by construction and the measured shape only as well as that assumption holds, which is the reason for the caveat on the callout."
        es="El artículo publica las curvas del alimento solo como figuras, así que el motor reconstruye cada alimento a partir del f80 medido únicamente. Al igualar la ley de Rosin-Rammler a 0,8 en f80 y despejar x63 se obtiene la segunda ecuación de arriba, con un exponente de uniformidad supuesto de 0,9, un valor típico de un alimento de itabirita tal como sale de la mina. El alimento reconstruido coincide con el f80 medido por construcción y con la forma medida solo en la medida en que la suposición se sostiene, que es la razón de la advertencia del recuadro."
      />
      <P
        en={<>What the calibrated lane changes is the classification, the fineness, the capacity base and the power form; what it leaves alone is the sieve grid, the Austin function with its two slopes, the Whiten solve and the Bond draw. The envelope gate checks the setting and the f80 against the support of the ten surveys and flags a point outside it, never answering with a confident number. A second open cone data set <Cite id="duarte2021" /> is cited as an anchor in the project record but is not a lane of this build.</>}
        es={<>Lo que cambia la vía calibrada es la clasificación, la finura, la base de capacidad y la forma de la potencia; lo que deja intacto es la grilla de tamices, la función de Austin con sus dos pendientes, la solución de Whiten y el consumo de Bond. La compuerta de envolvente compara el ajuste y el f80 con el soporte de las diez encuestas y marca un punto fuera de él, sin responder nunca con un número confiado. Un segundo conjunto abierto de datos de conos <Cite id="duarte2021" /> se cita como ancla en el registro del proyecto pero no es una vía de esta versión.</>}
      />
      <Callout variant="honest" title={t('Calibrated to one machine and one ore', 'Calibrado a una máquina y un mineral')}>
        {t('The fit is exact as published, and it is a fit to ten surveys of one machine and one ore. The throw and the speed are held at fixed nominal values on this lane, the feed curves are reconstructed, and the power in the surveys is estimated from the motor current, not from a dynamometer. Everything outside the support of the surveys, and every other machine of the page, stays illustrative.', 'El ajuste es exacto como fue publicado, y es un ajuste a diez encuestas de una máquina y un mineral. La carrera y la velocidad se mantienen en valores nominales fijos en esta vía, las curvas del alimento se reconstruyen, y la potencia de las encuestas se estima a partir de la corriente del motor, no de un dinamómetro. Todo lo que queda fuera del soporte de las encuestas, y toda otra máquina de la página, sigue siendo ilustrativo.')}
      </Callout>
    </DocSection>
  );
}
