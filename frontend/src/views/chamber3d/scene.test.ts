import { createVizLoop } from '@fasl-work/caos-app-shell';
import { Color, Vector3 } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Operating } from '../../engine/types';
import type { ScenePalette } from './palette';
import { createChamberScene, type ControlsLike, type RendererLike, type SceneDeps } from './scene';

const OP: Operating = { machine: 'cone-sec', cssMm: 20, throwMm: 24, speedRpm: 240, feedX63Mm: 80, feedM: 1.4, oreAxb: 45, oreWi: 14 };
const PAL: ScenePalette = {
  ramp: [new Color(1, 0, 0), new Color(0, 0, 1)],
  concave: new Color(0.5, 0.5, 0.5),
  mantle: new Color(0, 1, 0),
  plateFixed: new Color(0.6, 0.6, 0.6),
  plateSwing: new Color(0, 1, 0),
  eccentric: new Color(1, 0.5, 0),
  ambient: 0.8,
};

function fakes() {
  const log = { sizes: [] as [number, number][], renders: 0, disposed: 0, controlsDisposed: 0, pixelRatio: 0 };
  const listeners: Record<string, (() => void)[]> = {};
  const controls: ControlsLike & { emit: (t: string) => void } = {
    target: new Vector3(),
    enableDamping: false,
    update: () => {},
    dispose: () => {
      log.controlsDisposed++;
    },
    addEventListener: (t, fn) => {
      (listeners[t] ||= []).push(fn);
    },
    emit: (t) => (listeners[t] || []).forEach((f) => f()),
  };
  const renderer: RendererLike = {
    domElement: {} as HTMLCanvasElement,
    setSize: (w, h) => {
      log.sizes.push([w, h]);
    },
    setPixelRatio: (r) => {
      log.pixelRatio = r;
    },
    render: () => {
      log.renders++;
    },
    dispose: () => {
      log.disposed++;
    },
  };
  const deps: SceneDeps = { createRenderer: () => renderer, createControls: () => controls };
  return { log, controls, deps };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function make(op: Operating = OP, w = 600, h = 400) {
  const f = fakes();
  const scene = createChamberScene({ width: w, height: h, op, p80Mm: 12, f80Mm: 80, palette: PAL, deps: f.deps, pixelRatio: 2 });
  return { ...f, scene };
}

describe('sized by its container', () => {
  it('sets the renderer size and the camera aspect from a 300 by 200 and then a 1200 by 700 container', () => {
    const { scene, log } = make(OP, 300, 200);
    expect(log.sizes.at(-1)).toEqual([300, 200]);
    expect(scene.camera.aspect).toBeCloseTo(1.5, 6);
    scene.resize(1200, 700);
    expect(log.sizes.at(-1)).toEqual([1200, 700]);
    expect(scene.camera.aspect).toBeCloseTo(1200 / 700, 6);
  });
  it('skips the render while the container has no size', () => {
    const { scene, log } = make();
    const n = log.renders;
    scene.resize(0, 0);
    scene.resize(500, 0);
    expect(log.renders).toBe(n);
    expect(log.sizes.at(-1)).toEqual([600, 400]);
  });
  it('re-fits an untouched view when the container changes, and keeps a view the reader moved', () => {
    const a = make(OP, 300, 600);
    const d0 = a.scene.camera.position.distanceTo(a.controls.target);
    a.scene.resize(1200, 700);
    expect(a.scene.camera.position.distanceTo(a.controls.target)).not.toBeCloseTo(d0, 3);
    const b = make();
    b.controls.emit('change');
    const p = b.scene.camera.position.clone();
    b.scene.resize(300, 600);
    expect(b.scene.camera.position.toArray()).toEqual(p.toArray());
  });
});

describe('the point of view', () => {
  it('survives an operating-point change and is re-fitted only by Reset view', () => {
    const { scene, controls } = make();
    controls.emit('change');
    scene.camera.position.add(new Vector3(100, 50, 20));
    const pos = scene.camera.position.clone();
    const target = controls.target.clone();
    scene.setOperating({ ...OP, cssMm: 30 }, 14, 80);
    scene.setOperating({ ...OP, machine: 'jaw' }, 14, 80);
    expect(scene.camera.position.toArray()).toEqual(pos.toArray());
    expect(controls.target.toArray()).toEqual(target.toArray());
    scene.resetView();
    expect(scene.camera.position.toArray()).not.toEqual(pos.toArray());
  });
  it('keeps even an untouched view across an operating-point change', () => {
    const { scene } = make();
    const pos = scene.camera.position.clone();
    scene.setOperating({ ...OP, cssMm: 35 }, 14, 80);
    expect(scene.camera.position.toArray()).toEqual(pos.toArray());
  });
});

describe('every machine and the invalid point', () => {
  for (const machine of ['cone-sec', 'cone-tert', 'cone-short-head', 'gyratory', 'jaw'] as const) {
    it(`draws the ${machine} chamber and steps it`, () => {
      const { scene, log } = make({ ...OP, machine });
      const n = log.renders;
      scene.advance(16);
      expect(log.renders).toBeGreaterThan(n);
    });
  }
  it('draws a chamber with nothing gripped when CSS reaches the feed top size', () => {
    const { scene } = make({ ...OP, cssMm: 300 });
    expect(() => {
      for (let i = 0; i < 10; i++) scene.advance(16);
    }).not.toThrow();
    expect(scene.brokenCount()).toBe(0);
  });
});

describe('paused start', () => {
  it('requests no animation frame while building, resizing, changing controls or redrawing', () => {
    const raf = vi.fn(() => 1);
    vi.stubGlobal('requestAnimationFrame', raf);
    const { scene } = make();
    scene.resize(800, 500);
    scene.setParams({ speed: 2, rockScale: 1.5, fracture: false });
    scene.setOperating({ ...OP, cssMm: 25 }, 13, 80);
    scene.setPalette(PAL);
    scene.render();
    expect(raf).not.toHaveBeenCalled();
  });
  it('moves only when told to: a loop on the shell state machine requests nothing before play and nothing after dispose', () => {
    const { scene, log } = make();
    let pending: ((t: number) => void) | null = null;
    let requested = 0;
    const loop = createVizLoop(
      (dt) => {
        scene.advance(dt);
      },
      { loop: true },
      {
        raf: (cb) => {
          requested++;
          pending = cb;
          return requested;
        },
        caf: () => {
          pending = null;
        },
      },
    );
    expect(requested).toBe(0);
    const renders = log.renders;
    loop.play();
    expect(requested).toBe(1);
    pending!(0);
    pending!(16);
    expect(log.renders).toBeGreaterThan(renders);
    loop.dispose();
    scene.dispose();
    const after = requested;
    const r = log.renders;
    scene.advance(16);
    scene.render();
    expect(requested).toBe(after);
    expect(log.renders).toBe(r);
  });
});

describe('disposal', () => {
  it('disposes the renderer, the controls and every geometry and material on dispose, once', () => {
    const { scene, log } = make();
    const owned = scene.disposables();
    const spies = owned.map((d) => vi.spyOn(d, 'dispose'));
    expect(owned.length).toBeGreaterThan(4);
    scene.dispose();
    scene.dispose();
    for (const s of spies) expect(s).toHaveBeenCalledTimes(1);
    expect(log.disposed).toBe(1);
    expect(log.controlsDisposed).toBe(1);
  });
  it('disposes the old chamber when the operating point changes', () => {
    const { scene } = make();
    const old = scene.chamberDisposables();
    const spies = old.map((d) => vi.spyOn(d, 'dispose'));
    scene.setOperating({ ...OP, machine: 'jaw' }, 14, 80);
    expect(old.length).toBeGreaterThan(0);
    for (const s of spies) expect(s).toHaveBeenCalled();
  });
});

describe('tokens', () => {
  it('recolours the chamber materials from a new palette without rebuilding', () => {
    const { scene } = make();
    const mats = scene.chamberDisposables().length;
    scene.setPalette({ ...PAL, mantle: new Color(0, 0, 1) });
    expect(scene.chamberDisposables().length).toBe(mats);
    expect(scene.mantleColor().toArray()).toEqual([0, 0, 1]);
  });
});
