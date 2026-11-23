// The rules that decide the layout of the particle-simulation view (DM-017; B1 to B3, M1 and M2 of the independent visual review), as pure
// functions over measured boxes and strings. src/views/dem.browser.mjs measures a built page and hands the numbers to them; vitest hands them
// planted numbers, so the rules themselves are tested: each returns the problems it finds (an empty list is a pass), each problem a sentence
// that names what was measured.

/** @typedef {{ left: number, right: number, top: number, bottom: number }} Box */

const TOL = 1;

/**
 * B1: every column of the verdict table stands inside its card and the summary sentence is whole.
 * On a desktop each header cell lies between the card's left and right edges (a column scrolled off to the side is a problem) and the table
 * does not scroll sideways; on a phone the table is restacked, so no wrapper scrolls sideways and no cell lies outside the card.
 * @param {{ card: Box, columns: { name: string, left: number, right: number }[], wrapper: { scrollWidth: number, clientWidth: number }, summary: Box & { scrollWidth: number, clientWidth: number, text: string }, stacked: boolean }} m
 * @returns {string[]}
 */
export function verdictLayoutProblems(m) {
  const out = [];
  for (const c of m.columns) {
    if (c.left < m.card.left - TOL || c.right > m.card.right + TOL) out.push(`the column "${c.name}" lies outside its card (${Math.round(c.left)} to ${Math.round(c.right)} px, the card ${Math.round(m.card.left)} to ${Math.round(m.card.right)} px)`);
  }
  if (m.wrapper.scrollWidth > m.wrapper.clientWidth + TOL) out.push(`the table scrolls sideways (${m.wrapper.scrollWidth} px of content in ${m.wrapper.clientWidth} px)${m.stacked ? ', and on a phone it must be restacked' : ''}`);
  const s = m.summary;
  if (s.left < m.card.left - TOL || s.right > m.card.right + TOL) out.push(`the summary sentence lies outside its card (${Math.round(s.left)} to ${Math.round(s.right)} px)`);
  if (s.scrollWidth > s.clientWidth + TOL) out.push(`the summary sentence is cut (${s.scrollWidth} px of text in ${s.clientWidth} px)`);
  if (!s.text || !/\d/.test(s.text)) out.push('the summary sentence holds no count');
  return out;
}

/**
 * B3: no two labels of one axis overlap (the boxes of the tick labels, in one coordinate system).
 * @param {{ text: string, left: number, right: number, top: number, bottom: number }[]} labels
 * @returns {string[]}
 */
export function labelOverlapProblems(labels) {
  const out = [];
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i];
      const b = labels[j];
      if (a.left < b.right - TOL && b.left < a.right - TOL && a.top < b.bottom - TOL && b.top < a.bottom - TOL) out.push(`the labels "${a.text}" and "${b.text}" overlap`);
    }
  }
  return out;
}

/**
 * B2: a mark of a side without a value lies outside the plotting range: no part of it may intersect the plot's box.
 * @param {{ id: string, box: Box }[]} marks the marks drawn for sides that state no value
 * @param {Box} plot the plot area of the chart the marks belong to
 * @returns {string[]}
 */
export function nullMarkProblems(marks, plot) {
  const out = [];
  for (const m of marks) {
    const inside = m.box.left < plot.right - TOL && m.box.right > plot.left + TOL && m.box.top < plot.bottom - TOL && m.box.bottom > plot.top + TOL;
    if (inside) out.push(`the mark of "${m.id}", a side with no value, lies inside the plotting range (${Math.round(m.box.top)} to ${Math.round(m.box.bottom)} px against the plot ${Math.round(plot.top)} to ${Math.round(plot.bottom)} px)`);
  }
  return out;
}

/**
 * M1: the replay stage's own box is at least `min` of the App route's viewport.
 * @param {{ width: number, height: number }} stage
 * @param {{ width: number, height: number }} viewport
 * @param {number} [min]
 * @returns {string[]}
 */
export function stageShareProblems(stage, viewport, min = 0.6) {
  const share = (stage.width * stage.height) / (viewport.width * viewport.height);
  return share + 1e-9 >= min ? [] : [`the replay stage is ${(share * 100).toFixed(1)} percent of the viewport (${Math.round(stage.width)} by ${Math.round(stage.height)} px of ${viewport.width} by ${viewport.height}), at least ${Math.round(min * 100)} percent is required`];
}

