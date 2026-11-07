// Catalog row V5, the population balance (SH-004): the Neumann series of the solve computed from the live engine's B, C and f, equal to
// the closed form to 1e-9 once it has run as many passes as size classes, its residual against the pass count, and the size distribution
// (V3) drawing the product after the pass the shared cursor holds.
import { LinkedViewProvider } from '@fasl-work/caos-app-shell';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CaseData } from '../api/artifacts';
import { evaluate } from '../engine/engine';
import { closedFormProduct, neumannPasses, passingOf, passesToResidual, whitenMatrices, type WhitenMatrices } from '../engine/passes';
import type { Operating } from '../engine/types';
import type { CaseManifest, Trace } from '../lib/contract.types';
import { operatingOf, railOf, selectionOf } from '../workbench/model';
import { passCurves, PassesView, SOLVE_TOLERANCE } from './passes';
import { GradationView } from './product';
import { ViewContext, type ViewCtx } from './shared';

const derived = new URL('../../../data/derived/', import.meta.url);
const read = <T,>(rel: string): T => JSON.parse(readFileSync(new URL(rel, derived), 'utf8')) as T;
const IDS = ['S01', 'HP500-01', 'G01', 'J01', 'H01', 'T01'];
const ops: Record<string, Operating> = Object.fromEntries(IDS.map((id) => [id, operatingOf(read<CaseManifest>(`manifests/${id}.json`).params)]));
const maxAbs = (a: readonly number[], b: readonly number[]) => a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);

describe('SH-004: the series of the live engine’s matrices is the closed form after n passes', () => {
  for (const id of IDS) {
    it(`${id}: p_n at n = the number of size classes equals the closed form to 1e-9, and the closed form is the engine's product`, () => {
      const m = whitenMatrices(ops[id]);
      const s = neumannPasses(m);
      expect(s.n).toBe(m.n);
      expect(s.product.length).toBe(m.n + 1);
      expect(maxAbs(s.product[m.n], s.closed)).toBeLessThan(1e-9);
      const total = s.closed.reduce((a, v) => a + Math.max(0, v), 0);
      expect(
        maxAbs(
          s.closed.map((v) => Math.max(0, v) / total),
          evaluate(ops[id]).product.mass,
        ),
      ).toBeLessThan(1e-9);
    });
  }
  it('B is strictly lower triangular (the breakage gate), so B C is nilpotent', () => {
    const m = whitenMatrices(ops.S01);
    for (let i = 0; i < m.n; i++) for (let j = i; j < m.n; j++) expect(m.B[i * m.n + j]).toBe(0);
  });
  it('the residual starts at the whole product, never rises, and reaches the tolerance before n', () => {
    const s = neumannPasses(whitenMatrices(ops['HP500-01']));
    expect(s.residual[0]).toBeCloseTo(
      s.closed.reduce((a, v) => a + Math.abs(v), 0),
      12,
    );
    for (let k = 1; k < s.residual.length; k++) expect(s.residual[k]).toBeLessThanOrEqual(s.residual[k - 1] + 1e-15);
    const k = passesToResidual(s, SOLVE_TOLERANCE)!;
    expect(k).toBeGreaterThan(0);
    expect(k).toBeLessThanOrEqual(s.n);
    expect(s.residual[k]).toBeLessThan(SOLVE_TOLERANCE);
    expect(s.residual[k - 1]).toBeGreaterThanOrEqual(SOLVE_TOLERANCE);
  });
  it('mass is conserved pass by pass: what has left plus what is still in the chamber is the feed', () => {
    const m = whitenMatrices(ops.S01);
    const s = neumannPasses(m);
    // the finest class has no finer class to break into, so its nipped mass is the engine's closure residual, kept out of both sums
    for (let k = 0; k <= m.n; k++) {
      const out = s.product[k].reduce((a, v) => a + v, 0);
      const lostToFinest = s.sentBack.slice(0, k).reduce((a, v) => a + v[m.n - 1], 0);
      expect(out + s.inChamber[k] + lostToFinest).toBeCloseTo(1, 9);
    }
  });
  it('adversarial: a planted change of one entry of B moves p_n away from the replay and fails the closed-form equality', () => {
    const m = whitenMatrices(ops.S01);
    const planted: WhitenMatrices = { ...m, B: Float64Array.from(m.B) };
    planted.B[12 * m.n + 4] += 0.05;
    const s = neumannPasses(planted);
    expect(maxAbs(s.product[m.n], closedFormProduct(m))).toBeGreaterThan(1e-6);
    const total = closedFormProduct(m).reduce((a, v) => a + v, 0);
    expect(
      maxAbs(
        s.product[m.n].map((v) => v / total),
        evaluate(ops.S01).product.mass,
      ),
    ).toBeGreaterThan(1e-6);
  });
  it('the curve after the last pass is the engine’s product curve; before it, it lies under it', () => {
    const s = neumannPasses(whitenMatrices(ops.S01));
    const r = evaluate(ops.S01);
    expect(maxAbs(passCurves(s, s.n).after, r.product.passing)).toBeLessThan(1e-9);
    const early = passCurves(s, 3).after;
    for (let i = 0; i < early.length; i++) expect(early[i]).toBeLessThanOrEqual(r.product.passing[i] + 1e-12);
    expect(passingOf(s.closed, s.closed)[0]).toBeCloseTo(1, 12);
  });
});

describe('SH-004: the gradation (V3) draws the product after the pass the shared cursor holds', () => {
  const manifest = read<CaseManifest>('manifests/S01.json');
  const data: CaseData = { manifest, trace: read<Trace>('S01/trace.json'), traceReason: null };
  const sel = selectionOf(data, railOf(manifest.params), 'canonical');
  const ctx: ViewCtx = {
    sel,
    unavailable: null,
    index: null,
    loo: null,
    target: 12,
    setTarget: () => undefined,
    canApplyCss: false,
    applyCss: () => undefined,
    drift: null,
    setDrift: () => undefined,
    pickCase: () => undefined,
  };
  const render = (cursor: number | null) =>
    renderToStaticMarkup(
      <ViewContext.Provider value={ctx}>
        <LinkedViewProvider initial={{ cursor }}>
          <GradationView />
          <PassesView />
        </LinkedViewProvider>
      </ViewContext.Provider>,
    );
  it('both views stand at the same pass', () => {
    const html = render(5);
    expect(html.match(/data-pass-count="5"/g)?.length).toBe(2);
  });
  it('with no pass chosen, both draw the exact product (n passes)', () => {
    const html = render(null);
    expect(html.match(/data-pass-count="28"/g)?.length).toBe(2);
  });
});
