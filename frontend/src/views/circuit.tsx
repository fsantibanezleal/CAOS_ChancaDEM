// Catalog row V1, the system: the three-stage crushing circuit as a 2D flowsheet (primary gyratory or jaw, secondary cone, tertiary cone
// or short-head), each stage named by its machine, the selected case's stage active with its feed and product streams labelled
// (t/h, F80, P80, kW, closed-side setting) from the case's manifest and committed trace (a real survey's measured values where the
// manifest has them), the other stages dimmed and selectable: a stage loads the first case of that stage (SH-002). The flow along the
// streams is a dash pattern moving at a speed proportional to the case's throughput, a CSS animation with no animation frame of its
// own; under reduced motion it stops and the arrowheads show the direction (SH-003). The plant layout is not drawn: the product models
// one machine per case, so the flowsheet is the context the machine sits in (plan decision D-2).
import { PlotCard, pick, prefersReducedMotion, useLinkedItem, useShellLang, useWorkbenchState, type BiText } from '@fasl-work/caos-app-shell';
import { useEffect, useState, type ReactNode } from 'react';
import { loadManifest, useArtifact } from '../api/artifacts';
import type { Machine } from '../engine/types';
import type { CaseIndex, CaseManifest, Text, Trace } from '../lib/contract.types';
import { CalloutStage, type CalloutSpec, type Subject } from './callouts';
import { Labels, LabelText, TOKEN } from './draw';
import { linkedId } from './linked';
import { bare, Pending, provenanceOf, useNum, useT, useView } from './shared';

export type StageId = 'primary' | 'secondary' | 'tertiary';
export const STAGES: readonly StageId[] = ['primary', 'secondary', 'tertiary'];

export const STAGE_NAME: Record<StageId, Text> = {
  primary: { en: 'Primary crushing', es: 'Chancado primario' },
  secondary: { en: 'Secondary crushing', es: 'Chancado secundario' },
  tertiary: { en: 'Tertiary crushing', es: 'Chancado terciario' },
};

export const MACHINE_NAME: Record<Machine, Text> = {
  'cone-sec': { en: 'Secondary cone', es: 'Cono secundario' },
  'cone-tert': { en: 'Tertiary cone', es: 'Cono terciario' },
  'cone-short-head': { en: 'Short-head cone', es: 'Cono de cabeza corta' },
  gyratory: { en: 'Gyratory', es: 'Giratoria' },
  jaw: { en: 'Jaw', es: 'Mandíbula' },
};

/** The machines each stage of the circuit runs (the case matrix spans them). */
export const STAGE_MACHINES: Record<StageId, Machine[]> = {
  primary: ['gyratory', 'jaw'],
  secondary: ['cone-sec'],
  tertiary: ['cone-tert', 'cone-short-head'],
};

/** The stage a machine sits in. */
export function stageOfMachine(machine: Machine): StageId {
  return (STAGES.find((s) => STAGE_MACHINES[s].includes(machine)) ?? 'secondary') as StageId;
}

/** A case of the index with the stage and machine its manifest declares (the index itself carries neither). */
export interface StagedCase {
  caseId: string;
  stage: string;
  machine: Machine;
}

/**
 * The case a stage loads: the first case of the index whose manifest puts it in that stage on one of the stage's machines. A control
 * case is never picked (it is a check of the engine, not a stage of a circuit), and a stage with no such case is refused (null), never
 * answered with a case of another stage.
 */
export function caseForStage(stage: StageId, cases: readonly StagedCase[]): string | null {
  const hit = cases.find((c) => c.stage === stage && STAGE_MACHINES[stage].includes(c.machine));
  return hit ? hit.caseId : null;
}

/** The manifests of every case of the index, read once, as staged cases. */
export function useStagedCases(index: CaseIndex | null) {
  return useArtifact<StagedCase[]>(
    async (signal) => {
      if (!index) return new Promise<StagedCase[]>(() => undefined);
      const rows = await Promise.all(
        index.cases.map((c) =>
          loadManifest(c.case_id, signal).then(
            (m): StagedCase => ({ caseId: m.case_id, stage: String(m.stage), machine: m.params.machine as Machine }),
            () => null,
          ),
        ),
      );
      return rows.filter((r): r is StagedCase => r !== null);
    },
    [index],
  );
}

export type StreamId = 'feed' | 'product' | 'power' | 'css';

