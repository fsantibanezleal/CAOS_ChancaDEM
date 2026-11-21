// The web side of the ChancaDEM contracts (docs/contracts/catalog.md): the case documents (case-index, case-manifest, trace),
// the HP500 documents (hp500-backbone, hp500-loo), the two model slots (surrogate-model, anomaly-model), the model metrics, the
// particle-simulation document (dem-run) and the readiness document. The types of the first three and of readiness are GENERATED: contract.gen.ts comes from
// docs/contracts/api.openapi.json, whose components are the schema files of docs/contracts/schemas/ (ADR-0080 decision 2;
// `npm run contracts:types`, checked by `npm run build`), and the names below are aliases of the generated types. The
// OpenAPI document serves only those four documents, so the other five have no generated type: their types are inferred
// from the run-time descriptors below (`Of<K>`), which is the one place their shape is written on this side. Each
// descriptor describes the keys of a document at run time, and `satisfies` ties the generated documents' descriptors to
// their generated type (a key added to or removed from a schema and not here fails `tsc`). contract.test.ts reads the
// committed bake and the provider tree against the descriptors in both directions, types included, so the pipeline
// cannot ship a shape the web does not read, and the web cannot read a key the pipeline does not write (T11).
import type { components } from './contract.gen';

type Schemas = components['schemas'];

/** Every reader-facing string is bilingual at the source. */
export type Text = Schemas['text'];

export type Trace = Schemas['Trace'];
export type TraceSummary = Trace['summary'];
export type CaseManifest = Schemas['CaseManifest'];
export type ArtifactRef = CaseManifest['artifact'];
export type GateVerdict = CaseManifest['gate'];
export type CaseParams = CaseManifest['params'];
export type CaseMeasured = NonNullable<CaseManifest['measured']>;
export type CaseSource = CaseManifest['source'];
export type CaseIndex = Schemas['CaseIndex'];
export type CaseIndexEntry = CaseIndex['cases'][number];
export type Readiness = Schemas['Readiness'];
export type ReadinessEntry = Readiness['contracts'][number];

/** The declared state of a catalog row (docs/contracts/catalog.md, Missing-data states). */
export type ContractState = ReadinessEntry['state'];

/** What served a catalog row in this build; null when nothing did. */
export type Provenance = NonNullable<ReadinessEntry['provenance']>;

/** The 503 body (state missing, with the reason) and the 404 body of the API (catalog row api). */
export type UnavailableBody = Schemas['UnavailableBody'];
export type NotFoundBody = Schemas['NotFoundBody'];

export const SCHEMAS = {
  trace: 'chancadem.trace/v1',
  manifest: 'chancadem.manifest/v1',
  index: 'chancadem.index/v1',
  readiness: 'chancadem.readiness/v1',
  backbone: 'chancadem.hp500.backbone/v1',
  loo: 'chancadem.hp500.loo/v1',
  crusherbayes: 'chancadem.hp500.crusherbayes/v1',
  comparison: 'chancadem.hp500.comparison/v1',
  surrogate: 'chancadem.surrogate/v1',
  anomaly: 'chancadem.anomaly/v1',
  metrics: 'chancadem.model-metrics/v1',
  demRun: 'chancadem.dem.run/v1',
} as const satisfies {
  trace: Trace['schema'];
  manifest: CaseManifest['schema'];
  index: CaseIndex['schema'];
  readiness: Readiness['schema'];
  backbone: string;
  loo: string;
  crusherbayes: string;
  comparison: string;
  surrogate: Schemas['SurrogateModel']['schema'];
  anomaly: string;
  metrics: string;
  demRun: string;
};

/**
 * A run-time description of a value: a primitive, a bilingual text, an array of a kind, a fixed tuple, an object, a map,
 * a value of a closed set of strings, a kind that may also be null (an optional bound, an absent reference) or one of
 * several kinds (a union). An object member may be `{ optional: kind }`: the key may be absent, and when present it
 * conforms to the kind.
 */
export type Kind =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'text'
  | { readonly array: Kind }
  | { readonly tuple: readonly Kind[] }
  | { readonly object: Readonly<Record<string, Member>> }
  | { readonly map: Kind }
  | { readonly enum: readonly string[] }
  | { readonly nullable: Kind }
  | { readonly union: readonly Kind[] };

/** An object member: a kind, or a kind whose key may be absent. */
export type Member = Kind | { readonly optional: Kind };

type ObjectOf<O> = { [P in keyof O as O[P] extends { optional: unknown } ? never : P]: Of<O[P]> } & {
  [P in keyof O as O[P] extends { optional: unknown } ? P : never]?: O[P] extends { optional: infer X } ? Of<X> : never;
};

