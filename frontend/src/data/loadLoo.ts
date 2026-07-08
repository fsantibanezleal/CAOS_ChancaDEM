// Loader for the committed CrusherCal LOO traces (data/derived/hp500/{loo,backbone}.json, copied to public/data by
// copy-data.mjs). The frontend NEVER recomputes these numbers; it reads the offline-validated, deterministic
// artifact so the App, Benchmark and docs all quote exactly the same held-out results.

export interface StatBlock { mape_pct: number; rmse: number; r2: number; maxdev_pct: number }
export interface Uq {
  sigma: number; band_halfwidth: number; nominal_coverage: number;
  empirical_coverage: number; band_rel_pct: number; note: string;
}
export interface LooFold {
  M0_backbone: StatBlock; M1_residual: StatBlock; M2_freeform: StatBlock;
  constant_mean: StatBlock; M1_label_shuffle: StatBlock;
  pred: { M0: number[]; M1: number[]; M2: number[] };
  uq?: Uq;
}
export interface LooTarget { target: string; measured: number[]; strict: LooFold; leaky: LooFold }

export interface PowerParity {
  note: string;
  bond_pd_range_kw: [number, number];
  measured_range_kw: [number, number];
  bare_bond: StatBlock; engine_pc_1p30_110: StatBlock;
  refit_pc: StatBlock & { zeta: number; pn: number };
  constant_mean: StatBlock;
  per_survey: { n: number; css: number; measured: number; bare_bond: number; engine_pc: number; refit_pc: number }[];
}
export interface TphParity {
  note: string;
  backbone: StatBlock;
  per_survey: { n: number; css: number; measured: number; backbone: number }[];
}
export interface LooDoc {
  schema: string;
  source: { paper: string; doi: string; license: string; table?: string };
  n: number; seed: number;
  config: Record<string, unknown>;
  loo: { tph: LooTarget; kW: LooTarget; p80: LooTarget };
  power_parity: PowerParity;
  tph_parity: TphParity;
}

const base = () => (import.meta.env.BASE_URL || '/');
let cache: LooDoc | null = null;

export async function loadLoo(): Promise<LooDoc> {
  if (cache) return cache;
  const res = await fetch(`${base()}data/hp500/loo.json`);
  if (!res.ok) throw new Error(`loo.json ${res.status}`);
  cache = (await res.json()) as LooDoc;
  return cache;
}
