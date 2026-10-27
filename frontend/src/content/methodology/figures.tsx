// The nine figures of the Methodology page, one per topic. The six that plot computed data are the shell's `UPlotChart`
// (Tier A interactions on, a bilingual title, axis labels with units), fed by the build's own engine functions at the
// operating point named in each caption, so a figure cannot drift from the code it describes. The three that draw a
// structure and no data (the two networks and the leave-one-out fold) stay hand-authored SVG with shell tokens only.
import { useFormat, type ShellColorToken } from '@fasl-work/caos-app-shell';
import { UPlotChart } from '@fasl-work/caos-app-shell/chart';
import { useT } from '../bi';
import { evaluate } from '../../engine/engine';
import { appearanceCum, phiFromT10, t10Calibrated } from '../../engine/breakage';
import { classificationParams, classify } from '../../engine/classification';
import { HP500_ENVELOPE } from '../../engine/envelope';
import { bondPower, optimalSpeed, throughput } from '../../engine/capacity';
import type { Operating } from '../../engine/types';

const W = 640;
const TOKENS = {
  accent: 'var(--color-accent)',
  accent2: 'var(--color-accent-2)',
  magenta: 'var(--color-magenta)',
  warn: 'var(--color-warn)',
};
const C: Record<'accent' | 'accent2' | 'magenta', ShellColorToken> = { accent: '--color-accent', accent2: '--color-accent-2', magenta: '--color-magenta' };
const bi = (s: string) => ({ en: s, es: s });
const HEIGHT = 300;

/** The reference operating point of the figures: a secondary cone at its design throw and optimum speed. */
export const REF_OP: Operating = { machine: 'cone-sec', cssMm: 32, throwMm: 30, speedRpm: 360, feedX63Mm: 90, feedM: 1.2, oreAxb: 60, oreWi: 14 };

const range = (a: number, b: number, n: number): number[] => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

export function SizeFigure() {
  const f = useFormat();
  const r = evaluate(REF_OP);
  return (
    <UPlotChart
      title={{ en: 'Feed and product passing curves on the sieve grid', es: 'Curvas de pasante del alimento y del producto sobre la grilla de tamices' }}
      x={{ values: r.feed.edgesMm.slice().reverse(), label: { en: 'Size', es: 'Tamaño' }, unit: bi('mm'), log: true }}
      y={{ label: { en: 'Passing', es: 'Pasante' }, unit: bi('%'), range: [0, 100], format: { decimals: 0 } }}
      series={[
        { label: { en: 'Feed (Rosin-Rammler)', es: 'Alimento (Rosin-Rammler)' }, values: r.feed.passing.map((p) => p * 100).reverse(), color: C.accent },
        { label: { en: 'Product', es: 'Producto' }, values: r.product.passing.map((p) => p * 100).reverse(), color: C.magenta },
      ]}
      marks={[
        { x: r.p80, label: bi(`P80 ${f(r.p80, { digits: 3 })} mm`) },
        { x: r.f80, label: bi(`F80 ${f(r.f80, { digits: 3 })} mm`) },
      ]}
      yMarks={[{ y: 80, label: { en: '80 % passing', es: '80 % pasante' }, tone: 'neutral' }]}
      height={HEIGHT}
    />
  );
}

export function BreakageFigure() {
  const f = useFormat();
  const us = range(Math.log(0.01), 0, 80).map(Math.exp);
  const mk = (t10: number, color: ShellColorToken) => ({
    label: bi(`t10 = ${f(t10 * 100, { decimals: 0 })} %`),
    color,
    values: us.map((u) => appearanceCum(u, phiFromT10(t10)) * 100),
  });
  return (
    <UPlotChart
      title={{ en: 'Austin cumulative breakage function for three t10 values', es: 'Función de fractura acumulada de Austin para tres valores de t10' }}
      x={{ values: us, label: { en: 'Relative size u = x / parent size', es: 'Tamaño relativo u = x / tamaño madre' }, log: true, format: { digits: 2 } }}
      y={{ label: { en: 'Progeny passing', es: 'Progenie pasante' }, unit: bi('%'), range: [0, 100], format: { decimals: 0 } }}
      series={[mk(0.15, C.accent), mk(0.25, C.accent2), mk(0.4, C.magenta)]}
      marks={[{ x: 0.1, label: { en: 'u = 1/10, where B = t10', es: 'u = 1/10, donde B = t10' } }]}
      height={HEIGHT}
    />
  );
}