/** The TypeScript type of the values a descriptor accepts. */
export type Of<K> = K extends 'string'
  ? string
  : K extends 'number' | 'integer'
    ? number
    : K extends 'boolean'
      ? boolean
      : K extends 'text'
        ? Text
        : K extends { readonly array: infer A }
          ? Of<A>[]
          : K extends { readonly tuple: infer T extends readonly unknown[] }
            ? { -readonly [I in keyof T]: Of<T[I]> }
            : K extends { readonly map: infer M }
              ? Record<string, Of<M>>
              : K extends { readonly enum: readonly (infer E)[] }
                ? E
                : K extends { readonly nullable: infer N }
                  ? Of<N> | null
                  : K extends { readonly union: readonly (infer U)[] }
                    ? Of<U>
                    : K extends { readonly object: infer O }
                      ? ObjectOf<O>
                      : never;

const MACHINES = ['cone-sec', 'cone-tert', 'cone-short-head', 'gyratory', 'jaw'] as const;
const REGIMES = ['choke', 'trickle', 'pass-through', 'invalid'] as const;
export const FLAG_CODES = [
  'css_ge_feed_top',
  'pass_through',
  'negligible_reduction',
  'ill_conditioned',
  'css_nonpositive',
  'feed_nonpositive',
  'f80_lt_css',
  'css_outside_calibrated',
  'f80_outside_calibrated',
  'css_below_vendor_minimum',
  'reduction_ratio_above_typical',
] as const;
export type FlagCode = (typeof FLAG_CODES)[number];

const SERIES = { array: 'number' } as const;

export const TRACE_SUMMARY = {
  f80_mm: 'number',
  p80_mm: 'number',
  p50_mm: 'number',
  p20_mm: 'number',
  reduction_ratio: 'number',
  pct_passing: { map: 'number' },
  throughput_tph: 'number',
  power_kw: 'number',
  specific_energy_kwh_t: 'number',
  oss_mm: 'number',
  nip_angle_deg: 'number',
  nip_limit_deg: 'number',
  regime: { enum: REGIMES },
  valid: 'boolean',
  out_of_envelope: 'boolean',
  implausible: 'boolean',
  mass_closure: 'number',
  cond_estimate: { union: ['number', { enum: ['Infinity'] }] },
} as const satisfies Record<keyof TraceSummary, Kind>;

export const TRACE = {
  schema: 'string',
  case_id: 'string',
  sieve_mm: SERIES,
  mid_mm: SERIES,
  feed_passing: SERIES,
  product_passing: SERIES,
  feed_mass: SERIES,
  product_mass: SERIES,
  classification: SERIES,
  appearance_t10: 'number',
  summary: { object: TRACE_SUMMARY },
  speed_sweep: { object: { speed_rpm: SERIES, throughput_tph: SERIES, power_kw: SERIES } },
  css_sweep: { object: { css_mm: SERIES, p80_mm: SERIES, throughput_tph: SERIES, power_kw: SERIES } },
} as const satisfies Record<keyof Trace, Kind>;

export const MANIFEST_PARAMS = {
  machine: { enum: MACHINES },
  css_mm: 'number',
  throw_mm: 'number',
  speed_rpm: 'number',
  feed_x63_mm: 'number',
  feed_m: 'number',
  ore_axb: 'number',
  ore_wi: 'number',
  calibrated: 'boolean',
} as const satisfies Record<keyof CaseParams, Kind>;

export const MANIFEST = {
  schema: 'string',
  case_id: 'string',
  title: 'text',
  category: 'text',
  stage: { enum: ['primary', 'secondary', 'tertiary', 'control'] },
  control: { nullable: { enum: ['negative', 'invalid', 'calibration'] } },
  real_or_synthetic: { enum: ['real', 'synthetic'] },
  expected_band: 'text',
  context: { object: { problem: 'text', variables: 'text', reading: 'text' } },
  engine: { object: { package: 'string', version: 'string', model: 'string' } },
  params: { object: MANIFEST_PARAMS },
  measured: { optional: { object: { survey: 'integer', f80_mm: 'number', css_mm: 'number', feed_tph: 'number', power_kw: 'number' } } },
  seed: 'integer',
  artifact: { object: { path: 'string', format: { enum: ['json'] }, trace_schema: 'string', bytes: 'integer', sha256: 'string' } },
  lane: { enum: ['live', 'precompute'] },
  gate: {
    object: {
      lane: { enum: ['live', 'precompute'] },
      pure_python: 'boolean',
      wheels: { array: 'string' },
      trace_bytes: 'integer',
      run_ms_budget: 'number',
      trace_bytes_budget: 'integer',
      reasons: { array: 'string' },
    },
  },
  flags: { array: { enum: FLAG_CODES } },
  metrics: { map: 'number' },
  models: { map: { enum: ['real', 'baseline'] } },
  expect: { map: { tuple: ['number', 'number'] } },
  source: {
    union: [
      { object: { kind: { enum: ['authored'] } } },
      { object: { kind: { enum: ['publication'] }, citation: 'string', doi: 'string', license: { enum: ['CC BY 4.0'] } } },
    ],
  },
} as const satisfies Record<keyof CaseManifest, Member>;

