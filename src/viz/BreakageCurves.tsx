import { useCallback } from 'react';
import uPlot from 'uplot';
import { useShellLang, InlineMath } from '@fasl-work/caos-app-shell';
import { UPlotChart, themeVars } from './UPlotChart';
import { t10Of, specificEnergy, tFamily } from '../physics/breakage';
import type { Operating } from '../physics/types';

// Breakage / appearance curves: the JKMRC t10 vs specific-energy curve (with the current operating point) and
// the t-family (tn vs 1/n) that fills the breakage matrix B — showing B is DERIVED from the cited A,b, never
// hand-tuned. Reacts to throw/speed (→ Ecs) and ore A·b.
export function BreakageCurves({ op, height = 220 }: { op: Operating; height?: number }) {
  const es = useShellLang() === 'es';
  const ecsCur = specificEnergy(op.throwMm, op.speedRpm);
  const t10Cur = t10Of(ecsCur, op.oreAxb);

  const ecsGrid: number[] = [], t10s: number[] = [];
  for (let e = 0; e <= 4; e += 0.05) { ecsGrid.push(e); t10s.push(t10Of(e, op.oreAxb) * 100); }
  const data: uPlot.AlignedData = [ecsGrid, t10s, ecsGrid.map((e) => (Math.abs(e - ecsCur) < 0.03 ? t10Cur * 100 : null))];

  const build = useCallback((width: number, h: number): uPlot.Options => {
    const v = themeVars();
    return {
      width, height: h,
      scales: { x: { time: false }, y: { range: [0, 100] } },
      axes: [
        { stroke: v.dim, grid: { stroke: v.grid }, label: 'Ecs (kWh/t)', labelSize: 26, font: '11px sans-serif', labelFont: '11px sans-serif' },
        { stroke: v.dim, grid: { stroke: v.grid }, label: 't10 (%)', labelSize: 26, font: '11px sans-serif', labelFont: '11px sans-serif' },
      ],
      cursor: { drag: { x: true, y: false }, points: { show: true }, focus: { prox: 20 } },
      legend: { show: true, live: true },
      series: [
        { label: 'Ecs', value: (_u, x) => (x == null ? '--' : `${x!.toFixed(2)} kWh/t`) },
        { label: 't10', stroke: v.accent, width: 2.4, value: (_u, y) => (y == null ? '--' : `${y.toFixed(1)} %`) },
        { label: es ? 'actual' : 'current', stroke: '#f0883e', points: { show: true, size: 10, fill: '#f0883e' }, width: 0 },
      ],
    };
  }, [es]);

  const tf = tFamily(t10Cur);
  return (
    <div>
      <UPlotChart data={data} build={build} height={height} />
      <div className="tz-panel-sub" style={{ marginTop: '0.3rem' }}>
        <InlineMath tex={String.raw`t_{10}=A(1-e^{-b\,E_{cs}})`} /> · Ecs ≈ {ecsCur.toFixed(2)} kWh/t · t10 = <b style={{ color: 'var(--color-fg)' }}>{(t10Cur * 100).toFixed(1)}%</b>
      </div>
      <table className="tz-table" style={{ marginTop: '0.4rem' }}>
        <thead><tr><th>{es ? 'familia t' : 't-family'}</th>{tf.map((t) => <th key={t.n} className="num">t{t.n}</th>)}</tr></thead>
        <tbody><tr><td>{es ? '% pasa 1/n' : '% pass 1/n'}</td>{tf.map((t) => <td key={t.n} className="num">{(t.tn * 100).toFixed(1)}</td>)}</tr></tbody>
      </table>
    </div>
  );
}
