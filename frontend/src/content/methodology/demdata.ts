// The numbers of the Methodology topic on the particle simulation, read from the committed document dem/jaw-lab.json (catalog row
// dem-run) by pure functions, so the prose, the table and the figure of the topic are tested against the document and never typed.
import type { DemRun } from '../../lib/contract.types';

export type DemPoint = DemRun['points'][number];
export type DemQuantity = 'throughput' | 'net_power' | 'reduction_ratio';
export type DemPair = 'simulation_vs_measured' | 'population_balance_vs_measured' | 'population_balance_vs_simulation';
export type DemVerdictWord = 'met' | 'not met' | 'not compared';

export const QUANTITIES: readonly DemQuantity[] = ['throughput', 'net_power', 'reduction_ratio'];
export const PAIRS: readonly DemPair[] = ['simulation_vs_measured', 'population_balance_vs_measured', 'population_balance_vs_simulation'];

/** The reason a verdict is not compared, in the reader's words (the basis of the document). */
export const BASIS_TEXT: Record<string, { en: string; es: string }> = {
  run_incomplete: { en: 'the particle run did not complete', es: 'la corrida de partículas no se completó' },
  no_window: { en: 'the run holds no steady window', es: 'la corrida no tiene una ventana estacionaria' },
  no_work_index: { en: 'no work index of the ore is published', es: 'no hay un índice de trabajo del mineral publicado' },
  nothing_passed: { en: 'no mass passed the discharge', es: 'no pasó masa por la descarga' },
};

export interface VerdictCounts {
  met: number;
  notMet: number;
  notCompared: number;
  total: number;
}

const tally = (words: DemVerdictWord[]): VerdictCounts => ({
  met: words.filter((w) => w === 'met').length,
  notMet: words.filter((w) => w === 'not met').length,
  notCompared: words.filter((w) => w === 'not compared').length,
  total: words.length,
});

/** Every verdict of the document (three points, three pairs of sides, three quantities), optionally of one pair of sides. */
export function verdictCounts(doc: DemRun, pair?: DemPair): VerdictCounts {
  const words: DemVerdictWord[] = [];
  for (const p of doc.points) {
    for (const k of pair ? [pair] : PAIRS) for (const q of QUANTITIES) words.push(p.verdicts[k][q].verdict);
  }
  return tally(words);
}

/** The points whose particle run did not complete, in the document's order. */
export function incompletePoints(doc: DemRun): DemPoint[] {
  return doc.points.filter((p) => p.simulation.status !== 'complete');
}

/** The first of the document's overlap limits at which the run of a point completed, or null when it never did. */
export function completingLimit(p: DemPoint): number | null {
  const hit = p.simulation.attempts.find((a) => a.status === 'complete');
  return hit ? hit.max_overlap_fraction : null;
}

export interface ErrorBar {
  id: string;
  pointId: string;
  feedClass: string;
  side: 'simulation' | 'population_balance';
  quantity: DemQuantity;
  /** Relative error against the measurement in percent, null when the verdict is not compared. */
  errorPct: number | null;
  band: number;
  verdict: DemVerdictWord;
  basis: string | null;
}

/** One bar per point, side (particle simulation, population balance) and quantity: the relative error against the measurement. */
export function errorBars(doc: DemRun): ErrorBar[] {
  const out: ErrorBar[] = [];
  for (const p of doc.points) {
    for (const q of QUANTITIES) {
      for (const [side, pair] of [['simulation', 'simulation_vs_measured'], ['population_balance', 'population_balance_vs_measured']] as const) {
        const v = p.verdicts[pair][q];
        out.push({
          id: `${p.id}-${side}-${q}`,
          pointId: p.id,
          feedClass: p.feed_class,
          side,
          quantity: q,
          errorPct: v.verdict === 'not compared' || v.relative_error === null ? null : v.relative_error * 100,
          band: v.band,
          verdict: v.verdict,
          basis: v.basis,
        });
      }
    }
  }
  return out;
}

/** The ratio of the energy the swing plate delivers per kilogram in the steady window to the measured one, null without a window. */
export function energyShareOfMeasured(p: DemPoint): number | null {
  const e = p.simulation.specific_energy_j_kg;
  return e === null ? null : e / p.measured.specific_energy_j_kg;
}

/** The ratio of the simulated throughput of the window to the measured one, null without a window. */
export function throughputRatio(p: DemPoint): number | null {
  const q = p.simulation.throughput_kg_h;
  return q === null ? null : q / p.measured.throughput_kg_h.value;
}

/** The share of the strokes of the steady window that ran above the reference overlap, null without a window. */
export function windowOverlapShare(p: DemPoint): { above: number; strokes: number } | null {
  const w = p.simulation.window;
  const a = p.simulation.window_strokes_above_overlap_reference;
  return w && a !== null ? { above: a, strokes: w.strokes } : null;
}

/** The share of the energy absorbed by the particles that the replacements injected back, null when nothing was absorbed. */
export function injectedShare(p: DemPoint): number | null {
  const b = p.simulation.breakage;
  return b.absorbed_energy_j > 0 ? b.injected_energy_j / b.absorbed_energy_j : null;
}
