// ADR-0070 scenario focus view: one selected crusher, full page, nothing competing with the chamber.
//
// ADDITIVE. The App (Tool.tsx) keeps every tab and all its explanation; this route is a second way to look
// at the SAME machine through the SAME physics, for operating it rather than reading about it. It renders
// OUTSIDE <AppShell> on purpose: the shell header and footer are exactly the chrome a focus view exists to
// escape.
//
// Style per the ADR-0070 spec: fixed full-viewport two-column grid with the rail on the right; stage at
// least 80% of the viewport, edge to edge; the operating state NAMED on the stage in one plain sentence;
// KPIs overlaid as a HUD rather than stacked as cards; a visible return that lands back on the App.

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useShellLang } from '@fasl-work/caos-app-shell';
import { evaluate } from '../physics/engine';
import type { Machine, Operating } from '../physics/types';
import { Chamber3D } from '../viz/Chamber3D';
import { ChamberSlice } from '../viz/ChamberSlice';

const MACHINES: { id: Machine; en: string; es: string }[] = [
  { id: 'cone-sec', en: 'Cone · secondary', es: 'Cono · secundario' },
  { id: 'cone-tert', en: 'Cone · tertiary', es: 'Cono · terciario' },
  { id: 'cone-short-head', en: 'Short-head', es: 'Cabeza corta' },
  { id: 'gyratory', en: 'Gyratory', es: 'Giratorio' },
  { id: 'jaw', en: 'Jaw', es: 'Mandibula' },
];

/** A sensible starting point per machine. A focus view opens on a machine that is actually running, not
 *  on whatever the default happened to be for a different crusher class. */
const SEED: Record<Machine, Partial<Operating>> = {
  'cone-sec': { cssMm: 38, throwMm: 32, speedRpm: 700 },
  'cone-tert': { cssMm: 16, throwMm: 24, speedRpm: 850 },
  'cone-short-head': { cssMm: 10, throwMm: 18, speedRpm: 900 },
  gyratory: { cssMm: 165, throwMm: 44, speedRpm: 140 },
  jaw: { cssMm: 125, throwMm: 38, speedRpm: 250 },
};

/** What the reduction ratio MEANS, said on the stage. A user should be able to read the operating state
 *  off the visualization without leaving for a docs tab. */
function state(rr: number, es: boolean): { label: string; text: string } {
  if (rr < 2.5) {
    return {
      label: es ? 'Reduccion baja' : 'Light reduction',
      text: es
        ? 'La camara apenas reduce: el CSS esta abierto respecto al alimento, pasa material sin fracturar y se desperdicia capacidad de chancado.'
        : 'The chamber is barely reducing: the CSS is open relative to the feed, material passes without breaking and crushing capacity is wasted.',
    };
  }
  if (rr > 6) {
    return {
      label: es ? 'Reduccion forzada' : 'Forced reduction',
      text: es
        ? 'Se pide mas reduccion de la que una sola etapa entrega bien: sube la potencia por tonelada y el desgaste, y conviene una etapa adicional.'
        : 'More reduction is being asked than one stage delivers well: power per tonne and wear both rise, and a further stage is the better answer.',
    };
  }
  return {
    label: es ? 'Reduccion normal' : 'Normal reduction',
    text: es
      ? 'La razon de reduccion esta en el rango donde una etapa trabaja bien, con la potencia por tonelada en su zona util.'
      : 'The reduction ratio sits in the range where a single stage works well, with power per tonne in its useful band.',
  };
}

