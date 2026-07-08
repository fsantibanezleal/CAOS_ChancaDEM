// Invariant tests for the live crusher-physics engine. These are the physics-asserts the manifest requires:
// mass closure, monotone classification, strictly-lower breakage, the CSS↓⇒finer trend, the capacity hump, and
// the pass-through / invalid guards. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, gridEdges, gridMid } from '../src/physics/engine';
import { classificationParams, classify } from '../src/physics/classification';
import { breakageMatrix, phiFromT10 } from '../src/physics/breakage';
import { throughput } from '../src/physics/capacity';
import { makeFeed } from '../src/physics/feed';
import type { Operating } from '../src/physics/types';

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

test('more throw (more energy) gives an equal-or-finer product', () => {
  const lo = evaluate({ ...base, throwMm: 16 }).p80;
  const hi = evaluate({ ...base, throwMm: 44 }).p80;
  assert.ok(hi <= lo + 1e-9, `more throw ⇒ finer: throw16 P80=${lo}, throw44 P80=${hi}`);
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
