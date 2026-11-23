// The stage of the particle-simulation view (requirement DM-012, DM-013): the laboratory jaw's section in the x-z plane, to scale, on a canvas
// that follows its container's size and the device's pixel ratio; the fixed plate, the swing plate from its pivot to its bottom edge at the
// frame, the hopper, the discharge level and the closed and open settings, and the spheres as circles coloured by their diameter against the
// feed class, drawn far to near along y so depth reads. Three callouts are anchored to the scene (the discharge, the swing plate, the product
// below the discharge) through the shell's callout stage, as the chamber's section does; the controls sit in the stage's control row, never over
// the subject. The animation loop is the shell's (usePausedViz): it stops when the view unmounts, when the tab is hidden and, here, it never
// starts under reduced motion.
import { PlotCard, prefersReducedMotion, resolveToken, SceneCallouts, Stage, useLinkedCursor, usePausedViz, useShellLang, useStageSize, useThemeTokens, type BiText } from '@fasl-work/caos-app-shell';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Loaded } from '../api/artifacts';
import type { DemRun } from '../lib/contract.types';
import { toCallout, type CalloutSpec } from './callouts';
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
import { pathConflicts, type Box } from './dem.rules.mjs';
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
/**
 * The shapes a frame draws that a label must not cover, in the canvas's CSS pixels: the circle of every sphere of the frame and the two plate
 * lines (the fixed plate, and the swing plate from its pivot to its end). The check reads them from the canvas's `data-shapes`, never from pixels.
 */
export function replayShapes(tf: StageTransform, g: DemReplay['geometry'], frames: DemFrames | null, frame: number, plate: { x: number; z: number }): { circles: number[][]; plates: number[][] } {
  const circles: number[][] = [];
  if (frames) {
    const [s0, s1] = frameSpheres(frames, frame);
    const d = frames.data;
    for (let s = s0; s < s1; s++) {
      const c = tf.px(d[s * 4], d[s * 4 + 2]);
      circles.push([Math.round(c.x * 10) / 10, Math.round(c.y * 10) / 10, Math.round(Math.max(1.2, d[s * 4 + 3] * tf.scale) * 10) / 10]);
    }
  }
  const f0 = tf.px(g.fixed_plate_x_mm, g.fixed_plate_z_mm[0]);
  const f1 = tf.px(g.fixed_plate_x_mm, g.fixed_plate_z_mm[1]);
  const pivot = tf.px(g.swing_pivot_mm[0], g.swing_pivot_mm[1]);
  const e = tf.px(plate.x, plate.z);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return { circles, plates: [[r1(f0.x), r1(f0.y), r1(f1.x), r1(f1.y)], [r1(pivot.x), r1(pivot.y), r1(e.x), r1(e.y)]] };
}

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
      const r = Math.max(1.2, d[s * 4 + 3] * tf.scale);
      ctx.globalAlpha = 0.55 + (0.45 * (d[s * 4 + 1] - ys[0])) / span;
      ctx.fillStyle = a.palette[sizeClass(2 * d[s * 4 + 3], a.feedLowMm)];
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = r > 2.5 ? a.colors.surface : a.colors.fg;
      ctx.lineWidth = r > 2.5 ? 0.6 : 0.8;
      ctx.stroke();
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
      data-shapes={inset ? undefined : JSON.stringify(replayShapes(tf, r.geometry, frames, frame, plate))}
    />
  );
};

/**
 * The labels of the section, placed outside the chamber so the scene never covers them: on the left of the drawn part the fixed plate and
 * the discharge level, on its right the swing plate, the settings and the hopper, each with a leader to what it names. They are placed so
 * none leaves the drawing or touches another (the gate's G10). Also the subjects the callouts are anchored to, on the main section.
 */
