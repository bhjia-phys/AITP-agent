/** Exercise actual suite selections with production Loader services and an isolated persistent Session. */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { dump, load } from 'js-yaml'
import type { Context } from '@deepseek-ai/cordis'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import { boot, initProfile, readProfilePatches, composeEntries, loadOverlayPatches, loadProfile, type ProfileContext } from '@deepseek-ai/dsh-app-boot'
import LlmRuntime, { createUserMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import * as JsonlPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import SandboxPolicy from '@deepseek-ai/dsh-sandbox-policy'
import ResearchMemory from '@deepseek-ai/dsh-research-memory'
import ResearchResources from '@deepseek-ai/dsh-research-resources'
import * as Literature from '@deepseek-ai/dsh-research-literature'
import * as Knowledge from '@deepseek-ai/dsh-research-knowledge'
import * as Code from '@deepseek-ai/dsh-research-code'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { parseDshArgs } from '../../apps/cli/src/args.ts'
import { prepareAitpStartup } from '../aitp-agent.ts'
import ExactSessionQuery from '../../packages/research/research-memory/tests/fixtures/runtime/query-plugin.ts'
import * as mock from './aitp-composition-model.ts'

import ConfigEditor from '@deepseek-ai/dsh-config-editor'
import Settings from '@deepseek-ai/dsh-settings'
import * as ResearchSettings from '../../packages/client/ui-aitp-settings/src/index.ts'
import type { ResearchPreferences } from '../../packages/client/ui-aitp-settings/src/preferences.ts'
import type { EntryOptions } from '@deepseek-ai/cordis-plugin-loader'
import type { IndexInjection } from '@deepseek-ai/dsh-host-webserver'

const fixture = process.argv[2]
if (fixture === undefined) throw new Error('A Loader fixture path is required.')
const repository = resolve(import.meta.dirname, '../..')
const home = resolve('.app-home')
const notes = resolve('notes')
const workspaceId = 'settings-scratch' as WorkspaceId
const signal = new AbortController().signal
const sessionId = SessionId('settings-persisted-session')
await mkdir(notes)
const original = '# Research\n\nA preserved scientific question with a finite bound.\n'
await writeFile(join(notes, 'research.md'), original)
const baselineProfile = loadProfile('test', 'web', join(repository, 'apps/cli/package.json'), home, { readOnly: true })
const ids = new Set(['research-memory', 'research-resources', 'research-literature', 'research-knowledge', 'research-code', 'ui-aitp-settings'])
const domainRows = composeEntries([...baselineProfile.layers.map(layer => layer.patches)])
  .filter(entry => ids.has(entry.id)).map(entry => ({ ...entry, name: `cordis:${entry.id}` }))
const dependencies = load(await readFile(fixture, 'utf8'), { schema: entryListSchema }) as EntryOptions[]
for (const entry of dependencies) entry.id = entry.name.replace('cordis:', '')
const dir = join(home, 'profiles/web')
initProfile(dir, ['aitp-settings-fixture'])
await writeFile(join(dir, 'cordis.yml'), '[]\n')
const bundle = join(dir, 'node_modules/aitp-settings-fixture')
await mkdir(bundle, { recursive: true })
await writeFile(join(bundle, 'package.json'), JSON.stringify({ name: 'aitp-settings-fixture', version: '1.0.0', dsh: { bundle: { patch: 'cordis.patch.yml' } } }))
await writeFile(join(bundle, 'cordis.patch.yml'), dump([{ insert: [...dependencies, ...domainRows,
  { id: 'config-editor', name: 'cordis:editor' }, { id: 'settings', name: 'cordis:settings' },
] }], { schema: entryListSchema }))
const sourceConfiguration = [
  { id: 'research-memory', config: { roots: [{ id: 'settings-scratch', path: notes, writable: true }], watchSources: false, automaticResearch: true, maxContextCharacters: 12000 } },
  { id: 'research-resources', config: { roots: [{ id: 'settings-sources', path: notes }], watchSources: false } },
]
await writeFile(join(dir, 'cordis.patch.yml'), dump(sourceConfiguration))

async function start(options: string[] = []): Promise<{ ctx: Context; close: () => Promise<void> }> {
  const startup = await prepareAitpStartup(repository, options, home)
  try {
    const invocation = parseDshArgs(startup.args, 'test')
    if (invocation.mode !== 'profile') throw new Error('Expected profile launch')
    const loaded = loadProfile('test', 'web', join(repository, 'apps/cli/package.json'), home)
    const profile: ProfileContext = { name: 'web', startedBundles: ['aitp-settings-fixture'], dir,
      patchPath: join(dir, 'cordis.patch.yml'), installAnchor: join(repository, 'apps/cli/package.json'),
      cwd: process.cwd(), home, overlays: invocation.patches.flatMap(path => loadOverlayPatches('test', path)), telemetryDisabledEnv: undefined }
    const ctx = await boot('test', join(dir, 'cordis.yml'), readProfilePatches('test', profile, loaded), (ctx) => {
      ctx.provide('profileContext', profile)
      Object.assign(ctx.loader.builtins, { llm: LlmRuntime, sessions: SessionStore,
        projections: SessionProjectionRegistry, persistence: JsonlPersistence, query: ExactSessionQuery,
        prompt: SystemPrompt, tools: ToolRuntime, agents: AgentRegistry, loop: AgentLoop,
        typert: TypertRegistry, policy: SandboxPolicy, mock, editor: ConfigEditor, settings: Settings,
        'research-memory': ResearchMemory, 'research-resources': ResearchResources, 'research-literature': Literature,
        'research-knowledge': Knowledge, 'research-code': Code, 'ui-aitp-settings': ResearchSettings })
    })
    return { ctx, close: async () => { await ctx.fiber.dispose(); startup.release() } }
  } catch (error) { startup.release(); throw error }
}

const observations: object[] = []
let baselineHistory: unknown
async function observe(ctx: Context, label: string): Promise<void> {
  const memory = ctx.get('researchMemory')
  const provider = await memory?.provider({ workspaceId }, signal)
  const history = await ctx.sessionQuery.readSession(sessionId)
  const comparable = { ...history, session: { ...history.session, delegationDepth: history.session.delegationDepth ?? 0 } }
  baselineHistory ??= comparable
  const entry = [...ctx.loader.entries()].find(entry => entry.options.id === 'ui-aitp-settings')
  const injections: IndexInjection[] = []
  ctx.emit('webserver/index-inject', injections)
  observations.push({ label, memory: memory !== undefined, automaticResearch: provider?.capabilities.automaticResearch,
    bootstrap: injections.find(injection => injection.kind === 'global' && injection.name === '__AITP_RESEARCH_STARTUP__'),
    settings: ctx.settings.describe().find(row => row.ns === 'ui-aitp-settings')?.value,
    settingActive: entry?.fiber !== undefined,
    libraries: ['research-literature', 'research-knowledge', 'research-code'].map((id) => {
      const row = [...ctx.loader.entries()].find(row => row.options.id === id)
      return { id, enabled: row?.options.disabled !== true, fiber: row?.fiber !== undefined }
    }), sourcesPreserved: await readFile(join(notes, 'research.md'), 'utf8') === original,
    historyPreserved: isDeepStrictEqual(comparable, baselineHistory) })
}
async function save(ctx: Context, preferences: ResearchPreferences): Promise<void> {
  const form = ctx.settings.describe().find(row => row.ns === 'ui-aitp-settings')
  if (form === undefined) throw new Error('The research settings form is unavailable.')
  const keys = ['suite', 'literature', 'knowledge', 'code'] as const
  await ctx.settings.mutate('ui-aitp-settings', keys.map(key => ({ op: 'set' as const, path: [key], value: preferences[key] })), form.revision)
}

let running = await start(['--research-suite=full'])
try {
  const agent = await running.ctx.agentLoop.create(sessionId, { provider: 'aitp-composition-model', model: 'aitp-composition-model' }, { cwd: notes })
  agent.followup(createUserMessage({ source: { kind: 'aitp-research', actor: 'human', origin: { workspaceId } }, content: [{ type: 'text', text: 'Retain the finite qualification.' }] }))
  await agent.whenIdle()
  await running.ctx.sessions.flush(agent.session)
  await observe(running.ctx, 'initial-full')
  await save(running.ctx, { suite: 'browse', literature: false, knowledge: true, code: false })
  await observe(running.ctx, 'saved-browse-still-full')
} finally { await running.close() }
running = await start()
try {
  await observe(running.ctx, 'restarted-browse')
  await save(running.ctx, { suite: 'skills', literature: false, knowledge: true, code: false })
  await observe(running.ctx, 'saved-skills-still-browse')
} finally { await running.close() }
running = await start()
try {
  await observe(running.ctx, 'restarted-skills')
  await save(running.ctx, { suite: 'full', literature: true, knowledge: true, code: true })
  await observe(running.ctx, 'saved-full-still-skills')
} finally { await running.close() }
running = await start(['--research-suite=browse', '--research-libraries=code'])
try { await observe(running.ctx, 'explicit-browse-overrides-full') } finally { await running.close() }
running = await start()
try { await observe(running.ctx, 'restarted-saved-full') } finally { await running.close() }
const savedPatch = load(await readFile(join(dir, 'cordis.patch.yml'), 'utf8')) as EntryOptions[]
await writeFile('settings-observations.json', JSON.stringify({ observations,
  sourceConfigurationPreserved: sourceConfiguration.every(row => isDeepStrictEqual(savedPatch.find(saved => saved.id === row.id), row)),
  settingsRows: savedPatch.filter(row => row.id === 'ui-aitp-settings').length,
}))
