// What the Experiments page loads, once, for all its topics: the cases with their replays (the cross-case content moved here from the App)
// and CrusherCal's validation document. Each topic reads the same load, so switching topics never fetches a file twice; a document the
// readiness lists as absent shows its reason in place of a chart (never an empty chart), and the cases that load still draw.
import { pick, useShellLang, type BiText } from '@fasl-work/caos-app-shell';
import { createContext, useContext, type ReactNode } from 'react';
import { ArtifactUnavailable, loadAllCases, loadHp500Loo, useArtifact, type CaseData, type Loaded } from '../../api/artifacts';
import type { CaseIndex, Hp500Loo, Text } from '../../lib/contract.types';
import { ReadinessNote } from '../../readiness/ReadinessNote';

export interface Bundle {
  index: CaseIndex;
  cases: CaseData[];
  /** The cases the readiness document lists as absent, with the reason. */
  absent: { caseId: string; title: Text; reason: Text }[];
  loo: Loaded<Hp500Loo>;
}

async function loadBundle(signal: AbortSignal): Promise<Bundle> {
  const { index, cases, absent } = await loadAllCases(signal);
  let loo: Loaded<Hp500Loo>;
  try {
    loo = { state: 'ready', data: await loadHp500Loo(index, signal) };
  } catch (e) {
    if (!(e instanceof ArtifactUnavailable)) throw e;
    loo = { state: 'unavailable', reason: e.reason };
  }
  return { index, cases, absent, loo };
}

const BundleContext = createContext<Loaded<Bundle>>({ state: 'loading' });

/** Loads the bundle once and hands it to every topic below. */
export function ExperimentsData({ children }: { children: ReactNode }) {
  const bundle = useArtifact(loadBundle, []);
  return <BundleContext.Provider value={bundle}>{children}</BundleContext.Provider>;
}

export const useBundle = (): Loaded<Bundle> => useContext(BundleContext);

const LOADING: BiText = { en: 'Loading the committed artifacts', es: 'Cargando los artefactos comprometidos' };

/** A sentence in the displayed language without the closing full stop the readiness reasons carry. */
const bare = (s: string): string => s.replace(/[.\s]+$/, '');

/**
 * The frame of a data view: the readiness note of the catalog rows it reads, then its content when the data is there, else the state it
 * is in (loading, not available yet with the reason, or the error). `needsLoo` makes the view wait for CrusherCal's document.
 */
export function DataView({ rows, needsLoo = false, children }: { rows: string[]; needsLoo?: boolean; children: (b: Bundle, loo: Hp500Loo | null) => ReactNode }) {
  const lang = useShellLang();
  const bundle = useBundle();
  let body: ReactNode;
  if (bundle.state === 'loading') {
    body = (
      <p className="caos-pending" data-state="loading">
        {pick(LOADING, lang)}
      </p>
    );
  } else if (bundle.state === 'unavailable') {
    body = (
      <p className="caos-pending" data-state="unavailable">
        {lang === 'es' ? `Aún no disponible: ${bare(bundle.reason.es)}.` : `Not available yet: ${bare(bundle.reason.en)}.`}
      </p>
    );
  } else if (bundle.state === 'error') {
    body = (
      <p className="caos-pending" data-state="error">
        {bundle.error}
      </p>
    );
  } else if (needsLoo && bundle.data.loo.state !== 'ready') {
    const loo = bundle.data.loo;
    const why = loo.state === 'unavailable' ? (lang === 'es' ? bare(loo.reason.es) : bare(loo.reason.en)) : lang === 'es' ? 'el documento de validación no se pudo leer' : 'the validation document could not be read';
    body = (
      <p className="caos-pending" data-state="unavailable">
        {lang === 'es' ? `Aún no disponible: ${why}.` : `Not available yet: ${why}.`}
      </p>
    );
  } else {
    const loo = bundle.data.loo.state === 'ready' ? bundle.data.loo.data : null;
    body = children(bundle.data, loo);
  }
  return (
    <>
      <ReadinessNote ids={rows} />
      {body}
    </>
  );
}

/** A table that scrolls inside its own box on a narrow screen instead of widening the page. */
export function Scroll({ children }: { children: ReactNode }) {
  return <div style={{ overflowX: 'auto', minWidth: 0 }}>{children}</div>;
}

/** The names of the machines in both languages, for a table cell. */
export const MACHINE_NAME: Record<string, Text> = {
  'cone-sec': { en: 'Secondary cone', es: 'Cono secundario' },
  'cone-tert': { en: 'Tertiary cone', es: 'Cono terciario' },
  'cone-short-head': { en: 'Short-head cone', es: 'Cono de cabeza corta' },
  gyratory: { en: 'Gyratory', es: 'Giratorio' },
  jaw: { en: 'Jaw', es: 'Mandíbula' },
};
