import { execFile } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { setGlobalProxyFromEnv } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Config } from '@aitp/protocol';
import { loadConfig } from '@aitp/core';
import { startAgent } from './compose.ts';

const args = process.argv.slice(2), command = args.shift() ?? 'serve';
const option = (name: string) => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : undefined; };
const env: Record<string, string | undefined> = { ...process.env };
if (option('--config')) env.AITP_AGENT_CONFIG = resolve(option('--config')!);
if (option('--data')) env.AITP_AGENT_HOME = resolve(option('--data')!);
const checkout = fileURLToPath(new URL('../../../../', import.meta.url));

try {
  if (args.includes('--help') || command === 'help') {
    process.stdout.write('aitp-agent init --topics PATH [--knowledge PATH] [--aitp PATH] [--config FILE]\naitp-agent serve|open [--config FILE] [--data PATH] [--faux] [--profile read-only]\naitp-agent doctor [--config FILE]\n');
  } else if (command === 'init') {
    if (!option('--topics')) throw new Error('init needs --topics PATH; it never creates research topics');
    const topicsRoot = resolve(option('--topics')!);
    if (!(await stat(topicsRoot)).isDirectory()) throw new Error('Topics root is not a directory');
    const configPath = env.AITP_AGENT_CONFIG ?? join(homedir(), '.config/aitp-agent/config.json');
    const config = Config.parse({
      workspace: { root: dirname(topicsRoot), topicsRoot, ...(option('--knowledge') ? { knowledgeRoot: resolve(option('--knowledge')!) } : {}), extraReadRoots: [], locations: [], writeMode: 'off', pilotTopics: [], previews: { openings: false, conclusions: false, parents: false } },
      aitp: { checkout: option('--aitp') ? resolve(option('--aitp')!) : join(checkout, 'aitp'), extraSkillRoots: [] },
      models: { main: { provider: args.includes('--faux') ? 'faux' : 'openai', modelId: option('--model') ?? (args.includes('--faux') ? 'faux-model' : 'gpt-6.1-sol'), thinkingLevel: 'high' } },
      clusters: [], sandbox: { engine: 'bwrap', readRoots: [], hiddenPaths: [], limits: { addressSpaceMB: 1024, processes: 64, fileSizeMB: 64, wallSeconds: 60 }, maxConcurrentHeavy: 1 },
      server: { host: '127.0.0.1', port: Number(option('--port') ?? 4318) }, ui: { theme: 'system', language: 'en' },
    });
    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    process.stdout.write(`Created ${configPath}; research writes are off.\n`);
  } else if (command === 'doctor') {
    const { config, configPath, dataDir } = await loadConfig(env);
    const checks = [];
    for (const [name, path] of [['topics', config.workspace.topicsRoot], ['AITP Skills', join(config.aitp.checkout, 'plugins/aitp/skills/aitp-memory/SKILL.md')], ...(config.workspace.knowledgeRoot ? [['knowledge', config.workspace.knowledgeRoot]] : [])]) {
      try { await stat(path!); checks.push({ name, ok: true, detail: path }); } catch { checks.push({ name, ok: false, detail: 'Missing path' }); }
    }
    process.stdout.write(JSON.stringify({ configPath, dataDir, checks, network: 'Not queried', execution: 'Read-only milestone; command sandbox is not enabled' }, null, 2) + '\n');
    if (checks.some(c => !c.ok)) process.exitCode = 1;
  } else if (command === 'serve' || command === 'open') {
    if (option('--profile') && option('--profile') !== 'read-only') throw new Error('Full execution is not available yet; use --profile read-only');
    // Changing NODE_USE_ENV_PROXY after Node starts has no effect. Use Node's actual
    // proxy setup so provider fetches honor HTTPS_PROXY and local calls honor NO_PROXY.
    setGlobalProxyFromEnv(env);
    const running = await startAgent({ env, profile: 'read-only', faux: args.includes('--faux'), version: '0.1.0', staticDir: join(checkout, 'agent/apps/workbench/dist') });
    process.stdout.write(`AITP read-only workbench${args.includes('--faux') ? ' (simulated model)' : ''}\n${running.url}\n`);
    if (command === 'open') execFile('explorer.exe', [running.url], error => { if (error) process.stderr.write('Open the URL above in your browser.\n'); });
    await new Promise<void>(resolveStop => {
      let stopping = false;
      const stop = () => { if (stopping) return; stopping = true; void running.stop().then(resolveStop, error => { process.stderr.write(String(error) + '\n'); process.exitCode = 1; resolveStop(); }); };
      process.once('SIGINT', stop); process.once('SIGTERM', stop);
    });
  } else throw new Error(`Unknown command: ${command}`);
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : 'Startup failed') + '\n');
  process.exitCode = 1;
}
