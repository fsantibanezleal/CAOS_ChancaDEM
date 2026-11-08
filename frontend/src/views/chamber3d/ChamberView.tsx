// The 3D crusher chamber as a shell view: one filling PlotCard whose stage is the three.js canvas and whose controls
// row sits under it. It starts paused (the first frame is drawn static), moves only through the shell's usePausedViz,
// takes its size from the shell's Stage (a ResizeObserver on the stage box, never the viewport) and its colours from
// the shell's tokens. Its four parts carry labels on the canvas and are selectable there (a label, or a click on the part itself through
// the scene's raycast), on the shell's linked-view store: the section beside it (views/chamber.tsx) selects the same part, both ways.
import {
  PlotCard,
  Stage,
  formatNumber,
  pick,
  useShellLang,
  useThemeStore,
  useLinkedItem,
  usePausedViz,
  type BiText,
  type Provenance,
} from '@fasl-work/caos-app-shell';
import { useEffect, useRef, useState } from 'react';
import { linkedId, selectedOf, useLinkedSelection } from '../linked';
import { machineGeom } from '../../engine/chamber';
import { PART_IDS, type PartId } from './geometry';
import type { Operating } from '../../engine/types';
import './chamber3d.css';
import { webglDeps } from './deps';
import { readPalette } from './palette';
import { createChamberScene, type ChamberScene, type PartPoint, type Pose, type SceneParams } from './scene';
import * as T from './text';