export const INDEX = {
  schema: 'string',
  engine_version: 'string',
  n_cases: 'integer',
  default_case: 'string',
  cases: {
    array: {
      object: {
        case_id: 'string',
        title: 'text',
        category: 'text',
        real_or_synthetic: { enum: ['real', 'synthetic'] },
        manifest_path: 'string',
      },
    },
  },
  files: { array: 'string' },
} as const satisfies Record<keyof CaseIndex, Kind>;

/** The 503 body of the API: the state and the bilingual reason. */
export const UNAVAILABLE = { detail: { object: { state: { enum: ['missing'] }, reason: 'text' } } } as const satisfies Record<keyof UnavailableBody, Kind>;

const STATES = ['available', 'partial', 'stale', 'provider', 'training', 'missing'] as const;

export const READINESS = {
  schema: 'string',
  product_version: 'string',
  catalog_sha256: 'string',
  contracts: {
    array: {
      object: {
        id: 'string',
        version: 'string',
        status: { enum: ['real', 'active'] },
        provenance: { nullable: { enum: ['real', 'stub', 'simulator', 'fixture', 'baseline'] } },
        state: { enum: STATES },
        reason: { nullable: 'text' },
        missing: { array: 'string' },
      },
    },
  },
} as const satisfies Record<keyof Readiness, Kind>;

const SOURCE = { object: { paper: 'string', doi: 'string', license: 'string', table: 'string' } } as const;

/** hp500-backbone: the calibrated engine on each of the ten HP500 surveys. */
export const HP500_BACKBONE = {
  schema: 'string',
  source: SOURCE,
  engine_version: 'string',
  note: 'string',
  n: 'integer',
  surveys: {
    array: {
      object: {
        id: 'string',
        n: 'integer',
        measured: { object: { css_mm: 'number', f80_mm: 'number', feed_tph: 'number', power_kw: 'number' } },
        backbone: {
          object: { p80_mm: 'number', throughput_tph: 'number', bond_power_kw: 'number', calibrated_power_kw: 'number', f80_model_mm: 'number' },
        },
      },
    },
  },
} as const satisfies Record<string, Kind>;
export type Hp500Backbone = Of<{ readonly object: typeof HP500_BACKBONE }>;

const SCORES = { object: { mape_pct: 'number', rmse: 'number', r2: 'number', maxdev_pct: 'number' } } as const;
const RANGE = { tuple: ['number', 'number'] } as const;
const UQ = { object: { sigma: 'number', band_halfwidth: 'number', nominal_coverage: 'number', empirical_coverage: 'number', band_rel_pct: 'number', note: 'string', nested_coverage: { optional: 'number' }, nested_covered: { optional: { array: 'boolean' } }, nested_sigma: { optional: SERIES }, nested_note: { optional: 'string' } } } as const;
const FOLDS = {
  M0_backbone: SCORES,
  M1_residual: SCORES,
  M2_freeform: SCORES,
  constant_mean: SCORES,
  M1_label_shuffle: SCORES,
  pred: { object: { M0: SERIES, M1: SERIES, M2: SERIES, B_lin: { optional: SERIES }, Morrell: { optional: SERIES }, Morrell_noload: { optional: SERIES } } },
  // from hp500-loo 1.2.0, all optional: the setting-only line (throughput and power) and Morrell's two variants (power only)
  B_lin: { optional: SCORES },
  Morrell: { optional: SCORES },
  Morrell_noload: { optional: SCORES },
  morrell_fit: {
    optional: {
      object: { m_ic_kwh_t: SERIES, m_ic_noload_kwh_t: SERIES, no_load_kw: SERIES, noload_variant_m_ic_positive: { array: 'boolean' } },
    },
  },
} as const;
const LOO_TARGET = {
  target: { enum: ['tph', 'kW', 'p80'] },
  measured: SERIES,
  strict: { object: { ...FOLDS, uq: UQ } },
  leaky: { object: { ...FOLDS, uq: { optional: UQ } } },
} as const;

