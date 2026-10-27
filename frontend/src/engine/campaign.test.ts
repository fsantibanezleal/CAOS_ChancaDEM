// The campaign functions against the shared table tests/fixtures/campaign-reference.json (written by tests/test_campaign.py from the
// canonical Python engine, schema chancadem.campaign-reference/v1): cssAtP80Target must reproduce every row to 1e-6 mm, and the engine's
// own P80 at the returned setting must be the target, which does not use the file.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cssAtP80Target, hoursToTarget } from './campaign';
import { evaluate } from './engine';
import type { Operating } from './types';

interface Row {
  id: string;
  op: { machine: Operating['machine']; css_mm: number; throw_mm: number; speed_rpm: number; feed_x63_mm: number; feed_m: number; ore_axb: number; ore_wi: number; calibrated: boolean };
  p80_target_mm: number;
  css_max_mm: number;
  css_target_mm: number | null;
}
const FIXTURE = fileURLToPath(new URL('../../../tests/fixtures/campaign-reference.json', import.meta.url));
const doc = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { schema: string; rows: Row[] };
const opOf = (o: Row['op']): Operating => ({ machine: o.machine, cssMm: o.css_mm, throwMm: o.throw_mm, speedRpm: o.speed_rpm, feedX63Mm: o.feed_x63_mm, feedM: o.feed_m, oreAxb: o.ore_axb, oreWi: o.ore_wi, calibrated: o.calibrated });
const BASE: Operating = { machine: 'cone-sec', cssMm: 32, throwMm: 30, speedRpm: 360, feedX63Mm: 90, feedM: 1.2, oreAxb: 55, oreWi: 14 };

describe('cssAtP80Target on the shared table', () => {
  it('has the schema and enough rows', () => {
    expect(doc.schema).toBe('chancadem.campaign-reference/v1');
    expect(doc.rows.length).toBeGreaterThanOrEqual(30);
  });
  it('reproduces every row to 1e-6 mm', () => {
    for (const r of doc.rows) {
      const got = cssAtP80Target(opOf(r.op), r.p80_target_mm, r.css_max_mm);
      if (r.css_target_mm === null) expect(got, r.id).toBeNull();
      else expect(got === null ? NaN : Math.abs(got - r.css_target_mm), r.id).toBeLessThanOrEqual(1e-6);
    }
  });
  it('the engine P80 at the returned setting is the target', () => {
    let n = 0;
    for (const r of doc.rows) {
      const op = opOf(r.op);
      const css = cssAtP80Target(op, r.p80_target_mm, r.css_max_mm);
      if (css === null || css <= op.cssMm + 1e-6) continue;
      n++;
      expect(Math.abs(evaluate({ ...op, cssMm: css }).p80 - r.p80_target_mm), r.id).toBeLessThanOrEqual(1e-5);
    }
    expect(n).toBeGreaterThanOrEqual(10);
  });
});

describe('cssAtP80Target edge cases', () => {
  const p80 = evaluate(BASE).p80;
  it('a target above the current P80 opens the setting', () => {
    expect(cssAtP80Target(BASE, p80 * 1.1, 90)).toBeGreaterThan(BASE.cssMm);
  });
  it('a target already exceeded returns the current setting', () => {
    expect(cssAtP80Target(BASE, p80 * 0.9, 90)).toBe(BASE.cssMm);
  });
  it('a target never reached below the ceiling is null', () => {
    expect(cssAtP80Target(BASE, 1e6, 90)).toBeNull();
  });
  it('a ceiling at or below the current setting is null', () => {
    expect(cssAtP80Target(BASE, p80 * 1.1, BASE.cssMm)).toBeNull();
    expect(cssAtP80Target(BASE, p80 * 1.1, 10)).toBeNull();
  });
  it('an invalid point or input is null', () => {
    expect(cssAtP80Target({ ...BASE, cssMm: 0 }, 30, 90)).toBeNull();
    expect(cssAtP80Target(BASE, NaN, 90)).toBeNull();
    expect(cssAtP80Target(BASE, -5, 90)).toBeNull();
    expect(cssAtP80Target(BASE, 30, Infinity)).toBeNull();
  });
  it('a P80 that is not monotone over the bracket is null, never a guess', () => {
    const wavy = (op: Operating) => ({ p80: evaluate(op).p80 + 4 * Math.sin(op.cssMm * 1.3), valid: true });
    expect(cssAtP80Target(BASE, p80 * 1.3, 90, wavy)).toBeNull();
  });
});

describe('hoursToTarget', () => {
  it('is the opening over the drift', () => {
    expect(hoursToTarget(2, 0.04)).toBeCloseTo(50, 12);
    expect(hoursToTarget(1, 1)).toBeCloseTo(1, 12);
    expect(hoursToTarget(0, 0.1)).toBe(0);
    expect(hoursToTarget(-0.5, 0.1)).toBe(0);
  });
  it('refuses a drift that is not positive', () => {
    expect(hoursToTarget(2, 0)).toBeNull();
    expect(hoursToTarget(2, -0.1)).toBeNull();
    expect(hoursToTarget(2, NaN)).toBeNull();
    expect(hoursToTarget(NaN, 0.1)).toBeNull();
  });
  it('takes both numbers with no default drift', () => {
    expect(hoursToTarget.length).toBe(2);
  });
});
