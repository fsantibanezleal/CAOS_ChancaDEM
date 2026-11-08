// The campaign view of the Performance group (BL-004): how many operating hours remain before the product's P80 leaves its target as the
// closed-side setting drifts open with liner wear, against the drift rate. The product models no wear and asserts no drift rate: the
// drift rate is the x axis, the user's to measure, and the only sourced figure on the chart is the 45 h between two manual re-sets of
// the setting at the plant of Ma, Fan and He (Appl. Sci. 2016, p. 3), drawn as a reference line and never as a default.
// The engine gives P80 as a function of the setting for the case, so the opening the target allows is the setting at which P80 reaches
// the target minus the current setting (cssAtP80Target), and the hours are that opening over the drift (hoursToTarget).
import { Knob, PlotCard, useShellLang, useWorkbenchState, type BiText } from '@fasl-work/caos-app-shell';
import { UPlotChart, type ChartSeries } from '@fasl-work/caos-app-shell/chart';
import { useState } from 'react';
import { CSS_MAX_MM, cssAtP80Target, hoursToTarget } from '../engine/campaign';
import { evaluate } from '../engine/engine';
import type { Operating } from '../engine/types';
import type { Text } from '../lib/contract.types';
import { Fill, Stack } from './draw';
import { ChartCallouts, type CalloutSpec, type ChartPoint } from './callouts';
import { useEntry } from './staging';
import { useHours } from './linked';
import { Pending, provenanceOf, useNum, useT, useView } from './shared';
import { finAll, LIVE_COLOR, logSpace } from './series';

/** The re-set interval of the one plant the research found a figure for: manual adjustment of the setting every 45 h (Ma et al. 2016, p. 3). */
export const REFERENCE_RESET_H = 45;
/** The x axis: the drift rate, from the lowest to the highest value the axis shows [mm/h]. */
export const DRIFT_RANGE: [number, number] = [0.01, 1];
const CURVE_POINTS = 49;
/** The target the views open with, as a multiple of the case's own P80: a control value, not a claim. */
export const DEFAULT_TARGET_FACTOR = 1.1;

/** The one target rule of the App and the story (SDD catalog row V4, SH-010): the case's P80 plus 10 percent. */
export const defaultP80Target = (p80Mm: number): number => p80Mm * DEFAULT_TARGET_FACTOR;

export const REFERENCE_LABEL: Text = {
  en: 'the re-set interval of one plant (Ma et al. 2016)',
  es: 'el intervalo de reajuste de una planta (Ma et al. 2016)',
};