/** hp500-loo: CrusherCal, the leave-one-survey-out validation with its controls and predictive bands. */
export const HP500_LOO = {
  schema: 'string',
  source: SOURCE,
  engine_version: 'string',
  n: 'integer',
  seed: 'integer',
  config: {
    object: {
      resid_clip_frac: 'number',
      ridge_lambda: 'number',
      features: { array: 'string' },
      targets_primary: { array: { enum: ['tph', 'kW'] } },
      target_secondary: { array: { enum: ['p80'] } },
      morrell: { optional: { object: { k_s: 'number', k2: 'number', circuit: { enum: ['closed', 'open'] }, inputs: 'string', fitted: 'string' } } },
    },
  },
  loo: { object: { tph: { object: LOO_TARGET }, kW: { object: LOO_TARGET }, p80: { object: LOO_TARGET } } },
  power_parity: {
    object: {
      note: 'string',
      bond_pd_range_kw: RANGE,
      measured_range_kw: RANGE,
      bare_bond: SCORES,
      engine_pc_1p30_110: SCORES,
      refit_pc: { object: { mape_pct: 'number', rmse: 'number', r2: 'number', maxdev_pct: 'number', zeta: 'number', pn: 'number' } },
      constant_mean: SCORES,
      per_survey: { array: { object: { n: 'integer', css: 'number', measured: 'number', bare_bond: 'number', engine_pc: 'number', refit_pc: 'number' } } },
    },
  },
  tph_parity: {
    object: {
      note: 'string',
      backbone: SCORES,
      per_survey: { array: { object: { n: 'integer', css: 'number', measured: 'number', backbone: 'number' } } },
    },
  },
} as const satisfies Record<string, Kind>;
export type Hp500Loo = Of<{ readonly object: typeof HP500_LOO }>;

const CB_SCORES = { object: { mape_pct: 'number', rmse: 'number', lpd_mean: 'number', coverage_80: 'number', mean_width: 'number' } } as const;
const CB_TARGET = { object: { measured: SERIES, pred_mean: SERIES, lo80: SERIES, hi80: SERIES, scores: CB_SCORES } } as const;
const CB_COMPARATORS = { object: { M0: CB_SCORES, B_lin: CB_SCORES, M2: CB_SCORES } } as const;
const PER_TARGET = <K extends Kind>(kind: K) => ({ object: { tph: kind, kW: kind } }) as const;

/** hp500-crusherbayes: CrusherBayes, the Bayesian calibration of the engine's scalars with a structural discrepancy, held out on the ten surveys. */
export const HP500_CRUSHERBAYES = {
  schema: 'string',
  source: SOURCE,
  engine_version: 'string',
  n: 'integer',
  seed: 'integer',
  inputs_sha256: 'string',
  method: {
    object: {
      sampler: 'string',
      sampler_version: 'string',
      move: 'string',
      walkers: 'integer',
      steps: 'integer',
      burn_in_steps: 'integer',
      thin: 'integer',
      predictive_draws_per_sample: 'integer',
      likelihood: 'string',
      discrepancy_prior_sd: PER_TARGET('number'),
      noise_prior: { object: { family: 'string', median: PER_TARGET('number'), log_sd: 'number' } },
      p80: 'string',
      interval_80: 'string',
    },
  },
  priors: { array: { object: { name: 'string', unit: 'string', nominal: 'number', log: 'boolean', mu: 'number', sd: 'number', lo: 'number', hi: 'number', source: 'string' } } },
  convergence: {
    object: {
      criterion: 'string',
      tau_factor: 'integer',
      folds: {
        array: {
          object: {
            fold: { union: ['integer', { enum: ['all'] }] },
            converged: 'boolean',
            tau_max: 'number',
            post_burn_steps: 'integer',
            chain_over_tau: 'number',
            acceptance_fraction: 'number',
            samples: 'integer',
          },
        },
      },
      all_converged: 'boolean',
    },
  },
  loo: PER_TARGET(CB_TARGET),
  comparators: PER_TARGET(CB_COMPARATORS),
  comparators_note: 'string',
  contraction: { array: { object: { name: 'string', unit: 'string', nominal: 'number', prior_sd: 'number', posterior_mean: 'number', posterior_sd: 'number', contraction: 'number' } } },
  contraction_note: 'string',
  kill_criterion: {
    object: {
      rule: 'string',
      margin_mape_pts: 'number',
      coverage_band: { tuple: ['number', 'number'] },
      power_mape_pct: 'number',
      power_mape_blin_pct: 'number',
      power_gain_over_blin_pts: 'number',
      a_power_beats_blin_by_margin: 'boolean',
      tph_mape_pct: 'number',
      tph_mape_m0_pct: 'number',
      tph_gain_over_m0_pts: 'number',
      a_tph_beats_m0_by_margin: 'boolean',
      a_holds: 'boolean',
      coverage: PER_TARGET('number'),
      coverage_outside_band: PER_TARGET('boolean'),
      mean_width: PER_TARGET('number'),
      mean_width_crushercal: PER_TARGET('number'),
      band_wider_than_crushercal: PER_TARGET('boolean'),
      b_holds: 'boolean',
      verdict: { enum: ['kept', 'dropped as a predictor'] },
    },
  },
} as const satisfies Record<string, Kind>;
export type Hp500CrusherBayes = Of<{ readonly object: typeof HP500_CRUSHERBAYES }>;

