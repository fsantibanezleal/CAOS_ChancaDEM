// The Morrell and CrusherBayes Methodology topics against the committed documents: the held-out power of each survey and the errors
// the prose states (hp500/loo.json), and the contraction the figure draws (hp500/crusherbayes.json).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Hp500CrusherBayes, Hp500Loo } from '../../lib/contract.types';
import { contractionBars, morrellHeldOut, pearson } from './newdata';

const read = <T>(rel: string): T => JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../data/derived/${rel}`, import.meta.url)), 'utf8')) as T;
const cb = read<Hp500CrusherBayes>('hp500/crusherbayes.json');
const loo = read<Hp500Loo>('hp500/loo.json');

describe('the Morrell topic', () => {
  it('draws one group per survey with the measured power and the held-out power of both variants and of B-lin', () => {
    const m = morrellHeldOut(loo);
    expect(m).not.toBeNull();
    if (!m) return;
    expect(m.surveys).toHaveLength(loo.n);
    const p = loo.loo.kW.strict.pred;
    m.surveys.forEach((s, i) => {
      expect(s.measured).toBe(loo.loo.kW.measured[i]);
      expect(s.morrell).toBe(p.Morrell?.[i]);
      expect(s.noload).toBe(p.Morrell_noload?.[i]);
      expect(s.blin).toBe(p.B_lin?.[i]);
    });
  });
  it('states the errors of the document: both variants worse than the setting-only line, the through-origin one the worst', () => {
    const m = morrellHeldOut(loo);
    if (!m) throw new Error('no Morrell fit in hp500/loo.json');
    expect(m.mape.morrell).toBe(loo.loo.kW.strict.Morrell?.mape_pct);
    expect(m.mape.noload).toBe(loo.loo.kW.strict.Morrell_noload?.mape_pct);
    expect(m.mape.blin).toBe(loo.loo.kW.strict.B_lin?.mape_pct);
    expect(m.mape.noload).toBeGreaterThan(m.mape.blin);
    expect(m.mape.morrell).toBeGreaterThan(m.mape.noload);
    // the method card: the measured power falls as the throughput rises (correlation -0.85)
    expect(m.powerThroughputCorr).toBeCloseTo(-0.85, 2);
  });
  it('adversarial: a document without the Morrell fit gives no figure, and series of different lengths throw', () => {
    const bare = structuredClone(loo);
    delete (bare.loo.kW.strict.pred as { Morrell?: number[] }).Morrell;
    expect(morrellHeldOut(bare)).toBeNull();
    const short = structuredClone(loo);
    short.loo.kW.strict.pred.Morrell?.pop();
    expect(() => morrellHeldOut(short)).toThrow(/disagree/);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 12);
  });
});

describe('the CrusherBayes topic', () => {
  it('draws every row of the contraction table, posterior over prior standard deviation', () => {
    const bars = contractionBars(cb);
    expect(bars.map((b) => b.name)).toEqual(cb.contraction.map((r) => r.name));
    bars.forEach((b) => expect(b.posteriorSd / b.priorSd).toBeCloseTo(b.contraction, 2));
  });
  it('adversarial: a contraction that disagrees with its standard deviations throws', () => {
    const bad = structuredClone(cb);
    (bad.contraction[0] as { contraction: number }).contraction = 0.1;
    expect(() => contractionBars(bad)).toThrow(/disagrees/);
  });
});
