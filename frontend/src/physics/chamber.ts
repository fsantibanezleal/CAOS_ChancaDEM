// Parametric crusher chamber geometry — REBUILT to real liner anatomy (crusher-correction-manifest §1).
// Prior build was wrong (a mining engineer flagged it): it ended both liners in the same lower zone and set the
// gap by a single radial subtraction, and the camera auto-rotated so the CONCAVE looked like it spun. Reality
// (cone/gyratory): the CONCAVE (bowl liner) is FIXED; the MANTLE (head) is a convex ogive whose base extends
// BELOW the concave lower lip and whose wall THICKENS DOWNWARD — exactly what lets you RAISE the mantle
// (hydroset) to close the setting. CSS = the true minimum gap over a gyration near the discharge, set by the
// mantle's vertical position (NOT a radial scale, NOT the tan-difference law). The jaw is a planar two-plate
// mechanism, NOT a surface of revolution. Lengths in mm. Qualitative-calibrated (manifest §1.3), never printed
// as measured liner angles.

import type { Machine } from './types';

export interface ChamberParams {
  zTop: number;        // chamber height (discharge z=0 → feed) [mm]
  zPz: number;         // top of the parallel zone [mm] (short for standard, LONG for short-head, ≈0 gyratory)
  zRed: number;        // top of the converging (reduction) zone; feed flare above
  rDis: number;        // concave radius at the discharge [mm]
  alphaC: number;      // concave half-angle from vertical in the converging zone [rad]
  alphaFlare: number;  // feed-flare half-angle (steeper opening) [rad]
  alphaM: number;      // mantle head half-angle [rad] (alphaM < alphaC ⇒ gap widens upward)
  overlap: number;     // how far the mantle base sits BELOW the concave discharge lip [mm]
  isRevolution: boolean; // false for jaw (planar mechanism)
}

// Per-machine params — calibrated to QUALITATIVE facts (manifest §1.3): standard = SHORT parallel zone;
// short-head (tertiary) = LONG parallel zone + smaller chamber + STEEPER head; gyratory = near-vertical concave,
// ~no parallel zone, tall, stacked rings; jaw = planar. Never printed as measured angles.
const GEOM: Record<Machine, ChamberParams> = {
  'cone-sec':        { zTop: 950, zPz: 110, zRed: 620, rDis: 360, alphaC: 0.27, alphaFlare: 0.72, alphaM: 0.12, overlap: 90, isRevolution: true },
  'cone-tert':       { zTop: 760, zPz: 230, zRed: 560, rDis: 300, alphaC: 0.30, alphaFlare: 0.70, alphaM: 0.18, overlap: 75, isRevolution: true },
  'cone-short-head': { zTop: 720, zPz: 330, zRed: 560, rDis: 290, alphaC: 0.30, alphaFlare: 0.66, alphaM: 0.23, overlap: 70, isRevolution: true },
  'gyratory':        { zTop: 1500, zPz: 30, zRed: 1150, rDis: 560, alphaC: 0.10, alphaFlare: 0.30, alphaM: 0.05, overlap: 150, isRevolution: true },
  'jaw':             { zTop: 1300, zPz: 0, zRed: 1000, rDis: 230, alphaC: 0.16, alphaFlare: 0.20, alphaM: 0, overlap: 0, isRevolution: false },
};

export interface ChamberProfile {
  machine: Machine; P: ChamberParams; cssMm: number; throwMm: number; isRevolution: boolean;
  rConcave: (z: number) => number;       // fixed bowl liner radius at height z
  rMantleClosed: (z: number) => number;  // mantle radius (closed azimuth) at height z
  cssActualMm: number;                   // true min gap over the discharge zone (engine-computed)
  ossMm: number;
}

/** CONCAVE: parallel zone → converging (αc) → feed flare (steeper). FIXED; does not move with CSS. */
function rConcaveAt(z: number, P: ChamberParams): number {
  if (z <= P.zPz) return P.rDis;
  if (z <= P.zRed) return P.rDis + (z - P.zPz) * Math.tan(P.alphaC);
  const rRed = P.rDis + (P.zRed - P.zPz) * Math.tan(P.alphaC);
  return rRed + (z - P.zRed) * Math.tan(P.alphaFlare);
}

/** MANTLE (convex ogive): base extends BELOW the concave (overlap); parallel-zone flank runs parallel to the
 *  concave so the gap there ≈ css; the crushing cone diverges upward (αc−αm). Wall thickens downward. */
function rMantleClosedAt(z: number, P: ChamberParams, css: number): number {
  if (z < -P.overlap) return 0;
  const zc = Math.max(0, z);
  if (z <= P.zPz) return Math.max(0, rConcaveAt(zc, P) - css);   // parallel zone: gap ≈ CSS
  const rPz = rConcaveAt(P.zPz, P) - css;
  return Math.max(0, rPz - (z - P.zPz) * Math.tan(Math.max(0.01, P.alphaC - P.alphaM)));
}

