import { useCallback } from 'react';
import uPlot from 'uplot';
import { useShellLang } from '@fasl-work/caos-app-shell';
import { UPlotChart, themeVars } from './UPlotChart';
import { throughput, optimalSpeed } from '../physics/capacity';
import type { Operating } from '../physics/types';

// Capacity envelope: throughput vs eccentric speed, showing the capacity HUMP (rises to an optimum then falls
// as the gyrating head obstructs free-fall). The current operating point is marked; the optimum is annotated.
export function CapacityEnvelope({ op, height = 240, measuredTph }: { op: Operating; height?: number; measuredTph?: number }) {
  const es = useShellLang() === 'es';
  const speeds: number[] = [], q: number[] = [];
  for (let s = 120; s <= 640; s += 8) { speeds.push(s); q.push(throughput(op.machine, op.cssMm, op.throwMm, s, op.calibrated)); }
  const curQ = throughput(op.machine, op.cssMm, op.throwMm, op.speedRpm, op.calibrated);
  const opt = optimalSpeed(op.machine);
  const yMax = Math.max(Math.max(...q), measuredTph ?? 0) * 1.1;
  // measured survey point (Real lane): plotted at the nominal running speed as a REAL anchor next to the curve
  const measuredSeries = measuredTph != null ? speeds.map((s) => (Math.abs(s - op.speedRpm) < 4 ? measuredTph : null)) : null;
  const data: uPlot.AlignedData = measuredSeries
    ? [speeds, q, speeds.map((s) => (Math.abs(s - op.speedRpm) < 4 ? curQ : null)), measuredSeries]
    : [speeds, q, speeds.map((s) => (Math.abs(s - op.speedRpm) < 4 ? curQ : null))];

  const build = useCallback((width: number, h: number): uPlot.Options => {
    const v = themeVars();
    const series: uPlot.Series[] = [
      { label: es ? 'velocidad' : 'speed', value: (_u, x) => (x == null ? '--' : `${x!.toFixed(0)} rpm`) },
      { label: es ? 'capacidad (modelo)' : 'throughput (model)', stroke: v.accent, width: 2.4, value: (_u, y) => (y == null ? '--' : `${y.toFixed(0)} t/h`) },
      { label: es ? 'operación' : 'operating', stroke: '#f0883e', points: { show: true, size: 10, fill: '#f0883e' }, width: 0 },
    ];
    if (measuredSeries) series.push({ label: es ? 'medido (real)' : 'measured (real)', stroke: '#3fb950', points: { show: true, size: 12, fill: '#3fb950' }, width: 0, value: (_u, y) => (y == null ? '--' : `${y.toFixed(0)} t/h`) });
    return {
      width, height: h,
      scales: { x: { time: false }, y: { range: [0, yMax] } },
      axes: [
        { stroke: v.dim, grid: { stroke: v.grid }, label: es ? 'velocidad (rpm)' : 'speed (rpm)', labelSize: 26, font: '11px sans-serif', labelFont: '11px sans-serif' },
        { stroke: v.dim, grid: { stroke: v.grid }, label: 't/h', labelSize: 26, font: '11px sans-serif', labelFont: '11px sans-serif' },
      ],
      cursor: { drag: { x: true, y: false, setScale: true }, points: { show: true }, focus: { prox: 20 } },
      legend: { show: true, live: true },
      series,
    };
  }, [es, yMax, measuredSeries]);

  return (
    <div>
      <UPlotChart data={data} build={build} height={height} />
      <div className="tz-panel-sub" style={{ marginTop: '0.3rem' }}>
        {es ? 'Óptimo en' : 'Optimum at'} ≈ {opt} rpm · {es ? 'actual' : 'current'} {op.speedRpm} rpm → <b style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-mono)' }}>{curQ.toFixed(0)} t/h</b>
        {measuredTph != null ? ` · ${es ? 'medido' : 'measured'} ${measuredTph.toFixed(0)} t/h` : ''}
        {op.speedRpm > opt ? ` · ${es ? 'pasado el óptimo (capacidad cae)' : 'past the optimum (capacity falling)'}` : ''}
      </div>
    </div>
  );
}
