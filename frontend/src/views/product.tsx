// Group 2, Product: the feed and product gradations (live solid, the committed replay dashed), the breakage appearance with the
// classification curve, and the mass balance per size class. Every chart is on the shell's `UPlotChart` or `BarChart`; the numbers
// under the charts are the engine's (live) and the trace's (replay). A case whose replay is absent keeps the live lane running and
// says the replay is not available yet, with the reason.
import { BarChart, PlotCard, ViewsRow, useWorkbenchState, type BarDatum } from '@fasl-work/caos-app-shell';
import { UPlotChart, type ChartSeries } from '@fasl-work/caos-app-shell/chart';
import { appearanceCum, phiFromT10, tFamily } from '../engine/breakage';
import { classificationParams, classify } from '../engine/classification';
import type { Text } from '../lib/contract.types';
import { liveT10 } from '../workbench/model';
import { Fill, Stack } from './draw';
import { bare, GroupFrame, Pending, provenanceOf, READOUT_SIZES, useNum, useT, useView, type Sub } from './shared';
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

function GradationView() {
  const { sel } = useView();
  const stateKey = useWorkbenchState()?.stateKey;
  const t = useT();
  const num = useNum();
  if (!sel) return <Pending />;
  const r = sel.result;
  const trace = sel.data.trace;
  const x = asc(r.feed.edgesMm);
  const series: ChartSeries[] = [
    { label: { en: 'Feed (live)', es: 'Alimentación (en vivo)' }, values: finAll(asc(r.feed.passing)), color: FEED_COLOR, width: 1.6 },
    { label: { en: 'Product (live)', es: 'Producto (en vivo)' }, values: finAll(asc(r.product.passing)), color: LIVE_COLOR, width: 2.4 },
  ];
  if (trace) series.push({ label: { en: 'Product (replay)', es: 'Producto (replay)' }, values: finAll(asc(trace.product_passing)), color: REPLAY_COLOR, dash: REPLAY_DASH, width: 1.8 });
  const lead = [num(r.f80, { digits: 4 }), num(r.p80, { digits: 4 }), num(r.reductionRatio, { decimals: 2 })];
  const passing = READOUT_SIZES.map((s) => num(r.pctPassing[s], { percent: true, decimals: 1 }));
  const live = [...lead, ...passing];
  const replay = trace
    ? [
        num(trace.summary.f80_mm, { digits: 4 }),
        num(trace.summary.p80_mm, { digits: 4 }),
        num(trace.summary.reduction_ratio, { decimals: 2 }),
        ...READOUT_SIZES.map((s) => num(trace.summary.pct_passing[String(s)], { percent: true, decimals: 1 })),
      ]
    : null;
  return (
    <PlotCard fill title={{ en: 'Feed and product gradation', es: 'Gradación de la alimentación y del producto' }} lane="live" provenance={provenanceOf(sel)} dataKey={stateKey} note={laneNote(sel.data.traceReason, !!trace)}>
      <Stack>
        <div className="cdem-tablewrap">
          <table className="caos-table" data-state="ready">
            <thead>
              <tr>
                <th rowSpan={2}>{t('Lane', 'Carril')}</th>
                <th rowSpan={2}>{t('F80 (mm)', 'F80 (mm)')}</th>
                <th rowSpan={2}>{t('P80 (mm)', 'P80 (mm)')}</th>
                <th rowSpan={2}>{t('Reduction', 'Reducción')}</th>
                <th colSpan={READOUT_SIZES.length} style={{ textAlign: 'center' }}>
                  {t('Passing at size (mm)', 'Pasante según tamaño (mm)')}
                </th>
              </tr>
              <tr>
                {READOUT_SIZES.map((sz) => (
                  <th key={sz}>{num(sz, { decimals: 0 })}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t('Live', 'En vivo')}</td>
                {live.map((v, i) => (
                  <td key={i}>{v}</td>
                ))}
              </tr>
              {replay && (
                <tr>
                  <td>{t('Replay', 'Replay')}</td>
                  {replay.map((v, i) => (
                    <td key={i}>{v}</td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Fill>
          <UPlotChart
            title={{ en: 'Cumulative passing against size', es: 'Pasante acumulado contra tamaño' }}
            height="fill"
            x={{ values: x, label: { en: 'Size', es: 'Tamaño' }, unit: 'mm', log: true }}
            y={{ label: { en: 'Passing', es: 'Pasante' }, range: [0, 1], format: { percent: true, decimals: 0 } }}
            series={series}
            marks={[
              { x: r.f80, label: 'F80' },
              { x: r.p80, label: 'P80' },
            ]}
          />
        </Fill>
      </Stack>
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
    { id: 'breakage', label: { en: 'Breakage', es: 'Fractura' }, content: <BreakageView /> },
    { id: 'balance', label: { en: 'Mass balance', es: 'Balance de masa' }, content: <BalanceView /> },
  ];
  return <GroupFrame group="product" ariaLabel={{ en: 'Product views', es: 'Vistas del producto' }} tabs={tabs} />;
}
