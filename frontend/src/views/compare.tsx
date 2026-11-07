// Catalog row V6, comparison and decision: which method should a forecast of throughput and power trust, measured on surveys it never
// saw? The held-out (strict leave-one-survey-out) MAPE of every method of hp500-loo and of CrusherBayes (hp500-crusherbayes) on shared
// axes, the ten per-survey errors as points beside each method, the predictive bands where the documents have them, and the method
// with the lowest held-out MAPE per target marked as the recommended one with its reason (SH-009). The two controls of the protocol
// (the constant mean and the label shuffle) are drawn as the bars to beat and are never recommended: they are checks, not forecasts.
// Every number is read from the committed documents; the per-survey errors are recomputed from their predictions and measurements, and
// their mean is the document's MAPE (the test holds the two equal).
import { PlotCard, ViewsRow, useLinkedItem, useShellLang, useWorkbenchState, type BiText } from '@fasl-work/caos-app-shell';
import { UPlotChart, type ChartSeries } from '@fasl-work/caos-app-shell/chart';
import { useState } from 'react';
import { loadHp500CrusherBayes, loadHp500Loo, useArtifact } from '../api/artifacts';
import type { CaseIndex, Hp500CrusherBayes, Hp500Loo, Text } from '../lib/contract.types';
import { ChartCallouts, type CalloutSpec, type ChartPoint } from './callouts';
import { linkedId, selectedOf, useLinkedSelection } from './linked';
import { bare, useNum, useT, useView } from './shared';

export type CompareTarget = 'tph' | 'kW';

export interface MethodRow {
  id: string;
  name: Text;
  /** A control of the protocol: drawn, never recommended. */
  control: boolean;
  mape: number;
  /** The absolute percent error on each held-out survey, or null when the document carries no per-survey prediction. */
  errors: number[] | null;
  /** The per-survey predictions, for the band chart. */
  pred: number[] | null;
  /** The 80 percent predictive band per survey, where the document has one. */
  band: { lo: number[]; hi: number[]; coverage: number } | null;
  source: Text;
}

/** The methods of the comparison by their names (the documents' keys stay the documents'). */
export const METHOD_NAME: Record<string, Text> = {
  M0_backbone: { en: 'Calibrated backbone', es: 'Esqueleto calibrado' },
  M1_residual: { en: 'Backbone plus bounded residual', es: 'Esqueleto más residuo acotado' },
  M2_freeform: { en: 'Free-form fit', es: 'Ajuste de forma libre' },
  B_lin: { en: 'Setting-only line', es: 'Línea solo de la abertura' },
  Morrell: { en: 'Morrell size-specific energy', es: 'Energía específica de Morrell' },
  Morrell_noload: { en: 'Morrell with a no-load term', es: 'Morrell con término en vacío' },
  crusherbayes: { en: 'CrusherBayes', es: 'CrusherBayes' },
  constant_mean: { en: 'Constant mean (control)', es: 'Media constante (control)' },
  M1_label_shuffle: { en: 'Label shuffle (control)', es: 'Etiquetas barajadas (control)' },
};

/** The short names on the chart's axis. */
export const METHOD_SHORT: Record<string, Text> = {
  M0_backbone: { en: 'Backbone', es: 'Esqueleto' },
  M1_residual: { en: 'Residual', es: 'Residuo' },
  M2_freeform: { en: 'Free-form', es: 'Forma libre' },
  B_lin: { en: 'Setting-only', es: 'Solo abertura' },
  Morrell: { en: 'Morrell', es: 'Morrell' },
  Morrell_noload: { en: 'Morrell no-load', es: 'Morrell vacío' },
  crusherbayes: { en: 'CrusherBayes', es: 'CrusherBayes' },
  constant_mean: { en: 'Mean', es: 'Media' },
  M1_label_shuffle: { en: 'Shuffle', es: 'Barajada' },
};

/** The key of a method's per-survey predictions in the document's `pred` object: the ladder rows keep their row key's prefix. */
const predKeyOf = (id: string): string | null => (id === 'constant_mean' || id === 'M1_label_shuffle' ? null : /^M\d_/.test(id) ? id.slice(0, 2) : id);

const absErrors = (pred: readonly number[], measured: readonly number[]) => pred.map((p, i) => (Math.abs(p - measured[i]) / measured[i]) * 100);