const CMP_INPUT = { object: { path: 'string', schema: 'string', engine_version: 'string' } } as const;
const CMP_TARGET = {
  object: {
    measured: SERIES,
    methods: { array: { object: { id: 'string', control: 'boolean', mape_pct: 'number', ape_pct: { nullable: SERIES } } } },
    recommended: 'string',
    runner_up: 'string',
    paired: { array: { object: { method: 'string', against: 'string', mean_diff_pts: 'number', ci95: { tuple: ['number', 'number'] }, wins: 'integer', p_better: 'number' } } },
  },
} as const;

/** hp500-comparison: the paired comparison of the held-out methods, per target, against the recommended one (the manuscript's bootstrap). */
export const HP500_COMPARISON = {
  schema: 'string',
  source: SOURCE,
  engine_version: 'string',
  n: 'integer',
  bootstrap: { object: { method: 'string', resamples: 'integer', seed: 'integer', quantiles: { tuple: ['number', 'number'] } } },
  inputs: { object: { loo: CMP_INPUT, crusherbayes: { nullable: CMP_INPUT } } },
  crusherbayes: { object: { included: 'boolean', note: { nullable: 'text' } } },
  targets: PER_TARGET(CMP_TARGET),
} as const satisfies Record<string, Kind>;
export type Hp500Comparison = Of<{ readonly object: typeof HP500_COMPARISON }>;

/** The training range of a continuous input, [low, high], and the ranges of every continuous input of every machine (training.input_ranges of both model contracts). */
const BOUNDS = { tuple: ['number', 'number'] } as const;
const MACHINE_RANGES = { object: { css_mm: BOUNDS, throw_mm: BOUNDS, speed_rpm: BOUNDS, feed_x63_mm: BOUNDS, feed_m: BOUNDS, ore_axb: BOUNDS } } as const;
const INPUT_RANGES = {
  object: { 'cone-sec': MACHINE_RANGES, 'cone-tert': MACHINE_RANGES, jaw: MACHINE_RANGES, 'cone-short-head': MACHINE_RANGES, gyratory: MACHINE_RANGES },
} as const;

const GRAPH = (output: string) => ({ object: { path: 'string', bytes: 'integer', sha256: 'string', opset: 'integer', input: { enum: ['x'] }, output: { enum: [output] } } }) as const;

/** surrogate-model: the inference contract of the surrogate MLP (input, output, scaling and graphs). */
export const SURROGATE_MODEL = {
  schema: 'string',
  engine_version: 'string',
  machine_order: { array: { enum: MACHINES } },
  input_order: { array: { enum: ['css_mm', 'throw_mm', 'speed_rpm', 'feed_x63_mm', 'feed_m', 'ore_axb'] } },
  in_mean: SERIES,
  in_std: SERIES,
  output_order: {
    array: { enum: ['p80_mm', 'p50_mm', 'p20_mm', 'pass_1', 'pass_4', 'pass_8', 'pass_16', 'pass_32', 'throughput_tph', 'power_kw'] },
  },
  out_log: { array: 'boolean' },
  out_mean: SERIES,
  out_std: SERIES,
  graphs: { object: { float32: GRAPH('y'), int8: GRAPH('y') } },
  architecture: 'string',
  training: { object: { seed: 'integer', n_train: 'integer', n_test: 'integer', sampler: 'string', input_ranges: INPUT_RANGES, torch_version: 'string', export_parity_max_abs: { optional: 'number' } } },
} as const satisfies Record<string, Kind>;
export type SurrogateModel = Of<{ readonly object: typeof SURROGATE_MODEL }>;

/** anomaly-model: the inference contract of the denoising autoencoder (features, scaling, threshold and graph). */
export const ANOMALY_MODEL = {
  schema: 'string',
  engine_version: 'string',
  feature_order: {
    array: {
      enum: [
        'log10_p80_mm',
        'log10_p50_mm',
        'log10_p20_mm',
        'pass_1',
        'pass_4',
        'pass_8',
        'pass_16',
        'pass_32',
        'throughput_tph',
        'power_kw',
        'reduction_ratio',
        'log10_f80_mm',
        'specific_energy_kwh_t',
        'feed_m',
      ],
    },
  },
  mean: SERIES,
  std: SERIES,
  threshold_p99: 'number',
  train_recon_mean: 'number',
  graph: GRAPH('xr'),
  architecture: 'string',
  training: { object: { seed: 'integer', n_train: 'integer', noise_std: 'number', input_ranges: INPUT_RANGES, torch_version: 'string', export_parity_max_abs: { optional: 'number' } } },
} as const satisfies Record<string, Kind>;
export type AnomalyModel = Of<{ readonly object: typeof ANOMALY_MODEL }>;

