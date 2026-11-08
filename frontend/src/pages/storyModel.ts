// The story's model (ADR-0082 section 3; the SDD's Visualization catalog, story paragraph; plan decision D-8): the five steps in the
// problem's verbs, each headline a number read from the release's documents or computed by the live engine from them, never typed, and
// the missing state with its reason when a document is absent (SH-005). Pure: the test runs it in node against the committed documents.
import { formatNumber } from '@fasl-work/caos-app-shell';
import { CSS_MAX_MM } from '../engine/campaign';
import { evaluate } from '../engine/engine';
import type { Operating } from '../engine/types';
import type { Hp500Backbone, Hp500Comparison, Hp500CrusherBayes, Hp500Loo, Text } from '../lib/contract.types';
import type { CalloutSpec } from '../views/callouts';
import { defaultP80Target, driftCurve, driftSecant } from '../views/campaign';
import { certaintyText, compareRows, recommend } from '../views/compare';
import { passesToSolve, passesWord } from '../views/passes';

export type StoryStepId = 'measure' | 'inside' | 'solve' | 'compare' | 'operate';

export interface StoryStepDef {
  id: StoryStepId;
  number: number;
  verb: Text;
  /** The App group the exit opens (the catalog row's placement). */
  group: 'system' | 'product' | 'performance' | 'validation';
  accent: 1 | 2 | 3 | 4 | 5;
}

export const STORY_STEPS: readonly StoryStepDef[] = [
  { id: 'measure', number: 1, verb: { en: 'Measure', es: 'Medir' }, group: 'system', accent: 1 },
  { id: 'inside', number: 2, verb: { en: 'Look inside', es: 'Mirar adentro' }, group: 'system', accent: 2 },
  { id: 'solve', number: 3, verb: { en: 'Solve', es: 'Resolver' }, group: 'product', accent: 3 },
  { id: 'compare', number: 4, verb: { en: 'Compare', es: 'Comparar' }, group: 'validation', accent: 4 },
  { id: 'operate', number: 5, verb: { en: 'Operate', es: 'Operar' }, group: 'performance', accent: 5 },
];

export const isStep = (id: string | undefined): id is StoryStepId => STORY_STEPS.some((s) => s.id === id);

/** The deep link of a step on a case. */
export const stepHref = (step: StoryStepId, caseId: string): string => `/story/${step}?case=${encodeURIComponent(caseId)}`;

/** The App view of the group each step opens (the catalog row's placement): Look inside is the chamber, Solve the population balance. */
export const STEP_SUB: Record<StoryStepId, string> = { measure: 'circuit', inside: 'chamber', solve: 'passes', compare: 'compare', operate: 'campaign' };

/** The state a step carries into the App beside its case and view: the P80 target of Operate. */
export interface ExitState {
  targetMm?: number | null;
}

/** Where the exit of a step lands: the App on the step's case, with the step's group and view open and the step's target. */
export function exitHref(step: StoryStepId, caseId: string, state: ExitState = {}): string {
  const def = STORY_STEPS.find((s) => s.id === step) ?? STORY_STEPS[0];
  const q = new URLSearchParams({ case: caseId, view: def.group, sub: STEP_SUB[def.id] });
  if (step === 'operate' && state.targetMm != null && Number.isFinite(state.targetMm) && state.targetMm > 0) q.set('target', String(Math.round(state.targetMm * 1e6) / 1e6));
  return `/app?${q.toString()}`;
}

/** What the story reads: the case's operating point (null while it is not available) and the three HP500 documents with their reasons. */
export interface StoryInputs {
  caseId: string;
  op: Operating | null;
  backbone: Hp500Backbone | null;
  backboneReason: Text | null;
  loo: Hp500Loo | null;
  looReason: Text | null;
  cb: Hp500CrusherBayes | null;
  cbReason: Text | null;
  /** The paired comparison (hp500-comparison): how sure the ranking is; null with its reason when the document is absent. */
  comparison?: Hp500Comparison | null;
  comparisonReason?: Text | null;
}

/** The point the Operate step draws at a case: the one target rule, the drift that reaches it and the secant over that range. */
export function operatePoint(op: Operating): { targetMm: number; crossingMm: number | null; secant: number | null } | null {
  const now = evaluate(op);
  if (!now.valid || !Number.isFinite(now.p80)) return null;
  const targetMm = defaultP80Target(now.p80);
  const curve = driftCurve(op, targetMm, CSS_MAX_MM[op.machine], null);
  return { targetMm, crossingMm: curve.crossingMm, secant: driftSecant(op, curve.crossingMm) };
}

/** The ten surveys' feed rates as marks on the Measure stage: each mark's share of the axis from the lowest to the highest rate. */
export function feedStrip(backbone: Hp500Backbone | null): { survey: number; tph: number; at: number }[] {
  if (!backbone || backbone.surveys.length === 0) return [];
  const tph = backbone.surveys.map((s) => s.measured.feed_tph);
  const lo = Math.min(...tph);
  const hi = Math.max(...tph);
  return backbone.surveys.map((s) => ({ survey: s.n, tph: s.measured.feed_tph, at: hi > lo ? (s.measured.feed_tph - lo) / (hi - lo) : 0.5 }));
}

