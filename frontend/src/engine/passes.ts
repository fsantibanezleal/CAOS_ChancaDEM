// The Whiten solve as its Neumann series (the population-balance view, catalog row V5). The engine solves (I - B C) x = f by LU and
// takes p = (I - C) x (whiten.ts). Because B is strictly lower triangular (the breakage gate of the method ladder), B C has a zero
// diagonal and is nilpotent: (B C)^n = 0 for n size classes, so x = sum_{k<n} (B C)^k f exactly, and the product after k passes is
// p_k = (I - C) sum_{j<k} (B C)^j f. Pass j presents v_j = (B C)^j f to the chamber: C v_j is nipped and broken (its progeny is
// B C v_j = v_{j+1}, presented again) and (I - C) v_j escapes as product. Nothing here changes a number of the engine: the matrices
// are read out with the same calls evaluate() makes, in the same order, and the closed form is the engine's own LU solve.
import { breakageMatrix, phiFromT10, specificEnergy, t10Calibrated, t10Of } from './breakage';
import { classificationParams, classify } from './classification';
import { gridEdges, gridMid } from './engine';
import { makeFeed } from './feed';
import { solveLU } from './linalg';
import { REF_THROW_MM } from './machines';
import { sizeAtPassing } from './sieve';
import type { Operating } from './types';

/** The three operands of the Whiten solve at an operating point, read out exactly as evaluate() builds them. */
export interface WhitenMatrices {
  /** Number of size classes. */
  n: number;
  /** Sieve edges, coarse to fine [mm] (n + 1 values). */
  edgesMm: number[];
  /** Class mid-sizes [mm]. */
  midMm: number[];
  /** Classification: the probability that a particle of each class is nipped and broken. */
  c: number[];
  /** Breakage matrix, row-major n by n, strictly lower triangular. */
  B: Float64Array;
  /** Feed mass per class (sums to 1). */
  f: number[];
}

/** The matrices of the engine's solve at `op` (the same feed, classification, t10 and appearance function as evaluate()). */
export function whitenMatrices(op: Operating): WhitenMatrices {
  const edgesMm = gridEdges();
  const midMm = gridMid();
  const feed = makeFeed(edgesMm, op.feedX63Mm, op.feedM);
  const f80 = sizeAtPassing(feed, 0.8);
  const cparams = classificationParams(op.machine, op.cssMm, { f80Mm: f80, calibrated: op.calibrated, throwMm: op.throwMm });
  const c = midMm.map((d) => classify(d, cparams));
  const ecs = specificEnergy(op.speedRpm, REF_THROW_MM[op.machine]);
  const t10 = op.calibrated ? t10Calibrated(op.cssMm, f80) : t10Of(ecs, op.oreAxb);
  const B = breakageMatrix(edgesMm, midMm, phiFromT10(t10));
  return { n: midMm.length, edgesMm, midMm, c, B, f: [...feed.mass] };
}

/** (B C) v for a vector v: (B C)[i][j] = B[i][j] c[j]. */
function applyBC(m: WhitenMatrices, v: readonly number[]): number[] {
  const { n, B, c } = m;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < i; j++) s += B[i * n + j] * c[j] * v[j];
    out[i] = s;
  }
  return out;
}

/** The closed form p = (I - C)(I - B C)^-1 f by the engine's LU solve, before the engine clips and renormalises it for display. */
export function closedFormProduct(m: WhitenMatrices): number[] {
  const { n, B, c, f } = m;
  const M = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) M[i * n + j] = (i === j ? 1 : 0) - B[i * n + j] * c[j];
  const x = solveLU(M, Float64Array.from(f), n);
  return Array.from(x, (xi, i) => (1 - c[i]) * xi);
}

export interface PassSeries {
  /** Number of size classes: the series is exact after this many passes. */
  n: number;
  /** p_k for k = 0 .. passes (p_0 = 0): the product mass per class after k passes. */
  product: number[][];
  /** The closed-form product mass per class. */
  closed: number[];
  /** The L1 distance between p_k and the closed form, for k = 0 .. passes [mass fraction of the feed]. */
  residual: number[];
  /** C v_k for k = 0 .. passes: the mass per class nipped at pass k and sent back, broken, to be presented again. */
  sentBack: number[][];
  /** v_k summed: the share of the feed still in the chamber when pass k starts. */
  inChamber: number[];
}

/** The Neumann series of the solve from pass 0 to `passes` (default: the number of size classes, where it is exact). */
export function neumannPasses(m: WhitenMatrices, passes = m.n): PassSeries {
  const { n, c } = m;
  const closed = closedFormProduct(m);
  const product: number[][] = [new Array<number>(n).fill(0)];
  const sentBack: number[][] = [];
  const inChamber: number[] = [];
  let v = [...m.f];
  let acc = new Array<number>(n).fill(0);
  for (let k = 0; k < passes; k++) {
    inChamber.push(v.reduce((s, x) => s + x, 0));
    sentBack.push(v.map((x, i) => c[i] * x));
    acc = acc.map((a, i) => a + (1 - c[i]) * v[i]);
    product.push(acc);
    v = applyBC(m, v);
  }
  inChamber.push(v.reduce((s, x) => s + x, 0));
  sentBack.push(v.map((x, i) => c[i] * x));
  const residual = product.map((p) => p.reduce((s, x, i) => s + Math.abs(x - closed[i]), 0));
  return { n, product, closed, residual, sentBack, inChamber };
}

/** The first pass count whose residual is below `tol`, or null when none of the computed passes reaches it. */
export function passesToResidual(series: PassSeries, tol: number): number | null {
  const k = series.residual.findIndex((r) => r < tol);
  return k < 0 ? null : k;
}

/**
 * The cumulative passing of a product after some passes, on the sieve edges (coarse to fine), as a share of the closed-form product's
 * mass: at the last pass it is the engine's product curve; before it, the curve of what has already left the chamber, below it.
 */
export function passingOf(mass: readonly number[], closed: readonly number[]): number[] {
  const total = closed.reduce((s, x) => s + Math.max(0, x), 0) || 1;
  const k = mass.length;
  const out = new Array<number>(k + 1).fill(0);
  let acc = 0;
  for (let i = k - 1; i >= 0; i--) {
    acc += Math.max(0, mass[i]);
    out[i] = acc / total;
  }
  out[k] = 0;
  return out;
}
