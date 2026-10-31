// The priors table of the CrusherBayes topic in the reader's language: the source of every prior, as the committed document writes it,
// is shown in English unchanged and in Spanish through the translation table keyed by the prior's name, with every number of the
// document formatted by the locale (a decimal comma) and the DOI kept verbatim; a source the table does not know falls back to the
// document's text with its numbers localized, never to a decimal point on a Spanish page.
import { formatNumber } from '@fasl-work/caos-app-shell';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Hp500CrusherBayes } from '../../lib/contract.types';
import { PRIOR_SOURCE_ES, priorSource, priorUnit, sourceNumbers } from './priors';

const cb = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../../data/derived/hp500/crusherbayes.json', import.meta.url)), 'utf8'),
) as Hp500CrusherBayes;
const fmt = (lang: 'en' | 'es') => (v: number, decimals: number) => formatNumber(v, lang, { decimals, grouping: false });
// the G11 rule of the shell gate: a number with a decimal point, outside a URL
const pointDecimal = /(?<![\w.,/:@#])(\d+)\.(\d+)(?![\w/@]|\.\d)/;
const withoutUrls = (s: string) => s.replace(/https?:\/\/[^\s,;()]+/g, '');

describe('the CrusherBayes priors table in the reader language', () => {
  it('every prior of the committed document has a Spanish source, and its template uses every number of the document once', () => {
    for (const p of cb.priors) {
      const tpl = PRIOR_SOURCE_ES[p.name];
      expect(tpl, p.name).toBeTruthy();
      const n = sourceNumbers(p.source).numbers.length;
      const used = [...tpl.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
      expect(used, p.name).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });
  it('in English the source is the document text unchanged', () => {
    for (const p of cb.priors) expect(priorSource(p.name, p.source, 'en', fmt('en'))).toBe(p.source);
  });
  it('in Spanish no number has a decimal point, the decimals carry a comma and the DOI stays verbatim', () => {
    for (const p of cb.priors) {
      const es = priorSource(p.name, p.source, 'es', fmt('es'));
      expect(withoutUrls(es), p.name).not.toMatch(pointDecimal);
      for (const url of sourceNumbers(p.source).urls) expect(es, p.name).toContain(url);
      for (const tok of sourceNumbers(p.source).numbers) expect(es, `${p.name} ${tok}`).toContain(tok.replace('.', ','));
      expect(es, p.name).not.toMatch(/\b(?:nominal: the|width|weakly|standard deviation|plus or minus|multiplier of|shift of)\b/);
    }
    const wi = cb.priors.find((p) => p.name === 'wi_kwh_t');
    expect(wi && priorSource(wi.name, wi.source, 'es', fmt('es'))).toContain('7,2 y 10,6 kWh/t');
  });
  it('adversarial: an unknown prior or a source whose numbers changed falls back to the document text with the numbers localized', () => {
    const unknown = priorSource('new_scalar', 'width: a log standard deviation of 0.15 (Rocha et al. 2024, https://doi.org/10.3390/min14090919)', 'es', fmt('es'));
    expect(unknown).toContain('0,15');
    expect(unknown).toContain('https://doi.org/10.3390/min14090919');
    expect(withoutUrls(unknown)).not.toMatch(pointDecimal);
    const p = cb.priors[0];
    const changed = priorSource(p.name, `${p.source}; one more number 3.5`, 'es', fmt('es'));
    expect(changed).toContain('3,5');
    expect(changed).toContain('one more number');
  });
  it('the unit column is translated where it has words', () => {
    expect(priorUnit('t10 percentage points', 'es')).toBe('puntos porcentuales de t10');
    expect(priorUnit('t10 percentage points', 'en')).toBe('t10 percentage points');
    expect(priorUnit('kWh/t', 'es')).toBe('kWh/t');
  });
});
