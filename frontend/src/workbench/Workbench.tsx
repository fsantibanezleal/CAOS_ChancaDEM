// The App route (ADR-0016 s9, ADR-0071): one CaseWorkbench. The rail holds the case picker, the three variants of the closed-side
// setting, the six knobs of the live engine and its live values; the instrument holds the question groups. The replay lane is the
// committed trace of the case; the live lane is the TypeScript engine re-run with the rail's values. The groups are Chamber,
// Product, Performance (with the comparison of the variants), Learned and Validation, then the Context write-up: six tabs, the
// most the shell takes (ADR-0071 rule 5). Focus mode (ADR-0070) is on for every case: the Focus button opens the open group in the
// full viewport with the case, the group and the sub-view kept, and the rail as the parameter column.
import { CaseWorkbench, Knob, Readout, useShellLang, useWorkbenchState, type CaseDef, type RailSection } from '@fasl-work/caos-app-shell';
import { useEffect, useMemo, useState } from 'react';
import { loadCase, loadHp500Loo, loadIndex, useArtifact, type CaseData } from '../api/artifacts';
import type { CaseIndex, Hp500Loo, Text } from '../lib/contract.types';
import { caseAbsent } from '../readiness/readiness';
import { useReadiness } from '../readiness/useReadiness';
import { ChamberGroup } from '../views/chamber';
import { ContextView } from '../views/context';
import { LearnedGroup } from '../views/learned';
import { PerformanceGroup } from '../views/performance';
import { ProductGroup } from '../views/product';
import { ViewContext, provenanceOf, type ViewCtx } from '../views/shared';
import { ValidationGroup } from '../views/validation';
import { bakedOf, BANDED_MACHINE, knobBounds, KNOBS, railMoved, railOf, selectionOf, VARIANTS, type RailValues, type Selection } from './model';
import './workbench.css';

const MACHINE_NAME: Record<string, Text> = {
  'cone-sec': { en: 'Secondary cone', es: 'Cono secundario' },
  'cone-tert': { en: 'Tertiary cone', es: 'Cono terciario' },
  'cone-short-head': { en: 'Short-head cone', es: 'Cono de cabeza corta' },
  gyratory: { en: 'Gyratory', es: 'Giratoria' },
  jaw: { en: 'Jaw', es: 'Mandíbula' },
};

function LiveValues({ sel }: { sel: Selection | null }) {
  const stateKey = useWorkbenchState()?.stateKey;
  const r = sel?.result;
  const prov = sel ? provenanceOf(sel) : 'synthetic';
  return (
    <Readout
      title={{ en: 'Live values', es: 'Valores en vivo' }}
      lane="live"
      provenance={prov}
      dataKey={stateKey}
      items={[
        { label: 'P80', value: r ? r.p80 : null, unit: 'mm', format: { digits: 4 }, hint: { en: 'The size 80 percent of the product passes.', es: 'El tamaño bajo el cual pasa el 80 por ciento del producto.' } },
        { label: { en: 'Reduction ratio', es: 'Razón de reducción' }, value: r ? r.reductionRatio : null, unitless: true, format: { decimals: 2 }, hint: { en: 'Feed F80 over product P80.', es: 'F80 de la alimentación sobre P80 del producto.' } },
        { label: { en: 'Throughput', es: 'Capacidad' }, value: r ? r.throughputTph : null, unit: 't/h', format: { digits: 4 } },
        { label: { en: 'Power', es: 'Potencia' }, value: r ? r.powerKw : null, unit: 'kW', format: { digits: 4 } },
        { label: { en: 'Specific energy', es: 'Energía específica' }, value: r ? r.specificEnergyKwhT : null, unit: 'kWh/t', format: { decimals: 2 } },
        // the two inputs of the case that are not knobs: a case is one machine, and the ore's Bond index is the case's
        { label: { en: 'Machine', es: 'Máquina' }, text: sel ? MACHINE_NAME[sel.data.manifest.params.machine] : { en: 'not available', es: 'no disponible' }, hint: { en: 'A case is one machine; the machine is not a knob.', es: 'Un caso es una máquina; la máquina no es una perilla.' } },
        { label: { en: 'Bond work index', es: 'Índice de Bond' }, value: sel ? sel.data.manifest.params.ore_wi : null, unit: 'kWh/t', format: { digits: 4 }, hint: { en: 'Energy to grind the ore from a large size to 80 percent passing 100 micrometres.', es: 'Energía para moler el mineral desde un tamaño grande hasta 80 por ciento pasante de 100 micrómetros.' } },
      ]}
    />
  );
}

