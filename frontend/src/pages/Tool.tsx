import { useEffect, useState, type ReactNode } from 'react';
import { Tabs, useShellLang } from '@fasl-work/caos-app-shell';
import { useWorkbench } from '../state/store';
import { CASES } from '../data/cases';
import { HP500_SURVEYS, HP500_SOURCE } from '../data/real/hp500-minasrio';
import { loadLoo, type LooDoc } from '../data/loadLoo';
import { envelopeText, type EnvelopeCode } from '../physics/envelope';
import type { Machine, CrusherResult } from '../physics/types';
import type { RealSurvey } from '../data/real/hp500-minasrio';
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

// The App workbench. A FIRST-LEVEL Source selector (Synthetic | Real sample) sits at the top of the sidebar.
// Synthetic: a case preset + free sliders drive the live pure-TS engine + the two ONNX models. Real sample: the
// sliders disable, a survey picker (#1..#10) appears, and the SAME engine runs on a real HP500 industrial survey
// (measured CSS + f80), calibrated to the Rocha et al. 2024 fit. Every Real tab is badged by provenance.
const MACHINES: { id: Machine; en: string; es: string }[] = [
  { id: 'cone-sec', en: 'Cone · sec', es: 'Cono · sec' },
  { id: 'cone-tert', en: 'Cone · tert', es: 'Cono · terc' },
  { id: 'cone-short-head', en: 'Short-head', es: 'Cabeza corta' },
  { id: 'gyratory', en: 'Gyratory', es: 'Giratorio' },
  { id: 'jaw', en: 'Jaw', es: 'Mandíbula' },
];

