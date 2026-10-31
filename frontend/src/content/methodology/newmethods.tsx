// Two topics of the Methodology: Morrell's size-specific crusher energy and CrusherBayes, the Bayesian calibration of the engine
// with a structural discrepancy. The equations and the method constants are written here (they are the method); every fitted
// or sampled number, the priors, the sampler's size, the thresholds of the kill criterion and the fitted work index, is read
// from the committed documents when the topic opens, never typed.
import { Callout, Cite, DocSection, Equation, useFormat, useShellLang } from '@fasl-work/caos-app-shell';
import { loadHp500CrusherBayes, loadHp500Loo, loadIndex, useArtifact } from '../../api/artifacts';
import { P, useT } from '../bi';
import { Ready, TableWrap } from '../benchmark/shared';

export function Morrell() {
  const t = useT();
  const loo = useArtifact(async (s) => loadHp500Loo(await loadIndex(s), s), []);
  return (
    <DocSection title={{ en: 'Morrell size-specific energy', es: 'Energía específica por tamaño de Morrell' }} area="method" kind="classical" refs={['gmsg2016', 'morrell2009', 'rocha2024']}>
      <P
        en={<>Morrell&apos;s method gives the specific energy of a conventional crusher from the feed and product sizes and one ore property, the crushing work index M_ic. It is the documented alternative to Bond&apos;s law for coarse duty <Cite id="morrell2009" />. The equations below are the ones the GMSG guideline prints for conventional crushers <Cite id="gmsg2016" />; the paper itself was not the source of the transcription.</>}
        es={<>El método de Morrell da la energía específica de un chancador convencional a partir de los tamaños de alimento y producto y una propiedad del mineral, el índice de trabajo de chancado M_ic. Es la alternativa documentada a la ley de Bond para trabajo grueso <Cite id="morrell2009" />. Las ecuaciones siguientes son las que la guía del GMSG imprime para chancadores convencionales <Cite id="gmsg2016" />; el artículo mismo no fue la fuente de la transcripción.</>}
      />
      <Equation
        tex={String.raw`W_c = S_c\,K_2\,M_{ic}\,4\left(x_2^{f(x_2)} - x_1^{f(x_1)}\right)\ [\mathrm{kWh/t}], \qquad f(x) = -\left(0.295 + \frac{x}{1\,000\,000}\right)`}
        caption={t('Equation B4 of the guideline: W_c is the specific energy in kWh/t, x_1 and x_2 the 80 % passing sizes of the feed and of the product in micrometres, M_ic the crushing work index in kWh/t, K_2 = 1.0 for a crusher in closed circuit with a classifying screen and 1.19 in open circuit, and S_c the hardness correction below. The size term is a pure number, so W_c has the unit of M_ic.', 'Ecuación B4 de la guía: W_c es la energía específica en kWh/t, x_1 y x_2 los tamaños al 80 % pasante del alimento y del producto en micrómetros, M_ic el índice de trabajo de chancado en kWh/t, K_2 = 1,0 para un chancador en circuito cerrado con harnero clasificador y 1,19 en circuito abierto, y S_c la corrección de dureza de abajo. El término de tamaño es un número puro, así que W_c tiene la unidad de M_ic.')}
      />
      <Equation
        tex={String.raw`S_c = K_s\,(x_1 x_2)^{-0.2},\quad K_s = 55 \quad\text{(applied when } S_c < 1\text{, taken as } 1 \text{ when } S_c > 1\text{)}`}
        caption={t('Equation B5: the hardness parameter S_c, with K_s = 55 for a conventional crusher; it corrects the energy only where it is below one.', 'Ecuación B5: el parámetro de dureza S_c, con K_s = 55 para un chancador convencional; corrige la energía solo donde es menor que uno.')}
      />
      <P
        en={<>The power is the specific energy times the feed rate, W_c in kWh/t times Q in t/h, in kW. The guideline defines the net power as the motor power less the no-load power. The work index of the Minas Rio ore is not published, so M_ic is a fitted scalar, and so is the no-load power in the second variant: both are refit on the training surveys of every fold, with the measured feed f80 as x_1, the backbone P80 as x_2 (a model output used as an input, never as a target) and the measured feed rate as Q. Two variants are held out, one through the origin and one with a no-load term.</>}
        es={<>La potencia es la energía específica por la tasa de alimentación, W_c en kWh/t por Q en t/h, en kW. La guía define la potencia neta como la potencia del motor menos la potencia en vacío. El índice de trabajo del mineral de Minas Rio no está publicado, así que M_ic es un escalar ajustado, y también la potencia en vacío en la segunda variante: ambos se reajustan con los muestreos de entrenamiento de cada pliegue, con el f80 medido de la alimentación como x_1, el P80 del esqueleto como x_2 (una salida del modelo usada como entrada, nunca como objetivo) y la tasa de alimentación medida como Q. Se reservan dos variantes, una por el origen y otra con un término en vacío.</>}
      />
      <Ready a={loo} wait={{ en: 'Loading the fitted work indices', es: 'Cargando los índices de trabajo ajustados' }}>
        {(l) => <FitNote loo={l} />}
      </Ready>
      <Callout variant="honest" title={t('What this topic does not claim', 'Lo que este tema no afirma')}>
        {t(
          'It is a held-out comparison, not a power predictor shipped to the App: the plant work index and its no-load reading are not available, and the engine keeps Bond’s draw. It carries no tumbling-mill terms, no open-circuit K_2 in the fit (the fitted M_ic absorbs it) and no size-distribution correction. The Benchmark page reads the errors of both variants from the committed document.',
          'Es una comparación reservada, no un predictor de potencia entregado a la App: el índice de trabajo de la planta y su lectura en vacío no están disponibles, y el motor conserva la potencia de Bond. No lleva términos de molino de bolas, ni K_2 de circuito abierto en el ajuste (el M_ic ajustado lo absorbe), ni corrección por distribución de tamaños. La página Benchmark lee los errores de ambas variantes del documento versionado.',
        )}
      </Callout>
    </DocSection>
  );
}

