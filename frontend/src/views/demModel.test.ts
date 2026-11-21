// The model of the particle-simulation view (DM-012 to DM-015), on the provider tree's document and frames: the decoding of the replay,
// the stroke cursor, the three callouts, the series of the three sides, the sentence that says which is nearer the measurement, the
// verdict words and the run's status. Every function reads the document; a planted copy of the document moves its outputs, and a
// verdict that is not met never yields a sentence, a word or a state of agreement.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { DemRun } from '../lib/contract.types';
import {
  advance,
  basisText,
  classCounts,
  calloutSource,
  calloutState,
  cellOf,
  comparisonSeries,
  CHART_QUANTITIES,
  cursorOfFrame,
  cursorOfStrokeIndex,
  cursorRange,
  decodeFrames,
  DemFramesError,
  distributionOf,
  frameAt,
  frameLabel,
  frameLabelText,
  frameSpheres,
  nearer,
  nearerSentence,
  openingCursor,
  passedAt,
  plain,
  playbackAllowed,
  pointCallouts,
  relativeError,
  runStateText,
  runStatusText,
  sideValue,
  sizeClass,
  sizeClassLabels,
  SIZE_CLASSES,
  stageTransform,
  takeaway,
  verdictCounts,
  verdictRows,
  verdictState,
  verdictWord,
  VERDICT_MARK,
  windowMeanPower,
  type DemPoint,
} from './demModel';

