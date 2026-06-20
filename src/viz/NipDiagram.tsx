import { useShellLang, InlineMath } from '@fasl-work/caos-app-shell';
import { chamberProfile, chamberNipAngle } from '../physics/chamber';
import { nipLimit } from '../physics/capacity';
import type { Operating } from '../physics/types';

// Nip-angle diagram: a particle wedged between the mantle and the concave, with the nip angle drawn against the
// friction grip limit. Makes the geometric grip condition α_nip ≤ 2·arctan(µ) visible — WHY a particle is
// gripped and crushed vs squeezed up and out.
export function NipDiagram({ op, height = 300 }: { op: Operating; height?: number }) {
  const es = useShellLang() === 'es';
  const prof = chamberProfile(op.machine, op.cssMm, op.throwMm);
  const nip = chamberNipAngle(prof);
  const lim = nipLimit();
  const gripped = nip <= lim;
  const half = (nip / 2) * Math.PI / 180;

  const W = 460, H = height, cx = W / 2, cy = H * 0.78, L = H * 0.62;
  // two walls forming the wedge, half-angle = nip/2 from vertical
  const lx = cx - Math.sin(half) * L, ly = cy - Math.cos(half) * L;
  const rx = cx + Math.sin(half) * L, ry = cy - Math.cos(half) * L;
  const pr = 26;   // particle radius

  return (
    <div>
      <div className="tz-svg-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={es ? 'Diagrama de nip' : 'Nip diagram'} style={{ font: '11px sans-serif' }}>
          {/* walls */}
          <line x1={cx} y1={cy} x2={lx} y2={ly} stroke="var(--color-fg-subtle)" strokeWidth="3" />
          <line x1={cx} y1={cy} x2={rx} y2={ry} stroke="#3fb950" strokeWidth="3" />
          <text x={lx - 6} y={ly - 4} textAnchor="end" fill="var(--color-fg-subtle)">{es ? 'cóncavo' : 'concave'}</text>
          <text x={rx + 6} y={ry - 4} fill="#3fb950">{es ? 'manto' : 'mantle'}</text>
          {/* gripped particle */}
          <circle cx={cx} cy={cy - L * 0.5} r={pr} fill={gripped ? 'color-mix(in oklab, #3fb950 30%, transparent)' : 'color-mix(in oklab, #f85149 30%, transparent)'} stroke={gripped ? '#3fb950' : '#f85149'} strokeWidth="2" />
          {/* nip angle arc at apex */}
          <path d={`M${cx - 26 * Math.sin(half)},${cy - 26 * Math.cos(half)} A26,26 0 0 0 ${cx + 26 * Math.sin(half)},${cy - 26 * Math.cos(half)}`} fill="none" stroke="#f0883e" strokeWidth="2" />
          <text x={cx} y={cy - 34} textAnchor="middle" fill="#f0883e" fontWeight="700">{nip.toFixed(1)}°</text>
          {/* grip direction arrow */}
          <line x1={cx} y1={cy - L * 0.5} x2={cx} y2={cy - L * 0.5 + (gripped ? 40 : -40)} stroke={gripped ? '#3fb950' : '#f85149'} strokeWidth="2" markerEnd="url(#nip-a)" />
          <defs><marker id="nip-a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill={gripped ? '#3fb950' : '#f85149'} /></marker></defs>
        </svg>
      </div>
      <div className="tz-decision" style={{ marginTop: '0.5rem' }}>
        <span className="tz-verdict">
          <InlineMath tex={String.raw`\alpha_{\text{nip}}=`} /> <b style={{ fontFamily: 'var(--font-mono)' }}>{nip.toFixed(1)}°</b>
          <span style={{ margin: '0 0.3rem' }}>{gripped ? '≤' : '>'}</span>
          <InlineMath tex={String.raw`2\arctan\mu=`} /> <b style={{ fontFamily: 'var(--font-mono)' }}>{lim.toFixed(1)}°</b>
          <span className={`tz-badge ${gripped ? 'ok' : 'bad'}`} style={{ marginLeft: '0.4rem' }}>{gripped ? (es ? 'agarra y tritura' : 'gripped & crushed') : (es ? 'escupido hacia arriba' : 'squeezed upward')}</span>
        </span>
        <span className="tz-panel-sub">{es ? 'Si el ángulo de nip supera el límite de fricción, la partícula es expulsada hacia arriba en vez de fracturarse. µ ≈ 0.35.' : 'If the nip angle exceeds the friction limit, the particle is ejected upward instead of being broken. µ ≈ 0.35.'}</span>
      </div>
    </div>
  );
}
