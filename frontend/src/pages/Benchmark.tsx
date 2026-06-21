import { useEffect, useState } from 'react';
import { Refs, useShellLang } from '@fasl-work/caos-app-shell';
import { loadLearned, learnedMetrics, type Metrics } from '../physics/surrogate';

// Benchmark — the three honest, separable checks (the central defense against over-claiming). The surrogate-vs-
// physics numbers are loaded LIVE from the committed surrogate_metrics.json (the real held-out values from the
// independent 2nd LHS draw) — no fabricated numbers.
export default function Benchmark() {
  const es = useShellLang() === 'es';
  const [met, setMet] = useState<Metrics | null>(null);
  useEffect(() => { loadLearned().then(() => setMet(learnedMetrics())).catch(() => {}); }, []);

  const OUTS = ['p80', 'p50', 'p20', 'pass1', 'pass4', 'pass8', 'pass16', 'pass32', 'tph', 'kW'];

  return (
    <section className="tz-prose" style={{ maxWidth: '100%' }}>
      <h2>Benchmark</h2>
      <p className="tz-lead">{es ? 'Tres comprobaciones separables y reportadas con honestidad — la defensa central contra el sobre-ajuste y la precisión hueca.' : 'Three separable, honestly-reported checks — the central defense against over-claiming and hollow accuracy.'}</p>

      <h3>{es ? '1 · Surrogate vs la física que emula (held-out)' : '1 · Surrogate vs the physics it emulates (held-out)'}</h3>
      <p>{es ? 'R²/MAPE por salida del MLP ONNX contra el motor exacto de balance poblacional, en un segundo barrido Latin-hypercube INDEPENDIENTE (otra semilla, no un split de filas). Crítico: mide acuerdo con la física barata calibrada, NO con una planta real.' : 'Per-output R²/MAPE of the ONNX MLP vs the exact population-balance engine, on a second INDEPENDENT Latin-hypercube draw (different seed, not a row-split). Critical: it measures agreement with the calibrated cheap physics, NOT a real plant.'}</p>
      {met ? (
        <table className="tz-table" style={{ maxWidth: 620 }}>
          <thead><tr><th>{es ? 'salida' : 'output'}</th><th className="num">R²</th><th className="num">MAPE %</th></tr></thead>
          <tbody>{OUTS.map((k) => met.perOutput[k] && (
            <tr key={k}><td>{k}</td><td className="num">{met.perOutput[k].r2}</td><td className="num">{met.perOutput[k].mape_pct}</td></tr>
          ))}</tbody>
        </table>
      ) : <p className="tz-panel-sub">…{es ? 'cargando métricas' : 'loading metrics'}…</p>}
      {met && <p className="tz-panel-sub">{es ? 'Entrenado con' : 'Trained on'} {met.nTrain} {es ? 'puntos, evaluado en' : 'points, evaluated on'} {met.nTest} {es ? 'puntos held-out independientes. Monotonicidad P80 vs CSS verificada' : 'independent held-out points. P80-vs-CSS monotonicity verified'}: <b>{String(met.p80MonotoneVsCss)}</b>. {es ? 'La pestaña «Surrogate vs física» del App muestra el scatter de paridad en vivo.' : 'The App’s “Surrogate vs physics” tab shows the live parity scatter.'}</p>}

      <h3>{es ? '2 · Acuerdo balance-poblacional ↔ DEM' : '2 · Population-balance ↔ DEM agreement'}</h3>
      <p>{es ? 'El check de "¿la capa en vivo ES de verdad la física?": la salida de la matriz de Whiten contra los escalares del DEM grueso offline (P80, t/h, kW) en puntos compartidos, con tolerancia declarada. Una brecha mayor a la tolerancia es señal de rediseño (derivar B/S del DEM), no algo para tapar.' : 'The "is the live tier actually the physics?" check: the Whiten-matrix output vs the offline coarse-grained DEM scalars (P80, t/h, kW) on shared points, with a stated tolerance. A gap beyond tolerance is a redesign signal (derive B/S from the DEM), not something to paper over.'}</p>
      <p className="tz-note">{es ? 'Las trazas DEM offline y este cruce se incorporan en el siguiente incremento (la capa DEM 3D); el balance poblacional + la capacidad ya corren en vivo y se validan con los tests de invariantes (cierre de masa, monotonicidad, joroba de capacidad).' : 'The offline DEM traces and this cross-check are wired in the next increment (the 3D DEM tier); the population balance + capacity already run live and are validated by the invariant tests (mass closure, monotonicity, the capacity hump).'}</p>

      <h3>{es ? '3 · Calibración a número absoluto' : '3 · Absolute-number calibration'}</h3>
      <p>{es ? 'Factores de escala contra datos industriales publicados de cono clase HP (Duarte et al. 2021, CC-BY), manteniendo el ancla de calibración ESTRICTAMENTE disjunta de cualquier punto de validación held-out. Además, el autoencoder se evalúa como AUC de clasificación de régimen del error de reconstrucción.' : 'Scale factors against published HP-class cone industrial data (Duarte et al. 2021, CC-BY), keeping the calibration anchor STRICTLY disjoint from any held-out validation point. Separately, the autoencoder is scored as the regime-classification AUC of its reconstruction error.'}</p>

      <h3>{es ? 'Honestidad' : 'Honesty'}</h3>
      <p>{es ? 'Las constantes K1/K2/K3 y el acople de energía son ilustrativos (reproducen tendencias) hasta calibrar con los datos abiertos. El surrogate emula la física barata calibrada, no una planta. Reproducibilidad: semillas fijas + flags deterministas de torch; el contrato de replay es el .onnx + metrics.json versionados, no un reentrenamiento bit-idéntico. No se reportan números fabricados.' : 'The K1/K2/K3 constants and the energy coupling are illustrative (they reproduce trends) pending calibration to the open data. The surrogate emulates the calibrated cheap physics, not a plant. Reproducibility: fixed seeds + deterministic torch flags; the replay contract is the committed .onnx + metrics.json, not a bit-identical retrain. No fabricated numbers are reported.'}</p>
      <Refs ids={['duarte2021', 'morrell2009', 'quist2016', 'napiermunn1996']} label="References" />
    </section>
  );
}
