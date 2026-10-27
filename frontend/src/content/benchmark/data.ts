// The Benchmark page's arithmetic over the committed documents: pure functions, no React, so the test runs them in node. Every
// number the page shows is read from hp500/loo.json, hp500/backbone.json, model-metrics.json, the surrogate contract or the
// manifests; what is computed here is a difference, a rank or a distance of those numbers, never a figure typed in.
import { HP500_ENVELOPE } from '../../engine/envelope';
import type { Operating } from '../../engine/types';
import type { Hp500Backbone, Hp500Loo, Text } from '../../lib/contract.types';

export type Target = 'tph' | 'kW' | 'p80';
export type Fold = 'strict' | 'leaky';

/** The models of the validation, in the order of the document. */
export const MODELS = ['M0_backbone', 'M1_residual', 'M2_freeform', 'constant_mean', 'M1_label_shuffle'] as const;
export type ModelKey = (typeof MODELS)[number];

export const MODEL_LABEL: Record<ModelKey, Text> = {
  M0_backbone: { en: 'M0 calibrated backbone', es: 'M0 esqueleto calibrado' },
  M1_residual: { en: 'M1 backbone plus bounded residual', es: 'M1 esqueleto más residuo acotado' },
  M2_freeform: { en: 'M2 free-form', es: 'M2 de forma libre' },
  constant_mean: { en: 'Constant mean', es: 'Media constante' },
  M1_label_shuffle: { en: 'Label shuffle', es: 'Etiquetas barajadas' },
};

/** Short labels for the bars of a chart. */
export const MODEL_SHORT: Record<ModelKey, Text> = {
  M0_backbone: { en: 'M0', es: 'M0' },
  M1_residual: { en: 'M1', es: 'M1' },
  M2_freeform: { en: 'M2', es: 'M2' },
  constant_mean: { en: 'Mean', es: 'Media' },
  M1_label_shuffle: { en: 'Shuffle', es: 'Barajada' },
};

export const TARGET_LABEL: Record<Target, Text> = {
  tph: { en: 'Throughput (t/h)', es: 'Capacidad (t/h)' },
  kW: { en: 'Power (kW)', es: 'Potencia (kW)' },
  p80: { en: 'P80 (mm), self-consistency', es: 'P80 (mm), autoconsistencia' },
};

/** The scores of one model on one target and fold. */
export function scoresOf(loo: Hp500Loo, target: Target, fold: Fold, model: ModelKey) {
  return loo.loo[target][fold][model];
}

/** The optimism gap in points of MAPE: the leaky fold's error subtracted from the strict fold's. Positive when fitting on all ten flatters the model. */
export function optimismGap(loo: Hp500Loo, target: Target, model: ModelKey): number {
  return scoresOf(loo, target, 'strict', model).mape_pct - scoresOf(loo, target, 'leaky', model).mape_pct;
}

/** The signed error of a prediction against a measurement, in percent of the measurement. */
export const errPct = (pred: number, measured: number): number => ((pred - measured) / measured) * 100;

/** The strict-fold backbone (M0) prediction for survey number `n` (1 to 10), its measurement and the 80 percent band around it. */
export function bandFor(loo: Hp500Loo, target: 'tph' | 'kW', n: number) {
  const t = loo.loo[target];
  const i = n - 1;
  const pred = t.strict.pred.M0[i];
  const half = t.strict.uq.band_halfwidth;
  const measured = t.measured[i];
  return { measured, pred, half, lo: pred - half, hi: pred + half, inside: Math.abs(pred - measured) <= half };
}

/**
 * How far a survey lies from the centre of the calibrated envelope, in units of the envelope's half-range, taking the larger of the
 * closed-side setting and the feed f80 (a Chebyshev distance). 0 is the centre, 1 is the edge of the envelope the fit is supported on
 * (engine/envelope.ts, the range of the ten surveys); above 1 would be outside it.
 */
export function envelopeDistance(cssMm: number, f80Mm: number): number {
  const part = ([lo, hi]: readonly [number, number], v: number) => Math.abs(v - (lo + hi) / 2) / ((hi - lo) / 2);
  return Math.max(part(HP500_ENVELOPE.cssMm, cssMm), part(HP500_ENVELOPE.f80Mm, f80Mm));
}

export interface RobustnessPoint {
  id: string;
  n: number;
  cssMm: number;
  f80Mm: number;
  distance: number;
  /** The strict-fold error of the backbone, signed, in percent of the measurement. */
  tphErrPct: number;
  kwErrPct: number;
}

