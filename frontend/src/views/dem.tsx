// The view "Particle simulation" of the Validation group (tab `particles`; catalog row dem-run; requirements DM-012 to DM-017): the discrete
// element method run by the published package on the laboratory jaw crusher of the paper's tests, beside the measurement and the population
// balance. The stage replays the particles in the jaw's section (cropped to where they are) with the moving plate, the magnified crushing zone
// and three anchored callouts; the per-stroke power and the mass passed share one stroke cursor with the stage in both directions (the shell's
// linked-view store, scoped to this view); the three operating points are on shared axes for throughput, net power and product P80 with the
// measurement's band, the simulation's standard error and the population balance's spread; then the product size distribution, the verdict
// table with its sources, and the states of the row. Every number is read from the document by a function of demModel.ts. The view shows a
// laboratory machine, not the selected case, and says so. The document's and the package's own English texts are quoted verbatim in blocks
// marked as such (translate="no", lang="en"), never rewritten.
import { LinkedViewProvider, PlotCard, prefersReducedMotion, runStagedTransition, ViewsRow, useLinkedCursor, useShellLang, useWorkbenchState, type BiText, type MotionStage } from '@fasl-work/caos-app-shell';
import { UPlotChart, type ChartSeries } from '@fasl-work/caos-app-shell/chart';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  feedClassText,
  finalAttempt,
  frameBelow,
  hasPaperSimulation,
  isComplete,
  labMachine,
  nearerSentence,
  noValueNote,
  openingCursor,
  overlapClause,
  packageMessage,
  pairTitle,
  paperSimulation,
  pointCallouts,
  powerRange,
  QUANTITIES,
  QUANTITY_DECIMALS,
  QUANTITY_NAME,
  QUANTITY_UNIT,
  runStateText,
  runStatusText,
  SIDE_NAME,
  signedPct,
  SPREAD_NAME,
  storedRateText,
  takeaway,
  VERDICT_MARK,
  VERDICT_SCOPE,
  verdictRows,
  verdictSummary,
  verdictWord,
  windowMeanPower,
  type ChartQuantity,
  type DemFrames,
  type DemPoint,
  type Num,
  type QuantitySeries,
} from './demModel';
import { FramesState, REDUCED_NOTE, ReplayControls, ReplayStage, StageCard } from './demReplay';
import { useNum, useT, useView } from './shared';

const pick = (t: { en: string; es: string }, lang: 'en' | 'es'): string => t[lang];

/** The document's or the package's own words, in English, verbatim: marked as foreign-language text so a Spanish page never rewrites their numbers. */
export function Q({ children }: { children: ReactNode }) {
  return (
    <q className="cdem-quote" translate="no" lang="en">
      {children}
    </q>
  );
}

/** The callouts of a point for the stage: the model's three, in the reader's numbers; a value that is missing has no unit. */
export function calloutSpecs(point: DemPoint, num: Num): CalloutSpec[] {
  return pointCallouts(point).map((c) => {
    const source = calloutSource(c, num);
    return {
      id: c.id,
      eyebrow: c.eyebrow,
      value: c.value === null ? null : num(c.value, c.decimalsOrDigits),
      unit: c.value === null ? { en: '', es: '' } : c.unit,
      state: calloutState(c.state),
      source,
      missing: source,
    };
  });
}