/** The rows of a target, read from the documents; CrusherBayes is absent from them when its document is (null). */
export function compareRows(loo: Hp500Loo, cb: Hp500CrusherBayes | null, target: CompareTarget): MethodRow[] {
  const t = loo.loo[target];
  const strict = t.strict as Record<string, unknown> & typeof t.strict;
  const measured = t.measured;
  const looSource: Text = { en: `hp500/loo.json, strict leave-one-survey-out, ${target}`, es: `hp500/loo.json, dejando un muestreo fuera, ${target}` };
  const rows: MethodRow[] = [];
  for (const id of ['M0_backbone', 'M1_residual', 'M2_freeform', 'B_lin', 'Morrell', 'Morrell_noload', 'constant_mean', 'M1_label_shuffle']) {
    const scores = strict[id] as { mape_pct: number } | undefined;
    if (!scores) continue;
    const key = predKeyOf(id);
    const pred = key ? ((t.strict.pred as Record<string, number[] | undefined>)[key] ?? null) : null;
    const band =
      id === 'M0_backbone' && pred ? { lo: pred.map((p) => p - t.strict.uq.band_halfwidth), hi: pred.map((p) => p + t.strict.uq.band_halfwidth), coverage: t.strict.uq.empirical_coverage } : null;
    rows.push({
      id,
      name: METHOD_NAME[id],
      control: id === 'constant_mean' || id === 'M1_label_shuffle',
      mape: scores.mape_pct,
      errors: pred ? absErrors(pred, measured) : null,
      pred,
      band,
      source: looSource,
    });
  }
  if (cb) {
    const c = cb.loo[target];
    rows.push({
      id: 'crusherbayes',
      name: METHOD_NAME.crusherbayes,
      control: false,
      mape: c.scores.mape_pct,
      errors: absErrors(c.pred_mean, c.measured),
      pred: [...c.pred_mean],
      band: { lo: [...c.lo80], hi: [...c.hi80], coverage: c.scores.coverage_80 },
      source: { en: `hp500/crusherbayes.json, held out, ${target}`, es: `hp500/crusherbayes.json, reservado, ${target}` },
    });
  }
  return rows;
}

/** The recommended method of a target: the lowest held-out MAPE among the methods that are not controls (null when there is none). */
export function recommend(rows: readonly MethodRow[]): MethodRow | null {
  let best: MethodRow | null = null;
  for (const r of rows) if (!r.control && Number.isFinite(r.mape) && (best === null || r.mape < best.mape)) best = r;
  return best;
}

/** Why the recommended method is recommended, in the problem's terms. */
export function recommendReason(best: MethodRow, rows: readonly MethodRow[], target: CompareTarget, fmt: (v: number) => string): Text {
  const methods = rows.filter((r) => !r.control).length;
  const what: Text = target === 'tph' ? { en: 'throughput', es: 'capacidad' } : { en: 'power', es: 'potencia' };
  return {
    en: `Recommended for ${what.en}: ${best.name.en}, the lowest held-out error of the ${methods} methods on the ten surveys it never saw (${fmt(best.mape)} percent mean absolute error).`,
    es: `Recomendado para ${what.es}: ${best.name.es}, el menor error reservado de los ${methods} métodos en los diez muestreos que nunca vio (${fmt(best.mape)} por ciento de error absoluto medio).`,
  };
}

/** The three callouts of the comparison: the recommended method, the selected one and the constant mean, the bar to beat. */
export function compareCallouts(rows: readonly MethodRow[], best: MethodRow | null, chosen: MethodRow, fmt: (v: number, o: { digits?: number }) => string): CalloutSpec[] {
  const control = rows.find((r) => r.id === 'constant_mean') ?? null;
  const unit = { en: '% held-out MAPE', es: '% MAPE reservado' };
  return [
    best
      ? {
          id: 'best',
          eyebrow: { en: `RECOMMENDED: ${METHOD_SHORT[best.id].en.toUpperCase()}`, es: `RECOMENDADO: ${METHOD_SHORT[best.id].es.toUpperCase()}` },
          value: fmt(best.mape, { digits: 3 }),
          unit,
          state: 'normal',
          source: best.source,
        }
      : {
          id: 'best',
          eyebrow: { en: 'RECOMMENDED', es: 'RECOMENDADO' },
          value: null,
          unit,
          state: 'inactive',
          source: { en: 'no method', es: 'ningún método' },
          missing: { en: 'no method is scored for this target', es: 'ningún método tiene puntaje para este objetivo' },
        },
    {
      id: 'chosen',
      eyebrow: { en: `SELECTED: ${METHOD_SHORT[chosen.id].en.toUpperCase()}`, es: `SELECCIONADO: ${METHOD_SHORT[chosen.id].es.toUpperCase()}` },
      value: fmt(chosen.mape, { digits: 3 }),
      unit,
      state: 'selected',
      source: chosen.source,
    },
    control
      ? { id: 'control', eyebrow: { en: 'THE BAR TO BEAT: MEAN', es: 'LA VARA: MEDIA' }, value: fmt(control.mape, { digits: 3 }), unit, state: 'warning', source: control.source }
      : {
          id: 'control',
          eyebrow: { en: 'THE BAR TO BEAT: MEAN', es: 'LA VARA: MEDIA' },
          value: null,
          unit,
          state: 'inactive',
          source: { en: 'hp500/loo.json', es: 'hp500/loo.json' },
          missing: { en: 'the document carries no constant-mean control', es: 'el documento no trae el control de media constante' },
        },
  ];
}

