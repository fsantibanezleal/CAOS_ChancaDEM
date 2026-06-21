// CONTRACT 2 mirror (frontend side). MUST stay in lock-step with the Python schemas in
// data-pipeline/chancalab/core/{trace.py, manifest.py}. A drift here makes `tsc` fail -> the contract is enforced at
// BUILD time (the web cannot ship reading a shape the pipeline does not produce).

// ---------- per-case replay trace (chancadem.trace/v1) ----------

export interface CaseResult {
  p80: number;
  p50: number;
  p20: number;
  pctPassing: Record<string, number>; // {1,4,8,16,32}
  tph: number;
  kW: number;
  reduction: number;
  ecs: number;
  regime: string;
  valid: boolean;
}

export interface OperatingPoint {
  machine: string;
  cssMm: number;
  throwMm: number;
  speedRpm: number;
  feedX63Mm: number;
  feedM: number;
  oreAxb: number;
  oreWi: number;
}

export interface SurrogateAccuracy {
  p80: { r2: number; mape_pct: number } | null;
  tph: { r2: number; mape_pct: number } | null;
  kW: { r2: number; mape_pct: number } | null;
  p80MonotoneVsCss: boolean | null;
}

export interface CaseTrace {
  schema: string; // "chancadem.trace/v1"
  case_id: string;
  category: string;
  stage: string;
  control: string | null;
  real_or_synthetic: string;
  expected_band: string;
  operating: OperatingPoint;
  result: CaseResult;
  surrogate: SurrogateAccuracy;
}

// ---------- manifest (chancadem.manifest/v2) + index ----------

export interface ArtifactRef { path: string; format: string; trace_schema: string; bytes: number; }

export interface GateVerdict {
  lane: string;
  client_side: boolean;
  runtimes: string[];
  trace_bytes: number;
  run_ms_budget: number;
  trace_bytes_budget: number;
  reasons: string[];
}

export interface SharedArtifacts {
  models: Array<{ id: string; file: string; opset: number; input: number[] }>;
  scaler: string;
  ae_scaler: string;
  ae_threshold: string;
  surrogate_metrics: string;
}

export interface CaseManifest {
  schema: string; // "chancadem.manifest/v2"
  case_id: string;
  name: string;
  category: string;
  stage: string;
  control: string | null;
  machine: string;
  real_or_synthetic: string;
  expected_band: string;
  validation_anchor: string;
  engine: { package: string; version: string; model: string };
  seed: number;
  shared: SharedArtifacts;
  artifact: ArtifactRef;
  lane: 'live' | 'precompute';
  gate: GateVerdict;
  flags: Array<Record<string, unknown>>;
  metrics: Record<string, number>;
  honesty: string;
}

export interface CaseIndexEntry { case_id: string; category: string; stage: string; manifest_path: string; }

export interface CaseIndex {
  schema: string; // "chancadem.index/v1"
  engine_version: string;
  n_cases: number;
  cases: CaseIndexEntry[];
}
