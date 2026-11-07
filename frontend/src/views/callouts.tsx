// The anchored callouts of every primary view and story stage (ADR-0082 section 5, SH-007), on the shell's SceneCallouts in its header
// placement: the cards sit in a band at the top of the view, each with a leader to the point of the drawing it describes, so no card
// covers its subject or another card. The drawing takes the rest of the view below the band. Two hosts:
// - CalloutStage, for a drawing of the product's own (the circuit): the drawing reports where its subjects are, in pixels of the stage,
//   and the anchors are those points, exact;
// - ChartCallouts, over a shell chart: the anchors are the data points mapped onto the chart's plot area (uPlot's `.u-over`, measured
//   after layout) on the axes the view declares; the mapping is the view's declared range, so an anchor can sit a few pixels off the
//   rendered point when uPlot widens a range (a review obligation of ADR-0082 rule 5, recorded in the report).
// Every value carries its unit and its source; a callout whose value is missing says "not available" with the reason as its source.
import { SceneCallouts, Stage, useShellLang, type BiText, type CalloutState, type SceneCalloutDef } from '@fasl-work/caos-app-shell';
import { useEffect, useRef, useState, type ReactNode } from 'react';

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
 * The height of the shell's header band for `count` cards in a host `width` wide: the shell lays the cards out in columns (two below
 * 520 px, as many as fit otherwise), 184 by 68 px (164 by 54 px below 640 px), 8 px from the edges and 8 px apart (6 px compact).
 * The drawing starts below it.
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
  return (
    <Stage label={label} className={className}>
      {({ width, height }) => {
        const band = calloutBand(callouts.length, width);
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
            <SceneCallouts items={items} placement="header" className="cdem-callout-layer" />
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

/** The normalised position of a data point on a plot area inside a host, from the axes' declared ranges. */
export function chartAnchor(p: ChartPoint, frame: ChartFrame, plot: { left: number; top: number; width: number; height: number }, host: { width: number; height: number }) {
  const t = (v: number, [lo, hi]: [number, number], log?: boolean) => {
    if (log) return (Math.log10(Math.max(v, 1e-12)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));
    return (v - lo) / (hi - lo || 1);
  };
  const fx = Math.max(0, Math.min(1, t(p.x, frame.x, frame.xLog)));
  const fy = Math.max(0, Math.min(1, t(p.y, frame.y, frame.yLog)));
  return { x: (plot.left + fx * plot.width) / Math.max(1, host.width), y: (plot.top + (1 - fy) * plot.height) / Math.max(1, host.height) };
}

/** A shell chart with its callouts: the band at the top, the chart below it, the anchors on the chart's measured plot area. */
export function ChartCallouts({ callouts, points, frame, children }: { callouts: CalloutSpec[]; points: ChartPoint[]; frame: ChartFrame; children: ReactNode }) {
  const lang = useShellLang();
  const host = useRef<HTMLDivElement | null>(null);
  const [geom, setGeom] = useState<{ width: number; height: number; plot: { left: number; top: number; width: number; height: number } | null }>({ width: 0, height: 0, plot: null });
  useEffect(() => {
    const node = host.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const r = node.getBoundingClientRect();
      const over = node.querySelector('.u-over');
      const o = over ? over.getBoundingClientRect() : null;
      const plot = o && o.width > 0 && o.height > 0 ? { left: o.left - r.left, top: o.top - r.top, width: o.width, height: o.height } : null;
      setGeom((g) => (g.width === r.width && g.height === r.height && JSON.stringify(g.plot) === JSON.stringify(plot) ? g : { width: r.width, height: r.height, plot }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  const band = calloutBand(callouts.length, geom.width || 900);
  // before the first layout the plot area is the host below the band, less the axes' usual room
  const plot = geom.plot ?? { left: 56, top: band + 8, width: Math.max(1, geom.width - 72), height: Math.max(1, geom.height - band - 72) };
  const items = callouts.map((c) => {
    const p = points.find((q) => q.id === c.id);
    return toCallout(c, p ? chartAnchor(p, frame, plot, geom) : { x: 0.5, y: 0.7 }, lang);
  });
  return (
    <div ref={host} className="cdem-callout-host cdem-callout-fill" data-callout-band={band}>
      <div className="cdem-callout-drawing" style={{ top: band }}>
        {children}
      </div>
      <SceneCallouts items={items} placement="header" className="cdem-callout-layer" />
    </div>
  );
}
