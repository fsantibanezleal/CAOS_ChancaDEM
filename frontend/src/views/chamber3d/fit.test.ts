import { readdirSync, readFileSync } from 'node:fs';
import { Box3, Color, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Operating } from '../../engine/types';
import { buildChamber } from './geometry';
import { FIT_MARGIN, fitCamera } from './fit';
import type { ScenePalette } from './palette';

const PAL: ScenePalette = {
  ramp: [new Color(1, 0, 0), new Color(0, 0, 1)],
  concave: new Color(0.5, 0.5, 0.5),
  mantle: new Color(0, 1, 0),
  plateFixed: new Color(0.6, 0.6, 0.6),
  plateSwing: new Color(0, 1, 0),
  eccentric: new Color(1, 0.5, 0),
  ambient: 0.8,
};
const OP: Operating = { machine: 'cone-sec', cssMm: 20, throwMm: 24, speedRpm: 240, feedX63Mm: 80, feedM: 1.4, oreAxb: 45, oreWi: 14 };
const MACHINES = ['cone-sec', 'cone-tert', 'cone-short-head', 'gyratory', 'jaw'] as const;
const ASPECTS = [0.5, 1, 2, 3];

/** Corners of a gyratory-sized box, for the pure tests of the maths. */
function corners(box: Box3): Vector3[] {
  const out: Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) out.push(new Vector3(x, y, z));
  return out;
}
const BOX_POINTS = corners(new Box3(new Vector3(-560, -150, -560), new Vector3(560, 1500, 560)));

function camAt(fit: ReturnType<typeof fitCamera>, aspect: number, fov: number): PerspectiveCamera {
  const cam = new PerspectiveCamera(fov, aspect, fit.near, fit.far);
  cam.position.copy(fit.position);
  cam.lookAt(fit.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

/** The projected extent of the points in normalised device coordinates. */
function extent(points: Vector3[], cam: PerspectiveCamera) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const p of points) {
    const n = p.clone().project(cam);
    x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x);
    y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y);
    z1 = Math.max(z1, n.z);
  }
  return { x0, x1, y0, y1, z1 };
}

describe('camera fit on points', () => {
  for (const aspect of [0.5, 1, 3]) {
    it(`keeps every point of a box inside the frustum at aspect ${aspect}`, () => {
      const fit = fitCamera(BOX_POINTS, 45, aspect);
      const e = extent(BOX_POINTS, camAt(fit, aspect, 45));
      for (const v of [e.x0, e.x1, e.y0, e.y1]) expect(Math.abs(v)).toBeLessThanOrEqual(1 / FIT_MARGIN + 1e-6);
      expect(e.z1).toBeLessThan(1);
    });
  }

  it('is bound by the horizontal half-angle in a tall panel and by the vertical one in a wide panel', () => {
    expect(fitCamera(BOX_POINTS, 45, 0.5).binding).toBe('horizontal');
    expect(fitCamera(BOX_POINTS, 45, 3).binding).toBe('vertical');
  });

  it('never divides by a zero aspect or an empty point list', () => {
    expect(Number.isFinite(fitCamera(BOX_POINTS, 45, 0).distance)).toBe(true);
    expect(Number.isFinite(fitCamera([], 45, 1).distance)).toBe(true);
  });

  it('keeps near and far around the distance', () => {
    const fit = fitCamera(BOX_POINTS, 45, 1.6);
    expect(fit.near).toBeGreaterThanOrEqual(1);
    expect(fit.far).toBeGreaterThan(fit.distance * 2);
  });
});

describe('camera fit on the real chambers', () => {
  for (const machine of MACHINES) {
    const chamber = buildChamber({ ...OP, machine }, PAL);
    for (const aspect of ASPECTS) {
      it(`${machine} at aspect ${aspect}: inside the frame, filling the binding axis, centred`, () => {
        const fit = fitCamera(chamber.points, 45, aspect, chamber.viewDir);
        const e = extent(chamber.points, camAt(fit, aspect, 45));
        const m = 1 / FIT_MARGIN;
        for (const v of [e.x0, e.x1, e.y0, e.y1]) expect(Math.abs(v)).toBeLessThanOrEqual(m + 1e-3);
        // the binding axis is filled to the margin, on both sides
        const spanX = e.x1 - e.x0;
        const spanY = e.y1 - e.y0;
        expect(Math.max(spanX, spanY)).toBeGreaterThan(2 * m - 0.02);
        // centred: the silhouette is not pushed to one side
        expect(Math.abs(e.x0 + e.x1)).toBeLessThan(0.06);
        expect(Math.abs(e.y0 + e.y1)).toBeLessThan(0.06);
      });
    }
    it(`${machine} in a 2:1 stage covers at least 30% of it with its projected box (the G6 floor)`, () => {
      const fit = fitCamera(chamber.points, 45, 2, chamber.viewDir);
      const e = extent(chamber.points, camAt(fit, 2, 45));
      expect(((e.x1 - e.x0) * (e.y1 - e.y0)) / 4).toBeGreaterThanOrEqual(0.3);
    });
  }
});

describe('framing of every committed case (the G6 stage-fill floor with a margin)', () => {
  const dir = new URL('../../../../data/derived/manifests/', import.meta.url);
  const ids = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json');
  const ops = ids.map((f) => {
    const m = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { case_id: string; params: Record<string, number | string | boolean> };
    const p = m.params;
    const op: Operating = {
      machine: p.machine as Operating['machine'],
      cssMm: p.css_mm as number,
      throwMm: p.throw_mm as number,
      speedRpm: p.speed_rpm as number,
      feedX63Mm: p.feed_x63_mm as number,
      feedM: p.feed_m as number,
      oreAxb: p.ore_axb as number,
      oreWi: p.ore_wi as number,
    };
    return { id: m.case_id, op };
  });
  // the stage of the Chamber view at 1280 x 800 measures 964 x 458 (964 x 416 under a flagged case's alert line); the larger gate sizes are about 2:1
  const STAGES = [880 / 460, 1000 / 520, 1.9, 2.1, 964 / 458, 964 / 416];

  it('finds the committed cases', () => {
    expect(ops.length).toBeGreaterThanOrEqual(27);
  });
  for (const aspect of STAGES) {
    it(`every case and every machine covers at least 35% of a stage of aspect ${aspect.toFixed(2)}`, () => {
      const low: string[] = [];
      const all = [...ops, ...MACHINES.map((machine) => ({ id: `default ${machine}`, op: { ...OP, machine } }))];
      for (const { id, op } of all) {
        const chamber = buildChamber(op, PAL);
        const pts = chamber.points;
        const fit = fitCamera(pts, 45, aspect, chamber.viewDir);
        const e = extent(pts, camAt(fit, aspect, 45));
        const cover = ((e.x1 - e.x0) * (e.y1 - e.y0)) / 4;
        if (cover < 0.35) low.push(`${id} ${(100 * cover).toFixed(1)}%`);
      }
      expect(low).toEqual([]);
    });
  }
  it('keeps every case inside the frame at aspects 0.5 to 3', () => {
    for (const { op } of ops) {
      const chamber = buildChamber(op, PAL);
      const pts = chamber.points;
      for (const aspect of ASPECTS) {
        const e = extent(pts, camAt(fitCamera(pts, 45, aspect, chamber.viewDir), aspect, 45));
        for (const v of [e.x0, e.x1, e.y0, e.y1]) expect(Math.abs(v)).toBeLessThanOrEqual(1 / FIT_MARGIN + 1e-3);
      }
    }
  });
});
