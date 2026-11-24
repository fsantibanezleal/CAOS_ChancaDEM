// The Methodology topic on the particle simulation against the committed document dem/jaw-lab.json: the counts, the bars and the
// ratios the prose states are the document's, and the qualitative sentences of the topic (which side is high, which run stopped) hold.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DemRun } from '../../lib/contract.types';
import { PAIRS, QUANTITIES, completingLimit, energyShareOfMeasured, errorBars, incompletePoints, injectedShare, throughputRatio, verdictCounts, windowOverlapShare } from './demdata';

const doc = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../data/derived/dem/jaw-lab.json', import.meta.url)), 'utf8')) as DemRun;
const point = (id: string) => {
  const p = doc.points.find((x) => x.id === id);
  if (!p) throw new Error(`no point ${id}`);
  return p;
};

describe('the verdict counts of the topic', () => {
  it('count the three quantities of the three pairs of sides at the three points, every verdict once', () => {
    const c = verdictCounts(doc);
    expect(c.total).toBe(doc.points.length * PAIRS.length * QUANTITIES.length);
    expect(c.met + c.notMet + c.notCompared).toBe(c.total);
    const byPair = PAIRS.map((p) => verdictCounts(doc, p));
    expect(byPair.reduce((s, x) => s + x.met, 0)).toBe(c.met);
    expect(byPair.reduce((s, x) => s + x.notMet, 0)).toBe(c.notMet);
    expect(byPair.reduce((s, x) => s + x.notCompared, 0)).toBe(c.notCompared);
  });
  it('adversarial: a verdict changed in a copy of the document moves the counts', () => {
    const copy = structuredClone(doc) as { -readonly [K in keyof DemRun]: DemRun[K] };
    const before = verdictCounts(copy);
    const v = copy.points[0].verdicts.simulation_vs_measured.throughput as { verdict: string };
    v.verdict = v.verdict === 'met' ? 'not met' : 'met';
    expect(verdictCounts(copy)).not.toEqual(before);
  });
});

describe('the sentences of the topic about the result', () => {
  it('the document is partial and the incomplete runs are the ones the document lists', () => {
    expect(doc.state).toBe('partial');
    expect(incompletePoints(doc).map((p) => p.id)).toEqual(doc.incomplete);
  });
  it('the run of the middle feed stops with the overlap error at both limits and states no window statistic', () => {
    const p = point('31.5-26.5');
    expect(p.simulation.status).toBe('overlap_error');
    expect(p.simulation.attempts.map((a) => a.status)).toEqual(['overlap_error', 'overlap_error']);
    expect(completingLimit(p)).toBeNull();
    expect(p.simulation.throughput_kg_h).toBeNull();
    expect(p.simulation.net_power_kw).toBeNull();
    for (const q of QUANTITIES) expect(p.verdicts.simulation_vs_measured[q].verdict).toBe('not compared');
  });
  it('the two completed runs complete at the second overlap limit and pass the batch faster than the measurement', () => {
    for (const id of ['63-52', '16-13.2']) {
      const p = point(id);
      expect(p.simulation.status).toBe('complete');
      expect(completingLimit(p)).toBe(doc.settings.overlap_ladder[1]);
      expect(throughputRatio(p) ?? 0).toBeGreaterThan(1.5);
      expect(p.verdicts.simulation_vs_measured.throughput.verdict).toBe('not met');
      expect(p.verdicts.simulation_vs_measured.reduction_ratio.verdict).toBe('not met');
      expect(p.verdicts.simulation_vs_measured.net_power.verdict).toBe('met');
    }
  });
  it('the energy per kilogram of the completed runs is a fraction of the measured one: the net power is met with a fast machine', () => {
    for (const id of ['63-52', '16-13.2']) expect(energyShareOfMeasured(point(id)) ?? 1).toBeLessThan(0.5);
  });
  it('the 63/52 run holds the product coarser than the measured one, and nine spheres above the open side passed', () => {
    const p = point('63-52');
    expect(p.simulation.p80_mm ?? 0).toBeGreaterThan(p.measured.p80_mm);
    expect(p.simulation.spheres_above_open_side).toBeGreaterThan(0);
    expect(p.simulation.largest_product_mm ?? 0).toBeGreaterThan(doc.settings.oss_mm);
    const w = windowOverlapShare(p);
    expect(w).not.toBeNull();
    expect((w?.above ?? 0) / (w?.strokes ?? 1)).toBeGreaterThan(0.5);
  });
  it('the population balance throughput is below the measured one at the three points and it states no power', () => {
    for (const p of doc.points) {
      expect(p.population_balance.throughput_kg_h).toBeLessThan(p.measured.throughput_kg_h.value);
      expect(p.verdicts.population_balance_vs_measured.throughput.verdict).toBe('not met');
      expect(p.verdicts.population_balance_vs_measured.net_power.verdict).toBe('not compared');
      expect(p.verdicts.population_balance_vs_measured.net_power.basis).toBe('no_work_index');
    }
  });
  it('the population balance reduction ratio is inside the band at the middle feed only', () => {
    const met = doc.points.filter((p) => p.verdicts.population_balance_vs_measured.reduction_ratio.verdict === 'met').map((p) => p.id);
    expect(met).toEqual(['31.5-26.5']);
  });
  it('the replacements inject a small share of the energy the particles absorbed', () => {
    for (const id of ['63-52', '16-13.2']) expect(injectedShare(point(id)) ?? 1).toBeLessThan(0.1);
  });
});

describe('the bars of the figure', () => {
  const bars = errorBars(doc);
  it('are one per point, side and quantity, with the error of the document in percent', () => {
    expect(bars).toHaveLength(doc.points.length * 2 * QUANTITIES.length);
    const b = bars.find((x) => x.id === '63-52-simulation-throughput');
    expect(b?.errorPct).toBeCloseTo((point('63-52').verdicts.simulation_vs_measured.throughput.relative_error ?? 0) * 100, 9);
    expect(b?.verdict).toBe('not met');
  });
  it('draw no bar for a verdict that is not compared', () => {
    for (const b of bars.filter((x) => x.verdict === 'not compared')) expect(b.errorPct).toBeNull();
    for (const b of bars.filter((x) => x.verdict !== 'not compared')) expect(b.errorPct).not.toBeNull();
  });
});
