// The shared engine reference: the producer side of the fixture tests/fixtures/engine-reference.json (schema
// chancadem.engine-reference/v1). The Python port in data-pipeline/pipeline/model/crusher/ is held to the same
// file by tests/test_crusher_engine.py, so the two engines cannot drift apart unnoticed.
//
//   CHANCADEM_WRITE_REFERENCE=1 npx vitest run src/engine/reference.test.ts   regenerates the fixture
//   npm test                                                                   checks that it still matches
//
// Equal rule: numbers within 1e-9 * max(1, |expected|), strings, booleans and lists of strings exactly. A
// non-finite number is written as the string "Infinity", "-Infinity" or "NaN" and compared as that string.
import { it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate } from './engine';
import type { Operating, CrusherResult, Machine } from './types';

const FIXTURE = fileURLToPath(new URL('../../../tests/fixtures/engine-reference.json', import.meta.url));
const SCHEMA = 'chancadem.engine-reference/v1';
const REL_TOL = 1e-9;

// ---- the inputs of the real-survey lane and the case matrix (they live outside this tree, in the app layer) ----
// HP500 constants and the operating point of a survey, as the app store builds it (opOfSurvey).
const HP500_NOMINAL = { throwMm: 34, speedRpm: 360 };
const HP500_BLEND_WI = 9.0;
const HP500_COMPACT_AXB = 677.3;
const x63FromF80 = (f80Mm: number, m = 0.9): number => f80Mm / Math.pow(Math.log(5), 1 / m);
// Table A1 of Rocha et al. 2024 as [survey, f80 mm, CSS mm].
const SURVEYS: Array<[number, number, number]> = [
  [1, 88, 54], [2, 84, 54], [3, 47, 48], [4, 88, 48], [5, 62, 48], [6, 79, 40], [7, 140, 38], [8, 123, 44], [9, 81, 40], [10, 81, 55],
];
const opOfSurvey = (cssMm: number, f80Mm: number): Operating => ({
  machine: 'cone-sec', cssMm, throwMm: HP500_NOMINAL.throwMm, speedRpm: HP500_NOMINAL.speedRpm,
  feedX63Mm: x63FromF80(f80Mm), feedM: 0.9, oreAxb: HP500_COMPACT_AXB, oreWi: HP500_BLEND_WI, calibrated: true,
});

// Per-machine reference regime (the store MACHINE_REF), with the S01 ore.
const MACHINE_REF: Record<Machine, Pick<Operating, 'cssMm' | 'throwMm' | 'speedRpm' | 'feedX63Mm'>> = {
  'cone-sec': { cssMm: 32, throwMm: 30, speedRpm: 360, feedX63Mm: 90 },
  'cone-tert': { cssMm: 8, throwMm: 16, speedRpm: 400, feedX63Mm: 28 },
  'cone-short-head': { cssMm: 8, throwMm: 16, speedRpm: 480, feedX63Mm: 28 },
  'gyratory': { cssMm: 165, throwMm: 30, speedRpm: 150, feedX63Mm: 600 },
  'jaw': { cssMm: 110, throwMm: 38, speedRpm: 290, feedX63Mm: 350 },
};
const MACHINES = Object.keys(MACHINE_REF) as Machine[];
const refOp = (machine: Machine): Operating => ({ machine, ...MACHINE_REF[machine], feedM: 1.2, oreAxb: 55, oreWi: 14 });

