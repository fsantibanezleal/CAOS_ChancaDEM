import { useEffect, useState } from 'react';
import { useShellLang } from '@fasl-work/caos-app-shell';
import { loadLoo, type LooDoc, type StatBlock } from '../data/loadLoo';

// CrusherCal benchmark panels. All numbers are READ from the committed, offline-validated LOO trace
// (data/hp500/loo.json); nothing is recomputed or asserted here. Two honest views:
//   PowerParity  measured kW vs the bare Bond draw, the engine Pc=1.30*Pd+110, and a refit Pc (the corrected
//                finding: our Bond draw is uninformative for the measured power spread; no 2x-removal is claimed).
//   LooParity    held-out (strict LOO) measured vs modeled t/h and kW, with the 80% predictive interval and the
//                pre-registered null (the residual net does not beat the calibrated backbone out-of-sample).

interface Series { label: string; color: string; pts: { x: number; y: number }[] }

/** Measured (x) vs modeled (y) parity scatter with a 1:1 line, a +-bandPct reference band, optional error bars on
 *  the first series (the UQ interval), and a legend. Linear axes (values share a magnitude). Theme-aware via CSS. */
function ParitySvg({ series, unit, bandPct = 0.15, errHalf, es }: {
  series: Series[]; unit: string; bandPct?: number; errHalf?: number; es: boolean;
}) {
  const W = 460, H = 340, pad = 52;
  const all = series.flatMap((s) => s.pts.flatMap((p) => [p.x, p.y]));
  const lo = all.length ? Math.min(...all) * 0.9 : 0;
  const hi = all.length ? Math.max(...all) * 1.08 : 1;
  const sx = (v: number) => pad + ((v - lo) / (hi - lo)) * (W - 2 * pad);
  const sy = (v: number) => H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad);
  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => lo + (i / ticks) * (hi - lo));

  return (
    <div className="tz-svg-wrap" style={{ marginTop: '0.4rem' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="parity scatter" style={{ font: '11px sans-serif' }}>
        {/* +-band reference region around the 1:1 line */}
        <polygon
          points={`${sx(lo)},${sy(lo * (1 - bandPct))} ${sx(hi)},${sy(hi * (1 - bandPct))} ${sx(hi)},${sy(hi * (1 + bandPct))} ${sx(lo)},${sy(lo * (1 + bandPct))}`}
          fill="var(--color-accent)" opacity="0.10" />
        {/* axes */}
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--color-fg-subtle)" />
        <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="var(--color-fg-subtle)" />
        {tickVals.map((v, i) => (
          <g key={i}>
            <text x={sx(v)} y={H - pad + 14} textAnchor="middle" fill="var(--color-fg-faint)" fontSize="9">{v.toFixed(0)}</text>
            <text x={pad - 6} y={sy(v) + 3} textAnchor="end" fill="var(--color-fg-faint)" fontSize="9">{v.toFixed(0)}</text>
          </g>
        ))}
        {/* 1:1 line */}
        <line x1={sx(lo)} y1={sy(lo)} x2={sx(hi)} y2={sy(hi)} stroke="var(--color-fg-subtle)" strokeDasharray="5 4" />
        {/* error bars on the first (backbone) series */}
        {errHalf && series[0]?.pts.map((p, i) => (
          <line key={`e${i}`} x1={sx(p.x)} y1={sy(p.y - errHalf)} x2={sx(p.x)} y2={sy(p.y + errHalf)}
            stroke={series[0].color} strokeWidth="1" opacity="0.4" />
        ))}
        {/* points */}
        {series.map((s) => s.pts.map((p, i) => (
          <circle key={`${s.label}${i}`} cx={sx(p.x)} cy={sy(p.y)} r="4" fill={s.color} opacity="0.8"
            stroke="var(--color-surface)" strokeWidth="0.6" />
        )))}
        <text x={W / 2} y={H - 6} textAnchor="middle" fill="var(--color-fg-subtle)">{es ? `medido (${unit})` : `measured (${unit})`}</text>
        <text x={14} y={H / 2} textAnchor="middle" fill="var(--color-fg-subtle)" transform={`rotate(-90 14 ${H / 2})`}>{es ? `modelado (${unit})` : `modeled (${unit})`}</text>
      </svg>
      <div className="tz-legend-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.2rem', fontSize: 11 }}>
        {series.map((s) => (
          <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-fg-subtle)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: s.color, display: 'inline-block' }} />{s.label}
          </span>
        ))}
        <span style={{ color: 'var(--color-fg-faint)' }}>{es ? `banda +-${Math.round(bandPct * 100)}% + linea 1:1` : `+-${Math.round(bandPct * 100)}% band + 1:1 line`}</span>
      </div>
    </div>
  );
}

