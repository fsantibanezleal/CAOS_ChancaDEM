// The numbers and words of the App and the story, held to their evidence (the 0.13.000 visualization review, findings B1, B2, M5, M6,
// M7, M10 and the minors m1, m2, m5, m6, m9, m11): the Operate headline is the drift response drawn on the stage, the Compare headline
// names a mean, the comparison's gap and its interval are read from hp500-comparison, the exits keep the step's view and target under
// one target rule, the measured and the model F80 are told apart, and each step opens on its evidence.
import { formatNumber, LinkedViewProvider } from '@fasl-work/caos-app-shell';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CSS_MAX_MM } from '../engine/campaign';
import { evaluate } from '../engine/engine';
import { neumannPasses, passesToResidual, whitenMatrices } from '../engine/passes';
import type { Operating } from '../engine/types';
import type { CaseManifest, Hp500Backbone, Hp500Comparison, Hp500CrusherBayes, Hp500Loo, Trace } from '../lib/contract.types';
import { defaultP80Target, driftCurve, driftSecant, hoursCallouts } from '../views/campaign';
import { circuitValues } from '../views/circuit';
import { bandNote, certaintyText, CompareBody, compareCallouts, compareRows, METHOD_NAME, openingChoice, recommend } from '../views/compare';
import { passCount } from '../views/linked';
import { MACHINE_FLOOR, openingPass, passCallouts, passesWord } from '../views/passes';
import { gradationCallouts } from '../views/product';
import { subOfUrl } from '../views/shared';
import { operatingOf, railOf, selectionOf } from '../workbench/model';
import { targetOfUrl } from '../workbench/Workbench';
import { exitHref, feedStrip, operateHeadlineProblems, operatePoint, storyHeadlines, type StoryInputs } from './storyModel';

const derived = new URL('../../../data/derived/', import.meta.url);
const read = <T,>(rel: string): T => JSON.parse(readFileSync(new URL(rel, derived), 'utf8')) as T;
const src = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const backbone = read<Hp500Backbone>('hp500/backbone.json');
const loo = read<Hp500Loo>('hp500/loo.json');
const cb = read<Hp500CrusherBayes>('hp500/crusherbayes.json');
const comparison = read<Hp500Comparison>('hp500/comparison.json');
const manifest = read<CaseManifest>('manifests/HP500-01.json');
const trace = read<Trace>('HP500-01/trace.json');
const op: Operating = operatingOf(manifest.params);
const full: StoryInputs = { caseId: 'HP500-01', op, backbone, backboneReason: null, loo, looReason: null, cb, cbReason: null, comparison, comparisonReason: null };
const en = (v: number, o: { digits?: number; decimals?: number } = {}) => formatNumber(v, 'en', o);
const numbersIn = (s: string) => (s.match(/(?<![A-Za-z\d.,])\d[\d,]*(?:\.\d+)?/g) ?? []).map((x) => Number(x.replace(/,/g, '')));