export interface StreamValue {
  id: StreamId;
  label: Text;
  value: number | null;
  unit: string;
  source: Text;
  /** Why the value is missing (the trace the readiness lists as absent). */
  missing?: Text;
}

export interface CircuitValues {
  stage: StageId;
  machine: Machine;
  real: boolean;
  feedTph: StreamValue;
  f80: StreamValue;
  p80: StreamValue;
  power: StreamValue;
  css: StreamValue;
}

/**
 * The values the flowsheet writes on the active stage, each read from its document: a real survey's measured throughput, F80, power and
 * setting from its manifest; every other value from the committed trace of the case (the engine at the manifest's point); the setting
 * of a synthetic case from its manifest. P80 is never measured (the surveys' gradations are figure-only), so it is the trace's.
 */
export function circuitValues(manifest: CaseManifest, trace: Trace | null, traceReason: Text | null): CircuitValues {
  const machine = manifest.params.machine as Machine;
  const measured = manifest.measured ?? null;
  const survey = measured ? measured.survey : null;
  const fromSurvey: Text = { en: `Survey ${survey} of Rocha et al. 2024, measured`, es: `Muestreo ${survey} de Rocha et al. 2024, medido` };
  const fromTrace: Text = { en: `Committed trace of ${manifest.case_id}, the engine at the case's point`, es: `Traza comprometida de ${manifest.case_id}, el motor en el punto del caso` };
  const fromManifest: Text = { en: `Manifest of ${manifest.case_id}`, es: `Manifiesto de ${manifest.case_id}` };
  const missing: Text = traceReason ?? { en: 'the committed trace of this case is not in this build', es: 'la traza comprometida de este caso no está en esta versión' };
  const s = trace?.summary ?? null;
  const fromT = (id: StreamId, label: Text, v: number | undefined, unit: string): StreamValue =>
    s ? { id, label, value: v ?? null, unit, source: fromTrace } : { id, label, value: null, unit, source: fromTrace, missing };
  const labels = {
    feed: { en: 'Feed', es: 'Alimentación' },
    f80: { en: 'Feed F80', es: 'F80 de la alimentación' },
    p80: { en: 'Product P80', es: 'P80 del producto' },
    power: { en: 'Power', es: 'Potencia' },
    css: { en: 'Closed-side setting', es: 'Abertura de descarga' },
  } satisfies Record<string, Text>;
  return {
    stage: stageOfMachine(machine),
    machine,
    real: !!measured,
    feedTph: measured ? { id: 'feed', label: labels.feed, value: measured.feed_tph, unit: 't/h', source: fromSurvey } : fromT('feed', labels.feed, s?.throughput_tph, 't/h'),
    // a real survey's F80 is the measured one, named so; the engine's feed F80 (reconstructed from it) is the model's, on the other views
    f80: measured ? { id: 'feed', label: { en: 'Measured feed F80', es: 'F80 medido de la alimentación' }, value: measured.f80_mm, unit: 'mm', source: fromSurvey } : fromT('feed', labels.f80, s?.f80_mm, 'mm'),
    p80: fromT('product', labels.p80, s?.p80_mm, 'mm'),
    power: measured ? { id: 'power', label: labels.power, value: measured.power_kw, unit: 'kW', source: fromSurvey } : fromT('power', labels.power, s?.power_kw, 'kW'),
    css: measured
      ? { id: 'css', label: labels.css, value: measured.css_mm, unit: 'mm', source: fromSurvey }
      : { id: 'css', label: labels.css, value: manifest.params.css_mm, unit: 'mm', source: fromManifest },
  };
}

/** The speed of the flow along a stream [px/s]: proportional to the throughput, so twice the tonnage moves twice as fast. */
export const FLOW_PX_PER_S_PER_TPH = 0.025;
/** One period of the dash pattern [px]: the animation moves the pattern by one period per cycle. */
export const FLOW_PERIOD_PX = 24;

/** The duration of one cycle of the flow [s] for a throughput, or null (no flow drawn moving) at a missing or non-positive tonnage. */
export function flowCycleSeconds(tph: number | null): number | null {
  if (tph === null || !Number.isFinite(tph) || tph <= 0) return null;
  return FLOW_PERIOD_PX / (FLOW_PX_PER_S_PER_TPH * tph);
}

/** A duration in seconds as CSS reads it: four decimals, never an exponent or a locale's comma. */
export const cssSeconds = (s: number): string => String(Math.round(s * 1e4) / 1e4);

