// The three engine topics of the classical core, as the code runs them: the Whiten solve with its conditioning proxy, the
// capacity and power, and the engine's checks with the envelope gate. The methods and their equations are on the Methodology
// page; these topics give the exact steps, constants, guards and clamps of the canonical Python engine and of its TypeScript
// port, which a shared reference holds equal.
import { Callout, Cite, DocSection, Equation, Figure } from '@fasl-work/caos-app-shell';
import { P, useT } from '../bi';
import { StepsFigure } from './figures';
import { Steps } from './parts';

export function WhitenSolve() {
  const t = useT();
  return (
    <DocSection title={{ en: 'The Whiten solve and its conditioning proxy', es: 'La solución de Whiten y su indicador de condicionamiento' }} area="engine" refs={['whiten1972', 'napiermunn1996']}>
      <P
        en={<>The chamber is one breakage zone on a fixed grid of 28 size classes: the square-root-of-two series from a top size of 256 mm down to 256 divided by 2 to the 14th, 0.0156 mm. The feed is a Rosin-Rammler law discretised on that grid, each class holding the difference of the cumulative passing at its two edges, floored at zero and renormalised to a sum of one. The solve forms the matrix M as the identity minus B times C, where C is diagonal and B is strictly lower triangular, so M has a unit diagonal and is never singular in exact arithmetic <Cite id="whiten1972" /> <Cite id="napiermunn1996" />. It then solves M x = f by LU decomposition with partial pivoting and applies the left factor (I - C) to get the product.</>}
        es={<>La cámara es una zona de fractura sobre una malla fija de 28 clases de tamaño: la serie de raíz de dos desde un tamaño máximo de 256 mm hasta 256 dividido por 2 a la 14, 0,0156 mm. El alimento es una ley de Rosin-Rammler discretizada en esa malla, y cada clase guarda la diferencia del pasante acumulado en sus dos bordes, acotada en cero y renormalizada a suma uno. La solución arma la matriz M como la identidad menos B por C, donde C es diagonal y B es estrictamente triangular inferior, así que M tiene diagonal unitaria y nunca es singular en aritmética exacta <Cite id="whiten1972" /> <Cite id="napiermunn1996" />. Luego resuelve M x = f por descomposición LU con pivoteo parcial y aplica el factor izquierdo (I - C) para obtener el producto.</>}
      />
      <Steps
        items={[
          { en: 'The feed: the Rosin-Rammler passing at every edge of the grid, the mass of each class as the difference of two edges, the feed F80 by log-linear interpolation of the cumulative passing.', es: 'El alimento: el pasante de Rosin-Rammler en cada borde de la malla, la masa de cada clase como diferencia de dos bordes, el F80 del alimento por interpolación log-lineal del pasante acumulado.' },
          { en: 'The classification: K1, K2 and K3 from the machine, the setting and the throw, with K2 kept at least 5 percent above K1, evaluated at the geometric mid-size of each class into the diagonal of C.', es: 'La clasificación: K1, K2 y K3 según la máquina, el ajuste y la carrera, con K2 al menos 5 por ciento sobre K1, evaluada en el tamaño medio geométrico de cada clase en la diagonal de C.' },
          { en: 'The breakage: the specific energy 0.033 times the design throw times the speed over 350 rpm gives t10, capped at 0.44, which fixes the weight of the Austin appearance function (slopes 0.35 and 4.2, weight clamped to 0.02 to 0.98); each column of B is normalised to a sum of one. On the calibrated lane t10 comes straight from the HP500 fit.', es: 'La fractura: la energía específica, 0,033 por la carrera de diseño por la velocidad sobre 350 rpm, da t10, acotado en 0,44, que fija el peso de la función de aparición de Austin (pendientes 0,35 y 4,2, peso acotado entre 0,02 y 0,98); cada columna de B se normaliza a suma uno. En la vía calibrada t10 sale directo del ajuste HP500.' },
          { en: 'The solve: LU with partial pivoting of M x = f, then p = (I - C) x floored at zero. The mass closure, the absolute difference of the sums of p and f, is recorded before p is renormalised to a sum of one.', es: 'La solución: LU con pivoteo parcial de M x = f, luego p = (I - C) x acotado en cero. El cierre de masa, la diferencia absoluta de las sumas de p y f, se registra antes de renormalizar p a suma uno.' },
          { en: 'The readouts: P80, P50 and P20 by log-linear interpolation, the passing at 1, 4, 8, 16 and 32 mm by interpolation linear in the log of the size, and the reduction ratio F80 over P80.', es: 'Las lecturas: P80, P50 y P20 por interpolación log-lineal, el pasante a 1, 4, 8, 16 y 32 mm por interpolación lineal en el logaritmo del tamaño, y la razón de reducción F80 sobre P80.' },
        ]}
      />
      <Equation
        tex={String.raw`(I - BC)\,x = f, \qquad p = (I - C)\,x, \qquad \varepsilon = \Bigl|\sum_i p_i - \sum_i f_i\Bigr|`}
        caption={t('The solve as coded: f is the feed mass per class (sums to one), B the strictly lower triangular breakage matrix, C the diagonal classification, x the internal flow through the chamber, p the product mass per class and epsilon the mass closure reported before p is renormalised; all are dimensionless mass fractions.', 'La solución tal como está codificada: f es la masa del alimento por clase (suma uno), B la matriz de fractura estrictamente triangular inferior, C la clasificación diagonal, x el flujo interno por la cámara, p la masa del producto por clase y epsilon el cierre de masa informado antes de renormalizar p; todos son fracciones de masa sin dimensión.')}
      />
      <Figure caption={t('The five steps of one evaluation, from the feed law to the product readouts.', 'Los cinco pasos de una evaluación, desde la ley del alimento hasta las lecturas del producto.')}>
        <StepsFigure
          label={t('From the feed law to the product readouts', 'De la ley del alimento a las lecturas del producto')}
          boxes={[
            { title: 'x63, m', line: t('feed law', 'ley del alimento') },
            { title: 'C(d)', line: 'K1, K2, K3' },
            { title: 'B', line: 't10, phi' },
            { title: 'LU', line: '(I - BC) x = f' },
            { title: 'p', line: 'P80, P50, P20' },
          ]}
          arrows={['28', 'C', 'B', 'x']}
        />
      </Figure>
      <P
        en="The conditioning proxy is a cheap row-sum ratio, not a true condition number: the largest over the smallest absolute row sum of M. The evaluation marks a point not valid, with the ill-conditioned flag, when the proxy is not finite or exceeds one million. If a zero pivot is ever met, the solve returns the feed unchanged with a mass closure of zero and an infinite proxy, so the caller flags the point and never shows a confident number. The Python port keeps the LU as written, and not a library solve, so the order of the floating-point operations is the TypeScript order, and a small module reproduces the arithmetic of JavaScript for the out-of-domain cases, such as a negative base to a fractional power, so a nonsensical point returns a flagged result and never an exception."
        es="El indicador de condicionamiento es una razón barata de sumas por fila, no un número de condición verdadero: la mayor sobre la menor de las sumas absolutas por fila de M. La evaluación marca un punto como no válido, con la marca de mal condicionamiento, cuando el indicador no es finito o supera un millón. Si alguna vez aparece un pivote cero, la solución devuelve el alimento sin cambio con cierre de masa cero y un indicador infinito, de modo que quien llama marca el punto y nunca muestra un número confiado. El port a Python conserva la LU tal como está escrita, y no una solución de biblioteca, para que el orden de las operaciones de punto flotante sea el de TypeScript, y un módulo pequeño reproduce la aritmética de JavaScript en los casos fuera de dominio, como una base negativa elevada a una potencia fraccionaria, así que un punto sin sentido devuelve un resultado marcado y nunca una excepción."
      />
      <Equation
        tex={String.raw`\kappa = \frac{\max_i \sum_j \lvert M_{ij} \rvert}{\min_i \sum_j \lvert M_{ij} \rvert}, \qquad M = I - BC, \qquad \text{not valid if } \kappa > 10^{6} \ \text{or } \kappa \text{ is not finite}`}
        caption={t('The conditioning proxy kappa: M_ij are the entries of the matrix of the solve, so each sum is an absolute row sum; kappa is dimensionless and the threshold is the constant of the engine.', 'El indicador de condicionamiento kappa: M_ij son las entradas de la matriz de la solución, de modo que cada suma es una suma absoluta por fila; kappa no tiene dimensión y el umbral es la constante del motor.')}
      />
      <Callout variant="note" title={t('Where it works and where it fails', 'Dónde funciona y dónde falla')}>
        {t(
          'It works for a choke-fed chamber with the setting below the feed F80: the solve conserves mass to rounding and a tighter setting gives a finer product. It degrades in the pass-through regime, where the setting is at or above F80 and almost nothing is gripped, and the point is invalid when the setting reaches the 256 mm top size. The proxy is only a screen: it is not the condition number of the matrix, and the assumption of a single breakage zone with one classification function is the model, not a measurement of a real chamber.',
          'Funciona para una cámara alimentada hasta el atoro con el ajuste bajo el F80 del alimento: la solución conserva la masa hasta el redondeo y un ajuste más cerrado da un producto más fino. Se degrada en el régimen de paso directo, donde el ajuste está en el F80 o sobre él y casi nada es agarrado, y el punto es inválido cuando el ajuste alcanza el tamaño máximo de 256 mm. El indicador es solo un filtro: no es el número de condición de la matriz, y el supuesto de una sola zona de fractura con una función de clasificación es el modelo, no una medición de una cámara real.',
        )}
      </Callout>
    </DocSection>
  );
}

