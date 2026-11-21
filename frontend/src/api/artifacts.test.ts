// The artifact layer refuses what is not JSON: a static host that answers a missing file with its HTML page must
// surface as an error at the fetch, not as a parse failure in a view (T3). The loaders of the HP500 documents, the model metrics
// and the two model slots take the readiness document and the index into account: nothing the build does not hold is asked for.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CaseIndex, DemRun, Readiness, ReadinessEntry } from '../lib/contract.types';
import { resetReadiness } from '../readiness/readiness';
import { ArtifactError, ArtifactUnavailable, getJSON, loadAnomaly, loadDemFrames, loadDemRun, loadHp500Loo, loadModelMetrics, loadSurrogate } from './artifacts';

// the product version, read from VERSION like the build does, never written here
const VERSION = readFileSync(new URL('../../../VERSION', import.meta.url), 'utf8').trim();

vi.stubGlobal('__APP_VERSION__', 'test-version');

afterEach(() => vi.unstubAllGlobals());

function answer(body: string, status: number, type: string) {
  return vi.fn(async (url: string) => ({ url, ok: status < 400, status, headers: new Headers({ 'content-type': type }), json: async () => JSON.parse(body) }));
}

describe('getJSON', () => {
  it('asks for the artifact under the base with the release version, and returns its JSON', async () => {
    const fetch = answer('{"ok":true}', 200, 'application/json');
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('__APP_VERSION__', 'test-version');
    await expect(getJSON('manifests/index.json')).resolves.toEqual({ ok: true });
    expect(fetch.mock.calls[0][0]).toMatch(/\/data\/manifests\/index\.json\?v=test-version$/);
  });
  it('adversarial: refuses an HTML answer (the host fallback for a missing file)', async () => {
    vi.stubGlobal('fetch', answer('<!doctype html>', 200, 'text/html'));
    vi.stubGlobal('__APP_VERSION__', 'test-version');
    await expect(getJSON('manifests/missing.json')).rejects.toThrow(ArtifactError);
  });
  it('refuses an error status, naming the file', async () => {
    vi.stubGlobal('fetch', answer('', 404, 'text/html'));
    vi.stubGlobal('__APP_VERSION__', 'test-version');
    await expect(getJSON('data/x.json')).rejects.toThrow(/data\/x\.json: HTTP 404/);
  });
});

// ---- the loaders of the HP500 documents, the model metrics and the two model slots ----
const index = (files: string[]): CaseIndex => ({ schema: 'chancadem.index/v1', engine_version: VERSION, n_cases: 0, default_case: 'A', cases: [], files });
const row = (id: string, state: ReadinessEntry['state'], reason: ReadinessEntry['reason'] = null): ReadinessEntry => ({
  id,
  version: '1.0.0',
  status: 'real',
  provenance: state === 'missing' ? null : state === 'training' ? 'baseline' : 'real',
  state,
  reason,
  missing: [],
});
const readiness = (...rows: ReadinessEntry[]): Readiness => ({ schema: 'chancadem.readiness/v1', product_version: VERSION, catalog_sha256: '0', contracts: rows });

/** A host that answers the given documents by relative path and 404s the rest, counting the files it was asked for. */
function host(docs: Record<string, unknown>) {
  const asked: string[] = [];
  const fetch = vi.fn(async (url: string) => {
    const rel = Object.keys(docs).find((k) => url.includes(`/data/${k}`));
    asked.push(url);
    return { ok: !!rel, status: rel ? 200 : 404, headers: new Headers({ 'content-type': 'application/json' }), json: async () => docs[rel ?? ''] };
  });
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('__APP_VERSION__', 'test-version');
  resetReadiness();
  return asked;
}