/** What the survey measured: a real case's own values, beside the note that its inputs are not the rail's to change. */
function MeasuredValues({ sel, lang }: { sel: Selection | null; lang: 'en' | 'es' }) {
  const stateKey = useWorkbenchState()?.stateKey;
  const measured = sel?.data.manifest.measured;
  if (!sel || !measured) return null;
  return (
    <>
      <p className="caos-plot-note">
        {lang === 'es' ? 'Las entradas de un muestreo real son medidas: el panel las muestra y no las cambia.' : 'The inputs of a real survey are measured: the rail shows them and does not change them.'}
      </p>
      <Readout
        title={{ en: `Measured, survey ${measured.survey}`, es: `Medido, muestreo ${measured.survey}` }}
        lane="replay"
        provenance="real"
        dataKey={stateKey}
        items={[
          { label: { en: 'Feed F80', es: 'F80 de la alimentación' }, value: measured.f80_mm, unit: 'mm', format: { digits: 4 } },
          { label: { en: 'Closed-side setting', es: 'Abertura de descarga' }, value: measured.css_mm, unit: 'mm', format: { digits: 4 } },
          { label: { en: 'Throughput', es: 'Capacidad' }, value: measured.feed_tph, unit: 't/h', format: { digits: 4 } },
          { label: { en: 'Power', es: 'Potencia' }, value: measured.power_kw, unit: 'kW', format: { digits: 4 } },
        ]}
      />
    </>
  );
}

