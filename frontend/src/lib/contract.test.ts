// T11: the committed artifacts against the web's declared contract, in both directions, types included. The same
// assertions run on two roots: the committed bake (data/derived, when it holds the product's own bake) and the provider
// tree (docs/contracts/fixtures/data/derived). They are the swap test and the consumer test of the catalog rows
// case-index, case-manifest, trace, hp500-backbone, hp500-loo, surrogate-model, anomaly-model and model-metrics, and
// the consumer side of readiness. A document the root must hold and does not is a failure naming its path, never a pass.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ANOMALY_MODEL,
  conform,
  FLAG_CODES,
  HP500_BACKBONE,
  HP500_LOO,
  INDEX,
  MANIFEST,
  MODEL_METRICS,
  READINESS,
  SCHEMAS,
  SURROGATE_MODEL,
  TRACE,
  TRACE_SUMMARY,
  UNAVAILABLE,
  type AnomalyModel,
  type CaseIndex,
  type CaseManifest,
  type Hp500Backbone,
  type Hp500Loo,
  type ModelMetrics,
  type Readiness,
  type SurrogateModel,
  type Trace,
} from './contract.types';

// the product version, read from VERSION like the build does, never written here
const VERSION = readFileSync(new URL('../../../VERSION', import.meta.url), 'utf8').trim();

const BAKE = new URL('../../../data/derived/', import.meta.url);
const PROVIDER = new URL('../../../docs/contracts/fixtures/data/derived/', import.meta.url);
const catalogUrl = new URL('../../../docs/contracts/catalog.md', import.meta.url);

/** The bake is checked once it is the product's own: until unit U3b-1 bakes it, data/derived still holds the template's example. */
function bakeState(): { run: boolean; why: string } {
  const index = new URL('manifests/index.json', BAKE);
  if (!existsSync(index)) return { run: false, why: 'data/derived/manifests/index.json is absent' };
  const schema = (JSON.parse(readFileSync(index, 'utf8')) as { schema?: string }).schema ?? '';
  return schema === SCHEMAS.index ? { run: true, why: '' } : { run: false, why: `data/derived still holds the template example bake (${schema})` };
}

const roots: Array<[string, URL, boolean, string]> = [
  ['data/derived (the bake)', BAKE, bakeState().run, bakeState().why],
  ['docs/contracts/fixtures/data/derived (the provider)', PROVIDER, true, ''],
];

/** The rows of the `## Contracts` table of the catalog, with their cells by header name. */
function catalogRows(): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  let inTable = false;
  let header: string[] = [];
  for (const line of readFileSync(catalogUrl, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      inTable = line.trim() === '## Contracts';
      continue;
    }
    if (!inTable || !line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells[0] === 'id') header = cells;
    else if (!/^-+$/.test(cells[0])) rows.push(Object.fromEntries(header.map((h, i) => [h, cells[i]])));
  }
  return rows;
}
const catalogIds = (): string[] => catalogRows().map((r) => r.id);
/** The model slots of the catalog: the rows whose `model io` cell is not `-`. */
const modelSlots = (): string[] => catalogRows().filter((r) => r['model io'] !== '-').map((r) => r.id);

function readFrom(root: URL, rel: string): unknown {
  const url = new URL(rel, root);
  if (!existsSync(url)) throw new Error(`missing committed document: ${fileURLToPath(url)}`);
  return JSON.parse(readFileSync(url, 'utf8'));
}