/** The survey number of a real case id (HP500-03 is survey 3), or null. */
export const surveyOfCase = (caseId: string | undefined): number | null => {
  const m = caseId ? /^HP500-(\d+)$/.exec(caseId) : null;
  return m ? Number(m[1]) : null;
};
export const caseOfSurvey = (n: number): string => `HP500-${String(n).padStart(2, '0')}`;

function MethodButton({ row, best, lang }: { row: MethodRow; best: boolean; lang: 'en' | 'es' }) {
  const item = useLinkedItem(linkedId('method', row.id), 'panel');
  return (
    <button type="button" className="cdem-linkbtn" {...item} data-recommended={best ? 'true' : 'false'}>
      {row.name[lang]}
      {best ? (lang === 'es' ? ' (recomendado)' : ' (recommended)') : ''}
    </button>
  );
}

function SurveyButton({ n, current, onPick }: { n: number; current: boolean; onPick: () => void }) {
  const item = useLinkedItem(linkedId('survey', n), 'panel');
  return (
    <button
      type="button"
      className="cdem-linkbtn"
      data-linked-id={item['data-linked-id']}
      data-linked-view={item['data-linked-view']}
      data-linked-selected={current ? 'true' : item['data-linked-selected']}
      aria-pressed={current}
      onClick={() => {
        item.onClick();
        onPick();
      }}
    >
      {n}
    </button>
  );
}

