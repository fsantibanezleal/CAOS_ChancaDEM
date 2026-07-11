import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { usePausedViz, useThemeStore } from '@fasl-work/caos-app-shell';
import { chamberProfile, profilePolylines, jawProfile } from '../physics/chamber';
import type { Operating } from '../physics/types';

// Interactive 3D crusher chamber. Two genuinely different machine kinds are drawn differently:
//  * SURFACE-OF-REVOLUTION (cone / gyratory / short-head): the fixed concave (wireframe lathe) + the gyrating
//    mantle (solid lathe whose axis NUTATES about a fixed pivot at the eccentric speed) + rocks that fall, are
//    gripped near the discharge and FRACTURE into finer fragments.
//  * JAW: a PLANAR two-plate mechanism, a near-vertical FIXED plate and an inclined SWING plate that pivots
//    about the overhead eccentric (throw largest at the discharge, ~0 at the suspension) + rocks that fall
//    through the converging V and fracture near the discharge.
// Rocks are low-poly instanced meshes; on breakage a rock shrinks and (fracture ON) SHATTERS into scattering
// shards, so the crushing reads visually. Camera fits the chamber and the POV PERSISTS across option changes
// (only "Reset view" re-fits). Autoplay on load for visual impact; the rAF still halts on a hidden tab (ADR-0059),
// so it is not a compute bomb. This is a KINEMATIC view of the geometry + motion + the gradation the engine
// computes, NOT a DEM solve; the physically-faithful trajectories are the offline DEM-trace upgrade.
const VIRIDIS = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
function viridis(t: number): THREE.Color {
  t = Math.max(0, Math.min(1, t)); const x = t * 4; const i = Math.min(3, Math.floor(x)); const f = x - i;
  const a = VIRIDIS[i], b = VIRIDIS[i + 1];
  return new THREE.Color((a[0] + f * (b[0] - a[0])) / 255, (a[1] + f * (b[1] - a[1])) / 255, (a[2] + f * (b[2] - a[2])) / 255);
}

// a jittered icosahedron reads as an irregular rock; flat-shaded, instanced (rotation varies each rock).
function makeRockGeometry(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 0).toNonIndexed();
  const p = g.attributes.position as THREE.BufferAttribute;
  const seen = new Map<string, [number, number, number]>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let j = seen.get(key);
    if (!j) { const s = 0.72 + Math.random() * 0.42; j = [p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s]; seen.set(key, j); }
    p.setXYZ(i, j[0], j[1], j[2]);
  }
  g.computeVertexNormals();
  return g;
}

function fitCamera(cam: THREE.PerspectiveCamera, controls: OrbitControls, box: THREE.Box3) {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1000;
  const dist = (maxDim / 2) / Math.tan((cam.fov * Math.PI) / 360) * 1.65;
  controls.target.copy(center);
  cam.position.set(center.x + dist * 0.72, center.y + dist * 0.4, center.z + dist * 0.72);
  cam.near = Math.max(1, dist / 200); cam.far = dist * 12; cam.updateProjectionMatrix();
  controls.update();
}

