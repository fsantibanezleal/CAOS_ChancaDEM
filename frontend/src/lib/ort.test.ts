// Catalog rows surrogate-model and anomaly-model, consumer side: the encoding and decoding in ort.ts, driven by the
// fields of the model contracts (never by statistics written in the code), reproduce the feature vectors that
// tests/fixtures/engine-reference.json holds for every point, which the canonical Python engine's tests hold too. The ONNX
// graph itself is not run here: the producer's test runs it through onnxruntime (tests/contracts/test_models.py), and
// the App's gate loads it in a real browser. Contracts come from the provider tree; a real bake must pass the same checks.
import { useLangStore } from '@fasl-work/caos-app-shell';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { evaluate } from '../engine/engine';
import type { Operating } from '../engine/types';
import { AnomalyView, SurrogateView } from '../views/learned';
import { ViewContext, type ViewCtx } from '../views/shared';
import { operatingOf } from '../workbench/model';
import type { AnomalyModel, CaseManifest, SurrogateModel } from './contract.types';
import { anomalyScoreOf, applicability, decodeSurrogate, encodeAnomaly, encodeSurrogate, NotApplicableError, notApplicableText, OUTPUT_UNITS, predictSurrogate, readAnomaly } from './ort';

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

// ---- F1: the applicability rule, the same table of points as tests/contracts/test_models.py ----

const MACHINES = ['cone-sec', 'cone-tert', 'jaw', 'cone-short-head', 'gyratory'] as const;
const CONTINUOUS = ['css_mm', 'throw_mm', 'speed_rpm', 'feed_x63_mm', 'feed_m', 'ore_axb'] as const;
const SURVEYS = Array.from({ length: 10 }, (_, i) => `HP500-${String(i + 1).padStart(2, '0')}`);
// sha256 of the verdict lines of the shared table; the producer's test pins the same digest
const TABLE_DIGEST = 'bcaf117a70140ee381191f35625341daa46f3720efae43b9327c5f7a0b780965';

type Input = (typeof CONTINUOUS)[number];
type Ranges = Record<string, Record<Input, [number, number]>>;
type Row = { id: string; op: Operating; applies: boolean; reasons: string[] };

const BAKE = new URL('../../../data/derived/', import.meta.url);
const surveyOp = (id: string): Operating => {
  const m = readContract<CaseManifest>(BAKE, `manifests/${id}.json`);
  expect(m.params.calibrated).toBe(true);
  return operatingOf(m.params);
};

function opOf(machine: (typeof MACHINES)[number], v: Record<Input, number>, calibrated = false): Operating {
  return { machine, cssMm: v.css_mm, throwMm: v.throw_mm, speedRpm: v.speed_rpm, feedX63Mm: v.feed_x63_mm, feedM: v.feed_m, oreAxb: v.ore_axb, oreWi: 14, ...(calibrated ? { calibrated: true } : {}) };
}

function applicabilityTable(ranges: Ranges): Row[] {
  const rows: Row[] = [];
  for (const machine of MACHINES) {
    const r = ranges[machine];
    const centre = Object.fromEntries(CONTINUOUS.map((k) => [k, (r[k][0] + r[k][1]) / 2])) as Record<Input, number>;
    rows.push({ id: `${machine}.centre`, op: opOf(machine, centre), applies: true, reasons: [] });
    rows.push({ id: `${machine}.calibrated`, op: opOf(machine, centre, true), applies: false, reasons: ['calibrated_case'] });
    for (const k of CONTINUOUS) {
      const [lo, hi] = r[k];
      rows.push({ id: `${machine}.${k}.lo`, op: opOf(machine, { ...centre, [k]: lo }), applies: true, reasons: [] });
      rows.push({ id: `${machine}.${k}.hi`, op: opOf(machine, { ...centre, [k]: hi }), applies: true, reasons: [] });
      rows.push({ id: `${machine}.${k}.below`, op: opOf(machine, { ...centre, [k]: lo - 1e-6 }), applies: false, reasons: [`outside_training_range:${k}`] });
      rows.push({ id: `${machine}.${k}.above`, op: opOf(machine, { ...centre, [k]: hi + 1e-6 }), applies: false, reasons: [`outside_training_range:${k}`] });
    }
    rows.push({ id: `${machine}.two`, op: opOf(machine, { ...centre, css_mm: r.css_mm[1] + 1, feed_m: r.feed_m[0] - 0.1 }), applies: false, reasons: ['outside_training_range:css_mm', 'outside_training_range:feed_m'] });
    rows.push({ id: `${machine}.nan`, op: opOf(machine, { ...centre, speed_rpm: Number.NaN }), applies: false, reasons: ['outside_training_range:speed_rpm'] });
    rows.push({ id: `${machine}.calibrated_and_outside`, op: opOf(machine, { ...centre, ore_axb: 677.3 }, true), applies: false, reasons: ['calibrated_case'] });
  }
  for (const id of SURVEYS) rows.push({ id, op: surveyOp(id), applies: false, reasons: ['calibrated_case'] });
  return rows;
}

