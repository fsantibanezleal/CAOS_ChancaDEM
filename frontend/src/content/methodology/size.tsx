// Topic 1 of the Methodology: the feed and product size distributions on the engine's sieve grid.
import { Callout, Cite, DocSection, Equation, Figure } from '@fasl-work/caos-app-shell';
import { P, useT } from '../bi';
import { SizeFigure } from './figures';

export function Size() {
  const t = useT();
  return (
    <DocSection title={{ en: 'Feed and product size distributions', es: 'Distribuciones de tamaño del alimento y del producto' }} area="method" kind="classical" refs={['rosin1933', 'napiermunn1996']}>
      <P
        en={<>Every size distribution in the engine lives on one fixed grid of 28 size classes. The grid is the square-root-of-two series of laboratory sieves: the top edge is 256 mm and each following edge is the previous one divided by the square root of two, so 29 edges run from 256 mm down to 0.0156 mm, two classes for every halving of the aperture. Classes are ordered from coarse to fine, which is what makes the breakage matrix lower-triangular <Cite id="napiermunn1996" />.</>}
        es={<>Toda distribución de tamaño del motor vive en una misma grilla fija de 28 clases de tamaño. La grilla es la serie raíz de dos de los tamices de laboratorio: el borde superior es 256 mm y cada borde siguiente es el anterior dividido por la raíz de dos, de modo que 29 bordes van desde 256 mm hasta 0,0156 mm, dos clases por cada mitad de la abertura. Las clases se ordenan de gruesas a finas, y eso es lo que vuelve triangular inferior a la matriz de fractura <Cite id="napiermunn1996" />.</>}
      />
      <Equation
        tex={String.raw`e_i = \frac{256}{(\sqrt{2})^{\,i}}\ \text{mm},\quad i = 0,\dots,28, \qquad y_i = \sqrt{e_i\, e_{i+1}}`}
        caption={t('The sieve grid: e_i is the i-th aperture edge in mm (256 mm at i = 0, descending) and y_i the geometric mid-size of class i, the size the model assigns to every particle of that class.', 'La grilla de tamices: e_i es el i-ésimo borde de abertura en mm (256 mm en i = 0, descendente) e y_i el tamaño medio geométrico de la clase i, el tamaño que el modelo asigna a toda partícula de esa clase.')}
      />
      <P
        en={<>The feed is never read from a table. It is generated from two numbers by the Rosin-Rammler (Weibull) law, the standard description of crushed and ground products <Cite id="rosin1933" />. The cumulative fraction passing a size x is one minus the exponential of minus the ratio x over x63 raised to the power m. The mass of each class is the difference of the passing fractions at its two edges, and the vector is renormalised so that the masses add to one.</>}
        es={<>El alimento nunca se lee de una tabla. Se genera a partir de dos números con la ley de Rosin-Rammler (Weibull), la descripción estándar de los productos chancados y molidos <Cite id="rosin1933" />. La fracción acumulada que pasa un tamaño x es uno menos la exponencial de menos el cociente x sobre x63 elevado a la potencia m. La masa de cada clase es la diferencia de las fracciones pasantes en sus dos bordes, y el vector se renormaliza para que las masas sumen uno.</>}
      />
      <Equation
        tex={String.raw`R(x) = 1 - \exp\!\left[-\left(\frac{x}{x_{63}}\right)^{m}\right], \qquad f_i = \frac{R(e_i) - R(e_{i+1})}{\sum_k \big(R(e_k) - R(e_{k+1})\big)}`}
        caption={t('The Rosin-Rammler feed: R(x) is the fraction passing size x (mm), x63 the size at 63.2 % passing (mm), m the uniformity exponent (higher m, a narrower feed) and f_i the mass fraction of class i after renormalisation.', 'El alimento de Rosin-Rammler: R(x) es la fracción que pasa el tamaño x (mm), x63 el tamaño al 63,2 % pasante (mm), m el exponente de uniformidad (m mayor, alimento más estrecho) y f_i la fracción de masa de la clase i tras la renormalización.')}
      />
      <Figure caption={t('Feed and product passing curves of the reference point (cone secondary, CSS 32 mm, throw 30 mm, 360 rpm, feed x63 90 mm and m 1.2), computed by the engine; the dashed lines mark F80 and P80 where each curve crosses 80 %.', 'Curvas de pasante del alimento y del producto del punto de referencia (cono secundario, CSS 32 mm, carrera 30 mm, 360 rpm, alimento x63 90 mm y m 1,2), calculadas por el motor; las líneas segmentadas marcan F80 y P80 donde cada curva cruza 80 %.')}>
        <SizeFigure />
      </Figure>
      <P
        en="The passing curve is built from the mass vector by a cumulative sum from the finest class upward: the passing at an edge is the mass finer than that edge, normalised by the total. Every gradation number the interface shows is read from this curve. F80 is the size at 80 percent passing of the feed, and P80, P50 and P20 are the sizes at 80, 50 and 20 percent passing of the product; the reduction ratio is F80 divided by P80."
        es="La curva de pasante se construye a partir del vector de masas con una suma acumulada desde la clase más fina hacia arriba: el pasante en un borde es la masa más fina que ese borde, normalizada por el total. Todo número de granulometría que muestra la interfaz se lee de esta curva. F80 es el tamaño al 80 por ciento pasante del alimento, y P80, P50 y P20 son los tamaños al 80, 50 y 20 por ciento pasante del producto; la razón de reducción es F80 dividido por P80."
      />
      <Equation
        tex={String.raw`x_p = \exp\!\Big[\ln e_{i+1} + \tau\,\big(\ln e_i - \ln e_{i+1}\big)\Big], \qquad \tau = \frac{p - G_{i+1}}{G_i - G_{i+1}}, \qquad G_i \ge p \ge G_{i+1}`}
        caption={t('The size at a passing fraction p: G_i is the cumulative passing at edge e_i; the two edges that bracket p are interpolated linearly in the logarithm of size. P80 is x_p at p = 0.8, and the reduction ratio is F80 / P80.', 'El tamaño a una fracción pasante p: G_i es el pasante acumulado en el borde e_i; los dos bordes que encierran a p se interpolan linealmente en el logaritmo del tamaño. P80 es x_p con p = 0,8, y la razón de reducción es F80 / P80.')}
      />
      <P
        en="The percent passing at fixed sizes (1, 4, 8, 16 and 32 mm) uses the same bracket in the other direction: it interpolates the passing fraction linearly in the logarithm of the size between the two edges around the requested size, and it is one above the top edge and zero below the bottom one. Because the grid is geometric, the logarithmic interpolation follows the straight segments that a sieve analysis plotted on a logarithmic axis shows."
        es="El porcentaje pasante a tamaños fijos (1, 4, 8, 16 y 32 mm) usa el mismo encierro en sentido contrario: interpola la fracción pasante linealmente en el logaritmo del tamaño entre los dos bordes que rodean al tamaño pedido, y vale uno sobre el borde superior y cero bajo el inferior. Como la grilla es geométrica, la interpolación logarítmica sigue los tramos rectos que muestra un análisis granulométrico graficado en un eje logarítmico."
      />
      <P
        en="The same grid carries the product of every method of the page. The Whiten solve returns a mass per class on these 28 classes, the surrogate predicts the readouts of this curve, and the calibrated lane rebuilds a feed from a single measured number on it. Keeping one grid means that a feed, a product and a breakage matrix are always the same length, and that a mass balance is a statement about vectors of equal size."
        es="La misma grilla lleva el producto de cada método de la página. La solución de Whiten devuelve una masa por clase en estas 28 clases, el sustituto predice las lecturas de esta curva, y la vía calibrada reconstruye un alimento a partir de un solo número medido sobre ella. Mantener una grilla significa que un alimento, un producto y una matriz de fractura tienen siempre el mismo largo, y que un balance de masa es una afirmación sobre vectores del mismo tamaño."
      />
      <Callout variant="honest" title={t('Exact and illustrative', 'Exacto e ilustrativo')}>
        {t('The grid, the formulas and the interpolation are computed exactly as written. The Rosin-Rammler feed is a model of a feed, not a measured screen analysis: a real feed has its own shape. On the measured HP500 lane the feed is rebuilt from one measured size with an assumed exponent, because the source publishes the feed curves only as figures.', 'La grilla, las fórmulas y la interpolación se calculan exactamente como están escritas. El alimento de Rosin-Rammler es un modelo de un alimento, no un análisis granulométrico medido: un alimento real tiene su propia forma. En la vía HP500 medida el alimento se reconstruye a partir de un tamaño medido con un exponente supuesto, porque la fuente publica las curvas del alimento solo como figuras.')}
      </Callout>
    </DocSection>
  );
}