export function ClassificationFigure() {
  const f = useFormat();
  const ds = range(0, 110, 220);
  const at = (throwMm: number) => classificationParams('cone-sec', REF_OP.cssMm, { throwMm });
  const base = at(30);
  const wide = at(46);
  return (
    <UPlotChart
      title={{ en: 'Whiten classification curve at two eccentric throws', es: 'Curva de clasificación de Whiten con dos carreras excéntricas' }}
      x={{ values: ds, label: { en: 'Particle size d', es: 'Tamaño de partícula d' }, unit: bi('mm'), format: { decimals: 0 } }}
      y={{ label: { en: 'Capture probability C(d)', es: 'Probabilidad de captura C(d)' }, range: [0, 1], format: { decimals: 2 } }}
      series={[
        { label: { en: 'Throw 30 mm (design)', es: 'Carrera 30 mm (diseño)' }, values: ds.map((d) => classify(d, base)), color: C.accent },
        { label: { en: 'Throw 46 mm', es: 'Carrera 46 mm' }, values: ds.map((d) => classify(d, wide)), color: C.magenta },
      ]}
      marks={[
        { x: base.k1, label: bi(`K1 ${f(base.k1, { digits: 3 })} mm`) },
        { x: base.k2, label: bi(`K2 ${f(base.k2, { digits: 3 })} mm`) },
        { x: wide.k2, label: bi(`K2 ${f(wide.k2, { digits: 3 })} mm`) },
      ]}
      height={HEIGHT}
    />
  );
}

export function CalibratedFigure() {
  const css = range(30, 60, 60);
  const mk = (f80: number, color: ShellColorToken) => ({ label: bi(`f80 = ${f80} mm`), color, values: css.map((c) => t10Calibrated(c, f80) * 100) });
  return (
    <UPlotChart
      title={{ en: 'Calibrated t10 against the closed-side setting for three feed sizes', es: 'El t10 calibrado frente al lado cerrado para tres tamaños de alimento' }}
      x={{ values: css, label: { en: 'Closed-side setting CSS', es: 'Lado cerrado CSS' }, unit: bi('mm'), format: { decimals: 0 } }}
      y={{ label: { en: 'Calibrated t10', es: 't10 calibrado' }, unit: bi('%'), range: [0, 50], format: { decimals: 0 } }}
      series={[mk(47, C.accent), mk(90, C.accent2), mk(140, C.magenta)]}
      marks={[
        { x: HP500_ENVELOPE.cssMm[0], label: { en: 'Support starts', es: 'Empieza el soporte' } },
        { x: HP500_ENVELOPE.cssMm[1], label: { en: 'Support ends', es: 'Termina el soporte' } },
      ]}
      yMarks={[{ y: 44, label: { en: 'Cap of the engine, 44 %', es: 'Tope del motor, 44 %' }, tone: 'warn' }]}
      height={HEIGHT}
    />
  );
}