/** The note that says what the view shows: a laboratory machine of published tests, not the case selected in the workbench. */
export function LabNote({ run }: { run: DemRun }) {
  const lang = useShellLang();
  const num = useNum();
  const m = run.machine;
  const machine = labMachine(m.name, lang);
  const text =
    lang === 'es'
      ? `Esta vista muestra ${machine} (boca ${num(m.gape_mm, { digits: 3 })} mm, ancho ${num(m.width_mm, { digits: 3 })} mm, carrera ${num(m.throw_mm, { digits: 3 })} mm), una máquina de ensayos publicados, no la máquina del caso elegido en el panel.`
      : `This view shows ${machine} (gape ${num(m.gape_mm, { digits: 3 })} mm, width ${num(m.width_mm, { digits: 3 })} mm, throw ${num(m.throw_mm, { digits: 3 })} mm), a machine of published tests, not the machine of the case selected in the workbench.`;
  return (
    <p className="caos-plot-note cdem-labnote" data-lab-note="">
      {text}
    </p>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The operating point choice.
// ---------------------------------------------------------------------------------------------------------------------------------

function PointChoice({ run, pointId, onPick }: { run: DemRun; pointId: string; onPick: (id: string) => void }) {
  const lang = useShellLang();
  const num = useNum();
  const t = useT();
  return (
    <div className="cdem-controls cdem-points" role="group" aria-label={t('Operating point: the feed class of the test', 'Punto de operación: la clase de alimentación del ensayo')} data-point-choice="">
      {run.points.map((p) => (
        <button key={p.id} type="button" className="btn cdem-pointbtn" aria-pressed={p.id === pointId} data-point={p.id} data-run-status={p.simulation.status} onClick={() => onPick(p.id)}>
          {feedClassText(p.feed_class, num)} mm: {pick(runStateText(p.simulation, true), lang)}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The staged change of operating point (ADR-0082 rule 4): the stage first, then the per-stroke series, then the rest; instant under reduced motion.
// ---------------------------------------------------------------------------------------------------------------------------------

/** The stages of a change of operating point, in order: each sets how much of the view is shown (1 the stage, 2 the series, 3 everything). */
export function pointStages(set: (step: number) => void): MotionStage[] {
  return [
    { run: () => set(1), durationMs: 320 },
    { run: () => set(2), durationMs: 320 },
    { run: () => set(3), durationMs: 0 },
  ];
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The linked per-stroke series.
// ---------------------------------------------------------------------------------------------------------------------------------

/** The marker of the stroke cursor on a per-stroke chart: one vertical mark at the cursor. */
export const cursorMark = (cursor: number): { x: number; label: BiText } => ({ x: cursor, label: { en: 'cursor', es: 'cursor' } });

/** The hint under the comparison and distribution charts: it says what a touch does as well as a pointer. */
const READ_HINT: BiText = { en: 'Hover or touch a point to read its values', es: 'Pase el cursor o toque un punto para leer sus valores' };

const SERIES_HINT: BiText = { en: 'Choose a stroke on the chart to move the replay', es: 'Elija un golpe en el gráfico para mover la repetición' };

function StrokeSeries({ point, cursor, onPick }: { point: DemPoint; cursor: number; onPick: (stroke: number) => void }) {
  const lang = useShellLang();
  const num = useNum();
  const s = point.simulation;
  const strokes = [...s.series.stroke];
  const w = s.window;
  const mean = windowMeanPower(s);
  const unitP: BiText = { en: 'W', es: 'W' };
  const x = { values: strokes, label: { en: 'Stroke', es: 'Golpe' }, range: [0, strokes[strokes.length - 1] + 1] as [number, number] };
  const stopAt = finalAttempt(s).stopped_during_stroke;
  // the cursor and, for a run that did not complete, the stroke it stopped in
  // the cursor is the shell's mark; the stop of a run that did not complete is the view's own (StopMark): dashed, in the alarm colour, with its label on a line of its own
  const marks = [cursorMark(cursor)];
  const stopMark = !isComplete(s) && stopAt !== null ? stopAt : null;
  const [pLo, pHi] = powerRange(s);
  const yMaxM = Math.max(...s.series.passed_kg, ...s.series.hold_up_kg, s.mass_fed_kg) * 1.1;
  const power: ChartSeries[] = [{ id: 'plate-power', label: { en: 'Plate power per stroke', es: 'Potencia de la placa por golpe' }, values: [...s.series.plate_power_w], color: '--color-accent', width: 2 }];
  // neutral series: colour is reserved for state and focus, and the cursor has a colour of its own
  const mass: ChartSeries[] = [
    { id: 'passed', label: { en: 'Mass passed', es: 'Masa pasada' }, values: [...s.series.passed_kg], color: '--color-fg', width: 2 },
    { id: 'held', label: { en: 'Mass held in the chamber', es: 'Masa retenida en la cámara' }, values: [...s.series.hold_up_kg], color: '--color-fg-subtle', width: 1.6, dash: [5, 3] },
  ];
  const pick = (i: number) => onPick(strokes[Math.max(0, Math.min(strokes.length - 1, i))]);
  return (
    <div className="cdem-series-row" data-stroke-series="" data-cursor-stroke={cursor} data-window={w ? `${w.first_stroke},${w.last_stroke}` : ''}>
      <div className="cdem-series-cell">
        <ChartCallouts
          callouts={[]}
          points={[]}
          frame={{ x: x.range, y: [pLo, pHi] }}
          overlay={(at) => (
            <>
              {w && <WindowBand at={at} from={w.first_stroke - 0.5} to={w.last_stroke + 0.5} yTop={pHi} yBottom={pLo} cursor={cursor} label={lang === 'es' ? 'ventana estacionaria' : 'steady window'} />}
              {stopMark !== null && <StopMark at={at} x={stopMark} yTop={pHi} yBottom={pLo} label={lang === 'es' ? 'corrida detenida' : 'run stopped'} />}
            </>
          )}
        >
          <UPlotChart
            title={{ en: 'Plate power per stroke, with the steady window', es: 'Potencia de la placa por golpe, con la ventana estacionaria' }}
            height="fill"
            x={x}
            y={{ label: { en: 'Plate power', es: 'Potencia de la placa' }, unit: unitP, range: [pLo, pHi], format: { digits: 3 } }}
            series={power}
            marks={marks}
            yMarks={mean === null ? [] : [{ y: mean, label: { en: `window mean ${num(mean, { digits: 3 })} W`, es: `media de la ventana ${num(mean, { digits: 3 })} W` }, tone: 'neutral' }]}
            onPick={pick}
            hint={SERIES_HINT}
            readout={(i) => `${lang === 'es' ? 'golpe' : 'stroke'} ${strokes[i]}: ${num(s.series.plate_power_w[i], { digits: 3 })} W`}
          />
        </ChartCallouts>
      </div>
      <div className="cdem-series-cell">
        <ChartCallouts
          callouts={[]}
          points={[]}
          frame={{ x: x.range, y: [0, yMaxM] }}
          overlay={(at) => (stopMark !== null ? <StopMark at={at} x={stopMark} yTop={yMaxM} yBottom={0} label={lang === 'es' ? 'corrida detenida' : 'run stopped'} /> : null)}
        >
        <UPlotChart
          title={{ en: 'Mass passed and held, with the spheres held', es: 'Masa pasada y retenida, con las esferas retenidas' }}
          height="fill"
          x={x}
          y={{ label: { en: 'Mass', es: 'Masa' }, unit: { en: 'kg', es: 'kg' }, range: [0, yMaxM], format: { digits: 3 } }}
          series={mass}
          marks={marks}
          onPick={pick}
          hint={SERIES_HINT}
          readout={(i) =>
            lang === 'es'
              ? `golpe ${strokes[i]}: pasados ${num(s.series.passed_kg[i], { digits: 3 })} kg; retenidas ${s.series.held[i]} esferas (${num(s.series.hold_up_kg[i], { digits: 3 })} kg)`
              : `stroke ${strokes[i]}: passed ${num(s.series.passed_kg[i], { digits: 3 })} kg; held ${s.series.held[i]} spheres (${num(s.series.hold_up_kg[i], { digits: 3 })} kg)`
          }
        />
        </ChartCallouts>
      </div>
    </div>
  );
}

/** The steady window shaded behind a per-stroke chart: a band from stroke `from` to `to` over the plot's height, with its name. */
export function windowLabelSide(from: number, to: number, cursor: number): 'left' | 'right' {
  // the label stands at the inside edge of the band that is farther from the cursor, so it never sits under the cursor's own label
  return cursor < (from + to) / 2 ? 'right' : 'left';
}

function WindowBand({ at, from, to, yTop, yBottom, cursor, label }: { at: (p: { x: number; y: number }) => { x: number; y: number }; from: number; to: number; yTop: number; yBottom: number; cursor: number; label: string }) {
  const a = at({ x: from, y: yTop });
  const b = at({ x: to, y: yBottom });
  const side = windowLabelSide(from, to, cursor);
  return (
    <g data-window-band="" data-window-from={from} data-window-to={to}>
      <rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill="color-mix(in oklab, var(--color-accent) 12%, transparent)" stroke="var(--color-accent)" strokeWidth={1} strokeDasharray="4 3" />
      <text data-window-label={side} x={side === 'right' ? Math.max(a.x, b.x) - 4 : Math.min(a.x, b.x) + 4} y={Math.min(a.y, b.y) + 26} textAnchor={side === 'right' ? 'end' : 'start'} fontSize={11} fill="var(--color-fg-subtle)" style={{ fontFamily: 'var(--font-sans)' }}>
        {label}
      </text>
    </g>
  );
}

/** The stop of a run that did not complete: a dashed line in the alarm colour with its label on a line of its own, so it is told from the cursor by colour, dash and place. */
export function StopMark({ at, x, yTop, yBottom, label }: { at: (p: { x: number; y: number }) => { x: number; y: number }; x: number; yTop: number; yBottom: number; label: string }) {
  const a = at({ x, y: yTop });
  const b = at({ x, y: yBottom });
  return (
    <g data-stop-mark={x}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-bad)" strokeWidth={1.6} strokeDasharray="2 3" />
      <text x={a.x - 4} y={a.y + 40} textAnchor="end" fontSize={11} fill="var(--color-bad)" style={{ fontFamily: 'var(--font-sans)' }}>
        {label}
      </text>
    </g>
  );
}

function SeriesCard({ point, cursor, onPick }: { point: DemPoint; cursor: number; onPick: (stroke: number) => void }) {
  const stateKey = useWorkbenchState()?.stateKey;
  return (
    <PlotCard title={{ en: 'Per stroke: power and mass passed, linked to the replay', es: 'Por golpe: potencia y masa pasada, ligadas a la repetición' }} lane="replay" provenance="published" dataKey={stateKey}>
      <StrokeSeries point={point} cursor={cursor} onPick={onPick} />
    </PlotCard>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The stage of one operating point.
// ---------------------------------------------------------------------------------------------------------------------------------

/** The run's status line: where and why it stopped or how it completed, the overlap clause the power verdicts rest on, and the package's own message in English. */
function StatusLine({ run, point }: { run: DemRun; point: DemPoint }) {
  const lang = useShellLang();
  const num = useNum();
  const t = useT();
  const status = runStatusText(point.simulation, num);
  const clause = overlapClause(point.simulation, run.settings, num);
  const message = packageMessage(point.simulation);
  return (
    <p className="cdem-status" data-run-status={point.simulation.status} data-state-run={isComplete(point.simulation) ? 'complete' : 'stopped'}>
      {pick(status, lang)}
      {clause ? ` ${pick(clause, lang)}` : ''}
      {message && (
        <>
          {' '}
          {t('The package’s message, in English: ', 'Mensaje del paquete, en inglés: ')}
          <Q>{message}</Q>
        </>
      )}
    </p>
  );
}

function MainRow({ run, point, frames, speed, onSpeed, reducedMotion, choice, cursor }: { run: DemRun; point: DemPoint; frames: Loaded<DemFrames>; speed: number; onSpeed: (s: number) => void; reducedMotion?: boolean; choice: ReactNode; cursor: number | null }) {
  const lang = useShellLang();
  const num = useNum();
  const stateKey = useWorkbenchState()?.stateKey;
  const r = point.simulation.replay;
  const at = cursor ?? openingCursor(point);
  if (!r || at === null) {
    return (
      <p className="caos-pending" data-state="unavailable">
        {lang === 'es' ? 'Este punto no registró cuadros: no hay repetición de partículas.' : 'This point recorded no frames: there is no particle replay.'}
      </p>
    );
  }
  const frame = frameBelow(r, at);
  const ready = frames.state === 'ready' ? frames.data : null;
  const reduced = reducedMotion ?? prefersReducedMotion();
  return (
    <StageCard title={{ en: 'Laboratory jaw, not the selected case: particle replay', es: 'Mandíbula de laboratorio, no el caso elegido: repetición de partículas' }} stateKey={stateKey}>
      <div className="cdem-stage-bar">
        {choice}
        <ReplayControls point={point} frame={frame} reducedMotion={reducedMotion} speed={speed} onSpeed={onSpeed} />
      </div>
      <p className="cdem-status" data-stored-rate="" data-reduced-motion-note={reduced ? '' : undefined}>
        {pick(storedRateText(r), lang)}
        {reduced ? ` ${pick(REDUCED_NOTE, lang)}` : ''}
      </p>
      {frames.state === 'loading' || frames.state === 'unavailable' || frames.state === 'error' ? (
        <FramesState frames={frames} />
      ) : (
        <div className="cdem-fill cdem-stage-fill" data-frames="ready">
          <ReplayStage run={run} point={point} frames={ready} cursor={at} callouts={calloutSpecs(point, num)} />
        </div>
      )}
      <StatusLine run={run} point={point} />
    </StageCard>
  );
}

/** The takeaway sentence and the readiness line: the first block after the stage card. */
function AfterStage({ run, point, readiness }: { run: DemRun; point: DemPoint; readiness: ReactNode }) {
  const lang = useShellLang();
  const num = useNum();
  return (
    <div className="cdem-after-stage" data-after-stage="">
      <p className="cdem-takeaway" data-takeaway="">
        {pick(takeaway(point, run.bands, num), lang)}
      </p>
      {readiness}
    </div>
  );
}

/** The cursor of the enclosing linked-view store, read where the per-stroke series are drawn. */
function Linked({ point, children }: { point: DemPoint; children: (cursor: number | null, scrub: (c: number | null) => void) => ReactNode }) {
  const { cursor, scrub } = useLinkedCursor();
  return <>{children(cursor ?? openingCursor(point), scrub)}</>;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The comparison on shared axes.
// ---------------------------------------------------------------------------------------------------------------------------------

/** The panel's height for the first row: the view's parent is sized by the shell (a flex column of the App's panel), and the stage takes all of it
 * so the rest starts under the fold. Below 900 px the page scrolls and the row keeps its own minimum. */
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

const COLORS = { measurement: '--color-fg', simulation: '--color-accent', population_balance: '--color-accent-2', stopped: '--color-fg-subtle', paper: '--color-magenta' } as const;

type At = (p: { x: number; y: number }) => { x: number; y: number };

function Whisker({ x, lo, hi, color, at }: { x: number; lo: number; hi: number; color: string; at: At }) {
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

/** The x position of a side's mark within its category: the three sides of a point are a little apart so none hides another. */
export const sideOffset = (side: 'measurement' | 'simulation' | 'population_balance', dx: number): number => (side === 'simulation' ? -dx : side === 'population_balance' ? dx : 0);

/** The horizontal offset of a side's mark [categories] and the half width of the measurement's band: the three feed classes are equally spaced positions 1, 2 and 3. */
export const CATEGORY = { dx: 0.17, half: 0.3 } as const;

/**
 * What the comparison draws over the chart, in the plot's own scales (`at` maps a data point to pixels): the measurement's band shaded and the
 * standard error of the particle simulation and the spread of the population balance as bars. A side that states no value has no mark here at
 * all: it is said in words as the chart's own axis note (noValueNote), directly under the tick labels and above the key.
 */
export function ComparisonOverlay({ series, at }: { series: QuantitySeries; at: At }) {
  const rows = series.points.map((p, i) => ({ p, c: i + 1 }));
  return (
    <g data-comparison-overlay={series.quantity}>
      {rows.map(({ p, c }) => {
        const m = p.measurement;
        if (m.lo === null || m.hi === null) return null;
        const lo = at({ x: c - CATEGORY.half, y: m.hi });
        const hi = at({ x: c + CATEGORY.half, y: m.lo });
        return <rect key={`b${p.id}`} data-measurement-band={p.id} x={lo.x} y={Math.min(lo.y, hi.y)} width={hi.x - lo.x} height={Math.abs(hi.y - lo.y)} fill="color-mix(in oklab, var(--color-fg) 12%, transparent)" stroke="var(--color-fg-subtle)" strokeWidth={1} strokeDasharray="4 3" />;
      })}
      {rows.map(({ p, c }) => (
        <g key={`w${p.id}`}>
          {p.simulation.lo !== null && p.simulation.hi !== null && <Whisker x={c + sideOffset('simulation', CATEGORY.dx)} lo={p.simulation.lo} hi={p.simulation.hi} color={`var(${COLORS.simulation})`} at={at} />}
          {p.population_balance.lo !== null && p.population_balance.hi !== null && <Whisker x={c + sideOffset('population_balance', CATEGORY.dx)} lo={p.population_balance.lo} hi={p.population_balance.hi} color={`var(${COLORS.population_balance})`} at={at} />}
        </g>
      ))}
    </g>
  );
}

function ComparisonChart({ series }: { series: QuantitySeries }) {
  const lang = useShellLang();
  const num = useNum();
  const pts = series.points.map((p, i) => ({ ...p, c: i + 1 }));
  const xs = pts.map((p) => p.c);
  const xRange: [number, number] = [0.45, 3.55];
  const all = pts.flatMap((p) => [p.measurement.hi, p.simulation.hi, p.simulation.value, p.population_balance.hi, p.population_balance.value, p.paper?.value ?? null]).filter((v): v is number => v !== null);
  const yMax = Math.max(...all) * 1.12;
  const mk = (side: 'simulation' | 'population_balance', stopped: boolean): { values: number[]; xv: number[] } => {
    const rows = pts.filter((p) => p[side].value !== null && p[side].stopped === stopped);
    return { values: rows.map((p) => p[side].value as number), xv: rows.map((p) => p.c + sideOffset(side, CATEGORY.dx)) };
  };
  const sim = mk('simulation', false);
  const stopped = mk('simulation', true);
  const pb = mk('population_balance', false);
  const list: ChartSeries[] = [{ id: 'measurement', label: SIDE_NAME.measurement, values: pts.map((p) => p.measurement.value), mode: 'points', size: 10, color: COLORS.measurement }];
  if (sim.values.length) list.push({ id: 'simulation', label: SIDE_NAME.simulation, values: sim.values, x: sim.xv, mode: 'points', size: 9, color: COLORS.simulation });
  if (stopped.values.length) list.push({ id: 'simulation-stopped', label: { en: 'Particle simulation, product before the stop', es: 'Simulación de partículas, producto antes de la detención' }, values: stopped.values, x: stopped.xv, mode: 'points', size: 9, color: COLORS.stopped });
  if (pb.values.length) list.push({ id: 'population-balance', label: SIDE_NAME.population_balance, values: pb.values, x: pb.xv, mode: 'points', size: 9, color: COLORS.population_balance });
  // the paper's own simulation, where the point has it: its own mark and its own legend entry, two steps left of the measurement
  const paperRows = pts.filter((p) => p.paper !== null);
  if (paperRows.length) list.push({ id: 'paper', label: { en: 'The paper’s own simulation', es: 'La simulación propia del artículo' }, values: paperRows.map((p) => p.paper!.value), x: paperRows.map((p) => p.c - 2 * CATEGORY.dx), mode: 'points', size: 9, color: COLORS.paper });
  // a side with no value has no mark in the plot: its legend entry has no values, and the text "no value" stands at its feed class under the axis
  const anyMissing = pts.some((p) => (['simulation', 'population_balance'] as const).some((side) => p[side].value === null && p[side].reason !== null));
  if (anyMissing) list.push({ id: 'no-value', label: { en: 'No value (said under the tick labels, reason in the note)', es: 'Sin valor (dicho bajo las marcas del eje, motivo en la nota)' }, values: pts.map(() => null), mode: 'points', size: 6, color: '--color-fg-faint' });
  // the sides that state no value are said in words as the axis's own note, directly under the tick labels and above the key
  const axisNote = noValueNote(series, num);
  const ticks = pts.map((p) => ({ value: p.c, label: { en: `${feedClassText(p.feedClass, num)} mm`, es: `${feedClassText(p.feedClass, num)} mm` } as BiText }));
  const name = pick(series.name, lang);
  const unit = pick(series.unit, lang);
  const bandPct = num(series.points[0].band * 100, { digits: 2 });
  return (
    <ChartCallouts callouts={[]} points={[]} frame={{ x: xRange, y: [0, yMax] }} overlay={(at) => <ComparisonOverlay series={series} at={at} />}>
      <UPlotChart
        title={{ en: `${series.name.en} by feed class`, es: `${series.name.es} por clase de alimentación` }}
        height="fill"
        x={{ values: xs, label: axisNote ?? { en: 'Feed class', es: 'Clase de alimentación' }, ticks, range: xRange }}
        y={{ label: series.name, unit: series.unit, range: [0, yMax], format: { digits: 3 } }}
        series={list}
        hint={READ_HINT}
        readout={(i) => `${feedClassText(pts[i].feedClass, num)} mm: ${name} ${pts[i].measurement.value === null ? '' : `${num(pts[i].measurement.value as number, { digits: 3 })} ${unit}`}, ${lang === 'es' ? 'banda' : 'band'} ${bandPct} %`}
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
  const noValues = series.points.flatMap((p) => (['simulation', 'population_balance'] as const).flatMap((side) => (p[side].value === null && p[side].reason ? [`${pick(SIDE_NAME[side], lang)}, ${feedClassText(p.feedClass, num)} mm: ${pick(p[side].reason as Text, lang)}`] : [])));
  const bandNote =
    q === 'p80'
      ? t(`Shaded: the band of the reduction ratio F80/P80 (${num(series.points[0].band * 100, { digits: 2 })} percent) written as a band on P80. Bars: the population balance’s P80 with ${SPREAD_NAME.en} (its classification parameters), a sensitivity band and not a confidence interval.`, `Sombreado: la banda de la razón de reducción F80/P80 (${num(series.points[0].band * 100, { digits: 2 })} por ciento) escrita como banda de P80. Barras: el P80 del balance poblacional con ${SPREAD_NAME.es} (sus parámetros de clasificación), una banda de sensibilidad y no un intervalo de confianza.`)
      : t(`Shaded: the measurement plus or minus the ${num(series.points[0].band * 100, { digits: 2 })} percent band. Bars: one standard error of the particle simulation over its steady window. The three sides of a feed class are drawn a little apart so none hides another.`, `Sombreado: la medición más o menos la banda de ${num(series.points[0].band * 100, { digits: 2 })} por ciento. Barras: un error estándar de la simulación de partículas sobre su ventana estacionaria. Los tres lados de una clase de alimentación se dibujan algo separados para que ninguno oculte a otro.`);
  const paperNote = series.points.some((p) => p.paper !== null) ? t('Magenta mark: the paper’s own simulation, as context only; no verdict rests on it.', 'Marca magenta: la simulación propia del artículo, solo como contexto; ningún veredicto se apoya en ella.') : null;
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
        {paperNote && (
          <p className="caos-plot-note" data-paper-note="">
            {paperNote}
          </p>
        )}
        {noValues.length > 0 && (
          <p className="caos-plot-note" data-no-value-reasons="">
            {t('No value (said under the tick labels): ', 'Sin valor (dicho bajo las marcas del eje): ')}
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
  const feed = feedClassText(point.feed_class, num);
  const d = distributionOf(run, point);
  const stopped = d.simulationStopped;
  const a = finalAttempt(point.simulation);
  const list: ChartSeries[] = [
    { id: 'measured', label: { en: 'Measured sieves', es: 'Tamices medidos' }, values: d.measured.passing, x: d.measured.sieves, mode: 'points', size: 9, color: '--color-fg' },
    {
      id: 'simulation',
      label: stopped ? { en: `Particle simulation, product of the ${num(a.mass_passed_kg, { digits: 3 })} kg passed before the stop`, es: `Simulación de partículas, producto de los ${num(a.mass_passed_kg, { digits: 3 })} kg pasados antes de la detención` } : SIDE_NAME.simulation,
      values: d.simulation,
      color: stopped ? '--color-fg-subtle' : '--color-accent',
      dash: stopped ? [6, 3] : undefined,
      width: 2.2,
    },
    { id: 'pb', label: SIDE_NAME.population_balance, values: d.populationBalance, color: '--color-accent-2', width: 2.2 },
    { id: 'pb-low', label: { en: 'Population balance, low end of the spread', es: 'Balance poblacional, extremo bajo de la dispersión' }, values: d.populationBalanceLow, color: '--color-accent-2', dash: [4, 3], width: 1.2 },
    { id: 'pb-high', label: { en: 'Population balance, high end of the spread', es: 'Balance poblacional, extremo alto de la dispersión' }, values: d.populationBalanceHigh, color: '--color-accent-2', dash: [4, 3], width: 1.2 },
  ];
  const marks = [
    { x: d.css_mm, label: { en: `closed ${num(d.css_mm, { digits: 3 })}`, es: `cerrada ${num(d.css_mm, { digits: 3 })}` } },
    { x: d.oss_mm, label: { en: `open ${num(d.oss_mm, { digits: 3 })}`, es: `abierta ${num(d.oss_mm, { digits: 3 })}` } },
  ];
  const note: BiText = {
    en: `Cumulative passing against size, ${feed} mm feed; the marks are the closed and the open side setting in mm. ${stopped ? `The particle run did not complete: its curve is the product of the mass passed before the stop. ` : ''}The particle simulation states no passing below its smallest sphere (${num(run.settings.minimum_sphere_mm, { digits: 2 })} mm), so its curve starts there. Dashed: the population balance with ${SPREAD_NAME.en} (its classification parameters).`,
    es: `Pasante acumulado contra tamaño, alimentación de ${feed} mm; las marcas son la abertura cerrada y la abierta en mm. ${stopped ? 'La corrida de partículas no se completó: su curva es el producto de la masa pasada antes de la detención. ' : ''}La simulación de partículas no entrega pasante bajo su esfera más pequeña (${num(run.settings.minimum_sphere_mm, { digits: 2 })} mm), así que su curva parte ahí. Segmentadas: el balance poblacional con ${SPREAD_NAME.es} (sus parámetros de clasificación).`,
  };
  return (
    <PlotCard title={{ en: `Product size distribution, ${feed} mm feed`, es: `Distribución de tamaños del producto, alimentación de ${feed} mm` }} lane="replay" provenance="published" dataKey={stateKey} note={note}>
      <div className="cdem-distribution" data-distribution={point.id}>
        <UPlotChart
          title={{ en: 'Cumulative passing against size', es: 'Pasante acumulado contra tamaño' }}
          height="fill"
          x={{ values: d.sieves, label: { en: 'Size', es: 'Tamaño' }, unit: { en: 'mm', es: 'mm' }, log: true, range: [0.8, 80] }}
          y={{ label: { en: 'Cumulative passing', es: 'Pasante acumulado' }, unit: { en: '%', es: '%' }, range: [0, 105], format: { digits: 3 } }}
          series={list}
          marks={marks}
          hint={READ_HINT}
        />
      </div>
    </PlotCard>
  );
}

/** The verdict table of a point: the summary of the document's counts is a paragraph outside the table, the verdict follows the quantity, the basis is a line under the verdict, and on a phone each quantity is a block. */
export function VerdictTable({ run, point }: { run: DemRun; point: DemPoint }) {
  const lang = useShellLang();
  const num = useNum();
  const t = useT();
  const rows = verdictRows(point);
  const fmt = (q: (typeof QUANTITIES)[number], v: number | null) => (v === null ? t('no value', 'sin valor') : `${num(v, { decimals: QUANTITY_DECIMALS[q] })}${q === 'reduction_ratio' ? '' : ` ${pick(QUANTITY_UNIT[q], lang)}`}`);
  const feed = feedClassText(point.feed_class, num);
  const head = [t('Comparison', 'Comparación'), t('Quantity', 'Cantidad'), t('Verdict', 'Veredicto'), t('First', 'Primero'), t('Second', 'Segundo'), t('Relative error', 'Error relativo'), t('Band', 'Banda'), t('Resolved', 'Resuelto')];
  return (
    <div data-verdict-table={point.id} className="cdem-vt">
      <p className="cdem-vt-summary" data-verdict-summary="">
        {t(`Verdicts of the ${feed} mm point. `, `Veredictos del punto de ${feed} mm. `)}
        {pick(verdictSummary(run), lang)}
      </p>
      <div className="cdem-tablewrap">
        <table className="caos-table" data-state="ready">
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.pair}-${r.quantity}`} data-pair={r.pair} data-quantity={r.quantity} data-verdict={r.state}>
                {i % QUANTITIES.length === 0 && (
                  <th scope="rowgroup" rowSpan={QUANTITIES.length} className="cdem-vt-pair">
                    {pick(pairTitle(r.pair), lang)}
                  </th>
                )}
                <td data-label={head[1]} className="cdem-vt-qty">{pick(QUANTITY_NAME[r.quantity], lang)}</td>
                <td data-label={head[2]} className="cdem-vt-verdict">
                  <span aria-hidden="true">{VERDICT_MARK[r.state]} </span>
                  {pick(verdictWord(r.state), lang)}
                  {r.basis && <div className="cdem-basis">{pick(r.basis, lang)}</div>}
                </td>
                <td data-label={head[3]}>{fmt(r.quantity, r.first)}</td>
                <td data-label={head[4]}>{fmt(r.quantity, r.second)}</td>
                <td data-label={head[5]}>{r.relativeError === null ? t('none', 'ninguno') : `${signedPct(r.relativeError, (v) => num(v, { decimals: 1 }))} %`}</td>
                <td data-label={head[6]}>{`±${num(r.band * 100, { digits: 2 })} %`}</td>
                <td data-label={head[7]}>{r.resolved === null ? t('not applicable', 'no aplica') : r.resolved ? t('yes', 'sí') : t('no', 'no')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VerdictCard({ run, point }: { run: DemRun; point: DemPoint }) {
  const num = useNum();
  const stateKey = useWorkbenchState()?.stateKey;
  const feed = feedClassText(point.feed_class, num);
  return (
    <PlotCard title={{ en: `Verdicts, ${feed} mm feed`, es: `Veredictos, alimentación de ${feed} mm` }} lane="replay" provenance="published" dataKey={stateKey} note={hasPaperSimulation(run) ? VERDICT_SCOPE : undefined}>
      <VerdictTable run={run} point={point} />
    </PlotCard>
  );
}

/** The sources of the measured values, the package and its seed, and what the bands are and when they were set; the document's own words are quoted in English, verbatim. */
export function Sources({ run, point }: { run: DemRun; point: DemPoint }) {
  const t = useT();
  const num = useNum();
  const stateKey = useWorkbenchState()?.stateKey;
  const m = point.measured;
  const ps = paperSimulation(point);
  const row = (term: string, def: ReactNode) => (
    <div className="cdem-source">
      <dt>{term}</dt>
      <dd>{def}</dd>
    </div>
  );
  const diff = (f: number) => `${num(Math.abs(f) * 100, { digits: 3 })} ${t('percent', 'por ciento')} ${f < 0 ? t('below', 'por debajo del') : f > 0 ? t('above', 'por encima del') : t('at', 'igual al')} ${t('the measured value', 'valor medido')}`;
  const paperPart = (label: string, unit: string, v: { value: number; source: string; relativeToMeasured: number | null } | null) =>
    v && v.relativeToMeasured !== null ? (
      <span key={label}>
        {label} {num(v.value, { digits: 3 })} {unit} (<Q>{v.source}</Q>), {diff(v.relativeToMeasured)}.{' '}
      </span>
    ) : null;
  return (
    <PlotCard title={{ en: 'Sources, package, seed and bands', es: 'Fuentes, paquete, semilla y bandas' }} lane="replay" provenance="published" dataKey={stateKey} note={{ en: 'The quoted texts are the document’s own words, in English, verbatim.', es: 'Los textos entre comillas son las palabras del propio documento, en inglés y sin cambios.' }}>
      <dl className="cdem-sources" data-sources="">
        {row(
          t('Measured throughput', 'Capacidad medida'),
          <>
            {num(m.throughput_kg_h.value, { digits: 4 })} kg/h ({t('digitisation noise', 'ruido de digitalización')} {num(m.throughput_kg_h.digitisation_noise, { digits: 2 })} kg/h): <Q>{m.throughput_kg_h.source}</Q>
          </>,
        )}
        {row(
          t('Measured net power', 'Potencia neta medida'),
          <>
            {num(m.net_power_kw.value, { digits: 3 })} kW: <Q>{m.net_power_kw.source}</Q>
          </>,
        )}
        {row(t('Measured product', 'Producto medido'), <Q>{m.product_source}</Q>)}
        {row(
          t('Paper', 'Artículo'),
          <>
            <Q>{run.source.paper}</Q>; DOI {run.source.doi}; <Q>{run.source.license}</Q>
          </>,
        )}
        {row(t('Digitisation', 'Digitalización'), <Q>{run.source.digitised}</Q>)}
        {row(
          t('Machine', 'Máquina'),
          <>
            <Q>{run.machine.name}</Q>: <Q>{run.machine.source}</Q>
          </>,
        )}
        {ps &&
          row(
            t('The paper’s own simulation', 'La simulación propia del artículo'),
            <>
              {paperPart(t('net power', 'potencia neta'), 'kW', ps.netPower)}
              {paperPart(t('throughput', 'capacidad'), 'kg/h', ps.throughput)}
            </>,
          )}
        {row(t('Particle simulation', 'Simulación de partículas'), <span translate="no">{`${run.package.name} ${run.package.version} (${run.package.backend}); ${t('seed', 'semilla')} ${run.seed}`}</span>)}
        {row(
          t('Ore', 'Mineral'),
          <>
            <Q>{run.ore.name}</Q>; <Q>{run.ore.derivation}</Q>
          </>,
        )}
        {row(t('Population balance', 'Balance poblacional'), <Q>{`${run.preset.capacity_model} ${run.preset.first_estimate_source} ${run.preset.ranges_source} ${run.preset.power}`}</Q>)}
        {row(
          t('Bands', 'Bandas'),
          <>
            {t('throughput', 'capacidad')} {num(run.bands.throughput_relative * 100, { digits: 2 })} %, {t('net power', 'potencia neta')} {num(run.bands.net_power_relative * 100, { digits: 2 })} %, {t('reduction ratio', 'razón de reducción')} {num(run.bands.reduction_ratio_relative * 100, { digits: 2 })} %: <Q>{run.bands.set}</Q>
          </>,
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

/** The loaded document: the stage with the operating point choice, the per-stroke series, the comparison, the distribution, the verdicts and the sources. */
export function DemBody({ run, readiness, frames, initialPoint, initialCursor, reducedMotion }: DemBodyProps) {
  const { index } = useView();
  const lang = useShellLang();
  const [pointId, setPointId] = useState(initialPoint ?? run.points[0].id);
  const [speed, setSpeed] = useState<number>(DEFAULT_SPEED);
  // how much of the view is shown: 3 is all of it; a change of point sets 0 and the staged transition brings the stage, the series, then the rest
  const [step, setStep] = useState(3);
  const transition = useRef<AbortController | null>(null);
  const changed = useRef(false);
  const point = run.points.find((p) => p.id === pointId) ?? run.points[0];
  const replay = point.simulation.replay;
  const loaded = useArtifact<DemFrames>((signal) => (index && replay ? loadDemFrames(index, replay, signal) : new Promise<DemFrames>(() => undefined)), [index, replay?.file]);
  const shown: Loaded<DemFrames> = frames ?? loaded;
  const view = viewState(readiness ?? null, ['dem-run']);
  const [panelRef] = usePanelHeight();
  useEffect(() => {
    if (!changed.current) return;
    transition.current?.abort();
    const ctl = new AbortController();
    transition.current = ctl;
    void runStagedTransition(pointStages(setStep), { reducedMotion: reducedMotion ?? prefersReducedMotion(), signal: ctl.signal });
    return () => ctl.abort();
  }, [pointId, reducedMotion]);
  const choosePoint = (id: string) => {
    if (id === pointId) return;
    changed.current = true;
    setStep(0);
    setPointId(id);
  };
  const on = (n: number) => (step >= n ? 'true' : 'false');
  const opening = initialCursor !== undefined && point.id === (initialPoint ?? run.points[0].id) ? initialCursor : openingCursor(point);
  return (
    <div ref={panelRef} className="cdem-dem" data-state="ready" data-point={point.id} data-run-state={run.state} data-incomplete={run.incomplete.join(',')}>
      <LinkedViewProvider key={point.id} initial={{ cursor: opening }}>
        <Linked point={point}>
          {(cursor, scrub) => (
            <>
              <div className="cdem-dem-main cdem-reveal" data-on={on(1)}>
                <MainRow
                  run={run}
                  point={point}
                  frames={shown}
                  speed={speed}
                  onSpeed={setSpeed}
                  reducedMotion={reducedMotion}
                  cursor={cursor}
                  choice={<PointChoice run={run} pointId={point.id} onPick={choosePoint} />}
                />
              </div>
              <div className="cdem-dem-rest cdem-reveal" data-on={on(2)}>
                <AfterStage run={run} point={point} readiness={readiness !== undefined ? <NoteLine view={view} lang={lang} /> : null} />
                <LabNote run={run} />
                {cursor !== null && <SeriesCard point={point} cursor={cursor} onPick={(stroke) => scrub(cursorOfStrokeIndex(point.simulation, point.simulation.series.stroke.indexOf(stroke)) ?? stroke)} />}
              </div>
            </>
          )}
        </Linked>
      </LinkedViewProvider>
      <div className="cdem-dem-rest cdem-reveal" data-on={on(3)}>
        <ViewsRow>
          {CHART_QUANTITIES.map((q) => (
            <ComparisonCard key={q} run={run} q={q} pointId={point.id} />
          ))}
        </ViewsRow>
        <DistributionCard run={run} point={point} />
        <VerdictCard run={run} point={point} />
        <Sources run={run} point={point} />
      </div>
    </div>
  );
}

/** The row's reason without the path the loader prefixes it with, so the sentence reads once: "dem/jaw-lab.json is not available yet: the bake was not run." becomes "the bake was not run". */
export function bareReason(reason: Text, lang: 'en' | 'es'): string {
  return reason[lang].replace(/^\S+\s+(?:is not available yet|aún no está disponible):\s*/i, '');
}

/** A document that is not in this build: the reader's reason, with nothing drawn. */
export function DemUnavailable({ reason }: { reason: Text }) {
  const lang = useShellLang();
  const t = useT();
  return (
    <div className="cdem-dem" data-state="unavailable-wrap">
      <p className="caos-pending" data-state="unavailable">
        {t('The particle simulation of the laboratory jaw crusher is not available yet: ', 'La simulación de partículas de la chancadora de mandíbula del laboratorio aún no está disponible: ')}
        {bareReason(reason, lang)}
      </p>
    </div>
  );
}

/** A document that could not be read: one sentence in the reader's language, with the cause quoted. */
export function DemUnreadable({ error }: { error: string }) {
  const t = useT();
  return (
    <p className="caos-pending" role="alert" data-state="unavailable">
      {t('The particle simulation of the laboratory jaw crusher could not be read from this build. Cause: ', 'No se pudo leer la simulación de partículas de la chancadora de mandíbula del laboratorio en esta versión. Causa: ')}
      <Q>{error.replace(/^Error:\s*/, '')}</Q>
    </p>
  );
}

/** The App's view: reads the document through the index and the readiness, and says why when it cannot. */
export function DemView() {
  const { index } = useView();
  const lang = useShellLang();
  const readiness = useReadiness();
  const doc = useArtifact<DemRun>((signal) => (index ? loadDemRun(index, signal) : new Promise<DemRun>(() => undefined)), [index]);
  if (doc.state === 'unavailable') return <DemUnavailable reason={doc.reason} />;
  if (doc.state === 'error') return <DemUnreadable error={doc.error} />;
  if (doc.state !== 'ready')
    return (
      <p className="caos-pending" data-state="loading">
        {lang === 'es' ? 'Cargando la simulación de partículas' : 'Loading the particle simulation'}
      </p>
    );
  return <DemBody run={doc.data} readiness={readiness} />;
}
