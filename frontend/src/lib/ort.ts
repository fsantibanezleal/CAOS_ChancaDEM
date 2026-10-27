// Live in-browser inference of the two learned models (onnxruntime-web). The surrogate emulates the live physics engine; the
// autoencoder scores how far a result lies from the engine's training manifold. Everything that decides what the graph
// sees or what its answer means comes from the model contracts (catalog rows surrogate-model and anomaly-model): the order
// of the machines and of the inputs, the means and standard deviations, the log outputs, the feature order, the threshold.
// Nothing about them is written here, so a retrained model ships by replacing its contract and its graph.
//
// The encoding and decoding are pure functions (tested in ort.test.ts against tests/fixtures/engine-reference.json); the
// runtime is loaded on first use, single-threaded WASM (a static host has no COOP/COEP headers for threaded WASM), and the
// WASM binary is bundled from the npm package, so the same release as the JavaScript and served from the site: no CDN is
// asked at run time. A call to one model waits for the previous call to that model (onnxruntime-web forbids concurrent
// run() on one session; React StrictMode and rapid knob moves would otherwise trigger it).
import type { CrusherResult, Operating } from '../engine/types';
import type { AnomalyModel, SurrogateModel, Text } from './contract.types';

export type SurrogateInput = SurrogateModel['input_order'][number];
export type SurrogateOutput = SurrogateModel['output_order'][number];
export type AnomalyFeature = AnomalyModel['feature_order'][number];

/** How each output of the surrogate is written: its label, its unit and its number format. */
export const OUTPUT_UNITS: Record<SurrogateOutput, { label: { en: string; es: string }; unit?: string; percent?: boolean }> = {
  p80_mm: { label: { en: 'P80', es: 'P80' }, unit: 'mm' },
  p50_mm: { label: { en: 'P50', es: 'P50' }, unit: 'mm' },
  p20_mm: { label: { en: 'P20', es: 'P20' }, unit: 'mm' },
  pass_1: { label: { en: 'Passing 1 mm', es: 'Pasante a 1 mm' }, percent: true },
  pass_4: { label: { en: 'Passing 4 mm', es: 'Pasante a 4 mm' }, percent: true },
  pass_8: { label: { en: 'Passing 8 mm', es: 'Pasante a 8 mm' }, percent: true },
  pass_16: { label: { en: 'Passing 16 mm', es: 'Pasante a 16 mm' }, percent: true },
  pass_32: { label: { en: 'Passing 32 mm', es: 'Pasante a 32 mm' }, percent: true },
  throughput_tph: { label: { en: 'Throughput', es: 'Capacidad' }, unit: 't/h' },
  power_kw: { label: { en: 'Power', es: 'Potencia' }, unit: 'kW' },
};

/** The surrogate's input: a one-hot of the machine in the contract's order, then the continuous inputs standardised, in the contract's order. */
export function encodeSurrogate(op: Operating, c: SurrogateModel): Float32Array {
  const values: Record<SurrogateInput, number> = {
    css_mm: op.cssMm,
    throw_mm: op.throwMm,
    speed_rpm: op.speedRpm,
    feed_x63_mm: op.feedX63Mm,
    feed_m: op.feedM,
    ore_axb: op.oreAxb,
  };
  const nMachines = c.machine_order.length;
  const x = new Float32Array(nMachines + c.input_order.length);
  const hot = c.machine_order.indexOf(op.machine);
  if (hot < 0) throw new Error(`the surrogate contract does not list the machine ${op.machine}`);
  x[hot] = 1;
  c.input_order.forEach((name, j) => {
    x[nMachines + j] = (values[name] - c.in_mean[j]) / c.in_std[j];
  });
  return x;
}

/** The surrogate's answer: the graph's standardised output, un-standardised and, where the contract says so, raised to the power of ten. */
export function decodeSurrogate(y: ArrayLike<number>, c: SurrogateModel): Record<SurrogateOutput, number> {
  if (y.length !== c.output_order.length) throw new Error(`the surrogate returns ${c.output_order.length} values, the graph gave ${y.length}`);
  const out = {} as Record<SurrogateOutput, number>;
  c.output_order.forEach((name, i) => {
    const v = y[i] * c.out_std[i] + c.out_mean[i];
    out[name] = c.out_log[i] ? Math.pow(10, v) : v;
  });
  return out;
}

const log10 = (x: number): number => Math.log10(Math.max(x, 1e-6));

/** The 14 features of an engine result the autoencoder reads, by the contract's names. */
export function anomalyFeatureValues(r: CrusherResult): Record<AnomalyFeature, number> {
  return {
    log10_p80_mm: log10(r.p80),
    log10_p50_mm: log10(r.p50),
    log10_p20_mm: log10(r.p20),
    pass_1: r.pctPassing[1],
    pass_4: r.pctPassing[4],
    pass_8: r.pctPassing[8],
    pass_16: r.pctPassing[16],
    pass_32: r.pctPassing[32],
    throughput_tph: r.throughputTph,
    power_kw: r.powerKw,
    reduction_ratio: r.reductionRatio,
    log10_f80_mm: log10(r.f80),
    specific_energy_kwh_t: r.specificEnergyKwhT,
    feed_m: r.op.feedM,
  };
}

