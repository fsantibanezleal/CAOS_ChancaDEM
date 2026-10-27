// Camera fit for the chamber view. It fits the chamber's own geometry (the vertices of its meshes), not its bounding
// box: a surface of revolution leaves the corners of its box empty, and with perspective the box fit left the visible
// chamber a quarter of the stage's width (the G6 stage-fill failure). The distance is the smallest at which every
// vertex lies inside the frustum with a small margin, so whichever half-angle (vertical or horizontal) needs the larger
// distance binds and the chamber fills that axis; the target is moved so the silhouette is centred in the frame.
import { Vector3 } from 'three';

/** Room left around the chamber: it fills 1 / FIT_MARGIN of the half-frustum on its binding axis. */
export const FIT_MARGIN = 1.06;
/** From the target to the camera: the three-quarter view the shipped view used (x and z equal, a little above). */
const VIEW_DIR = new Vector3(0.72, 0.4, 0.72).normalize();
const FALLBACK = [new Vector3(-500, 0, -500), new Vector3(500, 1000, 500)];
const ITERATIONS = 6;

export interface Fit {
  position: Vector3;
  target: Vector3;
  near: number;
  far: number;
  distance: number;
  binding: 'vertical' | 'horizontal';
}

export function fitCamera(points: Vector3[], fovDeg: number, aspect: number): Fit {
  const pts = points.length > 0 ? points : FALLBACK;
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  const tanH = tanV * Math.max(aspect, 1e-3);
  const forward = VIEW_DIR.clone().negate();
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, forward).normalize();

  const lo = new Vector3(Infinity, Infinity, Infinity);
  const hi = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const p of pts) {
    lo.min(p);
    hi.max(p);
  }
  const target = lo.clone().add(hi).multiplyScalar(0.5);

  const c = new Vector3();
  let dV = 1;
  let dH = 1;
  const solve = () => {
    dV = 1;
    dH = 1;
    for (const p of pts) {
      c.copy(p).sub(target);
      const a = c.dot(VIEW_DIR);
      dV = Math.max(dV, a + (Math.abs(c.dot(up)) * FIT_MARGIN) / tanV);
      dH = Math.max(dH, a + (Math.abs(c.dot(right)) * FIT_MARGIN) / tanH);
    }
    return Math.max(dV, dH);
  };

  let distance = solve();
  for (let i = 0; i < ITERATIONS; i++) {
    // centre the silhouette: move the target by the middle of the projected extent
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) {
      c.copy(p).sub(target);
      const depth = Math.max(1e-3, distance - c.dot(VIEW_DIR));
      const nx = c.dot(right) / (depth * tanH);
      const ny = c.dot(up) / (depth * tanV);
      x0 = Math.min(x0, nx); x1 = Math.max(x1, nx);
      y0 = Math.min(y0, ny); y1 = Math.max(y1, ny);
    }
    target.addScaledVector(right, ((x0 + x1) / 2) * tanH * distance).addScaledVector(up, ((y0 + y1) / 2) * tanV * distance);
    distance = solve();
  }
  return {
    position: target.clone().addScaledVector(VIEW_DIR, distance),
    target,
    near: Math.max(1, distance / 200),
    far: distance * 12,
    distance,
    binding: dH > dV ? 'horizontal' : 'vertical',
  };
}
