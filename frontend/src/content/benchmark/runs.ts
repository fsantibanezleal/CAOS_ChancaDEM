// The live runs of the Benchmark page: the calibrated engine and the generic engine at a survey's measured operating point, in this
// browser, and the verdict of the applicability rule for the learned surrogate. The surrogate emulates the generic engine (the
// canonical engine with no HP500 calibration, the one its training sweep ran); a measured survey runs the calibrated engine, so
// the rule says the surrogate does not apply and it is not graded there: no surrogate number is computed for a survey.
import { evaluate } from '../../engine/engine';
import type { Operating } from '../../engine/types';
import type { CaseManifest, SurrogateModel } from '../../lib/contract.types';
import { applicability, type Applicability } from '../../lib/ort';
import { operatingOf } from '../../workbench/model';

export interface EngineReading {
  tph: number;
  kw: number;
  p80: number;
}

export interface SurveyRun {
  id: string;
  n: number;
  measured: { tph: number; kw: number; f80: number; css: number };
  calibrated: EngineReading;
  generic: EngineReading;
  /** The operating point of the survey (calibrated, as the case is). */
  op: Operating;
  /** The applicability rule for the released surrogate at this survey; null when the slot has no released model (the engine answers). */
  rule: Applicability | null;
}

const reading = (r: { throughputTph: number; powerKw: number; p80: number }): EngineReading => ({ tph: r.throughputTph, kw: r.powerKw, p80: r.p80 });

/** The engine at the survey's operating point, calibrated as the case is, and with no calibration. */
export function engineReadings(op: Operating): { calibrated: EngineReading; generic: EngineReading } {
  const calibrated = reading(evaluate(op));
  const { calibrated: _flag, ...rest } = op;
  void _flag;
  const generic = reading(evaluate(rest));
  return { calibrated, generic };
}

/** A survey run; `contract` is the released surrogate's contract, or null when its slot is answered by the engine. */
export async function runSurvey(manifest: CaseManifest, contract: SurrogateModel | null): Promise<SurveyRun> {
  const m = manifest.measured;
  if (!m) throw new Error(`${manifest.case_id} carries no measured values`);
  const op = operatingOf(manifest.params);
  const { calibrated, generic } = engineReadings(op);
  const rule = contract ? applicability(op, contract) : null;
  return { id: manifest.case_id, n: m.survey, measured: { tph: m.feed_tph, kw: m.power_kw, f80: m.f80_mm, css: m.css_mm }, calibrated, generic, op, rule };
}
