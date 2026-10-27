// The chamber scene, framework-free: it owns the three.js objects and exposes what the component drives. It requests
// no animation frame (the component's usePausedViz calls `advance`), takes its size from `resize`, and reads no
// colour but the palette it is given. The renderer and the controls come from `deps`, so a test runs it without WebGL.
import { AmbientLight, Color, DirectionalLight, DynamicDrawUsage, InstancedMesh, MeshStandardMaterial, PerspectiveCamera, Scene, Vector3 } from 'three';
import { gridEdges } from '../../engine/engine';
import type { Operating } from '../../engine/types';
import { fitCamera } from './fit';
import { buildChamber, type Chamber, type Disposable } from './geometry';
import type { ScenePalette } from './palette';
import { breakShrink, makeRockGeometry, RockField } from './rocks';

export interface RendererLike {
  domElement: HTMLCanvasElement;
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

  const ambient = new AmbientLight(new Color(1, 1, 1), o.palette.ambient);
  const sun = new DirectionalLight(new Color(1, 1, 1), 0.85);
  sun.position.set(1, 2, 1.4);
  scene.add(ambient, sun);

  const rockGeo = makeRockGeometry();
  const rockMat = new MeshStandardMaterial({ metalness: 0.1, roughness: 0.85, flatShading: true });
  const rocks = new InstancedMesh(rockGeo, rockMat, MAX);
  rocks.instanceMatrix.setUsage(DynamicDrawUsage);
  scene.add(rocks);
  const owned: Disposable[] = [rockGeo, rockMat, rocks];

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
  };

  const fit = () => {
    const f = fitCamera(chamber.box, FOV, camera.aspect);
    applying = true;
    controls.target.copy(f.target);
    camera.position.copy(f.position);
    camera.near = f.near;
    camera.far = f.far;
    camera.updateProjectionMatrix();
    controls.update();
    applying = false;
  };

  const pose = (): Pose => ({ position: camera.position.clone(), target: controls.target.clone() });

  build(op, o.p80Mm, o.f80Mm);
  fit();
  if (o.initialPose) {
    applying = true;
    camera.position.copy(o.initialPose.position);
    controls.target.copy(o.initialPose.target);
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
      ambient.intensity = p.ambient;
      chamber.recolor(p);
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
