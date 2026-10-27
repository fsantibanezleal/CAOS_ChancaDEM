// The selection the views share: the operating point a case, the rail's values and a variant make; the live engine's result
// at it; the replay lane (the engine at the manifest's own point, which the committed trace holds to six digits); and the
// flags the live point carries. Pure functions, no React and no shell: the parity test and the model test run them in node.
import type { CaseData } from '../api/artifacts';
import { specificEnergy, t10Calibrated, t10Of } from '../engine/breakage';
import { evaluate } from '../engine/engine';
import { flagCodesOf } from '../engine/flags';
import { REF_THROW_MM } from '../engine/machines';
import type { CrusherResult, Operating } from '../engine/types';
import type { CaseManifest, CaseParams, FlagCode, Hp500Loo, Text } from '../lib/contract.types';

/** The six inputs the rail moves. The machine and the Bond work index are the case's and are not on the rail. */
export interface RailValues {
  cssMm: number;
  throwMm: number;
  speedRpm: number;
  feedX63Mm: number;
  feedM: number;
  oreAxb: number;
}
export type RailKey = keyof RailValues;

export interface KnobSpec {
  key: RailKey;
  /** The `data-control` id the gate moves. */
  id: string;
  label: Text;
  hint: Text;
  /** A symbol, or a word in both languages; absent for a dimensionless input. */
  unit?: string;
  min: number;
  max: number;
  step: number;
}

/** The knobs of the rail, in the order of the rail, with the usual range of each input (a case outside it widens its own knob). */
export const KNOBS: readonly KnobSpec[] = [
  {
    key: 'cssMm',
    id: 'css',
    label: { en: 'Closed-side setting', es: 'Abertura de descarga' },
    hint: { en: 'The narrowest gap between the mantle and the concave (or the jaws), in millimetres. The tighter it is, the finer the product.', es: 'La abertura más estrecha entre el manto y el cóncavo (o las mandíbulas), en milímetros. Cuanto más cerrada, más fino el producto.' },
    unit: 'mm',
    min: 4,
    max: 260,
    step: 1,
  },
  {
    key: 'throwMm',
    id: 'throw',
    label: { en: 'Throw', es: 'Carrera' },
    hint: { en: 'The eccentric stroke: the open-side setting minus the closed-side setting, in millimetres.', es: 'La excursión excéntrica: la abertura del lado abierto menos la del lado cerrado, en milímetros.' },
    unit: 'mm',
    min: 8,
    max: 50,
    step: 1,
  },
  {
    key: 'speedRpm',
    id: 'speed',
    label: { en: 'Eccentric speed', es: 'Velocidad excéntrica' },
    hint: { en: 'Revolutions of the eccentric per minute. Capacity rises to an optimum and then falls.', es: 'Revoluciones del excéntrico por minuto. La capacidad sube hasta un óptimo y luego cae.' },
    unit: 'rpm',
    min: 100,
    max: 600,
    step: 5,
  },
  {
    key: 'feedX63Mm',
    id: 'x63',
    label: { en: 'Feed x63', es: 'Alimentación x63' },
    hint: { en: 'The size at which 63.2 percent of the feed passes (Rosin-Rammler), in millimetres.', es: 'El tamaño bajo el cual pasa el 63,2 por ciento de la alimentación (Rosin-Rammler), en milímetros.' },
    unit: 'mm',
    min: 20,
    max: 800,
    step: 1,
  },
  {
    key: 'feedM',
    id: 'm',
    label: { en: 'Feed uniformity m', es: 'Uniformidad de la alimentación' },
    hint: { en: 'The Rosin-Rammler exponent of the feed: the higher it is, the narrower the size distribution.', es: 'El exponente de Rosin-Rammler de la alimentación: cuanto mayor, más estrecha la distribución de tamaños.' },
    min: 0.6,
    max: 2.2,
    step: 0.05,
  },
  {
    key: 'oreAxb',
    id: 'axb',
    label: { en: 'Ore A times b', es: 'Mineral A por b' },
    hint: { en: 'The drop-weight ore competence A times b (JKMRC): the lower it is, the harder the ore.', es: 'La competencia del mineral A por b (JKMRC, ensayo de caída de peso): cuanto menor, más duro el mineral.' },
    min: 25,
    max: 120,
    step: 1,
  },
];

