// Group 2, Product: the feed and product gradations (live solid, the committed replay dashed), the breakage appearance with the
// classification curve, and the mass balance per size class. Every chart is on the shell's `UPlotChart` or `BarChart`; the numbers
// under the charts are the engine's (live) and the trace's (replay). A case whose replay is absent keeps the live lane running and
// says the replay is not available yet, with the reason.
import { BarChart, PlotCard, ViewsRow, useWorkbenchState, type BarDatum, type BiText } from '@fasl-work/caos-app-shell';
import { useMemo } from 'react';
import { UPlotChart, type ChartSeries } from '@fasl-work/caos-app-shell/chart';
import { appearanceCum, phiFromT10, tFamily } from '../engine/breakage';
import { classificationParams, classify } from '../engine/classification';
import { evaluate } from '../engine/engine';
import type { Operating } from '../engine/types';
import type { Text } from '../lib/contract.types';
import { liveT10, type Selection } from '../workbench/model';
import { ChartCallouts, type CalloutSpec, type ChartPoint } from './callouts';
import { linkedId, selectedClass, useHours, useLinkedSelection } from './linked';
import { openingPass, PassesView, passCurves, passesWord, passSeriesOf, usePassCount } from './passes';
import { Fill, Stack } from './draw';
import { bare, GroupFrame, Pending, provenanceOf, useNum, useT, useView, type Sub } from './shared';
import { asc, FEED_COLOR, finAll, LIVE_COLOR, logSpace, REPLAY_COLOR, REPLAY_DASH } from './series';

const REPLAY_NOTE: Text = {
  en: 'Dashed: the committed replay of the case. It is not available yet for this case, so only the live lane is drawn.',
  es: 'Segmentada: el replay comprometido del caso. Aún no está disponible para este caso, así que solo se dibuja el carril en vivo.',
};

/** The note under a live-against-replay view: what solid and dashed mean, or why the replay is missing. */
function laneNote(reason: Text | null, hasReplay: boolean): Text {
  if (!hasReplay) return { en: `${REPLAY_NOTE.en} Reason: ${bare(reason?.en ?? 'the replay is not in this build')}.`, es: `${REPLAY_NOTE.es} Razón: ${bare(reason?.es ?? 'el replay no está en esta versión')}.` };
  return { en: 'Solid: the live engine at the rail’s values. Dashed: the committed replay of the case.', es: 'Continua: el motor en vivo con los valores del panel. Segmentada: el replay comprometido del caso.' };
}

/** The product the hours cursor stands for: the setting opened by the reader's drift rate times the hours (no wear rate is asserted). */
export function productAtHours(op: Operating, hours: number | null, driftMmPerH: number | null) {
  if (hours === null || !(hours > 0) || driftMmPerH === null || !(driftMmPerH > 0)) return null;
  const cssMm = op.cssMm + driftMmPerH * hours;
  return { hours, cssMm, result: evaluate({ ...op, cssMm }) };
}

/** What the engine's feed F80 is: the model's, reconstructed from the measured feed on a real survey (whose measured F80 differs: the
 * engine's 28-class feed truncates the Rosin-Rammler law the survey's F80 sets), and the model's on a synthetic case. */
export function modelF80Source(caseId: string, measuredF80: number | null, fmt: (v: number, o: { digits?: number }) => string): Text {
  return measuredF80 !== null
    ? { en: `Model feed F80, live engine, reconstructed from the measured ${fmt(measuredF80, { digits: 3 })} mm, ${caseId}`, es: `F80 del modelo, motor en vivo, reconstruido desde los ${fmt(measuredF80, { digits: 3 })} mm medidos, ${caseId}` }
    : { en: `Model feed F80, live engine at the rail's values, ${caseId}`, es: `F80 del modelo, motor en vivo con los valores del panel, ${caseId}` };
}

