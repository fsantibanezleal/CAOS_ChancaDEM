// Every reference the site cites: the shared core and each page's own file. An id is defined once; a duplicate is an
// error at load, never a silent override (each page unit writes only its own file).
import type { Citation } from '@fasl-work/caos-app-shell';
import { BENCHMARK } from './citations/benchmark';
import { CORE } from './citations/core';
import { EXPERIMENTS } from './citations/experiments';
import { IMPLEMENTATION } from './citations/implementation';
import { INTRODUCTION } from './citations/introduction';
import { METHODOLOGY } from './citations/methodology';

export function mergeCitations(...groups: Citation[][]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of groups.flat()) {
    if (seen.has(c.id)) throw new Error(`citation id defined twice: ${c.id}`);
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

export const CITATIONS: Citation[] = mergeCitations(CORE, INTRODUCTION, METHODOLOGY, IMPLEMENTATION, EXPERIMENTS, BENCHMARK);
