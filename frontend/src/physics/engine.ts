// Top-level live engine: an Operating point → a full CrusherResult. This is the single source of physics truth
// the whole app reads, AND the ground-truth the offline LHS sweep samples to train the ONNX surrogate (so the
// surrogate honestly emulates THIS engine). Pure TypeScript, sub-millisecond — no Pyodide, no backend.

import { makeGrid, midSizes, toPSD, sizeAtPassing, passingAtSize } from './sieve';
import { makeFeed } from './feed';
import { classificationParams, classify } from './classification';
import { specificEnergy, t10Of, phiFromT10, breakageMatrix } from './breakage';
import { whitenSolve } from './whiten';
import { throughput, bondPower, nipAngle, nipLimit } from './capacity';
import type { Operating, CrusherResult, Regime } from './types';

const TOP_MM = 256;     // sieve top size [mm]
const K = 28;           // sieve classes (√2 series → covers 256mm → ~0.4mm)
const READOUT_SIZES = [1, 4, 8, 16, 32];

const EDGES = makeGrid(TOP_MM, K);
const MID = midSizes(EDGES);

export function gridEdges(): number[] { return EDGES; }
export function gridMid(): number[] { return MID; }

/** Evaluate one operating point. */
export function evaluate(op: Operating): CrusherResult {
  const feed = makeFeed(EDGES, op.feedX63Mm, op.feedM);
  const f80 = sizeAtPassing(feed, 0.8);

  // classification C(d)
  const cparams = classificationParams(op.machine, op.cssMm);
  const c = MID.map((d) => classify(d, cparams));

  // breakage B from energy → t10 → Austin Φ
  const ecs = specificEnergy(op.throwMm, op.speedRpm);
  const t10 = t10Of(ecs, op.oreAxb);
  const phi = phiFromT10(t10);
  const B = breakageMatrix(EDGES, MID, phi);

  // solve
  const { product: pmass, massClosure, cond } = whitenSolve(c, B, feed.mass, MID.length);
  const product = toPSD(EDGES, pmass);

  const p80 = sizeAtPassing(product, 0.8);
  const p50 = sizeAtPassing(product, 0.5);
  const p20 = sizeAtPassing(product, 0.2);
  const reductionRatio = p80 > 0 ? f80 / p80 : 0;
  const pctPassing: Record<number, number> = {};
  for (const s of READOUT_SIZES) pctPassing[s] = passingAtSize(product, s);

  const tph = throughput(op.machine, op.cssMm, op.throwMm, op.speedRpm);
  const powerKw = bondPower(tph, f80, p80, op.oreWi);

  const ossMm = op.cssMm + op.throwMm;
  const nip = nipAngle(op.machine, op.cssMm);
  const nipLim = nipLimit();

  // regime + validity
  const flags: string[] = [];
  let regime: Regime = 'choke';
  let valid = true;
  if (op.cssMm >= f80) {                       // setting wider than 80% of feed → most material passes ungripped
    regime = 'pass-through';
    if (op.cssMm >= feed.edgesMm[0]) { valid = false; flags.push('CSS ≥ feed top size — nothing is gripped'); }
    else flags.push('CSS ≥ F80 — little size reduction (pass-through regime)');
  }
  if (reductionRatio < 1.05 && valid) { regime = regime === 'choke' ? 'pass-through' : regime; flags.push('reduction ratio ≈ 1 — negligible breakage'); }
  if (!isFinite(cond) || cond > 1e6) { valid = false; flags.push('ill-conditioned breakage matrix near choke'); }
  if (op.cssMm >= feed.edgesMm[0]) regime = 'invalid';

  return {
    op, feed, product,
    f80, p80, p50, p20, reductionRatio, pctPassing,
    throughputTph: tph, powerKw, specificEnergyKwhT: ecs,
    ossMm, nipAngleDeg: nip, nipLimitDeg: nipLim, regime,
    valid, flags, massClosure, condEstimate: cond,
  };
}
