// Catalog row trace, consumer side: the TypeScript engine at each manifest's operating point reproduces its committed
// trace (the canonical Python engine's output), summary and gradations, within the six significant digits the trace is
// written with. This is the one place the two engines meet in the App's contract, so it is where they are held together;
// the engine against its reference points (reference.test.ts) is the other. It runs on the provider tree and, once unit
// U3b-1 has baked it, on data/derived. The comparison is itself tested: a one percent change of one passing value fails it.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCHEMAS, type CaseIndex, type CaseManifest, type Trace } from '../lib/contract.types';
import { errorPct, liveT10, operatingOf } from '../workbench/model';
import { evaluate, gridEdges, gridMid } from './engine';
import { flagCodesOf } from './flags';
import { throughput } from './capacity';
import { classificationParams, classify } from './classification';
import type { CrusherResult } from './types';

const ROOTS: Array<[string, URL]> = [
  ['data/derived (the bake)', new URL('../../../data/derived/', import.meta.url)],
  ['docs/contracts/fixtures/data/derived (the provider)', new URL('../../../docs/contracts/fixtures/data/derived/', import.meta.url)],
];

/** Six significant digits are written, so a value is right to half a unit of its sixth digit: 5e-6 of itself at worst. */
const REL = 5e-6;
/** Values that are zero to six digits (a mass closure of 3e-16) compare in absolute terms. */
const ABS = 1e-12;

const near = (live: number, committed: number, abs = ABS): boolean => Math.abs(live - committed) <= REL * Math.abs(committed) + abs;

function series(label: string, live: number[], committed: number[], abs = ABS): string[] {
  if (live.length !== committed.length) return [`${label}: ${live.length} values live, ${committed.length} committed`];
  return live.flatMap((v, i) => (near(v, committed[i], abs) ? [] : [`${label}[${i}]: live ${v} != committed ${committed[i]}`]));
}

/**
 * The classification C(d) is a probability written to six decimals, and the producer baked it from the unrounded feed size
 * (FX02: x63 51.8614483896) while the manifest records it to six digits (51.8614). On the steep tail of C that input
 * rounding is worth 1.2e-6 (FX02 class 5: 0.010698 from the manifest, 0.010697 committed), so it compares to 2e-6
 * absolute; every other quantity, which the rounding moves by less than its own sixth digit, compares to six digits.
 */
const CLASSIFICATION_ABS = 2e-6;

/** Every difference between the live engine at the manifest's point and the committed trace and manifest metrics. */
export function compareTrace(m: CaseManifest, t: Trace, r: CrusherResult): string[] {
  const s = t.summary;
  const out: string[] = [];
  const scalar = (label: string, live: number, committed: number) => {
    if (!near(live, committed)) out.push(`${label}: live ${live} != committed ${committed}`);
  };
  out.push(...series('sieve_mm', gridEdges(), t.sieve_mm), ...series('mid_mm', gridMid(), t.mid_mm));
  out.push(...series('feed_passing', r.feed.passing, t.feed_passing), ...series('product_passing', r.product.passing, t.product_passing));
  out.push(...series('feed_mass', r.feed.mass, t.feed_mass), ...series('product_mass', r.product.mass, t.product_mass));
  const op = operatingOf(m.params);
  scalar('appearance_t10', liveT10(op, r.f80), t.appearance_t10);
  const pairs: Array<[string, number, number]> = [
    ['f80_mm', r.f80, s.f80_mm],
    ['p80_mm', r.p80, s.p80_mm],
    ['p50_mm', r.p50, s.p50_mm],
    ['p20_mm', r.p20, s.p20_mm],
    ['reduction_ratio', r.reductionRatio, s.reduction_ratio],
    ['throughput_tph', r.throughputTph, s.throughput_tph],
    ['power_kw', r.powerKw, s.power_kw],
    ['specific_energy_kwh_t', r.specificEnergyKwhT, s.specific_energy_kwh_t],
    ['oss_mm', r.ossMm, s.oss_mm],
    ['nip_angle_deg', r.nipAngleDeg, s.nip_angle_deg],
    ['nip_limit_deg', r.nipLimitDeg, s.nip_limit_deg],
    ['mass_closure', r.massClosure, s.mass_closure],
  ];
  for (const [label, live, committed] of pairs) scalar(`summary.${label}`, live, committed);
  for (const size of [1, 4, 8, 16, 32]) scalar(`summary.pct_passing.${size}`, r.pctPassing[size], s.pct_passing[String(size)]);
  if (typeof s.cond_estimate === 'number') scalar('summary.cond_estimate', r.condEstimate, s.cond_estimate);
  else if (Number.isFinite(r.condEstimate)) out.push(`summary.cond_estimate: live ${r.condEstimate} != committed ${s.cond_estimate}`);
  if (r.regime !== s.regime) out.push(`summary.regime: live ${r.regime} != committed ${s.regime}`);
  if (r.valid !== s.valid) out.push(`summary.valid: live ${r.valid} != committed ${s.valid}`);
  if (r.outOfEnvelope !== s.out_of_envelope) out.push(`summary.out_of_envelope: live ${r.outOfEnvelope} != committed ${s.out_of_envelope}`);
  if (r.implausible !== s.implausible) out.push(`summary.implausible: live ${r.implausible} != committed ${s.implausible}`);
  // the classification C(d) at the class mid-sizes is the engine's own selection function
  const params = classificationParams(op.machine, op.cssMm, { f80Mm: r.f80, calibrated: op.calibrated, throwMm: op.throwMm });
  out.push(...series('classification', gridMid().map((d) => classify(d, params)), t.classification, CLASSIFICATION_ABS));
  // the two sweeps are the engine at the point with one input varied
  const sp = t.speed_sweep;
  out.push(...series('speed_sweep.throughput_tph', sp.speed_rpm.map((v) => throughput(op.machine, op.cssMm, op.throwMm, v, op.calibrated)), sp.throughput_tph));
  out.push(...series('speed_sweep.power_kw', sp.speed_rpm.map((v) => evaluate({ ...op, speedRpm: v }).powerKw), sp.power_kw));
  const cs = t.css_sweep;
  const atCss = cs.css_mm.map((v) => evaluate({ ...op, cssMm: v }));
  out.push(...series('css_sweep.p80_mm', atCss.map((x) => x.p80), cs.p80_mm));
  out.push(...series('css_sweep.throughput_tph', atCss.map((x) => x.throughputTph), cs.throughput_tph));
  out.push(...series('css_sweep.power_kw', atCss.map((x) => x.powerKw), cs.power_kw));
  // the manifest's result scalars are the same numbers, and its flag codes the engine's
  const metrics: Array<[string, number]> = [
    ['p80_mm', r.p80],
    ['p50_mm', r.p50],
    ['p20_mm', r.p20],
    ['f80_mm', r.f80],
    ['reduction_ratio', r.reductionRatio],
    ['throughput_tph', r.throughputTph],
    ['power_kw', r.powerKw],
    ['specific_energy_kwh_t', r.specificEnergyKwhT],
  ];
  for (const [k, live] of metrics) scalar(`metrics.${k}`, live, m.metrics[k]);
  if (m.measured) {
    scalar('metrics.throughput_err_pct', errorPct(r.throughputTph, m.measured.feed_tph), m.metrics.throughput_err_pct);
    scalar('metrics.power_err_pct', errorPct(r.powerKw, m.measured.power_kw), m.metrics.power_err_pct);
  }
  if (flagCodesOf(r).join(',') !== m.flags.join(',')) out.push(`flags: live ${flagCodesOf(r).join(',')} != committed ${m.flags.join(',')}`);
  return out;
}

