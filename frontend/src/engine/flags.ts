// The bilingual text of every flag a case can carry. The pipeline writes stable codes into the manifest (the `flags` enum of
// docs/contracts/schemas/case-manifest.schema.json): four from the engine's own checks, five from its envelope gate and two sourced warnings (bounds.ts). The
// physics core never carries prose, so the App maps each code to text here, in English and Spanish, and maps the engine's
// live flags (sentences, for the four checks, and envelope codes) back to the codes. A sentence the map does not know is an
// error, never a flag that quietly disappears: a number must not be shown without the reason it cannot be trusted.
import { FLAG_CODES, type FlagCode } from '../lib/contract.types';
import { envelopeText, type EnvelopeCode } from './envelope';
import { MAX_TYPICAL_REDUCTION_RATIO as RATIO, MIN_VENDOR_CSS_MM as MINCSS, type BoundCode } from './bounds';
import type { CrusherResult } from './types';

export const ALL_FLAG_CODES: readonly FlagCode[] = FLAG_CODES;

const ENVELOPE_CODES: readonly FlagCode[] = ['css_nonpositive', 'feed_nonpositive', 'f80_lt_css', 'css_outside_calibrated', 'f80_outside_calibrated'];

/** The engine's four check flags are sentences (engine.ts); the envelope's are the codes themselves. */
const BOUND_CODES: readonly FlagCode[] = ['css_below_vendor_minimum', 'reduction_ratio_above_typical'];

// The two sourced warnings (bounds.ts) name their bound and its source; the numbers come from the constants, never retyped here.
const BOUND_TEXT: Record<BoundCode, { en: string; es: string }> = {
  css_below_vendor_minimum: {
    en: `The closed-side setting is below the vendor minimum of the machine type (secondary cone ${MINCSS['cone-sec']} mm, tertiary and short head cone ${MINCSS['cone-tert']} mm, jaw ${MINCSS.jaw} mm; Metso HP application guide p. 6, Metso C Series brochure p. 11). The vendors call the minimum soft, so the point stays valid, but the reading is a model extrapolation below a setting they do not recommend.`,
    es: `La abertura de descarga es menor que el mínimo del fabricante para este tipo de máquina (cono secundario ${MINCSS['cone-sec']} mm, cono terciario y de cabeza corta ${MINCSS['cone-tert']} mm, mandíbula ${MINCSS.jaw} mm; guía de aplicación HP de Metso p. 6, folleto de la serie C de Metso p. 11). El fabricante considera blando ese mínimo, así que el punto sigue siendo válido, pero la lectura es una extrapolación del modelo bajo una abertura que no recomienda.`,
  },
  reduction_ratio_above_typical: {
    en: `The reduction ratio F80/P80 is above the typical ceiling of one stage (secondary cone ${RATIO['cone-sec']}, tertiary and short head cone ${RATIO['cone-tert']}, jaw ${RATIO.jaw}, gyratory ${RATIO.gyratory}; Metso HP application guide p. 2, Metso Basics in Minerals Processing p. 3:2). The ranges are typical, not hard maxima, so the point stays valid, but a plant reaches this size reduction in more than one stage.`,
    es: `La razón de reducción F80/P80 supera el techo típico de una etapa (cono secundario ${RATIO['cone-sec']}, cono terciario y de cabeza corta ${RATIO['cone-tert']}, mandíbula ${RATIO.jaw}, giratoria ${RATIO.gyratory}; guía de aplicación HP de Metso p. 2, Basics in Minerals Processing de Metso p. 3:2). Los rangos son típicos y no máximos estrictos, así que el punto sigue siendo válido, pero una planta logra esta reducción de tamaño en más de una etapa.`,
  },
};

const ENGINE_SENTENCES: ReadonlyArray<[string, FlagCode]> = [
  ['CSS ≥ feed top size, nothing is gripped', 'css_ge_feed_top'],
  ['CSS ≥ F80, little size reduction (pass-through regime)', 'pass_through'],
  ['reduction ratio ≈ 1, negligible breakage', 'negligible_reduction'],
  ['ill-conditioned breakage matrix near choke', 'ill_conditioned'],
];

const ENGINE_TEXT: Record<'css_ge_feed_top' | 'pass_through' | 'negligible_reduction' | 'ill_conditioned', { en: string; es: string }> = {
  css_ge_feed_top: {
    en: 'The closed-side setting is at or above the feed top size: nothing is gripped, so the reading is not meaningful.',
    es: 'La abertura de descarga es igual o mayor que el tamaño máximo de la alimentación: nada se atrapa, así que la lectura no es significativa.',
  },
  pass_through: {
    en: 'The closed-side setting is at or above the feed F80: most of the material passes ungripped and the size reduction is small (pass-through regime).',
    es: 'La abertura de descarga es igual o mayor que el F80 de la alimentación: la mayor parte del material pasa sin ser atrapada y la reducción de tamaño es pequeña (régimen de paso directo).',
  },
  negligible_reduction: {
    en: 'The reduction ratio is close to 1: the breakage is negligible.',
    es: 'La razón de reducción es cercana a 1: la fractura es despreciable.',
  },
  ill_conditioned: {
    en: 'The breakage matrix is ill-conditioned near choke: the solution of the mass balance is not reliable.',
    es: 'La matriz de fractura está mal condicionada cerca del atasco: la solución del balance de masa no es confiable.',
  },
};

/** The sentence of a flag code in one language. */
export function flagText(code: FlagCode, lang: 'en' | 'es'): string {
  if (BOUND_CODES.includes(code)) return BOUND_TEXT[code as BoundCode][lang];
  if (ENVELOPE_CODES.includes(code)) return envelopeText(code as EnvelopeCode, lang === 'es');
  return ENGINE_TEXT[code as keyof typeof ENGINE_TEXT][lang];
}

/** The codes of the flags a live result carries, in the engine's order (the order the pipeline writes them in). */
export function flagCodesOf(r: Pick<CrusherResult, 'flags'>): FlagCode[] {
  return r.flags.map((flag) => {
    const sentence = ENGINE_SENTENCES.find(([s]) => s === flag);
    if (sentence) return sentence[1];
    if ((ENVELOPE_CODES as readonly string[]).includes(flag) || (BOUND_CODES as readonly string[]).includes(flag)) return flag as FlagCode;
    throw new Error(`unknown engine flag "${flag}": add its code and text to engine/flags.ts and to the manifest schema`);
  });
}