describe('B1: the Operate headline is the drift response drawn on the stage', () => {
  const p80 = evaluate(op).p80;
  const target = defaultP80Target(p80);
  const curve = driftCurve(op, target, CSS_MAX_MM[op.machine], null);
  const secant = driftSecant(op, curve.crossingMm)!;
  const calls = hoursCallouts('HP500-01', target, curve, secant, null, en);
  it('the headline’s two numbers are the stage’s target and its crossing, in both languages', () => {
    const value = (id: string) => calls.find((c) => c.id === id)!.value;
    const h = storyHeadlines(full, 'en').operate.headline;
    expect(numbersIn(h)).toEqual([Number(value('target')), Number(value('cross'))]);
    expect(h).toBe(`P80 reaches the ${value('target')} mm target after ${value('cross')} mm of setting drift`);
    const es = storyHeadlines(full, 'es').operate.headline;
    expect(es).toContain(formatNumber(target, 'es', { digits: 3 }));
    expect(es).toContain(`${formatNumber(curve.crossingMm!, 'es', { digits: 3 })} mm de desplazamiento`);
  });
  it('the P80-per-mm callout is the drawn curve’s secant from its start to the crossing, within 1e-6', () => {
    const now = evaluate(op).p80;
    const atCross = evaluate({ ...op, cssMm: op.cssMm + curve.crossingMm! }).p80;
    expect(Math.abs(secant - (atCross - now) / curve.crossingMm!)).toBeLessThan(1e-6);
    // the crossing is where the drawn curve meets the target line
    expect(Math.abs(atCross - target)).toBeLessThan(1e-6);
    const c = calls.find((x) => x.id === 'now')!;
    expect(c.value).toBe(en(secant, { digits: 3 }));
    expect(c.source.en).toMatch(/Secant to the target over the drawn range/);
    expect(c.source.es).toMatch(/Secante al objetivo/);
  });
  it('HP500 survey 1: 35.8 mm reached after 22 mm, a secant of 0.148, as the Methodology paragraph states', () => {
    expect(en(target, { digits: 3 })).toBe('35.8');
    expect(en(curve.crossingMm!, { digits: 3 })).toBe('22');
    expect(en(secant, { digits: 3 })).toBe('0.148');
    const para = src('../content/methodology/machine.tsx');
    for (const s of ['35.81 mm', '22.0 mm', '0.148 mm', '54.77 mm', '38.05 mm', 'K1 = 0.23 CSS + 0.30 F80']) expect(para).toContain(s);
    for (const s of ['35,81 mm', '22,0 mm', '0,148 mm', '54,77 mm', '38,05 mm']) expect(para).toContain(s);
  });
  it('the kink the paragraph names: the slope drops from about 0.263 to 0.116 within 0.02 mm of the 54.77 mm setting', () => {
    const slope = (a: number, b: number) => (evaluate({ ...op, cssMm: b }).p80 - evaluate({ ...op, cssMm: a }).p80) / (b - a);
    expect(slope(54.7, 54.74)).toBeCloseTo(0.263, 3);
    expect(slope(54.8, 54.9)).toBeCloseTo(0.1156, 3);
    const k1 = (css: number) => 0.23 * css + 0.3 * evaluate({ ...op, cssMm: css }).f80;
    expect(k1(54.76)).toBeLessThan(38.0552);
    expect(k1(54.78)).toBeGreaterThan(38.0552);
  });
  it('adversarial: a local slope stated as the drift response, or hours, is refused', () => {
    expect(operateHeadlineProblems('P80 rises 0.267 mm per mm of setting drift')).not.toEqual([]);
    expect(operateHeadlineProblems('El P80 sube 0,267 mm por mm de abertura desplazada')).not.toEqual([]);
    expect(operateHeadlineProblems('P80 leaves its target after 45 h')).not.toEqual([]);
    for (const lang of ['en', 'es'] as const) expect(operateHeadlineProblems(storyHeadlines(full, lang).operate.headline)).toEqual([]);
  });
});

describe('B2: the Compare headline names the metric as a mean', () => {
  it('adversarial: en says "on average", es "en promedio", and the number is the recommended MAPE', () => {
    const best = recommend(compareRows(loo, cb, 'kW'))!;
    const h = storyHeadlines(full, 'en').compare.headline;
    const es = storyHeadlines(full, 'es').compare.headline;
    expect(h).toBe(`${best.name.en}: lowest held-out power error, ${en(best.mape, { digits: 4 })}% on average`);
    expect(es).toContain('en promedio');
    expect(es).toContain(best.name.es);
    // Spec item 9 of F3b: the Spanish headline keeps "held out" (reservado) within the 12-word rule
    expect(es).toContain('reservado');
    expect(es.split(/\s+/).length).toBeLessThanOrEqual(12);
    expect(es.startsWith(`${best.name.es}: menor error reservado, `) && es.endsWith('% en promedio')).toBe(true);
    expect(h).not.toMatch(/\bwithin\b/);
    expect(es).not.toMatch(/\bcon \d/);
    expect(numbersIn(h)).toEqual([best.mape]);
  });
});

