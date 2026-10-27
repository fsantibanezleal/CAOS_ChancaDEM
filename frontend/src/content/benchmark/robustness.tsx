// Robustness: the strict per-survey error of the backbone against the survey's distance from the centre of the calibrated envelope.
// The surrogate's error against its distance from the training ranges would be the other candidate; the metrics document carries
// only per-output aggregates and no per-point error, so the page uses the backbone, whose per-survey predictions are committed.
import { Cite, DocSection, PlotCard, useFormat } from '@fasl-work/caos-app-shell';
import { UPlotChart } from '@fasl-work/caos-app-shell/chart';
import { useMemo } from 'react';
import type { Hp500Backbone, Hp500Loo } from '../../lib/contract.types';
import { HP500_ENVELOPE } from '../../engine/envelope';
import { ReadinessNote } from '../../readiness/ReadinessNote';
import { P, useT } from '../bi';
import { robustnessPoints, spearman } from './data';
import { Ready, TableWrap, useBench } from './shared';

function Curve({ loo, backbone }: { loo: Hp500Loo; backbone: Hp500Backbone }) {
  const t = useT();
  const f = useFormat();
  const pts = useMemo(() => robustnessPoints(loo, backbone), [loo, backbone]);
  const dist = pts.map((p) => p.distance);
  const rhoTph = spearman(dist, pts.map((p) => Math.abs(p.tphErrPct)));
  const rhoKw = spearman(dist, pts.map((p) => Math.abs(p.kwErrPct)));
  const atEdge = pts.filter((p) => Math.abs(p.distance - 1) < 1e-9).length;
  const top = Math.ceil(Math.max(...pts.flatMap((p) => [Math.abs(p.tphErrPct), Math.abs(p.kwErrPct)])) / 10) * 10;
  const inside = pts.every((p) => p.distance <= 1 + 1e-9);
  const [cLo, cHi] = HP500_ENVELOPE.cssMm;
  const [fLo, fHi] = HP500_ENVELOPE.f80Mm;
  return (
    <>
      <P
        en={
          <>
            The distance of a survey is how far its closed-side setting and its feed f80 lie from the centre of the calibrated envelope (setting {f(cLo, { decimals: 0 })} to {f(cHi, { decimals: 0 })} mm, f80 {f(fLo, { decimals: 0 })} to {f(fHi, { decimals: 0 })} mm), in units of the envelope&apos;s half-range, taking the larger of the two: 0 at the centre, 1 at the edge.
            {inside ? ' Every survey lies inside the envelope, because the envelope is the range of the surveys themselves; the curve therefore shows what happens as a held-out survey sits nearer the edge of what the fit was supported on, not beyond it.' : ''} The error is the strict one, so the backbone never saw the survey it predicts.
          </>
        }
        es={
          <>
            La distancia de un muestreo es cuán lejos están su abertura de lado cerrado y su f80 de alimentación del centro de la envolvente calibrada (abertura de {f(cLo, { decimals: 0 })} a {f(cHi, { decimals: 0 })} mm, f80 de {f(fLo, { decimals: 0 })} a {f(fHi, { decimals: 0 })} mm), en unidades de la mitad del rango de la envolvente, tomando la mayor de las dos: 0 en el centro, 1 en el borde.
            {inside ? ' Todos los muestreos quedan dentro de la envolvente, porque la envolvente es el rango de los propios muestreos; la curva muestra entonces qué ocurre cuando un muestreo reservado está más cerca del borde de lo que sostuvo el ajuste, no más allá.' : ''} El error es el estricto, así que el esqueleto nunca vio el muestreo que predice.
          </>
        }
      />
      <TableWrap>
        <table className="caos-table" data-state="ready">
          <caption>{t('Strict error of the backbone per survey, ordered by distance from the centre of the calibrated envelope.', 'Error estricto del esqueleto por muestreo, ordenado por distancia al centro de la envolvente calibrada.')}</caption>
          <thead>
            <tr>
              <th className="caos-col-text">{t('Survey', 'Muestreo')}</th>
              <th>{t('Setting (mm)', 'Abertura (mm)')}</th>
              <th>{t('Feed f80 (mm)', 'f80 de alimentación (mm)')}</th>
              <th>{t('Distance', 'Distancia')}</th>
              <th>{t('Throughput error (%)', 'Error de capacidad (%)')}</th>
              <th>{t('Power error (%)', 'Error de potencia (%)')}</th>
            </tr>
          </thead>
          <tbody>
            {pts.map((p) => (
              <tr key={p.id}>
                <td className="caos-col-text">{p.n}</td>
                <td>{f(p.cssMm, { decimals: 0 })}</td>
                <td>{f(p.f80Mm, { decimals: 0 })}</td>
                <td>{f(p.distance, { decimals: 2 })}</td>
                <td>{f(p.tphErrPct, { decimals: 1 })}</td>
                <td>{f(p.kwErrPct, { decimals: 1 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <PlotCard title={{ en: 'Absolute strict error against distance from the envelope centre', es: 'Error estricto absoluto contra distancia al centro de la envolvente' }} lane="offline" provenance="real">
        <UPlotChart
          title={{ en: 'Absolute strict error against distance from the envelope centre', es: 'Error estricto absoluto contra distancia al centro de la envolvente' }}
          height={300}
          x={{ values: dist, label: { en: 'Distance from the envelope centre (edge = 1)', es: 'Distancia al centro de la envolvente (borde = 1)' }, range: [0, 1.1] }}
          y={{ label: { en: 'Absolute error', es: 'Error absoluto' }, unit: '%', range: [0, top] }}
          series={[
            { id: 'tph', label: { en: 'Throughput', es: 'Capacidad' }, values: pts.map((p) => Math.abs(p.tphErrPct)), color: '--color-accent', mode: 'points' },
            { id: 'kw', label: { en: 'Power', es: 'Potencia' }, values: pts.map((p) => Math.abs(p.kwErrPct)), color: '--color-warn', mode: 'points' },
          ]}
          readout={(i) => `${t('Survey', 'Muestreo')} ${pts[i].n}: ${t('distance', 'distancia')} ${f(pts[i].distance, { decimals: 2 })}, ${t('throughput', 'capacidad')} ${f(pts[i].tphErrPct, { decimals: 1 })} %, ${t('power', 'potencia')} ${f(pts[i].kwErrPct, { decimals: 1 })} %`}
        />
      </PlotCard>
      <P
        en={
          <>
            Rank correlation of the absolute error with the distance: {f(rhoTph, { decimals: 2 })} for throughput and {f(rhoKw, { decimals: 2 })} for power. With {pts.length} points, {atEdge} of them at the edge, these are rough guides and not a fitted law: the page does not claim that the error grows toward the edge, only reports whether it does in these surveys <Cite id="rocha2024" />.
          </>
        }
        es={
          <>
            Correlación de rangos del error absoluto con la distancia: {f(rhoTph, { decimals: 2 })} para la capacidad y {f(rhoKw, { decimals: 2 })} para la potencia. Con {pts.length} puntos, {atEdge} de ellos en el borde, son guías gruesas y no una ley ajustada: la página no afirma que el error crezca hacia el borde, sólo informa si lo hace en estos muestreos <Cite id="rocha2024" />.
          </>
        }
      />
    </>
  );
}

export function Robustness() {
  const { loo, backbone } = useBench();
  return (
    <DocSection title={{ en: 'Error against distance from the calibrated envelope', es: 'Error frente a la distancia a la envolvente calibrada' }} area="robustness" refs={['rocha2024']}>
      <P
        en="Two curves could answer how the models degrade: the backbone's strict error against the distance of the survey from the calibrated envelope, or the surrogate's error against the distance of a point from its training ranges. The model metrics carry only an aggregate error per output, with no error per point, so the second curve cannot be drawn from a committed artifact. This page draws the first, from the per-survey predictions CrusherCal commits."
        es="Dos curvas podrían responder cómo se degradan los modelos: el error estricto del esqueleto contra la distancia del muestreo a la envolvente calibrada, o el error del sustituto contra la distancia de un punto a sus rangos de entrenamiento. Las métricas del modelo traen sólo un error agregado por salida, sin error por punto, así que la segunda curva no puede dibujarse desde un artefacto versionado. Esta página dibuja la primera, desde las predicciones por muestreo que CrusherCal versiona."
      />
      <ReadinessNote ids={['hp500-loo', 'hp500-backbone']} />
      <Ready a={loo} b={backbone}>
        {(l, b) => <Curve loo={l} backbone={b} />}
      </Ready>
    </DocSection>
  );
}
