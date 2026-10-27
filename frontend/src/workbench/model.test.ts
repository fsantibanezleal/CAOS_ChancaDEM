// The selection model of the App: the operating point a case, the rail and a variant make, and the parity of the live
// engine against the committed replay. Pure functions over the contracts, run on the provider tree.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CaseData } from '../api/artifacts';
import { evaluate } from '../engine/engine';
import type { CaseIndex, CaseManifest, Hp500Loo, Trace } from '../lib/contract.types';
import {
  GROUP_ORDER,
  GROUP_ROWS,
  knobBounds,
  liveT10,
  operatingOf,
  parityOf,
  PARITY_TOLERANCE,
  railMoved,
  rowsFor,
  railOf,
  selectionOf,
  syntheticBand,
  VARIANTS,
} from './model';

const root = new URL('../../../docs/contracts/fixtures/data/derived/', import.meta.url);
const read = <T>(rel: string): T => JSON.parse(readFileSync(new URL(rel, root), 'utf8')) as T;
const index = read<CaseIndex>('manifests/index.json');
const load = (id: string): CaseData => {
  const manifest = read<CaseManifest>(`manifests/${id}.json`);
  return { manifest, trace: read<Trace>(manifest.artifact.path), traceReason: null };
};
const synthetic = load(index.cases.find((c) => c.real_or_synthetic === 'synthetic')!.case_id);
const real = load(index.cases.find((c) => c.real_or_synthetic === 'real')!.case_id);

describe('the operating point of a case', () => {
  it('maps every parameter of the manifest, and marks the calibrated lane only on a calibrated case', () => {
    const p = synthetic.manifest.params;
    const op = operatingOf(p);
    expect(op).toMatchObject({ machine: p.machine, cssMm: p.css_mm, throwMm: p.throw_mm, speedRpm: p.speed_rpm, feedX63Mm: p.feed_x63_mm, feedM: p.feed_m, oreAxb: p.ore_axb, oreWi: p.ore_wi });
    expect(op.calibrated).toBeFalsy();
    expect(operatingOf(real.manifest.params).calibrated).toBe(true);
  });
  it("the rail starts from the manifest and applies on top of it; the Bond index and the machine stay the case's", () => {
    const p = synthetic.manifest.params;
    const rail = railOf(p);
    expect(railMoved(p, rail)).toBe(false);
    const moved = { ...rail, cssMm: rail.cssMm + 3 };
    expect(railMoved(p, moved)).toBe(true);
    const op = operatingOf(p, moved);
    expect(op.cssMm).toBe(p.css_mm + 3);
    expect(op.machine).toBe(p.machine);
    expect(op.oreWi).toBe(p.ore_wi);
  });
  it("a knob always holds its case's own value, however far it lies from the usual range", () => {
    for (const d of [synthetic, real]) {
      const p = d.manifest.params;
      const r = railOf(p);
      for (const [key, b] of Object.entries(knobBounds(p))) {
        const v = r[key as keyof typeof r];
        expect(b.min, key).toBeLessThanOrEqual(v);
        expect(b.max, key).toBeGreaterThanOrEqual(v);
      }
    }
  });
});

describe('the variants', () => {
  it('are the canonical setting, a tight one (CSS 15 percent lower) and an open one (15 percent higher), applied on the rail', () => {
    expect(VARIANTS.map((v) => [v.id, v.cssFactor])).toEqual([
      ['canonical', 1],
      ['tight', 0.85],
      ['open', 1.15],
    ]);
    const p = synthetic.manifest.params;
    const rail = { ...railOf(p), cssMm: 40 };
    expect(operatingOf(p, rail, 0.85).cssMm).toBeCloseTo(34, 12);
    expect(operatingOf(p, rail, 1.15).cssMm).toBeCloseTo(46, 12);
    expect(operatingOf(p, rail, 1.15).speedRpm).toBe(p.speed_rpm);
  });
  it('a tighter setting gives a finer product and an open one a coarser, on the synthetic case', () => {
    const rail = railOf(synthetic.manifest.params);
    const p80 = (id: string) => selectionOf(synthetic, rail, id).result.p80;
    expect(p80('tight')).toBeLessThan(p80('canonical'));
    expect(p80('canonical')).toBeLessThan(p80('open'));
  });
  it('the real case says its variants are a calibrated what-if, in both languages', () => {
    for (const v of VARIANTS) {
      expect(v.note(real.manifest).en).toMatch(/calibrated/i);
      expect(v.note(real.manifest).es).toMatch(/calibrad/i);
      expect(v.note(synthetic.manifest).en).not.toMatch(/calibrated what-if/i);
    }
  });
});