const digest = (v: { id: string; applies: boolean; reasons: string[] }[]): string =>
  createHash('sha256')
    .update(v.map((x) => `${x.id}|${x.applies ? 1 : 0}|${x.reasons.join(',')}`).join('\n'))
    .digest('hex');

describe('F1: the learned models answer only where they apply', () => {
  const sur = readContract<SurrogateModel>(BAKE, 'models/surrogate.json');
  const ae = readContract<AnomalyModel>(BAKE, 'models/psd-ae.json');

  it('both contracts carry the same training ranges', () => {
    expect(sur.training.input_ranges).toEqual(ae.training.input_ranges);
    expect(Object.keys(sur.training.input_ranges)).toEqual([...MACHINES]);
  });

  it('adversarial: the shared table of points gives the expected verdicts, on both contracts, and the digest the producer pins', () => {
    for (const c of [sur, ae]) {
      const rows = applicabilityTable(c.training.input_ranges as unknown as Ranges);
      expect(rows.length).toBe(5 * (2 + 6 * 4 + 3) + 10);
      const got = rows.map((r) => ({ id: r.id, ...applicability(r.op, c) }));
      for (const [i, row] of rows.entries()) expect({ id: row.id, applies: got[i].applies, reasons: got[i].reasons }).toEqual({ id: row.id, applies: row.applies, reasons: row.reasons });
      expect(digest(got)).toBe(TABLE_DIGEST);
    }
  });

  it('the ranges are those of the contract, not of the code: a contract with a narrower range refuses a point the shipped one accepts', () => {
    const narrow = structuredClone(sur);
    (narrow.training.input_ranges as unknown as Ranges)['cone-sec'].css_mm = [6, 20];
    const op = opOf('cone-sec', { css_mm: 32, throw_mm: 30, speed_rpm: 360, feed_x63_mm: 90, feed_m: 1.2, ore_axb: 55 });
    expect(applicability(op, sur)).toEqual({ applies: true, reasons: [] });
    expect(applicability(op, narrow)).toEqual({ applies: false, reasons: ['outside_training_range:css_mm'] });
  });

  it('adversarial: no survey gets a graph answer from either model (the call is refused before any graph runs)', async () => {
    for (const id of SURVEYS) {
      const op = surveyOp(id);
      await expect(predictSurrogate(sur, op), id).rejects.toBeInstanceOf(NotApplicableError);
      await expect(readAnomaly(ae, evaluate(op)), id).rejects.toBeInstanceOf(NotApplicableError);
    }
  });

  it('says why in both languages, with the input, its value and the range', () => {
    const survey = surveyOp('HP500-01');
    const calibrated = notApplicableText(survey, sur, applicability(survey, sur), { en: 'the engine', es: 'el motor' });
    expect(calibrated.en).toBe('The learned models emulate the uncalibrated engine; this measured survey runs the calibrated fit, so they do not apply and the engine answers.');
    expect(calibrated.es).toContain('muestreo');
    const op = opOf('cone-sec', { css_mm: 120.5, throw_mm: 30, speed_rpm: 360, feed_x63_mm: 90, feed_m: 1.2, ore_axb: 55 });
    const text = notApplicableText(op, sur, applicability(op, sur), { en: 'the engine', es: 'el motor' });
    expect(text.en).toContain('setting 120.5 lies outside the trained range 6 to 90');
    expect(text.es).toContain('abertura 120,5 queda fuera del rango entrenado 6 a 90');
    for (const t of [calibrated, text]) expect(`${t.en} ${t.es}`).not.toMatch(/[\u2014\u2192]/u);
  });
});