export function Chamber3D({ op, p80, f80, height = 620 }: { op: Operating; p80: number; f80: number; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useThemeStore((s) => s.theme);

  // viz controls (refs so changing them does NOT recreate the scene, which would reset the POV)
  const [speed, setSpeed] = useState(1.5);
  const [rockSize, setRockSize] = useState(1.3);
  const [fracture, setFracture] = useState(true);
  const speedRef = useRef(speed); speedRef.current = speed;
  const sizeRef = useRef(rockSize); sizeRef.current = rockSize;
  const fractureRef = useRef(fracture); fractureRef.current = fracture;

  const poseRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const resetViewRef = useRef<() => void>(() => {});

  const stepRef = useRef<(() => void) | null>(null);
  const viz = usePausedViz(() => { stepRef.current?.(); }, { loop: true, autoStart: true });

  useEffect(() => {
    const el = ref.current; if (!el) return;
    // Height is driven by the CSS on the mount div (responsive to the viewport), so read the ACTUAL rendered
    // height; the `height` prop is only a fallback before first layout. The ResizeObserver keeps it in sync.
    const W = el.clientWidth || 600, H = el.clientHeight || height;
    const dark = theme === 'dark';
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(45, W / H, 1, 20000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true; controls.autoRotate = false;

    scene.add(new THREE.AmbientLight(0xffffff, dark ? 0.7 : 0.9));
    const dl = new THREE.DirectionalLight(0xffffff, 0.85); dl.position.set(1, 2, 1.4); scene.add(dl);

    const prof = chamberProfile(op.machine, op.cssMm, op.throwMm);
    const disposables: { dispose(): void }[] = [];
    const chamberGroup = new THREE.Group(); scene.add(chamberGroup);

    // ---- rock instances (parents + shard pool) ----
    const NBASE = 560, MAX = 1500;
    const rockGeo = makeRockGeometry(); disposables.push(rockGeo);
    const rockMat = new THREE.MeshStandardMaterial({ metalness: 0.1, roughness: 0.85, flatShading: true }); disposables.push(rockMat);
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, MAX);
    rocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(rocks); disposables.push(rocks);
    const px = new Float32Array(MAX), py = new Float32Array(MAX), pz = new Float32Array(MAX);
    const size = new Float32Array(MAX), active = new Uint8Array(MAX), broke = new Uint8Array(MAX);
    const rx = new Float32Array(MAX), ry = new Float32Array(MAX), rz = new Float32Array(MAX);    // rotation phase
    const drx = new Float32Array(MAX), dry = new Float32Array(MAX), drz = new Float32Array(MAX);  // rotation rate
    const vx = new Float32Array(MAX), vy = new Float32Array(MAX), vz = new Float32Array(MAX);      // shard scatter velocity
    const ang = new Float32Array(MAX), rad = new Float32Array(MAX), xw = new Float32Array(MAX);    // machine-specific
    for (let i = 0; i < MAX; i++) { drx[i] = (Math.random() - 0.5) * 0.14; dry[i] = (Math.random() - 0.5) * 0.14; drz[i] = (Math.random() - 0.5) * 0.14; }

    const baseR = Math.max(14, prof.P.zTop * 0.023);
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
    const setColor = (i: number) => rocks.setColorAt(i, viridis(1 - size[i]));
    let shardCursor = NBASE;
    const fallSpeed = 5 + op.speedRpm / 40;

    // per-kind placement + horizontal clamp
    let place: (i: number, top: boolean) => void;
    let clamp: (i: number) => void;
    let breakZone = prof.P.zTop * 0.32;
    let mechStep: () => void;

    if (prof.isRevolution) {
      const { concave, mantle } = profilePolylines(prof, 48);
      const ccGeo = new THREE.LatheGeometry(concave.map(([r, z]) => new THREE.Vector2(r, z)), 64);
      const ccMat = new THREE.MeshBasicMaterial({ color: dark ? 0x3a4350 : 0x9aa6b2, wireframe: true, transparent: true, opacity: 0.5 });
      chamberGroup.add(new THREE.Mesh(ccGeo, ccMat)); disposables.push(ccGeo, ccMat);
      const mGeo = new THREE.LatheGeometry(mantle.map(([r, z]) => new THREE.Vector2(Math.max(6, r), z)), 48);
      const mMat = new THREE.MeshStandardMaterial({ color: 0x3fb950, metalness: 0.3, roughness: 0.6, flatShading: true });
      const mantleGroup = new THREE.Group(); mantleGroup.add(new THREE.Mesh(mGeo, mMat)); chamberGroup.add(mantleGroup); disposables.push(mGeo, mMat);
      breakZone = prof.P.zTop * 0.32;
      place = (i, top) => {
        ang[i] = Math.random() * Math.PI * 2;
        const z = (top ? 0.72 + Math.random() * 0.28 : Math.random()) * prof.P.zTop;
        const rc = prof.rConcave(z), rm = prof.rMantleClosed(z);
        rad[i] = rm + Math.random() * Math.max(8, rc - rm);
        px[i] = Math.cos(ang[i]) * rad[i]; py[i] = z; pz[i] = Math.sin(ang[i]) * rad[i];
        size[i] = 0.55 + Math.random() * 0.45; broke[i] = 0; vx[i] = vy[i] = vz[i] = 0;
      };
      clamp = (i) => { const z = Math.max(0, py[i]); rad[i] = Math.max(prof.rMantleClosed(z), Math.min(prof.rConcave(z), rad[i])); px[i] = Math.cos(ang[i]) * rad[i]; pz[i] = Math.sin(ang[i]) * rad[i]; };
      let phase = 0;
      mechStep = () => {
        phase += (op.speedRpm / 60) * 0.04 * speedRef.current;
        const ecc = Math.atan2(op.throwMm, prof.P.zTop) * 1.4;
        mantleGroup.rotation.set(0, 0, 0); mantleGroup.rotateY(phase); mantleGroup.rotateZ(ecc); mantleGroup.rotateY(-phase);
      };
    } else {
      const j = jawProfile(op.machine, op.cssMm, op.throwMm);
      const zTop = j.P.zTop, depth = zTop * 0.6;
      const makePlate = (x0: number, x1: number, color: number) => {
        const L = Math.hypot(x1 - x0, zTop), phi = Math.atan2(-(x1 - x0), zTop);
        const g = new THREE.BoxGeometry(38, L, depth);
        const m = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.6, flatShading: true });
        const mesh = new THREE.Mesh(g, m); mesh.rotation.z = phi; mesh.position.set((x0 + x1) / 2, zTop / 2, 0);
        disposables.push(g, m); return mesh;
      };
      chamberGroup.add(makePlate(j.xFixed(0), j.xFixed(zTop), dark ? 0x6b7682 : 0x8a96a2));
      const pivot = new THREE.Group();
      const pivotX = j.xSwing(zTop, 0.5), pivotY = zTop; pivot.position.set(pivotX, pivotY, 0);
      const swingMesh = makePlate(j.xSwing(0, 0.5) - pivotX, j.xSwing(zTop, 0.5) - pivotX, 0x3fb950);
      swingMesh.position.y -= pivotY; pivot.add(swingMesh); chamberGroup.add(pivot);
      const eGeo = new THREE.SphereGeometry(34, 16, 12); const eMat = new THREE.MeshStandardMaterial({ color: 0xf0883e });
      const eMesh = new THREE.Mesh(eGeo, eMat); eMesh.position.set(pivotX, pivotY, 0); chamberGroup.add(eMesh); disposables.push(eGeo, eMat);
      const swingAmp = (j.throwMm / 2) / zTop;
      breakZone = zTop * 0.3;
      place = (i, top) => {
        const z = (top ? 0.72 + Math.random() * 0.28 : Math.random()) * zTop;
        const xF = j.xFixed(z), xS = j.xSwing(z, 0.5);
        px[i] = xS + Math.random() * (xF - xS); py[i] = z; xw[i] = (Math.random() - 0.5) * depth * 0.9; pz[i] = xw[i];
        size[i] = 0.55 + Math.random() * 0.45; broke[i] = 0; vx[i] = vy[i] = vz[i] = 0;
      };
      clamp = (i) => { const z = Math.max(0, py[i]); px[i] = Math.max(j.xSwing(z, 0.5), Math.min(j.xFixed(z), px[i])); pz[i] = xw[i]; };
      let phase = 0;
      mechStep = () => { phase += (op.speedRpm / 60) * 0.05 * speedRef.current; pivot.rotation.z = swingAmp * Math.sin(phase); };
    }

    for (let i = 0; i < NBASE; i++) { active[i] = 1; place(i, false); }
    for (let i = NBASE; i < MAX; i++) active[i] = 0;

    const spawnShards = (parent: number) => {
      const k = 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let s = 0; s < k; s++) {
        let slot = -1;
        for (let t = 0; t < MAX - NBASE; t++) { const c = NBASE + ((shardCursor - NBASE + t) % (MAX - NBASE)); if (!active[c]) { slot = c; break; } }
        if (slot < 0) return; shardCursor = slot + 1;
        active[slot] = 1; broke[slot] = 1;
        px[slot] = px[parent]; py[slot] = py[parent]; pz[slot] = pz[parent];
        ang[slot] = ang[parent]; rad[slot] = rad[parent]; xw[slot] = pz[parent];
        size[slot] = Math.max(0.12, size[parent] * (0.4 + Math.random() * 0.3));
        vx[slot] = (Math.random() - 0.5) * 26; vy[slot] = Math.random() * 10; vz[slot] = (Math.random() - 0.5) * 26;
        setColor(slot);
      }
    };

    const step = () => {
      mechStep();
      const spd = speedRef.current, rs = sizeRef.current, frac = fractureRef.current;
      const fall = fallSpeed * spd;
      for (let i = 0; i < MAX; i++) {
        if (!active[i]) { _s.setScalar(0); _m.compose(_v.set(0, -1e5, 0), _q.identity(), _s); rocks.setMatrixAt(i, _m); continue; }
        rx[i] += drx[i] * spd; ry[i] += dry[i] * spd; rz[i] += drz[i] * spd;
        const isShard = i >= NBASE;
        py[i] -= fall;
        if (isShard) { px[i] += vx[i] * spd; py[i] += vy[i] * spd; pz[i] += vz[i] * spd; vx[i] *= 0.9; vy[i] = vy[i] * 0.9 - 0.6 * spd; vz[i] *= 0.9; }
        if (!broke[i] && py[i] < breakZone) { broke[i] = 1; size[i] *= 0.55; setColor(i); if (frac) spawnShards(i); }
        if (py[i] < 0) {
          if (isShard) { active[i] = 0; continue; }
          place(i, true); setColor(i);
        } else if (!isShard) clamp(i);
        const r = baseR * (0.4 + 0.7 * size[i]) * rs;
        _e.set(rx[i], ry[i], rz[i]); _q.setFromEuler(_e); _s.setScalar(r);
        _m.compose(_v.set(px[i], py[i], pz[i]), _q, _s); rocks.setMatrixAt(i, _m);
      }
      rocks.instanceMatrix.needsUpdate = true;
      if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
      controls.update(); renderer.render(scene, cam);
    };

    // initial colors + one frame
    for (let i = 0; i < MAX; i++) { size[i] = size[i] || 0.6; setColor(i); }
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;

    // camera: restore persisted POV, else fit the chamber; expose reset
    const box = new THREE.Box3().setFromObject(chamberGroup);
    if (poseRef.current) { cam.position.copy(poseRef.current.pos); controls.target.copy(poseRef.current.target); cam.updateProjectionMatrix(); controls.update(); }
    else fitCamera(cam, controls, box);
    resetViewRef.current = () => { poseRef.current = null; fitCamera(cam, controls, box); renderer.render(scene, cam); };
    controls.addEventListener('change', () => { poseRef.current = { pos: cam.position.clone(), target: controls.target.clone() }; renderer.render(scene, cam); });

    stepRef.current = step;
    step();

    const ro = new ResizeObserver(() => { const w = el.clientWidth || W, h = el.clientHeight || H; renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); renderer.render(scene, cam); });
    ro.observe(el);
    return () => {
      stepRef.current = null; resetViewRef.current = () => {}; ro.disconnect(); controls.dispose();
      for (const d of disposables) d.dispose();
      renderer.dispose(); el.removeChild(renderer.domElement);
    };
  }, [op, theme, height, p80, f80]);

  return (
    <div className="tz-canvas-wrap">
      {/* Responsive: fill the available workbench height (the bottom controls are compact), not a fixed box. */}
      <div ref={ref} style={{ width: '100%', height: 'clamp(460px, 74vh, 900px)' }} />
      <div className="tz-precomp-banner">
        <button type="button" className="btn" onClick={() => (viz.playing ? viz.pause() : viz.play())}>{viz.playing ? 'Pause' : 'Play'}</button>
        <span>Kinematic chamber, drag to orbit, rocks coloured by size</span>
      </div>
      <div className="tz-viz-controls">
        <label>speed
          <input type="range" min={0.25} max={4} step={0.25} value={speed} onChange={(e) => setSpeed(+e.target.value)} />
          <b>{speed.toFixed(2)}x</b>
        </label>
        <label>rock size
          <input type="range" min={0.5} max={2.5} step={0.1} value={rockSize} onChange={(e) => setRockSize(+e.target.value)} />
          <b>{rockSize.toFixed(1)}x</b>
        </label>
        <button type="button" className={`btn${fracture ? ' on' : ''}`} onClick={() => setFracture((v) => !v)} aria-pressed={fracture}>
          {fracture ? 'Fracture on' : 'Fracture off'}
        </button>
        <button type="button" className="btn" onClick={() => resetViewRef.current()}>Reset view</button>
      </div>
    </div>
  );
}
