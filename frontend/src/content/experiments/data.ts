// The Experiments page's numbers. Everything here is a pure function of a committed artifact (a loaded case, the HP500 validation
// document) or of the live engine: no figure is typed in a view. The sweeps are the ones the pipeline wrote into each trace
// (`css_sweep`, `speed_sweep`); the throw range is run through the engine in the browser, over the range of the workbench's throw knob.
import type { CaseData } from '../../api/artifacts';
import { optimalSpeed } from '../../engine/capacity';
import { evaluate } from '../../engine/engine';
import type { Machine } from '../../engine/types';
import type { Hp500Loo, Text } from '../../lib/contract.types';
import { KNOBS, operatingOf, railOf } from '../../workbench/model';

export type FamilyId = 'cone-sec' | 'cone-tert' | 'cone-short-head' | 'gyratory' | 'jaw' | 'hp500';

/** The machine families of the sweeps, in the order of the page. A control case is in none: it tests the guards and not a machine. */
export const FAMILIES: { id: FamilyId; label: Text }[] = [
  { id: 'cone-sec', label: { en: 'Secondary cone', es: 'Cono secundario' } },
  { id: 'cone-tert', label: { en: 'Tertiary cone', es: 'Cono terciario' } },
  { id: 'cone-short-head', label: { en: 'Short-head cone', es: 'Cono de cabeza corta' } },
  { id: 'gyratory', label: { en: 'Gyratory', es: 'Giratorio' } },
  { id: 'jaw', label: { en: 'Jaw', es: 'Mandíbula' } },
  { id: 'hp500', label: { en: 'HP500 surveys', es: 'Muestreos HP500' } },
];

/** The family of a case: the calibrated survey cases form their own, a control belongs to none. */
export function familyOf(d: CaseData): FamilyId | null {
  const p = d.manifest.params;
  if (d.manifest.control) return null;
  if (p.calibrated) return 'hp500';
  return p.machine as FamilyId;
}

/** The cases of a family that carry their replay, in the order of the index. */
export const casesOf = (cases: readonly CaseData[], family: FamilyId): CaseData[] => cases.filter((c) => c.trace !== null && familyOf(c) === family);

/** The least-squares slope of ln y on ln x: the elasticity d ln y / d ln x of a curve that is a power law, read over the whole sweep. */
export function elasticity(x: readonly number[], y: readonly number[]): number {
  const n = x.length;
  const lx = x.map(Math.log);
  const ly = y.map(Math.log);
  const mx = lx.reduce((a, b) => a + b, 0) / n;
  const my = ly.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (lx[i] - mx) * (ly[i] - my);
    sxx += (lx[i] - mx) ** 2;
  }
  return sxy / sxx;
}

/** True when y never falls as x rises along the sweep (the committed values are written to six digits, so a fall below that is a fall). */
export const risesAlong = (y: readonly number[]): boolean => y.every((v, i) => i === 0 || v >= y[i - 1]);

export interface SettingRow {
  id: string;
  title: Text;
  /** The case's own closed-side setting [mm]. */
  css: number;
  cssLo: number;
  cssHi: number;
  p80Lo: number;
  p80Hi: number;
  tphLo: number;
  tphHi: number;
  /** Elasticity of P80 and of throughput with respect to the setting. */
  eP80: number;
  eTph: number;
  /** P80 and throughput both rise at every step of the sweep. */
  rises: boolean;
}

export function settingRow(d: CaseData): SettingRow | null {
  const t = d.trace;
  if (!t) return null;
  const s = t.css_sweep;
  const last = s.css_mm.length - 1;
  return {
    id: d.manifest.case_id,
    title: d.manifest.title,
    css: d.manifest.params.css_mm,
    cssLo: s.css_mm[0],
    cssHi: s.css_mm[last],
    p80Lo: s.p80_mm[0],
    p80Hi: s.p80_mm[last],
    tphLo: s.throughput_tph[0],
    tphHi: s.throughput_tph[last],
    eP80: elasticity(s.css_mm, s.p80_mm),
    eTph: elasticity(s.css_mm, s.throughput_tph),
    rises: risesAlong(s.p80_mm) && risesAlong(s.throughput_tph),
  };
}

/** The x of the maximum of a sampled curve, by the parabola through the largest sample and its two neighbours (the sample itself at an end). */
export function vertex(x: readonly number[], y: readonly number[]): number {
  let k = 0;
  for (let i = 1; i < y.length; i++) if (y[i] > y[k]) k = i;
  if (k === 0 || k === y.length - 1) return x[k];
  const [x0, x1, x2] = [x[k - 1], x[k], x[k + 1]];
  const [y0, y1, y2] = [y[k - 1], y[k], y[k + 1]];
  const den = (x0 - x1) * (x0 - x2) * (x1 - x2);
  const a = (x2 * (y1 - y0) + x1 * (y0 - y2) + x0 * (y2 - y1)) / den;
  const b = (x2 * x2 * (y0 - y1) + x1 * x1 * (y2 - y0) + x0 * x0 * (y1 - y2)) / den;
  return a < 0 ? -b / (2 * a) : x1;
}

