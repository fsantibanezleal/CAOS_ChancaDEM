// The guided story at /story/<step> (ADR-0082 section 3; SDD Visualization catalog; SH-005 to SH-007, SH-010), on the shell's StoryFrame
// (the stepper, the deep links, the keys, play and pause, the pause on any reader input) and the same state as the App: the case is the
// URL's (?case=, a real survey by default), the selection and the cursors are the shell's linked-view stores. Each step's stage is a view
// of the catalog with its callouts, its panel the evidence and the controls linked to it:
//   1 Measure (V1, the circuit on a real survey), 2 Look inside (V2, the chamber section), 3 Solve (V5 on the V3 axes),
//   4 Compare (V6), 5 Operate (V4).
// The headlines are storyHeadlines() (story.ts), every number read from the committed documents or the live engine. The exit lands on the
// App with the step's case, group and view, and the Operate target (exitHref).
import { StoryFrame, useLinkedCursor, useLinkedItem, useLinkedView, useShellLang, formatNumber, type StoryStep } from '@fasl-work/caos-app-shell';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { loadCase, loadHp500Backbone, loadHp500Comparison, loadHp500CrusherBayes, loadHp500Loo, loadIndex, useArtifact, type CaseData, type Loaded } from '../api/artifacts';
import type { CaseIndex, Hp500Backbone, Hp500Comparison, Hp500CrusherBayes, Hp500Loo, Text } from '../lib/contract.types';
import { caseAbsent } from '../readiness/readiness';
import { useReadiness } from '../readiness/useReadiness';
import { defaultP80Target, HoursView, p80PerMm } from '../views/campaign';
import { SectionDrawing } from '../views/chamber';
import { CircuitDrawing, StreamTable, caseForStage, circuitValues, STAGES, useStagedCases, type StageId } from '../views/circuit';
import { CompareBody, surveyOfCase, caseOfSurvey, type CompareTarget } from '../views/compare';
import { linkedId } from '../views/linked';
import { MACHINE_FLOOR, openingPass, PassControls, PassesChart, passesWord, passSeriesOf, usePassCount } from '../views/passes';
import { ViewContext, type ViewCtx } from '../views/shared';
import { operatingOf, railOf, selectionOf, type Selection } from '../workbench/model';
import type { Machine } from '../engine/types';
import { exitHref, feedStrip, isStep, operatePoint, STORY_STEPS, stepHref, storyHeadlines, type StoryStepId } from './storyModel';
import '../workbench/workbench.css';

const ready = <T,>(l: Loaded<T>): T | null => (l.state === 'ready' ? l.data : null);
const reasonOf = <T,>(l: Loaded<T>): Text | null => (l.state === 'unavailable' ? l.reason : l.state === 'error' ? { en: l.error, es: l.error } : null);
const never = <T,>() => new Promise<T>(() => undefined);

/** The last value a loader gave, kept while the next one loads, so a scrub that changes the case never blanks the story. */
function useLastReady<T>(l: Loaded<T>): T | null {
  const last = useRef<T | null>(null);
  if (l.state === 'ready') last.current = l.data;
  return last.current;
}

/** The survey scrubber of the Measure step: the shell's linked cursor holds the survey number, and moving it opens that survey. */
function SurveyScrubber({ n, current, onPick }: { n: number; current: number | null; onPick: (survey: number) => void }) {
  const lang = useShellLang();
  const { cursor, scrub, inputProps, markerProps } = useLinkedCursor();
  const at = cursor ?? current ?? 1;
  return (
    <div className="cdem-controls">
      <span {...markerProps} data-linked-cursor-position={at} className="cdem-cursor-chip">
        {lang === 'es' ? `Muestreo ${at} de ${n}` : `Survey ${at} of ${n}`}
      </span>
      <input
        type="range"
        min={1}
        max={n}
        step={1}
        {...inputProps}
        value={at}
        aria-label={lang === 'es' ? 'Muestreo medido' : 'Measured survey'}
        onChange={(e) => {
          const k = Number(e.target.value);
          scrub(k);
          onPick(k);
        }}
      />
    </div>
  );
}

