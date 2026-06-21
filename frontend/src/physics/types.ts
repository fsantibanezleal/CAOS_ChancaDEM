// Domain types for the live crusher-physics engine. All physical quantities are SI-ish mining units:
// sizes in millimetres, throughput in tonnes/hour, power in kilowatts, specific energy in kWh/tonne.

export type Machine = 'cone-sec' | 'cone-tert' | 'cone-short-head' | 'gyratory' | 'jaw';

/** The operating point — exactly the sliders the studio exposes. */
export interface Operating {
  machine: Machine;
  cssMm: number;        // closed-side setting (narrowest gap) [mm]
  throwMm: number;      // eccentric throw = OSS − CSS [mm]
  speedRpm: number;     // eccentric / gyration speed [rev/min]
  feedX63Mm: number;    // Rosin–Rammler characteristic size of the feed (63.2% passing) [mm]
  feedM: number;        // Rosin–Rammler uniformity exponent of the feed [-]
  oreAxb: number;       // JKMRC drop-weight ore competence A·b [-] (lower = harder/tougher)
  oreWi: number;        // Bond work index [kWh/t]
}

/** Particle-size distribution on the engine's geometric sieve grid. */
export interface PSD {
  edgesMm: number[];     // K+1 sieve aperture edges, descending (coarse → fine) [mm]
  midMm: number[];       // K geometric class mid-sizes [mm]
  mass: number[];        // K normalized mass fraction per class (Σ = 1)
  passing: number[];     // K+1 cumulative % passing at each edge [0..1]
}

/** A complete evaluation of one operating point — what every view reads. */
export interface CrusherResult {
  op: Operating;
  feed: PSD;
  product: PSD;
  // gradation summary [mm]
  f80: number; p80: number; p50: number; p20: number;
  reductionRatio: number;            // F80 / P80
  pctPassing: Record<number, number>; // product % passing at {1,4,8,16,32} mm [0..1]
  // capacity + energy
  throughputTph: number;             // [t/h]
  powerKw: number;                   // [kW]
  specificEnergyKwhT: number;        // Ecs effectively applied [kWh/t]
  // geometry / regime
  ossMm: number;                     // open-side setting = CSS + throw [mm]
  nipAngleDeg: number;               // chamber nip angle [deg]
  nipLimitDeg: number;               // grip limit = 2·atan(µ) [deg]
  regime: Regime;
  // honesty: validity guard
  valid: boolean;
  flags: string[];                   // why a point is flagged invalid / extrapolating
  // numerical health of the Whiten solve
  massClosure: number;               // |Σproduct − Σfeed| (should be ~0)
  condEstimate: number;              // rough conditioning proxy of (I − B·C)
}

export type Regime = 'choke' | 'trickle' | 'pass-through' | 'invalid';

/** Classification (selection) parameters K1,K2,K3 for the Whiten model. */
export interface Classification { k1: number; k2: number; k3: number; }
