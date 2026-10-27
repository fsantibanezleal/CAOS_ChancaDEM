// The small parts of a drawing of the App's own (the chamber, the nip wedge): the colour tokens an SVG attribute can name, the
// frame that stacks a table above a drawing, and the label placer that keeps every label inside its drawing and off every other
// label (the gate's G10 measures that on the built page, in the page font and in the wide fallback font). The text is measured
// with the shell's text kit, never by a count of characters.
import { textWidth } from '@fasl-work/caos-app-shell';
import type { ReactNode } from 'react';

/** The shell's colour tokens as values an SVG attribute takes: a drawing follows the theme because it names tokens, never hex. */
export const TOKEN = {
  fg: 'var(--color-fg)',
  subtle: 'var(--color-fg-subtle)',
  faint: 'var(--color-fg-faint)',
  surface: 'var(--color-surface)',
  border: 'var(--color-border)',
  accent: 'var(--color-accent)',
  good: 'var(--color-good)',
  warn: 'var(--color-warn)',
  bad: 'var(--color-bad)',
  goodSoft: 'color-mix(in oklab, var(--color-good) 28%, transparent)',
  badSoft: 'color-mix(in oklab, var(--color-bad) 28%, transparent)',
  subtleSoft: 'color-mix(in oklab, var(--color-fg-subtle) 10%, transparent)',
} as const;

export const FONT_PX = 11;
const LINE = FONT_PX + 3;

/** A table above a drawing in one card: the drawing takes what the table leaves; below 900 px the stack takes the height it needs. */
export function Stack({ children }: { children: ReactNode }) {
  return (
    <div className="cdem-stack" data-caos-flow="">
      {children}
    </div>
  );
}

/** The area under a table that a chart or a `Stage` fills. */
export function Fill({ children }: { children: ReactNode }) {
  return <div className="cdem-fill">{children}</div>;
}

export interface Placed {
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  fill: string;
  weight?: number;
}

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * Places the labels of one drawing, one by one: each is kept inside the drawing's box, and moves a line up or down (alternately,
 * to the least distance) until it overlaps no label placed before it. The first labels placed keep their place, so the order of the
 * calls is the order of importance.
 */
export class Labels {
  private boxes: Box[] = [];
  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly margin = 4,
  ) {}

  place(text: string, x: number, y: number, anchor: Placed['anchor'] = 'middle', style: { fill?: string; weight?: number } = {}): Placed {
    const px = FONT_PX;
    const w = textWidth(text, px);
    const x0For = (cx: number) => (anchor === 'start' ? cx : anchor === 'end' ? cx - w : cx - w / 2);
    const lo = this.margin;
    const hi = Math.max(lo, this.width - this.margin - w);
    let x0 = Math.min(hi, Math.max(lo, x0For(x)));
    const ax = anchor === 'start' ? x0 : anchor === 'end' ? x0 + w : x0 + w / 2;
    const top = (cy: number) => cy - px;
    const fits = (cy: number) => !this.boxes.some((b) => x0 < b.x1 + 2 && x0 + w > b.x0 - 2 && top(cy) < b.y1 + 1 && cy + 3 > b.y0 - 1);
    const clampY = (cy: number) => Math.min(this.height - this.margin - 3, Math.max(this.margin + px, cy));
    let cy = clampY(y);
    for (let k = 1; k <= 12 && !fits(cy); k++) {
      const step = Math.ceil(k / 2) * LINE * (k % 2 ? -1 : 1);
      const trial = clampY(y + step);
      if (fits(trial)) {
        cy = trial;
        break;
      }
    }
    x0 = Math.max(lo, x0);
    this.boxes.push({ x0, x1: x0 + w, y0: top(cy), y1: cy + 3 });
    return { text, x: ax, y: cy, anchor, fill: style.fill ?? TOKEN.fg, weight: style.weight };
  }
}

/** The text elements of placed labels. */
export function LabelText({ items }: { items: Placed[] }) {
  return (
    <>
      {items.map((p) => (
        <text key={`${p.text}-${p.x}-${p.y}`} x={p.x} y={p.y} textAnchor={p.anchor} fill={p.fill} fontSize={FONT_PX} fontWeight={p.weight} style={{ fontFamily: 'var(--font-sans)' }}>
          {p.text}
        </text>
      ))}
    </>
  );
}
