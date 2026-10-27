// Group 3, Performance: the result table above the capacity hump, the setting trade-off, the power draw, and the comparison of
// the three variants. Each chart draws the live engine at the rail's values (solid) and the committed sweep of the replay
// (dashed), with the current setting marked. On a real survey the measured throughput and power are reference lines, with the
// CrusherCal 80 percent predictive band (the strict leave-one-survey-out folds) and the pre-registered null stated in the note.
import { PlotCard, ViewsRow, useShellLang, useWorkbenchState, type BiText } from '@fasl-work/caos-app-shell';
import { UPlotChart, type ChartSeries } from '@fasl-work/caos-app-shell/chart';
import { useMemo } from 'react';
import { optimalSpeed, throughput } from '../engine/capacity';
import { evaluate } from '../engine/engine';
import type { Operating } from '../engine/types';
import type { Text } from '../lib/contract.types';
import { bandHalfWidth, selectionOf, VARIANTS } from '../workbench/model';
import { Fill, Stack } from './draw';
import { bare, GroupFrame, Pending, provenanceOf, REGIME_TEXT, useNum, useT, useView, type Sub } from './shared';
import { asc, finAll, LIVE_COLOR, linSpace, REPLAY_COLOR, REPLAY_DASH } from './series';
import type { Selection } from '../workbench/model';

/** The sweep grid of a chart: the trace's own when it is there, else the same fraction of the baked point (the producer sweeps 0.5 to 1.5 times). */
function gridOf(trace: number[] | undefined, baked: number): number[] {
  return trace ?? linSpace(baked * 0.5, baked * 1.5, 31);
}

interface BandNote {
  text: Text;
}

/** The note on a real survey's reference lines: what the band is, and the pre-registered null. */
function bandNote(sel: Selection, bandReady: boolean, reason: Text | null): BandNote | null {
  if (sel.data.manifest.real_or_synthetic !== 'real') return null;
  const base: Text = {
    en: 'Dotted lines: the measured value of the survey, and the engine’s value with the 80 percent predictive half-band of CrusherCal (strict leave-one-survey-out). The pre-registered null holds: the residual model does not beat the calibrated backbone out of sample, so the backbone and its empirical band are shown.',
    es: 'Líneas punteadas: el valor medido del muestreo, y el valor del motor con la semibanda predictiva del 80 por ciento de CrusherCal (dejando un muestreo fuera). El nulo preregistrado se cumple: el modelo de residuos no supera al esqueleto calibrado fuera de muestra, así que se muestran el esqueleto y su banda empírica.',
  };
  if (bandReady) return { text: base };
  return {
    text: {
      en: `The measured value is the dotted line. The predictive band is not available yet: ${bare(reason?.en ?? 'the validation document is not in this build')}.`,
      es: `El valor medido es la línea punteada. La banda predictiva aún no está disponible: ${bare(reason?.es ?? 'el documento de validación no está en esta versión')}.`,
    },
  };
}

interface SweepProps {
  title: BiText;
  chartTitle: BiText;
  xLabel: BiText;
  xUnit: string;
  yLabel: BiText;
  yUnit: string;
  x: number[];
  live: number[];
  replay: number[] | null;
  marks: { x: number; label: BiText }[];
  yMarks?: { y: number; label?: BiText; tone?: 'warn' | 'bad' | 'good' | 'neutral' }[];
  note?: Text;
  sel: Selection;
}

/** One chart of the group: a live curve over a sweep, the committed sweep dashed, the current setting marked. */
function SweepCard({ title, chartTitle, xLabel, xUnit, yLabel, yUnit, x, live, replay, marks, yMarks, note, sel }: SweepProps) {
  const stateKey = useWorkbenchState()?.stateKey;
  const reason = sel.data.traceReason;
  const series: ChartSeries[] = [{ label: { en: 'Live', es: 'En vivo' }, values: finAll(live), color: LIVE_COLOR, width: 2.4 }];
  if (replay) series.push({ label: { en: 'Replay', es: 'Replay' }, values: finAll(replay), color: REPLAY_COLOR, dash: REPLAY_DASH, width: 1.8 });
  const lane: Text = replay
    ? { en: 'Solid: the live engine at the rail’s values. Dashed: the committed sweep of the replay, at the case’s own point.', es: 'Continua: el motor en vivo con los valores del panel. Segmentada: el barrido comprometido del replay, en el punto propio del caso.' }
    : { en: `Solid: the live engine. The committed sweep is not available yet: ${bare(reason?.en ?? 'the replay is not in this build')}.`, es: `Continua: el motor en vivo. El barrido comprometido aún no está disponible: ${bare(reason?.es ?? 'el replay no está en esta versión')}.` };
  const text: Text = note ? { en: `${lane.en} ${note.en}`, es: `${lane.es} ${note.es}` } : lane;
  return (
    <PlotCard fill title={title} lane="live" provenance={provenanceOf(sel)} dataKey={stateKey} note={text}>
      <UPlotChart
        title={chartTitle}
        height="fill"
        x={{ values: x, label: xLabel, unit: xUnit }}
        y={{ label: yLabel, unit: yUnit }}
        series={series}
        marks={marks}
        yMarks={yMarks}
      />
    </PlotCard>
  );
}

