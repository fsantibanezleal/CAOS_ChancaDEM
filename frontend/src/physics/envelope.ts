// Validated-envelope gate (a negative control wired into the engine). An empirical model must FLAG implausible or
// out-of-calibration inputs, never emit a confident number for them. Two layers:
//
//  1. PHYSICALLY IMPLAUSIBLE (any lane): f80 < CSS (the feed is finer than the setting, nothing is gripped),
//     CSS <= 0, or a non-positive feed size. These are not "extrapolation", they are nonsensical operating points.
//  2. OUT OF CALIBRATED ENVELOPE (the Real / calibrated HP500 lane): the Rocha et al. 2024 fit is only supported
//     over CSS in [38, 55] mm and f80 in [47, 140] mm on itabirite iron ore. Outside that the Table-5 calibration
//     is an extrapolation and the readout must say so rather than pretend accuracy.
//
// The engine returns stable CODES; the UI maps them to bilingual text (so the physics core stays language-agnostic).

import type { Operating } from './types';

/** The calibrated support of the HP500 secondary-cone fit (Rocha et al. 2024, the 10-survey range). */
export const HP500_ENVELOPE = { cssMm: [38, 55] as const, f80Mm: [47, 140] as const };

export type EnvelopeCode =
  | 'f80_lt_css'
  | 'css_nonpositive'
  | 'feed_nonpositive'
  | 'css_outside_calibrated'
  | 'f80_outside_calibrated';

export interface EnvelopeCheck {
  /** true only when every check passes (physically valid AND, on the calibrated lane, inside the fitted support). */
  inEnvelope: boolean;
  /** true when a physically-implausible input was found (worse than mere extrapolation). */
  implausible: boolean;
  codes: EnvelopeCode[];
}

/** Gate an operating point. `f80` is the engine-computed feed 80%-passing size [mm] (the real gripped-size scale). */
export function checkEnvelope(op: Operating, f80Mm: number): EnvelopeCheck {
  const codes: EnvelopeCode[] = [];
  let implausible = false;

  if (!(op.cssMm > 0)) { codes.push('css_nonpositive'); implausible = true; }
  if (!(op.feedX63Mm > 0)) { codes.push('feed_nonpositive'); implausible = true; }
  if (f80Mm > 0 && op.cssMm >= f80Mm) { codes.push('f80_lt_css'); implausible = true; }

  // calibrated-support checks apply only on the Real / calibrated cone-sec lane
  if (op.calibrated && op.machine === 'cone-sec') {
    const [cLo, cHi] = HP500_ENVELOPE.cssMm;
    const [fLo, fHi] = HP500_ENVELOPE.f80Mm;
    if (op.cssMm < cLo || op.cssMm > cHi) codes.push('css_outside_calibrated');
    if (f80Mm > 0 && (f80Mm < fLo || f80Mm > fHi)) codes.push('f80_outside_calibrated');
  }

  return { inEnvelope: codes.length === 0, implausible, codes };
}

/** Bilingual UI text for an envelope code (the physics core never carries prose). */
export function envelopeText(code: EnvelopeCode, es: boolean): string {
  const T: Record<EnvelopeCode, { en: string; es: string }> = {
    f80_lt_css: {
      en: 'CSS is wider than the feed F80: nothing is gripped (pass-through). Reading is not meaningful.',
      es: 'El CSS es mayor que el F80 del alimento: nada se atrapa (paso directo). La lectura no es significativa.',
    },
    css_nonpositive: { en: 'CSS must be positive.', es: 'El CSS debe ser positivo.' },
    feed_nonpositive: { en: 'Feed size must be positive.', es: 'El tamano del alimento debe ser positivo.' },
    css_outside_calibrated: {
      en: `CSS outside the calibrated HP500 support [${HP500_ENVELOPE.cssMm[0]}, ${HP500_ENVELOPE.cssMm[1]}] mm: the Table-5 fit is extrapolating.`,
      es: `CSS fuera del soporte calibrado HP500 [${HP500_ENVELOPE.cssMm[0]}, ${HP500_ENVELOPE.cssMm[1]}] mm: el ajuste (Tabla 5) esta extrapolando.`,
    },
    f80_outside_calibrated: {
      en: `f80 outside the calibrated HP500 support [${HP500_ENVELOPE.f80Mm[0]}, ${HP500_ENVELOPE.f80Mm[1]}] mm: the Table-5 fit is extrapolating.`,
      es: `f80 fuera del soporte calibrado HP500 [${HP500_ENVELOPE.f80Mm[0]}, ${HP500_ENVELOPE.f80Mm[1]}] mm: el ajuste (Tabla 5) esta extrapolando.`,
    },
  };
  return es ? T[code].es : T[code].en;
}
