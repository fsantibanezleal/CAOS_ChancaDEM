// Catalog row V5, the method at work: the Whiten population balance as its Neumann series, computed live from the engine's breakage
// matrix B, classification C and feed f for the selected case (engine/passes.ts). After n passes the product is
// p_n = (I - C) sum_{k<n} (B C)^k f, drawn on the axes of the size distribution (V3) against the closed form p = (I - C)(I - B C)^-1 f;
// B is strictly lower triangular, so the series is exact after as many passes as size classes, and the residual against n shows how
// fast it gets close before that. The pass count is the shell's shared cursor, so the gradation view draws the same pass (SH-004).
import { PlotCard, ViewsRow, useLinkedCursor, useShellLang, useWorkbenchState, type BiText } from '@fasl-work/caos-app-shell';
import { UPlotChart, type ChartSeries } from '@fasl-work/caos-app-shell/chart';
import { useEffect, useMemo, useState } from 'react';
import { neumannPasses, passesToResidual, passingOf, whitenMatrices, type PassSeries } from '../engine/passes';
import type { Operating } from '../engine/types';
import { ChartCallouts, type CalloutSpec, type ChartPoint } from './callouts';
import { linkedId, passCount, selectedClass, useLinkedSelection } from './linked';
import type { Selection } from '../workbench/model';
import { Pending, provenanceOf, useNum, useView } from './shared';
import { asc, FEED_COLOR, finAll, LIVE_COLOR, REPLAY_COLOR, REPLAY_DASH } from './series';

/** The residual the story's Solve step reads: the pass after which the product is within a millionth of the feed of the closed form. */
export const SOLVE_TOLERANCE = 1e-6;

const cache = new WeakMap<Operating, PassSeries>();
/** The series of the live engine at an operating point (cached per point object: the selection keeps one per render). */
export function passSeriesOf(op: Operating): PassSeries {
  let s = cache.get(op);
  if (!s) {
    s = neumannPasses(whitenMatrices(op));
    cache.set(op, s);
  }
  return s;
}

/** The cumulative passing of the product after `n` passes and of the closed form, coarse to fine on the sieve edges. */
export function passCurves(series: PassSeries, n: number): { after: number[]; closed: number[] } {
  const k = Math.max(0, Math.min(series.product.length - 1, n));
  return { after: passingOf(series.product[k], series.closed), closed: passingOf(series.closed, series.closed) };
}

/** The pass the reader looks at, as the shared cursor holds it (the exact product, n classes, until the reader scrubs). */
export function usePassCount(n: number): number {
  const { cursor } = useLinkedSelection();
  return passCount(cursor, n);
}

const PASS_MS = 320;

/** The pass scrubber and its play button: the shell's linked cursor; play walks the passes and any input stops it. */
export function PassControls({ n }: { n: number }) {
  const lang = useShellLang();
  const { scrub, inputProps, markerProps } = useLinkedCursor();
  const count = usePassCount(n);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    if (count >= n) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => scrub(count + 1), PASS_MS);
    return () => window.clearTimeout(timer);
  }, [playing, count, n, scrub]);
  const label = lang === 'es' ? `Pasada ${count} de ${n}` : `Pass ${count} of ${n}`;
  return (
    <div className="cdem-controls">
      <button
        className="btn"
        type="button"
        aria-pressed={playing}
        onClick={() => {
          if (!playing && count >= n) scrub(0);
          setPlaying((p) => !p);
        }}
      >
        {playing ? (lang === 'es' ? 'Pausar' : 'Pause') : lang === 'es' ? 'Reproducir las pasadas' : 'Play the passes'}
      </button>
      <span {...markerProps} data-linked-cursor-position={count} className="cdem-cursor-chip">
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={n}
        step={1}
        {...inputProps}
        value={count}
        aria-label={lang === 'es' ? 'Número de pasadas por la cámara' : 'Number of passes through the chamber'}
        onChange={(e) => {
          setPlaying(false);
          scrub(Number(e.target.value));
        }}
      />
    </div>
  );
}