export const CAMPAIGN_TEXT = {
  reading: {
    en: 'How to read it: wear opens the closed-side setting, and the engine says how far it may open before the P80 of the product reaches the target. That opening, divided by the rate at which the setting drifts, is the number of operating hours until the product leaves its target. The curve is that division for every drift rate on the axis.',
    es: 'Cómo leerlo: el desgaste abre la abertura de descarga, y el motor dice cuánto puede abrirse antes de que el P80 del producto llegue al objetivo. Esa apertura, dividida por la velocidad con que la abertura se desplaza, son las horas de operación hasta que el producto sale de su objetivo. La curva es esa división para cada velocidad de desplazamiento del eje.',
  },
  measure: {
    en: 'The drift rate is yours to measure, for example from the movement of the adjustment ring that the vendor guide describes between liner changes. The product does not model wear and asserts no wear rate; the horizontal line is the one figure the research found, the manual re-set every 45 h at the plant of Ma et al. 2016, drawn for scale and not as a default.',
    es: 'La velocidad de desplazamiento es una magnitud que usted debe medir, por ejemplo desde el movimiento del anillo de ajuste que describe la guía del fabricante entre cambios de blindaje. El producto no modela el desgaste y no afirma ninguna tasa de desgaste; la línea horizontal es la única cifra que encontró la investigación, el reajuste manual cada 45 h en la planta de Ma et al. 2016, dibujada como escala y no como valor por defecto.',
  },
  calibrated: {
    en: 'This is a calibrated case: the projection is the calibrated model\'s, the same engine call that gives the numbers of the other views, and it holds only where the calibrated envelope holds.',
    es: 'Este es un caso calibrado: la proyección es la del modelo calibrado, la misma llamada al motor que da los números de las otras vistas, y vale solo donde vale la envolvente calibrada.',
  },
  exceeded: {
    en: 'The target is already exceeded at the current setting: the P80 of the product is at or above it, so no hours remain and there is no curve to draw.',
    es: 'El objetivo ya está superado con la abertura actual: el P80 del producto está en él o sobre él, así que no quedan horas y no hay curva que dibujar.',
  },
  unreachable: {
    en: 'The target is never reached below the ceiling of the setting for this machine, at a setting the engine answers as a valid point, or the P80 of the engine is not monotone over that range. There is no opening to divide, so no curve is drawn.',
    es: 'El objetivo no se alcanza nunca bajo el techo de la abertura de esta máquina, con una abertura que el motor responda como punto válido, o el P80 del motor no es monótono en ese rango. No hay apertura que dividir, así que no se dibuja curva.',
  },
  invalid: {
    en: 'The operating point or the target is not valid for the engine, so there is no projection: the other views say why.',
    es: 'El punto de operación o el objetivo no es válido para el motor, así que no hay proyección: las otras vistas dicen por qué.',
  },
  noCurve: {
    en: 'No curve is drawn for this target: the statement above the figure says why.',
    es: 'No se dibuja curva para este objetivo: el enunciado sobre la figura dice por qué.',
  },
  ceiling: {
    en: 'The ceiling of the setting is the upper end of the training range of the machine type, the range the engine was swept over.',
    es: 'El techo de la abertura es el extremo superior del rango de entrenamiento del tipo de máquina, el rango sobre el que se barrió el motor.',
  },
  control: {
    en: 'The P80 above which the product is out of specification. It opens at the case\'s own P80 plus 10 percent, a value to set, not a claim.',
    es: 'El P80 sobre el cual el producto queda fuera de especificación. Abre en el P80 propio del caso más 10 por ciento, un valor para fijar, no una afirmación.',
  },
} satisfies Record<string, Text>;

export type CampaignModel =
  | { kind: 'invalid' }
  | { kind: 'unreachable' }
  | { kind: 'exceeded' }
  | { kind: 'curve'; cssTargetMm: number; deltaCssMm: number; driftMmPerH: number[]; hours: number[] };

/** What the figure shows for an operating point, a P80 target and the ceiling of the setting. */
export function campaignModel(op: Operating, p80TargetMm: number, cssMaxMm: number): CampaignModel {
  if (!(Number.isFinite(p80TargetMm) && p80TargetMm > 0)) return { kind: 'invalid' };
  const now = evaluate(op);
  if (!now.valid || !Number.isFinite(now.p80) || now.p80 <= 0) return { kind: 'invalid' };
  const css = cssAtP80Target(op, p80TargetMm, cssMaxMm);
  if (css === null) return { kind: 'unreachable' };
  const delta = css - op.cssMm;
  if (delta <= 0) return { kind: 'exceeded' };
  const driftMmPerH = logSpace(DRIFT_RANGE[0], DRIFT_RANGE[1], CURVE_POINTS);
  const hours = driftMmPerH.map((d) => hoursToTarget(delta, d) as number);
  return { kind: 'curve', cssTargetMm: css, deltaCssMm: delta, driftMmPerH, hours };
}

