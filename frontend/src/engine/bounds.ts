// Sourced setting and reduction-ratio warnings (counterpart of data-pipeline/pipeline/model/crusher/bounds.py). Two checks run in
// evaluate() after the envelope gate, on the operating point and the computed reduction ratio F80 / P80. A breach is a warning,
// never an invalidity: the vendors call the minimum setting soft ("the minimum setting is that at which the crusher will operate
// without causing ring bounce", Metso HP guide p. 6; "smaller closed side settings may be possible", Metso C Series brochure
// p. 11) and the reduction ratios are typical ranges, not hard maxima. Both bounds are strict: a setting exactly at the minimum
// or a ratio exactly at the ceiling does not warn. `valid` is never touched. The text of the codes is in flags.ts.
//
// Sources (the research report r-min-css-2026-10-27 of the coordination repository holds the pages read):
//  S1: Metso, "Nordberg HP Series cone crushers, Wear parts application guide" (code 2602): chamber selection table p. 6
//      (minimum setting "A": 16 mm for the HP500 standard liners, 6 mm for the HP500 short head); reduction ratio of the HP
//      standard chamber 3 to 5 and of the short head chamber 2 to 4, p. 2.
//  S4: Metso, "Nordberg C Series jaw crushers" brochure 4226-04-24, 2024: technical specifications p. 11 (minimum closed side
//      setting from 40 mm for the C80, the smallest of the series, up to 175 mm for the C200).
//  S7: Metso, "Basics in Minerals Processing", 8th ed. 2011, p. 3:2: reduction ratio jaw 3 to 4, gyratory 3 to 4.

import type { Machine } from './types';

export type BoundCode = 'css_below_vendor_minimum' | 'reduction_ratio_above_typical';

// Minimum closed-side setting [mm] below which the vendor's smallest model of the machine type no longer operates. cone-sec:
// HP500 standard liners, S1 p. 6. cone-tert and cone-short-head: HP500 short head, S1 p. 6. jaw: the smallest minimum of the
// C Series (the C80), S4 p. 11, so a setting below it is below every C-series jaw's minimum. gyratory: no source found (the
// Metso Superior MKIII brochures tabulate capacity from an open-side setting of 152 mm only), so the check is skipped, never
// guessed.
export const MIN_VENDOR_CSS_MM: Partial<Record<Machine, number>> = {
  'cone-sec': 16,
  'cone-tert': 6,
  'cone-short-head': 6,
  jaw: 40,
};

// Upper end of the typical reduction ratio F80 / P80 of one stage. cone-sec: HP standard chamber 3 to 5, S1 p. 2. cone-tert and
// cone-short-head: HP short head chamber 2 to 4, S1 p. 2. jaw and gyratory: 3 to 4, S7 p. 3:2.
export const MAX_TYPICAL_REDUCTION_RATIO: Record<Machine, number> = {
  'cone-sec': 5,
  'cone-tert': 4,
  'cone-short-head': 4,
  jaw: 4,
  gyratory: 4,
};

/** The warning codes of a setting and a reduction ratio, in a fixed order (setting, then ratio). */
export function checkBounds(machine: Machine, cssMm: number, reductionRatio: number): BoundCode[] {
  const codes: BoundCode[] = [];
  const minimum = MIN_VENDOR_CSS_MM[machine];
  if (minimum !== undefined && cssMm < minimum) codes.push('css_below_vendor_minimum');
  const ceiling = MAX_TYPICAL_REDUCTION_RATIO[machine];
  if (ceiling !== undefined && reductionRatio > ceiling) codes.push('reduction_ratio_above_typical');
  return codes;
}
