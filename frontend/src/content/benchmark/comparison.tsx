// Comparison: a learned model beside a classical baseline on the same real data. First the calibrated backbone against the learned
// bounded residual (M1) on the ten surveys, strict against leaky folds; then the surrogate against the engine at the surveys' own
// operating points, computed in this browser.
import { BarChart, Cite, DocSection, PlotCard, ViewsRow, useFormat, useShellLang, type BarDatum } from '@fasl-work/caos-app-shell';
import { useEffect, useState } from 'react';
import type { Hp500Loo } from '../../lib/contract.types';
import { ReadinessNote } from '../../readiness/ReadinessNote';
import { P, useT } from '../bi';
import { INPUT_LABEL } from '../../lib/ort';
import { TARGET_LABEL, errPct, optimismGap, scoresOf, type Target } from './data';
import { runSurvey, type SurveyRun } from './runs';
import { CrusherBayesView } from './crusherbayes';
import { Pending, Ready, TableWrap, useBench } from './shared';
import type { Loaded } from '../../api/artifacts';

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
              'The calibrated backbone against the learned bounded residual, on the same folds. Strict: every scalar and the residual refit without the held-out survey. Leaky: fitted on all ten. The optimism gap is strict MAPE minus leaky MAPE, in points: how much fitting on the survey being predicted flatters the model.',
              'El esqueleto calibrado frente al residuo acotado aprendido, sobre los mismos pliegues. Estricto: cada escalar y el residuo se reajustan sin el muestreo reservado. Con fuga: ajustado con los diez. La brecha de optimismo es el MAPE estricto menos el MAPE con fuga, en puntos: cuánto favorece al modelo ajustarlo con el muestreo que se predice.',
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
                  <td className="caos-col-text">{m === 'M0_backbone' ? t('M0 calibrated backbone (phenomenological)', 'M0 esqueleto calibrado (fenomenológico)') : t('M1 bounded residual (learned)', 'M1 residuo acotado (aprendido)')}</td>
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
  const { surrogate, metrics } = useBench();
  if (runs.state !== 'ready') return <Pending of={runs} wait={{ en: 'Running the engines in this browser', es: 'Corriendo los motores en este navegador' }} />;
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
  const refused = rs.filter((r) => r.rule && !r.rule.applies);
  const m = metrics.state === 'ready' ? metrics.data.surrogate : null;
  const mape = (k: 'p80_mm' | 'throughput_tph' | 'power_kw') => (m ? f(m.per_output[k].mape_pct, { decimals: 1 }) : '');
  const verdict = (r: SurveyRun): string => {
    if (!r.rule) return t('not available', 'no disponible');
    if (r.rule.applies) return t('applies', 'aplica');
    if (r.rule.reasons.includes('calibrated_case')) return t('does not apply: calibrated case', 'no aplica: caso calibrado');
    const names = r.rule.reasons.map((x) => INPUT_LABEL[x.slice('outside_training_range:'.length) as keyof typeof INPUT_LABEL]?.[lang] ?? x);
    return `${t('does not apply: outside the training range in', 'no aplica: fuera del rango de entrenamiento en')} ${names.join(', ')}`;
  };
  return (
    <>
      <p>
        {t(
          `The surrogate is graded where it applies: on its own held-out draw, against the engine it emulates${m ? ` (${f(m.n_test, { decimals: 0 })} points; mean absolute percentage error ${mape('p80_mm')} percent in P80, ${mape('throughput_tph')} percent in throughput and ${mape('power_kw')} percent in power)` : ''}, in the first table of the Results section. It was trained on the uncalibrated engine over a range of inputs per machine, so a model applies to an operating point only when the point is not calibrated and every input lies inside its machine's training range. All ${refused.length} of the ${rs.length} surveys fail that rule, because a measured survey runs the calibrated fit, so the page computes no surrogate number for them: the calibrated engine answers there, and the comparison that carries the page on real data is the one above, the calibrated backbone against the bounded residual.`,
          `El sustituto se califica donde aplica: en su propio sorteo reservado, frente al motor que emula${m ? ` (${f(m.n_test, { decimals: 0 })} puntos; error porcentual absoluto medio de ${mape('p80_mm')} por ciento en P80, ${mape('throughput_tph')} por ciento en capacidad y ${mape('power_kw')} por ciento en potencia)` : ''}, en la primera tabla de la sección de Resultados. Se entrenó con el motor sin calibrar sobre un rango de entradas por máquina, así que un modelo aplica a un punto de operación sólo cuando el punto no está calibrado y cada entrada queda dentro del rango de entrenamiento de su máquina. Los ${refused.length} de los ${rs.length} muestreos incumplen esa regla, porque un muestreo medido corre el ajuste calibrado, así que la página no calcula ningún número del sustituto para ellos: allí responde el motor calibrado, y la comparación que sostiene la página con datos reales es la de arriba, el esqueleto calibrado frente al residuo acotado.`,
        )}
      </p>
      <TableWrap>
        <table className="caos-table" data-state="ready" data-live="surrogate-vs-engine">
          <caption>{t('The engines at each survey’s measured operating point (live), and the verdict of the applicability rule for the surrogate.', 'Los motores en el punto de operación medido de cada muestreo (en vivo), y el veredicto de la regla de aplicabilidad para el sustituto.')}</caption>
          <thead>
            <tr>
              <th className="caos-col-text">{t('Survey', 'Muestreo')}</th>
              <th>{t('Calibrated engine (t/h)', 'Motor calibrado (t/h)')}</th>
              <th>{t('Generic engine (t/h)', 'Motor genérico (t/h)')}</th>
              <th>{t('Calibrated engine (kW)', 'Motor calibrado (kW)')}</th>
              <th>{t('Generic engine (kW)', 'Motor genérico (kW)')}</th>
              <th className="caos-col-text">{t('Surrogate', 'Sustituto')}</th>
            </tr>
          </thead>
          <tbody>
            {rs.map((r) => (
              <tr key={r.id}>
                <td className="caos-col-text">{r.n}</td>
                <td>{f(r.calibrated.tph, { decimals: 0 })}</td>
                <td>{f(r.generic.tph, { decimals: 0 })}</td>
                <td>{f(r.calibrated.kw, { decimals: 0 })}</td>
                <td>{f(r.generic.kw, { decimals: 0 })}</td>
                <td className="caos-col-text">{verdict(r)}</td>
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
    <DocSection title={{ en: 'Learned residual and the calibrated backbone', es: 'Residuo aprendido y el modelo base calibrado' }} area="comparison" refs={['rocha2024', 'koh2021', 'kennedy2001', 'foremanmackey2013']}>
      <P
        en={
          <>
            The baseline here is the calibrated backbone, the Whiten and Evertsson engine with the HP500 constants fitted by the source paper <Cite id="rocha2024" />; the learned model is M1, a ridge residual on the setting and the feed f80, clipped to a fraction of the backbone, added on top. Both are scored on the same ten surveys and the same folds. The comparison that matters is the strict one; the leaky column is there to show how much of a learned model&apos;s apparent skill comes from having seen the survey it is asked about.
          </>
        }
        es={
          <>
            La línea base es aquí el esqueleto calibrado, el motor de Whiten y Evertsson con las constantes HP500 ajustadas por el artículo fuente <Cite id="rocha2024" />; el modelo aprendido es M1, un residuo de regresión ridge sobre la abertura y el f80 de la alimentación, acotado a una fracción del esqueleto y sumado encima. Ambos se califican sobre los mismos diez muestreos y los mismos pliegues. La comparación que importa es la estricta; la columna con fuga está para mostrar cuánto de la habilidad aparente de un modelo aprendido viene de haber visto el muestreo por el que se le pregunta.
          </>
        }
      />
      <ReadinessNote ids={['hp500-loo']} />
      <Ready a={loo}>{(l) => <OptimismTables loo={l} />}</Ready>
      <P
        en={
          <>
            The second comparison asks a different question: does the learned surrogate agree with the engine it replaced, at the operating points of the real surveys? The surrogate is trained only on the engine&apos;s synthetic sweeps <Cite id="koh2021" />, never on the surveys, and only over a range of inputs per machine, so the page asks first whether the surrogate applies to a survey at all, by the rule below, and grades it only where it does.
          </>
        }
        es={
          <>
            La segunda comparación hace otra pregunta: ¿concuerda el sustituto aprendido con el motor que reemplazó, en los puntos de operación de los muestreos reales? El sustituto se entrena sólo con los barridos sintéticos del motor <Cite id="koh2021" />, nunca con los muestreos, y sólo sobre un rango de entradas por máquina, así que la página pregunta primero si el sustituto aplica a un muestreo, por la regla de abajo, y lo califica sólo donde aplica.
          </>
        }
      />
      <ReadinessNote ids={['surrogate-model', 'case-manifest']} />
      <SurrogateVsEngine />
      <CrusherBayesView />
      <p className="caos-plot-note">{t('Rows are computed on each load of the page; nothing in them is stored.', 'Las filas se calculan en cada carga de la página; nada de ello se almacena.')}</p>
    </DocSection>
  );
}
