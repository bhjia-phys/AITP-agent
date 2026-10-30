/** Service admission checks; the Loader suite covers the production composition. */
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { SessionRequestId } from '@deepseek-ai/dsh-api-session-controller/types'
import ResearchResources from '@deepseek-ai/dsh-research-resources'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { createUserMessage, LlmAdapter, ToolCallId, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import SandboxPolicy from '@deepseek-ai/dsh-sandbox-policy'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import * as JsonlPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import ExactSessionQuery from './fixtures/runtime/query-plugin.ts'
import ResearchMemory from '../src/index.ts'
import { promptAdmission } from './fixtures/admission.ts'
import { topicIdForPath, resourceIdForPath } from '../src/markdown.ts'

const disposers: (() => Promise<unknown>)[] = []
afterEach(async () => { for (const dispose of disposers.splice(0).reverse()) await dispose() })
const workspaceId = 'scratch' as WorkspaceId
const signal = (): AbortSignal => new AbortController().signal

class Capture extends LlmAdapter {
  requests: GenerateOptions[] = []
  writeNext = false
  private writeStage = 0
  constructor(private readonly readContextFirst = false) { super() }
  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    if (this.writeNext && this.writeStage < 2) {
      const preparing = this.writeStage++ === 0
      const operationId = /Operation ([0-9a-f-]+): prepared/.exec(JSON.stringify(options.messages))?.[1]
      if (!preparing && operationId === undefined) throw new Error('Prepared receipt did not reach the actual model request.')
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId(preparing ? 'prepare-record' : 'apply-record'),
        name: preparing ? 'research_prepare_change' : 'research_apply_change', arguments: JSON.stringify(preparing ? {
          disposition: 'edit', rationale: 'Retain the explicit human finite-system correction.', edits: [{
            resourceId: resourceIdForPath('a/research.md'), originalText: 'Finite systems only.',
            replacementText: 'Finite N=6 only, pending the boundary control.', rationale: 'Keep the boundary condition.', sourceRefs: [],
          }], remainingUses: ['The parent implication remains unresolved.'],
        } : { operationId }) } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
      return
    }
    if (this.readContextFirst && this.requests.length === 1) {
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId('read-owning-topic'), name: 'research_read_context', arguments: '{}' } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
      return
    }
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Bounded answer.' } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

async function fixture(readContextFirst = false, writable = false) {
  const path = await mkdtemp(join(tmpdir(), 'research-service-'))
  disposers.push(() => rm(path, { recursive: true, force: true }))
  disposers.push(() => rm(`${path}-receipts`, { recursive: true, force: true }))
  await mkdir(join(path, 'a'))
  await mkdir(join(path, 'b'))
  await writeFile(join(path, 'research.md'), '# Project\nGlobal question.\n## Topics\n[A](a/research.md)\n[B](b/research.md)\n')
  await writeFile(join(path, 'a/research.md'), '# Alpha\nThe first question.\n## Scope\nFinite systems only.\n## Materials\n[Shared](../shared.md)\n')
  await writeFile(join(path, 'b/research.md'), '# Beta\nA different question.\n## Materials\n[Shared](../shared.md)\n')
  await writeFile(join(path, 'shared.md'), '# Evidence\nThe unresolved condition.\n')
  const ctx = new Context()
  disposers.push(() => ctx.fiber.dispose())
  await mountAgentLoopTestDependencies(ctx)
  if (writable) await ctx.plugin(SandboxPolicy, { mode: 'workspace-write', workspaceRoot: path })
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(ExactSessionQuery)
  const loop = await ctx.plugin(AgentLoop, { agents: [] })
  const model = new Capture(readContextFirst)
  ctx.llm.registerAdapter(['capture'], model)
  // Isolate admission from generic SessionController creation; all later loop and context work is production code.
  const create = vi.fn(async () => {
    const agent = await ctx.agentLoop.create(SessionId(`service-${create.mock.calls.length}`), { provider: 'capture', model: 'capture' }, { cwd: path })
    return { sessionId: agent.id }
  })
  ctx.provide('sessionController', { create, ...promptAdmission(ctx) } as never)
  const service = new ResearchMemory(ctx, ResearchMemory.Config({ roots: [{ path, id: workspaceId, writable, stateDirectory: `${path}-receipts` }] }))
  return { service, ctx, path, create, model, loop }
}

