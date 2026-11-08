// Catalog row V6, comparison and decision: which method should a forecast of throughput and power trust, measured on surveys it never
// saw? The held-out (strict leave-one-survey-out) MAPE of every method of hp500-loo and of CrusherBayes (hp500-crusherbayes) on shared
// axes, the ten per-survey errors as points beside each method, the predictive bands where the documents have them, and the method
// with the lowest held-out MAPE per target marked as the recommended one with its reason (SH-009). The two controls of the protocol
// (the constant mean and the label shuffle) are drawn as the bars to beat and are never recommended: they are checks, not forecasts.
// Every number is read from the committed documents; the per-survey errors are recomputed from their predictions and measurements, and
// their mean is the document's MAPE (the test holds the two equal). How sure the ranking is comes from hp500-comparison (rule 7): the
// paired difference of each method against the recommended one over the ten surveys, with its bootstrap interval and its wins, drawn
// as an interval mark and named in the third callout and the takeaway; never typed here, and the missing state when it is absent.
import { PlotCard, useLinkedItem, useShellLang, useWorkbenchState, type BiText } from '@fasl-work/caos-app-shell';
import { UPlotChart, type ChartSeries } from '@fasl-work/caos-app-shell/chart';
import { useCallback, useRef, useState } from 'react';
import { loadHp500Comparison, loadHp500CrusherBayes, loadHp500Loo, useArtifact } from '../api/artifacts';
import type { CaseIndex, Hp500Comparison, Hp500CrusherBayes, Hp500Loo, Text } from '../lib/contract.types';
import { ChartCallouts, type CalloutSpec, type ChartPoint } from './callouts';
import { useEntry } from './staging';
import { linkedId, selectedOf, useLinkedSelection } from './linked';
import { bare, useNum, useT, useView } from './shared';

export type CompareTarget = 'tph' | 'kW';

export interface MethodRow {
  id: string;
  name: Text;
  /** A control of the protocol: drawn, never recommended. */
  control: boolean;
  mape: number;
  /** The absolute percent error on each held-out survey, or null when the document carries no per-survey prediction. */
  errors: number[] | null;
  /** The per-survey predictions, for the band chart. */
  pred: number[] | null;
  /** The 80 percent predictive band per survey, where the document has one. */
  band: { lo: number[]; hi: number[]; coverage: number } | null;
  source: Text;
}

/** The methods of the comparison by their names (the documents' keys stay the documents'). */
export const METHOD_NAME: Record<string, Text> = {
  M0_backbone: { en: 'Calibrated backbone', es: 'Esqueleto calibrado' },
  M1_residual: { en: 'Backbone plus bounded residual', es: 'Esqueleto más residuo acotado' },
  M2_freeform: { en: 'Free-form fit', es: 'Ajuste de forma libre' },
  B_lin: { en: 'Setting-only line', es: 'Línea solo de la abertura' },
  Morrell: { en: 'Morrell size-specific energy', es: 'Energía específica de Morrell' },
  Morrell_noload: { en: 'Morrell with a no-load term', es: 'Morrell con término en vacío' },
  crusherbayes: { en: 'CrusherBayes', es: 'CrusherBayes' },
  constant_mean: { en: 'Constant mean (control)', es: 'Media constante (control)' },
  M1_label_shuffle: { en: 'Label shuffle (control)', es: 'Etiquetas barajadas (control)' },
};

/** Every MAPE the comparison shows has one decimal (N9 of the 0.13.000 re-check: 14 % beside 12.8 % read as two precisions). */
export const MAPE_DECIMALS = 1;

/** The colour of the paired gap's interval bracket and its mean (N6): its own token, never a series' or the selected survey's. */
export const GAP_COLOR = '--color-magenta';

/** The width of the comparison below which its axis numbers the methods instead of naming them [px]. */
export const NARROW_PX = 640;

/** The method axis's ticks: the short names, or the methods' numbers below NARROW_PX. */
export function methodTicks(rows: readonly MethodRow[], narrow: boolean): { value: number; label: Text }[] {
  return rows.map((r, i) => ({ value: i + 1, label: narrow ? { en: String(i + 1), es: String(i + 1) } : (METHOD_SHORT[r.id] ?? r.name) }));
}

/** The short names on the chart's axis (m7: two adjacent names never touch at 1280 px). */
export const METHOD_SHORT: Record<string, Text> = {
  M0_backbone: { en: 'Backbone', es: 'Esqueleto' },
  M1_residual: { en: 'Residual', es: 'Residuo' },
  M2_freeform: { en: 'Free-form', es: 'Libre' },
  B_lin: { en: 'Line', es: 'Línea' },
  Morrell: { en: 'Morrell', es: 'Morrell' },
  Morrell_noload: { en: 'No-load', es: 'En vacío' },
  crusherbayes: { en: 'CrusherBayes', es: 'CrusherBayes' },
  constant_mean: { en: 'Mean', es: 'Media' },
  M1_label_shuffle: { en: 'Shuffle', es: 'Barajada' },
};

