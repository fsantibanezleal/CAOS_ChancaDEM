// The Experiments page's data functions, run on the committed artifacts themselves (data/derived): the checks hold the statements the page
// makes in its prose, so a regenerated artifact that breaks one of them fails here and not on the reader's screen.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CaseData } from '../../api/artifacts';
import type { CaseManifest, CaseIndex, Hp500Loo, Trace } from '../../lib/contract.types';
import { casesOf, classOf, coverage, elasticity, familyOf, FAMILIES, pearson, risesAlong, settingRow, speedRow, surveysOf, throwRange, throwSweep, vertex } from './data';

const DERIVED = new URL('../../../../data/derived/', import.meta.url);
const read = <T>(rel: string): T => JSON.parse(readFileSync(new URL(rel, DERIVED), 'utf8')) as T;

const index = read<CaseIndex>('manifests/index.json');
const cases: CaseData[] = index.cases.map((c) => {
  const manifest = read<CaseManifest>(`manifests/${c.case_id}.json`);
  return { manifest, trace: read<Trace>(manifest.artifact.path), traceReason: null };
});
const loo = read<Hp500Loo>('hp500/loo.json');
const byId = (id: string) => cases.find((c) => c.manifest.case_id === id)!;

describe('the machine families', () => {
  it('put every non-control case in exactly one family and no control in any', () => {
    for (const c of cases) {
      const f = familyOf(c);
      if (c.manifest.control) expect(f).toBeNull();
      else expect(FAMILIES.map((x) => x.id)).toContain(f);
    }
  });

  it('hold the ten surveys as one family', () => {
    expect(casesOf(cases, 'hp500')).toHaveLength(10);
  });
});

describe('the closed-side setting sweeps', () => {
  it('rise in P80 and in throughput at every step, in every case', () => {
    for (const c of cases) expect(settingRow(c)?.rises, c.manifest.case_id).toBe(true);
  });

  it('read the elasticity of a power law exactly', () => {
    const x = [1, 2, 4, 8];
    expect(elasticity(x, x.map((v) => 3 * v ** 0.7))).toBeCloseTo(0.7, 12);
  });
});

describe('the speed sweeps', () => {
  it('find the apex of a parabola exactly and the sample itself at an end', () => {
    const x = [0, 1, 2, 3, 4];
    expect(vertex(x, x.map((v) => 10 - (v - 2.3) ** 2))).toBeCloseTo(2.3, 12);
    expect(vertex(x, x.map((v) => v))).toBe(4);
  });

  it('agree with the engine design optimum to within one percent for every case', () => {
    for (const c of cases) {
      const r = speedRow(c)!;
      expect(Math.abs(r.apex / r.engineApex - 1), c.manifest.case_id).toBeLessThan(0.01);
    }
  });

  it('never put the case above its own sweep peak', () => {
    for (const c of cases) expect(speedRow(c)!.lossPct, c.manifest.case_id).toBeGreaterThanOrEqual(-1e-9);
  });
});

describe('the throw range', () => {
  const s01 = throwSweep(byId('S01'));
  const hp = throwSweep(byId('HP500-01'));

  it('covers the knob range in whole millimetres', () => {
    const r = throwRange();
    expect(r[0]).toBe(8);
    expect(r[r.length - 1]).toBe(50);
    expect(s01).toHaveLength(r.length);
  });

  it('coarsens the product and raises the capacity as the throw widens on the synthetic lane', () => {
    expect(risesAlong(s01.map((p) => p.p80))).toBe(true);
    expect(risesAlong(s01.map((p) => p.tph))).toBe(true);
    expect(s01[s01.length - 1].p80).toBeGreaterThan(s01[0].p80);
  });

  it('leaves the product alone on the calibrated lane while the capacity still moves', () => {
    expect(new Set(hp.map((p) => p.p80.toFixed(6))).size).toBe(1);
    expect(hp[hp.length - 1].tph).toBeGreaterThan(hp[0].tph);
  });

  it('reproduces the committed replay at the case own throw', () => {
    const own = byId('S01').manifest.params.throw_mm;
    const p = s01.find((x) => x.throwMm === own)!;
    expect(Math.abs(p.p80 / byId('S01').trace!.summary.p80_mm - 1)).toBeLessThan(5e-6);
  });
});

describe('the ten surveys', () => {
  const surveys = surveysOf(cases);

  it('are numbered 1 to 10 and match the validation document', () => {
    expect(surveys.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(surveys.map((s) => s.feedTph)).toEqual(loo.loo.tph.measured);
    expect(surveys.map((s) => s.powerKw)).toEqual(loo.loo.kW.measured);
  });

  it('classify f80 into equal-width classes', () => {
    expect(classOf(47, 47, 140, 3)).toBe(0);
    expect(classOf(140, 47, 140, 3)).toBe(2);
    expect(classOf(90, 47, 140, 3)).toBe(1);
  });

  it('have a defined correlation', () => {
    expect(Number.isFinite(pearson(surveys.map((s) => s.css), surveys.map((s) => s.feedTph)))).toBe(true);
  });
});

describe('the predictive band', () => {
  it('covers the share of surveys the document states', () => {
    for (const target of ['tph', 'kW'] as const) {
      const c = coverage(loo, target);
      expect(c.count / loo.n, target).toBeCloseTo(loo.loo[target].strict.uq.empirical_coverage, 6);
    }
  });

  it('records the nested, out-of-sample coverage as the share of its per-survey verdicts, with the sigma of the other surveys', () => {
    for (const target of ['tph', 'kW'] as const) {
      const uq = loo.loo[target].strict.uq;
      const t = loo.loo[target];
      expect(uq.nested_covered?.length, target).toBe(loo.n);
      expect(uq.nested_sigma?.length, target).toBe(loo.n);
      expect(uq.nested_covered!.filter(Boolean).length / loo.n, target).toBeCloseTo(uq.nested_coverage!, 3);
      uq.nested_covered!.forEach((covered, i) => {
        const others = t.measured.map((y, k) => y - t.strict.pred.M0[k]).filter((_, k) => k !== i);
        const mean = others.reduce((a, b) => a + b, 0) / others.length;
        const sigma = Math.sqrt(others.reduce((a, b) => a + (b - mean) ** 2, 0) / (others.length - 1));
        expect(uq.nested_sigma![i], `${target} ${i}`).toBeCloseTo(sigma, 1);
        expect(covered, `${target} ${i}`).toBe(Math.abs(t.measured[i] - t.strict.pred.M0[i]) <= 1.2816 * sigma);
      });
    }
  });
});
