// Parametric chamber geometry — ONE source feeding the 3D view, the 2D axisymmetric slice and the nip diagram.
// A cone/gyratory chamber is two surfaces of revolution: the fixed concave r_cc(z) and the mantle r_m(z) whose
// axis NUTATES (gyrates about a fixed pivot) by the eccentric angle, so the gap at a given height oscillates
// between CSS (closed side) and OSS (open side) once per revolution. The jaw is a planar wedge with a swinging
// face. All lengths in mm. This geometry is illustrative-to-scale (didactic), not a vendor chamber drawing.

import type { Machine } from './types';

export interface ChamberProfile {
  zTop: number; zBot: number;          // chamber height span [mm] (z=0 at discharge, up to feed)
  rConcave: (z: number) => number;     // fixed concave radius at height z [mm]
  rMantleBase: (z: number) => number;  // mantle radius (closed side) at height z [mm]
  eccentricMm: number;                 // horizontal mantle excursion at the discharge (≈ throw) [mm]
  isJaw: boolean;
}

interface Geom { height: number; rTopConcave: number; rBotConcave: number; mantleInset: number; }
const GEOM: Record<Machine, Geom> = {
  'cone-sec':  { height: 900, rTopConcave: 700, rBotConcave: 360, mantleInset: 70 },
  'cone-tert': { height: 700, rTopConcave: 560, rBotConcave: 300, mantleInset: 55 },
  'jaw':       { height: 1300, rTopConcave: 700, rBotConcave: 230, mantleInset: 0 },
};

/** Build the chamber profile for a machine + setting. CSS sets the discharge gap; throw the eccentric excursion. */
export function chamberProfile(machine: Machine, cssMm: number, throwMm: number): ChamberProfile {
  const g = GEOM[machine];
  const isJaw = machine === 'jaw';
  // concave: linear taper from a wide feed opening down to the discharge
  const rConcave = (z: number) => {
    const t = (z - 0) / g.height;                 // 0 at discharge, 1 at top
    return g.rBotConcave + t * (g.rTopConcave - g.rBotConcave);
  };
  // mantle (closed side): sits one gap (CSS) inside the concave at the discharge, tapering up; the parallel
  // zone near the discharge keeps the gap ≈ CSS over a short height (the crushing/parallel zone).
  const rMantleBase = (z: number) => {
    const t = z / g.height;
    const gapTop = cssMm + 0.55 * (g.rTopConcave - g.rBotConcave);  // wider gap up top (feed opening)
    const gap = cssMm + t * (gapTop - cssMm);
    return Math.max(8, rConcave(z) - gap);
  };
  return { zTop: g.height, zBot: 0, rConcave, rMantleBase, eccentricMm: throwMm, isJaw };
}

/** Nip angle [deg] from the local chamber wall slopes near the discharge (the wedge between concave & mantle). */
export function chamberNipAngle(p: ChamberProfile): number {
  const z0 = p.zTop * 0.12, z1 = p.zTop * 0.32;
  const dConcave = (p.rConcave(z1) - p.rConcave(z0)) / (z1 - z0);
  const dMantle = (p.rMantleBase(z1) - p.rMantleBase(z0)) / (z1 - z0);
  // the gap-closing angle ≈ atan of the difference in wall slopes, doubled for the two-sided wedge
  const ang = Math.atan(Math.abs(dConcave - dMantle)) * 2;
  return (ang * 180) / Math.PI;
}

/** Polyline (r,z) samples of concave and mantle for 2D/3D drawing. n points bottom→top. */
export function profilePolylines(p: ChamberProfile, n = 40): { concave: [number, number][]; mantle: [number, number][] } {
  const concave: [number, number][] = [], mantle: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const z = p.zBot + (i / n) * (p.zTop - p.zBot);
    concave.push([p.rConcave(z), z]); mantle.push([p.rMantleBase(z), z]);
  }
  return { concave, mantle };
}
