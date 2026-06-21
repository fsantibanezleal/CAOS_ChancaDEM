// The Whiten crusher solve. The chamber is one breakage zone with classification C (which particles are
// nipped) and breakage B (how the nipped ones distribute to finer sizes). The internal balance x = f + B·C·x
// gives the product p = (I − C)·x = (I − C)·(I − B·C)⁻¹·f  — note (I − C) sits on the LEFT of the inverse
// (Whiten 1972; Napier-Munn et al. 1996). We never form the inverse: we LU-solve (I − B·C)·x = f, then apply
// (I − C). Because B is strictly lower-triangular, B·C has a zero diagonal so (I − B·C) is unit-diagonal and
// always non-singular; we still keep a conditioning guard for the near-choke C→1 regime.

import { solveLU, condProxy } from './linalg';

export interface WhitenOut { product: number[]; massClosure: number; cond: number; }

/** Solve the Whiten model. c = classification per class (length n), B = strictly-lower-triangular breakage
 *  matrix (row-major n·n), f = feed mass per class (length n, Σ=1). Returns product mass per class. */
export function whitenSolve(c: number[], B: Float64Array, f: number[], n: number): WhitenOut {
  // M = I − B·C ; C diagonal ⇒ (B·C)[i][j] = B[i][j]·c[j]
  const M = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) M[i * n + j] = (i === j ? 1 : 0) - B[i * n + j] * c[j];
  }
  const cond = condProxy(M, n);
  const fv = Float64Array.from(f);
  let x: Float64Array;
  try {
    x = solveLU(M, fv, n);
  } catch {
    // singular (should not happen with strictly-lower B): fall back to feed unchanged so the UI flags it
    return { product: Array.from(f), massClosure: 0, cond: Infinity };
  }
  // p = (I − C)·x
  const product = new Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) { const v = Math.max(0, (1 - c[i]) * x[i]); product[i] = v; sum += v; }
  const feedSum = f.reduce((a, b) => a + b, 0);
  // The model conserves mass exactly in exact arithmetic; report the residual before renormalizing for display.
  const closure = Math.abs(sum - feedSum);
  if (sum > 0) for (let i = 0; i < n; i++) product[i] /= sum;   // renormalize to a clean PSD (Σ=1)
  return { product, massClosure: closure, cond };
}
