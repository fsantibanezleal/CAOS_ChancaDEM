// The rocks of the chamber view: pure size and colour mappings, the shard spawn rule, and the instanced field that
// falls, is gripped near the discharge, shrinks across the break zone and (Fracture on) shatters into shards.
// Kinematic: the motion is drawn, not solved; the size change across the break zone comes from the engine's
// gradation (P80 over F80).
import { Color, Euler, IcosahedronGeometry, Matrix4, Quaternion, Vector3, type BufferAttribute, type BufferGeometry, type InstancedMesh } from 'three';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Size left after the break zone, as a share of the size before. The square root of the engine's P80 over F80,
 *  kept between 0.25 and 0.85 so a rock always visibly shrinks and never vanishes; the shipped constant (0.55)
 *  when the gradation is unusable. */
export function breakShrink(p80Mm: number, f80Mm: number): number {
  if (!(Number.isFinite(p80Mm) && Number.isFinite(f80Mm)) || p80Mm <= 0 || f80Mm <= 0) return 0.55;
  return Math.max(0.25, Math.min(0.85, Math.sqrt(p80Mm / f80Mm)));
}

/** Position on the colour ramp: 0 for the coarsest rock, towards 1 for the finest. */
export function rockColorT(size: number): number {
  return 1 - clamp01(size);
}

/** Piecewise-linear colour on a ramp of stops, t in [0, 1]; writes into `out`. */
export function rampColor(stops: Color[], t: number, out: Color): Color {
  if (stops.length === 0) return out.setRGB(0.5, 0.5, 0.5);
  if (stops.length === 1) return out.copy(stops[0]);
  const x = clamp01(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return out.copy(stops[i]).lerp(stops[i + 1], x - i);
}

/** Drawn radius of a rock of relative size `size`, for the base radius of the chamber and the rock-size control. */
export function rockRadius(size: number, baseR: number, scale: number): number {
  return baseR * (0.4 + 0.7 * size) * scale;
}

/** Shards a breaking rock throws: two, or three when the draw is under one half. */
export function shardCount(rand: () => number): number {
  return 2 + (rand() < 0.5 ? 1 : 0);
}

/** A shard is 0.4 to 0.7 of its parent, never under 0.12. */
export function shardSize(parent: number, rand: () => number): number {
  return Math.max(0.12, parent * (0.4 + rand() * 0.3));
}

/** Next free slot of the shard pool [nBase, max) from the cursor, wrapping inside the pool; -1 when it is full. */
export function findFreeSlot(active: Uint8Array, nBase: number, max: number, cursor: number): number {
  const pool = max - nBase;
  for (let t = 0; t < pool; t++) {
    const c = nBase + ((((cursor - nBase + t) % pool) + pool) % pool);
    if (!active[c]) return c;
  }
  return -1;
}

/** A jittered icosahedron reads as an irregular rock; flat-shaded and instanced. */
export function makeRockGeometry(rand: () => number = Math.random): BufferGeometry {
  const g = new IcosahedronGeometry(1, 0); // already non-indexed in three 0.186 (toNonIndexed warns and returns it)
  const p = g.attributes.position as BufferAttribute;
  const seen = new Map<string, [number, number, number]>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let j = seen.get(key);
    if (!j) {
      const s = 0.72 + rand() * 0.42;
      j = [p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s];
      seen.set(key, j);
    }
    p.setXYZ(i, j[0], j[1], j[2]);
  }
  g.computeVertexNormals();
  return g;
}

/** Machine-specific placement of a rock and the clamp that keeps it between the liners. */
export interface Placer {
  /** Height under which a rock is crushed [mm]. */
  breakZone: number;
  place: (f: RockField, i: number, top: boolean) => void;
  clamp: (f: RockField, i: number) => void;
}

type InstanceTarget = Pick<InstancedMesh, 'setMatrixAt' | 'setColorAt' | 'instanceMatrix' | 'instanceColor'>;

export interface RockFieldOptions {
  mesh: InstanceTarget;
  placer: Placer;
  nBase: number;
  max: number;
  baseR: number;
  /** Fall per frame at 60 frames per second and speed 1 [mm]. */
  fallPerFrame: number;
  shrink: number;
  /** False at an invalid operating point: nothing is gripped, rocks fall through unbroken. */
  gripped: boolean;
  ramp: Color[];
  rand?: () => number;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _v = new Vector3();
const _s = new Vector3();
const _c = new Color();

export class RockField {
  readonly max: number;
  readonly nBase: number;
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly pz: Float32Array;
  readonly size: Float32Array;
  readonly active: Uint8Array;
  readonly broke: Uint8Array;
  readonly ang: Float32Array;
  readonly rad: Float32Array;
  readonly xw: Float32Array;
  private rx: Float32Array;
  private ry: Float32Array;
  private rz: Float32Array;
  private drx: Float32Array;
  private dry: Float32Array;
  private drz: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private vz: Float32Array;
  private cursor: number;
  private readonly o: RockFieldOptions;
  readonly rand: () => number;

