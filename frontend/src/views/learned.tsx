// Group 4, Learned models: the surrogate's prediction beside the engine's, the autoencoder's anomaly score against its threshold,
// and the inverse search for the closed-side setting that gives a target P80. Each view says which model answered: the released
// ONNX graph, or the slot's baseline (the engine for the surrogate, the envelope gate for the anomaly view) when the readiness
// document says the slot is in training or its contract is not in the build. The graphs are loaded only when this group opens.
import { BarChart, Knob, PlotCard, Verdict, pick, useShellLang, useWorkbenchState, type BiText } from '@fasl-work/caos-app-shell';
import { UPlotChart, type ChartSeries } from '@fasl-work/caos-app-shell/chart';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadAnomaly, loadModelMetrics, loadSurrogate, useArtifact, type ModelSlot } from '../api/artifacts';
import { checkEnvelope } from '../engine/envelope';
import { evaluate } from '../engine/engine';
import { recommendCss } from '../engine/surrogate';
import type { Operating } from '../engine/types';
import type { AnomalyModel, ModelMetrics, SurrogateModel, Text } from '../lib/contract.types';
import { OUTPUT_UNITS, predictSurrogate, readAnomaly, type AnomalyReading, type SurrogateOutput } from '../lib/ort';
import { Fill, Stack } from './draw';
import { bare, GroupFrame, Pending, provenanceOf, useNum, useT, useView, type Sub } from './shared';
import { asc, finAll, FEED_COLOR, linSpace, LIVE_COLOR } from './series';

type Run<T> = { state: 'loading' } | { state: 'ready'; key: string; value: T } | { state: 'error'; key: string; message: string };

/** An asynchronous ONNX call for a key (the operating point): loading until it answers, the answer tagged with its key so a late answer to an old point is never shown. */
function useOnnx<T>(enabled: boolean, key: string, compute: () => Promise<T>): Run<T> {
  const [run, setRun] = useState<Run<T>>({ state: 'loading' });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    compute().then(
      (value) => alive && setRun({ state: 'ready', key, value }),
      (e: unknown) => alive && setRun({ state: 'error', key, message: String(e) }),
    );
    return () => {
      alive = false;
    };
    // the key names the inputs of compute
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);
  return run;
}

const opKey = (op: Operating): string => JSON.stringify(op);

/** Which model answered, in words, for a slot. */
function answeredBy(kind: 'surrogate' | 'anomaly', slot: ModelSlot<unknown> | null, failed: string | null): Text {
  if (slot?.answer === 'released' && !failed) {
    return kind === 'surrogate'
      ? { en: 'Answered by the released surrogate: an ONNX graph running in this browser.', es: 'Responde el sustituto publicado: un grafo ONNX que corre en este navegador.' }
      : { en: 'Answered by the released autoencoder: an ONNX graph running in this browser.', es: 'Responde el autocodificador publicado: un grafo ONNX que corre en este navegador.' };
  }
  const why: Text = failed
    ? { en: `the graph did not run (${failed})`, es: `el grafo no corrió (${failed})` }
    : slot?.answer === 'baseline'
      ? slot.reason
      : { en: 'the model is loading', es: 'el modelo se está cargando' };
  return kind === 'surrogate'
    ? { en: `Answered by the baseline, the engine itself: ${bare(why.en)}.`, es: `Responde la línea base, el propio motor: ${bare(why.es)}.` }
    : { en: `Answered by the baseline, the envelope gate: ${bare(why.en)}.`, es: `Responde la línea base, la compuerta de envolvente: ${bare(why.es)}.` };
}

interface Props {
  slot: ModelSlot<SurrogateModel> | null;
  metrics: ModelMetrics | null;
  metricsReason: Text | null;
}

