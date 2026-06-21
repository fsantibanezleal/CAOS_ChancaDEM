import { Refs, useShellLang } from '@fasl-work/caos-app-shell';
import { CASES } from '../data/cases';

// Experiments — the case-coverage matrix and the controlled sweeps the studio runs. The offline LHS sweep +
// surrogate parity plots are wired in once the pipeline artifacts land (build stage F); this page documents the
// design + the live case matrix now.
export default function Experiments() {
  const es = useShellLang() === 'es';
  return (
    <section className="tz-prose" style={{ maxWidth: '100%' }}>
      <h2>{es ? 'Experimentos' : 'Experiments'}</h2>
      <p className="tz-lead">{es ? 'La cobertura de casos y los barridos controlados que explora el estudio: tipo de máquina, dureza, granulometría de alimentación, régimen y los dos controles (paso directo e inválido).' : 'The case coverage and controlled sweeps the studio explores: machine type, hardness, feed gradation, regime, and the two controls (pass-through and invalid).'}</p>

      <h3>{es ? 'Matriz de casos' : 'Case matrix'}</h3>
      <table className="tz-table">
        <thead><tr><th>ID</th><th>{es ? 'Caso' : 'Case'}</th><th>{es ? 'Máquina' : 'Machine'}</th><th className="num">CSS</th><th className="num">A·b</th><th>{es ? 'Tipo' : 'Type'}</th></tr></thead>
        <tbody>{CASES.map((c) => (
          <tr key={c.id}><td><b>{c.id}</b></td><td>{c.name}</td><td>{c.machine}</td><td className="num">{c.cssMm}</td><td className="num">{c.oreAxb}</td>
            <td>{c.control ? <span className={`tz-badge ${c.control === 'invalid' ? 'bad' : c.control === 'negative' ? 'warn' : 'ok'}`}>{c.control}</span> : '—'}</td></tr>
        ))}</tbody>
      </table>

      <h3>{es ? 'Barridos controlados' : 'Controlled sweeps'}</h3>
      <ul>
        <li>{es ? <><b>CSS → P80.</b> Cerrar el CSS afina el producto monótonamente (verificado en los tests del motor). La pestaña de mapa de operación muestra P80 sobre velocidad×CSS.</> : <><b>CSS → P80.</b> Closing the CSS makes the product monotonically finer (asserted in the engine tests). The operating-map tab shows P80 over speed×CSS.</>}</li>
        <li>{es ? <><b>Velocidad → capacidad.</b> La capacidad sube hasta un óptimo y luego cae (la joroba de Evertsson) — el caso S03 (sobre-velocidad) cruza deliberadamente al lado descendente.</> : <><b>Speed → capacity.</b> Capacity rises to an optimum then falls (the Evertsson hump) — case S03 (over-speed) deliberately crosses to the falling side.</>}</li>
        <li>{es ? <><b>Controles.</b> CP1 (paso directo, CSS ≥ F80) debe mostrar reducción ≈1; CI1 (CSS &gt; tope de feed) debe marcarse inválido, nunca un gráfico bonito.</> : <><b>Controls.</b> CP1 (pass-through, CSS ≥ F80) must show reduction ≈1; CI1 (CSS &gt; feed top) must be flagged invalid, never a pretty plot.</>}</li>
      </ul>

      <h3>{es ? 'Protocolo a prueba de fugas' : 'Leakage-safe protocol'}</h3>
      <p>{es ? 'El surrogate se entrena con un barrido Latin-hypercube sobre el espacio de operación (3 máquinas × 6 ejes continuos, ~4200 puntos válidos, semilla 12345) evaluado por el motor físico exacto. Se evalúa en un SEGUNDO barrido Latin-hypercube INDEPENDIENTE (semilla 67890, ~1500 puntos) — no un split de filas, que filtraría el diseño estratificado. Los puntos inválidos (CSS≥F80, mal condicionados) se descartan del entrenamiento del surrogate y forman el conjunto negativo del autoencoder.' : 'The surrogate trains on a Latin-hypercube sweep of the operating space (3 machines × 6 continuous axes, ~4200 valid points, seed 12345) evaluated by the exact physics engine. It is evaluated on a SECOND INDEPENDENT Latin-hypercube draw (seed 67890, ~1500 points) — not a row-split, which would leak the stratified design. Invalid points (CSS≥F80, ill-conditioned) are discarded from surrogate training and form the autoencoder’s negative set.'}</p>
      <p className="tz-note">{es ? 'Los resultados held-out reales (R²/MAPE por salida) y el scatter de paridad en vivo (surrogate ONNX vs motor físico) se muestran en la página Benchmark. Las trazas DEM offline y el cruce balance-poblacional↔DEM se incorporan en el siguiente incremento.' : 'The real held-out results (per-output R²/MAPE) and the live parity scatter (ONNX surrogate vs the physics engine) are on the Benchmark page. The offline DEM traces and the population-balance↔DEM cross-check are wired in the next increment.'}</p>
      <Refs ids={['duarte2021', 'quist2016', 'napiermunn1996']} label="References" />
    </section>
  );
}
