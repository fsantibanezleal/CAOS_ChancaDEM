// The nine figures of the Methodology page, one per topic. Every curve is computed by the build's own engine functions at
// the operating point named in the figure's caption, so a figure cannot drift from the code it describes; every colour is a
// shell token; every label is bilingual through `useT`.
import { useFormat } from '@fasl-work/caos-app-shell';
import { useT } from '../bi';
import { evaluate } from '../../engine/engine';
import { appearanceCum, phiFromT10, t10Calibrated } from '../../engine/breakage';
import { classificationParams, classify } from '../../engine/classification';
import { HP500_ENVELOPE } from '../../engine/envelope';
import { bondPower, optimalSpeed, throughput } from '../../engine/capacity';
import type { Operating } from '../../engine/types';
import { Chain, Plot, TOKENS, type Pt } from './plot';

/** The reference operating point of the figures: a secondary cone at its design throw and optimum speed. */
export const REF_OP: Operating = { machine: 'cone-sec', cssMm: 32, throwMm: 30, speedRpm: 360, feedX63Mm: 90, feedM: 1.2, oreAxb: 60, oreWi: 14 };

const range = (a: number, b: number, n: number): number[] => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

export function SizeFigure() {
  const t = useT();
  const f = useFormat();
  const r = evaluate(REF_OP);
  const pts = (psd: typeof r.feed): Pt[] => psd.edgesMm.map((e, i) => [e, psd.passing[i] * 100]);
  return (
    <Plot
      label={t('Feed and product passing curves on the sieve grid', 'Curvas de pasante del alimento y del producto sobre la grilla de tamices')}
      xLabel={t('Size (mm, logarithmic)', 'Tamaño (mm, logarítmico)')}
      yLabel={t('Passing (%)', 'Pasante (%)')}
      xr={[0.0156, 256]} xlog xticks={[0.0156, 0.0625, 0.25, 1, 4, 16, 64, 256]} yr={[0, 100]} yticks={[0, 20, 40, 60, 80, 100]} yDecimals={0}
      series={[
        { name: t('Feed (Rosin-Rammler)', 'Alimento (Rosin-Rammler)'), pts: pts(r.feed), color: TOKENS.accent },
        { name: t('Product', 'Producto'), pts: pts(r.product), color: TOKENS.magenta },
      ]}
      vmarks={[
        { x: r.p80, label: `P80 ${f(r.p80, { digits: 3 })} mm`, color: TOKENS.magenta, side: 'left' },
        { x: r.f80, label: `F80 ${f(r.f80, { digits: 3 })} mm`, color: TOKENS.accent, side: 'left', row: 1 },
      ]}
      hmarks={[{ y: 80, label: t('80 % passing', '80 % pasante'), color: TOKENS.faint, side: 'left' }]}
    />
  );
}

export function BreakageFigure() {
  const t = useT();
  const f = useFormat();
  const us = range(Math.log(0.01), 0, 80).map(Math.exp);
  const mk = (t10: number, color: string) => ({
    name: `t10 = ${f(t10 * 100, { decimals: 0 })} %`,
    color,
    pts: us.map((u): Pt => [u, appearanceCum(u, phiFromT10(t10)) * 100]),
  });
  return (
    <Plot
      label={t('Austin cumulative breakage function for three t10 values', 'Función de fractura acumulada de Austin para tres valores de t10')}
      xLabel={t('Relative size u = x / parent size (logarithmic)', 'Tamaño relativo u = x / tamaño madre (logarítmico)')}
      yLabel={t('Progeny passing (%)', 'Progenie pasante (%)')}
      xr={[0.01, 1]} xlog xticks={[0.01, 0.1, 1]} xDecimals={2} yr={[0, 100]} yticks={[0, 20, 40, 60, 80, 100]} yDecimals={0}
      series={[mk(0.15, TOKENS.accent), mk(0.25, TOKENS.accent2), mk(0.4, TOKENS.magenta)]}
      vmarks={[{ x: 0.1, label: t('u = 1/10, where B = t10', 'u = 1/10, donde B = t10'), color: TOKENS.warn, side: 'right' }]}
    />
  );
}

