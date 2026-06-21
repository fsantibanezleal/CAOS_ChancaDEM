// The single workbench store. A case preset or any slider writes the Operating point; `result` is the live
// engine evaluation every view reads. Pure + synchronous — the engine is sub-millisecond, so we recompute on
// each change rather than memoizing across the tree.
import { create } from 'zustand';
import { evaluate } from '../physics/engine';
import { CASES, DEFAULT_CASE, type Case } from '../data/cases';
import type { Operating, CrusherResult, Machine } from '../physics/types';

const opOf = (c: Case): Operating => ({
  machine: c.machine, cssMm: c.cssMm, throwMm: c.throwMm, speedRpm: c.speedRpm,
  feedX63Mm: c.feedX63Mm, feedM: c.feedM, oreAxb: c.oreAxb, oreWi: c.oreWi,
});

// Per-machine reference REGIME (mid-of-envelope) — applied when the user switches machine so the operating
// point stays physically sensible (a gyratory never sits at a 32 mm CSS). Only the machine-dependent geometry /
// speed / feed-size snap; the ore properties (feedM grading, oreAxb hardness) are carried over unchanged.
const MACHINE_REF: Record<Machine, Pick<Operating, 'cssMm' | 'throwMm' | 'speedRpm' | 'feedX63Mm'>> = {
  'cone-sec':        { cssMm: 32, throwMm: 30, speedRpm: 360, feedX63Mm: 90 },
  'cone-tert':       { cssMm: 8, throwMm: 16, speedRpm: 400, feedX63Mm: 28 },
  'cone-short-head': { cssMm: 8, throwMm: 16, speedRpm: 480, feedX63Mm: 28 },
  'gyratory':        { cssMm: 165, throwMm: 30, speedRpm: 150, feedX63Mm: 600 },
  'jaw':             { cssMm: 110, throwMm: 38, speedRpm: 290, feedX63Mm: 350 },
};

interface WorkbenchState {
  caseId: string;
  op: Operating;
  result: CrusherResult;
  setCase: (id: string) => void;
  patch: (p: Partial<Operating>) => void;
  reset: () => void;
}

export const useWorkbench = create<WorkbenchState>((set) => ({
  caseId: DEFAULT_CASE.id,
  op: opOf(DEFAULT_CASE),
  result: evaluate(opOf(DEFAULT_CASE)),
  setCase: (id) => {
    const c = CASES.find((x) => x.id === id) ?? DEFAULT_CASE;
    const op = opOf(c);
    set({ caseId: c.id, op, result: evaluate(op) });
  },
  patch: (p) => set((s) => {
    // switching machine snaps the regime params into that machine's envelope (keeping ore properties)
    const ref = p.machine && p.machine !== s.op.machine ? MACHINE_REF[p.machine] : undefined;
    const op = { ...s.op, ...ref, ...p };
    return { op, result: evaluate(op) };
  }),
  reset: () => { const op = opOf(DEFAULT_CASE); set({ caseId: DEFAULT_CASE.id, op, result: evaluate(op) }); },
}));
