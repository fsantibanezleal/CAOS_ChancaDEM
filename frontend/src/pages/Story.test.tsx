// The story (SH-005, SH-006, SH-007, SH-010): five steps at /story/<step>, each headline a number proven against the committed documents
// or the live engine it is read from, the missing state when a document is absent, the exit to the App on the step's case and group, and
// three callouts with a unit and a source on every stage. The browser behaviour the shell owns (the stepper, the keys, the pause on
// input) is driven in a browser by scripts/check_story_mode.mjs, src/pages/story.browser.mjs and the gate's G21.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../engine/engine';
import { neumannPasses, passesToResidual, whitenMatrices } from '../engine/passes';
import type { Operating } from '../engine/types';
import type { CaseManifest, Hp500Backbone, Hp500CrusherBayes, Hp500Loo, Trace } from '../lib/contract.types';
import { sectionCallouts } from '../views/chamber';
import { circuitCallouts, circuitValues } from '../views/circuit';
import { compareCallouts, compareRows, recommend } from '../views/compare';
import { driftCurve, hoursCallouts, p80PerMm } from '../views/campaign';
import { passCallouts } from '../views/passes';
import { operatingOf } from '../workbench/model';
import { calloutProblems, exitHref, headlineProblems, operateHeadlineProblems, STORY_STEPS, storyHeadlines, stepHref, type StoryInputs } from './storyModel';

const derived = new URL('../../../data/derived/', import.meta.url);
const read = <T,>(rel: string): T => JSON.parse(readFileSync(new URL(rel, derived), 'utf8')) as T;
const backbone = read<Hp500Backbone>('hp500/backbone.json');
const loo = read<Hp500Loo>('hp500/loo.json');
const cb = read<Hp500CrusherBayes>('hp500/crusherbayes.json');
const manifest = read<CaseManifest>('manifests/HP500-01.json');
const trace = read<Trace>('HP500-01/trace.json');
const op: Operating = operatingOf(manifest.params);
const full: StoryInputs = { caseId: 'HP500-01', op, backbone, backboneReason: null, loo, looReason: null, cb, cbReason: null };
const fmtEn = (v: number, digits: number) => Number(v.toPrecision(digits)).toLocaleString('en-US');
// the numbers a headline states, without the digits of a name (P80, HP500)
const numbersIn = (s: string) => (s.match(/(?<![A-Za-z\d.,])\d[\d,]*(?:\.\d+)?/g) ?? []).map((x) => Number(x.replace(/,/g, '')));

describe('SH-005: five steps, each with a numbered headline read from the release', () => {
  const h = storyHeadlines(full, 'en');
  it('the steps are measure, inside, solve, compare and operate, in that order, each at /story/<step> with the case', () => {
    expect(STORY_STEPS.map((s) => s.id)).toEqual(['measure', 'inside', 'solve', 'compare', 'operate']);
    expect(STORY_STEPS.map((s) => s.number)).toEqual([1, 2, 3, 4, 5]);
    for (const s of STORY_STEPS) expect(stepHref(s.id, 'HP500-01')).toBe(`/story/${s.id}?case=HP500-01`);
    const product = JSON.parse(readFileSync(new URL('../../../product.json', import.meta.url), 'utf8')) as { showcase: { story_routes: string[] } };
    expect(product.showcase.story_routes).toEqual(STORY_STEPS.map((s) => `/story/${s.id}`));
  });
  it('every headline, in both languages, states a number in at most 12 words', () => {
    for (const lang of ['en', 'es'] as const) {
      const hl = storyHeadlines(full, lang);
      for (const s of STORY_STEPS) expect(headlineProblems(hl[s.id].headline), `${lang} ${s.id}: ${hl[s.id].headline}`).toEqual([]);
    }
  });
  it('measure: the throughput range of the ten surveys is the backbone document’s', () => {
    const tph = backbone.surveys.map((s) => s.measured.feed_tph);
    expect(numbersIn(h.measure.headline)).toEqual([backbone.n, Math.min(...tph), Math.max(...tph)]);
  });
  it('inside: the nip angle and its grip limit are the live engine’s at the case', () => {
    const r = evaluate(op);
    const [nip, limit] = numbersIn(h.inside.headline);
    expect(nip).toBeCloseTo(r.nipAngleDeg, 1);
    expect(limit).toBeCloseTo(r.nipLimitDeg, 2);
    expect(limit).toBe(38.58);
  });
  it('solve: the passes to a residual below one millionth are the live engine’s series', () => {
    const k = passesToResidual(neumannPasses(whitenMatrices(op)), 1e-6);
    expect(k).not.toBeNull();
    expect(numbersIn(h.solve.headline)).toEqual([k]);
  });
  it('compare: the recommended power method and its held-out MAPE are the documents’ lowest', () => {
    const best = recommend(compareRows(loo, cb, 'kW'))!;
    const all = [
      ...['M0_backbone', 'M1_residual', 'M2_freeform', 'B_lin', 'Morrell', 'Morrell_noload']
        .map((k) => (loo.loo.kW.strict as unknown as Record<string, { mape_pct: number } | undefined>)[k]?.mape_pct)
        .filter((v): v is number => v !== undefined),
      cb.loo.kW.scores.mape_pct,
    ];
    expect(best.mape).toBe(Math.min(...all));
    expect(numbersIn(h.compare.headline)).toEqual([best.mape]);
    expect(h.compare.headline).toContain(best.name.en);
  });
  it('SH-010: operate states P80 per millimetre of setting drift from the engine, never hours', () => {
    const slope = p80PerMm(op)!;
    expect(numbersIn(h.operate.headline)).toEqual([Number(fmtEn(slope, 3))]);
    expect(h.operate.headline).toMatch(/per mm/);
    expect(h.operate.headline).not.toMatch(/\bh\b|hour/i);
    const es = storyHeadlines(full, 'es').operate.headline;
    expect(es).toMatch(/por mm/);
    expect(es).not.toMatch(/\bh\b|hora/i);
  });
  it('adversarial: an Operate headline in hours, or without P80 per millimetre, is refused', () => {
    expect(operateHeadlineProblems('P80 leaves its target after 45 h')).not.toEqual([]);
    expect(operateHeadlineProblems('El P80 sale del objetivo tras 45 horas')).not.toEqual([]);
    expect(operateHeadlineProblems('P80 rises 0.62 mm per mm of setting drift')).toEqual([]);
    for (const lang of ['en', 'es'] as const) expect(operateHeadlineProblems(storyHeadlines(full, lang).operate.headline)).toEqual([]);
  });
  it('adversarial: a headline with no number, or of 13 words, is refused', () => {
    expect(headlineProblems('The circuit at work')).not.toEqual([]);
    expect(headlineProblems('one two three four five six seven eight nine ten eleven twelve 13')).not.toEqual([]);
    expect(headlineProblems('Ten surveys fed 813 to 1,639 t/h')).toEqual([]);
  });
  it('adversarial: a step whose document is absent says so, with the reason, instead of a placeholder', () => {
    const reason = { en: 'hp500/backbone.json is not in this build', es: 'hp500/backbone.json no está en esta versión' };
    const gone = storyHeadlines({ ...full, backbone: null, backboneReason: reason, loo: null, looReason: reason }, 'en');
    expect(gone.measure.missing).toBe(true);
    expect(gone.measure.headline).toMatch(/not available/i);
    expect(gone.measure.summary).toContain('hp500/backbone.json is not in this build');
    expect(gone.compare.missing).toBe(true);
    expect(gone.compare.summary).toContain('hp500/backbone.json is not in this build');
    expect(gone.measure.headline).not.toMatch(/NaN|undefined|null/);
    // the steps the live engine answers keep their numbers
    expect(gone.solve.missing).toBe(false);
  });
  it('compare without CrusherBayes draws the other methods and says CrusherBayes is not available', () => {
    const reason = { en: 'hp500/crusherbayes.json is not in this build', es: 'hp500/crusherbayes.json no está en esta versión' };
    const noCb = storyHeadlines({ ...full, cb: null, cbReason: reason }, 'en');
    expect(noCb.compare.missing).toBe(false);
    expect(noCb.compare.summary).toContain('CrusherBayes is not available');
  });
});

