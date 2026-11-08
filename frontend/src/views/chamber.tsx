// Group 1, Chamber: the 2D slice of the crushing chamber with the closed and open settings, and the nip angle against its grip
// limit. Both are drawings on the shell's `Stage` with the text kit, each under a table of the numbers it draws. The structure
// is illustrative of the machine class (cone and gyratory as a surface of revolution, the jaw as a planar two-plate mechanism),
// not the plant's own drawing, and the card says so; the numbers (the settings, the nip angle, the grip limit) are the engine's.
// The section draws the nip angle itself (M4 of the 0.13.000 review): the wedge between the mantle and the concave at the nip, at the
// engine's angle, with the grip limit 2 arctan 0.35 = 38.58 degrees as a second, dashed wedge, and the NIP ANGLE callout anchored inside
// the wedge. Its parts (mantle, concave, the gap at the closed side, the feed) are selectable on the shell's linked-view store, linked
// both ways to the 3D chamber (views/chamber3d) and to the section's callouts: the selected part's callout is shown selected.
import { formatNumber, PlotCard, Stage, ViewsRow, useShellLang, useWorkbenchState } from '@fasl-work/caos-app-shell';
import { lazy, Suspense, type ReactNode } from 'react';
import { chamberProfile, jawProfile, machineGeom, profilePolylines } from '../engine/chamber';
import { evaluate } from '../engine/engine';
import type { Operating } from '../engine/types';
import type { Text } from '../lib/contract.types';
import { CalloutStage, type CalloutSpec, type Subject } from './callouts';
import { CircuitView } from './circuit';
import { linkedId, selectedOf, useHours, useLinkedSelection } from './linked';
import { Fill, Labels, LabelText, Stack, TOKEN } from './draw';
import { GroupFrame, Pending, provenanceOf, useNum, useT, useView, type Sub } from './shared';

const STRUCTURE_NOTE = {
  en: 'The structure is illustrative of the machine class, not the plant’s own drawing; the settings, the nip angle and the grip limit are the engine’s numbers.',
  es: 'La estructura es ilustrativa de la clase de máquina, no el plano de la planta; las aberturas, el ángulo de nip y el límite de agarre son números del motor.',
} as const;

interface GeometryRow {
  css: number;
  throwMm: number;
  oss: number;
  nip: number;
  limit: number;
}

/** The numbers under the slice and the nip diagram: one row, the same in both, so a reader finds a number in one place. The headers
 * are the symbols the drawing writes (CSS, OSS), each with its full name as a tooltip, and the reading is the table's caption, so the
 * header is whole in the chamber's narrow card at 1280 px (m3). */
