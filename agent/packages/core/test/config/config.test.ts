import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { expect, it } from 'vitest';
import { loadConfig } from '../../src/config/index.ts';
import { fixture } from '../locations/support.ts';
it('loads overrides and defaults, supplies root, and names invalid fields', async () => {
  const f = await fixture(); const home = await mkdtemp(join(tmpdir(), 'aitp-config-'));
  try {
    const path = join(home, '.config/aitp-agent/config.json'); await mkdir(dirname(path), { recursive: true });
    const raw = structuredClone(f.config) as any; delete raw.workspace.root;
    await writeFile(path, JSON.stringify(raw));
    const loaded = await loadConfig({ HOME: home });
    expect(loaded.config.workspace.root).toBe(f.root);
    expect(loaded.dataDir).toBe(join(home, '.local/share/aitp-agent'));
    expect(loaded.configPath).toBe(path);
    const overridden = await loadConfig({ AITP_AGENT_CONFIG: path, AITP_AGENT_HOME: f.dataDir });
    expect(overridden.dataDir).toBe(f.dataDir);
    raw.workspace.topicsRoot = 'relative'; await writeFile(path, JSON.stringify(raw));
    await expect(loadConfig({ AITP_AGENT_CONFIG: path })).rejects.toThrow(/workspace.topicsRoot/);
    await writeFile(path, '{'); await expect(loadConfig({ AITP_AGENT_CONFIG: path })).rejects.toThrow(/configuration/);
  } finally { await f.cleanup(); await rm(home, { recursive: true, force: true }); }
});
it('hides a custom configuration directory and runtime data inside a read root', async () => {
  const f = await fixture();
  try {
    const dir = join(f.root, 'settings'); await mkdir(dir); const configPath = join(dir, 'config.json');
    await writeFile(configPath, JSON.stringify(f.config));
    const loaded = await loadConfig({ AITP_AGENT_CONFIG: configPath, AITP_AGENT_HOME: join(f.root, 'state') });
    const { createWorkspaceFs } = await import('../../src/paths/index.ts');
    const fs = createWorkspaceFs({ ...f.deps, config: loaded.config, dataDir: loaded.dataDir });
    await expect(fs.resolve({ kind: 'absolute', path: configPath })).rejects.toThrow('forbidden_path');
    await expect(fs.resolve({ kind: 'absolute', path: loaded.dataDir })).rejects.toThrow('forbidden_path');
  } finally { await f.cleanup(); }
});
it('rejects an external knowledge root whose identity cannot be workspace-relative', async () => {
  const f = await fixture(); const home = await mkdtemp(join(tmpdir(), 'aitp-config-'));
  try {
    const path = join(home, 'config.json');
    await writeFile(path, JSON.stringify({ ...f.config, workspace: { ...f.config.workspace, knowledgeRoot: home } }));
    await expect(loadConfig({ AITP_AGENT_CONFIG: path })).rejects.toThrow(/knowledgeRoot must be inside workspace.root/);
  } finally { await f.cleanup(); await rm(home, { recursive: true, force: true }); }
});