/** The comparison: the dot plot of the held-out errors (the stage) and the selected method's predictions with their band. */
export function CompareBody({
  loo,
  cb,
  cbReason,
  target,
  setTarget,
  caseId,
  onPickCase,
  part,
}: {
  loo: Hp500Loo;
  cb: Hp500CrusherBayes | null;
  cbReason: Text | null;
  target: CompareTarget;
  setTarget: (t: CompareTarget) => void;
  caseId: string | undefined;
  onPickCase: (caseId: string) => void;
  part?: 'stage' | 'panel';
}) {
  const lang = useShellLang();
  const num = useNum();
  const t = useT();
  const stateKey = useWorkbenchState()?.stateKey;
  const { selectedId } = useLinkedSelection();
  const rows = compareRows(loo, cb, target);
  const best = recommend(rows);
  const chosenId = selectedOf(selectedId, 'method');
  const chosen = rows.find((r) => r.id === chosenId) ?? best ?? rows[0];
  const control = rows.find((r) => r.id === 'constant_mean') ?? null;
  const ticks = rows.map((r, i) => ({ value: i + 1, label: METHOD_SHORT[r.id] }));
  const xs = rows.map((_, i) => i + 1);
  const n = loo.n;
  const survey = surveyOfCase(caseId);
  const dotsX: number[] = [];
  const dotsY: number[] = [];
  const selX: number[] = [];
  const selY: number[] = [];
  rows.forEach((r, i) => {
    r.errors?.forEach((e, k) => {
      const x = i + 1 + 0.18 + (0.22 * k) / Math.max(1, n - 1);
      dotsX.push(x);
      dotsY.push(e);
      if (survey === k + 1) {
        selX.push(x);
        selY.push(e);
      }
    });
  });
  const series: ChartSeries[] = [
    { id: 'mape', label: { en: 'Held-out MAPE', es: 'MAPE reservado' }, values: rows.map((r) => r.mape), mode: 'points', size: 15, color: '--color-accent' },
    { id: 'surveys', label: { en: 'Error on each held-out survey', es: 'Error en cada muestreo reservado' }, values: dotsY, x: dotsX, mode: 'points', size: 6, color: '--color-fg-subtle' },
  ];
  if (best) series.push({ id: 'best', label: { en: 'Recommended', es: 'Recomendado' }, values: [best.mape], x: [rows.indexOf(best) + 1], mode: 'points', size: 22, color: '--color-good' });
  if (selX.length) series.push({ id: 'survey', label: { en: `Survey ${survey}`, es: `Muestreo ${survey}` }, values: selY, x: selX, mode: 'points', size: 10, color: '--color-warn' });
  const yMax = Math.max(...rows.map((r) => r.mape), ...dotsY) * 1.08;
  const callouts = compareCallouts(rows, best, chosen, (v, o) => num(v, o));
  const points: ChartPoint[] = [
    { id: 'best', x: best ? rows.indexOf(best) + 1 : 1, y: best?.mape ?? 0 },
    { id: 'chosen', x: rows.indexOf(chosen) + 1, y: chosen.mape },
    { id: 'control', x: control ? rows.indexOf(control) + 1 : rows.length, y: control?.mape ?? 0 },
  ];
  const reason = best ? recommendReason(best, rows, target, (v) => num(v, { digits: 3 })) : { en: 'No method is scored for this target.', es: 'Ningún método tiene puntaje para este objetivo.' };
  const cbNote: Text | null = cb
    ? null
    : {
        en: `CrusherBayes is not available: ${bare(cbReason?.en ?? 'its document is not in this build')}.`,
        es: `CrusherBayes no está disponible: ${bare(cbReason?.es ?? 'su documento no está en esta versión')}.`,
      };
  const surveys = Array.from({ length: n }, (_, k) => k + 1);
  const measured = loo.loo[target].measured;
  const unit = target === 'tph' ? 't/h' : 'kW';
  const bandSeries: ChartSeries[] = [
    { id: 'measured', label: { en: 'Measured', es: 'Medido' }, values: [...measured], mode: 'points', size: 9, color: '--color-fg' },
    {
      id: 'pred',
      label: { en: `${chosen.name.en}, held out`, es: `${chosen.name.es}, reservado` },
      values: chosen.pred ? [...chosen.pred] : surveys.map(() => null),
      mode: 'points',
      size: 8,
      color: '--color-accent',
    },
  ];
  if (chosen.band) {
    bandSeries.push({ id: 'lo', label: { en: '80 percent band, low', es: 'Banda del 80 por ciento, baja' }, values: chosen.band.lo, color: '--color-accent', dash: [4, 3], width: 1.2 });
    bandSeries.push({ id: 'hi', label: { en: '80 percent band, high', es: 'Banda del 80 por ciento, alta' }, values: chosen.band.hi, color: '--color-accent', dash: [4, 3], width: 1.2 });
  }
  const stage = (
    <PlotCard
      fill
      title={{ en: 'Held-out error of every method, ten surveys', es: 'Error reservado de cada método, diez muestreos' }}
      lane="replay"
      provenance="real"
      dataKey={stateKey}
      note={{
        en: `${reason.en} The large dot is a method's mean absolute percent error with every survey held out of its own fit; the small dots are its ten errors.${cbNote ? ` ${cbNote.en}` : ''}`,
        es: `${reason.es} El punto grande es el error porcentual absoluto medio de un método con cada muestreo fuera de su propio ajuste; los puntos chicos son sus diez errores.${cbNote ? ` ${cbNote.es}` : ''}`,
      }}
    >
      <div className="cdem-stack" data-caos-flow="" data-target={target} data-recommended={best?.id ?? ''}>
        <div className="cdem-controls" role="group" aria-label={t('Target of the forecast', 'Objetivo del pronóstico')}>
          <button type="button" aria-pressed={target === 'tph'} onClick={() => setTarget('tph')}>
            {t('Throughput (t/h)', 'Capacidad (t/h)')}
          </button>
          <button type="button" aria-pressed={target === 'kW'} onClick={() => setTarget('kW')}>
            {t('Power (kW)', 'Potencia (kW)')}
          </button>
        </div>
        <ChartCallouts callouts={callouts} points={points} frame={{ x: [0.5, rows.length + 0.5], y: [0, yMax] }}>
          <UPlotChart
            title={{ en: 'Held-out mean absolute percent error by method', es: 'Error porcentual absoluto medio reservado por método' }}
            height="fill"
            x={{ values: xs, label: { en: 'Method', es: 'Método' }, ticks, range: [0.5, rows.length + 0.5] }}
            y={{ label: { en: 'Held-out absolute error', es: 'Error absoluto reservado' }, unit: '%', range: [0, yMax] }}
            series={series}
            readout={(i) => `${rows[i].name[lang]}: ${num(rows[i].mape, { digits: 3 })} %`}
          />
        </ChartCallouts>
      </div>
    </PlotCard>
  );
  // in the story's docked panel the card takes the height its parts need and the panel scrolls; in the App it fills its column
  const docked = part === 'panel';
  const panel = (
    <PlotCard
      fill={!docked}
      title={{ en: 'The selected method on each survey', es: 'El método seleccionado en cada muestreo' }}
      lane="replay"
      provenance="real"
      dataKey={stateKey}
      note={
        chosen.band
          ? {
              en: `Dashed: the 80 percent predictive band (coverage ${num(chosen.band.coverage * 100, { digits: 3 })} percent of the ten surveys).`,
              es: `Segmentada: la banda predictiva del 80 por ciento (cobertura ${num(chosen.band.coverage * 100, { digits: 3 })} por ciento de los diez muestreos).`,
            }
          : { en: 'This method has no predictive band in its document.', es: 'Este método no tiene banda predictiva en su documento.' }
      }
    >
      <div className="cdem-stack" data-caos-flow="">
        <div className="cdem-tablewrap">
          <table className="caos-table" data-state="ready">
            <tbody>
              <tr>
                <th className="caos-col-text">{t('Method', 'Método')}</th>
                <td className="caos-col-text">
                  {rows.map((r) => (
                    <span key={r.id} style={{ marginRight: '0.6rem', display: 'inline-block' }}>
                      <MethodButton row={r} best={best?.id === r.id} lang={lang} />
                    </span>
                  ))}
                </td>
              </tr>
              <tr>
                <th className="caos-col-text">{t('Survey', 'Muestreo')}</th>
                <td className="caos-col-text">
                  {surveys.map((k) => (
                    <span key={k} style={{ marginRight: '0.5rem' }}>
                      <SurveyButton n={k} current={survey === k} onPick={() => onPickCase(caseOfSurvey(k))} />
                    </span>
                  ))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className={docked ? undefined : 'cdem-fill'}>
          <UPlotChart
            title={{ en: `Measured and held-out prediction per survey (${unit})`, es: `Medido y predicción reservada por muestreo (${unit})` }}
            height={docked ? 260 : 'fill'}
            x={{ values: surveys, label: { en: 'Survey', es: 'Muestreo' }, ticks: surveys.map((k) => ({ value: k, label: { en: String(k), es: String(k) } as BiText })), range: [0.5, n + 0.5] }}
            y={{ label: target === 'tph' ? { en: 'Throughput', es: 'Capacidad' } : { en: 'Power', es: 'Potencia' }, unit }}
            series={bandSeries}
            marks={survey ? [{ x: survey, label: { en: 'selected survey', es: 'muestreo seleccionado' } }] : []}
            onPick={(i) => onPickCase(caseOfSurvey(i + 1))}
          />
        </div>
      </div>
    </PlotCard>
  );
  if (part === 'stage') return stage;
  if (part === 'panel') return panel;
  return (
    <ViewsRow shares={[3, 2]}>
      {stage}
      {panel}
    </ViewsRow>
  );
}

/** The App's view (Validation group, first view): reads both documents through the index. */
export function CompareView() {
  const { index, sel, pickCase } = useView();
  const [target, setTarget] = useState<CompareTarget>('kW');
  const loo = useArtifact<Hp500Loo>((signal) => (index ? loadHp500Loo(index as CaseIndex, signal) : new Promise<Hp500Loo>(() => undefined)), [index]);
  const cb = useArtifact<Hp500CrusherBayes>((signal) => (index ? loadHp500CrusherBayes(index as CaseIndex, signal) : new Promise<Hp500CrusherBayes>(() => undefined)), [index]);
  const lang = useShellLang();
  if (loo.state === 'unavailable')
    return (
      <p className="caos-pending" data-state="unavailable">
        {loo.reason[lang]}
      </p>
    );
  if (loo.state === 'error') return <p role="alert">{loo.error}</p>;
  if (loo.state !== 'ready' || cb.state === 'loading')
    return (
      <p className="caos-pending" data-state="loading">
        {lang === 'es' ? 'Cargando la validación' : 'Loading the validation'}
      </p>
    );
  return (
    <CompareBody
      loo={loo.data}
      cb={cb.state === 'ready' ? cb.data : null}
      cbReason={cb.state === 'unavailable' ? cb.reason : cb.state === 'error' ? { en: cb.error, es: cb.error } : null}
      target={target}
      setTarget={setTarget}
      caseId={sel?.data.manifest.case_id}
      onPickCase={pickCase}
    />
  );
}
