// The anchored callouts of every primary view and story stage (ADR-0082 section 5, SH-007), on the shell's SceneCallouts in its header
// placement: the cards sit in a band at the top of the view, each with a leader to the point of the drawing it describes, so no card
// covers its subject or another card. The drawing takes the rest of the view below the band. Two hosts:
// - CalloutStage, for a drawing of the product's own (the circuit, the chamber section): the drawing reports where its subjects are, in
//   pixels of the stage, and the anchors are those points, exact;
// - ChartCallouts, over a shell chart: each anchor is the data point on the chart as uPlot rendered it, in the callout layer's own pixels.
//   The x scale is the one uPlot rendered (the chart publishes it as `data-view-x`), the y scale the chart's fixed `y.range` (every
//   callout chart passes the frame's y as its range, so uPlot renders exactly it), and the plot area is uPlot's `.u-over` measured
//   against the callout layer at the same instant, so a transform of the stage (the story's entry) or a band that moves the chart
//   without resizing it (the band is first sized for the default width, then for the measured one) cannot leave an anchor behind:
//   the anchors are re-measured after every render, when the host, the layer or the plot resizes, and when uPlot's scale changes
//   (B3 of the 0.13.000 review, measured in the browser by src/views/showcase.browser.mjs within 4 px).
// Every value carries its unit and its source; a callout whose value is missing says "not available" with the reason as its source.
import { SceneCallouts, Stage, useShellLang, type BiText, type CalloutState, type SceneCalloutDef } from '@fasl-work/caos-app-shell';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

type Both = { en: string; es: string };

export interface CalloutSpec {
  id: string;
  eyebrow: Both;
  /** The value already formatted in the reader's language, or null when it is missing. */
  value: string | null;
  unit: Both;
  state: CalloutState;
  source: Both;
  /** Why the value is missing (the readiness reason), used as the source when `value` is null. */
  missing?: Both;
  trend?: 'up' | 'down' | 'flat';
}

const NOT_AVAILABLE = { en: 'not available', es: 'no disponible' };

/** A spec and its anchor (normalised to the host) as the shell's callout definition. */
export function toCallout(spec: CalloutSpec, anchor: { x: number; y: number }, lang: 'en' | 'es'): SceneCalloutDef {
  const clamp = (v: number) => Math.max(0.01, Math.min(0.99, Number.isFinite(v) ? v : 0.5));
  const missing = spec.value === null;
  return {
    id: spec.id,
    eyebrow: spec.eyebrow,
    value: missing ? (lang === 'es' ? NOT_AVAILABLE.es : NOT_AVAILABLE.en) : spec.value!,
    unit: spec.unit,
    state: missing ? 'inactive' : spec.state,
    anchor: { x: clamp(anchor.x), y: clamp(anchor.y) },
    source: missing && spec.missing ? spec.missing : spec.source,
    ...(spec.trend ? { trend: spec.trend } : {}),
  };
}

/**
 * The nominal height of the shell's header band for `count` cards in a host `width` wide (184 by 68 px cards, 164 by 54 px below
 * 640 px, 8 px from the edges and apart, 6 px compact): only the first frame's reserve. From shell 0.24.0 the layer measures its
 * cards and reports the band it really takes (`onLayout({ bandHeight })`, also `--caos-callout-band`), and the drawing starts below
 * that (M1 of the 0.13.000 review: cards that grew when their text wrapped covered the next row and the drawing).
 */
export function calloutBand(count: number, width: number): number {
  if (count <= 0) return 0;
  const compact = width < 640;
  const w = compact ? 164 : 184;
  const h = compact ? 54 : 68;
  const gap = compact ? 6 : 8;
  const columns = width < 520 ? 2 : Math.max(1, Math.min(count, Math.floor((width - 16 + gap) / (w + gap))));
  const rows = Math.ceil(count / columns);
  return 8 + rows * h + (rows - 1) * gap + 8;
}

/** The gap between the lowest card and the drawing [px]. */
export const BAND_GAP = 8;

/** The least height the drawing under the band keeps [px]: a chart keeps its plot, its axes and its key, so it is never unmounted. */
export const MIN_DRAWING_PX = 160;

/** The largest band a host `hostHeight` tall can reserve (N5 of the 0.13.000 re-check): its height less the drawing's minimum; an
 * unmeasured host (0) does not bound it. */
