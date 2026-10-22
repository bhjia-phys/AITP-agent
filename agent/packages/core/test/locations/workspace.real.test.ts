import { writeSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';
import { fixture } from './support.ts';
import { createWorkspaceFs } from '../../src/paths/index.ts';
import { createWorkspaceModel, excludedLocation } from '../../src/locations/index.ts';
import { createDerivedIndex } from '../../src/index/index.ts';

it.skipIf(!process.env.AITP_REAL_WORKSPACE)('reads the real workspace without recursive traversal or research writes', async () => {
  const f = await fixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'aitp-real-index-'));
  try {
    const topicsRoot = process.env.AITP_REAL_WORKSPACE!;
    const config = structuredClone(f.config);
    config.workspace = { ...config.workspace, root: dirname(topicsRoot), topicsRoot, knowledgeRoot: process.env.AITP_REAL_KNOWLEDGE || undefined, locations: [], writeMode: 'off' };
    const deps = { ...f.deps, config, dataDir };
    const fs = createWorkspaceFs(deps);
    const index = createDerivedIndex({ ...deps, fs });
    const workspace = createWorkspaceModel({ ...deps, fs, index });
    const started = performance.now();
    const graph = await workspace.graph();
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(60000);
    const locations = await workspace.locations();
    const reachable = locations.filter(l => l.source !== 'listing' && l.kind !== 'family');
    let currentWork = 0, entries = 0, pointers = 0, unresolved = 0;
    for (const l of locations) {
      expect(excludedLocation(l.id, l.kind === 'record')).toBe(false);
      const file = await fs.readText({ kind: 'workspace', path: l.id });
      const outline = await workspace.outline(l.id);
      if (/^#{1,6}\s+Current work\s*$/im.test(file.text) || /\\section\{Current work\}/i.test(file.text)) { expect(outline.currentWork, l.id).not.toBeNull(); currentWork++; }
      for (const entry of outline.currentWork?.entries ?? []) {
        entries++;
        expect(entry.text).toBe(file.text.split('\n').slice(entry.span.startLine - 1, entry.span.endLine).join('\n'));
        if (entry.pointer) { pointers++; expect(typeof entry.pointer.resolved).toBe('boolean'); if (!entry.pointer.resolved) { unresolved++; expect(outline.warnings.some(w => /unresolved/i.test(w.message))).toBe(true); } }
      }
    }
    const indexStart = performance.now(); await index.rebuild(); const indexMs = performance.now() - indexStart;
    expect(indexMs).toBeLessThan(60000); expect((await index.status()).documents).toBeGreaterThanOrEqual(reachable.length);
    writeSync(1, JSON.stringify({ locations: locations.length, reachable: reachable.length, nonFamily: reachable.filter(l => l.kind !== 'family').length, families: locations.filter(l => l.kind === 'family').length, unmapped: graph.navigation.unmapped.length, currentWork, entries, pointers, unresolved, graphMs: Math.round(elapsed), indexMs: Math.round(indexMs), indexed: (await index.status()).documents }) + '\n');
    // Family maps are reported separately; they do not inflate the main-note threshold.
    expect(reachable.length).toBeGreaterThanOrEqual(40);
  } finally { await f.cleanup(); await rm(dataDir, { recursive: true, force: true }); }
}, 120000);
