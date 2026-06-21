// The case matrix — distinct, fully-configurable operating scenarios spanning the whole comminution circuit
// (manifest §caseMatrix). Each case is a complete Operating point; the workbench loads one and every view
// reacts. The sliders then let the user move freely off the preset. The set deliberately exercises all FIVE
// machine kinds (primary gyratory + jaw, secondary cone, tertiary cone + short-head) across soft↔hard ore,
// fine↔RoM feed, tight↔open settings and under/at/over the capacity-hump optimum — not two of everything.
// CP1 (pass-through) and CI1 (CSS>F80) are deliberate negative / invalid controls (the engine must show ≈zero
// reduction / flag invalidity, not a pretty plot); CK1 is the absolute-number calibration anchor.

import type { Operating } from '../physics/types';

export interface Case extends Operating {
  id: string;
  name: string;
  blurb: string;
  stage: 'primary' | 'secondary' | 'tertiary' | 'control';
  control?: 'negative' | 'invalid' | 'calibration';
}

export const CASES: Case[] = [
  // ---- PRIMARY: gyratory + jaw (coarse RoM feed, wide settings, slow) ----
  { id: 'G01', name: 'Gyratory primary · hard · RoM', stage: 'primary', blurb: 'Primary gyratory on hard RoM ore at an OSS-controlled wide setting — very high tonnage, slow gyration.', machine: 'gyratory', cssMm: 165, throwMm: 30, speedRpm: 150, feedX63Mm: 600, feedM: 0.8, oreAxb: 40, oreWi: 16 },
  { id: 'G02', name: 'Gyratory primary · soft · high-tonnage', stage: 'primary', blurb: 'Soft ore, open setting, near the slow gyratory optimum — maximum throughput, modest reduction.', machine: 'gyratory', cssMm: 195, throwMm: 32, speedRpm: 160, feedX63Mm: 700, feedM: 0.85, oreAxb: 78, oreWi: 12 },
  { id: 'J01', name: 'Jaw primary · hard · RoM', stage: 'primary', blurb: 'Primary jaw, hard ore, run-of-mine feed, wide setting (single-toggle ellipse, throw max at discharge).', machine: 'jaw', cssMm: 125, throwMm: 40, speedRpm: 300, feedX63Mm: 400, feedM: 0.9, oreAxb: 42, oreWi: 16 },
  { id: 'J02', name: 'Jaw primary · medium · trickle', stage: 'primary', blurb: 'Primary jaw, medium ore, coarse feed, trickle-fed below choke — low fill, near-CSS product.', machine: 'jaw', cssMm: 80, throwMm: 36, speedRpm: 280, feedX63Mm: 300, feedM: 1.0, oreAxb: 55, oreWi: 14 },

  // ---- SECONDARY: cone (the workhorse; S01 is the reference operating point shown on first load) ----
  { id: 'S01', name: 'Cone secondary · medium · choke', stage: 'secondary', blurb: 'Well-graded choke feed at the capacity optimum — the reference operating point.', machine: 'cone-sec', cssMm: 32, throwMm: 30, speedRpm: 360, feedX63Mm: 90, feedM: 1.2, oreAxb: 55, oreWi: 14 },
  { id: 'S02', name: 'Cone secondary · soft · coarse', stage: 'secondary', blurb: 'Soft ore, coarse feed, open setting, below-optimum speed.', machine: 'cone-sec', cssMm: 40, throwMm: 32, speedRpm: 300, feedX63Mm: 120, feedM: 1.0, oreAxb: 80, oreWi: 11 },
  { id: 'S03', name: 'Cone secondary · hard · over-speed', stage: 'secondary', blurb: 'Hard ore, coarse feed, wide setting, above-optimum speed (past the capacity hump — tonnage falls).', machine: 'cone-sec', cssMm: 50, throwMm: 30, speedRpm: 470, feedX63Mm: 130, feedM: 1.0, oreAxb: 38, oreWi: 17 },
  { id: 'S04', name: 'Cone secondary · hard · RoM', stage: 'secondary', blurb: 'Hard ore, run-of-mine feed, wide setting at the optimum — a heavy-duty secondary duty.', machine: 'cone-sec', cssMm: 80, throwMm: 36, speedRpm: 360, feedX63Mm: 180, feedM: 0.9, oreAxb: 40, oreWi: 16 },
  { id: 'S05', name: 'Cone secondary · fines-heavy', stage: 'secondary', blurb: 'Fines-heavy feed, tight setting — high reduction, fine product, packing risk.', machine: 'cone-sec', cssMm: 16, throwMm: 26, speedRpm: 360, feedX63Mm: 55, feedM: 1.6, oreAxb: 55, oreWi: 14 },
  { id: 'S06', name: 'Cone secondary · trickle-fed', stage: 'secondary', blurb: 'Tight setting, trickle (single-particle) feeding — low fill, near-CSS product, poor shape.', machine: 'cone-sec', cssMm: 12, throwMm: 22, speedRpm: 360, feedX63Mm: 60, feedM: 1.2, oreAxb: 55, oreWi: 14 },

  // ---- TERTIARY: cone-tertiary + short-head (fine feed, tight settings, fast) ----
  { id: 'T01', name: 'Cone tertiary · fines', stage: 'tertiary', blurb: 'Tertiary cone, fine feed, tight setting at its higher optimum speed.', machine: 'cone-tert', cssMm: 8, throwMm: 16, speedRpm: 400, feedX63Mm: 28, feedM: 1.5, oreAxb: 55, oreWi: 14 },
  { id: 'T02', name: 'Cone tertiary · hard · closed', stage: 'tertiary', blurb: 'Hard ore, very tight closed setting at the optimum — high reduction into the fine end.', machine: 'cone-tert', cssMm: 10, throwMm: 18, speedRpm: 410, feedX63Mm: 32, feedM: 1.4, oreAxb: 38, oreWi: 18 },
  { id: 'H01', name: 'Short-head tertiary · fine product', stage: 'tertiary', blurb: 'Short-head (long parallel zone, steep head): finest product, fast, smallest chamber — the cubicity duty.', machine: 'cone-short-head', cssMm: 6, throwMm: 14, speedRpm: 500, feedX63Mm: 22, feedM: 1.6, oreAxb: 55, oreWi: 14 },
  { id: 'H02', name: 'Short-head tertiary · hard · choke', stage: 'tertiary', blurb: 'Short-head choke-fed on hard ore — tightest classification, high specific energy.', machine: 'cone-short-head', cssMm: 10, throwMm: 16, speedRpm: 470, feedX63Mm: 30, feedM: 1.5, oreAxb: 36, oreWi: 18 },

  // ---- CONTROLS (must NOT render silent garbage) ----
  { id: 'CP1', name: 'Pass-through (negative control)', stage: 'control', blurb: 'CSS wider than F80 — material passes mostly ungripped. The engine must show ≈zero reduction, not a pretty plot, and flag the pass-through regime.', machine: 'cone-sec', cssMm: 160, throwMm: 30, speedRpm: 360, feedX63Mm: 90, feedM: 1.2, oreAxb: 55, oreWi: 14, control: 'negative' },
  { id: 'CI1', name: 'CSS > feed top (invalid control)', stage: 'control', blurb: 'CSS wider than the feed top size — physically meaningless. The engine must FLAG invalidity (conditioning / mass-closure / non-negativity guard), never render silent garbage.', machine: 'cone-sec', cssMm: 280, throwMm: 30, speedRpm: 360, feedX63Mm: 90, feedM: 1.2, oreAxb: 55, oreWi: 14, control: 'invalid' },
  { id: 'CK1', name: 'Calibration anchor (HP-class cone)', stage: 'control', blurb: 'Operating point matched to published industrial cone data (Duarte et al. 2021) for absolute-number calibration; kept disjoint from any held-out validation point.', machine: 'cone-sec', cssMm: 25, throwMm: 30, speedRpm: 350, feedX63Mm: 80, feedM: 1.15, oreAxb: 52, oreWi: 15, control: 'calibration' },
];

// Reference operating point shown on first load — the secondary-cone choke optimum (S01).
export const DEFAULT_CASE = CASES.find((c) => c.id === 'S01') ?? CASES[0];
