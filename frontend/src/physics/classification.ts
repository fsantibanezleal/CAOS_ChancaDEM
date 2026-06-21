// The Whiten classification (selection) function C(d): the probability that a particle of size d entering the
// crusher chamber is captured (nipped) and broken rather than passing straight through. Whiten 1972; the
// K1/K2/K3 parameterization follows Andersen & Napier-Munn 1988 / Napier-Munn et al. (Mineral Comminution
// Circuits, JKMRC 1996):
//
//   C(d) = 0                                   for d ≤ K1   (smaller than the smallest gap → always escapes)
//   C(d) = 1 − ((K2 − d)/(K2 − K1))^K3         for K1 < d < K2
//   C(d) = 1                                   for d ≥ K2   (too large to escape → always broken)
//
// K1, K2 are LINEAR in the closed-side setting (CSS): a tighter setting captures smaller particles. The exact
// a0+a1·CSS slopes are machine-specific and require the open-access industrial-calibration data (Duarte et al.
// 2021, DOI 10.3390/min11111256) to fix; the literature-typical ranges used here are labelled provisional /
// illustrative in the UI and methodology — they reproduce the correct TRENDS (CSS↓ ⇒ finer product), not a
// specific plant's absolute numbers.

import type { Classification, Machine } from './types';

interface KModel { k1a: number; k1b: number; k2a: number; k2b: number; k3: number; }

// provisional literature-typical K-model per machine. K1 ≈ near-CSS (escape threshold); K2 ≈ a few × CSS
// (full-capture threshold); K3 (shape) ~2.3–3.0. Documented as illustrative pending plant calibration.
const KMODEL: Record<Machine, KModel> = {
  'cone-sec':        { k1a: 0.2, k1b: 0.90, k2a: 6.0, k2b: 1.95, k3: 2.3 },
  'cone-tert':       { k1a: 0.1, k1b: 0.85, k2a: 3.0, k2b: 1.75, k3: 2.5 },
  'cone-short-head': { k1a: 0.1, k1b: 0.82, k2a: 2.4, k2b: 1.65, k3: 2.7 }, // tighter classification (longer parallel zone)
  'gyratory':        { k1a: 0.6, k1b: 0.95, k2a: 10.0, k2b: 2.10, k3: 2.0 }, // coarse primary, OSS-controlled
  'jaw':             { k1a: 2.0, k1b: 0.95, k2a: 20.0, k2b: 2.30, k3: 2.1 },
};

/** Build K1,K2,K3 from machine + CSS (K1,K2 linear in CSS). */
export function classificationParams(machine: Machine, cssMm: number): Classification {
  const km = KMODEL[machine];
  const k1 = km.k1a + km.k1b * cssMm;
  const k2 = km.k2a + km.k2b * cssMm;
  return { k1, k2: Math.max(k2, k1 * 1.05), k3: km.k3 };
}

/** Classification probability for a particle of size d [mm]. Monotone non-decreasing in d, in [0,1]. */
export function classify(dMm: number, c: Classification): number {
  if (dMm <= c.k1) return 0;
  if (dMm >= c.k2) return 1;
  const r = (c.k2 - dMm) / (c.k2 - c.k1);
  return 1 - Math.pow(r, c.k3);
}
