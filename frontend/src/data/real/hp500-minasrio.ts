// "Real sample" lane data: 10 industrial surveys of a Metso HP500 secondary cone crusher at the Minas Rio
// operation (Anglo American), crushing itabirite iron ore. This is the genuine measured artifact the Faena
// "real artifacts processed live" Source selector picks from: the user chooses which survey, and the exact same
// pure-TypeScript engine runs on the survey's measured closed-side setting (CSS) and feed 80%-passing size (f80).
//
// Source (open access, CC BY 4.0 -- transcribed verbatim from the paper text):
//   Rocha, B.K.N.d.; Campos, T.M.; Silva, J.; Tavares, L.M.
//   "Fit-for-Purpose Model of HP500 Cone Crusher in Size Reduction of Itabirite Iron Ore."
//   Minerals 2024, 14(9), 919. DOI 10.3390/min14090919.
//   Per-survey operating table = Table A1; the model calibrated to these very surveys = Table 5;
//   ore drop-weight A,b and Bond Wi = Table 1.
//
// Honesty caveats (see the app badges + methodology):
//   1. The full feed/product particle-size-distribution curves are published as figures only (Figs 5/6), not as
//      a table. The feed here is therefore reconstructed from the measured f80 with a Rosin-Rammler band
//      (see x63FromF80 below), not read off a tabulated curve.
//   2. The power (kW) is the paper's estimate from measured electric current, not a calibrated dynamometer.
//
// This artifact is a secondary cone, so every survey is fixed to machine "cone-sec". Jaw / gyratory / tertiary /
// short-head stay synthetic (no equally clean open per-survey table was found for those).

/** Provenance of the real artifact, surfaced in-panel on every real view (Faena honesty rule). */
export const HP500_SOURCE = {
  paper: 'Rocha, Campos, Silva & Tavares 2024',
  doi: '10.3390/min14090919',
  license: 'CC BY 4.0',
  plant: 'Minas Rio (Anglo American)',
  machineModel: 'Metso HP500',
  ore: 'Itabirite (Compact + Supercompact blend)',
  /** Short one-line citation for in-panel display. */
  cite: 'Rocha et al., Minerals 2024, 14, 919 (CC BY), HP500, Minas Rio.',
} as const;

/** Drop-weight ore competence bands for the itabirite blend (Table 1). A*b is the standard single-number
 *  hardness index (higher = softer). Bond work index Wi in kWh/t. The plant crushes a blend of the two. */
export const HP500_ORE = {
  compact: { A: 64.5, b: 10.5, axb: 677.3, wiKwhT: 7.2 },
  supercompact: { A: 56.1, b: 2.2, axb: 123.4, wiKwhT: 10.6 },
  /** Representative blend Wi used for the modeled Bond power parity readout. */
  blendWiKwhT: 9.0,
} as const;

/** One industrial survey: the measured operating point of the HP500 secondary cone. */
export interface RealSurvey {
  id: string;                // "HP500-01" .. "HP500-10"
  n: number;                 // survey index 1..10 (as published)
  machine: 'cone-sec';       // fixed: this artifact is a secondary cone
  measured: {
    cssMm: number;           // closed-side setting [mm]           (measured, Table A1)
    f80Mm: number;           // feed 80%-passing size [mm]         (measured, Table A1)
    feedRateTph: number;     // solid feed rate [t/h]              (measured, Table A1)
    powerKW: number;         // crusher power [kW] (current-based) (measured*, Table A1)
  };
}

// Table A1, transcribed verbatim (survey | f80 mm | CSS mm | feed t/h | power kW).
const RAW: Array<[number, number, number, number, number]> = [
  [1, 88, 54, 1639, 209],
  [2, 84, 54, 1267, 212],
  [3, 47, 48, 1240, 262],
  [4, 88, 48, 1034, 349],
  [5, 62, 48, 1124, 325],
  [6, 79, 40, 813, 355],
  [7, 140, 38, 1050, 306],
  [8, 123, 44, 1138, 325],
  [9, 81, 40, 820, 350],
  [10, 81, 55, 1334, 187],
];

export const HP500_SURVEYS: RealSurvey[] = RAW.map(([n, f80, css, tph, kW]) => ({
  id: `HP500-${String(n).padStart(2, '0')}`,
  n,
  machine: 'cone-sec',
  measured: { cssMm: css, f80Mm: f80, feedRateTph: tph, powerKW: kW },
}));

/** HP500 nominal geometry / running point held fixed on the Real lane (the surveys vary only CSS and f80; the
 *  eccentric throw and speed are machine constants, not published per survey). Throw is a representative mid of
 *  the HP500 range; speed is the cone-sec capacity optimum so the modeled capacity curve peaks at the point. */
export const HP500_NOMINAL = { throwMm: 34, speedRpm: 360 } as const;

/** Reconstruct the Rosin-Rammler characteristic size x63 (63.2%-passing) from the measured f80.
 *  From R(x)=1-exp[-(x/x63)^m]: at x=f80, R=0.8 => (f80/x63)^m = ln(5) => x63 = f80 / ln(5)^(1/m).
 *  m = 0.9 is a run-of-mine uniformity typical of crushed itabirite feed (documented assumption, caveat 1). */
export function x63FromF80(f80Mm: number, m = 0.9): number {
  return f80Mm / Math.pow(Math.log(5), 1 / m);
}
