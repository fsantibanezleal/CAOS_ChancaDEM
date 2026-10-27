// Area 3 of the Introduction's technical view: the governing mathematics with the constants of the engine
// (`frontend/src/engine/`: feed.ts, sieve.ts, whiten.ts, classification.ts, breakage.ts, capacity.ts), each equation
// captioned with its symbols, and the symbol glossary with units.
import { DocSection, Equation, Glossary } from '@fasl-work/caos-app-shell';
import { P, useT } from '../bi';

export function MathSection() {
  const t = useT();
  return (
    <DocSection title={{ en: 'The mathematics', es: 'La matemática' }} area="math" refs={['rosin1933', 'whiten1972', 'andersen1988', 'evertsson1999', 'napiermunn1996', 'austin1984', 'evertsson2000', 'bond1952', 'rocha2024']}>
      <P
        en="The engine is a chain of eight relations. The first fixes the sieve grid and the feed, the next four build the two operators of the balance and solve it for the product, the next two give the capacity and the power, and the last states the calibrated lane for the HP500 surveys. The product size P80 is read from the solved product by log-linear interpolation on the passing curve, and every size is in millimetres, every throughput in tonnes per hour and every power in kilowatts."
        es="El motor es una cadena de ocho relaciones. La primera fija la grilla de tamices y la alimentación, las cuatro siguientes construyen los dos operadores del balance y lo resuelven para el producto, las dos siguientes dan la capacidad y la potencia, y la última enuncia el carril calibrado para los muestreos HP500. El tamaño del producto P80 se lee del producto resuelto por interpolación log-lineal sobre la curva de pasante, y todo tamaño va en milímetros, toda capacidad en toneladas por hora y toda potencia en kilowatts."
      />
      <Equation
        tex={String.raw`e_i = \frac{256}{(\sqrt{2})^{\,i}}\ \text{mm},\ \ i = 0,\dots,28, \qquad R(x) = 1 - \exp\!\left[-\left(\frac{x}{x_{63}}\right)^{m}\right]`}
        caption={t('The sieve grid and the feed: e_i are the 29 aperture edges of the 28 classes, from 256 mm down to 0.0156 mm, and R(x) is the Rosin-Rammler fraction of the feed passing the size x (mm), with x63 the size at 63.2 percent passing (mm) and m the dimensionless uniformity exponent; the class mass is the difference of R at its two edges, renormalised to sum to one.', 'La grilla de tamices y la alimentación: e_i son los 29 bordes de abertura de las 28 clases, desde 256 mm hasta 0,0156 mm, y R(x) es la fracción de la alimentación que pasa el tamaño x (mm), con x63 el tamaño al 63,2 por ciento pasante (mm) y m el exponente de uniformidad, sin dimensión; la masa de cada clase es la diferencia de R en sus dos bordes, renormalizada para sumar uno.')}
      />
      <Equation
        tex={String.raw`p = (I - C)\,(I - B\,C)^{-1} f`}
        caption={t('The Whiten balance: f and p are the feed and the product as mass fractions over the 28 classes (dimensionless, each summing to one), C is the diagonal classification matrix, B the strictly lower-triangular breakage matrix and I the identity. The code never forms the inverse: it solves the linear system (I - B C) x = f by LU factorisation and applies (I - C) to x.', 'El balance de Whiten: f y p son la alimentación y el producto como fracciones de masa sobre las 28 clases (sin dimensión, cada una suma uno), C es la matriz diagonal de clasificación, B la matriz de fractura estrictamente triangular inferior e I la identidad. El código nunca forma la inversa: resuelve el sistema lineal (I - B C) x = f por factorización LU y aplica (I - C) a x.')}
      />
      <Equation
        tex={String.raw`C(d) = \begin{cases} 0 & d \le K_1 \\[2pt] 1 - \left(\dfrac{K_2 - d}{K_2 - K_1}\right)^{K_3} & K_1 < d < K_2 \\[6pt] 1 & d \ge K_2 \end{cases}`}
        caption={t('The classification function evaluated at the mid-size d of each class (mm): K1 is the size below which a particle always escapes (mm), K2 the size above which it is always broken (mm) and K3 the dimensionless shape exponent.', 'La función de clasificación evaluada en el tamaño medio d de cada clase (mm): K1 es el tamaño bajo el cual una partícula siempre escapa (mm), K2 el tamaño sobre el cual siempre se rompe (mm) y K3 el exponente de forma, sin dimensión.')}
      />
      <Equation
        tex={String.raw`K_1 = a_1 + b_1\,\mathrm{CSS}, \qquad K_2 = \max\!\Big(a_2 + b_2\,\mathrm{CSS} + \tfrac{1}{2}\, b_2\,(T - T_{\mathrm{ref}}),\ 1.05\,K_1\Big), \qquad \mathrm{OSS} = \mathrm{CSS} + T`}
        caption={t('The capture window of the synthetic machines: CSS is the closed-side setting (mm), T the eccentric throw (mm), T_ref the design throw of the machine (mm), OSS the open-side setting (mm), and a1, b1, a2, b2 and K3 constants per machine. For the secondary cone, a1 = 0.2 mm, b1 = 0.90, a2 = 6.0 mm, b2 = 1.95, K3 = 2.3 and T_ref = 30 mm; the other four machines have their own constants.', 'La ventana de captura de las máquinas sintéticas: CSS es el lado cerrado (mm), T la carrera excéntrica (mm), T_ref la carrera de diseño de la máquina (mm), OSS el lado abierto (mm), y a1, b1, a2, b2 y K3 constantes por máquina. Para el cono secundario, a1 = 0,2 mm, b1 = 0,90, a2 = 6,0 mm, b2 = 1,95, K3 = 2,3 y T_ref = 30 mm; las otras cuatro máquinas tienen sus propias constantes.')}
      />
      <Equation
        tex={String.raw`t_{10} = \min\!\Big(0.44,\ \tfrac{A\,(1 - e^{-b\,E_{cs}})}{100}\Big), \quad E_{cs} = 0.033\,T_{\mathrm{ref}}\,\frac{n}{350}, \qquad B(u) = \Phi\,u^{\gamma} + (1-\Phi)\,u^{\beta}, \quad \gamma = 0.35,\ \beta = 4.2`}
        caption={t('The breakage: t10 is the fraction of progeny passing a tenth of the parent size, E_cs the specific comminution energy (kWh/t) at the eccentric speed n (rpm), A the maximum t10 in percent (60 in the code) and b the energy sensitivity (t/kWh, with A b the ore competence), and B(u) the Austin cumulative breakage at the relative size u = x/y of a progeny of size x from a parent of size y. The share Phi (dimensionless) is solved so that B(1/10) = t10; the 0.44 cap keeps t10 below the largest value the function can reach, 0.1^γ = 0.447.', 'La fractura: t10 es la fracción de fragmentos que pasa una décima del tamaño madre, E_cs la energía específica de conminución (kWh/t) a la velocidad excéntrica n (rpm), A el t10 máximo en porcentaje (60 en el código) y b la sensibilidad a la energía (t/kWh, con A b la competencia del mineral), y B(u) la fractura acumulada de Austin al tamaño relativo u = x/y de un fragmento de tamaño x de una partícula madre de tamaño y. La proporción Phi (sin dimensión) se resuelve para que B(1/10) = t10; el tope de 0,44 mantiene t10 bajo el mayor valor que la función alcanza, 0,1^γ = 0,447.')}
      />
      <Equation
        tex={String.raw`Q = Q_{\mathrm{ref}}\ \frac{\mathrm{CSS} + T/2}{g_{\mathrm{ref}}}\ s\,e^{\,1-s}, \qquad s = \frac{n}{n_{\mathrm{opt}}}`}
        caption={t('The capacity: Q is the throughput (t/h), Q_ref the reference capacity of the machine (t/h), g_ref its reference discharge gap (mm), n the eccentric speed (rpm) and n_opt the speed of maximum capacity (rpm); the factor s e^(1-s) is one at s = 1 and falls on both sides, the capacity hump. For the secondary cone Q_ref = 520 t/h, g_ref = 38 mm and n_opt = 360 rpm.', 'La capacidad: Q es el caudal (t/h), Q_ref la capacidad de referencia de la máquina (t/h), g_ref su abertura de descarga de referencia (mm), n la velocidad excéntrica (rpm) y n_opt la velocidad de capacidad máxima (rpm); el factor s e^(1-s) vale uno en s = 1 y cae a ambos lados, la joroba de capacidad. Para el cono secundario Q_ref = 520 t/h, g_ref = 38 mm y n_opt = 360 rpm.')}
      />
      <Equation
        tex={String.raw`W = 10\,W_i\left(\frac{1}{\sqrt{P_{80}}} - \frac{1}{\sqrt{F_{80}}}\right)\ \mathrm{kWh/t}, \qquad P_d = W\,Q\ \mathrm{kW}, \qquad P_c = \zeta\,P_d + P_n,\ \ \zeta = 1.30,\ P_n = 110\ \mathrm{kW}`}
        caption={t('The power: W is the Bond work per tonne (kWh/t), W_i the Bond work index (kWh/t), P80 and F80 the 80 percent passing sizes of the product and the feed in micrometres (the code converts the millimetres of the grid), P_d the net draw (kW) and Q the throughput (t/h). On the calibrated lane the crusher power P_c (kW) adds the factor zeta (dimensionless) and the no-load power P_n (kW) of the HP500 fit.', 'La potencia: W es el trabajo de Bond por tonelada (kWh/t), W_i el índice de trabajo de Bond (kWh/t), P80 y F80 los tamaños al 80 por ciento pasante del producto y de la alimentación en micrómetros (el código convierte los milímetros de la grilla), P_d el consumo neto (kW) y Q la capacidad (t/h). En el carril calibrado la potencia del chancador P_c (kW) agrega el factor zeta (sin dimensión) y la potencia en vacío P_n (kW) del ajuste HP500.')}
      />
      <Equation
        tex={String.raw`K_1 = 0.23\,\mathrm{CSS} + 0.30\,f_{80}, \qquad K_2 = \max\!\big(12.0 + 0.55\,\mathrm{CSS} + 0.40\,f_{80},\ 1.05\,K_1\big), \qquad K_3 = 2.3, \qquad t_{10}\,[\%] = \min\!\big(44,\ \max(0,\ 64 - 0.12\,\mathrm{CSS} - 0.23\,f_{80})\big)`}
        caption={t('The calibrated lane for the ten HP500 surveys, linear in the closed-side setting CSS (mm) and the feed f80 (mm), with the fit of Rocha et al. 2024 (Table 5) and a capacity base of 647 t/h; it replaces the per-machine constants and the energy path above, holds for CSS from 38 to 55 mm and f80 from 47 to 140 mm, and its classification does not depend on the throw.', 'El carril calibrado para los diez muestreos HP500, lineal en el lado cerrado CSS (mm) y el f80 de la alimentación (mm), con el ajuste de Rocha et al. 2024 (Tabla 5) y una base de capacidad de 647 t/h; reemplaza las constantes por máquina y la vía de energía de arriba, vale para CSS de 38 a 55 mm y f80 de 47 a 140 mm, y su clasificación no depende de la carrera.')}
      />
      <Glossary
        entries={[
          { term: 'f, p', definition: { en: 'the feed and the product as mass fractions over the 28 size classes (dimensionless, each sums to one)', es: 'la alimentación y el producto como fracciones de masa sobre las 28 clases de tamaño (sin dimensión, cada una suma uno)' } },
          { term: 'e_i', definition: { en: 'the aperture edges of the sieve grid, 256 mm divided by (√2)^i (mm)', es: 'los bordes de abertura de la grilla de tamices, 256 mm dividido por (√2)^i (mm)' } },
          { term: 'x63, m', definition: { en: 'the Rosin-Rammler size at 63.2 percent passing (mm) and its uniformity exponent (dimensionless)', es: 'el tamaño de Rosin-Rammler al 63,2 por ciento pasante (mm) y su exponente de uniformidad (sin dimensión)' } },
          { term: 'C, B, I', definition: { en: 'the diagonal classification matrix, the strictly lower-triangular breakage matrix and the identity (dimensionless)', es: 'la matriz diagonal de clasificación, la matriz de fractura estrictamente triangular inferior y la identidad (sin dimensión)' } },
          { term: 'd', definition: { en: 'the mid-size of a size class (mm)', es: 'el tamaño medio de una clase de tamaño (mm)' } },
          { term: 'K1, K2, K3', definition: { en: 'the always-escape size (mm), the always-broken size (mm) and the shape exponent (dimensionless) of the classification', es: 'el tamaño de escape seguro (mm), el tamaño de rotura segura (mm) y el exponente de forma (sin dimensión) de la clasificación' } },
          { term: 'CSS, OSS', definition: { en: 'the closed-side and the open-side setting of the chamber (mm)', es: 'el lado cerrado y el lado abierto de la cámara (mm)' } },
          { term: 'T, T_ref', definition: { en: 'the eccentric throw and the design throw of the machine (mm)', es: 'la carrera excéntrica y la carrera de diseño de la máquina (mm)' } },
          { term: 'n, n_opt', definition: { en: 'the eccentric speed and the speed of maximum capacity (rpm)', es: 'la velocidad excéntrica y la velocidad de capacidad máxima (rpm)' } },
          { term: 'A, b', definition: { en: 'the ore breakage parameters of the drop-weight test: the maximum t10 (percent) and the energy sensitivity (t/kWh)', es: 'los parámetros de fractura del mineral del ensayo de caída de peso: el t10 máximo (porcentaje) y la sensibilidad a la energía (t/kWh)' } },
          { term: 'E_cs', definition: { en: 'the specific comminution energy delivered per nip (kWh/t)', es: 'la energía específica de conminución entregada por mordida (kWh/t)' } },
          { term: 't10', definition: { en: 'the fraction of progeny passing a tenth of the parent size (dimensionless)', es: 'la fracción de fragmentos que pasa una décima del tamaño madre (sin dimensión)' } },
          { term: 'u, Φ, γ, β', definition: { en: 'the relative size x/y, the fines share solved from t10, and the fines-end and coarse-end slopes of the appearance function (dimensionless)', es: 'el tamaño relativo x/y, la proporción de finos resuelta desde t10, y las pendientes del extremo fino y del grueso de la función de aparición (sin dimensión)' } },
          { term: 'Q, Q_ref', definition: { en: 'the throughput and the reference capacity of the machine (t/h)', es: 'la capacidad y la capacidad de referencia de la máquina (t/h)' } },
          { term: 'g_ref', definition: { en: 'the reference discharge gap of the machine (mm)', es: 'la abertura de descarga de referencia de la máquina (mm)' } },
          { term: 's', definition: { en: 'the speed ratio n over n_opt (dimensionless)', es: 'la razón de velocidad n sobre n_opt (sin dimensión)' } },
          { term: 'F80, P80, f80', definition: { en: 'the sizes at 80 percent passing of the feed and of the product (mm; micrometres in Bond’s law); f80 is the feed value used by the calibrated fit', es: 'los tamaños al 80 por ciento pasante de la alimentación y del producto (mm; micrómetros en la ley de Bond); f80 es el valor de la alimentación que usa el ajuste calibrado' } },
          { term: 'W_i, W', definition: { en: 'the Bond work index and the Bond work per tonne (kWh/t)', es: 'el índice de trabajo de Bond y el trabajo de Bond por tonelada (kWh/t)' } },
          { term: 'P_d, P_c, P_n', definition: { en: 'the net Bond draw, the modelled crusher power and the no-load power (kW)', es: 'el consumo neto de Bond, la potencia modelada del chancador y la potencia en vacío (kW)' } },
          { term: 'ζ', definition: { en: 'the scaling of the net draw in the current-based power model of the HP500 fit (dimensionless)', es: 'el escalamiento del consumo neto en el modelo de potencia por corriente del ajuste HP500 (sin dimensión)' } },
        ]}
      />
    </DocSection>
  );
}
