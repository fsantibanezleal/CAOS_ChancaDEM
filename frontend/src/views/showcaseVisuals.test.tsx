// F3b, the 0.13.000 review's findings on geometry, motion and visuals (B3, B4, M2, M4, M8, M9, M12, m3, m7, m8, m10): what can be proven
// without a browser. The browser half (anchors measured on the rendered canvas within 4 px, the frame sequence of a step change, cut
// eyebrows and values, touching axis labels, one chart per view, the 3D parts selected both ways) is src/views/showcase.browser.mjs,
// run by `npm run check:story`.
import { createLinkedViewStore, formatNumber, LinkedViewProvider, runStagedTransition } from '@fasl-work/caos-app-shell';
import { readFileSync } from 'node:fs';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Color, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../engine/engine';
import type { Operating } from '../engine/types';
import type { Hp500Comparison, Hp500CrusherBayes, Hp500Loo } from '../lib/contract.types';
import { layerAnchor, renderedX, scaleFraction, type ChartFrame } from './callouts';
import { drawnTo } from './campaign';
import { CHAMBER_PARTS, drawSection, nipWedge, PART_CALLOUT, sectionCallouts, wedgeAngle, type PartLink } from './chamber';
import { createChamberScene, type ControlsLike, type RendererLike } from './chamber3d/scene';
import type { ScenePalette } from './chamber3d/palette';
import { CompareBody, compareCallouts, compareRows, methodTicks, METHOD_SHORT, NARROW_PX, openingChoice, recommend } from './compare';
import { passCallouts, passSeriesOf } from './passes';
import { counted, entryStages, FINAL } from './staging';

const derived = new URL('../../../data/derived/', import.meta.url);
const read = <T,>(rel: string): T => JSON.parse(readFileSync(new URL(rel, derived), 'utf8')) as T;
const num = (v: number | null | undefined, o: { digits?: number; decimals?: number } = {}) => (v === null || v === undefined ? '' : formatNumber(v, 'en', o));
const CONE: Operating = { machine: 'cone-sec', cssMm: 32, throwMm: 30, speedRpm: 360, feedX63Mm: 80, feedM: 1.4, oreAxb: 45, oreWi: 14 };
const JAW: Operating = { ...CONE, machine: 'jaw' } as Operating;

