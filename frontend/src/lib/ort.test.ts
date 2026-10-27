// Catalog rows surrogate-model and anomaly-model, consumer side: the encoding and decoding in ort.ts, driven by the
// fields of the model contracts (never by statistics written in the code), reproduce the feature vectors that
// tests/fixtures/engine-reference.json holds for every point, which the canonical Python engine's tests hold too. The ONNX
// graph itself is not run here: the producer's test runs it through onnxruntime (tests/contracts/test_models.py), and
// the App's gate loads it in a real browser. Contracts come from the provider tree; a real bake must pass the same checks.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../engine/engine';
import type { Operating } from '../engine/types';
import type { AnomalyModel, SurrogateModel } from './contract.types';
import { anomalyScoreOf, decodeSurrogate, encodeAnomaly, encodeSurrogate, OUTPUT_UNITS } from './ort';

interface RefPoint {
  id: string;
  op: Operating;
  features: { input: number[]; ae: Array<number | string>; aeInput: Array<number | string> };
}
const reference = JSON.parse(readFileSync(new URL('../../../tests/fixtures/engine-reference.json', import.meta.url), 'utf8')) as {
  scaler: { inMean: number[]; inStd: number[]; aeMean: number[]; aeStd: number[] };
  points: RefPoint[];
};

const CONTRACT_ROOTS = [
  ['docs/contracts/fixtures/data/derived (the provider)', new URL('../../../docs/contracts/fixtures/data/derived/', import.meta.url)],
  ['data/derived (the bake)', new URL('../../../data/derived/', import.meta.url)],
] as const;
const readContract = <T>(root: URL, rel: string): T => JSON.parse(readFileSync(new URL(rel, root), 'utf8')) as T;

/** A non-finite number is written in the fixture as the string it prints as. */
const num = (v: number | string): number => (typeof v === 'string' ? Number(v === 'Infinity' ? Infinity : v === '-Infinity' ? -Infinity : NaN) : v);
const same = (a: number, b: number): boolean => a === b || (Number.isNaN(a) && Number.isNaN(b));
const first = (v: ArrayLike<number>, w: ArrayLike<number>): number => Array.from(v).findIndex((x, i) => !same(x, w[i]));

for (const [label, root] of CONTRACT_ROOTS) {
  const surrogatePath = new URL('models/surrogate.json', root);
  const baked = existsSync(surrogatePath) && (readContract<{ schema?: string }>(root, 'models/surrogate.json').schema === 'chancadem.surrogate/v1');
  describe(`the model encodings follow the contracts of ${label}`, () => {
    if (!baked) {
      it.skip('not checked: no model contract of the product under this root yet', () => undefined);
      return;
    }
    const sur = readContract<SurrogateModel>(root, 'models/surrogate.json');
    const ae = readContract<AnomalyModel>(root, 'models/psd-ae.json');

    it('the contracts carry the statistics the engine reference was written with', () => {
      expect(sur.in_mean).toEqual(reference.scaler.inMean);
      expect(sur.in_std).toEqual(reference.scaler.inStd);
      expect(ae.mean).toEqual(reference.scaler.aeMean);
      expect(ae.std).toEqual(reference.scaler.aeStd);
    });

    it(`adversarial: the surrogate input of every one of the ${reference.points.length} reference points is the fixture's, to the bit`, () => {
      for (const p of reference.points) {
        const x = encodeSurrogate(p.op, sur);
        expect(x.length, p.id).toBe(11);
        expect(x instanceof Float32Array, p.id).toBe(true);
        expect(first(x, p.features.input), `${p.id}: first element that differs`).toBe(-1);
      }
    });

    it('adversarial: the anomaly features and the standardised input of every reference point are the fixture\'s, to the bit', () => {
      for (const p of reference.points) {
        const r = evaluate(p.op);
        const enc = encodeAnomaly(r, ae);
        expect(enc.features.length, p.id).toBe(14);
        expect(first(enc.features, p.features.ae.map(num)), `${p.id}: feature that differs`).toBe(-1);
        expect(first(enc.input, p.features.aeInput.map(num)), `${p.id}: standardised element that differs`).toBe(-1);
      }
    });

    it('the order of the vector follows the contract, not the code: a contract with its inputs reordered encodes in that order', () => {
      const swapped: SurrogateModel = {
        ...sur,
        input_order: ['throw_mm', 'css_mm', ...sur.input_order.slice(2)] as SurrogateModel['input_order'],
        in_mean: [sur.in_mean[1], sur.in_mean[0], ...sur.in_mean.slice(2)],
        in_std: [sur.in_std[1], sur.in_std[0], ...sur.in_std.slice(2)],
      };
      const op = reference.points[0].op;
      const a = encodeSurrogate(op, sur);
      const b = encodeSurrogate(op, swapped);
      expect(b[5]).toBe(a[6]);
      expect(b[6]).toBe(a[5]);
      expect(b[7]).toBe(a[7]);
    });

    it('the machine is a one-hot in the contract\'s machine_order', () => {
      for (const [i, machine] of sur.machine_order.entries()) {
        const x = encodeSurrogate({ ...reference.points[0].op, machine }, sur);
        expect(Array.from(x.slice(0, 5))).toEqual(sur.machine_order.map((_, j) => (j === i ? 1 : 0)));
      }
    });

    it('the decoding inverts the standardisation: a standardised engine result decodes to the engine result', () => {
      for (const p of reference.points.filter((q) => Number.isFinite(evaluate(q.op).p80) && evaluate(q.op).p80 > 0 && evaluate(q.op).throughputTph > 0 && evaluate(q.op).powerKw > 0)) {
        const r = evaluate(p.op);
        const truth: Record<string, number> = {
          p80_mm: r.p80,
          p50_mm: r.p50,
          p20_mm: r.p20,
          pass_1: r.pctPassing[1],
          pass_4: r.pctPassing[4],
          pass_8: r.pctPassing[8],
          pass_16: r.pctPassing[16],
          pass_32: r.pctPassing[32],
          throughput_tph: r.throughputTph,
          power_kw: r.powerKw,
        };
        if (!Object.values(truth).every((v) => v > 0 || v === 0)) continue;
        const y = Float32Array.from(sur.output_order.map((k, i) => ((sur.out_log[i] ? Math.log10(Math.max(truth[k], 1e-12)) : truth[k]) - sur.out_mean[i]) / sur.out_std[i]));
        const out = decodeSurrogate(y, sur);
        for (const k of sur.output_order) {
          if (truth[k] <= 0) continue;
          expect(Math.abs(out[k] - truth[k]) / truth[k], `${p.id} ${k}`).toBeLessThan(2e-4);
        }
      }
    });

    it('adversarial: a graph output of the wrong length is refused, not decoded', () => {
      expect(() => decodeSurrogate(new Float32Array(9), sur)).toThrow(/10 values/);
    });

    it('the anomaly score is the mean squared reconstruction error over the 14 values', () => {
      const x = Float32Array.from({ length: 14 }, (_, i) => i / 10);
      const xr = Float32Array.from({ length: 14 }, (_, i) => i / 10 + (i === 3 ? 0.14 : 0));
      expect(anomalyScoreOf(x, xr)).toBeCloseTo((0.14 * 0.14) / 14, 6);
      expect(anomalyScoreOf(x, x)).toBe(0);
      expect(() => anomalyScoreOf(x, xr.slice(0, 13))).toThrow(/14/);
    });

    it('every output has a unit the page writes', () => {
      for (const k of sur.output_order) expect(OUTPUT_UNITS[k], k).toBeDefined();
    });
  });
}