export function CapacityPower() {
  const t = useT();
  return (
    <DocSection title={{ en: 'Capacity, power and the nip geometry', es: 'Capacidad, potencia y geometría de mordida' }} area="engine" refs={['evertsson2000', 'bond1952', 'rocha2024']}>
      <P
        en={<>The capacity is a function of the machine, the closed-side setting, the throw and the speed alone, and it does not read the feed or the ore. Each of the five machines has a reference capacity in tonnes per hour, an optimum speed in rpm and a reference gap in millimetres; the opening factor is the setting plus half the throw over the reference gap, and the speed enters through the hump s times e to the 1 minus s, which equals one at the optimum <Cite id="evertsson2000" />. The result is floored at zero, and on the calibrated cone lane the reference capacity is the fixed 647 t/h of the HP500 fit. The nip angle is the base angle, 22 degrees (19 for the jaw), plus 3 degrees per unit of the setting over the reference gap minus one, and it is reported with its grip limit of 2 arctan 0.35, 38.6 degrees, without gating any result.</>}
        es={<>La capacidad es función solo de la máquina, el ajuste de lado cerrado, la carrera y la velocidad, y no lee el alimento ni el mineral. Cada una de las cinco máquinas tiene una capacidad de referencia en toneladas por hora, una velocidad óptima en rpm y un espacio de referencia en milímetros; el factor de apertura es el ajuste más la mitad de la carrera sobre el espacio de referencia, y la velocidad entra por la joroba s por e elevado a 1 menos s, que vale uno en el óptimo <Cite id="evertsson2000" />. El resultado se acota en cero, y en la vía calibrada del cono la capacidad de referencia es la fija de 647 t/h del ajuste HP500. El ángulo de mordida es el ángulo base, 22 grados (19 para la mandíbula), más 3 grados por cada unidad del ajuste sobre el espacio de referencia menos uno, y se informa junto a su límite de agarre de 2 arctan 0,35, 38,6 grados, sin condicionar ningún resultado.</>}
      />
      <Equation
        tex={String.raw`Q = \max\!\Bigl(0,\; Q_{\mathrm{ref}}\,\frac{\mathrm{CSS} + T/2}{g_{\mathrm{ref}}}\; s\,e^{\,1-s}\Bigr), \qquad s = \frac{n}{n_{\mathrm{opt}}}, \qquad Q_{\mathrm{ref}} = 647\ \text{on the calibrated cone}`}
        caption={t('The capacity as coded: Q is the throughput (t/h), Q_ref the reference capacity of the machine (t/h), CSS the closed-side setting and T the throw (mm), g_ref the reference gap of the machine (mm), n the eccentric speed and n_opt its optimum (rpm).', 'La capacidad tal como está codificada: Q es la capacidad (t/h), Q_ref la capacidad de referencia de la máquina (t/h), CSS el ajuste de lado cerrado y T la carrera (mm), g_ref el espacio de referencia de la máquina (mm), n la velocidad excéntrica y n_opt su óptimo (rpm).')}
      />
      <P
        en={<>The power is computed after the product, because it needs the F80 of the feed and the P80 the solve has just produced. Both sizes are converted from millimetres to micrometres, the specific energy of Bond is ten times the work index times the difference of the reciprocal square roots of P80 and F80, in kWh per tonne, and the net draw is that energy times the capacity, floored at zero, with a zero result when either size is not positive <Cite id="bond1952" />. On the synthetic machines the Bond draw is the power. On the calibrated lane the draw is passed through the current-based form of the paper, 1.30 times the draw plus 110 kW, computed with the blend work index of 9.0 kWh/t <Cite id="rocha2024" />; the Methodology page reports why that form does not reproduce the measured power and the Benchmark page gives the numbers from the committed artifact.</>}
        es={<>La potencia se calcula después del producto, porque necesita el F80 del alimento y el P80 que la solución acaba de producir. Ambos tamaños se convierten de milímetros a micrones, la energía específica de Bond es diez veces el índice de trabajo por la diferencia de los inversos de las raíces cuadradas de P80 y F80, en kWh por tonelada, y el consumo neto es esa energía por la capacidad, acotado en cero, con resultado cero cuando alguno de los tamaños no es positivo <Cite id="bond1952" />. En las máquinas sintéticas el consumo de Bond es la potencia. En la vía calibrada el consumo pasa por la forma basada en corriente del artículo, 1,30 por el consumo más 110 kW, calculada con el índice de trabajo de la mezcla de 9,0 kWh/t <Cite id="rocha2024" />; la página Metodología informa por qué esa forma no reproduce la potencia medida y la página Benchmark entrega las cifras del artefacto comprometido.</>}
      />
      <Equation
        tex={String.raw`P_d = \max\!\Bigl(0,\; 10\,W_i\bigl(P_{80}^{-1/2} - F_{80}^{-1/2}\bigr)\,Q\Bigr), \qquad P = \begin{cases} P_d & \text{synthetic machine} \\ 1.30\,P_d + 110 & \text{calibrated cone} \end{cases}`}
        caption={t('The power as coded: W_i is the Bond work index (kWh/t), P80 and F80 are taken in micrometres inside the formula, Q is the capacity (t/h), P_d the net Bond draw (kW) and P the reported power (kW).', 'La potencia tal como está codificada: W_i es el índice de trabajo de Bond (kWh/t), P80 y F80 se toman en micrones dentro de la fórmula, Q es la capacidad (t/h), P_d el consumo neto de Bond (kW) y P la potencia informada (kW).')}
      />
      <Callout variant="note" title={t('Where it works and where it fails', 'Dónde funciona y dónde falla')}>
        {t(
          'The capacity keeps the right shape: it rises with the opening, it peaks at the optimum speed and it falls past it. Its per-machine constants are illustrative references and only the calibrated cone carries a measured base. The power is exact Bond arithmetic on the engine product, and Bond is a known poor descriptor of coarse crushing; on the survey lane the engine does not reproduce the measured power, which is estimated from the motor current, so the modelled kilowatts are never presented as a prediction there.',
          'La capacidad conserva la forma correcta: sube con la apertura, tiene su máximo en la velocidad óptima y cae después. Sus constantes por máquina son referencias ilustrativas y solo el cono calibrado lleva una base medida. La potencia es aritmética exacta de Bond sobre el producto del motor, y Bond es un descriptor pobre y conocido del chancado grueso; en la vía de muestreos el motor no reproduce la potencia medida, que se estima desde la corriente del motor, así que los kilowatts modelados nunca se presentan allí como una predicción.',
        )}
      </Callout>
    </DocSection>
  );
}