/** The ten surveys' feed rates on the Measure stage, linked to the survey scrubber: the mark of the survey the cursor stands on is
 * selected, a mark opens its survey, and the lowest and the highest rate are written at the ends (the headline's evidence, M10). */
function FeedStrip({ backbone, fallback, onPick }: { backbone: Hp500Backbone; fallback: number | null; onPick: (survey: number) => void }) {
  const lang = useShellLang();
  const cursor = useLinkedView((st) => st.cursor);
  const at = cursor ?? fallback;
  const marks = feedStrip(backbone);
  const tph = marks.map((m) => m.tph);
  const fmt = (v: number) => formatNumber(v, lang, { digits: 4 });
  const W = 600;
  const pad = 70;
  const x = (share: number) => pad + share * (W - 2 * pad);
  return (
    <figure className="cdem-feed-strip" data-feed-strip="" data-feed-min={Math.min(...tph)} data-feed-max={Math.max(...tph)}>
      <svg viewBox={`0 0 ${W} 44`} width="100%" height="44" role="img" aria-label={lang === 'es' ? 'Alimentación medida de los diez muestreos (t/h)' : 'Measured feed of the ten surveys (t/h)'}>
        <line x1={x(0)} x2={x(1)} y1={22} y2={22} stroke="var(--color-border)" strokeWidth={2} />
        <text x={x(0) - 8} y={26} textAnchor="end" fontSize={12} fill="var(--color-fg)">{`${fmt(Math.min(...tph))} t/h`}</text>
        <text x={x(1) + 8} y={26} textAnchor="start" fontSize={12} fill="var(--color-fg)">{`${fmt(Math.max(...tph))} t/h`}</text>
        {marks.map((m) => (
          <g key={m.survey} data-feed-mark={m.survey} data-feed-tph={m.tph} data-linked-selected={at === m.survey ? 'true' : 'false'} style={{ cursor: 'pointer' }} onClick={() => onPick(m.survey)}>
            <title>{lang === 'es' ? `Muestreo ${m.survey}: ${fmt(m.tph)} t/h` : `Survey ${m.survey}: ${fmt(m.tph)} t/h`}</title>
            <circle cx={x(m.at)} cy={22} r={at === m.survey ? 8 : 5} fill={at === m.survey ? 'var(--color-accent)' : 'var(--color-fg-subtle)'} stroke="var(--color-bg)" strokeWidth={1.5} />
          </g>
        ))}
      </svg>
      <figcaption className="caos-plot-note">{lang === 'es' ? 'Alimentación medida de los diez muestreos; el punto grande es el mostrado.' : 'Measured feed of the ten surveys; the large dot is the one shown.'}</figcaption>
    </figure>
  );
}

/** The survey marker on the stage: it stands where the shared cursor stands, so the stage and the panel scrub together. */
function StageMarker({ fallback }: { fallback: number | null }) {
  const lang = useShellLang();
  const cursor = useLinkedView((st) => st.cursor);
  const at = cursor ?? fallback;
  return (
    <span className="cdem-story-marker" data-linked-cursor-marker="" data-linked-cursor-position={at ?? ''}>
      {at === null ? '' : lang === 'es' ? `Muestreo ${at}` : `Survey ${at}`}
    </span>
  );
}

function StageLink({ stage, label }: { stage: StageId; label: string }) {
  const item = useLinkedItem(linkedId('stage', stage), 'panel');
  return (
    <button type="button" className="cdem-linkbtn" {...item}>
      {label}
    </button>
  );
}

function Evidence({ title, children, source }: { title: string; children: ReactNode; source: ReactNode }) {
  return (
    <section className="cdem-story-evidence">
      <h2>{title}</h2>
      {children}
      <small>{source}</small>
    </section>
  );
}

