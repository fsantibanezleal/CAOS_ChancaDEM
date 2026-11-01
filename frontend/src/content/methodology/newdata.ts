// The numbers of the Morrell and CrusherBayes Methodology topics, read from the committed documents (hp500-loo 1.2.0 and
// hp500-crusherbayes 1.0.0) by pure functions, so the prose and the figures of the two topics are tested against the documents.
import type { Hp500CrusherBayes, Hp500Loo } from '../../lib/contract.types';

/** The Pearson correlation of two series of the same length. */
export function pearson(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 2) throw new Error('pearson: two series of the same length, at least two points');
  const ma = a.reduce((s, v) => s + v, 0) / a.length;
  const mb = b.reduce((s, v) => s + v, 0) / b.length;
  let ab = 0;
  let aa = 0;
  let bb = 0;
  a.forEach((v, i) => {
    ab += (v - ma) * (b[i] - mb);
    aa += (v - ma) ** 2;
    bb += (b[i] - mb) ** 2;
  });
  return ab / Math.sqrt(aa * bb);
}

/** One survey of the Morrell figure: the measured power and the held-out power of each variant and of the setting-only line. */
export interface MorrellSurvey {
  n: number;
  measured: number;
  morrell: number;
  noload: number;
  blin: number;
}

export interface MorrellHeldOut {
  surveys: MorrellSurvey[];
  /** Held-out power MAPE in percent: through the origin, with the no-load term, the setting-only line, the Bond backbone. */
  mape: { morrell: number; noload: number; blin: number; m0: number };
  /** The correlation of the measured power with the measured throughput over the surveys. */
  powerThroughputCorr: number;
}

/** The held-out Morrell numbers of hp500/loo.json (strict, power), or null when the document carries no Morrell fit. */
export function morrellHeldOut(loo: Hp500Loo): MorrellHeldOut | null {
  const s = loo.loo.kW.strict;
  const p = s.pred;
  if (!p.Morrell || !p.Morrell_noload || !p.B_lin || !s.Morrell || !s.Morrell_noload || !s.B_lin) return null;
  const measured = loo.loo.kW.measured;
  const tph = loo.loo.tph.measured;
  if ([p.Morrell, p.Morrell_noload, p.B_lin, tph].some((v) => v.length !== measured.length)) throw new Error('morrellHeldOut: the series of hp500/loo.json disagree in length');
  const { Morrell, Morrell_noload, B_lin } = p;
  return {
    surveys: measured.map((m, i) => ({ n: i + 1, measured: m, morrell: Morrell[i], noload: Morrell_noload[i], blin: B_lin[i] })),
    mape: { morrell: s.Morrell.mape_pct, noload: s.Morrell_noload.mape_pct, blin: s.B_lin.mape_pct, m0: s.M0_backbone.mape_pct },
    powerThroughputCorr: pearson(measured, tph),
  };
}

/** One sampled scalar of CrusherBayes: its prior and posterior standard deviations (fit to all ten surveys) and their ratio. */
export interface ContractionBar {
  name: string;
  priorSd: number;
  posteriorSd: number;
  contraction: number;
}

/**
 * The rows of the contraction table in the document's order: the engine scalars, the noise scales and the discrepancy coefficients.
 * A ratio that disagrees with the two standard deviations it is made of throws.
 */
export function contractionBars(cb: Hp500CrusherBayes): ContractionBar[] {
  return cb.contraction.map((r) => {
    if (Math.abs(r.posterior_sd / r.prior_sd - r.contraction) > 0.01) throw new Error(`contractionBars: ${r.name} has a contraction that disagrees with its standard deviations`);
    return { name: r.name, priorSd: r.prior_sd, posteriorSd: r.posterior_sd, contraction: r.contraction };
  });
}
