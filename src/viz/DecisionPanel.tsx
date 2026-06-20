import { useState } from 'react';
import { useShellLang } from '@fasl-work/caos-app-shell';
import { recommendCss } from '../physics/surrogate';
import { optimalSpeed } from '../physics/capacity';
import type { CrusherResult, Operating } from '../physics/types';

// The decision / recommendation layer (didactic what-if, NOT a plant setpoint controller). Given a target
// product P80 it recommends a CSS (inverse via bisection on the monotone engine); it diagnoses the binding
// constraint (capacity / power / nip); and it gives a RAG verdict on the operating point — all with honest
// framing, no overconfident single number.
export function DecisionPanel({ op, result, onApplyCss }: { op: Operating; result: CrusherResult; onApplyCss: (css: number) => void }) {
  const es = useShellLang() === 'es';
  const [target, setTarget] = useState(Math.round(result.p80));
  const rec = recommendCss(op, target);

  // bottleneck diagnosis
  const opt = optimalSpeed(op.machine);
  const overSpeed = op.speedRpm > opt * 1.08;
  const highPower = result.powerKw > (op.machine === 'jaw' ? 200 : 300);
  const nipBad = result.nipAngleDeg > result.nipLimitDeg;
  const bottleneck = !result.valid ? (es ? 'punto inválido' : 'invalid point')
    : nipBad ? (es ? 'limitado por nip (no agarra)' : 'nip-limited (no grip)')
    : overSpeed ? (es ? 'limitado por capacidad (sobre el óptimo)' : 'capacity-limited (past optimum)')
    : highPower ? (es ? 'limitado por potencia' : 'power-limited')
    : (es ? 'sin restricción activa' : 'no binding constraint');

  const verdict = !result.valid ? { c: 'bad', t: es ? 'Inválido' : 'Invalid' }
    : (result.regime === 'pass-through' || nipBad) ? { c: 'warn', t: es ? 'Revisar' : 'Review' }
    : { c: 'ok', t: es ? 'OK' : 'OK' };

  return (
    <div className="tz-decision">
      <span className="tz-decision-h">{es ? 'Decisión' : 'Decision'}</span>
      <span className="tz-verdict"><span className={`tz-badge ${verdict.c}`}>{verdict.t}</span>
        <span className="tz-panel-sub" style={{ marginLeft: '0.3rem' }}>{bottleneck}</span></span>

      <label className="tz-ctl" style={{ marginTop: '0.3rem' }}>
        <span className="tz-ctl-row">{es ? 'P80 objetivo' : 'Target P80'} <b>{target} mm</b></span>
        <input className="range" type="range" min={2} max={120} step={1} value={target} onChange={(e) => setTarget(+e.target.value)} />
      </label>
      <div className="tz-panel-sub">
        {rec == null ? (es ? 'Objetivo fuera del rango alcanzable con esta máquina/feed.' : 'Target unreachable for this machine/feed.')
          : <>{es ? 'CSS recomendado' : 'Recommended CSS'}: <b style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-mono)' }}>{rec.toFixed(1)} mm</b>{' '}
            <button className="chip" style={{ marginLeft: '0.3rem' }} onClick={() => onApplyCss(+rec.toFixed(1))}>{es ? 'aplicar' : 'apply'}</button></>}
      </div>
      <span className="tz-panel-sub" style={{ marginTop: '0.2rem' }}>{es ? 'Inverso por bisección sobre el motor monótono — qué-pasaría-si didáctico, no un setpoint de planta.' : 'Inverse via bisection on the monotone engine — a didactic what-if, not a plant setpoint.'}</span>
    </div>
  );
}