/** The three callouts of the gradation: F80 on the feed, P80 on the product, and the passing at the selected size (or at 1 mm). */
export function gradationCallouts(sel: Selection, cls: number | null, fmt: (v: number, o: { digits?: number; decimals?: number }) => string): { callouts: CalloutSpec[]; points: ChartPoint[] } {
  const r = sel.result;
  const source: Text = { en: `Live engine at the rail's values, ${sel.data.manifest.case_id}`, es: `Motor en vivo con los valores del panel, ${sel.data.manifest.case_id}` };
  const measuredF80 = sel.data.manifest.measured?.f80_mm ?? null;
  const edge = cls !== null ? r.product.edgesMm[cls] : 1;
  const passing = cls !== null ? r.product.passing[cls] : r.pctPassing[1];
  return {
    callouts: [
      { id: 'f80', eyebrow: { en: 'MODEL FEED F80', es: 'F80 DEL MODELO' }, value: Number.isFinite(r.f80) ? fmt(r.f80, { digits: 3 }) : null, unit: { en: 'mm', es: 'mm' }, state: 'normal', source: modelF80Source(sel.data.manifest.case_id, measuredF80, fmt) },
      { id: 'p80', eyebrow: { en: 'PRODUCT P80', es: 'P80 DEL PRODUCTO' }, value: Number.isFinite(r.p80) ? fmt(r.p80, { digits: 3 }) : null, unit: { en: 'mm', es: 'mm' }, state: 'selected', source },
      {
        id: 'class',
        eyebrow: cls !== null ? { en: `PASSING ${fmt(edge, { digits: 3 })} MM`, es: `PASANTE ${fmt(edge, { digits: 3 })} MM` } : { en: 'PASSING 1 MM', es: 'PASANTE 1 MM' },
        value: Number.isFinite(passing) ? fmt(passing * 100, { digits: 3 }) : null,
        unit: { en: '%', es: '%' },
        state: cls !== null ? 'selected' : 'normal',
        source,
      },
    ],
    points: [
      { id: 'f80', x: r.f80, y: 0.8 },
      { id: 'p80', x: r.p80, y: 0.8 },
      { id: 'class', x: edge, y: passing },
    ],
  };
}

