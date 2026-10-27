// Group 1, Chamber: the 2D slice of the crushing chamber with the closed and open settings, and the nip angle against its grip
// limit. Both are drawings on the shell's `Stage` with the text kit, each under a table of the numbers it draws. The structure
// is illustrative of the machine class (cone and gyratory as a surface of revolution, the jaw as a planar two-plate mechanism),
// not the plant's own drawing, and the card says so; the numbers (the settings, the nip angle, the grip limit) are the engine's.
// The 3D chamber is added to this group by the main session (unit U2b-2 writes views/chamber3d/).
import { PlotCard, Stage, useShellLang, useWorkbenchState } from '@fasl-work/caos-app-shell';
import { chamberProfile, jawProfile, machineGeom, profilePolylines } from '../engine/chamber';
import type { Operating } from '../engine/types';
import { Fill, Labels, LabelText, Stack, TOKEN } from './draw';
import { GroupFrame, Pending, useNum, useT, useView, type Sub } from './shared';

const STRUCTURE_NOTE = {
  en: 'The structure is illustrative of the machine class, not the plant’s own drawing; the settings, the nip angle and the grip limit are the engine’s numbers.',
  es: 'La estructura es ilustrativa de la clase de máquina, no el plano de la planta; las aberturas, el ángulo de nip y el límite de agarre son números del motor.',
} as const;

interface GeometryRow {
  css: number;
  throwMm: number;
  oss: number;
  nip: number;
  limit: number;
}

