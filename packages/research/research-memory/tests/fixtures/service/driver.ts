/** Load the production research service, write its scratch source, and resume from disk. */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
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
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import ResearchMemory from '@deepseek-ai/dsh-research-memory'
import ExactSessionQuery from '../runtime/query-plugin.ts'
import type { Result, TopicId } from '@deepseek-ai/dsh-research-memory'
import * as mock from './mock-llm.ts'

const configuredPath = process.argv[2]
if (configuredPath === undefined) throw new Error('The service fixture needs its Loader configuration path.')
const configPath = configuredPath
const root = join(process.cwd(), 'notes')
const workspaceId = 'service-scratch' as WorkspaceId
const topicId = 'topic:child%2Fresearch.md' as TopicId
const sessionId = SessionId('research-service-write')
const agentOptions = { provider: 'research-service-model', model: 'research-service-model' }
const originalParent = '# Project\n\n[Child](child/research.md) supplies finite-size controls only; it does not settle the root question.\n\n## Other work\n\n[Sibling](sibling/research.md) studies an independent question.\n'
const originalSibling = '# Sibling\n\nDoes C hold?\n\n## Current answer\n\nUndetermined; this question has not been assessed.\n'
await mkdir(join(root, 'child'), { recursive: true })
await mkdir(join(root, 'sibling'), { recursive: true })
await writeFile(join(root, 'research.md'), originalParent)
await writeFile(join(root, 'sibling/research.md'), originalSibling)
await writeFile(join(root, 'child/research.md'), '# Child\n\nCan we establish a finite bound?\n\n## Scope\n\nFinite N only.\n\n## Current answer\n\nNo accepted bound.\n\n## Limitations\n\nNo thermodynamic claim.\n\n## Current work\n\nThe failed open-boundary route can reopen only after its boundary condition changes.\n')
await writeFile(join(root, 'report.md'), '# Control\n\nThe synthetic N=6 control assumes A.\n')

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

async function boot(): Promise<Context> {
  const ctx = new Context()
  ctx.baseUrl = `${pathToFileURL(dirname(configPath)).href}/`
  await ctx.plugin(Loader)
  Object.assign(ctx.loader.builtins, { include: Include, llm: LlmRuntime, sessions: SessionStore,
    projections: SessionProjectionRegistry, persistence: JsonlPersistence, prompt: SystemPrompt,
    tools: ToolRuntime, agents: AgentRegistry, loop: AgentLoop, typert: TypertRegistry,
    policy: SandboxPolicy, mock, research: ResearchMemory, query: ExactSessionQuery })
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  for (const entry of ctx.loader.entries()) await entry.fiber?.await()
  if (ctx.get('researchMemory') === undefined) throw new Error('The production ResearchMemory plugin did not load.')
  return ctx
}

const signal = new AbortController().signal
let ctx = await boot()
try {
  const project = unwrap(await ctx.researchMemory.getProject({ workspaceId }, signal))
  const before = unwrap(await ctx.researchMemory.getTopic({ workspaceId, topicId }, signal))
  const agent = await ctx.agentLoop.create(sessionId, agentOptions, { cwd: root })
  agent.followup(createUserMessage({ source: { kind: 'aitp-research', actor: 'human', origin: {
    workspaceId, topicId, resourceId: 'resource:child%2Fresearch.md',
  } }, content: [{ type: 'text', text: 'Preserve the failed route and every condition. Integrate only the supported child result.' }] }))
  await agent.whenIdle()
  const after = unwrap(await ctx.researchMemory.getTopic({ workspaceId, topicId }, signal))
  const parentBeforeRepairPreserved = await readFile(join(root, 'research.md'), 'utf8') === originalParent
  agent.followup(createUserMessage({ source: { kind: 'aitp-research', actor: 'human', origin: {
    workspaceId, topicId, resourceId: 'resource:child%2Fresearch.md',
  } }, content: [{ type: 'text', text: 'Now assess and update the parent-use passage explicitly, retaining the finite-size limit. Leave the sibling untouched.' }] }))
  await agent.whenIdle()
  await ctx.sessions.flush(agent.session)
  await writeFile('service-observations.json', JSON.stringify({ project, before, after,
    parentBeforeRepairPreserved,
    parentAfterRepair: await readFile(join(root, 'research.md'), 'utf8'),
    siblingPreserved: await readFile(join(root, 'sibling/research.md'), 'utf8') === originalSibling }))
} finally { await ctx.fiber.dispose() }

ctx = await boot()
try {
  const handle = await ctx.agents.resume({ resumeSessionId: sessionId, agentOptions })
  handle.agent.followup(createUserMessage({ source: { kind: 'user' },
    content: [{ type: 'text', text: 'Resume the same child after restart.' }] }))
  await handle.agent.whenIdle()
  await ctx.sessions.flush(handle.agent.session)
  await writeFile('service-restarted.json', JSON.stringify({
    topic: unwrap(await ctx.researchMemory.getTopic({ workspaceId, topicId }, signal)),
    memory: unwrap(await ctx.researchMemory.getSessionMemory({ sessionId }, signal)),
    parent: await readFile(join(root, 'research.md'), 'utf8'),
    siblingPreserved: await readFile(join(root, 'sibling/research.md'), 'utf8') === originalSibling,
  }))
} finally { await ctx.fiber.dispose() }
