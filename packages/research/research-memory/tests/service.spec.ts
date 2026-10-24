/** Service admission checks; the Loader suite covers the production composition. */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { createUserMessage, LlmAdapter, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import * as JsonlPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import ExactSessionQuery from './fixtures/runtime/query-plugin.ts'
import ResearchMemory from '../src/index.ts'
import { topicIdForPath, resourceIdForPath } from '../src/markdown.ts'

const disposers: (() => Promise<unknown>)[] = []
afterEach(async () => { for (const dispose of disposers.splice(0).reverse()) await dispose() })
const workspaceId = 'scratch' as WorkspaceId
const signal = (): AbortSignal => new AbortController().signal

class Capture extends LlmAdapter {
  requests: GenerateOptions[] = []
  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Bounded answer.' } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

async function fixture() {
  const path = await mkdtemp(join(tmpdir(), 'research-service-'))
  disposers.push(() => rm(path, { recursive: true, force: true }))
  await mkdir(join(path, 'a'))
  await mkdir(join(path, 'b'))
  await writeFile(join(path, 'research.md'), '# Project\nGlobal question.\n## Topics\n[A](a/research.md)\n[B](b/research.md)\n')
  await writeFile(join(path, 'a/research.md'), '# Alpha\nThe first question.\n## Scope\nFinite systems only.\n## Materials\n[Shared](../shared.md)\n')
  await writeFile(join(path, 'b/research.md'), '# Beta\nA different question.\n## Materials\n[Shared](../shared.md)\n')
  await writeFile(join(path, 'shared.md'), '# Evidence\nThe unresolved condition.\n')
  const ctx = new Context()
  disposers.push(() => ctx.fiber.dispose())
  await mountAgentLoopTestDependencies(ctx)
  const loop = await ctx.plugin(AgentLoop, { agents: [] })
  const model = new Capture()
  ctx.llm.registerAdapter(['capture'], model)
  // Isolate admission from generic SessionController creation; all later loop and context work is production code.
  const create = vi.fn(async () => {
    const agent = await ctx.agentLoop.create(SessionId(`service-${create.mock.calls.length}`), { provider: 'capture', model: 'capture' }, { cwd: path })
    return { sessionId: agent.id }
  })
  ctx.provide('sessionController', { create } as never)
  const service = new ResearchMemory(ctx, ResearchMemory.Config({ roots: [{ path, id: workspaceId, writable: false }] }))
  return { service, ctx, path, create, model, loop }
}

it('rejects unresolved and ambiguous locations before creating a Session, and sends the resolved original to the actual request', async () => {
  const { service, ctx, create, model } = await fixture()
  const shared = resourceIdForPath('shared.md')
  expect(await service.ask({ workspaceId, resourceId: shared, question: 'Which branch?' }, signal())).toMatchObject({ ok: false })
  expect(await service.ask({ workspaceId, topicId: topicIdForPath('absent.md'), question: 'Missing?' }, signal())).toMatchObject({ ok: false })
  expect(create).not.toHaveBeenCalled()
  const result = await service.ask({ workspaceId, topicId: topicIdForPath('a/research.md'), resourceId: shared,
    selectedText: 'The unresolved condition.', question: '不要把这个条件忽略。为什么？' }, signal())
  if (!result.ok) throw new Error(result.error.message)
  await ctx.agents.get(result.value.sessionId)!.whenIdle()
  const sent = JSON.stringify(model.requests.at(-1))
  expect(sent).toContain('Finite systems only.')
  expect(sent).toContain('The unresolved condition.')
  expect(sent).toContain('不要把这个条件忽略。为什么？')
  expect(sent).not.toContain('A different question.')
  expect(await service.provider({ workspaceId }, signal())).toMatchObject({ capabilities: { applyChanges: false } })
})

it('supports project-root questions, cancels before admission, and names its workspace on every remote operation', async () => {
  const { service, ctx, create, model } = await fixture()
  const cancelled = AbortSignal.abort()
  await expect(service.ask({ workspaceId, question: 'Cancelled' }, cancelled)).rejects.toThrow()
  expect(create).not.toHaveBeenCalled()
  const result = await service.ask({ workspaceId, resourceId: resourceIdForPath('research.md'), question: 'Main question?' }, signal())
  if (!result.ok) throw new Error(result.error.message)
  await ctx.agents.get(result.value.sessionId)!.whenIdle()
  expect(JSON.stringify(model.requests.at(-1))).toContain('Global question.')
  for (const method of remoteMethods(service)) {
    if (method.method === 'getSessionMemory') expect(method.resources?.['session']?.({ sessionId: result.value.sessionId })).toBe(result.value.sessionId)
    else expect(method.resources?.['workspace']?.({ workspaceId })).toBe(workspaceId)
  }
})

it('reads memory from a persisted cold Session without creating an Agent, and keeps ordinary Sessions empty', async () => {
  const { service, ctx, path, create, loop } = await fixture()
  await ctx.plugin(JsonlPersistence, { root: join(path, '.sessions'), compression: 'none' })
  await ctx.plugin(ExactSessionQuery)
  const unbound = ctx.sessions.create(SessionId('ordinary-memory-reader'), { meta: { cwd: path } })
  expect(await service.getSessionMemory({ sessionId: unbound.id }, signal())).toEqual({ ok: true, value: null })
  expect(create).not.toHaveBeenCalled()
  const result = await service.ask({ workspaceId, topicId: topicIdForPath('a/research.md'), question: 'Retain my exact original question.' }, signal())
  if (!result.ok) throw new Error(result.error.message)
  const agent = ctx.agents.get(result.value.sessionId)!
  await agent.whenIdle()
  await ctx.sessions.flush(agent.session)
  const live = await service.getSessionMemory({ sessionId: result.value.sessionId }, signal())
  expect(live.ok && live.value?.researcher.some(item => item.text === 'Retain my exact original question.')).toBe(true)
  await loop.dispose()
  expect(ctx.agents.get(result.value.sessionId)).toBeUndefined()
  expect(ctx.sessions.get(result.value.sessionId)).toBeUndefined()
  const cold = await service.getSessionMemory({ sessionId: result.value.sessionId }, signal())
  expect(cold).toEqual(live)
  expect(ctx.agents.get(result.value.sessionId)).toBeUndefined()
  expect(create).toHaveBeenCalledTimes(1)
})

it('rejects non-owner memory reads and research scopes outside configured roots', async () => {
  const { service, ctx, path } = await fixture()
  await ctx.plugin(ExactSessionQuery)
  const session = ctx.sessions.create(SessionId('outside-research-root'), { meta: { cwd: path } })
  session.append('user/message', createUserMessage({ source: { kind: 'aitp-research', actor: 'human',
    origin: { workspaceId: 'not-configured', topicId: 'other' } }, content: [{ type: 'text', text: 'Private other-root question.' }] }), { surfaceOp: 'append' })
  await expect(service.getSessionMemory({ sessionId: session.id }, signal())).rejects.toThrow('Workspace is unavailable')
  const caller = ctx.extend({ invocation: { peer: { principal: { kind: 'external-test-reader' } } } })
  const observe = vi.spyOn(ctx.sessionQuery, 'observeSession')
  await expect(caller.researchMemory.getSessionMemory({ sessionId: session.id }, signal())).rejects.toThrow('available to the workspace owner')
  expect(observe).not.toHaveBeenCalled()
})

it.each([
  ['removed selection', 'The pinned selected source range changed; reopen the source and select it again.'],
  ['duplicate anchor', 'The source contains several matching anchors or headings.'],
  ['removed relationship', 'The selected material has no recorded relationship to the requested topic.'],
])('delivers the reason for a %s with fresh general topic evidence to the actual follow-up request', async (change, reason) => {
  const { service, ctx, path, model } = await fixture()
  const result = await service.ask({ workspaceId, topicId: topicIdForPath('a/research.md'),
    resourceId: resourceIdForPath('shared.md'), anchor: 'evidence', selectedText: 'The unresolved condition.',
    question: 'Explain the selected constraint.' }, signal())
  if (!result.ok) throw new Error(result.error.message)
  const agent = ctx.agents.get(result.value.sessionId)!
  await agent.whenIdle()
  if (change === 'removed selection') await writeFile(join(path, 'shared.md'), '# Evidence\nThe source account has changed.\n')
  else if (change === 'duplicate anchor') await writeFile(join(path, 'shared.md'), '# Evidence\nThe unresolved condition.\n## Evidence\nA different section.\n')
  else await writeFile(join(path, 'a/research.md'), '# Alpha\nThe first question.\n## Scope\nFinite systems only.\n')
  await service.refresh({ workspaceId }, signal())
  agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Recheck the selected source now.' }] }))
  await agent.whenIdle()
  const delivered = JSON.stringify(model.requests.at(-1)?.messages
    .filter(message => message.role === 'user' && message.source?.kind === 'runtime-context').at(-1))
  expect(delivered).toContain(reason)
  expect(delivered).toContain('Finite systems only.')
  expect(delivered).toContain('Original human-selected excerpt (not a fresh source read')
  expect(delivered).not.toContain('Source Selected source passage')
  expect(delivered).not.toContain('A different question.')
})

it('reports a vanished root excerpt without dropping the current authored project account', async () => {
  const { service, ctx, path, model } = await fixture()
  const result = await service.ask({ workspaceId, resourceId: resourceIdForPath('research.md'),
    selectedText: 'Global question.', question: 'Explain the project selection.' }, signal())
  if (!result.ok) throw new Error(result.error.message)
  const agent = ctx.agents.get(result.value.sessionId)!
  await agent.whenIdle()
  await writeFile(join(path, 'research.md'), '# Project\nCurrent root question.\n')
  await service.refresh({ workspaceId }, signal())
  agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Check the current root.' }] }))
  await agent.whenIdle()
  const delivered = JSON.stringify(model.requests.at(-1)?.messages
    .filter(message => message.role === 'user' && message.source?.kind === 'runtime-context').at(-1))
  expect(delivered).toContain('The pinned selected source range changed; reopen the source and select it again.')
  expect(delivered).toContain('Current root question.')
  expect(delivered).toContain('Original human-selected excerpt (not a fresh source read')
})

it('delivers usable source locators and topic evidence despite an unreadable authored directory link', async () => {
  const { service, ctx, path, model } = await fixture()
  await writeFile(join(path, 'a/research.md'), '# Alpha\nThe first question.\n## Scope\nFinite systems only.\n## Materials\n[Notes](notes/)\n[Project folder](../)\n')
  await service.refresh({ workspaceId }, signal())
  const topicId = topicIdForPath('a/research.md')
  expect(await service.getTopic({ workspaceId, topicId }, signal())).toMatchObject({ ok: true })
  const result = await service.ask({ workspaceId, topicId, resourceId: resourceIdForPath('a/research.md'),
    question: 'Which source and finite-system condition support this question?' }, signal())
  if (!result.ok) throw new Error(result.error.message)
  await ctx.agents.get(result.value.sessionId)!.whenIdle()
  const delivered = JSON.stringify(model.requests.at(-1)?.messages
    .filter(message => message.role === 'user' && message.source?.kind === 'runtime-context').at(-1))
  expect(delivered).toContain('Finite systems only.')
  expect(delivered).toContain('[resource:a%2Fresearch.md]')
  expect(delivered).toContain('Unavailable source:')
  expect(delivered).not.toContain('A source must have a normalized relative path')
})