/** The raw features in the contract's order, and the standardised input of the graph. */
export function encodeAnomaly(r: CrusherResult, c: AnomalyModel): { features: number[]; input: Float32Array } {
  const values = anomalyFeatureValues(r);
  const features = c.feature_order.map((name) => values[name]);
  const input = new Float32Array(features.length);
  features.forEach((f, i) => {
    input[i] = (f - c.mean[i]) / c.std[i];
  });
  return { features, input };
}

/** The anomaly score: the mean squared error between the standardised input and the graph's reconstruction of it. */
export function anomalyScoreOf(x: ArrayLike<number>, xr: ArrayLike<number>): number {
  if (x.length !== xr.length) throw new Error(`the reconstruction has ${xr.length} values, the input ${x.length} (14 expected)`);
  let sum = 0;
  for (let i = 0; i < x.length; i++) {
    const d = xr[i] - x[i];
    sum += d * d;
  }
  return sum / x.length;
}

export interface AnomalyReading {
  score: number;
  threshold: number;
  /** The score over the threshold. */
  ratio: number;
  anomalous: boolean;
}

// ---- applicability: where a learned model answers (one rule, the same as pipeline.model.bundles.applicability) ----

/** A continuous input a model is trained over, and the field of an operating point it reads. */
export type ModelInput = SurrogateInput;

/** The field of an operating point each continuous input reads. */
export const INPUT_FIELD: Record<ModelInput, 'cssMm' | 'throwMm' | 'speedRpm' | 'feedX63Mm' | 'feedM' | 'oreAxb'> = {
  css_mm: 'cssMm',
  throw_mm: 'throwMm',
  speed_rpm: 'speedRpm',
  feed_x63_mm: 'feedX63Mm',
  feed_m: 'feedM',
  ore_axb: 'oreAxb',
};

/** How each continuous input is written, with its unit, in both languages. */
export const INPUT_LABEL: Record<ModelInput, Text> = {
  css_mm: { en: 'setting', es: 'abertura' },
  throw_mm: { en: 'throw', es: 'carrera' },
  speed_rpm: { en: 'speed', es: 'velocidad' },
  feed_x63_mm: { en: 'feed x63', es: 'x63 de la alimentación' },
  feed_m: { en: 'feed m', es: 'm de la alimentación' },
  ore_axb: { en: 'ore A times b', es: 'A por b del mineral' },
};

/** The verdict of the rule: whether the models apply to an operating point, and the reason codes when they do not (`calibrated_case`, or `outside_training_range:<input>` per input, in the contract's input order). */
export interface Applicability {
  applies: boolean;
  reasons: string[];
}

/**
 * The applicability rule, read from the contract: a model applies to an operating point when the point is not calibrated
 * (the models emulate the uncalibrated engine) and every continuous input lies inside its machine's training range
 * (`training.input_ranges`, inclusive). A calibrated point is refused for that reason alone. A value that is not a number
 * is outside. Both model contracts carry the same ranges.
 */
export function applicability(op: Operating, c: SurrogateModel | AnomalyModel): Applicability {
  if (op.calibrated) return { applies: false, reasons: ['calibrated_case'] };
  const ranges = (c.training.input_ranges as Record<string, Record<ModelInput, [number, number]> | undefined>)[op.machine];
  if (!ranges) return { applies: false, reasons: ['outside_training_range:machine'] };
  const reasons = (Object.keys(INPUT_FIELD) as ModelInput[])
    .filter((name) => {
      const v = op[INPUT_FIELD[name]];
      return !(v >= ranges[name][0] && v <= ranges[name][1]);
    })
    .map((name) => `outside_training_range:${name}`);
  return { applies: reasons.length === 0, reasons };
}

/** A refused call: the model does not apply to the operating point, so no graph number is produced. */
export class NotApplicableError extends Error {
  constructor(readonly reasons: string[]) {
    super(`the learned model does not apply (${reasons.join(', ')})`);
    this.name = 'NotApplicableError';
  }
}

const g = (v: number): string => String(Number(v.toPrecision(4)));
const gEs = (v: number): string => g(v).replace('.', ',');

/**
 * The statement the views make where the models do not apply, in both languages: why, and that the slot's baseline answers
 * (`baseline`: the engine for the surrogate, the envelope gate for the autoencoder).
 */
