// The particle-simulation view (DM-012 to DM-015), rendered as static markup on the provider tree's document and frames: the tab, the three
// callouts with value, unit and state, the stroke cursor shared by the stage's frame label and the per-stroke charts, reduced motion, a run
// that did not complete, the readiness states, and the numbers on the page against the document. The browser half (the canvas, the anchors,
// the stage share, the themes) is measured by the shell's gate on the release build.
import { formatNumber, LinkedViewProvider, useLangStore } from '@fasl-work/caos-app-shell';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import type { Loaded } from '../api/artifacts';
import type { DemRun, Readiness } from '../lib/contract.types';
import { toCallout } from './callouts';
import { calloutSpecs, cursorMark, DemBody, DemUnavailable, LabNote, sideOffset } from './dem';
import { decodeFrames, frameAt, frameLabelText, nearerSentence, openingCursor, plain, type DemFrames, type DemPoint } from './demModel';
import { FramesState, NAMES, panelWidth, paletteOf, parseHex, plateExtremes, sequentialScale, drawReplay } from './demReplay';
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
const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

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
    expect(text).toContain('31.5/26.5 mm: detenida');
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
        expect(s.unit.en.length).toBeGreaterThan(0);
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
    expect(src).toMatch(/const choose = \(stroke: number\) => scrub\(stroke\)/);
    expect(src).toMatch(/onPick=\{pick\}/);
    expect(src).toMatch(/marks=\{\[mark\]\}/);
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
    expect(textOf(html)).toContain('Reduced motion: the replay does not play by itself; scrub to a stroke.');
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
    expect(text).toContain('No value (open circle):');
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
    expect(text).toContain('3 of 27 verdicts are met, 13 are not met and 11 are not compared');
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
    expect(t).toContain(`${en(1234)} kg/h`);
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
    const block = html.slice(html.indexOf('data-sources'));
    const text = textOf(block.slice(0, block.indexOf('</dl>'))).replace(/10\.3390\/\S+/g, '').replace(/\d+\.\d+\.\d+/g, '');
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
    expect(text).toContain('potencia neta 0,32 kW (text, section 3,2, p. 10), 5,88 por ciento por debajo de el valor medido');
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
    expect(src).toMatch(/showInset = insetH - insetHead\(pw\) >= INSET_MIN_PX/);
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
    expect(textOf(renderToStaticMarkup(<LabNote run={run} />))).toContain(run.machine.name);
  });
});

describe('the stage: colours, labels and the drawing of a frame', () => {
  it('the sequential scale runs through three shell tokens, the same tokens in both themes', () => {
    expect(parseHex('#56d4e5')).toEqual([0x56, 0xd4, 0xe5]);
    expect(parseHex('#abc')).toEqual([0xaa, 0xbb, 0xcc]);
    expect(parseHex('red')).toBeNull();
    const s = sequentialScale(['#000000', '#ffffff'], 3);
    expect(s).toEqual(['#000000', '#808080', '#ffffff']);
    expect(sequentialScale(['#ff0000', '#00ff00', '#0000ff'], 5)[2]).toBe('#00ff00');
    expect(sequentialScale(['nope', '#ffffff'], 2, '#101010')[0]).toBe('#101010');
    const tokens = new Proxy({}, { get: (_t, k) => (k === '--color-step-1' ? '#000000' : k === '--color-step-3' ? '#808080' : '#ffffff') }) as never;
    expect(paletteOf(tokens)).toHaveLength(6);
  });
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
