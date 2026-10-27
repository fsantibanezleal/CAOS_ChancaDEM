// Results: the held-out numbers, read at run time from the committed documents. CrusherCal on the ten measured surveys (strict
// folds, per target and model, and the 80 percent band's coverage), and the surrogate's error per output on the independent second draw.
import { BarChart, Cite, DocSection, PlotCard, ViewsRow, useFormat, useShellLang, type BarDatum } from '@fasl-work/caos-app-shell';
import { ReadinessNote } from '../../readiness/ReadinessNote';
import type { Hp500Loo, ModelMetrics } from '../../lib/contract.types';
import { OUTPUT_UNITS, type SurrogateOutput } from '../../lib/ort';
import { P, useT } from '../bi';
import { MODEL_LABEL, MODEL_SHORT, MODELS, TARGET_LABEL, scoresOf, type ModelKey, type Target } from './data';
import { Ready, TableWrap, useBench } from './shared';

const TARGETS: Target[] = ['tph', 'kW', 'p80'];

function modelBars(loo: Hp500Loo, target: Target): BarDatum[] {
  return MODELS.map((m: ModelKey) => ({
    id: m,
    label: MODEL_SHORT[m],
    value: scoresOf(loo, target, 'strict', m).mape_pct,
    tone: m === 'M0_backbone' ? 'accent' : m === 'constant_mean' || m === 'M1_label_shuffle' ? 'warn' : 'neutral',
  }));
}