describe('SH-006: deep links and the exit to the App', () => {
  it('the exit lands on the App with the step’s case and group', () => {
    expect(exitHref('measure', 'HP500-04')).toBe('/app?case=HP500-04&view=system');
    expect(exitHref('inside', 'HP500-04')).toBe('/app?case=HP500-04&view=system');
    expect(exitHref('solve', 'HP500-04')).toBe('/app?case=HP500-04&view=product');
    expect(exitHref('compare', 'HP500-04')).toBe('/app?case=HP500-04&view=validation');
    expect(exitHref('operate', 'HP500-04')).toBe('/app?case=HP500-04&view=performance');
  });
  it('adversarial: an exit that lands on another case is caught', () => {
    const landed = new URL(exitHref('solve', 'S01'), 'https://x').searchParams.get('case');
    expect(landed).toBe('S01');
    expect(landed).not.toBe('HP500-01');
  });
  it('a case id with characters a URL reserves is encoded, never injected', () => {
    expect(exitHref('measure', 'A&view=x')).toBe('/app?case=A%26view%3Dx&view=system');
  });
});

describe('SH-007: three anchored callouts with a value, a unit and a source on every stage', () => {
  const num = (v: number | null | undefined, o: { digits?: number; decimals?: number } = {}) =>
    v === null || v === undefined ? '' : o.decimals !== undefined ? v.toFixed(o.decimals) : String(Number(v.toPrecision(o.digits ?? 4)));
  const series = neumannPasses(whitenMatrices(op));
  const rows = compareRows(loo, cb, 'kW');
  const best = recommend(rows)!;
  const r = evaluate(op);
  const stages = {
    measure: circuitCallouts(circuitValues(manifest, trace, null), num),
    inside: sectionCallouts(op, r.nipAngleDeg, r.nipLimitDeg, null, 'HP500-01', num),
    solve: passCallouts(series, 3, num, 'HP500-01'),
    compare: compareCallouts(rows, best, best, num),
    operate: hoursCallouts('HP500-01', r.p80 * 1.1, driftCurve(op, r.p80 * 1.1, 90, null), p80PerMm(op), null, num),
  };
  it('each stage has at least three callouts, each with a value, a unit and a source in both languages', () => {
    for (const [id, list] of Object.entries(stages)) expect(calloutProblems(list), id).toEqual([]);
  });
  it('adversarial: a stage with two callouts, or a callout without a unit, is refused', () => {
    expect(calloutProblems(stages.solve.slice(0, 2))).not.toEqual([]);
    const noUnit = stages.inside.map((c, i) => (i === 1 ? { ...c, unit: { en: '', es: '' } } : c));
    expect(calloutProblems(noUnit)).not.toEqual([]);
    const noSource = stages.measure.map((c, i) => (i === 0 ? { ...c, source: { en: '', es: '' } } : c));
    expect(calloutProblems(noSource)).not.toEqual([]);
  });
  it('the measured stage reads the survey: its throughput callout is the manifest’s measured tonnage', () => {
    expect(stages.measure.find((c) => c.id === 'feed')?.value).toBe(num(manifest.measured!.feed_tph, { digits: 4 }));
  });
});
