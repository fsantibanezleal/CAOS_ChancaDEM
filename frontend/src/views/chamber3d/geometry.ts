// The chamber of one machine, drawn from engine/chamber.ts. Two kinds, as in the shipped view:
//  * surface of revolution (cone, short-head, gyratory): the fixed concave (wireframe lathe) and the gyrating mantle
//    (solid lathe whose axis nutates about a fixed pivot at the eccentric speed);
//  * jaw: a planar mechanism, a near-vertical fixed plate and an inclined swing plate pivoting about the overhead
//    eccentric (throw largest at the discharge, about zero at the suspension).
// Each chamber names its four selectable parts (M9 of the 0.13.000 review): the concave (the fixed plate of a jaw), the mantle (the
// swing plate), the gap at the closed side (a ring at the discharge, a bar between the plates of a jaw) and the feed (a cone above
// the chamber), each with its meshes for the raycast and the point its label stands on. The chamber's own meshes cast shadows on the
// scene's ground; the markers are added after the camera fit's points, so the fit frames the chamber, not its labels.
import { BoxGeometry, ConeGeometry, DoubleSide, Group, LatheGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector2, Vector3, type BufferGeometry, type Color } from 'three';
import { chamberProfile, jawProfile, profilePolylines } from '../../engine/chamber';
import type { Operating } from '../../engine/types';
import type { ScenePalette } from './palette';
import { DEFAULT_VIEW_DIR } from './fit';
import type { Placer } from './rocks';

export interface Disposable {
  dispose(): void;
}

/** The selectable parts of a chamber (linked ids "part:<id>", shared with the section in views/chamber.tsx). */
export type PartId = 'mantle' | 'concave' | 'gap' | 'feed';
export const PART_IDS: readonly PartId[] = ['mantle', 'concave', 'gap', 'feed'];

export interface ChamberPartMesh {
  meshes: Mesh[];
  /** Where the part's label stands, in world space, on the side the camera looks from. */
  at: Vector3;
  /** The materials that light up when the part is selected. */
  materials: MeshStandardMaterial[];
}

