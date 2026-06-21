import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useThemeStore } from '@fasl-work/caos-app-shell';
import { chamberProfile, profilePolylines, jawProfile } from '../physics/chamber';
import type { Operating } from '../physics/types';

// Interactive 3D crusher chamber. Two genuinely different machine kinds are drawn differently:
//  • SURFACE-OF-REVOLUTION (cone / gyratory / short-head): the fixed concave (wireframe lathe) + the gyrating
//    mantle (solid lathe whose axis NUTATES about a fixed pivot at the eccentric speed) + a kinematic particle
//    cloud that falls, is gripped near the discharge and breaks into finer fragments.
//  • JAW: a PLANAR two-plate mechanism — a near-vertical FIXED plate and an inclined SWING plate that pivots
//    about the overhead eccentric (so the throw is largest at the discharge, ~0 at the suspension) + particles
//    that fall through the converging V and break near the discharge.
// Drag to orbit. This is a KINEMATIC chamber animation (geometry + motion + the gradation the engine computes)
// — NOT a DEM solve; the physically-faithful trajectories are the offline DEM-trace upgrade.
const VIRIDIS = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
function viridis(t: number): THREE.Color {
  t = Math.max(0, Math.min(1, t)); const x = t * 4; const i = Math.min(3, Math.floor(x)); const f = x - i;
  const a = VIRIDIS[i], b = VIRIDIS[i + 1];
  return new THREE.Color((a[0] + f * (b[0] - a[0])) / 255, (a[1] + f * (b[1] - a[1])) / 255, (a[2] + f * (b[2] - a[2])) / 255);
}