export interface Headline {
  headline: string;
  summary: string;
  /** True when the step's number could not be read: the headline says so and the summary gives the reason. */
  missing: boolean;
}

const bare = (s: string): string => s.replace(/[.\s]+$/, '');

/** The headline and the subline of every step, in one language. */
export function storyHeadlines(input: StoryInputs, lang: 'en' | 'es'): Record<StoryStepId, Headline> {
  const es = lang === 'es';
  const n = (v: number, o: { digits?: number; decimals?: number }) => formatNumber(v, lang, o);
  const absent = (reason: Text | null, fallback: Text): string => `${es ? 'Aún no disponible' : 'Not available yet'}: ${bare((reason ?? fallback)[lang])}.`;
  const noCase: Text = { en: `the case ${input.caseId} is not available in this build`, es: `el caso ${input.caseId} no está disponible en esta versión` };

  let measure: Headline;
  if (input.backbone && input.backbone.surveys.length > 0) {
    const tph = input.backbone.surveys.map((s) => s.measured.feed_tph);
    const lo = n(Math.min(...tph), { digits: 4 });
    const hi = n(Math.max(...tph), { digits: 4 });
    const count = n(input.backbone.n, { decimals: 0 });
    measure = {
      headline: es ? `${count} muestreos medidos alimentaron ${lo} a ${hi} t/h` : `${count} measured surveys fed ${lo} to ${hi} t/h`,
      summary: es
        ? `Alimentación, F80, abertura y potencia medidas de un cono HP500 (Rocha et al. 2024); el caso mostrado es ${input.caseId}.`
        : `Measured feed, F80, setting and power of one HP500 cone (Rocha et al. 2024); the case shown is ${input.caseId}.`,
      missing: false,
    };
  } else {
    measure = {
      headline: es ? 'La capacidad medida no está disponible en esta versión' : 'The measured throughput is not available in this build',
      summary: absent(input.backboneReason, { en: 'hp500/backbone.json is not available in this build', es: 'hp500/backbone.json no está disponible en esta versión' }),
      missing: true,
    };
  }

  const r = input.op ? evaluate(input.op) : null;
  const inside: Headline =
    input.op && r && Number.isFinite(r.nipAngleDeg)
      ? {
          headline: es
            ? `Ángulo de nip ${n(r.nipAngleDeg, { decimals: 1 })}° contra el límite de ${n(r.nipLimitDeg, { decimals: 2 })}°`
            : `Nip angle ${n(r.nipAngleDeg, { decimals: 1 })}° against the ${n(r.nipLimitDeg, { decimals: 2 })}° grip limit`,
          summary: es
            ? `Abertura de descarga ${n(input.op.cssMm, { digits: 3 })} mm, carrera ${n(input.op.throwMm, { digits: 3 })} mm a ${n(input.op.speedRpm, { digits: 3 })} rpm; una partícula se agarra bajo 2 arctan 0,35.`
            : `Closed-side setting ${n(input.op.cssMm, { digits: 3 })} mm, throw ${n(input.op.throwMm, { digits: 3 })} mm at ${n(input.op.speedRpm, { digits: 3 })} rpm; a particle is gripped below 2 arctan 0.35.`,
          missing: false,
        }
      : { headline: es ? 'La cámara de este caso no está disponible en esta versión' : 'This case’s chamber is not available in this build', summary: absent(null, noCase), missing: true };

  const k = input.op ? passesToSolve(input.op) : null;
  const solve: Headline =
    input.op && k !== null
      ? {
          headline: es
            ? `A una millonésima de la forma cerrada tras ${n(k, { decimals: 0 })} ${passesWord(k, 'es')}`
            : `Within a millionth of the closed form after ${n(k, { decimals: 0 })} ${passesWord(k, 'en')}`,
          summary: es
            ? `p_n = (I - C) suma (B C)^k f con B, C y f del motor en vivo de ${input.caseId}; exacta tras tantas pasadas como clases de tamaño.`
            : `p_n = (I - C) sum (B C)^k f from the live engine's B, C and f of ${input.caseId}; exact after as many passes as size classes.`,
          missing: false,
        }
      : { headline: es ? 'El balance de este caso no está disponible en esta versión' : 'This case’s population balance is not available in this build', summary: absent(null, noCase), missing: true };

  let compare: Headline;
  const rows = input.loo ? compareRows(input.loo, input.cb, 'kW') : null;
  const best = rows ? recommend(rows) : null;
  if (rows && best) {
    const methods = rows.filter((m) => !m.control).length;
    const cbNote = input.cb
      ? ''
      : es
        ? ` CrusherBayes no está disponible: ${bare((input.cbReason ?? { en: '', es: 'su documento no está disponible en esta versión' }).es)}.`
        : ` CrusherBayes is not available: ${bare((input.cbReason ?? { en: 'its document is not available in this build', es: '' }).en)}.`;
    const sure = certaintyText(input.comparison ?? null, input.comparisonReason ?? null, 'kW', (v, o) => n(v, o ?? { digits: 3 }));
    compare = {
      headline: es ? `${best.name.es}: menor error en potencia, ${n(best.mape, { digits: 4 })}% en promedio` : `${best.name.en}: lowest held-out power error, ${n(best.mape, { digits: 4 })}% on average`,
      summary:
        (es
          ? `El menor error porcentual absoluto medio de ${methods} métodos, cada muestreo fuera de su propio ajuste. `
          : `The lowest mean absolute percent error of ${methods} methods, each survey held out of its own fit. `) +
        sure[lang] +
        cbNote,
      missing: false,
    };
  } else {
    compare = {
      headline: es ? 'La comparación de métodos no está disponible en esta versión' : 'The method comparison is not available in this build',
      summary: absent(input.looReason, { en: 'hp500/loo.json is not available in this build', es: 'hp500/loo.json no está disponible en esta versión' }),
      missing: true,
    };
  }

  const at = input.op ? operatePoint(input.op) : null;
  let operate: Headline;
  if (input.op && at && at.crossingMm !== null && at.crossingMm > 0 && at.secant !== null) {
    const tgt = n(at.targetMm, { digits: 3 });
    const mm = n(at.crossingMm, { digits: 3 });
    operate = {
      headline: es ? `P80 alcanza el objetivo de ${tgt} mm tras ${mm} mm de desplazamiento` : `P80 reaches the ${tgt} mm target after ${mm} mm of setting drift`,
      summary: es
        ? `Secante del motor en vivo en ese rango: ${n(at.secant, { digits: 3 })} mm de P80 por mm de abertura; el tiempo lo pone su velocidad de desplazamiento: el producto no afirma ninguna tasa de desgaste.`
        : `The live engine's secant over that range: ${n(at.secant, { digits: 3 })} mm of P80 per mm of setting; the time follows your drift rate: the product asserts no wear rate.`,
      missing: false,
    };
  } else if (input.op && at) {
    const tgt = n(at.targetMm, { digits: 3 });
    operate = {
      headline: es ? `P80 no alcanza el objetivo de ${tgt} mm bajo el techo de la abertura` : `P80 never reaches the ${tgt} mm target below the setting ceiling`,
      summary: es ? 'El motor en vivo no llega al objetivo en una abertura válida bajo el techo del rango de entrenamiento.' : 'The live engine does not reach the target at a valid setting below the ceiling of the training range.',
      missing: false,
    };
  } else {
    operate = { headline: es ? 'La deriva de este caso no está disponible en esta versión' : 'This case’s drift response is not available in this build', summary: absent(null, noCase), missing: true };
  }

  return { measure, inside, solve, compare, operate };
}

