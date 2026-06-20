import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useThemeStore } from '@fasl-work/caos-app-shell';
import { chamberProfile, profilePolylines } from '../physics/chamber';
import type { Operating } from '../physics/types';

// Interactive 3D crusher chamber: the fixed concave (wireframe lathe) + the gyrating mantle (solid lathe whose
// axis NUTATES about a fixed pivot at the eccentric speed) + a kinematic particle cloud that falls, is gripped
// near the discharge and breaks into finer (recoloured) fragments. Drag to orbit. This is a KINEMATIC chamber
// animation (it visualizes the geometry + motion + the gradation the live engine computes) — NOT a DEM solve;
// the physically-faithful particle trajectories are the offline DEM-trace upgrade.
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
    cam.position.set(1500, 700, 1500);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true; controls.target.set(0, 350, 0); controls.autoRotate = false;  // concave is FIXED in a real crusher — no camera spin; user orbits manually

    scene.add(new THREE.AmbientLight(0xffffff, dark ? 0.7 : 0.9));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(1, 2, 1); scene.add(dl);

    const prof = chamberProfile(op.machine, op.cssMm, op.throwMm);
    const { concave, mantle } = profilePolylines(prof, 48);
    // concave: wireframe lathe (revolve the (r,z) profile)
    const ccPts = concave.map(([r, z]) => new THREE.Vector2(r, z));
    const ccGeo = new THREE.LatheGeometry(ccPts, 64);
    const ccMat = new THREE.MeshBasicMaterial({ color: dark ? 0x3a4350 : 0x9aa6b2, wireframe: true, transparent: true, opacity: 0.5 });
    scene.add(new THREE.Mesh(ccGeo, ccMat));
    // mantle: solid lathe, set into a group we nutate
    const mPts = mantle.map(([r, z]) => new THREE.Vector2(Math.max(6, r), z));
    const mGeo = new THREE.LatheGeometry(mPts, 48);
    const mMat = new THREE.MeshStandardMaterial({ color: 0x3fb950, metalness: 0.3, roughness: 0.6, flatShading: true });
    const mantleMesh = new THREE.Mesh(mGeo, mMat);
    const mantleGroup = new THREE.Group(); mantleGroup.add(mantleMesh); scene.add(mantleGroup);

    // particle cloud — colour by size (viridis), fall + break near discharge
    const N = 900;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const sizeRel = new Float32Array(N);   // 0 fine .. 1 coarse
    const ang = new Float32Array(N), rad = new Float32Array(N), broke = new Uint8Array(N);
    const reset = (i: number, top: boolean) => {
      ang[i] = Math.random() * Math.PI * 2;
      const zt = top ? 0.7 + Math.random() * 0.3 : Math.random();
      const z = zt * prof.P.zTop;
      const rc = prof.rConcave(z), rm = prof.rMantleClosed(z);
      rad[i] = rm + Math.random() * Math.max(8, rc - rm);
      pos[i * 3] = Math.cos(ang[i]) * rad[i]; pos[i * 3 + 1] = z; pos[i * 3 + 2] = Math.sin(ang[i]) * rad[i];
      sizeRel[i] = 0.5 + Math.random() * 0.5; broke[i] = 0;
      const c = viridis(1 - sizeRel[i]); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    };
    for (let i = 0; i < N; i++) reset(i, false);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pMat = new THREE.PointsMaterial({ size: 18, vertexColors: true, sizeAttenuation: true });
    const points = new THREE.Points(geo, pMat); scene.add(points);

    let raf = 0; let phase = 0;
    const fallSpeed = 5 + op.speedRpm / 40;
    const breakZone = prof.P.zTop * 0.32;   // grip/break near the discharge
    const animate = () => {
      phase += (op.speedRpm / 60) * 0.04;
      // nutation: tilt the mantle axis and gyrate its phase
      const ecc = Math.atan2(op.throwMm, prof.P.zTop) * 1.4;
      mantleGroup.rotation.set(0, 0, 0);
      mantleGroup.rotateY(phase); mantleGroup.rotateZ(ecc); mantleGroup.rotateY(-phase);
      for (let i = 0; i < N; i++) {
        pos[i * 3 + 1] -= fallSpeed;
        // break: when entering the grip zone, shrink + recolour once
        if (!broke[i] && pos[i * 3 + 1] < breakZone) {
          broke[i] = 1; sizeRel[i] *= 0.45;
          const c = viridis(1 - sizeRel[i]); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        if (pos[i * 3 + 1] < 0) reset(i, true);
        else {
          const z = pos[i * 3 + 1];
          const rc = prof.rConcave(z), rm = prof.rMantleClosed(z);
          rad[i] = Math.max(rm, Math.min(rc, rad[i]));
          pos[i * 3] = Math.cos(ang[i]) * rad[i]; pos[i * 3 + 2] = Math.sin(ang[i]) * rad[i];
        }
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      pMat.size = 8 + 26 * Math.min(1, p80 / Math.max(1, f80));   // visual cue: finer product → smaller dots
      controls.update(); renderer.render(scene, cam);
      raf = requestAnimationFrame(animate);
    };
    animate();
    const ro = new ResizeObserver(() => { const w = el.clientWidth || W; renderer.setSize(w, H); cam.aspect = w / H; cam.updateProjectionMatrix(); });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      ccGeo.dispose(); mGeo.dispose(); geo.dispose(); ccMat.dispose(); mMat.dispose(); pMat.dispose();
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
