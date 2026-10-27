// The Introduction's two views (problem-context-first.md): the shell's ExecutiveView first and open, with its landing block and
// its five sub-tabs, and the technical view second (WB-006): its five areas at their floors in both languages, and the
// constants it states held to the engine's.
import { CitationsProvider, DocPage, useLangStore } from '@fasl-work/caos-app-shell';
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import executive from '../../../content/executive.json';
import { CITATIONS } from '../content/citations';
import { appearanceCum, phiFromT10, t10Calibrated } from '../engine/breakage';
import { calibratedPower, throughput } from '../engine/capacity';
import { classificationParams } from '../engine/classification';
import { makeGrid } from '../engine/sieve';
import { Introduction, IntroductionPage, TechnicalView } from './Introduction';
import { Methodology } from './Methodology';

const page = (node: React.ReactNode) =>
  renderToString(
    <CitationsProvider items={CITATIONS}>
      <MemoryRouter>{node}</MemoryRouter>
    </CitationsProvider>,
  );

// renderToString reads the store's initial state (zustand's server snapshot), so the language is set there
const setLang = (lang: 'en' | 'es') => {
  Object.assign(useLangStore.getInitialState(), { lang });
  useLangStore.setState({ lang });
};
afterEach(() => setLang('en'));

/** The technical view as the shell's DocPage renders it, in one language. */
const technical = (lang: 'en' | 'es') => {
  setLang(lang);
  return page(
    <DocPage title={{ en: 'Introduction', es: 'Introducción' }} lede="x">
      <TechnicalView />
    </DocPage>,
  );
};
const words = (html: string) => html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
/** The html of one area: from its section tag to the next area (or the end). */
const area = (html: string, name: string) => {
  const start = html.indexOf(`data-area="${name}"`);
  if (start < 0) return '';
  const next = html.indexOf('data-area="', start + 1);
  return html.slice(start, next < 0 ? undefined : next);
};
const dense = (html: string) => [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].filter((m) => words(m[1]) >= 40).length;

const escaped = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