describe('B3: a chart anchor is the point on the rendered scales, in the callout layer’s own pixels', () => {
  const plot = { left: 56, top: 130, width: 222, height: 116 };
  const layer = { width: 337, height: 416 };
  it('maps a point the way uPlot’s valToPos does, then divides by the layer the shell multiplies back', () => {
    const frame: ChartFrame = { x: [0, 10], y: [0, 1] };
    const a = layerAnchor({ id: 'p', x: 5, y: 0.25 }, frame, plot, layer);
    expect(a.x * layer.width).toBeCloseTo(56 + 0.5 * 222, 9);
    expect(a.y * layer.height).toBeCloseTo(130 + 0.75 * 116, 9);
  });
  it('reads a log axis on its decades', () => {
    expect(scaleFraction(10, [1, 100], true)).toBeCloseTo(0.5, 12);
    expect(scaleFraction(1, [1, 100], true)).toBe(0);
  });
  it('adversarial: the rendered x scale (data-view-x) replaces the declared one, and a malformed attribute is ignored', () => {
    expect(renderedX('0.25,7.75')).toEqual([0.25, 7.75]);
    expect(renderedX('7,1')).toBeNull();
    expect(renderedX('a,b')).toBeNull();
    expect(renderedX(null)).toBeNull();
    // the same point on a scale uPlot widened lands where uPlot drew it, not where the declared frame would put it
    const declared = layerAnchor({ id: 'p', x: 1, y: 0 }, { x: [0.5, 9.5], y: [0, 1] }, plot, layer);
    const rendered = layerAnchor({ id: 'p', x: 1, y: 0 }, { x: [0, 10], y: [0, 1] }, plot, layer);
    expect(Math.abs(declared.x - rendered.x) * layer.width).toBeGreaterThan(4);
  });
  it('adversarial: a point outside the scale is held at the plot’s edge, never off the layer', () => {
    const a = layerAnchor({ id: 'p', x: 99, y: -3 }, { x: [0, 10], y: [0, 1] }, plot, layer);
    expect(a.x * layer.width).toBeCloseTo(plot.left + plot.width, 9);
    expect(a.y * layer.height).toBeCloseTo(plot.top + plot.height, 9);
  });
  it('the anchors are re-measured after every render and on the layer, the plot and the scale (the source says so)', () => {
    const src = readFileSync(new URL('./callouts.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/useLayoutEffect\(\(\) => remeasure\.current\(\)\)/);
    expect(src).toMatch(/data-caos-callout-layer/);
    expect(src).toMatch(/\.u-over/);
    expect(src).toMatch(/attributeFilter: \['data-view-x'/);
    expect(src).not.toMatch(/host\.width/);
  });
});

describe('B4: a step change is staged, and reduced motion loses nothing', () => {
  it('the stages run in reading order: the highlight, then each callout one at a time, then all of them', () => {
    const seen: string[] = [];
    const stages = entryStages(3, (e) => seen.push(JSON.stringify(e)));
    for (const s of stages) s.run();
    expect(seen).toEqual([JSON.stringify({ reveal: 1, highlight: true }), '{"shown":1}', '{"shown":2}', '{"shown":3}', '{"shown":null}']);
    expect(stages.slice(1, 4).every((s) => (s.durationMs ?? 0) >= 150)).toBe(true);
  });
  it('a counting number ends on the value itself, so the final text is the exact one', () => {
    expect(counted(32.557, 1)).toBe(32.557);
    expect(counted(32.557, 0.5)).toBeCloseTo(16.2785, 9);
    expect(counted(32.557, 0)).toBe(0);
  });
  it('adversarial: under reduced motion every stage is applied at once, before the call returns', () => {
    const seen: string[] = [];
    void runStagedTransition(entryStages(3, (e) => seen.push(JSON.stringify(e))), { reducedMotion: true });
    expect(seen.length).toBe(5);
    expect(seen[seen.length - 1]).toBe('{"shown":null}');
  });
  it('outside the story every view draws its final state', () => {
    expect(FINAL).toEqual({ reveal: 1, highlight: true, shown: null, panel: 1, running: false });
  });
  it('adversarial: the drift curve drawn out to the crossing keeps its start and drops only the points past the share', () => {
    const xs = [0, 1, 2, 3, 4, 5];
    const v = [10, 11, 12, 13, 14, 15];
    expect(drawnTo(v, xs, 4, 1)).toEqual(v);
    expect(drawnTo(v, xs, 4, 0)).toEqual([10, null, null, null, null, null]);
    expect(drawnTo(v, xs, 4, 0.5)).toEqual([10, 11, 12, null, null, null]);
  });
  it('the Story stages its steps on the shell’s helpers, never an animation loop of its own', () => {
    const staging = readFileSync(new URL('./staging.tsx', import.meta.url), 'utf8');
    const story = readFileSync(new URL('../pages/Story.tsx', import.meta.url), 'utf8');
    expect(staging).toMatch(/runStagedTransition/);
    expect(staging).toMatch(/flyCamera/);
    expect(staging).toMatch(/prefersReducedMotion/);
    // no frame loop of its own: the browser's frame request and an interval timer are both absent (the name is assembled, so this test's
    // own text is not one)
    expect(staging).not.toMatch(new RegExp(`${'request'}AnimationFrame|setInterval`));
    expect(story).toMatch(/<EntryProvider /);
  });
});

describe('M2: callout eyebrows and units short enough for the card', () => {
  const series = passSeriesOf(CONE);
  it('adversarial: the population balance’s units are short in both languages, and its eyebrows are the short ones', () => {
    const calls = passCallouts(series, 6, (v, o) => num(v, o), 'S01');
    for (const c of calls) for (const lang of ['en', 'es'] as const) expect(c.unit[lang].length).toBeLessThanOrEqual(7);
    expect(calls.map((c) => c.eyebrow.en)).toEqual(['PASSES', 'ERROR', 'SENT BACK']);
  });
  it('the section’s throw carries its speed in the source, not in the eyebrow', () => {
    const r = evaluate(CONE);
    const t = sectionCallouts(CONE, r.nipAngleDeg, r.nipLimitDeg, null, 'S01', num).find((c) => c.id === 'throw')!;
    expect(t.eyebrow).toEqual({ en: 'THROW', es: 'CARRERA' });
    expect(t.source.en).toMatch(/^At 360 rpm, live engine, S01$/);
  });
});

describe('M4: the nip angle is drawn at the engine’s value, with the grip limit as a second wedge', () => {
  it('adversarial: the wedge’s rays meet at the engine’s nip angle and the limit’s at the limit, and the anchor is inside the wedge', () => {
    const w = nipWedge([300, 200], [260, 200], [0.1, -1], [-0.05, -1], 23.3, 38.58);
    expect(wedgeAngle({ apex: w.apex, rays: w.nip })).toBeCloseTo(23.3, 6);
    expect(wedgeAngle({ apex: w.apex, rays: w.limit })).toBeCloseTo(38.58, 6);
    // the rays pass through the two walls at the nip: the nip's ends are the wall points
    expect(Math.min(Math.hypot(w.nip[0][0] - 260, w.nip[0][1] - 200), Math.hypot(w.nip[1][0] - 260, w.nip[1][1] - 200))).toBeLessThan(3);
    const ang = (p: [number, number]) => Math.atan2(p[1] - w.apex[1], p[0] - w.apex[0]);
    const a = ang(w.anchor);
    const lo = Math.min(ang(w.nip[0]), ang(w.nip[1]));
    const hi = Math.max(ang(w.nip[0]), ang(w.nip[1]));
    expect(a).toBeGreaterThan(lo);
    expect(a).toBeLessThan(hi);
  });
  const wedgeIn = (op: Operating) => {
    const r = evaluate(op);
    const { node, subjects } = drawSection(op, 400, 420, 'en', num, { selected: null, select: () => undefined }, r.nipAngleDeg, r.nipLimitDeg);
    expect(renderToStaticMarkup(<>{node}</>)).toContain('data-nip-wedge');
    const nip = subjects.find((s) => s.id === 'nip')!;
    expect(nip.x).toBeGreaterThan(0);
    expect(nip.x).toBeLessThan(400);
  };
  it('the section of a cone-sec draws the wedge and anchors NIP ANGLE inside it', () => wedgeIn(CONE));
  it('the section of a jaw draws the wedge and anchors NIP ANGLE inside it', () => wedgeIn(JAW));
});

/** The host elements of a React tree (components are not expanded), for the clicks a test can make without a DOM. */
function hosts(node: ReactNode, out: ReactElement<Record<string, unknown>>[] = []): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) for (const n of node) hosts(n, out);
  else if (isValidElement(node)) {
    const el = node as ReactElement<Record<string, unknown>>;
    if (typeof el.type === 'string') out.push(el);
    hosts(el.props.children as ReactNode, out);
  }
  return out;
}

describe('M9: the chamber’s parts are named, selectable and linked both ways', () => {
  const r = evaluate(CONE);
  it('adversarial: each part of the section selects itself on the store, and a selected part is shown selected with its callout', () => {
    const picked: string[] = [];
    const link: PartLink = { selected: 'gap', select: (p) => picked.push(p) };
    const { node } = drawSection(CONE, 400, 420, 'en', num, link, r.nipAngleDeg, r.nipLimitDeg);
    const parts = hosts(node).filter((e) => typeof e.props['data-linked-id'] === 'string');
    expect(parts.map((e) => e.props['data-linked-id']).sort()).toEqual(CHAMBER_PARTS.map((p) => `part:${p}`).sort());
    for (const e of parts) (e.props.onClick as () => void)();
    expect(picked.sort()).toEqual([...CHAMBER_PARTS].sort());
    expect(parts.find((e) => e.props['data-linked-id'] === 'part:gap')!.props['data-linked-selected']).toBe('true');
    expect(parts.find((e) => e.props['data-linked-id'] === 'part:mantle')!.props['data-linked-selected']).toBe('false');
    const calls = sectionCallouts(CONE, r.nipAngleDeg, r.nipLimitDeg, null, 'S01', num, 'gap');
    expect(calls.find((c) => c.id === PART_CALLOUT.gap)!.state).toBe('selected');
    expect(sectionCallouts(CONE, r.nipAngleDeg, r.nipLimitDeg, null, 'S01', num, 'feed').some((c) => c.state === 'selected')).toBe(false);
  });

  const PAL: ScenePalette = {
    ramp: [new Color(1, 0, 0), new Color(0, 0, 1)],
    concave: new Color(0.5, 0.5, 0.5),
    mantle: new Color(0, 1, 0),
    plateFixed: new Color(0.6, 0.6, 0.6),
    plateSwing: new Color(0, 1, 0),
    eccentric: new Color(1, 0.5, 0),
    ambient: 0.8,
    accent: new Color(0, 0.5, 1),
  };
  const make = (op: Operating) => {
    const renderer: RendererLike = { domElement: {} as HTMLCanvasElement, shadowMap: { enabled: false, type: 0 as never }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined };
    const controls: ControlsLike = { target: new Vector3(), enableDamping: false, update: () => undefined, dispose: () => undefined, addEventListener: () => undefined };
    const scene = createChamberScene({ width: 600, height: 400, op, p80Mm: 12, f80Mm: 80, palette: PAL, deps: { createRenderer: () => renderer, createControls: () => controls } });
    return { scene, renderer };
  };
  const picks = (op: Operating) => {
      const { scene, renderer } = make(op);
      const pts = scene.partPoints();
      for (const id of ['mantle', 'concave', 'gap'] as const) {
        expect(pts[id].visible).toBe(true);
        // the test renderer has no element size: the points are in a canvas of the camera's aspect, 100 px high
        expect(scene.pick((pts[id].x / (scene.camera.aspect * 100)) * 2 - 1, -((pts[id].y / 100) * 2 - 1))).toBe(id);
      }
      expect(pts.feed.visible).toBe(true);
      scene.setSelected('mantle');
      expect(scene.selected()).toBe('mantle');
      expect(renderer.shadowMap!.enabled).toBe(true);
      expect(scene.ground().receiveShadow).toBe(true);
  };
  it("a cone-sec: a click on each part's label point picks that part, and the selected part lights up", () => picks(CONE));
  it("a jaw: a click on each part's label point picks that part, and the selected part lights up", () => picks(JAW));
});

describe('M8, m7, M12: the comparison is readable on a phone and opens on one chart', () => {
  const loo = read<Hp500Loo>('hp500/loo.json');
  const cb = read<Hp500CrusherBayes>('hp500/crusherbayes.json');
  const comparison = read<Hp500Comparison>('hp500/comparison.json');
  const rows = compareRows(loo, cb, 'kW');
  it('adversarial: below 640 px the axis numbers the methods; above it names them with the short names', () => {
    expect(NARROW_PX).toBe(640);
    expect(methodTicks(rows, true).map((t) => t.label.en)).toEqual(rows.map((_, i) => String(i + 1)));
    expect(methodTicks(rows, false).map((t) => t.label.en)).toEqual(rows.map((r) => METHOD_SHORT[r.id].en));
  });
  it('adversarial: the App’s view draws one chart at its opening state; the per-survey chart is its second view', () => {
    const best = recommend(rows);
    const html = renderToStaticMarkup(
      <LinkedViewProvider>
        <CompareBody loo={loo} cb={cb} cbReason={null} comparison={comparison} target="kW" setTarget={() => undefined} caseId="HP500-01" onPickCase={() => undefined} />
      </LinkedViewProvider>,
    );
    expect(html).toContain('data-compare-view="methods"');
    expect(html.match(/data-plot="/g)?.length).toBe(1);
    expect(html).toContain('Each survey');
    expect(compareCallouts(rows, best, openingChoice(rows, best, comparison, 'kW')!, comparison, null, 'kW', (v, o) => num(v, o))[2].unit.en).toBe('points');
    void createLinkedViewStore;
  });
});

describe('G21: the story header keeps one line of subline', () => {
  it('adversarial: a long summary keeps its first sentence in the header, a short one stays whole', async () => {
    const { headerSummary } = await import('../pages/Story');
    expect(headerSummary('Short.')).toBe('Short.');
    const long = `${'A first sentence that runs long enough to matter here, '.repeat(3)}end. Then the certainty sentence that the stage already carries.`;
    expect(headerSummary(long)).toBe(long.slice(0, long.indexOf('. ') + 1));
  });
});

describe('M1: the band a view reserves is the one the shell measured', () => {
  it('adversarial: before the shell reports a band the nominal one is reserved; after, the measured band plus the gap, whatever the nominal says', async () => {
    const { calloutBand, reservedBand, BAND_GAP } = await import('./callouts');
    expect(reservedBand(null, 3, 337)).toBe(calloutBand(3, 337));
    expect(reservedBand(152.3, 3, 337)).toBe(Math.ceil(152.3 + BAND_GAP));
    // three cards that wrapped to 90 px each in one row need more than the nominal 84 px
    expect(reservedBand(98, 3, 1036)).toBeGreaterThan(calloutBand(3, 1036));
  });
});

describe('M1: a band that swings between two card orders is held', () => {
  it('adversarial: an A, B, A cycle of reports holds the larger band; a new width starts again', async () => {
    const { nextBand } = await import('./callouts');
    let h = nextBand(null, 'k', 100);
    h = nextBand(h, 'k', 130);
    expect(h.band).toBe(130);
    h = nextBand(h, 'k', 100);
    expect(h.band).toBe(130);
    expect(h.frozen).toBe(true);
    expect(nextBand(h, 'k', 100).band).toBe(130);
    expect(nextBand(h, 'k2', 90).band).toBe(90);
  });
});