function sectionLabels(tf: StageTransform, point: DemPoint, run: DemRun, plate: { x: number; z: number }, width: number, height: number, names: Names, narrow: boolean, num: (v: number, o?: { digits?: number; decimals?: number }) => string, reserved: { x0: number; x1: number; y0: number; y1: number }[] = []): { node: ReactNode; boxes: { text: string; box: { left: number; right: number; top: number; bottom: number } }[] } {
  const r = point.simulation.replay!;
  const g = r.geometry;
  const ext = plateExtremes(r);
  const L = new Labels(width, height, 22);
  for (const b of reserved) L.reserve(b.x0, b.x1, b.y0, b.y1);
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
    // the callouts' leaders come in from the left, so the discharge level is named at the right
    { text: names.discharge, x: right, y: disY - 6, anchor: 'start', fill: TOKEN.faint, to: { x: tf.px(tf.bounds.xMax - 6, 0).x, y: disY } },
    { text: names.swing, x: right, y: swingMid.y, anchor: 'start', fill: TOKEN.accent, to: { x: swingMid.x + 4, y: swingMid.y } },
    { text: names.hopper, x: right + (narrow ? 8 : 0), y: hop.y - (narrow ? 14 : 0), anchor: 'start', fill: TOKEN.faint, to: { x: hop.x + 3, y: hop.y } },
    { text: `${names.css} ${num(run.settings.css_mm, { digits: 3 })} mm`, x: right, y: closedPx.y + 4, anchor: 'start', fill: TOKEN.accent, weight: 700, to: { x: closedPx.x + 3, y: closedPx.y } },
    { text: `${names.oss} ${num(run.settings.oss_mm, { digits: 3 })} mm`, x: right, y: openPx.y + 22, anchor: 'start', fill: TOKEN.subtle, to: { x: openPx.x + 3, y: openPx.y + 3 } },
  ];
  const placed = items.map((it) => ({ it, p: L.place(it.text, it.x, it.y, it.anchor, { fill: it.fill, weight: it.weight }) }));
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
  const boxes = placed.map(({ it }, i) => ({ text: it.text, box: L.placed[reserved.length + i] }));
  return { node, boxes };
}

/** The short names of the narrow stage, where a long label cannot stand clear of the walls and the callouts' leaders. */
export const SHORT_NAMES: Record<'en' | 'es', Pick<Names, 'hopper' | 'discharge'>> = {
  en: { hopper: 'hopper', discharge: 'discharge' },
  es: { hopper: 'tolva', discharge: 'descarga' },
};

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