describe('the documents the index declares', () => {
  it('adversarial: a document the index does not declare is not available yet, and is never asked for', async () => {
    const asked = host({ 'readiness.json': readiness(row('hp500-loo', 'provider')), 'hp500/loo.json': { schema: 'x' } });
    const e = await loadHp500Loo(index([])).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ArtifactUnavailable);
    expect((e as ArtifactUnavailable).reason.en).toMatch(/does not declare it/);
    expect((e as ArtifactUnavailable).reason.es).toMatch(/no lo declara/);
    expect(asked.some((u) => u.includes('hp500/loo.json'))).toBe(false);
  });
  it('adversarial: a document the readiness marks missing carries the row\'s reason, in both languages, and is never asked for', async () => {
    const asked = host({ 'readiness.json': readiness(row('model-metrics', 'missing', { en: 'not evaluated', es: 'sin evaluar' })), 'model-metrics.json': { schema: 'x' } });
    const e = await loadModelMetrics(index(['model-metrics.json'])).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ArtifactUnavailable);
    expect((e as ArtifactUnavailable).reason.en).toContain('not evaluated');
    expect((e as ArtifactUnavailable).reason.es).toContain('sin evaluar');
    expect(asked.some((u) => u.includes('model-metrics.json'))).toBe(false);
  });
  it('a document the index declares and the readiness does not mark is read', async () => {
    host({ 'readiness.json': readiness(row('hp500-loo', 'provider')), 'hp500/loo.json': { schema: 'chancadem.hp500.loo/v1' } });
    await expect(loadHp500Loo(index(['hp500/loo.json']))).resolves.toMatchObject({ schema: 'chancadem.hp500.loo/v1' });
  });
});

describe('the model slots', () => {
  const files = ['models/surrogate.json', 'models/psd-ae.json'];
  it('a slot the readiness says is training is answered by its baseline with the reason, and its contract is never fetched', async () => {
    const asked = host({
      'readiness.json': readiness(row('surrogate-model', 'training', { en: 'a new model trains', es: 'se entrena un modelo nuevo' })),
      'models/surrogate.json': { schema: 'chancadem.surrogate/v1' },
    });
    const slot = await loadSurrogate(index(files));
    expect(slot).toEqual({ answer: 'baseline', reason: { en: 'a new model trains', es: 'se entrena un modelo nuevo' } });
    expect(asked.some((u) => u.includes('models/surrogate.json'))).toBe(false);
  });
  it('a slot the readiness does not mark is released with the contract the index declares', async () => {
    host({ 'readiness.json': readiness(row('anomaly-model', 'provider')), 'models/psd-ae.json': { schema: 'chancadem.anomaly/v1' } });
    await expect(loadAnomaly(index(files))).resolves.toEqual({ answer: 'released', contract: { schema: 'chancadem.anomaly/v1' } });
  });
  it('adversarial: a contract that cannot be read falls back to the baseline, with the cause, and does not throw', async () => {
    host({ 'readiness.json': readiness(row('anomaly-model', 'available')) });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const slot = await loadAnomaly(index(files));
    warn.mockRestore();
    expect(slot.answer).toBe('baseline');
    if (slot.answer === 'baseline') expect(slot.reason.en).toMatch(/could not be read/);
  });
  it('a slot whose contract the index does not declare is answered by its baseline', async () => {
    host({ 'readiness.json': readiness(row('surrogate-model', 'available')) });
    const slot = await loadSurrogate(index([]));
    expect(slot.answer).toBe('baseline');
  });
});