export function Story() {
  const lang = useShellLang();
  const es = lang === 'es';
  const t = (en: string, s: string) => (es ? s : en);
  const num = (v: number, o: { digits?: number; decimals?: number }) => formatNumber(v, lang, o);
  const { step } = useParams();
  const [query, setQuery] = useSearchParams();
  const navigate = useNavigate();
  const readiness = useReadiness();
  const scrub = useLinkedView((s) => s.scrub);
  const index = useArtifact((signal) => loadIndex(signal), []);
  const idx: CaseIndex | null = ready(index);
  const firstReal = idx ? (idx.cases.find((c) => c.real_or_synthetic === 'real')?.case_id ?? idx.default_case) : null;
  const caseId = query.get('case') ?? firstReal;
  const loaded = useArtifact<CaseData>((signal) => (caseId ? loadCase(caseId, signal) : never<CaseData>()), [caseId]);
  const data = useLastReady(loaded);
  const backbone = useArtifact<Hp500Backbone>((signal) => (idx ? loadHp500Backbone(idx, signal) : never<Hp500Backbone>()), [idx]);
  const loo = useArtifact<Hp500Loo>((signal) => (idx ? loadHp500Loo(idx, signal) : never<Hp500Loo>()), [idx]);
  const cb = useArtifact<Hp500CrusherBayes>((signal) => (idx ? loadHp500CrusherBayes(idx, signal) : never<Hp500CrusherBayes>()), [idx]);
  const cmp = useArtifact<Hp500Comparison>((signal) => (idx ? loadHp500Comparison(idx, signal) : never<Hp500Comparison>()), [idx]);
  const staged = useStagedCases(idx);
  const [target, setTarget] = useState(0);
  const [drift, setDrift] = useState<number | null>(null);
  const [compareTarget, setCompareTarget] = useState<CompareTarget>('kW');
  const active: StoryStepId = isStep(step) ? step : 'measure';

  const sel: Selection | null = useMemo(() => (data ? selectionOf(data, railOf(data.manifest.params), 'canonical') : null), [data]);
  const survey = surveyOfCase(data?.manifest.case_id);

  // each step starts its shared cursor where its view reads it: the survey shown (Measure), the pass the Solve headline names (the first
  // within a millionth of the closed form), so the stage opens on the headline's evidence
  const solveStart = sel ? openingPass(passSeriesOf(sel.op)) : 1;
  useEffect(() => {
    if (active === 'measure') scrub(survey ?? 1);
    else if (active === 'solve') scrub(solveStart);
    else scrub(null);
  }, [active, survey, scrub, solveStart]);

  const shownCase = data?.manifest.case_id ?? caseId ?? '';
  const withCase = (id: string) => {
    const next = new URLSearchParams(query);
    next.set('case', id);
    setQuery(next, { replace: true });
  };

  const unavailable = index.state === 'unavailable' ? index.reason : index.state === 'error' ? { en: index.error, es: index.error } : loaded.state === 'unavailable' ? loaded.reason : null;
  const absent = data && idx ? caseAbsent(readiness ?? null, data.manifest.case_id, idx.cases.find((c) => c.case_id === data.manifest.case_id)?.manifest_path ?? '') : false;
  if (!sel || !data || absent) {
    return (
      <section className="cdem-story-state" data-state={absent || unavailable ? 'unavailable' : 'loading'}>
        <h1>{t('The crushing story', 'El recorrido del chancado')}</h1>
        <p>
          {unavailable
            ? unavailable[lang]
            : absent
              ? t('This case is listed as not available in the release evidence.', 'Este caso figura como no disponible en la evidencia de la versión.')
              : t('Loading the case and its documents.', 'Cargando el caso y sus documentos.')}
        </p>
        <a href={exitHref(active, caseId ?? '')}>{t('Open the App', 'Abrir la App')}</a>
      </section>
    );
  }

  const op = operatingOf(data.manifest.params);
  const heads = storyHeadlines(
    {
      caseId: shownCase,
      op,
      backbone: ready(backbone),
      backboneReason: reasonOf(backbone),
      loo: ready(loo),
      looReason: reasonOf(loo),
      cb: ready(cb),
      cbReason: reasonOf(cb),
      comparison: ready(cmp),
      comparisonReason: reasonOf(cmp),
    },
    lang,
  );
  const ctx: ViewCtx = {
    sel,
    unavailable: null,
    index: idx,
    loo: null,
    target: target > 0 ? target : defaultP80Target(sel.result.p80),
    setTarget,
    canApplyCss: false,
    applyCss: () => undefined,
    drift,
    setDrift,
    pickCase: withCase,
  };

  // Step 1, Measure: the circuit on the survey, the survey scrubber and the streams as the panel side of the selection
  const values = circuitValues(data.manifest, data.trace, data.traceReason);
  const cases = staged.state === 'ready' ? staged.data : [];
  const stageMachines: Partial<Record<StageId, Machine>> = {};
  for (const s of STAGES) {
    const id = caseForStage(s, cases);
    const hit = cases.find((c) => c.caseId === id);
    if (hit) stageMachines[s] = hit.machine;
  }
  const nSurveys = ready(backbone)?.n ?? 10;
  const measureStage = (
    <div className="cdem-story-stage">
      <CircuitDrawing
        values={values}
        stageMachines={stageMachines}
        label={{ en: 'Flowsheet of the three-stage crushing circuit', es: 'Diagrama de flujo del circuito de chancado de tres etapas' }}
        onPickStage={(stage) => {
          const id = caseForStage(stage, cases);
          if (id) withCase(id);
        }}
      />
      {ready(backbone) && <FeedStrip backbone={ready(backbone)!} fallback={survey} onPick={(k) => withCase(caseOfSurvey(k))} />}
      <StageMarker fallback={survey} />
    </div>
  );
  const bb = ready(backbone);
  const measurePanel = (
    <Evidence
      title={t('What the plant measured', 'Lo que midió la planta')}
      source={
        <>
          {t('Source: case manifest (Rocha et al. 2024, ', 'Fuente: manifiesto del caso (Rocha et al. 2024, ')}
          <span translate="no">CC BY 4.0</span>
          {t(') and the committed trace.', ') y la traza comprometida.')}
        </>
      }
    >
      <SurveyScrubber n={nSurveys} current={survey} onPick={(k) => withCase(caseOfSurvey(k))} />
      <StreamTable values={values} />
      <p>
        {t('Stages: ', 'Etapas: ')}
        {STAGES.map((s) => (
          <span key={s} style={{ marginRight: '0.5rem' }}>
            <StageLink stage={s} label={s === 'primary' ? t('primary', 'primaria') : s === 'secondary' ? t('secondary', 'secundaria') : t('tertiary', 'terciaria')} />
          </span>
        ))}
      </p>
      {bb ? (
        <p>
          {t('The ten surveys: ', 'Los diez muestreos: ')}
          {bb.surveys.map((s) => `${num(s.measured.feed_tph, { digits: 4 })}`).join(' · ')} t/h
        </p>
      ) : (
        <p>{heads.measure.summary}</p>
      )}
    </Evidence>
  );

  // Step 2, Look inside: the section with its callouts
  const insideStage = (
    <div className="cdem-story-stage">
      <SectionDrawing op={op} hours={null} caseId={shownCase} />
    </div>
  );
  const r = sel.result;
  const measuredF80 = data.manifest.measured?.f80_mm ?? null;
  const insidePanel = (
    <Evidence
      title={t('The chamber at this setting', 'La cámara con esta abertura')}
      source={t(
        'Source: the live TypeScript engine at the case’s manifest values; the 3D chamber of the App is a kinematic view, not a simulation.',
        'Fuente: el motor TypeScript en vivo con los valores del manifiesto del caso; la cámara 3D de la App es una vista cinemática, no una simulación.',
      )}
    >
      <p>
        {t('Closed-side setting', 'Abertura de descarga')} <strong>{num(op.cssMm, { digits: 3 })} mm</strong>, {t('open-side setting', 'abertura del lado abierto')}{' '}
        <strong>{num(r.ossMm, { digits: 3 })} mm</strong>.
      </p>
      <p>
        {t('Nip angle', 'Ángulo de nip')} <strong>{num(r.nipAngleDeg, { decimals: 1 })}°</strong> {t('against the grip limit', 'contra el límite de agarre')}{' '}
        <strong>{num(r.nipLimitDeg, { decimals: 2 })}°</strong>:{' '}
        {r.nipAngleDeg <= r.nipLimitDeg
          ? t('the particle is gripped and crushed.', 'la partícula se agarra y se tritura.')
          : t('the particle is squeezed upward.', 'la partícula es escupida hacia arriba.')}
      </p>
      <p>
        {t('Product P80', 'P80 del producto')} <strong>{num(r.p80, { digits: 3 })} mm</strong> {t('from the model’s feed F80 of', 'desde el F80 de alimentación del modelo,')}{' '}
        <strong>{num(r.f80, { digits: 3 })} mm</strong>
        {measuredF80 !== null
          ? t(`, reconstructed from the measured ${num(measuredF80, { digits: 3 })} mm.`, `, reconstruido desde los ${num(measuredF80, { digits: 3 })} mm medidos.`)
          : '.'}
      </p>
    </Evidence>
  );

  // Step 3, Solve: the population balance pass by pass on the gradation's axes
  const series = passSeriesOf(sel.op);
  const solveStage = (
    <div className="cdem-story-stage cdem-story-chart">
      <SolveStage sel={sel} />
    </div>
  );
  const solvePanel = (
    <Evidence
      title={t('The solve, pass by pass', 'La solución, pasada a pasada')}
      source={t(
        'Source: the live engine’s breakage matrix B, classification C and feed f; the closed form is its LU solve.',
        'Fuente: la matriz de fractura B, la clasificación C y la alimentación f del motor en vivo; la forma cerrada es su solución LU.',
      )}
    >
      <PassControls n={series.n} start={solveStart} />
      <SolveReadout sel={sel} start={solveStart} />
    </Evidence>
  );

  // Step 4, Compare: the held-out errors (stage) and the selected method on each survey (panel)
  const looData = ready(loo);
  const cbData = ready(cb);
  const compareStage = looData ? (
    <div className="cdem-story-stage cdem-story-chart">
      <CompareBody
        loo={looData}
        cb={cbData}
        cbReason={reasonOf(cb)}
        comparison={ready(cmp)}
        comparisonReason={reasonOf(cmp)}
        target={compareTarget}
        setTarget={setCompareTarget}
        caseId={shownCase}
        onPickCase={withCase}
        part="stage"
      />
    </div>
  ) : (
    <p className="caos-pending" data-state="unavailable">
      {heads.compare.summary}
    </p>
  );
  const comparePanel = looData ? (
    <div>
      <CompareBody
        loo={looData}
        cb={cbData}
        cbReason={reasonOf(cb)}
        comparison={ready(cmp)}
        comparisonReason={reasonOf(cmp)}
        target={compareTarget}
        setTarget={setCompareTarget}
        caseId={shownCase}
        onPickCase={withCase}
        part="panel"
      />
    </div>
  ) : (
    <p>{heads.compare.summary}</p>
  );

  // Step 5, Operate: P80 as the setting drifts, at the reader's drift rate
  const slope = p80PerMm(op);
  const drawn = operatePoint(op);
  const operateStage = (
    <div className="cdem-story-stage cdem-story-chart">
      <HoursView />
    </div>
  );
  const operatePanel = (
    <Evidence
      title={t('Operating the setting', 'Operar la abertura')}
      source={t(
        'Source: the live engine’s P80 against the setting; the 45 h line is the re-set interval of one plant (Ma, Fan and He 2016).',
        'Fuente: el P80 del motor en vivo contra la abertura; la línea de 45 h es el intervalo de reajuste de una planta (Ma, Fan y He 2016).',
      )}
    >
      <p data-drift-secant={drawn?.secant ?? ''}>
        {drawn && drawn.secant !== null && drawn.crossingMm !== null ? (
          <>
            {t('Over the drawn range, P80 rises from', 'En el rango dibujado, el P80 sube de')} <strong>{num(r.p80, { digits: 3 })} mm</strong>{' '}
            {t('to the', 'al objetivo de')} <strong>{num(drawn.targetMm, { digits: 3 })} mm</strong> {t('target in', 'en')}{' '}
            <strong>{num(drawn.crossingMm, { digits: 3 })} mm</strong> {t('of drift:', 'de desplazamiento:')}{' '}
            <strong>{num(drawn.secant, { digits: 3 })} mm</strong> {t('of P80 per mm of setting.', 'de P80 por mm de abertura.')}
          </>
        ) : (
          t('The target is not reached on the drawn range.', 'El objetivo no se alcanza en el rango dibujado.')
        )}
      </p>
      <p>
        {t('The local slope at the current setting is', 'La pendiente local en la abertura actual es')}{' '}
        <strong>{slope === null ? t('not available', 'no disponible') : `${num(slope, { digits: 3 })} mm/mm`}</strong>
        {t(
          ': the engine’s P80 is piecewise in the setting, so the slope at one setting is not the response over a drift (Methodology, the campaign view).',
          ': el P80 del motor es por tramos en la abertura, así que la pendiente en una abertura no es la respuesta a un desplazamiento (Metodología, la vista de campaña).',
        )}
      </p>
      <p>
        {t(
          'Enter your drift rate in the chart’s controls to read operating hours: the product asserts no wear rate.',
          'Ingrese su velocidad de desplazamiento en los controles del gráfico para leer horas de operación: el producto no afirma ninguna tasa de desgaste.',
        )}
      </p>
    </Evidence>
  );

  const content: Record<StoryStepId, { stage: ReactNode; panel: ReactNode }> = {
    measure: { stage: measureStage, panel: measurePanel },
    inside: { stage: insideStage, panel: insidePanel },
    solve: { stage: solveStage, panel: solvePanel },
    compare: { stage: compareStage, panel: comparePanel },
    operate: { stage: operateStage, panel: operatePanel },
  };
  const steps: StoryStep[] = STORY_STEPS.map((s) => ({
    id: s.id,
    number: s.number,
    verb: s.verb,
    headline: { en: heads[s.id].headline, es: heads[s.id].headline },
    summary: { en: heads[s.id].summary, es: heads[s.id].summary },
    href: stepHref(s.id, shownCase),
    accent: s.accent,
    stage: content[s.id].stage,
    // the docked panel keeps the height the layout gives it and scrolls inside, so a long panel never squeezes the stepper
    panel: <div className="cdem-story-dock">{content[s.id].panel}</div>,
  }));
  return (
    <ViewContext.Provider value={ctx}>
      <StoryFrame
        className="cdem-story"
        steps={steps}
        activeId={active}
        mobileStageMinHeight={560}
        onStepChange={(next) => navigate(stepHref(next as StoryStepId, shownCase))}
        onExit={() => navigate(exitHref(active, shownCase, { targetMm: ctx.target }))}
        labels={{
          steps: { en: 'The crushing story', es: 'El recorrido del chancado' },
          previous: { en: 'Previous', es: 'Anterior' },
          next: { en: 'Next', es: 'Siguiente' },
          play: { en: 'Play', es: 'Reproducir' },
          pause: { en: 'Pause', es: 'Pausar' },
          exit: { en: 'Explore in the App', es: 'Explorar en la App' },
        }}
      />
    </ViewContext.Provider>
  );
}