// The 17 cases of the case matrix: [id, machine, css, throw, speed, x63, m, axb, wi].
const CASES: Array<[string, Machine, number, number, number, number, number, number, number]> = [
  ['G01', 'gyratory', 165, 30, 150, 600, 0.8, 40, 16], ['G02', 'gyratory', 195, 32, 160, 700, 0.85, 78, 12],
  ['J01', 'jaw', 125, 40, 300, 400, 0.9, 42, 16], ['J02', 'jaw', 80, 36, 280, 300, 1.0, 55, 14],
  ['S01', 'cone-sec', 32, 30, 360, 90, 1.2, 55, 14], ['S02', 'cone-sec', 40, 32, 300, 120, 1.0, 80, 11],
  ['S03', 'cone-sec', 50, 30, 470, 130, 1.0, 38, 17], ['S04', 'cone-sec', 80, 36, 360, 180, 0.9, 40, 16],
  ['S05', 'cone-sec', 16, 26, 360, 55, 1.6, 55, 14], ['S06', 'cone-sec', 12, 22, 360, 60, 1.2, 55, 14],
  ['T01', 'cone-tert', 8, 16, 400, 28, 1.5, 55, 14], ['T02', 'cone-tert', 10, 18, 410, 32, 1.4, 38, 18],
  ['H01', 'cone-short-head', 6, 14, 500, 22, 1.6, 55, 14], ['H02', 'cone-short-head', 10, 16, 470, 30, 1.5, 36, 18],
  ['CP1', 'cone-sec', 160, 30, 360, 90, 1.2, 55, 14], ['CI1', 'cone-sec', 280, 30, 360, 90, 1.2, 55, 14],
  ['CK1', 'cone-sec', 25, 30, 350, 80, 1.15, 52, 15],
];

interface RefPoint { id: string; op: Operating }

/** The point list: every machine reference and its variations, the cases, the surveys and the branch controls. */
export function referencePoints(): RefPoint[] {
  const pts: RefPoint[] = [];
  const add = (id: string, op: Operating) => pts.push({ id, op });

  for (const m of MACHINES) {
    const r = refOp(m);
    add(`${m}:ref`, r);
    add(`${m}:css-tight`, { ...r, cssMm: r.cssMm * 0.6 });
    add(`${m}:css-open`, { ...r, cssMm: r.cssMm * 1.6 });
    add(`${m}:throw-short`, { ...r, throwMm: r.throwMm * 0.6 });
    add(`${m}:throw-long`, { ...r, throwMm: r.throwMm * 1.5 });
    add(`${m}:speed-low`, { ...r, speedRpm: r.speedRpm * 0.75 });
    add(`${m}:speed-high`, { ...r, speedRpm: r.speedRpm * 1.25 });
    add(`${m}:ore-soft`, { ...r, oreAxb: 85, oreWi: 10 });
    add(`${m}:ore-hard`, { ...r, oreAxb: 35, oreWi: 18 });
    add(`${m}:feed-coarse`, { ...r, feedX63Mm: r.feedX63Mm * 1.6 });
    add(`${m}:feed-fine`, { ...r, feedX63Mm: r.feedX63Mm * 0.6 });
  }

  for (const [id, machine, cssMm, throwMm, speedRpm, feedX63Mm, feedM, oreAxb, oreWi] of CASES) {
    add(`case:${id}`, { machine, cssMm, throwMm, speedRpm, feedX63Mm, feedM, oreAxb, oreWi });
  }

  for (const [n, f80, css] of SURVEYS) add(`hp500:${String(n).padStart(2, '0')}`, opOfSurvey(css, f80));

  // controls: each trips a branch of engine.ts, envelope.ts, classification.ts or an arithmetic edge case
  const s = refOp('cone-sec');
  add('ctl:pass-through-css-ge-f80', { ...s, cssMm: 140 });
  add('ctl:invalid-css-eq-top', { ...s, cssMm: 256 });
  add('ctl:invalid-css-gt-top-fine-feed', { ...s, cssMm: 300, feedX63Mm: 40 });
  add('ctl:ratio-one-valid', { ...s, feedM: 0 });
  add('ctl:feed-nonpositive-zero', { ...s, feedX63Mm: 0 });
  add('ctl:feed-nonpositive-negative', { ...s, feedX63Mm: -5 });
  add('ctl:css-zero', { ...s, cssMm: 0 });
  add('ctl:css-negative', { ...s, cssMm: -5 });
  add('ctl:feed-m-high', { ...s, feedM: 30 });
  add('ctl:feed-m-low', { ...s, feedM: 0.05 });
  add('ctl:feed-m-negative', { ...s, feedM: -1 });
  add('ctl:feed-x63-huge', { ...s, feedX63Mm: 1e6 });
  add('ctl:feed-x63-tiny', { ...s, feedX63Mm: 0.01 });
  add('ctl:css-tiny-hard-fast', { ...s, cssMm: 0.5, oreAxb: 1000, speedRpm: 2000, feedX63Mm: 200 });
  add('ctl:css-tiny-soft', { ...s, cssMm: 0.5, oreAxb: 1, speedRpm: 2000, feedX63Mm: 200 });
  add('ctl:throw-very-short-k2-floor', { ...s, throwMm: -200 });
  add('ctl:throw-zero', { ...s, throwMm: 0 });
  add('ctl:speed-zero', { ...s, speedRpm: 0 });
  add('ctl:speed-negative-overflow', { ...s, speedRpm: -300000 });
  add('ctl:ore-axb-zero', { ...s, oreAxb: 0 });
  add('ctl:ore-axb-huge-t10-cap', { ...s, oreAxb: 1e6 });
  add('ctl:ore-axb-negative-overflow', { ...s, oreAxb: -1e5 });
  add('ctl:ore-wi-zero', { ...s, oreWi: 0 });
  add('ctl:ore-wi-negative', { ...s, oreWi: -5 });
  // calibrated lane: support limits, implausible points and the other machines
  const c = opOfSurvey(48, 88);
  add('cal:css-above-support', { ...c, cssMm: 60 });
  add('cal:css-below-support', { ...c, cssMm: 30 });
  add('cal:f80-below-support', { ...c, feedX63Mm: x63FromF80(30) });
  add('cal:f80-above-support', { ...c, feedX63Mm: x63FromF80(170) });
  add('cal:both-outside-support', { ...c, cssMm: 60, feedX63Mm: x63FromF80(170) });
  add('cal:implausible-css-ge-f80', { ...c, cssMm: 120, feedX63Mm: x63FromF80(40) });
  add('cal:css-nonpositive', { ...c, cssMm: -3 });
  add('cal:feed-nonpositive', { ...c, feedX63Mm: -10 });
  add('cal:support-edge-low', { ...c, cssMm: 38, feedX63Mm: x63FromF80(47) });
  add('cal:support-edge-high', { ...c, cssMm: 55, feedX63Mm: x63FromF80(140) });
  for (const m of MACHINES) if (m !== 'cone-sec') add(`cal:machine-${m}`, { ...refOp(m), calibrated: true });
  add('cal:flag-false-explicit', { ...s, calibrated: false });
  return pts;
}