/** A case runs past its optimum when its speed exceeds the sweep's apex by more than this share. */
export const PAST_TOLERANCE = 0.01;

export interface SpeedRow {
  id: string;
  title: Text;
  machine: Machine;
  /** The case's own speed [rpm]. */
  speed: number;
  /** The apex of the committed speed sweep [rpm], and the engine's design optimum for the machine, as a check on it. */
  apex: number;
  engineApex: number;
  /** speed over apex. */
  ratio: number;
  /** Throughput of the case at its own speed (the trace's summary), the peak of the sweep, and what the case gives up against that peak [%]. */
  tphCase: number;
  tphPeak: number;
  lossPct: number;
  past: boolean;
}

export function speedRow(d: CaseData): SpeedRow | null {
  const t = d.trace;
  if (!t) return null;
  const s = t.speed_sweep;
  const apex = vertex(s.speed_rpm, s.throughput_tph);
  const peak = Math.max(...s.throughput_tph);
  const speed = d.manifest.params.speed_rpm;
  const tphCase = t.summary.throughput_tph;
  return {
    id: d.manifest.case_id,
    title: d.manifest.title,
    machine: d.manifest.params.machine as Machine,
    speed,
    apex,
    engineApex: optimalSpeed(d.manifest.params.machine as Machine),
    ratio: speed / apex,
    tphCase,
    tphPeak: peak,
    lossPct: 100 * (1 - tphCase / peak),
    past: speed / apex > 1 + PAST_TOLERANCE,
  };
}

export interface ThrowPoint {
  throwMm: number;
  p80: number;
  p50: number;
  reduction: number;
  tph: number;
  valid: boolean;
}

/** The range of the workbench's throw knob, in millimetres, one step apart. */
export function throwRange(): number[] {
  const k = KNOBS.find((x) => x.key === 'throwMm');
  if (!k) throw new Error('the throw knob is not in the workbench');
  const out: number[] = [];
  for (let v = k.min; v <= k.max + 1e-9; v += k.step) out.push(v);
  return out;
}

/** The live engine over the throw range, every other input held at the case's own value (and on the calibrated lane for a calibrated case). */
export function throwSweep(d: CaseData): ThrowPoint[] {
  const p = d.manifest.params;
  const rail = railOf(p);
  return throwRange().map((throwMm) => {
    const r = evaluate(operatingOf(p, { ...rail, throwMm }));
    return { throwMm, p80: r.p80, p50: r.p50, reduction: r.reductionRatio, tph: r.throughputTph, valid: r.valid };
  });
}

export interface SurveyRow {
  n: number;
  id: string;
  css: number;
  f80: number;
  feedTph: number;
  powerKw: number;
}

/** The measured operating point of each real survey, from its manifest, in survey order. */
export function surveysOf(cases: readonly CaseData[]): SurveyRow[] {
  return cases
    .flatMap((c) => {
      const m = c.manifest.measured;
      return c.manifest.real_or_synthetic === 'real' && m ? [{ n: m.survey, id: c.manifest.case_id, css: m.css_mm, f80: m.f80_mm, feedTph: m.feed_tph, powerKw: m.power_kw }] : [];
    })
    .sort((a, b) => a.n - b.n);
}

/** The index of the class of v among `classes` equal-width classes spanning [lo, hi]. */
export function classOf(v: number, lo: number, hi: number, classes: number): number {
  if (hi <= lo) return 0;
  return Math.min(classes - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * classes)));
}

/** The Pearson correlation of two samples. */
export function pearson(a: readonly number[], b: readonly number[]): number {
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return sab / Math.sqrt(saa * sbb);
}

export const MODEL_KEYS = ['M0_backbone', 'M1_residual', 'M2_freeform', 'constant_mean', 'M1_label_shuffle'] as const;
export type ModelKey = (typeof MODEL_KEYS)[number];

export const MODEL_LABEL: Record<ModelKey, Text> = {
  M0_backbone: { en: 'M0, calibrated backbone', es: 'M0, esqueleto calibrado' },
  M1_residual: { en: 'M1, backbone plus bounded residual', es: 'M1, esqueleto más residuo acotado' },
  M2_freeform: { en: 'M2, free-form fit', es: 'M2, ajuste libre' },
  constant_mean: { en: 'Constant mean', es: 'Media constante' },
  M1_label_shuffle: { en: 'M1 with shuffled labels', es: 'M1 con etiquetas barajadas' },
};

/** Whether each held-out survey falls inside the 80 percent band of the backbone, and how many do (the in-sample empirical coverage, by count: the half-width comes from the same residuals; the document's nested_coverage is the out-of-sample one). */
export function coverage(loo: Hp500Loo, target: 'tph' | 'kW'): { inside: boolean[]; count: number } {
  const t = loo.loo[target];
  const half = t.strict.uq.band_halfwidth;
  const inside = t.measured.map((y, i) => Math.abs(y - t.strict.pred.M0[i]) <= half);
  return { inside, count: inside.filter(Boolean).length };
}