/** The three callouts of the method view at pass `n`. */
export function passCallouts(series: PassSeries, n: number, fmt: (v: number, o: { digits?: number; decimals?: number; percent?: boolean }) => string, caseId: string): CalloutSpec[] {
  const k = Math.max(0, Math.min(series.n, n));
  const source: BiText = { en: `Live engine B, C and f of ${caseId}`, es: `B, C y f del motor en vivo de ${caseId}` };
  return [
    {
      id: 'pass',
      eyebrow: { en: 'PASSES', es: 'PASADAS' },
      value: `${fmt(k, { decimals: 0 })}`,
      unit: { en: `of ${series.n} passes`, es: `de ${series.n} pasadas` },
      state: 'selected',
      source,
    },
    {
      id: 'residual',
      eyebrow: { en: 'RESIDUAL', es: 'RESIDUO' },
      value: fmt(series.residual[k], { digits: 2 }),
      unit: { en: 'of feed', es: 'de alimentación' },
      state: series.residual[k] < SOLVE_TOLERANCE ? 'normal' : 'warning',
      source: { en: 'L1 distance of p_n to the closed form', es: 'Distancia L1 de p_n a la forma cerrada' },
    },
    {
      id: 'chamber',
      eyebrow: { en: 'IN THE CHAMBER', es: 'EN LA CÁMARA' },
      value: fmt(series.inChamber[k] * 100, { digits: 3 }),
      unit: { en: '% of feed', es: '% de alim.' },
      state: 'normal',
      source,
    },
  ];
}

/** The product after `count` passes on the V3 axes against the closed form, with its three callouts: the stage of the view and of the
 * story's Solve step. Selecting a size on it selects that class in every linked view. */
export function PassesChart({ sel, series, count }: { sel: Selection; series: PassSeries; count: number }) {
  const num = useNum();
  const { selectedId, select } = useLinkedSelection();
  const n = series.n;
  const edges = sel.result.feed.edgesMm;
  const x = asc(edges);
  const { after, closed } = passCurves(series, count);
  const cls = selectedClass(selectedId, n);
  const lines: ChartSeries[] = [
    { id: 'feed', label: { en: 'Feed', es: 'Alimentación' }, values: finAll(asc(sel.result.feed.passing)), color: FEED_COLOR, width: 1.4 },
    { id: 'closed', label: { en: 'Closed form p', es: 'Forma cerrada p' }, values: finAll(asc(closed)), color: REPLAY_COLOR, dash: REPLAY_DASH, width: 1.8 },
    { id: 'after', label: { en: `Product after ${count} passes`, es: `Producto tras ${count} pasadas` }, values: finAll(asc(after)), color: LIVE_COLOR, width: 2.6 },
  ];
  const iP80 = Math.max(
    0,
    edges.findIndex((e) => e <= sel.result.p80),
  );
  const at = (i: number) => Math.max(0, Math.min(edges.length - 1, i));
  const points: ChartPoint[] = [
    { id: 'pass', x: edges[at(iP80)], y: after[at(iP80)] },
    { id: 'residual', x: edges[at(iP80 + 4)], y: after[at(iP80 + 4)] },
    { id: 'chamber', x: edges[at(iP80 - 3)], y: closed[at(iP80 - 3)] },
  ];
  const callouts = passCallouts(series, count, (v, o) => num(v, o), sel.data.manifest.case_id);
  const toCls = (ascIndex: number) => edges.length - 1 - ascIndex;
  return (
    <ChartCallouts callouts={callouts} points={points} frame={{ x: [x[0], x[x.length - 1]], y: [0, 1], xLog: true }}>
      <UPlotChart
        title={{ en: 'Cumulative passing after n passes against size', es: 'Pasante acumulado tras n pasadas contra tamaño' }}
        height="fill"
        x={{ values: x, label: { en: 'Size', es: 'Tamaño' }, unit: 'mm', log: true }}
        y={{ label: { en: 'Passing', es: 'Pasante' }, range: [0, 1], format: { percent: true, decimals: 0 } }}
        series={lines}
        marks={cls !== null ? [{ x: edges[cls], label: { en: 'selected size', es: 'tamaño seleccionado' } }] : []}
        onPick={(i) => {
          const c = toCls(i);
          if (c >= 0 && c < n) select(linkedId('class', c), 'scene');
        }}
      />
    </ChartCallouts>
  );
}

