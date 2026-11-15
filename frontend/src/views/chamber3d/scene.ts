// The chamber scene, framework-free: it owns the three.js objects and exposes what the component drives. It requests
// no animation frame (the component's usePausedViz calls `advance`), takes its size from `resize`, and reads no
// colour but the palette it is given. The renderer and the controls come from `deps`, so a test runs it without WebGL.
// The chamber stands on a ground that takes its soft shadows (the shell's scene environment per theme: ground, key light that casts the
// shadow, fill and ambient light), and its four parts are named and selectable: `pick` raycasts a point of the canvas to a part,
// `partPoints` projects each part's label point to the canvas, and `setSelected` lights the selected part (M9 of the 0.13.000 review).
import { AmbientLight, Color, DirectionalLight, DynamicDrawUsage, InstancedMesh, Mesh, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, Raycaster, Scene, Vector2, Vector3, type ShadowMapType } from 'three';
import { gridEdges } from '../../engine/engine';
import type { Operating } from '../../engine/types';
import { fitCamera } from './fit';
import { buildChamber, PART_IDS, type Chamber, type Disposable, type PartId } from './geometry';
import type { ScenePalette } from './palette';
import { breakShrink, makeRockGeometry, RockField } from './rocks';

export interface RendererLike {
  domElement: HTMLCanvasElement;
  /** The WebGL renderer's shadow map; a test renderer has none. */
  shadowMap?: { enabled: boolean; type: ShadowMapType };
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setPixelRatio(ratio: number): void;
  render(scene: Scene, camera: PerspectiveCamera): void;
  dispose(): void;
}

export interface ControlsLike {
  target: Vector3;
  enableDamping: boolean;
  update(): unknown;
  dispose(): void;
  addEventListener(type: 'change', listener: () => void): void;
  listenToKeyEvents?(element: HTMLElement): void;
}

export interface SceneDeps {
  createRenderer: () => RendererLike;
  createControls: (camera: PerspectiveCamera, dom: HTMLElement) => ControlsLike;
}

export interface SceneParams {
  /** Animation speed, times. */
  speed: number;
  /** Rock size, times. */
  rockScale: number;
  fracture: boolean;
}

export interface Pose {
  position: Vector3;
  target: Vector3;
}

export interface SceneOptions {
  width: number;
  height: number;
  op: Operating;
  p80Mm: number;
  f80Mm: number;
  palette: ScenePalette;
  deps: SceneDeps;
  pixelRatio?: number;
  /** A point of view the reader had set before the scene was rebuilt; kept as it was. */
  initialPose?: Pose;
  /** Called when the reader moves the camera. */
  onUserMove?: (pose: Pose) => void;
  /** Called when the scene re-fits the camera by itself (a machine change), so a stored pose is dropped. */
  onRefit?: () => void;
  /** Called after every frame is drawn (the component re-reads the parts' label points). */
  onRendered?: () => void;
}

/** A part's label point on the canvas, in CSS pixels, and whether it is in front of the camera and inside the canvas. */
export interface PartPoint {
  x: number;
  y: number;
  visible: boolean;
}

export interface ChamberScene {
  readonly camera: PerspectiveCamera;
  readonly domElement: HTMLCanvasElement;
  resize(width: number, height: number): void;
  advance(dtMs: number): void;
  render(): void;
  setOperating(op: Operating, p80Mm: number, f80Mm: number): void;
  setParams(p: SceneParams): void;
  setPalette(p: ScenePalette): void;
  setPlaying(playing: boolean): void;
  resetView(): void;
  pose(): Pose;
  /** The part under a point of the canvas, in normalised device coordinates (-1 to 1, y up), or null. */
  pick(ndcX: number, ndcY: number): PartId | null;
  partPoints(): Record<PartId, PartPoint>;
  setSelected(part: PartId | null): void;
  selected(): PartId | null;
  /** The ground under the chamber (it receives the shadows). */
  ground(): Mesh;
  brokenCount(): number;
  mantleColor(): Color;
  disposables(): Disposable[];
  chamberDisposables(): Disposable[];
  dispose(): void;
}

const NBASE = 560;
const MAX = 1500;
const FOV = 45;
const FRAME_MS = 1000 / 60;

/** Frames of 60 per second elapsed in `dtMs`, capped so a stalled tab does not teleport the rocks. */
export function frameScale(dtMs: number): number {
  return Math.min(3, Math.max(0, dtMs) / FRAME_MS);
}

/** True when the operating point grips rock: CSS below the feed top size (the engine's own invalid rule). */
export function grips(op: Operating): boolean {
  return op.cssMm < gridEdges()[0];
}

