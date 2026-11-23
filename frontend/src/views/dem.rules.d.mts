// Types of src/views/dem.rules.mjs, for vitest and tsc.
export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export interface VerdictMeasure {
  card: Box;
  columns: { name: string; left: number; right: number }[];
  wrapper: { scrollWidth: number; clientWidth: number };
  summary: Box & { scrollWidth: number; clientWidth: number; text: string };
  stacked: boolean;
}
export function verdictLayoutProblems(m: VerdictMeasure): string[];
export function labelOverlapProblems(labels: { text: string; left: number; right: number; top: number; bottom: number }[]): string[];
export function nullMarkProblems(marks: { id: string; box: Box }[], plot: Box): string[];
export function stageShareProblems(stage: { width: number; height: number }, viewport: { width: number; height: number }, min?: number): string[];
export function stageShare(stage: { width: number; height: number }, viewport: { width: number; height: number }): number;
export function decimalProblems(texts: { text: string; quoted: boolean }[]): string[];
export function noValueStripProblems(strip: { id: string; box: Box }[], others: { text: string; box: Box }[], plot: Box): string[];
export function stageGeometryProblems(m: { card: { width: number; height: number }; drawing: { width: number; height: number }; section: { height: number }; zone: { height: number } }, viewport: { width: number; height: number }, limits?: { minDrawing?: number; minHeight?: number; minCard?: number }): string[];
export function chartOverlapProblems(roots: { id: string; box: Box }[]): string[];
export function leaderProblems(leaders: { id: string; end: { x: number; y: number }; box: Box }[], tol?: number, minGap?: number): string[];
export function luminance(hex: string): number;
export function contrast(a: string, b: string): number;
export function classContrastProblems(colours: string[], background: string, min?: number): string[];
export function axisNoteProblems(note: Box, ticks: { text: string; box: Box }[], maxGap?: number, title?: { text: string; box: Box } | null): string[];
export function stageTimesProblems(times: number[], minGap?: number): string[];
export interface Pt {
  x: number;
  y: number;
}
export interface LeaderPath {
  id: string;
  points: Pt[];
}
export function segmentHitsBox(a: Pt, b: Pt, box: Box, inset?: number): boolean;
export function pathConflicts(paths: LeaderPath[], cards?: { id: string; box: Box }[], labels?: { text: string; box: Box }[]): number;
export function leaderPathProblems(paths: LeaderPath[], cards: { id: string; box: Box }[], labels: { text: string; box: Box }[], skipShared?: boolean): string[];
export function labelShapeProblems(labels: { text: string; box: Box }[], circles: number[][], plates: number[][], plateWidth?: number): string[];