export function ClassificationFigure() {
  const t = useT();
  const f = useFormat();
  const ds = range(0, 110, 220);
  const at = (throwMm: number) => classificationParams('cone-sec', REF_OP.cssMm, { throwMm });
  const base = at(30);
  const wide = at(46);
  const curve = (c: typeof base): Pt[] => ds.map((d) => [d, classify(d, c)]);
  return (
    <Plot
      label={t('Whiten classification curve at two eccentric throws', 'Curva de clasificación de Whiten con dos carreras excéntricas')}
      xLabel={t('Particle size d (mm)', 'Tamaño de partícula d (mm)')}
      yLabel={t('Capture probability C(d)', 'Probabilidad de captura C(d)')}
      xr={[0, 110]} xticks={[0, 20, 40, 60, 80, 100]} xDecimals={0} yr={[0, 1]} yticks={[0, 0.25, 0.5, 0.75, 1]} yDecimals={2}
      series={[
        { name: t('Throw 30 mm (design)', 'Carrera 30 mm (diseño)'), pts: curve(base), color: TOKENS.accent },
        { name: t('Throw 46 mm', 'Carrera 46 mm'), pts: curve(wide), color: TOKENS.magenta },
      ]}
      vmarks={[
        { x: base.k1, label: `K1 ${f(base.k1, { digits: 3 })} mm`, color: TOKENS.sub, side: 'right', row: 3 },
        { x: base.k2, label: `K2 ${f(base.k2, { digits: 3 })} mm`, color: TOKENS.accent, side: 'left', row: 0 },
        { x: wide.k2, label: `K2 ${f(wide.k2, { digits: 3 })} mm`, color: TOKENS.magenta, side: 'right', row: 0 },
      ]}
    />
  );
}

export function CalibratedFigure() {
  const t = useT();
  const css = range(30, 60, 60);
  const mk = (f80: number, color: string) => ({
    name: `f80 = ${f80} mm`,
    color,
    pts: css.map((c): Pt => [c, t10Calibrated(c, f80) * 100]),
  });
  return (
    <Plot
      label={t('Calibrated t10 against the closed-side setting for three feed sizes', 'El t10 calibrado frente al lado cerrado para tres tamaños de alimento')}
      xLabel={t('Closed-side setting CSS (mm)', 'Lado cerrado CSS (mm)')}
      yLabel={t('Calibrated t10 (%)', 't10 calibrado (%)')}
      xr={[30, 60]} xticks={[30, 35, 40, 45, 50, 55, 60]} xDecimals={0} yr={[0, 50]} yticks={[0, 10, 20, 30, 40, 50]} yDecimals={0}
      band={{ x0: HP500_ENVELOPE.cssMm[0], x1: HP500_ENVELOPE.cssMm[1], label: t('Calibrated support of CSS', 'Soporte calibrado del CSS') }}
      hmarks={[{ y: 44, label: t('Cap of the engine, 44 %', 'Tope del motor, 44 %'), color: TOKENS.warn, side: 'right' }]}
      series={[mk(47, TOKENS.accent), mk(90, TOKENS.accent2), mk(140, TOKENS.magenta)]}
    />
  );
}

export function CapacityFigure() {
  const t = useT();
  const speeds = range(100, 700, 120);
  const mk = (throwMm: number, color: string) => ({
    name: t(`Throw ${throwMm} mm`, `Carrera ${throwMm} mm`),
    color,
    pts: speeds.map((n): Pt => [n, throughput('cone-sec', REF_OP.cssMm, throwMm, n)]),
  });
  return (
    <Plot
      label={t('Throughput against eccentric speed, the capacity hump', 'Capacidad frente a la velocidad excéntrica, la joroba de capacidad')}
      xLabel={t('Eccentric speed (rpm)', 'Velocidad excéntrica (rpm)')}
      yLabel={t('Throughput (t/h)', 'Capacidad (t/h)')}
      xr={[100, 700]} xticks={[100, 200, 300, 400, 500, 600, 700]} xDecimals={0} yr={[0, 800]} yticks={[0, 200, 400, 600, 800]} yDecimals={0}
      vmarks={[{ x: optimalSpeed('cone-sec'), label: t('Optimum speed', 'Velocidad óptima'), color: TOKENS.warn, side: 'right' }]}
      series={[mk(16, TOKENS.accent), mk(30, TOKENS.accent2), mk(44, TOKENS.magenta)]}
    />
  );
}

export function PowerFigure() {
  const t = useT();
  const p80s = range(4, 90, 120);
  const mk = (wi: number, color: string) => ({
    name: `Wi = ${wi} kWh/t`,
    color,
    pts: p80s.map((p): Pt => [p, bondPower(1, 100, p, wi)]),
  });
  return (
    <Plot
      label={t('Bond specific energy against product size for three work indices', 'Energía específica de Bond frente al tamaño del producto para tres índices de trabajo')}
      xLabel={t('Product size P80 (mm), feed F80 fixed at 100 mm', 'Tamaño del producto P80 (mm), F80 del alimento fijo en 100 mm')}
      yLabel={t('Specific energy W (kWh/t)', 'Energía específica W (kWh/t)')}
      xr={[4, 90]} xticks={[10, 20, 30, 40, 50, 60, 70, 80, 90]} xDecimals={0} yr={[0, 2.5]} yticks={[0, 0.5, 1, 1.5, 2, 2.5]} yDecimals={1}
      series={[mk(10, TOKENS.accent), mk(14, TOKENS.accent2), mk(18, TOKENS.magenta)]}
    />
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