/** Whether the reader prefers reduced motion, kept in step with the system setting. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => prefersReducedMotion());
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

interface Box {
  stage: StageId;
  x: number;
  y: number;
  w: number;
  h: number;
}

function StageNode({ box, active, machine, onPick, lang, extra }: { box: Box; active: boolean; machine: Text | null; onPick: (() => void) | null; lang: 'en' | 'es'; extra: string | null }) {
  const item = useLinkedItem(linkedId('stage', box.stage), 'scene');
  const title = STAGE_NAME[box.stage][lang];
  const name = machine ? machine[lang] : lang === 'es' ? 'sin caso' : 'no case';
  const pick = () => {
    item.onClick();
    onPick?.();
  };
  return (
    <g
      className="cdem-stage-node"
      role="button"
      tabIndex={0}
      aria-label={`${title}: ${name}${active ? (lang === 'es' ? ', etapa activa' : ', active stage') : ''}`}
      data-linked-id={item['data-linked-id']}
      data-linked-view={item['data-linked-view']}
      data-linked-selected={item['data-linked-selected']}
      aria-pressed={item['aria-pressed']}
      data-stage={box.stage}
      data-active={active ? 'true' : 'false'}
      opacity={active ? 1 : 0.55}
      onClick={pick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick();
        }
      }}
    >
      <title>{`${title}: ${name}${extra ? `, ${extra}` : ''}`}</title>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={10} fill={TOKEN.surface} stroke={active ? TOKEN.accent : TOKEN.border} strokeWidth={active ? 3 : 1.5} />
      {item['data-linked-selected'] === 'true' && (
        <rect x={box.x - 4} y={box.y - 4} width={box.w + 8} height={box.h + 8} rx={12} fill="none" stroke={TOKEN.accent} strokeWidth={1.5} strokeDasharray="4 3" />
      )}
    </g>
  );
}

/** A stream of another stage: drawn for the circuit's context, with no values in this case and nothing to select. */
function IdleStream({ d, label }: { d: string; label: string }) {
  return (
    <g data-flow="static" opacity={0.5}>
      <title>{label}</title>
      <path d={d} fill="none" stroke={TOKEN.subtle} strokeWidth={3} markerEnd="url(#cdem-arrow)" />
    </g>
  );
}

function StreamPath({ id, d, label, cycle, reduced }: { id: string; d: string; label: string; cycle: number | null; reduced: boolean }) {
  const item = useLinkedItem(linkedId('stream', id), 'scene');
  const moving = cycle !== null && !reduced;
  const selected = item['data-linked-selected'] === 'true';
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      data-linked-id={item['data-linked-id']}
      data-linked-view={item['data-linked-view']}
      data-linked-selected={item['data-linked-selected']}
      aria-pressed={item['aria-pressed']}
      data-flow={moving ? 'moving' : 'static'}
      data-flow-cycle={moving ? cssSeconds(cycle!) : ''}
      onClick={item.onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.onClick();
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      <title>{label}</title>
      <path d={d} fill="none" stroke={selected ? TOKEN.accent : TOKEN.subtle} strokeWidth={selected ? 5 : 3.5} markerEnd="url(#cdem-arrow)" />
      <path
        d={d}
        fill="none"
        stroke={TOKEN.accent}
        strokeWidth={2}
        strokeDasharray="12 12"
        className={moving ? 'cdem-stream-flow' : undefined}
        style={moving ? { animationDuration: `${cssSeconds(cycle!)}s` } : undefined}
        opacity={0.85}
        aria-hidden="true"
      />
      <path d={d} fill="none" stroke="transparent" strokeWidth={16} />
    </g>
  );
}

export interface CircuitProps {
  values: CircuitValues | null;
  /** The machine named on each stage: the active case's on its stage, else the machine of the case the stage would load. */
  stageMachines: Partial<Record<StageId, Machine>>;
  onPickStage: ((stage: StageId) => void) | null;
  label: BiText;
}

