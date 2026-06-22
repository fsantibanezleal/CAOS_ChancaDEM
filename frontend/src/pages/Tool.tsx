import { Tabs, useShellLang } from '@fasl-work/caos-app-shell';
import { useWorkbench } from '../state/store';
import { CASES } from '../data/cases';
import type { Machine, CrusherResult } from '../physics/types';
import { Chamber3D } from '../viz/Chamber3D';
import { ChamberSlice } from '../viz/ChamberSlice';
import { PsdChart } from '../viz/PsdChart';
import { Gauge } from '../viz/Gauge';
import { CapacityEnvelope } from '../viz/CapacityEnvelope';
import { SurrogateWhatIf } from '../viz/SurrogateWhatIf';
import { BreakageCurves } from '../viz/BreakageCurves';
import { NipDiagram } from '../viz/NipDiagram';
import { AnomalyView } from '../viz/AnomalyView';
import { OperatingMap } from '../viz/OperatingMap';
import { MassBalance } from '../viz/MassBalance';
import { DecisionPanel } from '../viz/DecisionPanel';

// The App workbench. A case preset + free sliders drive the live pure-TS crusher engine + the two ONNX models;
// a 12-tab Tabs workbench, a control sidebar (params + gauges + decision panel) and a KPI strip all react
// instantly to the selected case and parameters.
const MACHINES: { id: Machine; en: string; es: string }[] = [
  { id: 'cone-sec', en: 'Cone · sec', es: 'Cono · sec' },
  { id: 'cone-tert', en: 'Cone · tert', es: 'Cono · terc' },
  { id: 'cone-short-head', en: 'Short-head', es: 'Cabeza corta' },
  { id: 'gyratory', en: 'Gyratory', es: 'Giratorio' },
  { id: 'jaw', en: 'Jaw', es: 'Mandíbula' },
];

