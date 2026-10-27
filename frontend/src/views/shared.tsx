// What every view of the App shares: the selection the workbench hands down (a context, so no view takes it through six props),
// the states a view declares while its data is not there, the alert for a flagged point, and the group frame that puts the
// readiness note above a group. Nothing here draws a chart; the views do, on the shell's chart and drawing kit.
import { formatNumber, pick, SubTabs, useShellLang, type BiText, type FormatOptions, type Provenance } from '@fasl-work/caos-app-shell';
import { createContext, useContext, type ReactNode } from 'react';
import type { Loaded } from '../api/artifacts';
import { flagText } from '../engine/flags';
import type { CaseIndex, Hp500Loo, Text } from '../lib/contract.types';
import { ReadinessNote } from '../readiness/ReadinessNote';
import { BANDED_MACHINE, rowsFor, type GroupId, type Selection } from '../workbench/model';

export interface ViewCtx {
  /** The case at the rail's values and the open variant; null while the case loads or when it is not available. */
  sel: Selection | null;
  /** Why the selected case is not available yet, from the readiness document; null when it is. */
  unavailable: Text | null;
  index: CaseIndex | null;
  /** CrusherCal, for a real case and for a synthetic case of the banded machine; null on any other. */
  loo: Loaded<Hp500Loo> | null;
  /** The target P80 of the inverse search, in millimetres. */
  target: number;
  setTarget: (mm: number) => void;
  /** Sets the rail's closed-side setting so that the variant in force has this setting; false when the case's inputs are measured. */
  canApplyCss: boolean;
  applyCss: (mm: number) => void;
}

export const ViewContext = createContext<ViewCtx>({
  sel: null,
  unavailable: null,
  index: null,
  loo: null,
  target: 12,
  setTarget: () => undefined,
  canApplyCss: false,
  applyCss: () => undefined,
});
export const useView = (): ViewCtx => useContext(ViewContext);

/** A reason from the readiness document without its closing full stop, so a sentence can add its own. */
export const bare = (s: string): string => s.replace(/[.\s]+$/, '');

export const LOADING: BiText = { en: 'Loading the case', es: 'Cargando el caso' };

/** A view whose data is not there yet: the reason when the readiness gives one (never an empty chart, never a spinner), else it loads. */
export function Pending({ label = LOADING }: { label?: BiText }) {
  const lang = useShellLang();
  const { unavailable } = useView();
  if (unavailable) {
    return (
      <p className="caos-pending" data-state="unavailable">
        {unavailable[lang]}
      </p>
    );
  }
  return (
    <p className="caos-pending" data-state="loading">
      {pick(label, lang)}
    </p>
  );
}

/** A replay view of a case whose trace the readiness lists as absent: not available yet, with the reason. */
export function ReplayMissing({ reason }: { reason: Text | null }) {
  const lang = useShellLang();
  const fallback: Text = { en: 'the committed replay of this case is not in this build', es: 'el replay comprometido de este caso no está en esta versión' };
  const why = reason ?? fallback;
  return (
    <p className="caos-pending" data-state="unavailable">
      {lang === 'es' ? `Aún no disponible: ${bare(why.es)}.` : `Not available yet: ${bare(why.en)}.`}
    </p>
  );
}

/** The provenance of what a view shows about the selected case: its lane's data is real on a measured survey, synthetic otherwise. */
export const provenanceOf = (sel: Selection): Provenance => (sel.data.manifest.real_or_synthetic === 'real' ? 'real' : 'synthetic');

/** The number formatter bound to the interface language, as a plain function. */
export function useNum(): (v: number | null | undefined, o?: FormatOptions) => string {
  const lang = useShellLang();
  return (v, o) => formatNumber(v, lang, o);
}

/** A label in both languages for a heading in a table: `t('English', 'Español')`. */
export function useT(): (en: string, es: string) => string {
  const lang = useShellLang();
  return (en, es) => (lang === 'es' ? es : en);
}

/** A flagged point is never a confident number (catalog: the envelope gate). The alert takes one line above the views, so a
 * flagged case keeps the instrument's height (ADR-0071 rule 8: at 1280 x 800 a full list took about 90 px from every view);
 * it names how many reasons there are and opens to read them, and the Context tab lists them in full. */
export function FlagsAlert() {
  const lang = useShellLang();
  const { sel } = useView();
  if (!sel || sel.flags.length === 0) return null;
  const n = sel.flags.length;
  const title: BiText = sel.result.outOfEnvelope
    ? { en: `Outside the validated envelope: this reading is not confident (${n} ${n === 1 ? 'reason' : 'reasons'})`, es: `Fuera de la envolvente validada: esta lectura no es confiable (${n} ${n === 1 ? 'razón' : 'razones'})` }
    : { en: `This point is flagged (${n} ${n === 1 ? 'reason' : 'reasons'})`, es: `Este punto está marcado (${n} ${n === 1 ? 'razón' : 'razones'})` };
  return (
    <div role="alert" className="cdem-alert" data-flags={sel.flags.join(' ')}>
      <details>
        <summary>{pick(title, lang)}</summary>
        <ul>
          {sel.flags.map((code) => (
            <li key={code}>{flagText(code, lang)}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export interface Sub {
  id: string;
  label: BiText;
  content: ReactNode;
}

/**
 * One group of the instrument: the readiness note of its rows, the alert of a flagged point and its views as sub-tabs. The sub-tabs sit
 * directly in the group panel, where the shell sizes them to fill what the note and the alert leave.
 */
export function GroupFrame({ group, ariaLabel, tabs }: { group: GroupId; ariaLabel: BiText; tabs: Sub[] }) {
  const lang = useShellLang();
  const { sel } = useView();
  const real = sel?.data.manifest.real_or_synthetic === 'real';
  const banded = sel?.data.manifest.params.machine === BANDED_MACHINE;
  // a group with one view has no row of sub-tabs to choose from
  if (tabs.length === 1) {
    return (
      <>
        <ReadinessNote ids={rowsFor(group, real, banded)} />
        <FlagsAlert />
        {tabs[0].content}
      </>
    );
  }
  return (
    <>
      <ReadinessNote ids={rowsFor(group, real, banded)} />
      <FlagsAlert />
      <SubTabs ariaLabel={pick(ariaLabel, lang)} tabs={tabs.map((t) => ({ id: t.id, label: pick(t.label, lang), content: t.content }))} />
    </>
  );
}

/** The regime of the crusher in words. */
export const REGIME_TEXT: Record<string, Text> = {
  choke: { en: 'Choke-fed', es: 'Alimentada a tope' },
  trickle: { en: 'Trickle-fed', es: 'Alimentada a goteo' },
  'pass-through': { en: 'Pass-through', es: 'Paso directo' },
  invalid: { en: 'Invalid', es: 'Inválido' },
};

/** The sizes the passing fractions are read at, in millimetres. */
export const READOUT_SIZES = [1, 4, 8, 16, 32] as const;