export interface Chamber {
  group: Group;
  parts: Record<PartId, ChamberPartMesh>;
  /** The vertices of the chamber's own meshes at rest (world space), for the camera fit. */
  points: Vector3[];
  /** From the target to the camera: the view the chamber is framed in. */
  viewDir: Vector3;
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
  // the concave is a lit shell seen through (its inside faces too), with its wireframe kept as the structure's lines
  const ccMat = new MeshStandardMaterial({ color: palette.concave, metalness: 0.2, roughness: 0.75, transparent: true, opacity: 0.32, side: DoubleSide, depthWrite: false });
  const ccWireMat = new MeshBasicMaterial({ color: palette.concave, wireframe: true, transparent: true, opacity: 0.35 });
  const ccMesh = new Mesh(ccGeo, ccMat);
  ccMesh.castShadow = true;
  const ccWire = new Mesh(ccGeo, ccWireMat);
  group.add(ccMesh, ccWire);
  const mGeo = new LatheGeometry(mantle.map(([r, z]) => new Vector2(Math.max(6, r), z)), 48);
  const mMat = new MeshStandardMaterial({ color: palette.mantle, metalness: 0.3, roughness: 0.55, flatShading: true });
  const mantleGroup = new Group();
  const mMesh = new Mesh(mGeo, mMat);
  mMesh.castShadow = true;
  mMesh.receiveShadow = true;
  mantleGroup.add(mMesh);
  group.add(mantleGroup);
  disposables.push(ccGeo, ccMat, ccWireMat, mGeo, mMat);
  const points = meshPoints(group);
  // the parts' markers and label points, toward the camera's side of the axis
  const toward = Math.atan2(DEFAULT_VIEW_DIR.z, DEFAULT_VIEW_DIR.x);
  const onSide = (r: number, z: number) => new Vector3(Math.cos(toward) * r, z, Math.sin(toward) * r);
  const zGap = 6;
  const rc0 = prof.rConcave(zGap);
  const rm0 = Math.max(6, prof.rMantleClosed(zGap));
  const gapGeo = new TorusGeometry((rc0 + rm0) / 2, Math.max(4, (rc0 - rm0) * 0.32), 10, 64);
  const gapMat = new MeshStandardMaterial({ color: palette.eccentric, metalness: 0.1, roughness: 0.5, transparent: true, opacity: 0.85 });
  const gapMesh = new Mesh(gapGeo, gapMat);
  gapMesh.rotation.x = Math.PI / 2;
  gapMesh.position.y = zGap;
  group.add(gapMesh);
  const feedH = zTop * 0.16;
  const feedGeo = new ConeGeometry(feedH * 0.32, feedH, 24);
  const feedMat = new MeshStandardMaterial({ color: palette.plateFixed, metalness: 0.1, roughness: 0.6 });
  const feedMesh = new Mesh(feedGeo, feedMat);
  feedMesh.rotation.x = Math.PI;
  const feedAt = onSide((prof.rConcave(zTop) + Math.max(6, prof.rMantleClosed(zTop))) / 2, zTop - feedH * 0.35);
  feedMesh.position.copy(feedAt);
  feedMesh.castShadow = true;
  group.add(feedMesh);
  disposables.push(gapGeo, gapMat, feedGeo, feedMat);
  const parts: Record<PartId, ChamberPartMesh> = {
    // the concave's label stands at its silhouette, a quarter turn from the camera's side: a click there meets the concave alone (a click
    // through its near wall to the mantle or the gap picks those, the scene's pick rule)
    concave: {
      meshes: [ccMesh],
      at: new Vector3(Math.cos(toward + Math.PI / 2) * prof.rConcave(zTop * 0.6) * 0.99, zTop * 0.6, Math.sin(toward + Math.PI / 2) * prof.rConcave(zTop * 0.6) * 0.99),
      materials: [ccMat],
    },
    mantle: { meshes: [mMesh], at: onSide(Math.max(6, prof.rMantleClosed(zTop * 0.35)), zTop * 0.35), materials: [mMat] },
    gap: { meshes: [gapMesh], at: onSide((rc0 + rm0) / 2, zGap), materials: [gapMat] },
    feed: { meshes: [feedMesh], at: feedAt.clone(), materials: [feedMat] },
  };

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
    parts,
    points,
    viewDir: DEFAULT_VIEW_DIR.clone(),
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
      ccWireMat.color.copy(p.concave);
      mMat.color.copy(p.mantle);
      gapMat.color.copy(p.eccentric);
      feedMat.color.copy(p.plateFixed);
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
    mesh.castShadow = true;
    mesh.receiveShadow = true;
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
  const xGapL = j.xSwing(0, 0);
  const xGapR = j.xFixed(0);
  // the bar spans the discharge and stands out of the plates' front, where its label is
  const gapGeo = new BoxGeometry(Math.max(8, xGapR - xGapL), 10, depth * 1.2);
  const gapMat = new MeshStandardMaterial({ color: palette.eccentric, metalness: 0.1, roughness: 0.5, transparent: true, opacity: 0.85 });
  const gapMesh = new Mesh(gapGeo, gapMat);
  gapMesh.position.set((xGapL + xGapR) / 2, 4, 0);
  group.add(gapMesh);
  const feedH = zTop * 0.16;
  const feedGeo = new ConeGeometry(feedH * 0.32, feedH, 24);
  const feedMat = new MeshStandardMaterial({ color: palette.plateFixed, metalness: 0.1, roughness: 0.6 });
  const feedMesh = new Mesh(feedGeo, feedMat);
  feedMesh.rotation.x = Math.PI;
  feedMesh.position.set((j.xSwing(zTop, 0.5) + j.xFixed(zTop)) / 2, zTop - feedH * 0.35, 0);
  feedMesh.castShadow = true;
  group.add(feedMesh);
  disposables.push(gapGeo, gapMat, feedGeo, feedMat);
  const parts: Record<PartId, ChamberPartMesh> = {
    concave: { meshes: [fixed.mesh], at: new Vector3(j.xFixed(zTop * 0.6), zTop * 0.6, depth / 2), materials: [fixed.mat] },
    mantle: { meshes: [swing.mesh], at: new Vector3(j.xSwing(zTop * 0.4, 0.5), zTop * 0.4, depth / 2), materials: [swing.mat] },
    gap: { meshes: [gapMesh], at: new Vector3((xGapL + xGapR) / 2, 4, depth * 0.59), materials: [gapMat] },
    feed: { meshes: [feedMesh], at: feedMesh.position.clone(), materials: [feedMat] },
  };

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
    parts,
    points,
    // the jaw is two plates of a planar mechanism: a higher, more oblique view opens the V and shows the plates' depth
    viewDir: new Vector3(0.72, 1.3, 0.43),
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
      gapMat.color.copy(p.eccentric);
      feedMat.color.copy(p.plateFixed);
    },
    movingColor: () => swing.mat.color,
    disposables,
  };
}

export function buildChamber(op: Operating, palette: ScenePalette): Chamber {
  return chamberProfile(op.machine, op.cssMm, op.throwMm).isRevolution ? buildRevolution(op, palette) : buildJaw(op, palette);
}