function GeometryTable({ g }: { g: GeometryRow }) {
  const t = useT();
  const num = useNum();
  const gripped = g.nip <= g.limit;
  const head = (short: string, full: string) => (
    <th>
      <abbr title={full}>{short}</abbr>
    </th>
  );
  return (
    <div className="cdem-tablewrap">
      <table className="caos-table" data-state="ready">
        <caption className="cdem-caption">
          {gripped
            ? t('Gripped and crushed: the nip angle is within the grip limit.', 'Agarra y tritura: el ángulo de nip está dentro del límite de agarre.')
            : t('Squeezed upward: the nip angle is above the grip limit.', 'Escupida hacia arriba: el ángulo de nip supera el límite de agarre.')}
        </caption>
        <thead>
          <tr>
            {head('CSS (mm)', t('Closed-side setting (mm)', 'Abertura de descarga (mm)'))}
            {head(t('Throw (mm)', 'Carrera (mm)'), t('Throw (mm)', 'Carrera (mm)'))}
            {head('OSS (mm)', t('Open-side setting (mm)', 'Abertura del lado abierto (mm)'))}
            {head(t('Nip (°)', 'Nip (°)'), t('Nip angle (degrees)', 'Ángulo de nip (grados)'))}
            {head(t('Limit (°)', 'Límite (°)'), t('Grip limit (degrees)', 'Límite de agarre (grados)'))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{num(g.css, { digits: 4 })}</td>
            <td>{num(g.throwMm, { digits: 4 })}</td>
            <td>{num(g.oss, { digits: 4 })}</td>
            <td>{num(g.nip, { decimals: 1 })}</td>
            <td>{num(g.limit, { decimals: 1 })}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

type Num = (v: number | null | undefined, o?: { digits?: number; decimals?: number }) => string;

/** The parts of the chamber a reader can select, in the section and in 3D (linked ids "part:<id>"). */
export const CHAMBER_PARTS = ['mantle', 'concave', 'gap', 'feed'] as const;
export type ChamberPart = (typeof CHAMBER_PARTS)[number];

/** The callout each part is read on: the gap is the closed-side setting, the mantle carries the throw, the concave meets it at the nip. */
export const PART_CALLOUT: Record<ChamberPart, string | null> = { gap: 'css', mantle: 'throw', concave: 'nip', feed: null };

type Pt = [number, number];
const unit = ([x, y]: Pt): Pt => {
  const n = Math.hypot(x, y) || 1;
  return [x / n, y / n];
};
const rot = ([x, y]: Pt, a: number): Pt => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

export interface NipWedge {
  apex: Pt;
  /** The two rays of the nip angle and of the grip limit, from the apex. */
  nip: [Pt, Pt];
  limit: [Pt, Pt];
  /** The filled sector of the nip angle (an SVG path) and the dashed arc of the limit. */
  sector: string;
  limitArc: string;
  /** The middle of the sector's arc: the NIP ANGLE callout's anchor. */
  anchor: Pt;
}

/**
 * The nip wedge in drawing pixels: the two walls at the nip (points `c` on the concave and `m` on the mantle, with their upward
 * tangents), the bisector of the walls' directions, and the apex on it below the gap's middle at the distance where rays at plus and
 * minus half the engine's nip angle pass through the two walls; the grip limit is the same construction at its own angle, shorter.
 */
export function nipWedge(c: Pt, m: Pt, tc: Pt, tm: Pt, nipDeg: number, limitDeg: number): NipWedge {
  const bis = unit([unit(tc)[0] + unit(tm)[0], unit(tc)[1] + unit(tm)[1]]);
  const mid: Pt = [(c[0] + m[0]) / 2, (c[1] + m[1]) / 2];
  const half = Math.hypot(c[0] - m[0], c[1] - m[1]) / 2;
  const a = (Math.max(1, Math.min(nipDeg, 120)) / 2) * (Math.PI / 180);
  const b = (Math.max(1, Math.min(limitDeg, 150)) / 2) * (Math.PI / 180);
  const d = half / Math.tan(a);
  const apex: Pt = [mid[0] - bis[0] * d, mid[1] - bis[1] * d];
  const len = Math.hypot(half, d);
  const ray = (ang: number, l: number): Pt => {
    const v = rot(bis, ang);
    return [apex[0] + v[0] * l, apex[1] + v[1] * l];
  };
  const nip: [Pt, Pt] = [ray(-a, len), ray(a, len)];
  const rl = len * 0.62;
  const limit: [Pt, Pt] = [ray(-b, rl), ray(b, rl)];
  const r = len * 0.8;
  const p0 = ray(-a, r);
  const p1 = ray(a, r);
  const sector = `M${apex[0]},${apex[1]} L${p0[0]},${p0[1]} A${r},${r} 0 0 1 ${p1[0]},${p1[1]} Z`;
  const l0 = ray(-b, rl * 0.92);
  const l1 = ray(b, rl * 0.92);
  const limitArc = `M${l0[0]},${l0[1]} A${rl * 0.92},${rl * 0.92} 0 0 1 ${l1[0]},${l1[1]}`;
  // on the wedge's arc, where the angle is read (drawn in full colour, so the anchor is on ink at any theme)
  const anchor = ray(0, r);
  return { apex, nip, limit, sector, limitArc, anchor };
}

/** The angle in degrees between the two rays of a wedge (what a reader measures on the drawing). */
export function wedgeAngle(w: Pick<NipWedge, 'apex'> & { rays: [Pt, Pt] }): number {
  const u = unit([w.rays[0][0] - w.apex[0], w.rays[0][1] - w.apex[1]]);
  const v = unit([w.rays[1][0] - w.apex[0], w.rays[1][1] - w.apex[1]]);
  return (Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))) * 180) / Math.PI;
}

export interface PartLink {
  selected: string | null;
  select: (part: ChamberPart) => void;
}

/** The linked-view attributes of a part of the section (the shell's useLinkedItem, spelled out because a drawing function holds no hook). */
const partProps = (part: ChamberPart, link: PartLink) => {
  const on = link.selected === part;
  return {
    'data-linked-id': linkedId('part', part),
    'data-linked-view': 'panel',
    'data-linked-selected': on ? 'true' : 'false',
    'aria-pressed': on,
    role: 'button',
    tabIndex: 0,
    style: { cursor: 'pointer' },
    onClick: () => link.select(part),
    onKeyDown: (e: { key: string; preventDefault: () => void }) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        link.select(part);
      }
    },
  } as const;
};