const OUTPUT = { object: { r2: 'number', mape_pct: 'number', mape_pct_int8: 'number' } } as const;
const OUTPUT_NAMES = ['p80_mm', 'p50_mm', 'p20_mm', 'pass_1', 'pass_4', 'pass_8', 'pass_16', 'pass_32', 'throughput_tph', 'power_kw'] as const;

/** model-metrics: the held-out evaluation of the two model slots. */
export const MODEL_METRICS = {
  schema: 'string',
  engine_version: 'string',
  surrogate: {
    object: {
      n_train: 'integer',
      n_test: 'integer',
      test_seed: 'integer',
      per_output: { object: Object.fromEntries(OUTPUT_NAMES.map((k) => [k, OUTPUT])) as { readonly [K in (typeof OUTPUT_NAMES)[number]]: typeof OUTPUT } },
      p80_monotone_vs_css: 'boolean',
      parity: { object: { torch_vs_float32_max_abs: 'number', float32_vs_int8_max_abs: 'number' } },
      note: 'string',
    },
  },
  anomaly: {
    object: {
      n_heldout: 'integer',
      false_alarm_rate: 'number',
      n_planted: 'integer',
      detection_rate: 'number',
      envelope_false_alarm_rate: 'number',
      envelope_detection_rate: 'number',
      planted: 'string',
      note: 'string',
    },
  },
} as const satisfies Record<string, Kind>;
export type ModelMetrics = Of<{ readonly object: typeof MODEL_METRICS }>;

