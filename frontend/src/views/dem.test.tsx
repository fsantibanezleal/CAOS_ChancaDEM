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
import { bareReason, calloutSpecs, CATEGORY, ComparisonOverlay, cursorMark, DemBody, DemUnavailable, DemUnreadable, LabNote, pointStages, Q, sideOffset, Sources, VerdictTable } from './dem';
import { comparisonSeries, decodeFrames, frameAt, frameLabelText, nearerSentence, openingCursor, plain, type DemFrames, type DemPoint } from './demModel';
import { FramesState, NAMES, panelWidth, plateExtremes, drawReplay, stageColumns, sphereTop } from './demReplay';
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
  const b = readFileSync(new URL(`dem/${r.file.replace(/^dem\//, '')}`, provider));
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
  it('the three callouts follow the document: a value or a verdict changed in a copy moves them', () => {
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
  it('the frame label, the slider and the charts’ marker stand at the same cursor, for any cursor', () => {
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
    expect(src).toMatch(/onPick=\{\(stroke\) => scrub\(cursorOfStrokeIndex\(/);
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
    expect(src).not.toMatch(/requestAnimationFrame/);
  });
  it('under reduced motion the play button is off, the note says so and the frame at the cursor is shown', () => {
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
    expect(text).toContain('No value (written under the axis):');
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
    expect(src).toMatch(/Magnified \$\{num\(mag/);
    expect(src).toMatch(/data-scale-bar/);
    expect(src).toMatch(/showInset = insetH - head >= INSET_MIN_PX/);
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
    expect(es).toContain('1 de 3 corridas');
  });
  it('stale: the note says the bake is stale with its reason, and the document the build holds is still drawn', () => {
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
  it('missing: the reason is said in both languages with nothing drawn', () => {
    const reason = { en: 'the bake was not run for this build.', es: 'no se ejecutó la generación para esta versión.' };
    const en1 = renderToStaticMarkup(<DemUnavailable reason={reason} />);
    expect(en1).toContain('data-state="unavailable"');
    expect(textOf(en1)).toContain('The particle simulation of the laboratory jaw crusher is not available yet: the bake was not run for this build.');
    expect(en1).not.toContain('data-chart');
    setLang('es');
    expect(textOf(renderToStaticMarkup(<DemUnavailable reason={reason} />))).toContain('aún no está disponible: no se ejecutó la generación para esta versión.');
  });
  it('a replay file that is loading, unavailable or failed is said in the stage’s place, with its reason', () => {
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
    expect(src).toMatch(/CalloutStage/);
    expect(src).not.toMatch(/setInterval|requestAnimationFrame/);
    expect(src).toMatch(/placement|CalloutStage/);
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
  const overlay = (q: 'throughput' | 'net_power' | 'p80', lang: 'en' | 'es' = 'en') => renderToStaticMarkup(<svg><ComparisonOverlay series={comparisonSeries(run, q)} at={at} lang={lang} /></svg>);
  it('draws the text "no value" under the baseline for each null, in the side\u2019s colour, and no circle or other mark inside the plot', () => {
    const svg = overlay('net_power');
    const baseline = at({ x: 1, y: 0 }).y;
    const texts = [...svg.matchAll(/<text[^>]*data-no-value="([^"]+)"[^>]*y="([\d.]+)"/g)].map((m) => ({ id: m[1], y: Number(m[2]) }));
    // the particle simulation at 31.5/26.5 and the population balance at all three points
    expect(texts.map((x) => x.id).sort()).toEqual(['16-13.2:population_balance', '31.5-26.5:population_balance', '31.5-26.5:simulation', '63-52:population_balance']);
    for (const x of texts) expect(x.y).toBeGreaterThan(baseline);
    expect(svg).not.toContain('<circle');
    expect(svg).toContain('no value');
    const throughput = overlay('throughput');
    expect([...throughput.matchAll(/data-no-value="([^"]+)"/g)].map((m) => m[1])).toEqual(['31.5-26.5:simulation']);
    expect(overlay('p80')).not.toContain('data-no-value');
  });
  it('writes it in Spanish on a Spanish page, with the reason as the title', () => {
    const svg = overlay('net_power', 'es');
    expect(svg).toContain('sin valor');
    expect(svg).toContain('<title>balance poblacional: no se publica un índice de trabajo');
  });
  it('a side with a value keeps its bars: the measurement\u2019s band, the standard error and the spread are drawn at the feed class\u2019s position', () => {
    const svg = overlay('throughput');
    expect((svg.match(/data-measurement-band=/g) ?? []).length).toBe(3);
    expect(svg).toContain('<line');
    const x = (id: string) => Number(svg.match(new RegExp(`data-measurement-band="${id}" x="([\\d.]+)"`))![1]);
    expect(x('63-52')).toBeLessThan(x('31.5-26.5'));
    expect(x('31.5-26.5')).toBeLessThan(x('16-13.2'));
  });
  it('the legend has an entry for it, and its reasons are in the note', () => {
    const src = readFileSync(new URL('./dem.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/id: 'no-value', label: \{ en: 'No value \(written under the axis, reason in the note\)'/);
    expect(textOf(render())).toContain('population balance, 63/52 mm: no work index of the ore is published');
  });
});

describe('B3: the three feed classes are equally spaced categories labelled with their class', () => {
  it('the positions are 1, 2 and 3 with the sides a fixed step apart, so no two labels can meet', () => {
    const src = readFileSync(new URL('./dem.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/const pts = series\.points\.map\(\(p, i\) => \(\{ \.\.\.p, c: i \+ 1 \}\)\)/);
    expect(src).toMatch(/ticks = pts\.map\(\(p\) => \(\{ value: p\.c, label:/);
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
    expect(rep).toMatch(/SIZE_TOKENS\.map\(\(t\) => resolveToken\(t/);
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
    expect(narrow.inset).toBe(narrow.panel);
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
    expect(src).toMatch(/runStagedTransition\(pointStages\(setStep\), \{ reducedMotion: reducedMotion \?\? prefersReducedMotion\(\)/);
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
  it('m15 and m16: the per-stroke charts mark the stop of a run that did not complete and hint at what a click does', () => {
    const src = readFileSync(new URL('./dem.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/label: \{ en: 'run stopped', es: 'corrida detenida' \}/);
    expect(src).toMatch(/hint=\{SERIES_HINT\}/);
    expect(src).toMatch(/Choose a stroke on the chart to move the replay/);
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