/** The key of a method's per-survey predictions in the document's `pred` object: the ladder rows keep their row key's prefix. */
const predKeyOf = (id: string): string | null => (id === 'constant_mean' || id === 'M1_label_shuffle' ? null : /^M\d_/.test(id) ? id.slice(0, 2) : id);

const absErrors = (pred: readonly number[], measured: readonly number[]) => pred.map((p, i) => (Math.abs(p - measured[i]) / measured[i]) * 100);

/** The rows of a target, read from the documents; CrusherBayes is absent from them when its document is (null). */
export function compareRows(loo: Hp500Loo, cb: Hp500CrusherBayes | null, target: CompareTarget): MethodRow[] {
  const t = loo.loo[target];
  const strict = t.strict as Record<string, unknown> & typeof t.strict;
  const measured = t.measured;
  const looSource: Text = { en: `hp500/loo.json, strict leave-one-survey-out, ${target}`, es: `hp500/loo.json, dejando un muestreo fuera, ${target}` };
  const rows: MethodRow[] = [];
  for (const id of ['M0_backbone', 'M1_residual', 'M2_freeform', 'B_lin', 'Morrell', 'Morrell_noload', 'constant_mean', 'M1_label_shuffle']) {
    const scores = strict[id] as { mape_pct: number } | undefined;
    if (!scores) continue;
    const key = predKeyOf(id);
    const pred = key ? ((t.strict.pred as Record<string, number[] | undefined>)[key] ?? null) : null;
    const band =
      id === 'M0_backbone' && pred ? { lo: pred.map((p) => p - t.strict.uq.band_halfwidth), hi: pred.map((p) => p + t.strict.uq.band_halfwidth), coverage: t.strict.uq.empirical_coverage } : null;
    rows.push({
      id,
      name: METHOD_NAME[id],
      control: id === 'constant_mean' || id === 'M1_label_shuffle',
      mape: scores.mape_pct,
      errors: pred ? absErrors(pred, measured) : null,
      pred,
      band,
      source: looSource,
    });
  }
  if (cb) {
    const c = cb.loo[target];
    rows.push({
      id: 'crusherbayes',
      name: METHOD_NAME.crusherbayes,
      control: false,
      mape: c.scores.mape_pct,
      errors: absErrors(c.pred_mean, c.measured),
      pred: [...c.pred_mean],
      band: { lo: [...c.lo80], hi: [...c.hi80], coverage: c.scores.coverage_80 },
      source: { en: `hp500/crusherbayes.json, held out, ${target}`, es: `hp500/crusherbayes.json, reservado, ${target}` },
    });
  }
  return rows;
}

/** The recommended method of a target: the lowest held-out MAPE among the methods that are not controls (null when there is none). */
export function recommend(rows: readonly MethodRow[]): MethodRow | null {
  let best: MethodRow | null = null;
  for (const r of rows) if (!r.control && Number.isFinite(r.mape) && (best === null || r.mape < best.mape)) best = r;
  return best;
}

/** Why the recommended method is recommended, in the problem's terms. */
export function recommendReason(best: MethodRow, rows: readonly MethodRow[], target: CompareTarget, fmt: (v: number) => string): Text {
  const methods = rows.filter((r) => !r.control).length;
  const what: Text = target === 'tph' ? { en: 'throughput', es: 'capacidad' } : { en: 'power', es: 'potencia' };
  return {
    en: `Recommended for ${what.en}: ${best.name.en}, the lowest held-out error of the ${methods} methods on the ten surveys it never saw (${fmt(best.mape)} percent mean absolute error).`,
    es: `Recomendado para ${what.es}: ${best.name.es}, el menor error reservado de los ${methods} métodos en los diez muestreos que nunca vio (${fmt(best.mape)} por ciento de error absoluto medio).`,
  };
}

export type Paired = Hp500Comparison['targets']['kW']['paired'][number];

/** The paired row of a method against the recommended one in the comparison document, or null (absent document, or no such row). */
export function pairedOf(comparison: Hp500Comparison | null, target: CompareTarget, method: string | undefined): Paired | null {
  if (!comparison || !method) return null;
  return comparison.targets[target].paired.find((p) => p.method === method) ?? null;
}

/** The method the view opens selected: the runner-up of the comparison (so the stage shows two methods and the gap between them), else
 * the second-lowest MAPE of the rows, else the recommended one. */
