// A small plotting frame for the Methodology figures: a hand-authored SVG with linear or logarithmic axes, line series,
// vertical and horizontal marks, one shaded band and a key under the plot. Every colour is a shell token (never a hex
// value), so the figure follows the light and dark themes; every label is written by the caller in the displayed
// language; the drawing scales to its container through the viewBox (the `fig-svg wide` class), never a viewport height.
import { useFormat } from '@fasl-work/caos-app-shell';

export type Pt = [number, number];

export interface Series {
  name: string;
  pts: Pt[];
  color: string;
  dash?: string;
}
export interface VMark {
  x: number;
  label: string;
  color?: string;
  /** Row of the label under the top of the plot (0 is the first row). */
  row?: number;
  /** Which side of the line the label sits on. */
  side?: 'left' | 'right';
}
export interface HMark {
  y: number;
  label: string;
  color?: string;
  side?: 'left' | 'right';
}
export interface Band {
  x0: number;
  x1: number;
  label: string;
}

const W = 640;
const H = 330;
const L = 70;
const R = 624;
const T = 16;
const B = 238;

export const TOKENS = {
  accent: 'var(--color-accent)',
  accent2: 'var(--color-accent-2)',
  magenta: 'var(--color-magenta)',
  good: 'var(--color-good)',
  warn: 'var(--color-warn)',
  bad: 'var(--color-bad)',
  fg: 'var(--color-fg)',
  sub: 'var(--color-fg-subtle)',
  faint: 'var(--color-fg-faint)',
  border: 'var(--color-border)',
  surface: 'var(--color-surface-2)',
};

interface PlotProps {
  label: string;
  xLabel: string;
  yLabel: string;
  xr: [number, number];
  yr: [number, number];
  xlog?: boolean;
  xticks: number[];
  yticks: number[];
  xDecimals?: number;
  yDecimals?: number;
  series: Series[];
  vmarks?: VMark[];
  hmarks?: HMark[];
  band?: Band;
}

