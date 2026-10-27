// The first two experimental questions: how the product and the capacity move with the closed-side setting, and where the capacity hump of
// each machine peaks in speed. Both read the sweeps the pipeline committed into every case's replay (`css_sweep`, `speed_sweep`), grouped by
// machine family so a curve is only compared with curves of the same kind of machine. A table of the numbers sits above each chart.
import { PlotCard, SubTabs, ViewsRow, useFormat, useShellLang, type Provenance } from '@fasl-work/caos-app-shell';
import { UPlotChart, type ChartSeries } from '@fasl-work/caos-app-shell/chart';
import type { CaseData } from '../../api/artifacts';
import { useT, P } from '../bi';
import { DataView, MACHINE_NAME, Scroll } from './context';
import { casesOf, FAMILIES, PAST_TOLERANCE, settingRow, speedRow, type FamilyId, type SettingRow, type SpeedRow } from './data';

const ROWS = ['case-index', 'case-manifest', 'trace'];
const provenanceOf = (family: FamilyId): Provenance => (family === 'hp500' ? 'real' : 'synthetic');

/** A row of sub-tabs, one per machine family that has cases in the build. */
function FamilyTabs({ cases, ariaLabel, render }: { cases: CaseData[]; ariaLabel: string; render: (family: FamilyId, cs: CaseData[]) => React.ReactNode }) {
  const lang = useShellLang();
  const tabs = FAMILIES.flatMap((f) => {
    const cs = casesOf(cases, f.id);
    return cs.length ? [{ id: f.id, label: f.label[lang], content: render(f.id, cs) }] : [];
  });
  return <SubTabs ariaLabel={ariaLabel} tabs={tabs} />;
}

/** The sweep's x as a multiple of the case's own value, from the first case: the pipeline writes every sweep over the same multiples. */
function multiples(values: readonly number[], own: number): number[] {
  return values.map((v) => v / own);
}

const label = (d: CaseData) => d.manifest.case_id;

// ---- 1. the closed-side setting ----

