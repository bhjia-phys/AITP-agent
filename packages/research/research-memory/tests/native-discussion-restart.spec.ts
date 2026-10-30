/** Native DSH preparation must not turn a blank Session into a synthetic conversation. */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { SessionRequestId } from '@deepseek-ai/dsh-api-session-controller/types'
import type { SessionPromptRequest } from '@deepseek-ai/dsh-api-session-controller/types'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { LlmAdapter, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId, type SessionEvent, type SessionId as SessionIdentity } from '@deepseek-ai/dsh-session'
import * as JsonlPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import ExactSessionQuery from './fixtures/runtime/query-plugin.ts'
import { promptAdmission } from './fixtures/admission.ts'
import ResearchMemory from '../src/index.ts'
import { resourceIdForPath, topicIdForPath } from '../src/markdown.ts'

const workspaceId = brandString<WorkspaceId>('native-discussion-restart')
const signal = (): AbortSignal => new AbortController().signal
const modelSelection = { provider: 'native-restart', model: 'native-restart' }

class Capture extends LlmAdapter {
  readonly requests: GenerateOptions[] = []

  override async *stream(request: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(request)
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Bounded native answer.' } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

interface NativeBoot {
  readonly ctx: Context
  readonly service: ResearchMemory
  readonly createCalls: readonly unknown[]
  readonly prompt: (request: SessionPromptRequest, signal: AbortSignal) => Promise<unknown>
  readonly rejectNextPrompt: () => void
}

async function seed(root: string): Promise<void> {
  await mkdir(join(root, 'a'))
  await writeFile(join(root, 'research.md'), '# Project\n\n## Topics\n\n[Alpha](a/research.md)\n')
  await writeFile(join(root, 'a/research.md'), '# Alpha\n\n## Scope\n\nFinite systems only.\n\n## Materials\n\n[Shared](../shared.md)\n')
  await writeFile(join(root, 'shared.md'), '# Evidence\n\nThe unresolved condition.\n')
}

/** Boot only ordinary DSH prompt admission: no fork-only attributed-admission surface is exposed. */
async function boot(root: string, model: Capture): Promise<NativeBoot> {
  const ctx = new Context()
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(ExactSessionQuery)
  await ctx.plugin(JsonlPersistence, { root: join(root, '.sessions'), compression: 'none' })
  await ctx.plugin(AgentLoop, { agents: [] })
  // Match the standard DSH host's plugin-owned durable storage.  The second
  // Context below reopens this same backend rather than relying on a live
  // in-memory selection or on the Session JSONL itself.
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root: join(root, '.dsh-home', 'storages') })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  ctx.llm.registerAdapter([modelSelection.provider], model)
  ctx.provide('dshHomePath', (...parts: string[]) => join(root, '.dsh-home', ...parts))
  ctx.provide('agentDefaultModel', { currentSelection: () => modelSelection, saveSelection: async () => {} } as never)
  ctx.provide('workspaceRegistry', {
    get: (id: WorkspaceId) => id === workspaceId ? { path: root } : undefined,
    list: () => [{ id: workspaceId, path: root }],
  } as never)
  const admission = promptAdmission(ctx)
  const createCalls: unknown[] = []
  const create = async (request: { readonly sessionId?: SessionIdentity }) => {
    createCalls.push(request)
    const agent = await ctx.agentLoop.create(request.sessionId ?? SessionId(`native-${createCalls.length}`), modelSelection, { cwd: root })
    return { sessionId: agent.id }
  }
  // This deliberately provides only the public standard-prompt capability.
  let rejection: Error | undefined
  const prompt = async (request: SessionPromptRequest, _signal: AbortSignal) => {
    if (rejection !== undefined) {
      const error = rejection
      rejection = undefined
      throw error
    }
    return await admission.promptAttributed(request, { kind: 'user', rpcId: request.requestId }, () => {})
  }
  ctx.provide('sessionController', { create, resolveAgent: admission.resolveAgent, prompt } as never)
  const service = new ResearchMemory(ctx, ResearchMemory.Config({ roots: [{ id: workspaceId, path: root, writable: false,
    stateDirectory: join(root, '.research-state') }] }))
  return { ctx, service, createCalls, prompt, rejectNextPrompt: () => { rejection = new Error('standard admission failed') } }
}