function Slider({ label, unit, value, min, max, step, onChange }: { label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="tz-ctl">
      <span className="tz-ctl-row">{label} <b>{value}{unit}</b></span>
      <input className="range" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
}

export default function Tool() {
  const lang = useShellLang(); const es = lang === 'es';
  const { caseId, op, result, setCase, patch } = useWorkbench();
  const r = result;
  const cur = CASES.find((c) => c.id === caseId);

  const tabs = [
    { id: 'chamber3d', label: es ? 'Cámara 3D' : '3D chamber', content: <Chamber3D op={op} p80={r.p80} f80={r.f80} /> },
    { id: 'slice', label: es ? 'Corte 2D + nip' : '2D slice + nip', content: <ChamberSlice op={op} /> },
    { id: 'psd', label: es ? 'Gradación' : 'Gradation', content: <PsdChart feed={r.feed} product={r.product} f80={r.f80} p80={r.p80} height={300} /> },
    { id: 'kpi', label: es ? 'Indicadores' : 'Gauges', content: <GaugesPanel r={r} es={es} /> },
    { id: 'capacity', label: es ? 'Capacidad' : 'Capacity', content: <CapacityEnvelope op={op} /> },
    { id: 'whatif', label: es ? 'What-if (ONNX)' : 'What-if (ONNX)', content: <SurrogateWhatIf op={op} result={r} /> },
    { id: 'breakage', label: es ? 'Fractura t10' : 'Breakage t10', content: <BreakageCurves op={op} /> },
    { id: 'nip', label: es ? 'Ángulo de nip' : 'Nip angle', content: <NipDiagram op={op} /> },
    { id: 'anomaly', label: es ? 'Anomalía (AE)' : 'Anomaly (AE)', content: <AnomalyView result={r} /> },
    { id: 'map', label: es ? 'Mapa de operación' : 'Operating map', content: <OperatingMap op={op} /> },
    { id: 'mass', label: es ? 'Balance de masa' : 'Mass balance', content: <MassBalance op={op} result={r} /> },
  ];

  return (
    <section className="page-body tz-layout">
      {/* ---- control sidebar ---- */}
      <aside className="tz-controls">
        <div className="tz-ctl">
          <span>{es ? 'Caso' : 'Case'}</span>
          <select className="tz-sel" value={caseId} onChange={(e) => setCase(e.target.value)}>
            {CASES.map((c) => <option key={c.id} value={c.id}>{c.id} — {c.name}</option>)}
          </select>
          {cur && <span className="tz-panel-sub">{cur.blurb}</span>}
        </div>

        <div className="tz-ctl">
          <span>{es ? 'Máquina' : 'Machine'}</span>
          <div className="tz-chips">{MACHINES.map((m) => (
            <button key={m.id} className={`chip ${op.machine === m.id ? 'on' : ''}`} onClick={() => patch({ machine: m.id })}>{es ? m.es : m.en}</button>
          ))}</div>
        </div>

        <Slider label="CSS" unit=" mm" value={op.cssMm} min={4} max={260} step={1} onChange={(v) => patch({ cssMm: v })} />
        <Slider label={es ? 'Carrera' : 'Throw'} unit=" mm" value={op.throwMm} min={8} max={50} step={1} onChange={(v) => patch({ throwMm: v })} />
        <Slider label={es ? 'Velocidad' : 'Speed'} unit=" rpm" value={op.speedRpm} min={100} max={600} step={5} onChange={(v) => patch({ speedRpm: v })} />
        <Slider label="Feed x63" unit=" mm" value={op.feedX63Mm} min={20} max={800} step={5} onChange={(v) => patch({ feedX63Mm: v })} />
        <Slider label={es ? 'Feed m' : 'Feed m'} unit="" value={op.feedM} min={0.6} max={2.2} step={0.05} onChange={(v) => patch({ feedM: v })} />
        <Slider label={es ? 'Dureza A·b' : 'Ore A·b'} unit="" value={op.oreAxb} min={25} max={120} step={1} onChange={(v) => patch({ oreAxb: v })} />

        <Gauge title="P80" value={r.p80} min={1} max={Math.max(40, r.f80)} unit="mm" fmt={(v) => v.toFixed(1)}
          zones={[{ from: 1, to: 12, color: 'color-mix(in oklab, #3fb950 45%, transparent)' }, { from: 12, to: Math.max(40, r.f80), color: 'color-mix(in oklab, #d29922 45%, transparent)' }]} />

        <DecisionPanel op={op} result={r} onApplyCss={(css) => patch({ cssMm: css })} />
      </aside>

      {/* ---- reactive main ---- */}
      <div className="tz-main">
        <div className="tz-kpis">
          <div className="tz-kpi"><div className="tz-kpi-v">{r.p80.toFixed(1)}</div><div className="tz-kpi-l">P80 <span className="tz-kpi-u">mm</span></div></div>
          <div className="tz-kpi"><div className="tz-kpi-v">{r.reductionRatio.toFixed(2)}×</div><div className="tz-kpi-l">{es ? 'Reducción' : 'Reduction'}</div></div>
          <div className="tz-kpi"><div className="tz-kpi-v">{r.throughputTph.toFixed(0)}</div><div className="tz-kpi-l">{es ? 'Capacidad' : 'Throughput'} <span className="tz-kpi-u">t/h</span></div></div>
          <div className="tz-kpi"><div className="tz-kpi-v">{r.powerKw.toFixed(0)}</div><div className="tz-kpi-l">{es ? 'Potencia' : 'Power'} <span className="tz-kpi-u">kW</span></div></div>
        </div>
        <Tabs tabs={tabs} ariaLabel={es ? 'vistas' : 'views'} />
        <p className="tz-note">{es
          ? 'Motor de Whiten + Evertsson + Bond en TypeScript puro, en vivo; el surrogate y el autoencoder corren en ONNX en el navegador. Constantes ilustrativas (reproducen tendencias) hasta calibrar con datos industriales abiertos.'
          : 'Live pure-TypeScript Whiten + Evertsson + Bond engine; the surrogate and autoencoder run in ONNX in the browser. Constants are illustrative (they reproduce trends) pending calibration to open industrial data.'}</p>
      </div>
    </section>
  );
}

function GaugesPanel({ r, es }: { r: CrusherResult; es: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Gauge title={es ? 'Capacidad' : 'Throughput'} value={r.throughputTph} min={0} max={1500} unit="t/h"
        zones={[{ from: 0, to: 1500, color: 'color-mix(in oklab, #58a6ff 35%, transparent)' }]} />
      <Gauge title={es ? 'Potencia' : 'Power'} value={r.powerKw} min={0} max={550} unit="kW"
        zones={[{ from: 0, to: 350, color: 'color-mix(in oklab, #3fb950 40%, transparent)' }, { from: 350, to: 550, color: 'color-mix(in oklab, #f85149 40%, transparent)' }]} />
      <Gauge title={es ? 'Energía específica Ecs' : 'Specific energy Ecs'} value={r.specificEnergyKwhT} min={0} max={3} unit="kWh/t" fmt={(v) => v.toFixed(2)}
        zones={[{ from: 0, to: 3, color: 'color-mix(in oklab, #d29922 35%, transparent)' }]} />
      <Gauge title={es ? 'Razón de reducción' : 'Reduction ratio'} value={r.reductionRatio} min={1} max={12} unit="×" fmt={(v) => v.toFixed(2)}
        zones={[{ from: 1, to: 12, color: 'color-mix(in oklab, #58a6ff 35%, transparent)' }]} />
      <table className="tz-table">
        <thead><tr><th>{es ? 'Pasante a' : 'Passing at'}</th>{[1, 4, 8, 16, 32].map((s) => <th key={s} className="num">{s} mm</th>)}</tr></thead>
        <tbody><tr><td>{es ? 'producto' : 'product'}</td>{[1, 4, 8, 16, 32].map((s) => <td key={s} className="num">{(r.pctPassing[s] * 100).toFixed(1)}%</td>)}</tr></tbody>
      </table>
    </div>
  );
}