export function Plot({ label, xLabel, yLabel, xr, yr, xlog, xticks, yticks, xDecimals, yDecimals, series, vmarks = [], hmarks = [], band }: PlotProps) {
  const f = useFormat();
  const sx = (x: number) => {
    const t = xlog ? (Math.log(x) - Math.log(xr[0])) / (Math.log(xr[1]) - Math.log(xr[0])) : (x - xr[0]) / (xr[1] - xr[0]);
    return L + Math.max(0, Math.min(1, t)) * (R - L);
  };
  const sy = (y: number) => B - ((y - yr[0]) / (yr[1] - yr[0])) * (B - T);
  const tick = (v: number, d?: number) => f(v, d === undefined ? { digits: 3 } : { decimals: d });
  const path = (pts: Pt[]) => pts.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)).map(([x, y], i) => `${i ? 'L' : 'M'} ${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join(' ');
  // The key: items in a row under the axis title, spaced by an estimate of their width (wide enough for the fallback font).
  let kx = L;
  const keys = series.map((s) => {
    const x = kx;
    kx += 40 + s.name.length * 7.6;
    return { x, s };
  });
  return (
    <svg className="fig-svg wide" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} data-chart="methodology-figure">
      <rect x={L} y={T} width={R - L} height={B - T} fill="var(--color-surface)" stroke="var(--color-border)" />
      {band && (
        <g>
          <rect x={sx(band.x0)} y={T} width={sx(band.x1) - sx(band.x0)} height={B - T} fill="var(--color-accent-soft)" />
          <text x={sx(band.x0) + 6} y={B - 8} fontSize="12" fill="var(--color-fg-subtle)">{band.label}</text>
        </g>
      )}
      {yticks.map((v) => (
        <g key={`y${v}`}>
          <line x1={L} x2={R} y1={sy(v)} y2={sy(v)} stroke="var(--color-border)" strokeDasharray="2 4" />
          <text x={L - 8} y={sy(v) + 4} fontSize="12" textAnchor="end" fill="var(--color-fg-subtle)">{tick(v, yDecimals)}</text>
        </g>
      ))}
      {xticks.map((v) => (
        <g key={`x${v}`}>
          <line x1={sx(v)} x2={sx(v)} y1={B} y2={B + 5} stroke="var(--color-fg-faint)" />
          <text x={sx(v)} y={B + 20} fontSize="12" textAnchor="middle" fill="var(--color-fg-subtle)">{tick(v, xDecimals)}</text>
        </g>
      ))}
      <text x={(L + R) / 2} y={B + 42} fontSize="13" textAnchor="middle" fill="var(--color-fg)">{xLabel}</text>
      <text x={14} y={(T + B) / 2} fontSize="13" textAnchor="middle" fill="var(--color-fg)" transform={`rotate(-90 14 ${(T + B) / 2})`}>{yLabel}</text>
      {hmarks.map((m, i) => (
        <g key={`h${i}`}>
          <line x1={L} x2={R} y1={sy(m.y)} y2={sy(m.y)} stroke={m.color ?? TOKENS.warn} strokeDasharray="6 4" strokeWidth="1.4" />
          <text x={m.side === 'left' ? L + 6 : R - 6} y={sy(m.y) - 5} fontSize="12" textAnchor={m.side === 'left' ? 'start' : 'end'} fill={m.color ?? TOKENS.warn}>{m.label}</text>
        </g>
      ))}
      {vmarks.map((m, i) => {
        const x = sx(m.x);
        const right = (m.side ?? (x > (L + R) / 2 ? 'left' : 'right')) === 'right';
        return (
          <g key={`v${i}`}>
            <line x1={x} x2={x} y1={T} y2={B} stroke={m.color ?? TOKENS.warn} strokeDasharray="6 4" strokeWidth="1.4" />
            <text x={right ? x + 5 : x - 5} y={T + 15 + (m.row ?? 0) * 16} fontSize="12" textAnchor={right ? 'start' : 'end'} fill={m.color ?? TOKENS.warn}>{m.label}</text>
          </g>
        );
      })}
      {series.map((s) => (
        <path key={s.name} d={path(s.pts)} fill="none" stroke={s.color} strokeWidth="2.4" strokeDasharray={s.dash} strokeLinejoin="round" />
      ))}
      {keys.map(({ x, s }) => (
        <g key={`k${s.name}`}>
          <line x1={x} x2={x + 26} y1={H - 14} y2={H - 14} stroke={s.color} strokeWidth="2.6" strokeDasharray={s.dash} />
          <text x={x + 32} y={H - 10} fontSize="12" fill="var(--color-fg-subtle)">{s.name}</text>
        </g>
      ))}
    </svg>
  );
}

/** A row of boxes joined by arrows, each box with a title and up to two detail lines (the network and fold diagrams). */
export interface Box {
  title: string;
  lines?: string[];
  tone?: string;
}
export function Chain({ label, boxes, arrows }: { label: string; boxes: Box[]; arrows?: string[] }) {
  const n = boxes.length;
  const gap = 50;
  const bw = (W - 20 - (n - 1) * gap) / n;
  return (
    <svg className="fig-svg wide" viewBox={`0 0 ${W} 170`} role="img" aria-label={label} data-chart="methodology-figure">
      {boxes.map((b, i) => {
        const x = 10 + i * (bw + gap);
        return (
          <g key={i}>
            <rect x={x} y={34} width={bw} height={92} rx={8} fill="var(--color-surface-2)" stroke="var(--color-border)" strokeWidth="1.5" />
            <rect x={x} y={34} width={6} height={92} rx={3} fill={b.tone ?? TOKENS.accent} />
            <text x={x + bw / 2 + 3} y={62} fontSize="18" fontWeight="700" textAnchor="middle" fill="var(--color-fg)">{b.title}</text>
            {(b.lines ?? []).map((ln, k) => (
              <text key={k} x={x + bw / 2 + 3} y={84 + k * 18} fontSize="12" textAnchor="middle" fill="var(--color-fg-subtle)">{ln}</text>
            ))}
            {i < n - 1 && (
              <g>
                <path d={`M ${x + bw + 4} 80 L ${x + bw + gap - 4} 80 M ${x + bw + gap - 11} 74 L ${x + bw + gap - 4} 80 L ${x + bw + gap - 11} 86`} fill="none" stroke="var(--color-fg-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {arrows?.[i] && <text x={x + bw + gap / 2} y={66} fontSize="11" textAnchor="middle" fill="var(--color-fg-subtle)">{arrows[i]}</text>}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
