// The particle-simulation view (DM-012 to DM-015), rendered as static markup on the provider tree's document and frames: the tab, the three
// callouts with value, unit and state, the stroke cursor shared by the stage's frame label and the per-stroke charts, reduced motion, a run
// that did not complete, the readiness states, and the numbers on the page against the document. The browser half (the canvas, the anchors,
// the stage share, the themes) is measured by the shell's gate on the release build.
import { formatNumber, LinkedViewProvider, runStagedTransition, useLangStore } from '@fasl-work/caos-app-shell';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import type { Loaded } from '../api/artifacts';
import type { DemRun, Readiness } from '../lib/contract.types';
import { toCallout } from './callouts';
import { bareReason, calloutSpecs, windowLabelSide, CATEGORY, ComparisonOverlay, cursorMark, DemBody, DemUnavailable, DemUnreadable, LabNote, StopMark, pointStages, Q, sideOffset, Sources, VerdictTable } from './dem';
import { comparisonSeries, decodeFrames, frameAt, frameLabelText, nearerSentence, openingCursor, plain, sizeClassLabels, type DemFrames, type DemPoint } from './demModel';
import { calloutTargets, CALLOUT_COLUMN, FramesState, GUTTER, NAMES, panelWidth, plateExtremes, drawReplay, GUTTER_PHONE, replayShapes, routeLeaders, stageColumns, stageRects, sphereTop, TRACK_OFFSETS } from './demReplay';
import { axisNoteProblems, chartOverlapProblems, classContrastProblems, contrast, decimalProblems, labelOverlapProblems, labelShapeProblems, leaderPathProblems, leaderProblems, noValueStripProblems, pathConflicts, nullMarkProblems, stageTimesProblems, stageGeometryProblems, stageShare, stageShareProblems, verdictLayoutProblems } from './dem.rules.mjs';
import { subOfUrl, ViewContext, type ViewCtx } from './shared';
import { ValidationGroup } from './validation';

const provider = new URL('../../../docs/contracts/fixtures/data/derived/', import.meta.url);
const run = JSON.parse(readFileSync(new URL('dem/jaw-lab.json', provider), 'utf8')) as DemRun;
// the committed bake's readiness (the particle runs of one point did not complete); the provider tree's own says the row is served by a fixture
const readiness = JSON.parse(readFileSync(new URL('../../../data/derived/readiness.json', import.meta.url), 'utf8')) as Readiness;
type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
const copy = <T,>(v: T): Mutable<T> => JSON.parse(JSON.stringify(v)) as Mutable<T>;
const framesOf = (p: DemPoint): Loaded<DemFrames> => {
  const r = p.simulation.replay!;
  const b = readFileSync(new URL(`dem/${r.file.slice('dem/'.length)}`, provider));
  return { state: 'ready', data: decodeFrames(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, r) };
};
const setLang = (lang: 'en' | 'es') => {
  Object.assign(useLangStore.getInitialState(), { lang });
  useLangStore.setState({ lang });
};
afterEach(() => setLang('en'));
const en = (v: number, d = 3) => formatNumber(v, 'en', { digits: d });

