// Group 5, Validation: the live engine against the committed replay at the manifest's own point, where a difference above the six
// digits the trace is written with is a defect the view shows and never hides; and, on a real survey, the measured values against
// the model, with CrusherCal's 80 percent predictive band. The measured-against-model view exists only for a real case.
import { BarChart, PlotCard, Verdict, ViewsRow, useShellLang, useWorkbenchState } from '@fasl-work/caos-app-shell';
import { UPlotChart, type ChartSeries } from '@fasl-work/caos-app-shell/chart';
import type { Text } from '../lib/contract.types';
import { bandHalfWidth, errorPct, nearSixDigits, parityOf, PARITY_TOLERANCE } from '../workbench/model';
import { Stack } from './draw';
import { bare, GroupFrame, Pending, provenanceOf, ReplayMissing, useNum, useT, useView, type Sub } from './shared';
import { asc, FEED_COLOR, finAll, LIVE_COLOR, REPLAY_COLOR, REPLAY_DASH } from './series';

function ParityView() {
  const { sel } = useView();
  const stateKey = useWorkbenchState()?.stateKey;
  const lang = useShellLang();
  const t = useT();
  const num = useNum();
  if (!sel) return <Pending />;
  const trace = sel.data.trace;
  if (!trace) return <ReplayMissing reason={sel.data.traceReason} />;
  const live = sel.baked.result;
  const s = trace.summary;
  const prov = provenanceOf(sel);
  const passing = parityOf(live.product.passing, trace.product_passing);
  const feedPassing = parityOf(live.feed.passing, trace.feed_passing);
  const scalars: { en: string; es: string; live: number; replay: number; digits?: number }[] = [
    { en: 'F80 (mm)', es: 'F80 (mm)', live: live.f80, replay: s.f80_mm },
    { en: 'P80 (mm)', es: 'P80 (mm)', live: live.p80, replay: s.p80_mm },
    { en: 'P50 (mm)', es: 'P50 (mm)', live: live.p50, replay: s.p50_mm },
    { en: 'P20 (mm)', es: 'P20 (mm)', live: live.p20, replay: s.p20_mm },
    { en: 'Reduction ratio', es: 'Razón de reducción', live: live.reductionRatio, replay: s.reduction_ratio },
    { en: 'Throughput (t/h)', es: 'Capacidad (t/h)', live: live.throughputTph, replay: s.throughput_tph },
    { en: 'Power (kW)', es: 'Potencia (kW)', live: live.powerKw, replay: s.power_kw },
    { en: 'Specific energy (kWh/t)', es: 'Energía específica (kWh/t)', live: live.specificEnergyKwhT, replay: s.specific_energy_kwh_t },
  ];
  const scalarBad = scalars.filter((r) => !nearSixDigits(r.live, r.replay));
  const worstSize = passing.at >= 0 ? live.product.edgesMm[passing.at] : NaN;
  const ok = passing.ok && feedPassing.ok && scalarBad.length === 0;
  const verdict: Text = ok
    ? {
        en: `The live engine reproduces the replay: the largest difference in passing is ${num(passing.worst, { digits: 3 })}, below ${num(PARITY_TOLERANCE, { digits: 1 })}.`,
        es: `El motor en vivo reproduce el replay: la mayor diferencia en el pasante es ${num(passing.worst, { digits: 3 })}, bajo ${num(PARITY_TOLERANCE, { digits: 1 })}.`,
      }
    : {
        en: `Defect: the live engine departs from the replay. The largest difference in passing is ${num(passing.worst, { digits: 3 })} at ${num(worstSize, { digits: 3 })} mm, above ${num(PARITY_TOLERANCE, { digits: 1 })}${scalarBad.length ? `; ${scalarBad.length} summary value(s) differ beyond six digits` : ''}.`,
        es: `Defecto: el motor en vivo se aparta del replay. La mayor diferencia en el pasante es ${num(passing.worst, { digits: 3 })} en ${num(worstSize, { digits: 3 })} mm, sobre ${num(PARITY_TOLERANCE, { digits: 1 })}${scalarBad.length ? `; ${scalarBad.length} valor(es) del resumen difieren más allá de seis dígitos` : ''}.`,
      };
  const x = asc(live.product.edgesMm);
  const overlay: ChartSeries[] = [
    { label: { en: 'Feed (live)', es: 'Alimentación (en vivo)' }, values: finAll(asc(live.feed.passing)), color: FEED_COLOR, width: 1.4 },
    { label: { en: 'Product (live)', es: 'Producto (en vivo)' }, values: finAll(asc(live.product.passing)), color: LIVE_COLOR, width: 2.4 },
    { label: { en: 'Product (replay)', es: 'Producto (replay)' }, values: finAll(asc(trace.product_passing)), color: REPLAY_COLOR, dash: REPLAY_DASH, width: 1.8 },
  ];
  const diff = live.product.passing.map((v, i) => v - trace.product_passing[i]);
  const tolerance = [
    { y: PARITY_TOLERANCE, label: { en: 'tolerance', es: 'tolerancia' }, tone: 'bad' as const },
    { y: -PARITY_TOLERANCE, tone: 'bad' as const },
  ];
  return (
    <>
      <PlotCard title={{ en: 'The two lanes at the case’s own point', es: 'Los dos carriles en el punto propio del caso' }} lane="live" provenance={prov} dataKey={stateKey}>
        <Stack>
        <Verdict compact title={{ en: 'Live against replay', es: 'En vivo contra replay' }} tone={ok ? 'good' : 'bad'} verdict={verdict} />
        <div className="cdem-tablewrap">
          <table className="caos-table" data-state="ready">
            <thead>
              <tr>
                <th>{t('Lane', 'Carril')}</th>
                {scalars.map((r) => (
                  <th key={r.en}>{lang === 'es' ? r.es : r.en}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t('Replay (Python)', 'Replay (Python)')}</td>
                {scalars.map((r) => (
                  <td key={r.en}>{num(r.replay, { digits: 6 })}</td>
                ))}
              </tr>
              <tr>
                <td>{t('Live (TypeScript)', 'En vivo (TypeScript)')}</td>
                {scalars.map((r) => (
                  <td key={r.en}>{num(r.live, { digits: 6 })}</td>
                ))}
              </tr>
              <tr>
                <td>{t('Difference', 'Diferencia')}</td>
                {scalars.map((r) => (
                  <td key={r.en}>{num(Math.abs(r.live - r.replay), { digits: 3 })}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        </Stack>
      </PlotCard>
      <ViewsRow shares={[3, 2]}>
        <PlotCard fill title={{ en: 'Gradations, live and replay', es: 'Gradaciones, en vivo y replay' }} lane="live" provenance={prov} dataKey={stateKey}>
          <UPlotChart
            title={{ en: 'Feed and product passing, live and replay', es: 'Pasante de la alimentación y del producto, en vivo y replay' }}
            height="fill"
            x={{ values: x, label: { en: 'Size', es: 'Tamaño' }, unit: 'mm', log: true }}
            y={{ label: { en: 'Passing', es: 'Pasante' }, range: [0, 1], format: { percent: true, decimals: 0 } }}
            series={overlay}
          />
        </PlotCard>
        <PlotCard
          fill
          title={{ en: 'Live minus replay', es: 'En vivo menos replay' }}
          lane="live"
          provenance={prov}
          dataKey={stateKey}
          note={{ en: 'Red lines: the tolerance, six digits of the trace.', es: 'Líneas rojas: la tolerancia, seis dígitos de la traza.' }}
        >
          <UPlotChart
            title={{ en: 'Difference in passing against size', es: 'Diferencia del pasante contra tamaño' }}
            height="fill"
            x={{ values: x, label: { en: 'Size', es: 'Tamaño' }, unit: 'mm', log: true }}
            y={{ label: { en: 'Live minus replay', es: 'En vivo menos replay' }, format: { digits: 2 } }}
            series={[{ label: { en: 'Difference', es: 'Diferencia' }, values: finAll(asc(diff)), color: '--color-magenta', width: 2 }]}
            yMarks={tolerance}
          />
        </PlotCard>
      </ViewsRow>
    </>
  );
}

function MeasuredView() {
  const { sel, loo } = useView();
  const stateKey = useWorkbenchState()?.stateKey;
  const t = useT();
  const num = useNum();
  if (!sel) return <Pending />;
  const measured = sel.data.manifest.measured;
  if (!measured) return <Pending />;
  const model = sel.baked.result;
  const tph = { measured: measured.feed_tph, model: model.throughputTph };
  const kw = { measured: measured.power_kw, model: model.powerKw };
  const bandTph = loo?.state === 'ready' ? bandHalfWidth(loo.data, 'tph') : null;
  const bandKw = loo?.state === 'ready' ? bandHalfWidth(loo.data, 'kW') : null;
  const reason = loo?.state === 'unavailable' ? loo.reason : null;
  const inside = (a: { measured: number; model: number }, band: number | null) => (band === null ? t('band not available yet', 'banda aún no disponible') : Math.abs(a.model - a.measured) <= band ? t('yes', 'sí') : t('no', 'no'));
  const rows = [
    { key: 'f80', en: 'Feed F80 (mm)', es: 'F80 de la alimentación (mm)', measured: measured.f80_mm, model: model.f80, band: null as number | null, check: false },
    { key: 'tph', en: 'Throughput (t/h)', es: 'Capacidad (t/h)', measured: tph.measured, model: tph.model, band: bandTph, check: true },
    { key: 'kw', en: 'Power (kW)', es: 'Potencia (kW)', measured: kw.measured, model: kw.model, band: bandKw, check: true },
  ];
  const prov = provenanceOf(sel);
  const bandNote: Text = reason
    ? { en: `The predictive band is not available yet: ${bare(reason.en)}.`, es: `La banda predictiva aún no está disponible: ${bare(reason.es)}.` }
    : { en: 'The band is CrusherCal’s 80 percent predictive half-width from the strict leave-one-survey-out folds. The pre-registered null holds: the residual model does not beat the calibrated backbone out of sample.', es: 'La banda es la semianchura predictiva del 80 por ciento de CrusherCal, de los pliegues estrictos que dejan un muestreo fuera. El nulo preregistrado se cumple: el modelo de residuos no supera al esqueleto calibrado fuera de muestra.' };
  return (
    <>
      <PlotCard title={{ en: 'Measured against the calibrated model', es: 'Medido contra el modelo calibrado' }} lane="live" provenance={prov} dataKey={stateKey} note={bandNote}>
        <div className="cdem-tablewrap">
          <table className="caos-table" data-state="ready">
            <thead>
              <tr>
                <th className="caos-col-text">{t('Quantity', 'Magnitud')}</th>
                <th>{t('Measured', 'Medido')}</th>
                <th>{t('Model', 'Modelo')}</th>
                <th>{t('Error (%)', 'Error (%)')}</th>
                <th>{t('80% band half-width', 'Semibanda del 80%')}</th>
                <th>{t('Measured within the band', 'Medido dentro de la banda')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="caos-col-text">{t(r.en, r.es)}</td>
                  <td>{num(r.measured, { digits: 4 })}</td>
                  <td>{num(r.model, { digits: 4 })}</td>
                  <td>{num(errorPct(r.model, r.measured), { decimals: 1 })}</td>
                  <td>{r.check ? (r.band === null ? t('not available yet', 'aún no disponible') : num(r.band, { digits: 3 })) : t('not applicable', 'no aplica')}</td>
                  <td>{r.check ? inside(r, r.band) : t('not applicable', 'no aplica')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PlotCard>
      <ViewsRow>
        <PlotCard fill title={{ en: 'Throughput, measured and model', es: 'Capacidad, medida y del modelo' }} lane="live" provenance={prov} dataKey={stateKey}>
          <BarChart
            title={{ en: 'Throughput, measured and model', es: 'Capacidad, medida y del modelo' }}
            orientation="vertical"
            height="fill"
            axis={{ label: { en: 'Throughput', es: 'Capacidad' }, unit: 't/h', format: { digits: 4 } }}
            data={[
              { id: 'measured', label: { en: 'Measured', es: 'Medida' }, value: tph.measured, tone: 'good' },
              { id: 'model', label: { en: 'Model', es: 'Modelo' }, value: tph.model, tone: 'accent' },
            ]}
          />
        </PlotCard>
        <PlotCard fill title={{ en: 'Power, measured and model', es: 'Potencia, medida y del modelo' }} lane="live" provenance={prov} dataKey={stateKey}>
          <BarChart
            title={{ en: 'Power, measured and model', es: 'Potencia, medida y del modelo' }}
            orientation="vertical"
            height="fill"
            axis={{ label: { en: 'Power', es: 'Potencia' }, unit: 'kW', format: { digits: 4 } }}
            data={[
              { id: 'measured', label: { en: 'Measured', es: 'Medida' }, value: kw.measured, tone: 'good' },
              { id: 'model', label: { en: 'Model', es: 'Modelo' }, value: kw.model, tone: 'accent' },
            ]}
          />
        </PlotCard>
      </ViewsRow>
    </>
  );
}

export function ValidationGroup() {
  const { sel } = useView();
  const tabs: Sub[] = [{ id: 'parity', label: { en: 'Live against replay', es: 'En vivo contra replay' }, content: <ParityView /> }];
  if (sel?.data.manifest.real_or_synthetic === 'real') tabs.push({ id: 'measured', label: { en: 'Measured against model', es: 'Medido contra modelo' }, content: <MeasuredView /> });
  return <GroupFrame group="validation" ariaLabel={{ en: 'Validation views', es: 'Vistas de validación' }} tabs={tabs} />;
}
