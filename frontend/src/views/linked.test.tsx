// SH-008: a selection made in one view (a size class, a stream, a stage, a survey, the pass count, the hours) shows in the linked views of
// its catalog row, in both directions, through the shell's linked-view store. The click in a browser is driven by the gate's G21 on the
// story and by src/pages/story.browser.mjs; here the views are rendered over one store and each must show what the other selected.
import { createLinkedViewStore, LinkedViewProvider } from '@fasl-work/caos-app-shell';
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CaseData } from '../api/artifacts';
import type { CaseManifest, Hp500CrusherBayes, Hp500Loo, Trace } from '../lib/contract.types';
import { railOf, selectionOf } from '../workbench/model';
import { opAtHours } from './chamber';
import { circuitValues, drawCircuit, StreamTable } from './circuit';
import { CompareBody } from './compare';
import { HoursProvider, linkedId, passCount, selectedClass, selectedOf, useHours } from './linked';
import { PassesView } from './passes';
import { GradationView, productAtHours } from './product';
import { ViewContext, type ViewCtx } from './shared';

const derived = new URL('../../../data/derived/', import.meta.url);
const read = <T,>(rel: string): T => JSON.parse(readFileSync(new URL(rel, derived), 'utf8')) as T;
const manifest = read<CaseManifest>('manifests/HP500-03.json');
const trace = read<Trace>('HP500-03/trace.json');
const data: CaseData = { manifest, trace, traceReason: null };
const sel = selectionOf(data, railOf(manifest.params), 'canonical');
const ctx = (over: Partial<ViewCtx> = {}): ViewCtx => ({
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
  ...over,
});
const num = (v: number, o: { digits?: number; decimals?: number } = {}) => String(Number(v.toPrecision(o.digits ?? 4)));

/** Renders views over one store, initialised to the state a selection made in either view leaves. */
function over(state: { selectedId?: string | null; cursor?: number | null }, children: ReactNode, c: ViewCtx = ctx()) {
  return renderToStaticMarkup(
    <ViewContext.Provider value={c}>
      <LinkedViewProvider initial={state}>{children}</LinkedViewProvider>
    </ViewContext.Provider>,
  );
}

/** Whether an element of the given side carries the given linked id selected. */
const shows = (html: string, id: string, side: 'scene' | 'panel') =>
  new RegExp(`data-linked-id="${id}" data-linked-view="${side}" data-linked-selected="true"`).test(html) ||
  new RegExp(`data-linked-id="${id}"[^>]*data-linked-view="${side}"[^>]*data-linked-selected="true"`).test(html);

describe('the selection ids', () => {
  it('are namespaced, and a key of another kind is not read as one of this kind', () => {
    expect(linkedId('class', 7)).toBe('class:7');
    expect(selectedOf('class:7', 'class')).toBe('7');
    expect(selectedOf('stream:feed', 'class')).toBeNull();
    expect(selectedClass('class:7', 28)).toBe(7);
    expect(selectedClass('class:40', 28)).toBeNull();
    expect(selectedClass('stage:primary', 28)).toBeNull();
    expect(passCount(null, 28)).toBe(28);
    expect(passCount(4.4, 28)).toBe(4);
    expect(passCount(99, 28)).toBe(28);
  });
  it('the store the views share is the shell’s: a selection from the scene or from the panel is the same state', () => {
    for (const origin of ['scene', 'panel'] as const) {
      const store = createLinkedViewStore();
      store.getState().select('class:9', origin);
      expect(store.getState().selectedId).toBe('class:9');
      expect(store.getState().origin).toBe(origin);
    }
  });
});

describe('SH-008: both directions', () => {
  it('a size class selected in the gradation (V3) is the class the population balance (V5) follows, and the reverse', () => {
    const html = over(
      { selectedId: 'class:9', cursor: 6 },
      <>
        <GradationView />
        <PassesView />
      </>,
    );
    expect(html.match(/data-selected-class="9"/g)?.length).toBe(2);
    expect(html.match(/data-pass-count="6"/g)?.length).toBe(2);
  });
  it('a stream selected on the flowsheet (scene) is selected in the stream table (panel), and the reverse', () => {
    const values = circuitValues(manifest, trace, null);
    const scene = drawCircuit({ values, stageMachines: {}, onPickStage: null, label: { en: 'c', es: 'c' }, width: 900, height: 400, lang: 'en', num, reduced: true }).node;
    for (const id of ['stream:feed', 'stream:product', 'stage:secondary']) {
      const html = over(
        { selectedId: id },
        <>
          {scene}
          <StreamTable values={values} />
        </>,
      );
      expect(shows(html, id, 'scene'), `${id} scene`).toBe(true);
      expect(shows(html, id, 'panel'), `${id} panel`).toBe(true);
    }
  });
  it('adversarial: a selection made in the panel that the scene does not show is caught, and the reverse', () => {
    const values = circuitValues(manifest, trace, null);
    const scene = drawCircuit({ values, stageMachines: {}, onPickStage: null, label: { en: 'c', es: 'c' }, width: 900, height: 400, lang: 'en', num, reduced: true }).node;
    // the scene on a store of its own: the panel's selection never reaches it
    const split = over({ selectedId: 'stream:feed' }, <StreamTable values={values} />) + over({ selectedId: null }, scene);
    expect(shows(split, 'stream:feed', 'panel')).toBe(true);
    expect(shows(split, 'stream:feed', 'scene')).toBe(false);
    const reverse = over({ selectedId: 'stream:feed' }, scene) + over({ selectedId: null }, <StreamTable values={values} />);
    expect(shows(reverse, 'stream:feed', 'scene')).toBe(true);
    expect(shows(reverse, 'stream:feed', 'panel')).toBe(false);
  });
  it('a method selected in the comparison is shown selected, and the survey of the case is the selected survey', () => {
    const loo = read<Hp500Loo>('hp500/loo.json');
    const cb = read<Hp500CrusherBayes>('hp500/crusherbayes.json');
    const html = over({ selectedId: 'method:M2_freeform' }, <CompareBody loo={loo} cb={cb} cbReason={null} target="kW" setTarget={() => undefined} caseId="HP500-03" onPickCase={() => undefined} />);
    expect(shows(html, 'method:M2_freeform', 'panel')).toBe(true);
    expect(shows(html, 'survey:3', 'panel')).toBe(true);
    expect(html).toContain('Free-form fit, held out');
  });
  it('the hours cursor of the campaign (V4) opens the setting in the chamber (V2) and moves the product (V3); without a drift rate it moves nothing', () => {
    expect(opAtHours(sel.op, 20, null).hours).toBeNull();
    expect(productAtHours(sel.op, 20, null)).toBeNull();
    const at = opAtHours(sel.op, 20, 0.05);
    expect(at.op.cssMm).toBeCloseTo(sel.op.cssMm + 1, 12);
    expect(productAtHours(sel.op, 20, 0.05)!.cssMm).toBeCloseTo(at.op.cssMm, 12);
    function Probe() {
      const { hours } = useHours();
      return <i data-hours={hours ?? ''} />;
    }
    expect(
      renderToStaticMarkup(
        <HoursProvider initial={20}>
          <Probe />
          <Probe />
        </HoursProvider>,
      ).match(/data-hours="20"/g)?.length,
    ).toBe(2);
    const html = over(
      {},
      <HoursProvider initial={20}>
        <GradationView />
      </HoursProvider>,
      ctx({ drift: 0.05 }),
    );
    expect(html).toContain('data-hours="20"');
  });
});
