import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { Config } from '@aitp/protocol';
import type { LoadConfig } from '../contracts.ts';

// Preserve the actual configuration directory for the read guard without extending the shared contract.
export const configDirectories = new WeakMap<Config, string>();
export const loadConfig: LoadConfig = async (env) => {
  const home = env.HOME || homedir();
  const expand = (p: string) => resolve(p.replace(/^~(?=\/|$)/, home));
  const configPath = expand(env.AITP_AGENT_CONFIG || `${home}/.config/aitp-agent/config.json`);
  const dataDir = expand(env.AITP_AGENT_HOME || `${home}/.local/share/aitp-agent`);
  let raw;
  try { raw = JSON.parse(await readFile(configPath, 'utf8')); }
  catch (error) { throw new Error(`configuration ${configPath}: ${String(error)}`); }
  if (raw?.workspace?.root === undefined && typeof raw?.workspace?.topicsRoot === 'string') {
    raw.workspace.root = dirname(raw.workspace.topicsRoot);
  }
  const result = Config.safeParse(raw);
  if (!result.success) throw new Error(result.error.issues.map(i => `${i.path.join('.') || 'config'}: ${i.message}`).join('\n'));
  for (const [kind, root] of [['topicsRoot', result.data.workspace.topicsRoot], ['knowledgeRoot', result.data.workspace.knowledgeRoot]] as const) {
    if (!root) continue;
    const path = relative(result.data.workspace.root, root);
    if (isAbsolute(path) || path === '..' || path.startsWith('../')) throw new Error(`workspace.${kind} must be inside workspace.root; select their common ancestor as workspace.root`);
  }
  configDirectories.set(result.data, dirname(configPath));
  return { config: result.data, dataDir, configPath };
};