/** What makes a headline wrong for ADR-0082 rule 3: no number, or more than 12 words. Empty when it is right. */
export function headlineProblems(headline: string): string[] {
  const out: string[] = [];
  if (!/\d/.test(headline)) out.push('the headline states no number');
  const words = headline.trim().split(/\s+/).filter(Boolean).length;
  if (words > 12) out.push(`the headline has ${words} words; at most 12`);
  return out;
}

/** What makes a stage's callouts wrong for ADR-0082 rule 5 (SH-007): fewer than three, or one without a value, a unit or a source. */
export function calloutProblems(list: readonly CalloutSpec[]): string[] {
  const out: string[] = [];
  if (list.length < 3) out.push(`${list.length} callouts; at least 3`);
  for (const c of list) {
    if (c.value === null && !c.missing) out.push(`${c.id}: no value and no reason`);
    if (c.value !== null && !c.value.trim()) out.push(`${c.id}: an empty value`);
    if (!c.unit.en.trim() || !c.unit.es.trim()) out.push(`${c.id}: no unit`);
    if (!c.source.en.trim() || !c.source.es.trim()) out.push(`${c.id}: no source`);
    if (!c.eyebrow.en.trim() || !c.eyebrow.es.trim()) out.push(`${c.id}: no name`);
  }
  return out;
}

/** What makes the Operate headline wrong for SH-010: it states hours (a wear rate the product does not have), or it does not state the
 * drift in millimetres of setting, or it states a local slope (P80 per millimetre) as the drift response (B1 of the 0.13.000 review). */
export function operateHeadlineProblems(headline: string): string[] {
  const out: string[] = [];
  if (/\b(h|hours?|horas?)\b/i.test(headline)) out.push('the Operate headline states hours: the product asserts no wear rate');
  if (!/\d mm (of setting drift|de desplazamiento)\b/.test(headline)) out.push('the Operate headline does not state the drift in millimetres of setting');
  if (/\b(per|por) mm\b/.test(headline)) out.push('the Operate headline states a slope per millimetre, not the drift response over the drawn range');
  return out;
}