export function Chamber3D({ op, p80, f80, height = 360 }: { op: Operating; p80: number; f80: number; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const W = el.clientWidth || 600, H = height;
    const dark = theme === 'dark';
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(45, W / H, 1, 8000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true; controls.autoRotate = false;  // the fixed liner is FIXED — no camera spin; user orbits manually

    scene.add(new THREE.AmbientLight(0xffffff, dark ? 0.7 : 0.9));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(1, 2, 1); scene.add(dl);

    const prof = chamberProfile(op.machine, op.cssMm, op.throwMm);
    const disposables: { dispose(): void }[] = [];
    const N = 900;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const sizeRel = new Float32Array(N), broke = new Uint8Array(N);
    let raf = 0, phase = 0;
    const fallSpeed = 5 + op.speedRpm / 40;
    const setColor = (i: number) => { const c = viridis(1 - sizeRel[i]); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; };

    let animate: () => void;

    if (prof.isRevolution) {
      // ---------- surface-of-revolution chamber (cone / gyratory / short-head) ----------
      cam.position.set(1500, 700, 1500); controls.target.set(0, prof.P.zTop * 0.45, 0);
      const { concave, mantle } = profilePolylines(prof, 48);
      const ccGeo = new THREE.LatheGeometry(concave.map(([r, z]) => new THREE.Vector2(r, z)), 64);
      const ccMat = new THREE.MeshBasicMaterial({ color: dark ? 0x3a4350 : 0x9aa6b2, wireframe: true, transparent: true, opacity: 0.5 });
      scene.add(new THREE.Mesh(ccGeo, ccMat)); disposables.push(ccGeo, ccMat);
      const mGeo = new THREE.LatheGeometry(mantle.map(([r, z]) => new THREE.Vector2(Math.max(6, r), z)), 48);
      const mMat = new THREE.MeshStandardMaterial({ color: 0x3fb950, metalness: 0.3, roughness: 0.6, flatShading: true });
      const mantleGroup = new THREE.Group(); mantleGroup.add(new THREE.Mesh(mGeo, mMat)); scene.add(mantleGroup); disposables.push(mGeo, mMat);

      const ang = new Float32Array(N), rad = new Float32Array(N);
      const reset = (i: number, top: boolean) => {
        ang[i] = Math.random() * Math.PI * 2;
        const z = (top ? 0.7 + Math.random() * 0.3 : Math.random()) * prof.P.zTop;
        const rc = prof.rConcave(z), rm = prof.rMantleClosed(z);
        rad[i] = rm + Math.random() * Math.max(8, rc - rm);
        pos[i * 3] = Math.cos(ang[i]) * rad[i]; pos[i * 3 + 1] = z; pos[i * 3 + 2] = Math.sin(ang[i]) * rad[i];
        sizeRel[i] = 0.5 + Math.random() * 0.5; broke[i] = 0; setColor(i);
      };
      for (let i = 0; i < N; i++) reset(i, false);
      const breakZone = prof.P.zTop * 0.32;
      animate = () => {
        phase += (op.speedRpm / 60) * 0.04;
        const ecc = Math.atan2(op.throwMm, prof.P.zTop) * 1.4;
        mantleGroup.rotation.set(0, 0, 0); mantleGroup.rotateY(phase); mantleGroup.rotateZ(ecc); mantleGroup.rotateY(-phase);
        for (let i = 0; i < N; i++) {
          pos[i * 3 + 1] -= fallSpeed;
          if (!broke[i] && pos[i * 3 + 1] < breakZone) { broke[i] = 1; sizeRel[i] *= 0.45; setColor(i); }
          if (pos[i * 3 + 1] < 0) reset(i, true);
          else { const z = pos[i * 3 + 1]; rad[i] = Math.max(prof.rMantleClosed(z), Math.min(prof.rConcave(z), rad[i])); pos[i * 3] = Math.cos(ang[i]) * rad[i]; pos[i * 3 + 2] = Math.sin(ang[i]) * rad[i]; }
        }
        geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
        pMat.size = 8 + 26 * Math.min(1, p80 / Math.max(1, f80));
        controls.update(); renderer.render(scene, cam);
        raf = requestAnimationFrame(animate);
      };
    } else {
      // ---------- planar jaw mechanism (fixed + swing plate, swing pivots at the overhead eccentric) ----------
      const j = jawProfile(op.machine, op.cssMm, op.throwMm);
      const zTop = j.P.zTop, depth = zTop * 0.6;   // jaw chamber width (extrusion depth)
      cam.position.set(1400, zTop * 0.5, 1600); controls.target.set(-j.gapeMm * 0.2, zTop * 0.45, 0);

      // a flat plate from bottom (x0,0) to top (x1,zTop), thin in x, deep in z. Returns the mesh.
      const makePlate = (x0: number, x1: number, color: number, opacity = 1) => {
        const L = Math.hypot(x1 - x0, zTop), phi = Math.atan2(-(x1 - x0), zTop);
        const g = new THREE.BoxGeometry(38, L, depth);
        const m = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.6, flatShading: true, transparent: opacity < 1, opacity });
        const mesh = new THREE.Mesh(g, m); mesh.rotation.z = phi; mesh.position.set((x0 + x1) / 2, zTop / 2, 0);
        disposables.push(g, m); return mesh;
      };
      // fixed plate (does not move)
      scene.add(makePlate(j.xFixed(0), j.xFixed(zTop), dark ? 0x6b7682 : 0x8a96a2));
      // swing plate inside a pivot group whose origin is the overhead eccentric at the top of the swing face
      const pivot = new THREE.Group();
      const pivotX = j.xSwing(zTop, 0.5), pivotY = zTop;
      pivot.position.set(pivotX, pivotY, 0);
      const swingMesh = makePlate(j.xSwing(0, 0.5) - pivotX, j.xSwing(zTop, 0.5) - pivotX, 0x3fb950);
      // its position was computed in world coords; shift into pivot-local (subtract pivot origin on y too)
      swingMesh.position.y -= pivotY;
      pivot.add(swingMesh); scene.add(pivot);
      // eccentric marker at the pivot
      const eGeo = new THREE.SphereGeometry(34, 16, 12); const eMat = new THREE.MeshStandardMaterial({ color: 0xf0883e });
      const eMesh = new THREE.Mesh(eGeo, eMat); eMesh.position.set(pivotX, pivotY, 0); scene.add(eMesh); disposables.push(eGeo, eMat);
      const swingAmp = (j.throwMm / 2) / zTop;   // small-angle pivot so the discharge swings ±throw/2

      // particles fall through the converging V, spread across the jaw width, break near the discharge
      const xWidth = new Float32Array(N);  // z position (across the jaw width)
      const reset = (i: number, top: boolean) => {
        const z = (top ? 0.7 + Math.random() * 0.3 : Math.random()) * zTop;
        const xF = j.xFixed(z), xS = j.xSwing(z, 0.5);
        pos[i * 3] = xS + Math.random() * (xF - xS);
        pos[i * 3 + 1] = z;
        xWidth[i] = (Math.random() - 0.5) * depth * 0.9;
        pos[i * 3 + 2] = xWidth[i];
        sizeRel[i] = 0.5 + Math.random() * 0.5; broke[i] = 0; setColor(i);
      };
      for (let i = 0; i < N; i++) reset(i, false);
      const breakZone = zTop * 0.3;
      animate = () => {
        phase += (op.speedRpm / 60) * 0.05;
        pivot.rotation.z = swingAmp * Math.sin(phase);   // single-toggle swing about the overhead eccentric
        for (let i = 0; i < N; i++) {
          pos[i * 3 + 1] -= fallSpeed;
          if (!broke[i] && pos[i * 3 + 1] < breakZone) { broke[i] = 1; sizeRel[i] *= 0.45; setColor(i); }
          if (pos[i * 3 + 1] < 0) reset(i, true);
          else { const z = pos[i * 3 + 1]; pos[i * 3] = Math.max(j.xSwing(z, 0.5), Math.min(j.xFixed(z), pos[i * 3])); pos[i * 3 + 2] = xWidth[i]; }
        }
        geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
        pMat.size = 8 + 26 * Math.min(1, p80 / Math.max(1, f80));
        controls.update(); renderer.render(scene, cam);
        raf = requestAnimationFrame(animate);
      };
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pMat = new THREE.PointsMaterial({ size: 18, vertexColors: true, sizeAttenuation: true });
    scene.add(new THREE.Points(geo, pMat)); disposables.push(geo, pMat);

    animate();
    const ro = new ResizeObserver(() => { const w = el.clientWidth || W; renderer.setSize(w, H); cam.aspect = w / H; cam.updateProjectionMatrix(); });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      for (const d of disposables) d.dispose();
      renderer.dispose(); el.removeChild(renderer.domElement);
    };
  }, [op, theme, height, p80, f80]);

  return (
    <div className="tz-canvas-wrap">
      <div ref={ref} style={{ width: '100%', height }} />
      <div className="tz-precomp-banner">Kinematic chamber animation · drag to orbit · particles coloured by size</div>
    </div>
  );
}
