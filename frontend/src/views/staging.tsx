// The staged entry of a story step (ADR-0082 rule 4; B4 of the 0.13.000 review): after a step changes, its subject changes first (the
// stage's own data morphs in: the passes play, the methods' dots grow, the drift curve is drawn out, the section and the circuit move in),
// then the step's subject is highlighted, then the callouts enter one at a time in reading order, then the panel builds and its numbers
// count. The sequence is the shell's runStagedTransition and the eased progress its flyCamera loop (a camera pose of one coordinate,
// 0 to 1), never an animation loop of the product's own. With `prefers-reduced-motion: reduce` both apply their final state at once, so
// the first frame is the final one and nothing is lost. A step whose stage is missing keeps its missing state: no animation plays over it.
// Outside the story there is no provider, and every view draws its final state.
import { flyCamera, prefersReducedMotion, runStagedTransition, type MotionStage } from '@fasl-work/caos-app-shell';
import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';

export interface Entry {
  /** The subject's progress, 0 to 1 (the share of the passes played, of the methods grown, of the curve drawn). */
  reveal: number;
  /** True once the step's subject is highlighted. */
  highlight: boolean;
  /** How many callouts have entered, in reading order; null shows them all. */
  shown: number | null;
  /** The panel's progress, 0 to 1: it builds, and its numbers count up to their values. */
  panel: number;
  /** True while the sequence runs. */
  running: boolean;
}

export const FINAL: Entry = { reveal: 1, highlight: true, shown: null, panel: 1, running: false };
const START: Entry = { reveal: 0, highlight: false, shown: 0, panel: 0, running: true };

/** The durations of the sequence [ms]: the subject (the shell's flight takes 600 to 1500), the highlight, each callout, the panel. */
export const ENTRY_MS = { subject: 600, highlight: 260, callout: 200, panel: 600 } as const;

export const EntryContext = createContext<Entry>(FINAL);
export const useEntry = (): Entry => useContext(EntryContext);

/** The eased progress 0 to 1 of the shell's camera flight, as a promise; immediate under reduced motion. */
export function progress(durationMs: number, onFrame: (t: number) => void, reducedMotion: boolean, signal?: AbortSignal): Promise<void> {
  let at = 0;
  return flyCamera(
    { setPosition: (x) => (at = x), lookAt: () => undefined },
    { position: [0, 0, 0], target: [0, 0, 0] },
    { position: [1, 0, 0], target: [0, 0, 0] },
    { durationMs, reducedMotion, signal, onFrame: () => onFrame(Math.max(0, Math.min(1, at))) },
  );
}

/**
 * The stages of one step's entry, in order, for runStagedTransition: each sets the entry state, and its duration is the wait before the
 * next. `onSubject` runs the subject's own change (the passes scrubbed one by one); the panel's count is the last stage.
 */
export function entryStages(callouts: number, set: (e: Partial<Entry>) => void, subjectSteps: (() => void)[] = []): MotionStage[] {
  const per = subjectSteps.length ? ENTRY_MS.subject / subjectSteps.length : 0;
  return [
    ...subjectSteps.map((run) => ({ run, durationMs: per })),
    { run: () => set({ reveal: 1, highlight: true }), durationMs: ENTRY_MS.highlight },
    ...Array.from({ length: callouts }, (_, i) => ({ run: () => set({ shown: i + 1 }), durationMs: ENTRY_MS.callout })),
    { run: () => set({ shown: null }), durationMs: 0 },
  ];
}

/**
 * The entry of the step `key`: replays when the key changes. `animate` false (a missing stage, a test) draws the final state.
 * `subject` is the step's own change, called with the progress 0 to 1 (Solve scrubs its passes from it); when it is given the progress
 * drives it, otherwise the reveal of the views.
 */
export function useStagedEntry(key: string, callouts: number, animate: boolean, subject?: (t: number) => void): Entry {
  const [entry, setEntry] = useState<Entry>(FINAL);
  useLayoutEffect(() => {
    const reduced = prefersReducedMotion();
    if (!animate) {
      subject?.(1);
      setEntry(FINAL);
      return;
    }
    const abort = new AbortController();
    const set = (e: Partial<Entry>) => {
      if (!abort.signal.aborted) setEntry((prev) => ({ ...prev, ...e }));
    };
    setEntry(reduced ? FINAL : START);
    const run = async () => {
      // the subject first: its own change, eased by the shell's flight
      // the progress is applied in tenths (a twelfth for the count): each step is one render of the story, so the frame rate holds
      // (the gate's 30 fps floor), and the CSS eases between the steps
      let lastReveal = -1;
      await progress(
        ENTRY_MS.subject,
        (t) => {
          const q = quantize(t, 10);
          if (q === lastReveal) return;
          lastReveal = q;
          subject?.(q);
          set({ reveal: q });
        },
        reduced,
        abort.signal,
      );
      await runStagedTransition(entryStages(callouts, set), { reducedMotion: reduced, signal: abort.signal });
      let lastPanel = -1;
      await progress(
        ENTRY_MS.panel,
        (t) => {
          const q = quantize(t, 12);
          if (q === lastPanel) return;
          lastPanel = q;
          set({ panel: q });
        },
        reduced,
        abort.signal,
      );
      set({ running: false, panel: 1, shown: null, reveal: 1, highlight: true });
    };
    void run();
    return () => abort.abort();
    // the entry replays on a new step only; `subject` is the caller's closure of the moment
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, animate, callouts]);
  return entry;
}

/** The value a counting number shows at panel progress `t`: the value itself once the panel is built, so the final text is exact. */
export const counted = (value: number, t: number): number => (t >= 1 ? value : value * Math.max(0, t));

/** A progress 0 to 1 rounded up to `steps` steps (1 stays 1). */
export const quantize = (t: number, steps: number): number => Math.min(1, Math.ceil(Math.max(0, t) * steps) / steps);

/** The entry of one story step as a context: its state changes re-render only the components that read it (useEntry). */
export function EntryProvider({ entryKey, callouts, animate, subject, children }: { entryKey: string; callouts: number; animate: boolean; subject?: (t: number) => void; children: ReactNode }) {
  const entry = useStagedEntry(entryKey, callouts, animate, subject);
  return <EntryContext.Provider value={entry}>{children}</EntryContext.Provider>;
}