function SettingFamily({ family, cs }: { family: FamilyId; cs: CaseData[] }) {
  const t = useT();
  const f = useFormat();
  const rows = cs.flatMap((c) => {
    const r = settingRow(c);
    return r ? [r] : [];
  });
  const first = cs[0];
  const x = multiples(first.trace!.css_sweep.css_mm, first.manifest.params.css_mm);
  const p80: ChartSeries[] = cs.map((c) => ({ label: { en: label(c), es: label(c) }, values: c.trace!.css_sweep.p80_mm }));
  const tph: ChartSeries[] = cs.map((c) => ({ label: { en: label(c), es: label(c) }, values: c.trace!.css_sweep.throughput_tph }));
  const range = (pick: (r: SettingRow) => number) => [Math.min(...rows.map(pick)), Math.max(...rows.map(pick))] as const;
  const [e80Lo, e80Hi] = range((r) => r.eP80);
  const [eqLo, eqHi] = range((r) => r.eTph);
  const rising = rows.filter((r) => r.rises).length;
  const prov = provenanceOf(family);
  const familyName = FAMILIES.find((x) => x.id === family)!.label;
  return (
    <>
      <PlotCard
        title={{ en: `Closed-side sweep of each case, ${familyName.en.toLowerCase()}`, es: `Barrido de la abertura de cada caso, ${familyName.es.toLowerCase()}` }}
        lane="replay"
        provenance={prov}
        note={{ en: 'Replayed from the committed trace of each case: the engine at half to one and a half times the case setting, every other input held.', es: 'Reproducido de la traza comprometida de cada caso: el motor entre la mitad y una vez y media la abertura del caso, con todo lo demás fijo.' }}
      >
        <Scroll>
          <table className="caos-table" data-state="ready">
            <thead>
              <tr>
                <th>{t('Case', 'Caso')}</th>
                <th>{t('Setting range (mm)', 'Rango de abertura (mm)')}</th>
                <th>{t('P80 at both ends (mm)', 'P80 en los extremos (mm)')}</th>
                <th>{t('Throughput at both ends (t/h)', 'Capacidad en los extremos (t/h)')}</th>
                <th>{t('P80 elasticity', 'Elasticidad del P80')}</th>
                <th>{t('Throughput elasticity', 'Elasticidad de la capacidad')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{`${f(r.cssLo, { digits: 3 })} ${t('to', 'a')} ${f(r.cssHi, { digits: 3 })}`}</td>
                  <td>{`${f(r.p80Lo, { digits: 3 })} ${t('to', 'a')} ${f(r.p80Hi, { digits: 3 })}`}</td>
                  <td>{`${f(r.tphLo, { digits: 4 })} ${t('to', 'a')} ${f(r.tphHi, { digits: 4 })}`}</td>
                  <td>{f(r.eP80, { decimals: 2 })}</td>
                  <td>{f(r.eTph, { decimals: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </PlotCard>
      <ViewsRow>
        <PlotCard title={{ en: 'P80 against the setting', es: 'P80 frente a la abertura' }} lane="replay" provenance={prov}>
          <UPlotChart
            title={{ en: `P80 of each case against its closed-side setting, ${familyName.en.toLowerCase()}`, es: `P80 de cada caso frente a su abertura de lado cerrado, ${familyName.es.toLowerCase()}` }}
            height={320}
            solo
            x={{ values: x, label: { en: 'Setting as a multiple of the case setting', es: 'Abertura como múltiplo de la del caso' }, format: { decimals: 2 } }}
            y={{ label: { en: 'P80', es: 'P80' }, unit: { en: 'mm', es: 'mm' }, format: { digits: 3 } }}
            series={p80}
            marks={[{ x: 1, label: { en: 'Case setting', es: 'Abertura del caso' } }]}
          />
        </PlotCard>
        <PlotCard title={{ en: 'Throughput against the setting', es: 'Capacidad frente a la abertura' }} lane="replay" provenance={prov}>
          <UPlotChart
            title={{ en: `Throughput of each case against its closed-side setting, ${familyName.en.toLowerCase()}`, es: `Capacidad de cada caso frente a su abertura de lado cerrado, ${familyName.es.toLowerCase()}` }}
            height={320}
            solo
            x={{ values: x, label: { en: 'Setting as a multiple of the case setting', es: 'Abertura como múltiplo de la del caso' }, format: { decimals: 2 } }}
            y={{ label: { en: 'Throughput', es: 'Capacidad' }, unit: { en: 't/h', es: 't/h' }, format: { digits: 4 } }}
            series={tph}
            marks={[{ x: 1, label: { en: 'Case setting', es: 'Abertura del caso' } }]}
          />
        </PlotCard>
      </ViewsRow>
      <P
        en={`Reading of this family: in ${rising} of ${rows.length} cases both P80 and throughput rise at every step as the setting opens. The elasticity of P80 runs from ${f(e80Lo, { decimals: 2 })} to ${f(e80Hi, { decimals: 2 })} and that of the throughput from ${f(eqLo, { decimals: 2 })} to ${f(eqHi, { decimals: 2 })}, so a setting twice as wide multiplies the P80 by a factor between ${f(2 ** e80Lo, { decimals: 2 })} and ${f(2 ** e80Hi, { decimals: 2 })} and the throughput by a factor between ${f(2 ** eqLo, { decimals: 2 })} and ${f(2 ** eqHi, { decimals: 2 })}.`}
        es={`Lectura de esta familia: en ${rising} de ${rows.length} casos el P80 y la capacidad suben en cada paso al abrirse la abertura. La elasticidad del P80 va de ${f(e80Lo, { decimals: 2 })} a ${f(e80Hi, { decimals: 2 })} y la de la capacidad de ${f(eqLo, { decimals: 2 })} a ${f(eqHi, { decimals: 2 })}, de modo que una abertura al doble multiplica el P80 por un factor entre ${f(2 ** e80Lo, { decimals: 2 })} y ${f(2 ** e80Hi, { decimals: 2 })} y la capacidad por un factor entre ${f(2 ** eqLo, { decimals: 2 })} y ${f(2 ** eqHi, { decimals: 2 })}.`}
      />
    </>
  );
}

export function SettingView() {
  const t = useT();
  return (
    <DataView rows={ROWS}>
      {(b) => <FamilyTabs cases={b.cases} ariaLabel={t('Machine families, closed-side sweeps', 'Familias de máquinas, barridos de la abertura')} render={(fam, cs) => <SettingFamily family={fam} cs={cs} />} />}
    </DataView>
  );
}

// ---- 2. the capacity hump ----

function SpeedFamily({ family, cs }: { family: FamilyId; cs: CaseData[] }) {
  const t = useT();
  const lang = useShellLang();
  const f = useFormat();
  const rows = cs.flatMap((c) => {
    const r = speedRow(c);
    return r ? [r] : [];
  });
  const first = cs[0];
  const x = multiples(first.trace!.speed_sweep.speed_rpm, first.manifest.params.speed_rpm);
  const series: ChartSeries[] = cs.map((c) => {
    const s = c.trace!.speed_sweep.throughput_tph;
    const peak = Math.max(...s);
    return { label: { en: label(c), es: label(c) }, values: s.map((v) => (100 * v) / peak) };
  });
  const past = rows.filter((r) => r.past);
  const worst = rows.reduce((a, r) => (r.lossPct > a.lossPct ? r : a), rows[0]);
  const prov = provenanceOf(family);
  const familyName = FAMILIES.find((x) => x.id === family)!.label;
  const ids = (xs: SpeedRow[]) => xs.map((r) => r.id).join(', ');
  const yes = t('yes', 'sí');
  const no = t('no', 'no');
  return (
    <>
      <PlotCard
        title={{ en: `Speed sweep of each case, ${familyName.en.toLowerCase()}`, es: `Barrido de velocidad de cada caso, ${familyName.es.toLowerCase()}` }}
        lane="replay"
        provenance={prov}
        note={{ en: 'Replayed from the committed trace of each case: the engine at half to one and a half times the case speed. The apex is the vertex of the parabola through the highest sample and its two neighbours.', es: 'Reproducido de la traza comprometida de cada caso: el motor entre la mitad y una vez y media la velocidad del caso. El ápice es el vértice de la parábola por la muestra más alta y sus dos vecinas.' }}
      >
        <Scroll>
          <table className="caos-table" data-state="ready">
            <thead>
              <tr>
                <th>{t('Case', 'Caso')}</th>
                <th className="caos-col-text">{t('Machine', 'Máquina')}</th>
                <th>{t('Case speed (rpm)', 'Velocidad del caso (rpm)')}</th>
                <th>{t('Apex of the sweep (rpm)', 'Ápice del barrido (rpm)')}</th>
                <th>{t('Engine optimum (rpm)', 'Óptimo del motor (rpm)')}</th>
                <th>{t('Speed over apex', 'Velocidad sobre ápice')}</th>
                <th>{t('Throughput given up (%)', 'Capacidad cedida (%)')}</th>
                <th>{t('Past the optimum', 'Pasado el óptimo')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td className="caos-col-text">{MACHINE_NAME[r.machine][lang]}</td>
                  <td>{f(r.speed, { digits: 3 })}</td>
                  <td>{f(r.apex, { digits: 4 })}</td>
                  <td>{f(r.engineApex, { digits: 3 })}</td>
                  <td>{f(r.ratio, { decimals: 3 })}</td>
                  <td>{f(r.lossPct, { decimals: 1 })}</td>
                  <td>{r.past ? yes : no}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </PlotCard>
      <PlotCard title={{ en: 'The capacity hump of each case', es: 'La joroba de capacidad de cada caso' }} lane="replay" provenance={prov}>
        <UPlotChart
          title={{ en: `Throughput as a share of the sweep peak against speed, ${familyName.en.toLowerCase()}`, es: `Capacidad como parte del máximo del barrido frente a la velocidad, ${familyName.es.toLowerCase()}` }}
          height={320}
          solo
          x={{ values: x, label: { en: 'Speed as a multiple of the case speed', es: 'Velocidad como múltiplo de la del caso' }, format: { decimals: 2 } }}
          y={{ label: { en: 'Throughput over the peak of the sweep', es: 'Capacidad sobre el máximo del barrido' }, unit: { en: '%', es: '%' }, format: { decimals: 0 } }}
          series={series}
          marks={[{ x: 1, label: { en: 'Case speed', es: 'Velocidad del caso' } }]}
        />
      </PlotCard>
      <P
        en={`Reading of this family: ${past.length === 0 ? 'no case runs past its optimum' : `${past.length} of ${rows.length} case${past.length === 1 ? ' runs' : 's run'} past the optimum (${ids(past)}), taken as a speed more than ${f(PAST_TOLERANCE * 100, { decimals: 0 })} percent over the apex`}. The case that gives up most against the peak of its own sweep is ${worst.id}, with ${f(worst.lossPct, { decimals: 1 })} percent of its throughput.`}
        es={`Lectura de esta familia: ${past.length === 0 ? 'ningún caso opera pasado su óptimo' : `${past.length} de ${rows.length} caso${past.length === 1 ? ' opera' : 's operan'} pasado el óptimo (${ids(past)}), entendido como una velocidad más de ${f(PAST_TOLERANCE * 100, { decimals: 0 })} por ciento sobre el ápice`}. El caso que más cede frente al máximo de su propio barrido es ${worst.id}, con ${f(worst.lossPct, { decimals: 1 })} por ciento de su capacidad.`}
      />
    </>
  );
}

export function SpeedView() {
  const t = useT();
  return (
    <DataView rows={ROWS}>
      {(b) => <FamilyTabs cases={b.cases} ariaLabel={t('Machine families, speed sweeps', 'Familias de máquinas, barridos de velocidad')} render={(fam, cs) => <SpeedFamily family={fam} cs={cs} />} />}
    </DataView>
  );
}