function FitNote({ loo }: { loo: import('../../lib/contract.types').Hp500Loo }) {
  const f = useFormat();
  const lang = useShellLang();
  const fit = loo.loo.kW.strict.morrell_fit;
  if (!fit) return null;
  const range = (v: number[]) => `${f(Math.min(...v), { decimals: 1 })} ${lang === 'es' ? 'a' : 'to'} ${f(Math.max(...v), { decimals: 1 })}`;
  const neg = fit.noload_variant_m_ic_positive.filter((p) => !p).length;
  const n = fit.noload_variant_m_ic_positive.length;
  return (
    <P
      en={<>Fitted per fold, the through-origin M_ic runs from {range(fit.m_ic_kwh_t)} kWh/t. With the no-load term the fit gives a negative M_ic in {f(neg, { decimals: 0 })} of {f(n, { decimals: 0 })} folds ({range(fit.m_ic_noload_kwh_t)} kWh/t) with a no-load power of {range(fit.no_load_kw)} kW: the power falls as the throughput rises in these surveys while the design column rises with it, so the least-squares line has a negative slope. A negative work index is not Morrell&apos;s physics; that variant is therefore reported as a descriptive line on the design column, never as an estimate of M_ic.</>}
      es={<>Ajustado por pliegue, el M_ic por el origen va de {range(fit.m_ic_kwh_t)} kWh/t. Con el término en vacío el ajuste da un M_ic negativo en {f(neg, { decimals: 0 })} de {f(n, { decimals: 0 })} pliegues ({range(fit.m_ic_noload_kwh_t)} kWh/t) con una potencia en vacío de {range(fit.no_load_kw)} kW: en estos muestreos la potencia baja cuando sube la capacidad mientras la columna de diseño sube con ella, así que la recta de mínimos cuadrados tiene pendiente negativa. Un índice de trabajo negativo no es la física de Morrell; esa variante se informa entonces como una línea descriptiva sobre la columna de diseño, nunca como una estimación de M_ic.</>}
    />
  );
}