export function CapacityFigure() {
  const speeds = range(100, 700, 120);
  const mk = (throwMm: number, color: ShellColorToken) => ({
    label: { en: `Throw ${throwMm} mm`, es: `Carrera ${throwMm} mm` },
    color,
    values: speeds.map((n) => throughput('cone-sec', REF_OP.cssMm, throwMm, n)),
  });
  return (
    <UPlotChart
      title={{ en: 'Throughput against eccentric speed, the capacity hump', es: 'Capacidad frente a la velocidad excéntrica, la joroba de capacidad' }}
      x={{ values: speeds, label: { en: 'Eccentric speed', es: 'Velocidad excéntrica' }, unit: bi('rpm'), format: { decimals: 0 } }}
      y={{ label: { en: 'Throughput', es: 'Capacidad' }, unit: bi('t/h'), range: [0, 800], format: { decimals: 0 } }}
      series={[mk(16, C.accent), mk(30, C.accent2), mk(44, C.magenta)]}
      marks={[{ x: optimalSpeed('cone-sec'), label: { en: 'Optimum speed', es: 'Velocidad óptima' } }]}
      height={HEIGHT}
    />
  );
}

export function PowerFigure() {
  const p80s = range(4, 90, 120);
  const mk = (wi: number, color: ShellColorToken) => ({ label: bi(`Wi = ${wi} kWh/t`), color, values: p80s.map((p) => bondPower(1, 100, p, wi)) });
  return (
    <UPlotChart
      title={{ en: 'Bond specific energy against product size for three work indices', es: 'Energía específica de Bond frente al tamaño del producto para tres índices de trabajo' }}
      x={{ values: p80s, label: { en: 'Product size P80 (feed F80 fixed at 100 mm)', es: 'Tamaño del producto P80 (F80 del alimento fijo en 100 mm)' }, unit: bi('mm'), format: { decimals: 0 } }}
      y={{ label: { en: 'Specific energy W', es: 'Energía específica W' }, unit: bi('kWh/t'), range: [0, 2.5], format: { decimals: 1 } }}
      series={[mk(10, C.accent), mk(14, C.accent2), mk(18, C.magenta)]}
      height={HEIGHT}
    />
  );
}