for (const [label, root, run, why] of roots) {
  describe(`CONTRACT 2: ${label} is exactly what the web declares`, () => {
    if (!run) {
      it.skip(`not checked: ${why}`, () => undefined);
      return;
    }
    const read = (rel: string): unknown => readFrom(root, rel);
    const index = read('manifests/index.json') as CaseIndex;

    it('the index conforms and names a baked default case', () => {
      expect(conform(index, { object: INDEX })).toEqual([]);
      expect(index.schema).toBe(SCHEMAS.index);
      expect(index.n_cases).toBe(index.cases.length);
      expect(index.cases.length).toBeGreaterThan(0);
      const ids = index.cases.map((c) => c.case_id);
      expect(ids).toContain(index.default_case);
      expect(ids).toEqual([...ids].sort());
    });

    it('the files the index declares exist, and name the HP500 documents and the model contracts and graphs', () => {
      for (const rel of index.files) expect(existsSync(new URL(rel, root)), rel).toBe(true);
      for (const rel of ['hp500/backbone.json', 'hp500/loo.json', 'models/surrogate.json', 'models/psd-ae.json']) expect(index.files, rel).toContain(rel);
    });

    for (const entry of index.cases) {
      it(`${entry.case_id}: manifest and trace conform`, () => {
        const m = read(entry.manifest_path) as CaseManifest;
        expect(conform(m, { object: MANIFEST })).toEqual([]);
        expect(m.schema).toBe(SCHEMAS.manifest);
        expect(m.case_id).toBe(entry.case_id);
        expect(m.real_or_synthetic).toBe(entry.real_or_synthetic);
        expect(m.lane).toBe(m.gate.lane);
        // models: only catalog model slots (a row with a model io cell), each real or baseline
        expect(Object.keys(m.models).length).toBeGreaterThan(0);
        for (const [slot, which] of Object.entries(m.models)) {
          expect(modelSlots()).toContain(slot);
          expect(['real', 'baseline']).toContain(which);
        }
        // a real case carries its survey and its publication; a synthetic one neither
        expect(m.measured !== undefined).toBe(m.real_or_synthetic === 'real');
        expect(m.source.kind).toBe(m.real_or_synthetic === 'real' ? 'publication' : 'authored');
        const t = read(m.artifact.path) as Trace;
        expect(conform(t, { object: TRACE })).toEqual([]);
        expect(t.schema).toBe(SCHEMAS.trace);
        expect(t.case_id).toBe(entry.case_id);
        expect(m.artifact.trace_schema).toBe(SCHEMAS.trace);
        // the sieve grid has one more edge than it has classes, every gradation has the grid's length
        expect(t.sieve_mm.length).toBe(t.mid_mm.length + 1);
        for (const k of ['feed_passing', 'product_passing'] as const) expect(t[k].length, k).toBe(t.sieve_mm.length);
        for (const k of ['feed_mass', 'product_mass', 'classification'] as const) expect(t[k].length, k).toBe(t.mid_mm.length);
        // each sweep's arrays have one length
        expect(new Set(Object.values(t.speed_sweep).map((a) => a.length)).size).toBe(1);
        expect(new Set(Object.values(t.css_sweep).map((a) => a.length)).size).toBe(1);
        // the artifact bytes are the size of the file
        expect(readFileSync(new URL(m.artifact.path, root)).length).toBe(m.artifact.bytes);
        // the bake enforces the expected ranges; the committed metrics must lie inside them, and the summary equals the metrics
        for (const [metric, [lo, hi]] of Object.entries(m.expect)) {
          expect(m.metrics[metric]).toBeGreaterThanOrEqual(lo - 0.005);
          expect(m.metrics[metric]).toBeLessThanOrEqual(hi + 0.005);
        }
        // every flag is a code the web maps to bilingual text
        for (const f of m.flags) expect(FLAG_CODES).toContain(f);
      });
    }

    it('the HP500 documents conform, ten surveys each, and agree with the real cases', () => {
      const b = read('hp500/backbone.json') as Hp500Backbone;
      const l = read('hp500/loo.json') as Hp500Loo;
      expect(conform(b, { object: HP500_BACKBONE })).toEqual([]);
      expect(conform(l, { object: HP500_LOO })).toEqual([]);
      expect(b.schema).toBe(SCHEMAS.backbone);
      expect(l.schema).toBe(SCHEMAS.loo);
      expect(b.surveys.length).toBe(b.n);
      expect(b.surveys.map((s) => s.n)).toEqual(b.surveys.map((_, i) => i + 1));
      for (const k of ['tph', 'kW', 'p80'] as const) expect(l.loo[k].measured.length, k).toBe(l.n);
      // the band the gauges draw is a half-width of the strict folds: positive for a held-out target
      expect(l.loo.tph.strict.uq.band_halfwidth).toBeGreaterThanOrEqual(0);
      expect(l.loo.kW.strict.uq.band_halfwidth).toBeGreaterThanOrEqual(0);
    });

    it('the model contracts conform and name graphs that exist with the bytes they declare', () => {
      const s = read('models/surrogate.json') as SurrogateModel;
      const a = read('models/psd-ae.json') as AnomalyModel;
      expect(conform(s, { object: SURROGATE_MODEL })).toEqual([]);
      expect(conform(a, { object: ANOMALY_MODEL })).toEqual([]);
      expect(s.schema).toBe(SCHEMAS.surrogate);
      expect(a.schema).toBe(SCHEMAS.anomaly);
      expect(s.in_mean.length).toBe(s.input_order.length);
      expect(s.in_std.length).toBe(s.input_order.length);
      for (const k of ['out_log', 'out_mean', 'out_std'] as const) expect(s[k].length, k).toBe(s.output_order.length);
      expect(a.mean.length).toBe(a.feature_order.length);
      expect(a.std.length).toBe(a.feature_order.length);
      for (const g of [s.graphs.float32, s.graphs.int8, a.graph]) expect(readFileSync(new URL(g.path, root)).length, g.path).toBe(g.bytes);
    });

    // The provider tree of unit U3a does not hold model-metrics.json although the catalog row names it, and its index does not
    // declare it: the site then says the metrics are not available yet. A root whose index declares it is checked in full.
    it(index.files.includes('model-metrics.json') ? 'the model metrics conform and score every output of the surrogate' : 'the index does not declare model-metrics.json: the App says the metrics are not available yet', () => {
      if (!index.files.includes('model-metrics.json')) {
        expect(existsSync(new URL('model-metrics.json', root))).toBe(false);
        return;
      }
      const m = read('model-metrics.json') as ModelMetrics;
      expect(conform(m, { object: MODEL_METRICS })).toEqual([]);
      expect(m.schema).toBe(SCHEMAS.metrics);
      const s = read('models/surrogate.json') as SurrogateModel;
      expect(Object.keys(m.surrogate.per_output).sort()).toEqual([...s.output_order].sort());
    });

    it('the readiness document conforms and lists the catalog rows in order', () => {
      const r = read('readiness.json') as Readiness;
      expect(conform(r, { object: READINESS })).toEqual([]);
      expect(r.schema).toBe(SCHEMAS.readiness);
      const expected = catalogIds().filter((id) => id !== 'readiness');
      expect(expected.length).toBeGreaterThan(0);
      expect(r.contracts.map((e) => e.id)).toEqual(expected);
    });
  });
}

