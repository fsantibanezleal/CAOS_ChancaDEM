// Bridge the SAME live TypeScript engine the browser runs onto the 10 real HP500 / Minas Rio surveys and write
// data/derived/hp500/backbone.json, the committed per-survey backbone outputs the Python CrusherCal LOO validator
// (chancalab.hp500.loo) reads. This keeps the TypeScript engine the SINGLE source of physics truth: the backbone
// predictions the held-out validation grades are exactly what the app computes live, never a Python re-derivation.
//
// For every survey we emit the calibrated backbone {p80, tph, bond_pd, calibrated_kw} AND the bare-Bond draw
// (the raw Bond net comminution power, no plant recalibration) so the benchmark can show, honestly, how far each
// power estimate sits from the MEASURED kW. No metric is asserted here; the numbers speak for themselves downstream.
//
//   node --import tsx data-pipeline/chancalab/sweep/bake_hp500.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate } from '../../../frontend/src/physics/engine.ts';
import { bondPower } from '../../../frontend/src/physics/capacity.ts';
import { HP500_SURVEYS, HP500_NOMINAL, HP500_ORE, HP500_SOURCE, x63FromF80 } from '../../../frontend/src/data/real/hp500-minasrio.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../../../data/derived/hp500');
mkdirSync(OUT, { recursive: true });

const r2 = (x) => Math.round(x * 100) / 100;

// The Real-lane operating point, identical construction to state/store.ts opOfSurvey (single source of the mapping).
const opOfSurvey = (s) => ({
  machine: 'cone-sec',
  cssMm: s.measured.cssMm,
  throwMm: HP500_NOMINAL.throwMm,
  speedRpm: HP500_NOMINAL.speedRpm,
  feedX63Mm: x63FromF80(s.measured.f80Mm),
  feedM: 0.9,
  oreAxb: HP500_ORE.compact.axb,
  oreWi: HP500_ORE.blendWiKwhT,
  calibrated: true,
});

const surveys = HP500_SURVEYS.map((s) => {
  const op = opOfSurvey(s);
  const r = evaluate(op);
  // The raw Bond net draw the engine's calibratedPower scales; recomputed here so the benchmark can contrast it.
  const bondPd = bondPower(r.throughputTph, r.f80, r.p80, op.oreWi);
  return {
    id: s.id,
    n: s.n,
    // MEASURED ground truth (Table A1)
    measured: { cssMm: s.measured.cssMm, f80Mm: s.measured.f80Mm, tph: s.measured.feedRateTph, kW: s.measured.powerKW },
    // BACKBONE (the live calibrated TypeScript engine) predictions
    backbone: {
      p80: r2(r.p80),               // derived (no independent measurement; self-consistency target)
      tph: r2(r.throughputTph),     // calibrated Evertsson capacity (HP500 base), primary measured target
      bondPd: r2(bondPd),           // raw Bond net comminution draw [kW]
      calibratedKw: r2(r.powerKw),  // engine calibratedPower(bondPd) = 1.30*Pd + 110 (paper form on OUR Bond Pd)
      f80Model: r2(r.f80),          // engine feed f80 from the reconstructed feed
    },
  };
});

const payload = {
  schema: 'chancadem.hp500.backbone/v1',
  source: { paper: HP500_SOURCE.paper, doi: HP500_SOURCE.doi, license: HP500_SOURCE.license, table: 'A1 (measured) + 5 (fit)' },
  note: 'Backbone = the live calibrated TypeScript Whiten/Evertsson/Bond engine on each real survey. Measured t/h and '
    + 'kW are ground truth; P80 is a model output (paper PSD curves are figure-only), graded as self-consistency. '
    + 'The paper power constants zeta=1.30, Pn=110 apply to the paper size-specific Pd, NOT the classical Bond draw here.',
  n: surveys.length,
  surveys,
};

writeFileSync(resolve(OUT, 'backbone.json'), JSON.stringify(payload, null, 2) + '\n');
console.log(`baked ${surveys.length} HP500 backbone rows -> data/derived/hp500/backbone.json`);