export function CrusherBayes() {
  const t = useT();
  const cb = useArtifact(async (s) => loadHp500CrusherBayes(await loadIndex(s), s), []);
  return (
    <DocSection title={{ en: 'CrusherBayes: calibration with a discrepancy', es: 'CrusherBayes: calibración con discrepancia' }} area="method" kind="learned" refs={['kennedy2001', 'goodman2010', 'foremanmackey2013', 'rocha2024']}>
      <P
        en={<>The calibration of the source paper is a point fit. The hypothesis of CrusherBayes is that a posterior over the engine&apos;s fitted scalars, together with an explicit model-form discrepancy per target, gives a predictive distribution that is better calibrated and sharper than the residual band of CrusherCal, and shows which scalars the ten surveys identify and which stay at their prior. The rule that would drop it was written before the run and is applied by code to the numbers; the Benchmark page states the verdict.</>}
        es={<>La calibración del artículo fuente es un ajuste puntual. La hipótesis de CrusherBayes es que un posterior sobre los escalares ajustados del motor, junto con una discrepancia explícita de forma del modelo por magnitud, da una distribución predictiva mejor calibrada y más angosta que la banda de residuos de CrusherCal, y muestra qué escalares identifican los diez muestreos y cuáles se quedan en su a priori. La regla que lo descartaría se escribió antes de correr y se aplica por código a las cifras; la página Benchmark declara el veredicto.</>}
      />
      <Equation
        tex={String.raw`y_{t,i} = f_t(\theta;\,\mathrm{CSS}_i, f_{80,i}) + \delta_t(z_i) + \varepsilon_{t,i}, \quad \delta_t(z) = d_{t0} + d_{t1}\,z_{\mathrm{CSS}} + d_{t2}\,z_{f_{80}}, \quad \varepsilon \sim N(0, \sigma_t^2)`}
        caption={t('The likelihood for survey i and target t (throughput in t/h, power in kW; P80 is not measured and is never a target): the engine f_t at the scalars theta, plus a discrepancy delta_t that is a constant and two slopes on the setting and the feed f80 standardized on the training surveys z, plus Gaussian noise of scale sigma_t. The discrepancy has the low-order form of Kennedy and O’Hagan.', 'La verosimilitud para el muestreo i y la magnitud t (capacidad en t/h, potencia en kW; el P80 no se mide y nunca es objetivo): el motor f_t con los escalares theta, más una discrepancia delta_t que es una constante y dos pendientes sobre la abertura y el f80 de la alimentación estandarizados con los muestreos de entrenamiento z, más ruido gaussiano de escala sigma_t. La discrepancia tiene la forma de bajo orden de Kennedy y O’Hagan.')}
      />
      <P
        en={<>The discrepancy coefficients d have a Gaussian prior, so given the engine scalars the discrepancy and the noise are Gaussian and the discrepancy is integrated out exactly: y_t is normal with mean f_t(theta) and covariance sigma_t^2 I plus tau_t^2 Z Z^T, with Z the matrix of the three discrepancy regressors. The sampler explores the engine scalars and the two noise scales, and the coefficients d are drawn afterwards from their exact Gaussian conditional <Cite id="kennedy2001" />. The sampler is the affine-invariant ensemble sampler of Goodman and Weare <Cite id="goodman2010" />, as implemented in emcee <Cite id="foremanmackey2013" />.</>}
        es={<>Los coeficientes de discrepancia d tienen un a priori gaussiano, así que dados los escalares del motor la discrepancia y el ruido son gaussianos y la discrepancia se integra de forma exacta: y_t es normal con media f_t(theta) y covarianza sigma_t^2 I más tau_t^2 Z Z^T, con Z la matriz de los tres regresores de discrepancia. El muestreador explora los escalares del motor y las dos escalas de ruido, y los coeficientes d se extraen después de su condicional gaussiana exacta <Cite id="kennedy2001" />. El muestreador es el de conjunto afín-invariante de Goodman y Weare <Cite id="goodman2010" />, tal como lo implementa emcee <Cite id="foremanmackey2013" />.</>}
      />
      <Ready a={cb} wait={{ en: 'Loading the priors and the sampler settings', es: 'Cargando los a priori y la configuración del muestreador' }}>
        {(d) => <SpecTables cb={d} />}
      </Ready>
      <Callout variant="honest" title={t('What this topic does not claim', 'Lo que este tema no afirma')}>
        {t(
          'The prior widths are weakly informative choices that bracket the quoted spans of the source paper; no published range of these fitted scalars for this ore was found, so the widths are the author’s and are listed with the nominal values. The engine is its own simulator (a few milliseconds per evaluation), so no emulator stands between the sampler and the engine. The method is offline: the sampler runs in the bake and the site reads its document. Whether a posterior converged is recorded per fold, and the Benchmark page labels every figure of a posterior that did not.',
          'Los anchos de los a priori son elecciones débilmente informativas que encierran los rangos citados del artículo fuente; no se encontró un rango publicado de estos escalares ajustados para este mineral, así que los anchos son del autor y se listan junto a los valores nominales. El motor es su propio simulador (unos milisegundos por evaluación), así que ningún emulador se interpone entre el muestreador y el motor. El método es sin conexión: el muestreador corre en el precálculo y el sitio lee su documento. Si un posterior convergió se registra por pliegue, y la página Benchmark rotula cada cifra de un posterior que no lo hizo.',
        )}
      </Callout>
    </DocSection>
  );
}

