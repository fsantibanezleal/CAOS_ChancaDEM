// Latin-hypercube sweep over the operating space, evaluated by the SAME live TypeScript engine the app runs.
// Rather than re-port the Whiten/Evertsson/Bond engine to Python (divergence risk — the lesson from the sibling
// products), we generate the surrogate's training labels by running the real TS engine via tsx and logging
// (inputs → outputs) at each sampled operating point. The Python trainer then fits the ONNX surrogate + the
// denoising autoencoder on this dataset. The engine is the single source of physics truth; the surrogate
// honestly emulates IT.
//
// Run:  node --import tsx tools/sweep/gen_sweep.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { evaluate } from '../../../frontend/src/physics/engine.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
// training data is an OFFLINE artifact (the surrogate's labels), NOT a web payload — it stays beside the generator,
// the ONNX models + metrics.json (the web artifacts) go to data/derived/ from the Python trainer.
const OUT = HERE;
mkdirSync(OUT, { recursive: true });

// deterministic RNG (mulberry32) so the sweep is a pure function of the seed (ADR-0054 reproducibility).
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MACHINES = ['cone-sec', 'cone-tert', 'jaw', 'cone-short-head', 'gyratory'];
// per-machine continuous ranges [min,max]: css, throw, speed, feedX63, feedM, oreAxb. Each machine is sampled
// only over ITS realistic operating envelope (a gyratory never runs a 6 mm CSS; a short-head never a 200 mm one)
// so the surrogate learns each machine's true regime, not a shared rectangle.
const RANGE = {
  'cone-sec':         { css: [6, 90], throwMm: [16, 44], speed: [180, 560], x63: [40, 200], m: [0.7, 2.0], axb: [30, 110] },
  'cone-tert':        { css: [4, 22], throwMm: [10, 26], speed: [220, 600], x63: [15, 55], m: [0.9, 2.0], axb: [30, 110] },
  'jaw':              { css: [50, 160], throwMm: [24, 50], speed: [180, 380], x63: [180, 500], m: [0.7, 1.6], axb: [35, 110] },
  'cone-short-head':  { css: [4, 16], throwMm: [10, 22], speed: [380, 600], x63: [15, 45], m: [0.9, 2.0], axb: [30, 110] }, // tertiary short-head: finest, fastest, smallest gap
  'gyratory':         { css: [120, 240], throwMm: [22, 40], speed: [100, 200], x63: [300, 800], m: [0.7, 1.4], axb: [30, 110] }, // primary gyratory: very wide OSS-set, slow, coarse RoM feed
};
// Bond work index derived from ore competence A·b (harder ore = lower A·b = higher Wi), kept consistent so power
// tracks hardness without adding a free input dimension (surrogate stays at 6 continuous + 5 one-hot).
const wiOf = (axb) => Math.max(8, Math.min(20, 8 + (120 - axb) * 0.09));

/** Latin-hypercube: for each of D dims, a random permutation of N stratified cells, jittered within the cell. */
function lhs(n, d, rnd) {
  const cols = [];
  for (let j = 0; j < d; j++) {
    const perm = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [perm[i], perm[k]] = [perm[k], perm[i]]; }
    cols.push(perm.map((p) => (p + rnd()) / n));   // u ∈ (0,1), one per stratum
  }
  // transpose → n points × d uniforms
  return Array.from({ length: n }, (_, i) => cols.map((c) => c[i]));
}

// argv: [seed] [outName] [nPerMachine] — defaults generate the TRAIN set; an independent seed/name gives the
// held-out TEST set (a second LHS draw, NOT a row-split — a row-split leaks the stratified design).
const SEED = Number(process.argv[2] ?? 12345);
const OUT_NAME = process.argv[3] ?? 'cz-sweep';
const N_PER_MACHINE = Number(process.argv[4] ?? 1400);
const rnd = mulberry32(SEED);
const rows = [];
let kept = 0, invalid = 0;

for (const machine of MACHINES) {
  const R = RANGE[machine];
  const pts = lhs(N_PER_MACHINE, 6, rnd);
  for (const u of pts) {
    const lerp = (rg, t) => rg[0] + t * (rg[1] - rg[0]);
    const cssMm = lerp(R.css, u[0]);
    const throwMm = lerp(R.throwMm, u[1]);
    const speedRpm = lerp(R.speed, u[2]);
    const feedX63Mm = lerp(R.x63, u[3]);
    const feedM = lerp(R.m, u[4]);
    const oreAxb = lerp(R.axb, u[5]);
    const op = { machine, cssMm, throwMm, speedRpm, feedX63Mm, feedM, oreAxb, oreWi: wiOf(oreAxb) };
    const r = evaluate(op);
    // discard physically-invalid draws (CSS ≥ feed top, ill-conditioned) — they become the AE's negative set,
    // not surrogate training labels.
    const ok = r.valid && r.regime !== 'invalid' && r.reductionRatio >= 1.02 && isFinite(r.p80) && r.p80 > 0;
    rows.push({
      machine, cssMm, throwMm, speedRpm, feedX63Mm, feedM, oreAxb, oreWi: op.oreWi,
      // outputs (the surrogate's targets)
      p80: r.p80, p50: r.p50, p20: r.p20,
      pass1: r.pctPassing[1], pass4: r.pctPassing[4], pass8: r.pctPassing[8], pass16: r.pctPassing[16], pass32: r.pctPassing[32],
      tph: r.throughputTph, kW: r.powerKw,
      f80: r.f80, reduction: r.reductionRatio, ecs: r.specificEnergyKwhT,
      regime: r.regime, valid: ok,
    });
    if (ok) kept++; else invalid++;
  }
}

writeFileSync(resolve(OUT, `${OUT_NAME}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
const meta = { nTotal: rows.length, nValid: kept, nInvalid: invalid, nPerMachine: N_PER_MACHINE, machines: MACHINES, seed: SEED,
  inputs: ['machine(one-hot×5)', 'cssMm', 'throwMm', 'speedRpm', 'feedX63Mm', 'feedM', 'oreAxb'],
  outputs: ['p80', 'p50', 'p20', 'pass1', 'pass4', 'pass8', 'pass16', 'pass32', 'tph', 'kW'] };
writeFileSync(resolve(OUT, `${OUT_NAME}-meta.json`), JSON.stringify(meta, null, 2));
console.log(`wrote ${OUT_NAME}.jsonl: ${rows.length} points (${kept} valid, ${invalid} invalid) across ${MACHINES.length} machines (seed ${SEED})`);
