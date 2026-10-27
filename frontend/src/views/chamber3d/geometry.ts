// The chamber of one machine, drawn from engine/chamber.ts. Two kinds, as in the shipped view:
//  * surface of revolution (cone, short-head, gyratory): the fixed concave (wireframe lathe) and the gyrating mantle
//    (solid lathe whose axis nutates about a fixed pivot at the eccentric speed);
//  * jaw: a planar mechanism, a near-vertical fixed plate and an inclined swing plate pivoting about the overhead
//    eccentric (throw largest at the discharge, about zero at the suspension).
import { BoxGeometry, Group, LatheGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, Vector2, Vector3, type BufferGeometry, type Color } from 'three';
import { chamberProfile, jawProfile, profilePolylines } from '../../engine/chamber';
import type { Operating } from '../../engine/types';
import type { ScenePalette } from './palette';
import type { Placer } from './rocks';

export interface Disposable {
  dispose(): void;
}

export interface Chamber {
  group: Group;
  /** The vertices of the chamber's own meshes at rest (world space), for the camera fit. */
  points: Vector3[];
  placer: Placer;
  zTop: number;
  /** Advances the machine's motion by k frames at animation speed spd. */
  mech: (k: number, spd: number) => void;
  recolor: (p: ScenePalette) => void;
  /** The colour of the moving part (mantle, swing plate). */
  movingColor: () => Color;
  disposables: Disposable[];
}

/** World-space vertices of every mesh under `group`, in its current pose: the chamber's real extent, not its box. */
export function meshPoints(group: Group): Vector3[] {
  group.updateMatrixWorld(true);
  const out: Vector3[] = [];
  group.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const pos = (mesh.geometry as BufferGeometry).getAttribute('position');
    for (let i = 0; i < pos.count; i++) out.push(new Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  });
  return out;
}

function buildRevolution(op: Operating, palette: ScenePalette): Chamber {
  const prof = chamberProfile(op.machine, op.cssMm, op.throwMm);
  const zTop = prof.P.zTop;
  const group = new Group();
  const disposables: Disposable[] = [];
  const { concave, mantle } = profilePolylines(prof, 48);
  const ccGeo = new LatheGeometry(concave.map(([r, z]) => new Vector2(r, z)), 64);
  const ccMat = new MeshBasicMaterial({ color: palette.concave, wireframe: true, transparent: true, opacity: 0.5 });
  group.add(new Mesh(ccGeo, ccMat));
  const mGeo = new LatheGeometry(mantle.map(([r, z]) => new Vector2(Math.max(6, r), z)), 48);
  const mMat = new MeshStandardMaterial({ color: palette.mantle, metalness: 0.3, roughness: 0.6, flatShading: true });
  const mantleGroup = new Group();
  mantleGroup.add(new Mesh(mGeo, mMat));
  group.add(mantleGroup);
  disposables.push(ccGeo, ccMat, mGeo, mMat);
  const points = meshPoints(group);

  const placer: Placer = {
    breakZone: zTop * 0.32,
    place: (f, i, top) => {
      f.ang[i] = f.rand() * Math.PI * 2;
      const z = (top ? 0.72 + f.rand() * 0.28 : f.rand()) * zTop;
      const rc = prof.rConcave(z);
      const rm = prof.rMantleClosed(z);
      f.rad[i] = rm + f.rand() * Math.max(8, rc - rm);
      f.px[i] = Math.cos(f.ang[i]) * f.rad[i];
      f.py[i] = z;
      f.pz[i] = Math.sin(f.ang[i]) * f.rad[i];
      f.size[i] = 0.55 + f.rand() * 0.45;
    },
    clamp: (f, i) => {
      const z = Math.max(0, f.py[i]);
      f.rad[i] = Math.max(prof.rMantleClosed(z), Math.min(prof.rConcave(z), f.rad[i]));
      f.px[i] = Math.cos(f.ang[i]) * f.rad[i];
      f.pz[i] = Math.sin(f.ang[i]) * f.rad[i];
    },
  };
  let phase = 0;
  const ecc = Math.atan2(op.throwMm, zTop) * 1.4;
  return {
    group,
    points,
    placer,
    zTop,
    mech: (k, spd) => {
      phase += (op.speedRpm / 60) * 0.04 * spd * k;
      mantleGroup.rotation.set(0, 0, 0);
      mantleGroup.rotateY(phase);
      mantleGroup.rotateZ(ecc);
      mantleGroup.rotateY(-phase);
    },
    recolor: (p) => {
      ccMat.color.copy(p.concave);
      mMat.color.copy(p.mantle);
    },
    movingColor: () => mMat.color,
    disposables,
  };
}