/** One point per survey, ordered by its distance from the centre of the calibrated envelope. Throws when the two documents disagree on a measurement. */
export function robustnessPoints(loo: Hp500Loo, backbone: Hp500Backbone): RobustnessPoint[] {
  const out = backbone.surveys.map((s) => {
    const i = s.n - 1;
    const tph = loo.loo.tph;
    const kw = loo.loo.kW;
    if (tph.measured[i] !== s.measured.feed_tph || kw.measured[i] !== s.measured.power_kw) {
      throw new Error(`survey ${s.n}: hp500/loo.json and hp500/backbone.json disagree on the measured throughput or power`);
    }
    return {
      id: s.id,
      n: s.n,
      cssMm: s.measured.css_mm,
      f80Mm: s.measured.f80_mm,
      distance: envelopeDistance(s.measured.css_mm, s.measured.f80_mm),
      tphErrPct: errPct(tph.strict.pred.M0[i], tph.measured[i]),
      kwErrPct: errPct(kw.strict.pred.M0[i], kw.measured[i]),
    };
  });
  return out.sort((a, b) => a.distance - b.distance || a.n - b.n);
}

/** Average ranks (ties share the mean rank). */
function ranks(v: readonly number[]): number[] {
  const order = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(v.length).fill(0);
  let k = 0;
  while (k < order.length) {
    let j = k;
    while (j + 1 < order.length && order[j + 1][0] === order[k][0]) j++;
    const mean = (k + j) / 2 + 1;
    for (let m = k; m <= j; m++) r[order[m][1]] = mean;
    k = j + 1;
  }
  return r;
}

/** The Spearman rank correlation of two series; null when either has no spread. */
export function spearman(x: readonly number[], y: readonly number[]): number | null {
  if (x.length !== y.length || x.length < 3) return null;
  const a = ranks(x);
  const b = ranks(y);
  const ma = a.reduce((s, v) => s + v, 0) / a.length;
  const mb = b.reduce((s, v) => s + v, 0) / b.length;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < a.length; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return saa === 0 || sbb === 0 ? null : sab / Math.sqrt(saa * sbb);
}

export type SurrogateInputName = 'css_mm' | 'throw_mm' | 'speed_rpm' | 'feed_x63_mm' | 'feed_m' | 'ore_axb';

/** The field of an operating point each surrogate input reads. */
export const INPUT_FIELD: Record<SurrogateInputName, keyof Operating> = {
  css_mm: 'cssMm',
  throw_mm: 'throwMm',
  speed_rpm: 'speedRpm',
  feed_x63_mm: 'feedX63Mm',
  feed_m: 'feedM',
  ore_axb: 'oreAxb',
};

export const INPUT_LABEL: Record<SurrogateInputName, Text> = {
  css_mm: { en: 'setting', es: 'abertura' },
  throw_mm: { en: 'throw', es: 'carrera' },
  speed_rpm: { en: 'speed', es: 'velocidad' },
  feed_x63_mm: { en: 'feed x63', es: 'x63 de la alimentación' },
  feed_m: { en: 'feed m', es: 'm de la alimentación' },
  ore_axb: { en: 'ore A times b', es: 'A por b del mineral' },
};

/** The training range of each continuous input of a machine, read from the sampler text of the surrogate's contract; null when the text does not carry the machine. */
export function trainingRanges(sampler: string, machine: string): Record<SurrogateInputName, [number, number]> | null {
  const start = sampler.indexOf(`${machine}: `);
  if (start < 0) return null;
  const rest = sampler.slice(start + machine.length + 2);
  const end = rest.search(/[;)]/);
  const segment = end < 0 ? rest : rest.slice(0, end);
  const out: Partial<Record<SurrogateInputName, [number, number]>> = {};
  for (const m of segment.matchAll(/([a-z0-9_]+) ([0-9.]+) to ([0-9.]+)/g)) {
    out[m[1] as SurrogateInputName] = [Number(m[2]), Number(m[3])];
  }
  const names = Object.keys(INPUT_FIELD) as SurrogateInputName[];
  return names.every((n) => out[n]) ? (out as Record<SurrogateInputName, [number, number]>) : null;
}

/** The inputs of an operating point that lie outside the training ranges. */
export function outsideRanges(op: Operating, ranges: Record<SurrogateInputName, [number, number]>): SurrogateInputName[] {
  return (Object.keys(INPUT_FIELD) as SurrogateInputName[]).filter((name) => {
    const v = op[INPUT_FIELD[name]] as number;
    const [lo, hi] = ranges[name];
    return v < lo || v > hi;
  });
}
