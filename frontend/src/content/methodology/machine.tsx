// Topics 5 and 6 of the Methodology: capacity and the nip angle, and the power models.
import { Callout, Cite, DocSection, Equation, Figure, useFormat } from '@fasl-work/caos-app-shell';
import { P, useT } from '../bi';
import { CapacityFigure, PowerFigure } from './figures';

export function Capacity() {
  const t = useT();
  const f = useFormat();
  // [machine, Q_ref, n_opt, g_ref], read from the capacity model of the engine.
  const rows: [string, number, number, number][] = [
    ['cone-sec', 520, 360, 38],
    ['cone-tert', 240, 400, 16],
    ['cone-short-head', 200, 480, 12],
    ['gyratory', 4500, 150, 175],
    ['jaw', 700, 300, 110],
  ];
  const names: Record<string, [string, string]> = {
    'cone-sec': ['Secondary cone', 'Cono secundario'],
    'cone-tert': ['Tertiary cone', 'Cono terciario'],
    'cone-short-head': ['Short-head cone', 'Cono de cabeza corta'],
    gyratory: ['Primary gyratory', 'Giratorio primario'],
    jaw: ['Primary jaw', 'Mandíbula primaria'],
  };
  return (
    <DocSection title={{ en: 'Capacity and the nip angle', es: 'Capacidad y ángulo de mordida' }} area="method" kind="classical" refs={['evertsson2000', 'evertsson1999', 'hulthen2009']}>
      <P
        en={<>Throughput is unimodal in the eccentric speed, the capacity hump. At low speed the chamber discharges slowly; past an optimum the gyrating head obstructs free fall faster than gravity can clear the material, and capacity falls <Cite id="evertsson2000" />. The engine uses a reduced parametric form of that flow model: the hump s times e to the power 1 minus s, which peaks at one when the speed equals the optimum speed of the machine, multiplied by a reference capacity and by an opening factor.</>}
        es={<>La capacidad es unimodal en la velocidad excéntrica, la joroba de capacidad. A baja velocidad la cámara descarga lento; pasado un óptimo, la cabeza giratoria obstruye la caída libre más rápido de lo que la gravedad despeja el material, y la capacidad cae <Cite id="evertsson2000" />. El motor usa una forma paramétrica reducida de ese modelo de flujo: la joroba s por e elevado a 1 menos s, que tiene su máximo en uno cuando la velocidad iguala la velocidad óptima de la máquina, multiplicada por una capacidad de referencia y por un factor de apertura.</>}
      />
      <Equation
        tex={String.raw`Q = Q_{\mathrm{ref}}\ \frac{\mathrm{CSS} + T/2}{g_{\mathrm{ref}}}\ s\,e^{\,1-s}, \qquad s = \frac{n}{n_{\mathrm{opt}}}`}
        caption={t('The capacity model: Q is the throughput (t/h), Q_ref the reference capacity of the machine (t/h), CSS the closed-side setting and T the eccentric throw (mm), g_ref the reference discharge gap of the machine (mm), n the eccentric speed and n_opt its optimum (rpm); the factor s e^(1-s) peaks at 1 when s = 1.', 'El modelo de capacidad: Q es la capacidad (t/h), Q_ref la capacidad de referencia de la máquina (t/h), CSS el lado cerrado y T la carrera excéntrica (mm), g_ref el espacio de descarga de referencia de la máquina (mm), n la velocidad excéntrica y n_opt su óptimo (rpm); el factor s e^(1-s) tiene su máximo en 1 cuando s = 1.')}
      />
      <table className="caos-table" data-state="ready">
        <caption>{t('The reference constants of the capacity model.', 'Las constantes de referencia del modelo de capacidad.')}</caption>
        <thead>
          <tr>
            <th>{t('Machine', 'Máquina')}</th>
            <th>Q_ref (t/h)</th>
            <th>n_opt (rpm)</th>
            <th>g_ref (mm)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([id, q, n, g]) => (
            <tr key={id}>
              <td>{t(names[id][0], names[id][1])}</td>
              <td>{f(q, { decimals: 0 })}</td>
              <td>{f(n, { decimals: 0 })}</td>
              <td>{f(g, { decimals: 0 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Figure caption={t('Throughput of the reference secondary cone (CSS 32 mm) against eccentric speed for three throws, computed by the engine; the peak sits at the optimum speed of 360 rpm and a larger throw raises the whole curve.', 'Capacidad del cono secundario de referencia (CSS 32 mm) frente a la velocidad excéntrica con tres carreras, calculada por el motor; el máximo está en la velocidad óptima de 360 rpm y una carrera mayor levanta toda la curva.')}>
        <CapacityFigure />
      </Figure>
      <P
        en={<>The opening factor is the effective discharge gap, the closed-side setting plus half the throw (the mean gap over a revolution), divided by the reference gap of the machine, so a wider setting or a longer throw raises the capacity. The throw enters at half weight, a deliberate simplification: the engine does not carry a residence-time term, so its sensitivity to throw is milder than the spread of manufacturer figures. The optimum speed is a fixed constant of each machine and does not shift with the throw.</>}
        es={<>El factor de apertura es el espacio efectivo de descarga, el lado cerrado más la mitad de la carrera (el espacio medio durante una vuelta), dividido por el espacio de referencia de la máquina, de modo que un ajuste mayor o una carrera más larga elevan la capacidad. La carrera entra con medio peso, una simplificación deliberada: el motor no lleva un término de tiempo de residencia, así que su sensibilidad a la carrera es más suave que la dispersión de las cifras de los fabricantes. La velocidad óptima es una constante fija de cada máquina y no se desplaza con la carrera.</>}
      />
      <Equation
        tex={String.raw`\alpha = \alpha_0 + 3\left(\frac{\mathrm{CSS}}{g_{\mathrm{ref}}} - 1\right)\ \text{deg}, \qquad \alpha \le \alpha_{\lim} = 2\arctan\mu, \quad \mu = 0.35\ \Rightarrow\ \alpha_{\lim} = 38.6^{\circ}`}
        caption={t('The nip angle and its grip limit: alpha is the angle of the wedge between mantle and concave in degrees, alpha_0 its base value (22 degrees for every machine but the jaw, 19 for the jaw), g_ref the reference gap of the table, mu the friction between rock and liner and alpha_lim the largest angle that still grips a particle.', 'El ángulo de mordida y su límite de agarre: alfa es el ángulo de la cuña entre manto y cóncavo en grados, alfa_0 su valor base (22 grados para toda máquina salvo la mandíbula, 19 para la mandíbula), g_ref el espacio de referencia de la tabla, mu la fricción entre roca y revestimiento y alfa_lim el mayor ángulo que aún agarra una partícula.')}
      />
      <P
        en="A particle is nipped, and not squeezed upward and out, only while the nip angle stays below twice the arctangent of the friction coefficient. The engine's nip angle is static wall geometry that depends on the setting alone, not on the throw, and the cyclic opening of the gap over a revolution is not modelled; the live chamber drawing computes its own angle from the wall slopes of the profile it draws, for the picture only. The friction coefficient of 0.35 is an assumed value."
        es="Una partícula es mordida, y no apretada hacia arriba y hacia afuera, solo mientras el ángulo de mordida se mantiene bajo el doble de la arcotangente del coeficiente de fricción. El ángulo de mordida del motor es geometría estática de las paredes que depende solo del ajuste, no de la carrera, y la apertura cíclica del espacio durante una vuelta no se modela; el dibujo vivo de la cámara calcula su propio ángulo con las pendientes de las paredes del perfil que dibuja, solo para la imagen. El coeficiente de fricción de 0,35 es un valor supuesto."
      />
      <P
        en={<>The regime of an operating point follows from the gradation. A point is pass-through when the setting is at or above the feed F80, so most material passes ungripped, or when the reduction ratio is below 1.05, and it is invalid when the setting reaches the top size of the feed. A choke-fed chamber is the default and the only regime for which the capacity formula is meant. A trickle-fed state exists in the type and in the catalog cases, but the engine never assigns it. Real-time control of a cone crusher acts on exactly the two levers of this page, the setting and the speed <Cite id="hulthen2009" />.</>}
        es={<>El régimen de un punto de operación se deduce de la granulometría. Un punto es de paso directo cuando el ajuste está en el F80 del alimento o sobre él, de modo que la mayor parte del material pasa sin ser agarrada, o cuando la razón de reducción es menor que 1,05, y es inválido cuando el ajuste alcanza el tamaño máximo del alimento. Una cámara alimentada hasta el atoro es el caso por defecto y el único régimen para el que está pensada la fórmula de capacidad. Un estado de alimentación a goteo existe en el tipo y en los casos del catálogo, pero el motor nunca lo asigna. El control en tiempo real de un chancador de cono actúa sobre las dos palancas exactas de esta página, el ajuste y la velocidad <Cite id="hulthen2009" />.</>}
      />
      <Callout variant="honest" title={t('Exact and illustrative', 'Exacto e ilustrativo')}>
        {t('The formulas are exact as coded. The constants of the table are illustrative per-machine references that reproduce the shape of the hump and the direction of every effect, not the curve of a specific plant; only the calibrated lane replaces the secondary cone reference by 647 t/h from the published surveys. The nip angle and its limit are didactic geometry, and the trickle regime is not modelled.', 'Las fórmulas son exactas como están codificadas. Las constantes de la tabla son referencias ilustrativas por máquina que reproducen la forma de la joroba y el sentido de cada efecto, no la curva de una planta específica; solo la vía calibrada reemplaza la referencia del cono secundario por 647 t/h tomadas de las encuestas publicadas. El ángulo de mordida y su límite son geometría didáctica, y el régimen de goteo no se modela.')}
      </Callout>
    </DocSection>
  );
}

export function Power() {
  const t = useT();
  return (
    <DocSection title={{ en: 'Power: Bond and the current-based model', es: 'Potencia: Bond y el modelo basado en corriente' }} area="method" kind="classical" refs={['bond1952', 'rocha2024', 'morrell2009', 'grondahl2018']}>
      <P
        en={<>The classical power estimate is Bond's third theory of comminution: the specific energy needed to reduce a feed of size F80 to a product of size P80 is ten times the work index times the difference of the reciprocal square roots of the two sizes, with sizes in micrometres <Cite id="bond1952" />. The engine multiplies it by the throughput of the capacity model to obtain the net draw in kilowatts, using the F80 of the feed and the P80 that the Whiten solve has just produced.</>}
        es={<>La estimación clásica de potencia es la tercera teoría de la conminución de Bond: la energía específica necesaria para reducir un alimento de tamaño F80 a un producto de tamaño P80 es diez veces el índice de trabajo por la diferencia de los inversos de las raíces cuadradas de ambos tamaños, con los tamaños en micrones <Cite id="bond1952" />. El motor la multiplica por la capacidad del modelo de capacidad para obtener el consumo neto en kilowatts, usando el F80 del alimento y el P80 que la solución de Whiten acaba de producir.</>}
      />
      <Equation
        tex={String.raw`W = 10\,W_i\left(\frac{1}{\sqrt{P_{80}}} - \frac{1}{\sqrt{F_{80}}}\right)\ \ \mathrm{kWh/t}, \qquad P_d = W\,Q\ \ \mathrm{kW}`}
        caption={t('Bond power: W is the specific energy (kWh/t), W_i the Bond work index of the ore (kWh/t), F80 and P80 the 80 % passing sizes of feed and product (micrometres in the formula), Q the throughput (t/h) and P_d the net comminution draw (kW).', 'Potencia de Bond: W es la energía específica (kWh/t), W_i el índice de trabajo de Bond del mineral (kWh/t), F80 y P80 los tamaños al 80 % pasante del alimento y del producto (micrones en la fórmula), Q la capacidad (t/h) y P_d el consumo neto de conminución (kW).')}
      />
      <Figure caption={t('Bond specific energy against the product size P80 for three work indices, with the feed F80 fixed at 100 mm, computed by the engine; the energy rises steeply as the product gets finer.', 'Energía específica de Bond frente al tamaño del producto P80 con tres índices de trabajo, con el F80 del alimento fijo en 100 mm, calculada por el motor; la energía sube con fuerza a medida que el producto se vuelve más fino.')}>
        <PowerFigure />
      </Figure>
      <P
        en={<>Bond's law was calibrated for grinding and is a known poor descriptor of coarse crushing duty, and the size-specific energy of Morrell is the documented alternative <Cite id="morrell2009" />. The engine keeps Bond because it is the classical baseline of the method: it is cheap, it needs one ore parameter and it is the reference against which a better power model has to be judged. Its draw is net, with no no-load power, and it is zero when the product is not finer than the feed.</>}
        es={<>La ley de Bond se calibró para la molienda y es un descriptor pobre y conocido del trabajo de chancado grueso, y la energía específica por tamaño de Morrell es la alternativa documentada <Cite id="morrell2009" />. El motor conserva Bond porque es la línea base clásica del método: es barata, necesita un parámetro del mineral y es la referencia contra la cual debe juzgarse un modelo de potencia mejor. Su consumo es neto, sin potencia en vacío, y es cero cuando el producto no es más fino que el alimento.</>}
      />
      <Equation
        tex={String.raw`P_c = \zeta\, P_d + P_n, \qquad \zeta = 1.30, \quad P_n = 110\ \mathrm{kW}`}
        caption={t('The current-based form of the paper, Table 5: P_c is the crusher power (kW), P_d the size-specific net power of the paper (kW), zeta a dimensionless factor and P_n the no-load power (kW).', 'La forma basada en corriente del artículo, Tabla 5: P_c es la potencia del chancador (kW), P_d la potencia neta por tamaño del artículo (kW), zeta un factor sin dimensión y P_n la potencia en vacío (kW).')}
      />
      <P
        en={<>The paper reports a linear power model with a factor of 1.30 and a no-load power of 110 kW, where the net power is a size-specific quantity of the paper's own model, not the classical Bond draw <Cite id="rocha2024" />. The engine applies the form to its Bond draw on the calibrated lane. Release 0.06.000 graded that choice against the ten measured powers and the result was a negative: the Bond draw is nearly flat across the surveys while the measured power varies widely with the setting, so the form with the paper constants overshoots, and refitting its two constants collapses toward the survey mean. The measured power is therefore the reference shown on the real lane, and the modelled kilowatts are never presented as a prediction. Another study read feed segregation from power-draw signatures <Cite id="grondahl2018" />.</>}
        es={<>El artículo informa un modelo lineal de potencia con un factor de 1,30 y una potencia en vacío de 110 kW, donde la potencia neta es una cantidad por tamaño del propio modelo del artículo, no el consumo clásico de Bond <Cite id="rocha2024" />. El motor aplica la forma a su consumo de Bond en la vía calibrada. La versión 0.06.000 evaluó esa decisión contra las diez potencias medidas y el resultado fue negativo: el consumo de Bond es casi plano en las encuestas mientras la potencia medida varía mucho con el ajuste, de modo que la forma con las constantes del artículo sobrestima, y reajustar sus dos constantes colapsa hacia el promedio de las encuestas. Por eso la potencia medida es la referencia que se muestra en la vía real, y los kilowatts modelados nunca se presentan como una predicción. Otro estudio leyó la segregación del alimento en las firmas de la potencia consumida <Cite id="grondahl2018" />.</>}
      />
      <P
        en={<>The honest reading is that the engine carries no skill for power on the measured surveys, and that the capacity of the calibrated lane, not its power, is where the model meets the data. Closing the gap would require reconstructing the size-specific power of the paper, or digitising its size distributions to obtain an independent measured P80, and until then the power path is a documented limitation and not a result. The figures behind this statement are on the Benchmark page, read from the committed artifact.</>}
        es={<>La lectura honesta es que el motor no tiene habilidad para la potencia en las encuestas medidas, y que la capacidad de la vía calibrada, no su potencia, es donde el modelo se encuentra con los datos. Cerrar la brecha exigiría reconstruir la potencia por tamaño del artículo, o digitalizar sus distribuciones de tamaño para obtener un P80 medido independiente, y hasta entonces la ruta de potencia es una limitación documentada y no un resultado. Las cifras detrás de esta afirmación están en la página Benchmark, leídas del artefacto comprometido.</>}
      />
      <Callout variant="honest" title={t('A known negative', 'Un negativo conocido')}>
        {t('Bond is an exact formula applied to illustrative inputs: on the synthetic machines the draw is a didactic estimate. On the HP500 lane the paper form is applied outside its original definition and does not reproduce the measured power, which is itself estimated from the motor current and not from a dynamometer. No claim of removing a coarse-duty overprediction of Bond is made anywhere.', 'Bond es una fórmula exacta aplicada a entradas ilustrativas: en las máquinas sintéticas el consumo es una estimación didáctica. En la vía HP500 la forma del artículo se aplica fuera de su definición original y no reproduce la potencia medida, que a su vez se estima a partir de la corriente del motor y no de un dinamómetro. En ninguna parte se afirma haber eliminado una sobrestimación de Bond en chancado grueso.')}
      </Callout>
    </DocSection>
  );
}
