// Small pure helpers over the arrays the charts take. The engine's sieve grid runs coarse to fine; a chart reads left to right.
import { type ChartSeries } from '@fasl-work/caos-app-shell/chart';

/** A copy of an array in the opposite order (the sieve grid is coarse to fine, an axis is fine to coarse). */
export const asc = <T,>(a: readonly T[]): T[] => [...a].reverse();

/** A value a chart can draw, or null (a gap): an invalid point must show as a gap, never as NaN. */
export const fin = (v: number): number | null => (Number.isFinite(v) ? v : null);
export const finAll = (a: readonly number[]): (number | null)[] => a.map(fin);

/** `count` values spaced evenly on a log scale from `lo` to `hi`, both included. */
export function logSpace(lo: number, hi: number, count: number): number[] {
  const a = Math.log10(lo);
  const b = Math.log10(hi);
  return Array.from({ length: count }, (_, i) => 10 ** (a + ((b - a) * i) / (count - 1)));
}

/** `count` values spaced evenly from `lo` to `hi`, both included. */
export const linSpace = (lo: number, hi: number, count: number): number[] => Array.from({ length: count }, (_, i) => lo + ((hi - lo) * i) / (count - 1));

/** The largest finite value of the arrays, or `fallback` when there is none. */
export function maxOf(arrays: readonly (readonly number[])[], fallback = 1): number {
  const all = arrays.flat().filter(Number.isFinite);
  return all.length ? Math.max(...all) : fallback;
}

/** The series styles of the App: one meaning per colour. Live solid, replay dashed. */
export const LIVE_COLOR: NonNullable<ChartSeries['color']> = '--color-accent';
export const REPLAY_COLOR: NonNullable<ChartSeries['color']> = '--color-warn';
export const FEED_COLOR: NonNullable<ChartSeries['color']> = '--color-fg-subtle';
export const REPLAY_DASH = [6, 4];
