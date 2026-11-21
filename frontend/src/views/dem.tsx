// The view "Particle simulation" of the Validation group (tab `particles`; catalog row dem-run; requirements DM-012 to DM-017): the discrete
// element method run by the published package on the laboratory jaw crusher of the paper's tests, beside the measurement and the population
// balance. The stage replays the particles in the jaw's section with the moving plate and three anchored callouts; the per-stroke power and
// the mass passed share one stroke cursor with the stage in both directions (the shell's linked-view store, scoped to this view); the three
// operating points are on shared axes for throughput, net power and product P80 with the measurement's band, the simulation's standard error
// and the population balance's spread; then the product size distribution, the verdict table with its sources, and the states of the row.
// Every number is read from the document by a function of demModel.ts. The view shows a laboratory machine, not the selected case, and says so.
import { LinkedViewProvider, PlotCard, ViewsRow, useLinkedCursor, useShellLang, useWorkbenchState, type BiText } from '@fasl-work/caos-app-shell';
import { UPlotChart, type ChartSeries } from '@fasl-work/caos-app-shell/chart';
import { useRef, useState, type ReactNode } from 'react';
import { loadDemFrames, loadDemRun, useArtifact, type Loaded } from '../api/artifacts';
import type { DemRun, Readiness, Text } from '../lib/contract.types';
import { NoteLine } from '../readiness/ReadinessNote';
import { viewState } from '../readiness/readiness';
import { useReadiness } from '../readiness/useReadiness';
import { ChartCallouts, type CalloutSpec } from './callouts';
import {
  calloutSource,
  calloutState,
  CHART_QUANTITIES,
  comparisonSeries,
  cursorOfStrokeIndex,
  DEFAULT_SPEED,
  distributionOf,
  finalAttempt,
  frameAt,
  isComplete,
  nearerSentence,
  openingCursor,
  pairTitle,
  pointCallouts,
  QUANTITIES,
  QUANTITY_NAME,
  QUANTITY_UNIT,
  runStateText,
  runStatusText,
  SIDE_NAME,
  signedPct,
  takeaway,
  verdictCounts,
  verdictRows,
  VERDICT_MARK,
  verdictWord,
  windowMeanPower,
  type ChartQuantity,
  type DemFrames,
  type DemPoint,
  type Num,
  type QuantitySeries,
} from './demModel';
import { FramesState, ReplayControls, ReplayStage, StageCard } from './demReplay';
import { useNum, useT, useView } from './shared';

const pick = (t: { en: string; es: string }, lang: 'en' | 'es'): string => t[lang];

/** The callouts of a point for the stage: the model's three, in the reader's numbers. */
export function calloutSpecs(point: DemPoint, num: Num): CalloutSpec[] {
  return pointCallouts(point).map((c) => {
    const source = calloutSource(c, num);
    return {
      id: c.id,
      eyebrow: c.eyebrow,
      value: c.value === null ? null : num(c.value, c.decimalsOrDigits),
      unit: c.unit,
      state: calloutState(c.state),
      source,
      missing: source,
    };
  });
}

