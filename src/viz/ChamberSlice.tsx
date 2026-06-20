import { useShellLang } from '@fasl-work/caos-app-shell';
import { chamberProfile, chamberNipAngle, profilePolylines, jawProfile, machineGeom } from '../physics/chamber';
import { nipLimit } from '../physics/capacity';
import type { Operating } from '../physics/types';

// The honest MEASUREMENT view that ships alongside the 3D gestalt: a 2D cross-section where you READ the CSS/OSS
// gap, the throw stroke and — critically — the live nip angle vs the friction grip limit, as numbers. For the
// cone/gyratory it is the axisymmetric profile (mantle ogive inside the fixed concave bowl); for the JAW it is
// the planar two-plate mechanism (fixed jaw + swing jaw). They are fundamentally different machines, drawn
// differently — not one shape recoloured.
export function ChamberSlice({ op, height = 320 }: { op: Operating; height?: number }) {
  const es = useShellLang() === 'es';
  if (!machineGeom(op.machine).isRevolution) return <JawSlice op={op} height={height} es={es} />;
  const prof = chamberProfile(op.machine, op.cssMm, op.throwMm);
  const { concave, mantle } = profilePolylines(prof, 40);
  const nip = chamberNipAngle(prof);
  const lim = nipLimit();
  const gripped = nip <= lim;

  // map (r,z) → svg; z up, r right. Centre the chamber; the concave is the outer bowl, the mantle a solid cone.
  const W = 460, H = height, padX = 46, padY = 22;
  const rMax = Math.max(...concave.map((c) => c[0])) * 1.08;
  const zMin = -prof.P.overlap, zMax = prof.P.zTop, zRange = zMax - zMin; // include the overlap so the mantle is seen extending BELOW the concave
  const cx = W / 2;
  const sx = (r: number) => (r / rMax) * (W / 2 - padX);
  const sy = (z: number) => H - padY - ((z - zMin) / zRange) * (H - 2 * padY);
  const yDischarge = sy(0); // concave discharge lip line
  // outer bowl as a closed polygon (down the right concave wall, across the discharge, up the left wall)
  const bowl = [
    ...concave.map(([r, z]) => `${cx + sx(r)},${sy(z)}`),                  // right wall bottom→top? concave is bottom→top
  ];
  const bowlPath = `M${concave.map(([r, z]) => `${cx + sx(r)},${sy(z)}`).join(' L')} L${[...concave].reverse().map(([r, z]) => `${cx - sx(r)},${sy(z)}`).join(' L')} Z`;
  // mantle as a solid central cone (up the right edge, down the left edge), closed
  const mantlePath = `M${mantle.map(([r, z]) => `${cx + sx(r)},${sy(z)}`).join(' L')} L${[...mantle].reverse().map(([r, z]) => `${cx - sx(r)},${sy(z)}`).join(' L')} Z`;
  // open-side mantle outline (mantle shifted toward the right by the throw — the OSS extreme of one gyration)
  const ossOutline = `M${mantle.map(([r, z]) => `${cx + sx(r) + sx(op.throwMm) / 2},${sy(z)}`).join(' L')}`;
  void bowl;

  return (
    <div>
      <div className="tz-svg-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={es ? 'Corte de cámara' : 'Chamber cross-section'} style={{ font: '11px var(--font-sans, sans-serif)' }}>
          {/* concave bowl (outer, fixed) */}
          <path d={bowlPath} fill="color-mix(in oklab, var(--color-fg-subtle) 8%, transparent)" stroke="var(--color-fg-subtle)" strokeWidth="2.5" />
          {/* mantle (central solid ogive, gyrating) — its base extends BELOW the concave discharge lip */}
          <path d={mantlePath} fill="color-mix(in oklab, #3fb950 30%, transparent)" stroke="#3fb950" strokeWidth="2.5" />
          {/* concave discharge-lip line — the mantle visibly extends below it (this is what lets the post be raised) */}
          <line x1={cx - sx(prof.rConcave(2)) - 8} y1={yDischarge} x2={cx + sx(prof.rConcave(2)) + 8} y2={yDischarge} stroke="var(--color-fg-subtle)" strokeWidth="1" strokeDasharray="5 4" />
          <text x={cx - sx(rMax) + 2} y={yDischarge - 4} fill="var(--color-fg-faint)" fontSize="10">{es ? 'labio cóncavo' : 'concave lip'}</text>
          {/* OSS extreme outline (dashed) */}
          <path d={ossOutline} fill="none" stroke="#3fb950" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.7" />
          {/* labels */}
          <text x={cx} y={sy(zMax * 0.55)} textAnchor="middle" fill="#2ea043" fontWeight="600">{es ? 'manto' : 'mantle'}</text>
          <text x={cx + sx(rMax) - 6} y={sy(zMax * 0.85)} textAnchor="end" fill="var(--color-fg-subtle)">{es ? 'cóncavo' : 'concave'}</text>
          {/* CSS / OSS callouts at the discharge (right-side gap) */}
          {(() => {
            const z = 0 + 6; const rc = prof.rConcave(z), rm = prof.rMantleClosed(z);
            const yC = sy(z);
            return (<g>
              <line x1={cx + sx(rm)} y1={yC} x2={cx + sx(rc)} y2={yC} stroke="#f0883e" strokeWidth="2.5" />
              <text x={cx + sx((rm + rc) / 2)} y={yC - 8} textAnchor="middle" fill="#f0883e" fontWeight="700">CSS {op.cssMm}mm</text>
              <line x1={cx - sx(rm)} y1={yC} x2={cx - sx(rc)} y2={yC} stroke="var(--color-fg-faint)" strokeWidth="2" strokeDasharray="3 2" />
              <text x={cx - sx((rm + rc) / 2)} y={yC - 8} textAnchor="middle" fill="var(--color-fg-faint)">OSS {op.cssMm + op.throwMm}mm</text>
            </g>);
          })()}
        </svg>
      </div>
      <div className="tz-grid2" style={{ marginTop: '0.5rem' }}>
        <div className="tz-decision">
          <span className="tz-decision-h">{es ? 'Ángulo de nip' : 'Nip angle'}</span>
          <span className="tz-verdict"><b style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem' }}>{nip.toFixed(1)}°</b>
            <span className={`tz-badge ${gripped ? 'ok' : 'bad'}`}>{gripped ? (es ? 'agarra' : 'gripped') : (es ? 'escupe' : 'spits out')}</span></span>
          <span className="tz-panel-sub">{es ? 'Límite de agarre' : 'Grip limit'} 2·arctan(µ) = {lim.toFixed(1)}° (µ=0.35)</span>
        </div>
        <div className="tz-decision">
          <span className="tz-decision-h">{es ? 'Geometría' : 'Geometry'}</span>
          <span className="tz-panel-sub" style={{ fontFamily: 'var(--font-mono)' }}>CSS {op.cssMm} mm · throw {op.throwMm} mm · OSS {op.cssMm + op.throwMm} mm</span>
          <span className="tz-panel-sub">{es ? 'La carrera (throw) es la excursión excéntrica del manto: el hueco oscila entre CSS y OSS una vez por giro.' : 'The throw is the mantle’s eccentric excursion: the gap oscillates between CSS and OSS once per revolution.'}</span>
        </div>
      </div>
    </div>
  );
}