function StatRow({ label, s }: { label: string; s: StatBlock }) {
  return (
    <tr><td>{label}</td><td className="num">{s.mape_pct}</td><td className="num">{s.r2}</td><td className="num">{s.maxdev_pct}</td></tr>
  );
}

const C = { measured: '#58a6ff', bond: '#f85149', pc: '#d29922', refit: '#3fb950', backbone: '#3fb950', resid: '#f0883e', free: '#a371f7' };

export function PowerParity() {
  const es = useShellLang() === 'es';
  const [d, setD] = useState<LooDoc | null>(null);
  useEffect(() => { loadLoo().then(setD).catch(() => {}); }, []);
  if (!d) return <p className="tz-panel-sub">...{es ? 'cargando paridad de potencia' : 'loading power parity'}...</p>;
  const pp = d.power_parity;
  const series: Series[] = [
    { label: es ? 'Bond crudo' : 'bare Bond', color: C.bond, pts: pp.per_survey.map((r) => ({ x: r.measured, y: r.bare_bond })) },
    { label: 'Pc = 1.30·Pd + 110', color: C.pc, pts: pp.per_survey.map((r) => ({ x: r.measured, y: r.engine_pc })) },
    { label: es ? 'Pc reajustado' : 'refit Pc', color: C.refit, pts: pp.per_survey.map((r) => ({ x: r.measured, y: r.refit_pc })) },
  ];
  return (
    <div>
      <ParitySvg series={series} unit="kW" es={es} />
      <table className="tz-table" style={{ marginTop: '0.5rem', maxWidth: 560 }}>
        <thead><tr><th>{es ? 'modelo de potencia' : 'power model'}</th><th className="num">MAPE %</th><th className="num">R²</th><th className="num">{es ? 'máx dev %' : 'max dev %'}</th></tr></thead>
        <tbody>
          <StatRow label={es ? 'Bond crudo (draw)' : 'bare Bond draw'} s={pp.bare_bond} />
          <StatRow label="Pc = 1.30·Pd + 110 (paper form)" s={pp.engine_pc_1p30_110} />
          <StatRow label={`${es ? 'Pc reajustado' : 'refit Pc'} (ζ=${pp.refit_pc.zeta}, Pn=${pp.refit_pc.pn})`} s={pp.refit_pc} />
          <StatRow label={es ? 'línea base media constante' : 'constant-mean baseline'} s={pp.constant_mean} />
        </tbody>
      </table>
      <p className="tz-note">{es
        ? `Hallazgo honesto (corrige la premisa del dossier): el tiro de Bond del motor es casi plano (${pp.bond_pd_range_kw[0]} a ${pp.bond_pd_range_kw[1]} kW) y no explica la dispersión medida (${pp.measured_range_kw[0]} a ${pp.measured_range_kw[1]} kW), así que ni Bond crudo ni el Pc del paper (cuyo Pd es una potencia específica de tamaño, no el tiro de Bond clásico) reproducen la variación. El mejor reajuste de la FORMA del paper sobre nuestro Pd colapsa hacia la media. NO se afirma que se elimine una sobrepredicción 2x de Bond; el resultado real at-bar es la paridad de t/h, no la potencia. En la app la potencia medida es la referencia mostrada.`
        : `Honest finding (corrects the dossier premise): the engine Bond draw is nearly flat (${pp.bond_pd_range_kw[0]} to ${pp.bond_pd_range_kw[1]} kW) and does not explain the measured spread (${pp.measured_range_kw[0]} to ${pp.measured_range_kw[1]} kW), so neither the bare Bond draw nor the paper Pc (whose Pd is a size-specific net power, not the classical Bond draw) reproduces the variation. The best refit of the paper FORM on our Pd collapses toward the mean. We do NOT claim a Bond 2x-overprediction is removed; the real at-bar result is the t/h parity, not the power. In the app the MEASURED power is the shown reference.`}</p>
    </div>
  );
}

