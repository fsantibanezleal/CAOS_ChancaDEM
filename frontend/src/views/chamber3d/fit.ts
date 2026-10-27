// Camera fit for the chamber view. The shipped view sized the distance from the largest box side and one half-angle;
// this one projects the eight corners of the box on the camera's own axes, so the whole box lies inside the frustum
// at any aspect, and whichever half-angle (vertical or horizontal) needs the larger distance is the one that binds.
import { Box3, Vector3 } from 'three';

/** Room left around the chamber: the box fills at most 1 / FIT_MARGIN of the half-frustum on its binding axis. */
export const FIT_MARGIN = 1.12;
/** From the target to the camera: the three-quarter view the shipped view used (x and z equal, a little above). */
const VIEW_DIR = new Vector3(0.72, 0.4, 0.72).normalize();
const FALLBACK_SIZE = 1000;

export interface Fit {
  position: Vector3;
  target: Vector3;
  near: number;
  far: number;
  distance: number;
  binding: 'vertical' | 'horizontal';
}

export function fitCamera(box: Box3, fovDeg: number, aspect: number): Fit {
  const b = box.isEmpty() ? new Box3(new Vector3(-FALLBACK_SIZE / 2, 0, -FALLBACK_SIZE / 2), new Vector3(FALLBACK_SIZE / 2, FALLBACK_SIZE, FALLBACK_SIZE / 2)) : box;
  const target = b.getCenter(new Vector3());
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  const tanH = tanV * Math.max(aspect, 1e-3);
  // camera axes for a camera on VIEW_DIR looking at the target, y up
  const forward = VIEW_DIR.clone().negate();
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, forward).normalize();
  let dV = 0;
  let dH = 0;
  const c = new Vector3();
  for (const x of [b.min.x, b.max.x]) {
    for (const y of [b.min.y, b.max.y]) {
      for (const z of [b.min.z, b.max.z]) {
        c.set(x, y, z).sub(target);
        const towardCamera = c.dot(VIEW_DIR);
        dV = Math.max(dV, towardCamera + (Math.abs(c.dot(up)) * FIT_MARGIN) / tanV);
        dH = Math.max(dH, towardCamera + (Math.abs(c.dot(right)) * FIT_MARGIN) / tanH);
      }
    }
  }
  const binding = dH > dV ? 'horizontal' : 'vertical';
  const distance = Math.max(dH, dV, 1);
  return {
    position: target.clone().addScaledVector(VIEW_DIR, distance),
    target,
    near: Math.max(1, distance / 200),
    far: distance * 12,
    distance,
    binding,
  };
}
