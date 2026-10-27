// The last three experimental questions, on the ten measured HP500 surveys: where the surveys sit in feed rate against setting (the real
// envelope), whether the calibrated capacity backbone reproduces the measured throughput out of sample, and whether the engine's power
// reproduces the measured power. The numbers are CrusherCal's committed document (`hp500/loo.json`) and the surveys' manifests; nothing is
// recomputed here except the held-out residuals and the correlations, which are differences and sums of the committed values.
import { PlotCard, ViewsRow, useFormat, useShellLang } from '@fasl-work/caos-app-shell';
import { UPlotChart, type ChartSeries } from '@fasl-work/caos-app-shell/chart';
import type { CaseData } from '../../api/artifacts';
import { HP500_ENVELOPE } from '../../engine/envelope';
import type { Hp500Loo, Text } from '../../lib/contract.types';
import { P, useT } from '../bi';
import { DataView, Scroll } from './context';
import { classOf, coverage, MODEL_KEYS, MODEL_LABEL, pearson, surveysOf, type ModelKey } from './data';

// ---- 4. the real envelope ----

const CLASSES = 3;
const CLASS_COLOR = ['--color-accent-2', '--color-accent', '--color-magenta'] as const;

function EnvelopeBody({ cases }: { cases: CaseData[] }) {
  const t = useT();
  const f = useFormat();
  const lang = useShellLang();
  const s = surveysOf(cases);
  const f80Lo = Math.min(...s.map((r) => r.f80));
  const f80Hi = Math.max(...s.map((r) => r.f80));
  const edge = (k: number) => f80Lo + ((f80Hi - f80Lo) * k) / CLASSES;
  const x = s.map((r) => r.feedTph);
  const series: ChartSeries[] = Array.from({ length: CLASSES }, (_, k) => ({
    label: { en: `Feed f80 ${f(edge(k), { decimals: 0 })} to ${f(edge(k + 1), { decimals: 0 })} mm`, es: `f80 del alimento ${f(edge(k), { decimals: 0 })} a ${f(edge(k + 1), { decimals: 0 })} mm` },
    values: s.map((r) => (classOf(r.f80, f80Lo, f80Hi, CLASSES) === k ? r.css : null)),
    color: CLASS_COLOR[k],
    mode: 'points' as const,
    size: 11,
  }));
  const rCss = pearson(s.map((r) => r.css), x);
  const rF80 = pearson(s.map((r) => r.f80), x);
  const [cLo, cHi] = HP500_ENVELOPE.cssMm;
  return (
    <>
      <PlotCard
        title={{ en: 'The ten surveys, as measured', es: 'Los diez muestreos, tal como se midieron' }}
        lane="replay"
        provenance="real"
        note={{ en: 'Measured values of Table A1 of the open dataset, read from each survey manifest. The power was estimated from the electric current by the authors.', es: 'Valores medidos de la Tabla A1 del conjunto de datos abierto, leídos del manifiesto de cada muestreo. La potencia fue estimada por los autores a partir de la corriente eléctrica.' }}
      >
        <Scroll>
          <table className="caos-table" data-state="ready">
            <thead>
              <tr>
                <th>{t('Survey', 'Muestreo')}</th>
                <th>{t('Setting (mm)', 'Abertura (mm)')}</th>
                <th>{t('Feed f80 (mm)', 'f80 del alimento (mm)')}</th>
                <th>{t('Feed rate (t/h)', 'Flujo de alimentación (t/h)')}</th>
                <th>{t('Power (kW)', 'Potencia (kW)')}</th>
                <th>{t('Feed f80 class', 'Clase de f80')}</th>
              </tr>
            </thead>
            <tbody>
              {s.map((r) => (
                <tr key={r.id}>
                  <td>{r.n}</td>
                  <td>{f(r.css, { digits: 3 })}</td>
                  <td>{f(r.f80, { digits: 3 })}</td>
                  <td>{f(r.feedTph, { digits: 4 })}</td>
                  <td>{f(r.powerKw, { digits: 3 })}</td>
                  <td>{classOf(r.f80, f80Lo, f80Hi, CLASSES) + 1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </PlotCard>
      <PlotCard title={{ en: 'The real operating envelope', es: 'La envolvente de operación real' }} lane="replay" provenance="real" note={{ en: 'Classes of feed f80 are three equal widths between the smallest and the largest survey. The two lines are the calibrated support of the setting that the envelope gate holds.', es: 'Las clases de f80 son tres anchos iguales entre el menor y el mayor muestreo. Las dos líneas son el soporte calibrado de la abertura que mantiene la compuerta de envolvente.' }}>
        <UPlotChart
          title={{ en: 'Measured feed rate against closed-side setting for the ten HP500 surveys, coloured by feed f80', es: 'Flujo de alimentación medido frente a la abertura de lado cerrado de los diez muestreos HP500, coloreado por el f80 del alimento' }}
          height={340}
          solo
          x={{ values: x, label: { en: 'Measured feed rate', es: 'Flujo de alimentación medido' }, unit: { en: 't/h', es: 't/h' }, format: { digits: 4 }, range: [Math.min(...x) * 0.95, Math.max(...x) * 1.05] }}
          y={{ label: { en: 'Closed-side setting', es: 'Abertura de lado cerrado' }, unit: { en: 'mm', es: 'mm' }, format: { decimals: 0 }, range: [cLo - 4, cHi + 4] }}
          series={series}
          yMarks={[
            { y: cLo, label: { en: 'Calibrated support, lower', es: 'Soporte calibrado, inferior' }, tone: 'neutral' },
            { y: cHi, label: { en: 'Calibrated support, upper', es: 'Soporte calibrado, superior' }, tone: 'neutral' },
          ]}
          readout={(i) => {
            const r = s[i];
            return lang === 'es'
              ? `Muestreo ${r.n}: abertura ${f(r.css, { digits: 3 })} mm, f80 del alimento ${f(r.f80, { digits: 3 })} mm, flujo ${f(r.feedTph, { digits: 4 })} t/h`
              : `Survey ${r.n}: setting ${f(r.css, { digits: 3 })} mm, feed f80 ${f(r.f80, { digits: 3 })} mm, feed rate ${f(r.feedTph, { digits: 4 })} t/h`;
          }}
        />
      </PlotCard>
      <P
        en={`Reading: the surveys span a setting from ${f(Math.min(...s.map((r) => r.css)), { decimals: 0 })} to ${f(Math.max(...s.map((r) => r.css)), { decimals: 0 })} mm, a feed f80 from ${f(f80Lo, { decimals: 0 })} to ${f(f80Hi, { decimals: 0 })} mm and a feed rate from ${f(Math.min(...x), { digits: 4 })} to ${f(Math.max(...x), { digits: 4 })} t/h. The setting and the feed rate move together (correlation ${f(rCss, { decimals: 2 })}), while the feed f80 shows almost no link with the feed rate (correlation ${f(rF80, { decimals: 2 })}).`}
        es={`Lectura: los muestreos cubren una abertura de ${f(Math.min(...s.map((r) => r.css)), { decimals: 0 })} a ${f(Math.max(...s.map((r) => r.css)), { decimals: 0 })} mm, un f80 del alimento de ${f(f80Lo, { decimals: 0 })} a ${f(f80Hi, { decimals: 0 })} mm y un flujo de ${f(Math.min(...x), { digits: 4 })} a ${f(Math.max(...x), { digits: 4 })} t/h. La abertura y el flujo se mueven juntos (correlación ${f(rCss, { decimals: 2 })}), mientras que el f80 del alimento casi no se relaciona con el flujo (correlación ${f(rF80, { decimals: 2 })}).`}
      />
    </>
  );
}

export function EnvelopeView() {
  return <DataView rows={['case-index', 'case-manifest']}>{(b) => <EnvelopeBody cases={b.cases} />}</DataView>;
}

// ---- 5. the calibrated capacity ----

/** The held-out residual chart of a target: measured minus the strict prediction of the backbone, with the 80 percent band as two lines. */
function ResidualChart({ loo, target, unit, name }: { loo: Hp500Loo; target: 'tph' | 'kW'; unit: string; name: Text }) {
  const f = useFormat();
  const lang = useShellLang();
  const d = loo.loo[target];
  const n = d.measured.length;
  const nums = Array.from({ length: n }, (_, i) => i + 1);
  const resid = d.measured.map((y, i) => y - d.strict.pred.M0[i]);
  const half = d.strict.uq.band_halfwidth;
  return (
    <UPlotChart
      title={{ en: `Held-out residual of the backbone for ${name.en}, per survey, with the 80 percent band`, es: `Residuo reservado del esqueleto para ${name.es}, por muestreo, con la banda del 80 por ciento` }}
      height={300}
      x={{ values: nums, label: { en: 'Survey', es: 'Muestreo' }, format: { decimals: 0 }, ticks: nums.map((v) => ({ value: v, label: { en: String(v), es: String(v) } })), range: [0.5, n + 0.5] }}
      y={{ label: { en: 'Measured minus predicted', es: 'Medido menos predicho' }, unit: { en: unit, es: unit }, format: { digits: 3 }, range: [-Math.max(half, ...resid.map(Math.abs)) * 1.15, Math.max(half, ...resid.map(Math.abs)) * 1.15] }}
      series={[{ label: { en: 'Residual of M0, strict fold', es: 'Residuo de M0, pliegue estricto' }, values: resid, color: '--color-accent', mode: 'points', size: 10 }]}
      yMarks={[
        { y: half, label: { en: 'Upper limit of the 80 percent band', es: 'Límite superior de la banda del 80 por ciento' }, tone: 'good' },
        { y: -half, label: { en: 'Lower limit of the 80 percent band', es: 'Límite inferior de la banda del 80 por ciento' }, tone: 'good' },
        { y: 0, tone: 'neutral' },
      ]}
      readout={(i) =>
        lang === 'es'
          ? `Muestreo ${i + 1}: medido ${f(d.measured[i], { digits: 4 })} ${unit}, predicho ${f(d.strict.pred.M0[i], { digits: 4 })} ${unit}, residuo ${f(resid[i], { digits: 3 })} ${unit}`
          : `Survey ${i + 1}: measured ${f(d.measured[i], { digits: 4 })} ${unit}, predicted ${f(d.strict.pred.M0[i], { digits: 4 })} ${unit}, residual ${f(resid[i], { digits: 3 })} ${unit}`
      }
      hint={{ en: 'Hover the chart to read a survey', es: 'Pase el cursor por el gráfico para leer un muestreo' }}
    />
  );
}

function CapacityBody({ loo }: { loo: Hp500Loo }) {
  const t = useT();
  const f = useFormat();
  const lang = useShellLang();
  const d = loo.loo.tph;
  const cov = coverage(loo, 'tph');
  const m0 = d.strict.M0_backbone;
  const mean = d.strict.constant_mean;
  const shuffle = d.strict.M1_label_shuffle;
  const m1 = d.strict.M1_residual;
  const beats = m0.mape_pct < mean.mape_pct;
  const shuffleOk = m0.mape_pct < shuffle.mape_pct;
  const m1Better = m1.mape_pct < m0.mape_pct;
  const uq = d.strict.uq;
  return (
    <>
      <PlotCard
        title={{ en: 'Throughput, strict and leaky folds', es: 'Capacidad, pliegues estrictos y con fuga' }}
        lane="offline"
        provenance="real"
        note={{ en: `Scored on the ${f(loo.n, { decimals: 0 })} measured throughputs of the surveys. Strict: every scalar refitted without the held-out survey. Leaky: fitted on all ten, shown only to make the optimism visible.`, es: `Evaluado sobre las ${f(loo.n, { decimals: 0 })} capacidades medidas de los muestreos. Estricto: cada escalar se reajusta sin el muestreo retenido. Con fuga: ajustado con los diez, se muestra solo para hacer visible el optimismo.` }}
      >
        <Scroll>
          <table className="caos-table" data-state="ready">
            <thead>
              <tr>
                <th className="caos-col-text">{t('Model', 'Modelo')}</th>
                <th>{t('Strict MAPE (%)', 'MAPE estricto (%)')}</th>
                <th>{t('Strict RMSE (t/h)', 'RMSE estricto (t/h)')}</th>
                <th>{t('Strict R squared', 'R cuadrado estricto')}</th>
                <th>{t('Leaky MAPE (%)', 'MAPE con fuga (%)')}</th>
                <th>{t('Leaky R squared', 'R cuadrado con fuga')}</th>
              </tr>
            </thead>
            <tbody>
              {MODEL_KEYS.map((k: ModelKey) => (
                <tr key={k}>
                  <td className="caos-col-text">{MODEL_LABEL[k][lang]}</td>
                  <td>{f(d.strict[k].mape_pct, { decimals: 2 })}</td>
                  <td>{f(d.strict[k].rmse, { decimals: 2 })}</td>
                  <td>{f(d.strict[k].r2, { decimals: 3 })}</td>
                  <td>{f(d.leaky[k].mape_pct, { decimals: 2 })}</td>
                  <td>{f(d.leaky[k].r2, { decimals: 3 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </PlotCard>
      <ViewsRow>
        <PlotCard title={{ en: 'Measured against predicted throughput', es: 'Capacidad medida frente a predicha' }} lane="offline" provenance="real">
          <UPlotChart
            title={{ en: 'Parity of the calibrated backbone: measured against predicted throughput, strict and leaky folds', es: 'Paridad del esqueleto calibrado: capacidad medida frente a predicha, pliegues estrictos y con fuga' }}
            height={320}
            parity
            x={{ values: d.measured, label: { en: 'Measured throughput', es: 'Capacidad medida' }, unit: { en: 't/h', es: 't/h' }, format: { digits: 4 } }}
            y={{ label: { en: 'Predicted throughput', es: 'Capacidad predicha' }, unit: { en: 't/h', es: 't/h' }, format: { digits: 4 } }}
            series={[
              { label: { en: 'M0, strict fold (held out)', es: 'M0, pliegue estricto (retenido)' }, values: d.strict.pred.M0, color: '--color-accent', mode: 'points', size: 10 },
              { label: { en: 'M0, leaky fold (fitted on all ten)', es: 'M0, pliegue con fuga (ajustado con los diez)' }, values: d.leaky.pred.M0, color: '--color-warn', mode: 'points', size: 8 },
            ]}
          />
        </PlotCard>
        <PlotCard title={{ en: 'Held-out residual and 80 percent band', es: 'Residuo reservado y banda del 80 por ciento' }} lane="offline" provenance="real">
          <ResidualChart loo={loo} target="tph" unit="t/h" name={{ en: 'throughput', es: 'la capacidad' }} />
        </PlotCard>
      </ViewsRow>
      <P
        en={`Reading: on held-out surveys the backbone has a MAPE of ${f(m0.mape_pct, { decimals: 2 })} percent and an R squared of ${f(m0.r2, { decimals: 3 })}, against ${f(mean.mape_pct, { decimals: 2 })} percent for the constant mean, so the backbone ${beats ? 'beats' : 'does not beat'} the mean, and ${f(shuffle.mape_pct, { decimals: 2 })} percent for the label-shuffle control, which ${shuffleOk ? 'it also beats, as a result without leakage must' : 'it does not beat, which would mean leakage'}. The residual model M1 reaches ${f(m1.mape_pct, { decimals: 2 })} percent, ${m1Better ? 'below the backbone, so out of sample it adds some skill beyond the pre-registered expectation of a null' : 'not below the backbone, so out of sample it adds nothing, the null that was pre-registered'}. The 80 percent band is plus or minus ${f(uq.band_halfwidth, { decimals: 1 })} t/h (${f(uq.band_rel_pct, { decimals: 1 })} percent of the mean throughput) and holds ${f(cov.count, { decimals: 0 })} of ${f(loo.n, { decimals: 0 })} surveys, an in-sample empirical coverage of ${f(uq.empirical_coverage, { decimals: 2 })} against ${f(uq.nominal_coverage, { decimals: 2 })} nominal (its spread comes from the same residuals it is checked against)${uq.nested_coverage === undefined ? '' : `; taking each survey's spread from the other nine only, the out-of-sample coverage is ${f(uq.nested_coverage, { decimals: 2 })}`}; with ten surveys one survey moves the coverage by ${f(1 / loo.n, { decimals: 2 })}.`}
        es={`Lectura: con muestreos retenidos el esqueleto tiene un MAPE de ${f(m0.mape_pct, { decimals: 2 })} por ciento y un R cuadrado de ${f(m0.r2, { decimals: 3 })}, frente a ${f(mean.mape_pct, { decimals: 2 })} por ciento de la media constante, de modo que el esqueleto ${beats ? 'supera' : 'no supera'} a la media, y ${f(shuffle.mape_pct, { decimals: 2 })} por ciento del control de etiquetas barajadas, que ${shuffleOk ? 'también supera, como debe un resultado sin fuga' : 'no supera, lo que indicaría fuga'}. El modelo de residuos M1 llega a ${f(m1.mape_pct, { decimals: 2 })} por ciento, ${m1Better ? 'bajo el esqueleto, así que fuera de muestra aporta algo más que el nulo preregistrado' : 'sin bajar del esqueleto, así que fuera de muestra no aporta nada, el nulo que se preregistró'}. La banda del 80 por ciento es más o menos ${f(uq.band_halfwidth, { decimals: 1 })} t/h (${f(uq.band_rel_pct, { decimals: 1 })} por ciento de la capacidad media) y contiene ${f(cov.count, { decimals: 0 })} de ${f(loo.n, { decimals: 0 })} muestreos, una cobertura empírica dentro de la muestra de ${f(uq.empirical_coverage, { decimals: 2 })} frente a ${f(uq.nominal_coverage, { decimals: 2 })} nominal (su dispersión sale de los mismos residuos contra los que se verifica)${uq.nested_coverage === undefined ? '' : `; tomando la dispersión de cada muestreo solo de los otros nueve, la cobertura fuera de la muestra es ${f(uq.nested_coverage, { decimals: 2 })}`}; con diez muestreos uno solo mueve la cobertura en ${f(1 / loo.n, { decimals: 2 })}.`}
      />
    </>
  );
}

export function CapacityView() {
  return <DataView rows={['hp500-loo']} needsLoo>{(_b, loo) => (loo ? <CapacityBody loo={loo} /> : null)}</DataView>;
}

// ---- 6. the power ----

function PowerBody({ loo, surveys }: { loo: Hp500Loo; surveys: ReturnType<typeof surveysOf> }) {
  const t = useT();
  const f = useFormat();
  const lang = useShellLang();
  const pp = loo.power_parity;
  const kw = loo.loo.kW;
  const rows: { name: Text; scored: Text; s: { mape_pct: number; rmse: number; r2: number } }[] = [
    { name: { en: 'Bare Bond draw', es: 'Consumo de Bond puro' }, scored: { en: 'in sample', es: 'dentro de la muestra' }, s: pp.bare_bond },
    { name: { en: 'Paper form on the Bond draw, zeta 1.30 and no-load 110 kW', es: 'Forma del artículo sobre el consumo de Bond, zeta 1,30 y vacío 110 kW' }, scored: { en: 'in sample', es: 'dentro de la muestra' }, s: pp.engine_pc_1p30_110 },
    { name: { en: `Paper form refitted on all ten, zeta ${f(pp.refit_pc.zeta, { decimals: 2 })} and no-load ${f(pp.refit_pc.pn, { decimals: 1 })} kW`, es: `Forma del artículo reajustada con los diez, zeta ${f(pp.refit_pc.zeta, { decimals: 2 })} y vacío ${f(pp.refit_pc.pn, { decimals: 1 })} kW` }, scored: { en: 'in sample', es: 'dentro de la muestra' }, s: pp.refit_pc },
    { name: { en: 'Constant mean of the ten', es: 'Media constante de los diez' }, scored: { en: 'in sample', es: 'dentro de la muestra' }, s: pp.constant_mean },
    { name: { en: 'Paper form refitted without the survey (M0)', es: 'Forma del artículo reajustada sin el muestreo (M0)' }, scored: { en: 'held out', es: 'retenido' }, s: kw.strict.M0_backbone },
    { name: { en: 'Constant mean of the other nine', es: 'Media constante de los otros nueve' }, scored: { en: 'held out', es: 'retenido' }, s: kw.strict.constant_mean },
  ];
  const [bLo, bHi] = pp.bond_pd_range_kw;
  const [mLo, mHi] = pp.measured_range_kw;
  const share = (bHi - bLo) / (mHi - mLo);
  const m0 = kw.strict.M0_backbone;
  const mean = kw.strict.constant_mean;
  const cov = coverage(loo, 'kW');
  const css = surveys.map((s) => s.css);
  const negative = pp.bare_bond.r2 < 0 && !(m0.mape_pct < mean.mape_pct);
  return (
    <>
      <PlotCard
        title={{ en: 'Power estimates against the measured power', es: 'Estimaciones de potencia frente a la potencia medida' }}
        lane="offline"
        provenance="real"
        note={{ en: 'The first four rows are the in-sample contrast of the power path with the ten measured values; the last two are the strict held-out fold. The measured power was estimated from the electric current by the authors.', es: 'Las primeras cuatro filas son el contraste dentro de la muestra de la vía de potencia con los diez valores medidos; las dos últimas son el pliegue estricto retenido. La potencia medida fue estimada por los autores a partir de la corriente eléctrica.' }}
      >
        <Scroll>
          <table className="caos-table" data-state="ready">
            <thead>
              <tr>
                <th className="caos-col-text">{t('Power estimate', 'Estimación de potencia')}</th>
                <th>{t('Scored', 'Evaluada')}</th>
                <th>{t('MAPE (%)', 'MAPE (%)')}</th>
                <th>{t('RMSE (kW)', 'RMSE (kW)')}</th>
                <th>{t('R squared', 'R cuadrado')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="caos-col-text">{r.name[lang]}</td>
                  <td>{r.scored[lang]}</td>
                  <td>{f(r.s.mape_pct, { decimals: 2 })}</td>
                  <td>{f(r.s.rmse, { decimals: 2 })}</td>
                  <td>{f(r.s.r2, { decimals: 3 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </PlotCard>
      <ViewsRow>
        <PlotCard title={{ en: 'Measured against modelled power', es: 'Potencia medida frente a modelada' }} lane="offline" provenance="real">
          <UPlotChart
            title={{ en: 'Parity of the power estimates: measured against modelled power of the ten surveys', es: 'Paridad de las estimaciones de potencia: potencia medida frente a modelada de los diez muestreos' }}
            height={320}
            parity
            x={{ values: pp.per_survey.map((r) => r.measured), label: { en: 'Measured power', es: 'Potencia medida' }, unit: { en: 'kW', es: 'kW' }, format: { digits: 3 } }}
            y={{ label: { en: 'Modelled power', es: 'Potencia modelada' }, unit: { en: 'kW', es: 'kW' }, format: { digits: 3 } }}
            series={[
              { label: { en: 'Bare Bond draw', es: 'Consumo de Bond puro' }, values: pp.per_survey.map((r) => r.bare_bond), color: '--color-accent', mode: 'points', size: 10 },
              { label: { en: 'Paper form on the Bond draw', es: 'Forma del artículo sobre Bond' }, values: pp.per_survey.map((r) => r.engine_pc), color: '--color-bad', mode: 'points', size: 10 },
              { label: { en: 'Paper form refitted on all ten', es: 'Forma del artículo reajustada con los diez' }, values: pp.per_survey.map((r) => r.refit_pc), color: '--color-good', mode: 'points', size: 8 },
            ]}
          />
        </PlotCard>
        <PlotCard title={{ en: 'Power against the setting', es: 'Potencia frente a la abertura' }} lane="offline" provenance="real">
          <UPlotChart
            title={{ en: 'Measured power and the bare Bond draw against the closed-side setting of the ten surveys', es: 'Potencia medida y consumo de Bond puro frente a la abertura de lado cerrado de los diez muestreos' }}
            height={320}
            x={{ values: css, label: { en: 'Closed-side setting', es: 'Abertura de lado cerrado' }, unit: { en: 'mm', es: 'mm' }, format: { decimals: 0 } }}
            y={{ label: { en: 'Power', es: 'Potencia' }, unit: { en: 'kW', es: 'kW' }, format: { digits: 3 } }}
            series={[
              { label: { en: 'Measured', es: 'Medida' }, values: pp.per_survey.map((r) => r.measured), color: '--color-good', mode: 'points', size: 10 },
              { label: { en: 'Bare Bond draw', es: 'Consumo de Bond puro' }, values: pp.per_survey.map((r) => r.bare_bond), color: '--color-accent', mode: 'points', size: 10 },
            ]}
          />
        </PlotCard>
      </ViewsRow>
      <P
        en={`Reading: the Bond draw of the engine spans ${f(bLo, { digits: 4 })} to ${f(bHi, { digits: 4 })} kW while the measured power spans ${f(mLo, { digits: 4 })} to ${f(mHi, { digits: 4 })} kW, so the draw covers ${f(share * 100, { decimals: 0 })} percent of the measured spread. Scored against the ten measured values the bare draw has a MAPE of ${f(pp.bare_bond.mape_pct, { decimals: 2 })} percent and an R squared of ${f(pp.bare_bond.r2, { decimals: 2 })}, the paper form applied to it ${f(pp.engine_pc_1p30_110.mape_pct, { decimals: 2 })} percent, and the constant mean ${f(pp.constant_mean.mape_pct, { decimals: 2 })} percent. Held out, the refitted form has a MAPE of ${f(m0.mape_pct, { decimals: 2 })} percent against ${f(mean.mape_pct, { decimals: 2 })} percent for the mean of the other nine, so it ${m0.mape_pct < mean.mape_pct ? 'beats' : 'does not beat'} the mean, and its 80 percent band holds ${f(cov.count, { decimals: 0 })} of ${f(loo.n, { decimals: 0 })} surveys in sample${kw.strict.uq.nested_coverage === undefined ? '' : ` (${f(kw.strict.uq.nested_coverage, { decimals: 2 })} of the surveys out of sample, taking each spread from the other nine)`}.${negative ? " The engine's power does not reproduce the measured power of these surveys: this is the negative result that the product reports as it is, and the throughput of the previous topic is the result that holds." : ''}`}
        es={`Lectura: el consumo de Bond del motor va de ${f(bLo, { digits: 4 })} a ${f(bHi, { digits: 4 })} kW mientras la potencia medida va de ${f(mLo, { digits: 4 })} a ${f(mHi, { digits: 4 })} kW, de modo que el consumo cubre ${f(share * 100, { decimals: 0 })} por ciento de la dispersión medida. Evaluado contra los diez valores medidos, el consumo puro tiene un MAPE de ${f(pp.bare_bond.mape_pct, { decimals: 2 })} por ciento y un R cuadrado de ${f(pp.bare_bond.r2, { decimals: 2 })}, la forma del artículo aplicada a él ${f(pp.engine_pc_1p30_110.mape_pct, { decimals: 2 })} por ciento, y la media constante ${f(pp.constant_mean.mape_pct, { decimals: 2 })} por ciento. Con muestreos retenidos, la forma reajustada tiene un MAPE de ${f(m0.mape_pct, { decimals: 2 })} por ciento frente a ${f(mean.mape_pct, { decimals: 2 })} por ciento de la media de los otros nueve, así que ${m0.mape_pct < mean.mape_pct ? 'supera' : 'no supera'} a la media, y su banda del 80 por ciento contiene ${f(cov.count, { decimals: 0 })} de ${f(loo.n, { decimals: 0 })} muestreos dentro de la muestra${kw.strict.uq.nested_coverage === undefined ? '' : ` (${f(kw.strict.uq.nested_coverage, { decimals: 2 })} de los muestreos fuera de la muestra, tomando cada dispersión de los otros nueve)`}.${negative ? ' La potencia del motor no reproduce la potencia medida de estos muestreos: es el resultado negativo que el producto informa tal como es, y el resultado que se sostiene es la capacidad del tema anterior.' : ''}`}
      />
    </>
  );
}

export function PowerView() {
  return <DataView rows={['hp500-loo', 'case-manifest']} needsLoo>{(b, loo) => (loo ? <PowerBody loo={loo} surveys={surveysOf(b.cases)} /> : null)}</DataView>;
}
