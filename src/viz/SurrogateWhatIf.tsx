import { useEffect, useState } from 'react';
import { useShellLang } from '@fasl-work/caos-app-shell';
import { surrogatePredict, type SurOut, learnedMetrics, loadLearned, type Metrics } from '../physics/surrogate';
import type { CrusherResult, Operating } from '../physics/types';

// Live surrogate what-if: the ONNX MLP runs in-browser on the current operating point and predicts the product
// in a single forward pass. We show it next to the exact engine values — the surrogate's job is to EMULATE the
// physics instantly, so a small gap here is the honest measure of the learned model (it is benchmarked against
// the physics it emulates, not a real plant).
export function SurrogateWhatIf({ op, result }: { op: Operating; result: CrusherResult }) {
  const es = useShellLang() === 'es';
  const [pred, setPred] = useState<SurOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [met, setMet] = useState<Metrics | null>(null);

  useEffect(() => { loadLearned().then(() => setMet(learnedMetrics())).catch(() => {}); }, []);
  useEffect(() => {
    let alive = true;
    surrogatePredict(op).then((p) => { if (alive) { setPred(p); setErr(null); } }).catch((e) => { if (alive) setErr(String(e)); });
    return () => { alive = false; };
  }, [op]);

  const rows: { label: string; eng: number; sur: number | undefined; unit: string; fmt: (v: number) => string }[] = [
    { label: 'P80', eng: result.p80, sur: pred?.p80, unit: 'mm', fmt: (v) => v.toFixed(1) },
    { label: 'P50', eng: result.p50, sur: pred?.p50, unit: 'mm', fmt: (v) => v.toFixed(1) },
    { label: es ? 'Capacidad' : 'Throughput', eng: result.throughputTph, sur: pred?.tph, unit: 't/h', fmt: (v) => v.toFixed(0) },
    { label: es ? 'Potencia' : 'Power', eng: result.powerKw, sur: pred?.kW, unit: 'kW', fmt: (v) => v.toFixed(0) },
  ];

  return (
    <div>
      <div className="tz-panel-sub">{es ? 'El surrogate ONNX corre EN VIVO en el navegador. Comparado con el motor físico exacto:' : 'The ONNX surrogate runs LIVE in the browser. Compared with the exact physics engine:'}</div>
      {err ? <p className="tz-note">{es ? 'No se pudo cargar el modelo ONNX' : 'ONNX model failed to load'}: {err}</p> : (
        <table className="tz-table" style={{ marginTop: '0.4rem' }}>
          <thead><tr><th>{es ? 'Salida' : 'Output'}</th><th className="num">{es ? 'Motor (física)' : 'Engine (physics)'}</th><th className="num">{es ? 'Surrogate (ONNX)' : 'Surrogate (ONNX)'}</th><th className="num">Δ</th></tr></thead>
          <tbody>{rows.map((r) => {
            const d = r.sur == null ? null : Math.abs(r.sur - r.eng) / Math.max(1e-6, Math.abs(r.eng)) * 100;
            return (<tr key={r.label}><td>{r.label}</td>
              <td className="num">{r.fmt(r.eng)} {r.unit}</td>
              <td className="num">{r.sur == null ? '…' : `${r.fmt(r.sur)} ${r.unit}`}</td>
              <td className="num" style={{ color: d != null && d < 6 ? '#3fb950' : 'var(--color-fg-subtle)' }}>{d == null ? '' : `${d.toFixed(1)}%`}</td></tr>);
          })}</tbody>
        </table>
      )}
      {met && <div className="tz-panel-sub" style={{ marginTop: '0.4rem' }}>
        {es ? 'En held-out independiente' : 'On the independent held-out set'}: P80 R²={met.perOutput.p80.r2}, MAPE {met.perOutput.p80.mape_pct}% · tph MAPE {met.perOutput.tph.mape_pct}% · kW MAPE {met.perOutput.kW.mape_pct}%.
        {' '}{es ? 'Honesto: emula la física barata, no una planta real.' : 'Honest: it emulates the cheap physics, not a real plant.'}
      </div>}
    </div>
  );
}
