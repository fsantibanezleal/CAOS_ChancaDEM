// Invariant tests for the live crusher-physics engine. These are the physics-asserts the manifest requires:
// mass closure, monotone classification, strictly-lower breakage, the CSS↓⇒finer trend, the capacity hump, and
// the pass-through / invalid guards. Run: npm test
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { evaluate, gridEdges, gridMid } from './engine';
import { classificationParams, classify } from './classification';
import { breakageMatrix, phiFromT10 } from './breakage';
import { throughput } from './capacity';
import { makeFeed, rosinRammlerSizeAt } from './feed';
import { checkEnvelope } from './envelope';
import { checkBounds, MIN_VENDOR_CSS_MM, MAX_TYPICAL_REDUCTION_RATIO } from './bounds';
import type { Operating } from './types';

const base: Operating = {
  machine: 'cone-sec', cssMm: 32, throwMm: 30, speedRpm: 360,
  feedX63Mm: 90, feedM: 1.1, oreAxb: 55, oreWi: 14,
};

test('feed PSD normalizes and F80 is sensible', () => {
  const feed = makeFeed(gridEdges(), 90, 1.1);
  const sum = feed.mass.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `feed mass Σ=${sum}`);
  assert.ok(feed.passing[0] >= 0.99, 'coarsest edge passes ~100%');
});

test('classification is monotone non-decreasing, C(small)=0, C(large)=1', () => {
  const cp = classificationParams('cone-sec', 32);
  let prev = -1;
  for (const d of gridMid()) {
    const c = classify(d, cp);
    assert.ok(c >= 0 && c <= 1, `C in [0,1]: ${c}`);
    // mid is descending (coarse→fine); classify increases with size, so walking fine→coarse increases
  }
  assert.equal(classify(cp.k1 * 0.5, cp), 0, 'below K1 → 0');
  assert.equal(classify(cp.k2 * 2, cp), 1, 'above K2 → 1');
  // explicit monotonicity over ascending sizes
  const sizes = [...gridMid()].sort((a, b) => a - b);
  for (const d of sizes) { const c = classify(d, cp); assert.ok(c >= prev - 1e-12, 'monotone'); prev = c; }
});

test('breakage matrix is strictly lower-triangular and columns conserve mass', () => {
  const edges = gridEdges(), mid = gridMid(), n = mid.length;
  const B = breakageMatrix(edges, mid, phiFromT10(0.35));
  for (let j = 0; j < n; j++) {
    let col = 0;
    for (let i = 0; i < n; i++) {
      if (i <= j) assert.equal(B[i * n + j], 0, `strictly lower: B[${i}][${j}]`);
      col += B[i * n + j];
    }
    if (j < n - 1) assert.ok(Math.abs(col - 1) < 1e-9, `column ${j} sums to 1 (got ${col})`);
  }
});

test('Whiten solve conserves mass (closure ~0) and product normalizes', () => {
  const r = evaluate(base);
  assert.ok(r.massClosure < 1e-6, `mass closure ${r.massClosure}`);
  const sum = r.product.mass.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `product Σ=${sum}`);
  assert.ok(isFinite(r.condEstimate), 'conditioning finite for a nominal point');
});

test('product is finer than feed (reduction ratio > 1)', () => {
  const r = evaluate(base);
  assert.ok(r.p80 < r.f80, `P80 ${r.p80} < F80 ${r.f80}`);
  assert.ok(r.reductionRatio > 1, `RR ${r.reductionRatio}`);
});

test('tighter CSS gives a finer product (monotone P80 vs CSS)', () => {
  const p80s = [16, 24, 32, 50, 80].map((css) => evaluate({ ...base, cssMm: css }).p80);
  for (let i = 1; i < p80s.length; i++) assert.ok(p80s[i] >= p80s[i - 1] - 1e-9, `P80 rises with CSS: ${p80s}`);
});

test('more throw widens OSS and gives an equal-or-COARSER product (Evertsson/Andersen), with higher capacity', () => {
  // At fixed CSS, a larger eccentric throw opens the chamber wider (OSS = CSS + throw), so larger particles
  // escape during the open phase: the product coarsens, the reduction ratio drops, and capacity rises. This is
  // the OEM/Evertsson direction; routing throw into the per-nip energy (the old model) wrongly made it finer.
  const lo = evaluate({ ...base, throwMm: 16 });
  const hi = evaluate({ ...base, throwMm: 44 });
  assert.ok(hi.p80 >= lo.p80 - 1e-9, `more throw ⇒ coarser: throw16 P80=${lo.p80}, throw44 P80=${hi.p80}`);
  assert.ok(hi.reductionRatio <= lo.reductionRatio + 1e-9, `more throw ⇒ lower reduction ratio: ${lo.reductionRatio} → ${hi.reductionRatio}`);
  assert.ok(hi.throughputTph >= lo.throughputTph - 1e-9, `more throw ⇒ higher capacity: ${lo.throughputTph} → ${hi.throughputTph}`);
  assert.ok(Math.abs(hi.ossMm - (base.cssMm + 44)) < 1e-9, `OSS = CSS + throw (got ${hi.ossMm})`);
});

