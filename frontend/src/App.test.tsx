// The landing and the header order (shell 0.13.1, docs/06_executive-view.md): the product opens on the Introduction's executive view,
// the App has its own route and is the leftmost tab, always (App, Introduction, Methodology, Implementation, Experiments, Benchmark),
// and an old App link keeps its query string and hash (WB-008).
import { APP_ROUTE, LANDING_ROUTE, STANDARD_ROUTES } from '@fasl-work/caos-app-shell';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');

describe('the landing', () => {
  it('the routes are the standard ones, the App first and at /app, the landing on the Introduction', () => {
    expect(LANDING_ROUTE).toBe('/introduction');
    expect(APP_ROUTE).toBe('/app');
    expect(STANDARD_ROUTES.map((r) => r.path)).toEqual(['/app', '/introduction', '/methodology', '/implementation', '/experiments', '/benchmark']);
  });

  it('the example header lists the six routes in the decided order, the App leftmost', () => {
    const order = ['/app', '/introduction', '/methodology', '/implementation', '/experiments', '/benchmark'];
    expect(STANDARD_ROUTES.map((route) => route.path)).toEqual(order);
    expect(source).toContain('routes: STANDARD_ROUTES');
  });

  it('the Introduction opens on the executive view', () => {
    expect(source).toContain("const Introduction = lazy(() => import('./pages/Introduction')");
    expect(source).toContain('<Route path="/introduction" element={<Introduction />} />');
    expect(source).toContain('<Suspense fallback=');
    const introduction = readFileSync(new URL('./pages/Introduction.tsx', import.meta.url), 'utf8');
    expect(introduction).toContain('ExecutiveView data={data}');
  });

  it('the App route renders the workbench and not the executive view', () => {
    expect(source).toContain("const Workbench = lazy(() => import('./workbench/Workbench')");
    expect(source).toContain('<Route path="/app" element={<Workbench />} />');
    const workbench = readFileSync(new URL('./workbench/Workbench.tsx', import.meta.url), 'utf8');
    expect(workbench).toContain('<CaseWorkbench');
  });

  it('the root and the catch-all render the shell landing, which opens the Introduction and keeps an old App link', () => {
    expect(source).toContain('<Route path="/" element={<Landing />} />');
    expect(source).toContain('<Route path="/app" element={<Workbench />} />');
    expect(source).toContain('<Route path="*" element={<Landing />} />');
    expect(source).not.toContain('<Route path="/" element={<Workbench');
  });

  it('adversarial: the Introduction-first order of shell 0.13.0 is refused, the landing does not move the tabs', () => {
    expect(STANDARD_ROUTES[0].path).not.toBe(LANDING_ROUTE);
    expect(STANDARD_ROUTES[0].path).toBe(APP_ROUTE);
    expect(STANDARD_ROUTES.map((r) => r.path).indexOf(LANDING_ROUTE)).toBe(1);
  });

  it('the App route opens Focus mode: the workbench sets focus, and the rail head carries the Focus control (WB-014)', () => {
    const workbench = readFileSync(new URL('./workbench/Workbench.tsx', import.meta.url), 'utf8');
    expect(workbench).toMatch(/<CaseWorkbench[\s\S]*?\bfocus\b/);
  });

  it('the old /focus/<machine> route forwards to the App in Focus mode, on the first case of that machine in the index', () => {
    expect(source).toContain('<Route path="/focus/:machine" element={<FocusForward />} />');
    const forward = readFileSync(new URL('./workbench/FocusForward.tsx', import.meta.url), 'utf8');
    expect(forward).toContain('`/app?case=${encodeURIComponent(id)}&focus=1`');
    expect(forward).toContain("'/app?focus=1'");
    expect(forward).toContain('<Navigate replace');
    // the forward is not one of the standard routes: the header never lists it
    expect(STANDARD_ROUTES.map((r) => r.path)).not.toContain('/focus/:machine');
  });

  it('adversarial: the root alone does not render the workbench', () => {
    expect(source).toContain('<Route path="/" element={<Landing />} />');
    expect(source).toContain('<Route path="*" element={<Landing />} />');
    expect(source).not.toContain('<Route path="/" element={<Workbench');
  });
});