function SpecTables({ cb }: { cb: import('../../lib/contract.types').Hp500CrusherBayes }) {
  const t = useT();
  const f = useFormat();
  const m = cb.method;
  const k = cb.kill_criterion;
  const pct = { percent: true, decimals: 0 } as const;
  const i0 = { decimals: 0 } as const;
  return (
    <>
      <TableWrap>
        <table className="caos-table" data-state="ready" data-crusherbayes="priors">
          <caption>
            {t(
              'The sampled scalars of the engine with the prior of each: a truncated normal around the nominal value, in the logarithm of the value where the column says so. The source column names where the nominal value comes from.',
              'Los escalares muestreados del motor con el a priori de cada uno: una normal truncada alrededor del valor nominal, en el logaritmo del valor donde la columna lo indica. La columna de fuente nombra de dónde sale el valor nominal.',
            )}
          </caption>
          <thead>
            <tr>
              <th className="caos-col-text">{t('Scalar', 'Escalar')}</th>
              <th className="caos-col-text">{t('Unit', 'Unidad')}</th>
              <th>{t('Nominal', 'Nominal')}</th>
              <th className="caos-col-text">{t('Scale', 'Escala')}</th>
              <th>{t('Prior sd', 'Desv. a priori')}</th>
              <th>{t('Bounds', 'Límites')}</th>
              <th className="caos-col-text">{t('Source', 'Fuente')}</th>
            </tr>
          </thead>
          <tbody>
            {cb.priors.map((p) => (
              <tr key={p.name}>
                <td className="caos-col-text">{p.name}</td>
                <td className="caos-col-text">{p.unit}</td>
                <td>{f(p.nominal, { decimals: 2 })}</td>
                <td className="caos-col-text">{p.log ? t('logarithm', 'logaritmo') : t('linear', 'lineal')}</td>
                <td>{f(p.sd, { decimals: 2 })}</td>
                <td>
                  {f(p.lo, { decimals: 2 })} {t('to', 'a')} {f(p.hi, { decimals: 2 })}
                </td>
                <td className="caos-col-text">{p.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <P
        en={<>The discrepancy coefficients have a Gaussian prior of standard deviation {f(m.discrepancy_prior_sd.tph, i0)} t/h and {f(m.discrepancy_prior_sd.kW, i0)} kW; the noise has a log-normal prior with medians {f(m.noise_prior.median.tph, i0)} t/h and {f(m.noise_prior.median.kW, i0)} kW. The sampler is {m.sampler} {m.sampler_version} with {f(m.walkers, i0)} walkers and {f(m.steps, i0)} steps, of which {f(m.burn_in_steps, i0)} are discarded, thinned by {f(m.thin, i0)}, with the seed fixed. Each held-out fold is a posterior fitted on nine surveys; one more is fitted on all ten for the contraction table.</>}
        es={<>Los coeficientes de discrepancia tienen un a priori gaussiano de desviación estándar {f(m.discrepancy_prior_sd.tph, i0)} t/h y {f(m.discrepancy_prior_sd.kW, i0)} kW; el ruido tiene un a priori lognormal con medianas {f(m.noise_prior.median.tph, i0)} t/h y {f(m.noise_prior.median.kW, i0)} kW. El muestreador es {m.sampler} {m.sampler_version} con {f(m.walkers, i0)} caminantes y {f(m.steps, i0)} pasos, de los cuales {f(m.burn_in_steps, i0)} se descartan, raleados cada {f(m.thin, i0)}, con la semilla fija. Cada pliegue reservado es un posterior ajustado con nueve muestreos; otro más se ajusta con los diez para la tabla de contracción.</>}
      />
      <P
        en={<>Convergence criterion: a posterior counts as converged when its post-burn chain is at least {f(cb.convergence.tau_factor, i0)} integrated autocorrelation times long, taking the largest time over the parameters; a posterior that fails is recorded as not converged and kept in the document. Kill criterion, written before the run: the method is dropped as a predictor if (a) its power error is not below that of the setting-only line B-lin by at least {f(k.margin_mape_pts, { decimals: 1 })} points and its throughput error does not beat that of the calibrated backbone by at least {f(k.margin_mape_pts, { decimals: 1 })} points, and (b) on either target its coverage lies outside {f(k.coverage_band[0], pct)} to {f(k.coverage_band[1], pct)} or its mean band is wider than the CrusherCal band.</>}
        es={<>Criterio de convergencia: un posterior cuenta como convergido cuando su cadena posterior al descarte tiene al menos {f(cb.convergence.tau_factor, i0)} tiempos de autocorrelación integrados, tomando el mayor tiempo entre los parámetros; un posterior que falla se registra como sin converger y se conserva en el documento. Criterio de descarte, escrito antes de correr: el método se descarta como predictor si (a) su error en potencia no es menor que el de la recta solo de la abertura B-lin en al menos {f(k.margin_mape_pts, { decimals: 1 })} puntos y su error en capacidad no supera al del esqueleto calibrado en al menos {f(k.margin_mape_pts, { decimals: 1 })} puntos, y (b) en cualquiera de las dos magnitudes su cobertura queda fuera de {f(k.coverage_band[0], pct)} a {f(k.coverage_band[1], pct)} o su banda media es más ancha que la banda de CrusherCal.</>}
      />
    </>
  );
}