// ---- the feature encodings of surrogate.ts (not exported there: its module imports the ONNX runtime) ----
// The frozen scaler of the surrogate (data/derived/scaler.json: inMean, inStd) and of the autoencoder
// (data/derived/ae_scaler.json: mean, std), embedded in the fixture so both engines encode with the same numbers.
const SCALER = {
  inMean: [59.12966537475586, 26.003122329711914, 355.6756896972656, 188.49363708496094, 1.313321590423584, 70.57135009765625],
  inStd: [56.631683349609375, 10.287561416625977, 135.84506225585938, 198.72792053222656, 0.33907583355903625, 22.795068740844727],
  aeMean: [1.467167615890503, 1.1436902284622192, 0.448967844247818, 0.15786579251289368, 0.3134826123714447, 0.44715023040771484,
    0.593015193939209, 0.6932022571563721, 1062.06591796875, 175.29615783691406, 4.3613409996032715, 1.9716603755950928,
    0.7934262156486511, 1.313321590423584],
  aeStd: [0.547846794128418, 0.5997057557106018, 0.715634822845459, 0.11960113048553467, 0.23100346326828003, 0.31256452202796936,
    0.3597903251647949, 0.3327787518501282, 1354.9217529296875, 87.6966781616211, 4.075794219970703, 0.31735119223594666,
    0.2958548963069916, 0.33907583355903625],
};
const ENC_MACHINES: Machine[] = ['cone-sec', 'cone-tert', 'jaw', 'cone-short-head', 'gyratory'];
const CONT: (keyof Operating)[] = ['cssMm', 'throwMm', 'speedRpm', 'feedX63Mm', 'feedM', 'oreAxb'];