test('throw is neutral at the machine design throw (reference baseline preserved)', () => {
  // K2 gains the throw term centered on the machine design throw (cone-sec 30 mm), so at the design throw the
  // classification window (and hence the product) is identical to the pre-throw-model baseline.
  const cpDesign = classificationParams('cone-sec', 32, { throwMm: 30 });
  const cpNone = classificationParams('cone-sec', 32);
  assert.ok(Math.abs(cpDesign.k2 - cpNone.k2) < 1e-9, `K2 unchanged at design throw (${cpDesign.k2} vs ${cpNone.k2})`);
});

test('capacity is unimodal in speed (the hump rises then falls)', () => {
  const speeds = [180, 270, 360, 450, 540];
  const q = speeds.map((s) => throughput('cone-sec', 32, 30, s));
  const peak = q.indexOf(Math.max(...q));
  assert.ok(peak > 0 && peak < q.length - 1, `hump interior (q=${q.map((v) => v.toFixed(0))})`);
  for (let i = 1; i <= peak; i++) assert.ok(q[i] >= q[i - 1], 'rising to peak');
  for (let i = peak + 1; i < q.length; i++) assert.ok(q[i] <= q[i - 1], 'falling after peak');
});

test('pass-through / invalid guard fires when CSS ≥ feed top size', () => {
  const r = evaluate({ ...base, cssMm: 300 });   // wider than the 256mm grid top
  assert.equal(r.valid, false);
  assert.ok(r.flags.length > 0, 'flags populated');
});

test('throughput and power are positive and finite for a valid point', () => {
  const r = evaluate(base);
  assert.ok(r.throughputTph > 0 && isFinite(r.throughputTph), `tph ${r.throughputTph}`);
  assert.ok(r.powerKw > 0 && isFinite(r.powerKw), `kW ${r.powerKw}`);
});

test('envelope gate: a valid in-support point is inside the envelope', () => {
  const r = evaluate(base);
  assert.equal(r.outOfEnvelope, false, 'base point is in-envelope');
  assert.equal(r.implausible, false);
  assert.equal(r.envelopeCodes.length, 0);
});

test('envelope gate: an implausible point (CSS >= feed F80) is flagged AND marked invalid', () => {
  // wide setting relative to a fine feed -> f80 < CSS -> physically nonsensical
  const r = evaluate({ ...base, cssMm: 120, feedX63Mm: 40 });
  assert.equal(r.implausible, true, 'implausible flagged');
  assert.equal(r.outOfEnvelope, true);
  assert.equal(r.valid, false, 'implausible => invalid (no confident number)');
  assert.ok(r.envelopeCodes.includes('f80_lt_css'));
});

test('envelope gate: calibrated lane flags out-of-support CSS/f80 as extrapolating (not implausible)', () => {
  // calibrated HP500 support is CSS [38,55], f80 [47,140]; CSS 60 with a coarse feed extrapolates
  const r = evaluate({ ...base, machine: 'cone-sec', cssMm: 60, feedX63Mm: 120, calibrated: true });
  assert.equal(r.outOfEnvelope, true, 'extrapolation flagged');
  assert.ok(r.envelopeCodes.includes('css_outside_calibrated'), `codes ${r.envelopeCodes}`);
  assert.equal(r.implausible, false, 'extrapolation is not implausible');
});

test('envelope gate: the 10 real HP500 surveys are all physically plausible', () => {
  const surveys: Array<[number, number]> = [[54, 88], [54, 84], [48, 47], [48, 88], [48, 62], [40, 79], [38, 140], [44, 123], [40, 81], [55, 81]];
  for (const [css, f80] of surveys) {
    const r = evaluate({ ...base, machine: 'cone-sec', cssMm: css, feedX63Mm: f80 * 1.4, calibrated: true });
    assert.equal(r.implausible, false, `survey CSS ${css} f80 ${f80} not implausible`);
  }
});

// N1: the envelope gate tests the feed's declared (untruncated) F80, not the F80 the 256 mm grid truncates.
const x63Of = (f80: number, m = 0.9): number => f80 / Math.pow(Math.log(5), 1 / m);
const calibrated = (css: number, f80: number): Operating => ({
  ...base, machine: 'cone-sec', cssMm: css, throwMm: 34, speedRpm: 360, feedX63Mm: x63Of(f80), feedM: 0.9, oreAxb: 677.3, oreWi: 9, calibrated: true,
});

test('envelope gate: a calibrated point with a declared F80 of 180 mm is outside the support although the grid truncates it', () => {
  assert.ok(Math.abs(rosinRammlerSizeAt(0.8, x63Of(180), 0.9) - 180) < 1e-6);
  const r = evaluate(calibrated(48, 180));
  assert.ok(r.f80 < 140, `the truncated grid F80 ${r.f80} stays the model value`);
  assert.ok(r.envelopeCodes.includes('f80_outside_calibrated'), `codes ${r.envelopeCodes}`);
  assert.equal(r.implausible, false);
});