/** The engine at the rail's values with only one input varied over a grid. */
function sweep(op: Operating, key: 'speedRpm' | 'cssMm', grid: number[]) {
  return grid.map((v) => evaluate({ ...op, [key]: v }));
}

function ResultView() {
  const { sel, loo } = useView();
  const stateKey = useWorkbenchState()?.stateKey;
  const t = useT();
  const num = useNum();
  const lang = useShellLang();
  const op = sel?.op;
  const trace = sel?.data.trace ?? null;
  const baked = sel?.data.manifest.params.speed_rpm ?? 0;
  const speeds = useMemo(() => gridOf(trace?.speed_sweep.speed_rpm, baked), [trace, baked]);
  const live = useMemo(() => (op ? speeds.map((s) => throughput(op.machine, op.cssMm, op.throwMm, s, op.calibrated)) : []), [op, speeds]);
  if (!sel || !op) return <Pending />;
  const r = sel.result;
  const measured = sel.data.manifest.measured;
  const band = loo?.state === 'ready' ? bandHalfWidth(loo.data, 'tph') : null;
  const yMarks: NonNullable<SweepProps['yMarks']> = [];
  if (measured) {
    yMarks.push({ y: measured.feed_tph, label: { en: 'measured', es: 'medido' }, tone: 'good' });
    if (band !== null) {
      yMarks.push({ y: r.throughputTph + band, label: { en: '80% band', es: 'banda 80%' }, tone: 'neutral' });
      yMarks.push({ y: r.throughputTph - band, tone: 'neutral' });
    }
  }
  const head: [string, string][] = [
    ['P80 (mm)', 'P80 (mm)'],
    ['P50 (mm)', 'P50 (mm)'],
    ['P20 (mm)', 'P20 (mm)'],
    ['Reduction', 'Reducción'],
    ['Throughput (t/h)', 'Capacidad (t/h)'],
    ['Power (kW)', 'Potencia (kW)'],
    ['Energy (kWh/t)', 'Energía (kWh/t)'],
    ['Open side (mm)', 'Lado abierto (mm)'],
  ];
  const s = trace?.summary;
  const regimeOf = (code: string) => REGIME_TEXT[code]?.[lang] ?? code;
  const rows: { name: string; cells: string[]; regime: string }[] = [
    {
      name: t('Live', 'En vivo'),
      regime: regimeOf(r.regime),
      cells: [num(r.p80, { digits: 4 }), num(r.p50, { digits: 4 }), num(r.p20, { digits: 4 }), num(r.reductionRatio, { decimals: 2 }), num(r.throughputTph, { digits: 4 }), num(r.powerKw, { digits: 4 }), num(r.specificEnergyKwhT, { decimals: 2 }), num(r.ossMm, { digits: 4 })],
    },
  ];
  if (s) {
    rows.push({
      name: t('Replay', 'Replay'),
      regime: regimeOf(s.regime),
      cells: [num(s.p80_mm, { digits: 4 }), num(s.p50_mm, { digits: 4 }), num(s.p20_mm, { digits: 4 }), num(s.reduction_ratio, { decimals: 2 }), num(s.throughput_tph, { digits: 4 }), num(s.power_kw, { digits: 4 }), num(s.specific_energy_kwh_t, { decimals: 2 }), num(s.oss_mm, { digits: 4 })],
    });
  }
  return (
    <>
      <PlotCard title={{ en: 'Result at the operating point', es: 'Resultado en el punto de operación' }} lane="live" provenance={provenanceOf(sel)} dataKey={stateKey}>
        <div className="cdem-tablewrap">
          <table className="caos-table" data-state="ready">
            <thead>
              <tr>
                <th>{t('Lane', 'Carril')}</th>
                {head.map(([en, es]) => (
                  <th key={en}>{t(en, es)}</th>
                ))}
                <th className="caos-col-text">{t('Regime', 'Régimen')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  {row.cells.map((c, i) => (
                    <td key={i}>{c}</td>
                  ))}
                  <td className="caos-col-text">{row.regime}</td>
                </tr>
              ))}
              {measured && (
                <tr>
                  <td>{t('Measured', 'Medido')}</td>
                  <td colSpan={4} className="caos-col-text">
                    {t('not measured by the survey', 'no medido en el muestreo')}
                  </td>
                  <td>{num(measured.feed_tph, { digits: 4 })}</td>
                  <td>{num(measured.power_kw, { digits: 4 })}</td>
                  <td colSpan={3} className="caos-col-text">
                    {t('not measured by the survey', 'no medido en el muestreo')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PlotCard>
      <SweepCard
        sel={sel}
        title={{ en: 'Capacity against eccentric speed', es: 'Capacidad contra velocidad excéntrica' }}
        chartTitle={{ en: 'Throughput against eccentric speed', es: 'Capacidad contra velocidad excéntrica' }}
        xLabel={{ en: 'Eccentric speed', es: 'Velocidad excéntrica' }}
        xUnit="rpm"
        yLabel={{ en: 'Throughput', es: 'Capacidad' }}
        yUnit="t/h"
        x={speeds}
        live={live}
        replay={trace ? trace.speed_sweep.throughput_tph : null}
        marks={[
          { x: op.speedRpm, label: { en: 'current', es: 'actual' } },
          { x: optimalSpeed(op.machine), label: { en: 'optimum', es: 'óptimo' } },
        ]}
        yMarks={yMarks}
        note={bandNote(sel, band !== null, loo?.state === 'unavailable' ? loo.reason : null)?.text}
      />
    </>
  );
}

function SettingView() {
  const { sel } = useView();
  const op = sel?.op;
  const trace = sel?.data.trace ?? null;
  const baked = sel?.data.manifest.params.css_mm ?? 0;
  const grid = useMemo(() => gridOf(trace?.css_sweep.css_mm, baked), [trace, baked]);
  const results = useMemo(() => (op ? sweep(op, 'cssMm', grid) : []), [op, grid]);
  if (!sel || !op) return <Pending />;
  const mark = [{ x: op.cssMm, label: { en: 'current', es: 'actual' } as BiText }];
  return (
    <ViewsRow>
      <SweepCard
        sel={sel}
        title={{ en: 'Product size against the setting', es: 'Tamaño del producto contra la abertura' }}
        chartTitle={{ en: 'P80 against the closed-side setting', es: 'P80 contra la abertura de descarga' }}
        xLabel={{ en: 'Closed-side setting', es: 'Abertura de descarga' }}
        xUnit="mm"
        yLabel="P80"
        yUnit="mm"
        x={grid}
        live={results.map((r) => r.p80)}
        replay={trace ? trace.css_sweep.p80_mm : null}
        marks={mark}
      />
      <SweepCard
        sel={sel}
        title={{ en: 'Capacity against the setting', es: 'Capacidad contra la abertura' }}
        chartTitle={{ en: 'Throughput against the closed-side setting', es: 'Capacidad contra la abertura de descarga' }}
        xLabel={{ en: 'Closed-side setting', es: 'Abertura de descarga' }}
        xUnit="mm"
        yLabel={{ en: 'Throughput', es: 'Capacidad' }}
        yUnit="t/h"
        x={grid}
        live={results.map((r) => r.throughputTph)}
        replay={trace ? trace.css_sweep.throughput_tph : null}
        marks={mark}
      />
    </ViewsRow>
  );
}

function PowerView() {
  const { sel, loo } = useView();
  const op = sel?.op;
  const trace = sel?.data.trace ?? null;
  const baked = sel?.data.manifest.params.speed_rpm ?? 0;
  const speeds = useMemo(() => gridOf(trace?.speed_sweep.speed_rpm, baked), [trace, baked]);
  const results = useMemo(() => (op ? sweep(op, 'speedRpm', speeds) : []), [op, speeds]);
  if (!sel || !op) return <Pending />;
  const measured = sel.data.manifest.measured;
  const band = loo?.state === 'ready' ? bandHalfWidth(loo.data, 'kW') : null;
  const yMarks: NonNullable<SweepProps['yMarks']> = [];
  if (measured) {
    yMarks.push({ y: measured.power_kw, label: { en: 'measured', es: 'medido' }, tone: 'good' });
    if (band !== null) {
      yMarks.push({ y: sel.result.powerKw + band, label: { en: '80% band', es: 'banda 80%' }, tone: 'neutral' });
      yMarks.push({ y: sel.result.powerKw - band, tone: 'neutral' });
    }
  }
  return (
    <SweepCard
      sel={sel}
      title={{ en: 'Power draw against eccentric speed', es: 'Potencia contra velocidad excéntrica' }}
      chartTitle={{ en: 'Power against eccentric speed', es: 'Potencia contra velocidad excéntrica' }}
      xLabel={{ en: 'Eccentric speed', es: 'Velocidad excéntrica' }}
      xUnit="rpm"
      yLabel={{ en: 'Power', es: 'Potencia' }}
      yUnit="kW"
      x={speeds}
      live={results.map((r) => r.powerKw)}
      replay={trace ? trace.speed_sweep.power_kw : null}
      marks={[{ x: op.speedRpm, label: { en: 'current', es: 'actual' } }]}
      yMarks={yMarks}
      note={bandNote(sel, band !== null, loo?.state === 'unavailable' ? loo.reason : null)?.text}
    />
  );
}

/** The three variants side by side: a table of their numbers above their product gradations. */
function CompareView() {
  const { sel } = useView();
  const stateKey = useWorkbenchState()?.stateKey;
  const t = useT();
  const num = useNum();
  const lang = useShellLang();
  const rows = useMemo(() => (sel ? VARIANTS.map((v) => ({ v, s: selectionOf(sel.data, sel.rail, v.id) })) : []), [sel]);
  if (!sel) return <Pending />;
  const colors = ['--color-accent', '--color-good', '--color-magenta'] as const;
  const x = asc(sel.result.product.edgesMm);
  const series: ChartSeries[] = rows.map(({ v, s }, i) => ({
    id: v.id,
    label: v.label,
    values: finAll(asc(s.result.product.passing)),
    color: colors[i % colors.length],
    width: v.id === sel.variant.id ? 2.8 : 1.8,
    dash: i === 0 ? undefined : i === 1 ? [2, 3] : [8, 3],
  }));
  return (
    <PlotCard
      fill
      title={{ en: 'The three settings compared', es: 'Las tres aberturas comparadas' }}
      lane="live"
      provenance={provenanceOf(sel)}
      dataKey={stateKey}
      note={{ en: 'Each variant re-runs the engine with the closed-side setting scaled on the rail’s value; the one in force is drawn thicker.', es: 'Cada variante vuelve a correr el motor con la abertura de descarga escalada sobre el valor del panel; la que está en uso se dibuja más gruesa.' }}
    >
      <Stack>
        <div className="cdem-tablewrap">
          <table className="caos-table" data-state="ready">
            <thead>
              <tr>
                <th>{t('Variant', 'Variante')}</th>
                <th>{t('Closed-side setting (mm)', 'Abertura de descarga (mm)')}</th>
                <th>{t('P80 (mm)', 'P80 (mm)')}</th>
                <th>{t('Throughput (t/h)', 'Capacidad (t/h)')}</th>
                <th>{t('Power (kW)', 'Potencia (kW)')}</th>
                <th>{t('Specific energy (kWh/t)', 'Energía específica (kWh/t)')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ v, s }) => (
                <tr key={v.id}>
                  <td>{v.label[lang]}</td>
                  <td>{num(s.op.cssMm, { digits: 4 })}</td>
                  <td>{num(s.result.p80, { digits: 4 })}</td>
                  <td>{num(s.result.throughputTph, { digits: 4 })}</td>
                  <td>{num(s.result.powerKw, { digits: 4 })}</td>
                  <td>{num(s.result.specificEnergyKwhT, { decimals: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Fill>
          <UPlotChart
            title={{ en: 'Product gradation of the three settings', es: 'Gradación del producto de las tres aberturas' }}
            height="fill"
            x={{ values: x, label: { en: 'Size', es: 'Tamaño' }, unit: 'mm', log: true }}
            y={{ label: { en: 'Passing', es: 'Pasante' }, range: [0, 1], format: { percent: true, decimals: 0 } }}
            series={series}
            solo
          />
        </Fill>
      </Stack>
    </PlotCard>
  );
}

export function PerformanceGroup() {
  const tabs: Sub[] = [
    { id: 'result', label: { en: 'Result and capacity', es: 'Resultado y capacidad' }, content: <ResultView /> },
    { id: 'setting', label: { en: 'Setting trade-off', es: 'Efecto de la abertura' }, content: <SettingView /> },
    { id: 'power', label: { en: 'Power', es: 'Potencia' }, content: <PowerView /> },
    { id: 'compare', label: { en: 'Compare variants', es: 'Comparar variantes' }, content: <CompareView /> },
  ];
  return <GroupFrame group="performance" ariaLabel={{ en: 'Performance views', es: 'Vistas de desempeño' }} tabs={tabs} />;
}