export function notApplicableText(op: Operating, c: SurrogateModel | AnomalyModel, a: Applicability, baseline: { en: string; es: string }): Text {
  const ranges = (c.training.input_ranges as Record<string, Record<ModelInput, [number, number]> | undefined>)[op.machine];
  if (a.reasons.includes('calibrated_case')) {
    return {
      en: `The learned models emulate the uncalibrated engine; this measured survey runs the calibrated fit, so they do not apply and ${baseline.en} answers.`,
      es: `Los modelos aprendidos emulan el motor sin calibrar; este muestreo medido corre el ajuste calibrado, así que no aplican y responde ${baseline.es}.`,
    };
  }
  const parts = a.reasons
    .map((r) => r.slice('outside_training_range:'.length) as ModelInput)
    .filter((name) => ranges && INPUT_FIELD[name])
    .map((name) => {
      const v = op[INPUT_FIELD[name]];
      const [lo, hi] = ranges![name];
      return {
        en: `${INPUT_LABEL[name].en} ${g(v)} lies outside the trained range ${g(lo)} to ${g(hi)}`,
        es: `${INPUT_LABEL[name].es} ${gEs(v)} queda fuera del rango entrenado ${gEs(lo)} a ${gEs(hi)}`,
      };
    });
  return {
    en: `The learned models were trained on a limited range of this machine: ${parts.map((p) => p.en).join('; ') || 'the point is outside it'}. They do not apply, and ${baseline.en} answers.`,
    es: `Los modelos aprendidos se entrenaron en un rango acotado de esta máquina: ${parts.map((p) => p.es).join('; ') || 'el punto queda fuera de él'}. No aplican, y responde ${baseline.es}.`,
  };
}

// ---- the runtime: loaded on first use ----

type Ort = typeof import('onnxruntime-web');
type Session = import('onnxruntime-web').InferenceSession;

let runtime: Promise<Ort> | null = null;

function loadRuntime(): Promise<Ort> {
  runtime ??= (async () => {
    // The wasm-only build of the runtime and its binary from the same package version; Vite bundles the binary as an asset of the site.
    const [ort, wasm] = await Promise.all([import('onnxruntime-web/wasm'), import('onnxruntime-web/ort-wasm-simd-threaded.wasm?url')]);
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = { wasm: wasm.default };
    return ort;
  })();
  return runtime;
}

const sessions = new Map<string, Promise<Session>>();
const locks = new Map<string, Promise<unknown>>();

interface GraphRef {
  path: string;
  input: string;
  output: string;
}

function session(graph: GraphRef): Promise<Session> {
  let s = sessions.get(graph.path);
  if (!s) {
    const url = `${import.meta.env.BASE_URL}data/${graph.path}?v=${encodeURIComponent(__APP_VERSION__)}`;
    s = loadRuntime().then(async (ort) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${graph.path}: HTTP ${res.status}`);
      return ort.InferenceSession.create(new Uint8Array(await res.arrayBuffer()), { executionProviders: ['wasm'] });
    });
    // a failed load is not kept: the next call tries again
    s.catch(() => sessions.delete(graph.path));
    sessions.set(graph.path, s);
  }
  return s;
}

async function run(graph: GraphRef, input: Float32Array): Promise<Float32Array> {
  const [ort, s] = await Promise.all([loadRuntime(), session(graph)]);
  const previous = locks.get(graph.path) ?? Promise.resolve();
  const job = previous.then(async () => {
    const out = await s.run({ [graph.input]: new ort.Tensor('float32', input, [1, input.length]) });
    return out[graph.output].data as Float32Array;
  });
  locks.set(graph.path, job.catch(() => undefined));
  return job;
}

/** The graph of each slot at the path its schema fixes (a `const` in docs/contracts/schemas): the default of the raw runners. */
const SURROGATE_GRAPH: GraphRef = { path: 'models/surrogate.onnx', input: 'x', output: 'y' };
const ANOMALY_GRAPH: GraphRef = { path: 'models/psd-ae.onnx', input: 'x', output: 'xr' };

/**
 * The surrogate graph on an encoded input: standardised 11 values in, standardised 10 values out. The engine's
 * learned tier (engine/surrogate.ts, the 0.09.003 module that holds the CSS inverse) calls it with the input only.
 */
export function runSurrogate(x11: Float32Array, graph: GraphRef = SURROGATE_GRAPH): Promise<Float32Array> {
  return run(graph, x11);
}

/** The autoencoder graph on an encoded input: standardised 14 values in, their reconstruction out. */
export function runAutoencoder(x14: Float32Array, graph: GraphRef = ANOMALY_GRAPH): Promise<Float32Array> {
  return run(graph, x14);
}

/** The released surrogate's prediction at an operating point, from its contract and the graph the contract names; throws `NotApplicableError` where the rule says the model does not apply. */
export async function predictSurrogate(c: SurrogateModel, op: Operating): Promise<Record<SurrogateOutput, number>> {
  const a = applicability(op, c);
  if (!a.applies) throw new NotApplicableError(a.reasons);
  return decodeSurrogate(await runSurrogate(encodeSurrogate(op, c), c.graphs.float32), c);
}

/** The released autoencoder's reading of an engine result, from its contract and the graph the contract names; throws `NotApplicableError` where the rule says the model does not apply. */
export async function readAnomaly(c: AnomalyModel, r: CrusherResult): Promise<AnomalyReading> {
  const a = applicability(r.op, c);
  if (!a.applies) throw new NotApplicableError(a.reasons);
  const { input } = encodeAnomaly(r, c);
  const score = anomalyScoreOf(input, await runAutoencoder(input, c.graph));
  return { score, threshold: c.threshold_p99, ratio: score / c.threshold_p99, anomalous: score > c.threshold_p99 };
}
