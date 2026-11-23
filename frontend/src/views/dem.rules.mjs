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
      if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(token)) continue;
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