function buildJaw(op: Operating, palette: ScenePalette): Chamber {
  const j = jawProfile(op.machine, op.cssMm, op.throwMm);
  const zTop = j.P.zTop;
  const depth = zTop * 0.6;
  const group = new Group();
  const disposables: Disposable[] = [];
  const makePlate = (x0: number, x1: number, color: Color) => {
    const L = Math.hypot(x1 - x0, zTop);
    const phi = Math.atan2(-(x1 - x0), zTop);
    const g = new BoxGeometry(38, L, depth);
    const m = new MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.6, flatShading: true });
    const mesh = new Mesh(g, m);
    mesh.rotation.z = phi;
    mesh.position.set((x0 + x1) / 2, zTop / 2, 0);
    disposables.push(g, m);
    return { mesh, mat: m };
  };
  const fixed = makePlate(j.xFixed(0), j.xFixed(zTop), palette.plateFixed);
  group.add(fixed.mesh);
  const pivot = new Group();
  const pivotX = j.xSwing(zTop, 0.5);
  const pivotY = zTop;
  pivot.position.set(pivotX, pivotY, 0);
  const swing = makePlate(j.xSwing(0, 0.5) - pivotX, j.xSwing(zTop, 0.5) - pivotX, palette.plateSwing);
  swing.mesh.position.y -= pivotY;
  pivot.add(swing.mesh);
  group.add(pivot);
  const eGeo = new SphereGeometry(34, 16, 12);
  const eMat = new MeshStandardMaterial({ color: palette.eccentric });
  const eMesh = new Mesh(eGeo, eMat);
  eMesh.position.set(pivotX, pivotY, 0);
  group.add(eMesh);
  disposables.push(eGeo, eMat);
  const points = meshPoints(group);
  const swingAmp = j.throwMm / 2 / zTop;

  const placer: Placer = {
    breakZone: zTop * 0.3,
    place: (f, i, top) => {
      const z = (top ? 0.72 + f.rand() * 0.28 : f.rand()) * zTop;
      const xF = j.xFixed(z);
      const xS = j.xSwing(z, 0.5);
      f.px[i] = xS + f.rand() * (xF - xS);
      f.py[i] = z;
      f.xw[i] = (f.rand() - 0.5) * depth * 0.9;
      f.pz[i] = f.xw[i];
      f.size[i] = 0.55 + f.rand() * 0.45;
    },
    clamp: (f, i) => {
      const z = Math.max(0, f.py[i]);
      f.px[i] = Math.max(j.xSwing(z, 0.5), Math.min(j.xFixed(z), f.px[i]));
      f.pz[i] = f.xw[i];
    },
  };
  let phase = 0;
  return {
    group,
    points,
    placer,
    zTop,
    mech: (k, spd) => {
      phase += (op.speedRpm / 60) * 0.05 * spd * k;
      pivot.rotation.z = swingAmp * Math.sin(phase);
    },
    recolor: (p) => {
      fixed.mat.color.copy(p.plateFixed);
      swing.mat.color.copy(p.plateSwing);
      eMat.color.copy(p.eccentric);
    },
    movingColor: () => swing.mat.color,
    disposables,
  };
}

export function buildChamber(op: Operating, palette: ScenePalette): Chamber {
  return chamberProfile(op.machine, op.cssMm, op.throwMm).isRevolution ? buildRevolution(op, palette) : buildJaw(op, palette);
}