export function openingChoice(rows: readonly MethodRow[], best: MethodRow | null, comparison: Hp500Comparison | null, target: CompareTarget): MethodRow | null {
  const named = comparison ? rows.find((r) => r.id === comparison.targets[target].runner_up) : undefined;
  if (named) return named;
  const free = rows.filter((r) => !r.control && r !== best && Number.isFinite(r.mape)).sort((a, b) => a.mape - b.mape);
  return free[0] ?? best;
}

const fallbackReason: Text = { en: 'hp500/comparison.json is not in this build', es: 'hp500/comparison.json no está en esta versión' };

/** How sure the ranking of a target is with ten surveys, from the comparison document: the gap to the runner-up, its interval and its
 * wins; when the document is absent, the reason (never a number). */
export function certaintyText(comparison: Hp500Comparison | null, reason: Text | null, target: CompareTarget, fmt: (v: number, o?: { digits?: number; decimals?: number }) => string): Text {
  if (!comparison) {
    const why = reason ?? fallbackReason;
    return { en: `How sure the ranking is: not available yet: ${bare(why.en)}.`, es: `Cuán segura es la clasificación: aún no disponible: ${bare(why.es)}.` };
  }
  const t = comparison.targets[target];
  const p = pairedOf(comparison, target, t.runner_up);
  const best = METHOD_NAME[t.recommended] ?? { en: t.recommended, es: t.recommended };
  const runner = METHOD_NAME[t.runner_up] ?? { en: t.runner_up, es: t.runner_up };
  if (!p) return { en: `The comparison has no paired row for ${runner.en}.`, es: `La comparación no tiene fila pareada para ${runner.es}.` };
  const n = comparison.n;
  const [lo, hi] = p.ci95;
  const d = (v: number) => fmt(v, { decimals: 2 });
  const settled = lo > 0;
  return {
    en: `Against the runner-up, ${runner.en}, ${best.en} is ${d(p.mean_diff_pts)} points lower on average (95 percent paired interval ${d(lo)} to ${d(hi)}) and lower on ${p.wins} of the ${n} surveys: ${settled ? `the interval excludes zero, so the ranking holds on these ${n} surveys` : `the interval includes zero, so ${n} surveys do not settle the ranking`}.`,
    es: `Frente al segundo, ${runner.es}, ${best.es} es ${d(p.mean_diff_pts)} puntos menor en promedio (intervalo pareado del 95 por ciento ${d(lo)} a ${d(hi)}) y menor en ${p.wins} de los ${n} muestreos: ${settled ? `el intervalo excluye el cero, así que la clasificación se sostiene en estos ${n} muestreos` : `el intervalo incluye el cero, así que ${n} muestreos no deciden la clasificación`}.`,
  };
}

/** The three callouts of the comparison: the recommended method, the selected one (the runner-up at the opening state) and the paired
 * gap of the selected method (or of the runner-up, when the recommended one is selected) to the recommended one, with its interval. */
export function compareCallouts(
  rows: readonly MethodRow[],
  best: MethodRow | null,
  chosen: MethodRow,
  comparison: Hp500Comparison | null,
  comparisonReason: Text | null,
  target: CompareTarget,
  fmt: (v: number, o: { digits?: number; decimals?: number }) => string,
): CalloutSpec[] {
  const unit = { en: '% MAPE', es: '% MAPE' };
  const named = (r: MethodRow) => ({ en: `${r.name.en}, held out`, es: `${r.name.es}, reservado` });
  return [
    best
      ? {
          id: 'best',
          eyebrow: { en: 'BEST', es: 'MEJOR' },
          value: fmt(best.mape, { decimals: MAPE_DECIMALS }),
          unit,
          state: 'normal',
          source: named(best),
        }
      : {
          id: 'best',
          eyebrow: { en: 'BEST', es: 'MEJOR' },
          value: null,
          unit,
          state: 'inactive',
          source: { en: 'no method', es: 'ningún método' },
          missing: { en: 'no method is scored for this target', es: 'ningún método tiene puntaje para este objetivo' },
        },
    {
      id: 'chosen',
      eyebrow: { en: 'SELECTED', es: 'ELEGIDO' },
      value: fmt(chosen.mape, { decimals: MAPE_DECIMALS }),
      unit,
      state: 'selected',
      source: named(chosen),
    },
    gapCallout(rows, best, chosen, comparison, comparisonReason, target, fmt),
  ];
}

