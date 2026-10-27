// The campaign view's two functions (counterpart of data-pipeline/pipeline/model/crusher/campaign.py, held to it by the shared table
// tests/fixtures/campaign-reference.json). As the closed-side setting drifts open with liner wear the engine's P80 rises with it;
// cssAtP80Target finds the setting at which P80 reaches a target, the opening allowed before the product leaves its target is that
// setting minus the current one, and hoursToTarget divides it by a drift rate the user supplies. The product models no wear and asserts
// no drift rate: nothing here has a default for it (research report r-liner-wear-2026-10-27: no primary source for a liner wear rate or
// a CSS drift rate in mm/h; the only sourced practice is the re-set every 45 h of Ma, Fan and He, Appl. Sci. 2016,
// doi:10.3390/app6120404, p. 3).
//
// The caller passes the setting ceiling: the app uses the upper bound of the machine's training range (CSS_MAX_MM below, the css_mm
// upper bound of sweep.RANGES). The search runs over the settings the engine answers as a valid point, from the current setting up to
// the ceiling, on a fixed grid; a P80 that falls over that grid is no answer (null), never a guess.
import { evaluate } from './engine';
import type { Machine, Operating } from './types';

/** The upper bound of each machine's training range of the closed-side setting [mm] (sweep.RANGES, css_mm, the same numbers). */
export const CSS_MAX_MM: Record<Machine, number> = {
  'cone-sec': 90,
  'cone-tert': 22,
  jaw: 160,
  'cone-short-head': 16,
  gyratory: 240,
};

export const GRID_POINTS = 64;
export const BISECTION_STEPS = 60;
/** P80 may fall by this many floating-point steps (ulps) between two grid settings before the bracket counts as not monotone. */
export const MONOTONE_SLACK_ULPS = 4;

/** One unit in the last place of a positive double (math.ulp in Python). */
function ulp(x: number): number {
  return 2 ** (Math.floor(Math.log2(x)) - 52);
}

type Evaluator = (op: Operating) => { p80: number; valid: boolean };

/**
 * The smallest closed-side setting at or above the current one at which the engine's P80 reaches `p80TargetMm`.
 * Returns the current setting when its P80 is already at or above the target, and null when the point or an input is invalid, when
 * `cssMaxMm` is not above the current setting, when P80 is not monotone over the bracket, or when the target is not reached at a
 * valid setting at or below `cssMaxMm`. `run` is the engine call (the engine itself; a test passes another).
 */
export function cssAtP80Target(op: Operating, p80TargetMm: number, cssMaxMm: number, run: Evaluator = evaluate): number | null {
  if (!(Number.isFinite(p80TargetMm) && p80TargetMm > 0 && Number.isFinite(cssMaxMm) && Number.isFinite(op.cssMm))) return null;
  if (!(op.cssMm > 0 && cssMaxMm > op.cssMm)) return null;
  const at = (css: number): number | null => {
    const r = run({ ...op, cssMm: css });
    return !r.valid || !Number.isFinite(r.p80) || r.p80 <= 0 ? null : r.p80;
  };
  const p0 = at(op.cssMm);
  if (p0 === null) return null;
  if (p0 >= p80TargetMm) return op.cssMm;
  // the valid prefix of the bracket, checked for monotonicity
  let lastCss = op.cssMm;
  let lastP80 = p0;
  let prev = p0;
  for (let i = 1; i < GRID_POINTS; i++) {
    const css = op.cssMm + ((cssMaxMm - op.cssMm) * i) / (GRID_POINTS - 1);
    const p = at(css);
    if (p === null) break;
    if (p < prev - MONOTONE_SLACK_ULPS * ulp(prev)) return null;
    prev = p;
    lastCss = css;
    lastP80 = p;
  }
  if (lastP80 < p80TargetMm) return null;
  let lo = op.cssMm;
  let hi = lastCss;
  for (let i = 0; i < BISECTION_STEPS; i++) {
    const mid = (lo + hi) / 2;
    const pm = at(mid);
    if (pm === null || pm >= p80TargetMm) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Operating hours until the setting has opened by `deltaCssMm` at `driftMmPerH`; 0 when nothing remains to open. Null when either
 * number is not finite or the drift is not positive: a setting that does not drift never leaves its target.
 */
export function hoursToTarget(deltaCssMm: number, driftMmPerH: number): number | null {
  if (!(Number.isFinite(deltaCssMm) && Number.isFinite(driftMmPerH)) || driftMmPerH <= 0) return null;
  // nothing left to open is zero hours (a negative opening counts as none)
  return Math.max(deltaCssMm, 0) / driftMmPerH;
}