/** The share of the viewport the stage takes, for the report. */
export const stageShare = (stage, viewport) => (stage.width * stage.height) / (viewport.width * viewport.height);

/**
 * F5: no two chart roots of the view overlap: every pair of boxes (the `.uplot` roots, each with its plot, tick labels, axis title, key and hint) is disjoint.
 * @param {{ id: string, box: Box }[]} roots
 * @returns {string[]}
 */
export function chartOverlapProblems(roots) {
  const out = [];
  for (let i = 0; i < roots.length; i++) {
    for (let j = i + 1; j < roots.length; j++) {
      const a = roots[i].box;
      const b = roots[j].box;
      if (a.left < b.right - TOL && b.left < a.right - TOL && a.top < b.bottom - TOL && b.top < a.bottom - TOL) out.push(`the chart ${roots[i].id} (${Math.round(a.top)} to ${Math.round(a.bottom)} px) and the chart ${roots[j].id} (${Math.round(b.top)} to ${Math.round(b.bottom)} px) overlap`);
    }
  }
  return out;
}

/**
 * M2: on the Spanish page no number is written with a decimal point outside the blocks marked as the document's or the package's own English
 * words. A version or a section number with two dots, a DOI and a thousands group (2.167) are not decimals (the shell's gate reads them the same way).
 * @param {{ text: string, quoted: boolean }[]} texts the text nodes of the view with whether each is inside a block marked lang="en"
 * @returns {string[]}
 */