describe('the selection', () => {
  it("at the canonical variant and the baked rail, the live result is the manifest's result", () => {
    for (const d of [synthetic, real]) {
      const sel = selectionOf(d, railOf(d.manifest.params), 'canonical');
      expect(sel.result.p80).toBeCloseTo(d.manifest.metrics.p80_mm, 3);
      expect(sel.result.throughputTph).toBeCloseTo(d.manifest.metrics.throughput_tph, 1);
      expect(sel.baked.result.p80).toBe(sel.result.p80);
    }
  });
  it("the replay lane does not move with the rail: the baked result is the engine at the manifest's parameters", () => {
    const d = synthetic;
    const sel = selectionOf(d, { ...railOf(d.manifest.params), cssMm: 55 }, 'canonical');
    expect(sel.baked.result.p80).toBe(evaluate(operatingOf(d.manifest.params)).p80);
    expect(sel.result.p80).not.toBe(sel.baked.result.p80);
  });
  it('an out-of-envelope point carries its flag codes and never an empty list', () => {
    const d = synthetic;
    const sel = selectionOf(d, { ...railOf(d.manifest.params), cssMm: 300 }, 'canonical');
    expect(sel.result.outOfEnvelope).toBe(true);
    expect(sel.flags.length).toBeGreaterThan(0);
  });
  it("the t10 of the live point at the baked rail is the trace's", () => {
    const d = real;
    const sel = selectionOf(d, railOf(d.manifest.params), 'canonical');
    expect(Math.abs(liveT10(sel.op, sel.result.f80) - d.trace!.appearance_t10)).toBeLessThan(5e-6);
  });
});

describe('the rows each group reads', () => {
  it('there is one list per group of the App, in the order the tab row shows them, and one for the write-up', () => {
    expect(GROUP_ORDER).toEqual(['chamber', 'product', 'performance', 'learned', 'validation']);
    expect(Object.keys(GROUP_ROWS)).toEqual([...GROUP_ORDER, 'context']);
    for (const rows of Object.values(GROUP_ROWS)) expect(rows.length).toBeGreaterThan(0);
  });
  it('the HP500 validation is a row of a real survey only', () => {
    expect(rowsFor('performance', true)).toContain('hp500-loo');
    expect(rowsFor('performance', false)).not.toContain('hp500-loo');
    expect(rowsFor('learned', false)).toEqual(GROUP_ROWS.learned);
  });
});

describe('live against replay', () => {
  const edges = synthetic.trace!.product_passing;
  it('the largest absolute difference is found where it is', () => {
    const live = edges.map((v, i) => (i === 7 ? v + 0.0004 : v));
    const p = parityOf(live, edges);
    expect(p.worst).toBeCloseTo(0.0004, 12);
    expect(p.at).toBe(7);
  });
  it('adversarial: a planted difference above 1e-6 is a defect, never rounded away; one below it passes', () => {
    expect(PARITY_TOLERANCE).toBe(1e-6);
    expect(parityOf(edges.map((v, i) => (i === 3 ? v + 2e-6 : v)), edges).ok).toBe(false);
    expect(parityOf(edges.map((v, i) => (i === 3 ? v + 5e-7 : v)), edges).ok).toBe(true);
    expect(parityOf(edges, edges)).toEqual({ worst: 0, at: 0, ok: true });
  });
  it('arrays of different lengths are a defect', () => {
    expect(parityOf(edges.slice(1), edges).ok).toBe(false);
  });
  it('the live engine at the baked parameters is within the trace rounding of the committed gradation', () => {
    for (const d of [synthetic, real]) {
      const live = evaluate(operatingOf(d.manifest.params)).product.passing;
      expect(parityOf(live, d.trace!.product_passing).worst).toBeLessThan(5e-6);
    }
  });
});