const ctx: ViewCtx = {
  sel: null,
  unavailable: null,
  index: null,
  loo: null,
  target: 12,
  setTarget: () => undefined,
  canApplyCss: false,
  applyCss: () => undefined,
  drift: null,
  setDrift: () => undefined,
  pickCase: () => undefined,
};
const render = (props: Partial<Parameters<typeof DemBody>[0]> = {}, doc: DemRun = run) => {
  const p = doc.points.find((q) => q.id === (props.initialPoint ?? doc.points[0].id)) ?? doc.points[0];
  return renderToStaticMarkup(
    <ViewContext.Provider value={ctx}>
      <DemBody run={doc} readiness={readiness} frames={framesOf(p)} {...props} />
    </ViewContext.Provider>,
  );
};
const textOf = (html: string) => html.replace(/<!-- -->/g, '').replace(/<\/?q[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

describe('the tab', () => {
  it('Particle simulation is a tab of the Validation group, in both languages, and its deep link names it', () => {
    const html = renderToStaticMarkup(
      <ViewContext.Provider value={ctx}>
        <ValidationGroup />
      </ViewContext.Provider>,
    );
    expect(html).toContain('Particle simulation');
    expect(html).toContain('Methods compared');
    setLang('es');
    const es = renderToStaticMarkup(
      <ViewContext.Provider value={ctx}>
        <ValidationGroup />
      </ViewContext.Provider>,
    );
    expect(es).toContain('Simulación de partículas');
    expect(subOfUrl('?case=S01&view=validation&sub=particles', 'validation', ['compare', 'parity', 'particles'])).toBe('particles');
    expect(subOfUrl('?view=chamber&sub=particles', 'validation', ['compare', 'parity', 'particles'])).toBeUndefined();
    const src = readFileSync(new URL('./validation.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/id: 'particles', label: \{ en: 'Particle simulation', es: 'Simulación de partículas' \}/);
  });
});

describe('DM-012: the view with the provider document', () => {
  it('renders the coarsest feed first, the laboratory machine’s note and the three operating points with their run states in words', () => {
    const html = render();
    expect(html).toContain('data-point="63-52"');
    expect(html).toContain('data-lab-note');
    const text = textOf(html);
    expect(text).toContain('a machine of published tests, not the machine of the case selected in the workbench');
    expect(text).toContain('63/52 mm: complete');
    expect(text).toContain('31.5/26.5 mm: stopped');
    expect(text).toContain('16/13.2 mm: complete');
    expect((html.match(/data-point-choice/g) ?? []).length).toBe(1);
    expect(html).toContain('data-frames="ready"');
  });
  it('is complete in Spanish: the note, the point choice, the controls and the verdict words', () => {
    setLang('es');
    const text = textOf(render());
    expect(text).toContain('no la máquina del caso elegido en el panel');
    expect(text).toContain('63/52 mm: completa');
    expect(text).toContain('31,5/26,5 mm: detenida');
    expect(text).toContain('Reproducir');
    expect(text).toContain('Veredictos');
    expect(text).toContain('No cumple');
    expect(text).toContain('Sin comparar');
    expect(text).not.toMatch(/\bNot met\b/);
  });
  it('three callouts with value, unit and state, read from the document', () => {
    for (const p of run.points) {
      const specs = calloutSpecs(p, plain);
      expect(specs.map((s) => s.id)).toEqual(['throughput', 'net_power', 'p80']);
      for (const s of specs) {
        if (s.value !== null) expect(s.unit.en.length).toBeGreaterThan(0);
        else expect(s.unit.en).toBe('');
        expect(['normal', 'warning', 'alarm', 'inactive']).toContain(s.state);
        expect(s.source.en).toContain(s.id === 'p80' && p.simulation.status !== 'complete' ? 'passed before the stop' : 'Measured');
      }
    }
    const coarse = calloutSpecs(run.points[0], plain);
    expect(coarse[0].value).toBe(String(Number(run.points[0].simulation.throughput_kg_h!.toPrecision(3))));
    expect(coarse[0].state).toBe('alarm');
    expect(coarse[1].state).toBe('normal');
    // the shell's callout carries value, unit, state and source for each; a missing value says not available with its reason
    const card = toCallout(calloutSpecs(run.points[1], plain)[0], { x: 0.5, y: 0.5 }, 'en');
    expect(card.value).toBe('not available');
    expect(card.state).toBe('inactive');
    expect((card.source as { en: string }).en).toContain('run incomplete');
    const shown = toCallout(coarse[1], { x: 0.4, y: 0.8 }, 'es');
    expect(shown.value).toBe(coarse[1].value);
    expect((shown.unit as { es: string }).es).toBe('kW');
  });
  it('adversarial: a value or a verdict changed in a copy of the document moves the callout', () => {
    const d = copy(run);
    d.points[0].simulation.net_power_kw = 0.987;
    d.points[0].verdicts.simulation_vs_measured.net_power.verdict = 'not met';
    const specs = calloutSpecs(d.points[0], plain);
    expect(specs[1].value).toBe('0.987');
    expect(specs[1].state).toBe('alarm');
    expect(specs[1].source.en).toContain('Not met');
  });
  it('the takeaway line is the document’s numbers in the problem’s terms', () => {
    const text = textOf(render());
    expect(text).toContain(`At the 63/52 mm feed the particle simulation passes ${en(run.points[0].simulation.throughput_kg_h!)} kg/h against ${en(run.points[0].measured.throughput_kg_h.value)} measured`);
  });
});

describe('DM-013: one stroke cursor for the stage and the charts, and reduced motion', () => {
  it('adversarial: the frame label, the slider and both charts marker follow a planted cursor, for any cursor', () => {
    for (const cursor of [37, 40.5, 70.25, 83]) {
      const html = render({ initialCursor: cursor });
      const p = run.points[0];
      const r = p.simulation.replay!;
      const label = frameLabelText(r, frameAt(r, cursor), (v, o) => formatNumber(v, 'en', o), 'en');
      expect(textOf(html)).toContain(label);
      expect(html).toContain(`data-cursor-stroke="${cursor}"`);
      expect(html).toContain(`data-linked-cursor-position="${cursor}"`);
      expect(html).toContain(`data-frame="${frameAt(r, cursor)}"`);
    }
  });
  it('a cursor chosen on a chart is the stage’s cursor: the page writes both from the one linked-view store of the view', () => {
    const src = readFileSync(new URL('./dem.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/useLinkedCursor\(\)/);
    expect(src).toContain('onPick={(stroke) => scrub(cursorOfStrokeIndex(');
    expect(src).toMatch(/onPick=\{pick\}/);
    expect(src).toMatch(/marks=\{marks\}/);
    expect(cursorMark(37.5).x).toBe(37.5);
    const rep = readFileSync(new URL('./demReplay.tsx', import.meta.url), 'utf8');
    expect(rep).toMatch(/useLinkedCursor\(\)/);
    expect(rep).toMatch(/scrub\(next\.cursor\)/);
  });
  it('the view opens at the first stroke of the steady window, and playback never starts by itself', () => {
    const html = render();
    expect(html).toContain(`data-cursor-stroke="${openingCursor(run.points[0])}"`);
    expect(html).toContain('data-playing="false"');
    expect(html).toContain('data-autoplay="false"');
    const src = readFileSync(new URL('./demReplay.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/autoStart: false/);
    expect(src).not.toMatch(/autoStart: true/);
    expect(src).not.toMatch(/request\w*Frame/);
  });
  it('adversarial: under reduced motion the play button is off, the note says so and the frame at the cursor is shown', () => {
    const html = render({ reducedMotion: true, initialCursor: 40.5 });
    expect(html).toContain('data-reduced-motion="true"');
    expect(html).toContain('data-playing="false"');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Play<\/button>/);
    expect(textOf(html)).toContain('Reduced motion is on: the replay does not play; step with the slider or the arrow keys.');
    expect(html).toContain('data-cursor-stroke="40.5"');
    expect(textOf(html)).toContain('stroke 41, t = ');
    const normal = render({ reducedMotion: false });
    expect(normal).toContain('data-reduced-motion="false"');
    expect(normal).not.toMatch(/<button[^>]*disabled[^>]*>Play<\/button>/);
    expect(textOf(normal)).not.toContain('Reduced motion:');
  });
});

describe('DM-012: a point whose run did not complete', () => {
  const html = render({ initialPoint: '31.5-26.5' });
  const text = textOf(html);
  it('says at which stroke and why it stopped, with the spheres held and the mass passed, and shows no window statistic', () => {
    expect(html).toContain('data-point="31.5-26.5"');
    expect(text).toContain('The run did not complete');
    expect(text).toContain('during stroke 6');
    expect(text).toContain('overlap');
    expect(text).toContain('327 spheres held');
    expect(html).toContain('data-run-status="overlap_error"');
    expect(html).toContain('data-window=""');
    expect(html).not.toContain('data-window-band');
    expect(text).not.toContain('window mean');
    expect(text).toContain('it has no steady window, so it states no throughput, power or reduction ratio to set against the measurement');
  });
  it('its callouts state no throughput or power, and its verdict table says not compared with the basis, never a number or an agreement', () => {
    const specs = calloutSpecs(run.points[1], plain);
    expect(specs[0].value).toBeNull();
    expect(specs[1].value).toBeNull();
    expect(text).toContain('Not compared');
    expect(text).toContain('the particle run did not complete (it stopped during stroke 6), so it has no steady window');
    expect(text).toContain('no value');
    expect(text).not.toMatch(/agree|agreement/i);
  });
  it('its product distribution is named as the product of the mass passed before the stop', () => {
    expect(text).toContain('The particle run did not complete: its curve is the product of the mass passed before the stop.');
  });
  it('in Spanish the stop and its stroke are said in the reader’s words', () => {
    setLang('es');
    const es = textOf(render({ initialPoint: '31.5-26.5' }));
    expect(es).toContain('La corrida no se completó');
    expect(es).toContain('durante el golpe 6');
  });
});

describe('DM-014: the comparison, the distribution, the verdicts and the sources on the page', () => {
  const html = render();
  const text = textOf(html);
  it('three comparison charts of the three points, each with the sentence of every point', () => {
    for (const q of ['throughput', 'net_power', 'p80'] as const) {
      expect(html).toContain(`data-comparison="${q}"`);
      run.points.forEach((_, i) => expect(text).toContain(nearerSentence(run, i, q, (v, o) => formatNumber(v, 'en', o)).en));
    }
    expect(text).toContain('Shaded: the measurement plus or minus the 10 percent band.');
    expect(text).toContain('a sensitivity band and not a confidence interval');
    expect(text).toContain('No value (the line under the chart):');
  });
  it('a side that states no value is named with its reason, and no sentence of any chart reads as agreement for a verdict that is not met', () => {
    expect(text).toContain('population balance, 63/52 mm: no work index of the ore is published, so the population balance states no net power');
    const bad = copy(run);
    for (const p of bad.points) for (const pair of ['simulation_vs_measured', 'population_balance_vs_measured'] as const) for (const q of ['throughput', 'net_power', 'reduction_ratio'] as const) p.verdicts[pair][q].verdict = 'not met';
    const page = render({}, bad as DemRun);
    const sentences = [...page.matchAll(/<ul class="cdem-sentences"[^>]*>(.*?)<\/ul>/gs)].map((m) => textOf(m[1])).join(' ');
    expect(sentences.length).toBeGreaterThan(500);
    expect(sentences).not.toMatch(/(?<!not )within the band/);
    expect(sentences).not.toMatch(/agree|agreement/i);
    expect(sentences).toContain('not within the band');
  });
  it('the verdict table has the nine rows of the chosen point with the words, the marks and the bands of the document', () => {
    expect((html.match(/data-pair=/g) ?? []).length).toBeGreaterThanOrEqual(9);
    expect(html).toContain('data-verdict-table="63-52"');
    expect(text).toContain('Particle simulation against measurement');
    expect(text).toContain('Population balance against particle simulation');
    expect(text).toContain('Met');
    expect(text).toContain('Not met');
    expect(text).toContain('±10 %');
    expect(text).toContain('A verdict that is met is within the band; one that is not met or not compared is outside it or not judged.');
    expect(text).toContain('Of the 27 verdicts of the document, 3 met (1 of them not resolved by the package\u2019s rule), 13 not met and 11 not compared.');
    expect(html).toMatch(/data-verdict="not-met"/);
    expect(html).toMatch(/data-verdict="not-compared"/);
  });
  it('the sources: each measured value’s figure and page, the package and its version, the seed, and the bands with when they were set', () => {
    const p = run.points[0];
    expect(text).toContain(p.measured.throughput_kg_h.source);
    expect(text).toContain(p.measured.net_power_kw.source);
    expect(text).toContain(p.measured.product_source);
    expect(text).toContain(`${run.package.name} ${run.package.version} (${run.package.backend}); seed ${run.seed}`);
    expect(text).toContain(run.bands.set);
    expect(text).toContain(run.source.doi);
  });
  it('every number on the page follows the document: a value changed in a copy changes the table and the sentences', () => {
    const d = copy(run);
    d.points[0].verdicts.simulation_vs_measured.throughput.first = 1234;
    d.points[0].verdicts.population_balance_vs_measured.reduction_ratio.relative_error = 0.4321;
    const t = textOf(render({}, d as DemRun));
    expect(t).toContain('1,234.0 kg/h');
    expect(t).toContain('+43.2 %');
    expect(text).not.toContain('+43.2 %');
  });
  it('the sides of a point are drawn a little apart on the size axis, simulation to the left, population balance to the right', () => {
    expect(sideOffset('simulation', 2)).toBe(-2);
    expect(sideOffset('population_balance', 2)).toBe(2);
    expect(sideOffset('measurement', 2)).toBe(0);
  });
});

describe('a Spanish page writes no decimal point in the sources', () => {
  it('the sources block holds no digit.digit outside a DOI or a version', () => {
    setLang('es');
    const html = render();
    // the document and the package own English words are quoted blocks (translate=no): everything outside them is the page own text
    const outside = html.replace(/<q [^>]*translate="no"[^>]*>.*?<\/q>/gs, "");
    const block = outside.slice(outside.indexOf("data-sources"));
    const text = textOf(block.slice(0, block.indexOf("</dl>"))).replace(/10\.3390\/\S+/g, "");
    // a version or a section number with two dots is not a decimal (the gate reads it the same way)
    expect((text.match(/\S*\d\.\d\S*/g) ?? []).filter((tok) => !/\d\.\d+\.\d/.test(tok))).toEqual([]);
  });
});

describe('the paper’s own simulation, the scope of the verdicts and the spread wording', () => {
  it('the sources state the paper’s own simulation at the point that has it, with both sources and both differences in numbers, and no agreement', () => {
    const text = textOf(render());
    expect(text).toContain('The paper’s own simulation');
    expect(text).toContain('net power 0.32 kW (text, section 3.2, p. 10), 5.88 percent below the measured value');
    expect(text).toContain('throughput 890 kW'.replace('kW', 'kg/h') + ' (Fig. 14a dashed curve at 57 mm read by eye, not digitised (about 880 to 890), p. 12), 11.4 percent above the measured value');
    expect(text).toContain('Magenta mark: the paper’s own simulation, as context only; no verdict rests on it.');
  });
  it('the verdict table’s note says the verdicts are about the particle simulation of the package, not about the published study', () => {
    expect(textOf(render())).toContain('The verdicts of this view are about the particle simulation as the package crushdem implements it, not about the published study, whose own simulation is the mark described in the comparison charts.');
    setLang('es');
    expect(textOf(render())).toContain('no al estudio publicado');
  });
  it('a point without it says nothing: no row in its sources', () => {
    for (const id of ['31.5-26.5', '16-13.2']) {
      const html = render({ initialPoint: id });
      const sources = html.slice(html.indexOf('data-sources'));
      expect(sources.slice(0, sources.indexOf('</dl>'))).not.toContain('own simulation');
    }
  });
  it('a document with none anywhere draws no mark note, no sources row and no scope sentence', () => {
    const none = copy(run);
    for (const p of none.points) p.paper_simulation = null;
    const text = textOf(render({}, none as DemRun));
    expect(text).not.toContain('own simulation');
    expect(text).not.toContain('Magenta mark');
    expect(text).not.toContain('published study');
  });
  it('on a Spanish page the paper’s sources write their numbers with a comma, and its legend entry is Spanish', () => {
    setLang('es');
    const html = render();
    const text = textOf(html);
    expect(text).toContain('La simulación propia del artículo');
    expect(text).toContain('potencia neta 0,32 kW (text, section 3.2, p. 10), 5,88 por ciento por debajo del valor medido');
    const src = readFileSync(new URL('./dem.tsx', import.meta.url), 'utf8');
    expect(src).toContain("es: 'La simulación propia del artículo' }");
  });
  it('the spread of the population balance is named as the ranges King gives for cone crushers, never published ranges of a jaw', () => {
    const text = textOf(render());
    expect(text).toContain('the spread over the ranges King gives for cone crushers');
    expect(text).not.toMatch(/published ranges|published parameter ranges/i);
    setLang('es');
    const es = textOf(render());
    expect(es).toContain('la dispersión sobre los rangos que King da para chancadoras de cono');
    expect(es).not.toMatch(/rangos publicados/i);
  });
  it('the stage carries a magnified inset, framed and labelled, with its own scale bar, that is left out when the stage is too short', () => {
    const src = readFileSync(new URL('./demReplay.tsx', import.meta.url), 'utf8');
    expect(src).toContain('Magnified ${num(mag');
    expect(src).toMatch(/data-scale-bar/);
    expect(src).toContain('showInset = rect.inset.h - insetHead(rect.inset.w) >= INSET_MIN_PX');
    expect(src).toMatch(/inset && 'dem-inset'|'dem-inset'/);
    expect(src).toMatch(/data-label-leaders/);
  });
});

describe('DM-015: the states of the row', () => {
  it('partial: the reason is shown in the reader’s language and what the document holds is drawn', () => {
    const html = render({ readiness });
    expect(textOf(html)).toContain('Partial build: 1 of 3 particle runs did not complete.');
    expect(html).toContain('data-readiness="partial"');
    expect(html).toContain('data-frames="ready"');
    setLang('es');
    const es = textOf(render({ readiness }));
    expect(es).toContain('Versión parcial:');
    expect(es).toContain('1 de 3');
  });
  it('adversarial: a stale bake says so with its reason, and nothing the document does not hold is drawn', () => {
    const doc = copy(readiness);
    const row = doc.contracts.find((c) => c.id === 'dem-run')!;
    row.state = 'stale';
    row.reason = { en: 'the document was baked by an older version.', es: 'el documento lo generó una versión anterior.' };
    const html = render({ readiness: doc as Readiness });
    expect(html).toContain('data-readiness="stale"');
    expect(textOf(html)).toContain('Stale bake: the document was baked by an older version.');
    expect(html).toContain('data-point="63-52"');
  });
  it('available: no note; unknown: the readiness is said unknown, never a silent view', () => {
    const doc = copy(readiness);
    doc.contracts.find((c) => c.id === 'dem-run')!.state = 'available';
    expect(render({ readiness: doc as Readiness })).not.toContain('data-readiness=');
    expect(render({ readiness: null })).toContain('data-readiness="unknown"');
    expect(render({ readiness: undefined })).not.toContain('data-readiness=');
  });
  it('adversarial: a document that is missing says why in both languages and draws nothing', () => {
    const reason = { en: 'the bake was not run for this build.', es: 'no se ejecutó la generación para esta versión.' };
    const en1 = renderToStaticMarkup(<DemUnavailable reason={reason} />);
    expect(en1).toContain('data-state="unavailable"');
    expect(textOf(en1)).toContain('The particle simulation of the laboratory jaw crusher is not available yet: the bake was not run for this build.');
    expect(en1).not.toContain('data-chart');
    setLang('es');
    expect(textOf(renderToStaticMarkup(<DemUnavailable reason={reason} />))).toContain('aún no está disponible: no se ejecutó la generación para esta versión.');
  });
  it('adversarial: a replay file that failed is said in the stage place, with its reason', () => {
    expect(renderToStaticMarkup(<FramesState frames={{ state: 'loading' }} />)).toContain('Loading the particle replay');
    expect(renderToStaticMarkup(<FramesState frames={{ state: 'unavailable', reason: { en: 'the index does not declare it', es: 'el índice no lo declara' } }} />)).toContain('the index does not declare it');
    const failed = renderToStaticMarkup(<FramesState frames={{ state: 'error', error: 'dem/x.bin: 12 bytes, the document names 99' }} />);
    expect(failed).toContain('role="alert"');
    expect(failed).toContain('the document names 99');
    const html = render({ frames: { state: 'error', error: 'boom' } });
    expect(html).not.toContain('data-frames="ready"');
    expect(textOf(html)).toContain('The particle replay could not be read: boom');
  });
  it('the lab note names the machine from the document', () => {
    expect(textOf(renderToStaticMarkup(<LabNote run={run} />))).toContain('This view shows the laboratory jaw crusher of Barrios et al. 2020 (gape 90 mm');
    setLang('es');
    expect(textOf(renderToStaticMarkup(<LabNote run={run} />))).toContain('Esta vista muestra la chancadora de mandíbula de laboratorio de Barrios et al. 2020 (boca 90 mm');
  });
});

describe('the stage: colours, labels and the drawing of a frame', () => {
  it('the section is drawn far to near along y, one circle per sphere of the frame, the plate over the spheres', () => {
    const p = run.points[0];
    const r = p.simulation.replay!;
    const frames = (framesOf(p) as { data: DemFrames }).data;
    const i = frameAt(r, 37);
    const calls: string[] = [];
    let arcs = 0;
    const ctx2d = new Proxy({} as Record<string, unknown>, {
      get: (t, k: string) => (k in t ? t[k] : (..._a: unknown[]) => {
        calls.push(k);
        if (k === 'arc') arcs++;
      }),
      set: (t, k: string, v) => {
        t[k] = v;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    const order = drawReplay(
      ctx2d,
      {
        tf: { scale: 0.5, bounds: { xMin: -60, xMax: 120, zMin: -70, zMax: 540 }, px: (x, z) => ({ x: (x + 60) * 0.5, y: (540 - z) * 0.5 }) },
        geometry: r.geometry,
        plate: { x: r.plate_bottom_x_mm[i], z: r.plate_bottom_z_mm[i] },
        ...plateExtremes(r),
        frames,
        frame: i,
        feedLowMm: p.feed_mm[0],
        palette: ['#1', '#2', '#3', '#4', '#5', '#6'],
        colors: { fg: '#000', subtle: '#111', faint: '#222', accent: '#333', surface: '#444', border: '#555' },
      },
      { width: 200, height: 320 },
    );
    expect(order).toHaveLength(r.count[i]);
    expect(arcs).toBe(r.count[i] + 1);
    const base = frames.offsets[i];
    const ys = order.map((k) => frames.data[(base + k) * 4 + 1]);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(calls.indexOf('clearRect')).toBe(0);
  });
  it('the closed and open positions are the extremes of the plate’s bottom edge, at the document’s settings', () => {
    const e = plateExtremes(run.points[0].simulation.replay!);
    expect(e.closed.x).toBeCloseTo(run.settings.css_mm, 6);
    expect(e.open.x).toBeCloseTo(run.settings.oss_mm, 6);
  });
  it('the size panel takes a third of the stage, never less than 130 px nor more than 230', () => {
    expect(panelWidth(300)).toBe(130);
    expect(panelWidth(600)).toBe(216);
    expect(panelWidth(1200)).toBe(230);
    expect(NAMES.en.fixed).toBe('fixed plate');
    expect(NAMES.es.swing).toBe('placa móvil');
  });
  it('the stage’s canvas follows the container’s size and the pixel ratio, and the loop stops on unmount and a hidden tab (the shell’s hook)', () => {
    const src = readFileSync(new URL('./demReplay.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/devicePixelRatio/);
    expect(src).toMatch(/usePausedViz/);
    expect(src).toMatch(/SceneCallouts/);
    expect(src).not.toMatch(/setInterval|request\w*Frame/);
    expect(src).toMatch(/placement="header"/);
  });
});

describe('the whole view stays inside the scope of the document', () => {
  it('without a linked-view provider of its own, the view still scopes its cursor to itself (a provider per operating point)', () => {
    const src = readFileSync(new URL('./dem.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/<LinkedViewProvider key=\{point\.id\}/);
    expect(typeof LinkedViewProvider).toBe('function');
  });
});

// ----------------------------------------------------------------------------------------------------------------------------------
// The fix round after the independent visual review (B1 to B3, M1 to M5, m1 to m16).
// ----------------------------------------------------------------------------------------------------------------------------------
const css = readFileSync(new URL('../workbench/workbench.css', import.meta.url), 'utf8');
const lightness = (hex: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return 116 * (y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116) - 16;
};
const ramp = (block: RegExp): string[] => {
  const body = css.match(block)![1];
  return [...body.matchAll(/--cdem-size-\d: (#[0-9a-f]{6});/g)].map((m) => m[1]);
};

describe('B1: the verdict table keeps its summary and its verdict in view', () => {
  const html = render();
  const table = html.slice(html.indexOf('data-verdict-table'));
  it('the summary is a paragraph outside the table and its scroller, with the count of verdicts not resolved by the package\u2019s rule', () => {
    const summary = table.slice(table.indexOf('<p class="cdem-vt-summary"'), table.indexOf('</p>', table.indexOf('<p class="cdem-vt-summary"')));
    expect(summary).toContain('3 met (1 of them not resolved by the package');
    expect(table.indexOf('cdem-vt-summary')).toBeLessThan(table.indexOf('class="cdem-tablewrap"'));
    expect(table).not.toContain('<caption');
  });
  it('the Verdict column comes right after the quantity, and the basis is a line inside the verdict cell, not a column', () => {
    const heads = [...table.slice(0, table.indexOf('</thead>')).matchAll(/<th>(.*?)<\/th>/g)].map((m) => m[1]);
    expect(heads.slice(0, 3)).toEqual(['Comparison', 'Quantity', 'Verdict']);
    expect(heads).not.toContain('Basis');
    const stopped = render({ initialPoint: '31.5-26.5' });
    const cell = stopped.slice(stopped.indexOf('cdem-vt-verdict'));
    expect(cell.slice(0, cell.indexOf('</td>'))).toContain('class="cdem-basis"');
  });
  it('every cell carries its label for the restacked table, and the stylesheet stacks it below 900 px instead of scrolling', () => {
    expect(table).toContain('data-label="Verdict"');
    expect(css).toMatch(/\.cdem-vt td::before \{\s*content: attr\(data-label\)/);
    expect(css).toMatch(/\.cdem-vt tr,\s*\.cdem-vt th,\s*\.cdem-vt td \{\s*display: block;/);
  });
  it('the verdict card is a row of its own, full width', () => {
    const src = readFileSync(new URL('./dem.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/<DistributionCard run=\{run\} point=\{point\} \/>\s*<VerdictCard run=\{run\} point=\{point\} \/>/);
    expect(src).not.toMatch(/<ViewsRow shares=\{\[1, 1\]\}>\s*<DistributionCard/);
  });
});

describe('B2: a side with no value has no mark inside the plotting range', () => {
  const at = (p: { x: number; y: number }) => ({ x: 60 + p.x * 100, y: 300 - p.y * 0.2 });
  const overlay = (q: 'throughput' | 'net_power' | 'p80') => renderToStaticMarkup(<svg><ComparisonOverlay series={comparisonSeries(run, q)} at={at} /></svg>);
  it('adversarial: a side with no value yields no mark inside the plotting range of the rendered overlay: the overlay draws nothing for it, no mark and no text of its own', () => {
    for (const q of ['throughput', 'net_power', 'p80'] as const) {
      const svg = overlay(q);
      expect(svg).not.toContain('data-no-value');
      expect(svg).not.toContain('<circle');
      expect(svg).not.toContain('<text');
    }
    // the bands and bars of the sides that do state a value are still drawn
    expect((overlay('throughput').match(/data-measurement-band=/g) ?? []).length).toBe(3);
  });
  it('the sides with no value are said in words on a line of their own under the axis title (which stays Feed class), in both languages, and the key has no entry for them', () => {
    const src = readFileSync(new URL('./dem.tsx', import.meta.url), 'utf8');
    expect(src).toContain("label: { en: 'Feed class', es: 'Clase de alimentación' }");
    expect(src).toContain('data-axis-note');
    expect(src).not.toContain("id: 'no-value'");
    expect(src).not.toContain('NoValueStrip');
    expect(textOf(render())).toContain('population balance, 63/52 mm: no work index of the ore is published');
    expect(textOf(render())).toContain('No value (the line under the chart):');
  });
  it('a side with a value keeps its bars: the measurement band, the standard error and the spread are drawn at the feed class position', () => {
    const svg = overlay('throughput');
    expect(svg).toContain('<line');
    const x = (id: string) => Number(svg.match(new RegExp(`data-measurement-band="${id}" x="([\\d.]+)"`))![1]);
    expect(x('63-52')).toBeLessThan(x('31.5-26.5'));
    expect(x('31.5-26.5')).toBeLessThan(x('16-13.2'));
  });
});

describe('B3: the three feed classes are equally spaced categories labelled with their class', () => {
  it('the positions are 1, 2 and 3 with the sides a fixed step apart, so no two labels can meet', () => {
    const src = readFileSync(new URL('./dem.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/const pts = series\.points\.map\(\(p, i\) => \(\{ \.\.\.p, c: i \+ 1 \}\)\)/);
    expect(src).toContain('ticks = pts.map((p) => ({ value: p.c, label:');
    expect(src).toMatch(/xRange: \[number, number\] = \[0\.45, 3\.55\]/);
    expect(CATEGORY.dx * 2).toBeLessThan(CATEGORY.half * 2);
    expect(sideOffset('simulation', CATEGORY.dx)).toBeCloseTo(-0.17, 9);
  });
});

describe('M2: the Spanish page', () => {
  it('feed classes go through the formatter wherever they are written, and the page\u2019s own text holds no decimal point', () => {
    setLang('es');
    const html = render({ initialPoint: '31.5-26.5' });
    const text = textOf(html);
    expect(text).toContain('31,5/26,5 mm: detenida');
    expect(text).toContain('Con 31,5/26,5 mm');
    expect(text).toContain('Veredictos del punto de 31,5/26,5 mm');
    const outside = html.replace(/<q [^>]*translate="no"[^>]*>.*?<\/q>/gs, '').replace(/<[^>]+>/g, ' ').replace(/<!-- -->/g, '');
    expect((outside.match(/\S*\d\.\d\S*/g) ?? []).filter((tok) => !/\d\.\d+\.\d/.test(tok) && !tok.includes('/min'))).toEqual([]);
  });
  it('the package\u2019s message and the document\u2019s words are quoted blocks marked as English, verbatim', () => {
    setLang('es');
    const html = render({ initialPoint: '31.5-26.5' });
    expect(html).toContain('translate="no" lang="en"');
    expect(html).toMatch(/Mensaje del paquete, en inglés: <q[^>]*translate="no"[^>]*>overlap of 0\.547 of the smaller radius at sphere 621 exceeds the limit 0\.500/);
    const sources = render();
    expect(sources).toContain(`<q class="cdem-quote" translate="no" lang="en">${run.points[0].measured.throughput_kg_h.source}</q>`);
    expect(sources).toContain(`<q class="cdem-quote" translate="no" lang="en">${run.source.license}</q>`);
    expect(renderToStaticMarkup(<Q>3.2</Q>)).toContain('lang="en"');
  });
  it('the machine is named in Spanish with its article in the lab note, and the English note has its article too (m13)', () => {
    setLang('es');
    expect(textOf(render())).toContain('Esta vista muestra la chancadora de mandíbula de laboratorio de Barrios et al. 2020');
  });
  it('no localiser touches a licence name, a section or an equation number (there is none)', () => {
    const src = readFileSync(new URL('./demModel.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/localizeNumbers/);
  });
});

describe('M3: colour by meaning', () => {
  it('the size scale is a set of data tokens of the view, ordered in lightness in both themes, and the series of the masses are neutral', () => {
    const dark = ramp(/:root,\s*\[data-theme='dark'\] \{\s*(--cdem-size-0[^}]*)\}/);
    const light = ramp(/\[data-theme='light'\] \{\s*(--cdem-size-0[^}]*)\}/);
    expect(dark).toHaveLength(6);
    expect(light).toHaveLength(6);
    const ld = dark.map(lightness);
    const ll = light.map(lightness);
    for (let i = 1; i < 6; i++) {
      expect(ld[i]).toBeGreaterThan(ld[i - 1] + 5);
      expect(ll[i]).toBeLessThan(ll[i - 1] - 5);
    }
    const src = readFileSync(new URL('./dem.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/id: 'passed'.*color: '--color-fg'/);
    expect(src).toMatch(/id: 'held'.*color: '--color-fg-subtle'/);
    expect(src).not.toMatch(/color: '--color-(good|warn|bad)'/);
    const rep = readFileSync(new URL('./demReplay.tsx', import.meta.url), 'utf8');
    expect(rep).toContain('SIZE_TOKENS.map((t) => resolveToken(t');
    expect(rep).not.toMatch(/--color-step/);
  });
});

describe('M1: the stage', () => {
  it('is the full row, with the replay stage ahead of the series, which dock below it', () => {
    const src = readFileSync(new URL('./dem.tsx', import.meta.url), 'utf8');
    expect(src.indexOf('<MainRow')).toBeLessThan(src.indexOf('<SeriesCard'));
    expect(src).not.toMatch(/<ViewsRow shares=\{\[3, 2\]\}>/);
  });
  it('the section is cropped to the highest sphere of the replay, the zone is magnified beside it, and a phone stacks the zone under the panel', () => {
    const p = run.points[0];
    const f = (framesOf(p) as { data: DemFrames }).data;
    const top = sphereTop(f);
    expect(top).toBeGreaterThan(300);
    expect(top).toBeLessThan(p.simulation.replay!.geometry.fixed_plate_z_mm[1]);
    const wide = stageColumns(1000, 380);
    expect(wide.wide).toBe(true);
    expect(wide.main + wide.inset + wide.panel + 12).toBe(1000);
    expect(wide.inset).toBeGreaterThanOrEqual(200);
    const narrow = stageColumns(340, 400);
    expect(narrow.wide).toBe(false);
    expect(narrow.panel + narrow.inset + 8).toBe(340);
  });
});

describe('M5: a change of operating point is a staged transition, instant under reduced motion', () => {
  it('has three stages, the stage, the series and the rest, each of 200 to 500 ms but the last', async () => {
    const seen: number[] = [];
    const stages = pointStages((n) => seen.push(n));
    expect(stages).toHaveLength(3);
    for (const s of stages.slice(0, 2)) expect(s.durationMs!).toBeGreaterThanOrEqual(200);
    for (const s of stages.slice(0, 2)) expect(s.durationMs!).toBeLessThanOrEqual(500);
    const t0 = Date.now();
    await runStagedTransition(stages, { reducedMotion: true });
    expect(seen).toEqual([1, 2, 3]);
    expect(Date.now() - t0).toBeLessThan(150);
  });
  it('the view runs it on a change of point and passes the reduced-motion preference', () => {
    const src = readFileSync(new URL('./dem.tsx', import.meta.url), 'utf8');
    expect(src).toContain('runStagedTransition(pointStages(setStep), { reducedMotion: reducedMotion ?? prefersReducedMotion()');
    expect(src).toMatch(/setStep\(0\);\s*setPointId\(id\)/);
    expect(css).toMatch(/\.cdem-reveal\[data-on='false'\] \{\s*opacity: 0;/);
  });
});

describe('M4, m9 and the small findings', () => {
  it('states under the controls how many frames per stroke the point stores', () => {
    expect(textOf(render())).toContain('This replay stores 12 frames per stroke; the spheres are shown as stored and the plate is interpolated between them.');
    expect(textOf(render({ initialPoint: '16-13.2' }))).toContain('stores 4 frames per stroke');
  });
  it('m9: under reduced motion Play is disabled and the reason is said beside it in both languages', () => {
    expect(textOf(render({ reducedMotion: true }))).toContain('Reduced motion is on: the replay does not play; step with the slider or the arrow keys.');
    setLang('es');
    expect(textOf(render({ reducedMotion: true }))).toContain('Movimiento reducido activo: la repetición no se reproduce; avance con el control deslizante o las flechas.');
  });
  it('m7: the status line of a complete run says how many window strokes ran above the reference overlap', () => {
    expect(textOf(render())).toContain('18 of the 29 strokes of the steady window ran above the reference overlap of 0.3.');
  });
  it('m10: the missing state reads once and without a path, and a document that cannot be read is one sentence with the cause quoted', () => {
    const reason = { en: 'dem/jaw-lab.json is not available yet: the bake was not run.', es: 'dem/jaw-lab.json aún no está disponible: no se ejecutó la generación.' };
    expect(bareReason(reason, 'en')).toBe('the bake was not run.');
    expect(bareReason(reason, 'es')).toBe('no se ejecutó la generación.');
    const text = textOf(renderToStaticMarkup(<DemUnavailable reason={reason} />));
    expect(text).toContain('is not available yet: the bake was not run.');
    expect(text).not.toContain('dem/jaw-lab.json');
    const failed = textOf(renderToStaticMarkup(<DemUnreadable error="Error: dem/jaw-lab.json: HTTP 404" />));
    expect(failed).toContain('could not be read from this build. Cause: dem/jaw-lab.json: HTTP 404');
    expect(failed).not.toContain('Error:');
  });
  it('m15 and m16, R8, R10: the stop is a mark of its own (dashed, alarm colour, label on its own line) and the charts say what a touch does', () => {
    const src = readFileSync(new URL('./dem.tsx', import.meta.url), 'utf8');
    expect(src).toContain("label={lang === 'es' ? 'corrida detenida' : 'run stopped'}");
    expect(src).toContain('hint={SERIES_HINT}');
    expect(src.match(/hint=\{READ_HINT\}/g)?.length).toBe(2);
    expect(src).toContain('Choose a stroke on the chart to move the replay');
    expect(src).toContain('Hover or touch a point to read its values');
    expect(src).not.toContain('Hover the chart to read the values');
  });
  it('the stop mark stands on a line of its own, away from the cursor label, in the alarm colour with a dash', () => {
    const at = (p: { x: number; y: number }) => ({ x: 20 + p.x * 40, y: 200 - p.y });
    const html = renderToStaticMarkup(<svg><StopMark at={at} x={6} xMax={12} yTop={100} yBottom={0} label="run stopped" /></svg>);
    expect(html).toContain('data-stop-mark="6"');
    expect(html).toContain('stroke="var(--color-bad)"');
    expect(html).toContain('stroke-dasharray="2 3"');
    expect(html).toContain('run stopped');
    // T4: in the top margin (above the plot's top), at the right of the stop line while there is room for it, at its left near the plot's right edge
    expect(Number(html.match(/<text[^>]*y="([\d.]+)"/)![1])).toBeLessThan(at({ x: 6, y: 100 }).y);
    expect(html).toContain('text-anchor="start"');
    expect(html).toContain(`x="${at({ x: 6, y: 100 }).x + 5}"`);
    const near = renderToStaticMarkup(<svg><StopMark at={at} x={11.5} xMax={12} yTop={100} yBottom={0} label="run stopped" /></svg>);
    expect(near).toContain('text-anchor="end"');
    expect(near).toContain(`x="${at({ x: 11.5, y: 100 }).x - 5}"`);
  });
  it('m6: the view\u2019s numbers are tabular', () => {
    expect(css).toMatch(/\.cdem-dem \{\s*font-variant-numeric: tabular-nums;/);
    expect(readFileSync(new URL('./demReplay.tsx', import.meta.url), 'utf8')).toMatch(/fontVariantNumeric: 'tabular-nums'/);
  });
  it('m4: the verdict table writes one precision per column', () => {
    const t = textOf(renderToStaticMarkup(<VerdictTable run={run} point={run.points[0]} />));
    expect(t).toContain('2,167.1 kg/h');
    expect(t).toContain('798.7 kg/h');
    expect(t).toContain('4.17');
    expect(t).toContain('8.60');
  });
  it('the sources give the digitisation noise with its unit', () => {
    expect(textOf(renderToStaticMarkup(<Sources run={run} point={run.points[0]} />))).toContain('digitisation noise 0.48 kg/h');
  });
});

describe('DM-017: the layout rules decide from measured boxes and strings (src/views/dem.rules.mjs)', () => {
  const card = { left: 207, right: 1264, top: 130, bottom: 700 };
  const goodColumns = [
    { name: 'Comparison', left: 220, right: 420 },
    { name: 'Quantity', left: 420, right: 560 },
    { name: 'Verdict', left: 560, right: 900 },
    { name: 'Band', left: 900, right: 1250 },
  ];
  const good = {
    card,
    columns: goodColumns,
    wrapper: { scrollWidth: 1040, clientWidth: 1040 },
    summary: { left: 220, right: 1240, top: 150, bottom: 190, scrollWidth: 1020, clientWidth: 1020, text: 'Of the 27 verdicts of the document, 3 met' },
    stacked: false,
  };
  it('a table whose every column is inside its card and whose summary is whole passes', () => {
    expect(verdictLayoutProblems(good)).toEqual([]);
    expect(verdictLayoutProblems({ ...good, stacked: true, columns: goodColumns.map((c) => ({ ...c, left: 220, right: 1240 })) })).toEqual([]);
  });
  it('adversarial: a verdict column outside its card is reported, with the column named', () => {
    const p = verdictLayoutProblems({ ...good, columns: [...goodColumns, { name: 'Verdict', left: 1541, right: 1712 }] });
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('the column "Verdict" lies outside its card');
  });
  it('adversarial: a table that scrolls sideways, and on a phone a table that is not restacked, are reported', () => {
    expect(verdictLayoutProblems({ ...good, wrapper: { scrollWidth: 1712, clientWidth: 1040 } })[0]).toContain('scrolls sideways');
    expect(verdictLayoutProblems({ ...good, stacked: true, wrapper: { scrollWidth: 635, clientWidth: 337 } })[0]).toContain('restacked');
  });
  it('adversarial: a summary sentence that is cut, outside its card or without a count is reported', () => {
    expect(verdictLayoutProblems({ ...good, summary: { ...good.summary, scrollWidth: 1712 } })[0]).toContain('summary sentence is cut');
    expect(verdictLayoutProblems({ ...good, summary: { ...good.summary, right: 2465 } })[0]).toContain('summary sentence lies outside its card');
    expect(verdictLayoutProblems({ ...good, summary: { ...good.summary, text: '' } })[0]).toContain('holds no count');
  });
  it('adversarial: two overlapping tick labels are reported, and well separated ones pass', () => {
    const a = { text: '16/13.2 mm', left: 100, right: 160, top: 300, bottom: 313 };
    const b = { text: '31.5/26.5 mm', left: 140, right: 215, top: 300, bottom: 313 };
    expect(labelOverlapProblems([a, b])).toEqual(['the labels "16/13.2 mm" and "31.5/26.5 mm" overlap']);
    expect(labelOverlapProblems([a, { ...b, left: 200, right: 275 }])).toEqual([]);
    expect(labelOverlapProblems([a, { ...b, top: 330, bottom: 343 }])).toEqual([]);
  });
  it('adversarial: a stage of 40 percent of the viewport is reported, and one of 65 percent passes', () => {
    const vp = { width: 1280, height: 800 };
    const p = stageShareProblems({ width: 1057 * 0.6, height: 640 }, vp);
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('39.6 percent');
    expect(stageShareProblems({ width: 1057, height: 635 }, vp)).toEqual([]);
    expect(stageShare({ width: 640, height: 640 }, vp)).toBeCloseTo(0.4, 9);
  });
  it('adversarial: a mark of a null inside the plotting range is reported, and one under the baseline passes', () => {
    const plot = { left: 60, right: 340, top: 40, bottom: 260 };
    const inside = { id: '31.5-26.5:simulation', box: { left: 100, right: 108, top: 250, bottom: 258 } };
    const under = { id: '31.5-26.5:population_balance', box: { left: 100, right: 150, top: 296, bottom: 309 } };
    expect(nullMarkProblems([inside], plot)[0]).toContain('lies inside the plotting range');
    expect(nullMarkProblems([under], plot)).toEqual([]);
    expect(nullMarkProblems([under, inside], plot)).toHaveLength(1);
  });
  it('adversarial: a decimal point on a Spanish string is reported; the quoted English, a thousands group and a version are not', () => {
    expect(decimalProblems([{ text: 'Con 31.5/26.5 mm la simulación', quoted: false }])).toHaveLength(1);
    expect(decimalProblems([{ text: 'potencia 0.34 kW', quoted: false }])[0]).toContain('0.34');
    expect(decimalProblems([{ text: 'section 3.2, p. 10', quoted: true }])).toEqual([]);
    expect(decimalProblems([{ text: '2.167 kg/h', quoted: false }])).toEqual([]);
    expect(decimalProblems([{ text: 'crushdem 0.6.0 (numba)', quoted: false }])).toEqual([]);
    expect(decimalProblems([{ text: '1.220 y 2.464', quoted: false }])).toEqual([]);
    expect(decimalProblems([{ text: '0,34 kW y 31,5/26,5 mm', quoted: false }])).toEqual([]);
  });
  it('the browser script hands its measurements to these rules and is run by the story checks', () => {
    const b = readFileSync(new URL('./dem.browser.mjs', import.meta.url), 'utf8');
    for (const rule of ['leaderPathProblems', 'verdictLayoutProblems', 'axisNoteProblems', 'labelOverlapProblems', 'stageGeometryProblems', 'decimalProblems', 'leaderProblems', 'classContrastProblems', 'stageTimesProblems']) expect(b).toContain(rule);
    expect(readFileSync(new URL('../pages/story.browser.mjs', import.meta.url), 'utf8')).toContain("import('../views/dem.browser.mjs')");
  });
});

describe('F1: the quotes of the quoted English blocks are real characters', () => {
  const stylesheet = readFileSync(new URL('../workbench/workbench.css', import.meta.url), 'utf8');
  const C1 = new RegExp('[\\u0080-\\u009f]');
  it('the stylesheet quotes with the CSS escapes of U+201C and U+201D, and no stylesheet or source of the view holds a control character', () => {
    expect(stylesheet).toMatch(/quotes: "\\201C" "\\201D";/);
    for (const f of ['dem.tsx', 'demModel.ts', 'demReplay.tsx', 'dem.browser.mjs', 'dem.rules.mjs']) expect(readFileSync(new URL(`./${f}`, import.meta.url), 'utf8'), f).not.toMatch(C1);
    expect(stylesheet).not.toMatch(C1);
    // every backslash of the stylesheet starts one of the two quote escapes and nothing else
    expect(stylesheet.split(String.fromCharCode(92)).slice(1).map((piece) => piece.slice(0, 4))).toEqual(['201C', '201D']);
    expect(String.fromCharCode(0x201c)).toBe('\u201C');
  });
  it('the quoted block is a q element marked as English, whose quotes the stylesheet supplies, and no rendered text of the view holds a control character', () => {
    for (const lang of ['en', 'es'] as const) {
      setLang(lang);
      for (const id of ['63-52', '31.5-26.5', '16-13.2']) expect(textOf(render({ initialPoint: id }))).not.toMatch(C1);
    }
    const q = renderToStaticMarkup(<Q>overlap of 0.547</Q>);
    expect(q).toBe('<q class="cdem-quote" translate="no" lang="en">overlap of 0.547</q>');
    expect(q).not.toMatch(C1);
  });
});

describe('F2 and R3: the note of the missing sides overlaps nothing and stands directly under the tick labels', () => {
  const ticks = [
    { text: '63/52 mm', box: { left: 80, right: 140, top: 264, bottom: 277 } },
    { text: '16/13.2 mm', box: { left: 260, right: 330, top: 264, bottom: 277 } },
  ];
  it('adversarial: a note on a tick label, above the lowest tick label or far under them is reported; one directly under passes', () => {
    expect(axisNoteProblems({ left: 70, right: 330, top: 282, bottom: 296 }, ticks)).toEqual([]);
    expect(axisNoteProblems({ left: 70, right: 330, top: 270, bottom: 284 }, ticks)[0]).toContain('overlaps the tick label');
    expect(axisNoteProblems({ left: 70, right: 330, top: 200, bottom: 214 }, ticks).join(' ')).toContain('above the lowest tick label');
    expect(axisNoteProblems({ left: 70, right: 330, top: 350, bottom: 364 }, ticks)[0]).toContain('73 px under the tick labels');
  });
  it('adversarial: a "no value" text on a tick label, on the axis title, on another or inside the plot is reported', () => {
    const plot = { left: 60, right: 340, top: 40, bottom: 260 };
    const under = { id: '31.5-26.5:simulation', box: { left: 160, right: 205, top: 330, bottom: 344 } };
    const title = { text: 'Feed class', box: { left: 150, right: 230, top: 296, bottom: 310 } };
    expect(noValueStripProblems([under], [title], plot)).toEqual([]);
    expect(noValueStripProblems([{ ...under, box: { ...under.box, top: 300, bottom: 314 } }], [title], plot)[0]).toContain('overlaps "Feed class"');
    expect(noValueStripProblems([{ id: 'x', box: { left: 100, right: 140, top: 200, bottom: 214 } }], [], plot)[0]).toContain('inside the plotting range');
  });
  it('the rules for a text under an axis still hold', () => {
    const plot = { left: 60, right: 340, top: 40, bottom: 260 };
    expect(noValueStripProblems([{ id: 'x', box: { left: 100, right: 140, top: 200, bottom: 214 } }], [], plot)[0]).toContain('inside the plotting range');
    expect(nullMarkProblems([], plot)).toEqual([]);
  });
  it('the browser script measures the note against the tick labels', () => {
    const b = readFileSync(new URL('./dem.browser.mjs', import.meta.url), 'utf8');
    expect(b).toContain('axisNoteProblems');
    expect(b).toContain('[data-axis-note]');
  });
});

describe('F3: the quantity cell is left aligned in every row', () => {
  it('every quantity cell carries the class the stylesheet aligns left', () => {
    const html = render();
    const table = html.slice(html.indexOf('data-verdict-table'));
    expect((table.match(/class="cdem-vt-qty"/g) ?? []).length).toBe(9);
    expect(css).toMatch(/\.cdem-vt \.caos-table td\.cdem-vt-qty \{\s*text-align: left;/);
  });
});

describe('F4: the stage is composed so the drawing is what the first screen shows', () => {
  it('the point choice and the controls share a row, the reduced-motion note and the stored rate are one line, the takeaway and the readiness follow the card', () => {
    const html = render({ reducedMotion: true });
    const bar = html.slice(html.indexOf('class="cdem-stage-bar"'));
    expect(bar.slice(0, bar.indexOf('data-stored-rate')).includes('data-point-choice')).toBe(true);
    expect(bar.slice(0, bar.indexOf('data-stored-rate')).includes('data-linked-cursor')).toBe(true);
    const line = html.slice(html.indexOf('data-stored-rate'));
    const one = line.slice(0, line.indexOf('</p>'));
    expect(one).toContain('This replay stores 12 frames per stroke');
    expect(one).toContain('Reduced motion is on');
    expect((html.match(/data-stored-rate/g) ?? []).length).toBe(1);
    expect(render()).not.toContain('data-reduced-motion-note');
    const afterCard = html.slice(html.indexOf('data-after-stage'));
    expect(afterCard.slice(0, 600)).toContain('data-takeaway');
    expect(afterCard.slice(0, 1200)).toContain('data-readiness="partial"');
    expect(html.indexOf('data-after-stage')).toBeGreaterThan(html.indexOf('data-run-status'));
  });
  it('the callouts of the shell\u2019s anchored placement stand in the margins of the section on a desktop; on a phone the header band stays', () => {
    const rep = readFileSync(new URL('./demReplay.tsx', import.meta.url), 'utf8');
    expect(rep).toMatch(/<SceneCallouts items=\{items\} placement="header" \/>/);
    expect(rep).toContain('<StageBody {...props} />');
    expect(rep).toContain('data-callouts-column');
    expect(stageColumns(1040, 330).wide).toBe(true);
    expect(stageColumns(340, 400).wide).toBe(false);
  });
  it('adversarial: a drawing region under 40 percent, a zone or a section under 380 px, or a stage card under 60 percent is reported', () => {
    const vp = { width: 1280, height: 800 };
    const good = { card: { width: 1057, height: 640 }, drawing: { width: 1040, height: 420 }, section: { height: 400 }, zone: { height: 400 } };
    expect(stageGeometryProblems(good, vp)).toEqual([]);
    expect(stageGeometryProblems({ ...good, drawing: { width: 1040, height: 245 } }, vp)[0]).toContain('drawing region');
    expect(stageGeometryProblems({ ...good, zone: { height: 210 } }, vp)[0]).toContain('magnified zone');
    expect(stageGeometryProblems({ ...good, section: { height: 230 } }, vp)[0]).toContain('section');
    expect(stageGeometryProblems({ ...good, card: { width: 640, height: 640 } }, vp)[0]).toContain('stage card');
  });
});

describe('F5: the two per-stroke charts stack on a phone, each with its own box', () => {
  it('adversarial: two chart roots whose boxes overlap are reported, with both named; disjoint ones pass', () => {
    const power = { id: 'series#0', box: { left: 16, right: 374, top: 1957, bottom: 2340 } };
    const mass = { id: 'series#1', box: { left: 16, right: 374, top: 2225, bottom: 2428 } };
    const p = chartOverlapProblems([power, mass]);
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('series#0');
    expect(p[0]).toContain('series#1');
    expect(chartOverlapProblems([power, { ...mass, box: { ...mass.box, top: 2350, bottom: 2640 } }])).toEqual([]);
    expect(chartOverlapProblems([power, { ...mass, box: { left: 400, right: 780, top: 1957, bottom: 2340 } }])).toEqual([]);
    expect(chartOverlapProblems([power, mass, { id: 'c', box: { left: 0, right: 390, top: 2300, bottom: 2500 } }])).toHaveLength(3);
  });
  it('the stacked cells keep the floor of the callout host under the first chart, so the first chart cannot spill over the second', () => {
    expect(css).toMatch(/\.cdem-series-cell \{\s*height: auto;\s*min-height: 27rem;/);
    expect(css).toContain('min-height: max(26rem');
  });
  it('the window label stands at the inside edge of the band farther from the cursor, so it never sits under the cursor label', () => {
    expect(windowLabelSide(36.5, 65.5, 37)).toBe('right');
    expect(windowLabelSide(36.5, 65.5, 65)).toBe('left');
    expect(windowLabelSide(36.5, 65.5, 55)).toBe('left');
    const src = readFileSync(new URL('./dem.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/data-window-label=\{side\}/);
    expect(src).toMatch(/cursor=\{cursor\} label=/);
  });
  it('the browser script measures every chart root of the view at both sizes for the three points', () => {
    const b = readFileSync(new URL('./dem.browser.mjs', import.meta.url), 'utf8');
    expect(b).toContain('chartOverlapProblems');
    expect(b).toContain(".cdem-dem .uplot");
  });
});

describe('R1: every callout leader reaches its subject', () => {
  it('adversarial: a leader that ends in empty space, or two that end within 20 px of each other, are reported; a leader on its subject passes', () => {
    const swing = { left: 100, right: 140, top: 50, bottom: 300 };
    const gap = { left: 118, right: 150, top: 396, bottom: 412 };
    const good = [
      { id: 'net_power', end: { x: 120, y: 175 }, box: swing },
      { id: 'throughput', end: { x: 134, y: 404 }, box: gap },
    ];
    expect(leaderProblems(good)).toEqual([]);
    const lost = leaderProblems([{ id: 'throughput', end: { x: 427, y: 634 }, box: gap }]);
    expect(lost).toHaveLength(1);
    expect(lost[0]).toContain('the leader of "throughput" ends at (427, 634), outside its subject');
    const close = leaderProblems([...good, { id: 'p80', end: { x: 134, y: 413 }, box: { left: 120, right: 150, top: 396, bottom: 420 } }]);
    expect(close).toHaveLength(1);
    expect(close[0]).toContain('9.0 px apart');
  });
  it('the targets of the three callouts are on their subjects in the drawing, 20 px or more apart, for every point and plate position', () => {
    for (const p of run.points) {
      const r = p.simulation.replay!;
      const ext = plateExtremes(r);
      const tf = { scale: 0.8, bounds: { xMin: -55, xMax: 120, zMin: -70, zMax: 470 }, px: (x: number, z: number) => ({ x: (x + 55) * 0.8, y: (470 - z) * 0.8 }) };
      for (const i of [0, Math.floor(r.frames / 2), r.frames - 1]) {
        const targets = calloutTargets(tf, r.geometry, { x: r.plate_bottom_x_mm[i], z: r.plate_bottom_z_mm[i] }, ext.closed);
        expect(targets.map((x) => x.id)).toEqual(['throughput', 'net_power', 'p80']);
        expect(leaderProblems(targets.map((x) => ({ id: x.id, end: x.end, box: x.box })), 4, 20)).toEqual([]);
      }
    }
  });
  it('the stage rectangles: wide has the column, the gutter, the section, the zone and the legend in one row; narrow has the column and the section over the legend and the zone', () => {
    const wide = stageRects(1040, 420);
    expect(wide.wide).toBe(true);
    expect(wide.chamber.x).toBe(CALLOUT_COLUMN + GUTTER);
    expect(wide.chamber.x + wide.chamber.w).toBeLessThanOrEqual(wide.inset.x);
    expect(wide.inset.x + wide.inset.w).toBeLessThanOrEqual(wide.panel.x);
    const narrow = stageRects(358, 864);
    expect(narrow.wide).toBe(false);
    // stacked: the cards, then the section at the full width, then the legend and the zone in a row
    expect(narrow.callouts.y).toBe(0);
    expect(narrow.chamber.y).toBeGreaterThanOrEqual(narrow.callouts.y + narrow.callouts.h);
    expect(narrow.chamber.x).toBe(0);
    expect(narrow.chamber.w).toBe(358);
    expect(narrow.inset.y).toBe(narrow.panel.y);
    expect(narrow.inset.y).toBeGreaterThanOrEqual(narrow.chamber.y + narrow.chamber.h);
    expect(narrow.inset.x + narrow.inset.w).toBeLessThanOrEqual(358);
    expect(narrow.callouts.x).toBeGreaterThanOrEqual(GUTTER_PHONE);
    expect(narrow.inset.y + narrow.inset.h).toBeLessThanOrEqual(864);
  });
});

describe('T1 and T6: the leaders are routed as elbows through the gutter, across no card and no label', () => {
  const swing = { left: 100, right: 140, top: 50, bottom: 300 };
  void swing;
  const cardBox = (top: number) => ({ left: 0, right: CALLOUT_COLUMN, top, bottom: top + 120 });
  const cardsAt = [60, 200, 340].map((top, k) => ({ id: ['throughput', 'net_power', 'p80'][k] as 'throughput' | 'net_power' | 'p80', x: CALLOUT_COLUMN / 2, y: top + 60, box: cardBox(top) }));
  const tf = { scale: 0.8, bounds: { xMin: -55, xMax: 120, zMin: -70, zMax: 470 }, px: (x: number, z: number) => ({ x: (x + 55) * 0.8, y: (470 - z) * 0.8 }) };
  it('each leader leaves its own card at the card\u2019s height, runs down its own track in the gutter and reaches its subject; no card is crossed, no two share a line', () => {
    for (const p of run.points) {
      const r = p.simulation.replay!;
      const ext = plateExtremes(r);
      for (const i of [0, Math.floor(r.frames / 2), r.frames - 1]) {
        const targets = calloutTargets(tf, r.geometry, { x: r.plate_bottom_x_mm[i], z: r.plate_bottom_z_mm[i] }, ext.closed);
        const paths = routeLeaders(cardsAt, targets, CALLOUT_COLUMN, CALLOUT_COLUMN + GUTTER, { cards: cardsAt.map((c) => ({ id: c.id, box: c.box })) });
        expect(leaderPathProblems(paths, cardsAt.map((c) => ({ id: c.id, box: c.box })), [])).toEqual([]);
        for (const path of paths) {
          const card = cardsAt.find((c) => c.id === path.id)!;
          const [first, second] = path.points;
          expect(first.y).toBe(card.y);
          expect(second).toEqual({ x: CALLOUT_COLUMN, y: card.y });
          const track = path.points[2].x;
          expect(TRACK_OFFSETS.map((o) => CALLOUT_COLUMN + o)).toContain(track);
          const end = path.points[path.points.length - 1];
          const t = targets.find((q) => q.id === path.id)!;
          expect(end.x).toBeCloseTo(CALLOUT_COLUMN + GUTTER + t.end.x, 6);
          expect(end.y).toBeCloseTo(t.end.y, 6);
        }
        expect(new Set(paths.map((q) => q.points[2].x)).size).toBe(3);
      }
    }
  });
  it('the P80 leader ends on the discharge level, the same height as the throughput leader\u2019s end, 30 mm to its left', () => {
    const r = run.points[0].simulation.replay!;
    const targets = calloutTargets(tf, r.geometry, { x: r.plate_bottom_x_mm[0], z: r.plate_bottom_z_mm[0] }, plateExtremes(r).closed);
    const t = targets.find((q) => q.id === 'throughput')!;
    const p = targets.find((q) => q.id === 'p80')!;
    expect(p.end.y).toBeCloseTo(t.end.y, 6);
    expect(p.end.x).toBeCloseTo(tf.px(r.geometry.fixed_plate_x_mm - 45, 0).x, 6);
    expect(p.approachY).toBeGreaterThan(p.end.y);
    expect(t.approachY).toBeLessThan(t.end.y);
  });
  const boxOf = (left: number, top: number, w: number, h: number) => ({ left, right: left + w, top, bottom: top + h });
  const own = { id: 'throughput', points: [{ x: 106, y: 120 }, { x: 212, y: 120 }, { x: 217, y: 120 }, { x: 217, y: 380 }, { x: 300, y: 380 }, { x: 300, y: 392 }] };
  const cards = [{ id: 'throughput', box: boxOf(0, 60, 212, 120) }, { id: 'net_power', box: boxOf(0, 200, 212, 120) }, { id: 'p80', box: boxOf(0, 340, 212, 120) }];
  it('adversarial: a leader that passes behind another callout card is reported with both named, one that leaves its own card and runs down the gutter passes', () => {
    expect(leaderPathProblems([own], cards, [])).toEqual([]);
    const behind = { id: 'throughput', points: [{ x: 106, y: 120 }, { x: 106, y: 260 }, { x: 300, y: 260 }] };
    const problems = leaderPathProblems([behind], cards, []);
    expect(problems.length).toBeGreaterThanOrEqual(1);
    expect(problems[0]).toContain('the leader of "throughput" passes through the callout card "net_power"');
  });
  it('adversarial: a leader that crosses a label box of the drawing is reported with the label named; one that runs beside it passes', () => {
    const labels = [{ text: 'discharge level', box: boxOf(240, 372, 90, 14) }, { text: 'hopper', box: boxOf(400, 20, 40, 14) }];
    const problems = leaderPathProblems([own], cards, labels);
    expect(problems.length).toBeGreaterThanOrEqual(1);
    expect(problems[0]).toContain('crosses the label "discharge level"');
    expect(leaderPathProblems([own], cards, [{ text: 'open 17.5 mm', box: boxOf(240, 420, 90, 14) }])).toEqual([]);
  });
  it('adversarial: two leaders that run along one line, or that cross, are reported; tracks a few px apart in the gutter pass', () => {
    const shared = { id: 'p80', points: [{ x: 106, y: 400 }, { x: 212, y: 400 }, { x: 218, y: 400 }, { x: 218, y: 380 }, { x: 330, y: 380 }, { x: 330, y: 392 }] };
    const sameLine = leaderPathProblems([own, { ...shared, points: shared.points.map((q) => ({ x: q.x === 218 ? 217 : q.x, y: q.y })) }], cards, []);
    expect(sameLine.join(' ')).toContain('run along one line');
    const clear = { id: 'p80', points: [{ x: 106, y: 400 }, { x: 212, y: 400 }, { x: 224, y: 400 }, { x: 224, y: 412 }, { x: 330, y: 412 }, { x: 330, y: 392 }] };
    expect(leaderPathProblems([own, clear], cards, [])).toEqual([]);
    expect(pathConflicts([own, shared])).toBeGreaterThanOrEqual(1);
    const crossing = { id: 'net_power', points: [{ x: 106, y: 260 }, { x: 212, y: 260 }, { x: 212, y: 260 }, { x: 260, y: 260 }, { x: 260, y: 150 }, { x: 320, y: 150 }] };
    expect(pathConflicts([own, crossing])).toBe(1);
    const cut = { id: 'net_power', points: [{ x: 200, y: 300 }, { x: 240, y: 300 }, { x: 240, y: 100 }] };
    expect(pathConflicts([{ id: 'throughput', points: [{ x: 217, y: 200 }, { x: 300, y: 200 }] }, cut])).toBe(1);
  });
  it('adversarial: a leader whose end is off its subject is still reported by the end rule, and the browser check measures paths, ends and the painted pixel', () => {
    const lost = leaderProblems([{ id: 'p80', end: { x: 300, y: 500 }, box: boxOf(280, 380, 24, 12) }]);
    expect(lost[0]).toContain('outside its subject');
    const b = readFileSync(new URL('./dem.browser.mjs', import.meta.url), 'utf8');
    expect(b).toContain('leaderPathProblems(');
    expect(b).toContain('ends on something drawn');
    expect(b).toContain('[data-caos-callout]');
  });
});

describe('P1 and P2: the phone stage is stacked and no label covers a sphere or a plate line', () => {
  const tf = { scale: 0.5, bounds: { xMin: -55, xMax: 120, zMin: -70, zMax: 470 }, px: (x: number, z: number) => ({ x: 100 + (x + 55) * 0.5, y: (470 - z) * 0.5 }) };
  it('on the left side, each leader leaves its own card at the card’s left edge, runs down its own track in the gutter at the left and across to its subject under the cards', () => {
    const r = run.points[0].simulation.replay!;
    const targets = calloutTargets(tf, r.geometry, { x: r.plate_bottom_x_mm[0], z: r.plate_bottom_z_mm[0] }, plateExtremes(r).closed);
    const cards = [20, 120, 220].map((top, k) => ({ id: ['throughput', 'net_power', 'p80'][k] as 'throughput' | 'net_power' | 'p80', x: 130, y: top + 45, box: { left: 46, right: 210, top, bottom: top + 90 } }));
    const paths = routeLeaders(cards, targets, GUTTER_PHONE, 0, { cards: cards.map((c) => ({ id: c.id, box: c.box })) }, 'left', 320);
    expect(leaderPathProblems(paths, cards.map((c) => ({ id: c.id, box: c.box })), [])).toEqual([]);
    for (const path of paths) {
      const card = cards.find((c) => c.id === path.id)!;
      expect(path.points[1]).toEqual({ x: GUTTER_PHONE, y: card.y });
      expect(path.points[2].x).toBeLessThan(GUTTER_PHONE);
      const t = targets.find((q) => q.id === path.id)!;
      const end = path.points[path.points.length - 1];
      expect(end.y).toBeCloseTo(320 + t.end.y, 6);
    }
    expect(new Set(paths.map((q) => q.points[2].x)).size).toBe(3);
  });
  it('the shapes of a frame are its spheres as circles and the two plate lines, in the canvas pixels', () => {
    const r = run.points[0].simulation.replay!;
    const f = (framesOf(run.points[0]) as { data: DemFrames }).data;
    const counts = Array.from({ length: r.frames }, (_, i) => r.count[i]);
    const last = counts.indexOf(Math.max(...counts));
    const shapes = replayShapes(tf, r.geometry, f, last, { x: r.plate_bottom_x_mm[last], z: r.plate_bottom_z_mm[last] });
    expect(shapes.circles.length).toBeGreaterThan(10);
    expect(shapes.circles.every((c) => c.length === 3 && c[2] > 0)).toBe(true);
    expect(shapes.plates).toHaveLength(2);
    expect(replayShapes(tf, r.geometry, null, 0, { x: 0, z: 0 }).circles).toEqual([]);
  });
  const box = (left: number, top: number, w: number, h: number) => ({ left, right: left + w, top, bottom: top + h });
  it('adversarial: a label whose box covers a drawn sphere is reported with the count; one outside every sphere passes', () => {
    const circles = [[100, 50, 10], [130, 50, 10], [300, 300, 6]];
    expect(labelShapeProblems([{ text: 'hopper', box: box(180, 40, 60, 14) }], circles, [])).toEqual([]);
    const hit = labelShapeProblems([{ text: 'hopper', box: box(95, 44, 60, 14) }], circles, []);
    expect(hit).toEqual(['the label "hopper" covers 2 drawn spheres']);
    expect(labelShapeProblems([{ text: 'one', box: box(295, 295, 4, 10) }], circles, [])).toEqual(['the label "one" covers 1 drawn sphere']);
    // a box that only touches the circle's bounding square, not the circle, passes
    expect(labelShapeProblems([{ text: 'corner', box: box(108, 58, 20, 10) }], [[100, 50, 10]], [])).toEqual([]);
  });
  it('adversarial: a label whose box lies on the fixed plate line or on the swing plate line is reported with the plate named', () => {
    const plates = [[100, 20, 100, 300], [160, 40, 220, 260]];
    expect(labelShapeProblems([{ text: 'fixed plate', box: box(20, 100, 60, 14) }], [], plates)).toEqual([]);
    expect(labelShapeProblems([{ text: 'fixed plate', box: box(60, 100, 60, 14) }], [], plates)).toEqual(['the label "fixed plate" covers the fixed plate line']);
    expect(labelShapeProblems([{ text: 'swing plate', box: box(180, 120, 60, 14) }], [], plates)).toEqual(['the label "swing plate" covers the swing plate line']);
    // the line is 5 px thick: a box 2 px from the centre line is on it
    expect(labelShapeProblems([{ text: 'near', box: box(102, 100, 40, 14) }], [], plates)).toEqual(['the label "near" covers the fixed plate line']);
  });
  it('the browser check reads the stage’s drawn shapes from its data attribute at both sizes and reports the counts', () => {
    const b = readFileSync(new URL('./dem.browser.mjs', import.meta.url), 'utf8');
    expect(b).toContain('labelShapeProblems(');
    expect(b).toContain('data-shapes');
    const rep = readFileSync(new URL('./demReplay.tsx', import.meta.url), 'utf8');
    expect(rep).toContain('data-shapes=');
  });
});

describe('R2: the size classes read against the stage in both themes', () => {
  const stylesheet = readFileSync(new URL('../workbench/workbench.css', import.meta.url), 'utf8');
  const ramp = (re: RegExp): string[] => [...stylesheet.match(re)![1].matchAll(/--cdem-size-\d: (#[0-9a-f]{6});/g)].map((m) => m[1]);
  const dark = ramp(/:root,\s*\[data-theme='dark'\] \{\s*(--cdem-size-0[^}]*)\}/);
  const light = ramp(/\[data-theme='light'\] \{\s*(--cdem-size-0[^}]*)\}/);
  it('every one of the twelve classes is at 3 to 1 or more against the stage background of its theme, ordered in lightness', () => {
    expect(dark).toHaveLength(6);
    expect(light).toHaveLength(6);
    expect(classContrastProblems(dark, '#161b22')).toEqual([]);
    expect(classContrastProblems(light, '#ffffff')).toEqual([]);
    for (const c of dark) expect(contrast(c, '#161b22')).toBeGreaterThanOrEqual(3);
    for (const c of light) expect(contrast(c, '#ffffff')).toBeGreaterThanOrEqual(3);
  });
  it('adversarial: the old light ramp (the dark one reversed, a pale yellow at the fine end) is reported', () => {
    const old = ['#fde66a', '#cbbf6b', '#98957a', '#666a74', '#35466e', '#00224e'];
    const p = classContrastProblems(old, '#ffffff');
    expect(p.length).toBeGreaterThanOrEqual(2);
    expect(p[0]).toContain('the size class 0 (#fde66a) has a contrast of 1.');
    expect(classContrastProblems(['#2a99d4', '#2a99d4', '#2a99d4', '#2a99d4', '#2a99d4', '#2a99d4'], '#ffffff').join(' ')).toContain('not ordered in lightness');
  });
  it('T7: the light ramp ends on a dark brown, not on a red beside the alarm red, and every class keeps 3 to 1 and the order', () => {
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const hueOf = (hex: string) => {
      const [r, g, b] = rgb(hex);
      const mx = Math.max(r, g, b);
      const d = mx - Math.min(r, g, b);
      const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    const last = light[5];
    expect(contrast(last, '#ffffff')).toBeGreaterThanOrEqual(3);
    const h = hueOf(last);
    expect(h > 8 && h < 340).toBe(true);
    expect(hueOf(light[4]) > 8 && hueOf(light[4]) < 340).toBe(true);
    // the alarm red of the light theme is about hue 355 or 0: no class of the ramp lies within 8 degrees of it
    for (const c of light) expect(Math.min(hueOf(c), 360 - hueOf(c))).toBeGreaterThan(8);
  });
  it('the small spheres are outlined so a two-pixel dot is seen', () => {
    const rep = readFileSync(new URL('./demReplay.tsx', import.meta.url), 'utf8');
    expect(rep).toContain('ctx.strokeStyle = r > 2.5 ? a.colors.surface : a.colors.fg;');
    expect(rep).not.toContain('if (r > 2.5) ctx.stroke();');
  });
});

describe('R5: the three steps of a change of point come at their own times', () => {
  it('adversarial: steps that come together, or fewer than three steps, are reported; steps 320 ms apart pass', () => {
    expect(stageTimesProblems([20, 340, 660])).toEqual([]);
    expect(stageTimesProblems([20, 552, 552])[0]).toContain('step 3 came 0 ms after step 2');
    expect(stageTimesProblems([20, 552])).toEqual(['2 steps were seen, three are required']);
    const stages = pointStages(() => undefined);
    expect(stages.map((s) => s.durationMs)).toEqual([320, 320, 0]);
  });
});

describe('R10: a decimal before a small unit is a decimal even where a thousands group would pass', () => {
  it('adversarial: "1.234 kW" on a Spanish string is reported, "2.167 kg/h" is a thousands group and is not', () => {
    expect(decimalProblems([{ text: 'consume 1.234 kW', quoted: false }])).toHaveLength(1);
    expect(decimalProblems([{ text: 'pasa 1.234 mm', quoted: false }])).toHaveLength(1);
    expect(decimalProblems([{ text: 'masa 1.234 kg', quoted: false }])).toHaveLength(1);
    expect(decimalProblems([{ text: 'pasa 2.167 kg/h', quoted: false }])).toEqual([]);
    expect(decimalProblems([{ text: 'pasa 2.167 kg/h frente a 1.220 kg/h', quoted: false }])).toEqual([]);
    expect(decimalProblems([{ text: 'consume 1.234 kW', quoted: true }])).toEqual([]);
  });
});

describe('R4 and R9: the verdict table headers and the size panel sign', () => {
  it('the three text columns are left aligned under their headers on a desktop, the number columns right', () => {
    const stylesheet = readFileSync(new URL('../workbench/workbench.css', import.meta.url), 'utf8');
    expect(stylesheet).toContain('.cdem-vt .caos-table thead th:nth-child(3),');
    expect(stylesheet).toMatch(/\.cdem-vt \.caos-table td\.cdem-vt-verdict \{\s*text-align: left;/);
  });
  it('the top class of the size panel is written with the greater-than-or-equal sign', () => {
    expect(sizeClassLabels(52, plain, 'en')[5].charCodeAt(0)).toBe(0x2265);
    expect(sizeClassLabels(52, plain, 'es')[5]).toBe(`${String.fromCharCode(0x2265)} 52`);
  });
});