it('prepares native source context without inventing a question or submitting a model turn', async () => {
  const { service, ctx, model } = await fixture()
  const result = await service.prepareDiscussion({ workspaceId, topicId: topicIdForPath('a/research.md'),
    question: 'Keep my exact native question.' }, signal())
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.error.message)
  expect(model.requests).toHaveLength(0)
  const agent = ctx.agents.get(result.value.sessionId)
  if (agent === undefined) throw new Error('Prepared native Session is unavailable')
  const selected = await service.getSessionMemory({ sessionId: result.value.sessionId }, signal())
  expect(selected.ok && selected.value?.researcher.length).toBe(0)
  agent.followup(createUserMessage({ source: { kind: 'user' },
    content: [{ type: 'text', text: 'Keep my exact native question.' }] }))
  await agent.whenIdle()
  expect(model.requests).toHaveLength(1)
  const request = JSON.stringify(model.requests[0])
  expect(request).toContain('Finite systems only.')
  expect(request).toContain('Keep my exact native question.')
  const events = agent.session.snapshotEvents().filter(event => event.type === 'user/message')
  expect(events.filter(event => event.data.source.kind === 'user')).toHaveLength(1)
  const recovered = await service.getSessionMemory({ sessionId: result.value.sessionId }, signal())
  expect(recovered.ok && recovered.value?.researcher.length).toBe(1)
  expect(await service.prepareDiscussion({ workspaceId, sessionId: agent.id,
    topicId: topicIdForPath('b/research.md'), question: 'Change scope?' }, signal())).toMatchObject({ ok: false })
})

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

it('delivers the owning question and answer from a material in both the request and explicit context tool', async () => {
  const { service, ctx, path, model } = await fixture(true)
  const question = 'Does the selected control answer the owning finite-size question?'
  const answer = 'It supports a conditional bound only under A.'
  await writeFile(join(path, 'a/research.md'), `# Alpha\nAn orientation, not the actual question or answer.\n## Question\n${question}\n## Current answer\n${answer}\n## Scope\nFinite N only.\n## Materials\n[Shared](../shared.md)\n`)
  await service.refresh({ workspaceId }, signal())
  const result = await service.ask({ workspaceId, topicId: topicIdForPath('a/research.md'), resourceId: resourceIdForPath('shared.md'),
    selectedText: 'The unresolved condition.', question: 'Explain this material in its research context.' }, signal())
  if (!result.ok) throw new Error(result.error.message)
  await ctx.agents.get(result.value.sessionId)!.whenIdle()
  expect(model.requests).toHaveLength(2)
  const actualContext = JSON.stringify(model.requests[0]?.messages.filter(message => message.role === 'user' && message.source?.kind === 'runtime-context'))
  const toolResult = JSON.stringify(model.requests[1]?.messages.find(message => message.role === 'tool' && message.toolCallId === 'read-owning-topic'))
  for (const delivered of [actualContext, toolResult]) {
    expect(delivered).toContain(question)
    expect(delivered).toContain(answer)
    expect(delivered).toContain('Finite N only.')
    expect(delivered).toContain('The unresolved condition.')
    expect(delivered).not.toContain('A different question.')
  }
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
    if (method.method === 'getSessionMemory' || method.method === 'setResearchMode') {
      expect(method.resources?.['session']?.({ sessionId: result.value.sessionId })).toBe(result.value.sessionId)
    }
    else expect(method.resources?.['workspace']?.({ workspaceId })).toBe(workspaceId)
  }
})