/** The three callouts of the circuit: the feed throughput, the product P80 and the power draw, each with its document as its source. */
export function circuitCallouts(values: CircuitValues, num: (v: number, o: { digits?: number; decimals?: number }) => string): CalloutSpec[] {
  // a callout card holds one short line of source: the document, without the clause the stream table spells out
  const short = (t: { en: string; es: string }) => ({ en: t.en.split(',')[0], es: t.es.split(',')[0] });
  const fmt = (v: StreamValue, o: { digits?: number; decimals?: number }) => (v.value === null ? null : num(v.value, o));
  const [feed, product, power]: CalloutSpec[] = [
    {
      id: 'feed',
      eyebrow: { en: 'FEED', es: 'ALIMENTO' },
      value: fmt(values.feedTph, { digits: 4 }),
      unit: { en: 't/h', es: 't/h' },
      state: 'normal',
      source: short(values.feedTph.source),
      missing: values.feedTph.missing,
    },
    {
      id: 'product',
      eyebrow: { en: 'PRODUCT P80', es: 'P80 PRODUCTO' },
      value: fmt(values.p80, { digits: 3 }),
      unit: { en: 'mm', es: 'mm' },
      state: 'selected',
      source: short(values.p80.source),
      missing: values.p80.missing,
    },
    {
      id: 'power',
      eyebrow: { en: 'POWER DRAW', es: 'POTENCIA' },
      value: fmt(values.power, { digits: 3 }),
      unit: { en: 'kW', es: 'kW' },
      state: 'normal',
      source: short(values.power.source),
      missing: values.power.missing,
    },
  ];
  // left to right as their subjects stand: the feed stream, the machine, the product stream
  return [feed, power, product];
}

/** The flowsheet itself, with its three callouts (throughput, P80, power) anchored on the streams and the machine. */
export function CircuitDrawing({ values, stageMachines, onPickStage, label }: CircuitProps) {
  const lang = useShellLang();
  const num = useNum();
  const reduced = useReducedMotion();
  const callouts: CalloutSpec[] = values ? circuitCallouts(values, (v, o) => num(v, o)) : [];
  return <CalloutStage label={label} callouts={callouts} draw={({ width, height }) => drawCircuit({ values, stageMachines, onPickStage, label, width, height, lang, num, reduced })} />;
}

/**
 * The flowsheet's SVG for a box, and where its callouts' subjects are. Exported so a test reads the drawing a reader sees: the machine
 * named on every stage, the values on the active stage's streams, and the flow moving (or, under reduced motion, still).
 */
