// The linked selection of the App and the story (ADR-0082 section 6; the catalog's "linked views" column; plan decision D-10), on the
// shell's linked-view store, never a store of the product's own:
// - the shell's LinkedViewProvider (App.tsx) holds the selected object, a namespaced id ("class:<i>" for a size class, "stage:<id>"
//   for a stage of the circuit, "stream:<id>" for a stream, "part:<id>" for a part of the chamber, "method:<id>" for a method of the
//   comparison, "survey:<id>" for a held-out survey), and its cursor is the pass count of the population balance (V5 and V3);
// - the hours cursor of the campaign (V4, read by V2 and V3) is a second instance of the same shell store (createLinkedViewStore), so
//   scrubbing the passes never moves the hours and the reverse.
// The case itself is the workbench's selection (?case=), which every view reads, so a survey selected in the comparison is the case of
// the circuit and the gradation by construction.
import { createLinkedViewStore, useLinkedView, type LinkedViewStore, type SelectionOrigin } from '@fasl-work/caos-app-shell';
import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useStore } from 'zustand';

export type LinkedKind = 'class' | 'stage' | 'stream' | 'part' | 'method' | 'survey';

/** The id of a linked object of one kind. */
export const linkedId = (kind: LinkedKind, key: string | number): string => `${kind}:${key}`;

/** The key of the selected object when it is of this kind, else null. */
export function selectedOf(selectedId: string | null, kind: LinkedKind): string | null {
  if (!selectedId) return null;
  const at = selectedId.indexOf(':');
  return at > 0 && selectedId.slice(0, at) === kind ? selectedId.slice(at + 1) : null;
}

/** The selected size class (its index on the coarse-to-fine sieve grid), or null. */
export function selectedClass(selectedId: string | null, n: number): number | null {
  const key = selectedOf(selectedId, 'class');
  if (key === null || !/^\d+$/.test(key)) return null;
  const i = Number(key);
  return i < n ? i : null;
}

/** The pass count of the population balance from the shared cursor: the number of size classes (the exact product) when unset. */
export function passCount(cursor: number | null, n: number): number {
  if (cursor === null || !Number.isFinite(cursor)) return n;
  return Math.max(0, Math.min(n, Math.round(cursor)));
}

/** The selection and the pass cursor of the shell's store, with the actions the views call. */
export function useLinkedSelection() {
  const selectedId = useLinkedView((s) => s.selectedId);
  const cursor = useLinkedView((s) => s.cursor);
  const select = useLinkedView((s) => s.select);
  const scrub = useLinkedView((s) => s.scrub);
  return { selectedId, cursor, select: (id: string | null, origin: SelectionOrigin) => select(id, origin), scrub };
}

const HoursContext = createContext<LinkedViewStore | null>(null);

/** The hours cursor of the campaign: a second shell linked-view store, so the passes and the hours are scrubbed apart. */
export function HoursProvider({ children, initial }: { children: ReactNode; initial?: number | null }) {
  const ref = useRef<LinkedViewStore | null>(null);
  if (!ref.current) ref.current = createLinkedViewStore({ cursor: initial ?? null });
  return <HoursContext.Provider value={ref.current}>{children}</HoursContext.Provider>;
}

const FALLBACK = createLinkedViewStore();

/** The hours cursor [h] and its setter; null until the reader scrubs (the views then draw the current state, hour zero). */
export function useHours(): { hours: number | null; setHours: (h: number | null) => void } {
  const store = useContext(HoursContext) ?? FALLBACK;
  const hours = useStore(store, (s) => s.cursor);
  const scrub = useStore(store, (s) => s.scrub);
  return { hours, setHours: scrub };
}
