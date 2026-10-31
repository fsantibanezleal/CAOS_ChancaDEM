// What the Benchmark page's sections share: the documents they read, loaded once for the page (the case index, CrusherCal's
// validation, the calibrated backbone, the model metrics, the surrogate's slot and the ten survey manifests), and the states a
// section shows while a document is not there (the reason from the readiness document, never an empty chart).
import { pick, useShellLang, type BiText } from '@fasl-work/caos-app-shell';
import { createContext, useContext, type ReactNode } from 'react';
import {
  loadHp500Backbone,
  loadHp500CrusherBayes,
  loadHp500Loo,
  loadIndex,
  loadManifest,
  loadModelMetrics,
  loadSurrogate,
  useArtifact,
  type Loaded,
  type ModelSlot,
} from '../../api/artifacts';
import type { CaseIndex, CaseManifest, Hp500Backbone, Hp500CrusherBayes, Hp500Loo, ModelMetrics, SurrogateModel } from '../../lib/contract.types';

export interface BenchData {
  index: Loaded<CaseIndex>;
  loo: Loaded<Hp500Loo>;
  crusherbayes: Loaded<Hp500CrusherBayes>;
  backbone: Loaded<Hp500Backbone>;
  metrics: Loaded<ModelMetrics>;
  surrogate: Loaded<ModelSlot<SurrogateModel>>;
  /** The manifests of the real surveys, in the order of the case index. */
  surveys: Loaded<CaseManifest[]>;
}

const BenchContext = createContext<BenchData | null>(null);

export function useBench(): BenchData {
  const ctx = useContext(BenchContext);
  if (!ctx) throw new Error('useBench: the Benchmark page provides the documents');
  return ctx;
}

// One fetch of the case index for the page; a failed one is not kept. It takes no abort signal: the first section to unmount
// must not cancel the load the others wait on.
let indexOnce: Promise<CaseIndex> | null = null;
function theIndex(): Promise<CaseIndex> {
  indexOnce ??= loadIndex().catch((e: unknown) => {
    indexOnce = null;
    throw e;
  });
  return indexOnce;
}

/** Loads every document of the page once and hands it down. */
export function BenchProvider({ children }: { children: ReactNode }) {
  const index = useArtifact(() => theIndex(), []);
  const loo = useArtifact(async (s) => loadHp500Loo(await theIndex(), s), []);
  const crusherbayes = useArtifact(async (s) => loadHp500CrusherBayes(await theIndex(), s), []);
  const backbone = useArtifact(async (s) => loadHp500Backbone(await theIndex(), s), []);
  const metrics = useArtifact(async (s) => loadModelMetrics(await theIndex(), s), []);
  const surrogate = useArtifact(async (s) => loadSurrogate(await theIndex(), s), []);
  const surveys = useArtifact(async (s) => {
    const idx = await theIndex();
    const ids = idx.cases.filter((c) => c.real_or_synthetic === 'real').map((c) => c.case_id);
    return Promise.all(ids.map((id) => loadManifest(id, s)));
  }, []);
  return <BenchContext.Provider value={{ index, loo, crusherbayes, backbone, metrics, surrogate, surveys }}>{children}</BenchContext.Provider>;
}

const WAIT: BiText = { en: 'Loading the artifacts', es: 'Cargando los artefactos' };

/** What stands where a document would be: loading, the error, or not available yet with the reason from the readiness document. */
export function Pending({ of, wait = WAIT }: { of: Loaded<unknown>; wait?: BiText }) {
  const lang = useShellLang();
  if (of.state === 'unavailable') {
    return (
      <p className="caos-pending" data-state="unavailable">
        {of.reason[lang]}
      </p>
    );
  }
  if (of.state === 'error') {
    return (
      <p className="caos-pending" data-state="error">
        {of.error}
      </p>
    );
  }
  return (
    <p className="caos-pending" data-state="loading">
      {pick(wait, lang)}
    </p>
  );
}

/** Renders `children` with the documents when all are there, else the state of the first one that is not. */
export function Ready<A, B = never, C = never>({
  a,
  b,
  c,
  wait,
  children,
}: {
  a: Loaded<A>;
  b?: Loaded<B>;
  c?: Loaded<C>;
  wait?: BiText;
  children: (a: A, b: B, c: C) => ReactNode;
}) {
  const parts: Loaded<unknown>[] = [a, ...(b ? [b] : []), ...(c ? [c] : [])];
  const bad = parts.find((p) => p.state !== 'ready');
  if (bad) return <Pending of={bad} wait={wait} />;
  return <>{children((a as { data: A }).data, (b as { data: B } | undefined)?.data as B, (c as { data: C } | undefined)?.data as C)}</>;
}

/** A table that scrolls inside its own box instead of widening the page. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div style={{ overflowX: 'auto', minWidth: 0 }}>{children}</div>;
}