function gapCallout(
  rows: readonly MethodRow[],
  best: MethodRow | null,
  chosen: MethodRow,
  comparison: Hp500Comparison | null,
  comparisonReason: Text | null,
  target: CompareTarget,
  fmt: (v: number, o: { digits?: number; decimals?: number }) => string,
): CalloutSpec {
  // short eyebrow and unit (M2): the interval leads the source, which names the two methods
  const eyebrow = { en: 'GAP', es: 'BRECHA' };
  const other = chosen.id !== best?.id ? chosen : comparison ? (rows.find((r) => r.id === comparison.targets[target].runner_up) ?? null) : null;
  const p = pairedOf(comparison, target, other?.id);
  if (!comparison || !p || !other || !best) {
    const why = comparison ? { en: `the comparison has no paired row for ${other?.name.en ?? 'this method'}`, es: `la comparación no tiene fila pareada para ${other?.name.es ?? 'este método'}` } : (comparisonReason ?? fallbackReason);
    return { id: 'gap', eyebrow, value: null, unit: { en: 'points', es: 'puntos' }, state: 'inactive', source: { en: 'hp500/comparison.json', es: 'hp500/comparison.json' }, missing: { en: bare(why.en), es: bare(why.es) } };
  }
  const [lo, hi] = p.ci95;
  const d = (v: number) => fmt(v, { decimals: 2 });
  return {
    id: 'gap',
    eyebrow,
    value: `${p.mean_diff_pts > 0 ? '+' : ''}${d(p.mean_diff_pts)}`,
    unit: { en: 'points', es: 'puntos' },
    state: lo > 0 ? 'normal' : 'warning',
    source: {
      // short, so the card keeps its height: the methods by their axis names, the full sentence in the takeaway
      en: `95% ${d(lo)} to ${d(hi)}; ${(METHOD_SHORT[other.id] ?? other.name).en} minus ${(METHOD_SHORT[best.id] ?? best.name).en}, wins ${p.wins} of ${comparison.n}`,
      es: `95% ${d(lo)} a ${d(hi)}; ${(METHOD_SHORT[other.id] ?? other.name).es} menos ${(METHOD_SHORT[best.id] ?? best.name).es}, gana ${p.wins} de ${comparison.n}`,
    },
  };
}

/** The 95 percent interval of the paired gap as a bracket beside the selected method's dot, in a colour of its own, with its end values
 * (N6 of the 0.13.000 re-check: a 12 to 25 px mark in the selected survey's colour, on its dot, was hard to read). It stands on the
 * MAPE axis from the recommended MAPE plus the low end to it plus the high end; `at` places a data point on the rendered scales. */
export function GapBracket({ at, x, base, ci, fmt }: { at: (p: { x: number; y: number }) => { x: number; y: number }; x: number; base: number; ci: [number, number] | readonly number[]; fmt: (v: number) => string }) {
  const lo = at({ x: x - 0.12, y: base + ci[0] });
  const hi = at({ x: x - 0.12, y: base + ci[1] });
  const cap = 5;
  const signed = (v: number) => `${v > 0 ? '+' : ''}${fmt(v)}`;
  const label = { fontSize: 11, fill: 'var(--color-fg)', stroke: 'var(--color-surface)', strokeWidth: 3, paintOrder: 'stroke' as const, textAnchor: 'end' as const };
  return (
    <g data-gap-bracket="" data-gap-lo={ci[0]} data-gap-hi={ci[1]} stroke={`var(${GAP_COLOR})`} strokeWidth={2} fill="none">
      <line x1={lo.x} y1={lo.y} x2={hi.x} y2={hi.y} />
      <line x1={lo.x} y1={lo.y} x2={lo.x + cap} y2={lo.y} />
      <line x1={hi.x} y1={hi.y} x2={hi.x + cap} y2={hi.y} />
      {/* the ends' values above and below the bracket, so the two never meet however short the bracket is drawn */}
      <text x={hi.x + cap} y={hi.y - 4} {...label}>
        {signed(ci[1])}
      </text>
      <text x={lo.x + cap} y={lo.y + 13} {...label}>
        {signed(ci[0])}
      </text>
    </g>
  );
}

/** The survey number of a real case id (HP500-03 is survey 3), or null. */
export const surveyOfCase = (caseId: string | undefined): number | null => {
  const m = caseId ? /^HP500-(\d+)$/.exec(caseId) : null;
  return m ? Number(m[1]) : null;
};
export const caseOfSurvey = (n: number): string => `HP500-${String(n).padStart(2, '0')}`;

function MethodButton({ row, n, best, lang }: { row: MethodRow; n: number; best: boolean; lang: 'en' | 'es' }) {
  const item = useLinkedItem(linkedId('method', row.id), 'panel');
  return (
    <button type="button" className="cdem-linkbtn" {...item} data-recommended={best ? 'true' : 'false'}>
      <span className="cdem-pick-n">{n}.</span> {row.name[lang]}
      {best ? (lang === 'es' ? ' (recomendado)' : ' (recommended)') : ''}
    </button>
  );
}

