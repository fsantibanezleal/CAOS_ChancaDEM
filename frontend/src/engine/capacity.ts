// Capacity, power and nip geometry, the scalar performance envelope.
//
// Capacity (Evertsson flow model, reduced form): throughput is unimodal in eccentric speed. At low speed the
// chamber discharges slowly; past an optimum the gyrating head obstructs free-fall faster than gravity can
// clear material, so capacity falls, the well-known capacity hump. We use Q = Q_ref · openFactor · s·e^{1−s}
// with s = speed/speed_opt (peaks at s=1), openFactor ∝ effective discharge opening (CSS + throw/2). This is a
// reduced parametric form of Evertsson (2000) "Cone Crusher Performance"; absolute numbers are illustrative
// per-machine references, not a specific plant's curve.
//
// Power (Bond 1952): W = 10·Wi·(1/√P80 − 1/√F80) [kWh/t] with sizes in micrometres; draw [kW] = W · Q [t/h].
// Morrell's size-specific energy (Mic) is documented on /methodology as the SOTA alternative.

import type { Machine } from './types';

interface CapModel { qRef: number; speedOpt: number; refGapMm: number; }

// per-machine reference capacity [t/h], optimal eccentric speed [rpm], reference discharge gap [mm].
const CAP: Record<Machine, CapModel> = {
  'cone-short-head': { qRef: 200, speedOpt: 480, refGapMm: 12 }, // tertiary short-head: finer, faster, smaller gap
  'gyratory':        { qRef: 4500, speedOpt: 150, refGapMm: 175 }, // primary gyratory: very high t/h, slow gyration, OSS-set
  'cone-sec':  { qRef: 520, speedOpt: 360, refGapMm: 38 },
  'cone-tert': { qRef: 240, speedOpt: 400, refGapMm: 16 },
  'jaw':       { qRef: 700, speedOpt: 300, refGapMm: 110 },
};

// HP500 secondary cone calibrated capacity base (Rocha et al. 2024, Table 4): the throughput model is anchored at
// QT ≈ 647 t/h so the modeled curve sits within the measured 813-1639 t/h band of the 10 surveys, instead of the
// ~3x-low synthetic cone-sec reference (qRef 520). Used only on the Real-sample lane.
const HP500_QREF = 647;

/** Throughput [t/h] from machine + CSS + throw + speed. Unimodal in speed (the capacity hump). On the Real lane
 *  (calibrated, cone-sec) the base is the HP500-anchored QT so the curve overlays the measured survey points. */
export function throughput(machine: Machine, cssMm: number, throwMm: number, speedRpm: number, calibrated = false): number {
  const m = CAP[machine];
  const qRef = calibrated && machine === 'cone-sec' ? HP500_QREF : m.qRef;
  const openFactor = (cssMm + throwMm / 2) / m.refGapMm;
  const s = speedRpm / m.speedOpt;
  const hump = s * Math.exp(1 - s);             // peaks at s=1 → value 1
  return Math.max(0, qRef * openFactor * hump);
}

/** HP500 current-based power model (Rocha et al. 2024, Table 5): Pc = ζ·Pd + Pn with ζ = 1.30 and no-load
 *  Pn = 110 kW, where Pd is the Bond net comminution draw. Returns the modeled crusher power [kW] for the
 *  measured-vs-model parity readout on the Real lane. */
export function calibratedPower(bondPdKw: number): number {
  return 1.3 * bondPdKw + 110;
}

/** The speed [rpm] that maximizes throughput for a machine (the hump apex), used to mark the operating point. */
export function optimalSpeed(machine: Machine): number {
  return CAP[machine].speedOpt;
}

/** Bond power draw [kW] from throughput and F80/P80 [mm]. */
export function bondPower(tph: number, f80Mm: number, p80Mm: number, wi: number): number {
  const f80um = f80Mm * 1000, p80um = p80Mm * 1000;
  if (p80um <= 0 || f80um <= 0) return 0;
  const w = 10 * wi * (1 / Math.sqrt(p80um) - 1 / Math.sqrt(f80um));   // kWh/t
  return Math.max(0, w * tph);
}

/** Nip angle [deg] (the wedge between mantle and concave), rises modestly with a wider setting. Illustrative
 *  geometry within published ranges (cone ~22–28°, jaw ~18–26°). */
export function nipAngle(machine: Machine, cssMm: number): number {
  const base = machine === 'jaw' ? 19 : 22;
  const m = CAP[machine];
  return base + 6 * (cssMm / m.refGapMm - 1) * 0.5;
}

/** Grip limit 2·atan(µ) [deg]: a particle is nipped (not squeezed up and out) iff nip ≤ this. µ ≈ 0.35. */
export function nipLimit(mu = 0.35): number {
  return (2 * Math.atan(mu) * 180) / Math.PI;
}