describe('the Introduction', () => {
  it('the Introduction opens on the executive view rendered from content/executive.json at schema 2.0.0', () => {
    const html = page(<Introduction />);
    expect(html).toContain('data-executive-view');
    expect(html).toContain('data-executive-schema="2.0.0"');
    expect(html).toContain('data-executive-valid="true"');
    // the executive tab is the first and the selected one; the technical view is the second and is not rendered while closed
    const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*aria-selected="(true|false)"[^>]*>([^<]*)</g)].map((m) => [m[1], m[2]]);
    expect(tabs.slice(0, 2)).toEqual([
      ['true', 'Executive'],
      ['false', 'Technical'],
    ]);
    // the landing block: the problem's title, the key statement and the headline figures with their values
    expect(html).toContain(escaped(executive.title.en));
    expect(html).toContain(escaped(executive.key_statement.en.split('. ')[0]));
    for (const f of executive.headline_figures) expect(html).toContain(escaped(f.value.en));
    // the five sub-tabs, titled as the standard titles them, the first open with its key message line
    const sub = [...html.matchAll(/<button[^>]*role="tab"[^>]*>([^<]*)</g)].map((m) => m[1]);
    for (const title of ['The pain', 'The context', 'The current situation', 'The trends', 'The proposal']) expect(sub).toContain(title);
    expect(html).toContain(escaped(executive.pain.key_message.en));
    // the rubric of the old view is gone, and so is the old brief
    for (const old of ['Industry &amp; Exec Tailoring', 'AI Transformation Story', '4Cs Positioning', 'Delivery &amp; Credibility', 'What this product is']) expect(html).not.toContain(old);
  });

  it('adversarial: an invalid data file renders the error state and not a blank view', () => {
    const bad = JSON.parse(JSON.stringify(executive));
    delete bad.pain.bearers[1].cost;
    const html = page(<IntroductionPage data={bad} />);
    expect(html).toContain('data-executive-valid="false"');
    expect(html).toContain('pain.bearers[1].cost');
    expect(html).not.toContain('data-executive-valid="true"');
  });

  it('adversarial: a file in the old format (schema 1.0.0) is refused with the state of the 0.12.0 fields', () => {
    const html = page(<IntroductionPage data={{ executive: { en: 'Chief Operating Officer', es: 'Director de Operaciones' }, initiative: executive.title }} />);
    expect(html).toContain('data-executive-valid="false"');
  });

  it('adversarial: the Introduction takes the same full-width document layout as Methodology, and sets no reading column of its own', () => {
    // the shell's DocPage renders `page-body wide` (shell 0.13.1; 0.13.0 left the Introduction without `wide`) (WB-011)
    const layout = (html: string) => html.match(/<div class="(page-body[^"]*)" data-doc-page/)?.[1];
    expect(layout(page(<Introduction />))).toContain('wide');
    expect(layout(page(<Introduction />))).toBe(layout(page(<Methodology />)));
    const source = readFileSync(new URL('./Introduction.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/max-width|maxWidth|reading-column/);
  });

  it('the technical view carries the five areas in order, each at its floor, in English and in Spanish (ADR-0017 section 2.1)', () => {
    for (const lang of ['en', 'es'] as const) {
      const html = technical(lang);
      const order = ['problem', 'principles', 'math', 'pipeline', 'honesty'].map((a) => html.indexOf(`data-area="${a}"`));
      expect(
        order.every((i) => i >= 0),
        `${lang}: every area is present`,
      ).toBe(true);
      expect(order, `${lang}: the areas are in the order of the standard`).toEqual([...order].sort((a, b) => a - b));
      expect(dense(area(html, 'problem')), `${lang} problem`).toBeGreaterThanOrEqual(2);
      expect(dense(area(html, 'principles')), `${lang} principles`).toBeGreaterThanOrEqual(2);
      expect((area(html, 'math').match(/data-glossary-item/g) ?? []).length, `${lang} glossary`).toBeGreaterThanOrEqual(10);
      expect((area(html, 'pipeline').match(/<li>/g) ?? []).length, `${lang} pipeline steps`).toBeGreaterThanOrEqual(4);
      expect((area(html, 'honesty').match(/data-callout="honest"/g) ?? []).length, `${lang} honest callouts`).toBe(1);
      expect(dense(area(html, 'honesty')), `${lang} honesty`).toBeGreaterThanOrEqual(1);
      // page level: the overview figure (with its caption) and at least three equations
      expect(html).toMatch(/<figure[^>]*>\s*<svg class="fig-svg wide"[\s\S]*?<figcaption/);
      expect((html.match(/class="katex-display"/g) ?? []).length, `${lang} equations`).toBeGreaterThanOrEqual(3);
    }
  });

  it('adversarial: the executive view holds no equation and no glossary, and the template example is gone from the technical view', () => {
    setLang('en');
    const exec = page(<Introduction />);
    expect(exec).not.toContain('class="equation"');
    expect(exec).not.toContain('data-glossary');
    for (const lang of ['en', 'es'] as const) {
      const html = technical(lang);
      // the SIR example, its figures and its prose must not survive in the technical view
      for (const old of ['SIR', 'epidemic', 'epidemia', 'Hethcote', 'immunis', 'inmuniz', 'Kermack', 'placeholder', 'marcador', 'instantiate']) expect(html, old).not.toContain(old);
      // the style rules: no em-dash, no arrow character, and the plant surveys are "muestreos", never "encuestas"
      expect(html).not.toMatch(/[\u2014\u2192\u2190]/);
      expect(html).not.toMatch(/encuesta/i);
    }
    expect(technical('es')).toContain('muestreos');
    // the two languages are two texts: no Spanish glossary definition repeats its English one
    const defs = (html: string) => [...html.matchAll(/data-glossary-item[\s\S]*?<dd[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => m[1]);
    const en = defs(technical('en'));
    const es = defs(technical('es'));
    expect(en.length).toBeGreaterThanOrEqual(10);
    expect(es.length).toBe(en.length);
    en.forEach((d, i) => expect(es[i], `glossary item ${i}`).not.toBe(d));
  });

  it('adversarial: the constants the view states are the constants of the engine', () => {
    // the grid: 28 classes in a square-root-of-two series from 256 mm, so the finest edge is 256 / 2^14 = 0.015625 mm
    const edges = makeGrid(256, 28);
    expect(edges).toHaveLength(29);
    expect(edges[28]).toBeCloseTo(0.015625, 12);
    // the secondary cone window: K1 = 0.2 + 0.90 CSS, K2 = 6.0 + 1.95 CSS at the design throw of 30 mm, K3 = 2.3
    const k0 = classificationParams('cone-sec', 0, { throwMm: 30 });
    const k10 = classificationParams('cone-sec', 10, { throwMm: 30 });
    expect(k0).toEqual({ k1: 0.2, k2: 6, k3: 2.3 });
    expect(k10.k1).toBeCloseTo(0.2 + 0.9 * 10, 12);
    expect(k10.k2).toBeCloseTo(6 + 1.95 * 10, 12);
    // the capacity of the secondary cone: Q_ref 520 t/h, g_ref 38 mm, n_opt 360 rpm (s e^(1-s) = 1 at s = 1), 647 t/h calibrated
    expect(throughput('cone-sec', 38, 0, 360)).toBeCloseTo(520, 9);
    expect(throughput('cone-sec', 38, 0, 360, true)).toBeCloseTo(647, 9);
    // the calibrated lane: K1 = 0.23 CSS + 0.30 f80, K2 = 12 + 0.55 CSS + 0.40 f80, K3 = 2.3, t10 = 64 - 0.12 CSS - 0.23 f80, Pc = 1.30 Pd + 110
    const cal = classificationParams('cone-sec', 40, { calibrated: true, f80Mm: 100 });
    expect(cal.k1).toBeCloseTo(0.23 * 40 + 30, 12);
    expect(cal.k2).toBeCloseTo(12 + 0.55 * 40 + 40, 12);
    expect(cal.k3).toBe(2.3);
    expect(t10Calibrated(40, 100)).toBeCloseTo((64 - 4.8 - 23) / 100, 12);
    expect(calibratedPower(100)).toBeCloseTo(240, 12);
    // the appearance function (gamma 0.35, beta 4.2) passes through t10 at u = 1/10 and reaches at most 0.1^0.35 = 0.447
    expect(appearanceCum(0.1, phiFromT10(0.3))).toBeCloseTo(0.3, 9);
    expect(Math.pow(0.1, 0.35)).toBeCloseTo(0.447, 3);
    // and the text states them
    const html = technical('en');
    for (const stated of ['0.0156 mm', '647 t/h', '38 to 55 mm', '47 to 140 mm', '813 to 1639 t/h', '187 to 355 kW', '1500 ms', '256 KiB', '121 operating points']) expect(html, stated).toContain(stated);
  });
});