it('delivers an existing family map to the normal model context without a new-project prompt', async () => {
  const { service, ctx, path, model } = await fixture()
  await rm(join(path, 'research.md'))
  await writeFile(join(path, 'README.md'), '# Independent family\n\nEach direction retains its own evidence.\n\n## Topics\n[A](a/research.md)\n[B](b/research.md)\n')
  const result = await service.ask({ workspaceId, question: 'Recover the existing directions.' }, signal())
  if (!result.ok) throw new Error(result.error.message)
  await ctx.agents.get(result.value.sessionId)!.whenIdle()
  const context = JSON.stringify(model.requests.at(-1)?.messages.filter(message => message.role === 'user' && message.source?.kind === 'runtime-context'))
  expect(context).toContain('Independent family')
  expect(context).toContain('Each direction retains its own evidence.')
  expect(context).toContain('Research family folder map')
  expect(await service.getSessionMemory({ sessionId: result.value.sessionId }, signal())).toMatchObject({
    ok: true, value: { researchLocation: { initializing: false, title: 'Independent family' } },
  })
  await expect(readFile(join(path, 'research.md'))).rejects.toMatchObject({ code: 'ENOENT' })
})

it('reads memory from a persisted cold Session without creating an Agent, and keeps ordinary Sessions empty', async () => {
  const { service, ctx, path, create, loop } = await fixture()
  await ctx.plugin(JsonlPersistence, { root: join(path, '.sessions'), compression: 'none' })
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
  const session = ctx.sessions.create(SessionId('outside-research-root'), { meta: { cwd: path } })
  session.append('user/message', createUserMessage({ source: { kind: 'aitp-research', actor: 'human',
    origin: { workspaceId: 'not-configured', topicId: 'other' } }, content: [{ type: 'text', text: 'Private other-root question.' }] }), { surfaceOp: 'append' })
  await expect(service.getSessionMemory({ sessionId: session.id }, signal())).rejects.toThrow('Workspace is unavailable')
  const caller = ctx.extend({ invocation: { peer: { principal: { kind: 'external-test-reader' } } } })
  const observe = vi.spyOn(ctx.sessionQuery, 'observeSession')
  await expect(caller.researchMemory.getSessionMemory({ sessionId: session.id }, signal())).rejects.toThrow('available to the workspace owner')
  await expect(caller.researchMemory.ask({ workspaceId, sessionId: session.id, question: 'Unauthorized continuation' }, signal())).rejects.toThrow('available to the workspace owner')
  await expect(caller.researchMemory.listDiscussions({ workspaceId }, signal())).rejects.toThrow('available to the workspace owner')
  expect(observe).not.toHaveBeenCalled()
})