/** The nip wedge's elements: the filled sector and its rays at the engine's angle, the limit's dashed rays and arc, its two labels. */
function WedgeMarks({ w }: { w: NipWedge }) {
  return (
    <g data-nip-wedge="" data-subject="">
      <path d={w.sector} fill="color-mix(in oklab, var(--color-warn) 32%, transparent)" stroke={TOKEN.warn} strokeWidth={2} />
      {w.nip.map((p, i) => (
        <line key={`n${i}`} x1={w.apex[0]} y1={w.apex[1]} x2={p[0]} y2={p[1]} stroke={TOKEN.warn} strokeWidth={1.6} />
      ))}
      {w.limit.map((p, i) => (
        <line key={`l${i}`} x1={w.apex[0]} y1={w.apex[1]} x2={p[0]} y2={p[1]} stroke={TOKEN.bad} strokeWidth={1.2} strokeDasharray="4 3" />
      ))}
      <path d={w.limitArc} fill="none" stroke={TOKEN.bad} strokeWidth={1.2} strokeDasharray="4 3" />
    </g>
  );
}

/** The cone and gyratory slice: the fixed concave, the gyrating mantle, the closed-side setting at the discharge and the open-side outline. */
function revolutionSlice(op: Operating, width: number, height: number, lang: 'en' | 'es', num: Num, link: PartLink, nipDeg: number, limitDeg: number): { node: ReactNode; subjects: Subject[] } {
  const prof = chamberProfile(op.machine, op.cssMm, op.throwMm);
  const { concave, mantle } = profilePolylines(prof, 40);
  const P = prof.P;
  const padX = 8;
  const padY = 10;
  const rMax = Math.max(...concave.map((c) => c[0])) * 1.04;
  const zMin = -P.overlap;
  const zRange = P.zTop - zMin;
  const s = Math.min((width - 2 * padX) / (2 * rMax), (height - 2 * padY) / zRange);
  const cx = width / 2;
  const sx = (r: number) => r * s;
  const sy = (z: number) => height - padY - (z - zMin) * s;
  const right = (pts: [number, number][]) => pts.map(([r, z]) => `${cx + sx(r)},${sy(z)}`);
  const left = (pts: [number, number][]) => [...pts].reverse().map(([r, z]) => `${cx - sx(r)},${sy(z)}`);
  const bowl = `M${right(concave).join(' L')} L${left(concave).join(' L')} Z`;
  const hasMantle = mantle.length >= 2;
  const body = hasMantle ? `M${right(mantle).join(' L')} L${left(mantle).join(' L')} Z` : '';
  const shifted = hasMantle ? `M${mantle.map(([r, z]) => `${cx + sx(r) + sx(op.throwMm) / 2},${sy(z)}`).join(' L')}` : '';
  const zGap = 6;
  const rc = prof.rConcave(zGap);
  const rm = prof.rMantleClosed(zGap);
  const yGap = sy(zGap);
  // the nip wedge on the closed side, at 55 percent of the chamber's height: the walls' upward tangents from the profile
  const zN = P.zTop * 0.55;
  const dz = Math.max(1, P.zTop * 0.02);
  const wall = (r: (z: number) => number): Pt => unit([sx(r(zN + dz)) - sx(r(zN)), sy(zN + dz) - sy(zN)]);
  const w = nipWedge([cx + sx(prof.rConcave(zN)), sy(zN)], [cx + sx(Math.max(0, prof.rMantleClosed(zN))), sy(zN)], wall(prof.rConcave), wall((z) => Math.max(0, prof.rMantleClosed(z))), nipDeg, limitDeg);
  const L = new Labels(width, height);
  const names = {
    mantle: lang === 'es' ? 'manto' : 'mantle',
    concave: lang === 'es' ? 'cóncavo' : 'concave',
    lip: lang === 'es' ? 'labio del cóncavo' : 'concave lip',
    feed: lang === 'es' ? 'alimentación' : 'feed',
  };
  const yFeed = sy(P.zTop) - 2;
  const labels = [
    L.place(`CSS ${num(op.cssMm, { digits: 4 })} mm`, cx + sx(rc) + 12, yGap - 4, 'start', { fill: TOKEN.warn, weight: 700 }),
    L.place(`OSS ${num(op.cssMm + op.throwMm, { digits: 4 })} mm`, cx - sx(rc) - 12, yGap - 4, 'end', { fill: TOKEN.faint }),
    L.place(names.mantle, cx, sy(P.zTop * 0.55), 'middle', { fill: TOKEN.good, weight: 600 }),
    L.place(names.concave, cx + sx(prof.rConcave(P.zTop * 0.85)) - 6, sy(P.zTop * 0.85), 'end', { fill: TOKEN.subtle }),
    L.place(names.lip, padX, sy(0) - 5, 'start', { fill: TOKEN.faint }),
    L.place(`${num(limitDeg, { decimals: 2 })}°`, w.limit[1][0] + 4, w.limit[1][1], 'start', { fill: TOKEN.bad }),
  ];
  const subjects: Subject[] = [
    { id: 'css', x: cx + (sx(rm) + sx(rc)) / 2, y: yGap },
    { id: 'nip', x: w.anchor[0], y: w.anchor[1] },
    { id: 'throw', x: cx - (sx(rm) + sx(rc)) / 2, y: yGap },
  ];
  const sel = (part: ChamberPart) => link.selected === part;
  const node = (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={lang === 'es' ? 'Corte de la cámara de chancado' : 'Cross-section of the crushing chamber'} data-chart="chamber-slice">
      <path d={bowl} fill={TOKEN.subtleSoft} stroke={sel('concave') ? TOKEN.accent : TOKEN.subtle} strokeWidth={sel('concave') ? 4 : 2.5} />
      {hasMantle && (
        <path d={body} fill={TOKEN.goodSoft} stroke={sel('mantle') ? TOKEN.accent : TOKEN.good} strokeWidth={sel('mantle') ? 4 : 2.5} {...partProps('mantle', link)}>
          <title>{names.mantle}</title>
        </path>
      )}
      <line x1={cx - sx(rc) - 8} y1={sy(0)} x2={cx + sx(rc) + 8} y2={sy(0)} stroke={TOKEN.subtle} strokeWidth={1} strokeDasharray="5 4" />
      {hasMantle && <path d={shifted} fill="none" stroke={TOKEN.good} strokeWidth={1.2} strokeDasharray="4 3" opacity={0.7} />}
      <WedgeMarks w={w} />
      {/* the concave is selected on its wall, beside its label: the bowl lies under the mantle, so the bowl itself is no target */}
      <g {...partProps('concave', link)}>
        <title>{names.concave}</title>
        <circle cx={cx + sx(prof.rConcave(P.zTop * 0.72))} cy={sy(P.zTop * 0.72)} r={9} fill="transparent" />
        <circle cx={cx + sx(prof.rConcave(P.zTop * 0.72))} cy={sy(P.zTop * 0.72)} r={4} fill={sel('concave') ? TOKEN.accent : TOKEN.subtle} />
      </g>
      <g {...partProps('gap', link)}>
        <title>{lang === 'es' ? 'abertura de descarga' : 'closed-side setting'}</title>
        <line x1={cx + sx(rm)} y1={yGap} x2={cx + sx(rc)} y2={yGap} stroke="transparent" strokeWidth={12} />
        <line x1={cx + sx(rm)} y1={yGap} x2={cx + sx(rc)} y2={yGap} stroke={sel('gap') ? TOKEN.accent : TOKEN.warn} strokeWidth={sel('gap') ? 4 : 2.5} />
      </g>
      <line x1={cx - sx(rm)} y1={yGap} x2={cx - sx(rc)} y2={yGap} stroke={TOKEN.faint} strokeWidth={2} strokeDasharray="3 2" />
      <g {...partProps('feed', link)}>
        <title>{names.feed}</title>
        <line x1={cx + sx(prof.rConcave(P.zTop)) * 0.72} y1={Math.max(2, yFeed - 18)} x2={cx + sx(prof.rConcave(P.zTop)) * 0.72} y2={yFeed} stroke={sel('feed') ? TOKEN.accent : TOKEN.fg} strokeWidth={sel('feed') ? 3.5 : 2} />
        <polygon
          points={`${cx + sx(prof.rConcave(P.zTop)) * 0.72 - 5},${yFeed - 6} ${cx + sx(prof.rConcave(P.zTop)) * 0.72 + 5},${yFeed - 6} ${cx + sx(prof.rConcave(P.zTop)) * 0.72},${yFeed + 2}`}
          fill={sel('feed') ? TOKEN.accent : TOKEN.fg}
        />
      </g>
      <LabelText items={labels} />
    </svg>
  );
  return { node, subjects };
}