/** The numbers under the slice and the nip diagram: one row, the same in both, so a reader finds a number in one place. */
function GeometryTable({ g }: { g: GeometryRow }) {
  const t = useT();
  const num = useNum();
  const gripped = g.nip <= g.limit;
  return (
    <div className="cdem-tablewrap">
      <table className="caos-table" data-state="ready">
        <thead>
          <tr>
            <th>{t('Closed-side setting (mm)', 'Abertura de descarga (mm)')}</th>
            <th>{t('Throw (mm)', 'Carrera (mm)')}</th>
            <th>{t('Open-side setting (mm)', 'Abertura del lado abierto (mm)')}</th>
            <th>{t('Nip angle (deg)', 'Ángulo de nip (grados)')}</th>
            <th>{t('Grip limit (deg)', 'Límite de agarre (grados)')}</th>
            <th className="caos-col-text">{t('Reading', 'Lectura')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{num(g.css, { digits: 4 })}</td>
            <td>{num(g.throwMm, { digits: 4 })}</td>
            <td>{num(g.oss, { digits: 4 })}</td>
            <td>{num(g.nip, { decimals: 1 })}</td>
            <td>{num(g.limit, { decimals: 1 })}</td>
            <td className="caos-col-text">{gripped ? t('Gripped and crushed', 'Agarra y tritura') : t('Squeezed upward', 'Escupida hacia arriba')}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** The cone and gyratory slice: the fixed concave, the gyrating mantle, the closed-side setting at the discharge and the open-side outline. */
function RevolutionSlice({ op, width, height }: { op: Operating; width: number; height: number }) {
  const lang = useShellLang();
  const num = useNum();
  const prof = chamberProfile(op.machine, op.cssMm, op.throwMm);
  const { concave, mantle } = profilePolylines(prof, 40);
  const P = prof.P;
  const padX = 8;
  const padY = 10;
  const rMax = Math.max(...concave.map((c) => c[0])) * 1.04;
  const zMin = -P.overlap;
  const zRange = P.zTop - zMin;
  const s = Math.min((width - 2 * padX) / (2 * rMax), (height - 2 * padY) / zRange);
  const cx = width / 2;
  const sx = (r: number) => r * s;
  const sy = (z: number) => height - padY - (z - zMin) * s;
  const right = (pts: [number, number][]) => pts.map(([r, z]) => `${cx + sx(r)},${sy(z)}`);
  const left = (pts: [number, number][]) => [...pts].reverse().map(([r, z]) => `${cx - sx(r)},${sy(z)}`);
  const bowl = `M${right(concave).join(' L')} L${left(concave).join(' L')} Z`;
  const hasMantle = mantle.length >= 2;
  const body = hasMantle ? `M${right(mantle).join(' L')} L${left(mantle).join(' L')} Z` : '';
  const shifted = hasMantle ? `M${mantle.map(([r, z]) => `${cx + sx(r) + sx(op.throwMm) / 2},${sy(z)}`).join(' L')}` : '';
  const zGap = 6;
  const rc = prof.rConcave(zGap);
  const rm = prof.rMantleClosed(zGap);
  const yGap = sy(zGap);
  const L = new Labels(width, height);
  const names = {
    mantle: lang === 'es' ? 'manto' : 'mantle',
    concave: lang === 'es' ? 'cóncavo' : 'concave',
    lip: lang === 'es' ? 'labio del cóncavo' : 'concave lip',
  };
  const labels = [
    L.place(`CSS ${num(op.cssMm, { digits: 4 })} mm`, cx + sx(rc) + 12, yGap - 4, 'start', { fill: TOKEN.warn, weight: 700 }),
    L.place(`OSS ${num(op.cssMm + op.throwMm, { digits: 4 })} mm`, cx - sx(rc) - 12, yGap - 4, 'end', { fill: TOKEN.faint }),
    L.place(names.mantle, cx, sy(P.zTop * 0.55), 'middle', { fill: TOKEN.good, weight: 600 }),
    L.place(names.concave, cx + sx(prof.rConcave(P.zTop * 0.85)) - 6, sy(P.zTop * 0.85), 'end', { fill: TOKEN.subtle }),
    L.place(names.lip, padX, sy(0) - 5, 'start', { fill: TOKEN.faint }),
  ];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={lang === 'es' ? 'Corte de la cámara de chancado' : 'Cross-section of the crushing chamber'} data-chart="chamber-slice">
      <path d={bowl} fill={TOKEN.subtleSoft} stroke={TOKEN.subtle} strokeWidth={2.5} />
      {hasMantle && <path d={body} fill={TOKEN.goodSoft} stroke={TOKEN.good} strokeWidth={2.5} />}
      <line x1={cx - sx(rc) - 8} y1={sy(0)} x2={cx + sx(rc) + 8} y2={sy(0)} stroke={TOKEN.subtle} strokeWidth={1} strokeDasharray="5 4" />
      {hasMantle && <path d={shifted} fill="none" stroke={TOKEN.good} strokeWidth={1.2} strokeDasharray="4 3" opacity={0.7} />}
      <line x1={cx + sx(rm)} y1={yGap} x2={cx + sx(rc)} y2={yGap} stroke={TOKEN.warn} strokeWidth={2.5} />
      <line x1={cx - sx(rm)} y1={yGap} x2={cx - sx(rc)} y2={yGap} stroke={TOKEN.faint} strokeWidth={2} strokeDasharray="3 2" />
      <LabelText items={labels} />
    </svg>
  );
}

/** The jaw slice: a fixed plate and a swing plate that close on a V, drawn closed (solid) and open (dashed). */
function JawSlice({ op, width, height }: { op: Operating; width: number; height: number }) {
  const lang = useShellLang();
  const num = useNum();
  const j = jawProfile(op.machine, op.cssMm, op.throwMm);
  const zTop = j.P.zTop;
  const padX = 12;
  const padY = 12;
  const xLeft = j.xSwing(zTop, 1);
  const xRight = j.xFixed(zTop);
  const span = Math.abs(xRight - xLeft) || 1;
  const s = Math.min((width - 2 * padX) / span, (height - 2 * padY) / zTop);
  const x0 = (width - span * s) / 2;
  const sx = (x: number) => x0 + (x - xLeft) * s;
  const sy = (z: number) => height - padY - z * s;
  const n = 40;
  const fixed: string[] = [];
  const closed: string[] = [];
  const open: string[] = [];
  for (let i = 0; i <= n; i++) {
    const z = (i / n) * zTop;
    fixed.push(`${sx(j.xFixed(z))},${sy(z)}`);
    closed.push(`${sx(j.xSwing(z, 0))},${sy(z)}`);
    open.push(`${sx(j.xSwing(z, 1))},${sy(z)}`);
  }
  const wedge = `M${fixed.join(' L')} L${[...closed].reverse().join(' L')} Z`;
  const yDischarge = sy(2);
  const yTop = sy(zTop - 2);
  const L = new Labels(width, height);
  const names = {
    fixed: lang === 'es' ? 'placa fija' : 'fixed jaw',
    swing: lang === 'es' ? 'placa móvil' : 'swing jaw',
    eccentric: lang === 'es' ? 'excéntrica' : 'eccentric',
    gape: lang === 'es' ? 'boca' : 'gape',
  };
  const labels = [
    L.place(`CSS ${num(op.cssMm, { digits: 4 })} mm`, (sx(j.xSwing(0, 0)) + sx(j.xFixed(0))) / 2, yDischarge - 8, 'middle', { fill: TOKEN.warn, weight: 700 }),
    L.place(`OSS ${num(op.cssMm + op.throwMm, { digits: 4 })} mm`, (sx(j.xSwing(0, 1)) + sx(j.xFixed(0))) / 2, yDischarge - 24, 'middle', { fill: TOKEN.faint }),
    L.place(`${names.gape} ${num(j.gapeMm, { digits: 3 })} mm`, (sx(j.xSwing(zTop, 0)) + sx(j.xFixed(zTop))) / 2, yTop + 18, 'middle', { fill: TOKEN.faint }),
    L.place(names.eccentric, sx(j.xSwing(zTop, 0)), yTop - 10, 'middle', { fill: TOKEN.warn }),
    L.place(names.fixed, sx(j.xFixed(zTop * 0.5)) + 10, sy(zTop * 0.5), 'start', { fill: TOKEN.subtle }),
    L.place(names.swing, sx(j.xSwing(zTop * 0.5, 0)) - 10, sy(zTop * 0.5), 'end', { fill: TOKEN.good }),
  ];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={lang === 'es' ? 'Mecanismo de la chancadora de mandíbula' : 'Jaw crusher mechanism'} data-chart="chamber-slice">
      <path d={wedge} fill={TOKEN.goodSoft} stroke="none" />
      <polyline points={fixed.join(' ')} fill="none" stroke={TOKEN.subtle} strokeWidth={6} strokeLinecap="round" />
      <polyline points={open.join(' ')} fill="none" stroke={TOKEN.good} strokeWidth={2} strokeDasharray="5 4" opacity={0.7} />
      <polyline points={closed.join(' ')} fill="none" stroke={TOKEN.good} strokeWidth={6} strokeLinecap="round" />
      <circle cx={sx(j.xSwing(zTop, 0))} cy={yTop} r={6} fill="none" stroke={TOKEN.warn} strokeWidth={2} />
      <line x1={sx(j.xSwing(0, 0))} y1={yDischarge} x2={sx(j.xFixed(0))} y2={yDischarge} stroke={TOKEN.warn} strokeWidth={2.5} />
      <line x1={sx(j.xSwing(0, 1))} y1={yDischarge + 4} x2={sx(j.xFixed(0))} y2={yDischarge + 4} stroke={TOKEN.faint} strokeWidth={2} strokeDasharray="3 2" />
      <LabelText items={labels} />
    </svg>
  );
}

/** The wedge between the mantle and the concave with a particle in it, and the nip angle against the grip limit. */
function NipWedge({ nip, limit, width, height }: { nip: number; limit: number; width: number; height: number }) {
  const lang = useShellLang();
  const num = useNum();
  const gripped = nip <= limit;
  const half = (Math.min(Math.max(nip, 1), 80) / 2) * (Math.PI / 180);
  const cx = width / 2;
  const base = height - 18;
  const len = Math.max(40, Math.min(height - 40, width / (2 * Math.sin(half) + 0.4)));
  const lx = cx - Math.sin(half) * len;
  const rx = cx + Math.sin(half) * len;
  const ty = base - Math.cos(half) * len;
  const pr = Math.max(8, Math.min(24, len * 0.12));
  const py = base - len * 0.52;
  const arc = Math.max(18, len * 0.22);
  const tone = gripped ? TOKEN.good : TOKEN.bad;
  const dir = gripped ? 1 : -1;
  const L = new Labels(width, height);
  const labels = [
    L.place(`${num(nip, { decimals: 1 })}°`, cx, base - arc - 6, 'middle', { fill: TOKEN.warn, weight: 700 }),
    L.place(lang === 'es' ? 'cóncavo' : 'concave', lx, ty - 6, 'end', { fill: TOKEN.subtle }),
    L.place(lang === 'es' ? 'manto' : 'mantle', rx, ty - 6, 'start', { fill: TOKEN.good }),
  ];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={lang === 'es' ? 'Ángulo de nip entre el manto y el cóncavo' : 'Nip angle between the mantle and the concave'} data-chart="nip-wedge">
      <line x1={cx} y1={base} x2={lx} y2={ty} stroke={TOKEN.subtle} strokeWidth={3} />
      <line x1={cx} y1={base} x2={rx} y2={ty} stroke={TOKEN.good} strokeWidth={3} />
      <circle cx={cx} cy={py} r={pr} fill={gripped ? TOKEN.goodSoft : TOKEN.badSoft} stroke={tone} strokeWidth={2} />
      <path d={`M${cx - arc * Math.sin(half)},${base - arc * Math.cos(half)} A${arc},${arc} 0 0 0 ${cx + arc * Math.sin(half)},${base - arc * Math.cos(half)}`} fill="none" stroke={TOKEN.warn} strokeWidth={2} />
      <line x1={cx} y1={py} x2={cx} y2={py + dir * (pr + 14)} stroke={tone} strokeWidth={2} />
      <polygon points={`${cx - 5},${py + dir * (pr + 8)} ${cx + 5},${py + dir * (pr + 8)} ${cx},${py + dir * (pr + 16)}`} fill={tone} />
      <LabelText items={labels} />
    </svg>
  );
}

