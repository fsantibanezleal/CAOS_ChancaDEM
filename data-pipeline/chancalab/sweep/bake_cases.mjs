// Bake the 18-case circuit matrix through the SAME live TypeScript Whiten/Evertsson/Bond engine the browser runs,
// and write data/derived/case-results.json — the committed, deterministic per-case engine outputs the LIGHT Python
// pipeline reshapes into per-case replay traces + manifests (CONTRACT 2). Run after the SPA lives under frontend/:
//   node --import tsx data-pipeline/chancalab/sweep/bake_cases.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate } from '../../../frontend/src/physics/engine.ts';
import { CASES } from '../../../frontend/src/data/cases.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DERIVED = resolve(HERE, '../../../data/derived');
mkdirSync(DERIVED, { recursive: true });

const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 10000) / 10000;
const GRID = [1, 4, 8, 16, 32];

const cases = {};
for (const c of CASES) {
  const op = { machine: c.machine, cssMm: c.cssMm, throwMm: c.throwMm, speedRpm: c.speedRpm,
    feedX63Mm: c.feedX63Mm, feedM: c.feedM, oreAxb: c.oreAxb, oreWi: c.oreWi };
  const r = evaluate(op);
  cases[c.id] = {
    p80: r2(r.p80), p50: r2(r.p50), p20: r2(r.p20),
    pctPassing: Object.fromEntries(GRID.map((g) => [g, r4(r.pctPassing[g] ?? 0)])),
    tph: r2(r.throughputTph), kW: r2(r.powerKw),
    reduction: r2(r.reductionRatio), ecs: r4(r.specificEnergyKwhT),
    regime: r.regime, valid: r.valid, flags: r.flags ?? [],
  };
}
writeFileSync(resolve(DERIVED, 'case-results.json'),
  JSON.stringify({ schema: 'chancadem.caseresults/v1', n: Object.keys(cases).length, cases }));
console.log(`baked ${Object.keys(cases).length} case results -> data/derived/case-results.json`);