export function decimalProblems(texts) {
  const out = [];
  for (const t of texts) {
    if (t.quoted) continue;
    for (const m of t.text.matchAll(/(?<![\w.,/:@#])(\d+)\.(\d+)(?![\w@]|\.\d|\/[A-Za-z])/g)) {
      // a thousands group of the Spanish locale (1 to 3 digits, not starting with 0, then groups of exactly 3) is not a decimal
      const token = t.text.slice(m.index).match(/^\d+(?:\.\d+)+/)?.[0] ?? m[0];
      const after = t.text.slice(m.index + token.length);
      // 1.234 kW is a decimal (the values of this view in kW, mm, kg, s and % never reach a thousand); 2.167 kg/h is a thousands group
      const smallUnit = /^\s*(?:kW|mm|kg(?!\/)|s|%)(?![A-Za-z])/.test(after);
      if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(token) && !smallUnit) continue;
      out.push(`"${t.text.trim().slice(0, 60)}" writes ${m[0]} with a decimal point`);
    }
  }
  return out;
}

/**
 * F2: the "no value" texts of a comparison chart's strip overlap no tick label, no axis title and no other "no value" text, and lie outside the
 * plotting range.
 * @param {{ id: string, box: Box }[]} strip the "no value" texts
 * @param {{ text: string, box: Box }[]} others the tick labels and the axis title of the chart
 * @param {Box} plot
 * @returns {string[]}
 */
export function noValueStripProblems(strip, others, plot) {
  const out = [];
  const hit = (a, b) => a.left < b.right - TOL && b.left < a.right - TOL && a.top < b.bottom - TOL && b.top < a.bottom - TOL;
  for (let i = 0; i < strip.length; i++) {
    for (let j = i + 1; j < strip.length; j++) if (hit(strip[i].box, strip[j].box)) out.push(`the "no value" texts of ${strip[i].id} and ${strip[j].id} overlap`);
    for (const o of others) if (hit(strip[i].box, o.box)) out.push(`the "no value" text of ${strip[i].id} overlaps "${o.text}"`);
  }
  out.push(...nullMarkProblems(strip, plot));
  return out;
}

/**
 * F4: the first screen shows the drawing. At 1280 by 800 the drawing region is at least `minDrawing` of the viewport's area, the magnified
 * zone and the section are each at least `minHeight` px high, and the stage card is at least `minCard` of the viewport.
 * @param {{ card: { width: number, height: number }, drawing: { width: number, height: number }, section: { height: number }, zone: { height: number } }} m
 * @param {{ width: number, height: number }} viewport
 * @param {{ minDrawing?: number, minHeight?: number, minCard?: number }} [limits]
 * @returns {string[]}
 */
export function stageGeometryProblems(m, viewport, limits = {}) {
  const { minDrawing = 0.4, minHeight = 380, minCard = 0.6 } = limits;
  const out = [];
  const share = stageShare(m.drawing, viewport);
  if (share + 1e-9 < minDrawing) out.push(`the drawing region is ${(share * 100).toFixed(1)} percent of the viewport (${Math.round(m.drawing.width)} by ${Math.round(m.drawing.height)} px), at least ${Math.round(minDrawing * 100)} percent is required`);
  if (m.zone.height < minHeight) out.push(`the magnified zone is ${Math.round(m.zone.height)} px high, at least ${minHeight} px is required`);
  if (m.section.height < minHeight) out.push(`the section is ${Math.round(m.section.height)} px high, at least ${minHeight} px is required`);
  for (const p of stageShareProblems(m.card, viewport, minCard)) out.push(p.replace('the replay stage', 'the stage card'));
  return out;
}

/**
 * R1: the end of every callout's leader lies inside its subject's drawn box (or within `tol` px of it), and no two leader ends are closer than
 * `minGap` px.
 * @param {{ id: string, end: { x: number, y: number }, box: Box }[]} leaders
 * @param {number} [tol]
 * @param {number} [minGap]
 * @returns {string[]}
 */
export function leaderProblems(leaders, tol = 4, minGap = 20) {
  const out = [];
  for (const l of leaders) {
    const inside = l.end.x >= l.box.left - tol && l.end.x <= l.box.right + tol && l.end.y >= l.box.top - tol && l.end.y <= l.box.bottom + tol;
    if (!inside) out.push(`the leader of "${l.id}" ends at (${Math.round(l.end.x)}, ${Math.round(l.end.y)}), outside its subject (${Math.round(l.box.left)} to ${Math.round(l.box.right)} by ${Math.round(l.box.top)} to ${Math.round(l.box.bottom)})`);
  }
  for (let i = 0; i < leaders.length; i++) {
    for (let j = i + 1; j < leaders.length; j++) {
      const d = Math.hypot(leaders[i].end.x - leaders[j].end.x, leaders[i].end.y - leaders[j].end.y);
      if (d < minGap) out.push(`the leaders of "${leaders[i].id}" and "${leaders[j].id}" end ${d.toFixed(1)} px apart, at least ${minGap} px is required`);
    }
  }
  return out;
}

/** The WCAG relative luminance of a `#rrggbb` colour. */
export function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** The WCAG contrast ratio of two `#rrggbb` colours. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * R2: every class of the size scale is at `min` to 1 or more against the stage's background (WCAG 1.4.11), and the classes are ordered in
 * lightness (strictly, in one direction) in the theme.
 * @param {string[]} colours the six classes, finest first, as `#rrggbb`
 * @param {string} background the stage's background as `#rrggbb`
 * @param {number} [min]
 * @returns {string[]}
 */
export function classContrastProblems(colours, background, min = 3) {
  const out = [];
  colours.forEach((c, i) => {
    const k = contrast(c, background);
    if (k + 1e-9 < min) out.push(`the size class ${i} (${c}) has a contrast of ${k.toFixed(2)} to 1 against ${background}, at least ${min} to 1 is required`);
  });
  const l = colours.map(luminance);
  const up = l.every((v, i) => i === 0 || v > l[i - 1]);
  const down = l.every((v, i) => i === 0 || v < l[i - 1]);
  if (!up && !down) out.push('the size classes are not ordered in lightness');
  return out;
}

/**
 * R3 and T3: the note that says which sides state no value stands on a line of its own under the axis title: it overlaps no tick label and no
 * title, its top is not above the title's bottom and at most `maxGap` px under it. Without a title (a chart that has none), it stands at most
 * `maxGap` px under the lowest tick label.
 * @param {Box} note
 * @param {{ text: string, box: Box }[]} ticks
 * @param {number} [maxGap]
 * @param {{ text: string, box: Box } | null} [title] the axis title, which stays "Feed class" or "Clase de alimentación"
 * @returns {string[]}
 */
export function axisNoteProblems(note, ticks, maxGap = 40, title = null) {
  const out = [];
  const low = Math.max(...ticks.map((t) => t.box.bottom));
  for (const t of ticks) if (note.left < t.box.right - TOL && t.box.left < note.right - TOL && note.top < t.box.bottom - TOL && t.box.top < note.bottom - TOL) out.push(`the note of the missing sides overlaps the tick label "${t.text}"`);
  if (note.top < low - TOL) out.push('the note of the missing sides stands above the lowest tick label');
  if (title) {
    const t = title.box;
    if (note.left < t.right - TOL && t.left < note.right - TOL && note.top < t.bottom - TOL && t.top < note.bottom - TOL) out.push(`the note of the missing sides overlaps the axis title "${title.text}"`);
    if (note.top < t.bottom - TOL) out.push(`the note of the missing sides is not under the axis title "${title.text}"`);
    if (note.top - t.bottom > maxGap) out.push(`the note of the missing sides stands ${Math.round(note.top - t.bottom)} px under the axis title, at most ${maxGap} px is required`);
  } else if (note.top - low > maxGap) {
    out.push(`the note of the missing sides stands ${Math.round(note.top - low)} px under the tick labels, at most ${maxGap} px is required`);
  }
  return out;
}

/**
 * R5: a change of operating point has three steps at their own times: the stage, then the per-stroke series, then the rest, each at least
 * `minGap` ms after the one before.
 * @param {number[]} times the times, in ms from the click, at which the stage, the series and the rest were shown
 * @param {number} [minGap]
 * @returns {string[]}
 */
export function stageTimesProblems(times, minGap = 200) {
  const out = [];
  if (times.length !== 3) return [`${times.length} steps were seen, three are required`];
  for (let i = 1; i < 3; i++) if (times[i] - times[i - 1] < minGap) out.push(`step ${i + 1} came ${Math.round(times[i] - times[i - 1])} ms after step ${i}, at least ${minGap} ms is required`);
  return out;
}

/**
 * @typedef {{ x: number, y: number }} Pt
 * @typedef {{ id: string, points: Pt[] }} LeaderPath
 */

/**
 * Whether the segment from a to b passes through the interior of the box, shrunk by `inset` px on every side (Liang-Barsky clipping).
 * @param {Pt} a
 * @param {Pt} b
 * @param {Box} box
 * @param {number} [inset]
 * @returns {boolean}
 */
export function segmentHitsBox(a, b, box, inset = 0.5) {
  const l = box.left + inset;
  const r = box.right - inset;
  const t = box.top + inset;
  const bt = box.bottom - inset;
  if (r <= l || bt <= t) return false;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of [[-dx, a.x - l], [dx, r - a.x], [-dy, a.y - t], [dy, bt - a.y]]) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const k = q / p;
      if (p < 0) t0 = Math.max(t0, k);
      else t1 = Math.min(t1, k);
      if (t0 > t1) return false;
    }
  }
  return t1 - t0 > 1e-9;
}