function SurveyButton({ n, current, onPick }: { n: number; current: boolean; onPick: () => void }) {
  const item = useLinkedItem(linkedId('survey', n), 'panel');
  return (
    <button
      type="button"
      className="cdem-linkbtn"
      data-linked-id={item['data-linked-id']}
      data-linked-view={item['data-linked-view']}
      data-linked-selected={current ? 'true' : item['data-linked-selected']}
      aria-pressed={current}
      onClick={() => {
        item.onClick();
        onPick();
      }}
    >
      {n}
    </button>
  );
}

/** The comparison: the dot plot of the held-out errors (the stage) and the selected method's predictions with their band. */
export function CompareBody({
  loo,
  cb,
  cbReason,
  comparison = null,
  comparisonReason = null,
  target,
  setTarget,
  caseId,
  onPickCase,
  part,
}: {
  loo: Hp500Loo;
  cb: Hp500CrusherBayes | null;
  cbReason: Text | null;
  /** The paired comparison (hp500-comparison); null with its reason when the document is absent. */
  comparison?: Hp500Comparison | null;
  comparisonReason?: Text | null;
  target: CompareTarget;
  setTarget: (t: CompareTarget) => void;
  caseId: string | undefined;
  onPickCase: (caseId: string) => void;
  part?: 'stage' | 'panel';
}) {
  const lang = useShellLang();
  const num = useNum();
  const t = useT();
  const stateKey = useWorkbenchState()?.stateKey;
  const { selectedId } = useLinkedSelection();
  const rows = compareRows(loo, cb, target);
  const best = recommend(rows);
  // the story's entry grows the methods' dots one by one (views/staging.tsx); outside the story every method is drawn
  const { reveal } = useEntry();
  const grown = reveal >= 1 ? rows.length : Math.max(1, Math.ceil(reveal * rows.length));
  const chosenId = selectedOf(selectedId, 'method');
  const chosen = rows.find((r) => r.id === chosenId) ?? openingChoice(rows, best, comparison, target) ?? rows[0];
  // below 640 px the axis numbers the methods (the pickers and the readout name them), so no two labels touch (M8, m7)
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const measure = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node || typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(() => setWidth(node.getBoundingClientRect().width));
    observer.current.observe(node);
    setWidth(node.getBoundingClientRect().width);
  }, []);
  const narrow = width > 0 && width < NARROW_PX;
  const [view, setView] = useState<'methods' | 'surveys'>('methods');
  const ticks = methodTicks(rows, narrow);
  const xs = rows.map((_, i) => i + 1);
  const n = loo.n;
  const survey = surveyOfCase(caseId);
  const dotsX: number[] = [];
  const dotsY: number[] = [];
  const selX: number[] = [];
  const selY: number[] = [];
  rows.forEach((r, i) => {
    if (i >= grown) return;
    r.errors?.forEach((e, k) => {
      const x = i + 1 + 0.18 + (0.22 * k) / Math.max(1, n - 1);
      dotsX.push(x);
      dotsY.push(e);
      if (survey === k + 1) {
        selX.push(x);
        selY.push(e);
      }
    });
  });
  const series: ChartSeries[] = [
    { id: 'mape', label: { en: 'Held-out MAPE', es: 'MAPE reservado' }, values: rows.map((r, i) => (i < grown ? r.mape : null)), mode: 'points', size: 15, color: '--color-accent' },
    { id: 'surveys', label: { en: 'Error on each held-out survey', es: 'Error en cada muestreo reservado' }, values: dotsY, x: dotsX, mode: 'points', size: 6, color: '--color-fg-subtle' },
  ];
  if (best && rows.indexOf(best) < grown) series.push({ id: 'best', label: { en: 'Recommended', es: 'Recomendado' }, values: [best.mape], x: [rows.indexOf(best) + 1], mode: 'points', size: 22, color: '--color-good' });
  if (selX.length) series.push({ id: 'survey', label: { en: `Survey ${survey}`, es: `Muestreo ${survey}` }, values: selY, x: selX, mode: 'points', size: 10, color: '--color-warn' });
  // the paired gap of the runner-up (or of the selected method) to the recommended one, drawn on the MAPE axis at that method as the
  // recommended MAPE plus the 95 percent interval of the mean paired difference: an interval mark with its numbers in its label
  const gapRow = chosen.id !== best?.id ? chosen : comparison ? (rows.find((r) => r.id === comparison.targets[target].runner_up) ?? null) : null;
  const gap = best && gapRow ? pairedOf(comparison, target, gapRow.id) : null;
  const gx = best && gapRow ? rows.indexOf(gapRow) + 1 - 0.14 : 0;
  const bracketShown = Boolean(best && gapRow && gap && grown === rows.length);
  if (best && gapRow && gap && bracketShown) {
    // the mean of the paired gap, on the MAPE axis beside the selected method's dot; its 95 percent interval is the bracket drawn over
    // the chart (gapBracket) in the same colour of its own (N6)
    const d = (v: number) => num(v, { decimals: 2 });
    series.push({
      id: 'gapmean',
      // one line of the key: the bracket on the chart carries the interval's end values, the GAP callout and the takeaway name the methods
      label: { en: `Mean paired gap, ${d(gap.mean_diff_pts)} points, and its 95% bracket`, es: `Brecha pareada media, ${d(gap.mean_diff_pts)} puntos, y su corchete 95%` },
      values: [best.mape + gap.mean_diff_pts],
      x: [gx],
      mode: 'points',
      size: 11,
      color: GAP_COLOR,
    });
  }
  const yMax = Math.max(...rows.map((r) => r.mape), ...rows.flatMap((r) => r.errors ?? []), ...(best && gap ? [best.mape + gap.ci95[1]] : [])) * 1.08;
  const callouts = compareCallouts(rows, best, chosen, comparison, comparisonReason, target, (v, o) => num(v, o));
  const points: ChartPoint[] = [
    { id: 'best', x: best ? rows.indexOf(best) + 1 : 1, y: best?.mape ?? 0 },
    { id: 'chosen', x: rows.indexOf(chosen) + 1, y: chosen.mape },
    { id: 'gap', x: best && gapRow && gap ? gx : rows.indexOf(chosen) + 1, y: best && gap ? best.mape + gap.mean_diff_pts : chosen.mape },
  ];
  const sure = certaintyText(comparison, comparisonReason, target, (v, o) => num(v, o ?? { digits: 3 }));
  const base = best ? recommendReason(best, rows, target, (v) => num(v, { decimals: MAPE_DECIMALS })) : { en: 'No method is scored for this target.', es: 'Ningún método tiene puntaje para este objetivo.' };
  const reason: Text = best ? { en: `${base.en} ${sure.en}`, es: `${base.es} ${sure.es}` } : base;
  const cbNote: Text | null = cb
    ? null
    : {
        en: `CrusherBayes is not available: ${bare(cbReason?.en ?? 'its document is not in this build')}.`,
        es: `CrusherBayes no está disponible: ${bare(cbReason?.es ?? 'su documento no está en esta versión')}.`,
      };
  const surveys = Array.from({ length: n }, (_, k) => k + 1);
  const measured = loo.loo[target].measured;
  const unit = target === 'tph' ? 't/h' : 'kW';
  const bandSeries: ChartSeries[] = [
    { id: 'measured', label: { en: 'Measured', es: 'Medido' }, values: [...measured], mode: 'points', size: 9, color: '--color-fg' },
    {
      id: 'pred',
      label: { en: `${chosen.name.en}, held out`, es: `${chosen.name.es}, reservado` },
      values: chosen.pred ? [...chosen.pred] : surveys.map(() => null),
      mode: 'points',
      size: 8,
      color: '--color-accent',
    },
  ];
  if (chosen.band) {
    bandSeries.push({ id: 'lo', label: { en: '80 percent band, low', es: 'Banda del 80 por ciento, baja' }, values: chosen.band.lo, color: '--color-accent', dash: [4, 3], width: 1.2 });
    bandSeries.push({ id: 'hi', label: { en: '80 percent band, high', es: 'Banda del 80 por ciento, alta' }, values: chosen.band.hi, color: '--color-accent', dash: [4, 3], width: 1.2 });
  }
  const note: Text = {
    en: `${reason.en} The large dot is a method's mean absolute percent error with every survey held out of its own fit; the small dots are its ten errors.${narrow ? ' The axis numbers the methods; the list above the chart names them, and hovering a method reads its name.' : ''}${cbNote ? ` ${cbNote.en}` : ''}`,
    es: `${reason.es} El punto grande es el error porcentual absoluto medio de un método con cada muestreo fuera de su propio ajuste; los puntos chicos son sus diez errores.${narrow ? ' El eje numera los métodos; la lista sobre el gráfico los nombra, y al pasar sobre un método se lee su nombre.' : ''}${cbNote ? ` ${cbNote.es}` : ''}`,
  };
  // the story's stage states how sure its ranking is (N3, M7): its note opens with the certainty sentence the App's takeaway uses, so the
  // stage's framing is never stronger than its evidence; how to read the dots and why the method is recommended open the docked panel
  const readDots: Text = {
    en: "The large dot is a method's mean absolute percent error with every survey held out of its own fit; the small dots are its ten errors.",
    es: 'El punto grande es el error porcentual absoluto medio de un método con cada muestreo fuera de su propio ajuste; los puntos chicos son sus diez errores.',
  };
  const stageNote: Text = {
    en: `${sure.en}${narrow ? ' The axis numbers the methods; the panel names them.' : ''}`,
    es: `${sure.es}${narrow ? ' El eje numera los métodos; el panel los nombra.' : ''}`,
  };
  const panelNote = (b: Text): Text => ({
    en: `${base.en} ${readDots.en}${cbNote ? ` ${cbNote.en}` : ''} ${b.en}`.trim(),
    es: `${base.es} ${readDots.es}${cbNote ? ` ${cbNote.es}` : ''} ${b.es}`.trim(),
  });
  const targetButtons = (
    <div className="cdem-controls" role="group" aria-label={t('Target of the forecast', 'Objetivo del pronóstico')}>
      <button type="button" className="btn" aria-pressed={target === 'tph'} onClick={() => setTarget('tph')}>
        {t('Throughput (t/h)', 'Capacidad (t/h)')}
      </button>
      <button type="button" className="btn" aria-pressed={target === 'kW'} onClick={() => setTarget('kW')}>
        {t('Power (kW)', 'Potencia (kW)')}
      </button>
    </div>
  );
  const dotPlot = (
    <ChartCallouts
      callouts={callouts}
      points={points}
      frame={{ x: [0.5, rows.length + 0.5], y: [0, yMax] }}
      overlay={best && gap && bracketShown ? (at) => <GapBracket at={at} x={gx} base={best.mape} ci={gap.ci95} fmt={(v) => num(v, { decimals: 2 })} /> : undefined}
    >
      <UPlotChart
        title={{ en: 'Held-out mean absolute percent error by method', es: 'Error porcentual absoluto medio reservado por método' }}
        height="fill"
        x={{ values: xs, label: { en: 'Method', es: 'Método' }, ticks, range: [0.5, rows.length + 0.5] }}
        y={{ label: { en: 'Held-out absolute error', es: 'Error absoluto reservado' }, unit: '%', range: [0, yMax] }}
        series={series}
        readout={(i) => `${i + 1}. ${rows[i].name[lang]}: ${num(rows[i].mape, { decimals: MAPE_DECIMALS })} %`}
      />
    </ChartCallouts>
  );
  // the methods and the surveys as wrapping lists of buttons, the panel side of the linked selection: every name is whole at any width
  // (M8), numbered as the axis numbers them below 640 px
  const pickers = (
    <div className="cdem-pickers">
      <div className="cdem-pick" role="group" aria-label={t('Method', 'Método')}>
        <span className="cdem-pick-label">{t('Method', 'Método')}</span>
        {rows.map((r, i) => (
          <MethodButton key={r.id} row={r} n={i + 1} best={best?.id === r.id} lang={lang} />
        ))}
      </div>
      <div className="cdem-pick" role="group" aria-label={t('Survey', 'Muestreo')}>
        <span className="cdem-pick-label">{t('Survey', 'Muestreo')}</span>
        {surveys.map((k) => (
          <SurveyButton key={k} n={k} current={survey === k} onPick={() => onPickCase(caseOfSurvey(k))} />
        ))}
      </div>
    </div>
  );
  const docked = part === 'panel';
  const perSurvey = (
    <UPlotChart
      title={{ en: `Measured and held-out prediction per survey (${unit})`, es: `Medido y predicción reservada por muestreo (${unit})` }}
      height={docked ? 260 : 'fill'}
      x={{ values: surveys, label: { en: 'Survey', es: 'Muestreo' }, ticks: surveys.map((k) => ({ value: k, label: { en: String(k), es: String(k) } as BiText })), range: [0.5, n + 0.5] }}
      y={{ label: target === 'tph' ? { en: 'Throughput', es: 'Capacidad' } : { en: 'Power', es: 'Potencia' }, unit }}
      series={bandSeries}
      marks={survey ? [{ x: survey, label: { en: 'selected survey', es: 'muestreo seleccionado' } }] : []}
      onPick={(i) => onPickCase(caseOfSurvey(i + 1))}
    />
  );
  const stageAttrs = { 'data-target': target, 'data-recommended': best?.id ?? '', 'data-selected-method': chosen.id, 'data-gap': gap ? String(gap.mean_diff_pts) : '', 'data-narrow': narrow ? 'true' : 'false' };
  if (part === 'stage')
    return (
      <PlotCard fill title={{ en: 'Held-out error of every method, ten surveys', es: 'Error reservado de cada método, diez muestreos' }} lane="replay" provenance="real" dataKey={stateKey} note={stageNote}>
        {/* the target switch is the docked panel's (with the pickers), so the stage gives the dot plot its height (N7) */}
        <div ref={measure} className="cdem-stack" data-caos-flow="" {...stageAttrs}>
          {dotPlot}
        </div>
      </PlotCard>
    );
  if (part === 'panel')
    return (
      <PlotCard title={{ en: 'The selected method on each survey', es: 'El método seleccionado en cada muestreo' }} lane="replay" provenance="real" dataKey={stateKey} note={panelNote(bandNote(chosen, best, (v) => num(v, { digits: 3 })))}>
        <div className="cdem-stack" data-caos-flow="">
          {targetButtons}
          {pickers}
          {perSurvey}
        </div>
      </PlotCard>
    );
  // the App's view opens on the one primary chart (M12): the dot plot takes the card, the per-survey predictions are its second view
  return (
    <PlotCard
      fill
      title={view === 'methods' ? { en: 'Held-out error of every method, ten surveys', es: 'Error reservado de cada método, diez muestreos' } : { en: 'The selected method on each survey', es: 'El método seleccionado en cada muestreo' }}
      lane="replay"
      provenance="real"
      dataKey={stateKey}
      note={view === 'methods' ? note : bandNote(chosen, best, (v) => num(v, { digits: 3 }))}
    >
      <div ref={measure} className="cdem-stack" data-caos-flow="" {...stageAttrs} data-compare-view={view}>
        <div className="cdem-controls">
          {targetButtons}
          <div className="cdem-controls" role="group" aria-label={t('What the chart shows', 'Lo que muestra el gráfico')}>
            <button type="button" className="btn" aria-pressed={view === 'methods'} onClick={() => setView('methods')}>
              {t('Methods compared', 'Métodos comparados')}
            </button>
            <button type="button" className="btn" aria-pressed={view === 'surveys'} onClick={() => setView('surveys')}>
              {t('Each survey', 'Cada muestreo')}
            </button>
          </div>
        </div>
        {pickers}
        {view === 'methods' ? dotPlot : <div className="cdem-fill">{perSurvey}</div>}
      </div>
    </PlotCard>
  );
}

