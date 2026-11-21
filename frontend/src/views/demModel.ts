// The model of the particle-simulation view (catalog row dem-run; requirements DM-012 to DM-015): pure functions over the document
// `data/derived/dem/jaw-lab.json`, never over a number typed here. The view reads the document through them: the decoding of a
// point's replay, the stroke cursor and its frame, the three callouts of a point, the series of a quantity over the three points for
// the measurement, the particle simulation and the population balance, the sentence that says which side is nearer the measurement,
// the verdict rows with their basis, the words of a run's status and the colour class of a sphere. A null value is never turned into
// a number: a side that states no value carries the reason, and the view draws no mark for it. A verdict that is not `met` is never
// worded as agreement here, so no view can show it as one.
import type { DemRun, Text } from '../lib/contract.types';

export type Lang = 'en' | 'es';
export type Num = (v: number, o?: { digits?: number; decimals?: number }) => string;

export type DemPoint = DemRun['points'][number];
export type DemSimulation = DemPoint['simulation'];
export type DemReplay = NonNullable<DemSimulation['replay']>;
export type DemAttempt = DemSimulation['attempts'][number];
export type DemVerdictCell = DemPoint['verdicts']['simulation_vs_measured']['throughput'];
export type DemBasis = NonNullable<DemVerdictCell['basis']>;

export const QUANTITIES = ['throughput', 'net_power', 'reduction_ratio'] as const;
export type Quantity = (typeof QUANTITIES)[number];
export const PAIRS = ['simulation_vs_measured', 'population_balance_vs_measured', 'population_balance_vs_simulation'] as const;
export type PairKey = (typeof PAIRS)[number];
export const SIDES = ['measurement', 'simulation', 'population_balance'] as const;
export type Side = (typeof SIDES)[number];
/** The quantities of the comparison charts: the product P80 stands for the reduction ratio, whose band the document states (F80 over P80). */
export const CHART_QUANTITIES = ['throughput', 'net_power', 'p80'] as const;
export type ChartQuantity = (typeof CHART_QUANTITIES)[number];

/** The names of the three sides, in the reader's words. */
export const SIDE_NAME: Record<Side, Text> = {
  measurement: { en: 'measurement', es: 'medición' },
  simulation: { en: 'particle simulation', es: 'simulación de partículas' },
  population_balance: { en: 'population balance', es: 'balance poblacional' },
};

export const QUANTITY_NAME: Record<Quantity, Text> = {
  throughput: { en: 'Throughput', es: 'Capacidad' },
  net_power: { en: 'Net power', es: 'Potencia neta' },
  reduction_ratio: { en: 'Reduction ratio F80/P80', es: 'Razón de reducción F80/P80' },
};

export const QUANTITY_UNIT: Record<Quantity, Text> = {
  throughput: { en: 'kg/h', es: 'kg/h' },
  net_power: { en: 'kW', es: 'kW' },
  reduction_ratio: { en: 'F80/P80', es: 'F80/P80' },
};

export const PAIR_NAME: Record<PairKey, { first: Side; second: Side }> = {
  simulation_vs_measured: { first: 'simulation', second: 'measurement' },
  population_balance_vs_measured: { first: 'population_balance', second: 'measurement' },
  population_balance_vs_simulation: { first: 'population_balance', second: 'simulation' },
};

export const pairTitle = (pair: PairKey): Text => {
  const p = PAIR_NAME[pair];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return { en: `${cap(SIDE_NAME[p.first].en)} against ${SIDE_NAME[p.second].en}`, es: `${cap(SIDE_NAME[p.first].es)} contra ${SIDE_NAME[p.second].es}` };
};

export const pick = (t: Text, lang: Lang): string => t[lang];

/** The text of `fmt` for a plain number: the formatter of the interface language, or this fallback in a test. */
export const plain: Num = (v, o) => (o?.decimals !== undefined ? v.toFixed(o.decimals) : Number(v.toPrecision(o?.digits ?? 3)).toString());

// ---------------------------------------------------------------------------------------------------------------------------------
// Frames: the binary replay file, four little-endian unsigned 16-bit integers per sphere, decoded to millimetres.
// ---------------------------------------------------------------------------------------------------------------------------------

export interface DemFrames {
  /** The number of frames. */
  frames: number;
  /** The first sphere of each frame in `data` (in spheres), one more than the frames; the last is the total. */
  offsets: Int32Array;
  /** Four values per sphere: x, y, z and radius, in millimetres. */
  data: Float32Array;
}

export class DemFramesError extends Error {}

const LEVELS = 65535;
const RECORD_BYTES = 8;

/** The replay file's bytes as frames. The length is checked against the document's byte count and against its sphere counts before
 * any value is read, and every value is read with an explicit little-endian view, so the machine's byte order never matters. */
export function decodeFrames(buffer: ArrayBuffer, replay: DemReplay): DemFrames {
  if (buffer.byteLength !== replay.bytes) throw new DemFramesError(`${replay.file}: ${buffer.byteLength} bytes, the document names ${replay.bytes}`);
  const total = replay.count.reduce((a, c) => a + c, 0);
  if (total * RECORD_BYTES !== replay.bytes) throw new DemFramesError(`${replay.file}: the frames hold ${total} spheres, ${replay.bytes} bytes are ${replay.bytes / RECORD_BYTES}`);
  if (replay.count.length !== replay.frames) throw new DemFramesError(`${replay.file}: ${replay.count.length} sphere counts for ${replay.frames} frames`);
  const e = replay.encoding;
  const view = new DataView(buffer);
  const data = new Float32Array(total * 4);
  const lin = (u: number, [lo, hi]: readonly [number, number]) => lo + (u / LEVELS) * (hi - lo);
  for (let s = 0; s < total; s++) {
    const at = s * RECORD_BYTES;
    data[s * 4] = lin(view.getUint16(at, true), e.x_range_mm);
    data[s * 4 + 1] = lin(view.getUint16(at + 2, true), e.y_range_mm);
    data[s * 4 + 2] = lin(view.getUint16(at + 4, true), e.z_range_mm);
    data[s * 4 + 3] = (view.getUint16(at + 6, true) / LEVELS) * e.radius_max_mm;
  }
  const offsets = new Int32Array(replay.frames + 1);
  for (let i = 0; i < replay.frames; i++) offsets[i + 1] = offsets[i] + replay.count[i];
  return { frames: replay.frames, offsets, data };
}

