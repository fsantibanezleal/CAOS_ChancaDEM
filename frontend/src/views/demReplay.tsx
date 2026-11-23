// The stage of the particle-simulation view (requirement DM-012, DM-013): the laboratory jaw's section in the x-z plane, to scale, on a canvas
// that follows its container's size and the device's pixel ratio; the fixed plate, the swing plate from its pivot to its bottom edge at the
// frame, the hopper, the discharge level and the closed and open settings, and the spheres as circles coloured by their diameter against the
// feed class, drawn far to near along y so depth reads. Three callouts are anchored to the scene (the discharge, the swing plate, the product
// below the discharge) through the shell's callout stage, as the chamber's section does; the controls sit in the stage's control row, never over
// the subject. The animation loop is the shell's (usePausedViz): it stops when the view unmounts, when the tab is hidden and, here, it never
// starts under reduced motion.
import { PlotCard, prefersReducedMotion, resolveToken, SceneCallouts, Stage, useLinkedCursor, usePausedViz, useShellLang, useStageSize, useThemeTokens, type BiText } from '@fasl-work/caos-app-shell';
import { useEffect, useRef, type ReactNode } from 'react';
import type { Loaded } from '../api/artifacts';
import type { DemRun } from '../lib/contract.types';
import { CalloutStage, toCallout, type CalloutSpec, type Subject } from './callouts';
import {
  advance,
  classCounts,
  cursorRange,
  DEFAULT_SPEED,
  frameLabelText,
  frameSpheres,
  frameBelow,
  insetBounds,
  plateAt,
  playbackAllowed,
  SIZE_TOKENS,
  stageBounds,
  sizeClass,
  sizeClassLabels,
  SIZE_CLASSES,
  SPEEDS,
  stageTransform,
  type DemFrames,
  type DemPoint,
  type DemReplay,
  type StageTransform,
} from './demModel';
import { Labels, LabelText, TOKEN } from './draw';
import { useNum, useT } from './shared';

// ---------------------------------------------------------------------------------------------------------------------------------
// The colours: shell tokens resolved for the theme, a sequential scale of the size classes between three of them.
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * The colours of the size classes: the data tokens `--cdem-size-0` to `--cdem-size-5` of the view (workbench.css), a sequential scale ordered
 * in lightness in both themes, finest class first. They are neither a story-step accent nor a state colour. A canvas cannot read a CSS
 * variable, so they are resolved for the theme in force and re-resolved when the theme changes.
 */
