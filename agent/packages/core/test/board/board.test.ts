import { expect, it } from 'vitest';
import { fixture } from '../locations/support.ts';
it('projects every Current work entry and applies owner, state and grouping filters', async () => {
  const f = await fixture();
  try {
    const all = await f.workspace.board();
    const places = await f.workspace.locations(); let count = 0;
    for (const p of places) count += (await f.workspace.outline(p.id)).currentWork?.entries.length ?? 0;
    expect(all).toHaveLength(count);
    const waiting = await f.workspace.board({ state: 'waiting-researcher' }); expect(waiting.length).toBeGreaterThan(0); expect(waiting.every(r => r.state === 'waiting-researcher')).toBe(true);
    const owner = 'topics/spectra/selfconsistent/research.md'; expect(await f.workspace.board({ owner })).toHaveLength(3);
    const row = all.find(r => r.owner === owner)!; expect(row.ownerTitle).toBe('Self-consistent spectra');
    const grouped = await f.workspace.board({ grouping: row.grouping }); expect(grouped.every(r => r.grouping === row.grouping)).toBe(true);
    const family = await f.workspace.board({ grouping: 'family:topics/spectra/README.md' });
    expect(family.some(r => r.owner === owner)).toBe(true);
    expect(family.every(r => r.grouping === 'family:topics/spectra/README.md')).toBe(true);
  } finally { await f.cleanup(); }
});
