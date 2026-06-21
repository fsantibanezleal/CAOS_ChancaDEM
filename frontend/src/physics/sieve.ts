// The geometric sieve grid (√2 series, the standard lab sieve progression) and PSD utilities. Sizes are in mm,
// classes are ordered COARSE → FINE (descending edges) to match the strictly-lower-triangular breakage matrix
// (progeny is always finer → lower class index appears LATER, so B is lower-triangular in this ordering).

import type { PSD } from './types';

/** Build a descending geometric sieve grid from `top` mm down by ratio √2 for `k` classes (k+1 edges). */
export function makeGrid(topMm = 256, k = 28, ratio = Math.SQRT2): number[] {
  const edges: number[] = [];
  let v = topMm;
  for (let i = 0; i <= k; i++) { edges.push(v); v /= ratio; }
  return edges;                    // length k+1, descending
}

/** Geometric mid-size of each class from its edges. */
export function midSizes(edges: number[]): number[] {
  const mid: number[] = [];
  for (let i = 0; i < edges.length - 1; i++) mid.push(Math.sqrt(edges[i] * edges[i + 1]));
  return mid;
}

/** Cumulative %-passing at each edge from per-class mass (mass[i] belongs to class between edge i and i+1). */
export function cumulativePassing(_edges: number[], mass: number[]): number[] {
  const k = mass.length;
  const passing = new Array(k + 1).fill(0);
  // passing at the finest edge (bottom) is 0; passing at edge i = fraction finer than edge i = Σ mass below i
  let acc = 0;
  for (let i = k - 1; i >= 0; i--) { acc += mass[i]; passing[i] = acc; }
  passing[k] = 0;
  // normalize defensively
  const tot = passing[0] || 1;
  for (let i = 0; i <= k; i++) passing[i] /= tot;
  return passing;
}

/** Assemble a PSD object from a grid + per-class mass (renormalized to Σ=1). */
export function toPSD(edges: number[], mass: number[]): PSD {
  const tot = mass.reduce((a, b) => a + b, 0) || 1;
  const norm = mass.map((m) => m / tot);
  return { edgesMm: edges, midMm: midSizes(edges), mass: norm, passing: cumulativePassing(edges, norm) };
}

/** Size at a given cumulative passing fraction (e.g. 0.8 → P80), log-interpolated on the passing curve. */
export function sizeAtPassing(psd: PSD, frac: number): number {
  const { edgesMm: e, passing: p } = psd;
  // passing is descending in index (coarse edge has highest passing). Find the bracket where p crosses frac.
  for (let i = 0; i < p.length - 1; i++) {
    const hi = p[i], lo = p[i + 1];
    if (frac <= hi && frac >= lo) {
      if (hi === lo) return e[i];
      // log-linear interpolation in size between edges e[i] (passing hi) and e[i+1] (passing lo)
      const t = (frac - lo) / (hi - lo);
      return Math.exp(Math.log(e[i + 1]) + t * (Math.log(e[i]) - Math.log(e[i + 1])));
    }
  }
  return frac > p[0] ? e[0] : e[e.length - 1];
}

/** Linear-interpolated %-passing at an arbitrary size [mm] (for the {1,4,8,16,32}mm readouts). */
export function passingAtSize(psd: PSD, sizeMm: number): number {
  const { edgesMm: e, passing: p } = psd;
  if (sizeMm >= e[0]) return 1;
  if (sizeMm <= e[e.length - 1]) return 0;
  for (let i = 0; i < e.length - 1; i++) {
    const hiE = e[i], loE = e[i + 1];
    if (sizeMm <= hiE && sizeMm >= loE) {
      const t = (Math.log(sizeMm) - Math.log(loE)) / (Math.log(hiE) - Math.log(loE));
      return p[i + 1] + t * (p[i] - p[i + 1]);
    }
  }
  return 0;
}
