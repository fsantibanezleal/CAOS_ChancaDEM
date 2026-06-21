import { useCallback } from 'react';
import uPlot from 'uplot';
import { UPlotChart, themeVars } from './UPlotChart';
import type { PSD } from '../physics/types';

// Feed-vs-product gradation on a semilog %-passing axis — the canonical comminution chart. Feed (dashed) vs
// product (solid accent); P80/F80 markers show the reduction. Reacts live to every slider.
export function PsdChart({ feed, product, f80, p80, height = 240 }: { feed: PSD; product: PSD; f80: number; p80: number; height?: number }) {
  // x = sieve edge size (mm, ascending for a left-to-right fine→coarse plot), y = % passing (0..100)
  const edges = feed.edgesMm;
  const xs = edges.map((e) => e).reverse();                 // ascending sizes
  const feedY = feed.passing.map((p) => p * 100).reverse();
  const prodY = product.passing.map((p) => p * 100).reverse();
  const data: uPlot.AlignedData = [xs, feedY, prodY];

  const build = useCallback((width: number, h: number): uPlot.Options => {
    const v = themeVars();
    return {
      width, height: h,
      scales: { x: { distr: 3, time: false }, y: { range: [0, 100] } },   // distr:3 = log x
      axes: [
        { stroke: v.dim, grid: { stroke: v.grid, width: 1 }, ticks: { stroke: v.grid },
          // log axis: label only the decade ticks (10^k), blank the minors — avoids "null" on intermediate splits
          values: (_u, ts) => ts.map((t) => { if (t == null) return null; const l = Math.log10(t); return Math.abs(l - Math.round(l)) < 1e-6 ? (t >= 1 ? String(t) : String(+t.toFixed(3))) : null; }),
          label: 'size (mm)', labelSize: 28, font: '11px var(--font-sans, sans-serif)', labelFont: '11px var(--font-sans, sans-serif)' },
        { stroke: v.dim, grid: { stroke: v.grid, width: 1 }, ticks: { stroke: v.grid }, label: '% passing', labelSize: 28, font: '11px var(--font-sans, sans-serif)', labelFont: '11px var(--font-sans, sans-serif)' },
      ],
      cursor: { drag: { x: true, y: false, setScale: true }, points: { show: true }, focus: { prox: 20 } },
      legend: { show: true, live: true },
      series: [
        { label: 'size (mm)', value: (_u, x) => (x == null ? '--' : `${x.toFixed(1)} mm`) },
        { label: 'feed', stroke: v.dim, width: 1.6, dash: [6, 4], value: (_u, y) => (y == null ? '--' : `${y.toFixed(1)} %`) },
        { label: 'product', stroke: v.accent, width: 2.4, value: (_u, y) => (y == null ? '--' : `${y.toFixed(1)} %`) },
      ],
    };
  }, []);

  return (
    <div>
      <UPlotChart data={data} build={build} height={height} />
      <div style={{ display: 'flex', gap: '1.2rem', fontSize: '0.76rem', color: 'var(--color-fg-subtle)', marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
        <span>F80 = <b style={{ color: 'var(--color-fg)' }}>{f80.toFixed(1)} mm</b></span>
        <span>P80 = <b style={{ color: 'var(--color-fg)' }}>{p80.toFixed(1)} mm</b></span>
        <span>reduction = <b style={{ color: 'var(--color-fg)' }}>{(p80 > 0 ? f80 / p80 : 0).toFixed(2)}×</b></span>
      </div>
    </div>
  );
}
