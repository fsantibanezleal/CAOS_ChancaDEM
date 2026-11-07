// The campaign view (BL-004): the model behind the figure, the 45 h reference line, the statements in both languages, and the rule that
// no wear rate is asserted (the drift rate is the x axis, never a default).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../engine/engine';
import type { Operating } from '../engine/types';
import { CAMPAIGN_TEXT, DRIFT_RANGE, REFERENCE_RESET_H, campaignChart, campaignModel, defaultTarget } from './campaign';

const BASE: Operating = { machine: 'cone-sec', cssMm: 32, throwMm: 30, speedRpm: 360, feedX63Mm: 90, feedM: 1.2, oreAxb: 55, oreWi: 14 };
const p80 = evaluate(BASE).p80;

describe('the model of the figure', () => {
  it('defaults the target to the case P80 plus 10 percent', () => {
    expect(defaultTarget(p80)).toBeCloseTo(p80 * 1.1, 12);
  });
  it('opens a curve of hours against the drift, falling as the drift rises', () => {
    const m = campaignModel(BASE, defaultTarget(p80), 90);
    expect(m.kind).toBe('curve');
    if (m.kind !== 'curve') return;
    expect(m.deltaCssMm).toBeGreaterThan(0);
    expect(m.cssTargetMm).toBeCloseTo(BASE.cssMm + m.deltaCssMm, 12);
    expect(m.driftMmPerH[0]).toBeCloseTo(0.01, 12);
    expect(m.driftMmPerH[m.driftMmPerH.length - 1]).toBeCloseTo(1, 12);
    for (let i = 1; i < m.hours.length; i++) expect(m.hours[i]).toBeLessThan(m.hours[i - 1]);
    expect(m.hours[0]).toBeCloseTo(m.deltaCssMm / 0.01, 9);
  });
  it('a target already exceeded is zero hours and no curve', () => {
    const m = campaignModel(BASE, p80 * 0.9, 90);
    expect(m.kind).toBe('exceeded');
  });
  it('a target never reached below the ceiling has no curve', () => {
    expect(campaignModel(BASE, 1e6, 90).kind).toBe('unreachable');
  });
  it('an invalid point has no curve', () => {
    expect(campaignModel({ ...BASE, cssMm: 0 }, 30, 90).kind).toBe('invalid');
  });
});

describe('the chart', () => {
  const m = campaignModel(BASE, defaultTarget(p80), 90);
  it('draws the drift rate on a log axis from 0.01 to 1 mm/h and the hours up the side', () => {
    
    const c = campaignChart(m);
    expect(DRIFT_RANGE).toEqual([0.01, 1]);
    expect(c.x.log).toBe(true);
    expect(c.x.unit).toBe('mm/h');
    expect(c.y.unit).toBe('h');
    expect(c.x.values[0]).toBeCloseTo(0.01, 12);
    expect(c.series[0].values.length).toBe(c.x.values.length);
  });
  it('carries the 45 h re-set of Ma et al. 2016 as a labelled reference line', () => {
    
    const c = campaignChart(m);
    expect(REFERENCE_RESET_H).toBe(45);
    const line = c.yMarks.find((y) => y.y === 45);
    expect(line).toBeDefined();
    expect(line?.label.en).toBe('the re-set interval of one plant (Ma et al. 2016)');
    expect(line?.label.es.length).toBeGreaterThan(10);
  });
});

describe('the statements', () => {
  const langs = ['en', 'es'] as const;
  it('every statement exists in both languages', () => {
    for (const [key, text] of Object.entries(CAMPAIGN_TEXT)) {
      for (const l of langs) expect(text[l].length, `${key}.${l}`).toBeGreaterThan(20);
    }
  });
  it('says the drift rate is the user\'s to measure and the product does not model wear', () => {
    expect(CAMPAIGN_TEXT.measure.en).toMatch(/measure/i);
    expect(CAMPAIGN_TEXT.measure.en).toMatch(/does not model wear/i);
    expect(CAMPAIGN_TEXT.measure.es).toMatch(/medir/i);
    expect(CAMPAIGN_TEXT.measure.es).toMatch(/no modela el desgaste/i);
  });
  it('states that the calibrated lane projects with the calibrated model', () => {
    expect(CAMPAIGN_TEXT.calibrated.en).toMatch(/calibrated/i);
    expect(CAMPAIGN_TEXT.calibrated.es).toMatch(/calibrad/i);
  });
});