/** The rail's values at the manifest's own operating point. */
export function railOf(p: CaseParams): RailValues {
  return { cssMm: p.css_mm, throwMm: p.throw_mm, speedRpm: p.speed_rpm, feedX63Mm: p.feed_x63_mm, feedM: p.feed_m, oreAxb: p.ore_axb };
}

/** True when any of the rail's values differs from the manifest's. */
export function railMoved(p: CaseParams, rail: RailValues): boolean {
  const base = railOf(p);
  return (Object.keys(base) as RailKey[]).some((k) => rail[k] !== base[k]);
}

/** The range of each knob for a case: the usual range, widened to hold the case's own value (a real survey's A times b is 677). */
export function knobBounds(p: CaseParams): Record<RailKey, { min: number; max: number }> {
  const base = railOf(p);
  return Object.fromEntries(KNOBS.map((k) => [k.key, { min: Math.min(k.min, Math.floor(base[k.key])), max: Math.max(k.max, Math.ceil(base[k.key])) }])) as Record<RailKey, { min: number; max: number }>;
}

/**
 * The engine's operating point: the case's machine and Bond work index, the rail's values over the manifest's, and the
 * closed-side setting scaled by a variant's factor. The calibrated lane is marked only on a calibrated case.
 */
export function operatingOf(p: CaseParams, rail: RailValues = railOf(p), cssFactor = 1): Operating {
  return {
    machine: p.machine,
    cssMm: rail.cssMm * cssFactor,
    throwMm: rail.throwMm,
    speedRpm: rail.speedRpm,
    feedX63Mm: rail.feedX63Mm,
    feedM: rail.feedM,
    oreAxb: rail.oreAxb,
    oreWi: p.ore_wi,
    ...(p.calibrated ? { calibrated: true } : {}),
  };
}

export interface VariantSpec {
  id: string;
  /** The factor on the rail's closed-side setting. */
  cssFactor: number;
  label: Text;
  /** One line, for this case: on a real survey a variant is a calibrated what-if and says so. */
  note: (m: CaseManifest) => Text;
}

const REAL_WHATIF: Text = { en: 'a calibrated what-if', es: 'escenario calibrado' };

/** The variants every case offers, applied on top of the rail's values. */
export const VARIANTS: readonly VariantSpec[] = [
  {
    id: 'canonical',
    cssFactor: 1,
    label: { en: 'Canonical', es: 'Canónica' },
    note: (m) =>
      m.real_or_synthetic === 'real'
        ? { en: 'The survey as measured, on the calibrated fit.', es: 'El muestreo como se midió, sobre el ajuste calibrado.' }
        : { en: "The case at the rail's setting.", es: 'El caso con la abertura del panel.' },
  },
  {
    id: 'tight',
    cssFactor: 0.85,
    label: { en: 'Tight', es: 'Cerrada' },
    note: (m) =>
      m.real_or_synthetic === 'real'
        ? { en: `15 percent lower: ${REAL_WHATIF.en}.`, es: `15 por ciento menor: ${REAL_WHATIF.es}.` }
        : { en: 'Setting 15 percent lower.', es: 'Abertura 15 por ciento menor.' },
  },
  {
    id: 'open',
    cssFactor: 1.15,
    label: { en: 'Open', es: 'Abierta' },
    note: (m) =>
      m.real_or_synthetic === 'real'
        ? { en: `15 percent higher: ${REAL_WHATIF.en}.`, es: `15 por ciento mayor: ${REAL_WHATIF.es}.` }
        : { en: 'Setting 15 percent higher.', es: 'Abertura 15 por ciento mayor.' },
  },
];

export const variantOf = (id: string): VariantSpec => VARIANTS.find((v) => v.id === id) ?? VARIANTS[0];

export interface Baked {
  op: Operating;
  result: CrusherResult;
  flags: FlagCode[];
}

const bakedCache = new WeakMap<CaseManifest, Baked>();

