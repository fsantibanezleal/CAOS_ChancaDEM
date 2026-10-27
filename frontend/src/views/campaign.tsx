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
import { Pending, provenanceOf, useNum, useT, useView } from './shared';
import { finAll, LIVE_COLOR, logSpace } from './series';

/** The re-set interval of the one plant the research found a figure for: manual adjustment of the setting every 45 h (Ma et al. 2016, p. 3). */
export const REFERENCE_RESET_H = 45;
/** The x axis: the drift rate, from the lowest to the highest value the axis shows [mm/h]. */
export const DRIFT_RANGE: [number, number] = [0.01, 1];
const CURVE_POINTS = 49;
/** The target the view opens with, as a multiple of the case's own P80: a control value, not a claim. */
export const DEFAULT_TARGET_FACTOR = 1.1;

/** The default P80 target: the case's P80 plus 10 percent. */
export const defaultTarget = (p80Mm: number): number => p80Mm * DEFAULT_TARGET_FACTOR;

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
  const baseTarget = defaultTarget(p80);
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