export function Workbench() {
  const lang = useShellLang();
  const readiness = useReadiness();
  const index = useArtifact((signal) => loadIndex(signal), []);
  const [caseId, setCaseId] = useState<string | null>(null);
  const selected = caseId ?? (index.state === 'ready' ? index.data.default_case : null);
  const loaded = useArtifact((signal) => (selected ? loadCase(selected, signal) : new Promise<CaseData>(() => undefined)), [selected]);
  const [variant, setVariant] = useState<string>(VARIANTS[0].id);
  const [rail, setRail] = useState<{ caseId: string; vals: RailValues } | null>(null);
  const [target, setTarget] = useState(12);

  // A new case starts from its own parameters (the rail shows when they were moved, and resets them), and its target P80 from its own P80.
  const data = loaded.state === 'ready' && loaded.data.manifest.case_id === selected ? loaded.data : null;
  useEffect(() => {
    if (!data) return;
    setRail({ caseId: data.manifest.case_id, vals: railOf(data.manifest.params) });
    const p80 = bakedOf(data.manifest).result.p80;
    setTarget(Number.isFinite(p80) ? Math.min(120, Math.max(2, Math.round(p80))) : 12);
  }, [data]);
  const vals = rail && data && rail.caseId === data.manifest.case_id ? rail.vals : null;

  const sel: Selection | null = useMemo(() => (data && vals ? selectionOf(data, vals, variant) : null), [data, vals, variant]);

  const isReal = data?.manifest.real_or_synthetic === 'real';
  // CrusherCal's document is read by a real survey (its measured band) and by a synthetic case of the machine the model family was calibrated on (a lower-bound band).
  const readsLoo = isReal || (data?.manifest.real_or_synthetic === 'synthetic' && data.manifest.params.machine === BANDED_MACHINE);
  const loo = useArtifact<Hp500Loo>((signal) => (index.state === 'ready' && readsLoo ? loadHp500Loo(index.data, signal) : new Promise<Hp500Loo>(() => undefined)), [index.state, readsLoo]);

  // A case the readiness document lists as absent stays in the selector, marked, so its reason can be read.
  const absent = lang === 'es' ? ' (aún no disponible)' : ' (not available yet)';
  const cases: CaseDef[] =
    index.state === 'ready'
      ? index.data.cases.map((c) => ({
          id: c.case_id,
          name: c.title[lang] + (caseAbsent(readiness ?? null, c.case_id, c.manifest_path) ? absent : ''),
          category: c.category[lang],
          kind: c.real_or_synthetic,
        }))
      : [];
  const unavailable: Text | null = index.state === 'unavailable' ? index.reason : loaded.state === 'unavailable' ? loaded.reason : null;
  const moved = !!(data && vals && railMoved(data.manifest.params, vals));
  const locked = !!data?.manifest.params.calibrated;

  const ctx: ViewCtx = {
    sel,
    unavailable,
    index: index.state === 'ready' ? (index.data as CaseIndex) : null,
    loo: readsLoo ? loo : null,
    target,
    setTarget,
    canApplyCss: !!sel && !locked,
    applyCss: (mm) => rail && sel && setRail({ caseId: rail.caseId, vals: { ...rail.vals, cssMm: mm / sel.variant.cssFactor } }),
  };

  const bounds = data ? knobBounds(data.manifest.params) : null;
  const operating = unavailable ? (
    <p className="caos-pending" data-state="unavailable">
      {lang === 'es' ? 'Los parámetros de este caso aún no están disponibles.' : "This case's parameters are not available yet."}
    </p>
  ) : (
    <>
      {KNOBS.map((k) => (
        <Knob
          key={k.id}
          id={k.id}
          label={k.label}
          hint={k.hint}
          value={vals ? vals[k.key] : (bounds ? bounds[k.key].min : k.min)}
          min={bounds ? bounds[k.key].min : k.min}
          max={bounds ? bounds[k.key].max : k.max}
          step={k.step}
          unit={k.unit}
          disabled={!vals || locked}
          onChange={(v) => rail && setRail({ caseId: rail.caseId, vals: { ...rail.vals, [k.key]: v } })}
        />
      ))}
    </>
  );
  const sections: RailSection[] = [
    { id: 'operating', label: { en: 'Inputs', es: 'Entradas' }, content: operating },
    {
      id: 'values',
      label: { en: 'Values', es: 'Valores' },
      content: (
        <>
          {index.state === 'error' && <p role="alert">{index.error}</p>}
          {loaded.state === 'error' && <p role="alert">{loaded.error}</p>}
          <LiveValues sel={sel} />
        </>
      ),
    },
    ...(isReal ? [{ id: 'measured', label: { en: 'Measured', es: 'Medido' }, content: <MeasuredValues sel={sel} lang={lang} /> }] : []),
  ];

  const prov = sel ? provenanceOf(sel) : 'synthetic';
  const manifest = data?.manifest;
  return (
    <ViewContext.Provider value={ctx}>
      <CaseWorkbench
        caseId={selected ?? ''}
        source={manifest?.real_or_synthetic}
        cases={{
          cases,
          selectedId: selected ?? '',
          onSelect: (id) => {
            setCaseId(id);
            setVariant(VARIANTS[0].id);
          },
          layout: 'select',
          deepLink: true,
          modifiedFromId: moved ? selected : null,
          onResetToCanonical: () => data && setRail({ caseId: data.manifest.case_id, vals: railOf(data.manifest.params) }),
        }}
        controls={vals ? { ...vals, target } : {}}
        variants={{
          variants: VARIANTS.map((v) => ({ id: v.id, label: v.label, note: manifest ? v.note(manifest) : undefined, lane: 'live' as const })),
          activeId: variant,
          onSelect: setVariant,
          title: { en: 'Closed-side setting', es: 'Abertura de descarga' },
        }}
        rail={sections}
        focus
        groups={[
          { id: 'chamber', label: { en: 'Chamber', es: 'Cámara' }, lane: 'live', provenance: 'synthetic', content: <ChamberGroup /> },
          { id: 'product', label: { en: 'Product', es: 'Producto' }, lane: 'live', provenance: prov, content: <ProductGroup /> },
          { id: 'performance', label: { en: 'Performance', es: 'Desempeño' }, lane: 'live', provenance: prov, content: <PerformanceGroup /> },
          { id: 'learned', label: { en: 'Learned', es: 'Aprendido' }, lane: 'live', provenance: prov, content: <LearnedGroup /> },
          { id: 'validation', label: { en: 'Validation', es: 'Validación' }, lane: 'live', provenance: prov, content: <ValidationGroup /> },
        ]}
        context={{ content: <ContextView /> }}
      />
    </ViewContext.Provider>
  );
}