const DEFAULT_CTX: ViewCtx = { sel: null, unavailable: null, index: null, loo: null, target: 12, setTarget: () => undefined, canApplyCss: false, applyCss: () => undefined };
afterEach(() => {
  Object.assign(useLangStore.getInitialState(), { lang: 'en' });
  useLangStore.setState({ lang: 'en' });
});

describe('F1: the App never shows a graph number on a calibrated real case', () => {
  const sur = readContract<SurrogateModel>(BAKE, 'models/surrogate.json');
  const ae = readContract<AnomalyModel>(BAKE, 'models/psd-ae.json');
  const selection = (op: Operating) =>
    ({ op, result: evaluate(op), data: { manifest: { real_or_synthetic: 'real' } }, flags: [] }) as unknown as import('../workbench/model').Selection;
  const render = (node: React.ReactElement, op: Operating) =>
    renderToString(createElement(ViewContext.Provider, { value: { ...DEFAULT_CTX, sel: selection(op) } }, node));
  const metrics = null;
  const html = (kind: 'surrogate' | 'anomaly', op: Operating, lang: 'en' | 'es') => {
    Object.assign(useLangStore.getInitialState(), { lang });
    useLangStore.setState({ lang });
    return kind === 'surrogate'
      ? render(createElement(SurrogateView, { slot: { answer: 'released', contract: sur }, metrics, metricsReason: null }), op)
      : render(createElement(AnomalyView, { slot: { answer: 'released', contract: ae }, metrics }), op);
  };

  it('adversarial: on each of the ten surveys the Learned views state the rule and show the baseline, in both languages, and no loading state of a graph', () => {
    for (const id of SURVEYS) {
      const op = surveyOp(id);
      for (const lang of ['en', 'es'] as const) {
        const s = html('surrogate', op, lang);
        const a = html('anomaly', op, lang);
        expect(s, `${id} ${lang}`).not.toMatch(/Running the surrogate|Ejecutando el sustituto/);
        expect(a, `${id} ${lang}`).not.toMatch(/Running the autoencoder|Ejecutando el autocodificador/);
        if (lang === 'en') {
          expect(s).toContain('The learned models emulate the uncalibrated engine; this measured survey runs the calibrated fit, so they do not apply and the engine answers.');
          expect(a).toContain('so they do not apply and the envelope gate answers.');
          expect(s).toContain('Answered by the baseline, the engine itself.');
          expect(s).not.toContain('>Surrogate<');
          expect(s).not.toContain('Relative error');
          expect(a).toContain('Envelope gate');
          expect(a).not.toContain('Autoencoder</th>');
        } else {
          expect(s).toContain('Los modelos aprendidos emulan el motor sin calibrar; este muestreo medido corre el ajuste calibrado');
          expect(s).not.toContain('Error relativo');
        }
      }
    }
  });

  it('a point outside a training range is refused with the input, its value and the range; an uncalibrated point inside waits for the graph', () => {
    const outside = { machine: 'cone-sec', cssMm: 120.5, throwMm: 30, speedRpm: 360, feedX63Mm: 90, feedM: 1.2, oreAxb: 55, oreWi: 14 } as Operating;
    expect(html('surrogate', outside, 'en')).toContain('setting 120.5 lies outside the trained range 6 to 90');
    expect(html('surrogate', outside, 'es')).toContain('abertura 120,5 queda fuera del rango entrenado 6 a 90');
    const inside = { ...outside, cssMm: 32 } as Operating;
    expect(html('surrogate', inside, 'en')).toMatch(/Running the surrogate in the browser/);
  });
});