export function createChamberScene(o: SceneOptions): ChamberScene {
  const { deps } = o;
  const scene = new Scene();
  const sized = o.width > 0 && o.height > 0;
  const camera = new PerspectiveCamera(FOV, sized ? o.width / o.height : 1, 1, 20000);
  const renderer = deps.createRenderer();
  renderer.setPixelRatio(o.pixelRatio ?? 1);
  if (sized) renderer.setSize(o.width, o.height);
  const controls = deps.createControls(camera, renderer.domElement);
  controls.enableDamping = false;

  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
  }
  const env = o.palette.env;
  const ambient = new AmbientLight(new Color(env?.ambient.color ?? '#ffffff'), env ? env.ambient.intensity * 0.45 : o.palette.ambient);
  const sun = new DirectionalLight(new Color(env?.key.color ?? '#ffffff'), env ? env.key.intensity * 0.55 : 0.85);
  sun.castShadow = env?.key.castShadow ?? true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0006;
  const fill = new DirectionalLight(new Color(env?.fill.color ?? '#ffffff'), env ? env.fill.intensity * 0.5 : 0.3);
  scene.add(ambient, sun, sun.target, fill);
  const groundGeo = new PlaneGeometry(1, 1);
  const groundMat = new MeshStandardMaterial({ color: new Color(env?.ground ?? '#808080'), roughness: 1, metalness: 0 });
  const groundMesh = new Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);
  const raycaster = new Raycaster();
  let selectedPart: PartId | null = null;

  const rockGeo = makeRockGeometry();
  const rockMat = new MeshStandardMaterial({ metalness: 0.1, roughness: 0.85, flatShading: true });
  const rocks = new InstancedMesh(rockGeo, rockMat, MAX);
  rocks.instanceMatrix.setUsage(DynamicDrawUsage);
  scene.add(rocks);
  rocks.castShadow = true;
  const owned: Disposable[] = [rockGeo, rockMat, rocks, groundGeo, groundMat];

  let params: SceneParams = { speed: 1.5, rockScale: 1.3, fracture: true };
  let palette = o.palette;
  let op = o.op;
  let chamber: Chamber;
  let field: RockField;
  let userMoved = false;
  let applying = false;
  let stepping = false;
  let disposed = false;
  let hasSize = sized;

  const build = (nextOp: Operating, p80: number, f80: number) => {
    if (chamber) {
      scene.remove(chamber.group);
      for (const d of chamber.disposables) d.dispose();
    }
    op = nextOp;
    chamber = buildChamber(op, palette);
    scene.add(chamber.group);
    // the ground under the lowest point of the chamber, wide enough for the shadow at any view; the key light frames the chamber
    let lo = Infinity;
    let span = 1;
    for (const q of chamber.points) {
      lo = Math.min(lo, q.y);
      span = Math.max(span, Math.abs(q.x), Math.abs(q.z), q.y);
    }
    const y0 = Number.isFinite(lo) ? lo - span * 0.02 : 0;
    groundMesh.position.set(0, y0, 0);
    groundMesh.scale.set(span * 8, span * 8, 1);
    sun.position.set(span * 1.1, y0 + span * 2.4, span * 1.5);
    sun.target.position.set(0, y0 + span * 0.4, 0);
    const cam = sun.shadow.camera;
    cam.left = -span * 1.6;
    cam.right = span * 1.6;
    cam.top = span * 1.6;
    cam.bottom = -span * 1.6;
    cam.near = span * 0.1;
    cam.far = span * 6;
    cam.updateProjectionMatrix();
    fill.position.set(-span * 1.4, y0 + span, -span * 0.8);
    applySelected();
    field = new RockField({
      mesh: rocks,
      placer: chamber.placer,
      nBase: NBASE,
      max: MAX,
      baseR: Math.max(14, chamber.zTop * 0.023),
      fallPerFrame: 5 + op.speedRpm / 40,
      shrink: breakShrink(p80, f80),
      gripped: grips(op),
      ramp: palette.ramp,
    });
    field.write(params.rockScale);
  };

  const render = () => {
    if (disposed || !hasSize) return;
    renderer.render(scene, camera);
    o.onRendered?.();
  };

  const fit = () => {
    const f = fitCamera(chamber.points, FOV, camera.aspect, chamber.viewDir);
    applying = true;
    controls.target.copy(f.target);
    camera.position.copy(f.position);
    // the controls aim the camera at their target on update; aimed here too, so the scene's own projection (the parts' label points,
    // the raycast) holds whatever controls drive it
    camera.lookAt(f.target);
    camera.near = f.near;
    camera.far = f.far;
    camera.updateProjectionMatrix();
    controls.update();
    applying = false;
  };

  const pose = (): Pose => ({ position: camera.position.clone(), target: controls.target.clone() });

  function applySelected() {
    if (!chamber) return;
    const glow = palette.accent ?? new Color(1, 1, 1);
    for (const id of PART_IDS) for (const m of chamber.parts[id].materials) m.emissive.copy(id === selectedPart ? glow : new Color(0, 0, 0)).multiplyScalar(id === selectedPart ? 0.45 : 1);
  }

  build(op, o.p80Mm, o.f80Mm);
  fit();
  if (o.initialPose) {
    applying = true;
    camera.position.copy(o.initialPose.position);
    controls.target.copy(o.initialPose.target);
    camera.lookAt(o.initialPose.target);
    camera.updateProjectionMatrix();
    controls.update();
    applying = false;
    userMoved = true;
  }
  controls.addEventListener('change', () => {
    if (applying || disposed) return;
    userMoved = true;
    o.onUserMove?.(pose());
    if (!stepping) render();
  });
  // keyboard: the arrow keys pan once the canvas has focus
  renderer.domElement.tabIndex = 0;
  controls.listenToKeyEvents?.(renderer.domElement);
  render();

  return {
    camera,
    domElement: renderer.domElement,
    resize(w, h) {
      if (disposed || !(w > 0 && h > 0)) return;
      hasSize = true;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      if (!userMoved) fit();
      else camera.updateProjectionMatrix();
      render();
    },
    advance(dtMs) {
      if (disposed) return;
      const k = frameScale(dtMs);
      chamber.mech(k, params.speed);
      field.step(k, params.speed, params.rockScale, params.fracture);
      stepping = true;
      controls.update();
      stepping = false;
      render();
    },
    render,
    setOperating(next, p80, f80) {
      if (disposed) return;
      const machineChanged = next.machine !== op.machine;
      build(next, p80, f80);
      // another machine is another chamber (a gyratory is twice a cone's height): re-fit; any other change keeps the view
      if (machineChanged) {
        userMoved = false;
        fit();
        o.onRefit?.();
      }
      render();
    },
    setParams(p) {
      if (disposed) return;
      const rescale = p.rockScale !== params.rockScale;
      params = p;
      if (rescale) field.write(p.rockScale);
      render();
    },
    setPalette(p) {
      if (disposed) return;
      palette = p;
      ambient.intensity = p.env ? p.env.ambient.intensity * 0.45 : p.ambient;
      if (p.env) {
        ambient.color.set(p.env.ambient.color);
        sun.color.set(p.env.key.color);
        sun.intensity = p.env.key.intensity * 0.55;
        fill.color.set(p.env.fill.color);
        fill.intensity = p.env.fill.intensity * 0.5;
        groundMat.color.set(p.env.ground);
      }
      chamber.recolor(p);
      applySelected();
      field.setRamp(p.ramp);
      render();
    },
    setPlaying(playing) {
      controls.enableDamping = playing;
    },
    resetView() {
      if (disposed) return;
      userMoved = false;
      fit();
      render();
    },
    pose,
    pick(ndcX, ndcY) {
      if (disposed) return null;
      chamber.group.updateMatrixWorld(true);
      raycaster.setFromCamera(new Vector2(ndcX, ndcY), camera);
      const meshes = PART_IDS.flatMap((id) => chamber.parts[id].meshes.map((m) => ({ id, m })));
      const hits = raycaster.intersectObjects(
        meshes.map((x) => x.m),
        false,
      );
      // a part seen through (the concave's translucent shell) gives way to the first solid part behind it on the same ray
      const seeThrough = (o: unknown) => {
        const m = (o as Mesh).material as MeshStandardMaterial;
        return Boolean(m.transparent) && m.opacity < 0.5;
      };
      const id = (o: unknown) => meshes.find((x) => x.m === o)!.id;
      if (!hits.length) return null;
      const solid = hits.find((h) => !seeThrough(h.object));
      return id((seeThrough(hits[0].object) && solid ? solid : hits[0]).object);
    },
    partPoints() {
      const w = renderer.domElement.clientWidth || camera.aspect * 100;
      const h = renderer.domElement.clientHeight || 100;
      camera.updateMatrixWorld();
      const out = {} as Record<PartId, PartPoint>;
      for (const id of PART_IDS) {
        const v = chamber.parts[id].at.clone().project(camera);
        const x = ((v.x + 1) / 2) * w;
        const y = ((1 - v.y) / 2) * h;
        out[id] = { x, y, visible: v.z > -1 && v.z < 1 && x >= 0 && x <= w && y >= 0 && y <= h };
      }
      return out;
    },
    setSelected(part) {
      if (disposed || part === selectedPart) return;
      selectedPart = part;
      applySelected();
      render();
    },
    selected: () => selectedPart,
    ground: () => groundMesh,
    brokenCount: () => field.brokenCount(),
    mantleColor: () => chamber.movingColor(),
    disposables: () => [...owned, ...chamber.disposables],
    chamberDisposables: () => [...chamber.disposables],
    dispose() {
      if (disposed) return;
      disposed = true;
      controls.dispose();
      for (const d of owned) d.dispose();
      for (const d of chamber.disposables) d.dispose();
      renderer.dispose();
    },
  };
}