/** The spheres of a frame: the first and one past the last sphere, in spheres. */
export const frameSpheres = (f: DemFrames, i: number): [number, number] => {
  const k = Math.max(0, Math.min(f.frames - 1, i));
  return [f.offsets[k], f.offsets[k + 1]];
};

// ---------------------------------------------------------------------------------------------------------------------------------
// The stroke cursor: one position in strokes. Frame i of the replay is the end of the i-th of `frames_per_stroke` slices of the
// stroke it belongs to, so its position is (first stroke - 1) + (i + 1) / frames_per_stroke: the stroke axis of the per-stroke charts,
// where stroke s is plotted at x = s, the end of that stroke.
// ---------------------------------------------------------------------------------------------------------------------------------

/** The lowest and highest cursor position of a replay [strokes]: its first frame and its last stroke. */
export const cursorRange = (r: DemReplay): [number, number] => [r.first_stroke - 1 + 1 / r.frames_per_stroke, r.last_stroke];

/** The cursor position of frame `i` [strokes]. */
export const cursorOfFrame = (r: DemReplay, i: number): number => r.first_stroke - 1 + (i + 1) / r.frames_per_stroke;

/** The frame nearest a cursor position (clamped to the replay): a null or non-finite cursor is the last frame. */
export function frameAt(r: DemReplay, cursor: number | null): number {
  if (cursor === null || !Number.isFinite(cursor)) return r.frames - 1;
  const i = Math.round((cursor - (r.first_stroke - 1)) * r.frames_per_stroke) - 1;
  return Math.max(0, Math.min(r.frames - 1, i));
}

/** The cursor a point opens at: the first stroke of the steady window for a run that has one, else the last stroke the replay holds. */
export function openingCursor(point: DemPoint): number | null {
  const r = point.simulation.replay;
  if (!r) return null;
  const w = point.simulation.window;
  const [lo, hi] = cursorRange(r);
  return Math.max(lo, Math.min(hi, w ? w.first_stroke : r.last_stroke));
}

/** The label of a frame: its stroke and its simulated time. */
export function frameLabel(r: DemReplay, i: number): { stroke: number; timeS: number } {
  const k = Math.max(0, Math.min(r.frames - 1, i));
  return { stroke: r.stroke[k], timeS: r.t_s[k] };
}

export function frameLabelText(r: DemReplay, i: number, num: Num, lang: Lang): string {
  const { stroke, timeS } = frameLabel(r, i);
  return lang === 'es' ? `golpe ${stroke}, t = ${num(timeS, { decimals: 2 })} s` : `stroke ${stroke}, t = ${num(timeS, { decimals: 2 })} s`;
}

/** Playback is allowed unless the reader prefers reduced motion; the loop itself also stops on a hidden tab and on unmount (the shell's hook). */
export const playbackAllowed = (reducedMotion: boolean): boolean => !reducedMotion;

/** The speeds of playback, in strokes per second: one stroke a second is followed by eye (the machine makes six). */
export const SPEEDS = [0.5, 1, 2, 4] as const;
export const DEFAULT_SPEED = 1;

