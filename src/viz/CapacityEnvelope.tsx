import { useCallback } from 'react';
import uPlot from 'uplot';
import { useShellLang } from '@fasl-work/caos-app-shell';
import { UPlotChart, themeVars } from './UPlotChart';
import { throughput, optimalSpeed } from '../physics/capacity';
import type { Operating } from '../physics/types';

// Capacity envelope: throughput vs eccentric speed, showing the capacity HUMP (rises to an optimum then falls
// as the gyrating head obstructs free-fall). The current operating point is marked; the optimum is annotated.
export function CapacityEnvelope({ op, height = 240 }: { op: Operating; height?: number }) {
  const es = useShellLang() === 'es';
  const speeds: number[] = [], q: number[] = [];
  for (let s = 120; s <= 640; s += 8) { speeds.push(s); q.push(throughput(op.machine, op.cssMm, op.throwMm, s)); }
  const curQ = throughput(op.machine, op.cssMm, op.throwMm, op.speedRpm);
  const opt = optimalSpeed(op.machine);
  const data: uPlot.AlignedData = [speeds, q, speeds.map((s) => (Math.abs(s - op.speedRpm) < 4 ? curQ : null))];

  const build = useCallback((width: number, h: number): uPlot.Options => {
    const v = themeVars();
    return {
      width, height: h,
      scales: { x: { time: false }, y: { range: [0, Math.max(...q) * 1.1] } },
      axes: [
        { stroke: v.dim, grid: { stroke: v.grid }, label: es ? 'velocidad (rpm)' : 'speed (rpm)', labelSize: 26, font: '11px sans-serif', labelFont: '11px sans-serif' },
        { stroke: v.dim, grid: { stroke: v.grid }, label: 't/h', labelSize: 26, font: '11px sans-serif', labelFont: '11px sans-serif' },
      ],
      cursor: { drag: { x: true, y: false, setScale: true }, points: { show: true }, focus: { prox: 20 } },
      legend: { show: true, live: true },
      series: [
        { label: es ? 'velocidad' : 'speed', value: (_u, x) => (x == null ? '--' : `${x!.toFixed(0)} rpm`) },
        { label: es ? 'capacidad' : 'throughput', stroke: v.accent, width: 2.4, value: (_u, y) => (y == null ? '--' : `${y.toFixed(0)} t/h`) },
        { label: es ? 'operación' : 'operating', stroke: '#f0883e', points: { show: true, size: 10, fill: '#f0883e' }, width: 0 },
      ],
    };
  }, [es, q]);

  return (
    <div>
      <UPlotChart data={data} build={build} height={height} />
      <div className="tz-panel-sub" style={{ marginTop: '0.3rem' }}>
        {es ? 'Óptimo en' : 'Optimum at'} ≈ {opt} rpm · {es ? 'actual' : 'current'} {op.speedRpm} rpm → <b style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-mono)' }}>{curQ.toFixed(0)} t/h</b>
        {op.speedRpm > opt ? ` · ${es ? 'pasado el óptimo (capacidad cae)' : 'past the optimum (capacity falling)'}` : ''}
      </div>
    </div>
  );
}