it('inspects only the owning conversation actual write receipt with immutable before/after and separate current bytes', async () => {
  const { service, ctx, model, path, create } = await fixture(false, true)
  model.writeNext = true
  const asked = await service.ask({ workspaceId, topicId: topicIdForPath('a/research.md'),
    question: 'Correct this isolated record: retain finite N=6 and the missing boundary control.' }, signal())
  if (!asked.ok) throw new Error(asked.error.message)
  const agent = ctx.agents.get(asked.value.sessionId)!
  await agent.whenIdle()
  const write = ctx.sessionProjections.stateOf(agent.session, 'researchWorking')?.writes.find(item => item.state === 'applied')
  if (write === undefined) throw new Error(`A real source write was not applied: ${JSON.stringify(model.requests.at(-1)?.messages)}`)
  const request = { workspaceId, sessionId: agent.id, operationId: write.operationId }
  const inspected = await service.getChange(request, signal())
  expect(inspected).toMatchObject({ ok: true, value: { ...request, state: 'applied', completeness: 'complete',
    files: [{ relativePath: 'a/research.md', state: 'applied', current: { state: 'matches-planned-output' } }],
    remainingUses: ['The parent implication remains unresolved.'], omittedFiles: 0, omittedDiffs: 0, omittedUses: 0,
  } })
  if (!inspected.ok) throw new Error(inspected.error.message)
  expect(inspected.value.files[0]?.beforeText).toContain('Finite systems only.')
  expect(inspected.value.files[0]?.afterText).toContain('Finite N=6 only, pending the boundary control.')
  await writeFile(join(path, 'a/research.md'), '# External subsequent edit\nKeep the later editor change.\n')
  expect(await service.getChange(request, signal())).toMatchObject({ ok: true, value: { state: 'applied',
    files: [{ beforeText: inspected.value.files[0]?.beforeText, afterText: inspected.value.files[0]?.afterText,
      current: { state: 'different' } }],
  } })
  const other = await service.ask({ workspaceId, topicId: topicIdForPath('b/research.md'), question: 'Independent discussion.' }, signal())
  if (!other.ok) throw new Error(other.error.message)
  await ctx.agents.get(other.value.sessionId)!.whenIdle()
  expect(await service.getChange({ ...request, sessionId: other.value.sessionId }, signal()))
    .toMatchObject({ ok: false, error: { code: 'permission-denied' } })
  expect(await service.getChange({ ...request, workspaceId: brandString<WorkspaceId>('other') }, signal()))
    .toMatchObject({ ok: false, error: { code: 'permission-denied' } })
  const caller = ctx.extend({ invocation: { peer: { principal: { kind: 'external-test-reader' } } } })
  await expect(caller.researchMemory.getChange(request, signal())).rejects.toThrow('available to the workspace owner')
  expect(create).toHaveBeenCalledTimes(2)
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


it('continues the exact direction with immutable per-message origins and native retry identities', async () => {
  const { service, ctx, create, model } = await fixture()
  const topicId = topicIdForPath('a/research.md')
  const first = await service.ask({ workspaceId, topicId, resourceId: resourceIdForPath('a/research.md'), question: 'First exact question.' }, signal())
  if (!first.ok) throw new Error(first.error.message)
  const sessionId = first.value.sessionId
  const agent = ctx.agents.get(sessionId)!
  await agent.whenIdle()
  const request = { workspaceId, topicId, sessionId, requestId: brandString<SessionRequestId>('second-research-input'),
    mode: 'steer' as const, resourceId: resourceIdForPath('shared.md'), selectedText: 'The unresolved condition.',
    question: 'UNTRUSTED_DIFFERENT_SEARCH_TEXT', content: [{ type: 'text' as const, text: 'Actual composer follow-up.' }] }
  expect(await service.ask(request, signal())).toEqual({ ok: true, value: { sessionId } })
  await agent.whenIdle()
  expect(await service.ask(request, signal())).toEqual({ ok: true, value: { sessionId } })
  await agent.whenIdle()
  expect(create).toHaveBeenCalledTimes(1)
  expect(model.requests).toHaveLength(2)
  expect(JSON.stringify(model.requests.at(-1))).not.toContain('UNTRUSTED_DIFFERENT_SEARCH_TEXT')
  const accepted = agent.session.snapshotEvents().filter(event => event.type === 'user/message')
    .filter(event => event.data.source.kind === 'aitp-research')
  expect(accepted).toHaveLength(2)
  expect(accepted[0]?.data.source).toMatchObject({ kind: 'aitp-research', origin: { resourceId: resourceIdForPath('a/research.md') } })
  expect(accepted[1]?.data).toMatchObject({ id: 'second-research-input', source: { kind: 'aitp-research', origin: { resourceId: resourceIdForPath('shared.md') } } })
  expect(accepted[1]?.data.source).not.toHaveProperty('origin.sessionId')
  await expect(service.ask({ ...request, topicId: topicIdForPath('b/research.md'), requestId: brandString<SessionRequestId>('wrong-direction') }, signal()))
    .rejects.toMatchObject({ code: 'research/session-unavailable' })
  expect(model.requests).toHaveLength(2)
})

it('binds only an explicit same-Workspace blank discussion and refuses unrelated ordinary history', async () => {
  const { service, ctx, path, create, model } = await fixture()
  const blank = await ctx.agentLoop.create(SessionId('explicit-blank'), { provider: 'capture', model: 'capture' }, { cwd: path })
  const other = await ctx.agentLoop.create(SessionId('foreign-blank'), { provider: 'capture', model: 'capture' }, { cwd: join(path, 'b') })
  const ordinary = await ctx.agentLoop.create(SessionId('ordinary-history'), { provider: 'capture', model: 'capture' }, { cwd: path })
  ordinary.session.append('user/message', createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Prior unrelated discussion.' }] }), { surfaceOp: 'append' })
  const request = { workspaceId, topicId: topicIdForPath('a/research.md'), question: 'First real input.' }
  for (const agent of [other, ordinary]) await expect(service.ask({ ...request, sessionId: agent.id }, signal()))
    .rejects.toMatchObject({ code: 'research/session-unavailable' })
  expect(model.requests).toHaveLength(0)
  expect(await service.ask({ ...request, sessionId: blank.id }, signal())).toMatchObject({ ok: true, value: { sessionId: blank.id } })
  await blank.whenIdle()
  expect(create).not.toHaveBeenCalled()
  expect(model.requests).toHaveLength(1)
})

it('lists live and durable discussions by exact topic with fresh titles and honest bounds, without activating cold Agents', async () => {
  const { service, ctx, path, create, loop } = await fixture()
  await ctx.plugin(JsonlPersistence, { root: join(path, '.sessions'), compression: 'none' })
  const topicId = topicIdForPath('a/research.md')
  const ids = []
  for (const selected of [topicId, topicIdForPath('b/research.md'), topicId]) {
    const result = await service.ask({ workspaceId, topicId: selected, question: `Question for ${selected}` }, signal())
    if (!result.ok) throw new Error(result.error.message)
    const agent = ctx.agents.get(result.value.sessionId)!
    await agent.whenIdle()
    agent.session.append('session/title', { title: `Actual title ${ids.length}`, source: { kind: 'user' }, messageSeqs: [] })
    await ctx.sessions.flush(agent.session)
    ids.push(agent.id)
  }
  const live = await service.listDiscussions({ workspaceId, topicId }, signal())
  if (!live.ok) throw new Error(live.error.message)
  expect(live.value.completeness).toBe('complete')
  expect(live.value.items.map(item => item.sessionId).sort()).toEqual([ids[0], ids[2]].sort())
  expect(live.value.items.map(item => item.title).sort()).toEqual(['Actual title 0', 'Actual title 2'])
  expect(live.value.items.every(item => !item.busy)).toBe(true)
  expect(await service.listDiscussions({ workspaceId, topicId, limit: 1 }, signal())).toMatchObject({ ok: true, value: { completeness: 'partial', items: [expect.anything()] } })
  expect(await service.listDiscussions({ workspaceId }, signal())).toMatchObject({ ok: true, value: { completeness: 'complete', items: [] } })
  await loop.dispose()
  const observed = vi.spyOn(ctx.sessionQuery, 'observeSession')
  const cold = await service.listDiscussions({ workspaceId, topicId }, signal())
  expect(cold).toEqual(live)
  const calls = observed.mock.calls.length
  expect(await service.listDiscussions({ workspaceId, topicId }, signal())).toEqual(cold)
  expect(observed).toHaveBeenCalledTimes(calls)
  for (const id of ids) expect(ctx.agents.get(id)).toBeUndefined()
  expect(create).toHaveBeenCalledTimes(3)
})

it('explicitly refreshes material readers after confirmed writes and retains the file outcome if notification fails', async () => {
  const { service, ctx } = await fixture(false, true)
  await ctx.plugin(ResearchResources, { roots: [] })
  await ctx.fiber.await()
  const topicId = topicIdForPath('a/research.md')
  const topic = await service.getTopic({ workspaceId, topicId }, signal())
  if (!topic.ok) throw new Error(topic.error.message)
  const refresh = vi.spyOn(ctx.researchResources, 'refresh')
  const preview = await service.previewChange({ workspaceId, intent: { topicId, expectedRevision: topic.value.revision,
    command: { kind: 'update-scope', scope: 'Finite systems only, with convention A.' } } })
  if (!preview.ok) throw new Error(preview.error.message)
  refresh.mockRejectedValueOnce(new Error('Materials bridge interrupted after write.'))
  const applied = await service.applyChange({ workspaceId, request: { previewId: preview.value.value.previewId, operationId: 'explicit-write-refresh' } })
  expect(applied.ok).toBe(true)
  if (!applied.ok) throw new Error(applied.error.message)
  expect(applied.value.value.notificationWarning).toContain('file outcome is recorded')
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(refresh.mock.calls[0]?.[0]).toHaveProperty('rootId')
  const readback = await service.getTopic({ workspaceId, topicId }, signal())
  expect(readback.ok && readback.value.value.scope).toContain('convention A')
  const stale = await service.applyChange({ workspaceId, request: { previewId: 'missing-preview', operationId: 'failed-write-refresh' } })
  expect(stale.ok).toBe(false)
  expect(refresh).toHaveBeenCalledTimes(1)
})


it('rechecks a blank discussion after concurrent attachment admission before binding its first direction', async () => {
  const { service, ctx, path, model } = await fixture()
  const agent = await ctx.agentLoop.create(SessionId('racing-blank'), { provider: 'capture', model: 'capture' }, { cwd: path })
  const original = ctx.attachments.admitPromptContent.bind(ctx.attachments)
  const release: (() => void)[] = []
  const admission = vi.spyOn(ctx.attachments, 'admitPromptContent').mockImplementation(async (content) => {
    const admitted = await original(content)
    await new Promise<void>((resolve) => { release.push(resolve) })
    return admitted
  })
  const settled = Promise.allSettled(['a', 'b'].map(direction => service.ask({ workspaceId, sessionId: agent.id,
    topicId: topicIdForPath(`${direction}/research.md`), question: `Question from ${direction}` }, signal())))
  await vi.waitFor(() => { expect(admission).toHaveBeenCalledTimes(2) })
  for (const resolve of release) resolve()
  const results = await settled
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
  await agent.whenIdle()
  expect(model.requests).toHaveLength(1)
  const accepted = agent.session.snapshotEvents().filter(event => event.type === 'user/message' && event.data.source.kind === 'aitp-research')
  expect(accepted).toHaveLength(1)
})

it('resumes the exact persisted discussion through Session authority and retains its original human context', async () => {
  const { service, ctx, path, loop, create, model } = await fixture()
  await ctx.plugin(JsonlPersistence, { root: join(path, '.sessions'), compression: 'none' })
  ctx.provide('agentDefaultModel', { currentSelection: () => ({ provider: 'capture', model: 'capture' }), saveSelection: async () => {} } as never)
  const request = { workspaceId, topicId: topicIdForPath('a/research.md'), question: 'PERSISTED_EXACT_HUMAN_BOUNDARY' }
  const first = await service.ask(request, signal())
  if (!first.ok) throw new Error(first.error.message)
  const original = ctx.agents.get(first.value.sessionId)!
  await original.whenIdle()
  await ctx.sessions.flush(original.session)
  await loop.dispose()
  expect(ctx.agents.get(first.value.sessionId)).toBeUndefined()
  await ctx.plugin(AgentLoop, { agents: [] })
  const resumed = await service.ask({ ...request, sessionId: first.value.sessionId, question: 'Continue that same research direction.' }, signal())
  expect(resumed).toEqual(first)
  const agent = ctx.agents.get(first.value.sessionId)!
  expect(agent).not.toBe(original)
  await agent.whenIdle()
  expect(JSON.stringify(model.requests.at(-1))).toContain('PERSISTED_EXACT_HUMAN_BOUNDARY')
  expect(create).toHaveBeenCalledTimes(1)
})