/** The cursor after `dtMs` of playback at `speed` strokes a second, and whether the replay reached its end. */
export function advance(r: DemReplay, cursor: number, dtMs: number, speed: number): { cursor: number; done: boolean } {
  const [, hi] = cursorRange(r);
  const next = cursor + (dtMs / 1000) * speed;
  return next >= hi ? { cursor: hi, done: true } : { cursor: next, done: false };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The stage's geometry: the section in the x-z plane, to scale.
// ---------------------------------------------------------------------------------------------------------------------------------

export interface StageTransform {
  /** Pixels per millimetre. */
  scale: number;
  /** The pixel position of a point of the section [mm]. */
  px: (x: number, z: number) => { x: number; y: number };
  /** The drawn extent of the section [mm]. */
  bounds: { xMin: number; xMax: number; zMin: number; zMax: number };
}

/** The part of the section the stage draws [mm]: from the sphere-free ground below the discharge level to just above the plates; the hopper
 * rises above and is cropped there, and the stage says so. */
export function stageBounds(g: DemReplay['geometry']): StageTransform['bounds'] {
  const gape = g.swing_pivot_mm[0] - g.fixed_plate_x_mm;
  return {
    xMin: g.fixed_plate_x_mm - 0.55 * gape,
    xMax: g.swing_pivot_mm[0] + 0.3 * gape,
    zMin: g.discharge_z_mm - 20,
    zMax: g.fixed_plate_z_mm[1] + 12,
  };
}

/** The section fitted to a box of `width` by `height` pixels with `pad` pixels around it, centred, one scale on both axes. */
export function stageTransform(g: DemReplay['geometry'], width: number, height: number, pad = 8): StageTransform {
  const b = stageBounds(g);
  const scale = Math.max(0.01, Math.min((width - 2 * pad) / (b.xMax - b.xMin), (height - 2 * pad) / (b.zMax - b.zMin)));
  const w = (b.xMax - b.xMin) * scale;
  const h = (b.zMax - b.zMin) * scale;
  const ox = (width - w) / 2;
  const oy = (height - h) / 2;
  return { scale, bounds: b, px: (x, z) => ({ x: ox + (x - b.xMin) * scale, y: oy + (b.zMax - z) * scale }) };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The colour class of a sphere: its diameter against the lower size of the feed class. Class 5 is feed-sized or larger.
// ---------------------------------------------------------------------------------------------------------------------------------

/** The upper edges of the size classes as fractions of the feed class's lower size. */
export const SIZE_CLASS_EDGES = [0.1, 0.2, 0.35, 0.6, 1.0] as const;
export const SIZE_CLASSES = SIZE_CLASS_EDGES.length + 1;

/** The class (0 finest to 5 feed-sized or coarser) of a sphere of diameter `diameterMm` in a feed class whose lower size is `feedLowMm`. */
export function sizeClass(diameterMm: number, feedLowMm: number): number {
  const f = diameterMm / Math.max(1e-9, feedLowMm);
  for (let c = 0; c < SIZE_CLASS_EDGES.length; c++) if (f < SIZE_CLASS_EDGES[c]) return c;
  return SIZE_CLASS_EDGES.length;
}

/** How many spheres of each size class a frame holds (index 0 finest): the mix the stage's panel draws beside the section. */
export function classCounts(f: DemFrames, i: number, feedLowMm: number): number[] {
  const out = new Array<number>(SIZE_CLASSES).fill(0);
  const [a, b] = frameSpheres(f, i);
  for (let s = a; s < b; s++) out[sizeClass(2 * f.data[s * 4 + 3], feedLowMm)]++;
  return out;
}

/** The legend of the classes: each class's range in millimetres for a feed class. */
export function sizeClassLabels(feedLowMm: number, num: Num): string[] {
  const edges = SIZE_CLASS_EDGES.map((e) => e * feedLowMm);
  return Array.from({ length: SIZE_CLASSES }, (_, c) => {
    if (c === 0) return `< ${num(edges[0], { digits: 2 })}`;
    if (c === SIZE_CLASSES - 1) return `>= ${num(edges[c - 1], { digits: 2 })}`;
    return `${num(edges[c - 1], { digits: 2 })} to ${num(edges[c], { digits: 2 })}`;
  });
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Verdicts: a state of a cell, its word, its mark and the callout state it takes. Only `met` may read as within the band.
// ---------------------------------------------------------------------------------------------------------------------------------

export type VerdictState = 'met' | 'met-unresolved' | 'not-met' | 'not-compared';

/** The state of a verdict cell: `met` is unresolved when the document says the package's rule does not resolve it. */
export function verdictState(c: Pick<DemVerdictCell, 'verdict' | 'resolved'>): VerdictState {
  if (c.verdict === 'met') return c.resolved === false ? 'met-unresolved' : 'met';
  return c.verdict === 'not met' ? 'not-met' : 'not-compared';
}

const VERDICT_WORD: Record<VerdictState, Text> = {
  met: { en: 'Met', es: 'Cumple' },
  'met-unresolved': { en: 'Met, not resolved', es: 'Cumple, sin resolver' },
  'not-met': { en: 'Not met', es: 'No cumple' },
  'not-compared': { en: 'Not compared', es: 'Sin comparar' },
};
export const verdictWord = (s: VerdictState): Text => VERDICT_WORD[s];

/** A mark that says the state without colour: a check, a cross, a check with a question, an empty circle. */
export const VERDICT_MARK: Record<VerdictState, string> = { met: '✓', 'met-unresolved': '✓?', 'not-met': '✕', 'not-compared': '○' };

/** The state a callout shows (the shell's states): never `normal` for a verdict that is not met. */
export function calloutState(s: VerdictState): 'normal' | 'warning' | 'alarm' | 'inactive' {
  return s === 'met' ? 'normal' : s === 'met-unresolved' ? 'warning' : s === 'not-met' ? 'alarm' : 'inactive';
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Runs: the final attempt, where it stopped and why.
// ---------------------------------------------------------------------------------------------------------------------------------

export const finalAttempt = (s: DemSimulation): DemAttempt => s.attempts[s.attempts.length - 1];
export const isComplete = (s: DemSimulation): boolean => s.status === 'complete';

const STATUS_WORD: Record<DemSimulation['status'], Text> = {
  complete: { en: 'completed', es: 'completó' },
  overlap_error: { en: 'stopped on the package’s overlap error', es: 'se detuvo por el error de traslape del paquete' },
  stalled: { en: 'stopped when the mass passed stalled', es: 'se detuvo al estancarse la masa pasada' },
  max_strokes: { en: 'stopped at the stroke limit', es: 'se detuvo en el límite de golpes' },
  max_wall_time: { en: 'stopped at the wall-time limit', es: 'se detuvo en el límite de tiempo' },
};

/** Where and why a run ended, in the reader's words: complete with its strokes, or the stop with its stroke, the mass it had passed and the spheres held. */
export function runStatusText(s: DemSimulation, num: Num): Text {
  const a = finalAttempt(s);
  if (isComplete(s)) {
    return {
      en: `The run ${STATUS_WORD.complete.en} in ${s.strokes} strokes at an overlap limit of ${num(a.max_overlap_fraction, { digits: 2 })} (the first limits tried stopped earlier: ${s.attempts.length - 1} attempt${s.attempts.length === 2 ? '' : 's'} before it).`,
      es: `La corrida ${STATUS_WORD.complete.es} en ${s.strokes} golpes con un límite de traslape de ${num(a.max_overlap_fraction, { digits: 2 })} (los límites anteriores se detuvieron antes: ${s.attempts.length - 1} intento${s.attempts.length === 2 ? '' : 's'} previo${s.attempts.length === 2 ? '' : 's'}).`,
    };
  }
  const at = a.stopped_during_stroke;
  const where = at === null ? { en: `after ${s.strokes} strokes`, es: `tras ${s.strokes} golpes` } : { en: `during stroke ${at}`, es: `durante el golpe ${at}` };
  const why = s.error ? ` (${s.error})` : '';
  return {
    en: `The run did not complete: it ${STATUS_WORD[s.status].en} ${where.en}${why}, with ${a.held_spheres} spheres held and ${num(a.mass_passed_kg, { digits: 3 })} of ${num(s.mass_fed_kg, { digits: 3 })} kg passed. The replay runs to the stop.`,
    es: `La corrida no se completó: ${STATUS_WORD[s.status].es} ${where.es}${s.error ? ` (${s.error})` : ''}, con ${a.held_spheres} esferas retenidas y ${num(a.mass_passed_kg, { digits: 3 })} de ${num(s.mass_fed_kg, { digits: 3 })} kg pasados. La repetición llega hasta la detención.`,
  };
}

/** The state of a run in one short phrase (the operating point choice). */
export function runStateText(s: DemSimulation, short = false): Text {
  if (isComplete(s)) return short ? { en: 'complete', es: 'completa' } : { en: `complete, ${s.strokes} strokes`, es: `completa, ${s.strokes} golpes` };
  const at = finalAttempt(s).stopped_during_stroke;
  if (short) return { en: 'stopped', es: 'detenida' };
  return { en: `stopped${at === null ? '' : ` in stroke ${at}`}`, es: `detenida${at === null ? '' : ` en el golpe ${at}`}` };
}

/** Why a verdict is not compared, in words: the basis the document gives. */
export function basisText(basis: DemBasis | null, point: DemPoint | null): Text {
  switch (basis) {
    case 'run_incomplete': {
      const at = point ? finalAttempt(point.simulation).stopped_during_stroke : null;
      return {
        en: `the particle run did not complete${at === null ? '' : ` (it stopped during stroke ${at})`}, so it has no steady window`,
        es: `la corrida de partículas no se completó${at === null ? '' : ` (se detuvo durante el golpe ${at})`}, así que no tiene ventana estacionaria`,
      };
    }
    case 'no_window':
      return { en: 'the run completed without a steady window', es: 'la corrida se completó sin una ventana estacionaria' };
    case 'no_work_index':
      return { en: 'no work index of the ore is published, so the population balance states no net power', es: 'no se publica un índice de trabajo del mineral, así que el balance poblacional no entrega potencia neta' };
    case 'nothing_passed':
      return { en: 'no mass passed the discharge', es: 'no pasó masa por la descarga' };
    default:
      return { en: 'no basis is stated', es: 'no se declara un fundamento' };
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Values of the three sides, and the relative error the document defines: (first - second) / second.
// ---------------------------------------------------------------------------------------------------------------------------------

/** The value a side states for a quantity at a point, or null (the population balance states no net power; a run that did not complete states no window statistic). */
export function sideValue(p: DemPoint, side: Side, q: Quantity): number | null {
  if (side === 'measurement') return q === 'throughput' ? p.measured.throughput_kg_h.value : q === 'net_power' ? p.measured.net_power_kw.value : p.measured.reduction_ratio;
  if (side === 'simulation') return q === 'throughput' ? p.simulation.throughput_kg_h : q === 'net_power' ? p.simulation.net_power_kw : p.simulation.reduction_ratio;
  return q === 'throughput' ? p.population_balance.throughput_kg_h : q === 'net_power' ? null : p.population_balance.reduction_ratio;
}

/** The product P80 a side states [mm] (the simulation's is that of the mass passed before the stop for a run that did not complete). */
export function sideP80(p: DemPoint, side: Side): number | null {
  return side === 'measurement' ? p.measured.p80_mm : side === 'simulation' ? p.simulation.p80_mm : p.population_balance.p80_mm;
}

/** The verdict cell of a pair and a quantity. */
export const cellOf = (p: DemPoint, pair: PairKey, q: Quantity): DemVerdictCell => p.verdicts[pair][q];

/** The relative error of the first against the second [fraction], null when either value is absent. */
export const relativeError = (first: number | null, second: number | null): number | null => (first === null || second === null || second === 0 ? null : (first - second) / second);

// ---------------------------------------------------------------------------------------------------------------------------------
// The three callouts of a point: the particle simulation's throughput, net power and product P80 against the measurement.
// ---------------------------------------------------------------------------------------------------------------------------------

export interface CalloutModel {
  id: 'throughput' | 'net_power' | 'p80';
  eyebrow: Text;
  /** The particle simulation's value; null when the run states none. */
  value: number | null;
  unit: Text;
  decimalsOrDigits: { digits: number };
  measured: number | null;
  /** The relative error of the simulation's value against the measurement [fraction]; null when there is no value. */
  relativeError: number | null;
  state: VerdictState;
  /** The verdict's cell: the one of the quantity (the reduction ratio's for P80). */
  cell: DemVerdictCell;
  /** Why there is no value or no comparison, from the document's basis; null otherwise. */
  basis: Text | null;
}

const CALLOUT_QUANTITY: Record<CalloutModel['id'], Quantity> = { throughput: 'throughput', net_power: 'net_power', p80: 'reduction_ratio' };

export function pointCallouts(p: DemPoint): CalloutModel[] {
  const eyebrow: Record<CalloutModel['id'], Text> = {
    throughput: { en: 'THROUGHPUT', es: 'CAPACIDAD' },
    net_power: { en: 'NET POWER', es: 'POTENCIA NETA' },
    p80: { en: 'PRODUCT P80', es: 'P80 DEL PRODUCTO' },
  };
  const unit: Record<CalloutModel['id'], Text> = { throughput: { en: 'kg/h', es: 'kg/h' }, net_power: { en: 'kW', es: 'kW' }, p80: { en: 'mm', es: 'mm' } };
  return (['throughput', 'net_power', 'p80'] as const).map((id) => {
    const q = CALLOUT_QUANTITY[id];
    const cell = cellOf(p, 'simulation_vs_measured', q);
    const value = id === 'p80' ? p.simulation.p80_mm : sideValue(p, 'simulation', q);
    const measured = id === 'p80' ? p.measured.p80_mm : sideValue(p, 'measurement', q);
    const state = verdictState(cell);
    return {
      id,
      eyebrow: eyebrow[id],
      value,
      unit: unit[id],
      decimalsOrDigits: { digits: 3 },
      measured,
      relativeError: relativeError(value, measured),
      state,
      cell,
      basis: cell.verdict === 'not compared' ? basisText(cell.basis, p) : null,
    };
  });
}

/** A signed percentage: +171 percent, -11.5 percent. */
export const signedPct = (frac: number, num: Num): string => `${frac > 0 ? '+' : frac < 0 ? '-' : ''}${num(Math.abs(frac) * 100, { digits: 3 })}`;

/** The source line of a callout: the measurement, the relative error and the verdict's word, or the basis when the verdict is not compared. */
export function calloutSource(c: CalloutModel, num: Num): Text {
  const word = verdictWord(c.state);
  const mark = VERDICT_MARK[c.state];
  if (c.measured === null) return { en: `${mark} ${word.en}`, es: `${mark} ${word.es}` };
  const m = num(c.measured, c.id === 'net_power' ? { digits: 3 } : { digits: 3 });
  if (c.value === null) return { en: `Measured ${m}; ${mark} ${word.en}: ${basisShort(c.cell.basis).en}`, es: `Medido ${m}; ${mark} ${word.es}: ${basisShort(c.cell.basis).es}` };
  const e = c.relativeError === null ? '' : `${signedPct(c.relativeError, num)}% `;
  if (c.state === 'not-compared') return { en: `Measured ${m}; ${e}${mark} ${word.en}: ${basisShort(c.cell.basis).en}`, es: `Medido ${m}; ${e}${mark} ${word.es}: ${basisShort(c.cell.basis).es}` };
  const kind = c.id === 'p80' ? { en: ' (state: reduction ratio)', es: ' (estado: razón de reducción)' } : { en: '', es: '' };
  return { en: `Measured ${m}; ${e}${mark} ${word.en}${kind.en}`, es: `Medido ${m}; ${e}${mark} ${word.es}${kind.es}` };
}

/** The basis in two or three words, for a callout's source. */
export function basisShort(basis: DemBasis | null): Text {
  switch (basis) {
    case 'run_incomplete':
      return { en: 'run incomplete', es: 'corrida incompleta' };
    case 'no_window':
      return { en: 'no steady window', es: 'sin ventana estacionaria' };
    case 'no_work_index':
      return { en: 'no work index', es: 'sin índice de trabajo' };
    case 'nothing_passed':
      return { en: 'nothing passed', es: 'nada pasó' };
    default:
      return { en: 'no basis stated', es: 'sin fundamento declarado' };
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The takeaway: what the selected run shows, in the problem's terms, built from the document.
// ---------------------------------------------------------------------------------------------------------------------------------

export function takeaway(p: DemPoint, bands: DemRun['bands'], num: Num): Text {
  const feed = `${p.feed_class}`;
  const s = p.simulation;
  if (!isComplete(s) || s.window === null) {
    const a = finalAttempt(s);
    const at = a.stopped_during_stroke;
    return {
      en: `At the ${feed} mm feed the particle run stopped${at === null ? '' : ` during stroke ${at}`} with ${a.held_spheres} spheres held and ${num(a.mass_passed_kg, { digits: 3 })} kg passed: it has no steady window, so it states no throughput, power or reduction ratio to set against the measurement.`,
      es: `Con la alimentación de ${feed} mm la corrida de partículas se detuvo${at === null ? '' : ` durante el golpe ${at}`} con ${a.held_spheres} esferas retenidas y ${num(a.mass_passed_kg, { digits: 3 })} kg pasados: no tiene ventana estacionaria, así que no entrega capacidad, potencia ni razón de reducción para contrastar con la medición.`,
    };
  }
  const t = cellOf(p, 'simulation_vs_measured', 'throughput');
  const w = cellOf(p, 'simulation_vs_measured', 'net_power');
  const tw = verdictWord(verdictState(t));
  const ww = verdictWord(verdictState(w));
  const e = (c: DemVerdictCell) => (c.relative_error === null ? '' : `${signedPct(c.relative_error, num)} percent`);
  return {
    en: `At the ${feed} mm feed the particle simulation passes ${num(s.throughput_kg_h ?? 0, { digits: 3 })} kg/h against ${num(t.second ?? 0, { digits: 3 })} measured (${e(t)}, ${tw.en.toLowerCase()} for the ${num(bands.throughput_relative * 100, { digits: 2 })} percent band) and draws ${num(s.net_power_kw ?? 0, { digits: 3 })} kW against ${num(w.second ?? 0, { digits: 3 })} kW (${e(w)}, ${ww.en.toLowerCase()} for the ${num(bands.net_power_relative * 100, { digits: 2 })} percent band).`,
    es: `Con la alimentación de ${feed} mm la simulación de partículas pasa ${num(s.throughput_kg_h ?? 0, { digits: 3 })} kg/h frente a ${num(t.second ?? 0, { digits: 3 })} medidos (${e(t).replace('percent', 'por ciento')}, ${tw.es.toLowerCase()} para la banda de ${num(bands.throughput_relative * 100, { digits: 2 })} por ciento) y consume ${num(s.net_power_kw ?? 0, { digits: 3 })} kW frente a ${num(w.second ?? 0, { digits: 3 })} kW (${e(w).replace('percent', 'por ciento')}, ${ww.es.toLowerCase()} para la banda de ${num(bands.net_power_relative * 100, { digits: 2 })} por ciento).`,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The series of a quantity over the three points, side by side on the feed's mean size.
// ---------------------------------------------------------------------------------------------------------------------------------

export interface SideMark {
  /** The value the side states, or null: then no mark is drawn and `reason` says why. */
  value: number | null;
  /** The lower and upper end of what is drawn around the value (the measurement's band, the simulation's standard error, the spread of the population balance's P80); null where there is none. */
  lo: number | null;
  hi: number | null;
  /** Why the side has no value or no verdict, or what the value is (the product before the stop); null otherwise. */
  reason: Text | null;
  /** The value is of a run that did not complete (the product P80 of the mass passed before the stop). */
  stopped: boolean;
}

export interface SeriesPoint {
  id: DemPoint['id'];
  feedClass: string;
  /** The feed's mean size [mm]: the abscissa. */
  x: number;
  measurement: SideMark;
  simulation: SideMark;
  population_balance: SideMark;
  /** The relative band of the measurement for this quantity [fraction] (the reduction ratio's for P80). */
  band: number;
}

export interface QuantitySeries {
  quantity: ChartQuantity;
  unit: Text;
  name: Text;
  points: SeriesPoint[];
}

const CHART_UNIT: Record<ChartQuantity, Text> = { throughput: { en: 'kg/h', es: 'kg/h' }, net_power: { en: 'kW', es: 'kW' }, p80: { en: 'mm', es: 'mm' } };
const CHART_NAME: Record<ChartQuantity, Text> = {
  throughput: { en: 'Throughput', es: 'Capacidad' },
  net_power: { en: 'Net power', es: 'Potencia neta' },
  p80: { en: 'Product P80', es: 'P80 del producto' },
};
const CHART_VERDICT_QUANTITY: Record<ChartQuantity, Quantity> = { throughput: 'throughput', net_power: 'net_power', p80: 'reduction_ratio' };
export const verdictQuantityOf = (q: ChartQuantity): Quantity => CHART_VERDICT_QUANTITY[q];

const NO_MARK: SideMark = { value: null, lo: null, hi: null, reason: null, stopped: false };

export function comparisonSeries(run: DemRun, q: ChartQuantity, num: Num = plain): QuantitySeries {
  const vq = CHART_VERDICT_QUANTITY[q];
  const points = run.points.map((p): SeriesPoint => {
    const rrBand = run.bands.reduction_ratio_relative;
    const band = q === 'throughput' ? run.bands.throughput_relative : q === 'net_power' ? run.bands.net_power_relative : rrBand;
    const simCell = cellOf(p, 'simulation_vs_measured', vq);
    const pbCell = cellOf(p, 'population_balance_vs_measured', vq);
    // measurement
    const mv = q === 'p80' ? p.measured.p80_mm : sideValue(p, 'measurement', vq);
    // the band of the reduction ratio F80/P80 as a band on P80: |RR_side / RR_measured - 1| <= b holds for P80_side in [P80_m / (1 + b), P80_m / (1 - b)]
    const measurement: SideMark = {
      value: mv,
      lo: mv === null ? null : q === 'p80' ? mv / (1 + band) : mv * (1 - band),
      hi: mv === null ? null : q === 'p80' ? mv / (1 - band) : mv * (1 + band),
      reason: null,
      stopped: false,
    };
    // particle simulation
    let simulation: SideMark;
    if (q === 'p80') {
      const v = p.simulation.p80_mm;
      const stopped = !isComplete(p.simulation);
      simulation = {
        value: v,
        lo: null,
        hi: null,
        stopped,
        reason: stopped && v !== null ? { en: `the product of the ${num(finalAttempt(p.simulation).mass_passed_kg, { digits: 3 })} kg passed before the stop`, es: `el producto de los ${num(finalAttempt(p.simulation).mass_passed_kg, { digits: 3 })} kg pasados antes de la detención` } : v === null ? basisText(simCell.basis, p) : null,
      };
    } else {
      const v = sideValue(p, 'simulation', vq);
      const se = q === 'throughput' ? p.simulation.throughput_se_kg_h : p.simulation.net_power_se_kw;
      simulation = {
        value: v,
        lo: v === null || se === null ? null : v - se,
        hi: v === null || se === null ? null : v + se,
        reason: v === null ? basisText(simCell.basis, p) : null,
        stopped: false,
      };
    }
    // population balance
    let population_balance: SideMark;
    if (q === 'p80') {
      const [lo, hi] = p.population_balance.band.p80_mm;
      population_balance = { value: p.population_balance.p80_mm, lo, hi, reason: null, stopped: false };
    } else {
      const v = sideValue(p, 'population_balance', vq);
      population_balance = v === null ? { ...NO_MARK, reason: basisText(pbCell.basis, p) } : { value: v, lo: null, hi: null, reason: null, stopped: false };
    }
    return { id: p.id, feedClass: p.feed_class, x: p.feed_mean_mm, measurement, simulation, population_balance, band };
  });
  return { quantity: q, unit: CHART_UNIT[q], name: CHART_NAME[q], points };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Which side is nearer the measurement, as a sentence that never reads as agreement for a verdict that is not met.
// ---------------------------------------------------------------------------------------------------------------------------------

export interface Nearer {
  /** The side nearer the measurement, or null when fewer than two sides state a value. */
  side: 'simulation' | 'population_balance' | null;
  /** The percentage of each side's value from the measurement's, null where the side states none. */
  simulationPct: number | null;
  populationBalancePct: number | null;
}

/** For a quantity of the comparison at a point: the percentage each side is from the measurement and which one is nearer. */
export function nearer(p: DemPoint, q: ChartQuantity): Nearer {
  const vq = CHART_VERDICT_QUANTITY[q];
  const m = q === 'p80' ? sideP80(p, 'measurement') : sideValue(p, 'measurement', vq);
  const s = q === 'p80' ? sideP80(p, 'simulation') : sideValue(p, 'simulation', vq);
  const b = q === 'p80' ? sideP80(p, 'population_balance') : sideValue(p, 'population_balance', vq);
  const sp = relativeError(s, m);
  const bp = relativeError(b, m);
  const simulationPct = sp === null ? null : Math.abs(sp) * 100;
  const populationBalancePct = bp === null ? null : Math.abs(bp) * 100;
  const side = simulationPct === null || populationBalancePct === null ? null : simulationPct <= populationBalancePct ? 'simulation' : 'population_balance';
  return { side, simulationPct, populationBalancePct };
}

const STATE_CLAUSE: Record<VerdictState, Text> = {
  met: { en: 'within the band', es: 'dentro de la banda' },
  'met-unresolved': { en: 'within the band, not resolved by the package’s rule', es: 'dentro de la banda, sin resolver por la regla del paquete' },
  'not-met': { en: 'not within the band', es: 'fuera de la banda' },
  'not-compared': { en: 'not compared', es: 'sin comparar' },
};

/** The sentence under a comparison chart for a point: which side is nearer the measurement and by how many percent, then each side's verdict in words. */
export function nearerSentence(run: DemRun, pointIndex: number, q: ChartQuantity, num: Num = plain): Text {
  const p = run.points[pointIndex];
  const vq = CHART_VERDICT_QUANTITY[q];
  const n = nearer(p, q);
  const feed = p.feed_class;
  const band = cellOf(p, 'simulation_vs_measured', vq).band;
  const bandName: Text =
    q === 'p80'
      ? { en: `${num(band * 100, { digits: 2 })} percent band of the reduction ratio F80/P80`, es: `banda de ${num(band * 100, { digits: 2 })} por ciento de la razón de reducción F80/P80` }
      : { en: `${num(band * 100, { digits: 2 })} percent band`, es: `banda de ${num(band * 100, { digits: 2 })} por ciento` };
  const pct = (v: number) => num(v, { digits: 3 });
  const simCell = cellOf(p, 'simulation_vs_measured', vq);
  const pbCell = cellOf(p, 'population_balance_vs_measured', vq);
  const status = (cell: DemVerdictCell, has: boolean): Text => {
    const st = verdictState(cell);
    if (!has && st === 'not-compared') return { en: `states no value (${basisText(cell.basis, p).en})`, es: `no entrega valor (${basisText(cell.basis, p).es})` };
    if (st === 'not-compared') return { en: `${STATE_CLAUSE[st].en} (${basisText(cell.basis, p).en})`, es: `${STATE_CLAUSE[st].es} (${basisText(cell.basis, p).es})` };
    return STATE_CLAUSE[st];
  };
  const sName = SIDE_NAME.simulation;
  const bName = SIDE_NAME.population_balance;
  const esThe = (side: 'simulation' | 'population_balance') => (side === 'simulation' ? 'la simulación de partículas' : 'el balance poblacional');
  const esOf = (side: 'simulation' | 'population_balance') => (side === 'simulation' ? 'de la simulación de partículas' : 'del balance poblacional');
  let lead: Text;
  if (n.side) {
    const near = n.side === 'simulation' ? sName : bName;
    const far = n.side === 'simulation' ? bName : sName;
    const nearPct = n.side === 'simulation' ? n.simulationPct! : n.populationBalancePct!;
    const farPct = n.side === 'simulation' ? n.populationBalancePct! : n.simulationPct!;
    lead = {
      en: `At ${feed} mm the ${near.en} is nearer the measurement: ${pct(nearPct)} percent away, against ${pct(farPct)} percent for the ${far.en}.`,
      es: `Con ${feed} mm ${esThe(n.side)} está más cerca de la medición: a ${pct(nearPct)} por ciento, frente a ${pct(farPct)} por ciento ${esOf(n.side === 'simulation' ? 'population_balance' : 'simulation')}.`,
    };
  } else if (n.simulationPct !== null || n.populationBalancePct !== null) {
    const onlySide = n.simulationPct !== null ? 'simulation' : 'population_balance';
    const only = onlySide === 'simulation' ? sName : bName;
    const v = n.simulationPct ?? n.populationBalancePct!;
    lead = {
      en: `At ${feed} mm only the ${only.en} states a value: ${pct(v)} percent from the measurement.`,
      es: `Con ${feed} mm solo ${esThe(onlySide)} entrega un valor: a ${pct(v)} por ciento de la medición.`,
    };
  } else {
    lead = { en: `At ${feed} mm neither the particle simulation nor the population balance states a value.`, es: `Con ${feed} mm ni la simulación de partículas ni el balance poblacional entregan un valor.` };
  }
  const sc = status(simCell, n.simulationPct !== null);
  const bc = status(pbCell, n.populationBalancePct !== null);
  return {
    en: `${lead.en} Against the ${bandName.en}: particle simulation ${sc.en}; population balance ${bc.en}.`,
    es: `${lead.es} Frente a la ${bandName.es}: simulación de partículas ${sc.es}; balance poblacional ${bc.es}.`,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The product size distribution of a point.
// ---------------------------------------------------------------------------------------------------------------------------------

export interface DistributionSeries {
  sieves: number[];
  simulation: (number | null)[];
  /** The mass passed before the stop of a run that did not complete: its product is that of the mass passed so far. */
  simulationStopped: boolean;
  populationBalance: (number | null)[];
  populationBalanceLow: (number | null)[];
  populationBalanceHigh: (number | null)[];
  measured: { sieves: number[]; passing: (number | null)[] };
  css_mm: number;
  oss_mm: number;
}

export function distributionOf(run: DemRun, p: DemPoint): DistributionSeries {
  const sim = p.simulation.product;
  return {
    sieves: [...p.population_balance.product.sieves_mm],
    simulation: sim ? [...sim.passing_pct] : p.population_balance.product.sieves_mm.map(() => null),
    simulationStopped: !isComplete(p.simulation),
    populationBalance: [...p.population_balance.product.passing_pct],
    populationBalanceLow: [...p.population_balance.band.passing_low_pct],
    populationBalanceHigh: [...p.population_balance.band.passing_high_pct],
    measured: { sieves: [...p.measured.product.sieves_mm], passing: [...p.measured.product.passing_pct] },
    css_mm: run.settings.css_mm,
    oss_mm: run.settings.oss_mm,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The verdict table of a point: the three quantities by the three pairs of sides.
// ---------------------------------------------------------------------------------------------------------------------------------

export interface VerdictRow {
  pair: PairKey;
  quantity: Quantity;
  first: number | null;
  second: number | null;
  relativeError: number | null;
  band: number;
  state: VerdictState;
  resolved: boolean | null;
  basis: Text | null;
}

export function verdictRows(p: DemPoint): VerdictRow[] {
  return PAIRS.flatMap((pair) =>
    QUANTITIES.map((q): VerdictRow => {
      const c = cellOf(p, pair, q);
      return {
        pair,
        quantity: q,
        first: c.first,
        second: c.second,
        relativeError: c.relative_error,
        band: c.band,
        state: verdictState(c),
        resolved: c.resolved,
        basis: c.verdict === 'not compared' ? basisText(c.basis, p) : null,
      };
    }),
  );
}

/** How many of the document's verdicts are met, not met and not compared (the summary of the whole document). */
export function verdictCounts(run: DemRun): { met: number; notMet: number; notCompared: number; total: number } {
  let met = 0;
  let notMet = 0;
  let notCompared = 0;
  for (const p of run.points) for (const pair of PAIRS) for (const q of QUANTITIES) {
    const v = p.verdicts[pair][q].verdict;
    if (v === 'met') met++;
    else if (v === 'not met') notMet++;
    else notCompared++;
  }
  return { met, notMet, notCompared, total: met + notMet + notCompared };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The per-stroke series of a run.
// ---------------------------------------------------------------------------------------------------------------------------------

/** The mean of the per-stroke plate power over the steady window [W]; null for a run without one. */
export function windowMeanPower(s: DemSimulation): number | null {
  if (!s.window) return null;
  const { first_stroke: a, last_stroke: b } = s.window;
  let sum = 0;
  let n = 0;
  s.series.stroke.forEach((stroke, i) => {
    if (stroke >= a && stroke <= b) {
      sum += s.series.plate_power_w[i];
      n++;
    }
  });
  return n ? sum / n : null;
}

/** The stroke a chart click chooses: the stroke at index `i` of the per-stroke series, as a cursor position (the end of that stroke), clamped to the replay. */
export function cursorOfStrokeIndex(s: DemSimulation, i: number): number | null {
  const r = s.replay;
  if (!r) return null;
  const stroke = s.series.stroke[Math.max(0, Math.min(s.series.stroke.length - 1, i))];
  const [lo, hi] = cursorRange(r);
  return Math.max(lo, Math.min(hi, stroke));
}

/** The mass passed at the stroke the cursor stands in [kg] (the series' value at the end of the stroke the cursor is in). */
export function passedAt(s: DemSimulation, cursor: number): number | null {
  const stroke = Math.max(1, Math.ceil(cursor - 1e-9));
  const i = s.series.stroke.indexOf(stroke);
  return i < 0 ? null : s.series.passed_kg[i];
}

/**
 * The document's own source texts are English and carry numbers written with a decimal point ("section 3.2", "0.34 kW"). On a Spanish page
 * every number is written with a decimal comma, so the digits of such a text are rewritten; a token that holds a slash and letters (a DOI, a path) is
 * left as it is, and so is every word.
 */
export function localizeNumbers(text: string, lang: Lang): string {
  if (lang !== 'es') return text;
  return text
    .split(' ')
    .map((tok) => ((tok.includes('/') && /[A-Za-z]{2,}/.test(tok)) || /^https?:/i.test(tok) ? tok : tok.replace(/(?<![\d.])(\d+)\.(\d+)(?!\d|\.\d)/g, '$1,$2')))
    .join(' ');
}