const NULLABLE_NUMBER = { nullable: 'number' } as const;
const SIEVE_CURVE = { object: { sieves_mm: { array: 'number' }, passing_pct: { array: NULLABLE_NUMBER } } } as const;
const DEM_VALUE_SOURCE = { object: { value: 'number', digitisation_noise: 'number', source: 'string' } } as const;
const DEM_PAPER_VALUE = { object: { value: 'number', source: 'string' } } as const;
const DEM_VERDICT = {
  object: {
    first: NULLABLE_NUMBER,
    second: NULLABLE_NUMBER,
    relative_error: NULLABLE_NUMBER,
    band: 'number',
    verdict: { enum: ['met', 'not met', 'not compared'] },
    basis: { nullable: { enum: ['run_incomplete', 'no_window', 'no_work_index', 'nothing_passed'] } },
    resolved: { nullable: 'boolean' },
    edge_distance_se: NULLABLE_NUMBER,
  },
} as const;
const DEM_VERDICT_SET = { object: { throughput: DEM_VERDICT, net_power: DEM_VERDICT, reduction_ratio: DEM_VERDICT } } as const;
const DEM_STATUS = { enum: ['complete', 'overlap_error', 'stalled', 'max_strokes', 'max_wall_time'] } as const;
const DEM_PAIR = { tuple: ['number', 'number'] } as const;
const DEM_ATTEMPT = {
  object: {
    max_overlap_fraction: 'number',
    status: DEM_STATUS,
    strokes: 'integer',
    stopped_during_stroke: { nullable: 'integer' },
    max_overlap_reached: 'number',
    held_spheres: 'integer',
    hold_up_kg: 'number',
    mass_passed_kg: 'number',
    peak_particles: 'integer',
    deferred_placements: 'integer',
  },
} as const;
const DEM_REPLAY = {
  object: {
    file: 'string',
    bytes: 'integer',
    sha256: 'string',
    first_stroke: 'integer',
    last_stroke: 'integer',
    frames_per_stroke: 'integer',
    frames: 'integer',
    spheres: 'integer',
    t_s: { array: 'number' },
    stroke: { array: 'integer' },
    plate_bottom_x_mm: { array: 'number' },
    plate_bottom_z_mm: { array: 'number' },
    count: { array: 'integer' },
    encoding: { object: { record: { enum: ['uint16le x, uint16le y, uint16le z, uint16le radius'] }, x_range_mm: DEM_PAIR, y_range_mm: DEM_PAIR, z_range_mm: DEM_PAIR, radius_max_mm: 'number' } },
    geometry: {
      object: {
        fixed_plate_x_mm: 'number',
        fixed_plate_z_mm: DEM_PAIR,
        swing_pivot_mm: DEM_PAIR,
        swing_closed_bottom_mm: DEM_PAIR,
        discharge_z_mm: 'number',
        hopper_height_mm: 'number',
        width_mm: 'number',
      },
    },
  },
} as const;
const DEM_SIMULATION = {
  object: {
    status: DEM_STATUS,
    error: { nullable: 'string' },
    attempts: { array: DEM_ATTEMPT },
    capacity_slots: 'integer',
    strokes: 'integer',
    steps: 'integer',
    time_step_s: 'number',
    simulated_s: 'number',
    mass_fed_kg: 'number',
    mass_passed_kg: 'number',
    held_spheres: 'integer',
    hold_up_kg: 'number',
    pending_kg: 'number',
    window: { nullable: { object: { first_stroke: 'integer', last_stroke: 'integer', strokes: 'integer' } } },
    throughput_kg_h: NULLABLE_NUMBER,
    throughput_se_kg_h: NULLABLE_NUMBER,
    throughput_whole_run_kg_h: NULLABLE_NUMBER,
    net_power_kw: NULLABLE_NUMBER,
    net_power_se_kw: NULLABLE_NUMBER,
    net_power_whole_run_kw: NULLABLE_NUMBER,
    power_trend_stationary: { nullable: 'boolean' },
    specific_energy_j_kg: NULLABLE_NUMBER,
    specific_energy_kwh_t: NULLABLE_NUMBER,
    product: { nullable: SIEVE_CURVE },
    p80_mm: NULLABLE_NUMBER,
    p50_mm: NULLABLE_NUMBER,
    reduction_ratio: NULLABLE_NUMBER,
    fines_below_minimum_pct: NULLABLE_NUMBER,
    largest_product_mm: NULLABLE_NUMBER,
    spheres_above_open_side: { nullable: 'integer' },
    breakage: { object: { events: 'integer', progeny: 'integer', peak_particles: 'integer', deferred_placements: 'integer', injected_energy_j: 'number', absorbed_energy_j: 'number' } },
    mass_balance_residual_kg: 'number',
    window_strokes_above_overlap_reference: { nullable: 'integer' },
    series: {
      object: {
        stroke: { array: 'integer' },
        t_s: { array: 'number' },
        plate_power_w: { array: 'number' },
        passed_kg: { array: 'number' },
        held: { array: 'integer' },
        hold_up_kg: { array: 'number' },
        pending_kg: { array: 'number' },
        max_overlap: { array: 'number' },
      },
    },
    replay: { nullable: DEM_REPLAY },
  },
} as const;
const DEM_POPULATION_BALANCE = {
  object: {
    classification: { object: { k1_mm: 'number', k2_mm: 'number', k3: 'number' } },
    e50_j_kg: 'number',
    ore_axb: 'number',
    specific_energy_kwh_t: 'number',
    t10_pct: 'number',
    capacity: {
      object: {
        depth_m: 'number',
        critical_speed_rpm: 'number',
        regime: { enum: ['below_critical_speed', 'at_or_above_critical_speed'] },
        volumetric_m3_h: 'number',
        feed_factor: 'number',
        throw_factor: 'number',
        material_factor: 'number',
        density_t_m3: 'number',
      },
    },
    throughput_kg_h: 'number',
    f80_mm: 'number',
    p80_mm: 'number',
    p50_mm: 'number',
    reduction_ratio: 'number',
    product: SIEVE_CURVE,
    band: { object: { p80_mm: DEM_PAIR, p50_mm: DEM_PAIR, reduction_ratio: DEM_PAIR, passing_low_pct: { array: 'number' }, passing_high_pct: { array: 'number' } } },
    bond_kwh_t_per_wi: 'number',
    implied_work_index_kwh_t: 'number',
    mass_closure: 'number',
    flags: { array: 'string' },
  },
} as const;
const DEM_MEASURED = {
  object: {
    throughput_kg_h: DEM_VALUE_SOURCE,
    net_power_kw: DEM_VALUE_SOURCE,
    specific_energy_j_kg: 'number',
    specific_energy_kwh_t: 'number',
    product: { object: { sieves_mm: { array: 'number' }, passing_pct: { array: NULLABLE_NUMBER } } },
    product_source: 'string',
    product_noise_pct: 'number',
    p80_mm: 'number',
    p50_mm: 'number',
    reduction_ratio: 'number',
    bond_kwh_t_per_wi: 'number',
    implied_work_index_kwh_t: 'number',
  },
} as const;
const DEM_POINT_IDS = ['63-52', '31.5-26.5', '16-13.2'] as const;