describe('M7: the comparison is decided on the drawn paired interval of hp500-comparison', () => {
  const rows = compareRows(loo, cb, 'kW');
  const best = recommend(rows)!;
  const t = comparison.targets.kW;
  const runner = t.paired.find((p) => p.method === t.runner_up)!;
  it('the document’s recommended method is the web’s, and the view opens on its runner-up, so BEST and SELECTED differ', () => {
    expect(t.recommended).toBe(best.id);
    const opening = openingChoice(rows, best, comparison, 'kW')!;
    expect(opening.id).toBe(t.runner_up);
    const calls = compareCallouts(rows, best, opening, comparison, null, 'kW', en);
    expect(calls.map((c) => c.id)).toEqual(['best', 'chosen', 'gap']);
    expect(calls[0].value).not.toBe(calls[1].value);
  });
  it('the third callout is the paired gap of the runner-up with its interval and wins, read from the document', () => {
    const calls = compareCallouts(rows, best, openingChoice(rows, best, comparison, 'kW')!, comparison, null, 'kW', en);
    const gap = calls[2];
    expect(gap.value).toBe(`+${en(runner.mean_diff_pts, { decimals: 2 })}`);
    // M2 (F3b): the unit is short, so the card shows it whole; the interval leads the source
    expect(gap.unit.en).toBe('points');
    expect(gap.source.en.startsWith(`95% ${en(runner.ci95[0], { decimals: 2 })} to ${en(runner.ci95[1], { decimals: 2 })}; `)).toBe(true);
    expect(gap.source.en).toContain(`wins ${runner.wins} of ${comparison.n}`);
    // selecting the recommended method keeps the runner-up's gap; selecting another method shows that method's gap
    const self = compareCallouts(rows, best, best, comparison, null, 'kW', en)[2];
    expect(self.value).toBe(gap.value);
    const morrell = t.paired.find((p) => p.method === 'Morrell')!;
    expect(compareCallouts(rows, best, rows.find((r) => r.id === 'Morrell')!, comparison, null, 'kW', en)[2].value).toBe(`+${en(morrell.mean_diff_pts, { decimals: 2 })}`);
  });
  it('the takeaway says how sure the ranking is with ten surveys: the interval, the wins and whether it settles the ranking', () => {
    const s = certaintyText(comparison, null, 'kW', (v, o) => en(v, o ?? { digits: 3 }));
    expect(s.en).toContain(`${en(runner.ci95[0], { decimals: 2 })} to ${en(runner.ci95[1], { decimals: 2 })}`);
    expect(s.en).toContain(`lower on ${runner.wins} of the ${comparison.n} surveys`);
    expect(s.en).toContain(METHOD_NAME[t.runner_up].en);
    expect(s.en).toMatch(runner.ci95[0] > 0 ? /excludes zero/ : /do not settle the ranking/);
    expect(s.es).toMatch(runner.ci95[0] > 0 ? /excluye el cero/ : /no deciden la clasificación/);
    expect(storyHeadlines(full, 'en').compare.summary).toContain(s.en);
  });
  it('the rendered view draws the gap from the document and opens on the runner-up', () => {
    const html = renderToStaticMarkup(
      createElement(LinkedViewProvider, null, createElement(CompareBody, { loo, cb, cbReason: null, comparison, comparisonReason: null, target: 'kW', setTarget: () => undefined, caseId: 'HP500-01', onPickCase: () => undefined })),
    );
    expect(html).toContain(`data-gap="${runner.mean_diff_pts}"`);
    expect(html).toContain(`data-selected-method="${t.runner_up}"`);
  });
  it('the recommended method without a band is said once, in the panel note', () => {
    const note = bandNote(openingChoice(rows, best, comparison, 'kW')!, best, (v) => en(v, { digits: 3 }));
    expect(note.en.match(/The recommended method, Setting-only line, has no predictive band/g)?.length).toBe(1);
  });
  it('adversarial: absent comparison: the gap callout and the certainty sentence give the readiness reason, never a number', () => {
    const reason = { en: 'hp500/comparison.json is not available yet: The HP500 validation was not baked in this build.', es: 'hp500/comparison.json aún no está disponible: La validación HP500 no se generó en esta versión.' };
    const gap = compareCallouts(rows, best, openingChoice(rows, best, null, 'kW')!, null, reason, 'kW', en)[2];
    expect(gap.value).toBeNull();
    expect(gap.missing?.en).toContain('not baked in this build');
    const s = certaintyText(null, reason, 'kW', (v) => en(v));
    expect(s.en).toContain('not available yet');
    expect(s.en).not.toMatch(/\d\.\d/);
    expect(storyHeadlines({ ...full, comparison: null, comparisonReason: reason }, 'en').compare.summary).toContain('not baked in this build');
    // the rest of the view works from hp500-loo
    expect(openingChoice(rows, best, null, 'kW')!.id).toBe('M2_freeform');
  });
});

