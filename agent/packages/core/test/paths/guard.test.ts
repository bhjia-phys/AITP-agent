import { mkdir, writeFile, symlink, mkdtemp, rm, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { createWorkspaceFs, hiddenHomePaths } from '../../src/paths/index.ts';
import { fixture } from '../locations/support.ts';
it('refuses escapes, hidden paths and symlinks; lists and reads are bounded', async () => {
  const f = await fixture(); const outside = await mkdtemp(join(tmpdir(), 'aitp-outside-'));
  try {
    await writeFile(join(outside, 'secret'), 'secret');
    await symlink(outside, join(f.root, 'escape'));
    for (const path of ['../secret', 'topics/../../secret', 'topics/../research.md', '/etc/passwd']) await expect(f.fs.readText({ kind: 'workspace', path })).rejects.toThrow('forbidden_path');
    await expect(f.fs.readText({ kind: 'absolute', path: join(outside, 'secret') })).rejects.toThrow('forbidden_path');
    await expect(f.fs.readText({ kind: 'workspace', path: 'escape/secret' })).rejects.toThrow('forbidden_path');
    const hidden = join(f.root, 'hidden'); await mkdir(hidden); await writeFile(join(hidden, 'secret'), 'secret');
    await symlink(hidden, join(f.root, 'alias'));
    const cfg = structuredClone(f.config); cfg.sandbox.hiddenPaths = [hidden]; cfg.workspace.extraReadRoots.push(homedir());
    const fs = createWorkspaceFs({ ...f.deps, config: cfg, dataDir: join(f.root, 'runtime') });
    for (const path of [hidden, join(f.root, 'alias'), join(f.root, 'runtime'), ...hiddenHomePaths.map(p => join(homedir(), p))]) {
      for (const operation of [() => fs.resolve({ kind: 'absolute', path }), () => fs.stat({ kind: 'absolute', path }), () => fs.list({ kind: 'absolute', path }), () => fs.readBytes({ kind: 'absolute', path })]) await expect(operation()).rejects.toThrow('forbidden_path');
    }
    expect((await fs.list({ kind: 'absolute', path: f.root })).entries.map(e => e.name)).not.toContain('hidden');
    const large = join(f.root, 'large'); await mkdir(large);
    await Promise.all(Array.from({ length: 2005 }, (_, i) => writeFile(join(large, `f${i}`), '')));
    const listed = await f.fs.list({ kind: 'absolute', path: large }); expect(listed.truncated).toBe(true); expect(listed.entries).toHaveLength(2000);
    expect((await f.fs.list({ kind: 'absolute', path: large }, { limit: 7 })).entries).toHaveLength(7);
    const path = { kind: 'workspace', path: 'topics/AGENTS.md' } as const;
    await expect(f.fs.readText(path, { maxBytes: 2 })).rejects.toThrow('file_too_large');
    const first = await f.fs.readText(path); await utimes(join(f.root, path.path), new Date(0), new Date(0));
    expect((await f.fs.readText(path)).text).toBe(first.text);
    const bytes = await f.fs.readBytes(path, { range: { start: 0, end: 3 } }); expect(Buffer.from(bytes.bytes).toString()).toBe('# Wo'); expect(bytes.mime).toBe('text/markdown');
    await expect(f.fs.readBytes(path, { range: { start: -1, end: 2 } })).rejects.toThrow('invalid_range');
  } finally { await f.cleanup(); await rm(outside, { recursive: true, force: true }); }
});