/** dem-run: the discrete element method with particle-replacement breakage on the laboratory jaw crusher at three operating points, beside the measurement and the population balance, with nine verdicts per point and a replay of particle frames per point. */
export const DEM_RUN = {
  schema: { enum: ['chancadem.dem.run/v1'] },
  engine_version: 'string',
  machine: { object: { name: 'string', gape_mm: 'number', width_mm: 'number', throw_mm: 'number', source: 'string' } },
  source: { object: { paper: 'string', doi: 'string', license: 'string', digitised: 'string' } },
  package: { object: { name: { enum: ['crushdem'] }, version: 'string', backend: { enum: ['numba', 'numpy', 'warp'] } } },
  seed: 'integer',
  bands: { object: { throughput_relative: 'number', net_power_relative: 'number', reduction_ratio_relative: 'number', set: 'string' } },
  settings: {
    object: {
      css_mm: 'number',
      oss_mm: 'number',
      frequency_hz: 'number',
      speed_rpm: 'number',
      batch_kg: 'number',
      overlap_ladder: { array: 'number' },
      overlap_reference: 'number',
      stall_strokes: 'integer',
      max_strokes: 'integer',
      minimum_sphere_mm: 'number',
      sieves_mm: { array: 'number' },
    },
  },
  ore: {
    object: { name: 'string', density_kg_m3: 'number', e_inf_j_kg: 'number', d0_mm: 'number', phi: 'number', variance: 'number', gamma: 'number', a_max_percent: 'number', b_prime: 'number', derivation: 'string' },
  },
  preset: {
    object: {
      k1_over_css: 'number',
      k2: { enum: ['open-side setting'] },
      k3: 'number',
      first_estimate_source: 'string',
      k1_over_css_range: DEM_PAIR,
      k2_over_css_range: DEM_PAIR,
      k3_range: DEM_PAIR,
      ranges_source: 'string',
      capacity_model: 'string',
      material_factor: 'number',
      ore_link: 'string',
      power: 'string',
    },
  },
  state: { enum: ['available', 'partial'] },
  incomplete: { array: { enum: DEM_POINT_IDS } },
  points: {
    array: {
      object: {
        id: { enum: DEM_POINT_IDS },
        feed_class: { enum: ['63/52', '31.5/26.5', '16/13.2'] },
        feed_mm: DEM_PAIR,
        feed_mean_mm: 'number',
        feed_f80_mm: 'number',
        measured: DEM_MEASURED,
        paper_simulation: { nullable: { object: { net_power_kw: { nullable: DEM_PAPER_VALUE }, throughput_kg_h: { nullable: DEM_PAPER_VALUE } } } },
        simulation: DEM_SIMULATION,
        population_balance: DEM_POPULATION_BALANCE,
        verdicts: { object: { simulation_vs_measured: DEM_VERDICT_SET, population_balance_vs_measured: DEM_VERDICT_SET, population_balance_vs_simulation: DEM_VERDICT_SET } },
      },
    },
  },
} as const satisfies Record<string, Kind>;
export type DemRun = Of<{ readonly object: typeof DEM_RUN }>;

/** Every way `value` departs from `kind`, with its path; empty when it conforms. Booleans are not numbers. */
export function conform(value: unknown, kind: Kind, path = '$'): string[] {
  if (kind === 'string') return typeof value === 'string' ? [] : [`${path}: expected a string`];
  if (kind === 'number') return typeof value === 'number' && Number.isFinite(value) ? [] : [`${path}: expected a finite number`];
  if (kind === 'integer') return Number.isInteger(value) ? [] : [`${path}: expected an integer`];
  if (kind === 'boolean') return typeof value === 'boolean' ? [] : [`${path}: expected a boolean`];
  if (kind === 'text') return conform(value, { object: { en: 'string', es: 'string' } }, path);
  if ('enum' in kind) return typeof value === 'string' && kind.enum.includes(value) ? [] : [`${path}: expected one of ${kind.enum.join(', ')}`];
  if ('nullable' in kind) return value === null ? [] : conform(value, kind.nullable, path);
  if ('union' in kind) {
    const tries = kind.union.map((k) => conform(value, k, path));
    if (tries.some((t) => t.length === 0)) return [];
    const nearest = tries.reduce((a, b) => (b.length < a.length ? b : a));
    return [`${path}: matches none of ${kind.union.length} alternatives; nearest: ${nearest.join('; ')}`];
  }
  if ('array' in kind) {
    if (!Array.isArray(value)) return [`${path}: expected an array`];
    return value.flatMap((v, i) => conform(v, kind.array, `${path}[${i}]`));
  }
  if ('tuple' in kind) {
    if (!Array.isArray(value)) return [`${path}: expected an array`];
    if (value.length !== kind.tuple.length) return [`${path}: expected ${kind.tuple.length} values, found ${value.length}`];
    return kind.tuple.flatMap((k, i) => conform(value[i], k, `${path}[${i}]`));
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [`${path}: expected an object`];
  const obj = value as Record<string, unknown>;
  if ('map' in kind) return Object.entries(obj).flatMap(([k, v]) => conform(v, kind.map, `${path}.${k}`));
  const members = Object.entries(kind.object).map(([k, m]) => ({ key: k, optional: typeof m === 'object' && 'optional' in m, kind: (typeof m === 'object' && 'optional' in m ? m.optional : m) as Kind }));
  const want = members.map((m) => m.key);
  const out = [
    ...members.filter((m) => !m.optional && !(m.key in obj)).map((m) => `${path}.${m.key}: declared by the web, not written by the pipeline`),
    ...Object.keys(obj).filter((k) => !want.includes(k)).map((k) => `${path}.${k}: written by the pipeline, not declared by the web`),
  ];
  for (const m of members) if (m.key in obj) out.push(...conform(obj[m.key], m.kind, `${path}.${m.key}`));
  return out;
}
