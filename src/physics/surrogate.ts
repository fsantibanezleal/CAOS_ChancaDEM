// The learned tier's TypeScript side: it reproduces train.py's feature encoding BYTE-FOR-BYTE (the frozen
// scaler.json / ae_scaler.json contract), runs the ONNX models via onnxruntime-web, and inverse-transforms the
// outputs. Two products: (1) the surrogate prediction (instant emulation of the physics engine), (2) the
// autoencoder anomaly / out-of-distribution score. Plus the inverse "target P80 → recommended CSS" via
// bisection on the monotone surrogate (cheaper + guaranteed-consistent vs a trained inverse net).

import { runSurrogate, runAutoencoder } from '../lib/ort';
import { evaluate } from './engine';
import type { Operating, CrusherResult, Machine } from './types';

const MACHINES: Machine[] = ['cone-sec', 'cone-tert', 'jaw'];
const CONT: (keyof Operating)[] = ['cssMm', 'throwMm', 'speedRpm', 'feedX63Mm', 'feedM', 'oreAxb'];
const OUTS = ['p80', 'p50', 'p20', 'pass1', 'pass4', 'pass8', 'pass16', 'pass32', 'tph', 'kW'] as const;

interface Scaler { inputOrder: string[]; inMean: number[]; inStd: number[]; outputOrder: string[]; outLog: boolean[]; outMean: number[]; outStd: number[]; }
interface AeScaler { featOrder: string[]; mean: number[]; std: number[]; }
interface AeThr { threshold_p99: number; trainReconMean: number; }
export interface SurOut { p80: number; p50: number; p20: number; pass: Record<number, number>; tph: number; kW: number; }
export interface Metrics { nTrain: number; nTest: number; perOutput: Record<string, { r2: number; mape_pct: number }>; p80MonotoneVsCss: boolean; note: string; }

let scaler: Scaler | null = null, aeScaler: AeScaler | null = null, aeThr: AeThr | null = null, metrics: Metrics | null = null;

const base = () => (import.meta.env.BASE_URL || '/');

/** Load the frozen inference contracts once. */
export async function loadLearned(): Promise<void> {
  if (scaler) return;
  const [s, a, t, m] = await Promise.all([
    fetch(`${base()}scaler.json`).then((r) => r.json()),
    fetch(`${base()}ae_scaler.json`).then((r) => r.json()),
    fetch(`${base()}ae_threshold.json`).then((r) => r.json()),
    fetch(`${base()}surrogate_metrics.json`).then((r) => r.json()),
  ]);
  scaler = s; aeScaler = a; aeThr = t; metrics = m;
}

export function learnedMetrics(): Metrics | null { return metrics; }
export function aeThreshold(): number { return aeThr?.threshold_p99 ?? 0.4; }

function encodeInput(op: Operating): Float32Array {
  const x = new Float32Array(9);
  x[MACHINES.indexOf(op.machine)] = 1;
  for (let j = 0; j < CONT.length; j++) {
    const v = op[CONT[j]] as number;
    x[3 + j] = (v - scaler!.inMean[j]) / scaler!.inStd[j];
  }
  return x;
}

/** Surrogate prediction for an operating point (instant emulation of the live physics engine). */
export async function surrogatePredict(op: Operating): Promise<SurOut> {
  await loadLearned();
  const z = await runSurrogate(encodeInput(op));
  const v: number[] = [];
  for (let j = 0; j < OUTS.length; j++) {
    let val = z[j] * scaler!.outStd[j] + scaler!.outMean[j];
    if (scaler!.outLog[j]) val = Math.pow(10, val);
    v.push(val);
  }
  return { p80: v[0], p50: v[1], p20: v[2], pass: { 1: v[3], 4: v[4], 8: v[5], 16: v[6], 32: v[7] }, tph: v[8], kW: v[9] };
}

/** Build the 14-D autoencoder feature vector from a (physics) result — identical order to train.py's AE_FEATS. */
function aeFeats(r: CrusherResult): number[] {
  const L = (x: number) => Math.log10(Math.max(x, 1e-6));
  return [L(r.p80), L(r.p50), L(r.p20), r.pctPassing[1], r.pctPassing[4], r.pctPassing[8], r.pctPassing[16], r.pctPassing[32],
    r.throughputTph, r.powerKw, r.reductionRatio, L(r.f80), r.specificEnergyKwhT, r.op.feedM];
}

export interface AnomalyOut { score: number; threshold: number; isAnomaly: boolean; ratio: number; }

/** Autoencoder reconstruction-error anomaly score for the current operating point. score > threshold ⇒ the
 *  gradation/power regime is abnormal OR the query is off the surrogate's training manifold (extrapolation). */
export async function anomalyScore(r: CrusherResult): Promise<AnomalyOut> {
  await loadLearned();
  const f = aeFeats(r);
  const s = new Float32Array(14);
  for (let i = 0; i < 14; i++) s[i] = (f[i] - aeScaler!.mean[i]) / aeScaler!.std[i];
  const xr = await runAutoencoder(s);
  let mse = 0;
  for (let i = 0; i < 14; i++) { const d = xr[i] - s[i]; mse += d * d; }
  mse /= 14;
  const thr = aeThreshold();
  return { score: mse, threshold: thr, isAnomaly: mse > thr, ratio: mse / thr };
}

/** Inverse: recommend the CSS that hits a target product P80, by bisection on the monotone physics engine.
 *  (Uses the exact engine, guaranteed-consistent with the live readouts; the surrogate's monotonicity is the
 *  CI-checked property that makes the root unique.) Returns null if the target is unreachable in the CSS range. */
export function recommendCss(op: Operating, targetP80Mm: number, lo = 3, hi = 200): number | null {
  const p80At = (css: number) => evaluate({ ...op, cssMm: css }).p80;
  let a = lo, b = hi;
  const pa = p80At(a), pb = p80At(b);
  if (targetP80Mm < Math.min(pa, pb) || targetP80Mm > Math.max(pa, pb)) return null;
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2, pm = p80At(m);
    if (Math.abs(pm - targetP80Mm) < 1e-3) return m;
    if ((pm < targetP80Mm) === (pa < pb)) a = m; else b = m;   // monotone bracket
  }
  return (a + b) / 2;
}