// SH-001: the App reaches every view of the visualization catalog at the placement its row names, in at most six tabs with the Context
// tab, and each group opens on one stage (the gate's G6 and G18 measure the stage's share of the viewport on the built site).
import { MAX_WORKBENCH_GROUPS, LinkedViewProvider } from '@fasl-work/caos-app-shell';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import type { CaseData } from './api/artifacts';
import type { CaseManifest, Trace } from './lib/contract.types';
import { SystemGroup } from './views/chamber';
import { LearnedGroup } from './views/learned';
import { PerformanceGroup } from './views/performance';
import { ProductGroup } from './views/product';
import { ViewContext, type ViewCtx } from './views/shared';
import { ValidationGroup } from './views/validation';
import { CATALOG_PLACEMENT, GROUP_ORDER, MAX_TABS, placementProblems, railOf, selectionOf } from './workbench/model';

describe('SH-001: the catalog in the App, one stage per group', () => {
  const derived = new URL('../../data/derived/', import.meta.url);
  const read = <T,>(rel: string): T => JSON.parse(readFileSync(new URL(rel, derived), 'utf8')) as T;
  const manifest = read<CaseManifest>('manifests/HP500-01.json');
  const data: CaseData = { manifest, trace: read<Trace>('HP500-01/trace.json'), traceReason: null };
  const sel = selectionOf(data, railOf(manifest.params), 'canonical');
  const ctx: ViewCtx = { sel, unavailable: null, index: null, loo: null, target: 12, setTarget: () => undefined, canApplyCss: false, applyCss: () => undefined, drift: null, setDrift: () => undefined, pickCase: () => undefined };
  const GROUPS = { system: SystemGroup, product: ProductGroup, performance: PerformanceGroup, learned: LearnedGroup, validation: ValidationGroup } as const;
  /** The sub-views a group renders, in the order of its sub-tab row (the rendered component, not a list typed here). */
  const subviewsOf = (Group: () => ReactElement): string[] => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <LinkedViewProvider>
          <ViewContext.Provider value={ctx}>
            <Group />
          </ViewContext.Provider>
        </LinkedViewProvider>
      </MemoryRouter>,
    );
    return [...html.matchAll(/role="tab"[^>]*data-tab="([^"]+)"/g)].map((m) => m[1]);
  };
  const workbench = readFileSync(new URL('./workbench/Workbench.tsx', import.meta.url), 'utf8');
  const rendered = Object.fromEntries(GROUP_ORDER.map((g) => [g, subviewsOf(GROUPS[g])])) as Record<string, string[]>;

  it('the App has the five groups of the catalog in this order, plus the Context tab: six tabs, the shell’s most', () => {
    expect(MAX_TABS).toBe(MAX_WORKBENCH_GROUPS);
    expect(GROUP_ORDER).toEqual(['system', 'product', 'performance', 'learned', 'validation']);
    const ids = [...workbench.matchAll(/\{ id: '([a-z]+)', label: \{ en: '[^']+', es: '[^']+' \}, lane: 'live'/g)].map((m) => m[1]);
    expect(ids).toEqual([...GROUP_ORDER]);
    expect(workbench).toContain('context={{ content: <ContextView /> }}');
  });
  it('every catalog view sits where its row places it, and the groups it opens open on it', () => {
    expect(rendered.system.slice(0, 2)).toEqual(['circuit', 'chamber']);
    expect(rendered.product.slice(0, 2)).toEqual(['gradation', 'passes']);
    expect(rendered.performance[0]).toBe('campaign');
    expect(rendered.validation[0]).toBe('compare');
    expect(placementProblems([...GROUP_ORDER], rendered)).toEqual([]);
    expect(Object.keys(CATALOG_PLACEMENT)).toEqual(['V1', 'V2', 'V3', 'V4', 'V5', 'V6']);
  });
  it('adversarial: a seventh tab, or a catalog view with no App placement, is refused', () => {
    expect(placementProblems([...GROUP_ORDER, 'extra'], { ...rendered, extra: ['x'] })).toContain('6 groups and the Context tab make 7 tabs; at most 6');
    expect(placementProblems([...GROUP_ORDER], { ...rendered, product: ['gradation', 'breakage'] })).toEqual(['V5: the view passes is not in the group product']);
    expect(placementProblems([...GROUP_ORDER], { ...rendered, system: ['chamber', 'circuit'] })).toEqual(['V1: the group system opens on chamber, not on circuit']);
  });
  it('Focus mode is kept for every group, and the rail and tab row are the compact ones the stage floor needs', () => {
    expect(workbench).toMatch(/\n\s+focus\r?\n/);
    expect(workbench).toContain('tabDensity="compact"');
    expect(workbench).toMatch(/railWidth=\{\d+\}/);
  });
});
