import { useEffect, useState } from 'react';
import { useShellLang } from '@fasl-work/caos-app-shell';
import { anomalyScore, type AnomalyOut } from '../physics/surrogate';
import { Gauge } from './Gauge';
import type { CrusherResult } from '../physics/types';

// Operating-anomaly / out-of-distribution view: the denoising autoencoder runs LIVE on the current product-
// gradation signature; its reconstruction error is the anomaly score. High score ⇒ abnormal gradation/power
// regime OR a query off the surrogate's training manifold (so "the surrogate is extrapolating, distrust it").
export function AnomalyView({ result }: { result: CrusherResult }) {
  const es = useShellLang() === 'es';
  const [a, setA] = useState<AnomalyOut | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    anomalyScore(result).then((x) => alive && setA(x)).catch(() => alive && setErr(true));
    return () => { alive = false; };
  }, [result]);

  const regimeBadge = (() => {
    if (!result.valid) return { cls: 'bad', t: es ? 'Inválido' : 'Invalid' };
    if (result.regime === 'pass-through') return { cls: 'warn', t: es ? 'Paso directo' : 'Pass-through' };
    if (result.regime === 'trickle') return { cls: 'warn', t: es ? 'Goteo' : 'Trickle' };
    return { cls: 'ok', t: es ? 'Choque (normal)' : 'Choke (normal)' };
  })();

  return (
    <div>
      <div className="tz-panel-sub">{es ? 'El autoencoder denoising corre EN VIVO. Error de reconstrucción = score de anomalía / fuera-de-distribución.' : 'The denoising autoencoder runs LIVE. Reconstruction error = anomaly / out-of-distribution score.'}</div>
      {err ? <p className="tz-note">{es ? 'No se pudo cargar el autoencoder ONNX.' : 'Autoencoder ONNX failed to load.'}</p> : !a ? <p className="tz-panel-sub">…</p> : (
        <div style={{ marginTop: '0.5rem' }}>
          <Gauge title={es ? 'Error de reconstrucción (anomalía)' : 'Reconstruction error (anomaly)'} value={a.score} min={0} max={Math.max(a.threshold * 2.2, a.score * 1.1)}
            zones={[{ from: 0, to: a.threshold, color: 'color-mix(in oklab, #3fb950 50%, transparent)' }, { from: a.threshold, to: Math.max(a.threshold * 2.2, a.score * 1.1), color: 'color-mix(in oklab, #f85149 50%, transparent)' }]}
            fmt={(v) => v.toFixed(3)} />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem', alignItems: 'center' }}>
            <span className={`tz-badge ${a.isAnomaly ? 'bad' : 'ok'}`}>{a.isAnomaly ? (es ? 'Anómalo / extrapolando' : 'Anomalous / extrapolating') : (es ? 'En envolvente' : 'In-envelope')}</span>
            <span className={`tz-badge ${regimeBadge.cls}`}>{regimeBadge.t}</span>
            <span className="tz-panel-sub" style={{ fontFamily: 'var(--font-mono)' }}>{es ? 'umbral p99' : 'p99 threshold'} {a.threshold.toFixed(3)} · {(a.ratio).toFixed(2)}×</span>
          </div>
          <p className="tz-panel-sub" style={{ marginTop: '0.5rem' }}>{a.isAnomaly
            ? (es ? 'Esta operación produce una firma de gradación/potencia poco frecuente en el entrenamiento — el surrogate puede estar extrapolando; confía más en el motor físico.' : 'This operating point yields a gradation/power signature rare in training — the surrogate may be extrapolating; trust the physics engine more here.')
            : (es ? 'Firma dentro de la distribución de entrenamiento — el surrogate es confiable aquí.' : 'Signature within the training distribution — the surrogate is reliable here.')}</p>
        </div>
      )}
    </div>
  );
}