// surrogate.ts encodeInput: 5 one-hot + 6 standardised continuous, stored as float32.
function encodeInput(op: Operating): number[] {
  const x = new Float32Array(ENC_MACHINES.length + CONT.length);
  x[ENC_MACHINES.indexOf(op.machine)] = 1;
  for (let j = 0; j < CONT.length; j++) x[ENC_MACHINES.length + j] = ((op[CONT[j]] as number) - SCALER.inMean[j]) / SCALER.inStd[j];
  return Array.from(x);
}
// surrogate.ts aeFeats: the 14 raw autoencoder features of a result.
function aeFeats(r: CrusherResult): number[] {
  const L = (x: number) => Math.log10(Math.max(x, 1e-6));
  return [L(r.p80), L(r.p50), L(r.p20), r.pctPassing[1], r.pctPassing[4], r.pctPassing[8], r.pctPassing[16], r.pctPassing[32],
    r.throughputTph, r.powerKw, r.reductionRatio, L(r.f80), r.specificEnergyKwhT, r.op.feedM];
}
// surrogate.ts anomalyScore: the standardised features fed to the autoencoder, stored as float32.
function aeInput(f: number[]): number[] {
  const s = new Float32Array(14);
  for (let i = 0; i < 14; i++) s[i] = (f[i] - SCALER.aeMean[i]) / SCALER.aeStd[i];
  return Array.from(s);
}

// ---- fixture build, encode and compare ----
/** Replace every non-finite number by its string form so the JSON keeps it. */
function encodeNonFinite(v: unknown): unknown {
  if (typeof v === 'number') return Number.isFinite(v) ? v : Number.isNaN(v) ? 'NaN' : v > 0 ? 'Infinity' : '-Infinity';
  if (Array.isArray(v)) return v.map(encodeNonFinite);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encodeNonFinite(x)]));
  return v;
}

function buildFixture(): any {
  const points = referencePoints().map(({ id, op }) => {
    const { op: _op, ...result } = evaluate(op);
    const ae = aeFeats({ ...result, op } as CrusherResult);
    return { id, op, result, features: { input: encodeInput(op), ae, aeInput: aeInput(ae) } };
  });
  // a JSON round trip drops undefined fields (an absent `calibrated`), exactly as the committed file does
  return JSON.parse(JSON.stringify(encodeNonFinite({ schema: SCHEMA, scaler: SCALER, points })));
}

/** The Equal rule. Returns one line per difference, naming the path of the field. */
export function compareReference(expected: unknown, actual: unknown, path = '$'): string[] {
  if (typeof expected === 'number' && typeof actual === 'number') {
    return Math.abs(actual - expected) <= REL_TOL * Math.max(1, Math.abs(expected)) ? [] : [`${path}: ${actual} != ${expected}`];
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) return [`${path}: length ${actual.length} != ${expected.length}`];
    return expected.flatMap((e, i) => compareReference(e, actual[i], `${path}[${i}]`));
  }
  if (expected && actual && typeof expected === 'object' && typeof actual === 'object' && !Array.isArray(expected) && !Array.isArray(actual)) {
    const ek = Object.keys(expected as object).sort(), ak = Object.keys(actual as object).sort();
    if (ek.join('|') !== ak.join('|')) return [`${path}: keys ${ak.join(',')} != ${ek.join(',')}`];
    return ek.flatMap((k) => compareReference((expected as Record<string, unknown>)[k], (actual as Record<string, unknown>)[k], `${path}.${k}`));
  }
  return Object.is(expected, actual) ? [] : [`${path}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`];
}

if (process.env.CHANCADEM_WRITE_REFERENCE === '1') {
  mkdirSync(dirname(FIXTURE), { recursive: true });
  const f = buildFixture();   // one point per line keeps the diff of a regenerated fixture readable
  const body = f.points.map((p: unknown) => JSON.stringify(p)).join(',\n');
  writeFileSync(FIXTURE, `{"schema":${JSON.stringify(f.schema)},"scaler":${JSON.stringify(f.scaler)},"points":[\n${body}\n]}\n`, 'utf8');
}

const committed = (): any => JSON.parse(readFileSync(FIXTURE, 'utf8'));