export function bandLimit(hostHeight: number): number {
  return hostHeight > 0 ? Math.max(0, hostHeight - MIN_DRAWING_PX) : Number.POSITIVE_INFINITY;
}

/** The band a host reserves: the shell's measured band plus the gap once it has reported one, the nominal band before, never more than
 * the host's height less the drawing's minimum (a band reported while the layer had collapsed, a full-page capture or a viewport
 * resize, can never take the chart's room). */
export function reservedBand(measured: number | null, count: number, width: number, hostHeight = 0): number {
  const band = measured !== null && measured > 0 ? Math.ceil(measured + BAND_GAP) : calloutBand(count, width);
  return Math.min(band, bandLimit(hostHeight));
}

interface HeldBand {
  key: string;
  band: number;
  prev: number | null;
  /** The two bands of a detected swing (an A, B, A cycle of reports), or null. */
  swing: [number, number] | null;
}

const same = (a: number, b: number) => Math.abs(a - b) < 0.5;

/** The next held band after a report `v` (exported for its test): it follows the reports; when one swings back to the band before the
 * last (an A, B, A cycle) it holds the larger of the two while the reports stay on those two, and follows again on any other report
 * (a new width, new cards), so a transient band is never kept. A larger band past `limit` (bandLimit: it would leave the drawing no
 * room, a band reported while the layer had collapsed) is never the one held: the swing holds the smaller (N5). */
export function nextBand(h: HeldBand | null, key: string, v: number, limit = Number.POSITIVE_INFINITY): HeldBand {
  if (!h || h.key !== key) return { key, band: v, prev: null, swing: null };
  if (h.swing && (same(v, h.swing[0]) || same(v, h.swing[1]))) return h;
  if (same(v, h.band)) return h;
  if (!h.swing && h.prev !== null && same(v, h.prev)) {
    const lo = Math.min(h.band, v);
    const hi = Math.max(h.band, v);
    return { key, band: hi + BAND_GAP <= limit ? hi : lo, prev: h.band, swing: [lo, hi] };
  }
  return { key, band: v, prev: h.band, swing: null };
}

/**
 * The measured band of a host's SceneCallouts, from the shell's onLayout. The band sets the plot's height, the plot the anchors, and
 * the anchors the shell's card order (fewest crossings), so the band could swing between two orders without end (React's update
 * limit, seen on a zoomed chart at 390 px): a swing back is held at the larger band (nextBand).
 */
export function useMeasuredBand(key: string, hostHeight = 0): [number | null, (info: { bandHeight: number }) => void] {
  const [held, setHeld] = useState<HeldBand | null>(null);
  const limit = bandLimit(hostHeight);
  const onLayout = useCallback((info: { bandHeight: number }) => setHeld((h) => nextBand(h, key, info.bandHeight, limit)), [key, limit]);
  return [held && held.key === key ? held.band : null, onLayout];
}

export interface Subject {
  id: string;
  /** The subject's point in pixels of the stage. */
  x: number;
  y: number;
}

/** A drawing of the product's own with its callouts: `draw` receives the box under the band and returns the drawing and its subjects. */
export function CalloutStage({
  label,
  callouts,
  draw,
  className,
}: {
  label: BiText;
  callouts: CalloutSpec[];
  draw: (box: { width: number; height: number; top: number }) => { node: ReactNode; subjects: Subject[] };
  className?: string;
}) {
  const lang = useShellLang();
  // a drawing of the product's own holds the tallest band of its cards (its anchors move with the band only through the drawing's own
  // layout, which a width change redraws)
  const [measured, onLayout] = useMeasuredBand(callouts.map((c) => c.id).join(','));
  return (
    <Stage label={label} className={className}>
      {({ width, height }) => {
        // bounded to the stage's height less the drawing's minimum (N5)
        const band = reservedBand(measured, callouts.length, width, height);
        const { node, subjects } = draw({ width, height: Math.max(0, height - band), top: band });
        const items = callouts.map((c) => {
          const s = subjects.find((p) => p.id === c.id);
          return toCallout(c, s ? { x: s.x / Math.max(1, width), y: (s.y + band) / Math.max(1, height) } : { x: 0.5, y: 0.75 }, lang);
        });
        return (
          <div className="cdem-callout-host" style={{ width, height }} data-callout-band={band}>
            <div className="cdem-callout-drawing" style={{ top: band, height: Math.max(0, height - band) }}>
              {node}
            </div>
            <SceneCallouts items={items} placement="header" onLayout={onLayout} />
          </div>
        );
      }}
    </Stage>
  );
}

