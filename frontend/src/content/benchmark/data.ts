// The Benchmark page's arithmetic over the committed documents: pure functions, no React, so the test runs them in node. Every
// number the page shows is read from hp500/loo.json, hp500/backbone.json, model-metrics.json, the surrogate contract or the
// manifests; what is computed here is a difference, a rank or a distance of those numbers, never a figure typed in.
import { HP500_ENVELOPE } from '../../engine/envelope';
import type { Hp500Backbone, Hp500CrusherBayes, Hp500Loo, Text } from '../../lib/contract.types';

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

/**
 * The models hp500-loo 1.2.0 adds to the folds, all optional in the document: the setting-only line on both measured targets, Morrell's
 * two variants on power. A model absent for a target is absent from its rows, never drawn as a zero.
 */
export const EXTRA_MODELS = ['B_lin', 'Morrell', 'Morrell_noload'] as const;
export type ExtraKey = (typeof EXTRA_MODELS)[number];
export type RowKey = ModelKey | ExtraKey;

export const EXTRA_LABEL: Record<ExtraKey, Text> = {
  B_lin: { en: 'B-lin setting-only line', es: 'B-lin línea solo de la abertura' },
  Morrell: { en: 'Morrell size-specific energy', es: 'Morrell energía específica por tamaño' },
  Morrell_noload: { en: 'Morrell with a no-load term (descriptive line)', es: 'Morrell con término en vacío (línea descriptiva)' },
};
export const EXTRA_SHORT: Record<ExtraKey, Text> = {
  B_lin: { en: 'B-lin', es: 'B-lin' },
  Morrell: { en: 'Morrell', es: 'Morrell' },
  Morrell_noload: { en: 'Morrell + no-load', es: 'Morrell + vacío' },
};

export const ROW_LABEL: Record<RowKey, Text> = { ...MODEL_LABEL, ...EXTRA_LABEL };
export const ROW_SHORT: Record<RowKey, Text> = { ...MODEL_SHORT, ...EXTRA_SHORT };

/** The scores of an added model on a target and fold; null when the document does not carry it for that target. */
export function extraScores(loo: Hp500Loo, target: Target, fold: Fold, model: ExtraKey) {
  return loo.loo[target][fold][model] ?? null;
}

/** The rows of a target: the five models of the document, then each added model the document carries for that target. */
export function rowsFor(loo: Hp500Loo, target: Target): RowKey[] {
  return [...MODELS, ...EXTRA_MODELS.filter((m) => extraScores(loo, target, 'strict', m) !== null)];
}

/** The strict scores of any row; null for an added model the document lacks for the target. */
export function strictScores(loo: Hp500Loo, target: Target, row: RowKey) {
  return (EXTRA_MODELS as readonly string[]).includes(row) ? extraScores(loo, target, 'strict', row as ExtraKey) : scoresOf(loo, target, 'strict', row as ModelKey);
}

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

/** One survey of the CrusherBayes view: the measurement, the posterior predictive mean with its 80 percent interval, and the CrusherCal band around the backbone. */
export interface IntervalPoint {
  n: number;
  measured: number;
  mean: number;
  lo: number;
  hi: number;
  /** The CrusherCal strict band, M0 plus and minus the half-width; null when hp500-loo does not carry it for the target. */
  calLo: number | null;
  calHi: number | null;
  insideBayes: boolean;
}

/** The held-out intervals of one target, per survey. Throws when the two documents disagree on a measurement or on n. */
export function intervalPoints(cb: Hp500CrusherBayes, loo: Hp500Loo | null, target: 'tph' | 'kW'): IntervalPoint[] {
  const t = cb.loo[target];
  if (t.measured.length !== cb.n) throw new Error(`hp500/crusherbayes.json: ${target} holds ${t.measured.length} surveys, n is ${cb.n}`);
  if (loo && loo.loo[target].measured.some((m, i) => m !== t.measured[i])) {
    throw new Error(`hp500/crusherbayes.json and hp500/loo.json disagree on the measured ${target}`);
  }
  return t.measured.map((measured, i) => {
    const band = loo ? bandFor(loo, target, i + 1) : null;
    return {
      n: i + 1,
      measured,
      mean: t.pred_mean[i],
      lo: t.lo80[i],
      hi: t.hi80[i],
      calLo: band ? band.lo : null,
      calHi: band ? band.hi : null,
      insideBayes: measured >= t.lo80[i] && measured <= t.hi80[i],
    };
  });
}

/** The posteriors the sampler did not converge on, by held-out survey number (or `all`). Empty when every one converged. */
export function notConverged(cb: Hp500CrusherBayes): Array<number | 'all'> {
  return cb.convergence.folds.filter((f) => !f.converged).map((f) => f.fold);
}

/** The sentence that labels the numbers of a posterior set that did not converge, in one language; null when every posterior converged. */
export function convergenceText(cb: Hp500CrusherBayes, lang: 'en' | 'es'): string | null {
  const bad = notConverged(cb);
  if (!bad.length) return null;
  const names = bad.map((x) => (x === 'all' ? (lang === 'es' ? 'el ajuste con los diez' : 'the fit to all ten') : String(x))).join(', ');
  const total = cb.convergence.folds.length;
  return lang === 'es'
    ? `Posteriores sin converger: ${bad.length} de ${total} (${names}). Las cifras de CrusherBayes se leen con esa marca.`
    : `Posteriors not converged: ${bad.length} of ${total} (${names}). Read every CrusherBayes figure with that flag.`;
}

/** What the surveys identify: a parameter whose posterior is below half its prior in width, per the document's own note (below 0.5). */
export const IDENTIFIED_BELOW = 0.5;
/** A parameter the surveys leave at its prior: contraction at or above this. */
export const PRIOR_DOMINATED_FROM = 0.9;
export type ContractionClass = 'identified' | 'weak' | 'prior';
export function classifyContraction(c: number): ContractionClass {
  return c < IDENTIFIED_BELOW ? 'identified' : c >= PRIOR_DOMINATED_FROM ? 'prior' : 'weak';
}