/** The App's view (Product group): the product after n passes on the V3 axes, the residual and the mass sent back, at the shared pass. */
export function PassesView() {
  const { sel } = useView();
  const stateKey = useWorkbenchState()?.stateKey;
  const num = useNum();
  const { selectedId } = useLinkedSelection();
  const series = useMemo(() => (sel ? passSeriesOf(sel.op) : null), [sel]);
  const n = series?.n ?? 28;
  const count = usePassCount(n);
  if (!sel || !series) return <Pending />;
  const cls = selectedClass(selectedId, n);
  const residual = series.residual.map((r) => (r > 0 ? r : null));
  const passes = series.residual.map((_, k) => k);
  const k = Math.min(series.sentBack.length - 1, count);
  const mid = asc(sel.result.feed.midMm);
  const classMark = cls !== null ? [{ x: sel.result.feed.midMm[cls], label: { en: 'selected class', es: 'clase seleccionada' } as BiText }] : [];
  const followed = cls !== null ? { size: sel.result.feed.midMm[cls], now: series.product[Math.min(series.product.length - 1, count)][cls], final: series.closed[cls] } : null;
  return (
    <ViewsRow shares={[3, 2]}>
      <PlotCard
        fill
        title={{ en: 'The population balance, pass by pass', es: 'El balance poblacional, pasada a pasada' }}
        lane="live"
        provenance={provenanceOf(sel)}
        dataKey={stateKey}
        note={{
          en: `p_n = (I - C) sum_{k < n} (B C)^k f from the live engine's matrices; the dashed curve is the closed form p = (I - C)(I - B C)^-1 f. B is strictly lower triangular, so after ${n} passes (one per size class) the series is exact. Before that, the solid curve is the product that has already left the chamber, as a share of the final product.`,
          es: `p_n = (I - C) suma_{k < n} (B C)^k f con las matrices del motor en vivo; la curva segmentada es la forma cerrada p = (I - C)(I - B C)^-1 f. B es estrictamente triangular inferior, así que tras ${n} pasadas (una por clase de tamaño) la serie es exacta. Antes, la curva continua es el producto que ya salió de la cámara, como fracción del producto final.`,
        }}
      >
        <div className="cdem-stack" data-caos-flow="" data-pass-count={count} data-selected-class={cls ?? ''}>
          <PassControls n={n} />
          <PassesChart sel={sel} series={series} count={count} />
        </div>
      </PlotCard>
      <PlotCard
        fill
        title={{ en: 'Convergence and the mass sent back', es: 'Convergencia y la masa devuelta' }}
        lane="live"
        provenance={provenanceOf(sel)}
        dataKey={stateKey}
        note={
          followed
            ? {
                en: `Selected class at ${num(followed.size, { digits: 3 })} mm: ${num(followed.now, { digits: 3 })} of the feed has left in it after ${count} passes, of ${num(followed.final, { digits: 3 })} in the closed form.`,
                es: `Clase seleccionada en ${num(followed.size, { digits: 3 })} mm: ${num(followed.now, { digits: 3 })} de la alimentación salió en ella tras ${count} pasadas, de ${num(followed.final, { digits: 3 })} en la forma cerrada.`,
              }
            : { en: 'Select a size class on the gradation to follow its mass through the passes.', es: 'Seleccione una clase de tamaño en la gradación para seguir su masa a través de las pasadas.' }
        }
      >
        <div className="cdem-stack" data-caos-flow="">
          <div className="cdem-fill">
            <UPlotChart
              title={{ en: 'Residual against the pass count', es: 'Residuo contra el número de pasadas' }}
              height="fill"
              x={{ values: passes, label: { en: 'Passes', es: 'Pasadas' }, format: { decimals: 0 } }}
              y={{ label: { en: 'Residual (share of the feed)', es: 'Residuo (fracción de la alimentación)' }, log: true }}
              series={[{ id: 'residual', label: { en: 'L1 residual', es: 'Residuo L1' }, values: residual, color: LIVE_COLOR, width: 2, dots: true }]}
              marks={[{ x: count, label: { en: `pass ${count}`, es: `pasada ${count}` } }]}
            />
          </div>
          <div className="cdem-fill">
            <UPlotChart
              title={{ en: 'Mass nipped and sent back at this pass, per size class', es: 'Masa atrapada y devuelta en esta pasada, por clase de tamaño' }}
              height="fill"
              x={{ values: mid, label: { en: 'Size', es: 'Tamaño' }, unit: 'mm', log: true }}
              y={{ label: { en: 'Mass (share of the feed)', es: 'Masa (fracción de la alimentación)' } }}
              series={[{ id: 'sent', label: { en: `Sent back at pass ${k}`, es: `Devuelta en la pasada ${k}` }, values: finAll(asc(series.sentBack[k])), color: '--color-warn', width: 2, dots: true }]}
              marks={classMark}
            />
          </div>
        </div>
      </PlotCard>
    </ViewsRow>
  );
}

/** The passes to the story's tolerance, live from the engine at a point (null when the series never gets there). */
export function passesToSolve(op: Operating): number | null {
  return passesToResidual(passSeriesOf(op), SOLVE_TOLERANCE);
}