export interface ChamberViewProps {
  op: Operating;
  p80Mm: number;
  f80Mm: number;
  provenance: string;
  /** Added after the view's own statement that it is kinematic and why it is 3D. */
  note?: BiText;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

interface CanvasProps {
  width: number;
  height: number;
  op: Operating;
  p80Mm: number;
  f80Mm: number;
  params: SceneParams;
  playing: boolean;
  sceneRef: { current: ChamberScene | null };
  poseRef: { current: Pose | null };
  onDrawn: () => void;
  onUnavailable: () => void;
}

/** The name of a part on the canvas: a revolution's concave and mantle, a jaw's fixed and swing plates. */
export function partName(part: PartId, revolution: boolean): BiText {
  switch (part) {
    case 'concave':
      return revolution ? { en: 'concave', es: 'cóncavo' } : { en: 'fixed jaw', es: 'placa fija' };
    case 'mantle':
      return revolution ? { en: 'mantle', es: 'manto' } : { en: 'swing jaw', es: 'placa móvil' };
    case 'gap':
      return { en: 'closed-side gap', es: 'abertura de descarga' };
    case 'feed':
      return { en: 'feed', es: 'alimentación' };
  }
}

/** A part's label on the canvas: a dot on the part and its name beside it, a button on the shell's linked-view store. */
function PartLabel({ part, at, revolution }: { part: PartId; at: PartPoint; revolution: boolean }) {
  const lang = useShellLang();
  const item = useLinkedItem(linkedId('part', part), 'scene');
  return (
    <>
      <span className="chamber3d-dot" aria-hidden="true" style={{ left: at.x, top: at.y }} />
      <button type="button" className="chamber3d-part" data-part-label={part} data-part-at={`${Math.round(at.x)},${Math.round(at.y)}`} style={{ left: at.x + 8, top: at.y - 11 }} {...item}>
        {pick(partName(part, revolution), lang)}
      </button>
    </>
  );
}

const samePoints = (a: Record<PartId, PartPoint> | null, b: Record<PartId, PartPoint>) =>
  !!a && PART_IDS.every((id) => Math.abs(a[id].x - b[id].x) < 0.5 && Math.abs(a[id].y - b[id].y) < 0.5 && a[id].visible === b[id].visible);

/** The canvas, mounted by Stage only once the stage has a real size. */
function ChamberCanvas(p: CanvasProps) {
  const lang = useShellLang();
  const theme = useThemeStore((s) => s.theme);
  const hostRef = useRef<HTMLDivElement>(null);
  const latest = useRef(p);
  latest.current = p;
  const [points, setPoints] = useState<Record<PartId, PartPoint> | null>(null);
  const pending = useRef(false);
  const { selectedId, select } = useLinkedSelection();
  const part = selectedOf(selectedId, 'part');
  const selectedPart = part && (PART_IDS as readonly string[]).includes(part) ? (part as PartId) : null;
  const revolution = machineGeom(p.op.machine).isRevolution;
  const applied = useRef({ op: p.op, p80Mm: p.p80Mm, f80Mm: p.f80Mm });

  // build once per mount; the chamber, the palette, the size and the controls follow through the effects below
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const l = latest.current;
    let scene: ChamberScene;
    try {
      scene = createChamberScene({
        width: l.width,
        height: l.height,
        op: l.op,
        p80Mm: l.p80Mm,
        f80Mm: l.f80Mm,
        palette: readPalette(useThemeStore.getState().theme),
        deps: webglDeps(),
        pixelRatio: Math.min(2, window.devicePixelRatio || 1),
        initialPose: l.poseRef.current ?? undefined,
        onUserMove: (pose) => {
          latest.current.poseRef.current = pose;
        },
        onRefit: () => {
          latest.current.poseRef.current = null;
        },
        // the labels follow the camera: the parts' points are re-read once after the frames drawn in one task (the frames come from the
        // shell's usePausedViz loop or a camera move; this schedules no frame of its own)
        onRendered: () => {
          if (pending.current) return;
          pending.current = true;
          queueMicrotask(() => {
            pending.current = false;
            const sc = latest.current.sceneRef.current;
            if (!sc) return;
            const next = sc.partPoints();
            setPoints((prev) => (samePoints(prev, next) ? prev : next));
          });
        },
      });
    } catch {
      latest.current.onUnavailable();
      return;
    }
    scene.setParams(l.params);
    scene.setPlaying(l.playing);
    host.prepend(scene.domElement);
    // a click on a part selects it (a drag that orbits the camera is not a click)
    let down: [number, number] | null = null;
    const onDown = (e: PointerEvent) => {
      down = [e.clientX, e.clientY];
    };
    const onClick = (e: MouseEvent) => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const r = scene.domElement.getBoundingClientRect();
      const hit = scene.pick(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      if (hit) select(linkedId('part', hit), 'scene');
    };
    scene.domElement.addEventListener('pointerdown', onDown);
    scene.domElement.addEventListener('click', onClick);
    l.sceneRef.current = scene;
    applied.current = { op: l.op, p80Mm: l.p80Mm, f80Mm: l.f80Mm };
    l.onDrawn();
    return () => {
      scene.domElement.removeEventListener('pointerdown', onDown);
      scene.domElement.removeEventListener('click', onClick);
      l.sceneRef.current = null;
      scene.domElement.remove();
      scene.dispose();
    };
  }, []);

  useEffect(() => {
    p.sceneRef.current?.resize(p.width, p.height);
  }, [p.width, p.height, p.sceneRef]);

  useEffect(() => {
    const a = applied.current;
    if (a.op === p.op && a.p80Mm === p.p80Mm && a.f80Mm === p.f80Mm) return;
    applied.current = { op: p.op, p80Mm: p.p80Mm, f80Mm: p.f80Mm };
    p.sceneRef.current?.setOperating(p.op, p.p80Mm, p.f80Mm);
  }, [p.op, p.p80Mm, p.f80Mm, p.sceneRef]);

  useEffect(() => {
    p.sceneRef.current?.setParams(p.params);
  }, [p.params, p.sceneRef]);

  useEffect(() => {
    p.sceneRef.current?.setPlaying(p.playing);
  }, [p.playing, p.sceneRef]);

  // a theme change re-reads the tokens (the shell sets data-theme before the store changes)
  useEffect(() => {
    p.sceneRef.current?.setPalette(readPalette(theme));
  }, [theme, p.sceneRef]);

  useEffect(() => {
    p.sceneRef.current?.domElement.setAttribute('aria-label', pick(T.CANVAS_LABEL, lang));
  }, [lang, p.sceneRef]);

  // the part selected anywhere (here, in the section) is lit in the scene
  useEffect(() => {
    p.sceneRef.current?.setSelected(selectedPart);
  }, [selectedPart, p.sceneRef]);

  return (
    <div className="chamber3d-canvas" ref={hostRef} data-selected-part={selectedPart ?? ''}>
      {points && PART_IDS.filter((id) => points[id].visible).map((id) => <PartLabel key={id} part={id} at={points[id]} revolution={revolution} />)}
    </div>
  );
}

