// The live runs of the Benchmark page: the calibrated engine, the generic engine and the surrogate at a survey's measured operating
// point, in this browser. The surrogate emulates the generic engine (the canonical engine with no HP500 calibration, the one its
// training sweep ran), so the generic run is the fair reference for it; the calibrated run is the backbone CrusherCal validates.
import { evaluate } from '../../engine/engine';
import type { Operating } from '../../engine/types';
import type { CaseManifest, SurrogateModel } from '../../lib/contract.types';
import { predictSurrogate, type SurrogateOutput } from '../../lib/ort';
import { operatingOf } from '../../workbench/model';
import { outsideRanges, trainingRanges, type SurrogateInputName } from './data';

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
  /** The surrogate's answer; null when the slot has no released model (the engine answers). */
  surrogate: EngineReading | null;
  /** The inputs of this survey outside the surrogate's training range for the machine; null when the contract text does not carry the machine. */
  outside: SurrogateInputName[] | null;
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
  let surrogate: EngineReading | null = null;
  let outside: SurrogateInputName[] | null = null;
  if (contract) {
    const y: Record<SurrogateOutput, number> = await predictSurrogate(contract, op);
    surrogate = { tph: y.throughput_tph, kw: y.power_kw, p80: y.p80_mm };
    const ranges = trainingRanges(contract.training.sampler, op.machine);
    outside = ranges ? outsideRanges(op, ranges) : null;
  }
  return { id: manifest.case_id, n: m.survey, measured: { tph: m.feed_tph, kw: m.power_kw, f80: m.f80_mm, css: m.css_mm }, calibrated, generic, surrogate, outside };
}