/** The jaw slice: a fixed plate and a swing plate that close on a V, drawn closed (solid) and open (dashed). */
function jawSlice(op: Operating, width: number, height: number, lang: 'en' | 'es', num: Num, link: PartLink, nipDeg: number, limitDeg: number): { node: ReactNode; subjects: Subject[] } {
  const j = jawProfile(op.machine, op.cssMm, op.throwMm);
  const zTop = j.P.zTop;
  const padX = 12;
  const padY = 12;
  const xLeft = j.xSwing(zTop, 1);
  const xRight = j.xFixed(zTop);
  const span = Math.abs(xRight - xLeft) || 1;
  const s = Math.min((width - 2 * padX) / span, (height - 2 * padY) / zTop);
  const x0 = (width - span * s) / 2;
  const sx = (x: number) => x0 + (x - xLeft) * s;
  const sy = (z: number) => height - padY - z * s;
  const n = 40;
  const fixed: string[] = [];
  const closed: string[] = [];
  const open: string[] = [];
  for (let i = 0; i <= n; i++) {
    const z = (i / n) * zTop;
    fixed.push(`${sx(j.xFixed(z))},${sy(z)}`);
    closed.push(`${sx(j.xSwing(z, 0))},${sy(z)}`);
    open.push(`${sx(j.xSwing(z, 1))},${sy(z)}`);
  }
  const wedge = `M${fixed.join(' L')} L${[...closed].reverse().join(' L')} Z`;
  const yDischarge = sy(2);
  const yTop = sy(zTop - 2);
  const zN = zTop * 0.5;
  const dz = Math.max(1, zTop * 0.02);
  const w = nipWedge(
    [sx(j.xFixed(zN)), sy(zN)],
    [sx(j.xSwing(zN, 0)), sy(zN)],
    unit([sx(j.xFixed(zN + dz)) - sx(j.xFixed(zN)), sy(zN + dz) - sy(zN)]),
    unit([sx(j.xSwing(zN + dz, 0)) - sx(j.xSwing(zN, 0)), sy(zN + dz) - sy(zN)]),
    nipDeg,
    limitDeg,
  );
  const sel = (part: ChamberPart) => link.selected === part;
  const L = new Labels(width, height);
  const names = {
    fixed: lang === 'es' ? 'placa fija' : 'fixed jaw',
    swing: lang === 'es' ? 'placa móvil' : 'swing jaw',
    eccentric: lang === 'es' ? 'excéntrica' : 'eccentric',
    gape: lang === 'es' ? 'boca' : 'gape',
  };
  const labels = [
    L.place(`CSS ${num(op.cssMm, { digits: 4 })} mm`, (sx(j.xSwing(0, 0)) + sx(j.xFixed(0))) / 2, yDischarge - 8, 'middle', { fill: TOKEN.warn, weight: 700 }),
    L.place(`OSS ${num(op.cssMm + op.throwMm, { digits: 4 })} mm`, (sx(j.xSwing(0, 1)) + sx(j.xFixed(0))) / 2, yDischarge - 24, 'middle', { fill: TOKEN.faint }),
    L.place(`${names.gape} ${num(j.gapeMm, { digits: 3 })} mm`, (sx(j.xSwing(zTop, 0)) + sx(j.xFixed(zTop))) / 2, yTop + 18, 'middle', { fill: TOKEN.faint }),
    L.place(names.eccentric, sx(j.xSwing(zTop, 0)), yTop - 10, 'middle', { fill: TOKEN.warn }),
    L.place(names.fixed, sx(j.xFixed(zTop * 0.5)) + 10, sy(zTop * 0.5), 'start', { fill: TOKEN.subtle }),
    L.place(names.swing, sx(j.xSwing(zTop * 0.5, 0)) - 10, sy(zTop * 0.5), 'end', { fill: TOKEN.good }),
  ];
  const subjects: Subject[] = [
    { id: 'css', x: (sx(j.xSwing(0, 0)) + sx(j.xFixed(0))) / 2, y: yDischarge },
    { id: 'nip', x: w.anchor[0], y: w.anchor[1] },
    { id: 'throw', x: sx(j.xSwing(zTop, 0)), y: yTop },
  ];
  const node = (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={lang === 'es' ? 'Mecanismo de la chancadora de mandíbula' : 'Jaw crusher mechanism'} data-chart="chamber-slice">
      <path d={wedge} fill={TOKEN.goodSoft} stroke="none" />
      <polyline points={fixed.join(' ')} fill="none" stroke={sel('concave') ? TOKEN.accent : TOKEN.subtle} strokeWidth={6} strokeLinecap="round" />
      <polyline points={open.join(' ')} fill="none" stroke={TOKEN.good} strokeWidth={2} strokeDasharray="5 4" opacity={0.7} />
      <polyline points={closed.join(' ')} fill="none" stroke={sel('mantle') ? TOKEN.accent : TOKEN.good} strokeWidth={6} strokeLinecap="round" {...partProps('mantle', link)}>
        <title>{names.swing}</title>
      </polyline>
      <WedgeMarks w={w} />
      {/* the fixed plate is selected on a handle on it, clear of the wedge and the labels that cross the plate */}
      <g {...partProps('concave', link)}>
        <title>{names.fixed}</title>
        <circle cx={sx(j.xFixed(zTop * 0.8))} cy={sy(zTop * 0.8)} r={9} fill="transparent" />
        <circle cx={sx(j.xFixed(zTop * 0.8))} cy={sy(zTop * 0.8)} r={4} fill={sel('concave') ? TOKEN.accent : TOKEN.subtle} />
      </g>
      <circle cx={sx(j.xSwing(zTop, 0))} cy={yTop} r={6} fill="none" stroke={TOKEN.warn} strokeWidth={2} />
      <g {...partProps('feed', link)}>
        <title>{lang === 'es' ? 'alimentación' : 'feed'}</title>
        <polygon points={`${(sx(j.xSwing(zTop, 0)) + sx(j.xFixed(zTop))) / 2 - 5},${yTop - 4} ${(sx(j.xSwing(zTop, 0)) + sx(j.xFixed(zTop))) / 2 + 5},${yTop - 4} ${(sx(j.xSwing(zTop, 0)) + sx(j.xFixed(zTop))) / 2},${yTop + 4}`} fill={sel('feed') ? TOKEN.accent : TOKEN.fg} />
      </g>
      <g {...partProps('gap', link)}>
        <line x1={sx(j.xSwing(0, 0))} y1={yDischarge} x2={sx(j.xFixed(0))} y2={yDischarge} stroke="transparent" strokeWidth={12} />
        <line x1={sx(j.xSwing(0, 0))} y1={yDischarge} x2={sx(j.xFixed(0))} y2={yDischarge} stroke={sel('gap') ? TOKEN.accent : TOKEN.warn} strokeWidth={2.5} />
      </g>
      <line x1={sx(j.xSwing(0, 1))} y1={yDischarge + 4} x2={sx(j.xFixed(0))} y2={yDischarge + 4} stroke={TOKEN.faint} strokeWidth={2} strokeDasharray="3 2" />
      <LabelText items={labels} />
    </svg>
  );
  return { node, subjects };
}