function LooTables({ loo }: { loo: Hp500Loo }) {
  const t = useT();
  const f = useFormat();
  const lang = useShellLang();
  return (
    <>
      <TableWrap>
        <table className="caos-table" data-state="ready">
          <caption>
            {t(
              `Strict leave-one-survey-out folds on the ${loo.n} measured surveys: every fitted scalar is refit without the held-out survey. MAPE and maximum deviation in percent of the measurement; RMSE in the unit of the target.`,
              `Pliegues estrictos que dejan un muestreo fuera, sobre los ${loo.n} muestreos medidos: cada escalar ajustado se reajusta sin el muestreo reservado. MAPE y desviación máxima en porcentaje de lo medido; RMSE en la unidad de la magnitud.`,
            )}
          </caption>
          <thead>
            <tr>
              <th className="caos-col-text">{t('Target', 'Magnitud')}</th>
              <th className="caos-col-text">{t('Model', 'Modelo')}</th>
              <th>{t('MAPE (%)', 'MAPE (%)')}</th>
              <th>RMSE</th>
              <th>R²</th>
              <th>{t('Max deviation (%)', 'Desviación máxima (%)')}</th>
            </tr>
          </thead>
          <tbody>
            {TARGETS.flatMap((target) =>
              MODELS.map((m) => {
                const s = scoresOf(loo, target, 'strict', m);
                return (
                  <tr key={`${target}-${m}`}>
                    <td className="caos-col-text">{TARGET_LABEL[target][lang]}</td>
                    <td className="caos-col-text">{MODEL_LABEL[m][lang]}</td>
                    <td>{f(s.mape_pct, { decimals: 1 })}</td>
                    <td>{f(s.rmse, { decimals: 1 })}</td>
                    <td>{f(s.r2, { decimals: 3 })}</td>
                    <td>{f(s.maxdev_pct, { decimals: 1 })}</td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </TableWrap>
      <TableWrap>
        <table className="caos-table" data-state="ready">
          <caption>
            {t(
              'The 80 percent predictive band of the backbone: its half-width is 1.2816 times the spread of the held-out residuals, and its empirical coverage is the share of the surveys whose measurement fell inside.',
              'La banda predictiva del 80 por ciento del esqueleto: su semianchura es 1,2816 veces la dispersión de los residuos reservados, y su cobertura empírica es la fracción de muestreos cuya medición cayó dentro.',
            )}
          </caption>
          <thead>
            <tr>
              <th className="caos-col-text">{t('Target', 'Magnitud')}</th>
              <th>{t('Residual spread', 'Dispersión del residuo')}</th>
              <th>{t('Band half-width', 'Semianchura de la banda')}</th>
              <th>{t('Band width (% of the measurement)', 'Ancho de la banda (% de lo medido)')}</th>
              <th>{t('Nominal coverage', 'Cobertura nominal')}</th>
              <th>{t('Empirical coverage', 'Cobertura empírica')}</th>
            </tr>
          </thead>
          <tbody>
            {TARGETS.map((target) => {
              const u = loo.loo[target].strict.uq;
              return (
                <tr key={target}>
                  <td className="caos-col-text">{TARGET_LABEL[target][lang]}</td>
                  <td>{f(u.sigma, { decimals: 1 })}</td>
                  <td>{f(u.band_halfwidth, { decimals: 1 })}</td>
                  <td>{f(u.band_rel_pct, { decimals: 1 })}</td>
                  <td>{f(u.nominal_coverage, { percent: true, decimals: 0 })}</td>
                  <td>{f(u.empirical_coverage, { percent: true, decimals: 0 })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
      <ViewsRow>
        {(['tph', 'kW'] as const).map((target) => (
          <PlotCard key={target} title={{ en: `Strict MAPE by model, ${TARGET_LABEL[target].en}`, es: `MAPE estricto por modelo, ${TARGET_LABEL[target].es}` }} lane="offline" provenance="real">
            <BarChart
              title={{ en: `Strict MAPE by model, ${TARGET_LABEL[target].en}`, es: `MAPE estricto por modelo, ${TARGET_LABEL[target].es}` }}
              orientation="vertical"
              height={260}
              axis={{ label: { en: 'MAPE', es: 'MAPE' }, unit: '%', format: { decimals: 1 } }}
              data={modelBars(loo, target)}
            />
          </PlotCard>
        ))}
      </ViewsRow>
    </>
  );
}

function SurrogateTable({ metrics }: { metrics: ModelMetrics }) {
  const t = useT();
  const f = useFormat();
  const lang = useShellLang();
  const s = metrics.surrogate;
  const names = Object.keys(s.per_output) as SurrogateOutput[];
  const bars: BarDatum[] = names.map((k) => ({ id: k, label: OUTPUT_UNITS[k].label, value: s.per_output[k].mape_pct, tone: 'accent' }));
  return (
    <>
      <TableWrap>
        <table className="caos-table" data-state="ready">
          <caption>
            {t(
              `The surrogate on its held-out draw: ${f(s.n_test, { decimals: 0 })} points, an independent second Latin-hypercube draw (seed ${s.test_seed}), against the engine it emulates. R² and MAPE in original units, on the float32 graph; MAPE also on the int8 graph.`,
              `El sustituto en su sorteo reservado: ${f(s.n_test, { decimals: 0 })} puntos, un segundo sorteo independiente de hipercubo latino (semilla ${s.test_seed}), contra el motor que emula. R² y MAPE en unidades originales, sobre el grafo float32; MAPE también sobre el grafo int8.`,
            )}
          </caption>
          <thead>
            <tr>
              <th className="caos-col-text">{t('Output', 'Salida')}</th>
              <th>R²</th>
              <th>{t('MAPE float32 (%)', 'MAPE float32 (%)')}</th>
              <th>{t('MAPE int8 (%)', 'MAPE int8 (%)')}</th>
            </tr>
          </thead>
          <tbody>
            {names.map((k) => (
              <tr key={k}>
                <td className="caos-col-text">
                  {OUTPUT_UNITS[k].label[lang]}
                  {OUTPUT_UNITS[k].unit ? ` (${OUTPUT_UNITS[k].unit})` : OUTPUT_UNITS[k].percent ? ' (%)' : ''}
                </td>
                <td>{f(s.per_output[k].r2, { decimals: 4 })}</td>
                <td>{f(s.per_output[k].mape_pct, { decimals: 2 })}</td>
                <td>{f(s.per_output[k].mape_pct_int8, { decimals: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <PlotCard title={{ en: 'Surrogate MAPE by output, held-out draw', es: 'MAPE del sustituto por salida, sorteo reservado' }} lane="offline" provenance="synthetic">
        <BarChart
          title={{ en: 'Surrogate MAPE by output, held-out draw', es: 'MAPE del sustituto por salida, sorteo reservado' }}
          orientation="horizontal"
          axis={{ label: { en: 'MAPE (float32 graph)', es: 'MAPE (grafo float32)' }, unit: '%', format: { decimals: 1 } }}
          data={bars}
        />
      </PlotCard>
    </>
  );
}

function CoarseNote({ loo }: { loo: Hp500Loo }) {
  const t = useT();
  const f = useFormat();
  const m0 = scoresOf(loo, 'p80', 'strict', 'M0_backbone').mape_pct;
  const m1 = scoresOf(loo, 'p80', 'strict', 'M1_residual').mape_pct;
  return (
    <p>
      {t(
        `With ${loo.n} surveys the coverage is a coarse estimate: one survey moves it by ${f(100 / loo.n, { decimals: 0 })} percentage points. P80 is the backbone's own output, so its strict MAPE is ${f(m0, { decimals: 1 })} percent for M0 and ${f(m1, { decimals: 1 })} percent for M1: the row is a self-consistency check and says nothing about accuracy.`,
        `Con ${loo.n} muestreos la cobertura es una estimación gruesa: un muestreo la mueve ${f(100 / loo.n, { decimals: 0 })} puntos porcentuales. El P80 es la salida propia del esqueleto, así que su MAPE estricto es ${f(m0, { decimals: 1 })} por ciento para M0 y ${f(m1, { decimals: 1 })} por ciento para M1: la fila es una verificación de autoconsistencia y no dice nada sobre exactitud.`,
      )}
    </p>
  );
}

export function Results() {
  const { loo, metrics } = useBench();
  const f = useFormat();
  const m0 = loo.state === 'ready' ? scoresOf(loo.data, 'tph', 'strict', 'M0_backbone') : null;
  const mean = loo.state === 'ready' ? scoresOf(loo.data, 'tph', 'strict', 'constant_mean') : null;
  return (
    <DocSection title={{ en: 'Held-out results', es: 'Resultados reservados' }} area="results" refs={['rocha2024', 'koh2021']}>
      <P
        en={
          <>
            CrusherCal predicts each measured survey from the other nine, for the two measured targets, throughput and power, and grades P80 only as self-consistency because the source publishes its curves as figures <Cite id="rocha2024" />. The tables below put five models on the same folds: the calibrated backbone (M0), the backbone with a bounded residual (M1), a free-form fit (M2) and two controls, the constant mean and a label shuffle that must not beat M0.
            {m0 && mean ? (
              <>
                {' '}On throughput the backbone has a strict MAPE of {f(m0.mape_pct, { decimals: 1 })} percent against {f(mean.mape_pct, { decimals: 1 })} percent for the constant mean.
              </>
            ) : null}
          </>
        }
        es={
          <>
            CrusherCal predice cada muestreo medido a partir de los otros nueve, para las dos magnitudes medidas, capacidad y potencia, y califica el P80 sólo como autoconsistencia porque la fuente publica sus curvas como figuras <Cite id="rocha2024" />. Las tablas siguientes ponen cinco modelos sobre los mismos pliegues: el esqueleto calibrado (M0), el esqueleto con un residuo acotado (M1), un ajuste de forma libre (M2) y dos controles, la media constante y unas etiquetas barajadas que no deben superar a M0.
            {m0 && mean ? (
              <>
                {' '}En capacidad, el esqueleto tiene un MAPE estricto de {f(m0.mape_pct, { decimals: 1 })} por ciento contra {f(mean.mape_pct, { decimals: 1 })} por ciento de la media constante.
              </>
            ) : null}
          </>
        }
      />
      <ReadinessNote ids={['hp500-loo']} />
      <Ready a={loo}>{(l) => <LooTables loo={l} />}</Ready>
      <Ready a={loo}>
        {(l) => <CoarseNote loo={l} />}
      </Ready>
      <P
        en={<>The learned surrogate is graded on a different footing, because its truth is the engine it imitates and not a plant. Its held-out draw is independent of its training draw, and the figures below are read from the model metrics <Cite id="koh2021" />.</>}
        es={<>El sustituto aprendido se califica sobre otra base, porque su verdad es el motor que imita y no una planta. Su sorteo reservado es independiente del de entrenamiento, y las cifras siguientes se leen de las métricas del modelo <Cite id="koh2021" />.</>}
      />
      <ReadinessNote ids={['model-metrics']} />
      <Ready a={metrics}>{(m) => <SurrogateTable metrics={m} />}</Ready>
    </DocSection>
  );
}
