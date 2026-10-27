// The real renderer and controls. Kept apart from the scene so a test can run the scene without WebGL.
// three.js 0.186: WebGLRenderer throws when no WebGL context can be made; the component turns that into the
// shell's unavailable state.
import { WebGLRenderer, type PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SceneDeps } from './scene';

export function webglDeps(): SceneDeps {
  return {
    createRenderer: () => new WebGLRenderer({ antialias: true, alpha: true }),
    createControls: (camera: PerspectiveCamera, dom: HTMLElement) => {
      const c = new OrbitControls(camera, dom);
      c.autoRotate = false;
      return {
        get target() {
          return c.target;
        },
        get enableDamping() {
          return c.enableDamping;
        },
        set enableDamping(v: boolean) {
          c.enableDamping = v;
        },
        update: () => c.update(),
        dispose: () => c.dispose(),
        addEventListener: (type, listener) => c.addEventListener(type, listener),
        listenToKeyEvents: (el) => c.listenToKeyEvents(el),
      };
    },
  };
}