describe('no wear rate is asserted', () => {
  const src = readFileSync(fileURLToPath(new URL('./campaign.tsx', import.meta.url)), 'utf8');
  it('the view source has no drift value written as a rate or a default', () => {
    expect(src).not.toMatch(/drift\w*\s*=\s*\d/i);
    expect(src).not.toMatch(/\d\s*mm\/h/);
    expect(src).not.toMatch(/useState\(\s*0?\.\d+\s*\)/);
  });
});

// SH-010 and catalog row V4: P80 against the hours at the reader's drift rate, never a drift rate of the product's own.
import { driftCurve, DRIFT_TEXT, hoursCallouts, p80PerMm } from './campaign';

describe('SH-010: the campaign view asserts no wear rate', () => {
  const target = defaultTarget(p80);
  it('P80 per millimetre of setting is the engine’s central difference', () => {
    const h = Math.max(0.25, 0.01 * BASE.cssMm);
    const want = (evaluate({ ...BASE, cssMm: BASE.cssMm + h }).p80 - evaluate({ ...BASE, cssMm: BASE.cssMm - h }).p80) / (2 * h);
    expect(p80PerMm(BASE)).toBeCloseTo(want, 12);
    expect(p80PerMm(BASE)!).toBeGreaterThan(0);
  });
  it('with no drift rate the curve has no hours: the axis is the opening of the setting', () => {
    const c = driftCurve(BASE, target, 90, null);
    expect(c.hours).toBeNull();
    expect(c.crossingH).toBeNull();
    expect(c.crossingMm).not.toBeNull();
    expect(c.openingMm[0]).toBe(0);
    expect(c.p80[0]).toBeCloseTo(p80, 9);
  });
  it('with the reader’s drift rate the hours are the opening over it, and the target is crossed at the engine’s setting', () => {
    const c = driftCurve(BASE, target, 90, 0.2);
    const m = campaignModel(BASE, target, 90);
    expect(m.kind).toBe('curve');
    if (m.kind !== 'curve') return;
    expect(c.crossingMm).toBeCloseTo(m.deltaCssMm, 9);
    expect(c.crossingH).toBeCloseTo(m.deltaCssMm / 0.2, 9);
    c.hours!.forEach((hrs, i) => expect(hrs).toBeCloseTo(c.openingMm[i] / 0.2, 9));
  });
  it('adversarial: the callouts never state hours without the reader’s drift rate, and the drift control says it is the reader’s', () => {
    const fmt = (v: number) => v.toFixed(3);
    const unset = hoursCallouts('S01', target, driftCurve(BASE, target, 90, null), p80PerMm(BASE), null, fmt);
    expect(unset.some((c) => /\bh\b/.test(c.unit.en))).toBe(false);
    expect(unset.find((c) => c.id === 'now')!.unit.en).toBe('mm of P80 per mm of setting');
    const set = hoursCallouts('S01', target, driftCurve(BASE, target, 90, 0.2), p80PerMm(BASE), null, fmt);
    expect(set.find((c) => c.id === 'cross')!.unit.en).toBe('h at your drift rate');
    expect(DRIFT_TEXT.control.en).toMatch(/asserts no wear rate and sets none/);
    expect(DRIFT_TEXT.control.es).toMatch(/no afirma ni fija ninguna tasa de desgaste/);
  });
  it('adversarial: no default drift rate exists anywhere the view reads it from', () => {
    const shared = readFileSync(fileURLToPath(new URL('./shared.tsx', import.meta.url)), 'utf8');
    const wb = readFileSync(fileURLToPath(new URL('../workbench/Workbench.tsx', import.meta.url)), 'utf8');
    const story = readFileSync(fileURLToPath(new URL('../pages/Story.tsx', import.meta.url)), 'utf8');
    expect(shared).toMatch(/\n\s+drift: null,/);
    expect(wb).toContain('useState<number | null>(null)');
    expect(story).toContain('useState<number | null>(null)');
    for (const src of [shared, wb, story]) expect(src).not.toMatch(/drift\w*\s*[:=]\s*\d/i);
  });
});
