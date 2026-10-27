// Topic 2 of the Methodology: the energy of a nip, the JKMRC t10 relation, the Austin appearance function and the breakage matrix.
import { Callout, Cite, DocSection, Equation, Figure } from '@fasl-work/caos-app-shell';
import { P, useT } from '../bi';
import { BreakageFigure, FlowDiagram } from './figures';

export function Breakage() {
  const t = useT();
  return (
    <DocSection title={{ en: 'Breakage energy and the appearance function', es: 'Energía de fractura y función de aparición' }} area="method" kind="classical" refs={['evertsson1999', 'napiermunn1996', 'tavares2021', 'austin1984']}>
      <P
        en={<>How finely a particle breaks depends on the energy it receives. The engine computes one specific comminution energy per nip, in kWh per tonne, as 0.033 times the design throw of the machine in millimetres times the ratio of the eccentric speed to a reference speed of 350 rpm. It uses the design throw of each machine (30 mm for the secondary cone, 16 for the tertiary cones, 30 for the gyratory, 38 for the jaw) and not the throw slider, on purpose: throw acts on the product through the classification window, because routing it into the energy would make more throw give a finer product, the opposite of the flow model <Cite id="evertsson1999" />.</>}
        es={<>La finura con que se rompe una partícula depende de la energía que recibe. El motor calcula una energía específica de conminución por mordida, en kWh por tonelada, como 0,033 por la carrera de diseño de la máquina en milímetros por el cociente entre la velocidad excéntrica y una velocidad de referencia de 350 rpm. Usa la carrera de diseño de cada máquina (30 mm el cono secundario, 16 los conos terciarios, 30 el giratorio, 38 la mandíbula) y no el control de carrera, a propósito: la carrera actúa sobre el producto a través de la ventana de clasificación, porque llevarla a la energía haría que más carrera diera un producto más fino, lo contrario del modelo de flujo <Cite id="evertsson1999" />.</>}
      />
      <Equation
        tex={String.raw`E_{cs} = 0.033\, T_{\mathrm{ref}}\, \frac{n}{350}\ \ \mathrm{kWh/t}, \qquad t_{10} = \min\!\Big(0.44,\ \max\!\Big(0,\ \frac{A\,\big(1 - e^{-b\,E_{cs}}\big)}{100}\Big)\Big), \quad b = \frac{A\,b}{A},\ A = 60`}
        caption={t('Energy to fineness: E_cs is the specific energy per nip (kWh/t), T_ref the design throw of the machine (mm), n the eccentric speed (rpm), t10 the fraction of progeny passing one tenth of the parent size, A and b the drop-weight parameters of the ore (the product A times b is the slider; A is fixed at 60 in the code) and 0.44 the cap that the appearance function can represent.', 'De la energía a la finura: E_cs es la energía específica por mordida (kWh/t), T_ref la carrera de diseño de la máquina (mm), n la velocidad excéntrica (rpm), t10 la fracción de progenie que pasa un décimo del tamaño madre, A y b los parámetros de caída de peso del mineral (el producto A por b es el control; A se fija en 60 en el código) y 0,44 el tope que la función de aparición puede representar.')}
      />
      <P
        en={<>The JKMRC drop-weight test describes an ore by two parameters, A and b, whose product A times b is the single hardness index (a lower value is a tougher ore). It relates fineness to energy through the saturating curve above, where t10 is the share of the progeny that passes one tenth of the parent size <Cite id="napiermunn1996" /> <Cite id="tavares2021" />. The engine takes A as 60 and derives b from the A times b slider, then caps t10 at 0.44 so that the displayed value always matches the breakage matrix built from it.</>}
        es={<>El ensayo de caída de peso del JKMRC describe un mineral con dos parámetros, A y b, cuyo producto A por b es el índice único de dureza (un valor menor es un mineral más tenaz). Relaciona la finura con la energía mediante la curva saturante de arriba, donde t10 es la parte de la progenie que pasa un décimo del tamaño madre <Cite id="napiermunn1996" /> <Cite id="tavares2021" />. El motor toma A como 60 y deriva b del control de A por b, y luego limita t10 a 0,44 para que el valor mostrado coincida siempre con la matriz de fractura construida a partir de él.</>}
      />
      <Equation
        tex={String.raw`B(u) = \Phi\, u^{\gamma} + (1-\Phi)\, u^{\beta}, \quad \gamma = 0.35,\ \beta = 4.2, \qquad \Phi = \mathrm{clamp}_{[0.02,\,0.98]}\!\left(\frac{t_{10} - 0.1^{\beta}}{0.1^{\gamma} - 0.1^{\beta}}\right)`}
        caption={t('The Austin cumulative breakage function: B(u) is the fraction of the progeny finer than the relative size u = x / parent size, gamma the fines-end slope, beta the coarse-end slope and Phi the weight between them, solved so that B(1/10) equals t10.', 'La función de fractura acumulada de Austin: B(u) es la fracción de la progenie más fina que el tamaño relativo u = x / tamaño madre, gamma la pendiente del extremo fino, beta la del extremo grueso y Phi el peso entre ambas, resuelto para que B(1/10) sea igual a t10.')}
      />
      <Figure caption={t('The cumulative breakage function for three values of t10, all computed from the engine; every curve passes through its t10 at the relative size 1/10 and reaches 100 % at u = 1.', 'La función de fractura acumulada para tres valores de t10, todas calculadas con el motor; cada curva pasa por su t10 en el tamaño relativo 1/10 y llega a 100 % en u = 1.')}>
        <BreakageFigure />
      </Figure>
      <Figure caption={t('The steps from the energy of a nip to the breakage matrix.', 'Los pasos desde la energía de una mordida hasta la matriz de fractura.')}>
        <FlowDiagram topic="breakage" />
      </Figure>
      <P
        en={<>The shape of the progeny follows the Austin cumulative breakage function <Cite id="austin1984" />, with the slopes fixed in the code. At full weight on the fines term the curve reaches 0.1 to the power 0.35, which is 0.447, at one tenth of the size, so no larger t10 can be represented; this is why the cap is 0.44. An earlier slope of 0.62 capped at about 0.24 and silently clamped the weight, so the displayed t10 disagreed with the matrix, and the code comment records that defect.</>}
        es={<>La forma de la progenie sigue la función de fractura acumulada de Austin <Cite id="austin1984" />, con las pendientes fijas en el código. Con todo el peso en el término de finos la curva llega a 0,1 elevado a 0,35, que es 0,447, a un décimo del tamaño, de modo que no puede representarse un t10 mayor; por eso el tope es 0,44. Una pendiente anterior de 0,62 topaba cerca de 0,24 y limitaba el peso en silencio, así que el t10 mostrado discrepaba de la matriz, y el comentario del código registra ese defecto.</>}
      />
      <Equation
        tex={String.raw`b_{ij} = \frac{\max\!\big(0,\ B\big(\min(e_i, y_j)/y_j\big) - B\big(e_{i+1}/y_j\big)\big)}{\sum_{k>j} \max\!\big(0,\ B\big(\min(e_k, y_j)/y_j\big) - B\big(e_{k+1}/y_j\big)\big)}\ \ (i>j), \qquad b_{ij} = 0\ \ (i \le j)`}
        caption={t('The breakage matrix: b_ij is the mass fraction of broken class-j material that reports to the finer class i, built from the appearance function B with the sieve edges e_i and the parent mid-size y_j; every column is divided by its own sum, so broken mass is conserved exactly.', 'La matriz de fractura: b_ij es la fracción de masa del material roto de la clase j que va a la clase más fina i, construida con la función de aparición B, los bordes e_i y el tamaño medio y_j del padre; cada columna se divide por su propia suma, de modo que la masa rota se conserva exactamente.')}
      />
      <P
        en="The matrix is strictly lower-triangular: progeny reports only to classes that are strictly finer than the parent, so the diagonal is zero. That is the property the solve relies on. The product of the matrix with the classification diagonal also has a zero diagonal, the system matrix built from it has a unit diagonal, and its determinant is one, so the Whiten solve cannot be singular. The family t2, t4, t10, t25, t50 and t75 is read from the same function at the relative sizes one over n."
        es="La matriz es estrictamente triangular inferior: la progenie va solo a clases estrictamente más finas que el padre, de modo que la diagonal es cero. Esa es la propiedad en que se apoya la solución. El producto de la matriz con la diagonal de clasificación también tiene diagonal cero, la matriz del sistema construida con él tiene diagonal unitaria y su determinante es uno, así que la solución de Whiten no puede ser singular. La familia t2, t4, t10, t25, t50 y t75 se lee de la misma función en los tamaños relativos uno sobre n."
      />
      <Callout variant="honest" title={t('Exact and illustrative', 'Exacto e ilustrativo')}>
        {t('The formulas, the slopes and the cap are exact as the code runs them. The energy scale is didactic: the factor 0.033 and the 350 rpm reference put the energy in the band of about 0.3 to 2.5 kWh/t and are not a measured plant energy, A is assumed, the coarse slope 4.2 lies in the 3 to 6 range without being fitted, and the A times b of the synthetic ores is not a measured value. On the HP500 lane t10 comes from the published fit instead.', 'Las fórmulas, las pendientes y el tope son exactos como los ejecuta el código. La escala de energía es didáctica: el factor 0,033 y la referencia de 350 rpm ponen la energía en la banda de unos 0,3 a 2,5 kWh/t y no son una energía de planta medida, A es supuesto, la pendiente gruesa 4,2 está en el rango de 3 a 6 sin haber sido ajustada, y el A por b de los minerales sintéticos no es un valor medido. En la vía HP500 el t10 sale en cambio del ajuste publicado.')}
      </Callout>
    </DocSection>
  );
}
