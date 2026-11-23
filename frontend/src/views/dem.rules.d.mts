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