const readJSON = <T>(root: URL, rel: string): T => JSON.parse(readFileSync(new URL(rel, root), 'utf8')) as T;

for (const [label, root] of ROOTS) {
  const indexUrl = new URL('manifests/index.json', root);
  const baked = existsSync(indexUrl) && readJSON<{ schema?: string }>(root, 'manifests/index.json').schema === SCHEMAS.index;
  describe(`the live engine reproduces every case of ${label}`, () => {
    if (!baked) {
      it.skip('not checked: data/derived still holds the template example bake (unit U3b-1 bakes the product)', () => undefined);
      return;
    }
    const index = readJSON<CaseIndex>(root, 'manifests/index.json');
    for (const entry of index.cases) {
      it(`adversarial: ${entry.case_id} at its manifest's parameters equals its trace within six significant digits`, () => {
        const m = readJSON<CaseManifest>(root, entry.manifest_path);
        const t = readJSON<Trace>(root, m.artifact.path);
        const r = evaluate(operatingOf(m.params));
        expect(compareTrace(m, t, r)).toEqual([]);
      });
    }
  });
}

describe('the comparison is not vacuous', () => {
  const root = ROOTS[1][1];
  const index = readJSON<CaseIndex>(root, 'manifests/index.json');
  const entry = index.cases[0];
  const m = readJSON<CaseManifest>(root, entry.manifest_path);
  const t = readJSON<Trace>(root, m.artifact.path);
  const r = evaluate(operatingOf(m.params));

  it('adversarial: a one percent change of one product passing value fails the comparison, naming the value', () => {
    expect(compareTrace(m, t, r)).toEqual([]);
    const mid = Math.floor(t.product_passing.length / 2);
    const bad = structuredClone(t);
    bad.product_passing[mid] *= 1.01;
    const diffs = compareTrace(m, bad, r);
    expect(diffs.length).toBe(1);
    expect(diffs[0]).toContain(`product_passing[${mid}]`);
  });
  it('adversarial: a change in the seventh significant digit passes, in the fifth fails', () => {
    const lastDigit = structuredClone(t);
    lastDigit.summary.p80_mm *= 1 + 1e-7;
    expect(compareTrace(m, lastDigit, r)).toEqual([]);
    const fifth = structuredClone(t);
    fifth.summary.p80_mm *= 1 + 1e-4;
    expect(compareTrace(m, fifth, r).join('\n')).toContain('summary.p80_mm');
  });
  it('adversarial: a changed flag, regime or sweep value fails', () => {
    const flagged = structuredClone(m);
    flagged.flags = ['pass_through'];
    expect(compareTrace(flagged, t, r).join('\n')).toContain('flags:');
    const regime = structuredClone(t);
    regime.summary.regime = regime.summary.regime === 'choke' ? 'trickle' : 'choke';
    expect(compareTrace(m, regime, r).join('\n')).toContain('summary.regime');
    const sweep = structuredClone(t);
    sweep.speed_sweep.throughput_tph[3] *= 1.01;
    expect(compareTrace(m, sweep, r).join('\n')).toContain('speed_sweep.throughput_tph[3]');
  });
});