/** The operating point the drawing stands for: the hours cursor of the campaign opens the setting by the reader's drift rate. */
export function opAtHours(op: Operating, hours: number | null, drift: number | null): { op: Operating; hours: number | null } {
  if (hours === null || !(hours > 0) || drift === null || !(drift > 0)) return { op, hours: null };
  return { op: { ...op, cssMm: op.cssMm + drift * hours }, hours };
}

/** The three callouts of the section: the closed-side setting, the nip angle against its grip limit, and the throw at the speed. */
export function sectionCallouts(op: Operating, nip: number, limit: number, hours: number | null, caseId: string, num: Num, selectedPart: string | null = null): CalloutSpec[] {
  const source: Text =
    hours !== null
      ? { en: `Live engine, ${caseId}, after ${num(hours, { digits: 3 })} h at your drift rate`, es: `Motor en vivo, ${caseId}, tras ${num(hours, { digits: 3 })} h a su velocidad` }
      : { en: `Live engine at the rail's values, ${caseId}`, es: `Motor en vivo con los valores del panel, ${caseId}` };
  const picked = selectedPart && selectedPart in PART_CALLOUT ? PART_CALLOUT[selectedPart as ChamberPart] : null;
  const calls: CalloutSpec[] = [
    { id: 'css', eyebrow: { en: 'CSS', es: 'ABERTURA' }, value: num(op.cssMm, { digits: 3 }), unit: { en: 'mm', es: 'mm' }, state: hours !== null ? 'warning' : 'normal', source, trend: hours !== null ? 'up' : undefined },
    {
      id: 'nip',
      eyebrow: { en: 'NIP ANGLE', es: 'NIP' },
      value: num(nip, { decimals: 1 }),
      unit: { en: '°', es: '°' },
      state: nip <= limit ? 'normal' : 'alarm',
      source: { en: `Grip limit ${num(limit, { decimals: 2 })}° = 2 arctan 0.35`, es: `Límite de agarre ${num(limit, { decimals: 2 })}° = 2 arctan 0,35` },
    },
    // the speed is in the source: an eyebrow and a value share one row of a fixed-width card, so the eyebrow stays short (M2)
    {
      id: 'throw',
      eyebrow: { en: 'THROW', es: 'CARRERA' },
      value: num(op.throwMm, { digits: 3 }),
      unit: { en: 'mm', es: 'mm' },
      state: 'normal',
      source:
        hours !== null
          ? { en: `At ${num(op.speedRpm, { digits: 3 })} rpm; ${source.en}`, es: `A ${num(op.speedRpm, { digits: 3 })} rpm; ${source.es}` }
          : { en: `At ${num(op.speedRpm, { digits: 3 })} rpm, live engine, ${caseId}`, es: `A ${num(op.speedRpm, { digits: 3 })} rpm, motor en vivo, ${caseId}` },
    },
  ];
  return calls.map((c) => (c.id === picked ? { ...c, state: 'selected' } : c));
}