export function EnvelopeGate() {
  const t = useT();
  return (
    <DocSection title={{ en: 'The engine checks and the envelope gate', es: 'Las verificaciones del motor y la compuerta de envolvente' }} area="engine" refs={['rocha2024']}>
      <P
        en={<>An empirical model must flag an implausible or out-of-calibration input and never answer it with a confident number, so every evaluation ends with its checks, in a fixed order. A setting at or above the feed F80 sets the pass-through regime, and a setting at or above the 256 mm top size of the grid makes the point invalid with the regime invalid. A reduction ratio under 1.05 on a still valid point is flagged as negligible breakage. A conditioning proxy that is not finite or above one million makes the point invalid. Then the envelope gate adds its codes, and a physically implausible input is invalid too. A choke-fed chamber is the default regime; a trickle-fed state exists in the type and in some cases but the engine never assigns it.</>}
        es={<>Un modelo empírico debe marcar una entrada inverosímil o fuera de calibración y nunca responderla con un número confiado, así que cada evaluación termina con sus verificaciones, en un orden fijo. Un ajuste igual o mayor que el F80 del alimento fija el régimen de paso directo, y un ajuste igual o mayor que el tamaño máximo de 256 mm de la malla vuelve inválido el punto con el régimen inválido. Una razón de reducción menor que 1,05 en un punto aún válido se marca como fractura despreciable. Un indicador de condicionamiento no finito o sobre un millón vuelve inválido el punto. Luego la compuerta de envolvente agrega sus códigos, y una entrada físicamente inverosímil también es inválida. Una cámara alimentada hasta el atoro es el régimen por defecto; un estado de alimentación a goteo existe en el tipo y en algunos casos pero el motor nunca lo asigna.</>}
      />
      <P
        en={<>The gate has two layers. The first holds on every lane and is physical: a closed-side setting at or below zero, a feed size at or below zero, or a setting at or above the F80 of the feed are implausible, and the point is marked not valid. The second holds only on the calibrated cone lane and is a support check: the HP500 fit <Cite id="rocha2024" /> is supported for a setting from 38 to 55 mm and an F80 from 47 to 140 mm, and a point outside either range is flagged as extrapolating but is not made invalid. The engine writes stable codes, five from the gate and four from its own checks, into the manifest; the bilingual text of a code lives in the web, which maps the engine's sentences back to their codes and raises an error on a sentence it does not know, so a flag can never disappear quietly.</>}
        es={<>La compuerta tiene dos capas. La primera rige en toda vía y es física: un ajuste de lado cerrado igual o menor que cero, un tamaño de alimento igual o menor que cero, o un ajuste igual o mayor que el F80 del alimento son inverosímiles, y el punto se marca como no válido. La segunda rige solo en la vía calibrada del cono y es una verificación de soporte: el ajuste HP500 <Cite id="rocha2024" /> está respaldado para un ajuste de 38 a 55 mm y un F80 de 47 a 140 mm, y un punto fuera de cualquiera de los rangos se marca como extrapolación pero no se vuelve inválido. El motor escribe códigos estables, cinco de la compuerta y cuatro de sus propias verificaciones, en el manifiesto; el texto bilingüe de un código vive en la web, que traduce las frases del motor de vuelta a sus códigos y lanza un error ante una frase que no conoce, de modo que una marca nunca desaparece en silencio.</>}
      />
      <Equation
        tex={String.raw`\text{implausible} \iff \mathrm{CSS} \le 0 \ \lor\ x_{63} \le 0 \ \lor\ \mathrm{CSS} \ge F_{80}, \qquad \text{extrapolating} \iff \mathrm{CSS} \notin [38, 55] \ \lor\ F_{80} \notin [47, 140]`}
        caption={t('The two layers of the gate: CSS is the closed-side setting, x_63 the Rosin-Rammler size of the feed and F_80 the feed size at 80 percent passing, all in millimetres; the second condition applies only to the calibrated secondary cone, and its two intervals are the range of the ten surveys.', 'Las dos capas de la compuerta: CSS es el ajuste de lado cerrado, x_63 el tamaño de Rosin-Rammler del alimento y F_80 el tamaño del alimento al 80 por ciento pasante, todos en milímetros; la segunda condición rige solo para el cono secundario calibrado, y sus dos intervalos son el rango de los diez muestreos.')}
      />
      <Callout variant="note" title={t('Where it works and where it fails', 'Dónde funciona y dónde falla')}>
        {t(
          'It works as a screen for nonsensical and out-of-support inputs, with a reason that a reader can read. It is a set of rules and not a statistical test: the support is the bounding box of the ten surveys, so a point inside the box can still be far from every survey, and a point just outside it is flagged even when the fit would extrapolate well. The autoencoder of the Learned group is the learned complement, scored beside this gate on the same points.',
          'Funciona como filtro de entradas sin sentido y fuera de soporte, con una razón que un lector puede leer. Es un conjunto de reglas y no una prueba estadística: el soporte es la caja envolvente de los diez muestreos, así que un punto dentro de la caja aún puede estar lejos de todos los muestreos, y un punto apenas fuera se marca aunque el ajuste extrapolara bien. El autocodificador del grupo Aprendido es el complemento aprendido, evaluado junto a esta compuerta sobre los mismos puntos.',
        )}
      </Callout>
    </DocSection>
  );
}