export function usePalette(): string[] {
  useThemeTokens();
  return SIZE_TOKENS.map((t) => resolveToken(t, '#888888'));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The drawing of one frame.
// ---------------------------------------------------------------------------------------------------------------------------------

export interface DrawArgs {
  tf: StageTransform;
  geometry: DemReplay['geometry'];
  /** The swing plate's bottom edge at this frame [mm], and at its closed and open positions. */
  plate: { x: number; z: number };
  closed: { x: number; z: number };
  open: { x: number; z: number };
  frames: DemFrames | null;
  frame: number;
  /** The lower size of the feed class [mm]: the colour class of a sphere is its diameter against it. */
  feedLowMm: number;
  palette: string[];
  colors: { fg: string; subtle: string; faint: string; accent: string; surface: string; border: string };
}

const topCache = new WeakMap<DemFrames, number>();

/** The top of the highest sphere over the whole replay [mm]: the section is drawn up to it and the hopper above is left out. */
export function sphereTop(f: DemFrames): number {
  const hit = topCache.get(f);
  if (hit !== undefined) return hit;
  let top = -Infinity;
  for (let i = 0; i < f.data.length; i += 4) top = Math.max(top, f.data[i + 2] + f.data[i + 3]);
  topCache.set(f, top);
  return top;
}

/** The extremes of the plate's bottom edge over the replay: its closed (lowest x) and open (highest x) positions. */
export function plateExtremes(r: Pick<DemReplay, 'plate_bottom_x_mm' | 'plate_bottom_z_mm'>): { closed: { x: number; z: number }; open: { x: number; z: number } } {
  let lo = 0;
  let hi = 0;
  r.plate_bottom_x_mm.forEach((x, i) => {
    if (x < r.plate_bottom_x_mm[lo]) lo = i;
    if (x > r.plate_bottom_x_mm[hi]) hi = i;
  });
  return { closed: { x: r.plate_bottom_x_mm[lo], z: r.plate_bottom_z_mm[lo] }, open: { x: r.plate_bottom_x_mm[hi], z: r.plate_bottom_z_mm[hi] } };
}

/**
 * Draws a frame on a 2D context whose transform is already the device's pixel ratio: the ground below the discharge level, the hopper's
 * walls, the fixed plate, the spheres (far to near along y), the swing plate over them, and the plate's closed and open positions. Returns the
 * spheres drawn, in the order drawn (indices into the frame), so the order is testable.
 */
export function drawReplay(ctx: CanvasRenderingContext2D, a: DrawArgs, size: { width: number; height: number }): number[] {
  const { tf, geometry: g } = a;
  ctx.clearRect(0, 0, size.width, size.height);
  const b = tf.bounds;
  // the ground: where a sphere has left the chamber
  const ground = tf.px(b.xMin, g.discharge_z_mm);
  const groundEnd = tf.px(b.xMax, b.zMin);
  ctx.fillStyle = a.colors.faint;
  ctx.globalAlpha = 0.12;
  ctx.fillRect(ground.x, ground.y, groundEnd.x - ground.x, groundEnd.y - ground.y);
  ctx.globalAlpha = 1;
  // the hopper: walls above the plates, cropped at the top of the drawn part
  ctx.strokeStyle = a.colors.faint;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  const topFixed = tf.px(g.fixed_plate_x_mm, g.fixed_plate_z_mm[1]);
  const topEdge = tf.px(g.fixed_plate_x_mm, b.zMax);
  const pivot = tf.px(g.swing_pivot_mm[0], g.swing_pivot_mm[1]);
  const topRight = tf.px(g.swing_pivot_mm[0], b.zMax);
  ctx.beginPath();
  ctx.moveTo(topFixed.x, topFixed.y);
  ctx.lineTo(topEdge.x, topEdge.y);
  ctx.moveTo(pivot.x, pivot.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.stroke();
  ctx.setLineDash([]);
  // the fixed plate
  const f0 = tf.px(g.fixed_plate_x_mm, g.fixed_plate_z_mm[0]);
  const f1 = tf.px(g.fixed_plate_x_mm, g.fixed_plate_z_mm[1]);
  ctx.strokeStyle = a.colors.subtle;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(f0.x, f0.y);
  ctx.lineTo(f1.x, f1.y);
  ctx.stroke();
  // the discharge level
  ctx.strokeStyle = a.colors.faint;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  const d0 = tf.px(b.xMin, g.discharge_z_mm);
  const d1 = tf.px(b.xMax, g.discharge_z_mm);
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.stroke();
  // the swing plate at its closed and open positions, faint
  for (const p of [a.closed, a.open]) {
    const e = tf.px(p.x, p.z);
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // the spheres, far (smallest y) to near (largest y)
  const order: number[] = [];
  if (a.frames) {
    const [s0, s1] = frameSpheres(a.frames, a.frame);
    const d = a.frames.data;
    const idx = Array.from({ length: s1 - s0 }, (_, k) => s0 + k).sort((p, q) => d[p * 4 + 1] - d[q * 4 + 1]);
    const ys = idx.length ? [d[idx[0] * 4 + 1], d[idx[idx.length - 1] * 4 + 1]] : [0, 1];
    const span = Math.max(1e-9, ys[1] - ys[0]);
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = a.colors.surface;
    for (const s of idx) {
      const c = tf.px(d[s * 4], d[s * 4 + 2]);
      const r = Math.max(0.7, d[s * 4 + 3] * tf.scale);
      ctx.globalAlpha = 0.55 + (0.45 * (d[s * 4 + 1] - ys[0])) / span;
      ctx.fillStyle = a.palette[sizeClass(2 * d[s * 4 + 3], a.feedLowMm)];
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (r > 2.5) ctx.stroke();
      order.push(s - s0);
    }
    ctx.globalAlpha = 1;
  }
  // the swing plate at this frame, over the spheres
  const e = tf.px(a.plate.x, a.plate.z);
  ctx.strokeStyle = a.colors.accent;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pivot.x, pivot.y);
  ctx.lineTo(e.x, e.y);
  ctx.stroke();
  ctx.fillStyle = a.colors.accent;
  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, 4, 0, Math.PI * 2);
  ctx.fill();
  return order;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The canvas, its labels and its subjects.
// ---------------------------------------------------------------------------------------------------------------------------------

interface Names {
  fixed: string;
  swing: string;
  hopper: string;
  discharge: string;
  css: string;
  oss: string;
}

const ReplayCanvas = ({ width, height, run, point, frames, frame, tf, plate, inset = false }: { width: number; height: number; run: DemRun; point: DemPoint; frames: DemFrames | null; frame: number; tf: StageTransform; plate: { x: number; z: number }; inset?: boolean }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const tokens = useThemeTokens();
  const lang = useShellLang();
  const r = point.simulation.replay!;
  const ext = plateExtremes(r);
  const palette = usePalette();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = typeof window === 'undefined' ? 1 : Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawReplay(
      ctx,
      {
        tf,
        geometry: r.geometry,
        plate,
        closed: ext.closed,
        open: ext.open,
        frames,
        frame,
        feedLowMm: point.feed_mm[0],
        palette,
        colors: { fg: tokens['--color-fg'], subtle: tokens['--color-fg-subtle'], faint: tokens['--color-fg-faint'], accent: tokens['--color-accent'], surface: tokens['--color-surface'], border: tokens['--color-border'] },
      },
      { width, height },
    );
    // the drawing follows the frame, the size, the theme and the language of its labels (none are on the canvas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, frame, width, height, tokens, lang, tf]);
  void run;
  return (
    <canvas
      ref={ref}
      style={{ width, height, display: 'block' }}
      role="img"
      aria-label={inset ? (lang === 'es' ? 'Ampliación de la zona de chancado con las partículas del golpe elegido' : 'Magnification of the crushing zone with the particles of the chosen stroke') : lang === 'es' ? 'Sección de la chancadora de mandíbula del laboratorio con las partículas del golpe elegido' : 'Section of the laboratory jaw crusher with the particles of the chosen stroke'}
      data-chart={inset ? 'dem-inset' : 'dem-replay'}
      data-frame={frame}
      data-spheres={frames ? frameSpheres(frames, frame)[1] - frameSpheres(frames, frame)[0] : 0}
    />
  );
};

/**
 * The labels of the section, placed outside the chamber so the scene never covers them: on the left of the drawn part the fixed plate and
 * the discharge level, on its right the swing plate, the settings and the hopper, each with a leader to what it names. They are placed so
 * none leaves the drawing or touches another (the gate's G10). Also the subjects the callouts are anchored to, on the main section.
 */
function sectionLabels(tf: StageTransform, point: DemPoint, run: DemRun, plate: { x: number; z: number }, width: number, height: number, names: Names, num: (v: number, o?: { digits?: number; decimals?: number }) => string): { node: ReactNode; subjects: Subject[] } {
  const r = point.simulation.replay!;
  const g = r.geometry;
  const ext = plateExtremes(r);
  const L = new Labels(width, height, 22);
  const left = tf.px(tf.bounds.xMin, 0).x - 8;
  const right = tf.px(tf.bounds.xMax, 0).x + 8;
  const disY = tf.px(0, g.discharge_z_mm).y;
  const closedPx = tf.px(ext.closed.x, ext.closed.z);
  const openPx = tf.px(ext.open.x, ext.open.z);
  const swingMid = tf.px((g.swing_pivot_mm[0] + plate.x) / 2, (g.swing_pivot_mm[1] + plate.z) / 2);
  const fixedMid = tf.px(g.fixed_plate_x_mm, g.fixed_plate_z_mm[1] * 0.62);
  const hop = tf.px(g.swing_pivot_mm[0], tf.bounds.zMax - 25);
  // each label with the point of the drawing it names
  const items: { text: string; x: number; y: number; anchor: 'start' | 'end'; fill: string; weight?: number; to: { x: number; y: number } }[] = [
    { text: names.fixed, x: left, y: fixedMid.y, anchor: 'end', fill: TOKEN.subtle, to: { x: fixedMid.x - 4, y: fixedMid.y } },
    { text: names.discharge, x: left, y: disY, anchor: 'end', fill: TOKEN.faint, to: { x: tf.px(tf.bounds.xMin + 6, 0).x, y: disY } },
    { text: names.swing, x: right, y: swingMid.y, anchor: 'start', fill: TOKEN.accent, to: { x: swingMid.x + 4, y: swingMid.y } },
    { text: names.hopper, x: right, y: hop.y, anchor: 'start', fill: TOKEN.faint, to: { x: hop.x + 3, y: hop.y } },
    { text: `${names.css} ${num(run.settings.css_mm, { digits: 3 })} mm`, x: right, y: closedPx.y + 4, anchor: 'start', fill: TOKEN.accent, weight: 700, to: { x: closedPx.x + 3, y: closedPx.y } },
    { text: `${names.oss} ${num(run.settings.oss_mm, { digits: 3 })} mm`, x: right, y: openPx.y + 22, anchor: 'start', fill: TOKEN.subtle, to: { x: openPx.x + 3, y: openPx.y + 3 } },
  ];
  const placed = items.map((it) => ({ it, p: L.place(it.text, it.x, it.y, it.anchor, { fill: it.fill, weight: it.weight }) }));
  const subjects: Subject[] = [
    { id: 'throughput', x: tf.px((g.fixed_plate_x_mm + ext.closed.x) / 2, g.discharge_z_mm).x, y: tf.px(0, g.discharge_z_mm).y },
    { id: 'net_power', x: swingMid.x, y: swingMid.y },
    { id: 'p80', x: tf.px(g.fixed_plate_x_mm - 18, g.discharge_z_mm).x, y: tf.px(0, g.discharge_z_mm - 10).y },
  ];
  // dimension ticks of the two settings at the plate's bottom edge: the gap from the fixed plate to the closed and to the open edge, to scale
  const y0 = tf.px(0, 0).y + 8;
  const x0 = tf.px(g.fixed_plate_x_mm, 0).x;
  const node = (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" data-chart="dem-replay-labels" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
      <g stroke={TOKEN.accent} strokeWidth={1.5} fill="none">
        <line x1={x0} y1={y0} x2={closedPx.x} y2={y0} />
        <line x1={x0} y1={y0 - 3} x2={x0} y2={y0 + 3} />
        <line x1={closedPx.x} y1={y0 - 3} x2={closedPx.x} y2={y0 + 3} />
      </g>
      <g stroke={TOKEN.subtle} strokeWidth={1.2} fill="none">
        <line x1={x0} y1={y0 + 8} x2={openPx.x} y2={y0 + 8} />
        <line x1={openPx.x} y1={y0 + 5} x2={openPx.x} y2={y0 + 11} />
      </g>
      <g stroke={TOKEN.faint} strokeWidth={1} strokeDasharray="2 3" fill="none" data-label-leaders="">
        {placed.map(({ it, p }) => (
          <line key={it.text} x1={it.anchor === 'end' ? p.x + 3 : p.x - 3} y1={p.y - 4} x2={it.to.x} y2={it.to.y} />
        ))}
      </g>
      <LabelText items={placed.map(({ p }) => p)} />
    </svg>
  );
  return { node, subjects };
}

export const NAMES: Record<'en' | 'es', Names> = {
  en: { fixed: 'fixed plate', swing: 'swing plate', hopper: 'hopper above', discharge: 'discharge level', css: 'closed', oss: 'open' },
  es: { fixed: 'placa fija', swing: 'placa móvil', hopper: 'tolva arriba', discharge: 'nivel de descarga', css: 'cerrada', oss: 'abierta' },
};

/** The width the size panel takes beside the section [px]: a third of the stage, at least 150 and at most 230. */
export const panelWidth = (stageWidth: number): number => Math.round(Math.max(130, Math.min(230, stageWidth * 0.36)));

/**
 * The size panel: the legend of the colour scale and the mix of the frame in one drawing. One row per size class, finest first: its
 * swatch (the colour the spheres of that class have on the section), its range in millimetres, a bar for the number of spheres of that class
 * in this frame against the most the replay ever holds in one frame, and the count.
 */
/** The height of the size panel [px]: its title and one row per class. */
export const SIZE_PANEL_H = 20 + SIZE_CLASSES * 18 + 6;

export function SizePanel({ width, point, counts, max, palette }: { width: number; point: DemPoint; counts: number[]; max: number; palette: string[] }) {
  const height = SIZE_PANEL_H;
  const num = useNum();
  const t = useT();
  const lang = useShellLang();
  const labels = sizeClassLabels(point.feed_mm[0], num, lang);
  const top = 20;
  const row = 18;
  const labelW = 64;
  const barX = 18 + labelW;
  const barMax = Math.max(8, width - barX - 40);
  const font = { fontFamily: 'var(--font-sans)', fontSize: 11, fontVariantNumeric: 'tabular-nums' } as const;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('Spheres of the frame by diameter', 'Esferas del cuadro por diámetro')} data-legend="size" data-chart="dem-size-panel" style={{ position: 'absolute', right: 0, top: 0 }}>
      <text x={4} y={13} fill={TOKEN.subtle} fontWeight={600} {...{ style: font }}>
        {t('Diameter (mm)', 'Diámetro (mm)')}
      </text>
      {labels.map((label, c) => {
        const y = top + c * row + row / 2;
        const len = max > 0 ? Math.max(counts[c] > 0 ? 2 : 0, (counts[c] / max) * barMax) : 0;
        return (
          <g key={c} data-class={c} data-count={counts[c]}>
            <circle cx={9} cy={y} r={5} fill={palette[c]} stroke={TOKEN.border} strokeWidth={1} />
            <text x={18} y={y + 4} fill={TOKEN.fg} {...{ style: font }}>
              {label}
            </text>
            <rect x={barX} y={y - 5} width={len} height={10} fill={palette[c]} rx={2} />
            <text x={barX + len + 4} y={y + 4} fill={TOKEN.subtle} {...{ style: font }}>
              {counts[c]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** The smallest height of the inset's drawing [px]: under it the stage leaves the inset out (a stage too short to hold it says so). */
export const INSET_MIN_PX = 90;
const INSET_HEAD = 36;
/** The title of a narrow inset wraps to more lines. */
export const insetHead = (width: number): number => (width < 170 ? 54 : INSET_HEAD);

/**
 * The crushing zone magnified: the same frame, the same colours and the moving plate in the last 80 mm above the discharge level and a little
 * below it, with its own scale bar in millimetres, the closed and open settings marked and a frame and a title that say it is a magnification.
 * It sits below the size panel, where it covers neither the section nor a callout.
 */
export function Inset({ width, height, left, run, point, frames, frame, plate, mainScale }: { width: number; height: number; left?: number; run: DemRun; point: DemPoint; frames: DemFrames | null; frame: number; plate: { x: number; z: number }; mainScale: number }) {
  const num = useNum();
  const t = useT();
  const r = point.simulation.replay!;
  const g = r.geometry;
  const head = insetHead(width);
  const drawH = height - head;
  const tf = stageTransform(g, width, drawH, 4, insetBounds(g));
  const ext = plateExtremes(r);
  const mag = tf.scale / Math.max(1e-9, mainScale);
  const closed = tf.px(ext.closed.x, ext.closed.z);
  const open = tf.px(ext.open.x, ext.open.z);
  const x0 = tf.px(g.fixed_plate_x_mm, 0).x;
  const yDim = tf.px(0, g.discharge_z_mm - 6).y;
  const bar = 10 * tf.scale;
  const font = { fontFamily: 'var(--font-sans)', fontSize: 11, fontVariantNumeric: 'tabular-nums' } as const;
  return (
    <div className="cdem-inset" style={left === undefined ? { position: 'absolute', right: 0, bottom: 0, width, height } : { position: 'absolute', left, top: 0, width, height }} data-inset="" data-magnification={String(Math.round(mag * 100) / 100)}>
      <div className="cdem-inset-head" style={{ height: head }}>
        <strong>{t(`Magnified ${num(mag, { digits: 2 })} times: the crushing zone`, `Ampliada ${num(mag, { digits: 2 })} veces: la zona de chancado`)}</strong>
        <span>
          <span style={{ color: TOKEN.accent }}>{t('closed', 'cerrada')} {num(run.settings.css_mm, { digits: 3 })} mm</span>
          {' \u00B7 '}
          <span style={{ color: TOKEN.subtle }}>{t('open', 'abierta')} {num(run.settings.oss_mm, { digits: 3 })} mm</span>
        </span>
      </div>
      <div style={{ position: 'relative', width, height: drawH, border: `1px solid var(--color-border)`, borderRadius: 4, overflow: 'hidden' }}>
        <ReplayCanvas width={width - 2} height={drawH - 2} run={run} point={point} frames={frames} frame={frame} tf={tf} plate={plate} inset />
        <svg width={width - 2} height={drawH - 2} viewBox={`0 0 ${width - 2} ${drawH - 2}`} aria-hidden="true" data-chart="dem-inset-marks" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
          <g stroke={TOKEN.accent} strokeWidth={1.6} fill="none">
            <line x1={x0} y1={yDim} x2={closed.x} y2={yDim} />
            <line x1={x0} y1={yDim - 3} x2={x0} y2={yDim + 3} />
            <line x1={closed.x} y1={yDim - 3} x2={closed.x} y2={yDim + 3} />
          </g>
          <g stroke={TOKEN.subtle} strokeWidth={1.4} fill="none">
            <line x1={x0} y1={yDim + 8} x2={open.x} y2={yDim + 8} />
            <line x1={open.x} y1={yDim + 5} x2={open.x} y2={yDim + 11} />
          </g>
          <g stroke={TOKEN.fg} strokeWidth={2} fill="none" data-scale-bar={String(Math.round(bar * 10) / 10)}>
            <line x1={8} y1={drawH - 12} x2={8 + bar} y2={drawH - 12} />
            <line x1={8} y1={drawH - 15} x2={8} y2={drawH - 9} />
            <line x1={8 + bar} y1={drawH - 15} x2={8 + bar} y2={drawH - 9} />
          </g>
          <text x={8 + bar + 5} y={drawH - 8} fill={TOKEN.fg} {...{ style: font }}>
            10 mm
          </text>
        </svg>
      </div>
    </div>
  );
}

/**
 * The columns of the stage's drawing at a width and a height [px]. Wide (640 px and more): the section with the callouts in its empty margins on
 * the left, the magnified crushing zone beside it as the main drawing, at the full height of the region, and the size legend with its counts at
 * the right. Narrow: the section and the size legend side by side with the callouts in the shell's header band above, and the zone stacked under
 * the legend.
 */
/** The width of the column the callouts take at the left of the section on a desktop [px]. */
export const CALLOUT_COLUMN = 212;

export function stageColumns(width: number, height: number): { wide: boolean; panel: number; chamber: number; main: number; inset: number } {
  const panel = panelWidth(width);
  if (width < 640) return { wide: false, panel, chamber: Math.max(80, width - panel), main: Math.max(80, width - panel), inset: panel };
  // the section's column: the chamber at its scale with room for its labels on both sides, then the callouts' room on its right
  const zRange = 560;
  const chamber = Math.round(170 * Math.max(0.3, (height - 16) / zRange) + 2 * 92);
  const main = chamber + CALLOUT_COLUMN;
  const drawH = height - insetHead(panel + 200);
  const inset = Math.round(Math.max(220, Math.min(width - panel - main - 12, (drawH * 70) / 92 + 8)));
  return { wide: true, panel, chamber, main: width - panel - inset - 12, inset };
}

interface StageProps {
  run: DemRun;
  point: DemPoint;
  frames: DemFrames | null;
  cursor: number;
  callouts: CalloutSpec[];
}

/** The stage on a phone: the callouts in the shell's header band above the drawing, the zone stacked under the legend. */
function NarrowStage({ run, point, frames, cursor, callouts }: StageProps) {
  const lang = useShellLang();
  const num = useNum();
  const palette = usePalette();
  const r = point.simulation.replay!;
  const frame = frameBelow(r, cursor);
  const plate = plateAt(r, cursor);
  const counts = frames ? classCounts(frames, frame, point.feed_mm[0]) : new Array<number>(SIZE_CLASSES).fill(0);
  const bounds = stageBounds(r.geometry, frames ? sphereTop(frames) : undefined);
  return (
    <CalloutStage
      label={{ en: 'Particle replay in the jaw section', es: 'Repetición de partículas en la sección de la mandíbula' }}
      callouts={callouts}
      draw={({ width, height }) => {
        const col = stageColumns(width, height);
        const tf = stageTransform(r.geometry, col.main, height, 8, bounds);
        const { node, subjects } = sectionLabels(tf, point, run, plate, col.main, height, NAMES[lang], num);
        const head = insetHead(col.inset);
        // the zone stacks under the size panel; a stage too short for it leaves it out
        const insetH = height - SIZE_PANEL_H - 8;
        const showInset = insetH - head >= INSET_MIN_PX;
        return {
          node: (
            <div style={{ position: 'relative', width, height }} data-dem-stage="" data-frame={frame} data-layout="narrow" data-inset-shown={showInset ? 'true' : 'false'}>
              <ReplayCanvas width={col.main} height={height} run={run} point={point} frames={frames} frame={frame} tf={tf} plate={plate} />
              {node}
              <SizePanel width={col.panel} point={point} counts={counts} max={Math.max(1, ...r.count)} palette={palette} />
              {showInset && <Inset width={col.inset} height={insetH} run={run} point={point} frames={frames} frame={frame} plate={plate} mainScale={tf.scale} />}
            </div>
          ),
          subjects,
        };
      }}
    />
  );
}

/**
 * The stage on a desktop: the whole height of the region goes to the drawing. The section stands on the left with the callouts of the shell's
 * anchored placement in its empty margins (each with its leader to the subject it names), the magnified crushing zone is the main drawing in
 * the middle at the full height, and the size legend with its counts is at the right.
 */
function WideStage({ run, point, frames, cursor, callouts }: StageProps) {
  const lang = useShellLang();
  const num = useNum();
  const palette = usePalette();
  const r = point.simulation.replay!;
  const frame = frameBelow(r, cursor);
  const plate = plateAt(r, cursor);
  const counts = frames ? classCounts(frames, frame, point.feed_mm[0]) : new Array<number>(SIZE_CLASSES).fill(0);
  const bounds = stageBounds(r.geometry, frames ? sphereTop(frames) : undefined);
  return (
    <Stage label={{ en: 'Particle replay in the jaw section', es: 'Repetición de partículas en la sección de la mandíbula' }}>
      {({ width, height }) => {
        const col = stageColumns(width, height);
        const tf = stageTransform(r.geometry, col.chamber, height, 8, bounds);
        const { node, subjects } = sectionLabels(tf, point, run, plate, col.chamber, height, NAMES[lang], num);
        // the callouts are a column at the left of the section, in the shell's header placement: the cards stack, and each leader runs to the
        // column's right edge at the height of the subject it names (the shell has no side placement, so the leader ends at the section's edge)
        const items = callouts.map((c) => {
          const sub = subjects.find((q) => q.id === c.id);
          return toCallout(c, { x: 1, y: sub ? sub.y / Math.max(1, height) : 0.75 }, lang);
        });
        const left = CALLOUT_COLUMN;
        return (
          <div style={{ position: 'relative', width, height }} data-dem-stage="" data-frame={frame} data-layout="wide" data-inset-shown="true">
            <div className="cdem-callout-host" style={{ position: 'absolute', left: 0, top: 0, width: CALLOUT_COLUMN, height }} data-callouts-wide="">
              <SceneCallouts items={items} placement="header" />
            </div>
            <div style={{ position: 'absolute', left, top: 0, width: col.chamber, height }}>
              <ReplayCanvas width={col.chamber} height={height} run={run} point={point} frames={frames} frame={frame} tf={tf} plate={plate} />
              {node}
            </div>
            <Inset width={col.inset} height={height} left={left + col.chamber + 6} run={run} point={point} frames={frames} frame={frame} plate={plate} mainScale={tf.scale} />
            <SizePanel width={col.panel} point={point} counts={counts} max={Math.max(1, ...r.count)} palette={palette} />
          </div>
        );
      }}
    </Stage>
  );
}

/** The stage: the wide arrangement on a desktop, the stacked one on a phone; the spheres come from `frames` at the stored frame below the cursor and the plate is interpolated at the cursor. */
export function ReplayStage(props: StageProps) {
  const [ref, size] = useStageSize();
  return (
    <div ref={ref} style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
      {size.width > 0 && size.height > 0 && (size.width >= 640 ? <WideStage {...props} /> : <NarrowStage {...props} />)}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The controls: play and pause, the scrub, the speed, the keyboard.
// ---------------------------------------------------------------------------------------------------------------------------------

export interface PlayerProps {
  point: DemPoint;
  frame: number;
  /** For a test or a page that knows the preference: the reduced-motion flag; otherwise the browser's. */
  reducedMotion?: boolean;
  /** The playback speed [strokes per second] and its change; a controlled state of the view. */
  speed: number;
  onSpeed: (s: number) => void;
}

/**
 * The control row of the stage. The cursor is the shell's shared stroke cursor of the enclosing linked-view store: the slider, the keys
 * and playback write it, and the stage, the per-stroke charts and the label read it. Playback is the shell's paused-by-default loop; under
 * reduced motion it does not start and its button says so.
 */
export function ReplayControls({ point, frame, reducedMotion, speed, onSpeed }: PlayerProps) {
  const lang = useShellLang();
  const num = useNum();
  const t = useT();
  const { cursor, scrub, inputProps, markerProps } = useLinkedCursor();
  const r = point.simulation.replay!;
  const [lo, hi] = cursorRange(r);
  const reduced = reducedMotion ?? prefersReducedMotion();
  const allowed = playbackAllowed(reduced);
  const live = useRef({ cursor: cursor ?? hi, speed });
  live.current = { cursor: cursor ?? hi, speed };
  const viz = usePausedViz(
    (dt) => {
      const next = advance(r, live.current.cursor, dt, live.current.speed);
      live.current.cursor = next.cursor;
      scrub(next.cursor);
      return !next.done;
    },
    { autoStart: false },
  );
  // a new operating point or a reduced-motion preference stops the loop
  useEffect(() => {
    viz.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.file, allowed]);
  const toggle = () => {
    if (!allowed) return;
    if (!viz.playing && (cursor ?? hi) >= hi) scrub(lo);
    viz.toggle();
  };
  const onKey = (e: { key: string; preventDefault: () => void }) => {
    const step = 1 / r.frames_per_stroke;
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      toggle();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      viz.pause();
      const at = (cursor ?? hi) + (e.key === 'ArrowLeft' ? -step : step);
      scrub(Math.max(lo, Math.min(hi, at)));
    }
  };
  const label: BiText = { en: 'Stroke cursor', es: 'Cursor de golpe' };
  return (
    <div className="cdem-controls" role="group" aria-label={t('Replay controls', 'Controles de la repetición')} onKeyDown={onKey} data-frame={frame} data-playing={viz.playing ? 'true' : 'false'} data-reduced-motion={reduced ? 'true' : 'false'} data-autoplay="false">
      <button type="button" className="btn" onClick={toggle} disabled={!allowed} aria-pressed={viz.playing} title={allowed ? undefined : t('Playback is off: reduced motion is on', 'La reproducción está apagada: el movimiento reducido está activo')}>
        {viz.playing ? t('Pause', 'Pausa') : t('Play', 'Reproducir')}
      </button>
      <input
        type="range"
        {...inputProps}
        min={lo}
        max={hi}
        step={1 / r.frames_per_stroke}
        value={cursor ?? hi}
        aria-label={label[lang]}
        aria-valuetext={frameLabelText(r, frame, num, lang)}
        onChange={(e) => {
          viz.pause();
          inputProps.onChange(e);
        }}
      />
      <span {...markerProps} data-linked-cursor-position={cursor ?? hi} className="cdem-cursor-chip" data-frame-label="" aria-live="off">
        {frameLabelText(r, frame, num, lang)}
      </span>
      <label className="cdem-speed">
        <span>{t('Speed', 'Velocidad')}</span>
        <select value={speed} onChange={(e) => onSpeed(Number(e.target.value))} aria-label={t('Playback speed in strokes per second', 'Velocidad de reproducción en golpes por segundo')}>
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {num(s, { digits: 2 })} {s === 1 ? t('stroke/s', 'golpe/s') : t('strokes/s', 'golpes/s')}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export { DEFAULT_SPEED };

/** The reason Play is off under reduced motion, said beside the controls (the view writes it in its one line of notes). */
export const REDUCED_NOTE: { en: string; es: string } = {
  en: 'Reduced motion is on: the replay does not play; step with the slider or the arrow keys.',
  es: 'Movimiento reducido activo: la repetición no se reproduce; avance con el control deslizante o las flechas.',
};

/** The card of the stage: its title, its takeaway line as the note, and what fills it; a frames file that is loading or failed is said in the stage's place. */
export function StageCard({ title, note, stateKey, actions, children }: { title: BiText; note?: BiText; stateKey?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <PlotCard fill title={title} lane="replay" provenance="published" dataKey={stateKey} note={note} actions={actions}>
      <div className="cdem-stack" data-caos-flow="">
        {children}
      </div>
    </PlotCard>
  );
}

/** What stands in the stage's place while the frames file loads or when it failed: the reason, in the reader's language. */
export function FramesState({ frames }: { frames: Loaded<DemFrames> }) {
  const lang = useShellLang();
  if (frames.state === 'loading')
    return (
      <p className="caos-pending" data-state="loading">
        {lang === 'es' ? 'Cargando la repetición de partículas' : 'Loading the particle replay'}
      </p>
    );
  if (frames.state === 'unavailable')
    return (
      <p className="caos-pending" data-state="unavailable">
        {frames.reason[lang]}
      </p>
    );
  if (frames.state === 'error')
    return (
      <p className="caos-pending" role="alert" data-state="unavailable">
        {lang === 'es' ? `No se pudo leer la repetición de partículas: ${frames.error}` : `The particle replay could not be read: ${frames.error}`}
      </p>
    );
  return null;
}