export function GradationView() {
  const { sel, drift } = useView();
  const stateKey = useWorkbenchState()?.stateKey;
  const t = useT();
  const num = useNum();
  const { selectedId, select } = useLinkedSelection();
  const { hours } = useHours();
  const series = useMemo(() => (sel ? passSeriesOf(sel.op) : null), [sel]);
  const n = series?.n ?? 28;
  const count = usePassCount(n, series ? openingPass(series) : n);
  if (!sel || !series) return <Pending />;
  const r = sel.result;
  const trace = sel.data.trace;
  const x = asc(r.feed.edgesMm);
  const cls = selectedClass(selectedId, n);
  const params = classificationParams(sel.op.machine, sel.op.cssMm, { f80Mm: r.f80, calibrated: sel.op.calibrated, throwMm: sel.op.throwMm });
  const lines: ChartSeries[] = [
    { id: 'feed', label: { en: 'Feed (live)', es: 'Alimentación (en vivo)' }, values: finAll(asc(r.feed.passing)), color: FEED_COLOR, width: 1.6 },
    { id: 'product', label: { en: 'Product (live)', es: 'Producto (en vivo)' }, values: finAll(asc(r.product.passing)), color: LIVE_COLOR, width: 2.4 },
  ];
  if (trace) lines.push({ id: 'replay', label: { en: 'Product (replay)', es: 'Producto (replay)' }, values: finAll(asc(trace.product_passing)), color: REPLAY_COLOR, dash: REPLAY_DASH, width: 1.8 });
  lines.push({ id: 'classification', label: { en: 'Classification C (chance of breakage)', es: 'Clasificación C (probabilidad de fractura)' }, values: finAll(asc(r.feed.edgesMm.map((d) => classify(d, params)))), color: '--color-fg-faint', dash: [2, 3], width: 1.4 });
  if (count < n) {
    const { after } = passCurves(series, count);
    lines.push({ id: 'after', label: { en: `Product after ${count} ${passesWord(count, 'en')}`, es: `Producto tras ${count} ${passesWord(count, 'es')}` }, values: finAll(asc(after)), color: '--color-good', width: 2.2 });
  }
  const atHours = productAtHours(sel.op, hours, drift);
  if (atHours) lines.push({ id: 'hours', label: { en: `Product after ${num(atHours.hours, { digits: 3 })} h of drift`, es: `Producto tras ${num(atHours.hours, { digits: 3 })} h de desplazamiento` }, values: finAll(asc(atHours.result.product.passing)), color: '--color-bad', dash: [8, 3], width: 2 });
  const { callouts, points } = gradationCallouts(sel, cls, (v, o) => num(v, o));
  const lead = [num(r.f80, { digits: 4 }), num(r.p80, { digits: 4 }), num(r.reductionRatio, { decimals: 2 })];
  const measured = sel.data.manifest.measured ?? null;
  const replay = trace ? [num(trace.summary.f80_mm, { digits: 4 }), num(trace.summary.p80_mm, { digits: 4 }), num(trace.summary.reduction_ratio, { decimals: 2 })] : null;
  const marks: { x: number; label: BiText }[] = [
    { x: r.f80, label: { en: 'F80', es: 'F80' } },
    { x: r.p80, label: { en: 'P80', es: 'P80' } },
  ];
  if (cls !== null) marks.push({ x: r.product.edgesMm[cls], label: { en: 'selected size', es: 'tamaño seleccionado' } });
  // the chart's index runs fine to coarse over the edges; the class of an edge is the class it is the upper edge of
  const toCls = (ascIndex: number) => x.length - 1 - ascIndex;
  const note = laneNote(sel.data.traceReason, !!trace);
  return (
    <PlotCard
      fill
      title={{ en: 'Feed and product gradation', es: 'Gradación de la alimentación y del producto' }}
      lane="live"
      provenance={provenanceOf(sel)}
      dataKey={stateKey}
      note={{
        en: `${note.en} The faint dotted curve is the classification C on the same size axis. Select a size on the chart to follow its class in the population balance.`,
        es: `${note.es} La curva punteada tenue es la clasificación C sobre el mismo eje de tamaño. Seleccione un tamaño en el gráfico para seguir su clase en el balance poblacional.`,
      }}
    >
      <div className="cdem-stack" data-caos-flow="" data-pass-count={count} data-selected-class={cls ?? ''} data-hours={atHours ? atHours.hours : ''}>
        <div className="cdem-tablewrap">
          <table className="caos-table" data-state="ready">
            <thead>
              <tr>
                <th>{t('Lane', 'Carril')}</th>
                <th>{t('Feed F80 (mm)', 'F80 de alimentación (mm)')}</th>
                <th>{t('P80 (mm)', 'P80 (mm)')}</th>
                <th>{t('Reduction', 'Reducción')}</th>
              </tr>
            </thead>
            <tbody>
              {measured && (
                <tr data-measured-f80={measured.f80_mm}>
                  <td>{t(`Measured, survey ${measured.survey}`, `Medido, muestreo ${measured.survey}`)}</td>
                  <td>{num(measured.f80_mm, { digits: 4 })}</td>
                  <td>{t('not measured', 'no medido')}</td>
                  <td>{t('not measured', 'no medida')}</td>
                </tr>
              )}
              <tr>
                <td>{t('Model, live', 'Modelo, en vivo')}</td>
                {lead.map((v, i) => (
                  <td key={i}>{v}</td>
                ))}
              </tr>
              {replay && (
                <tr>
                  <td>{t('Model, replay', 'Modelo, replay')}</td>
                  {replay.map((v, i) => (
                    <td key={i}>{v}</td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ChartCallouts callouts={callouts} points={points} frame={{ x: [x[0], x[x.length - 1]], y: [0, 1], xLog: true }}>
          <UPlotChart
            title={{ en: 'Cumulative passing against size', es: 'Pasante acumulado contra tamaño' }}
            height="fill"
            x={{ values: x, label: { en: 'Size', es: 'Tamaño' }, unit: 'mm', log: true }}
            y={{ label: { en: 'Passing', es: 'Pasante' }, range: [0, 1], format: { percent: true, decimals: 0 } }}
            series={lines}
            marks={marks}
            onPick={(i) => {
              const c = toCls(i);
              if (c >= 0 && c < n) select(linkedId('class', c), 'scene');
            }}
          />
        </ChartCallouts>
      </div>
    </PlotCard>
  );
}

/** The cumulative breakage function B(u) of the Austin appearance model for a t10, over the relative size u from 0.01 to 1. */
function appearanceCurve(t10: number, u: number[]): number[] {
  const phi = phiFromT10(t10);
  return u.map((v) => appearanceCum(v, phi));
}

function BreakageView() {
  const { sel } = useView();
  const stateKey = useWorkbenchState()?.stateKey;
  const t = useT();
  const num = useNum();
  if (!sel) return <Pending />;
  const r = sel.result;
  const trace = sel.data.trace;
  const t10 = liveT10(sel.op, r.f80);
  const u = logSpace(0.01, 1, 60);
  const familyLive = tFamily(t10);
  const familyReplay = trace ? tFamily(trace.appearance_t10) : null;
  const mid = asc(r.feed.midMm);
  const params = classificationParams(sel.op.machine, sel.op.cssMm, { f80Mm: r.f80, calibrated: sel.op.calibrated, throwMm: sel.op.throwMm });
  const classLive = asc(r.feed.midMm.map((d) => classify(d, params)));
  const appearance: ChartSeries[] = [{ label: { en: 'Live', es: 'En vivo' }, values: finAll(appearanceCurve(t10, u)), color: LIVE_COLOR, width: 2.4 }];
  if (trace) appearance.push({ label: { en: 'Replay', es: 'Replay' }, values: finAll(appearanceCurve(trace.appearance_t10, u)), color: REPLAY_COLOR, dash: REPLAY_DASH, width: 1.8 });
  const classification: ChartSeries[] = [{ label: { en: 'Live', es: 'En vivo' }, values: finAll(classLive), color: LIVE_COLOR, width: 2.4 }];
  if (trace) classification.push({ label: { en: 'Replay', es: 'Replay' }, values: finAll(asc(trace.classification)), color: REPLAY_COLOR, dash: REPLAY_DASH, width: 1.8 });
  const prov = provenanceOf(sel);
  return (
    <>
      <PlotCard
        title={{ en: 'The t-family of the breakage appearance', es: 'La familia t de la apariencia de fractura' }}
        lane="live"
        provenance={prov}
        dataKey={stateKey}
        note={{
          en: `tn is the percent of the progeny finer than 1/n of the parent size; t10 is the fitted value, ${num(t10, { percent: true, decimals: 1 })} here.`,
          es: `tn es el porcentaje de la progenie más fina que 1/n del tamaño del padre; t10 es el valor ajustado, ${num(t10, { percent: true, decimals: 1 })} aquí.`,
        }}
      >
        <div className="cdem-tablewrap">
          <table className="caos-table" data-state="ready">
            <thead>
              <tr>
                <th>{t('Lane', 'Carril')}</th>
                {familyLive.map((f) => (
                  <th key={f.n}>{`t${f.n}`}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t('Live', 'En vivo')}</td>
                {familyLive.map((f) => (
                  <td key={f.n}>{num(f.tn, { percent: true, decimals: 1 })}</td>
                ))}
              </tr>
              {trace && familyReplay && (
                <tr>
                  <td>{t('Replay', 'Replay')}</td>
                  {familyReplay.map((f) => (
                    <td key={f.n}>{num(f.tn, { percent: true, decimals: 1 })}</td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PlotCard>
      <ViewsRow>
        <PlotCard
          fill
          title={{ en: 'Breakage appearance function', es: 'Función de apariencia de fractura' }}
          lane="live"
          provenance={prov}
          dataKey={stateKey}
          note={{
            en: `${laneNote(sel.data.traceReason, !!trace).en} B(u) is the share of the progeny finer than u times the parent size.`,
            es: `${laneNote(sel.data.traceReason, !!trace).es} B(u) es la fracción de la progenie más fina que u veces el tamaño del padre.`,
          }}
        >
          <UPlotChart
            title={{ en: 'Cumulative breakage against relative size', es: 'Fractura acumulada contra tamaño relativo' }}
            height="fill"
            x={{ values: u, label: { en: 'Relative size u', es: 'Tamaño relativo u' }, log: true, format: { digits: 2 } }}
            y={{ label: { en: 'Progeny finer than u', es: 'Progenie más fina que u' }, range: [0, 1], format: { percent: true, decimals: 0 } }}
            series={appearance}
            marks={[{ x: 0.1, label: 't10' }]}
          />
        </PlotCard>
        <PlotCard
          fill
          title={{ en: 'Classification: the chance a particle is broken', es: 'Clasificación: la probabilidad de que una partícula se fracture' }}
          lane="live"
          provenance={prov}
          dataKey={stateKey}
          note={{ en: 'K1 is the size below which a particle always escapes; K2, the size above which it is always broken.', es: 'K1 es el tamaño bajo el cual una partícula siempre escapa; K2, el tamaño sobre el cual siempre se fractura.' }}
        >
          <UPlotChart
            title={{ en: 'Classification against size', es: 'Clasificación contra tamaño' }}
            height="fill"
            x={{ values: mid, label: { en: 'Size', es: 'Tamaño' }, unit: 'mm', log: true }}
            y={{ label: { en: 'Probability of breakage', es: 'Probabilidad de fractura' }, range: [0, 1], format: { decimals: 1 } }}
            series={classification}
            marks={[
              { x: params.k1, label: 'K1' },
              { x: params.k2, label: 'K2' },
            ]}
          />
        </PlotCard>
      </ViewsRow>
    </>
  );
}

/** The mass balance: the mass fraction of feed and product in each size class; the classes finer than 0.5 mm are one bar. */
function BalanceView() {
  const { sel } = useView();
  const stateKey = useWorkbenchState()?.stateKey;
  const t = useT();
  const num = useNum();
  if (!sel) return <Pending />;
  const r = sel.result;
  const trace = sel.data.trace;
  // Size bands of two sieve classes each, named by the upper sieve edge in millimetres (the engine's grid is the square-root-of-two
  // series, so two classes are one factor of two); the classes under 0.5 mm are one last band.
  const CUT = 0.5;
  const edges = r.feed.edgesMm;
  const finite = (v: number): number | null => (Number.isFinite(v) ? v : null);
  const sumOf = (a: number[], from: number, to: number) => a.slice(from, to).reduce((acc, v) => acc + v, 0);
  const bands: { id: string; label: string; from: number; to: number }[] = [];
  for (let k = 0; 2 * k < edges.length - 1 && edges[2 * k] > CUT; k++) bands.push({ id: `b${k}`, label: num(edges[2 * k], { digits: 3 }), from: 2 * k, to: 2 * k + 2 });
  const lastTo = bands.length ? bands[bands.length - 1].to : 0;
  bands.push({ id: 'fines', label: `< ${num(CUT, { digits: 2 })}`, from: lastTo, to: r.feed.mass.length });
  const groups = bands.map((b) => ({ id: b.id, label: b.label, feed: sumOf(r.feed.mass, b.from, b.to), product: sumOf(r.product.mass, b.from, b.to) }));
  const data: BarDatum[] = groups.flatMap((g) => {
    const group = { id: g.id, label: g.label };
    return [
      { id: `${g.id}-feed`, label: { en: 'Feed', es: 'Alimentación' }, group, value: finite(g.feed), tone: 'neutral' as const },
      { id: `${g.id}-product`, label: { en: 'Product', es: 'Producto' }, group, value: finite(g.product), tone: 'accent' as const },
    ];
  });
  const totalFeed = r.feed.mass.reduce((s, v) => s + v, 0);
  const totalProduct = r.product.mass.reduce((s, v) => s + v, 0);
  return (
    <PlotCard
      fill
      title={{ en: 'Mass balance by size class', es: 'Balance de masa por clase de tamaño' }}
      lane="live"
      provenance={provenanceOf(sel)}
      dataKey={stateKey}
      note={{
        en: 'Each bar pair is a size band of two sieve classes, named by its upper sieve edge in millimetres; the classes finer than 0.5 mm are added into the last pair. Breakage conserves mass: each column of the breakage matrix sums to one.',
        es: 'Cada par de barras es una banda de tamaño de dos clases de tamiz, nombrada por su abertura superior de tamiz en milímetros; las clases más finas que 0,5 mm se suman en el último par. La fractura conserva la masa: cada columna de la matriz de fractura suma uno.',
      }}
    >
      <Stack>
        <div className="cdem-tablewrap">
          <table className="caos-table" data-state="ready">
            <thead>
              <tr>
                <th>{t('Lane', 'Carril')}</th>
                <th>{t('Feed mass (sum)', 'Masa de alimentación (suma)')}</th>
                <th>{t('Product mass (sum)', 'Masa de producto (suma)')}</th>
                <th>{t('Closure error', 'Error de cierre')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t('Live', 'En vivo')}</td>
                <td>{num(totalFeed, { decimals: 6 })}</td>
                <td>{num(totalProduct, { decimals: 6 })}</td>
                <td>{num(r.massClosure, { digits: 3 })}</td>
              </tr>
              {trace && (
                <tr>
                  <td>{t('Replay', 'Replay')}</td>
                  <td>{num(trace.feed_mass.reduce((s, v) => s + v, 0), { decimals: 6 })}</td>
                  <td>{num(trace.product_mass.reduce((s, v) => s + v, 0), { decimals: 6 })}</td>
                  <td>{num(trace.summary.mass_closure, { digits: 3 })}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Fill>
          <BarChart
            title={{ en: 'Mass fraction by size class, feed against product', es: 'Fracción de masa por clase de tamaño, alimentación contra producto' }}
            orientation="vertical"
            height="fill"
            values={false}
            axis={{ label: { en: 'Mass fraction', es: 'Fracción de masa' }, format: { percent: true, decimals: 0 } }}
            data={data}
            legend={[
              { tone: 'neutral', label: { en: 'Feed', es: 'Alimentación' } },
              { tone: 'accent', label: { en: 'Product', es: 'Producto' } },
            ]}
          />
        </Fill>
      </Stack>
    </PlotCard>
  );
}

export function ProductGroup() {
  const tabs: Sub[] = [
    { id: 'gradation', label: { en: 'Gradation', es: 'Gradación' }, content: <GradationView /> },
    { id: 'passes', label: { en: 'Population balance', es: 'Balance poblacional' }, content: <PassesView /> },
    { id: 'breakage', label: { en: 'Breakage', es: 'Fractura' }, content: <BreakageView /> },
    { id: 'balance', label: { en: 'Mass balance', es: 'Balance de masa' }, content: <BalanceView /> },
  ];
  return <GroupFrame group="product" ariaLabel={{ en: 'Product views', es: 'Vistas del producto' }} tabs={tabs} />;
}