/** The props of the chart for a curve: hours against the drift rate on log axes, the re-set reference line, the drift that uses the opening in that interval. */
export function campaignChart(m: CampaignModel) {
  const drift = m.kind === 'curve' ? m.driftMmPerH : logSpace(DRIFT_RANGE[0], DRIFT_RANGE[1], CURVE_POINTS);
  // no curve (target exceeded, never reached, invalid point): the frame and the reference line are drawn, the series is empty
  const hours: (number | null)[] = m.kind === 'curve' ? finAll(m.hours) : drift.map(() => null);
  const series: ChartSeries[] = [{ label: { en: 'Hours until the P80 target is exceeded', es: 'Horas hasta superar el P80 objetivo' }, values: hours, color: LIVE_COLOR, width: 2.4 }];
  const yMarks: { y: number; label: Text; tone: 'neutral' }[] = [{ y: REFERENCE_RESET_H, label: REFERENCE_LABEL, tone: 'neutral' }];
  const marks: { x: number; label: BiText }[] = [];
  const crossing = m.kind === 'curve' ? m.deltaCssMm / REFERENCE_RESET_H : Number.NaN;
  if (crossing >= DRIFT_RANGE[0] && crossing <= DRIFT_RANGE[1]) marks.push({ x: crossing, label: { en: 'opening used in one interval', es: 'apertura usada en un intervalo' } });
  return {
    x: { values: drift, label: { en: 'Drift rate of the setting', es: 'Velocidad de desplazamiento de la abertura' } as BiText, unit: 'mm/h', log: true },
    y: { label: { en: 'Operating hours', es: 'Horas de operación' } as BiText, unit: 'h', log: true },
    series,
    yMarks,
    marks,
  };
}