/** The panel's one statement about the predictive bands: the selected method's band when it has one, and, once, when the recommended
 * method's document has none. */
export function bandNote(chosen: MethodRow, best: MethodRow | null, fmt: (v: number) => string): Text {
  const parts: Text[] = [];
  if (chosen.band) {
    parts.push({
      en: `Dashed: the 80 percent predictive band of ${chosen.name.en} (coverage ${fmt(chosen.band.coverage * 100)} percent of the ten surveys).`,
      es: `Segmentada: la banda predictiva del 80 por ciento de ${chosen.name.es} (cobertura ${fmt(chosen.band.coverage * 100)} por ciento de los diez muestreos).`,
    });
  } else if (chosen.id !== best?.id) {
    parts.push({ en: `${chosen.name.en} has no predictive band in its document.`, es: `${chosen.name.es} no tiene banda predictiva en su documento.` });
  }
  if (best && !best.band) parts.push({ en: `The recommended method, ${best.name.en}, has no predictive band in its document.`, es: `El método recomendado, ${best.name.es}, no tiene banda predictiva en su documento.` });
  return { en: parts.map((p) => p.en).join(' '), es: parts.map((p) => p.es).join(' ') };
}

/** The App's view (Validation group, first view): reads both documents through the index. */
export function CompareView() {
  const { index, sel, pickCase } = useView();
  const [target, setTarget] = useState<CompareTarget>('kW');
  const loo = useArtifact<Hp500Loo>((signal) => (index ? loadHp500Loo(index as CaseIndex, signal) : new Promise<Hp500Loo>(() => undefined)), [index]);
  const cb = useArtifact<Hp500CrusherBayes>((signal) => (index ? loadHp500CrusherBayes(index as CaseIndex, signal) : new Promise<Hp500CrusherBayes>(() => undefined)), [index]);
  const cmp = useArtifact<Hp500Comparison>((signal) => (index ? loadHp500Comparison(index as CaseIndex, signal) : new Promise<Hp500Comparison>(() => undefined)), [index]);
  const lang = useShellLang();
  if (loo.state === 'unavailable')
    return (
      <p className="caos-pending" data-state="unavailable">
        {loo.reason[lang]}
      </p>
    );
  if (loo.state === 'error') return <p role="alert">{loo.error}</p>;
  if (loo.state !== 'ready' || cb.state === 'loading' || cmp.state === 'loading')
    return (
      <p className="caos-pending" data-state="loading">
        {lang === 'es' ? 'Cargando la validación' : 'Loading the validation'}
      </p>
    );
  return (
    <CompareBody
      loo={loo.data}
      cb={cb.state === 'ready' ? cb.data : null}
      cbReason={cb.state === 'unavailable' ? cb.reason : cb.state === 'error' ? { en: cb.error, es: cb.error } : null}
      comparison={cmp.state === 'ready' ? cmp.data : null}
      comparisonReason={cmp.state === 'unavailable' ? cmp.reason : cmp.state === 'error' ? { en: cmp.error, es: cmp.error } : null}
      target={target}
      setTarget={setTarget}
      caseId={sel?.data.manifest.case_id}
      onPickCase={pickCase}
    />
  );
}
