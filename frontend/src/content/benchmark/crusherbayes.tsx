// CrusherBayes on the Benchmark: the Bayesian calibration of the engine's fitted scalars with a structural discrepancy, held out on the
// ten HP500 surveys. Every figure is read at run time from hp500/crusherbayes.json (and the CrusherCal band from hp500/loo.json); a
// posterior the sampler did not converge on is labelled so wherever its numbers appear, and a missing document shows the readiness
// reason, never an empty chart.
import { Cite, PlotCard, Verdict, ViewsRow, useFormat, useShellLang, type BiText } from '@fasl-work/caos-app-shell';
import { UPlotChart } from '@fasl-work/caos-app-shell/chart';
import { useMemo } from 'react';
import type { Hp500CrusherBayes, Hp500Loo, Text } from '../../lib/contract.types';
import { ReadinessNote } from '../../readiness/ReadinessNote';
import { P, useT } from '../bi';
import { IDENTIFIED_BELOW, PRIOR_DOMINATED_FROM, TARGET_LABEL, classifyContraction, convergenceText, intervalPoints, type ContractionClass } from './data';
import { Ready, TableWrap, useBench } from './shared';

const PARAM_LABEL: Record<string, Text> = {
  q_ref_tph: { en: 'Capacity base (t/h)', es: 'Base de capacidad (t/h)' },
  wi_kwh_t: { en: 'Bond work index (kWh/t)', es: 'Índice de trabajo de Bond (kWh/t)' },
  zeta: { en: 'Power slope zeta', es: 'Pendiente de potencia zeta' },
  pn_kw: { en: 'No-load power (kW)', es: 'Potencia en vacío (kW)' },
  k1_scale: { en: 'Classification K1 multiplier', es: 'Multiplicador de K1 de clasificación' },
  k2_scale: { en: 'Classification K2 multiplier', es: 'Multiplicador de K2 de clasificación' },
  k3: { en: 'Classification K3', es: 'K3 de clasificación' },
  t10_shift_pct: { en: 'Breakage t10 shift (points)', es: 'Desplazamiento de t10 de fractura (puntos)' },
  sigma_tph: { en: 'Noise, throughput (t/h)', es: 'Ruido, capacidad (t/h)' },
  sigma_kW: { en: 'Noise, power (kW)', es: 'Ruido, potencia (kW)' },
  discrepancy_tph_constant: { en: 'Discrepancy, throughput: constant', es: 'Discrepancia, capacidad: constante' },
  discrepancy_tph_css: { en: 'Discrepancy, throughput: slope on the setting', es: 'Discrepancia, capacidad: pendiente en la abertura' },
  discrepancy_tph_f80: { en: 'Discrepancy, throughput: slope on the feed f80', es: 'Discrepancia, capacidad: pendiente en el f80 de alimentación' },
  discrepancy_kW_constant: { en: 'Discrepancy, power: constant', es: 'Discrepancia, potencia: constante' },
  discrepancy_kW_css: { en: 'Discrepancy, power: slope on the setting', es: 'Discrepancia, potencia: pendiente en la abertura' },
  discrepancy_kW_f80: { en: 'Discrepancy, power: slope on the feed f80', es: 'Discrepancia, potencia: pendiente en el f80 de alimentación' },
};

const CLASS_LABEL: Record<ContractionClass, Text> = {
  identified: { en: 'identified by the surveys', es: 'identificado por los muestreos' },
  weak: { en: 'weakly identified', es: 'débilmente identificado' },
  prior: { en: 'stays at its prior', es: 'se queda en su a priori' },
};

const TARGETS = ['tph', 'kW'] as const;

/** The convergence label as a bilingual text, or null when every posterior converged. */
const convergenceLabel = (cb: Hp500CrusherBayes): BiText | null => {
  const en = convergenceText(cb, 'en');
  const es = convergenceText(cb, 'es');
  return en && es ? { en, es } : null;
};