  constructor(o: RockFieldOptions) {
    this.o = o;
    this.max = o.max;
    this.nBase = o.nBase;
    this.rand = o.rand ?? Math.random;
    const n = o.max;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.size = new Float32Array(n);
    this.active = new Uint8Array(n);
    this.broke = new Uint8Array(n);
    this.ang = new Float32Array(n);
    this.rad = new Float32Array(n);
    this.xw = new Float32Array(n);
    this.rx = new Float32Array(n);
    this.ry = new Float32Array(n);
    this.rz = new Float32Array(n);
    this.drx = new Float32Array(n);
    this.dry = new Float32Array(n);
    this.drz = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.vz = new Float32Array(n);
    this.cursor = o.nBase;
    for (let i = 0; i < n; i++) {
      this.drx[i] = (this.rand() - 0.5) * 0.14;
      this.dry[i] = (this.rand() - 0.5) * 0.14;
      this.drz[i] = (this.rand() - 0.5) * 0.14;
    }
    for (let i = 0; i < o.nBase; i++) {
      this.active[i] = 1;
      this.placeRock(i, false);
    }
    for (let i = 0; i < n; i++) {
      if (!this.size[i]) this.size[i] = 0.6;
      this.paint(i);
    }
    this.write(1);
  }

  /** Called by a placer once it has set the position and the size of rock `i`. */
  private placeRock(i: number, top: boolean): void {
    this.o.placer.place(this, i, top);
    this.broke[i] = 0;
    this.vx[i] = this.vy[i] = this.vz[i] = 0;
  }

  private paint(i: number): void {
    this.o.mesh.setColorAt(i, rampColor(this.o.ramp, rockColorT(this.size[i]), _c));
  }

  activeCount(): number {
    let n = 0;
    for (let i = 0; i < this.max; i++) n += this.active[i];
    return n;
  }

  brokenCount(): number {
    let n = 0;
    for (let i = 0; i < this.max; i++) n += this.active[i] && this.broke[i] ? 1 : 0;
    return n;
  }

  setRamp(ramp: Color[]): void {
    this.o.ramp = ramp;
    for (let i = 0; i < this.max; i++) this.paint(i);
    if (this.o.mesh.instanceColor) this.o.mesh.instanceColor.needsUpdate = true;
  }

  /** Writes the matrices for the current positions with the rock-size control `rs`, without moving anything. */
  write(rs: number): void {
    for (let i = 0; i < this.max; i++) this.writeOne(i, rs);
    this.o.mesh.instanceMatrix.needsUpdate = true;
    if (this.o.mesh.instanceColor) this.o.mesh.instanceColor.needsUpdate = true;
  }

  private writeOne(i: number, rs: number): void {
    if (!this.active[i]) {
      _s.setScalar(0);
      _m.compose(_v.set(0, -1e5, 0), _q.identity(), _s);
      this.o.mesh.setMatrixAt(i, _m);
      return;
    }
    _e.set(this.rx[i], this.ry[i], this.rz[i]);
    _q.setFromEuler(_e);
    _s.setScalar(rockRadius(this.size[i], this.o.baseR, rs));
    _m.compose(_v.set(this.px[i], this.py[i], this.pz[i]), _q, _s);
    this.o.mesh.setMatrixAt(i, _m);
  }

  private spawnShards(parent: number): void {
    const k = shardCount(this.rand);
    for (let s = 0; s < k; s++) {
      const slot = findFreeSlot(this.active, this.nBase, this.max, this.cursor);
      if (slot < 0) return;
      this.cursor = slot + 1;
      this.active[slot] = 1;
      this.broke[slot] = 1;
      this.px[slot] = this.px[parent];
      this.py[slot] = this.py[parent];
      this.pz[slot] = this.pz[parent];
      this.ang[slot] = this.ang[parent];
      this.rad[slot] = this.rad[parent];
      this.xw[slot] = this.pz[parent];
      this.size[slot] = shardSize(this.size[parent], this.rand);
      this.vx[slot] = (this.rand() - 0.5) * 26;
      this.vy[slot] = this.rand() * 10;
      this.vz[slot] = (this.rand() - 0.5) * 26;
      this.paint(slot);
    }
  }

  /** One advance of `k` frames at the animation speed `spd`. k = 0 only redraws (the static first frame). */
  step(k: number, spd: number, rs: number, fracture: boolean): void {
    if (k <= 0) {
      this.write(rs);
      return;
    }
    const fall = this.o.fallPerFrame * spd * k;
    const damp = Math.pow(0.9, k);
    const { placer } = this.o;
    for (let i = 0; i < this.max; i++) {
      if (!this.active[i]) {
        this.writeOne(i, rs);
        continue;
      }
      this.rx[i] += this.drx[i] * spd * k;
      this.ry[i] += this.dry[i] * spd * k;
      this.rz[i] += this.drz[i] * spd * k;
      const isShard = i >= this.nBase;
      this.py[i] -= fall;
      if (isShard) {
        this.px[i] += this.vx[i] * spd * k;
        this.py[i] += this.vy[i] * spd * k;
        this.pz[i] += this.vz[i] * spd * k;
        this.vx[i] *= damp;
        this.vy[i] = this.vy[i] * damp - 0.6 * spd * k;
        this.vz[i] *= damp;
      }
      if (this.o.gripped && !this.broke[i] && this.py[i] < placer.breakZone) {
        this.broke[i] = 1;
        this.size[i] *= this.o.shrink;
        this.paint(i);
        if (fracture) this.spawnShards(i);
      }
      if (this.py[i] < 0) {
        if (isShard) {
          this.active[i] = 0;
          this.writeOne(i, rs);
          continue;
        }
        this.placeRock(i, true);
        this.paint(i);
      } else if (!isShard) placer.clamp(this, i);
      this.writeOne(i, rs);
    }
    this.o.mesh.instanceMatrix.needsUpdate = true;
    if (this.o.mesh.instanceColor) this.o.mesh.instanceColor.needsUpdate = true;
  }
}