test('envelope gate: the 10 real surveys keep their codes with the declared F80 (survey 7 sits on the 140 mm edge)', () => {
  const surveys: Array<[number, number]> = [[54, 88], [54, 84], [48, 47], [48, 88], [48, 62], [40, 79], [38, 140], [44, 123], [40, 81], [55, 81]];
  for (const [css, f80] of surveys) {
    const codes = evaluate(calibrated(css, f80)).envelopeCodes;
    assert.ok(!codes.includes('f80_outside_calibrated'), `survey ${css}/${f80}: ${codes}`);
    assert.equal(codes.includes('f80_lt_css'), css >= f80, `survey ${css}/${f80}: ${codes}`);
  }
});

test('envelope gate: checkEnvelope takes the declared F80 as a third argument, defaulting to the engine one', () => {
  const op = calibrated(48, 88);
  assert.deepEqual(checkEnvelope(op, 100).codes, []);
  assert.deepEqual(checkEnvelope(op, 100, 180).codes, ['f80_outside_calibrated']);
  assert.deepEqual(checkEnvelope(op, 100, 100).codes, []);
});

// I1 (BL-019): the sourced setting and reduction-ratio warnings, the mirror of tests/test_crusher_engine.py.
const CSS_CODE = 'css_below_vendor_minimum';
const RATIO_CODE = 'reduction_ratio_above_typical';
const pt = (machine: Operating['machine'], cssMm: number, feedX63Mm: number): Operating => ({
  ...base, machine, cssMm, throwMm: 30, speedRpm: 360, feedX63Mm, feedM: 1.2,
});

test('setting bounds: a cone-sec at CSS 1 mm warns with both codes and stays valid', () => {
  const r = evaluate(pt('cone-sec', 1, 90));
  assert.equal(r.valid, true);
  assert.equal(r.implausible, false);
  assert.equal(r.outOfEnvelope, false);
  assert.ok(r.flags.includes(CSS_CODE) && r.flags.includes(RATIO_CODE), `flags ${r.flags}`);
  assert.deepEqual(r.envelopeCodes, []);
});

test('setting bounds: the minimum is strict, per machine, and the gyratory has none', () => {
  assert.ok(!evaluate(pt('cone-sec', 16, 40)).flags.includes(CSS_CODE));
  assert.ok(evaluate(pt('cone-sec', 15.99, 40)).flags.includes(CSS_CODE));
  assert.ok(evaluate(pt('jaw', 39, 200)).flags.includes(CSS_CODE));
  assert.ok(!evaluate(pt('jaw', 40, 200)).flags.includes(CSS_CODE));
  for (const m of ['cone-tert', 'cone-short-head'] as const) {
    assert.ok(evaluate(pt(m, 5.99, 28)).flags.includes(CSS_CODE), m);
    assert.ok(!evaluate(pt(m, 6, 28)).flags.includes(CSS_CODE), m);
  }
  for (const css of [1, 20, 100, 165]) assert.ok(!evaluate(pt('gyratory', css, 600)).flags.includes(CSS_CODE), `gyratory ${css}`);
});

test('setting bounds: the ceilings are strict and sourced per machine', () => {
  assert.deepEqual(MIN_VENDOR_CSS_MM, { 'cone-sec': 16, 'cone-tert': 6, 'cone-short-head': 6, jaw: 40 });
  assert.deepEqual(MAX_TYPICAL_REDUCTION_RATIO, { 'cone-sec': 5, 'cone-tert': 4, 'cone-short-head': 4, jaw: 4, gyratory: 4 });
  for (const [m, ceiling] of Object.entries(MAX_TYPICAL_REDUCTION_RATIO)) {
    assert.ok(!checkBounds(m as Operating['machine'], 1000, ceiling).includes(RATIO_CODE), `${m} at the ceiling`);
    assert.ok(checkBounds(m as Operating['machine'], 1000, ceiling + 1e-9).includes(RATIO_CODE), `${m} above the ceiling`);
  }
  assert.deepEqual(checkBounds('cone-sec', 16, 5), []);
  assert.deepEqual(checkBounds('cone-sec', 15.9, 5.1), [CSS_CODE, RATIO_CODE]);
});

test('setting bounds: a warned point stays valid on every machine', () => {
  const cases: Array<[Operating['machine'], number, number]> = [['cone-sec', 1, 90], ['cone-tert', 2, 28], ['cone-short-head', 2, 28], ['jaw', 10, 350], ['gyratory', 2, 600]];
  for (const [m, css, x63] of cases) {
    const r = evaluate({ ...pt(m, css, x63), throwMm: 20, speedRpm: 300 });
    assert.ok(r.flags.includes(RATIO_CODE), m);
    assert.equal(r.valid, true, `${m}: ${r.flags}`);
  }
});