function humanMessages(events: readonly SessionEvent[]): Extract<SessionEvent, { readonly type: 'user/message' }>[] {
  return events.filter((event): event is Extract<SessionEvent, { readonly type: 'user/message' }> =>
    event.type === 'user/message' && event.data.source.kind === 'user')
}

it('keeps a prepared native discussion blank, then restores its selected source through a standard-controller restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'native-discussion-restart-'))
  let first: NativeBoot | undefined
  let restarted: NativeBoot | undefined
  try {
    await seed(root)
    const model = new Capture()
    first = await boot(root, model)
    const topicId = topicIdForPath('a/research.md')
    const prepared = await first.service.prepareDiscussion({ workspaceId, topicId,
      resourceId: resourceIdForPath('shared.md'), selectedText: 'The unresolved condition.', workflow: true }, signal())
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) throw new Error(prepared.error.message)
    const sessionId = prepared.value.sessionId
    const native = first.ctx.agents.get(sessionId)
    if (native === undefined) throw new Error('The prepared native Session is unavailable.')

    // Preparing source context must not append a synthetic human message or submit a turn.
    expect(native.session.snapshotEvents().filter(event => event.type === 'user/message')).toEqual([])
    expect(model.requests).toHaveLength(0)
    expect(first.createCalls).toHaveLength(1)

    const initialQuestion = 'Keep the finite-system condition in this native discussion.'
    await first.service.promptWorkflow({ workspaceId, sessionId, requestId: brandString<SessionRequestId>('native-first-prompt'), mode: 'queue',
      content: [{ type: 'text', text: initialQuestion }] }, signal())
    await native.whenIdle()
    expect(humanMessages(native.session.snapshotEvents())).toMatchObject([{
      data: { source: { kind: 'user' }, content: [{ type: 'text', text: initialQuestion }] },
    }])
    expect(humanMessages(native.session.snapshotEvents())).toHaveLength(1)
    expect(native.session.snapshotEvents().some(event => event.type === 'user/message'
      && event.data.source.kind === 'aitp-research')).toBe(false)
    const firstRequest = JSON.stringify(model.requests[0])
    expect(firstRequest).toContain('Finite systems only.')
    expect(firstRequest).toContain('The unresolved condition.')
    expect(firstRequest).toContain(initialQuestion)
    await first.ctx.sessions.flush(native.session)
    await first.ctx.fiber.dispose()
    first = undefined

    // A true fresh Host/service must recover the activated selection from durable state, not infer it from a fake message.
    restarted = await boot(root, model)
    const cold = await restarted.service.getSessionMemory({ sessionId }, signal())
    expect(cold).toMatchObject({ ok: true, value: { researchLocation: {
      workspaceId, topicId, global: false, workflow: true,
    }, sessionOrigin: { kind: 'source', notePath: 'shared.md' }, researcher: [{ text: initialQuestion }],
    contextSnapshots: [{ text: expect.stringContaining('Finite systems only.') }] } })
    expect(restarted.ctx.agents.get(sessionId)).toBeUndefined()

    const continuation = 'Continue without changing the selected source or research direction.'
    await restarted.service.promptWorkflow({ workspaceId, sessionId, requestId: brandString<SessionRequestId>('native-restarted-prompt'), mode: 'queue',
      content: [{ type: 'text', text: continuation }] }, signal())
    const resumed = restarted.ctx.agents.get(sessionId)
    if (resumed === undefined) throw new Error('The standard controller did not resume the native Session.')
    await resumed.whenIdle()
    const messages = humanMessages(resumed.session.snapshotEvents())
    expect(messages).toHaveLength(2)
    expect(messages.every(message => message.data.source.kind === 'user')).toBe(true)
    const resumedRequest = JSON.stringify(model.requests.at(-1))
    expect(resumedRequest).toContain('Finite systems only.')
    expect(resumedRequest).toContain('The unresolved condition.')
    expect(resumedRequest).toContain(initialQuestion)
    expect(resumedRequest).toContain(continuation)
  } finally {
    await restarted?.ctx.fiber.dispose()
    await first?.ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

it('records a blank prepared discussion\'s Research switch without creating a turn, and keeps that mode after restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'native-discussion-mode-'))
  let first: NativeBoot | undefined
  let restarted: NativeBoot | undefined
  try {
    await seed(root)
    const model = new Capture()
    first = await boot(root, model)
    const prepared = await first.service.prepareDiscussion({ workspaceId, topicId: topicIdForPath('a/research.md'),
      resourceId: resourceIdForPath('shared.md'), selectedText: 'The unresolved condition.', workflow: true }, signal())
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) throw new Error(prepared.error.message)
    const sessionId = prepared.value.sessionId
    const native = first.ctx.agents.get(sessionId)
    if (native === undefined) throw new Error('The prepared native Session is unavailable.')

    await first.service.setResearchMode({ sessionId, enabled: false }, signal())
    expect(native.session.snapshotEvents().filter(event => event.type === 'user/message')).toEqual([])
    expect(model.requests).toHaveLength(0)

    await first.service.promptWorkflow({ workspaceId, sessionId, requestId: brandString<SessionRequestId>('native-mode-first-prompt'), mode: 'queue',
      content: [{ type: 'text', text: 'Keep this source available, but handle this turn as an ordinary task.' }] }, signal())
    await native.whenIdle()
    expect(JSON.stringify(model.requests[0])).not.toContain('Research workflow is enabled')
    await first.ctx.sessions.flush(native.session)
    await first.ctx.fiber.dispose()
    first = undefined

    restarted = await boot(root, model)
    const cold = await restarted.service.getSessionMemory({ sessionId }, signal())
    expect(cold).toMatchObject({ ok: true, value: { researchLocation: { workflow: false } } })
    await restarted.service.promptWorkflow({ workspaceId, sessionId, requestId: brandString<SessionRequestId>('native-mode-restart-prompt'), mode: 'queue',
      content: [{ type: 'text', text: 'Continue the ordinary task.' }] }, signal())
    const resumed = restarted.ctx.agents.get(sessionId)
    if (resumed === undefined) throw new Error('The standard controller did not resume the native Session.')
    await resumed.whenIdle()
    expect(JSON.stringify(model.requests.at(-1))).not.toContain('Research workflow is enabled')
    expect(humanMessages(resumed.session.snapshotEvents())).toHaveLength(2)
  } finally {
    await restarted?.ctx.fiber.dispose()
    await first?.ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

it('withdraws a failed standard-composer reservation instead of binding a later unrelated input', async () => {
  const root = await mkdtemp(join(tmpdir(), 'native-discussion-failed-admission-'))
  let first: NativeBoot | undefined
  try {
    await seed(root)
    const model = new Capture()
    first = await boot(root, model)
    first.rejectNextPrompt()
    await expect(first.service.ask({ workspaceId, topicId: topicIdForPath('a/research.md'),
      resourceId: resourceIdForPath('shared.md'), selectedText: 'The unresolved condition.', workflow: true,
      question: 'This selection must not leak after a failed admission.' }, signal())).rejects.toThrow('standard admission failed')

    const sessionId = SessionId('native-1')
    const native = first.ctx.agents.get(sessionId)
    if (native === undefined) throw new Error('The failed admission did not leave its native Session available for inspection.')
    expect(native.session.snapshotEvents().filter(event => event.type === 'user/message')).toEqual([])
    await first.prompt({ sessionId, requestId: brandString<SessionRequestId>('native-after-failure-prompt'), mode: 'queue',
      content: [{ type: 'text', text: 'This is an unrelated ordinary follow-up.' }] }, signal())
    await native.whenIdle()
    expect(JSON.stringify(model.requests[0])).not.toContain('Finite systems only.')
    expect(JSON.stringify(model.requests[0])).not.toContain('The unresolved condition.')
    expect(await first.service.getSessionMemory({ sessionId }, signal())).toMatchObject({ ok: true, value: null })
  } finally {
    await first?.ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }
})
