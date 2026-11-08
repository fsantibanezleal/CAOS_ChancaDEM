// The findings of the 0.13.000 visualization re-check (wip/chancadem/viz-recheck-2026-11-08.md), held in node against the committed
// documents and the live engine: N1 (the margin's state by its meaning), N3 and M7 (the certainty clause on the story's Compare stage),
// N5 (a band that leaves the chart no room is never kept), N8 (the staged entry hidden from its first render) and N9 (no vacuous or
// unevenly formatted number). The drawing findings (N2, N4, N6, N7, M9) are measured in a browser by src/views/showcase.browser.mjs.
import { formatNumber, LinkedViewProvider } from '@fasl-work/caos-app-shell';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CSS_MAX_MM } from '../engine/campaign';
import { evaluate } from '../engine/engine';
import { neumannPasses, whitenMatrices } from '../engine/passes';
import type { CaseManifest, Hp500Comparison, Hp500CrusherBayes, Hp500Loo } from '../lib/contract.types';
import { operatingOf } from '../workbench/model';
import { bandLimit, MIN_DRAWING_PX, nextBand, reservedBand } from './callouts';
import { defaultP80Target, driftCurve, driftSecant, hoursCallouts, MARGIN_WARNING_SHARE, marginState } from './campaign';
import { GeometryTable } from './chamber';
import { certaintyText, CompareBody, compareCallouts, compareRows, openingChoice, recommend, recommendReason } from './compare';
import { openingPass, passCallouts } from './passes';
import { FINAL, openingEntry } from './staging';
import { storyHeadlines } from '../pages/storyModel';

const derived = new URL('../../../data/derived/', import.meta.url);
const read = <T,>(rel: string): T => JSON.parse(readFileSync(new URL(rel, derived), 'utf8')) as T;
const loo = read<Hp500Loo>('hp500/loo.json');
const cb = read<Hp500CrusherBayes>('hp500/crusherbayes.json');
const comparison = read<Hp500Comparison>('hp500/comparison.json');
const en = (v: number, o: { digits?: number; decimals?: number } = {}) => formatNumber(v, 'en', o);
const opOf = (id: string) => operatingOf(read<CaseManifest>(`manifests/${id}.json`).params);

const operateCallouts = (id: string) => {
  const op = opOf(id);
  const target = defaultP80Target(evaluate(op).p80);
  const curve = driftCurve(op, target, CSS_MAX_MM[op.machine], null);
  return { curve, calls: hoursCallouts(id, target, curve, driftSecant(op, curve.crossingMm), null, en) };
};

describe('N1: the margin to the target is in alarm only when the product is at or past it', () => {
  const R = 36;
  it('the state at both edges: alarm at 0 and below, warning just above 0 and just under the share, normal at the share', () => {
    expect(MARGIN_WARNING_SHARE).toBe(0.25);
    expect(marginState(0, R)).toBe('alarm');
    expect(marginState(-0.5, R)).toBe('alarm');
    expect(marginState(1e-9, R)).toBe('warning');
    expect(marginState(MARGIN_WARNING_SHARE * R - 1e-9, R)).toBe('warning');
    expect(marginState(MARGIN_WARNING_SHARE * R, R)).toBe('normal');
    expect(marginState(R, R)).toBe('normal');
  });
  it('missing data: a margin that cannot be computed has no state (the callout gives its reason)', () => {
    expect(marginState(null, R)).toBeNull();
    expect(marginState(5, 0)).toBe('normal');
  });
  it('HP500-01: 22 mm of 36 mm of training range is normal, never alarm (the drawn range is the setting to its ceiling)', () => {
    const { curve, calls } = operateCallouts('HP500-01');
    expect(curve.rangeMm).toBeCloseTo(CSS_MAX_MM['cone-sec'] - opOf('HP500-01').cssMm, 12);
    const m = calls.find((c) => c.id === 'cross')!;
    expect(m.value).toBe('22');
    expect(m.state).toBe('normal');
  });
  it('S01: 3.21 mm of 58 mm is a warning, near the target but not past it', () => {
    const { calls } = operateCallouts('S01');
    const m = calls.find((c) => c.id === 'cross')!;
    expect(m.value).toBe('3.21');
    expect(m.state).toBe('warning');
  });
  it('adversarial: a margin still in alarm with a positive margin is refused, on every real survey and synthetic case', () => {
    for (const id of ['HP500-01', 'HP500-04', 'HP500-10', 'S01', 'S03', 'T01']) {
      const { curve, calls } = operateCallouts(id);
      const m = calls.find((c) => c.id === 'cross')!;
      if (curve.crossingMm !== null && curve.crossingMm > 0) expect(m.state, id).not.toBe('alarm');
    }
  });
});