/** Build the profile for a machine + CSS + throw. */
export function chamberProfile(machine: Machine, cssMm: number, throwMm: number): ChamberProfile {
  const P = GEOM[machine];
  const rConcave = (z: number) => rConcaveAt(z, P);
  const rMantleClosed = (z: number) => rMantleClosedAt(z, P, cssMm);
  // true min perpendicular gap over the discharge zone (Metso HP CSS definition), not the tan-difference law
  let gmin = Infinity; const zHi = Math.max(P.zPz, P.zTop * 0.14);
  for (let z = 1; z <= zHi; z += 2) gmin = Math.min(gmin, rConcave(z) - rMantleClosed(z));
  return { machine, P, cssMm, throwMm, isRevolution: P.isRevolution, rConcave, rMantleClosed, cssActualMm: Math.max(0, gmin), ossMm: cssMm + throwMm };
}

/** Nip angle [deg] from the concave/mantle wall slopes near the discharge. */
export function chamberNipAngle(p: ChamberProfile): number {
  const z0 = p.P.zPz + 5, z1 = p.P.zPz + Math.max(60, p.P.zTop * 0.18);
  const dC = (p.rConcave(z1) - p.rConcave(z0)) / (z1 - z0);
  const dM = (p.rMantleClosed(z1) - p.rMantleClosed(z0)) / (z1 - z0);
  return Math.max(8, (Math.atan(Math.abs(dC - dM)) * 2 * 180) / Math.PI);
}

/** (r,z) polylines for drawing: concave (fixed, z∈[0,zTop]) and mantle (extends below z=0 by overlap). */
export function profilePolylines(p: ChamberProfile, n = 56): { concave: [number, number][]; mantle: [number, number][] } {
  const concave: [number, number][] = [], mantle: [number, number][] = [];
  for (let i = 0; i <= n; i++) { const z = (i / n) * p.P.zTop; concave.push([p.rConcave(z), z]); }
  const zBase = -p.P.overlap;
  for (let i = 0; i <= n; i++) {
    const z = zBase + (i / n) * (p.P.zTop - zBase);
    const r = p.rMantleClosed(z);
    if (r > 1) mantle.push([r, z]);
  }
  return { concave, mantle };
}

export function machineGeom(machine: Machine): ChamberParams { return GEOM[machine]; }

// ---------------------------------------------------------------------------------------------------------------
// JAW: a PLANAR two-plate mechanism (NOT a surface of revolution). A near-vertical FIXED jaw and an inclined
// SWING jaw form a V-shaped chamber that converges downward; feed enters at the wide GAPE (top) and the product
// exits at the CSS (bottom). Modern single-toggle / overhead-eccentric type: the swing motion is largest at the
// discharge and decays to ~0 at the suspension point near the top (Gauldie 1953; Wills & Finch, Mineral
// Processing Technology, ch. on crushers). The gap at the discharge oscillates between CSS (closed) and OSS =
// CSS+throw (open) once per revolution of the eccentric.
export interface JawProfile {
  machine: Machine; P: ChamberParams; cssMm: number; throwMm: number;
  gapeMm: number;                              // feed opening at the top [mm]
  xFixed: (z: number) => number;               // fixed-plate face x at height z (z: 0=discharge .. zTop=gape)
  xSwing: (z: number, openFrac: number) => number; // swing-plate face x; openFrac 0=closed(CSS) .. 1=open(OSS)
  nipDeg: number;                              // included angle between the two plates [deg]
}

/** Build the planar jaw geometry for a machine + CSS + throw. Fixed plate on the right (slight backward lean),
 *  swing plate to its left; chamber opening = CSS at z=0 widening to the gape at z=zTop. */
export function jawProfile(machine: Machine, cssMm: number, throwMm: number): JawProfile {
  const P = GEOM[machine];
  const nip = 0.38;            // ~22° included nip (jaw nip is typically 18–26°)
  const betaF = 0.06;          // fixed plate leans back slightly going up
  const xFixed = (z: number) => z * Math.tan(betaF);
  const xSwing = (z: number, openFrac: number) => {
    const gapClosed = cssMm + z * Math.tan(nip);          // closed-side opening at height z
    const open = throwMm * (1 - Math.min(1, z / P.zTop)); // throw: max at discharge, 0 at the top pivot
    return xFixed(z) - (gapClosed + open * openFrac);     // swing face sits to the LEFT of the fixed face
  };
  const gapeMm = cssMm + P.zTop * Math.tan(nip);
  const nipDeg = (nip + betaF) * 180 / Math.PI;
  return { machine, P, cssMm, throwMm, gapeMm, xFixed, xSwing, nipDeg };
}