function VerdictBlock({ cb }: { cb: Hp500CrusherBayes }) {
  const f = useFormat();
  const k = cb.kill_criterion;
  const d = { decimals: 1 } as const;
  const d2 = { decimals: 2 } as const;
  const pct0 = { percent: true, decimals: 0 } as const;
  const kept = k.verdict === 'kept';
  const worse = k.power_gain_over_blin_pts < 0;
  const en = `Verdict by the rule written before the run: ${kept ? 'kept' : 'dropped as a predictor'}. On power the held-out MAPE is ${f(k.power_mape_pct, d2)} percent against ${f(k.power_mape_blin_pct, d2)} percent for the setting-only line B-lin, a gain of ${f(k.power_gain_over_blin_pts, d2)} points (the rule asks for at least ${f(k.margin_mape_pts, d)}): ${worse ? 'it does not beat B-lin on power' : 'it beats B-lin on power'}. On throughput it scores ${f(k.tph_mape_pct, d2)} percent against ${f(k.tph_mape_m0_pct, d2)} percent for the calibrated backbone, a gain of ${f(k.tph_gain_over_m0_pts, d2)} points. The band: coverage ${f(k.coverage.tph, pct0)} on throughput and ${f(k.coverage.kW, pct0)} on power, with a mean width of ${f(k.mean_width.tph, d)} against ${f(k.mean_width_crushercal.tph, d)} t/h and ${f(k.mean_width.kW, d)} against ${f(k.mean_width_crushercal.kW, d)} kW for the CrusherCal band. ${kept ? 'It is kept because the rule drops a method only when it fails on accuracy and on the band together; that is a verdict on the rule, not a claim of skill over B-lin.' : 'The rule drops it as a predictor.'}`;
  const es = `Veredicto por la regla escrita antes de correr: ${kept ? 'se mantiene' : 'se descarta como predictor'}. En potencia el MAPE reservado es ${f(k.power_mape_pct, d2)} por ciento contra ${f(k.power_mape_blin_pct, d2)} por ciento de la recta solo de la abertura B-lin, una ganancia de ${f(k.power_gain_over_blin_pts, d2)} puntos (la regla exige al menos ${f(k.margin_mape_pts, d)}): ${worse ? 'no supera a B-lin en potencia' : 'supera a B-lin en potencia'}. En capacidad obtiene ${f(k.tph_mape_pct, d2)} por ciento contra ${f(k.tph_mape_m0_pct, d2)} por ciento del esqueleto calibrado, una ganancia de ${f(k.tph_gain_over_m0_pts, d2)} puntos. La banda: cobertura ${f(k.coverage.tph, pct0)} en capacidad y ${f(k.coverage.kW, pct0)} en potencia, con un ancho medio de ${f(k.mean_width.tph, d)} contra ${f(k.mean_width_crushercal.tph, d)} t/h y ${f(k.mean_width.kW, d)} contra ${f(k.mean_width_crushercal.kW, d)} kW de la banda de CrusherCal. ${kept ? 'Se mantiene porque la regla descarta un método solo cuando falla a la vez en exactitud y en la banda; es un veredicto sobre la regla, no una afirmación de habilidad sobre B-lin.' : 'La regla lo descarta como predictor.'}`;
  const label = convergenceLabel(cb);
  return (
    <>
      <Verdict title={{ en: 'Kill criterion', es: 'Criterio de descarte' }} tone={kept ? 'warn' : 'bad'} verdict={{ en, es }} />
      {label ? <Verdict title={{ en: 'Convergence', es: 'Convergencia' }} tone="warn" verdict={label} /> : null}
    </>
  );
}