describe('N3 and M7: the story’s Compare stage states how sure its ranking is', () => {
  it('the stage note opens with the certainty sentence the App’s takeaway uses, at the opening state', () => {
    const sure = certaintyText(comparison, null, 'kW', (v, o) => en(v, o ?? { digits: 3 }));
    const html = renderToStaticMarkup(
      createElement(
        LinkedViewProvider,
        null,
        createElement(CompareBody, { loo, cb, cbReason: null, comparison, comparisonReason: null, target: 'kW', setTarget: () => undefined, caseId: 'HP500-01', onPickCase: () => undefined, part: 'stage' }),
      ),
    );
    const note = /<p class="caos-plot-note">([^<]*)<\/p>/.exec(html)?.[1] ?? '';
    expect(note.startsWith(sure.en)).toBe(true);
    expect(note).toMatch(/do not settle the ranking/);
  });
  it('adversarial: the comparison absent: the stage note gives the reason, never a number', () => {
    const reason = { en: 'hp500/comparison.json is not baked in this build', es: 'hp500/comparison.json no se generó en esta versión' };
    const html = renderToStaticMarkup(
      createElement(
        LinkedViewProvider,
        null,
        createElement(CompareBody, { loo, cb, cbReason: null, comparison: null, comparisonReason: reason, target: 'kW', setTarget: () => undefined, caseId: 'HP500-01', onPickCase: () => undefined, part: 'stage' }),
      ),
    );
    expect(html).toContain('How sure the ranking is: not available yet: hp500/comparison.json is not baked in this build.');
  });
});

describe('N5: a callout band that leaves the drawing no room is never reserved', () => {
  it('the band is bounded to the host’s height less the drawing’s minimum', () => {
    expect(MIN_DRAWING_PX).toBe(160);
    expect(bandLimit(544)).toBe(384);
    expect(reservedBand(508, 3, 327, 544)).toBe(384);
    expect(reservedBand(166, 3, 327, 544)).toBe(174);
    // an unmeasured host does not bound the band
    expect(reservedBand(166, 3, 327, 0)).toBe(174);
  });
  it('adversarial: a swing through a transient band (a collapsed width) holds the band that leaves room, not the transient one', () => {
    let h = nextBand(null, 'k', 166, 384);
    h = nextBand(h, 'k', 508, 384);
    h = nextBand(h, 'k', 166, 384);
    expect(h.band).toBe(166);
    h = nextBand(h, 'k', 508, 384);
    expect(h.band).toBe(166);
  });
  it('a swing between two bands that both leave room still holds the larger (the layout loop F3b closed)', () => {
    let h = nextBand(null, 'k', 166, 384);
    h = nextBand(h, 'k', 240, 384);
    h = nextBand(h, 'k', 166, 384);
    expect(h.band).toBe(240);
  });
});

describe('N8: the staged entry is hidden from its first render', () => {
  it('with motion allowed a new step renders its callouts hidden at once, never the final state first', () => {
    const e = openingEntry(true, false);
    expect(e.shown).toBe(0);
    expect(e.running).toBe(true);
    expect(e.reveal).toBe(0);
  });
  it('reduced motion and a stage without data render the final state from the first frame', () => {
    expect(openingEntry(true, true)).toEqual(FINAL);
    expect(openingEntry(false, false)).toEqual(FINAL);
  });
});

describe('N9: no vacuous or unevenly formatted number', () => {
  const rows = compareRows(loo, cb, 'kW');
  const best = recommend(rows)!;
  it('MAPE with one decimal everywhere: the callouts, the reason and the headline', () => {
    const calls = compareCallouts(rows, best, openingChoice(rows, best, comparison, 'kW')!, comparison, null, 'kW', en);
    expect(calls[0].value).toBe('12.8');
    expect(calls[1].value).toBe('14.0');
    expect(recommendReason(best, rows, 'kW', (v) => en(v, { decimals: 1 })).en).toContain('(12.8 percent');
    expect(storyHeadlines({ caseId: 'HP500-01', op: opOf('HP500-01'), backbone: null, backboneReason: null, loo, looReason: null, cb, cbReason: null, comparison, comparisonReason: null }, 'en').compare.headline).toBe(
      'Setting-only line: lowest held-out power error, 12.8% on average',
    );
  });
  it('adversarial: SENT BACK at the opening pass is the mass sent back over the passes so far, never a vacuous 0 %', () => {
    for (const id of ['HP500-01', 'S01']) {
      const series = neumannPasses(whitenMatrices(opOf(id)));
      const k = openingPass(series);
      const sent = passCallouts(series, k, en, id)[2];
      const total = series.sentBack.slice(0, k).reduce((s, v) => s + v.reduce((a, x) => a + x, 0), 0);
      expect(sent.value).toBe(en(total * 100, { digits: 3 }));
      expect(Number(sent.value)).toBeGreaterThan(1);
      expect(sent.source.en).toMatch(new RegExp(`over passes 1 to ${k}`));
    }
  });
  it('the grip limit in the chamber table has two decimals, as the callout and the headline', () => {
    const html = renderToStaticMarkup(createElement(GeometryTable, { g: { css: 54, throwMm: 30, oss: 84, nip: 21.3, limit: 38.58009243837747 } }));
    expect(html).toContain('<td>38.58</td>');
  });
});