/** A point of a chart in its data units, for a callout's anchor. */
export interface ChartPoint {
  id: string;
  x: number;
  y: number;
}

export interface ChartFrame {
  x: [number, number];
  y: [number, number];
  xLog?: boolean;
  yLog?: boolean;
}

export interface PlotBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The fraction of an axis a value sits at on a rendered scale [lo, hi] (log when the axis is), clamped to the plot. */
export function scaleFraction(v: number, [lo, hi]: [number, number], log?: boolean): number {
  const l = (u: number) => Math.log10(Math.max(u, 1e-12));
  const t = log ? (l(v) - l(lo)) / (l(hi) - l(lo) || 1) : (v - lo) / (hi - lo || 1);
  return Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0.5));
}

/**
 * The anchor of a data point, normalised to the callout layer: the point on the rendered scales (uPlot's valToPos: left plus the
 * fraction of the width, top plus one minus the fraction of the height of its plot area), with the plot area in the layer's own
 * pixels, divided by the layer's size, which is what the shell's SceneCallouts multiplies back.
 */
export function layerAnchor(p: ChartPoint, scale: ChartFrame, plot: PlotBox, layer: { width: number; height: number }): { x: number; y: number } {
  const fx = scaleFraction(p.x, scale.x, scale.xLog);
  const fy = scaleFraction(p.y, scale.y, scale.yLog);
  return { x: (plot.left + fx * plot.width) / Math.max(1, layer.width), y: (plot.top + (1 - fy) * plot.height) / Math.max(1, layer.height) };
}

/** The x scale uPlot rendered, from the chart's `data-view-x` ("min,max"), or null before the chart is drawn. */
export function renderedX(attr: string | null | undefined): [number, number] | null {
  if (!attr) return null;
  const v = attr.split(',').map(Number);
  return v.length === 2 && v.every(Number.isFinite) && v[1] > v[0] ? [v[0], v[1]] : null;
}

