import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { FIT_MARGIN, fitCamera } from './fit';

const BOX = new Box3(new Vector3(-560, -150, -560), new Vector3(560, 1500, 560)); // a gyratory-sized chamber

function camAt(fit: ReturnType<typeof fitCamera>, aspect: number, fov: number): PerspectiveCamera {
  const cam = new PerspectiveCamera(fov, aspect, fit.near, fit.far);
  cam.position.copy(fit.position);
  cam.lookAt(fit.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

function corners(box: Box3): Vector3[] {
  const out: Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) out.push(new Vector3(x, y, z));
  return out;
}

describe('camera fit', () => {
  for (const aspect of [0.5, 1, 3]) {
    it(`keeps the whole bounding box inside the frustum at aspect ${aspect}`, () => {
      const fit = fitCamera(BOX, 45, aspect);
      const cam = camAt(fit, aspect, 45);
      for (const c of corners(BOX)) {
        const n = c.clone().project(cam);
        expect(Math.abs(n.x)).toBeLessThanOrEqual(1 / FIT_MARGIN + 1e-6);
        expect(Math.abs(n.y)).toBeLessThanOrEqual(1 / FIT_MARGIN + 1e-6);
        expect(n.z).toBeLessThan(1);
      }
    });
  }

  it('is bound by the horizontal half-angle in a tall panel and by the vertical one in a wide panel', () => {
    expect(fitCamera(BOX, 45, 0.5).binding).toBe('horizontal');
    expect(fitCamera(BOX, 45, 3).binding).toBe('vertical');
  });

  it('backs off further when the narrower half-angle binds', () => {
    const wide = fitCamera(BOX, 45, 3).distance;
    const square = fitCamera(BOX, 45, 1).distance;
    const tall = fitCamera(BOX, 45, 0.5).distance;
    expect(tall).toBeGreaterThan(square);
    expect(square).toBeGreaterThanOrEqual(wide);
  });

  it('centres the target on the box and keeps near and far around the distance', () => {
    const fit = fitCamera(BOX, 45, 1.6);
    expect(fit.target.toArray()).toEqual(BOX.getCenter(new Vector3()).toArray());
    expect(fit.near).toBeGreaterThanOrEqual(1);
    expect(fit.far).toBeGreaterThan(fit.distance * 2);
  });

  it('never divides by a zero aspect or an empty box', () => {
    expect(Number.isFinite(fitCamera(BOX, 45, 0).distance)).toBe(true);
    expect(Number.isFinite(fitCamera(new Box3(), 45, 1).distance)).toBe(true);
  });
});