/** A row of boxes joined by arrows, each box with a title and up to two detail lines (the network and fold diagrams). */
export interface Box {
  title: string;
  lines?: string[];
  tone?: string;
}
export function Chain({ label, boxes, arrows }: { label: string; boxes: Box[]; arrows?: string[] }) {
  const n = boxes.length;
  const gap = 50;
  const bw = (W - 20 - (n - 1) * gap) / n;
  return (
    <svg className="fig-svg wide" viewBox={`0 0 ${W} 170`} role="img" aria-label={label} data-chart="methodology-figure">
      {boxes.map((b, i) => {
        const x = 10 + i * (bw + gap);
        return (
          <g key={i}>
            <rect x={x} y={34} width={bw} height={92} rx={8} fill="var(--color-surface-2)" stroke="var(--color-border)" strokeWidth="1.5" />
            <rect x={x} y={34} width={6} height={92} rx={3} fill={b.tone ?? TOKENS.accent} />
            <text x={x + bw / 2 + 3} y={62} fontSize="18" fontWeight="700" textAnchor="middle" fill="var(--color-fg)">{b.title}</text>
            {(b.lines ?? []).map((ln, k) => (
              <text key={k} x={x + bw / 2 + 3} y={84 + k * 18} fontSize="12" textAnchor="middle" fill="var(--color-fg-subtle)">{ln}</text>
            ))}
            {i < n - 1 && (
              <g>
                <path d={`M ${x + bw + 4} 80 L ${x + bw + gap - 4} 80 M ${x + bw + gap - 11} 74 L ${x + bw + gap - 4} 80 L ${x + bw + gap - 11} 86`} fill="none" stroke="var(--color-fg-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {arrows?.[i] && <text x={x + bw + gap / 2} y={66} fontSize="11" textAnchor="middle" fill="var(--color-fg-subtle)">{arrows[i]}</text>}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function SurrogateFigure() {
  const t = useT();
  return (
    <Chain
      label={t('The surrogate network from the operating point to the ten outputs', 'La red sustituta desde el punto de operación hasta las diez salidas')}
      boxes={[
        { title: '11', lines: [t('inputs', 'entradas'), t('5 + 6', '5 + 6')], tone: TOKENS.accent2 },
        { title: '64', lines: [t('neurons', 'neuronas')] },
        { title: '64', lines: [t('neurons', 'neuronas')] },
        { title: '32', lines: [t('neurons', 'neuronas')] },
        { title: '10', lines: [t('outputs', 'salidas')], tone: TOKENS.magenta },
      ]}
      arrows={['GELU', 'GELU', 'GELU', 'linear']}
    />
  );
}

export function AutoencoderFigure() {
  const t = useT();
  return (
    <Chain
      label={t('The denoising autoencoder from 14 features through a 6-unit code', 'El autoencoder con ruido desde 14 atributos a través de un código de 6 unidades')}
      boxes={[
        { title: '14', lines: [t('features', 'atributos')], tone: TOKENS.accent2 },
        { title: '16', lines: [t('encoder', 'codificador')] },
        { title: '6', lines: [t('code', 'código')], tone: TOKENS.warn },
        { title: '16', lines: [t('decoder', 'decodificador')] },
        { title: '14', lines: [t('rebuilt', 'rehechos')], tone: TOKENS.magenta },
      ]}
      arrows={['GELU', 'GELU', 'GELU', 'linear']}
    />
  );
}

export function FoldFigure() {
  const t = useT();
  const n = 10;
  const bw = 46;
  const gap = 8;
  const x0 = (640 - (n * bw + (n - 1) * gap)) / 2;
  const tx = 14;
  const held = 3;
  return (
    <svg className="fig-svg wide" viewBox="0 0 640 190" role="img" aria-label={t('One fold of the leave-one-survey-out protocol', 'Un pliegue del protocolo dejar un muestreo afuera')} data-chart="methodology-figure">
      {Array.from({ length: n }).map((_, i) => {
        const x = x0 + i * (bw + gap);
        const out = i === held;
        const c = out ? 'var(--color-warn)' : 'var(--color-good)';
        return (
          <g key={i}>
            <rect x={x} y={30} width={bw} height={38} rx={6} fill="var(--color-surface-2)" stroke={c} strokeWidth="2" />
            <text x={x + bw / 2} y={54} fontSize="14" textAnchor="middle" fill="var(--color-fg)">{i + 1}</text>
          </g>
        );
      })}
      <text x={tx} y={20} fontSize="12" fill="var(--color-fg-subtle)">{t('Ten surveys of one HP500: this fold holds out survey 4', 'Diez muestreos de un HP500: este pliegue deja afuera el 4')}</text>
      <rect x={tx} y={92} width={22} height={12} rx={3} fill="var(--color-good)" />
      <text x={tx + 30} y={103} fontSize="12" fill="var(--color-fg-subtle)">{t('fit: the scalars on these nine', 'ajuste: los escalares con estas nueve')}</text>
      <rect x={tx} y={114} width={22} height={12} rx={3} fill="var(--color-warn)" />
      <text x={tx + 30} y={125} fontSize="12" fill="var(--color-fg-subtle)">{t('predict: the survey the fit never saw', 'predecir: el muestreo que el ajuste nunca vio')}</text>
      <text x={tx} y={152} fontSize="12" fill="var(--color-fg-subtle)">{t('controls: constant mean, label shuffle, leaky fold', 'controles: media constante, etiquetas barajadas, fuga')}</text>
      <text x={tx} y={172} fontSize="12" fill="var(--color-fg-subtle)">{t('interval: M0 plus or minus 1.2816 sigma of the residual', 'intervalo: M0 más o menos 1,2816 sigma del residuo')}</text>
    </svg>
  );
}

/** The structure diagram of one plotted topic: the steps the engine takes, as boxes (an SVG, so the topic also holds a drawn figure). */
export function FlowDiagram({ topic }: { topic: 'size' | 'calibrated' | 'capacity' | 'power' | 'breakage' | 'classification' }) {
  const t = useT();
  const defs: Record<string, { label: string; boxes: Box[]; arrows: string[] }> = {
    size: {
      label: t('From two feed numbers to the gradation readouts', 'De dos números del alimento a las lecturas de granulometría'),
      boxes: [{ title: 'x63, m', lines: [t('feed law', 'ley del alimento')], tone: TOKENS.accent2 }, { title: '28', lines: [t('classes', 'clases')] }, { title: t('passing', 'pasante'), lines: [t('cumulative', 'acumulado')] }, { title: 'F80 P80', lines: [t('log interpolation', 'interpolación log')], tone: TOKENS.magenta }],
      arrows: ['R(x)', t('sum', 'suma'), 'p'],
    },
    breakage: {
      label: t('From energy to the breakage matrix', 'De la energía a la matriz de fractura'),
      boxes: [{ title: 'Ecs', lines: [t('energy', 'energía')], tone: TOKENS.accent2 }, { title: 't10', lines: [t('fineness', 'finura')] }, { title: 'Phi', lines: [t('Austin weight', 'peso de Austin')] }, { title: 'B', lines: [t('lower triangular', 'triangular inf.')], tone: TOKENS.magenta }],
      arrows: ['A, b', 'B(1/10)', 'b_ij'],
    },
    classification: {
      label: t('The classification window that follows the open side', 'La ventana de clasificación que sigue al lado abierto'),
      boxes: [{ title: 'CSS, T', lines: [t('setting, throw', 'ajuste, carrera')], tone: TOKENS.accent2 }, { title: 'K1, K2', lines: [t('window', 'ventana')] }, { title: 'C(d)', lines: [t('per class', 'por clase')] }, { title: 'p', lines: [t('Whiten solve', 'solución de Whiten')], tone: TOKENS.magenta }],
      arrows: ['K', 'C', 'LU'],
    },
    calibrated: {
      label: t('The calibrated lane from a survey to the product', 'La vía calibrada desde un muestreo hasta el producto'),
      boxes: [{ title: 'CSS, f80', lines: [t('measured', 'medidos')], tone: TOKENS.accent2 }, { title: 'K1 K2 K3', lines: [t('Table 5', 'Tabla 5')] }, { title: 't10', lines: [t('calibrated', 'calibrado')] }, { title: 'P80', lines: [t('product', 'producto')], tone: TOKENS.magenta }],
      arrows: ['fit', 'fit', 'solve'],
    },
    capacity: {
      label: t('From the operating point to the throughput', 'Del punto de operación a la capacidad'),
      boxes: [{ title: 'CSS, T', lines: [t('opening', 'abertura')], tone: TOKENS.accent2 }, { title: t('factor', 'factor'), lines: [t('(CSS + T/2) / g', '(CSS + T/2) / g')] }, { title: 's e^(1-s)', lines: [t('speed hump', 'joroba de velocidad')] }, { title: 'Q', lines: [t('t/h', 't/h')], tone: TOKENS.magenta }],
      arrows: ['x', 'x', 'Q_ref'],
    },
    power: {
      label: t('From the gradation to the power draw', 'De la granulometría al consumo de potencia'),
      boxes: [{ title: 'F80, P80', lines: [t('sizes', 'tamaños')], tone: TOKENS.accent2 }, { title: 'W', lines: [t('Bond kWh/t', 'Bond kWh/t')] }, { title: 'P_d', lines: [t('W times Q', 'W por Q')] }, { title: 'P_c', lines: [t('paper form', 'forma del artículo')], tone: TOKENS.magenta }],
      arrows: ['Wi', 'Q', 'zeta, Pn'],
    },
  };
  const d = defs[topic];
  return <Chain label={d.label} boxes={d.boxes} arrows={d.arrows} />;
}