describe('M5 and m5: the exits keep the step’s view and target, under one target rule', () => {
  it('Look inside lands on the chamber, Solve on the population balance, Operate on the campaign with its target', () => {
    const q = (href: string) => new URL(href, 'https://x').searchParams;
    expect(Object.fromEntries(q(exitHref('inside', 'HP500-01')))).toEqual({ case: 'HP500-01', view: 'system', sub: 'chamber' });
    expect(Object.fromEntries(q(exitHref('solve', 'HP500-01')))).toEqual({ case: 'HP500-01', view: 'product', sub: 'passes' });
    expect(Object.fromEntries(q(exitHref('measure', 'HP500-01')))).toEqual({ case: 'HP500-01', view: 'system', sub: 'circuit' });
    expect(Object.fromEntries(q(exitHref('compare', 'HP500-01')))).toEqual({ case: 'HP500-01', view: 'validation', sub: 'compare' });
    const target = operatePoint(op)!.targetMm;
    const op5 = q(exitHref('operate', 'HP500-01', { targetMm: target }));
    expect(op5.get('sub')).toBe('campaign');
    expect(Math.abs(Number(op5.get('target')) - target)).toBeLessThan(1e-6);
  });
  it('adversarial: the App reads them: the view of the URL’s group and the target of the URL’s case', () => {
    expect(subOfUrl('?case=HP500-01&view=system&sub=chamber', 'system', ['circuit', 'chamber', 'nip'])).toBe('chamber');
    expect(subOfUrl('?case=HP500-01&view=product&sub=chamber', 'system', ['circuit', 'chamber', 'nip'])).toBeUndefined();
    expect(subOfUrl('?view=system&sub=nowhere', 'system', ['circuit', 'chamber'])).toBeUndefined();
    expect(targetOfUrl('?case=HP500-01&view=performance&target=35.81')).toEqual({ caseId: 'HP500-01', mm: 35.81 });
    expect(targetOfUrl('?case=HP500-01&target=-1')).toBeNull();
    expect(targetOfUrl('?case=HP500-01')).toBeNull();
  });
  it('adversarial: one target rule: the story’s and the App’s default target is defaultP80Target, P80 plus 10 percent, never a rounded P80', () => {
    expect(defaultP80Target(27.698)).toBeCloseTo(30.4678, 9);
    expect(operatePoint(op)!.targetMm).toBe(defaultP80Target(evaluate(op).p80));
    const wb = src('../workbench/Workbench.tsx');
    expect(wb).toContain('defaultP80Target(p80)');
    expect(wb).not.toMatch(/Math\.round\(p80\)/);
    expect(src('./Story.tsx')).not.toMatch(/p80 \* 1\.1/);
  });
});