/** The note that says what the view shows: a laboratory machine of published tests, not the case selected in the workbench. */
export function LabNote({ run }: { run: DemRun }) {
  const t = useT();
  return (
    <p className="caos-plot-note cdem-labnote" data-lab-note="">
      {t(
        `This view shows ${run.machine.name} (gape ${run.machine.gape_mm} mm, width ${run.machine.width_mm} mm, throw ${run.machine.throw_mm} mm), a machine of published tests, not the machine of the case selected in the workbench.`,
        `Esta vista muestra ${run.machine.name} (boca ${run.machine.gape_mm} mm, ancho ${run.machine.width_mm} mm, carrera ${run.machine.throw_mm} mm), una máquina de ensayos publicados, no la máquina del caso elegido en el panel.`,
      )}
    </p>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The operating point choice.
// ---------------------------------------------------------------------------------------------------------------------------------

function PointChoice({ run, pointId, onPick }: { run: DemRun; pointId: string; onPick: (id: string) => void }) {
  const lang = useShellLang();
  const t = useT();
  return (
    <div className="cdem-controls cdem-points" role="group" aria-label={t('Operating point: the feed class of the test', 'Punto de operación: la clase de alimentación del ensayo')} data-point-choice="">
      {run.points.map((p) => (
        <button key={p.id} type="button" className="btn" aria-pressed={p.id === pointId} data-point={p.id} data-run-status={p.simulation.status} onClick={() => onPick(p.id)}>
          {p.feed_class} mm: {pick(runStateText(p.simulation, true), lang)}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The linked per-stroke series.
// ---------------------------------------------------------------------------------------------------------------------------------

/** The marker of the stroke cursor on a per-stroke chart: one vertical mark at the cursor. */
export const cursorMark = (cursor: number): { x: number; label: BiText } => ({ x: cursor, label: { en: 'cursor', es: 'cursor' } });

function StrokeSeries({ point, cursor, onPick }: { point: DemPoint; cursor: number; onPick: (stroke: number) => void }) {
  const lang = useShellLang();
  const num = useNum();
  const s = point.simulation;
  const strokes = [...s.series.stroke];
  const w = s.window;
  const mean = windowMeanPower(s);
  const unitP: BiText = { en: 'W', es: 'W' };
  const x = { values: strokes, label: { en: 'Stroke', es: 'Golpe' }, range: [0, strokes[strokes.length - 1] + 1] as [number, number] };
  const mark = cursorMark(cursor);
  const yMaxP = Math.max(...s.series.plate_power_w) * 1.12;
  const yMaxM = Math.max(...s.series.passed_kg, ...s.series.hold_up_kg, s.mass_fed_kg) * 1.1;
  const power: ChartSeries[] = [{ id: 'plate-power', label: { en: 'Plate power per stroke', es: 'Potencia de la placa por golpe' }, values: [...s.series.plate_power_w], color: '--color-accent', width: 2 }];
  const mass: ChartSeries[] = [
    { id: 'passed', label: { en: 'Mass passed', es: 'Masa pasada' }, values: [...s.series.passed_kg], color: '--color-good', width: 2 },
    { id: 'held', label: { en: 'Mass held in the chamber', es: 'Masa retenida en la cámara' }, values: [...s.series.hold_up_kg], color: '--color-warn', width: 1.6, dash: [5, 3] },
  ];
  const pick = (i: number) => onPick(strokes[Math.max(0, Math.min(strokes.length - 1, i))]);
  return (
    <div className="cdem-stack cdem-grow" data-caos-flow="" data-stroke-series="" data-cursor-stroke={cursor} data-window={w ? `${w.first_stroke},${w.last_stroke}` : ''}>
      <div className="cdem-fill cdem-fill-series">
        <ChartCallouts
          callouts={[]}
          points={[]}
          frame={{ x: x.range, y: [0, yMaxP] }}
          overlay={w ? (at) => <WindowBand at={at} from={w.first_stroke - 0.5} to={w.last_stroke + 0.5} yTop={yMaxP} label={lang === 'es' ? 'ventana estacionaria' : 'steady window'} /> : undefined}
        >
          <UPlotChart
            title={{ en: 'Plate power per stroke, with the steady window', es: 'Potencia de la placa por golpe, con la ventana estacionaria' }}
            height="fill"
            x={x}
            y={{ label: { en: 'Plate power', es: 'Potencia de la placa' }, unit: unitP, range: [0, yMaxP], format: { digits: 3 } }}
            series={power}
            marks={[mark]}
            yMarks={mean === null ? [] : [{ y: mean, label: { en: `window mean ${num(mean, { digits: 3 })} W`, es: `media de la ventana ${num(mean, { digits: 3 })} W` }, tone: 'neutral' }]}
            onPick={pick}
            readout={(i) => `${lang === 'es' ? 'golpe' : 'stroke'} ${strokes[i]}: ${num(s.series.plate_power_w[i], { digits: 3 })} W`}
          />
        </ChartCallouts>
      </div>
      <div className="cdem-fill cdem-fill-series">
        <UPlotChart
          title={{ en: 'Mass passed and held, with the spheres held', es: 'Masa pasada y retenida, con las esferas retenidas' }}
          height="fill"
          x={x}
          y={{ label: { en: 'Mass', es: 'Masa' }, unit: { en: 'kg', es: 'kg' }, range: [0, yMaxM], format: { digits: 3 } }}
          series={mass}
          marks={[mark]}
          onPick={pick}
          readout={(i) =>
            lang === 'es'
              ? `golpe ${strokes[i]}: pasados ${num(s.series.passed_kg[i], { digits: 3 })} kg; retenidas ${s.series.held[i]} esferas (${num(s.series.hold_up_kg[i], { digits: 3 })} kg)`
              : `stroke ${strokes[i]}: passed ${num(s.series.passed_kg[i], { digits: 3 })} kg; held ${s.series.held[i]} spheres (${num(s.series.hold_up_kg[i], { digits: 3 })} kg)`
          }
        />
      </div>
    </div>
  );
}

/** The steady window shaded behind a per-stroke chart: a band from stroke `from` to `to` over the plot's height, with its name. */
function WindowBand({ at, from, to, yTop, label }: { at: (p: { x: number; y: number }) => { x: number; y: number }; from: number; to: number; yTop: number; label: string }) {
  const a = at({ x: from, y: yTop });
  const b = at({ x: to, y: 0 });
  return (
    <g data-window-band="" data-window-from={from} data-window-to={to}>
      <rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill="color-mix(in oklab, var(--color-accent) 12%, transparent)" stroke="var(--color-accent)" strokeWidth={1} strokeDasharray="4 3" />
      <text x={Math.min(a.x, b.x) + 4} y={Math.max(a.y, b.y) - 6} fontSize={11} fill="var(--color-fg-subtle)" style={{ fontFamily: 'var(--font-sans)' }}>
        {label}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The stage and the series of one operating point.
// ---------------------------------------------------------------------------------------------------------------------------------

function MainRow({ run, point, frames, speed, onSpeed, reducedMotion, readiness, choice }: { run: DemRun; point: DemPoint; frames: Loaded<DemFrames>; speed: number; onSpeed: (s: number) => void; reducedMotion?: boolean; readiness: ReactNode; choice: ReactNode }) {
  const lang = useShellLang();
  const num = useNum();
  const stateKey = useWorkbenchState()?.stateKey;
  const { cursor, scrub } = useLinkedCursor();
  const r = point.simulation.replay;
  const at = cursor ?? openingCursor(point);
  if (!r || at === null) {
    return (
      <p className="caos-pending" data-state="unavailable">
        {lang === 'es' ? 'Este punto no registró cuadros: no hay repetición de partículas.' : 'This point recorded no frames: there is no particle replay.'}
      </p>
    );
  }
  const frame = frameAt(r, at);
  const status = runStatusText(point.simulation, num);
  const line = takeaway(point, run.bands, num);
  const ready = frames.state === 'ready' ? frames.data : null;
  const choose = (stroke: number) => scrub(stroke);
  return (
    <ViewsRow shares={[3, 2]}>
      <StageCard title={{ en: 'Laboratory jaw, not the selected case: particle replay', es: 'Mandíbula de laboratorio, no el caso elegido: repetición de partículas' }} note={line} stateKey={stateKey}>
        {choice}
        <ReplayControls point={point} frame={frame} reducedMotion={reducedMotion} speed={speed} onSpeed={onSpeed} />
        {frames.state === 'loading' || frames.state === 'unavailable' || frames.state === 'error' ? (
          <FramesState frames={frames} />
        ) : (
          <div className="cdem-fill cdem-stage-fill" data-frames="ready">
            <ReplayStage run={run} point={point} frames={ready} frame={frame} callouts={calloutSpecs(point, num)} />
          </div>
        )}
      </StageCard>
      <PlotCard fill title={{ en: 'Per stroke: power and mass passed, linked to the replay', es: 'Por golpe: potencia y masa pasada, ligadas a la repetición' }} lane="replay" provenance="published" dataKey={stateKey}>
        <div className="cdem-stack" data-caos-flow="">
          <StrokeSeries point={point} cursor={at} onPick={(stroke) => choose(cursorOfStrokeIndex(point.simulation, point.simulation.series.stroke.indexOf(stroke)) ?? stroke)} />
          <p className="cdem-status" data-run-status={point.simulation.status} data-state-run={isComplete(point.simulation) ? 'complete' : 'stopped'}>
            {pick(status, lang)}
          </p>
          {readiness}
        </div>
      </PlotCard>
    </ViewsRow>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The comparison on shared axes.
// ---------------------------------------------------------------------------------------------------------------------------------

/** The panel's height for the first row: the view's parent is sized by the shell (a flex column of the App's panel), and the stage and the series
 * take all of it so the comparison below starts under the fold. Below 900 px the page scrolls and the row keeps its own minimum. */
function usePanelHeight(): [(el: HTMLDivElement | null) => void] {
  const ro = useRef<ResizeObserver | null>(null);
  const ref = (el: HTMLDivElement | null) => {
    ro.current?.disconnect();
    ro.current = null;
    const parent = el?.parentElement;
    if (!el || !parent || typeof ResizeObserver === 'undefined') return;
    const set = () => {
      if (window.innerWidth < 900) el.style.removeProperty('--cdem-main');
      else {
        // what is left of the panel below the first row's top, never more than what is left of the viewport (the footer takes about 44 px)
        const main = el.querySelector('.cdem-dem-main');
        const top = main ? main.getBoundingClientRect().top : parent.getBoundingClientRect().top;
        const inPanel = parent.getBoundingClientRect().bottom - top;
        el.style.setProperty('--cdem-main', `${Math.max(448, Math.min(inPanel, window.innerHeight - top - 34))}px`);
      }
    };
    ro.current = new ResizeObserver(set);
    ro.current.observe(parent);
    set();
  };
  return [ref];
}

const COLORS = { measurement: '--color-fg', simulation: '--color-accent', population_balance: '--color-accent-2', stopped: '--color-warn' } as const;

function Whisker({ x, lo, hi, color, at }: { x: number; lo: number; hi: number; color: string; at: (p: { x: number; y: number }) => { x: number; y: number } }) {
  const a = at({ x, y: lo });
  const b = at({ x, y: hi });
  return (
    <g stroke={color} strokeWidth={1.6} fill="none">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      <line x1={a.x - 4} y1={a.y} x2={a.x + 4} y2={a.y} />
      <line x1={b.x - 4} y1={b.y} x2={b.x + 4} y2={b.y} />
    </g>
  );
}

/** The x position of a side's mark: the three sides of a point are a little apart on the size axis so none hides another. */
export const sideOffset = (side: 'measurement' | 'simulation' | 'population_balance', dx: number): number => (side === 'simulation' ? -dx : side === 'population_balance' ? dx : 0);

function ComparisonChart({ series }: { series: QuantitySeries }) {
  const lang = useShellLang();
  const num = useNum();
  const sorted = [...series.points].sort((a, b) => a.x - b.x);
  const xs = sorted.map((p) => p.x);
  const span = Math.max(...xs) - Math.min(...xs);
  const dx = span * 0.045;
  const half = dx + span * 0.03;
  const xRange: [number, number] = [Math.min(...xs) - 2.5 * dx - 1, Math.max(...xs) + 2.5 * dx + 1];
  const all = sorted.flatMap((p) => [p.measurement.hi, p.simulation.hi, p.simulation.value, p.population_balance.hi, p.population_balance.value]).filter((v): v is number => v !== null);
  const yMax = Math.max(...all) * 1.12;
  const mk = (side: 'simulation' | 'population_balance', stopped: boolean): { values: number[]; xv: number[] } => {
    const rows = sorted.filter((p) => p[side].value !== null && p[side].stopped === stopped);
    return { values: rows.map((p) => p[side].value as number), xv: rows.map((p) => p.x + sideOffset(side, dx)) };
  };
  const sim = mk('simulation', false);
  const stopped = mk('simulation', true);
  const pb = mk('population_balance', false);
  const list: ChartSeries[] = [{ id: 'measurement', label: SIDE_NAME.measurement, values: sorted.map((p) => p.measurement.value), mode: 'points', size: 10, color: COLORS.measurement }];
  if (sim.values.length) list.push({ id: 'simulation', label: SIDE_NAME.simulation, values: sim.values, x: sim.xv, mode: 'points', size: 9, color: COLORS.simulation });
  if (stopped.values.length) list.push({ id: 'simulation-stopped', label: { en: 'Particle simulation, product before the stop', es: 'Simulación de partículas, producto antes de la detención' }, values: stopped.values, x: stopped.xv, mode: 'points', size: 9, color: COLORS.stopped });
  if (pb.values.length) list.push({ id: 'population-balance', label: SIDE_NAME.population_balance, values: pb.values, x: pb.xv, mode: 'points', size: 9, color: COLORS.population_balance });
  const ticks = sorted.map((p) => ({ value: p.x, label: { en: `${p.feedClass} mm`, es: `${p.feedClass} mm` } as BiText }));
  const name = pick(series.name, lang);
  const unit = pick(series.unit, lang);
  const bandPct = num(series.points[0].band * 100, { digits: 2 });
  return (
    <ChartCallouts
      callouts={[]}
      points={[]}
      frame={{ x: xRange, y: [0, yMax] }}
      overlay={(at) => (
        <g data-comparison-overlay={series.quantity}>
          {sorted.map((p) => {
            const m = p.measurement;
            const lo = at({ x: p.x - half, y: m.hi ?? 0 });
            const hi = at({ x: p.x + half, y: m.lo ?? 0 });
            return m.lo !== null && m.hi !== null ? (
              <rect key={`b${p.id}`} data-measurement-band={p.id} x={lo.x} y={Math.min(lo.y, hi.y)} width={hi.x - lo.x} height={Math.abs(hi.y - lo.y)} fill="color-mix(in oklab, var(--color-fg) 12%, transparent)" stroke="var(--color-fg-subtle)" strokeWidth={1} strokeDasharray="4 3" />
            ) : null;
          })}
          {sorted.map((p) => (
            <g key={`w${p.id}`}>
              {p.simulation.lo !== null && p.simulation.hi !== null && <Whisker x={p.x + sideOffset('simulation', dx)} lo={p.simulation.lo} hi={p.simulation.hi} color={`var(${COLORS.simulation})`} at={at} />}
              {p.population_balance.lo !== null && p.population_balance.hi !== null && <Whisker x={p.x + sideOffset('population_balance', dx)} lo={p.population_balance.lo} hi={p.population_balance.hi} color={`var(${COLORS.population_balance})`} at={at} />}
              {(['simulation', 'population_balance'] as const).map((side) => {
                const m = p[side];
                if (m.value !== null || m.reason === null) return null;
                // a side without a value is an open circle on the baseline, with its reason as the mark's title
                const c = at({ x: p.x + sideOffset(side, dx), y: 0 });
                return (
                  <circle key={`n${side}`} data-no-value={`${p.id}:${side}`} cx={c.x} cy={c.y - 6} r={4} fill="none" stroke={`var(${COLORS[side]})`} strokeWidth={1.6}>
                    <title>{`${pick(SIDE_NAME[side], lang)}: ${pick(m.reason, lang)}`}</title>
                  </circle>
                );
              })}
            </g>
          ))}
        </g>
      )}
    >
      <UPlotChart
        title={{ en: `${series.name.en} by feed class`, es: `${series.name.es} por clase de alimentación` }}
        height="fill"
        x={{ values: xs, label: { en: 'Feed class (mean size)', es: 'Clase de alimentación (tamaño medio)' }, ticks, range: xRange }}
        y={{ label: series.name, unit: series.unit, range: [0, yMax], format: { digits: 3 } }}
        series={list}
        readout={(i) => `${sorted[i].feedClass} mm: ${name} ${sorted[i].measurement.value === null ? '' : `${num(sorted[i].measurement.value as number, { digits: 3 })} ${unit}`}, ${lang === 'es' ? 'banda' : 'band'} ${bandPct} %`}
      />
    </ChartCallouts>
  );
}

function ComparisonCard({ run, q, pointId }: { run: DemRun; q: ChartQuantity; pointId: string }) {
  const lang = useShellLang();
  const num = useNum();
  const stateKey = useWorkbenchState()?.stateKey;
  const series = comparisonSeries(run, q, num);
  const t = (en: string, es: string) => (lang === 'es' ? es : en);
  const noValues = series.points.flatMap((p) => (['simulation', 'population_balance'] as const).flatMap((side) => (p[side].value === null && p[side].reason ? [`${pick(SIDE_NAME[side], lang)}, ${p.feedClass} mm: ${pick(p[side].reason as Text, lang)}`] : [])));
  const bandNote =
    q === 'p80'
      ? t(`Shaded: the band of the reduction ratio F80/P80 (${num(series.points[0].band * 100, { digits: 2 })} percent) written as a band on P80. Bars: the spread of the population balance over the published ranges of its classification parameters, a sensitivity band and not a confidence interval.`, `Sombreado: la banda de la razón de reducción F80/P80 (${num(series.points[0].band * 100, { digits: 2 })} por ciento) escrita como banda de P80. Barras: la dispersión del balance poblacional sobre los rangos publicados de sus parámetros de clasificación, una banda de sensibilidad y no un intervalo de confianza.`)
      : t(`Shaded: the measurement plus or minus the ${num(series.points[0].band * 100, { digits: 2 })} percent band. Bars: one standard error of the particle simulation over its steady window. The three sides of a point are drawn a little apart so none hides another.`, `Sombreado: la medición más o menos la banda de ${num(series.points[0].band * 100, { digits: 2 })} por ciento. Barras: un error estándar de la simulación de partículas sobre su ventana estacionaria. Los tres lados de un punto se dibujan algo separados para que ninguno oculte a otro.`);
  return (
    <PlotCard title={{ en: `${series.name.en} (${series.unit.en}) against the feed`, es: `${series.name.es} (${series.unit.es}) contra la alimentación` }} lane="replay" provenance="published" dataKey={stateKey}>
      <div data-comparison={q} className="cdem-comparison">
        <div className="cdem-comparison-chart">
          <ComparisonChart series={series} />
        </div>
        <ul className="cdem-sentences" data-sentences={q}>
          {run.points.map((p, i) => (
            <li key={p.id} data-point={p.id} aria-current={p.id === pointId ? 'true' : undefined}>
              {pick(nearerSentence(run, i, q, num), lang)}
            </li>
          ))}
        </ul>
        <p className="caos-plot-note">{bandNote}</p>
        {noValues.length > 0 && (
          <p className="caos-plot-note" data-no-value-reasons="">
            {t('No value (open circle): ', 'Sin valor (círculo abierto): ')}
            {noValues.join('; ')}.
          </p>
        )}
      </div>
    </PlotCard>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The product size distribution and the verdict table of the chosen point.
// ---------------------------------------------------------------------------------------------------------------------------------

function DistributionCard({ run, point }: { run: DemRun; point: DemPoint }) {
  const num = useNum();
  const stateKey = useWorkbenchState()?.stateKey;
  const d = distributionOf(run, point);
  const stopped = d.simulationStopped;
  const a = finalAttempt(point.simulation);
  const list: ChartSeries[] = [
    { id: 'measured', label: { en: 'Measured sieves', es: 'Tamices medidos' }, values: d.measured.passing, x: d.measured.sieves, mode: 'points', size: 9, color: '--color-fg' },
    {
      id: 'simulation',
      label: stopped ? { en: `Particle simulation, product of the ${num(a.mass_passed_kg, { digits: 3 })} kg passed before the stop`, es: `Simulación de partículas, producto de los ${num(a.mass_passed_kg, { digits: 3 })} kg pasados antes de la detención` } : SIDE_NAME.simulation,
      values: d.simulation,
      color: stopped ? '--color-warn' : '--color-accent',
      width: 2.2,
    },
    { id: 'pb', label: SIDE_NAME.population_balance, values: d.populationBalance, color: '--color-accent-2', width: 2.2 },
    { id: 'pb-low', label: { en: 'Population balance, low end of the spread', es: 'Balance poblacional, extremo bajo de la dispersión' }, values: d.populationBalanceLow, color: '--color-accent-2', dash: [4, 3], width: 1.2 },
    { id: 'pb-high', label: { en: 'Population balance, high end of the spread', es: 'Balance poblacional, extremo alto de la dispersión' }, values: d.populationBalanceHigh, color: '--color-accent-2', dash: [4, 3], width: 1.2 },
  ];
  const marks = [
    { x: d.css_mm, label: { en: `closed side ${num(d.css_mm, { digits: 3 })} mm`, es: `abertura cerrada ${num(d.css_mm, { digits: 3 })} mm` } },
    { x: d.oss_mm, label: { en: `open side ${num(d.oss_mm, { digits: 3 })} mm`, es: `abertura abierta ${num(d.oss_mm, { digits: 3 })} mm` } },
  ];
  const note: BiText = {
    en: `Cumulative passing against size, ${point.feed_class} mm feed. ${stopped ? `The particle run did not complete: its curve is the product of the mass passed before the stop. ` : ''}The particle simulation states no passing below its smallest sphere (${num(run.settings.minimum_sphere_mm, { digits: 2 })} mm), so its curve starts there. Dashed: the spread of the population balance over the published ranges of its classification parameters.`,
    es: `Pasante acumulado contra tamaño, alimentación de ${point.feed_class} mm. ${stopped ? 'La corrida de partículas no se completó: su curva es el producto de la masa pasada antes de la detención. ' : ''}La simulación de partículas no entrega pasante bajo su esfera más pequeña (${num(run.settings.minimum_sphere_mm, { digits: 2 })} mm), así que su curva parte ahí. Segmentadas: la dispersión del balance poblacional sobre los rangos publicados de sus parámetros de clasificación.`,
  };
  return (
    <PlotCard title={{ en: `Product size distribution, ${point.feed_class} mm feed`, es: `Distribución de tamaños del producto, alimentación de ${point.feed_class} mm` }} lane="replay" provenance="published" dataKey={stateKey} note={note}>
      <div className="cdem-distribution" data-distribution={point.id}>
        <UPlotChart
          title={{ en: 'Cumulative passing against size', es: 'Pasante acumulado contra tamaño' }}
          height="fill"
          x={{ values: d.sieves, label: { en: 'Size', es: 'Tamaño' }, unit: { en: 'mm', es: 'mm' }, log: true, range: [0.8, 80] }}
          y={{ label: { en: 'Cumulative passing', es: 'Pasante acumulado' }, unit: { en: '%', es: '%' }, range: [0, 105], format: { digits: 3 } }}
          series={list}
          marks={marks}
        />
      </div>
    </PlotCard>
  );
}

function VerdictTable({ run, point }: { run: DemRun; point: DemPoint }) {
  const lang = useShellLang();
  const num = useNum();
  const t = useT();
  const rows = verdictRows(point);
  const fmt = (q: (typeof QUANTITIES)[number], v: number | null) => (v === null ? t('no value', 'sin valor') : `${num(v, { digits: 3 })}${q === 'reduction_ratio' ? '' : ` ${pick(QUANTITY_UNIT[q], lang)}`}`);
  const counts = verdictCounts(run);
  return (
    <div className="cdem-tablewrap" data-verdict-table={point.id}>
      <table className="caos-table" data-state="ready">
        <caption className="cdem-caption">
          {t(
            `Verdicts of the ${point.feed_class} mm point. In the whole document ${counts.met} of ${counts.total} verdicts are met, ${counts.notMet} are not met and ${counts.notCompared} are not compared. A verdict that is met is within the band; one that is not met or not compared is outside it or not judged.`,
            `Veredictos del punto de ${point.feed_class} mm. En todo el documento ${counts.met} de ${counts.total} veredictos se cumplen, ${counts.notMet} no se cumplen y ${counts.notCompared} no se comparan. Un veredicto que se cumple está dentro de la banda; uno que no se cumple o no se compara está fuera de ella o sin juzgar.`,
          )}
        </caption>
        <thead>
          <tr>
            <th>{t('Comparison', 'Comparación')}</th>
            <th>{t('Quantity', 'Cantidad')}</th>
            <th>{t('First', 'Primero')}</th>
            <th>{t('Second', 'Segundo')}</th>
            <th>{t('Relative error', 'Error relativo')}</th>
            <th>{t('Band', 'Banda')}</th>
            <th>{t('Verdict', 'Veredicto')}</th>
            <th>{t('Resolved', 'Resuelto')}</th>
            <th>{t('Basis', 'Fundamento')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.pair}-${r.quantity}`} data-pair={r.pair} data-quantity={r.quantity} data-verdict={r.state}>
              {i % QUANTITIES.length === 0 && <th scope="rowgroup" rowSpan={QUANTITIES.length}>{pick(pairTitle(r.pair), lang)}</th>}
              <td>{pick(QUANTITY_NAME[r.quantity], lang)}</td>
              <td>{fmt(r.quantity, r.first)}</td>
              <td>{fmt(r.quantity, r.second)}</td>
              <td>{r.relativeError === null ? t('none', 'ninguno') : `${signedPct(r.relativeError, num)} %`}</td>
              <td>{`±${num(r.band * 100, { digits: 2 })} %`}</td>
              <td>
                <span aria-hidden="true">{VERDICT_MARK[r.state]} </span>
                {pick(verdictWord(r.state), lang)}
              </td>
              <td>{r.resolved === null ? t('not applicable', 'no aplica') : r.resolved ? t('yes', 'sí') : t('no', 'no')}</td>
              <td>{r.basis ? pick(r.basis, lang) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VerdictCard({ run, point }: { run: DemRun; point: DemPoint }) {
  const stateKey = useWorkbenchState()?.stateKey;
  return (
    <PlotCard title={{ en: `Verdicts, ${point.feed_class} mm feed`, es: `Veredictos, alimentación de ${point.feed_class} mm` }} lane="replay" provenance="published" dataKey={stateKey}>
      <VerdictTable run={run} point={point} />
    </PlotCard>
  );
}

/** The sources of the measured values, the package and its seed, and what the bands are and when they were set; all from the document. */
function Sources({ run, point }: { run: DemRun; point: DemPoint }) {
  const t = useT();
  const num = useNum();
  const stateKey = useWorkbenchState()?.stateKey;
  const m = point.measured;
  const row = (term: string, def: ReactNode) => (
    <div className="cdem-source">
      <dt>{term}</dt>
      <dd>{def}</dd>
    </div>
  );
  return (
    <PlotCard title={{ en: 'Sources, package, seed and bands', es: 'Fuentes, paquete, semilla y bandas' }} lane="replay" provenance="published" dataKey={stateKey} note={{ en: 'The source texts are the document’s own, in English.', es: 'Los textos de fuente son los del documento, en inglés.' }}>
      <dl className="cdem-sources" data-sources="">
        {row(t('Measured throughput', 'Capacidad medida'), `${num(m.throughput_kg_h.value, { digits: 4 })} kg/h (${t('digitisation noise', 'ruido de digitalización')} ${num(m.throughput_kg_h.digitisation_noise, { digits: 2 })}): ${m.throughput_kg_h.source}`)}
        {row(t('Measured net power', 'Potencia neta medida'), `${num(m.net_power_kw.value, { digits: 3 })} kW: ${m.net_power_kw.source}`)}
        {row(t('Measured product', 'Producto medido'), m.product_source)}
        {row(t('Paper', 'Artículo'), `${run.source.paper}; DOI ${run.source.doi}; ${run.source.license}`)}
        {row(t('Digitisation', 'Digitalización'), run.source.digitised)}
        {row(t('Machine', 'Máquina'), `${run.machine.name}: ${run.machine.source}`)}
        {row(t('Particle simulation', 'Simulación de partículas'), `${run.package.name} ${run.package.version} (${run.package.backend}); ${t('seed', 'semilla')} ${run.seed}`)}
        {row(t('Ore', 'Mineral'), `${run.ore.name}; ${run.ore.derivation}`)}
        {row(t('Population balance', 'Balance poblacional'), `${run.preset.capacity_model} ${run.preset.first_estimate_source} ${run.preset.ranges_source} ${run.preset.power}`)}
        {row(
          t('Bands', 'Bandas'),
          `${t('throughput', 'capacidad')} ${num(run.bands.throughput_relative * 100, { digits: 2 })} %, ${t('net power', 'potencia neta')} ${num(run.bands.net_power_relative * 100, { digits: 2 })} %, ${t('reduction ratio', 'razón de reducción')} ${num(run.bands.reduction_ratio_relative * 100, { digits: 2 })} %. ${run.bands.set}`,
        )}
      </dl>
    </PlotCard>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The view.
// ---------------------------------------------------------------------------------------------------------------------------------

export interface DemBodyProps {
  run: DemRun;
  readiness: Readiness | null | undefined;
  /** A test's decoded frames of a point (by its id); without it the view fetches the chosen point's file when it is shown. */
  frames?: Loaded<DemFrames>;
  initialPoint?: string;
  initialCursor?: number | null;
  reducedMotion?: boolean;
}

/** The loaded document: the readiness note, the laboratory machine's note, the operating point choice, the stage with its series, the comparison, the distribution, the verdicts and the sources. */
export function DemBody({ run, readiness, frames, initialPoint, initialCursor, reducedMotion }: DemBodyProps) {
  const { index } = useView();
  const lang = useShellLang();
  const [pointId, setPointId] = useState(initialPoint ?? run.points[0].id);
  const [speed, setSpeed] = useState<number>(DEFAULT_SPEED);
  const point = run.points.find((p) => p.id === pointId) ?? run.points[0];
  const replay = point.simulation.replay;
  const loaded = useArtifact<DemFrames>((signal) => (index && replay ? loadDemFrames(index, replay, signal) : new Promise<DemFrames>(() => undefined)), [index, replay?.file]);
  const shown: Loaded<DemFrames> = frames ?? loaded;
  const view = viewState(readiness ?? null, ['dem-run']);
  const [panelRef] = usePanelHeight();
  return (
    <div ref={panelRef} className="cdem-dem" data-state="ready" data-point={point.id} data-run-state={run.state} data-incomplete={run.incomplete.join(',')}>
      <LinkedViewProvider key={point.id} initial={{ cursor: initialCursor !== undefined && point.id === (initialPoint ?? run.points[0].id) ? initialCursor : openingCursor(point) }}>
        <div className="cdem-dem-main">
          <MainRow
            run={run}
            point={point}
            frames={shown}
            speed={speed}
            onSpeed={setSpeed}
            reducedMotion={reducedMotion}
            readiness={readiness !== undefined ? <NoteLine view={view} lang={lang} /> : null}
            choice={<PointChoice run={run} pointId={point.id} onPick={setPointId} />}
          />
        </div>
      </LinkedViewProvider>
      <div className="cdem-dem-rest">
        <LabNote run={run} />
        <ViewsRow>
          {CHART_QUANTITIES.map((q) => (
            <ComparisonCard key={q} run={run} q={q} pointId={point.id} />
          ))}
        </ViewsRow>
        <ViewsRow shares={[1, 1]}>
          <DistributionCard run={run} point={point} />
          <VerdictCard run={run} point={point} />
        </ViewsRow>
        <Sources run={run} point={point} />
      </div>
    </div>
  );
}

/** A document that is not in this build: the reader's reason, with nothing drawn. */
export function DemUnavailable({ reason }: { reason: Text }) {
  const lang = useShellLang();
  const t = useT();
  return (
    <div className="cdem-dem" data-state="unavailable-wrap">
      <p className="caos-pending" data-state="unavailable">
        {t('The particle simulation of the laboratory jaw crusher is not available yet: ', 'La simulación de partículas de la chancadora de mandíbula del laboratorio aún no está disponible: ')}
        {reason[lang]}
      </p>
    </div>
  );
}

/** The App's view: reads the document through the index and the readiness, and says why when it cannot. */
export function DemView() {
  const { index } = useView();
  const lang = useShellLang();
  const readiness = useReadiness();
  const doc = useArtifact<DemRun>((signal) => (index ? loadDemRun(index, signal) : new Promise<DemRun>(() => undefined)), [index]);
  if (doc.state === 'unavailable') return <DemUnavailable reason={doc.reason} />;
  if (doc.state === 'error')
    return (
      <p className="caos-pending" role="alert" data-state="unavailable">
        {lang === 'es' ? `No se pudo leer la simulación de partículas: ${doc.error}` : `The particle simulation could not be read: ${doc.error}`}
      </p>
    );
  if (doc.state !== 'ready')
    return (
      <p className="caos-pending" data-state="loading">
        {lang === 'es' ? 'Cargando la simulación de partículas' : 'Loading the particle simulation'}
      </p>
    );
  return <DemBody run={doc.data} readiness={readiness} />;
}