function SurrogateView({ slot, metrics, metricsReason }: Props) {
  const { sel } = useView();
  const stateKey = useWorkbenchState()?.stateKey;
  const lang = useShellLang();
  const t = useT();
  const num = useNum();
  const released = slot?.answer === 'released' ? slot.contract : null;
  const key = sel ? opKey(sel.op) : '';
  const run = useOnnx(!!released && !!sel, key, () => predictSurrogate(released as SurrogateModel, (sel as NonNullable<typeof sel>).op));
  if (!sel || !slot) return <Pending label={{ en: 'Loading the model contract', es: 'Cargando el contrato del modelo' }} />;
  const r = sel.result;
  const engine: Record<SurrogateOutput, number> = {
    p80_mm: r.p80,
    p50_mm: r.p50,
    p20_mm: r.p20,
    pass_1: r.pctPassing[1],
    pass_4: r.pctPassing[4],
    pass_8: r.pctPassing[8],
    pass_16: r.pctPassing[16],
    pass_32: r.pctPassing[32],
    throughput_tph: r.throughputTph,
    power_kw: r.powerKw,
  };
  const order = (released?.output_order ?? (Object.keys(OUTPUT_UNITS) as SurrogateOutput[])) as SurrogateOutput[];
  const failed = run.state === 'error' && run.key === key ? run.message : null;
  const answered = run.state === 'ready' && run.key === key ? run.value : null;
  if (released && !answered && !failed) return <Pending label={{ en: 'Running the surrogate in the browser', es: 'Ejecutando el sustituto en el navegador' }} />;
  const fmt = (name: SurrogateOutput, v: number) => (OUTPUT_UNITS[name].percent ? num(v, { percent: true, decimals: 1 }) : num(v, { digits: 4 }));
  const errorOf = (name: SurrogateOutput): string => {
    if (!answered) return '';
    const e = engine[name];
    return e !== 0 && Number.isFinite(e) ? num((Math.abs(answered[name] - e) / Math.abs(e)) * 100, { digits: 3 }) : num(null);
  };
  const header = (name: SurrogateOutput) => {
    const u = OUTPUT_UNITS[name];
    return `${u.label[lang]}${u.unit ? ` (${u.unit})` : ''}`;
  };
  // consecutive passing outputs share one spanning header; every other output has a header of its own
  const headerGroups: { names: SurrogateOutput[]; passing: boolean }[] = [];
  for (const name of order) {
    const passing = name.startsWith('pass_');
    const last = headerGroups[headerGroups.length - 1];
    if (passing && last?.passing) last.names.push(name);
    else headerGroups.push({ names: [name], passing });
  }
  const sizes = [32, 16, 8, 4, 1];
  const series: ChartSeries[] = [{ label: { en: 'Engine', es: 'Motor' }, values: finAll(asc(r.product.passing)), color: FEED_COLOR, width: 2 }];
  if (answered) {
    series.push({
      label: { en: 'Surrogate', es: 'Sustituto' },
      values: sizes.map((s) => answered[`pass_${s}` as SurrogateOutput]),
      x: sizes,
      mode: 'points',
      size: 9,
      color: LIVE_COLOR,
    });
  }
  const metric = (name: SurrogateOutput) => metrics?.surrogate.per_output[name];
  const note: Text = {
    en: [
      answeredBy('surrogate', slot, failed).en,
      metrics ? `Held-out error (mean absolute percentage, n = ${num(metrics.surrogate.n_test, { digits: 4 })}): P80 ${num(metric('p80_mm')?.mape_pct, { digits: 3 })} %, throughput ${num(metric('throughput_tph')?.mape_pct, { digits: 3 })} %, power ${num(metric('power_kw')?.mape_pct, { digits: 3 })} %. It emulates the engine, not a plant.` : `The held-out metrics are not available yet: ${bare(metricsReason?.en ?? 'the model metrics are not in this build')}.`,
    ].join(' '),
    es: [
      answeredBy('surrogate', slot, failed).es,
      metrics ? `Error en datos retenidos (error porcentual absoluto medio, n = ${num(metrics.surrogate.n_test, { digits: 4 })}): P80 ${num(metric('p80_mm')?.mape_pct, { digits: 3 })} %, capacidad ${num(metric('throughput_tph')?.mape_pct, { digits: 3 })} %, potencia ${num(metric('power_kw')?.mape_pct, { digits: 3 })} %. Emula el motor, no una planta.` : `Las métricas en datos retenidos aún no están disponibles: ${bare(metricsReason?.es ?? 'las métricas de los modelos no están en esta versión')}.`,
    ].join(' '),
  };
  return (
    <PlotCard fill title={{ en: 'The surrogate beside the engine', es: 'El sustituto junto al motor' }} lane="live" provenance={provenanceOf(sel)} dataKey={stateKey} note={note}>
      <Stack>
        <div className="cdem-tablewrap">
          <table className="caos-table" data-state="ready">
            <thead>
              <tr>
                <th rowSpan={2}>{t('Answer', 'Respuesta')}</th>
                {headerGroups.map((g) =>
                  g.names.length === 1 && !g.passing ? (
                    <th key={g.names[0]} rowSpan={2}>
                      {header(g.names[0])}
                    </th>
                  ) : (
                    <th key={g.names[0]} colSpan={g.names.length} style={{ textAlign: 'center' }}>
                      {t('Passing at size (mm)', 'Pasante según tamaño (mm)')}
                    </th>
                  ),
                )}
              </tr>
              <tr>
                {order
                  .filter((name) => name.startsWith('pass_'))
                  .map((name) => (
                    <th key={name}>{name.slice(5)}</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t('Engine', 'Motor')}</td>
                {order.map((name) => (
                  <td key={name}>{fmt(name, engine[name])}</td>
                ))}
              </tr>
              {answered && (
                <>
                  <tr>
                    <td>{t('Surrogate', 'Sustituto')}</td>
                    {order.map((name) => (
                      <td key={name}>{fmt(name, answered[name])}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>{t('Relative error (%)', 'Error relativo (%)')}</td>
                    {order.map((name) => (
                      <td key={name}>{errorOf(name)}</td>
                    ))}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <Fill>
          <UPlotChart
            title={{ en: 'Product gradation: engine curve and surrogate points', es: 'Gradación del producto: curva del motor y puntos del sustituto' }}
            height="fill"
            x={{ values: asc(r.product.edgesMm), label: { en: 'Size', es: 'Tamaño' }, unit: 'mm', log: true }}
            y={{ label: { en: 'Passing', es: 'Pasante' }, range: [0, 1], format: { percent: true, decimals: 0 } }}
            series={series}
          />
        </Fill>
      </Stack>
    </PlotCard>
  );
}

interface AnomalyProps {
  slot: ModelSlot<AnomalyModel> | null;
  metrics: ModelMetrics | null;
}

const CHECKS: { code: 'css_nonpositive' | 'feed_nonpositive' | 'f80_lt_css' | 'css_outside_calibrated' | 'f80_outside_calibrated'; label: BiText; calibratedOnly?: boolean }[] = [
  { code: 'css_nonpositive', label: { en: 'Closed-side setting is positive', es: 'La abertura de descarga es positiva' } },
  { code: 'feed_nonpositive', label: { en: 'Feed size is positive', es: 'El tamaño de la alimentación es positivo' } },
  { code: 'f80_lt_css', label: { en: 'Setting is below the feed F80', es: 'La abertura es menor que el F80 de la alimentación' } },
  { code: 'css_outside_calibrated', label: { en: 'Setting is inside the calibrated HP500 range', es: 'La abertura está dentro del rango calibrado del HP500' }, calibratedOnly: true },
  { code: 'f80_outside_calibrated', label: { en: 'Feed F80 is inside the calibrated HP500 range', es: 'El F80 de la alimentación está dentro del rango calibrado del HP500' }, calibratedOnly: true },
];

function AnomalyView({ slot, metrics }: AnomalyProps) {
  const { sel } = useView();
  const stateKey = useWorkbenchState()?.stateKey;
  const lang = useShellLang();
  const t = useT();
  const num = useNum();
  const released = slot?.answer === 'released' ? slot.contract : null;
  const key = sel ? opKey(sel.op) : '';
  const run = useOnnx<AnomalyReading>(!!released && !!sel, key, () => readAnomaly(released as AnomalyModel, (sel as NonNullable<typeof sel>).result));
  if (!sel || !slot) return <Pending label={{ en: 'Loading the model contract', es: 'Cargando el contrato del modelo' }} />;
  const failed = run.state === 'error' && run.key === key ? run.message : null;
  const reading = run.state === 'ready' && run.key === key ? run.value : null;
  if (released && !reading && !failed) return <Pending label={{ en: 'Running the autoencoder in the browser', es: 'Ejecutando el autocodificador en el navegador' }} />;
  const gate = checkEnvelope(sel.op, sel.result.f80);
  const gateText = gate.inEnvelope ? t('Inside the envelope', 'Dentro de la envolvente') : t(`Tripped (${gate.codes.length})`, `Activada (${gate.codes.length})`);
  const provenance = provenanceOf(sel);
  const planted = metrics?.anomaly;
  const modelNote: Text = answeredBy('anomaly', slot, failed);
  const note: Text = planted
    ? {
        en: `${modelNote.en} On the held-out draw the autoencoder raises a false alarm on ${num(planted.false_alarm_rate, { percent: true, decimals: 1 })} of points and detects ${num(planted.detection_rate, { percent: true, decimals: 0 })} of the planted off-manifold points; the envelope gate detects ${num(planted.envelope_detection_rate, { percent: true, decimals: 0 })}.`,
        es: `${modelNote.es} En el sorteo retenido el autocodificador da falsa alarma en ${num(planted.false_alarm_rate, { percent: true, decimals: 1 })} de los puntos y detecta ${num(planted.detection_rate, { percent: true, decimals: 0 })} de los puntos fuera de la variedad plantados; la compuerta de envolvente detecta ${num(planted.envelope_detection_rate, { percent: true, decimals: 0 })}.`,
      }
    : modelNote;
  if (reading && Number.isFinite(reading.score)) {
    return (
      <PlotCard fill title={{ en: 'Anomaly score against its threshold', es: 'Puntaje de anomalía contra su umbral' }} lane="live" provenance={provenance} dataKey={stateKey} note={note}>
        <Stack>
          <div className="cdem-tablewrap">
            <table className="caos-table" data-state="ready">
              <thead>
                <tr>
                  <th>{t('Reconstruction error', 'Error de reconstrucción')}</th>
                  <th>{t('Threshold p99', 'Umbral p99')}</th>
                  <th>{t('Score over threshold', 'Puntaje sobre el umbral')}</th>
                  <th className="caos-col-text">{t('Autoencoder', 'Autocodificador')}</th>
                  <th className="caos-col-text">{t('Envelope gate', 'Compuerta de envolvente')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{num(reading.score, { digits: 3 })}</td>
                  <td>{num(reading.threshold, { digits: 3 })}</td>
                  <td>{num(reading.ratio, { decimals: 2 })}</td>
                  <td className="caos-col-text">{reading.anomalous ? t('Anomalous: the surrogate may be extrapolating', 'Anómalo: el sustituto puede estar extrapolando') : t('Within the training manifold', 'Dentro de la variedad de entrenamiento')}</td>
                  <td className="caos-col-text">{gateText}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Fill>
            <BarChart
              title={{ en: 'Anomaly score and its threshold', es: 'Puntaje de anomalía y su umbral' }}
              orientation="vertical"
              height="fill"
              axis={{ label: { en: 'Mean squared reconstruction error', es: 'Error cuadrático medio de reconstrucción' }, format: { digits: 3 } }}
              data={[
                { id: 'score', label: { en: 'Score', es: 'Puntaje' }, value: reading.score, tone: reading.anomalous ? 'bad' : 'good' },
                { id: 'threshold', label: { en: 'Threshold p99', es: 'Umbral p99' }, value: reading.threshold, tone: 'neutral' },
              ]}
            />
          </Fill>
        </Stack>
      </PlotCard>
    );
  }
  // the envelope gate answers: a rule check on the physical and calibrated envelope
  const checks = CHECKS.map((c) => ({ ...c, applies: !c.calibratedOnly || !!sel.op.calibrated, tripped: gate.codes.includes(c.code) }));
  return (
    <PlotCard fill title={{ en: 'Envelope gate', es: 'Compuerta de envolvente' }} lane="live" provenance={provenance} dataKey={stateKey} note={reading && !Number.isFinite(reading.score) ? { en: `${note.en} The point is not a finite reading, so the autoencoder gave no score.`, es: `${note.es} El punto no es una lectura finita, así que el autocodificador no dio puntaje.` } : note}>
      <Stack>
        <Verdict
          compact
          title={{ en: 'Envelope gate', es: 'Compuerta de envolvente' }}
          tone={gate.inEnvelope ? 'good' : 'bad'}
          verdict={gate.inEnvelope ? { en: 'The point is inside the validated envelope.', es: 'El punto está dentro de la envolvente validada.' } : { en: 'The point is outside the validated envelope: the number is not confident.', es: 'El punto está fuera de la envolvente validada: el número no es confiable.' }}
        />
        <div className="cdem-tablewrap">
          <table className="caos-table" data-state="ready">
            <thead>
              <tr>
                <th className="caos-col-text">{t('Check', 'Verificación')}</th>
                <th className="caos-col-text">{t('Result', 'Resultado')}</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.code}>
                  <td className="caos-col-text">{pick(c.label, lang)}</td>
                  <td className="caos-col-text">{!c.applies ? t('Not applicable on a synthetic case', 'No aplica en un caso sintético') : c.tripped ? t('Tripped', 'Activada') : t('Passed', 'Cumple')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Stack>
    </PlotCard>
  );
}

function TargetView() {
  const { sel, target, setTarget, canApplyCss, applyCss } = useView();
  const stateKey = useWorkbenchState()?.stateKey;
  const t = useT();
  const num = useNum();
  const op = sel?.op;
  const grid = useMemo(() => linSpace(3, 200, 60), []);
  const curve = useMemo(() => (op ? grid.map((css) => evaluate({ ...op, cssMm: css }).p80) : []), [op, grid]);
  if (!sel || !op) return <Pending />;
  const rec = recommendCss(op, target);
  const atRec = rec === null ? null : evaluate({ ...op, cssMm: rec }).p80;
  const marks: { x: number; label: BiText }[] = [{ x: op.cssMm, label: { en: 'current', es: 'actual' } }];
  if (rec !== null) marks.push({ x: rec, label: { en: 'recommended', es: 'recomendada' } });
  const apply: ReactNode = (
    <button type="button" className="btn" disabled={rec === null || !canApplyCss} onClick={() => rec !== null && applyCss(Math.round(rec * 10) / 10)}>
      {t('Apply to the rail', 'Aplicar al panel')}
    </button>
  );
  return (
    <>
      <PlotCard title={{ en: 'Closed-side setting for a target P80', es: 'Abertura de descarga para un P80 objetivo' }} lane="live" provenance={provenanceOf(sel)} dataKey={stateKey} actions={apply}>
        <Knob
          id="target"
          label={{ en: 'Target P80', es: 'P80 objetivo' }}
          hint={{ en: 'The product size to reach. The search finds the closed-side setting at which the engine gives it.', es: 'El tamaño de producto que se quiere alcanzar. La búsqueda encuentra la abertura de descarga con que el motor lo entrega.' }}
          value={target}
          min={2}
          max={120}
          step={1}
          unit="mm"
          onChange={setTarget}
        />
        <div className="cdem-tablewrap">
          <table className="caos-table" data-state="ready">
            <thead>
              <tr>
                <th>{t('Target P80 (mm)', 'P80 objetivo (mm)')}</th>
                <th>{t('Recommended setting (mm)', 'Abertura recomendada (mm)')}</th>
                <th>{t('P80 at that setting (mm)', 'P80 con esa abertura (mm)')}</th>
                <th>{t('Current setting (mm)', 'Abertura actual (mm)')}</th>
                <th>{t('Current P80 (mm)', 'P80 actual (mm)')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{num(target, { digits: 4 })}</td>
                <td>{rec === null ? t('not reachable', 'no alcanzable') : num(rec, { digits: 4 })}</td>
                <td>{atRec === null ? t('not reachable', 'no alcanzable') : num(atRec, { digits: 4 })}</td>
                <td>{num(op.cssMm, { digits: 4 })}</td>
                <td>{num(sel.result.p80, { digits: 4 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </PlotCard>
      <PlotCard
        fill
        title={{ en: 'P80 against the closed-side setting', es: 'P80 contra la abertura de descarga' }}
        lane="live"
        provenance={provenanceOf(sel)}
        dataKey={stateKey}
        note={{
          en: `The recommendation is a bisection on the engine, which is monotone in the setting: a didactic what-if, not a plant set point.${canApplyCss ? '' : ' The inputs of a real survey are measured, so they are not changed here.'}`,
          es: `La recomendación es una bisección sobre el motor, que es monótono en la abertura: un escenario didáctico, no un punto de ajuste de planta.${canApplyCss ? '' : ' Las entradas de un muestreo real son medidas, así que no se cambian aquí.'}`,
        }}
      >
        <UPlotChart
          title={{ en: 'P80 against the closed-side setting', es: 'P80 contra la abertura de descarga' }}
          height="fill"
          x={{ values: grid, label: { en: 'Closed-side setting', es: 'Abertura de descarga' }, unit: 'mm' }}
          y={{ label: 'P80', unit: 'mm' }}
          series={[{ label: { en: 'Engine', es: 'Motor' }, values: finAll(curve), color: LIVE_COLOR, width: 2.4 }]}
          marks={marks}
          yMarks={[{ y: target, label: { en: 'target', es: 'objetivo' }, tone: 'good' }]}
        />
      </PlotCard>
    </>
  );
}

export function LearnedGroup() {
  const { index } = useView();
  const surrogate = useArtifact((signal) => (index ? loadSurrogate(index, signal) : new Promise<ModelSlot<SurrogateModel>>(() => undefined)), [index]);
  const anomaly = useArtifact((signal) => (index ? loadAnomaly(index, signal) : new Promise<ModelSlot<AnomalyModel>>(() => undefined)), [index]);
  const metrics = useArtifact((signal) => (index ? loadModelMetrics(index, signal) : new Promise<ModelMetrics>(() => undefined)), [index]);
  const props = {
    metrics: metrics.state === 'ready' ? metrics.data : null,
    metricsReason: metrics.state === 'unavailable' ? metrics.reason : null,
  };
  const tabs: Sub[] = [
    { id: 'surrogate', label: { en: 'Surrogate', es: 'Sustituto' }, content: <SurrogateView slot={surrogate.state === 'ready' ? surrogate.data : null} {...props} /> },
    { id: 'anomaly', label: { en: 'Anomaly', es: 'Anomalía' }, content: <AnomalyView slot={anomaly.state === 'ready' ? anomaly.data : null} metrics={props.metrics} /> },
    { id: 'target', label: { en: 'Target P80', es: 'P80 objetivo' }, content: <TargetView /> },
  ];
  return <GroupFrame group="learned" ariaLabel={{ en: 'Learned model views', es: 'Vistas de los modelos aprendidos' }} tabs={tabs} />;
}
