// Comparison: a learned model beside a classical baseline on the same real data. First the calibrated backbone against the learned
// bounded residual (M1) on the ten surveys, strict against leaky folds; then the surrogate against the engine at the surveys' own
// operating points, computed in this browser.
import { BarChart, Cite, DocSection, PlotCard, ViewsRow, useFormat, useShellLang, type BarDatum } from '@fasl-work/caos-app-shell';
import { useEffect, useState } from 'react';
import type { Hp500Loo } from '../../lib/contract.types';
import { ReadinessNote } from '../../readiness/ReadinessNote';
import { P, useT } from '../bi';
import { INPUT_LABEL, TARGET_LABEL, errPct, optimismGap, scoresOf, type Target } from './data';
import { runSurvey, type SurveyRun } from './runs';
import { Pending, Ready, TableWrap, useBench } from './shared';
import type { Loaded } from '../../api/artifacts';

/** A list in prose: `a, b and c`. */
const andList = (v: string[], word: string): string => (v.length < 2 ? v.join('') : `${v.slice(0, -1).join(', ')} ${word} ${v[v.length - 1]}`);

const GAP_TARGETS: Target[] = ['tph', 'kW'];

function OptimismTables({ loo }: { loo: Hp500Loo }) {
  const t = useT();
  const f = useFormat();
  const lang = useShellLang();
  const bars = (target: Target): BarDatum[] => [
    { id: 'm0s', label: { en: 'M0 strict', es: 'M0 estricto' }, value: scoresOf(loo, target, 'strict', 'M0_backbone').mape_pct, tone: 'accent' },
    { id: 'm0l', label: { en: 'M0 leaky', es: 'M0 con fuga' }, value: scoresOf(loo, target, 'leaky', 'M0_backbone').mape_pct, tone: 'warn' },
    { id: 'm1s', label: { en: 'M1 strict', es: 'M1 estricto' }, value: scoresOf(loo, target, 'strict', 'M1_residual').mape_pct, tone: 'accent' },
    { id: 'm1l', label: { en: 'M1 leaky', es: 'M1 con fuga' }, value: scoresOf(loo, target, 'leaky', 'M1_residual').mape_pct, tone: 'warn' },
  ];
  const meas = loo.loo.tph.measured.length;
  return (
    <>
      <TableWrap>
        <table className="caos-table" data-state="ready">
          <caption>
            {t(
              'The classical backbone against the learned bounded residual, on the same folds. Strict: every scalar and the residual refit without the held-out survey. Leaky: fitted on all ten. The optimism gap is strict MAPE minus leaky MAPE, in points: how much fitting on the survey being predicted flatters the model.',
              'El esqueleto clásico frente al residuo acotado aprendido, sobre los mismos pliegues. Estricto: cada escalar y el residuo se reajustan sin el muestreo reservado. Con fuga: ajustado con los diez. La brecha de optimismo es el MAPE estricto menos el MAPE con fuga, en puntos: cuánto favorece al modelo ajustarlo con el muestreo que se predice.',
            )}
          </caption>
          <thead>
            <tr>
              <th className="caos-col-text">{t('Target', 'Magnitud')}</th>
              <th className="caos-col-text">{t('Model', 'Modelo')}</th>
              <th>{t('Strict MAPE (%)', 'MAPE estricto (%)')}</th>
              <th>{t('Leaky MAPE (%)', 'MAPE con fuga (%)')}</th>
              <th>{t('Optimism gap (points)', 'Brecha de optimismo (puntos)')}</th>
            </tr>
          </thead>
          <tbody>
            {GAP_TARGETS.flatMap((target) =>
              (['M0_backbone', 'M1_residual'] as const).map((m) => (
                <tr key={`${target}-${m}`}>
                  <td className="caos-col-text">{TARGET_LABEL[target][lang]}</td>
                  <td className="caos-col-text">{m === 'M0_backbone' ? t('M0 calibrated backbone (classical)', 'M0 esqueleto calibrado (clásico)') : t('M1 bounded residual (learned)', 'M1 residuo acotado (aprendido)')}</td>
                  <td>{f(scoresOf(loo, target, 'strict', m).mape_pct, { decimals: 1 })}</td>
                  <td>{f(scoresOf(loo, target, 'leaky', m).mape_pct, { decimals: 1 })}</td>
                  <td>{f(optimismGap(loo, target, m), { decimals: 1 })}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </TableWrap>
      <ViewsRow>
        {GAP_TARGETS.map((target) => (
          <PlotCard key={target} title={{ en: `Strict and leaky MAPE, ${TARGET_LABEL[target].en}`, es: `MAPE estricto y con fuga, ${TARGET_LABEL[target].es}` }} lane="offline" provenance="real">
            <BarChart
              title={{ en: `Strict and leaky MAPE, ${TARGET_LABEL[target].en}`, es: `MAPE estricto y con fuga, ${TARGET_LABEL[target].es}` }}
              orientation="vertical"
              height={260}
              axis={{ label: { en: 'MAPE', es: 'MAPE' }, unit: '%', format: { decimals: 1 } }}
              data={bars(target)}
              legend={[
                { tone: 'accent', label: { en: 'Strict folds', es: 'Pliegues estrictos' } },
                { tone: 'warn', label: { en: 'Leaky folds', es: 'Pliegues con fuga' } },
              ]}
            />
          </PlotCard>
        ))}
      </ViewsRow>
      <TableWrap>
        <table className="caos-table" data-state="ready">
          <caption>
            {t(
              `The ${meas} surveys one by one, strict folds: the signed error of each model in percent of the measurement (positive when the model predicts above it).`,
              `Los ${meas} muestreos uno a uno, pliegues estrictos: el error con signo de cada modelo en porcentaje de lo medido (positivo cuando el modelo predice sobre ello).`,
            )}
          </caption>
          <thead>
            <tr>
              <th className="caos-col-text">{t('Survey', 'Muestreo')}</th>
              <th>{t('Measured (t/h)', 'Medido (t/h)')}</th>
              <th>{t('M0 error (%)', 'Error de M0 (%)')}</th>
              <th>{t('M1 error (%)', 'Error de M1 (%)')}</th>
              <th>{t('Measured (kW)', 'Medido (kW)')}</th>
              <th>{t('M0 error (%)', 'Error de M0 (%)')}</th>
              <th>{t('M1 error (%)', 'Error de M1 (%)')}</th>
            </tr>
          </thead>
          <tbody>
            {loo.loo.tph.measured.map((m, i) => (
              <tr key={i}>
                <td className="caos-col-text">{i + 1}</td>
                <td>{f(m, { decimals: 0 })}</td>
                <td>{f(errPct(loo.loo.tph.strict.pred.M0[i], m), { decimals: 1 })}</td>
                <td>{f(errPct(loo.loo.tph.strict.pred.M1[i], m), { decimals: 1 })}</td>
                <td>{f(loo.loo.kW.measured[i], { decimals: 0 })}</td>
                <td>{f(errPct(loo.loo.kW.strict.pred.M0[i], loo.loo.kW.measured[i]), { decimals: 1 })}</td>
                <td>{f(errPct(loo.loo.kW.strict.pred.M1[i], loo.loo.kW.measured[i]), { decimals: 1 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </>
  );
}

/** The engine and the surrogate at the ten surveys' operating points, run in this browser once the manifests and the slot are there. */
function useSurveyRuns(): Loaded<SurveyRun[]> {
  const { surveys, surrogate } = useBench();
  const [out, setOut] = useState<Loaded<SurveyRun[]>>({ state: 'loading' });
  useEffect(() => {
    if (surveys.state !== 'ready' || surrogate.state !== 'ready') return;
    let live = true;
    const contract = surrogate.data.answer === 'released' ? surrogate.data.contract : null;
    (async () => {
      const runs: SurveyRun[] = [];
      for (const m of surveys.data) runs.push(await runSurvey(m, contract));
      if (live) setOut({ state: 'ready', data: runs });
    })().catch((e: unknown) => {
      console.error(`[benchmark] ${String(e)}`);
      if (live) setOut({ state: 'error', error: String(e) });
    });
    return () => {
      live = false;
    };
  }, [surveys, surrogate]);
  if (surveys.state !== 'ready') return surveys.state === 'loading' ? { state: 'loading' } : (surveys as Loaded<SurveyRun[]>);
  if (surrogate.state !== 'ready') return surrogate.state === 'loading' ? { state: 'loading' } : (surrogate as Loaded<SurveyRun[]>);
  return out;
}

function SurrogateVsEngine() {
  const t = useT();
  const f = useFormat();
  const lang = useShellLang();
  const runs = useSurveyRuns();
  const { surrogate } = useBench();
  if (runs.state !== 'ready') return <Pending of={runs} wait={{ en: 'Running the engine and the surrogate in this browser', es: 'Corriendo el motor y el sustituto en este navegador' }} />;
  const slot = surrogate.state === 'ready' ? surrogate.data : null;
  const rs = runs.data;
  if (!slot || slot.answer === 'baseline') {
    return (
      <p className="caos-pending" data-state="unavailable">
        {slot ? (lang === 'es' ? slot.reason.es : slot.reason.en) : ''}{' '}
        {t('The engine answers in place of the surrogate; there is nothing to compare.', 'El motor responde en lugar del sustituto; no hay nada que comparar.')}
      </p>
    );
  }
  const flagged = rs.filter((r) => r.outside && r.outside.length > 0);
  const names = [...new Set(flagged.flatMap((r) => r.outside ?? []))];
  const rel = (a: number | undefined, b: number) => (a === undefined ? null : errPct(a, b));
  const median = (v: number[]) => {
    const s = [...v].sort((x, y) => x - y);
    return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
  };
  const medTph = median(rs.map((r) => Math.abs(rel(r.surrogate?.tph, r.generic.tph) ?? NaN)).filter(Number.isFinite));
  const medKw = median(rs.map((r) => Math.abs(rel(r.surrogate?.kw, r.generic.kw) ?? NaN)).filter(Number.isFinite));
  return (
    <>
      <p>
        {t(
          `Computed in this browser, live, for the ${rs.length} surveys. The surrogate emulates the generic engine (no HP500 calibration), so the fair reference is the generic engine; the calibrated engine, the backbone CrusherCal validates, is shown beside it. Median absolute difference of the surrogate against the generic engine: ${f(medTph, { decimals: 1 })} percent in throughput and ${f(medKw, { decimals: 1 })} percent in power.`,
          `Calculado en este navegador, en vivo, para los ${rs.length} muestreos. El sustituto emula el motor genérico (sin calibración HP500), así que la referencia justa es el motor genérico; el motor calibrado, el esqueleto que valida CrusherCal, se muestra a su lado. Diferencia absoluta mediana del sustituto frente al motor genérico: ${f(medTph, { decimals: 1 })} por ciento en capacidad y ${f(medKw, { decimals: 1 })} por ciento en potencia.`,
        )}
        {flagged.length > 0 && names.length > 0
          ? t(
              ` In ${flagged.length} of the ${rs.length} surveys the ${andList(names.map((n) => INPUT_LABEL[n].en), 'and')} ${names.length > 1 ? 'lie' : 'lies'} outside the range the surrogate was trained on for this machine, so those rows measure its extrapolation and not its error on its own range, which is the held-out table of the first section.`,
              ` En ${flagged.length} de los ${rs.length} muestreos ${andList(names.map((n) => INPUT_LABEL[n].es), 'y')} ${names.length > 1 ? 'quedan' : 'queda'} fuera del rango con que se entrenó el sustituto para esta máquina, así que esas filas miden su extrapolación y no su error en su propio rango, que es la tabla reservada de la primera sección.`,
            )
          : ''}
      </p>
      <TableWrap>
        <table className="caos-table" data-state="ready" data-live="surrogate-vs-engine">
          <caption>{t('The surrogate against the engine at each survey’s measured operating point (live).', 'El sustituto frente al motor en el punto de operación medido de cada muestreo (en vivo).')}</caption>
          <thead>
            <tr>
              <th className="caos-col-text">{t('Survey', 'Muestreo')}</th>
              <th>{t('Calibrated engine (t/h)', 'Motor calibrado (t/h)')}</th>
              <th>{t('Generic engine (t/h)', 'Motor genérico (t/h)')}</th>
              <th>{t('Surrogate (t/h)', 'Sustituto (t/h)')}</th>
              <th>{t('Surrogate vs generic (%)', 'Sustituto frente a genérico (%)')}</th>
              <th>{t('Calibrated engine (kW)', 'Motor calibrado (kW)')}</th>
              <th>{t('Generic engine (kW)', 'Motor genérico (kW)')}</th>
              <th>{t('Surrogate (kW)', 'Sustituto (kW)')}</th>
              <th>{t('Surrogate vs generic (%)', 'Sustituto frente a genérico (%)')}</th>
              <th className="caos-col-text">{t('Inputs outside the training range', 'Entradas fuera del rango de entrenamiento')}</th>
            </tr>
          </thead>
          <tbody>
            {rs.map((r) => (
              <tr key={r.id}>
                <td className="caos-col-text">{r.n}</td>
                <td>{f(r.calibrated.tph, { decimals: 0 })}</td>
                <td>{f(r.generic.tph, { decimals: 0 })}</td>
                <td>{f(r.surrogate?.tph, { decimals: 0 })}</td>
                <td>{f(rel(r.surrogate?.tph, r.generic.tph), { decimals: 1 })}</td>
                <td>{f(r.calibrated.kw, { decimals: 0 })}</td>
                <td>{f(r.generic.kw, { decimals: 0 })}</td>
                <td>{f(r.surrogate?.kw, { decimals: 0 })}</td>
                <td>{f(rel(r.surrogate?.kw, r.generic.kw), { decimals: 1 })}</td>
                <td className="caos-col-text">{r.outside === null ? t('not available', 'no disponible') : r.outside.length === 0 ? t('none', 'ninguna') : r.outside.map((n) => INPUT_LABEL[n][lang]).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </>
  );
}

export function Comparison() {
  const { loo } = useBench();
  const t = useT();
  return (
    <DocSection title={{ en: 'Learned model and classical baseline', es: 'Modelo aprendido y línea base clásica' }} area="comparison" refs={['rocha2024', 'koh2021']}>
      <P
        en={
          <>
            The classical baseline here is the calibrated backbone, the Whiten and Evertsson engine with the HP500 constants fitted by the source paper <Cite id="rocha2024" />; the learned model is M1, a ridge residual on the setting and the feed f80, clipped to a fraction of the backbone, added on top. Both are scored on the same ten surveys and the same folds. The comparison that matters is the strict one; the leaky column is there to show how much of a learned model&apos;s apparent skill comes from having seen the survey it is asked about.
          </>
        }
        es={
          <>
            La línea base clásica es aquí el esqueleto calibrado, el motor de Whiten y Evertsson con las constantes HP500 ajustadas por el artículo fuente <Cite id="rocha2024" />; el modelo aprendido es M1, un residuo de regresión ridge sobre la abertura y el f80 de la alimentación, acotado a una fracción del esqueleto y sumado encima. Ambos se califican sobre los mismos diez muestreos y los mismos pliegues. La comparación que importa es la estricta; la columna con fuga está para mostrar cuánto de la habilidad aparente de un modelo aprendido viene de haber visto el muestreo por el que se le pregunta.
          </>
        }
      />
      <ReadinessNote ids={['hp500-loo']} />
      <Ready a={loo}>{(l) => <OptimismTables loo={l} />}</Ready>
      <P
        en={
          <>
            The second comparison asks a different question: does the learned surrogate agree with the engine it replaced, at the operating points of the real surveys? The surrogate is trained only on the engine&apos;s synthetic sweeps <Cite id="koh2021" />, never on the surveys, so this is a test of how far it carries outside its sweep.
          </>
        }
        es={
          <>
            La segunda comparación hace otra pregunta: ¿concuerda el sustituto aprendido con el motor que reemplazó, en los puntos de operación de los muestreos reales? El sustituto se entrena sólo con los barridos sintéticos del motor <Cite id="koh2021" />, nunca con los muestreos, así que esto prueba hasta dónde llega fuera de su barrido.
          </>
        }
      />
      <ReadinessNote ids={['surrogate-model', 'case-manifest']} />
      <SurrogateVsEngine />
      <p className="caos-plot-note">{t('Rows are computed on each load of the page; nothing in them is stored.', 'Las filas se calculan en cada carga de la página; nada de ello se almacena.')}</p>
    </DocSection>
  );
}