/**
 * The runs two paths share along one line: parallel horizontal or vertical segments closer than `near` px that overlap over more than 1 px.
 * @param {LeaderPath} p
 * @param {LeaderPath} q
 * @param {number} [near]
 * @returns {number}
 */
function sharedRuns(p, q, near = 2.5) {
  let n = 0;
  for (let i = 1; i < p.points.length; i++) {
    for (let j = 1; j < q.points.length; j++) {
      const [a, b] = [p.points[i - 1], p.points[i]];
      const [c, d] = [q.points[j - 1], q.points[j]];
      const horizontal = Math.abs(a.y - b.y) < 0.01 && Math.abs(c.y - d.y) < 0.01 && Math.abs(a.y - c.y) < near;
      const vertical = Math.abs(a.x - b.x) < 0.01 && Math.abs(c.x - d.x) < 0.01 && Math.abs(a.x - c.x) < near;
      if (horizontal && Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) > 1) n++;
      if (vertical && Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) > 1) n++;
    }
  }
  return n;
}

/**
 * Whether two segments cross at a point inside both (a touch at an end is not a crossing).
 * @param {Pt} a
 * @param {Pt} b
 * @param {Pt} c
 * @param {Pt} d
 * @returns {boolean}
 */
function segmentsCross(a, b, c, d) {
  const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = o(a, b, c);
  const d2 = o(a, b, d);
  const d3 = o(c, d, a);
  const d4 = o(c, d, b);
  return d1 * d2 < -1e-9 && d3 * d4 < -1e-9;
}

