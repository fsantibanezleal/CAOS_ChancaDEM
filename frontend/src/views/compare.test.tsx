// Catalog row V6, comparison and decision (SH-009): the held-out MAPE of every method of hp500-loo and hp500-crusherbayes for throughput
// and for power, the ten per-survey errors whose mean is that MAPE, and the method with the lowest held-out MAPE marked as recommended,
// never a control; with CrusherBayes absent the other methods are drawn and the view says CrusherBayes is not available.
import { LinkedViewProvider } from '@fasl-work/caos-app-shell';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Hp500CrusherBayes, Hp500Loo } from '../lib/contract.types';
import { caseOfSurvey, CompareBody, compareRows, METHOD_NAME, recommend, recommendReason, surveyOfCase, type CompareTarget } from './compare';

const derived = new URL('../../../data/derived/', import.meta.url);
const loo = JSON.parse(readFileSync(new URL('hp500/loo.json', derived), 'utf8')) as Hp500Loo;
const cb = JSON.parse(readFileSync(new URL('hp500/crusherbayes.json', derived), 'utf8')) as Hp500CrusherBayes;
const TARGETS: CompareTarget[] = ['tph', 'kW'];

/** The lowest held-out MAPE among the forecasting methods, read straight from the documents. */
function documentsLowest(target: CompareTarget): { id: string; mape: number } {
  const strict = loo.loo[target].strict as unknown as Record<string, { mape_pct: number } | undefined>;
  const all = ['M0_backbone', 'M1_residual', 'M2_freeform', 'B_lin', 'Morrell', 'Morrell_noload'].flatMap((id) => (strict[id] ? [{ id, mape: strict[id]!.mape_pct }] : []));
  all.push({ id: 'crusherbayes', mape: cb.loo[target].scores.mape_pct });
  return all.reduce((a, b) => (b.mape < a.mape ? b : a));
}

describe('SH-009: every method on shared axes, read from the documents', () => {
  for (const target of TARGETS) {
    it(`${target}: the rows are the documents' methods with their held-out MAPE, the controls marked as controls`, () => {
      const rows = compareRows(loo, cb, target);
      const strict = loo.loo[target].strict as unknown as Record<string, { mape_pct: number } | undefined>;
      for (const r of rows) {
        if (r.id === 'crusherbayes') expect(r.mape).toBe(cb.loo[target].scores.mape_pct);
        else expect(r.mape).toBe(strict[r.id]!.mape_pct);
        expect(METHOD_NAME[r.id].en.length).toBeGreaterThan(3);
      }
      expect(
        rows
          .filter((r) => r.control)
          .map((r) => r.id)
          .sort(),
      ).toEqual(['M1_label_shuffle', 'constant_mean']);
      expect(rows.some((r) => r.id === 'crusherbayes')).toBe(true);
    });
    it(`${target}: the ten per-survey errors are recomputed from the predictions, and their mean is the document's MAPE`, () => {
      for (const r of compareRows(loo, cb, target)) {
        if (!r.errors) continue;
        expect(r.errors.length).toBe(loo.n);
        const mean = r.errors.reduce((a, v) => a + v, 0) / r.errors.length;
        expect(Math.abs(mean - r.mape), r.id).toBeLessThan(0.02);
      }
    });
    it(`${target}: the recommended method is the lowest held-out MAPE, and its reason says so`, () => {
      const best = recommend(compareRows(loo, cb, target))!;
      const want = documentsLowest(target);
      expect(best.id).toBe(want.id);
      expect(best.mape).toBe(want.mape);
      const reason = recommendReason(best, compareRows(loo, cb, target), target, (v) => v.toFixed(2));
      expect(reason.en).toContain(best.name.en);
      expect(reason.en).toContain('lowest held-out error');
      expect(reason.es).toContain(best.name.es);
    });
  }
  it('adversarial: a planted ordering where another method is the lowest moves the recommendation to it', () => {
    const rows = compareRows(loo, cb, 'kW');
    const planted = rows.map((r) => (r.id === 'M2_freeform' ? { ...r, mape: 1 } : r));
    expect(recommend(planted)!.id).toBe('M2_freeform');
    expect(recommend(rows)!.id).not.toBe('M2_freeform');
  });
  it('adversarial: a control with the lowest MAPE is never the recommendation', () => {
    const planted = compareRows(loo, cb, 'tph').map((r) => (r.id === 'constant_mean' ? { ...r, mape: 0.5 } : r));
    expect(recommend(planted)!.control).toBe(false);
  });
  it('the rendered view marks the recommended method and states its reason', () => {
    for (const target of TARGETS) {
      const html = renderToStaticMarkup(
        createElement(LinkedViewProvider, null, createElement(CompareBody, { loo, cb, cbReason: null, target, setTarget: () => undefined, caseId: 'HP500-03', onPickCase: () => undefined })),
      );
      const want = documentsLowest(target);
      expect(html).toContain(`data-recommended="${want.id}"`);
      expect(html).toContain('(recommended)');
      expect(html).toContain('lowest held-out error');
    }
  });
  it('without CrusherBayes the other methods are drawn and the view says CrusherBayes is not available', () => {
    const rows = compareRows(loo, null, 'kW');
    expect(rows.some((r) => r.id === 'crusherbayes')).toBe(false);
    expect(rows.length).toBeGreaterThan(5);
    const html = renderToStaticMarkup(
      createElement(
        LinkedViewProvider,
        null,
        createElement(CompareBody, {
          loo,
          cb: null,
          cbReason: { en: 'the sampler was not run for this build.', es: 'el muestreador no se ejecutó para esta versión.' },
          target: 'kW',
          setTarget: () => undefined,
          caseId: undefined,
          onPickCase: () => undefined,
        }),
      ),
    );
    expect(html).toContain('CrusherBayes is not available: the sampler was not run for this build.');
  });
  it('a survey of the comparison is the case of the circuit and the gradation', () => {
    expect(caseOfSurvey(3)).toBe('HP500-03');
    expect(surveyOfCase('HP500-03')).toBe(3);
    expect(surveyOfCase('S01')).toBeNull();
  });
});