// The JAW is a planar two-plate mechanism: a near-vertical FIXED jaw and an inclined SWING jaw forming a V that
// converges down to the discharge. Feed enters at the wide GAPE (top); product exits at the CSS (bottom). The
// swing plate is drawn at its CLOSED extreme (solid) and OPEN extreme (dashed) — the throw is largest at the
// discharge and decays to ~0 at the suspension point near the top (single-toggle / overhead-eccentric).
function JawSlice({ op, height, es }: { op: Operating; height: number; es: boolean }) {
  const j = jawProfile(op.machine, op.cssMm, op.throwMm);
  const lim = nipLimit();
  const gripped = j.nipDeg <= lim;
  const W = 460, H = height, padX = 60, padY = 22, n = 40;
  const zTop = j.P.zTop;
  // x extent: widest opening is the gape (open side) on the left of the fixed plate
  const xLeftMost = j.xSwing(zTop, 1);      // most-negative x (top of swing, open)
  const xRightMost = j.xFixed(zTop);        // fixed leans right going up
  const xSpan = (xRightMost - xLeftMost) || 1;
  const sx = (x: number) => padX + ((x - xLeftMost) / xSpan) * (W - 2 * padX);
  const sy = (z: number) => H - padY - (z / zTop) * (H - 2 * padY);
  const fixedPts: string[] = [], swingClosed: string[] = [], swingOpen: string[] = [];
  for (let i = 0; i <= n; i++) {
    const z = (i / n) * zTop;
    fixedPts.push(`${sx(j.xFixed(z))},${sy(z)}`);
    swingClosed.push(`${sx(j.xSwing(z, 0))},${sy(z)}`);
    swingOpen.push(`${sx(j.xSwing(z, 1))},${sy(z)}`);
  }
  // feed wedge (chamber interior, closed side): fixed wall down, across discharge, up the swing wall
  const wedge = `M${fixedPts.join(' L')} L${[...swingClosed].reverse().join(' L')} Z`;
  // plate thickness slabs (drawn as thick strokes); fixed slab to the right, swing slab to the left
  const yDis = sy(2), yTop = sy(zTop - 2);
  return (
    <div>
      <div className="tz-svg-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={es ? 'Mecanismo de mandíbula' : 'Jaw mechanism'} style={{ font: '11px var(--font-sans, sans-serif)' }}>
          {/* crushing chamber (interior, between the plates, closed side) */}
          <path d={wedge} fill="color-mix(in oklab, #3fb950 16%, transparent)" stroke="none" />
          {/* fixed jaw (right, near-vertical, FIXED) */}
          <polyline points={fixedPts.join(' ')} fill="none" stroke="var(--color-fg-subtle)" strokeWidth="6" strokeLinecap="round" />
          <text x={sx(j.xFixed(zTop * 0.5)) + 10} y={sy(zTop * 0.5)} fill="var(--color-fg-subtle)">{es ? 'placa fija' : 'fixed jaw'}</text>
          {/* swing jaw — open extreme (dashed) then closed extreme (solid) */}
          <polyline points={swingOpen.join(' ')} fill="none" stroke="#3fb950" strokeWidth="2" strokeDasharray="5 4" opacity="0.7" />
          <polyline points={swingClosed.join(' ')} fill="none" stroke="#2ea043" strokeWidth="6" strokeLinecap="round" />
          <text x={sx(j.xSwing(zTop * 0.5, 0)) - 10} y={sy(zTop * 0.5)} textAnchor="end" fill="#2ea043">{es ? 'placa móvil' : 'swing jaw'}</text>
          {/* eccentric / suspension point at the top of the swing jaw */}
          <circle cx={sx(j.xSwing(zTop, 0))} cy={yTop} r="6" fill="none" stroke="#f0883e" strokeWidth="2" />
          <text x={sx(j.xSwing(zTop, 0))} y={yTop - 10} textAnchor="middle" fill="#f0883e">{es ? 'excéntrica' : 'eccentric'}</text>
          {/* GAPE callout (top opening) */}
          <line x1={sx(j.xSwing(zTop, 0))} y1={yTop} x2={sx(j.xFixed(zTop))} y2={yTop} stroke="var(--color-fg-faint)" strokeWidth="1.5" strokeDasharray="3 2" />
          <text x={(sx(j.xSwing(zTop, 0)) + sx(j.xFixed(zTop))) / 2} y={yTop - 10} textAnchor="middle" fill="var(--color-fg-faint)">{es ? 'boca' : 'gape'} {j.gapeMm.toFixed(0)}mm</text>
          {/* CSS / OSS callouts at the discharge (bottom) */}
          <line x1={sx(j.xSwing(0, 0))} y1={yDis} x2={sx(j.xFixed(0))} y2={yDis} stroke="#f0883e" strokeWidth="2.5" />
          <text x={(sx(j.xSwing(0, 0)) + sx(j.xFixed(0))) / 2} y={yDis + 16} textAnchor="middle" fill="#f0883e" fontWeight="700">CSS {op.cssMm}mm</text>
          <line x1={sx(j.xSwing(0, 1))} y1={yDis + 4} x2={sx(j.xFixed(0))} y2={yDis + 4} stroke="var(--color-fg-faint)" strokeWidth="2" strokeDasharray="3 2" />
          <text x={(sx(j.xSwing(0, 1)) + sx(j.xFixed(0))) / 2} y={yDis + 30} textAnchor="middle" fill="var(--color-fg-faint)">OSS {op.cssMm + op.throwMm}mm</text>
        </svg>
      </div>
      <div className="tz-grid2" style={{ marginTop: '0.5rem' }}>
        <div className="tz-decision">
          <span className="tz-decision-h">{es ? 'Ángulo de nip' : 'Nip angle'}</span>
          <span className="tz-verdict"><b style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem' }}>{j.nipDeg.toFixed(1)}°</b>
            <span className={`tz-badge ${gripped ? 'ok' : 'bad'}`}>{gripped ? (es ? 'agarra' : 'gripped') : (es ? 'escupe' : 'spits out')}</span></span>
          <span className="tz-panel-sub">{es ? 'Límite de agarre' : 'Grip limit'} 2·arctan(µ) = {lim.toFixed(1)}° (µ=0.35)</span>
        </div>
        <div className="tz-decision">
          <span className="tz-decision-h">{es ? 'Geometría (mandíbula)' : 'Geometry (jaw)'}</span>
          <span className="tz-panel-sub" style={{ fontFamily: 'var(--font-mono)' }}>{es ? 'boca' : 'gape'} {j.gapeMm.toFixed(0)} · CSS {op.cssMm} · OSS {op.cssMm + op.throwMm} mm</span>
          <span className="tz-panel-sub">{es ? 'Mecanismo planar de dos placas (no es superficie de revolución). La carrera es máxima en la descarga y ~0 en la suspensión (toggle simple / excéntrica superior).' : 'Planar two-plate mechanism (not a surface of revolution). Throw is largest at the discharge and ~0 at the suspension point (single-toggle / overhead-eccentric).'}</span>
        </div>
      </div>
    </div>
  );
}