export function CampaignView() {
  const { sel, target: sharedTarget, setTarget } = useView();
  const stateKey = useWorkbenchState()?.stateKey;
  const lang = useShellLang();
  const t = useT();
  const num = useNum();
  const caseId = sel?.data.manifest.case_id ?? '';
  const [chosen, setChosen] = useState<{ caseId: string; mm: number } | null>(null);
  if (!sel) return <Pending />;
  const op = sel.op;
  const p80 = sel.result.p80;
  const baseTarget = defaultP80Target(p80);
  // The target is the workbench's own P80 target (its value is part of the key the views follow, so a change redraws the figure); until the
  // reader sets it here the view opens at the case's P80 plus 10 percent, and a target the workbench reset (a new case) falls back to that.
  const target = chosen && chosen.caseId === caseId && chosen.mm === sharedTarget ? chosen.mm : baseTarget;
  const cssMax = CSS_MAX_MM[op.machine];
  const model = campaignModel(op, target, cssMax);
  const knobMax = 300;
  const knobValue = Math.min(knobMax, Math.max(1, Math.round(target * 10) / 10));
  const notes: Text[] = [CAMPAIGN_TEXT.reading, CAMPAIGN_TEXT.measure, CAMPAIGN_TEXT.ceiling];
  if (op.calibrated) notes.push(CAMPAIGN_TEXT.calibrated);
  const note: Text = { en: notes.map((n) => n.en).join(' '), es: notes.map((n) => n.es).join(' ') };
  const chart = campaignChart(model);
  const statement: Text | null = model.kind === 'curve' ? null : CAMPAIGN_TEXT[model.kind];
  return (
    <PlotCard
      fill
      title={{ en: 'Hours until the product leaves its P80 target', es: 'Horas hasta que el producto sale de su P80 objetivo' }}
      lane="live"
      provenance={provenanceOf(sel)}
      dataKey={stateKey}
      note={note}
    >
      <Stack>
        <Knob
          id="campaign-target"
          label={{ en: 'P80 target', es: 'P80 objetivo' }}
          hint={CAMPAIGN_TEXT.control}
          value={knobValue}
          min={1}
          max={knobMax}
          step={0.1}
          unit="mm"
          onChange={(mm) => {
            setChosen({ caseId, mm });
            setTarget(mm);
          }}
        />
        <div className="cdem-tablewrap">
          <table className="caos-table" data-state="ready">
            <thead>
              <tr>
                <th>{t('Current P80 (mm)', 'P80 actual (mm)')}</th>
                <th>{t('P80 target (mm)', 'P80 objetivo (mm)')}</th>
                <th>{t('Current setting (mm)', 'Abertura actual (mm)')}</th>
                <th>{t('Setting at the target (mm)', 'Abertura en el objetivo (mm)')}</th>
                <th>{t('Opening allowed (mm)', 'Apertura permitida (mm)')}</th>
                <th>{t('Drift that uses it in one interval (mm/h)', 'Desplazamiento que la usa en un intervalo (mm/h)')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{num(p80, { digits: 4 })}</td>
                <td>{num(target, { digits: 4 })}</td>
                <td>{num(op.cssMm, { digits: 4 })}</td>
                <td>{model.kind === 'curve' ? num(model.cssTargetMm, { digits: 4 }) : model.kind === 'exceeded' ? num(op.cssMm, { digits: 4 }) : t('not reached', 'no se alcanza')}</td>
                <td>{model.kind === 'curve' ? num(model.deltaCssMm, { digits: 4 }) : model.kind === 'exceeded' ? num(0, { decimals: 1 }) : t('none', 'ninguna')}</td>
                <td>{model.kind === 'curve' ? num(model.deltaCssMm / REFERENCE_RESET_H, { digits: 3 }) : t('none', 'ninguno')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {statement && (
          <p className="caos-pending" data-state="empty">
            {model.kind === 'exceeded' ? t(`${statement.en} Hours remaining: 0.`, `${statement.es} Horas restantes: 0.`) : statement[lang]}
          </p>
        )}
        <Fill>
          <UPlotChart
            title={{ en: 'Hours until the P80 target is exceeded, against the drift rate of the setting', es: 'Horas hasta superar el P80 objetivo, contra la velocidad de desplazamiento de la abertura' }}
            height="fill"
            x={chart.x}
            y={chart.y}
            series={chart.series}
            marks={chart.marks}
            yMarks={chart.yMarks}
          />
        </Fill>
      </Stack>
    </PlotCard>
  );
}

// ---- Catalog row V4, state and dynamics: P80 against operating hours at the reader's drift rate (SH-010). The view opens with no drift
// rate: until the reader sets one, the same curve is drawn against the opening of the setting in millimetres, the one axis the engine
// answers without a wear rate. Once set, the axis is hours (the opening over the drift), the target P80 is the threshold, the hour it is
// crossed is marked, the 45 h re-set of Ma et al. 2016 is a reference line and the hours cursor is the now line (V2 and V3 follow it).

/** The engine's local dP80/dCSS at the operating point [mm of P80 per mm of setting], by a central difference; null at an invalid
 * point. It is the slope at the current setting only: the response over a drift is driftSecant (the engine's P80 is piecewise in the
 * setting, so the two differ; the view's Methodology paragraph says why). */
export function p80PerMm(op: Operating): number | null {
  const h = Math.max(0.25, 0.01 * op.cssMm);
  const lo = evaluate({ ...op, cssMm: op.cssMm - h });
  const hi = evaluate({ ...op, cssMm: op.cssMm + h });
  if (!lo.valid || !hi.valid || !Number.isFinite(lo.p80) || !Number.isFinite(hi.p80)) return null;
  return (hi.p80 - lo.p80) / (2 * h);
}

export interface DriftCurve {
  /** The opening of the setting at each point [mm]. */
  openingMm: number[];
  /** The hours at each point at the reader's drift rate, or null while no drift rate is set. */
  hours: number[] | null;
  p80: (number | null)[];
  /** The opening at which P80 reaches the target [mm] (0 when already exceeded), or null when it is never reached. */
  crossingMm: number | null;
  crossingH: number | null;
}

const OPENING_SAMPLES = 41;

/** P80 as the setting opens from its current value, to past the target's opening (or to the ceiling), and the hours when a drift is set. */
export function driftCurve(op: Operating, p80TargetMm: number, cssMaxMm: number, driftMmPerH: number | null): DriftCurve {
  const cssAt = cssAtP80Target(op, p80TargetMm, cssMaxMm);
  const crossingMm = cssAt === null ? null : Math.max(0, cssAt - op.cssMm);
  const room = Math.max(0, cssMaxMm - op.cssMm);
  const span = crossingMm !== null && crossingMm > 0 ? Math.min(room, crossingMm * 2) : room;
  const openingMm = Array.from({ length: OPENING_SAMPLES }, (_, i) => (span * i) / (OPENING_SAMPLES - 1));
  const p80 = openingMm.map((d) => {
    const r = evaluate({ ...op, cssMm: op.cssMm + d });
    return r.valid && Number.isFinite(r.p80) ? r.p80 : null;
  });
  const rate = driftMmPerH !== null && driftMmPerH > 0 ? driftMmPerH : null;
  return {
    openingMm,
    hours: rate === null ? null : openingMm.map((d) => d / rate),
    p80,
    crossingMm,
    crossingH: rate !== null && crossingMm !== null ? hoursToTarget(crossingMm, rate) : null,
  };
}

/**
 * The drift response over the drawn range: P80 at the target's crossing minus P80 now, over the drift that reaches the target
 * [mm of P80 per mm of setting], the secant of the curve the stage draws from its start to its crossing; null when the target is
 * never reached, already exceeded, or the point is not valid.
 */
export function driftSecant(op: Operating, crossingMm: number | null): number | null {
  if (crossingMm === null || !(crossingMm > 0)) return null;
  const now = evaluate(op);
  const at = evaluate({ ...op, cssMm: op.cssMm + crossingMm });
  if (!now.valid || !at.valid || !Number.isFinite(now.p80) || !Number.isFinite(at.p80)) return null;
  return (at.p80 - now.p80) / crossingMm;
}

export const DRIFT_TEXT = {
  control: {
    en: 'Your drift rate: how fast the closed-side setting opens as the liners wear, in millimetres per hour. The product asserts no wear rate and sets none: until you enter yours the curve is drawn against the opening of the setting.',
    es: 'Su velocidad de desplazamiento: cuán rápido se abre la abertura de descarga con el desgaste de los blindajes, en milímetros por hora. El producto no afirma ni fija ninguna tasa de desgaste: hasta que ingrese la suya, la curva se dibuja contra el desplazamiento de la abertura.',
  },
  unset: {
    en: 'No drift rate is set, so the axis is the opening of the setting in millimetres; enter your measured drift rate to read operating hours.',
    es: 'No hay velocidad de desplazamiento fijada, así que el eje es el desplazamiento de la abertura en milímetros; ingrese su velocidad medida para leer horas de operación.',
  },
} satisfies Record<string, Text>;

/** The three callouts of the campaign view: the target, where it is crossed, and the P80 at the now line (or, before a drift rate is
 * set, the drift response over the drawn range: the secant from the curve's start to the target's crossing, driftSecant). */
export function hoursCallouts(
  caseId: string,
  target: number,
  curve: DriftCurve,
  secant: number | null,
  atCursorP80: number | null,
  fmt: (v: number, o: { digits?: number }) => string,
): CalloutSpec[] {
  const source: Text = { en: `Live engine, ${caseId}`, es: `Motor en vivo, ${caseId}` };
  const reader: Text = { en: 'Your target and your drift rate', es: 'Su objetivo y su velocidad de desplazamiento' };
  const notReached: Text = { en: 'the target is not reached below the ceiling of the setting', es: 'el objetivo no se alcanza bajo el techo de la abertura' };
  const useHours = curve.hours !== null;
  return [
    { id: 'target', eyebrow: { en: 'TARGET P80', es: 'P80 OBJETIVO' }, value: fmt(target, { digits: 3 }), unit: { en: 'mm', es: 'mm' }, state: 'warning', source: reader },
    useHours
      ? { id: 'cross', eyebrow: { en: 'CROSSED AT', es: 'CRUZADO EN' }, value: curve.crossingH === null ? null : fmt(curve.crossingH, { digits: 3 }), unit: { en: 'h', es: 'h' }, state: 'alarm', source: { en: `${source.en}, at your drift rate`, es: `${source.es}, a su velocidad` }, missing: notReached }
      : {
          id: 'cross',
          eyebrow: { en: 'MARGIN', es: 'MARGEN' },
          value: curve.crossingMm === null ? null : fmt(curve.crossingMm, { digits: 3 }),
          unit: { en: 'mm', es: 'mm' },
          state: 'alarm',
          source: { en: `Drift allowed to the target; ${source.en}`, es: `Desplazamiento hasta el objetivo; ${source.es}` },
          missing: notReached,
        },
    atCursorP80 !== null
      ? { id: 'now', eyebrow: { en: 'P80 NOW', es: 'P80 AHORA' }, value: fmt(atCursorP80, { digits: 3 }), unit: { en: 'mm', es: 'mm' }, state: 'selected', source: { en: `At the now line; ${source.en}`, es: `En la línea de ahora; ${source.es}` } }
      : {
          id: 'now',
          eyebrow: { en: 'SLOPE', es: 'PENDIENTE' },
          value: secant === null ? null : fmt(secant, { digits: 3 }),
          unit: { en: 'mm/mm', es: 'mm/mm' },
          state: 'selected',
          source: { en: `Secant to the target over the drawn range, P80 per mm of drift, live engine, ${caseId}`, es: `Secante al objetivo en el rango dibujado, P80 por mm de desplazamiento, motor en vivo, ${caseId}` },
          missing: { en: 'the target is not reached on the drawn range', es: 'el objetivo no se alcanza en el rango dibujado' },
        },
  ];
}

/** The curve drawn out to a share `reveal` of the way to the target's crossing (the whole curve at 1): the values past it are gaps. */
export function drawnTo(values: (number | null)[], xs: readonly number[], crossX: number | null, reveal: number): (number | null)[] {
  if (reveal >= 1) return values;
  const end = crossX ?? xs[xs.length - 1] ?? 0;
  const upTo = xs[0] + Math.max(0, reveal) * (end - xs[0]);
  return values.map((v, i) => (i === 0 || xs[i] <= upTo ? v : null));
}

export function HoursView() {
  const { sel, target: sharedTarget, setTarget, drift, setDrift } = useView();
  const stateKey = useWorkbenchState()?.stateKey;
  const lang = useShellLang();
  const num = useNum();
  const { hours, setHours } = useHours();
  // the story's entry draws the curve out from the current setting to the target's crossing (views/staging.tsx); the App draws it whole
  const { reveal } = useEntry();
  if (!sel) return <Pending />;
  const op = sel.op;
  const target = sharedTarget > sel.result.p80 ? sharedTarget : defaultP80Target(sel.result.p80);
  const curve = driftCurve(op, target, CSS_MAX_MM[op.machine], drift);
  const secant = driftSecant(op, curve.crossingMm);
  const useHoursAxis = curve.hours !== null && drift !== null;
  const xs = useHoursAxis ? curve.hours! : curve.openingMm;
  const xMax = xs[xs.length - 1] || 1;
  const cursorX = useHoursAxis && hours !== null ? Math.min(xMax, Math.max(0, hours)) : null;
  const atCursor = cursorX !== null && drift !== null ? evaluate({ ...op, cssMm: op.cssMm + cursorX * drift }) : null;
  const callouts = hoursCallouts(sel.data.manifest.case_id, target, curve, secant, atCursor && Number.isFinite(atCursor.p80) ? atCursor.p80 : null, (v, o) => num(v, o));
  const crossX = useHoursAxis ? curve.crossingH : curve.crossingMm;
  const p80s = curve.p80.filter((v): v is number => v !== null);
  const yLo = Math.min(target, ...p80s) * 0.95;
  const yHi = Math.max(target, ...p80s) * 1.05;
  const points: ChartPoint[] = [
    // the target line is dashed from the plot's left edge, where its first dash is drawn: the anchor stands on ink at any width
    { id: 'target', x: xs[0] ?? 0, y: target },
    { id: 'cross', x: crossX ?? xMax, y: target },
    { id: 'now', x: cursorX ?? xs[0], y: atCursor ? atCursor.p80 : (curve.p80[0] ?? target) },
  ];
  const marks: { x: number; label: BiText }[] = [];
  if (crossX !== null && crossX <= xMax) marks.push({ x: crossX, label: { en: 'target crossed', es: 'objetivo cruzado' } });
  if (useHoursAxis && REFERENCE_RESET_H <= xMax) marks.push({ x: REFERENCE_RESET_H, label: REFERENCE_LABEL });
  if (cursorX !== null) marks.push({ x: cursorX, label: { en: 'now', es: 'ahora' } });
  return (
    <PlotCard
      fill
      title={{ en: 'P80 as the setting drifts open', es: 'P80 a medida que la abertura se abre' }}
      lane="live"
      provenance={provenanceOf(sel)}
      dataKey={stateKey}
      note={{ en: `${CAMPAIGN_TEXT.measure.en}${useHoursAxis ? '' : ` ${DRIFT_TEXT.unset.en}`}`, es: `${CAMPAIGN_TEXT.measure.es}${useHoursAxis ? '' : ` ${DRIFT_TEXT.unset.es}`}` }}
    >
      <div className="cdem-stack" data-caos-flow="" data-drift={drift ?? ''} data-hours={cursorX ?? ''}>
        <div className="cdem-controls">
          <label title={CAMPAIGN_TEXT.control[lang]}>
            {lang === 'es' ? 'P80 objetivo (mm) ' : 'P80 target (mm) '}
            <input type="number" min={0.1} step={0.1} value={Math.round(target * 10) / 10} onChange={(e) => Number(e.target.value) > 0 && setTarget(Number(e.target.value))} style={{ width: '5.5rem' }} />
          </label>
          <label title={DRIFT_TEXT.control[lang]}>
            {lang === 'es' ? 'Su velocidad (mm/h) ' : 'Your drift rate (mm/h) '}
            <input
              type="number"
              min={0}
              step={0.01}
              value={drift ?? ''}
              placeholder={lang === 'es' ? 'sin fijar' : 'not set'}
              onChange={(e) => setDrift(e.target.value === '' || !(Number(e.target.value) > 0) ? null : Number(e.target.value))}
              style={{ width: '5.5rem' }}
              data-drift-input=""
            />
          </label>
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.ceil(xMax))}
            step={Math.max(0.1, Math.ceil(xMax) / 200)}
            value={cursorX ?? 0}
            disabled={!useHoursAxis}
            aria-label={lang === 'es' ? 'Horas de operación (línea de ahora)' : 'Operating hours (the now line)'}
            onChange={(e) => setHours(Number(e.target.value))}
            data-hours-cursor=""
          />
          <span className="cdem-cursor-chip">{cursorX !== null ? `${num(cursorX, { digits: 3 })} h` : lang === 'es' ? 'horas: fije su velocidad' : 'hours: set your drift rate'}</span>
        </div>
        <ChartCallouts callouts={callouts} points={points} frame={{ x: [0, xMax], y: [yLo, yHi] }}>
          <UPlotChart
            title={{ en: 'P80 against operating hours', es: 'P80 contra horas de operación' }}
            height="fill"
            x={useHoursAxis ? { values: xs, label: { en: 'Operating hours', es: 'Horas de operación' }, unit: 'h' } : { values: xs, label: { en: 'Opening of the setting', es: 'Desplazamiento de la abertura' }, unit: 'mm' }}
            y={{ label: { en: 'Product P80', es: 'P80 del producto' }, unit: 'mm', range: [yLo, yHi] }}
            series={[{ id: 'p80', label: { en: 'P80 (live engine)', es: 'P80 (motor en vivo)' }, values: drawnTo(curve.p80, xs, crossX, Math.ceil(reveal * 12) / 12), color: LIVE_COLOR, width: 2.4 }]}
            yMarks={[{ y: target, label: { en: 'target P80', es: 'P80 objetivo' }, tone: 'neutral' }]}
            marks={marks}
          />
        </ChartCallouts>
      </div>
    </PlotCard>
  );
}
