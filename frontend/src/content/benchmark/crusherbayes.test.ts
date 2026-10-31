// The CrusherBayes view's arithmetic against the committed document: the convergence label, the intervals and the contraction classes.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Hp500CrusherBayes, Hp500Loo } from '../../lib/contract.types';
import { classifyContraction, convergenceText, intervalPoints, notConverged } from './data';

const read = <T>(rel: string): T => JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../data/derived/${rel}`, import.meta.url)), 'utf8')) as T;
const cb = read<Hp500CrusherBayes>('hp500/crusherbayes.json');
const loo = read<Hp500Loo>('hp500/loo.json');

describe('the CrusherBayes view', () => {
  it('labels exactly the posteriors the document records as not converged, in both languages', () => {
    const bad = cb.convergence.folds.filter((f) => !f.converged);
    expect(notConverged(cb)).toEqual(bad.map((f) => f.fold));
    expect(convergenceText(cb, 'en') === null).toBe(bad.length === 0);
    expect(convergenceText(cb, 'es') === null).toBe(bad.length === 0);
  });
  it('adversarial: a posterior flipped to not converged is labelled, one flipped back is not', () => {
    const flipped = structuredClone(cb);
    flipped.convergence.folds.forEach((f) => (f.converged = true));
    expect(convergenceText(flipped, 'en')).toBeNull();
    flipped.convergence.folds[2].converged = false;
    expect(convergenceText(flipped, 'en')).toContain('1 of');
    expect(convergenceText(flipped, 'es')).toContain('1 de');
  });
  it('the intervals carry the measurement of hp500/loo.json and one point per survey; a disagreement throws', () => {
    for (const target of ['tph', 'kW'] as const) {
      const pts = intervalPoints(cb, loo, target);
      expect(pts).toHaveLength(cb.n);
      pts.forEach((p) => expect(p.lo).toBeLessThanOrEqual(p.hi));
      expect(pts.every((p) => p.calLo !== null)).toBe(true);
    }
    const bad = structuredClone(loo);
    bad.loo.kW.measured[0] += 1;
    expect(() => intervalPoints(cb, bad, 'kW')).toThrow(/disagree/);
    expect(intervalPoints(cb, null, 'kW')[0].calLo).toBeNull();
  });
  it('the contraction classes follow the document note: under 0.5 identified, 0.9 and over at the prior', () => {
    expect(classifyContraction(0.44)).toBe('identified');
    expect(classifyContraction(0.7)).toBe('weak');
    expect(classifyContraction(1.0)).toBe('prior');
  });
});