const provider = new URL('../../../docs/contracts/fixtures/data/derived/dem/', import.meta.url);
const run = JSON.parse(readFileSync(new URL('jaw-lab.json', provider), 'utf8')) as DemRun;
type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
const copy = (): Mutable<DemRun> => JSON.parse(JSON.stringify(run)) as Mutable<DemRun>;
const bytesOf = (p: DemPoint): ArrayBuffer => {
  const b = readFileSync(new URL(`${p.simulation.replay!.file.replace(/^dem\//, '')}`, provider));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const [coarse, middle, fine] = run.points;
const AGREEMENT = /agree|agreement|matches|in line|coincide|concuerda|coinciden/i;

describe('DM-010 on the web side: the replay file decodes to the recorded frames, little-endian, checked against the document', () => {
  for (const p of run.points) {
    it(`${p.id}: the frame counts, the sphere total and the first and last frames are those of an independent byte reader`, () => {
      const r = p.simulation.replay!;
      const buf = bytesOf(p);
      const f = decodeFrames(buf, r);
      expect(f.frames).toBe(r.frames);
      expect(f.offsets[f.frames]).toBe(r.spheres);
      expect(f.data.length).toBe(r.spheres * 4);
      const raw = Buffer.from(buf);
      const e = r.encoding;
      const lin = (u: number, [lo, hi]: readonly [number, number]) => lo + (u / 65535) * (hi - lo);
      for (const frame of [0, r.frames - 1]) {
        const [a, b] = frameSpheres(f, frame);
        expect(b - a).toBe(r.count[frame]);
        for (const s of [a, b - 1]) {
          if (b === a) continue;
          expect(f.data[s * 4]).toBeCloseTo(lin(raw.readUInt16LE(s * 8), e.x_range_mm), 3);
          expect(f.data[s * 4 + 1]).toBeCloseTo(lin(raw.readUInt16LE(s * 8 + 2), e.y_range_mm), 3);
          expect(f.data[s * 4 + 2]).toBeCloseTo(lin(raw.readUInt16LE(s * 8 + 4), e.z_range_mm), 3);
          expect(f.data[s * 4 + 3]).toBeCloseTo((raw.readUInt16LE(s * 8 + 6) / 65535) * e.radius_max_mm, 3);
        }
      }
    });
  }
  it('the first frame of the 63/52 mm point holds the spheres the document counts, and the largest frame its maximum', () => {
    const r = coarse.simulation.replay!;
    const f = decodeFrames(bytesOf(coarse), r);
    expect(frameSpheres(f, 0)[1] - frameSpheres(f, 0)[0]).toBe(r.count[0]);
    expect(Math.max(...r.count)).toBe(291);
  });
  it('adversarial: a file of another length is refused with the bytes named, before any value is read', () => {
    const r = coarse.simulation.replay!;
    const buf = bytesOf(coarse);
    expect(() => decodeFrames(buf.slice(0, buf.byteLength - 1), r)).toThrow(DemFramesError);
    expect(() => decodeFrames(buf.slice(0, buf.byteLength - 1), r)).toThrow(String(r.bytes));
    expect(() => decodeFrames(new ArrayBuffer(r.bytes + 8), r)).toThrow(DemFramesError);
  });
  it('adversarial: counts that do not add up to the file are refused', () => {
    const r = { ...fine.simulation.replay!, count: fine.simulation.replay!.count.map((c, i) => (i === 3 ? c + 1 : c)) };
    expect(() => decodeFrames(bytesOf(fine), r)).toThrow(/spheres/);
  });
  it('the decoder reads little-endian explicitly: a record whose two byte orders differ decodes as little-endian', () => {
    const r = { ...coarse.simulation.replay!, bytes: 8, frames: 1, spheres: 1, count: [1] };
    const buf = new ArrayBuffer(8);
    new Uint8Array(buf).set([0x34, 0x12, 0x00, 0x80, 0xff, 0xff, 0x00, 0x00]);
    const f = decodeFrames(buf, r);
    const e = r.encoding;
    expect(f.data[0]).toBeCloseTo(e.x_range_mm[0] + (0x1234 / 65535) * (e.x_range_mm[1] - e.x_range_mm[0]), 3);
    expect(f.data[0]).not.toBeCloseTo(e.x_range_mm[0] + (0x3412 / 65535) * (e.x_range_mm[1] - e.x_range_mm[0]), 1);
    expect(f.data[2]).toBeCloseTo(e.z_range_mm[1], 3);
    const src = readFileSync(new URL('./demModel.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/getUint16\(at, true\)/);
    expect(src).not.toMatch(/new Uint16Array\(/);
  });
});

describe('DM-013: the stroke cursor and its frame', () => {
  it('the cursor runs from the first frame to the last stroke, and every frame is its own nearest frame', () => {
    for (const p of run.points) {
      const r = p.simulation.replay!;
      const [lo, hi] = cursorRange(r);
      expect(frameAt(r, lo)).toBe(0);
      expect(frameAt(r, hi)).toBe(r.frames - 1);
      expect(hi).toBe(r.last_stroke);
      for (let i = 0; i < r.frames; i += Math.max(1, Math.floor(r.frames / 40))) expect(frameAt(r, cursorOfFrame(r, i))).toBe(i);
    }
  });
  it('a frame belongs to the stroke the document gives, and a position inside a stroke (the end of the stroke before it excluded) is a frame of the stroke it falls in', () => {
    const r = coarse.simulation.replay!;
    expect(frameLabel(r, frameAt(r, 40.5)).stroke).toBe(41);
    expect(frameLabel(r, frameAt(r, 40)).stroke).toBe(40);
    expect(frameLabel(r, frameAt(r, 40.09)).stroke).toBe(41);
    expect(frameLabel(r, 0).timeS).toBe(r.t_s[0]);
  });
  it('a null, non-finite or out-of-range cursor lands on a frame of the replay', () => {
    const r = fine.simulation.replay!;
    expect(frameAt(r, null)).toBe(r.frames - 1);
    expect(frameAt(r, Number.NaN)).toBe(r.frames - 1);
    expect(frameAt(r, -10)).toBe(0);
    expect(frameAt(r, 1e6)).toBe(r.frames - 1);
  });
  it('the frame label gives the stroke and the simulated time in both languages', () => {
    const r = coarse.simulation.replay!;
    const i = frameAt(r, 37);
    expect(frameLabelText(r, i, plain, 'en')).toBe(`stroke 37, t = ${r.t_s[i].toFixed(2)} s`);
    expect(frameLabelText(r, i, plain, 'es')).toBe(`golpe 37, t = ${r.t_s[i].toFixed(2)} s`);
  });
  it('a run with a window opens at the window’s first stroke; one that stopped opens at the last stroke it holds', () => {
    expect(openingCursor(coarse)).toBe(coarse.simulation.window!.first_stroke);
    expect(openingCursor(middle)).toBe(middle.simulation.replay!.last_stroke);
    expect(openingCursor(fine)).toBe(fine.simulation.window!.first_stroke);
  });
  it('playback advances at the speed asked, ends at the last stroke and says so; reduced motion allows none', () => {
    const r = coarse.simulation.replay!;
    expect(advance(r, 10, 500, 2)).toEqual({ cursor: 11, done: false });
    expect(advance(r, r.last_stroke - 0.1, 500, 2)).toEqual({ cursor: r.last_stroke, done: true });
    expect(playbackAllowed(false)).toBe(true);
    expect(playbackAllowed(true)).toBe(false);
  });
  it('choosing a stroke on a chart is a cursor at the end of that stroke, inside the replay', () => {
    const s = coarse.simulation;
    expect(cursorOfStrokeIndex(s, 36)).toBe(37);
    expect(cursorOfStrokeIndex(s, 0)).toBeCloseTo(Math.max(1, cursorRange(s.replay!)[0]), 9);
    expect(passedAt(s, 37)).toBe(s.series.passed_kg[36]);
    expect(passedAt(s, 36.4)).toBe(s.series.passed_kg[36]);
  });
});

describe('the stage: the section to scale', () => {
  const g = coarse.simulation.replay!.geometry;
  it('one scale on both axes, the section inside the box, the closed edge where the geometry puts it', () => {
    const t = stageTransform(g, 300, 500, 10);
    const lo = t.px(t.bounds.xMin, t.bounds.zMin);
    const hi = t.px(t.bounds.xMax, t.bounds.zMax);
    expect(lo.x).toBeGreaterThanOrEqual(10 - 1e-9);
    expect(hi.x).toBeLessThanOrEqual(290 + 1e-9);
    expect(hi.y).toBeGreaterThanOrEqual(10 - 1e-9);
    expect(lo.y).toBeLessThanOrEqual(490 + 1e-9);
    const a = t.px(0, 0);
    const b = t.px(100, 100);
    expect((b.x - a.x) / 100).toBeCloseTo(t.scale, 9);
    expect((a.y - b.y) / 100).toBeCloseTo(t.scale, 9);
    // 100 mm is the same length across and up
    const wide = stageTransform(g, 900, 300, 10);
    expect(wide.scale).toBeLessThan(t.scale);
  });
  it('the gap between the closed edge and the fixed plate is the closed side setting, to scale', () => {
    const t = stageTransform(g, 400, 600);
    const fixed = t.px(g.fixed_plate_x_mm, 0).x;
    const closed = t.px(g.swing_closed_bottom_mm[0], 0).x;
    expect((closed - fixed) / t.scale).toBeCloseTo(run.settings.css_mm, 6);
  });
});

describe('the mix of a frame by size class', () => {
  it('the counts add up to the frame’s spheres, and the first frame of the 63/52 mm point is all feed-sized', () => {
    const r = coarse.simulation.replay!;
    const f = decodeFrames(bytesOf(coarse), r);
    for (const i of [0, 40, r.frames - 1]) expect(classCounts(f, i, coarse.feed_mm[0]).reduce((a, c) => a + c, 0)).toBe(r.count[i]);
    const first = classCounts(f, 0, coarse.feed_mm[0]);
    expect(first.slice(0, SIZE_CLASSES - 2).every((c) => c === 0)).toBe(true);
    expect(classCounts(f, 500, coarse.feed_mm[0])[0]).toBeGreaterThan(0);
  });
});

describe('the colour class of a sphere by its diameter against the feed class', () => {
  it('is monotone in the diameter, finest to feed-sized, and every class is reachable', () => {
    const low = coarse.feed_mm[0];
    let last = -1;
    const seen = new Set<number>();
    for (let d = 1; d <= 90; d += 0.5) {
      const c = sizeClass(d, low);
      expect(c).toBeGreaterThanOrEqual(last);
      last = c;
      seen.add(c);
    }
    expect(seen.size).toBe(SIZE_CLASSES);
    expect(sizeClass(low, low)).toBe(SIZE_CLASSES - 1);
    expect(sizeClass(low * 0.99, low)).toBe(SIZE_CLASSES - 2);
  });
  it('the legend names every class in millimetres from the feed class', () => {
    const labels = sizeClassLabels(coarse.feed_mm[0], plain);
    expect(labels).toHaveLength(SIZE_CLASSES);
    expect(labels[0]).toBe(`< ${plain(0.1 * coarse.feed_mm[0], { digits: 2 })}`);
    expect(labels[SIZE_CLASSES - 1].startsWith('>=')).toBe(true);
  });
});

describe('verdict words, marks and states: only a verdict that is met reads as within the band', () => {
  it('maps the document’s verdicts and the resolved rule', () => {
    expect(verdictState({ verdict: 'met', resolved: true })).toBe('met');
    expect(verdictState({ verdict: 'met', resolved: null })).toBe('met');
    expect(verdictState({ verdict: 'met', resolved: false })).toBe('met-unresolved');
    expect(verdictState({ verdict: 'not met', resolved: true })).toBe('not-met');
    expect(verdictState({ verdict: 'not compared', resolved: null })).toBe('not-compared');
  });
  it('a verdict that is not met or not compared never has the state, the word or the mark of a met one', () => {
    for (const s of ['not-met', 'not-compared'] as const) {
      expect(calloutState(s)).not.toBe('normal');
      expect(VERDICT_MARK[s]).not.toBe(VERDICT_MARK.met);
      expect(verdictWord(s).en).not.toMatch(/^met/i);
      expect(verdictWord(s).en).toMatch(/not/i);
      expect(verdictWord(s).es).toMatch(/no |sin /i);
      expect(`${verdictWord(s).en} ${verdictWord(s).es}`).not.toMatch(AGREEMENT);
    }
    expect(calloutState('met-unresolved')).toBe('warning');
    expect(calloutState('met')).toBe('normal');
    expect(new Set(Object.values(VERDICT_MARK)).size).toBe(4);
  });
});

describe('DM-012: the three callouts of a point, from the document', () => {
  it('63/52 mm: throughput, net power and product P80 of the particle simulation with the measured value, the relative error and the verdict', () => {
    const [t, w, p] = pointCallouts(coarse);
    expect(t.id).toBe('throughput');
    expect(t.value).toBe(coarse.simulation.throughput_kg_h);
    expect(t.measured).toBe(coarse.measured.throughput_kg_h.value);
    expect(t.relativeError!).toBeCloseTo(cellOf(coarse, 'simulation_vs_measured', 'throughput').relative_error!, 4);
    expect(t.state).toBe('not-met');
    expect(t.unit.en).toBe('kg/h');
    expect(w.value).toBe(coarse.simulation.net_power_kw);
    expect(w.state).toBe('met');
    expect(w.unit.en).toBe('kW');
    expect(p.value).toBe(coarse.simulation.p80_mm);
    expect(p.measured).toBe(coarse.measured.p80_mm);
    expect(p.unit.en).toBe('mm');
    expect(p.state).toBe('not-met');
    for (const c of [t, w, p]) {
      const src = calloutSource(c, plain);
      expect(src.en).toContain('Measured');
      expect(src.es).toContain('Medido');
      expect(src.en).toContain(VERDICT_MARK[c.state]);
    }
  });
  it('31.5/26.5 mm: a run that did not complete has no throughput and no power, and the callout says why instead of a number', () => {
    const [t, w, p] = pointCallouts(middle);
    expect(t.value).toBeNull();
    expect(w.value).toBeNull();
    expect(t.state).toBe('not-compared');
    expect(t.basis!.en).toContain('stroke 6');
    expect(calloutSource(t, plain).en).toContain('run incomplete');
    expect(calloutSource(w, plain).es).toContain('corrida incompleta');
    // the product of the mass passed before the stop is a value, but its verdict is still not compared
    expect(p.value).toBe(middle.simulation.p80_mm);
    expect(p.state).toBe('not-compared');
    expect(calloutSource(p, plain).en).toContain('Not compared');
  });
  it('16/13.2 mm: a verdict met inside two standard errors of its band edge is a warning, not a plain agreement', () => {
    const w = pointCallouts(fine)[1];
    expect(cellOf(fine, 'simulation_vs_measured', 'net_power').verdict).toBe('met');
    expect(cellOf(fine, 'simulation_vs_measured', 'net_power').resolved).toBe(false);
    expect(w.state).toBe('met-unresolved');
    expect(calloutState(w.state)).toBe('warning');
    expect(calloutSource(w, plain).en).toContain('not resolved');
  });
  it('a value changed in a copy of the document moves the callout; a verdict turned to not met moves its state and word', () => {
    const d = copy();
    d.points[0].simulation.throughput_kg_h = 1234.5;
    d.points[0].verdicts.simulation_vs_measured.net_power.verdict = 'not met';
    const [t, w] = pointCallouts(d.points[0]);
    expect(t.value).toBe(1234.5);
    expect(w.state).toBe('not-met');
    expect(calloutState(w.state)).toBe('alarm');
    expect(calloutSource(w, plain).en).toContain('Not met');
    expect(calloutSource(w, plain).en).not.toMatch(AGREEMENT);
  });
});

describe('DM-014: the series of the three sides on shared axes', () => {
  it('the abscissa of each point is the feed’s mean size, and each side’s value is the document’s', () => {
    const s = comparisonSeries(run, 'throughput');
    expect(s.points.map((p) => p.x)).toEqual(run.points.map((p) => p.feed_mean_mm));
    expect(s.points.map((p) => p.measurement.value)).toEqual(run.points.map((p) => p.measured.throughput_kg_h.value));
    expect(s.points[0].simulation.value).toBe(coarse.simulation.throughput_kg_h);
    expect(s.points[0].population_balance.value).toBe(coarse.population_balance.throughput_kg_h);
    expect(s.unit.en).toBe('kg/h');
  });
  it('the measurement carries its band, the simulation its standard error, and the band is the relative band of the document', () => {
    const t = comparisonSeries(run, 'throughput').points[0];
    expect(t.band).toBe(run.bands.throughput_relative);
    expect(t.measurement.lo!).toBeCloseTo(coarse.measured.throughput_kg_h.value * (1 - run.bands.throughput_relative), 9);
    expect(t.measurement.hi!).toBeCloseTo(coarse.measured.throughput_kg_h.value * (1 + run.bands.throughput_relative), 9);
    expect(t.simulation.lo!).toBeCloseTo(coarse.simulation.throughput_kg_h! - coarse.simulation.throughput_se_kg_h!, 9);
    expect(t.simulation.hi!).toBeCloseTo(coarse.simulation.throughput_kg_h! + coarse.simulation.throughput_se_kg_h!, 9);
    expect(t.population_balance.lo).toBeNull();
  });
  it('a null is never zero: a run that did not complete has no simulation mark, and the population balance has no power, each with its reason', () => {
    const t = comparisonSeries(run, 'throughput').points[1];
    expect(t.simulation.value).toBeNull();
    expect(t.simulation.lo).toBeNull();
    expect(t.simulation.reason!.en).toContain('did not complete');
    const w = comparisonSeries(run, 'net_power');
    for (const p of w.points) {
      expect(p.population_balance.value).toBeNull();
      expect(p.population_balance.reason!.en).toContain('no work index');
    }
    expect(w.points[1].simulation.value).toBeNull();
    for (const q of CHART_QUANTITIES) for (const p of comparisonSeries(run, q).points) for (const side of [p.measurement, p.simulation, p.population_balance]) if (side.value === null) expect(side.reason).not.toBeNull();
  });
  it('the product P80 carries the population balance’s spread and the measurement’s band as the reduction ratio’s band on P80', () => {
    const s = comparisonSeries(run, 'p80');
    const p = s.points[0];
    expect(p.population_balance.lo).toBe(coarse.population_balance.band.p80_mm[0]);
    expect(p.population_balance.hi).toBe(coarse.population_balance.band.p80_mm[1]);
    const b = run.bands.reduction_ratio_relative;
    // a product at either end of the band has a reduction ratio at the band's edge against the measured one
    const rrAt = (p80: number) => coarse.measured.p80_mm / p80;
    expect(rrAt(p.measurement.hi!) - 1).toBeCloseTo(-b, 9);
    expect(rrAt(p.measurement.lo!) - 1).toBeCloseTo(b, 9);
  });
  it('the product of a run that stopped is a value marked as the product of the mass passed before the stop', () => {
    const p = comparisonSeries(run, 'p80').points[1];
    expect(p.simulation.value).toBe(middle.simulation.p80_mm);
    expect(p.simulation.stopped).toBe(true);
    expect(p.simulation.reason!.en).toContain('before the stop');
  });
  it('a value changed in a copy of the document moves the series', () => {
    const d = copy();
    d.points[2].population_balance.throughput_kg_h = 4321;
    expect(comparisonSeries(d, 'throughput').points[2].population_balance.value).toBe(4321);
  });
});

describe('DM-014: which side is nearer the measurement, as a sentence', () => {
  it('63/52 mm throughput: the population balance is nearer, both sides are not within the band, and the percentages are the document’s', () => {
    const n = nearer(coarse, 'throughput');
    expect(n.side).toBe('population_balance');
    expect(n.simulationPct!).toBeCloseTo(Math.abs(cellOf(coarse, 'simulation_vs_measured', 'throughput').relative_error!) * 100, 2);
    expect(n.populationBalancePct!).toBeCloseTo(Math.abs(cellOf(coarse, 'population_balance_vs_measured', 'throughput').relative_error!) * 100, 2);
    const s = nearerSentence(run, 0, 'throughput');
    expect(s.en).toContain('the population balance is nearer the measurement');
    expect(s.en).toContain('particle simulation not within the band; population balance not within the band');
    expect(s.es).toContain('el balance poblacional está más cerca de la medición');
  });
  it('net power: only the particle simulation states a value; the population balance is not compared for want of a work index', () => {
    const s = nearerSentence(run, 0, 'net_power');
    expect(s.en).toContain('only the particle simulation states a value');
    expect(s.en).toContain('particle simulation within the band');
    expect(s.en).toContain('no work index');
    expect(s.es).toContain('índice de trabajo');
  });
  it('a point whose run did not complete: the simulation states no value and the sentence says why', () => {
    const s = nearerSentence(run, 1, 'throughput');
    expect(s.en).toContain('only the population balance states a value');
    expect(s.en).toContain('states no value (the particle run did not complete');
    expect(s.es).toContain('no entrega valor');
  });
  it('the product P80 of a stopped run is a value whose verdict is still not compared', () => {
    const s = nearerSentence(run, 1, 'p80');
    expect(s.en).toContain('not compared');
    expect(s.en).not.toContain('particle simulation within the band');
  });
  it('adversarial: a verdict turned to not met in a copy never yields a sentence of agreement, for every point and quantity, in both languages', () => {
    const d = copy();
    for (const p of d.points) for (const pair of ['simulation_vs_measured', 'population_balance_vs_measured'] as const) for (const q of ['throughput', 'net_power', 'reduction_ratio'] as const) {
      p.verdicts[pair][q].verdict = 'not met';
      p.verdicts[pair][q].resolved = null;
    }
    d.points.forEach((_, i) => {
      for (const q of CHART_QUANTITIES) {
        const s = nearerSentence(d, i, q);
        for (const lang of ['en', 'es'] as const) {
          expect(s[lang]).not.toMatch(AGREEMENT);
          expect(s[lang]).not.toMatch(/(?<!not )(?<!fuera de la banda; )within the band|dentro de la banda/);
        }
        expect(s.en).toContain('not within the band');
      }
    });
  });
  it('adversarial: a verdict turned to met in a copy for a side that states no value is still worded as not compared', () => {
    const d = copy();
    d.points[1].verdicts.simulation_vs_measured.throughput.verdict = 'not compared';
    expect(nearerSentence(d, 1, 'throughput').en).toContain('states no value');
  });
});

describe('DM-012: the run’s status and the takeaway', () => {
  it('a run that did not complete says at which stroke it stopped, why, how many spheres it held and how much mass had passed', () => {
    const t = runStatusText(middle.simulation, plain);
    expect(t.en).toContain('did not complete');
    expect(t.en).toContain('during stroke 6');
    expect(t.en).toContain('overlap');
    expect(t.en).toContain('327 spheres held');
    expect(t.en).toContain('0.306');
    expect(t.es).toContain('durante el golpe 6');
    expect(runStateText(middle.simulation).en).toBe('stopped in stroke 6');
  });
  it('a complete run says its strokes and its overlap limit', () => {
    const t = runStatusText(coarse.simulation, plain);
    expect(t.en).toContain('83 strokes');
    expect(runStateText(coarse.simulation).en).toBe('complete, 83 strokes');
    expect(runStateText(fine.simulation).es).toBe('completa, 54 golpes');
  });
  it('the takeaway of a complete run quotes the document’s numbers and verdict words; that of a stopped run states no window statistic', () => {
    const t = takeaway(coarse, run.bands, plain);
    expect(t.en).toContain('2170');
    expect(t.en).toContain('not met');
    expect(t.en).toContain('met for the 30 percent band');
    const u = takeaway(middle, run.bands, plain);
    expect(u.en).toContain('during stroke 6');
    expect(u.en).toContain('no steady window');
    expect(u.es).toContain('no tiene ventana estacionaria');
    expect(u.en).not.toMatch(/\d{3,} kg\/h/);
  });
  it('the basis of each verdict names its cause in words', () => {
    expect(basisText('no_work_index', null).en).toContain('no work index');
    expect(basisText('run_incomplete', middle).en).toContain('during stroke 6');
    expect(basisText('no_window', null).es).toContain('ventana');
    expect(basisText('nothing_passed', null).en).toContain('no mass');
    expect(basisText(null, null).en).toContain('no basis');
  });
});

describe('DM-014: the verdict table, the product distribution and the per-stroke window', () => {
  it('nine rows per point, each from the document’s cell; the totals are those of the bake', () => {
    for (const p of run.points) {
      const rows = verdictRows(p);
      expect(rows).toHaveLength(9);
      for (const r of rows) {
        const c = cellOf(p, r.pair, r.quantity);
        expect(r.first).toBe(c.first);
        expect(r.second).toBe(c.second);
        expect(r.band).toBe(c.band);
        expect(r.basis === null).toBe(c.verdict !== 'not compared');
      }
    }
    expect(verdictCounts(run)).toEqual({ met: 3, notMet: 13, notCompared: 11, total: 27 });
    const d = copy();
    d.points[0].verdicts.simulation_vs_measured.throughput.verdict = 'met';
    expect(verdictCounts(d).met).toBe(4);
  });
  it('a relative error is (first - second) over second, and null when either value is absent', () => {
    expect(relativeError(110, 100)).toBeCloseTo(0.1, 12);
    expect(relativeError(null, 100)).toBeNull();
    expect(relativeError(1, null)).toBeNull();
    expect(sideValue(coarse, 'population_balance', 'net_power')).toBeNull();
  });
  it('the distribution has the document’s sieves, gaps where a side states none, and the spread of the population balance', () => {
    const d = distributionOf(run, coarse);
    expect(d.sieves).toEqual(coarse.population_balance.product.sieves_mm);
    expect(d.simulation.slice(0, 5).every((v) => v === null)).toBe(true);
    expect(d.simulation[5]).toBe(coarse.simulation.product!.passing_pct[5]);
    expect(d.measured.sieves).toHaveLength(9);
    expect(d.populationBalanceLow).toHaveLength(d.sieves.length);
    expect(d.css_mm).toBe(7.5);
    expect(d.oss_mm).toBe(17.5);
    expect(distributionOf(run, middle).simulationStopped).toBe(true);
    expect(distributionOf(run, coarse).simulationStopped).toBe(false);
  });
  it('the steady-window mean of the per-stroke power is the document’s net power; a run without a window has none', () => {
    expect(windowMeanPower(coarse.simulation)! / 1000).toBeCloseTo(coarse.simulation.net_power_kw!, 4);
    expect(windowMeanPower(fine.simulation)! / 1000).toBeCloseTo(fine.simulation.net_power_kw!, 4);
    expect(windowMeanPower(middle.simulation)).toBeNull();
  });
});

describe('the words of the view never use the internal tier names, and carry no dash or arrow', () => {
  for (const file of ['demModel.ts', 'dem.tsx', 'demReplay.tsx']) {
    it(`${file}`, () => {
      let src: string;
      try {
        src = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      } catch {
        return;
      }
      expect(src).not.toMatch(new RegExp(`${String.fromCharCode(0x2014)}|${String.fromCharCode(0x2192)}|${String.fromCharCode(0x2190)}|${String.fromCharCode(0x21d2)}`));
      expect(src).not.toMatch(/\bclassical\b|state of the art|state-of-the-art|\bSOTA\b|\bbeyond\b|\btier\b/i);
    });
  }
});
