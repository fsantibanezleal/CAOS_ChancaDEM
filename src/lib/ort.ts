// Live in-browser inference of the two learned models (onnxruntime-web). The surrogate emulates the live
// physics engine; the autoencoder scores operating-anomaly / surrogate-extrapolation. The npm package
// (onnxruntime-web ^1.27.0) and the CDN wasmPaths are pinned to the SAME version — a version skew is the
// classic "Session already started" / load-failure trap. WASM EP, single-threaded (GitHub Pages has no
// COOP/COEP for threaded WASM).
import * as ort from 'onnxruntime-web';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
ort.env.wasm.numThreads = 1;

const sessions: Record<string, Promise<ort.InferenceSession>> = {};
const base = () => (import.meta.env.BASE_URL || '/');
const get = (name: string) => (sessions[name] ??= ort.InferenceSession.create(`${base()}${name}`, { executionProviders: ['wasm'] }));

// onnxruntime-web forbids concurrent run() on one session; StrictMode double-effects + rapid slider re-renders
// can trigger it — so serialise per model.
const locks: Record<string, Promise<unknown>> = {};

async function run(model: string, inputName: string, outputName: string, flat: Float32Array, dims: number[]): Promise<Float32Array> {
  const s = await get(model);
  const prev = locks[model] || Promise.resolve();
  const job = prev.then(async () => {
    const out = await s.run({ [inputName]: new ort.Tensor('float32', flat, dims) });
    return out[outputName].data as Float32Array;
  });
  locks[model] = job.catch(() => {});
  return job;
}

/** Surrogate forward: standardized 9-vec → standardized 10-vec (caller inverse-transforms via scaler.json). */
export function runSurrogate(x9: Float32Array): Promise<Float32Array> {
  return run('surrogate.onnx', 'x', 'y', x9, [1, 9]);
}

/** Autoencoder forward: standardized 14-vec → reconstruction 14-vec (caller computes MSE = anomaly score). */
export function runAutoencoder(x14: Float32Array): Promise<Float32Array> {
  return run('psd-ae.onnx', 'x', 'xr', x14, [1, 14]);
}