// ---- the particle-simulation document and its frames files (catalog row dem-run) ----
const provider = new URL('../../../docs/contracts/fixtures/data/derived/dem/', import.meta.url);
const demDoc = JSON.parse(readFileSync(new URL('jaw-lab.json', provider), 'utf8')) as DemRun;
const framesBytes = (file: string): ArrayBuffer => {
  const b = readFileSync(new URL(file, provider));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

/** A host that answers JSON documents and binary files by relative path, counting what it was asked for. */
function binaryHost(docs: Record<string, unknown>, bins: Record<string, { body: ArrayBuffer; type?: string; status?: number }>) {
  const asked: string[] = [];
  const fetch = vi.fn(async (url: string) => {
    asked.push(url);
    const bin = Object.keys(bins).find((k) => url.includes(`/data/${k}`));
    if (bin) {
      const b = bins[bin];
      return { ok: (b.status ?? 200) < 400, status: b.status ?? 200, headers: new Headers({ 'content-type': b.type ?? 'application/octet-stream' }), arrayBuffer: async () => b.body };
    }
    const rel = Object.keys(docs).find((k) => url.includes(`/data/${k}`));
    return { ok: !!rel, status: rel ? 200 : 404, headers: new Headers({ 'content-type': 'application/json' }), json: async () => docs[rel ?? ''] };
  });
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('__APP_VERSION__', 'test-version');
  resetReadiness();
  return asked;
}

describe('the particle-simulation document and its replay files', () => {
  const files = ['dem/jaw-lab.json', ...demDoc.points.map((p) => p.simulation.replay!.file)];
  const coarse = demDoc.points[0].simulation.replay!;
  it('the document is read through the index when the readiness says partial: what the document holds is drawn', async () => {
    binaryHost({ 'readiness.json': readiness(row('dem-run', 'partial', { en: '1 of 3 particle runs did not complete.', es: '1 de 3' })), 'dem/jaw-lab.json': demDoc }, {});
    await expect(loadDemRun(index(files))).resolves.toMatchObject({ schema: 'chancadem.dem.run/v1', state: 'partial' });
  });
  it('adversarial: a document the readiness marks missing is not asked for and carries the row\'s reason', async () => {
    const asked = binaryHost({ 'readiness.json': readiness(row('dem-run', 'missing', { en: 'the bake was not run', es: 'no se ejecutó la generación' })), 'dem/jaw-lab.json': demDoc }, {});
    const e = await loadDemRun(index(files)).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ArtifactUnavailable);
    expect((e as ArtifactUnavailable).reason.es).toContain('no se ejecutó la generación');
    expect(asked.some((u) => u.includes('jaw-lab.json'))).toBe(false);
  });
  it('a replay file is fetched under the release version and decoded to its frames, with the length of the document', async () => {
    const asked = binaryHost({ 'readiness.json': readiness(row('dem-run', 'partial')) }, { [coarse.file]: { body: framesBytes(coarse.file.replace(/^dem\//, '')) } });
    const f = await loadDemFrames(index(files), coarse);
    expect(f.frames).toBe(coarse.frames);
    expect(f.offsets[f.frames]).toBe(coarse.spheres);
    expect(asked.find((u) => u.includes('.frames.bin'))).toMatch(/\/data\/dem\/jaw-lab-63-52\.frames\.bin\?v=test-version$/);
  });
  it('adversarial: a file of another length than the document names is refused with both lengths, and nothing is decoded', async () => {
    const short = framesBytes(coarse.file.replace(/^dem\//, '')).slice(0, 1000);
    binaryHost({ 'readiness.json': readiness(row('dem-run', 'partial')) }, { [coarse.file]: { body: short } });
    const e = await loadDemFrames(index(files), coarse).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ArtifactError);
    expect(String(e)).toContain('1000');
    expect(String(e)).toContain(String(coarse.bytes));
  });
  it('adversarial: an HTML answer (the host fallback for a missing file) and an error status are refused, naming the file', async () => {
    binaryHost({ 'readiness.json': readiness(row('dem-run', 'partial')) }, { [coarse.file]: { body: new ArrayBuffer(coarse.bytes), type: 'text/html' } });
    await expect(loadDemFrames(index(files), coarse)).rejects.toThrow(/jaw-lab-63-52\.frames\.bin: answered text\/html/);
    binaryHost({ 'readiness.json': readiness(row('dem-run', 'partial')) }, { [coarse.file]: { body: new ArrayBuffer(0), status: 404 } });
    await expect(loadDemFrames(index(files), coarse)).rejects.toThrow(/jaw-lab-63-52\.frames\.bin: HTTP 404/);
  });
  it('adversarial: a file the index does not declare is never asked for', async () => {
    const asked = binaryHost({ 'readiness.json': readiness(row('dem-run', 'partial')) }, { [coarse.file]: { body: framesBytes(coarse.file.replace(/^dem\//, '')) } });
    const e = await loadDemFrames(index(['dem/jaw-lab.json']), coarse).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ArtifactUnavailable);
    expect(asked.some((u) => u.includes('.frames.bin'))).toBe(false);
  });
});