describe('M6: the measured F80 and the model’s F80 are told apart', () => {
  const sel = selectionOf({ manifest, trace, traceReason: null }, railOf(manifest.params), 'canonical');
  it('the Measure step shows the survey’s F80 as measured', () => {
    const v = circuitValues(manifest, trace, null);
    expect(v.f80.value).toBe(manifest.measured!.f80_mm);
    expect(v.f80.label.en).toBe('Measured feed F80');
    expect(v.f80.label.es).toMatch(/medido/);
  });
  it('adversarial: the gradation (V3) labels the engine’s F80 as the model’s, reconstructed from the measured one', () => {
    const f = gradationCallouts(sel, null, en).callouts.find((c) => c.id === 'f80')!;
    expect(f.eyebrow.en).toBe('MODEL F80');
    expect(f.eyebrow.es).toMatch(/MODELO/);
    expect(f.source.en).toContain(`reconstructed from the measured ${en(manifest.measured!.f80_mm, { digits: 3 })} mm`);
    expect(f.source.es).toContain('medidos');
    expect(f.value).toBe(en(sel.result.f80, { digits: 3 }));
    expect(f.value).not.toBe(en(manifest.measured!.f80_mm, { digits: 3 }));
  });
  it('the Look inside panel names the model’s F80 and the measured one', () => {
    const story = src('./Story.tsx');
    expect(story).toContain('from the model’s feed F80 of');
    expect(story).toContain('reconstructed from the measured');
    expect(story).toContain('reconstruido desde los');
  });
});

describe('M10 and m2: each step opens on its headline’s evidence', () => {
  it('adversarial: Measure draws the ten surveys’ feed rates, 813 to 1,639 t/h at the ends of its strip', () => {
    const marks = feedStrip(backbone);
    expect(marks.length).toBe(10);
    const lo = marks.find((m) => m.at === 0)!;
    const hi = marks.find((m) => m.at === 1)!;
    expect(lo.tph).toBe(813);
    expect(hi.tph).toBe(1639);
    expect(marks.map((m) => m.survey)).toEqual(backbone.surveys.map((s) => s.n));
    expect(feedStrip(null)).toEqual([]);
  });
  it('adversarial: Solve and V5 open at the pass the headline names (6 for HP500-01), not at pass 1 or 28', () => {
    const series = neumannPasses(whitenMatrices(op));
    const k = passesToResidual(series, 1e-6)!;
    expect(k).toBe(6);
    expect(openingPass(series)).toBe(k);
    expect(passCount(null, series.n, openingPass(series))).toBe(6);
    expect(passCount(3, series.n, openingPass(series))).toBe(3);
    expect(numbersIn(storyHeadlines(full, 'en').solve.headline)).toEqual([k]);
  });
});

describe('the minors: m1, m6, m9, m11', () => {
  const series = neumannPasses(whitenMatrices(op));
  it('m1: one pass is singular, in both languages', () => {
    expect(passesWord(1, 'en')).toBe('pass');
    expect(passesWord(6, 'en')).toBe('passes');
    expect(passesWord(1, 'es')).toBe('pasada');
    expect(passesWord(6, 'es')).toBe('pasadas');
    expect(src('./Story.tsx')).not.toMatch(/After \$\{count\} passes/);
  });
  it('m6: no Spanish label reads "opening of the opening"', () => {
    for (const rel of ['../views/campaign.tsx', '../content/methodology/machine.tsx']) expect(src(rel)).not.toMatch(/apertura de la abertura/i);
  });
  it('adversarial: m9: the second quantity beside the residual is the mass sent back at the pass, a different number', () => {
    const calls = passCallouts(series, 1, en, 'HP500-01');
    expect(calls.map((c) => c.id)).toEqual(['pass', 'residual', 'sent']);
    const sent = series.sentBack[1].reduce((s, x) => s + x, 0);
    expect(calls[2].value).toBe(en(sent * 100, { digits: 3 }));
    expect(calls[2].value).not.toBe(en(series.inChamber[1] * 100, { digits: 3 }));
  });
  it('adversarial: m11: a round-off residual is shown below machine precision, never as a value', () => {
    const k = series.residual.findIndex((r) => r < MACHINE_FLOOR);
    expect(k).toBeGreaterThan(0);
    const calls = passCallouts(series, k, en, 'HP500-01');
    expect(calls[1].value).toBe('< 1e-15');
    // M2 (F3b): the unit is short so the value is whole; machine precision is said in the source
    expect(calls[1].source.en).toMatch(/machine precision/);
    expect(calls[1].source.es).toMatch(/precisión de máquina/);
    expect(passCallouts(series, 2, en, 'HP500-01')[1].value).toBe(en(series.residual[2], { digits: 2 }));
  });
});