export function SizePanel({ width, left = 0, top = 0, point, counts, max, palette }: { width: number; left?: number; top?: number; point: DemPoint; counts: number[]; max: number; palette: string[] }) {
  const height = SIZE_PANEL_H;
  const num = useNum();
  const t = useT();
  const lang = useShellLang();
  const labels = sizeClassLabels(point.feed_mm[0], num, lang);
  const head = 20;
  const row = 18;
  const labelW = 64;
  const barX = 18 + labelW;
  const barMax = Math.max(8, width - barX - 40);
  const font = { fontFamily: 'var(--font-sans)', fontSize: 11, fontVariantNumeric: 'tabular-nums' } as const;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('Spheres of the frame by diameter', 'Esferas del cuadro por diámetro')} data-legend="size" data-chart="dem-size-panel" style={{ position: 'absolute', left, top }}>
      <text x={4} y={13} fill={TOKEN.subtle} fontWeight={600} {...{ style: font }}>
        {t('Diameter (mm)', 'Diámetro (mm)')}
      </text>
      {labels.map((label, c) => {
        const y = head + c * row + row / 2;
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
export function Inset({ width, height, left, top = 0, run, point, frames, frame, plate, mainScale }: { width: number; height: number; left?: number; top?: number; run: DemRun; point: DemPoint; frames: DemFrames | null; frame: number; plate: { x: number; z: number }; mainScale: number }) {
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
    <div className="cdem-inset" style={{ position: 'absolute', left, top, width, height }} data-inset="" data-magnification={String(Math.round(mag * 100) / 100)}>
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
            <line x1={8} y1={14} x2={8 + bar} y2={14} />
            <line x1={8} y1={11} x2={8} y2={17} />
            <line x1={8 + bar} y1={11} x2={8 + bar} y2={17} />
          </g>
          <text x={8 + bar + 5} y={18} fill={TOKEN.fg} {...{ style: font }}>
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
export interface CalloutTarget {
  id: 'throughput' | 'net_power' | 'p80';
  /** Where the leader ends, in pixels of the section's canvas. */
  end: { x: number; y: number };
  /** The height at which the leader's last run arrives, in the same pixels: the end itself, or a little above or below it when the last step is a short vertical. */
  approachY: number;
  /** The subject's drawn box, in the same pixels. */
  box: { left: number; right: number; top: number; bottom: number };
}

/**
 * The subjects the three callouts name and where each leader ends on them, in pixels of the section's canvas: the swing plate for the net power
 * (its middle), the discharge gap between the fixed plate and the plate's closed edge for the throughput (arriving from above), and the
 * discharge level to the left of the fixed plate for the P80 (arriving from below), so the two lowest leaders run on tracks 24 px apart and end
 * 30 mm apart on the level.
 */
export function calloutTargets(tf: StageTransform, g: DemReplay['geometry'], plate: { x: number; z: number }, closed: { x: number; z: number }): CalloutTarget[] {
  const gapL = tf.px(g.fixed_plate_x_mm, g.discharge_z_mm);
  const gapR = tf.px(closed.x, g.discharge_z_mm);
  const pivot = tf.px(g.swing_pivot_mm[0], g.swing_pivot_mm[1]);
  const tip = tf.px(plate.x, plate.z);
  const mid = { x: (pivot.x + tip.x) / 2, y: (pivot.y + tip.y) / 2 };
  const level = { x: tf.px(g.fixed_plate_x_mm - 45, 0).x, y: gapL.y };
  return [
    { id: 'throughput', end: { x: (gapL.x + gapR.x) / 2, y: gapL.y }, approachY: gapL.y - 12, box: { left: gapL.x - 4, right: gapR.x + 4, top: gapL.y - 8, bottom: gapL.y + 8 } },
    { id: 'net_power', end: mid, approachY: mid.y, box: { left: Math.min(pivot.x, tip.x) - 5, right: Math.max(pivot.x, tip.x) + 5, top: Math.min(pivot.y, tip.y) - 5, bottom: Math.max(pivot.y, tip.y) + 5 } },
    { id: 'p80', end: level, approachY: gapL.y + 12, box: { left: level.x - 12, right: level.x + 12, top: gapL.y - 6, bottom: gapL.y + 6 } },
  ];
}

export interface LeaderPath {
  id: CalloutTarget['id'];
  /** The path from the card's middle to the end, in pixels of the stage: through the column's edge at the card's own height, along its track in the gutter, and across to the subject. */
  points: { x: number; y: number }[];
}

/** The x offsets from the column's edge of the tracks the leaders run down in the gutter between the callout column and the drawing. */
export const TRACK_OFFSETS = [5, 12, 19] as const;

/**
 * The leaders as elbows: from the card's middle straight out to the column's edge at the card's own height (a short horizontal run that
 * crosses nothing), down or up its own track in the gutter, and across to the subject at the height the target gives. The tracks are
 * assigned to the leaders in the order that leaves the fewest crossings and overlaps.
 */
export function routeLeaders(cards: { id: CalloutTarget['id']; x: number; y: number }[], targets: CalloutTarget[], columnEdge: number, origin: number, boxes: { cards?: { id: string; box: Box }[]; labels?: { text: string; box: Box }[] } = {}, side: 'right' | 'left' = 'right', originY = 0): LeaderPath[] {
  const build = (order: number[]): LeaderPath[] =>
    cards.map((c, k) => {
      const t = targets.find((q) => q.id === c.id)!;
      const track = side === 'right' ? columnEdge + TRACK_OFFSETS[order[k]] : columnEdge - TRACK_OFFSETS[order[k]];
      const endX = origin + t.end.x;
      const raw = [
        { x: c.x, y: c.y },
        { x: columnEdge, y: c.y },
        { x: track, y: c.y },
        { x: track, y: originY + t.approachY },
        { x: endX, y: originY + t.approachY },
        { x: endX, y: originY + t.end.y },
      ];
      return { id: c.id, points: raw.filter((q, i) => i === 0 || Math.hypot(q.x - raw[i - 1].x, q.y - raw[i - 1].y) > 0.01) };
    });
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].filter((o) => o.length >= cards.length).map((o) => o.slice(0, cards.length));
  let best = build(perms[0]);
  let fewest = pathConflicts(best, boxes.cards, boxes.labels);
  for (const o of perms.slice(1)) {
    const paths = build(o);
    const n = pathConflicts(paths, boxes.cards, boxes.labels);
    if (n < fewest) {
      best = paths;
      fewest = n;
    }
  }
  return best;
}

/** The width of the column the callouts take at the left of the section on a desktop [px], and the gutter the leaders' tracks run in. */
export const CALLOUT_COLUMN = 212;
export const GUTTER = 28;
/** The same on a phone, where the cards are the compact size of the shell (164 px) and the column sits beside the section. */
export const CALLOUT_COLUMN_NARROW = 184;
export const GUTTER_NARROW = 28;

export function stageColumns(width: number, height: number): { wide: boolean; panel: number; chamber: number; main: number; inset: number } {
  const panel = panelWidth(width);
  if (width < 640) return { wide: false, panel, chamber: Math.max(80, width - CALLOUT_COLUMN_NARROW - GUTTER_NARROW), main: Math.max(80, width - panel), inset: Math.max(120, width - panel - 8) };
  // the section's column: the callouts' column, the gutter for their tracks and the chamber at its scale with room for its labels on both sides
  const zRange = 560;
  const chamber = Math.round(170 * Math.max(0.3, (height - 16) / zRange) + 2 * 92);
  const main = chamber + CALLOUT_COLUMN + GUTTER;
  const drawH = height - insetHead(panel + 200);
  const inset = Math.round(Math.max(220, Math.min(width - panel - main - 12, (drawH * 70) / 92 + 8)));
  return { wide: true, panel, chamber, main: width - panel - inset - 12, inset };
}

export interface StageRects {
  wide: boolean;
  callouts: { x: number; y: number; w: number; h: number };
  chamber: { x: number; y: number; w: number; h: number };
  inset: { x: number; y: number; w: number; h: number };
  panel: { x: number; y: number; w: number };
}

/** The gutter at the left of a phone's stage, where the leaders run down their tracks beside the cards [px]; the cards and the section's labels stand clear of it. */
export const GUTTER_PHONE = 22;
/** The height the lower row of a phone's stage takes (the size legend and the magnified zone) and the least the section takes [px]. */
export const PHONE_LOWER_H = 200;
export const PHONE_SECTION_MIN = 300;

/**
 * Where the parts of the stage stand. Wide: the callouts' column, the gutter, the section, the magnified zone and the size legend in one row at
 * the full height. Narrow (a phone): stacked, the callout cards first, one under another (`cardsH` is the height they take once laid out), then the
 * section at the full width with its labels outside the chamber on both sides, then the size legend and the magnified zone in a row.
 */
export function stageRects(width: number, height: number, cardsH = 300): StageRects {
  const col = stageColumns(width, height);
  if (col.wide) {
    const x = CALLOUT_COLUMN + GUTTER;
    return { wide: true, callouts: { x: 0, y: 0, w: CALLOUT_COLUMN, h: height }, chamber: { x, y: 0, w: col.chamber, h: height }, inset: { x: x + col.chamber + 6, y: 0, w: col.inset, h: height }, panel: { x: width - col.panel, y: 0, w: col.panel } };
  }
  const cy = cardsH + 6;
  const sectionH = Math.max(PHONE_SECTION_MIN, height - cy - PHONE_LOWER_H - 6);
  const ly = cy + sectionH + 6;
  return {
    wide: false,
    // the shell lays its compact cards (164 px) in a row where it can: the column is only as wide as one card, so they stand one under another
    callouts: { x: GUTTER_PHONE, y: 0, w: Math.min(CALLOUT_COLUMN, width - GUTTER_PHONE), h: cardsH },
    chamber: { x: 0, y: cy, w: width, h: sectionH },
    inset: { x: col.panel + 8, y: ly, w: Math.max(120, width - col.panel - 8), h: PHONE_LOWER_H },
    panel: { x: 0, y: ly, w: col.panel },
  };
}

interface StageProps {
  run: DemRun;
  point: DemPoint;
  frames: DemFrames | null;
  cursor: number;
  callouts: CalloutSpec[];
}

/**
 * The stage: the whole height of the region goes to the drawing. The callouts are a column of the shell's cards; each leader leaves its own
 * card at the card's height and the view's own layer carries it on as an elbow down a track in the gutter and across to the subject it names,
 * so no leader passes over or under another card or a label. On a desktop the magnified crushing zone is the main drawing beside the section;
 * on a phone the zone and the size legend stand in a row under the callouts and the section.
 */
function StageBody({ run, point, frames, cursor, callouts }: StageProps) {
  const lang = useShellLang();
  const num = useNum();
  const palette = usePalette();
  const r = point.simulation.replay!;
  const frame = frameBelow(r, cursor);
  const plate = plateAt(r, cursor);
  const counts = frames ? classCounts(frames, frame, point.feed_mm[0]) : new Array<number>(SIZE_CLASSES).fill(0);
  const bounds = stageBounds(r.geometry, frames ? sphereTop(frames) : undefined);
  // the callouts' column, set once the stage has a size (the shell renders its children only then)
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  // the middle of each card as the shell laid it out, in pixels of the stage: the leaders leave their own card at its height
  const [cards, setCards] = useState<Record<string, { x: number; y: number; box: Box }>>({});
  useLayoutEffect(() => {
    if (!host) return;
    // measured from the host's own corner, whatever the shell nests the cards in; read again whenever the shell adds, moves or resizes a card
    const measure = () => {
      const o = host.getBoundingClientRect();
      const next: Record<string, { x: number; y: number; box: Box }> = {};
      host.querySelectorAll<HTMLElement>('[data-caos-callout]').forEach((el) => {
        const id = el.getAttribute('data-caos-callout');
        if (!id) return;
        const r = el.getBoundingClientRect();
        const box = { left: Math.round((r.left - o.left) * 10) / 10, right: Math.round((r.right - o.left) * 10) / 10, top: Math.round((r.top - o.top) * 10) / 10, bottom: Math.round((r.bottom - o.top) * 10) / 10 };
        next[id] = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2, box };
      });
      setCards((prev) => {
        const same = Object.keys(next).length === Object.keys(prev).length && Object.entries(next).every(([k, v]) => prev[k] && Math.abs(prev[k].x - v.x) < 0.6 && Math.abs(prev[k].y - v.y) < 0.6 && Math.abs(prev[k].box.right - v.box.right) < 0.6);
        return same ? prev : next;
      });
    };
    measure();
    const watch = new MutationObserver(measure);
    watch.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    const size = new ResizeObserver(measure);
    size.observe(host);
    host.querySelectorAll('[data-caos-callout-layer], [data-caos-callout]').forEach((el) => size.observe(el));
    host.addEventListener('transitionend', measure);
    // the shell settles its cards over its first layout passes without a change this view can observe: read them again at once, then a few times more
    let left = 12;
    let timer = 0;
    const again = () => {
      measure();
      host.querySelectorAll('[data-caos-callout-layer], [data-caos-callout]').forEach((el) => size.observe(el));
      left -= 1;
      if (left > 0) timer = window.setTimeout(again, 150);
    };
    timer = window.setTimeout(again, 60);
    return () => {
      window.clearTimeout(timer);
      watch.disconnect();
      size.disconnect();
      host.removeEventListener('transitionend', measure);
    };
  }, [host]);
  return (
    <Stage label={{ en: 'Particle replay in the jaw section', es: 'Repetición de partículas en la sección de la mandíbula' }}>
      {({ width, height }) => {
        const cardsH = callouts.every((c) => cards[c.id]) ? Math.round(Math.max(...callouts.map((c) => cards[c.id].box.bottom)) + 8) : 300;
        const rect = stageRects(width, height, cardsH);
        const tf = stageTransform(r.geometry, rect.chamber.w, rect.chamber.h, 8, bounds);
        const targets = calloutTargets(tf, r.geometry, plate, plateExtremes(r).closed);
        // the column's edge the leaders cross: its right edge beside the section, its left edge (the gutter side) over it
        const edge = rect.wide ? rect.callouts.x + rect.callouts.w : rect.callouts.x;
        const origin = rect.chamber.x;
        const originY = rect.chamber.y;
        // the runs the leaders make across the section's margin are kept free of labels
        const reserved = targets.map((t) => ({ x0: -origin, x1: t.end.x + 4, y0: t.approachY - 3, y1: t.approachY + 3 }));
        const { node, boxes } = sectionLabels(tf, point, run, plate, rect.chamber.w, rect.chamber.h, NAMES[lang], !rect.wide, num, reserved);
        // the shell's leader runs from the card's middle out to the column's edge at the card's own height; with the cards not yet measured, at the middle
        const items = callouts.map((c) => toCallout(c, { x: rect.wide ? 1 : 0, y: (cards[c.id]?.y ?? rect.callouts.h / 2) / Math.max(1, rect.callouts.h) }, lang));
        const measured = callouts.every((c) => cards[c.id]);
        const stageLabels = boxes.map((b) => ({ text: b.text, box: { left: b.box.left + origin, right: b.box.right + origin, top: b.box.top + originY, bottom: b.box.bottom + originY } }));
        const dx = rect.callouts.x;
        const dy = rect.callouts.y;
        const placedCards = callouts.map((c) => (cards[c.id] ? { id: c.id, x: cards[c.id].x + dx, y: cards[c.id].y + dy, box: { left: cards[c.id].box.left + dx, right: cards[c.id].box.right + dx, top: cards[c.id].box.top + dy, bottom: cards[c.id].box.bottom + dy } } : null));
        const paths = measured
          ? routeLeaders(placedCards.map((c) => ({ id: c!.id as CalloutTarget['id'], x: c!.x, y: c!.y })), targets, edge, origin, { cards: placedCards.map((c) => ({ id: c!.id, box: c!.box })), labels: stageLabels }, rect.wide ? 'right' : 'left', originY)
          : [];
        const showInset = rect.inset.h - insetHead(rect.inset.w) >= INSET_MIN_PX;
        return (
          <div style={{ position: 'relative', width, height }} data-dem-stage="" data-frame={frame} data-layout={rect.wide ? 'wide' : 'narrow'} data-inset-shown={showInset ? 'true' : 'false'}>
            <div ref={setHost} className="cdem-callout-host" style={{ position: 'absolute', left: rect.callouts.x, top: rect.callouts.y, width: rect.callouts.w, height: rect.callouts.h }} data-callouts-column="">
              <SceneCallouts items={items} placement="header" />
            </div>
            <div style={{ position: 'absolute', left: rect.chamber.x, top: rect.chamber.y, width: rect.chamber.w, height: rect.chamber.h }}>
              <ReplayCanvas width={rect.chamber.w} height={rect.chamber.h} run={run} point={point} frames={frames} frame={frame} tf={tf} plate={plate} />
              {node}
            </div>
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" data-chart="dem-callout-leaders" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
              <g stroke={TOKEN.subtle} strokeWidth={1} strokeDasharray="2 3" fill="none">
                {targets.map((t) => {
                  const path = paths.find((q) => q.id === t.id);
                  return (
                    <g key={t.id}>
                      {path && (
                        <polyline
                          data-callout-leader={t.id}
                          data-end-x={Math.round((origin + t.end.x) * 10) / 10}
                          data-end-y={Math.round((originY + t.end.y) * 10) / 10}
                          data-points={path.points.map((q) => `${Math.round(q.x * 10) / 10},${Math.round(q.y * 10) / 10}`).join(' ')}
                          points={path.points.slice(1).map((q) => `${q.x},${q.y}`).join(' ')}
                        />
                      )}
                      <circle cx={origin + t.end.x} cy={originY + t.end.y} r={2} fill={TOKEN.subtle} stroke="none" />
                      <rect data-subject={t.id} x={origin + t.box.left} y={originY + t.box.top} width={t.box.right - t.box.left} height={t.box.bottom - t.box.top} stroke="none" fill="none" />
                    </g>
                  );
                })}
              </g>
            </svg>
            {showInset && <Inset width={rect.inset.w} height={rect.inset.h} left={rect.inset.x} top={rect.inset.y} run={run} point={point} frames={frames} frame={frame} plate={plate} mainScale={tf.scale} />}
            <SizePanel width={rect.panel.w} left={rect.panel.x} top={rect.panel.y} point={point} counts={counts} max={Math.max(1, ...r.count)} palette={palette} />
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
      {size.width > 0 && size.height > 0 && <StageBody {...props} />}
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