/** The section with its callouts: the drawing a story step and the App's chamber view share. */
export function SectionDrawing({ op, hours, caseId }: { op: Operating; hours: number | null; caseId: string }) {
  const lang = useShellLang();
  const num = useNum();
  const r = evaluate(op);
  const { selectedId, select } = useLinkedSelection();
  const part = selectedOf(selectedId, 'part');
  const link: PartLink = { selected: part, select: (p) => select(linkedId('part', p), 'panel') };
  const callouts = sectionCallouts(op, r.nipAngleDeg, r.nipLimitDeg, hours, caseId, num, part);
  const isRevolution = machineGeom(op.machine).isRevolution;
  return (
    <CalloutStage
      label={{ en: 'Chamber cross-section', es: 'Corte de la cámara' }}
      callouts={callouts}
      draw={({ width, height }) =>
        isRevolution ? revolutionSlice(op, width, height, lang, num, link, r.nipAngleDeg, r.nipLimitDeg) : jawSlice(op, width, height, lang, num, link, r.nipAngleDeg, r.nipLimitDeg)
      }
    />
  );
}

/** The wedge between the mantle and the concave with a particle in it, and the nip angle against the grip limit. */
function NipWedge({ nip, limit, width, height }: { nip: number; limit: number; width: number; height: number }) {
  const lang = useShellLang();
  const num = useNum();
  const gripped = nip <= limit;
  const half = (Math.min(Math.max(nip, 1), 80) / 2) * (Math.PI / 180);
  const cx = width / 2;
  // the apex sits high enough to write the angle under it, clear of the particle's arrow, which crosses the arc at some sizes
  const base = height - 34;
  const len = Math.max(40, Math.min(height - 40, width / (2 * Math.sin(half) + 0.4)));
  const lx = cx - Math.sin(half) * len;
  const rx = cx + Math.sin(half) * len;
  const ty = base - Math.cos(half) * len;
  const pr = Math.max(8, Math.min(24, len * 0.12));
  const py = base - len * 0.52;
  const arc = Math.max(18, len * 0.22);
  const tone = gripped ? TOKEN.good : TOKEN.bad;
  const dir = gripped ? 1 : -1;
  const L = new Labels(width, height);
  const labels = [
    L.place(`${num(nip, { decimals: 1 })}°`, cx, base + 22, 'middle', { fill: TOKEN.warn, weight: 700 }),
    L.place(lang === 'es' ? 'cóncavo' : 'concave', lx, ty - 6, 'end', { fill: TOKEN.subtle }),
    L.place(lang === 'es' ? 'manto' : 'mantle', rx, ty - 6, 'start', { fill: TOKEN.good }),
  ];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={lang === 'es' ? 'Ángulo de nip entre el manto y el cóncavo' : 'Nip angle between the mantle and the concave'} data-chart="nip-wedge">
      <line x1={cx} y1={base} x2={lx} y2={ty} stroke={TOKEN.subtle} strokeWidth={3} />
      <line x1={cx} y1={base} x2={rx} y2={ty} stroke={TOKEN.good} strokeWidth={3} />
      <circle cx={cx} cy={py} r={pr} fill={gripped ? TOKEN.goodSoft : TOKEN.badSoft} stroke={tone} strokeWidth={2} />
      <path d={`M${cx - arc * Math.sin(half)},${base - arc * Math.cos(half)} A${arc},${arc} 0 0 0 ${cx + arc * Math.sin(half)},${base - arc * Math.cos(half)}`} fill="none" stroke={TOKEN.warn} strokeWidth={2} />
      <line x1={cx} y1={py} x2={cx} y2={py + dir * (pr + 14)} stroke={tone} strokeWidth={2} />
      <polygon points={`${cx - 5},${py + dir * (pr + 8)} ${cx + 5},${py + dir * (pr + 8)} ${cx},${py + dir * (pr + 16)}`} fill={tone} />
      <LabelText items={labels} />
    </svg>
  );
}