/**
 * The number of conflicts among the leaders and, when given, the cards and labels: a leader crossing another leader, two leaders sharing a
 * line, a leader passing through a card other than its own (its own only along its first run, which starts in it) or through a label box.
 * @param {LeaderPath[]} paths
 * @param {{ id: string, box: Box }[]} [cards]
 * @param {{ text: string, box: Box }[]} [labels]
 * @returns {number}
 */
export function pathConflicts(paths, cards = [], labels = []) {
  let n = 0;
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      n += sharedRuns(paths[i], paths[j]);
      for (let a = 1; a < paths[i].points.length; a++) for (let b = 1; b < paths[j].points.length; b++) if (segmentsCross(paths[i].points[a - 1], paths[i].points[a], paths[j].points[b - 1], paths[j].points[b])) n++;
    }
  }
  return n + leaderPathProblems(paths, cards, labels, true).length;
}

/**
 * T6: the leaders' paths, measured. No segment passes through a callout card other than its own (the own card only along the first run,
 * which starts at its middle), none passes through a label's box, no two leaders run along one line, and every end lies on its subject.
 * @param {LeaderPath[]} paths the polylines, from the card's middle to the end, in one coordinate system
 * @param {{ id: string, box: Box }[]} cards the callout cards
 * @param {{ text: string, box: Box }[]} labels the drawn labels
 * @param {boolean} [skipShared] leave out the shared-line check (the caller counts it itself)
 * @returns {string[]}
 */
export function leaderPathProblems(paths, cards, labels, skipShared = false) {
  const out = [];
  for (const p of paths) {
    for (let i = 1; i < p.points.length; i++) {
      const [a, b] = [p.points[i - 1], p.points[i]];
      for (const c of cards) {
        if (c.id === p.id && i === 1) continue;
        if (segmentHitsBox(a, b, c.box)) out.push(`the leader of "${p.id}" passes through the callout card "${c.id}" on its segment ${i}`);
      }
      for (const l of labels) if (segmentHitsBox(a, b, l.box, 0)) out.push(`the leader of "${p.id}" crosses the label "${l.text}" on its segment ${i}`);
    }
  }
  if (!skipShared) {
    for (let i = 0; i < paths.length; i++) for (let j = i + 1; j < paths.length; j++) if (sharedRuns(paths[i], paths[j]) > 0) out.push(`the leaders of "${paths[i].id}" and "${paths[j].id}" run along one line`);
  }
  return out;
}

/**
 * P2: no stage label covers its subject. The label boxes against the shapes the stage's own drawing data gives (the circle of every sphere of
 * the frame shown, `[x, y, r]`, and the two plate lines, `[x0, y0, x1, y1]`, thick by `plateWidth`), all in one coordinate system.
 * @param {{ text: string, box: Box }[]} labels
 * @param {number[][]} circles
 * @param {number[][]} plates
 * @param {number} [plateWidth] the drawn width of a plate line [px]
 * @returns {string[]}
 */
export function labelShapeProblems(labels, circles, plates, plateWidth = 5) {
  const out = [];
  for (const l of labels) {
    const hit = circles.filter(([x, y, r]) => {
      const nx = Math.max(l.box.left, Math.min(x, l.box.right));
      const ny = Math.max(l.box.top, Math.min(y, l.box.bottom));
      return (x - nx) ** 2 + (y - ny) ** 2 < r * r;
    }).length;
    if (hit > 0) out.push(`the label "${l.text}" covers ${hit} drawn sphere${hit === 1 ? '' : 's'}`);
    plates.forEach(([x0, y0, x1, y1], i) => {
      if (segmentHitsBox({ x: x0, y: y0 }, { x: x1, y: y1 }, l.box, -plateWidth / 2)) out.push(`the label "${l.text}" covers the ${i === 0 ? 'fixed' : 'swing'} plate line`);
    });
  }
  return out;
}
