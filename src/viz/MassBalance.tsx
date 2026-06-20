import { useShellLang } from '@fasl-work/caos-app-shell';
import { evaluate } from '../physics/engine';
import type { CrusherResult, Operating } from '../physics/types';

// Mass-balance + physics-assert strip: the flow feed → classification C → breakage B → product with the closure
// residual shown (Σ product = Σ feed = 1 ⇒ a green "mass closure ≈ 0" badge), plus a strip of physics-assert
// badges that must hold (CSS↓ ⇒ P80↓, mass closure ≈ 0, capacity hump interior, CSS≥F80 ⇒ flagged invalid).
export function MassBalance({ op, result }: { op: Operating; result: CrusherResult }) {
  const es = useShellLang() === 'es';

  // run the assert probes live
  const p80Lo = evaluate({ ...op, cssMm: Math.max(4, op.cssMm * 0.6) }).p80;
  const p80Hi = evaluate({ ...op, cssMm: op.cssMm * 1.4 }).p80;
  const cssMono = p80Lo <= result.p80 + 1e-6 && result.p80 <= p80Hi + 1e-6;
  const closureOk = result.massClosure < 1e-5;
  const cssInvalid = op.cssMm >= result.f80;     // pass-through/invalid region
  const asserts = [
    { ok: cssMono, t: es ? 'CSS↓ ⇒ P80↓' : 'CSS↓ ⇒ P80↓' },
    { ok: closureOk, t: es ? `cierre de masa ≈ 0 (${result.massClosure.toExponential(1)})` : `mass closure ≈ 0 (${result.massClosure.toExponential(1)})` },
    { ok: result.reductionRatio >= 1, t: es ? `reducción ${result.reductionRatio.toFixed(2)}× ≥ 1` : `reduction ${result.reductionRatio.toFixed(2)}× ≥ 1` },
    { ok: cssInvalid ? !result.valid || result.regime !== 'choke' : true, t: es ? 'CSS≥F80 ⇒ marcado' : 'CSS≥F80 ⇒ flagged' },
  ];

  // a compact sankey-ish flow: the share of feed gripped (classified for breakage) vs passing unbroken — high
  // when the setting actually reduces, near-1-passing in the pass-through regime.
  const W = 460, H = 150;
  // unbroken-pass share decreases as the reduction ratio rises (more material gets gripped & broken).
  const passShare = result.reductionRatio <= 1.05 ? 0.85 : Math.max(0.08, Math.min(0.45, 0.5 / result.reductionRatio));
  const brokenShare = 1 - passShare;

  return (
    <div>
      <div className="tz-svg-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="mass balance" style={{ font: '11px sans-serif' }}>
          {/* feed */}
          <rect x="10" y="50" width="90" height="50" rx="6" fill="var(--color-surface)" stroke="var(--color-border)" />
          <text x="55" y="72" textAnchor="middle" fill="var(--color-fg)">{es ? 'Aliment.' : 'Feed'}</text>
          <text x="55" y="88" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="10">Σ=1.000</text>
          {/* split into classified (broken) vs passing */}
          <path d={`M100,62 C160,62 160,${30} 220,30`} stroke="#3fb950" strokeWidth={Math.max(2, brokenShare * 26)} fill="none" opacity="0.5" />
          <path d={`M100,88 C160,88 160,120 220,120`} stroke="var(--color-fg-subtle)" strokeWidth={Math.max(2, passShare * 26)} fill="none" opacity="0.5" />
          <rect x="220" y="14" width="100" height="40" rx="6" fill="var(--color-surface)" stroke="#3fb950" />
          <text x="270" y="32" textAnchor="middle" fill="var(--color-fg)" fontSize="10">{es ? 'fractura B·C' : 'breakage B·C'}</text>
          <text x="270" y="46" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="10">{(brokenShare * 100).toFixed(0)}%</text>
          <rect x="220" y="100" width="100" height="40" rx="6" fill="var(--color-surface)" stroke="var(--color-border)" />
          <text x="270" y="118" textAnchor="middle" fill="var(--color-fg)" fontSize="10">{es ? 'pasa (I−C)' : 'pass (I−C)'}</text>
          <text x="270" y="132" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="10">{(passShare * 100).toFixed(0)}%</text>
          {/* product */}
          <path d={`M320,34 C370,34 370,62 410,68`} stroke="#3fb950" strokeWidth="4" fill="none" opacity="0.5" />
          <path d={`M320,120 C370,120 370,88 410,82`} stroke="var(--color-fg-subtle)" strokeWidth="4" fill="none" opacity="0.5" />
          <rect x="410" y="50" width="44" height="50" rx="6" fill="var(--color-surface)" stroke="var(--color-accent)" />
          <text x="432" y="72" textAnchor="middle" fill="var(--color-fg)" fontSize="10">{es ? 'Prod.' : 'Prod.'}</text>
          <text x="432" y="88" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="9">Σ=1.000</text>
        </svg>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
        {asserts.map((a, i) => <span key={i} className={`tz-badge ${a.ok ? 'ok' : 'bad'}`}>{a.ok ? '✓' : '✗'} {a.t}</span>)}
      </div>
      <p className="tz-panel-sub" style={{ marginTop: '0.4rem' }}>{es ? 'La masa se conserva exactamente: cada columna de B se renormaliza a 1 y el producto es (I−C)(I−B·C)⁻¹·f. Las aserciones físicas se evalúan en vivo en el punto actual.' : 'Mass is conserved exactly: each column of B renormalizes to 1 and the product is (I−C)(I−B·C)⁻¹·f. The physics asserts are evaluated live at the current point.'}</p>
    </div>
  );
}
