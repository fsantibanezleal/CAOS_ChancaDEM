import { Color, IcosahedronGeometry, InstancedMesh, MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { breakShrink, findFreeSlot, rampColor, RockField, rockColorT, rockRadius, shardCount, shardSize, type Placer } from './rocks';

const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length];
};

describe('rock size and colour from the gradation', () => {
  it('shrinks a rock by the square root of the engine reduction, within 0.25 and 0.85', () => {
    expect(breakShrink(25, 100)).toBeCloseTo(0.5, 6);
    expect(breakShrink(1, 100)).toBe(0.25);
    expect(breakShrink(99, 100)).toBe(0.85);
  });
  it('falls back to the shipped 0.55 when the gradation is unusable', () => {
    expect(breakShrink(Number.NaN, 100)).toBe(0.55);
    expect(breakShrink(10, 0)).toBe(0.55);
    expect(breakShrink(-3, 50)).toBe(0.55);
  });
  it('maps size to colour position: the coarsest is 0, the finest is near 1', () => {
    expect(rockColorT(1)).toBe(0);
    expect(rockColorT(0.2)).toBeCloseTo(0.8, 6);
    expect(rockColorT(5)).toBe(0);
    expect(rockColorT(-1)).toBe(1);
  });
  it('interpolates a ramp of token colours piecewise-linearly', () => {
    const stops = [new Color(1, 0, 0), new Color(0, 1, 0), new Color(0, 0, 1)];
    const out = new Color();
    expect(rampColor(stops, 0, out).toArray()).toEqual([1, 0, 0]);
    expect(rampColor(stops, 1, out).toArray()).toEqual([0, 0, 1]);
    const mid = rampColor(stops, 0.25, out).toArray();
    expect(mid[0]).toBeCloseTo(0.5, 6);
    expect(mid[1]).toBeCloseTo(0.5, 6);
  });
  it('scales the drawn radius with the size, the base radius and the control', () => {
    expect(rockRadius(1, 10, 2)).toBeCloseTo(10 * 1.1 * 2, 6);
    expect(rockRadius(0.5, 10, 1)).toBeLessThan(rockRadius(1, 10, 1));
  });
});

describe('shard spawn rule', () => {
  it('spawns two shards, or three when the draw is under one half', () => {
    expect(shardCount(() => 0.2)).toBe(3);
    expect(shardCount(() => 0.8)).toBe(2);
  });
  it('sizes a shard at 0.4 to 0.7 of its parent and never under 0.12', () => {
    expect(shardSize(1, () => 0)).toBeCloseTo(0.4, 6);
    expect(shardSize(1, () => 1)).toBeCloseTo(0.7, 6);
    expect(shardSize(0.1, () => 0)).toBe(0.12);
  });
  it('finds a free slot from the cursor, wrapping inside the shard pool, and -1 when full', () => {
    const active = new Uint8Array(10).fill(1);
    expect(findFreeSlot(active, 4, 10, 4)).toBe(-1);
    active[5] = 0;
    expect(findFreeSlot(active, 4, 10, 4)).toBe(5);
    active[5] = 1;
    active[4] = 0;
    expect(findFreeSlot(active, 4, 10, 8)).toBe(4);
  });
});

function makeField(opts: { gripped: boolean }) {
  const mesh = new InstancedMesh(new IcosahedronGeometry(1, 0), new MeshBasicMaterial(), 40);
  const placer: Placer = {
    breakZone: 300,
    place: (f, i, top) => {
      f.px[i] = 0;
      f.py[i] = top ? 900 : 100 + i * 20;
      f.pz[i] = 0;
      f.size[i] = 0.8;
    },
    clamp: () => {},
  };
  const stops = [new Color(1, 0, 0), new Color(0, 0, 1)];
  const field = new RockField({ mesh, placer, nBase: 10, max: 40, baseR: 10, fallPerFrame: 20, shrink: 0.5, gripped: opts.gripped, ramp: stops, rand: seq(0.3, 0.6, 0.9) });
  return { field, mesh };
}

describe('the rock field', () => {
  it('breaks a rock below the break zone: it shrinks and, with Fracture on, spawns shards', () => {
    const { field } = makeField({ gripped: true });
    const before = field.activeCount();
    field.step(1, 1, 1, true);
    expect(field.activeCount()).toBeGreaterThan(before);
    expect(field.size[0]).toBeCloseTo(0.4, 6);
  });
  it('spawns no shards with Fracture off', () => {
    const { field } = makeField({ gripped: true });
    const before = field.activeCount();
    field.step(1, 1, 1, false);
    expect(field.activeCount()).toBe(before);
  });
  it('grips nothing at an invalid point: rocks fall through unbroken', () => {
    const { field } = makeField({ gripped: false });
    for (let n = 0; n < 5; n++) field.step(1, 1, 1, true);
    expect(field.activeCount()).toBe(10);
    for (let i = 0; i < 10; i++) expect(field.broke[i]).toBe(0);
  });
  it('does not move anything when the time step is zero (the static first frame)', () => {
    const { field } = makeField({ gripped: true });
    const py = Array.from(field.py.slice(0, 10));
    field.step(0, 1, 1, true);
    expect(Array.from(field.py.slice(0, 10))).toEqual(py);
  });
  it('recolours every instance from a new ramp', () => {
    const { field, mesh } = makeField({ gripped: true });
    field.setRamp([new Color(0, 1, 0), new Color(0, 1, 0)]);
    const c = new Color();
    mesh.getColorAt(0, c);
    expect(c.toArray()).toEqual([0, 1, 0]);
  });
});