function SolveStage({ sel }: { sel: Selection }) {
  const series = passSeriesOf(sel.op);
  const count = usePassCount(series.n, openingPass(series));
  return <PassesChart sel={sel} series={series} count={count} />;
}

function SolveReadout({ sel, start }: { sel: Selection; start: number }) {
  const lang = useShellLang();
  const series = passSeriesOf(sel.op);
  const count = usePassCount(series.n, start);
  const k = Math.min(series.residual.length - 1, count);
  const f = (v: number, o: { digits?: number }) => formatNumber(v, lang, o);
  const res = series.residual[k] < MACHINE_FLOOR ? (lang === 'es' ? 'bajo 1e-15 (precisión de máquina)' : 'below 1e-15 (machine precision)') : f(series.residual[k], { digits: 2 });
  return (
    <p data-pass-count={count}>
      {lang === 'es'
        ? `Tras ${count} ${passesWord(count, 'es')} el residuo es ${res} de la masa alimentada y ${f(series.inChamber[k] * 100, { digits: 3 })} % de la alimentación sigue en la cámara.`
        : `After ${count} ${passesWord(count, 'en')} the residual is ${res} of the feed mass and ${f(series.inChamber[k] * 100, { digits: 3 })} % of the feed is still in the chamber.`}
    </p>
  );
}