export function drawCircuit({
  values,
  stageMachines,
  onPickStage,
  label,
  width,
  height,
  lang,
  num,
  reduced,
}: CircuitProps & { width: number; height: number; lang: 'en' | 'es'; num: (v: number, o: { digits?: number; decimals?: number }) => string; reduced: boolean }): {
  node: ReactNode;
  subjects: Subject[];
} {
  const fmt = (v: StreamValue, o: { digits?: number; decimals?: number }) => (v.value === null ? null : num(v.value, o));
  const cycle = values ? flowCycleSeconds(values.feedTph.value) : null;
  const vertical = width < 560;
  const L = new Labels(width, height);
  const boxes: Box[] = STAGES.map((stage, i) => {
    if (vertical) {
      const h = Math.max(46, Math.min(84, height * 0.16));
      const w = Math.max(120, Math.min(200, width * 0.46));
      return { stage, x: width * 0.08, y: height * (0.14 + i * 0.31) - h / 2 + h / 2, w, h };
    }
    const w = Math.max(110, Math.min(210, width * 0.2));
    const h = Math.max(64, Math.min(170, height * 0.42));
    return { stage, x: width * (0.18 + i * 0.32) - w / 2, y: height * 0.5 - h / 2, w, h };
  });
  const mid = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const streamD: string[] = [];
  const ends: { a: { x: number; y: number }; b: { x: number; y: number } }[] = [];
  if (vertical) {
    const x = boxes[0].x + boxes[0].w / 2;
    ends.push({ a: { x, y: 4 }, b: { x, y: boxes[0].y - 2 } });
    for (let i = 0; i < 2; i++) ends.push({ a: { x, y: boxes[i].y + boxes[i].h + 2 }, b: { x, y: boxes[i + 1].y - 2 } });
    ends.push({ a: { x, y: boxes[2].y + boxes[2].h + 2 }, b: { x, y: height - 4 } });
  } else {
    const y = height * 0.5;
    ends.push({ a: { x: 4, y }, b: { x: boxes[0].x - 2, y } });
    for (let i = 0; i < 2; i++) ends.push({ a: { x: boxes[i].x + boxes[i].w + 2, y }, b: { x: boxes[i + 1].x - 2, y } });
    ends.push({ a: { x: boxes[2].x + boxes[2].w + 2, y }, b: { x: width - 4, y } });
  }
  for (const e of ends) streamD.push(`M${e.a.x},${e.a.y} L${e.b.x},${e.b.y}`);
  const activeIdx = values ? STAGES.indexOf(values.stage) : -1;
  const feedEnd = activeIdx >= 0 ? ends[activeIdx] : ends[0];
  const prodEnd = activeIdx >= 0 ? ends[activeIdx + 1] : ends[3];
  const midOf = (e: (typeof ends)[number]) => ({ x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 });
  const subjects: Subject[] = [
    { id: 'feed', ...midOf(feedEnd) },
    { id: 'product', ...midOf(prodEnd) },
    { id: 'power', ...(activeIdx >= 0 ? { x: mid(boxes[activeIdx]).x, y: boxes[activeIdx].y + boxes[activeIdx].h * 0.82 } : mid(boxes[1])) },
  ];
  const labels = [];
  for (const b of boxes) {
    const m = mid(b);
    const machine = values && b.stage === values.stage ? values.machine : stageMachines[b.stage];
    labels.push(L.place(STAGE_NAME[b.stage][lang], m.x, b.y + 16, 'middle', { fill: TOKEN.subtle }));
    labels.push(L.place(machine ? MACHINE_NAME[machine][lang] : lang === 'es' ? 'sin caso' : 'no case', m.x, b.y + 34, 'middle', { fill: TOKEN.fg, weight: 700 }));
  }
  if (values && activeIdx >= 0) {
    const b = boxes[activeIdx];
    const m = mid(b);
    const css = fmt(values.css, { digits: 3 });
    labels.push(L.place(`CSS ${css ?? '-'} mm`, m.x, b.y + b.h - 10, 'middle', { fill: TOKEN.warn, weight: 600 }));
    const fe = midOf(feedEnd);
    const pe = midOf(prodEnd);
    const tph = fmt(values.feedTph, { digits: 4 });
    const f80 = fmt(values.f80, { digits: 3 });
    const p80 = fmt(values.p80, { digits: 3 });
    if (vertical) {
      labels.push(L.place(`${tph ?? '-'} t/h · F80 ${f80 ?? '-'} mm`, fe.x + 12, fe.y + 4, 'start', { fill: TOKEN.fg }));
      labels.push(L.place(`P80 ${p80 ?? '-'} mm`, pe.x + 12, pe.y + 4, 'start', { fill: TOKEN.fg }));
    } else {
      labels.push(L.place(`${tph ?? '-'} t/h`, fe.x, fe.y - 34, 'middle', { fill: TOKEN.fg }));
      labels.push(L.place(`F80 ${f80 ?? '-'} mm`, fe.x, fe.y - 18, 'middle', { fill: TOKEN.fg }));
      labels.push(L.place(`P80 ${p80 ?? '-'} mm`, pe.x, pe.y - 18, 'middle', { fill: TOKEN.fg }));
    }
  }
  const streamIds = ['feed', 'p1', 'p2', 'product'];
  const streamText = (i: number) => {
    if (!values) return '';
    if (i === activeIdx) return lang === 'es' ? `Alimentación de ${STAGE_NAME[values.stage].es.toLowerCase()}` : `Feed to ${STAGE_NAME[values.stage].en.toLowerCase()}`;
    if (i === activeIdx + 1) return lang === 'es' ? `Producto de ${STAGE_NAME[values.stage].es.toLowerCase()}` : `Product of ${STAGE_NAME[values.stage].en.toLowerCase()}`;
    return lang === 'es' ? 'Corriente de otra etapa (sin valores en este caso)' : 'Stream of another stage (no values in this case)';
  };
  const node = (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={pick(label, lang)} data-chart="circuit" data-vertical={vertical ? 'true' : 'false'}>
      <defs>
        <marker id="cdem-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={TOKEN.subtle} />
        </marker>
      </defs>
      {streamD.map((d, i) => {
        const id = i === activeIdx ? 'feed' : i === activeIdx + 1 ? 'product' : streamIds[i];
        if (i !== activeIdx && i !== activeIdx + 1) return <IdleStream key={`${streamIds[i]}-${i}`} d={d} label={streamText(i)} />;
        return <StreamPath key={`${id}-${i}`} id={id} d={d} label={streamText(i)} cycle={cycle} reduced={reduced} />;
      })}
      {boxes.map((b) => {
        const machine = values && b.stage === values.stage ? values.machine : (stageMachines[b.stage] ?? null);
        const active = !!values && b.stage === values.stage;
        return (
          <StageNode
            key={b.stage}
            box={b}
            active={active}
            machine={machine ? MACHINE_NAME[machine] : null}
            onPick={onPickStage && !active ? () => onPickStage(b.stage) : null}
            lang={lang}
            extra={
              active
                ? lang === 'es'
                  ? 'etapa del caso seleccionado'
                  : 'the selected case’s stage'
                : lang === 'es'
                  ? 'seleccione para cargar un caso de esta etapa'
                  : 'select to load a case of this stage'
            }
          />
        );
      })}
      <LabelText items={labels} />
    </svg>
  );
  return { node, subjects };
}