export interface ChartGeom {
  layer: { width: number; height: number };
  plot: PlotBox | null;
  viewX: [number, number] | null;
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.25;
const MEASURES_PER_TASK = 6;
const sameBox = (a: PlotBox | null, b: PlotBox | null) => a === b || (!!a && !!b && near(a.left, b.left) && near(a.top, b.top) && near(a.width, b.width) && near(a.height, b.height));
const sameGeom = (a: ChartGeom, b: ChartGeom) =>
  near(a.layer.width, b.layer.width) && near(a.layer.height, b.layer.height) && sameBox(a.plot, b.plot) && (a.viewX === b.viewX || (!!a.viewX && !!b.viewX && a.viewX[0] === b.viewX[0] && a.viewX[1] === b.viewX[1]));

/** The layer's size and uPlot's plot area in the layer's pixels, from two rectangles read at the same instant: a transform of an
 * ancestor scales both alike, and the ratio of the layer's untransformed width to its drawn width undoes it. */
export function measureChart(host: HTMLElement): ChartGeom {
  const layerEl = host.querySelector<HTMLElement>(':scope > [data-caos-callout-layer]') ?? host;
  const lr = layerEl.getBoundingClientRect();
  const k = lr.width > 0 && layerEl.offsetWidth > 0 ? layerEl.offsetWidth / lr.width : 1;
  const layer = { width: lr.width * k, height: lr.height * k };
  const over = host.querySelector('.u-over');
  const o = over ? over.getBoundingClientRect() : null;
  const plot = o && o.width > 0 && o.height > 0 ? { left: (o.left - lr.left) * k, top: (o.top - lr.top) * k, width: o.width * k, height: o.height * k } : null;
  const viewX = renderedX(host.querySelector('[data-view-x]')?.getAttribute('data-view-x'));
  return { layer, plot, viewX };
}

/** A shell chart with its callouts: the band at the top, the chart below it, the anchors on the chart as uPlot rendered it. */
export function ChartCallouts({
  callouts,
  points,
  frame,
  overlay,
  children,
}: {
  callouts: CalloutSpec[];
  points: ChartPoint[];
  frame: ChartFrame;
  /** A drawing of the product's own over the chart (the comparison's interval bracket, N6), placed by `at`: a data point to the layer's
   * pixels on the scales uPlot rendered, the same geometry as the anchors; drawn once the plot area is measured. */
  overlay?: (at: (p: { x: number; y: number }) => { x: number; y: number }) => ReactNode;
  children: ReactNode;
}) {
  const lang = useShellLang();
  const host = useRef<HTMLDivElement | null>(null);
  const [geom, setGeom] = useState<ChartGeom>({ layer: { width: 0, height: 0 }, plot: null, viewX: null });
  const remeasure = useRef<() => void>(() => undefined);
  // a measurement can move what it measures (the band follows the cards, the cards the anchors): at most a few measurements are taken in
  // one task, so a chain of layout effects ends before React's update limit and the next task measures the settled layout
  const burst = useRef(0);
  remeasure.current = () => {
    const node = host.current;
    if (!node) return;
    if (burst.current === 0) setTimeout(() => (burst.current = 0), 0);
    burst.current += 1;
    if (burst.current > MEASURES_PER_TASK) {
      if (burst.current === MEASURES_PER_TASK + 1) setTimeout(() => remeasure.current(), 16);
      return;
    }
    const next = measureChart(node);
    setGeom((g) => (sameGeom(g, next) ? g : next));
  };
  // after every render: a new band moves the chart without resizing anything an observer watches
  useLayoutEffect(() => remeasure.current());
  useEffect(() => {
    const node = host.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const run = () => remeasure.current();
    const ro = new ResizeObserver(run);
    const watched = new Set<Element>();
    const watch = () => {
      for (const el of [node, node.querySelector(':scope > [data-caos-callout-layer]'), node.querySelector('.u-over')]) {
        if (el && !watched.has(el)) {
          watched.add(el);
          ro.observe(el);
        }
      }
    };
    watch();
    // the plot area appears when uPlot is built, and its scale changes on a zoom or new data
    const mo =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => {
            watch();
            run();
          });
    mo?.observe(node, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-view-x', 'data-drawn'] });
    run();
    return () => {
      ro.disconnect();
      mo?.disconnect();
    };
  }, []);
  const [measured, onLayout] = useMeasuredBand(`${callouts.map((c) => c.id).join(',')}:${Math.round(geom.layer.width)}`, geom.layer.height);
  const band = reservedBand(measured, callouts.length, geom.layer.width || 900, geom.layer.height);
  const scale: ChartFrame = { ...frame, x: geom.viewX ?? frame.x };
  const items = callouts.map((c) => {
    const p = points.find((q) => q.id === c.id);
    // before the chart is drawn there is no plot area to anchor to: the callout waits at the middle of the drawing
    return toCallout(c, p && geom.plot ? layerAnchor(p, scale, geom.plot, geom.layer) : { x: 0.5, y: 0.7 }, lang);
  });
  const plot = geom.plot;
  const at = (p: { x: number; y: number }) => {
    const a = plot ? layerAnchor({ id: '', ...p }, scale, plot, geom.layer) : { x: 0, y: 0 };
    return { x: a.x * geom.layer.width, y: a.y * geom.layer.height };
  };
  return (
    <div
      ref={host}
      className="cdem-callout-host cdem-callout-fill"
      data-callout-band={band}
      data-anchored={geom.plot ? 'true' : 'false'}
      // the data point each callout names, for the browser's anchor check: it places the point on the scales uPlot rendered (its tick
      // labels and data-view-x) and measures the leader's end against it (src/views/showcase.browser.mjs, N4 and B3)
      data-anchor-points={JSON.stringify(points.map((p) => ({ id: p.id, x: p.x, y: p.y })))}
    >
      <div className="cdem-callout-drawing" style={{ top: band }}>
        {children}
      </div>
      {overlay && plot && (
        <svg className="cdem-callout-overlay" width={geom.layer.width} height={geom.layer.height} aria-hidden="true" data-callout-overlay="">
          {overlay(at)}
        </svg>
      )}
      <SceneCallouts items={items} placement="header" onLayout={onLayout} />
    </div>
  );
}