function ScoresTable({ cb }: { cb: Hp500CrusherBayes }) {
  const t = useT();
  const f = useFormat();
  const lang = useShellLang();
  const note = convergenceText(cb, lang);
  return (
    <TableWrap>
      <table className="caos-table" data-state="ready" data-crusherbayes="scores">
        <caption>
          {t(
            `CrusherBayes held out on the ${cb.n} surveys, beside the setting-only line B-lin, the calibrated backbone M0 (whose nested band is the CrusherCal band) and the free-form fit M2, on the same folds. MAPE in percent, RMSE and mean 80 percent width in the unit of the target, the mean log predictive density, and the share of surveys inside their 80 percent interval.`,
            `CrusherBayes reservado en los ${cb.n} muestreos, junto a la recta solo de la abertura B-lin, el esqueleto calibrado M0 (cuya banda anidada es la banda de CrusherCal) y el ajuste de forma libre M2, sobre los mismos pliegues. MAPE en porcentaje, RMSE y ancho medio del 80 por ciento en la unidad de la magnitud, la densidad predictiva logarítmica media, y la fracción de muestreos dentro de su intervalo del 80 por ciento.`,
          )}
          {note ? ` ${note}` : ''}
        </caption>
        <thead>
          <tr>
            <th className="caos-col-text">{t('Target', 'Magnitud')}</th>
            <th className="caos-col-text">{t('Model', 'Modelo')}</th>
            <th>{t('MAPE (%)', 'MAPE (%)')}</th>
            <th>RMSE</th>
            <th>{t('Coverage of the 80 % interval', 'Cobertura del intervalo de 80 %')}</th>
            <th>{t('Mean width', 'Ancho medio')}</th>
            <th>{t('Mean log density', 'Densidad log media')}</th>
          </tr>
        </thead>
        <tbody>
          {TARGETS.flatMap((target) => {
            const rows: Array<[string, string, Hp500CrusherBayes['loo']['tph']['scores']]> = [
              ['cb', note ? t('CrusherBayes (not converged)', 'CrusherBayes (sin converger)') : 'CrusherBayes', cb.loo[target].scores],
              ['m0', t('M0 calibrated backbone (CrusherCal band)', 'M0 esqueleto calibrado (banda de CrusherCal)'), cb.comparators[target].M0],
              ['blin', t('B-lin setting-only line', 'B-lin recta solo de la abertura'), cb.comparators[target].B_lin],
              ['m2', t('M2 free-form', 'M2 de forma libre'), cb.comparators[target].M2],
            ];
            return rows.map(([id, label, s]) => (
              <tr key={`${target}-${id}`} data-model={id}>
                <td className="caos-col-text">{TARGET_LABEL[target][lang]}</td>
                <td className="caos-col-text">{label}</td>
                <td>{f(s.mape_pct, { decimals: 2 })}</td>
                <td>{f(s.rmse, { decimals: 1 })}</td>
                <td>{f(s.coverage_80, { percent: true, decimals: 0 })}</td>
                <td>{f(s.mean_width, { decimals: 1 })}</td>
                <td>{f(s.lpd_mean, { decimals: 2 })}</td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </TableWrap>
  );
}

function IntervalFigure({ cb, loo, target }: { cb: Hp500CrusherBayes; loo: Hp500Loo | null; target: 'tph' | 'kW' }) {
  const t = useT();
  const f = useFormat();
  const pts = useMemo(() => intervalPoints(cb, loo, target), [cb, loo, target]);
  const hasCal = pts.every((p) => p.calLo !== null);
  const unit = target === 'tph' ? 't/h' : 'kW';
  const title: BiText = { en: `Held-out 80 percent intervals, ${TARGET_LABEL[target].en}`, es: `Intervalos del 80 por ciento reservados, ${TARGET_LABEL[target].es}` };
  const values = pts.flatMap((p) => [p.measured, p.lo, p.hi, ...(hasCal ? [p.calLo as number, p.calHi as number] : [])]);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.05;
  const range = (a: number, b: number) => `${f(a, { decimals: 1 })} ${t('to', 'a')} ${f(b, { decimals: 1 })}`;
  return (
    <PlotCard title={title} lane="offline" provenance="real" note={convergenceLabel(cb) ?? undefined}>
      <UPlotChart
        title={title}
        height={300}
        x={{ values: pts.map((p) => p.n), label: { en: 'Held-out survey', es: 'Muestreo reservado' }, range: [0.5, pts.length + 0.5], format: { decimals: 0 } }}
        y={{ label: TARGET_LABEL[target], range: [lo - pad, hi + pad] }}
        series={[
          { id: 'measured', label: { en: 'Measured', es: 'Medido' }, values: pts.map((p) => p.measured), color: '--color-good', mode: 'points' },
          { id: 'mean', label: { en: 'CrusherBayes mean', es: 'Media de CrusherBayes' }, values: pts.map((p) => p.mean), color: '--color-accent', mode: 'points' },
          { id: 'lo80', label: { en: 'CrusherBayes 10th percentile', es: 'Percentil 10 de CrusherBayes' }, values: pts.map((p) => p.lo), color: '--color-accent', dash: [4, 4], width: 1 },
          { id: 'hi80', label: { en: 'CrusherBayes 90th percentile', es: 'Percentil 90 de CrusherBayes' }, values: pts.map((p) => p.hi), color: '--color-accent', dash: [4, 4], width: 1 },
          ...(hasCal
            ? [
                { id: 'callo', label: { en: 'CrusherCal band, lower edge', es: 'Banda de CrusherCal, borde inferior' }, values: pts.map((p) => p.calLo), color: '--color-warn' as const, dash: [2, 3], width: 1 },
                { id: 'calhi', label: { en: 'CrusherCal band, upper edge', es: 'Banda de CrusherCal, borde superior' }, values: pts.map((p) => p.calHi), color: '--color-warn' as const, dash: [2, 3], width: 1 },
              ]
            : []),
        ]}
        solo
        readout={(i) =>
          `${t('Survey', 'Muestreo')} ${pts[i].n}: ${t('measured', 'medido')} ${f(pts[i].measured, { decimals: 1 })} ${unit}; CrusherBayes ${f(pts[i].mean, { decimals: 1 })} ${unit} (${range(pts[i].lo, pts[i].hi)}), ${pts[i].insideBayes ? t('inside', 'dentro') : t('outside', 'fuera')}${pts[i].calLo !== null ? `; CrusherCal ${range(pts[i].calLo as number, pts[i].calHi as number)}` : ''}`
        }
      />
    </PlotCard>
  );
}

function SurveyTable({ cb, loo }: { cb: Hp500CrusherBayes; loo: Hp500Loo | null }) {
  const t = useT();
  const f = useFormat();
  const tph = intervalPoints(cb, loo, 'tph');
  const kw = intervalPoints(cb, loo, 'kW');
  const range = (lo: number | null, hi: number | null) => (lo === null || hi === null ? t('not recorded', 'no registrada') : `${f(lo, { decimals: 0 })} ${t('to', 'a')} ${f(hi, { decimals: 0 })}`);
  return (
    <TableWrap>
      <table className="caos-table" data-state="ready" data-crusherbayes="surveys">
        <caption>
          {t(
            'Each survey predicted by the posterior fitted without it: the measured value, the posterior predictive mean and its 80 percent interval (10th to 90th percentile), beside the CrusherCal band around the held-out backbone. The last column says whether the posterior of that fold converged.',
            'Cada muestreo predicho por el posterior ajustado sin él: el valor medido, la media predictiva del posterior y su intervalo del 80 por ciento (percentil 10 a 90), junto a la banda de CrusherCal alrededor del esqueleto reservado. La última columna dice si el posterior de ese pliegue convergió.',
          )}
        </caption>
        <thead>
          <tr>
            <th className="caos-col-text">{t('Survey', 'Muestreo')}</th>
            <th>{t('Throughput measured (t/h)', 'Capacidad medida (t/h)')}</th>
            <th>{t('Mean', 'Media')}</th>
            <th>{t('80 % interval', 'Intervalo del 80 %')}</th>
            <th>{t('CrusherCal band', 'Banda de CrusherCal')}</th>
            <th>{t('Power measured (kW)', 'Potencia medida (kW)')}</th>
            <th>{t('Mean', 'Media')}</th>
            <th>{t('80 % interval', 'Intervalo del 80 %')}</th>
            <th>{t('CrusherCal band', 'Banda de CrusherCal')}</th>
            <th className="caos-col-text">{t('Posterior', 'Posterior')}</th>
          </tr>
        </thead>
        <tbody>
          {tph.map((a, i) => {
            const b = kw[i];
            const fold = cb.convergence.folds.find((x) => x.fold === a.n);
            return (
              <tr key={a.n}>
                <td className="caos-col-text">{a.n}</td>
                <td>{f(a.measured, { decimals: 0 })}</td>
                <td>{f(a.mean, { decimals: 0 })}</td>
                <td>{range(a.lo, a.hi)}</td>
                <td>{range(a.calLo, a.calHi)}</td>
                <td>{f(b.measured, { decimals: 0 })}</td>
                <td>{f(b.mean, { decimals: 0 })}</td>
                <td>{range(b.lo, b.hi)}</td>
                <td>{range(b.calLo, b.calHi)}</td>
                <td className="caos-col-text" data-converged={fold ? String(fold.converged) : 'unknown'}>
                  {!fold ? t('not recorded', 'no registrado') : fold.converged ? t('converged', 'convergió') : t('not converged', 'sin converger')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableWrap>
  );
}

function ConvergenceTable({ cb }: { cb: Hp500CrusherBayes }) {
  const t = useT();
  const f = useFormat();
  const c = cb.convergence;
  const m = cb.method;
  return (
    <TableWrap>
      <table className="caos-table" data-state="ready" data-crusherbayes="convergence">
        <caption>
          {t(
            `Sampler: ${m.sampler} ${m.sampler_version}, ${f(m.walkers, { decimals: 0 })} walkers, ${f(m.steps, { decimals: 0 })} steps of which ${f(m.burn_in_steps, { decimals: 0 })} are discarded. A posterior counts as converged when its post-burn chain is at least ${f(c.tau_factor, { decimals: 0 })} integrated autocorrelation times long (the largest time over the parameters); the table shows how many times the chain has.`,
            `Muestreador: ${m.sampler} ${m.sampler_version}, ${f(m.walkers, { decimals: 0 })} caminantes, ${f(m.steps, { decimals: 0 })} pasos de los cuales ${f(m.burn_in_steps, { decimals: 0 })} se descartan. Un posterior cuenta como convergido cuando su cadena posterior al descarte tiene al menos ${f(c.tau_factor, { decimals: 0 })} tiempos de autocorrelación integrados (el mayor tiempo entre los parámetros); la tabla muestra cuántos tiempos tiene la cadena.`,
          )}
        </caption>
        <thead>
          <tr>
            <th className="caos-col-text">{t('Held-out survey', 'Muestreo reservado')}</th>
            <th className="caos-col-text">{t('Status', 'Estado')}</th>
            <th>{t('Autocorrelation time (steps)', 'Tiempo de autocorrelación (pasos)')}</th>
            <th>{t('Chain length over the time', 'Largo de la cadena sobre el tiempo')}</th>
            <th>{t('Acceptance', 'Aceptación')}</th>
            <th>{t('Samples', 'Muestras')}</th>
          </tr>
        </thead>
        <tbody>
          {c.folds.map((x) => (
            <tr key={String(x.fold)} data-converged={String(x.converged)}>
              <td className="caos-col-text">{x.fold === 'all' ? t('fit to all ten', 'ajuste con los diez') : x.fold}</td>
              <td className="caos-col-text">{x.converged ? t('converged', 'convergió') : t('not converged', 'sin converger')}</td>
              <td>{f(x.tau_max, { decimals: 1 })}</td>
              <td>{f(x.chain_over_tau, { decimals: 1 })}</td>
              <td>{f(x.acceptance_fraction, { percent: true, decimals: 0 })}</td>
              <td>{f(x.samples, { decimals: 0 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

function ContractionTable({ cb }: { cb: Hp500CrusherBayes }) {
  const t = useT();
  const f = useFormat();
  const lang = useShellLang();
  const note = convergenceText(cb, lang);
  const rows = cb.contraction.map((r) => ({ ...r, cls: classifyContraction(r.contraction) }));
  return (
    <TableWrap>
      <table className="caos-table" data-state="ready" data-crusherbayes="contraction">
        <caption>
          {t(
            `The contraction table, from the fit to all ten surveys: the posterior standard deviation over the prior one. Below ${f(IDENTIFIED_BELOW, { decimals: 1 })} the surveys identify the parameter; from ${f(PRIOR_DOMINATED_FROM, { decimals: 1 })} on it stays where its prior put it.`,
            `La tabla de contracción, del ajuste con los diez muestreos: la desviación estándar del posterior sobre la del a priori. Bajo ${f(IDENTIFIED_BELOW, { decimals: 1 })} los muestreos identifican el parámetro; desde ${f(PRIOR_DOMINATED_FROM, { decimals: 1 })} se queda donde lo puso su a priori.`,
          )}
          {note ? ` ${note}` : ''}
        </caption>
        <thead>
          <tr>
            <th className="caos-col-text">{t('Parameter', 'Parámetro')}</th>
            <th>{t('Prior sd', 'Desv. a priori')}</th>
            <th>{t('Posterior mean', 'Media del posterior')}</th>
            <th>{t('Posterior sd', 'Desv. del posterior')}</th>
            <th>{t('Contraction', 'Contracción')}</th>
            <th className="caos-col-text">{t('Reading', 'Lectura')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} data-contraction-class={r.cls}>
              <td className="caos-col-text">{PARAM_LABEL[r.name]?.[lang] ?? r.name}</td>
              <td>{f(r.prior_sd, { decimals: 2 })}</td>
              <td>{f(r.posterior_mean, { decimals: 2 })}</td>
              <td>{f(r.posterior_sd, { decimals: 2 })}</td>
              <td>{f(r.contraction, { decimals: 2 })}</td>
              <td className="caos-col-text">{CLASS_LABEL[r.cls][lang]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

function Body({ cb, loo }: { cb: Hp500CrusherBayes; loo: Hp500Loo | null }) {
  const f = useFormat();
  const named = (cls: ContractionClass, lang: 'en' | 'es', none: string) => {
    const ids = cb.contraction.filter((r) => classifyContraction(r.contraction) === cls).map((r) => PARAM_LABEL[r.name]?.[lang] ?? r.name);
    return ids.length ? ids.join('; ') : none;
  };
  const lo = f(IDENTIFIED_BELOW, { decimals: 1 });
  const hi = f(PRIOR_DOMINATED_FROM, { decimals: 1 });
  return (
    <>
      <VerdictBlock cb={cb} />
      <ScoresTable cb={cb} />
      <ViewsRow>
        {TARGETS.map((target) => (
          <IntervalFigure key={target} cb={cb} loo={loo} target={target} />
        ))}
      </ViewsRow>
      <SurveyTable cb={cb} loo={loo} />
      <P
        en={<>What the surveys identify, from the contraction table below (contraction under {lo}): {named('identified', 'en', 'no parameter')}. What stays at its prior (contraction of {hi} or more): {named('prior', 'en', 'no parameter')}. The two measured targets carry the product size only through the Bond term of the power, and the power follows the setting more than the product size, so the scalars that set the product size are not identified by these surveys: the data cannot calibrate the population balance, and the posterior says so instead of inventing a value.</>}
        es={<>Lo que identifican los muestreos, según la tabla de contracción de abajo (contracción bajo {lo}): {named('identified', 'es', 'ningún parámetro')}. Lo que se queda en su a priori (contracción de {hi} o más): {named('prior', 'es', 'ningún parámetro')}. Las dos magnitudes medidas llevan el tamaño del producto solo a través del término de Bond de la potencia, y la potencia sigue a la abertura más que al tamaño del producto, así que los escalares que fijan el tamaño del producto no quedan identificados por estos muestreos: los datos no pueden calibrar el balance poblacional, y el posterior lo dice en vez de inventar un valor.</>}
      />
      <ContractionTable cb={cb} />
      <ConvergenceTable cb={cb} />
    </>
  );
}

/** The CrusherBayes view of the Benchmark, inside the comparison section: the verdict, the scores, the intervals, the contraction and the convergence. */
export function CrusherBayesView() {
  const { crusherbayes, loo } = useBench();
  const t = useT();
  return (
    <>
      <h3>{t('CrusherBayes: a Bayesian calibration of the engine', 'CrusherBayes: una calibración bayesiana del motor')}</h3>
      <P
        en={<>CrusherBayes samples the engine&apos;s fitted scalars and adds a structural discrepancy per target, in the low-order form of Kennedy and O&apos;Hagan <Cite id="kennedy2001" />, with the affine-invariant ensemble sampler of the emcee package <Cite id="foremanmackey2013" />. It is held out exactly as CrusherCal is: each posterior is fitted on nine surveys and predicts the tenth. The rule that would drop it was written before the run, and the verdict below applies it to the numbers of the document.</>}
        es={<>CrusherBayes muestrea los escalares ajustados del motor y agrega una discrepancia estructural por magnitud, en la forma de bajo orden de Kennedy y O&apos;Hagan <Cite id="kennedy2001" />, con el muestreador de conjunto afín-invariante del paquete emcee <Cite id="foremanmackey2013" />. Se reserva igual que CrusherCal: cada posterior se ajusta con nueve muestreos y predice el décimo. La regla que lo descartaría se escribió antes de correr, y el veredicto de abajo la aplica a las cifras del documento.</>}
      />
      <ReadinessNote ids={['hp500-crusherbayes']} />
      <Ready a={crusherbayes}>{(cb) => <Body cb={cb} loo={loo.state === 'ready' ? loo.data : null} />}</Ready>
    </>
  );
}
