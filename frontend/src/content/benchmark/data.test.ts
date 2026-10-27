// The Benchmark page's arithmetic against the committed documents themselves (read from data/derived), not against numbers typed here.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HP500_ENVELOPE } from '../../engine/envelope';
import type { Hp500Backbone, Hp500Loo, SurrogateModel } from '../../lib/contract.types';
import { operatingOf } from '../../workbench/model';
import { applicability, NotApplicableError, notApplicableText, predictSurrogate } from '../../lib/ort';
import type { CaseManifest } from '../../lib/contract.types';
import { envelopeDistance, errPct, optimismGap, robustnessPoints, scoresOf, spearman } from './data';
import { engineReadings, runSurvey } from './runs';

const read = <T>(rel: string): T => JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../data/derived/${rel}`, import.meta.url)), 'utf8')) as T;
const loo = read<Hp500Loo>('hp500/loo.json');
const backbone = read<Hp500Backbone>('hp500/backbone.json');
const surrogate = read<SurrogateModel>('models/surrogate.json');

describe('the Benchmark arithmetic', () => {
  it('the optimism gap is the strict MAPE minus the leaky one', () => {
    for (const target of ['tph', 'kW'] as const) {
      expect(optimismGap(loo, target, 'M1_residual')).toBeCloseTo(scoresOf(loo, target, 'strict', 'M1_residual').mape_pct - scoresOf(loo, target, 'leaky', 'M1_residual').mape_pct, 10);
    }
  });

  it('the signed error of the stored predictions reproduces the stored strict MAPE of M0', () => {
    for (const target of ['tph', 'kW'] as const) {
      const t = loo.loo[target];
      const mape = (t.measured.reduce((s, m, i) => s + Math.abs(errPct(t.strict.pred.M0[i], m)), 0) / t.measured.length);
      expect(mape).toBeCloseTo(t.strict.M0_backbone.mape_pct, 1);
    }
  });

  it('the envelope distance is 0 at the centre, 1 at an edge and ranks the surveys', () => {
    const [cLo, cHi] = HP500_ENVELOPE.cssMm;
    const [fLo, fHi] = HP500_ENVELOPE.f80Mm;
    expect(envelopeDistance((cLo + cHi) / 2, (fLo + fHi) / 2)).toBe(0);
    expect(envelopeDistance(cLo, (fLo + fHi) / 2)).toBeCloseTo(1, 12);
    expect(envelopeDistance((cLo + cHi) / 2, fHi)).toBeCloseTo(1, 12);
    const pts = robustnessPoints(loo, backbone);
    expect(pts).toHaveLength(loo.n);
    expect(pts.map((p) => p.distance)).toEqual([...pts.map((p) => p.distance)].sort((a, b) => a - b));
    expect(Math.max(...pts.map((p) => p.distance))).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('refuses two documents that disagree on a measurement', () => {
    const bad: Hp500Backbone = { ...backbone, surveys: backbone.surveys.map((s, i) => (i === 0 ? { ...s, measured: { ...s.measured, feed_tph: s.measured.feed_tph + 1 } } : s)) };
    expect(() => robustnessPoints(loo, bad)).toThrow(/disagree/);
  });

  it('the rank correlation handles ties and the extremes', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 12);
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1, 12);
    expect(spearman([1, 1, 1, 1], [1, 2, 3, 4])).toBeNull();
    expect(spearman([1, 2, 2, 3], [1, 2, 3, 4])).not.toBeNull();
  });

  it('adversarial: every measured survey is a calibrated case the surrogate does not apply to, so the page computes no surrogate number for it', async () => {
    for (let n = 1; n <= 10; n++) {
      const id = `HP500-${String(n).padStart(2, '0')}`;
      const manifest = read<CaseManifest>(`manifests/${id}.json`);
      const run = await runSurvey(manifest, surrogate);
      expect(run.rule, id).toEqual({ applies: false, reasons: ['calibrated_case'] });
      expect(Object.keys(run), id).not.toContain('surrogate');
      await expect(predictSurrogate(surrogate, run.op), id).rejects.toBeInstanceOf(NotApplicableError);
      const text = notApplicableText(run.op, surrogate, run.rule as NonNullable<typeof run.rule>, { en: 'the engine', es: 'el motor' });
      expect(text.en).toContain('do not apply and the engine answers');
      expect(text.es).toContain('muestreo');
    }
    expect((await runSurvey(read<CaseManifest>('manifests/HP500-01.json'), null)).rule).toBeNull();
  });

  it('the same survey, uncalibrated, is refused for its ore competence: the range of the contract decides', () => {
    const run = read<CaseManifest>('manifests/HP500-01.json');
    const { calibrated: _calibrated, ...op } = operatingOf(run.params);
    void _calibrated;
    expect(applicability(op, surrogate)).toEqual({ applies: false, reasons: ['outside_training_range:ore_axb'] });
  });

  it('the live engine reproduces the committed backbone at each survey (calibrated lane) and the generic lane differs from it', () => {
    for (const s of backbone.surveys) {
      const params = {
        machine: 'cone-sec' as const,
        css_mm: s.measured.css_mm,
        throw_mm: 34,
        speed_rpm: 360,
        feed_x63_mm: 82,
        feed_m: 0.9,
        ore_axb: 677.3,
        ore_wi: 9,
        calibrated: true,
      };
      const r = engineReadings(operatingOf(params as Parameters<typeof operatingOf>[0]));
      // the throughput of the calibrated lane is a function of the setting, throw and speed alone, as in the backbone document
      expect(r.calibrated.tph).toBeCloseTo(s.backbone.throughput_tph, 0);
      expect(r.generic.tph).not.toBeCloseTo(r.calibrated.tph, 0);
    }
  });
});
