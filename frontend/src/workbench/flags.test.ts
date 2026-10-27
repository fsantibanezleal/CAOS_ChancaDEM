// engine/flags.ts: every code of the manifest schema's flags enum and every code the engine's envelope emits has
// bilingual text, and the engine's own flag sentences map to the codes the pipeline writes into the manifest.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../engine/engine';
import { ALL_FLAG_CODES, flagCodesOf, flagText } from '../engine/flags';
import type { Operating } from '../engine/types';
import { FLAG_CODES } from '../lib/contract.types';

const schema = JSON.parse(readFileSync(new URL('../../../docs/contracts/schemas/case-manifest.schema.json', import.meta.url), 'utf8')) as {
  properties: { flags: { items: { enum: string[] } } };
};
const reference = JSON.parse(readFileSync(new URL('../../../tests/fixtures/engine-reference.json', import.meta.url), 'utf8')) as {
  points: Array<{ id: string; op: Operating }>;
};

describe('the flag codes', () => {
  it('are exactly the enum of the manifest schema', () => {
    expect([...ALL_FLAG_CODES]).toEqual(schema.properties.flags.items.enum);
    expect([...FLAG_CODES]).toEqual(schema.properties.flags.items.enum);
  });
  it('each has a sentence in English and in Spanish, written without arrows or dashes', () => {
    for (const code of ALL_FLAG_CODES) {
      for (const lang of ['en', 'es'] as const) {
        const t = flagText(code, lang);
        expect(t.length, `${code} ${lang}`).toBeGreaterThan(12);
        expect(t, `${code} ${lang}`).not.toMatch(/[—→←↔⇒]|--/);
      }
      expect(flagText(code, 'es'), code).not.toBe(flagText(code, 'en'));
    }
  });
  it("adversarial: every flag the engine raised on every reference point maps to a code, in the engine's order; none is dropped", () => {
    let seen = 0;
    for (const p of reference.points) {
      const r = evaluate(p.op);
      const codes = flagCodesOf(r);
      expect(codes.length, p.id).toBe(r.flags.length);
      seen += codes.length;
      for (const c of codes) expect(ALL_FLAG_CODES, p.id).toContain(c);
    }
    expect(seen).toBeGreaterThan(20);
  });
  it('the reference points raise every code but the one that is unreachable by construction', () => {
    const raised = new Set(reference.points.flatMap((p) => flagCodesOf(evaluate(p.op))));
    const never = ALL_FLAG_CODES.filter((c) => !raised.has(c));
    // ill_conditioned cannot be reached (reference.test.ts documents why); every other code is raised
    expect(never).toEqual(['ill_conditioned']);
  });
  it('adversarial: a flag sentence the map does not know is refused, not shown as nothing', () => {
    const r = evaluate(reference.points[0].op);
    expect(() => flagCodesOf({ ...r, flags: ['a sentence the engine never wrote'] })).toThrow(/unknown engine flag/);
  });
});
