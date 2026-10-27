// The artifact layer (T3): every committed artifact is fetched from a root-absolute URL under the site's base, with
// ?v=VERSION so a new release never reads an old cached file, and must answer JSON: a static host answering a
// missing file with its HTML page would otherwise parse as an error far from the cause (failure classes 2, 9).
import { useEffect, useState } from 'react';
import type { AnomalyModel, CaseIndex, CaseManifest, Hp500Backbone, Hp500Loo, ModelMetrics, SurrogateModel, Text, Trace } from '../lib/contract.types';
import { loadReadiness, modelAnswers, rowUnavailable, unavailableRow } from '../readiness/readiness';

export class ArtifactError extends Error {}

/** The readiness document lists this artifact as absent: the view says not available yet, with the reason. */
export class ArtifactUnavailable extends Error {
  constructor(
    readonly path: string,
    readonly reason: Text,
  ) {
    super(`${path}: not available yet (${reason.en})`);
  }
}

/** Throws ArtifactUnavailable when the readiness document marks `path` absent; an unreadable document never does. */
async function requireAvailable(path: string): Promise<void> {
  const row = unavailableRow(await loadReadiness(), path);
  if (!row) return;
  const why = row.reason ?? { en: 'the pipeline did not write it', es: 'el pipeline no lo escribió' };
  throw new ArtifactUnavailable(path, {
    en: `${path} is not available yet: ${why.en}`,
    es: `${path} aún no está disponible: ${why.es}`,
  });
}

const DATA = `${import.meta.env.BASE_URL}data/`;

export async function getJSON<T>(rel: string, signal?: AbortSignal): Promise<T> {
  const url = `${DATA}${rel}?v=${encodeURIComponent(__APP_VERSION__)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new ArtifactError(`${rel}: HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('json')) throw new ArtifactError(`${rel}: answered ${type || 'no content type'}, not JSON`);
  return (await res.json()) as T;
}

const INDEX_PATH = 'manifests/index.json';

export async function loadIndex(signal?: AbortSignal): Promise<CaseIndex> {
  await requireAvailable(INDEX_PATH);
  return getJSON<CaseIndex>(INDEX_PATH, signal);
}

export async function loadManifest(caseId: string, signal?: AbortSignal): Promise<CaseManifest> {
  const path = `manifests/${caseId}.json`;
  await requireAvailable(path);
  return getJSON<CaseManifest>(path, signal);
}

export interface CaseData {
  manifest: CaseManifest;
  /** The replay of the case; null when the readiness lists it absent (the live lane still runs from the manifest). */
  trace: Trace | null;
  /** Why the trace is absent (bilingual, from the readiness document); null when it is there. */
  traceReason: Text | null;
}

/**
 * A case: its manifest and its trace. A manifest the readiness lists as absent rejects with ArtifactUnavailable; a trace it lists
 * as absent does not (catalog row trace: the live lane runs from the manifest's parameters, the replay views say not available yet).
 */
export async function loadCase(caseId: string, signal?: AbortSignal): Promise<CaseData> {
  const manifest = await loadManifest(caseId, signal);
  try {
    await requireAvailable(manifest.artifact.path);
  } catch (e) {
    if (e instanceof ArtifactUnavailable) return { manifest, trace: null, traceReason: e.reason };
    throw e;
  }
  const trace = await getJSON<Trace>(manifest.artifact.path, signal);
  return { manifest, trace, traceReason: null };
}

/**
 * A document the index declares among its further files (the HP500 documents, the model metrics). One the index does not declare,
 * or the readiness marks missing, rejects with ArtifactUnavailable and its reason: the site never asks for a file it does not hold.
 */
async function loadDeclared<T>(index: CaseIndex, path: string, row: string, signal?: AbortSignal): Promise<T> {
  const missing = rowUnavailable(await loadReadiness(), row);
  if (missing) {
    throw new ArtifactUnavailable(path, {
      en: `${path} is not available yet: ${missing.reason?.en ?? 'the pipeline did not write it'}`,
      es: `${path} aún no está disponible: ${missing.reason?.es ?? 'el pipeline no lo escribió'}`,
    });
  }
  if (!index.files.includes(path)) {
    throw new ArtifactUnavailable(path, {
      en: `${path} is not available yet: the case index of this build does not declare it`,
      es: `${path} aún no está disponible: el índice de casos de esta versión no lo declara`,
    });
  }
  await requireAvailable(path);
  return getJSON<T>(path, signal);
}

export const HP500_LOO_PATH = 'hp500/loo.json';
export const HP500_BACKBONE_PATH = 'hp500/backbone.json';
export const METRICS_PATH = 'model-metrics.json';
export const SURROGATE_PATH = 'models/surrogate.json';
export const ANOMALY_PATH = 'models/psd-ae.json';

