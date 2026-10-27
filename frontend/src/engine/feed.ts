// Feed particle-size distribution generator. The Rosin–Rammler (Weibull) model is the standard description of
// crushed-rock feed: cumulative passing R(x) = 1 − exp[−(x / x63)^m], where x63 is the size at 63.2% passing
// and m is the uniformity exponent (higher m → more uniform). Reference: Rosin & Rammler 1933; Gaudin–Schuhmann
// is offered as the alternative power-law fit on the methodology page.

import { toPSD } from './sieve';
import type { PSD } from './types';

/** Rosin–Rammler cumulative fraction passing size x. */
export function rosinRammlerPassing(xMm: number, x63: number, m: number): number {
  if (xMm <= 0) return 0;
  return 1 - Math.exp(-Math.pow(xMm / x63, m));
}

/** The size (mm) at a cumulative passing fraction of the untruncated Rosin–Rammler law, the inverse of rosinRammlerPassing:
 *  x63 · (−ln(1 − fraction))^(1/m). It does not stop at the sieve top size: it is the F80 the feed declares. */
export function rosinRammlerSizeAt(fraction: number, x63: number, m: number): number {
  return x63 * Math.pow(-Math.log(1 - fraction), 1 / m);
}

/** Discretize a Rosin–Rammler feed onto a sieve grid → per-class mass (Σ=1). */
export function makeFeed(edges: number[], x63: number, m: number): PSD {
  const k = edges.length - 1;
  const mass = new Array(k).fill(0);
  for (let i = 0; i < k; i++) {
    // mass in class i = passing(upper edge) − passing(lower edge)
    const up = rosinRammlerPassing(edges[i], x63, m);
    const lo = rosinRammlerPassing(edges[i + 1], x63, m);
    mass[i] = Math.max(0, up - lo);
  }
  return toPSD(edges, mass);
}

/** Gaudin–Schuhmann passing (the alternative power-law fit, shown on /methodology): R(x)=(x/k)^a for x<k. */
export function gaudinSchuhmannPassing(xMm: number, kMm: number, a: number): number {
  if (xMm <= 0) return 0;
  if (xMm >= kMm) return 1;
  return Math.pow(xMm / kMm, a);
}
