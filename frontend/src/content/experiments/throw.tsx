// The third experimental question: does a wider eccentric throw coarsen the product at a fixed setting, the direction Evertsson's flow model gives.
// The engine runs in the browser over the whole range of the workbench's throw knob at the build's default case (labelled live), and beside it
// at the first calibrated survey, whose fit did not vary the throw: the contrast shows the limit of the calibration, not a finding about cones.
import { PlotCard, ViewsRow, useFormat } from '@fasl-work/caos-app-shell';
import { UPlotChart } from '@fasl-work/caos-app-shell/chart';
import { useMemo } from 'react';
import type { CaseData } from '../../api/artifacts';
import { REF_THROW_MM } from '../../engine/machines';
import type { Machine } from '../../engine/types';
import { useT, P } from '../bi';
import { DataView, Scroll } from './context';
import { casesOf, throwSweep, type ThrowPoint } from './data';

const near = (sweep: ThrowPoint[], throwMm: number): ThrowPoint => sweep.reduce((a, p) => (Math.abs(p.throwMm - throwMm) < Math.abs(a.throwMm - throwMm) ? p : a), sweep[0]);

function ThrowBody({ ref0, cal }: { ref0: CaseData; cal: CaseData | undefined }) {
  const t = useT();
  const f = useFormat();
  const refSweep = useMemo(() => throwSweep(ref0), [ref0]);
  const calSweep = useMemo(() => (cal ? throwSweep(cal) : null), [cal]);
  const xs = refSweep.map((p) => p.throwMm);
  const lo = xs[0];
  const hi = xs[xs.length - 1];
  const refOwn = ref0.manifest.params.throw_mm;
  const refMachine = ref0.manifest.params.machine as Machine;
  const design = REF_THROW_MM[refMachine];
  const replay = ref0.trace?.summary ?? null;
  const at = near(refSweep, refOwn);
  const first = refSweep[0];
  const last = refSweep[refSweep.length - 1];
  const throws = [...new Set([lo, design, refOwn, cal?.manifest.params.throw_mm ?? lo, hi])].sort((a, b) => a - b);
  const calFirst = calSweep?.[0];
  const calLast = calSweep?.[calSweep.length - 1];
  const calP80Flat = calSweep ? Math.max(...calSweep.map((p) => p.p80)) - Math.min(...calSweep.map((p) => p.p80)) < 1e-9 : false;
  const refOk = refSweep.every((p, i) => i === 0 || (p.p80 >= refSweep[i - 1].p80 && p.tph >= refSweep[i - 1].tph));
  const refName = ref0.manifest.case_id;
  const calName = cal?.manifest.case_id ?? '';
  return (
    <>
      <PlotCard
        title={{ en: 'The engine over the throw range', es: 'El motor sobre el rango de carrera' }}
        lane="live"
        provenance="synthetic"
        note={{ en: 'Recomputed in this browser at every millimetre of the workbench throw knob; every other input stays at the value of the case.', es: 'Recalculado en este navegador en cada milímetro de la perilla de carrera del banco de trabajo; todo lo demás queda en el valor del caso.' }}
      >
        <Scroll>
          <table className="caos-table" data-state="ready">
            <thead>
              <tr>
                <th>{t('Throw (mm)', 'Carrera (mm)')}</th>
                <th>{`${t('P80 of', 'P80 de')} ${refName} (mm)`}</th>
                <th>{`${t('Reduction ratio of', 'Razón de reducción de')} ${refName}`}</th>
                <th>{`${t('Throughput of', 'Capacidad de')} ${refName} (t/h)`}</th>
                {cal && <th>{`${t('P80 of', 'P80 de')} ${calName} (mm)`}</th>}
                {cal && <th>{`${t('Throughput of', 'Capacidad de')} ${calName} (t/h)`}</th>}
              </tr>
            </thead>
            <tbody>
              {throws.map((th) => {
                const r = near(refSweep, th);
                const c = calSweep ? near(calSweep, th) : null;
                return (
                  <tr key={th}>
                    <td>{f(th, { decimals: 0 })}</td>
                    <td>{f(r.p80, { digits: 4 })}</td>
                    <td>{f(r.reduction, { decimals: 2 })}</td>
                    <td>{f(r.tph, { digits: 4 })}</td>
                    {c && <td>{f(c.p80, { digits: 4 })}</td>}
                    {c && <td>{f(c.tph, { digits: 4 })}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Scroll>
      </PlotCard>
      <ViewsRow>
        <PlotCard title={{ en: `P80 against the throw, ${refName}`, es: `P80 frente a la carrera, ${refName}` }} lane="live" provenance="synthetic">
          <UPlotChart
            title={{ en: `Live P80 against the eccentric throw at ${refName}`, es: `P80 en vivo frente a la carrera excéntrica en ${refName}` }}
            height={300}
            x={{ values: xs, label: { en: 'Eccentric throw', es: 'Carrera excéntrica' }, unit: { en: 'mm', es: 'mm' }, format: { decimals: 0 } }}
            y={{ label: { en: 'P80', es: 'P80' }, unit: { en: 'mm', es: 'mm' }, format: { digits: 3 } }}
            series={[{ label: { en: `Live engine, ${refName}`, es: `Motor en vivo, ${refName}` }, values: refSweep.map((p) => p.p80), color: '--color-accent' }]}
            marks={[{ x: refOwn, label: { en: 'Case throw', es: 'Carrera del caso' } }]}
            yMarks={replay ? [{ y: replay.p80_mm, label: { en: 'Committed replay', es: 'Replay comprometido' }, tone: 'neutral' }] : []}
          />
        </PlotCard>
        <PlotCard title={{ en: `Throughput against the throw, ${refName}`, es: `Capacidad frente a la carrera, ${refName}` }} lane="live" provenance="synthetic">
          <UPlotChart
            title={{ en: `Live throughput against the eccentric throw at ${refName}`, es: `Capacidad en vivo frente a la carrera excéntrica en ${refName}` }}
            height={300}
            x={{ values: xs, label: { en: 'Eccentric throw', es: 'Carrera excéntrica' }, unit: { en: 'mm', es: 'mm' }, format: { decimals: 0 } }}
            y={{ label: { en: 'Throughput', es: 'Capacidad' }, unit: { en: 't/h', es: 't/h' }, format: { digits: 4 } }}
            series={[{ label: { en: `Live engine, ${refName}`, es: `Motor en vivo, ${refName}` }, values: refSweep.map((p) => p.tph), color: '--color-accent' }]}
            marks={[{ x: refOwn, label: { en: 'Case throw', es: 'Carrera del caso' } }]}
            yMarks={replay ? [{ y: replay.throughput_tph, label: { en: 'Committed replay', es: 'Replay comprometido' }, tone: 'neutral' }] : []}
          />
        </PlotCard>
      </ViewsRow>
      {cal && calSweep && (
        <ViewsRow>
          <PlotCard title={{ en: `P80 against the throw, calibrated ${calName}`, es: `P80 frente a la carrera, ${calName} calibrado` }} lane="live" provenance="real">
            <UPlotChart
              title={{ en: `Live P80 against the eccentric throw at the calibrated survey ${calName}`, es: `P80 en vivo frente a la carrera excéntrica en el muestreo calibrado ${calName}` }}
              height={300}
              x={{ values: calSweep.map((p) => p.throwMm), label: { en: 'Eccentric throw', es: 'Carrera excéntrica' }, unit: { en: 'mm', es: 'mm' }, format: { decimals: 0 } }}
              y={{ label: { en: 'P80', es: 'P80' }, unit: { en: 'mm', es: 'mm' }, format: { digits: 3 } }}
              series={[{ label: { en: `Live engine, ${calName}`, es: `Motor en vivo, ${calName}` }, values: calSweep.map((p) => p.p80), color: '--color-magenta' }]}
              marks={[{ x: cal.manifest.params.throw_mm, label: { en: 'Survey throw', es: 'Carrera del muestreo' } }]}
            />
          </PlotCard>
          <PlotCard title={{ en: `Throughput against the throw, calibrated ${calName}`, es: `Capacidad frente a la carrera, ${calName} calibrado` }} lane="live" provenance="real">
            <UPlotChart
              title={{ en: `Live throughput against the eccentric throw at the calibrated survey ${calName}`, es: `Capacidad en vivo frente a la carrera excéntrica en el muestreo calibrado ${calName}` }}
              height={300}
              x={{ values: calSweep.map((p) => p.throwMm), label: { en: 'Eccentric throw', es: 'Carrera excéntrica' }, unit: { en: 'mm', es: 'mm' }, format: { decimals: 0 } }}
              y={{ label: { en: 'Throughput', es: 'Capacidad' }, unit: { en: 't/h', es: 't/h' }, format: { digits: 4 } }}
              series={[{ label: { en: `Live engine, ${calName}`, es: `Motor en vivo, ${calName}` }, values: calSweep.map((p) => p.tph), color: '--color-magenta' }]}
              marks={[{ x: cal.manifest.params.throw_mm, label: { en: 'Survey throw', es: 'Carrera del muestreo' } }]}
            />
          </PlotCard>
        </ViewsRow>
      )}
      <P
        en={`Reading: at ${refName}, widening the throw from ${f(lo, { decimals: 0 })} to ${f(hi, { decimals: 0 })} mm moves the P80 from ${f(first.p80, { digits: 4 })} to ${f(last.p80, { digits: 4 })} mm and the reduction ratio from ${f(first.reduction, { decimals: 2 })} to ${f(last.reduction, { decimals: 2 })}, while the throughput goes from ${f(first.tph, { digits: 4 })} to ${f(last.tph, { digits: 4 })} t/h; the product ${refOk ? 'coarsens and the capacity rises at every step, the direction the flow model gives' : 'does not follow the direction of the flow model at every step, which is a defect'}.${replay ? ` At the case throw of ${f(refOwn, { decimals: 0 })} mm the live P80 is ${f(at.p80, { digits: 6 })} mm and the committed replay gives ${f(replay.p80_mm, { digits: 6 })} mm.` : ''}${calSweep && calFirst && calLast ? ` On the calibrated survey ${calName} the P80 ${calP80Flat ? `stays at ${f(calFirst.p80, { digits: 4 })} mm over the whole range` : 'moves'} while the throughput goes from ${f(calFirst.tph, { digits: 4 })} to ${f(calLast.tph, { digits: 4 })} t/h.` : ''}`}
        es={`Lectura: en ${refName}, ensanchar la carrera de ${f(lo, { decimals: 0 })} a ${f(hi, { decimals: 0 })} mm mueve el P80 de ${f(first.p80, { digits: 4 })} a ${f(last.p80, { digits: 4 })} mm y la razón de reducción de ${f(first.reduction, { decimals: 2 })} a ${f(last.reduction, { decimals: 2 })}, mientras la capacidad pasa de ${f(first.tph, { digits: 4 })} a ${f(last.tph, { digits: 4 })} t/h; el producto ${refOk ? 'se engruesa y la capacidad sube en cada paso, el sentido que da el modelo de flujo' : 'no sigue el sentido del modelo de flujo en cada paso, lo que es un defecto'}.${replay ? ` Con la carrera del caso, de ${f(refOwn, { decimals: 0 })} mm, el P80 en vivo es ${f(at.p80, { digits: 6 })} mm y el replay comprometido da ${f(replay.p80_mm, { digits: 6 })} mm.` : ''}${calSweep && calFirst && calLast ? ` En el muestreo calibrado ${calName} el P80 ${calP80Flat ? `se queda en ${f(calFirst.p80, { digits: 4 })} mm en todo el rango` : 'se mueve'} mientras la capacidad pasa de ${f(calFirst.tph, { digits: 4 })} a ${f(calLast.tph, { digits: 4 })} t/h.` : ''}`}
      />
    </>
  );
}

export function ThrowView() {
  return (
    <DataView rows={['case-index', 'case-manifest', 'trace']}>
      {(b) => {
        const ref0 = b.cases.find((c) => c.manifest.case_id === b.index.default_case) ?? b.cases[0];
        const cal = casesOf(b.cases, 'hp500')[0];
        return ref0 ? <ThrowBody ref0={ref0} cal={cal} /> : null;
      }}
    </DataView>
  );
}