export function LooParity() {
  const es = useShellLang() === 'es';
  const [d, setD] = useState<LooDoc | null>(null);
  useEffect(() => { loadLoo().then(setD).catch(() => {}); }, []);
  if (!d) return <p className="tz-panel-sub">...{es ? 'cargando validación LOO' : 'loading LOO validation'}...</p>;
  const tph = d.loo.tph.strict;
  const kw = d.loo.kW.strict;
  const measTph = d.loo.tph.measured;
  const tphSeries: Series[] = [
    { label: es ? 'M0 backbone (LOO)' : 'M0 backbone (LOO)', color: C.backbone, pts: measTph.map((m, i) => ({ x: m, y: tph.pred.M0[i] })) },
    { label: es ? 'M1 residuo (LOO)' : 'M1 residual (LOO)', color: C.resid, pts: measTph.map((m, i) => ({ x: m, y: tph.pred.M1[i] })) },
  ];
  return (
    <div>
      <p className="tz-panel-sub">{es
        ? `Paridad HELD-OUT (leave-one-survey-out, ${d.n} encuestas): cada punto se predice con las otras ${d.n - 1}. La barra vertical en M0 es el intervalo predictivo del 80% (UQ). El t/h es el objetivo medido primario.`
        : `HELD-OUT parity (leave-one-survey-out, ${d.n} surveys): each point is predicted from the other ${d.n - 1}. The vertical bar on M0 is the 80% predictive interval (UQ). t/h is the primary measured target.`}</p>
      <ParitySvg series={tphSeries} unit="t/h" es={es} errHalf={tph.uq?.band_halfwidth} />
      <table className="tz-table" style={{ marginTop: '0.5rem', maxWidth: 640 }}>
        <thead><tr><th>{es ? 'modelo (LOO estricto)' : 'model (strict LOO)'}</th><th className="num">t/h MAPE %</th><th className="num">kW MAPE %</th><th className="num">t/h R²</th></tr></thead>
        <tbody>
          <tr><td>M0 {es ? 'backbone calibrado' : 'calibrated backbone'}</td><td className="num">{tph.M0_backbone.mape_pct}</td><td className="num">{kw.M0_backbone.mape_pct}</td><td className="num">{tph.M0_backbone.r2}</td></tr>
          <tr><td>M1 {es ? 'backbone + residuo acotado' : 'backbone + bounded residual'}</td><td className="num">{tph.M1_residual.mape_pct}</td><td className="num">{kw.M1_residual.mape_pct}</td><td className="num">{tph.M1_residual.r2}</td></tr>
          <tr><td>M2 {es ? 'libre (sobreajuste)' : 'free-form (overfit)'}</td><td className="num">{tph.M2_freeform.mape_pct}</td><td className="num">{kw.M2_freeform.mape_pct}</td><td className="num">{tph.M2_freeform.r2}</td></tr>
          <tr><td>{es ? 'media constante (línea base)' : 'constant-mean (baseline)'}</td><td className="num">{tph.constant_mean.mape_pct}</td><td className="num">{kw.constant_mean.mape_pct}</td><td className="num">{tph.constant_mean.r2}</td></tr>
          <tr><td>{es ? 'control etiqueta-barajada' : 'label-shuffle control'}</td><td className="num">{tph.M1_label_shuffle.mape_pct}</td><td className="num">{kw.M1_label_shuffle.mape_pct}</td><td className="num">{tph.M1_label_shuffle.r2}</td></tr>
        </tbody>
      </table>
      {tph.uq && (
        <p className="tz-panel-sub">{es
          ? `UQ (t/h): intervalo 80% = M0 ± ${tph.uq.band_halfwidth} t/h (±${tph.uq.band_rel_pct}%); cobertura empírica ${(tph.uq.empirical_coverage * 100).toFixed(0)}% vs 80% nominal (n=${d.n}, estimación gruesa).`
          : `UQ (t/h): 80% interval = M0 ± ${tph.uq.band_halfwidth} t/h (±${tph.uq.band_rel_pct}%); empirical coverage ${(tph.uq.empirical_coverage * 100).toFixed(0)}% vs 80% nominal (n=${d.n}, coarse estimate).`}</p>
      )}
      <p className="tz-note">{es
        ? `Resultado pre-registrado: en t/h el backbone calibrado alcanza ${tph.M0_backbone.mape_pct}% MAPE held-out (dentro de la banda ~15% del paper), supera a la media constante (${tph.constant_mean.mape_pct}%) y pasa el control de etiqueta-barajada (${tph.M1_label_shuffle.mape_pct}%): habilidad real. El residuo M1 NO supera al backbone fuera de muestra (${tph.M1_residual.mape_pct}% vs ${tph.M0_backbone.mape_pct}%): NULO pre-registrado, por eso enviamos el backbone + banda empírica, no un residuo sobreajustado. En kW el backbone no supera a la media (limitación de la potencia de Bond, ver panel de potencia).`
        : `Pre-registered result: for t/h the calibrated backbone reaches ${tph.M0_backbone.mape_pct}% held-out MAPE (inside the paper's ~15% band), beats the constant-mean baseline (${tph.constant_mean.mape_pct}%) and passes the label-shuffle control (${tph.M1_label_shuffle.mape_pct}%): real skill. The M1 residual does NOT beat the backbone out-of-sample (${tph.M1_residual.mape_pct}% vs ${tph.M0_backbone.mape_pct}%): a pre-registered NULL, so we ship the backbone + empirical band, not an overfit residual. For kW the backbone does not beat the mean (the Bond power limitation, see the power panel).`}</p>
    </div>
  );
}