export function ChamberView({ op, p80Mm, f80Mm, provenance, note }: ChamberViewProps) {
  const lang = useShellLang();
  const [params, setParams] = useState<SceneParams>({ speed: 1.5, rockScale: 1.3, fracture: true });
  const [drawn, setDrawn] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const sceneRef = useRef<ChamberScene | null>(null);
  const poseRef = useRef<Pose | null>(null);
  const reduced = useReducedMotion();

  // paused by default (autoStart is off); the loop is the shell's, and it halts on a hidden tab
  const viz = usePausedViz((dt) => {
    sceneRef.current?.advance(dt);
  }, { loop: true });
  const { pause } = viz;
  useEffect(() => {
    if (reduced) pause();
  }, [reduced, pause]);

  const blocked = reduced;
  const fmt = (v: number) => formatNumber(v, lang, { decimals: 2 });
  const fmt1 = (v: number) => formatNumber(v, lang, { decimals: 1 });
  const times = pick(T.TIMES, lang);
  const mergedNote: BiText = { en: pick(T.NOTE, 'en') + (note ? ` ${pick(note, 'en')}` : ''), es: pick(T.NOTE, 'es') + (note ? ` ${pick(note, 'es')}` : '') };

  return (
    <PlotCard title={T.TITLE} lane="live" provenance={provenance as Provenance} note={mergedNote} fill>
      <div className="chamber3d">
        {unavailable ? (
          <p className="chamber3d-unavailable" data-state="unavailable">
            {pick(T.UNAVAILABLE, lang)}
          </p>
        ) : (
          <>
            <div className="chamber3d-stage" data-state={drawn ? 'ready' : 'loading'}>
              <Stage label={T.STAGE_LABEL}>
                {(size) => (
                  <ChamberCanvas
                    width={size.width}
                    height={size.height}
                    op={op}
                    p80Mm={p80Mm}
                    f80Mm={f80Mm}
                    params={params}
                    playing={viz.playing}
                    sceneRef={sceneRef}
                    poseRef={poseRef}
                    onDrawn={() => setDrawn(true)}
                    onUnavailable={() => setUnavailable(true)}
                  />
                )}
              </Stage>
            </div>
            <div className="chamber3d-controls" role="group" aria-label={pick(T.CONTROLS_LABEL, lang)}>
              <button
                type="button"
                className="btn primary"
                disabled={blocked}
                aria-describedby={blocked ? 'chamber3d-reduced' : undefined}
                title={blocked ? pick(T.REDUCED, lang) : pick(T.PLAY_HINT, lang)}
                onClick={() => viz.toggle()}
              >
                {viz.playing ? pick(T.PAUSE, lang) : pick(T.PLAY, lang)}
              </button>
              {/* View-local display controls: native inputs with the shell's range, chip and btn classes and no data-control, because they change only this drawing, not the instrument's state key (gate G9) */}
              <label className="chamber3d-slider" title={pick(T.SPEED_HINT, lang)}>
                <span>{pick(T.SPEED, lang)}</span>
                <input
                  className="range chamber3d-range"
                  type="range"
                  min={0.25}
                  max={4}
                  step={0.25}
                  value={params.speed}
                  aria-label={`${pick(T.SPEED, lang)} (${times})`}
                  aria-valuetext={`${fmt(params.speed)} ${times}`}
                  onChange={(e) => setParams((s) => ({ ...s, speed: Number(e.target.value) }))}
                />
                <b className="chamber3d-value">{fmt(params.speed)}×</b>
              </label>
              <label className="chamber3d-slider" title={pick(T.ROCK_HINT, lang)}>
                <span>{pick(T.ROCK, lang)}</span>
                <input
                  className="range chamber3d-range"
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  value={params.rockScale}
                  aria-label={`${pick(T.ROCK, lang)} (${times})`}
                  aria-valuetext={`${fmt1(params.rockScale)} ${times}`}
                  onChange={(e) => setParams((s) => ({ ...s, rockScale: Number(e.target.value) }))}
                />
                <b className="chamber3d-value">{fmt1(params.rockScale)}×</b>
              </label>
              <button
                type="button"
                className={params.fracture ? 'chip on' : 'chip'}
                aria-pressed={params.fracture}
                title={pick(T.FRACTURE_HINT, lang)}
                onClick={() => setParams((s) => ({ ...s, fracture: !s.fracture }))}
              >
                {pick(T.FRACTURE, lang)}
              </button>
              <button
                type="button"
                className="btn"
                title={pick(T.RESET_HINT, lang)}
                onClick={() => {
                  poseRef.current = null;
                  sceneRef.current?.resetView();
                }}
              >
                {pick(T.RESET, lang)}
              </button>
              {blocked && (
                <span className="chamber3d-hint" id="chamber3d-reduced">
                  {pick(T.REDUCED, lang)}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </PlotCard>
  );
}
