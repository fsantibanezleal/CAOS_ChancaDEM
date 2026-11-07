// Catalog row V1, the circuit (SH-002, SH-003): every stage named by its machine, the active stage's streams labelled from the case's
// manifest and committed trace, a stage that loads only a case of its own machine, and the flow moving at a speed proportional to the
// throughput, standing still under reduced motion without one animation frame asked for.
import { formatNumber, LinkedViewProvider, useLangStore } from '@fasl-work/caos-app-shell';
import { readFileSync } from 'node:fs';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CaseIndex, CaseManifest, Trace } from '../lib/contract.types';
import { cssSeconds, caseForStage, circuitValues, drawCircuit, flowCycleSeconds, FLOW_PERIOD_PX, MACHINE_NAME, STAGE_MACHINES, StreamTable, useReducedMotion, type StagedCase } from './circuit';

const derived = new URL('../../../data/derived/', import.meta.url);
const read = <T,>(rel: string): T => JSON.parse(readFileSync(new URL(rel, derived), 'utf8')) as T;
const index = read<CaseIndex>('manifests/index.json');
const manifests = index.cases.map((c) => read<CaseManifest>(c.manifest_path));
const staged: StagedCase[] = manifests.map((m) => ({ caseId: m.case_id, stage: m.stage, machine: m.params.machine }));
const real = read<CaseManifest>('manifests/HP500-01.json');
const realTrace = read<Trace>('HP500-01/trace.json');
const synth = read<CaseManifest>('manifests/S01.json');
const synthTrace = read<Trace>('S01/trace.json');
const num = (v: number, o: { digits?: number; decimals?: number } = {}) => formatNumber(v, 'en', o);
const wrap = (node: ReactNode) => renderToStaticMarkup(createElement(LinkedViewProvider, null, node));

afterEach(() => {
  vi.unstubAllGlobals();
  Object.assign(useLangStore.getInitialState(), { lang: 'en' });
  useLangStore.setState({ lang: 'en' });
});

/** The values the stream table wrote, by row label. */
function tableValues(html: string): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const m of html.matchAll(/<tr data-stream-value="([^"]*)" data-stream-unit="[^"]*"><td class="caos-col-text"><button[^>]*>([^<]+)<\/button>/g)) out[m[2]] = m[1] === '' ? null : Number(m[1]);
  return out;
}

/** The labelled values that disagree with the case's documents (empty when every one is the document's). */
function mismatches(html: string, m: CaseManifest, tr: Trace): string[] {
  const got = tableValues(html);
  const want: Record<string, number> = m.measured
    ? { Feed: m.measured.feed_tph, 'Feed F80': m.measured.f80_mm, 'Product P80': tr.summary.p80_mm, Power: m.measured.power_kw, 'Closed-side setting': m.measured.css_mm }
    : { Feed: tr.summary.throughput_tph, 'Feed F80': tr.summary.f80_mm, 'Product P80': tr.summary.p80_mm, Power: tr.summary.power_kw, 'Closed-side setting': m.params.css_mm };
  return Object.entries(want)
    .filter(([k, v]) => got[k] !== v)
    .map(([k]) => k);
}

describe('SH-002: the streams carry the case’s own values', () => {
  it('a real survey: measured throughput, F80, power and setting from its manifest, P80 from its trace', () => {
    const html = wrap(createElement(StreamTable, { values: circuitValues(real, realTrace, null) }));
    expect(mismatches(html, real, realTrace)).toEqual([]);
    expect(html).toContain('Survey 1 of Rocha et al. 2024, measured');
  });
  it('a synthetic case: every value from its committed trace, the setting from its manifest', () => {
    const html = wrap(createElement(StreamTable, { values: circuitValues(synth, synthTrace, null) }));
    expect(mismatches(html, synth, synthTrace)).toEqual([]);
    expect(html).toContain('Committed trace of S01');
  });
  it('adversarial: a stream value that differs from the case manifest is caught', () => {
    const planted = { ...real, measured: { ...real.measured!, feed_tph: real.measured!.feed_tph + 1 } };
    const html = wrap(createElement(StreamTable, { values: circuitValues(planted, realTrace, null) }));
    expect(mismatches(html, real, realTrace)).toEqual(['Feed']);
  });
  it('a trace the readiness lists as absent shows the reason, never a number', () => {
    const reason = { en: 'the bake skipped this case', es: 'la generación omitió este caso' };
    const v = circuitValues(synth, null, reason);
    expect(v.p80.value).toBeNull();
    expect(v.p80.missing).toEqual(reason);
    const html = wrap(createElement(StreamTable, { values: v }));
    expect(html).toContain('Not available yet: the bake skipped this case');
  });
  it('every stage is named by its machine, the active one with its values; the drawing has its three subjects', () => {
    const values = circuitValues(real, realTrace, null);
    const machines = { primary: 'gyratory', tertiary: 'cone-short-head' } as const;
    const { node, subjects } = drawCircuit({ values, stageMachines: machines, onPickStage: null, label: { en: 'Circuit', es: 'Circuito' }, width: 1000, height: 400, lang: 'en', num, reduced: false });
    const svg = wrap(node);
    for (const name of [MACHINE_NAME.gyratory.en, MACHINE_NAME['cone-sec'].en, MACHINE_NAME['cone-short-head'].en]) expect(svg).toContain(name);
    expect(svg).toContain('data-stage="secondary" data-active="true"');
    expect(svg).toContain(`${num(real.measured!.feed_tph, { digits: 4 })} t/h`);
    expect(svg).toContain(`P80 ${num(realTrace.summary.p80_mm, { digits: 3 })} mm`);
    expect(svg).toContain(`CSS ${num(real.measured!.css_mm, { digits: 3 })} mm`);
    expect(subjects.map((s) => s.id)).toEqual(['feed', 'product', 'power']);
    for (const s of subjects) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(1000);
    }
  });
  it('a narrow stage stacks the circuit and keeps every label', () => {
    const values = circuitValues(real, realTrace, null);
    const svg = wrap(drawCircuit({ values, stageMachines: {}, onPickStage: null, label: { en: 'Circuit', es: 'Circuito' }, width: 360, height: 420, lang: 'es', num, reduced: false }).node);
    expect(svg).toContain('data-vertical="true"');
    expect(svg).toContain('Chancado secundario');
  });
});

