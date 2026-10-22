import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SearchHit } from '@aitp/protocol';
import { expect, it } from 'vitest';
import { fixture } from '../locations/support.ts';
import { createDerivedIndex } from '../../src/index/index.ts';
it('builds disposable WAL FTS passages, scopes search, persists isolated cache and updates by content', async () => {
  const f = await fixture();
  try {
    expect((await f.index.status()).documents).toBe(0);
    await f.index.rebuild();
    const status = await f.index.status(); expect(status.documents).toBeGreaterThan(20); expect(status.builtAt).toBeDefined();
    const notes = await f.index.search('damped', { scope: 'notes' }); expect(notes.length).toBeGreaterThan(0);
    for (const hit of notes) { SearchHit.parse(hit); const loc = hit.ref.locator!; if (loc.kind !== 'lines' || hit.ref.address.kind !== 'workspace') throw new Error('missing passage'); const text = await readFile(join(f.root, hit.ref.address.path), 'utf8'); expect(text.split('\n').slice(loc.start - 1, loc.end).join('\n')).toContain('damped'); }
    const hits = await f.index.search('projections', { scope: 'knowledge' }); expect(hits.some(h => h.ref.kind === 'knowledge')).toBe(true);
    expect(await f.index.search('projections', { scope: 'notes' })).toEqual([]);
    expect(await f.index.search('" * :')).toEqual([]);
    await f.index.cache('a').put('x', { n: 3 }); await f.index.cache('b').put('x', { n: 4 });
    const reopened = createDerivedIndex({ ...f.deps, fs: f.fs }); expect(await reopened.cache('a').get('x')).toEqual({ n: 3 });
    await reopened.cache('a').clear(); expect(await f.index.cache('a').get('x')).toBeUndefined(); expect(await f.index.cache('b').get('x')).toEqual({ n: 4 });
    const path = join(f.root, 'topics/dynamics/research.md'); await writeFile(path, (await readFile(path, 'utf8')) + '\n## Added\nUniquequasarword.\n');
    await f.index.rebuild(); expect(await f.index.search('Uniquequasarword')).toHaveLength(1);
    const db = new DatabaseSync(join(f.dataDir, 'index.sqlite')); try { expect(db.prepare('PRAGMA journal_mode').get()?.journal_mode).toBe('wal'); } finally { db.close(); }
    await rm(join(f.dataDir, 'index.sqlite')); await f.index.rebuild(); expect(await f.index.search('Uniquequasarword')).toHaveLength(1);
  } finally { await f.cleanup(); }
});
