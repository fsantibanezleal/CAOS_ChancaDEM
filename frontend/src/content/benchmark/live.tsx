// Live: pick a measured survey and the calibrated engine and the surrogate run in this browser on its measured operating point;
// the measurement, the engine, the surrogate and CrusherCal's held-out prediction with its 80 percent band are shown side by side.
import { BarChart, ChipGroup, DocSection, PlotCard, Verdict, ViewsRow, useFormat, useShellLang, type BarDatum } from '@fasl-work/caos-app-shell';
import { useEffect, useState } from 'react';
import type { Loaded } from '../../api/artifacts';
import type { CaseManifest, Hp500Loo } from '../../lib/contract.types';
import { ReadinessNote } from '../../readiness/ReadinessNote';
import { P, useT } from '../bi';
import { bandFor } from './data';
import { runSurvey, type SurveyRun } from './runs';
import { Pending, Ready, TableWrap, useBench } from './shared';

function useRun(manifest: CaseManifest): Loaded<SurveyRun> {
  const { surrogate } = useBench();
  const [out, setOut] = useState<{ id: string; value: Loaded<SurveyRun> }>({ id: '', value: { state: 'loading' } });
  useEffect(() => {
    if (surrogate.state !== 'ready') return;
    let live = true;
    const contract = surrogate.data.answer === 'released' ? surrogate.data.contract : null;
    runSurvey(manifest, contract).then(
      (run) => live && setOut({ id: manifest.case_id, value: { state: 'ready', data: run } }),
      (e: unknown) => {
        console.error(`[benchmark] ${String(e)}`);
        if (live) setOut({ id: manifest.case_id, value: { state: 'error', error: String(e) } });
      },
    );
    return () => {
      live = false;
    };
  }, [manifest, surrogate]);
  if (surrogate.state !== 'ready') return surrogate.state === 'loading' ? { state: 'loading' } : (surrogate as Loaded<SurveyRun>);
  return out.id === manifest.case_id ? out.value : { state: 'loading' };
}

