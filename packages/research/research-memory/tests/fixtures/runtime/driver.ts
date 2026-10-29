/** Full Loader boot, real compaction transactions, durable close and disk resume. */
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import Loader, { type ModuleLoaderV2 } from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import { sourceRootId, sourceIdForPath } from '@deepseek-ai/dsh-research-resources'
import type { ResearchOrigin } from '../../../src/working-types.ts'
import SessionStore from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import * as JsonlPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import TokenMeter from '@deepseek-ai/dsh-token-meter'
import BasicCompaction from '@deepseek-ai/dsh-compaction-basic'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-compaction'
import * as runtimePlugin from './runtime-plugin.ts'
import * as mock from './mock-llm.ts'
import ExactSessionQuery from './query-plugin.ts'
import type {} from '../../../src/working-types.ts'

const configuredPath = process.argv[2]
if (configuredPath === undefined) throw new Error('runtime fixture requires its overlay path')
const configPath = configuredPath
const id = SessionId('research-continuity')
const sourceStudy = process.env['AITP_SOURCE_STUDY_FIXTURE'] === '1'
const origin: ResearchOrigin = sourceStudy ? { scope: 'global', studyId: 'persistent-selected-set', selections: [
  { ref: { rootId: sourceRootId('local-library'), sourceId: sourceIdForPath('note.md') }, selectedText: 'GLOBAL_ORIGINAL_QUOTE: applies only under convention A.' },
] } : { workspaceId: 'scratch', topicId: 'branch-a' }
const agentOptions = { provider: 'research-runtime-mock', model: 'research-runtime-mock', cwd: process.cwd() }
await writeFile('research.md', '# Scratch research\n\nThe finite-chain result does not establish a thermodynamic limit.\n')

async function boot(selectedConfigPath = configPath): Promise<Context> {
  const ctx = new Context()
  ctx.baseUrl = `${pathToFileURL(dirname(selectedConfigPath)).href}/`
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-llm', LlmRuntime], ['@deepseek-ai/dsh-session', SessionStore],
    ['@deepseek-ai/dsh-session-projection', SessionProjectionRegistry],
    ['@deepseek-ai/dsh-session-persistence-jsonl', JsonlPersistence], ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRuntime], ['@deepseek-ai/dsh-agent', AgentRegistry],
    ['@deepseek-ai/dsh-agent-loop', AgentLoop], ['@deepseek-ai/dsh-token-meter', TokenMeter],
    ['@deepseek-ai/dsh-compaction-basic', BasicCompaction], ['./runtime-plugin.ts', runtimePlugin],
    ['./mock-llm.ts', mock], ['./query-plugin.ts', ExactSessionQuery],
  ])
  const internal: ModuleLoaderV2 = {
    version: 'v2',
    loadCache: new Map(),
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
    register(): never { throw new Error('unexpected module hook registration') },
    getOrCreateModuleJob(): never { throw new Error('unexpected module job creation') },
    resolveSync(): never { throw new Error('unexpected synchronous module resolution') },
    load(): never { throw new Error('unexpected module load') },
  }
  ctx.loader.internal = internal
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(selectedConfigPath).href } })
  await ctx.loader.await()
  for (const entry of ctx.loader.entries()) await entry.fiber?.await()
  return ctx
}

async function compact(ctx: Context, agent: Agent): Promise<void> {
  const result = await ctx.compaction.compactNow(agent, new AbortController().signal)
  if (result === null) throw new Error('no compactable fixture region')
}

let ctx = await boot()
try {
  const agent = await ctx.agentLoop.create(id, agentOptions, { cwd: process.cwd() })
  agent.followup(createUserMessage({
    source: { kind: 'aitp-research', actor: 'human', origin },
    content: [{ type: 'text', text: '只做解析推导。Preserve the exact boundary convention.' }],
  }))
  await agent.whenIdle()
  await compact(ctx, agent)
  agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'The approximation remains conditional; keep the failed route.' }] }))
  await agent.whenIdle()
  await compact(ctx, agent)
  await ctx.sessions.flush(agent.session)
} finally { await ctx.fiber.dispose() }

if (sourceStudy) await writeFile('research.md', '# Current source\nThe original passage has been removed.\n')

// Read the same ordinary Session without installing the research projection or tools.
const withoutRuntime = resolve('without-runtime.cordis.yml')
await writeFile(withoutRuntime, (await readFile(configPath, 'utf8')).replace(/\n- name: \.\/runtime-plugin\.ts\s*$/, '\n'))
ctx = await boot(withoutRuntime)
try {
  const handle = await ctx.agents.resume({ resumeSessionId: id, agentOptions })
  const events = handle.agent.session.snapshotEvents()
  await writeFile('runtime-disabled.json', JSON.stringify({
    researchProjectionAbsent: ctx.sessionProjections.stateOf(handle.agent.session, 'researchWorking') === undefined,
    researchToolsAbsent: !ctx.tools.schemas().some(tool => tool.name.startsWith('research_')),
    originalQuestions: events.filter(event => event.type === 'user/message' && event.data.source.kind === 'aitp-research'),
    successfulToolResults: events.filter(event => event.type === 'tool/result' && event.data.message.isError !== true),
    compactionCount: events.filter(event => event.type === 'compaction/end').length,
  }))
} finally { await ctx.fiber.dispose() }

ctx = await boot()
try {
  const handle = await ctx.agents.resume({ resumeSessionId: id, agentOptions })
  handle.agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'resume now' }] }))
  await handle.agent.whenIdle()
  await ctx.sessions.flush(handle.agent.session)
  const fresh = await ctx.agentLoop.create(SessionId('fresh-owner-conversation'), agentOptions, { cwd: process.cwd() })
  fresh.followup(createUserMessage({
    source: { kind: 'aitp-research', actor: 'human', origin },
    content: [{ type: 'text', text: 'fresh owner ask: continue this direction' }],
  }))
  await fresh.whenIdle()
  await ctx.sessions.flush(fresh.session)
} finally { await ctx.fiber.dispose() }
