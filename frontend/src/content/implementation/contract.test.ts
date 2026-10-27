// The table of the Implementation page's contracts topic is held to the catalog it transcribes: the same rows in the same
// order, each at the version the catalog gives it in its History section. A row added to or moved in the catalog without
// the page fails here, and so does a version bump the page does not show.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTRACT_ROWS } from './contract-rows';

const catalog = readFileSync(new URL('../../../../docs/contracts/catalog.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/** The rows of the `## Contracts` table: [id, version]. */
function contractsTable(): Array<[string, string]> {
  const start = catalog.indexOf('\n## Contracts\n');
  const end = catalog.indexOf('\n## ', start + 1);
  expect(start).toBeGreaterThan(-1);
  return catalog
    .slice(start, end)
    .split('\n')
    .filter((line) => line.startsWith('|') && !line.startsWith('| id ') && !line.startsWith('|---'))
    .map((line) => line.split('|').map((c) => c.trim()))
    .map((cells) => [cells[1], cells[2]] as [string, string]);
}

/** The newest History version of each contract: the last row of that contract in the `## History` table. */
function historyVersions(): Map<string, string> {
  const start = catalog.indexOf('\n## History\n');
  const out = new Map<string, string>();
  for (const line of catalog.slice(start).split('\n')) {
    if (!line.startsWith('|') || line.startsWith('| contract ') || line.startsWith('|---')) continue;
    const cells = line.split('|').map((c) => c.trim());
    out.set(cells[1], cells[2]);
  }
  return out;
}

describe('the contracts table of the Implementation page', () => {
  it('lists the catalog rows in the catalog order', () => {
    expect(CONTRACT_ROWS.map((r) => r.id)).toEqual(contractsTable().map(([id]) => id));
  });

  it('shows the version the catalog row and its newest History entry give', () => {
    const history = historyVersions();
    for (const [id, version] of contractsTable()) {
      const shown = CONTRACT_ROWS.find((r) => r.id === id)?.version;
      expect(shown, id).toBe(version);
      expect(history.get(id), `${id} in History`).toBe(version);
    }
  });
});
