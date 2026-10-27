import { describe, expect, it } from 'vitest';
import { readPalette } from './palette';

describe('palette from the shell tokens', () => {
  it('reads each colour from a token and never from a literal', () => {
    const asked: string[] = [];
    const resolve = (t: string) => {
      asked.push(t);
      return t === '--color-good' ? 'rgb(0, 255, 0)' : 'rgb(10, 20, 30)';
    };
    const p = readPalette('dark', resolve);
    expect(asked).toContain('--color-good');
    expect(asked.every((t) => t.startsWith('--color-'))).toBe(true);
    expect(p.mantle.toArray()[1]).toBeGreaterThan(p.mantle.toArray()[0]);
    expect(p.ramp.length).toBe(3);
  });
  it('lights a light theme more strongly than a dark one', () => {
    const r = () => 'rgb(1, 2, 3)';
    expect(readPalette('light', r).ambient).toBeGreaterThan(readPalette('dark', r).ambient);
  });
  it('survives a missing token (outside a browser) with a neutral grey', () => {
    const p = readPalette('dark', () => '');
    expect(p.concave.r).toBeGreaterThan(0);
    expect(Number.isFinite(p.mantle.g)).toBe(true);
  });
});