describe('CONTRACT 2: the checker', () => {
  it('adversarial: fails on a drifted document: a boolean is not a number, and extra and missing keys are named', () => {
    const problems = conform({ f80_mm: true, p80_mm: 3, extra: 1 }, { object: TRACE_SUMMARY }).join('\n');
    expect(problems).toMatch(/f80_mm: expected a finite number/);
    expect(problems).toMatch(/extra: written by the pipeline, not declared/);
    expect(problems).toMatch(/p50_mm: declared by the web, not written/);
  });
  it('adversarial: a value outside a closed set, a tuple of the wrong length and a union that matches nothing are named', () => {
    expect(conform('warm', { enum: ['choke', 'trickle'] }).join('')).toMatch(/expected one of choke, trickle/);
    expect(conform([1, 2, 3], { tuple: ['number', 'number'] }).join('')).toMatch(/expected 2 values, found 3/);
    expect(conform([1, 'x'], { tuple: ['number', 'number'] }).join('')).toMatch(/\[1\]: expected a finite number/);
    const source = MANIFEST.source;
    expect(conform({ kind: 'authored' }, source)).toEqual([]);
    expect(conform({ kind: 'publication', citation: 'c', doi: 'd', license: 'CC BY 4.0' }, source)).toEqual([]);
    expect(conform({ kind: 'publication', citation: 'c' }, source).join('')).toMatch(/matches none of 2 alternatives/);
    expect(conform('Infinity', TRACE_SUMMARY.cond_estimate)).toEqual([]);
    expect(conform('NaN', TRACE_SUMMARY.cond_estimate).join('')).toMatch(/matches none/);
  });
  it('an optional member may be absent and is checked when present', () => {
    const kind = { object: { a: 'number', b: { optional: 'number' } } } as const;
    expect(conform({ a: 1 }, kind)).toEqual([]);
    expect(conform({ a: 1, b: 2 }, kind)).toEqual([]);
    expect(conform({ a: 1, b: 'x' }, kind).join('')).toMatch(/\.b: expected a finite number/);
    expect(conform({ b: 1 }, kind).join('')).toMatch(/\.a: declared by the web/);
  });
  it('a nullable kind accepts null and still checks a value', () => {
    expect(conform(null, { nullable: 'number' })).toEqual([]);
    expect(conform(2, { nullable: 'number' })).toEqual([]);
    expect(conform('2', { nullable: 'number' }).join('')).toMatch(/expected a finite number/);
  });
  it('the 503 body of the API conforms, and a body without its reason does not', () => {
    const body = { detail: { state: 'missing', reason: { en: 'x', es: 'y' } } };
    expect(conform(body, { object: UNAVAILABLE })).toEqual([]);
    expect(conform({ detail: { state: 'missing' } }, { object: UNAVAILABLE }).join('')).toMatch(/reason: declared by the web/);
  });
  it('the model-metrics descriptor accepts a document written to the schema, and refuses one that lacks an output', () => {
    const output = { r2: 0.99, mape_pct: 1.2, mape_pct_int8: 1.4 };
    const names = ['p80_mm', 'p50_mm', 'p20_mm', 'pass_1', 'pass_4', 'pass_8', 'pass_16', 'pass_32', 'throughput_tph', 'power_kw'];
    const doc = {
      schema: SCHEMAS.metrics,
      engine_version: VERSION,
      surrogate: {
        n_train: 6000,
        n_test: 2000,
        test_seed: 7,
        per_output: Object.fromEntries(names.map((n) => [n, output])),
        p80_monotone_vs_css: true,
        parity: { torch_vs_float32_max_abs: 1e-6, float32_vs_int8_max_abs: 1e-2 },
        note: 'held out',
      },
      anomaly: { n_heldout: 2000, false_alarm_rate: 0.01, n_planted: 200, detection_rate: 0.9, envelope_false_alarm_rate: 0, envelope_detection_rate: 0.5, planted: 'x', note: 'n' },
    };
    expect(conform(doc, { object: MODEL_METRICS })).toEqual([]);
    const lacking = structuredClone(doc) as typeof doc;
    delete (lacking.surrogate.per_output as Record<string, unknown>).power_kw;
    expect(conform(lacking, { object: MODEL_METRICS }).join('')).toMatch(/power_kw: declared by the web, not written/);
  });
  it('the model slots are the catalog rows with a model io cell', () => {
    expect(modelSlots()).toEqual(['surrogate-model', 'anomaly-model']);
  });
  it('the catalog table is parsed: twelve rows, readiness among them', () => {
    expect(catalogIds()).toEqual([
      'params-record',
      'hp500-survey',
      'case-index',
      'case-manifest',
      'trace',
      'hp500-backbone',
      'hp500-loo',
      'surrogate-model',
      'anomaly-model',
      'model-metrics',
      'readiness',
      'api',
    ]);
  });
  it('every consumer test the catalog names for the web exists', () => {
    const named = catalogRows().flatMap((r) => [r['consumer test'], r['swap test']]).flatMap((c) => c.split(', ')).map((c) => c.split('::')[0]).filter((p) => p.startsWith('frontend/'));
    expect(named.length).toBeGreaterThan(0);
    for (const rel of new Set(named)) expect(existsSync(new URL(`../../../${rel}`, import.meta.url)), rel).toBe(true);
  });
});