export default function Focus() {
  const { machineId } = useParams();
  const es = useShellLang() === 'es';
  const machine = (MACHINES.find((m) => m.id === machineId)?.id ?? MACHINES[0].id) as Machine;
  const meta = MACHINES.find((m) => m.id === machine)!;

  const [op, setOp] = useState<Operating>(() => ({
    machine, cssMm: 38, throwMm: 32, speedRpm: 700,
    feedX63Mm: 180, feedM: 1.1, oreAxb: 48, oreWi: 14,
    ...SEED[machine],
  } as Operating));
  const [view, setView] = useState<'3d' | 'slice'>('3d');

  // Selecting a different machine must actually change the machine: re-seed on route change, or the chips
  // move the URL and the title while the chamber stays exactly as it was.
  const seeded = useMemo(() => {
    const next = { ...op, machine, ...SEED[machine] } as Operating;
    return next;
  }, [machine]);
  const active = seeded.machine === op.machine ? op : seeded;

  const r = useMemo(() => evaluate(active), [active]);
  const st = state(r.reductionRatio, es);
  const set = (k: keyof Operating, v: number) => setOp({ ...active, [k]: v } as Operating);

  const hud = [
    { v: r.p80.toFixed(1), l: 'P80 mm', tone: 'accent' },
    { v: `${r.reductionRatio.toFixed(2)}x`, l: es ? 'reduccion' : 'reduction', tone: 'blue' },
    { v: r.throughputTph.toFixed(0), l: 't/h' },
    { v: r.powerKw.toFixed(0), l: 'kW' },
    { v: `${(r.powerKw / Math.max(1, r.throughputTph)).toFixed(2)}`, l: es ? 'kWh/t' : 'kWh/t' },
    { v: `${active.cssMm}`, l: 'CSS mm' },
  ];

  return (
    <div className="tzf">
      <div className="tzf-stage">
        {view === '3d'
          ? <Chamber3D op={active} p80={r.p80} f80={r.f80} height={0} />
          : <ChamberSlice op={active} />}

        <div className="tzf-badge">
          <div className="tzf-badge-t">{st.label}</div>
          <div className="tzf-badge-d">{st.text}</div>
        </div>

        <div className="tzf-hud">
          {hud.map((h) => (
            <div className="tzf-hud-item" key={h.l}>
              <div className={`tzf-hud-v${h.tone ? ' ' + h.tone : ''}`}>{h.v}</div>
              <div className="tzf-hud-l">{h.l}</div>
            </div>
          ))}
        </div>

        <Link className="tzf-exit" to="/">{es ? 'Volver a la app' : 'Back to the app'}</Link>
      </div>

      <aside className="tzf-rail">
        <div className="tzf-rail-h">
          <div>
            <div className="tzf-title">{es ? meta.es : meta.en}</div>
            <div className="tzf-sub">{machine}</div>
          </div>
        </div>

        <div className="tzf-seg">
          <button className={view === '3d' ? 'on' : ''} onClick={() => setView('3d')}>{es ? 'Camara 3D' : '3D chamber'}</button>
          <button className={view === 'slice' ? 'on' : ''} onClick={() => setView('slice')}>{es ? 'Corte + nip' : 'Slice + nip'}</button>
        </div>

        <label className="tzf-ctl">
          <span className="tzf-ctl-l">CSS<b>{active.cssMm} mm</b></span>
          <input type="range" min={4} max={260} step={1} value={active.cssMm}
                 onChange={(e) => set('cssMm', +e.target.value)} />
        </label>

        <label className="tzf-ctl">
          <span className="tzf-ctl-l">{es ? 'Carrera' : 'Throw'}<b>{active.throwMm} mm</b></span>
          <input type="range" min={8} max={50} step={1} value={active.throwMm}
                 onChange={(e) => set('throwMm', +e.target.value)} />
        </label>

        <label className="tzf-ctl">
          <span className="tzf-ctl-l">{es ? 'Velocidad' : 'Speed'}<b>{active.speedRpm} rpm</b></span>
          <input type="range" min={100} max={1100} step={10} value={active.speedRpm}
                 onChange={(e) => set('speedRpm', +e.target.value)} />
        </label>

        <label className="tzf-ctl">
          <span className="tzf-ctl-l">{es ? 'Alimento x63' : 'Feed x63'}<b>{active.feedX63Mm} mm</b></span>
          <input type="range" min={20} max={900} step={5} value={active.feedX63Mm}
                 onChange={(e) => set('feedX63Mm', +e.target.value)} />
        </label>

        <label className="tzf-ctl">
          <span className="tzf-ctl-l">{es ? 'Competencia A·b' : 'Competence A·b'}<b>{active.oreAxb}</b></span>
          <input type="range" min={20} max={120} step={1} value={active.oreAxb}
                 onChange={(e) => set('oreAxb', +e.target.value)} />
        </label>

        <div className="tzf-note">
          {es
            ? 'La razon de reduccion compara el f80 del alimento con el P80 del producto. El CSS fija la abertura minima y por lo tanto el techo del producto; la carrera y la velocidad fijan cuantas veces se golpea una roca antes de salir.'
            : 'The reduction ratio compares feed f80 against product P80. The CSS sets the closed-side opening and therefore the ceiling on product size; throw and speed set how many times a rock is struck before it leaves.'}
        </div>

        <div className="tzf-cases">
          {MACHINES.map((m) => (
            <Link key={m.id} to={`/focus/${m.id}`} className={m.id === machine ? 'on' : ''}>{m.id}</Link>
          ))}
        </div>
      </aside>
    </div>
  );
}