function SliceView() {
  const { sel, drift } = useView();
  const { hours } = useHours();
  const stateKey = useWorkbenchState()?.stateKey;
  if (!sel) return <Pending />;
  const at = opAtHours(sel.op, hours, drift);
  const r = at.hours === null ? sel.result : evaluate(at.op);
  const g: GeometryRow = { css: at.op.cssMm, throwMm: at.op.throwMm, oss: r.ossMm, nip: r.nipAngleDeg, limit: r.nipLimitDeg };
  return (
    <PlotCard fill title={{ en: 'Chamber cross-section', es: 'Corte de la cámara' }} lane="live" provenance="synthetic" dataKey={stateKey} note={STRUCTURE_NOTE}>
      <Stack>
        <GeometryTable g={g} />
        <div className="cdem-fill cdem-fill-tall">
          <SectionDrawing op={at.op} hours={at.hours} caseId={sel.data.manifest.case_id} />
        </div>
      </Stack>
    </PlotCard>
  );
}

function NipView() {
  const { sel } = useView();
  const stateKey = useWorkbenchState()?.stateKey;
  if (!sel) return <Pending />;
  const r = sel.result;
  const g: GeometryRow = { css: sel.op.cssMm, throwMm: sel.op.throwMm, oss: r.ossMm, nip: r.nipAngleDeg, limit: r.nipLimitDeg };
  return (
    <PlotCard
      fill
      title={{ en: 'Nip angle against the grip limit', es: 'Ángulo de nip contra el límite de agarre' }}
      lane="live"
      provenance="synthetic"
      dataKey={stateKey}
      note={{
        en: 'A particle is gripped when the nip angle is at most 2 arctan(mu), with mu about 0.35; above it the particle is squeezed upward. The wedge is drawn at the engine’s nip angle.',
        es: 'Una partícula es agarrada cuando el ángulo de nip es como máximo 2 arctan(mu), con mu cercano a 0,35; sobre ese límite la partícula es escupida hacia arriba. La cuña se dibuja con el ángulo de nip del motor.',
      }}
    >
      <Stack>
        <GeometryTable g={g} />
        <Fill>
          <Stage label={{ en: 'Nip wedge', es: 'Cuña de nip' }}>{({ width, height }) => <NipWedge nip={r.nipAngleDeg} limit={r.nipLimitDeg} width={width} height={height} />}</Stage>
        </Fill>
      </Stack>
    </PlotCard>
  );
}

