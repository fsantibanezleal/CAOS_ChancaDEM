import { useEffect, useState } from 'react';
import { useShellLang } from '@fasl-work/caos-app-shell';
import { evaluate } from '../physics/engine';
import { surrogatePredict, learnedMetrics, loadLearned, type Metrics } from '../physics/surrogate';
import type { Machine, Operating } from '../physics/types';

// Surrogate-vs-physics parity: sample operating points, run the EXACT engine (truth) and the ONNX surrogate
// (prediction) LIVE in-browser, and scatter predicted vs true P80 against the y=x line. The honest score of the
// learned model against the physics it emulates (NOT a real plant). The aggregate R²/MAPE is the held-out value
// from training (an independent 2nd LHS draw).
const MACHINES: Machine[] = ['cone-sec', 'cone-tert', 'jaw'];

export function ParityScatter() {
  const es = useShellLang() === 'es';
  const [pts, setPts] = useState<{ t: number; p: number }[]>([]);
  const [met, setMet] = useState<Metrics | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadLearned(); if (alive) setMet(learnedMetrics());
      // deterministic sample across the 3 machines (a small live parity set)
      const rnd = (() => { let s = 7; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
      const out: { t: number; p: number }[] = [];
      for (let k = 0; k < 54; k++) {
        const machine = MACHINES[k % 3];
        const css = machine === 'jaw' ? 50 + rnd() * 110 : machine === 'cone-tert' ? 4 + rnd() * 18 : 6 + rnd() * 84;
        const op: Operating = { machine, cssMm: css, throwMm: 16 + rnd() * 28, speedRpm: 200 + rnd() * 340,
          feedX63Mm: machine === 'jaw' ? 200 + rnd() * 280 : 30 + rnd() * 160, feedM: 0.8 + rnd() * 1.1, oreAxb: 35 + rnd() * 70, oreWi: 10 + rnd() * 8 };
        const truth = evaluate(op); if (!truth.valid) continue;
        const pred = await surrogatePredict(op);
        out.push({ t: truth.p80, p: pred.p80 });
      }
      if (alive) setPts(out);
    })().catch(() => {});
    return () => { alive = false; };
  }, []);

  const W = 460, H = 320, pad = 44;
  const all = pts.flatMap((d) => [d.t, d.p]);
  const lo = all.length ? Math.min(...all) * 0.9 : 1, hi = all.length ? Math.max(...all) * 1.05 : 100;
  const sx = (v: number) => pad + (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * (W - 2 * pad);
  const sy = (v: number) => H - pad - (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * (H - 2 * pad);

  return (
    <div>
      <div className="tz-panel-sub">{es ? 'Predicho (surrogate ONNX) vs verdadero (motor físico) para P80, en puntos muestreados en vivo. La línea y=x es el acuerdo perfecto.' : 'Predicted (ONNX surrogate) vs true (physics engine) P80 on points sampled live. The y=x line is perfect agreement.'}</div>
      <div className="tz-svg-wrap" style={{ marginTop: '0.4rem' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="parity scatter" style={{ font: '11px sans-serif' }}>
          <line x1={sx(lo)} y1={sy(lo)} x2={sx(hi)} y2={sy(hi)} stroke="var(--color-fg-subtle)" strokeDasharray="5 4" />
          {pts.map((d, i) => <circle key={i} cx={sx(d.t)} cy={sy(d.p)} r="3.4" fill="var(--color-accent)" opacity="0.6" />)}
          <text x={W / 2} y={H - 8} textAnchor="middle" fill="var(--color-fg-subtle)">{es ? 'P80 verdadero (mm, log)' : 'true P80 (mm, log)'}</text>
          <text x={14} y={H / 2} textAnchor="middle" fill="var(--color-fg-subtle)" transform={`rotate(-90 14 ${H / 2})`}>{es ? 'P80 surrogate (mm, log)' : 'surrogate P80 (mm, log)'}</text>
          {!pts.length && <text x={W / 2} y={H / 2} textAnchor="middle" fill="var(--color-fg-faint)">…running ONNX…</text>}
        </svg>
      </div>
      {met && <table className="tz-table" style={{ marginTop: '0.4rem' }}>
        <thead><tr><th>{es ? 'salida' : 'output'}</th>{['p80', 'p50', 'tph', 'kW'].map((k) => <th key={k} className="num">{k}</th>)}</tr></thead>
        <tbody>
          <tr><td>R² {es ? '(held-out)' : '(held-out)'}</td>{['p80', 'p50', 'tph', 'kW'].map((k) => <td key={k} className="num">{met.perOutput[k].r2}</td>)}</tr>
          <tr><td>MAPE %</td>{['p80', 'p50', 'tph', 'kW'].map((k) => <td key={k} className="num">{met.perOutput[k].mape_pct}</td>)}</tr>
        </tbody>
      </table>}
    </div>
  );
}