function SliceView() {
  const { sel } = useView();
  const stateKey = useWorkbenchState()?.stateKey;
  if (!sel) return <Pending />;
  const r = sel.result;
  const g: GeometryRow = { css: sel.op.cssMm, throwMm: sel.op.throwMm, oss: r.ossMm, nip: r.nipAngleDeg, limit: r.nipLimitDeg };
  const isRevolution = machineGeom(sel.op.machine).isRevolution;
  return (
    <PlotCard fill title={{ en: 'Chamber cross-section', es: 'Corte de la cámara' }} lane="live" provenance="synthetic" dataKey={stateKey} note={STRUCTURE_NOTE}>
      <Stack>
        <GeometryTable g={g} />
        <Fill>
          <Stage label={{ en: 'Chamber cross-section', es: 'Corte de la cámara' }}>
            {({ width, height }) => (isRevolution ? <RevolutionSlice op={sel.op} width={width} height={height} /> : <JawSlice op={sel.op} width={width} height={height} />)}
          </Stage>
        </Fill>
      </Stack>
    </PlotCard>
  );
}

function NipView() {
  const { sel } = useView();
  const stateKey = useWorkbenchState()?.stateKey;
  if (!sel) return <Pending />;
  const r = sel.result;
  const g: GeometryRow = { css: sel.op.cssMm, throwMm: sel.op.throwMm, oss: r.ossMm, nip: r.nipAngleDeg, limit: r.nipLimitDeg };
  return (
    <PlotCard
      fill
      title={{ en: 'Nip angle against the grip limit', es: 'Ángulo de nip contra el límite de agarre' }}
      lane="live"
      provenance="synthetic"
      dataKey={stateKey}
      note={{
        en: 'A particle is gripped when the nip angle is at most 2 arctan(mu), with mu about 0.35; above it the particle is squeezed upward. The wedge is drawn at the engine’s nip angle.',
        es: 'Una partícula es agarrada cuando el ángulo de nip es como máximo 2 arctan(mu), con mu cercano a 0,35; sobre ese límite la partícula es escupida hacia arriba. La cuña se dibuja con el ángulo de nip del motor.',
      }}
    >
      <Stack>
        <GeometryTable g={g} />
        <Fill>
          <Stage label={{ en: 'Nip wedge', es: 'Cuña de nip' }}>{({ width, height }) => <NipWedge nip={r.nipAngleDeg} limit={r.nipLimitDeg} width={width} height={height} />}</Stage>
        </Fill>
      </Stack>
    </PlotCard>
  );
}

export function ChamberGroup() {
  const tabs: Sub[] = [
    { id: 'slice', label: { en: 'Section', es: 'Corte' }, content: <SliceView /> },
    { id: 'nip', label: { en: 'Nip angle', es: 'Ángulo de nip' }, content: <NipView /> },
  ];
  return <GroupFrame group="chamber" ariaLabel={{ en: 'Chamber views', es: 'Vistas de la cámara' }} tabs={tabs} />;
}
