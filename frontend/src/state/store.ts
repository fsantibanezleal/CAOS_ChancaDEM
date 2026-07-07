// The single workbench store. A case preset or any slider writes the Operating point; `result` is the live
// engine evaluation every view reads. Pure + synchronous, the engine is sub-millisecond, so we recompute on
// each change rather than memoizing across the tree.
import { create } from 'zustand';
import { evaluate } from '../physics/engine';
import { CASES, DEFAULT_CASE, type Case } from '../data/cases';
import { HP500_SURVEYS, HP500_NOMINAL, HP500_ORE, x63FromF80, type RealSurvey } from '../data/real/hp500-minasrio';
import type { Operating, CrusherResult, Machine } from '../physics/types';

const opOf = (c: Case): Operating => ({
  machine: c.machine, cssMm: c.cssMm, throwMm: c.throwMm, speedRpm: c.speedRpm,
  feedX63Mm: c.feedX63Mm, feedM: c.feedM, oreAxb: c.oreAxb, oreWi: c.oreWi,
});

// Real-sample lane: an HP500 survey → an Operating point driven by its MEASURED CSS + f80. Throw and speed are the
// HP500 nominal constants (not published per survey); the feed is reconstructed from f80 via Rosin-Rammler; the
// ore hardness/Wi come from the itabirite blend. `calibrated: true` switches the engine to the Table-5 fit.
export type Source = 'synthetic' | 'real';
const opOfSurvey = (s: RealSurvey): Operating => ({
  machine: 'cone-sec',
  cssMm: s.measured.cssMm,
  throwMm: HP500_NOMINAL.throwMm,
  speedRpm: HP500_NOMINAL.speedRpm,
  feedX63Mm: x63FromF80(s.measured.f80Mm),
  feedM: 0.9,
  oreAxb: HP500_ORE.compact.axb,   // metadata only: calibrated t10 does not use A·b
  oreWi: HP500_ORE.blendWiKwhT,
  calibrated: true,
});

// Per-machine reference REGIME (mid-of-envelope), applied when the user switches machine so the operating
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
  source: Source;
  caseId: string;
  surveyIdx: number;            // 0..9 index into HP500_SURVEYS (Real lane)
  survey: RealSurvey | null;    // the selected real survey (null in Synthetic mode)
  op: Operating;
  result: CrusherResult;
  setSource: (s: Source) => void;
  setCase: (id: string) => void;
  setSurvey: (idx: number) => void;
  patch: (p: Partial<Operating>) => void;
  reset: () => void;
}

export const useWorkbench = create<WorkbenchState>((set) => ({
  source: 'synthetic',
  caseId: DEFAULT_CASE.id,
  surveyIdx: 0,
  survey: null,
  op: opOf(DEFAULT_CASE),
  result: evaluate(opOf(DEFAULT_CASE)),
  setSource: (source) => set((s) => {
    if (source === 'real') {
      const survey = HP500_SURVEYS[s.surveyIdx] ?? HP500_SURVEYS[0];
      const op = opOfSurvey(survey);
      return { source, survey, op, result: evaluate(op) };
    }
    const c = CASES.find((x) => x.id === s.caseId) ?? DEFAULT_CASE;
    const op = opOf(c);
    return { source, survey: null, op, result: evaluate(op) };
  }),
  setCase: (id) => {
    const c = CASES.find((x) => x.id === id) ?? DEFAULT_CASE;
    const op = opOf(c);
    set({ source: 'synthetic', survey: null, caseId: c.id, op, result: evaluate(op) });
  },
  setSurvey: (idx) => set(() => {
    const survey = HP500_SURVEYS[idx] ?? HP500_SURVEYS[0];
    const op = opOfSurvey(survey);
    return { source: 'real', surveyIdx: idx, survey, op, result: evaluate(op) };
  }),
  patch: (p) => set((s) => {
    // sliders only apply on the Synthetic lane; on the Real lane the operating point is fixed by the survey.
    if (s.source === 'real') return s;
    // switching machine snaps the regime params into that machine's envelope (keeping ore properties)
    const ref = p.machine && p.machine !== s.op.machine ? MACHINE_REF[p.machine] : undefined;
    const op = { ...s.op, ...ref, ...p };
    return { op, result: evaluate(op) };
  }),
  reset: () => { const op = opOf(DEFAULT_CASE); set({ source: 'synthetic', survey: null, caseId: DEFAULT_CASE.id, op, result: evaluate(op) }); },
}));