describe('the lower-bound band of a synthetic case (BL-017)', () => {
  const looDoc = read<Hp500Loo>('hp500/loo.json');
  const ready = { state: 'ready' as const, data: looDoc };
  const unavailable = { state: 'unavailable' as const, reason: { en: 'The validation document is not in this build.', es: 'El documento de validación no está en esta versión.' } };

  it('a cone-sec throughput band is the value times the relative half-width read from the document, labelled as a lower bound in both languages', () => {
    const rel = looDoc.loo.tph.strict.uq.band_rel_pct;
    const b = syntheticBand('cone-sec', ready, 'tph', 1234.5);
    expect(b.kind).toBe('band');
    if (b.kind !== 'band') return;
    expect(b.halfWidth).toBeCloseTo((1234.5 * rel) / 100, 9);
    expect(b.relPct).toBe(rel);
    expect(b.label.en).toMatch(/at least/i);
    expect(b.label.en).toContain(rel.toFixed(1));
    expect(b.label.en).toMatch(/calibrated/i);
    expect(b.label.es).toMatch(/al menos/i);
    expect(b.label.es).toContain(rel.toFixed(1).replace('.', ','));
    expect(b.label.es).toMatch(/calibrad/i);
  });
  it('the power band reads the power target of the document, not the throughput one', () => {
    const b = syntheticBand('cone-sec', ready, 'kW', 500);
    expect(b.kind === 'band' && b.halfWidth).toBeCloseTo((500 * looDoc.loo.kW.strict.uq.band_rel_pct) / 100, 9);
    expect(looDoc.loo.kW.strict.uq.band_rel_pct).not.toBe(looDoc.loo.tph.strict.uq.band_rel_pct);
  });
  it('a document with other numbers moves the band: nothing is copied into code', () => {
    const other = JSON.parse(JSON.stringify(looDoc)) as { loo: { tph: { strict: { uq: { band_rel_pct: number } } } } };
    other.loo.tph.strict.uq.band_rel_pct = 7.5;
    const b = syntheticBand('cone-sec', { state: 'ready', data: other as unknown as Hp500Loo }, 'tph', 200);
    expect(b.kind === 'band' && b.halfWidth).toBeCloseTo(15, 9);
  });
  it.each(['jaw', 'gyratory', 'cone-tert', 'cone-short-head'] as const)('%s never shows a band, and says there are no measured data for the machine type', (m) => {
    const b = syntheticBand(m, ready, 'tph', 1000);
    expect(b.kind).toBe('none');
    if (b.kind !== 'none') return;
    expect(b.reason.en).toMatch(/no measured data/i);
    expect(b.reason.es).toMatch(/no hay datos medidos/i);
  });
  it('a missing or stale document gives no band and the reason of the readiness', () => {
    const b = syntheticBand('cone-sec', unavailable, 'tph', 1000);
    expect(b.kind).toBe('none');
    if (b.kind !== 'none') return;
    expect(b.reason.en).toContain('validation document is not in this build');
    expect(b.reason.es).toContain('documento de validación');
    expect(syntheticBand('cone-sec', null, 'tph', 1000).kind).toBe('none');
    expect(syntheticBand('cone-sec', { state: 'loading' }, 'tph', 1000).kind).toBe('none');
    expect(syntheticBand('cone-sec', { state: 'error', error: 'x' }, 'tph', 1000).kind).toBe('none');
  });
  it('the readiness rows of a banded synthetic case include the HP500 validation', () => {
    expect(rowsFor('performance', false, true)).toContain('hp500-loo');
    expect(rowsFor('performance', false, false)).not.toContain('hp500-loo');
  });
});