/** CrusherCal: the leave-one-survey-out validation of the HP500 backbone, with its predictive bands (catalog row hp500-loo). */
export const loadHp500Loo = (index: CaseIndex, signal?: AbortSignal) => loadDeclared<Hp500Loo>(index, HP500_LOO_PATH, 'hp500-loo', signal);
/** The calibrated engine on each of the ten HP500 surveys (catalog row hp500-backbone). */
export const loadHp500Backbone = (index: CaseIndex, signal?: AbortSignal) => loadDeclared<Hp500Backbone>(index, HP500_BACKBONE_PATH, 'hp500-backbone', signal);
/** The held-out evaluation of the two model slots (catalog row model-metrics). */
export const loadModelMetrics = (index: CaseIndex, signal?: AbortSignal) => loadDeclared<ModelMetrics>(index, METRICS_PATH, 'model-metrics', signal);

/** A model slot: the released model's contract, or the reason the slot's baseline answers instead. */
export type ModelSlot<T> = { answer: 'released'; contract: T } | { answer: 'baseline'; reason: Text };

async function loadSlot<T>(index: CaseIndex, slot: string, path: string, signal?: AbortSignal): Promise<ModelSlot<T>> {
  const doc = await loadReadiness();
  if (modelAnswers(doc, slot) === 'baseline') {
    const row = doc?.contracts.find((c) => c.id === slot);
    return { answer: 'baseline', reason: row?.reason ?? { en: 'the slot has no released model', es: 'la ranura no tiene un modelo publicado' } };
  }
  if (!index.files.includes(path)) {
    return { answer: 'baseline', reason: { en: `the case index of this build does not declare ${path}`, es: `el índice de casos de esta versión no declara ${path}` } };
  }
  try {
    return { answer: 'released', contract: await getJSON<T>(path, signal) };
  } catch (e) {
    if (signal?.aborted) throw e;
    console.warn(`[artifacts] ${String(e)}; the baseline answers`);
    return { answer: 'baseline', reason: { en: `the contract could not be read (${String(e)})`, es: `no se pudo leer el contrato (${String(e)})` } };
  }
}

/** The surrogate's contract (catalog row surrogate-model); the engine answers when the slot is in training or has no contract. */
export const loadSurrogate = (index: CaseIndex, signal?: AbortSignal) => loadSlot<SurrogateModel>(index, 'surrogate-model', SURROGATE_PATH, signal);
/** The autoencoder's contract (catalog row anomaly-model); the envelope gate answers when the slot is in training or has no contract. */
export const loadAnomaly = (index: CaseIndex, signal?: AbortSignal) => loadSlot<AnomalyModel>(index, 'anomaly-model', ANOMALY_PATH, signal);

export interface AbsentCase {
  caseId: string;
  title: Text;
  reason: Text;
}

/**
 * Every case's manifest and trace, for the cross-case pages (Experiments, Benchmark). A case the readiness document
 * lists as absent is not in `cases`: it is in `absent`, with its reason, and the others still load.
 */
export async function loadAllCases(signal?: AbortSignal): Promise<{ index: CaseIndex; cases: CaseData[]; absent: AbsentCase[] }> {
  const index = await loadIndex(signal);
  const settled = await Promise.all(
    index.cases.map((c) =>
      loadCase(c.case_id, signal).then(
        (data) => ({ data }),
        (e: unknown) => {
          if (e instanceof ArtifactUnavailable) return { absent: { caseId: c.case_id, title: c.title, reason: e.reason } };
          throw e;
        },
      ),
    ),
  );
  const cases = settled.flatMap((r) => ('data' in r ? [r.data] : []));
  const absent = settled.flatMap((r) => ('absent' in r ? [r.absent] : []));
  return { index, cases, absent };
}

/** A loaded value with its declared state; views write `data-state` from it, and the gate waits on it. */
export type Loaded<T> =
  | { state: 'loading' }
  | { state: 'ready'; data: T }
  | { state: 'unavailable'; reason: Text }
  | { state: 'error'; error: string };

export function useArtifact<T>(load: (signal: AbortSignal) => Promise<T>, deps: unknown[]): Loaded<T> {
  const [value, setValue] = useState<Loaded<T>>({ state: 'loading' });
  useEffect(() => {
    const ctl = new AbortController();
    setValue({ state: 'loading' });
    load(ctl.signal).then(
      (data) => {
        if (!ctl.signal.aborted) setValue({ state: 'ready', data });
      },
      (e: unknown) => {
        if (ctl.signal.aborted) return;
        if (e instanceof ArtifactUnavailable) {
          setValue({ state: 'unavailable', reason: e.reason });
          return;
        }
        console.error(`[artifacts] ${String(e)}`);
        setValue({ state: 'error', error: String(e) });
      },
    );
    return () => ctl.abort();
    // the caller names the dependencies of its loader
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