/** The engine at the manifest's own operating point: the lane the committed trace replays, and the parity view compares. */
export function bakedOf(m: CaseManifest): Baked {
  let b = bakedCache.get(m);
  if (!b) {
    const op = operatingOf(m.params);
    const result = evaluate(op);
    b = { op, result, flags: flagCodesOf(result) };
    bakedCache.set(m, b);
  }
  return b;
}

export interface Selection {
  data: CaseData;
  rail: RailValues;
  variant: VariantSpec;
  /** The operating point the views draw: the rail's values with the variant's setting. */
  op: Operating;
  result: CrusherResult;
  flags: FlagCode[];
  baked: Baked;
}

/** What the views show for a case, the rail's values and a variant. The engine runs synchronously and in under a millisecond. */
export function selectionOf(data: CaseData, rail: RailValues, variantId: string): Selection {
  const variant = variantOf(variantId);
  const op = operatingOf(data.manifest.params, rail, variant.cssFactor);
  const result = evaluate(op);
  return { data, rail, variant, op, result, flags: flagCodesOf(result), baked: bakedOf(data.manifest) };
}

/** The t10 of the appearance function at a point: the HP500 fit on the calibrated lane, the energy and competence path otherwise. */
export function liveT10(op: Operating, f80Mm: number): number {
  return op.calibrated ? t10Calibrated(op.cssMm, f80Mm) : t10Of(specificEnergy(op.speedRpm, REF_THROW_MM[op.machine]), op.oreAxb);
}

/** The error of a model value against a measured one, in percent of the measured value. */
export const errorPct = (model: number, measured: number): number => ((model - measured) / measured) * 100;

/** The live engine against the committed replay holds to the six digits the trace is written with: anything above this is a defect. */
export const PARITY_TOLERANCE = 1e-6;

/** A scalar the trace holds to six significant digits: the live value is right when it is within half a unit of the sixth digit. */
export const SIX_DIGITS = 5e-6;
export const nearSixDigits = (live: number, committed: number): boolean => Math.abs(live - committed) <= SIX_DIGITS * Math.abs(committed) + 1e-12;

export interface Parity {
  /** The largest absolute difference. */
  worst: number;
  /** Where it is (the index of the first one when several are equal). */
  at: number;
  ok: boolean;
}

/** The largest absolute difference between two arrays, found and kept, never rounded away; arrays of different lengths are a defect. */
export function parityOf(live: readonly number[], committed: readonly number[]): Parity {
  if (live.length !== committed.length) return { worst: Infinity, at: -1, ok: false };
  let worst = 0;
  let at = 0;
  for (let i = 0; i < live.length; i++) {
    const d = Math.abs(live[i] - committed[i]);
    if (!(d <= worst)) {
      worst = d;
      at = i;
    }
  }
  return { worst, at, ok: worst <= PARITY_TOLERANCE };
}

/** The half-width of CrusherCal's 80 percent predictive band for a measured quantity (strict leave-one-out folds). */
export const bandHalfWidth = (loo: Hp500Loo, target: 'tph' | 'kW'): number => loo.loo[target].strict.uq.band_halfwidth;

/** The groups of the App, in the order of the tab row. The write-up is the tab after them. */
export const GROUP_ORDER = ['chamber', 'product', 'performance', 'learned', 'validation'] as const;
export type GroupId = (typeof GROUP_ORDER)[number];

/**
 * The catalog rows each group reads: the readiness note of a group is computed from these and from nothing typed in a view. They are the
 * rows the group draws from, so a note stays short: the case documents for the chamber and the write-up, the trace for the replay views,
 * the HP500 validation for the bands of a real survey (only a real case reads it), the model contracts and metrics for the learned views.
 */
export const GROUP_ROWS: Record<GroupId | 'context', string[]> = {
  chamber: ['case-manifest'],
  product: ['trace'],
  performance: ['trace', 'hp500-loo'],
  learned: ['surrogate-model', 'anomaly-model', 'model-metrics'],
  validation: ['trace', 'hp500-loo'],
  context: ['case-manifest'],
};

/** The rows of a group that a case reads: the HP500 validation only matters to a real survey. */
export const rowsFor = (group: GroupId | 'context', real: boolean): string[] => GROUP_ROWS[group].filter((id) => real || id !== 'hp500-loo');