it('adversarial: the TypeScript engine reproduces the committed engine reference', () => {
  const diffs = compareReference(committed(), buildFixture());
  assert.deepEqual(diffs.slice(0, 20), [], `the engine drifted from tests/fixtures/engine-reference.json (${diffs.length} differences); regenerate with CHANCADEM_WRITE_REFERENCE=1 only if the change is intended`);
});

it('adversarial: the comparison is not vacuous (a 1e-6 relative change of one p80 or a removed flag fails it)', () => {
  const fixture = committed();
  const good = buildFixture();
  assert.deepEqual(compareReference(fixture, good), [], 'unmutated copy compares equal');
  const mutated = structuredClone(fixture);
  mutated.points[0].result.p80 *= 1 + 1e-6;
  const d = compareReference(mutated, good);
  assert.ok(d.length === 1 && d[0].includes('points[0].result.p80'), `p80 perturbation detected: ${d}`);
  const flagged = structuredClone(fixture);
  const idx = flagged.points.findIndex((p: { result: { flags: string[] } }) => p.result.flags.length > 0);
  flagged.points[idx].result.flags.pop();
  assert.ok(compareReference(flagged, good).length > 0, 'a removed flag string is detected');
  const feat = structuredClone(fixture);
  feat.points[0].features.input[6] += 1e-6;
  assert.ok(compareReference(feat, good).length > 0, 'a feature perturbation is detected');
});

it('the fixture covers every reachable branch of the engine, calibrated and not, on all five machines', () => {
  const pts = committed().points as Array<{ id: string; op: Operating; result: Record<string, any> }>;
  assert.ok(pts.length >= 60, `at least 60 points (${pts.length})`);
  const hit = (pred: (p: (typeof pts)[number]) => boolean) => pts.filter(pred).length;
  const checks: Record<string, number> = {
    'regime choke': hit((p) => p.result.regime === 'choke'),
    'regime pass-through': hit((p) => p.result.regime === 'pass-through'),
    'regime invalid': hit((p) => p.result.regime === 'invalid'),
    'valid true': hit((p) => p.result.valid === true),
    'valid false': hit((p) => p.result.valid === false),
    'flag CSS >= feed top': hit((p) => p.result.flags.some((f: string) => f.startsWith('CSS ≥ feed top'))),
    'flag CSS >= F80': hit((p) => p.result.flags.some((f: string) => f.startsWith('CSS ≥ F80'))),
    'flag reduction ratio': hit((p) => p.result.flags.some((f: string) => f.startsWith('reduction ratio'))),
    'flag reduction ratio on a valid point': hit((p) => p.result.valid && p.result.flags.some((f: string) => f.startsWith('reduction ratio'))),
    'calibrated': hit((p) => p.op.calibrated === true),
    'not calibrated': hit((p) => !p.op.calibrated),
    'calibrated non cone-sec': hit((p) => p.op.calibrated === true && p.op.machine !== 'cone-sec'),
    'outOfEnvelope': hit((p) => p.result.outOfEnvelope === true),
    'implausible': hit((p) => p.result.implausible === true),
    'non-finite field': hit((p) => JSON.stringify(p.result).includes('"NaN"') || JSON.stringify(p.result).includes('Infinity')),
  };
  for (const code of ['f80_lt_css', 'css_nonpositive', 'feed_nonpositive', 'css_outside_calibrated', 'f80_outside_calibrated']) {
    checks[`envelope code ${code}`] = hit((p) => p.result.envelopeCodes.includes(code));
  }
  for (const m of MACHINES) {
    checks[`machine ${m}`] = hit((p) => p.op.machine === m);
    checks[`machine ${m} valid`] = hit((p) => p.op.machine === m && p.result.valid === true);
  }
  for (const [name, n] of Object.entries(checks)) assert.ok(n > 0, `branch not hit by any fixture point: ${name}`);
  // 'ill-conditioned breakage matrix near choke' and the singular-pivot fallback are unreachable: the matrix
  // I - B*C is unit-diagonal with row sums in [1, 28], so the proxy stays below 28 (see the E1 report)
});
