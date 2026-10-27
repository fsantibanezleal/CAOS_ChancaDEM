// Provenance: where each row of the page comes from, what makes it hard and who may redistribute it. Counts and ranges are read from
// the documents; the licences are those the product records (LICENSES.md and ATTRIBUTION.md) and the source block of the HP500 documents.
import { Cite, DocSection, useFormat, useShellLang } from '@fasl-work/caos-app-shell';
import type { CaseIndex, Hp500Backbone, Hp500Loo, ModelMetrics } from '../../lib/contract.types';
import { ReadinessNote } from '../../readiness/ReadinessNote';
import { P, useT } from '../bi';
import { Ready, TableWrap, useBench } from './shared';

/** A licence name as Spanish writes it: no decimal point in a version number (the gate's G11), so `CC BY 4.0` reads `CC BY, versión 4`. */
function licenceEs(name: string): string {
  const m = /^(.*?)\s*(\d+)\.0$/.exec(name);
  return m ? `${m[1]}, versión ${m[2]}` : name.replace('.', ',');
}

function span(values: number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)];
}

function Rows({ index, loo, backbone, metrics }: { index: CaseIndex; loo: Hp500Loo; backbone: Hp500Backbone; metrics: ModelMetrics | null }) {
  const t = useT();
  const f = useFormat();
  const lang = useShellLang();
  const synth = index.cases.filter((c) => c.real_or_synthetic !== 'real');
  const categories = new Map<string, number>();
  for (const c of synth) categories.set(c.category[lang], (categories.get(c.category[lang]) ?? 0) + 1);
  const [cLo, cHi] = span(backbone.surveys.map((s) => s.measured.css_mm));
  const [fLo, fHi] = span(backbone.surveys.map((s) => s.measured.f80_mm));
  const range = (lo: number, hi: number) => `${f(lo, { decimals: 0 })} ${t('to', 'a')} ${f(hi, { decimals: 0 })}`;
  return (
    <TableWrap>
      <table className="caos-table" data-state="ready">
        <caption>{t('Every row of this page, by the data it rests on.', 'Cada fila de esta página, según los datos en que descansa.')}</caption>
        <thead>
          <tr>
            <th className="caos-col-text">{t('Dataset', 'Conjunto de datos')}</th>
            <th className="caos-col-text">{t('What it is', 'Qué es')}</th>
            <th className="caos-col-text">{t('Difficulty comes from', 'La dificultad viene de')}</th>
            <th className="caos-col-text">{t('Redistribution', 'Redistribución')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="caos-col-text">{t(`HP500 surveys (${f(loo.n, { decimals: 0 })})`, `Muestreos HP500 (${f(loo.n, { decimals: 0 })})`)}</td>
            <td className="caos-col-text">
              {t(
                `Measured, industrial: ${loo.source.paper}, ${loo.source.table}; a Metso HP500 secondary cone at Minas Rio on itabirite iron ore. The power is the paper's estimate from the measured current.`,
                `Medidos, industriales: ${loo.source.paper}, ${loo.source.table}; un cono secundario Metso HP500 en Minas Rio sobre mineral de hierro itabirita. La potencia es la estimación del artículo a partir de la corriente medida.`,
              )}
            </td>
            <td className="caos-col-text">
              {t(
                `The plant's own variation: setting ${range(cLo, cHi)} mm and feed f80 ${range(fLo, fHi)} mm, on one machine and one ore.`,
                `La variación propia de la planta: abertura de ${range(cLo, cHi)} mm y f80 de alimentación de ${range(fLo, fHi)} mm, en una máquina y un mineral.`,
              )}
            </td>
            <td className="caos-col-text">
              {t(`${loo.source.license}, with attribution to the source paper (doi ${loo.source.doi}).`, `${licenceEs(loo.source.license)}, con atribución al artículo fuente (doi ${loo.source.doi}).`)}
            </td>
          </tr>
          <tr>
            <td className="caos-col-text">{t(`Synthetic cases (${f(synth.length, { decimals: 0 })})`, `Casos sintéticos (${f(synth.length, { decimals: 0 })})`)}</td>
            <td className="caos-col-text">{t('Authored: parameter sets run through the engine, the controls among them.', 'Elaborados: conjuntos de parámetros corridos por el motor, los controles entre ellos.')}</td>
            <td className="caos-col-text">{[...categories.entries()].map(([k, v]) => `${k} (${f(v, { decimals: 0 })})`).join('; ')}</td>
            <td className="caos-col-text">{t('MIT, the product’s own work.', 'MIT, trabajo propio del producto.')}</td>
          </tr>
          <tr>
            <td className="caos-col-text">{t('Engine sweeps', 'Barridos del motor')}</td>
            <td className="caos-col-text">
              {metrics
                ? t(
                    `Authored: Latin-hypercube sweeps of the engine, ${f(metrics.surrogate.n_train, { decimals: 0 })} training points and ${f(metrics.surrogate.n_test, { decimals: 0 })} held-out points from an independent second draw (seed ${metrics.surrogate.test_seed}).`,
                    `Elaborados: barridos de hipercubo latino del motor, ${f(metrics.surrogate.n_train, { decimals: 0 })} puntos de entrenamiento y ${f(metrics.surrogate.n_test, { decimals: 0 })} puntos reservados de un segundo sorteo independiente (semilla ${metrics.surrogate.test_seed}).`,
                  )
                : t('Authored: Latin-hypercube sweeps of the engine; the metrics document is not available yet.', 'Elaborados: barridos de hipercubo latino del motor; el documento de métricas aún no está disponible.')}
            </td>
            <td className="caos-col-text">{t('Each machine over its own ranges; the held-out draw uses the same ranges with another seed.', 'Cada máquina sobre sus propios rangos; el sorteo reservado usa los mismos rangos con otra semilla.')}</td>
            <td className="caos-col-text">{t('MIT, the product’s own work.', 'MIT, trabajo propio del producto.')}</td>
          </tr>
          <tr>
            <td className="caos-col-text">{t('Models (surrogate and autoencoder)', 'Modelos (sustituto y autocodificador)')}</td>
            <td className="caos-col-text">{t('Trained on the engine sweeps, not on any survey.', 'Entrenados con los barridos del motor, no con ningún muestreo.')}</td>
            <td className="caos-col-text">{t('The engine they imitate: they inherit its assumptions and its errors.', 'El motor que imitan: heredan sus supuestos y sus errores.')}</td>
            <td className="caos-col-text">{t('MIT, the product’s own work.', 'MIT, trabajo propio del producto.')}</td>
          </tr>
        </tbody>
      </table>
    </TableWrap>
  );
}

export function Provenance() {
  const { index, loo, backbone, metrics } = useBench();
  return (
    <DocSection title={{ en: 'Where each row comes from', es: 'De dónde viene cada fila' }} area="provenance" refs={['rocha2024']}>
      <P
        en={
          <>
            Two kinds of data stand behind the page and they are never mixed: the measured surveys of the open source paper <Cite id="rocha2024" />, which are the only real data, and everything the product authored itself, the synthetic cases, the engine sweeps and the models trained on them. The licence of each is the one the product records for it.
          </>
        }
        es={
          <>
            Detrás de la página hay dos clases de datos y nunca se mezclan: los muestreos medidos del artículo abierto <Cite id="rocha2024" />, que son los únicos datos reales, y todo lo que el producto elaboró por sí mismo, los casos sintéticos, los barridos del motor y los modelos entrenados con ellos. La licencia de cada uno es la que el producto registra para él.
          </>
        }
      />
      <ReadinessNote ids={['case-index', 'hp500-backbone', 'hp500-loo', 'model-metrics']} />
      <Ready a={index} b={loo} c={backbone}>
        {(i, l, b) => <Rows index={i} loo={l} backbone={b} metrics={metrics.state === 'ready' ? metrics.data : null} />}
      </Ready>
    </DocSection>
  );
}