/** The streams of the active stage as a table the reader selects rows of (the panel side of the stream selection). */
export function StreamTable({ values }: { values: CircuitValues }) {
  const t = useT();
  const num = useNum();
  const lang = useShellLang();
  const rows: StreamValue[] = [values.feedTph, values.f80, values.p80, values.power, values.css];
  return (
    <div className="cdem-tablewrap">
      <table className="caos-table" data-state="ready" data-streams="">
        <thead>
          <tr>
            <th className="caos-col-text">{t('Stream', 'Corriente')}</th>
            <th>{t('Value', 'Valor')}</th>
            <th className="caos-col-text">{t('Source', 'Fuente')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <StreamRow
              key={`${r.id}-${r.label.en}`}
              row={r}
              linked={r.id === 'power' || r.id === 'css' ? linkedId('stage', values.stage) : linkedId('stream', r.id)}
              text={r.value === null ? t('not available', 'no disponible') : `${num(r.value, { digits: 4 })} ${r.unit}`}
              lang={lang}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A row of the stream table: a feed or product value selects its stream, the power and the setting select the machine's stage. */
function StreamRow({ row, linked, text, lang }: { row: StreamValue; linked: string; text: string; lang: 'en' | 'es' }) {
  const item = useLinkedItem(linked, 'panel');
  return (
    <tr data-stream-value={row.value === null ? '' : String(row.value)} data-stream-unit={row.unit}>
      <td className="caos-col-text">
        <button type="button" className="cdem-linkbtn" {...item}>
          {row.label[lang]}
        </button>
      </td>
      <td>{text}</td>
      <td className="caos-col-text" title={row.missing ? row.missing[lang] : row.source[lang]}>
        {row.missing ? `${lang === 'es' ? 'Aún no disponible' : 'Not available yet'}: ${bare(row.missing[lang])}` : row.source[lang]}
      </td>
    </tr>
  );
}

/** The App's view (System group, first view): the flowsheet over the stream table. */
export function CircuitView({ onPickCase }: { onPickCase: (caseId: string) => void }) {
  const { sel, index } = useView();
  const stateKey = useWorkbenchState()?.stateKey;
  const staged = useStagedCases(index);
  if (!sel) return <Pending />;
  const values = circuitValues(sel.data.manifest, sel.data.trace, sel.data.traceReason);
  const cases = staged.state === 'ready' ? staged.data : [];
  const stageMachines: Partial<Record<StageId, Machine>> = {};
  for (const s of STAGES) {
    const id = caseForStage(s, cases);
    const hit = cases.find((c) => c.caseId === id);
    if (hit) stageMachines[s] = hit.machine;
  }
  return (
    <PlotCard
      fill
      title={{ en: 'The crushing circuit', es: 'El circuito de chancado' }}
      lane="replay"
      provenance={provenanceOf(sel)}
      dataKey={stateKey}
      note={{
        en: 'The stage of the selected case is active, with the values of its manifest and committed trace (a real survey’s measured values where it has them); select another stage to load its first case. The flow moves at a speed proportional to the throughput, and stands still under reduced motion.',
        es: 'La etapa del caso seleccionado está activa, con los valores de su manifiesto y de su traza comprometida (los valores medidos de un muestreo real cuando los tiene); seleccione otra etapa para cargar su primer caso. El flujo se mueve a una velocidad proporcional a la capacidad, y se detiene con movimiento reducido.',
      }}
    >
      <div className="cdem-stack" data-caos-flow="">
        <div className="cdem-fill cdem-fill-tall">
          <CircuitDrawing
            values={values}
            stageMachines={stageMachines}
            label={{ en: 'Flowsheet of the three-stage crushing circuit', es: 'Diagrama de flujo del circuito de chancado de tres etapas' }}
            onPickStage={(stage) => {
              const id = caseForStage(stage, cases);
              if (id) onPickCase(id);
            }}
          />
        </div>
        <StreamTable values={values} />
      </div>
    </PlotCard>
  );
}