describe('SH-002: a stage loads a case of its own machine', () => {
  it('each stage loads the first case of the index on one of its machines, never a control', () => {
    expect(caseForStage('primary', staged)).toBe('G01');
    expect(caseForStage('secondary', staged)).toBe('HP500-01');
    expect(caseForStage('tertiary', staged)).toBe('H01');
    for (const stage of ['primary', 'secondary', 'tertiary'] as const) {
      const id = caseForStage(stage, staged)!;
      const m = manifests.find((x) => x.case_id === id)!;
      expect(m.stage).toBe(stage);
      expect(STAGE_MACHINES[stage]).toContain(m.params.machine);
    }
  });
  it('adversarial: a stage with no case of its machine is refused rather than loading the wrong case', () => {
    expect(
      caseForStage(
        'primary',
        staged.filter((c) => c.stage !== 'primary'),
      ),
    ).toBeNull();
    const mislabelled: StagedCase[] = [{ caseId: 'X1', stage: 'primary', machine: 'cone-sec' }];
    expect(caseForStage('primary', mislabelled)).toBeNull();
  });
});

describe('SH-003: the flow moves at a speed proportional to the throughput, and stands still under reduced motion', () => {
  it('twice the tonnage moves twice as fast; no tonnage, no flow', () => {
    const a = flowCycleSeconds(600)!;
    const b = flowCycleSeconds(1200)!;
    expect(FLOW_PERIOD_PX / b).toBeCloseTo(2 * (FLOW_PERIOD_PX / a), 9);
    expect(flowCycleSeconds(0)).toBeNull();
    expect(flowCycleSeconds(null)).toBeNull();
  });
  it('the active streams carry the moving dash at the case’s cycle; the others are static', () => {
    const values = circuitValues(real, realTrace, null);
    const svg = wrap(drawCircuit({ values, stageMachines: {}, onPickStage: null, label: { en: 'Circuit', es: 'Circuito' }, width: 1000, height: 400, lang: 'en', num, reduced: false }).node);
    const cycle = cssSeconds(flowCycleSeconds(real.measured!.feed_tph)!);
    expect(svg.match(/data-flow="moving"/g)?.length).toBe(2);
    expect(svg).toContain(`animation-duration:${cycle}s`);
    expect(svg).toContain('cdem-stream-flow');
  });
  it('adversarial: under a planted reduced-motion preference the flow stops and no animation frame is requested', () => {
    // the flow is a CSS animation: the view's module asks the browser for no frame at all, moving or still
    const source = readFileSync(new URL('./circuit.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/request\w*Frame|setInterval|usePausedViz/);
    const reduce = () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined });
    vi.stubGlobal('matchMedia', reduce);
    vi.stubGlobal('window', { matchMedia: reduce });
    function Probe() {
      return createElement('i', { 'data-reduced': String(useReducedMotion()) });
    }
    expect(renderToStaticMarkup(createElement(Probe))).toContain('data-reduced="true"');
    const values = circuitValues(real, realTrace, null);
    const svg = wrap(drawCircuit({ values, stageMachines: {}, onPickStage: null, label: { en: 'Circuit', es: 'Circuito' }, width: 1000, height: 400, lang: 'en', num, reduced: true }).node);
    expect(svg).not.toContain('data-flow="moving"');
    expect(svg).not.toContain('cdem-stream-flow');
    expect(svg).toContain('marker-end="url(#cdem-arrow)"');
  });
  it('the stylesheet stops the flow under prefers-reduced-motion as well', () => {
    const css = readFileSync(new URL('../workbench/workbench.css', import.meta.url), 'utf8');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.cdem-stream-flow\s*\{\s*animation: none;/);
  });
});