function Panel({ manifest, loo }: { manifest: CaseManifest; loo: Hp500Loo }) {
  const t = useT();
  const f = useFormat();
  const lang = useShellLang();
  const { surrogate } = useBench();
  const run = useRun(manifest);
  const n = manifest.measured?.survey ?? 0;
  const tph = bandFor(loo, 'tph', n);
  const kw = bandFor(loo, 'kW', n);
  const agrees = manifest.measured !== undefined && tph.measured === manifest.measured.feed_tph && kw.measured === manifest.measured.power_kw;
  if (!agrees) {
    return <Verdict title={{ en: 'Documents disagree', es: 'Los documentos discrepan' }} tone="bad" verdict={{ en: `Survey ${n}: the manifest and hp500/loo.json do not carry the same measurement.`, es: `Muestreo ${n}: el manifiesto y hp500/loo.json no traen la misma medición.` }} />;
  }
  if (run.state !== 'ready') return <Pending of={run} wait={{ en: 'Running the engine and the surrogate in this browser', es: 'Corriendo el motor y el sustituto en este navegador' }} />;
  const r = run.data;
  const baseline = surrogate.state === 'ready' && surrogate.data.answer === 'baseline' ? surrogate.data.reason : null;
  const inside = (tph.inside ? 1 : 0) + (kw.inside ? 1 : 0);
  const tone = inside === 2 ? 'good' : inside === 1 ? 'warn' : 'bad';
  const na = t('not available', 'no disponible');
  const extrapolates = (r.outside?.length ?? 0) > 0;
  const sur = (v: number | undefined, decimals: number) => (v === undefined ? na : `${f(v, { decimals })}${extrapolates ? t(' (extrapolation)', ' (extrapolación)') : ''}`);
  const bars = (measured: number, held: number, cal: number, gen: number, sur: number | undefined): BarDatum[] => [
    { id: 'measured', label: { en: 'Measured', es: 'Medido' }, value: measured, tone: 'good' },
    { id: 'held', label: { en: 'Held-out M0', es: 'M0 reservado' }, value: held, tone: 'accent' },
    { id: 'cal', label: { en: 'Calibrated engine', es: 'Motor calibrado' }, value: cal, tone: 'accent' },
    { id: 'gen', label: { en: 'Generic engine', es: 'Motor genérico' }, value: gen, tone: 'neutral' },
    ...(sur === undefined ? [] : [{ id: 'sur', label: { en: 'Surrogate', es: 'Sustituto' }, value: sur, tone: 'warn' as const }]),
  ];
  return (
    <>
      <Verdict
        compact
        title={{ en: 'Measured against the held-out band', es: 'Medido frente a la banda reservada' }}
        tone={tone}
        verdict={{
          en: `Survey ${n}: the measured throughput ${tph.inside ? 'lies inside' : 'lies outside'} the 80 percent band of the held-out backbone and the measured power ${kw.inside ? 'lies inside' : 'lies outside'} it.`,
          es: `Muestreo ${n}: la capacidad medida ${tph.inside ? 'queda dentro' : 'queda fuera'} de la banda del 80 por ciento del esqueleto reservado y la potencia medida ${kw.inside ? 'queda dentro' : 'queda fuera'} de ella.`,
        }}
      />
      <TableWrap>
        <table className="caos-table" data-state="ready" data-live="survey">
          <caption>
            {t(
              `Survey ${n}: setting ${f(r.measured.css, { decimals: 0 })} mm, feed f80 ${f(r.measured.f80, { decimals: 0 })} mm. The engine and the surrogate ran in this browser on the survey's measured operating point; the held-out prediction and its band are read from CrusherCal.`,
              `Muestreo ${n}: abertura ${f(r.measured.css, { decimals: 0 })} mm, f80 de alimentación ${f(r.measured.f80, { decimals: 0 })} mm. El motor y el sustituto corrieron en este navegador en el punto de operación medido del muestreo; la predicción reservada y su banda se leen de CrusherCal.`,
            )}
          </caption>
          <thead>
            <tr>
              <th className="caos-col-text">{t('Quantity', 'Magnitud')}</th>
              <th>{t('Measured', 'Medido')}</th>
              <th>{t('Held-out M0', 'M0 reservado')}</th>
              <th>{t('80% band', 'Banda del 80%')}</th>
              <th>{t('Calibrated engine (live)', 'Motor calibrado (en vivo)')}</th>
              <th>{t('Generic engine (live)', 'Motor genérico (en vivo)')}</th>
              <th>{t('Surrogate (live)', 'Sustituto (en vivo)')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="caos-col-text">{t('Throughput (t/h)', 'Capacidad (t/h)')}</td>
              <td>{f(tph.measured, { decimals: 0 })}</td>
              <td>{f(tph.pred, { decimals: 0 })}</td>
              <td>{`${f(tph.lo, { decimals: 0 })} ${t('to', 'a')} ${f(tph.hi, { decimals: 0 })}`}</td>
              <td>{f(r.calibrated.tph, { decimals: 0 })}</td>
              <td>{f(r.generic.tph, { decimals: 0 })}</td>
              <td>{sur(r.surrogate?.tph, 0)}</td>
            </tr>
            <tr>
              <td className="caos-col-text">{t('Power (kW)', 'Potencia (kW)')}</td>
              <td>{f(kw.measured, { decimals: 0 })}</td>
              <td>{f(kw.pred, { decimals: 0 })}</td>
              <td>{`${f(kw.lo, { decimals: 0 })} ${t('to', 'a')} ${f(kw.hi, { decimals: 0 })}`}</td>
              <td>{f(r.calibrated.kw, { decimals: 0 })}</td>
              <td>{f(r.generic.kw, { decimals: 0 })}</td>
              <td>{sur(r.surrogate?.kw, 0)}</td>
            </tr>
            <tr>
              <td className="caos-col-text">{t('P80 (mm)', 'P80 (mm)')}</td>
              <td>{t('not measured', 'no medido')}</td>
              <td>{na}</td>
              <td>{na}</td>
              <td>{f(r.calibrated.p80, { decimals: 1 })}</td>
              <td>{f(r.generic.p80, { decimals: 1 })}</td>
              <td>{sur(r.surrogate?.p80, 1)}</td>
            </tr>
          </tbody>
        </table>
      </TableWrap>
      {baseline ? (
        <p className="caos-plot-note" data-readiness="training">
          {t('The surrogate slot has no released model; the engine answers in its place.', 'La ranura del sustituto no tiene un modelo publicado; el motor responde en su lugar.')} {baseline[lang]}
        </p>
      ) : null}
      {r.outside && r.outside.length > 0 ? (
        <p className="caos-plot-note">
          {t('The surrogate runs outside its training range on this survey, in the inputs listed in the comparison above; read its column as an extrapolation.', 'El sustituto corre fuera de su rango de entrenamiento en este muestreo, en las entradas que lista la comparación de arriba; lea su columna como una extrapolación.')}
        </p>
      ) : null}
      <ViewsRow>
        <PlotCard title={{ en: 'Throughput, side by side', es: 'Capacidad, lado a lado' }} lane="live" provenance="real">
          <BarChart
            title={{ en: 'Throughput, side by side', es: 'Capacidad, lado a lado' }}
            orientation="vertical"
            height={260}
            axis={{ label: { en: 'Throughput', es: 'Capacidad' }, unit: 't/h', format: { decimals: 0 } }}
            data={bars(tph.measured, tph.pred, r.calibrated.tph, r.generic.tph, r.surrogate?.tph)}
          />
        </PlotCard>
        <PlotCard title={{ en: 'Power, side by side', es: 'Potencia, lado a lado' }} lane="live" provenance="real">
          <BarChart
            title={{ en: 'Power, side by side', es: 'Potencia, lado a lado' }}
            orientation="vertical"
            height={260}
            axis={{ label: { en: 'Power', es: 'Potencia' }, unit: 'kW', format: { decimals: 0 } }}
            data={bars(kw.measured, kw.pred, r.calibrated.kw, r.generic.kw, r.surrogate?.kw)}
          />
        </PlotCard>
      </ViewsRow>
    </>
  );
}

function Picker({ surveys, loo }: { surveys: CaseManifest[]; loo: Hp500Loo }) {
  const t = useT();
  const [pick, setPick] = useState<string | null>(null);
  const selected = surveys.find((m) => m.case_id === pick) ?? surveys[0];
  return (
    <>
      <ChipGroup
        id="bench-survey"
        label={{ en: 'Survey (Metso HP500 at Minas Rio)', es: 'Muestreo (Metso HP500 en Minas Rio)' }}
        value={selected.case_id}
        onChange={setPick}
        options={surveys.map((m) => ({ id: m.case_id, label: { en: String(m.measured?.survey ?? m.case_id), es: String(m.measured?.survey ?? m.case_id) }, hint: m.title }))}
      />
      <p className="caos-plot-note">{t('Nothing leaves this page: the engine and the surrogate run in your browser on the committed documents.', 'Nada sale de esta página: el motor y el sustituto corren en su navegador sobre los documentos versionados.')}</p>
      <Panel key={selected.case_id} manifest={selected} loo={loo} />
    </>
  );
}

export function Live() {
  const { surveys, loo } = useBench();
  return (
    <DocSection title={{ en: 'Run a survey in your browser', es: 'Correr un muestreo en su navegador' }} area="live" noRefsReason={{ en: 'Runs the engine and the models of this build in the browser.', es: 'Corre el motor y los modelos de esta compilación en el navegador.' }}>
      <P
        en="Choose one of the ten measured surveys. The calibrated engine and the learned surrogate run here, in WebAssembly and TypeScript, on the survey's own setting, feed size, throw and speed, and the table sets their answers beside the measurement and beside what CrusherCal predicted for that survey when it was held out, with the 80 percent band around that prediction."
        es="Elija uno de los diez muestreos medidos. El motor calibrado y el sustituto aprendido corren aquí, en WebAssembly y TypeScript, con la abertura, el tamaño de alimentación, la carrera y la velocidad del propio muestreo, y la tabla pone sus respuestas junto a la medición y junto a lo que CrusherCal predijo para ese muestreo cuando estaba reservado, con la banda del 80 por ciento alrededor de esa predicción."
      />
      <ReadinessNote ids={['case-manifest', 'hp500-loo', 'surrogate-model']} />
      <Ready a={surveys} b={loo}>
        {(s, l) => <Picker surveys={s} loo={l} />}
      </Ready>
    </DocSection>
  );
}