function Slider({ label, unit, value, min, max, step, onChange, disabled }: { label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className={`tz-ctl ${disabled ? 'is-disabled' : ''}`}>
      <span className="tz-ctl-row">{label} <b>{value}{unit}</b></span>
      <input className="range" type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
}

// A provenance badge token. real = measured value; calib = model fitted to the same surveys; struct = geometry
// illustrative; synthmodel = a synthetic-trained net evaluated on real input.
type BadgeKind = 'real' | 'calib' | 'struct' | 'synthmodel';
const BADGE_LABELS: Record<BadgeKind, { en: string; es: string; cls: string }> = {
  real: { en: 'REAL', es: 'REAL', cls: 'real' },
  calib: { en: 'CALIBRATED', es: 'CALIBRADO', cls: 'calib' },
  struct: { en: 'STRUCTURE-REAL', es: 'ESTRUCTURA-REAL', cls: 'struct' },
  synthmodel: { en: 'SYNTHETIC-MODEL on real input', es: 'MODELO SINTÉTICO sobre dato real', cls: 'synthmodel' },
};

function BadgeBar({ kinds, cite, es }: { kinds: BadgeKind[]; cite: boolean; es: boolean }) {
  return (
    <div className="tz-badgebar">
      {kinds.map((k) => <span key={k} className={`tz-badge ${BADGE_LABELS[k].cls}`}>{es ? BADGE_LABELS[k].es : BADGE_LABELS[k].en}</span>)}
      {cite && <span className="tz-cite">{HP500_SOURCE.cite}</span>}
    </div>
  );
}

export default function Tool() {
  const lang = useShellLang(); const es = lang === 'es';
  const { source, caseId, surveyIdx, survey, op, result, setSource, setCase, setSurvey, patch } = useWorkbench();
  const r = result;
  const real = source === 'real';
  const cur = CASES.find((c) => c.id === caseId);

  // per-tab provenance badge on the Real lane (see the dossier tab-by-tab map). Cite = show the in-panel citation.
  const wrap = (kinds: BadgeKind[], node: ReactNode): ReactNode => real
    ? <div>{<BadgeBar kinds={kinds} cite={kinds.includes('real') || kinds.includes('calib')} es={es} />}{node}</div>
    : node;

  const tabs = [
    { id: 'chamber3d', label: es ? 'Cámara 3D' : '3D chamber', content: wrap(['struct'], <Chamber3D op={op} p80={r.p80} f80={r.f80} />) },
    { id: 'slice', label: es ? 'Corte 2D + nip' : '2D slice + nip', content: wrap(['struct'], <ChamberSlice op={op} />) },
    { id: 'psd', label: es ? 'Gradación' : 'Gradation', content: wrap(['real', 'calib'], <PsdChart feed={r.feed} product={r.product} f80={r.f80} p80={r.p80} height={300} />) },
    { id: 'kpi', label: es ? 'Indicadores' : 'Gauges', content: wrap(['real'], <GaugesPanel r={r} es={es} survey={survey} />) },
    { id: 'capacity', label: es ? 'Capacidad' : 'Capacity', content: wrap(['real', 'calib'], <CapacityEnvelope op={op} measuredTph={survey?.measured.feedRateTph} />) },
    { id: 'whatif', label: es ? 'What-if (ONNX)' : 'What-if (ONNX)', content: wrap(['synthmodel'], <SurrogateWhatIf op={op} result={r} />) },
    { id: 'breakage', label: es ? 'Fractura t10' : 'Breakage t10', content: wrap(['calib'], <BreakageCurves op={op} f80Mm={real ? r.f80 : undefined} />) },
    { id: 'nip', label: es ? 'Ángulo de nip' : 'Nip angle', content: wrap(['struct'], <NipDiagram op={op} />) },
    { id: 'anomaly', label: es ? 'Anomalía (AE)' : 'Anomaly (AE)', content: wrap(['synthmodel'], <AnomalyView result={r} />) },
    { id: 'map', label: es ? 'Mapa de operación' : 'Operating map', content: wrap(['real'], <OperatingMap op={op} surveys={real ? HP500_SURVEYS : undefined} selectedN={survey?.n} />) },
    { id: 'mass', label: es ? 'Balance de masa' : 'Mass balance', content: wrap(['real'], <MassBalance op={op} result={r} />) },
  ];

  return (
    <section className="page-body tz-layout">
      {/* ---- control sidebar ---- */}
      <aside className="tz-controls">
        {/* FIRST-LEVEL source selector: synthetic simulator vs a real industrial survey */}
        <div className="tz-ctl">
          <span>{es ? 'Fuente' : 'Source'}</span>
          <div className="tz-chips">
            <button className={`chip ${!real ? 'on' : ''}`} onClick={() => setSource('synthetic')}>{es ? 'Sintético' : 'Synthetic'}</button>
            <button className={`chip ${real ? 'on' : ''}`} onClick={() => setSource('real')}>{es ? 'Muestra real' : 'Real sample'}</button>
          </div>
          <span className="tz-source-note">{real
            ? (es ? 'Encuesta industrial real HP500 (Minas Rio). Los deslizadores se fijan a la encuesta; elige cuál dato.' : 'Real HP500 industrial survey (Minas Rio). The sliders are fixed by the survey; you pick which datum.')
            : (es ? 'Simulador sintético con perillas libres.' : 'Synthetic simulator with free knobs.')}</span>
        </div>

        {real ? (
          <div className="tz-ctl">
            <span>{es ? 'Encuesta (HP500 #1–#10)' : 'Survey (HP500 #1–#10)'}</span>
            <select className="tz-sel" value={surveyIdx} onChange={(e) => setSurvey(+e.target.value)}>
              {HP500_SURVEYS.map((s, i) => <option key={s.id} value={i}>{`#${s.n}, CSS ${s.measured.cssMm}mm · f80 ${s.measured.f80Mm}mm · ${s.measured.feedRateTph} t/h`}</option>)}
            </select>
            {survey && <span className="tz-panel-sub">{es ? 'Cono secundario Metso HP500, itabirita. CSS y f80 medidos accionan el mismo motor.' : 'Metso HP500 secondary cone, itabirite. Measured CSS and f80 drive the same engine.'}</span>}
          </div>
        ) : (
          <div className="tz-ctl">
            <span>{es ? 'Caso' : 'Case'}</span>
            <select className="tz-sel" value={caseId} onChange={(e) => setCase(e.target.value)}>
              {CASES.map((c) => <option key={c.id} value={c.id}>{c.id}, {c.name}</option>)}
            </select>
            {cur && <span className="tz-panel-sub">{cur.blurb}</span>}
          </div>
        )}

        <div className={`tz-ctl ${real ? 'is-disabled' : ''}`}>
          <span>{es ? 'Máquina' : 'Machine'}</span>
          <div className="tz-chips">{MACHINES.map((m) => (
            <button key={m.id} className={`chip ${op.machine === m.id ? 'on' : ''}`} disabled={real} onClick={() => patch({ machine: m.id })}>{es ? m.es : m.en}</button>
          ))}</div>
        </div>

        <Slider label="CSS" unit=" mm" value={op.cssMm} min={4} max={260} step={1} disabled={real} onChange={(v) => patch({ cssMm: v })} />
        <Slider label={es ? 'Carrera' : 'Throw'} unit=" mm" value={op.throwMm} min={8} max={50} step={1} disabled={real} onChange={(v) => patch({ throwMm: v })} />
        <Slider label={es ? 'Velocidad' : 'Speed'} unit=" rpm" value={op.speedRpm} min={100} max={600} step={5} disabled={real} onChange={(v) => patch({ speedRpm: v })} />
        <Slider label="Feed x63" unit=" mm" value={+op.feedX63Mm.toFixed(1)} min={20} max={800} step={5} disabled={real} onChange={(v) => patch({ feedX63Mm: v })} />
        <Slider label={es ? 'Feed m' : 'Feed m'} unit="" value={op.feedM} min={0.6} max={2.2} step={0.05} disabled={real} onChange={(v) => patch({ feedM: v })} />
        <Slider label={es ? 'Dureza A·b' : 'Ore A·b'} unit="" value={op.oreAxb} min={25} max={120} step={1} disabled={real} onChange={(v) => patch({ oreAxb: v })} />

        <Gauge title="P80" value={r.p80} min={1} max={Math.max(40, r.f80)} unit="mm" fmt={(v) => v.toFixed(1)}
          zones={[{ from: 1, to: 12, color: 'color-mix(in oklab, #3fb950 45%, transparent)' }, { from: 12, to: Math.max(40, r.f80), color: 'color-mix(in oklab, #d29922 45%, transparent)' }]} />

        {!real && <DecisionPanel op={op} result={r} onApplyCss={(css) => patch({ cssMm: css })} />}
      </aside>

      {/* ---- reactive main ---- */}
      <div className="tz-main">
        <div className="tz-kpis">
          {real && survey ? (
            <>
              <div className="tz-kpi"><div className="tz-kpi-v">{survey.measured.cssMm}</div><div className="tz-kpi-l">CSS <span className="tz-kpi-u">mm</span> · {es ? 'medido' : 'measured'}</div></div>
              <div className="tz-kpi"><div className="tz-kpi-v">{survey.measured.f80Mm}</div><div className="tz-kpi-l">f80 <span className="tz-kpi-u">mm</span> · {es ? 'medido' : 'measured'}</div></div>
              <div className="tz-kpi"><div className="tz-kpi-v">{survey.measured.feedRateTph}</div><div className="tz-kpi-l">{es ? 'Capacidad' : 'Throughput'} <span className="tz-kpi-u">t/h</span> · {es ? 'medido' : 'measured'}</div></div>
              <div className="tz-kpi"><div className="tz-kpi-v">{survey.measured.powerKW}</div><div className="tz-kpi-l">{es ? 'Potencia' : 'Power'} <span className="tz-kpi-u">kW</span> · {es ? 'medido' : 'measured'}</div></div>
            </>
          ) : (
            <>
              <div className="tz-kpi"><div className="tz-kpi-v">{r.p80.toFixed(1)}</div><div className="tz-kpi-l">P80 <span className="tz-kpi-u">mm</span></div></div>
              <div className="tz-kpi"><div className="tz-kpi-v">{r.reductionRatio.toFixed(2)}×</div><div className="tz-kpi-l">{es ? 'Reducción' : 'Reduction'}</div></div>
              <div className="tz-kpi"><div className="tz-kpi-v">{r.throughputTph.toFixed(0)}</div><div className="tz-kpi-l">{es ? 'Capacidad' : 'Throughput'} <span className="tz-kpi-u">t/h</span></div></div>
              <div className="tz-kpi"><div className="tz-kpi-v">{r.powerKw.toFixed(0)}</div><div className="tz-kpi-l">{es ? 'Potencia' : 'Power'} <span className="tz-kpi-u">kW</span></div></div>
            </>
          )}
        </div>
        {r.outOfEnvelope && (
          <div className="tz-envelope-warn" role="alert">
            <b>{es ? 'Fuera de la envolvente validada' : 'Out of validated envelope'}</b>
            <ul>{(r.envelopeCodes as EnvelopeCode[]).map((c) => <li key={c}>{envelopeText(c, es)}</li>)}</ul>
          </div>
        )}
        <Tabs tabs={tabs} ariaLabel={es ? 'vistas' : 'views'} />
        <p className="tz-note">{real
          ? (es
            ? 'Muestra real: encuesta industrial HP500 (Rocha et al., Minerals 2024, 14, 919, CC BY, Minas Rio). CSS, f80, t/h y kW son medidos; el producto, t10 y las curvas provienen del ajuste Andersen-Whiten calibrado a estas mismas encuestas (Tabla 5). Salvedades: las curvas PSD completas son solo figuras en el paper (el alimento se reconstruye desde f80) y la potencia es la estimación del paper por corriente eléctrica.'
            : 'Real sample: HP500 industrial survey (Rocha et al., Minerals 2024, 14, 919, CC BY, Minas Rio). CSS, f80, t/h and kW are measured; the product, t10 and curves come from the Andersen-Whiten fit calibrated to these very surveys (Table 5). Caveats: the full feed/product PSD curves are figure-only in the paper (feed is reconstructed from f80) and power is the paper current-based estimate.')
          : (es
            ? 'Motor de Whiten + Evertsson + Bond en TypeScript puro, en vivo; el surrogate y el autoencoder corren en ONNX en el navegador. Constantes ilustrativas (reproducen tendencias) hasta calibrar con datos industriales abiertos.'
            : 'Live pure-TypeScript Whiten + Evertsson + Bond engine; the surrogate and autoencoder run in ONNX in the browser. Constants are illustrative (they reproduce trends) pending calibration to open industrial data.')}</p>
      </div>
    </section>
  );
}

function GaugesPanel({ r, es, survey }: { r: CrusherResult; es: boolean; survey: RealSurvey | null }) {
  const [loo, setLoo] = useState<LooDoc | null>(null);
  useEffect(() => { if (survey) loadLoo().then(setLoo).catch(() => {}); }, [survey]);
  // CrusherCal held-out 80% predictive-interval half-widths (t/h, kW) from the committed LOO trace, shown as the
  // uncertainty band on the real-lane gauges. On the synthetic lane no held-out band is available (no bands shown).
  const tphHalf = survey ? loo?.loo.tph.strict.uq?.band_halfwidth : undefined;
  const kwHalf = survey ? loo?.loo.kW.strict.uq?.band_halfwidth : undefined;
  const clamp = (lo: number, hi: number, min: number, max: number): [number, number] => [Math.max(min, lo), Math.min(max, hi)];
  const tphVal = survey ? survey.measured.feedRateTph : r.throughputTph;
  const kwVal = survey ? survey.measured.powerKW : r.powerKw;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {survey && (
        <table className="tz-table">
          <thead><tr><th>{es ? 'Medido (real)' : 'Measured (real)'}</th><th className="num">CSS</th><th className="num">f80</th><th className="num">t/h</th><th className="num">kW</th></tr></thead>
          <tbody><tr><td>{survey.id}</td><td className="num">{survey.measured.cssMm} mm</td><td className="num">{survey.measured.f80Mm} mm</td><td className="num">{survey.measured.feedRateTph}</td><td className="num">{survey.measured.powerKW}</td></tr></tbody>
        </table>
      )}
      {survey && (
        <div className="tz-panel-sub" style={{ fontFamily: 'var(--font-mono)' }}>
          {es ? 'Derivado (calibrado):' : 'Derived (calibrated):'} P80 = <b style={{ color: 'var(--color-fg)' }}>{r.p80.toFixed(1)} mm</b> · {es ? 'reducción' : 'reduction'} = <b style={{ color: 'var(--color-fg)' }}>{r.reductionRatio.toFixed(2)}×</b> {es ? 'desde el ajuste Andersen-Whiten (Tabla 5); la potencia y el t/h medidos son la referencia real.' : 'from the Andersen-Whiten fit (Table 5); the measured power and t/h are the real reference.'}
        </div>
      )}
      {survey && (tphHalf || kwHalf) && (
        <div className="tz-panel-sub">
          {es ? 'La banda sombreada en los medidores es el intervalo predictivo del 80% held-out de CrusherCal (LOO): ' : 'The shaded band on the gauges is CrusherCal\'s 80% held-out predictive interval (LOO): '}
          {tphHalf ? `±${tphHalf.toFixed(0)} t/h` : ''}{tphHalf && kwHalf ? ' · ' : ''}{kwHalf ? `±${kwHalf.toFixed(0)} kW` : ''}.
          {es ? ' El residuo M1 no supera al backbone fuera de muestra (nulo pre-registrado); se muestra el backbone + banda empírica.' : ' The M1 residual does not beat the backbone out-of-sample (pre-registered null); the backbone + empirical band is shown.'}
        </div>
      )}
      <Gauge title={es ? 'Capacidad' : 'Throughput'} value={tphVal} min={0} max={1800} unit="t/h"
        band={tphHalf ? clamp(tphVal - tphHalf, tphVal + tphHalf, 0, 1800) : undefined}
        zones={[{ from: 0, to: 1800, color: 'color-mix(in oklab, #58a6ff 35%, transparent)' }]} />
      <Gauge title={es ? 'Potencia' : 'Power'} value={kwVal} min={0} max={550} unit="kW"
        band={kwHalf ? clamp(kwVal - kwHalf, kwVal + kwHalf, 0, 550) : undefined}
        zones={[{ from: 0, to: 350, color: 'color-mix(in oklab, #3fb950 40%, transparent)' }, { from: 350, to: 550, color: 'color-mix(in oklab, #f85149 40%, transparent)' }]} />
      <Gauge title={es ? 'Energía específica Ecs' : 'Specific energy Ecs'} value={survey ? survey.measured.powerKW / survey.measured.feedRateTph : r.specificEnergyKwhT} min={0} max={3} unit="kWh/t" fmt={(v) => v.toFixed(2)}
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