// three.js is about half of the App's code: the 3D view is fetched only when its sub-view opens, so the workbench chunk
// stays under 500 KB and a reader who never opens it never downloads it.
const ChamberView = lazy(() => import('./chamber3d').then((m) => ({ default: m.ChamberView })));

/** The 3D chamber (unit U2b-2): a kinematic view of the selected case's chamber, driven by the live engine's values; the hours cursor of
 * the campaign opens its setting by the reader's drift rate. */
function Chamber3DView() {
  const { sel, drift } = useView();
  const { hours } = useHours();
  if (!sel) return <Pending />;
  const at = opAtHours(sel.op, hours, drift);
  const r = at.hours === null ? sel.result : evaluate(at.op);
  return (
    <Suspense fallback={<Pending />}>
      <ChamberView
        op={at.op}
        p80Mm={r.p80}
        f80Mm={r.f80}
        provenance={provenanceOf(sel)}
        note={at.hours === null ? undefined : { en: `Drawn after ${formatNumber(at.hours, 'en', { digits: 3 })} h at your drift rate.`, es: `Dibujada tras ${formatNumber(at.hours, 'es', { digits: 3 })} h a su velocidad.` }}
      />
    </Suspense>
  );
}

/** Catalog row V2, the key component: the 3D chamber cutaway beside the 2D section that carries its callouts. */
function ComponentView() {
  return (
    <ViewsRow shares={[3, 2]}>
      <Chamber3DView />
      <SliceView />
    </ViewsRow>
  );
}

/** The System group: the circuit (V1) first, then the chamber (V2) and the nip angle. */
export function SystemGroup() {
  const { pickCase } = useView();
  const tabs: Sub[] = [
    { id: 'circuit', label: { en: 'Circuit', es: 'Circuito' }, content: <CircuitView onPickCase={pickCase} /> },
    { id: 'chamber', label: { en: 'Chamber', es: 'Cámara' }, content: <ComponentView /> },
    { id: 'nip', label: { en: 'Nip angle', es: 'Ángulo de nip' }, content: <NipView /> },
  ];
  return <GroupFrame group="system" ariaLabel={{ en: 'System views', es: 'Vistas del sistema' }} tabs={tabs} />;
}

/** The section's drawing and its subjects at a size, for a machine of either kind (what SectionDrawing draws; exported for its tests). */
export function drawSection(op: Operating, width: number, height: number, lang: 'en' | 'es', num: Num, link: PartLink, nipDeg: number, limitDeg: number): { node: ReactNode; subjects: Subject[] } {
  return machineGeom(op.machine).isRevolution ? revolutionSlice(op, width, height, lang, num, link, nipDeg, limitDeg) : jawSlice(op, width, height, lang, num, link, nipDeg, limitDeg);
}
