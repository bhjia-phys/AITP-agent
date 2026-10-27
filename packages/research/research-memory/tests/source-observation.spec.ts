/** Concurrent source observations use real Markdown discovery and a controlled watch carrier. */
import { EventEmitter } from 'node:events'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { createUserMessage, LlmAdapter, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import ResearchMemory from '../src/index.ts'
import { MarkdownWorkspace, topicIdForPath } from '../src/markdown.ts'
import type { Result, ReadEnvelope, TopicPage } from '../src/types.ts'
import type { ResearchOrigin } from '../src/working-types.ts'

const watchMock = vi.hoisted(() => vi.fn())
vi.mock('node:fs', async original => ({ ...await original<typeof import('node:fs')>(), watch: watchMock }))

class Watcher extends EventEmitter {
  close = vi.fn()
  constructor(readonly changed: () => void) { super() }
}
const watchers: Watcher[] = []
const disposers: (() => Promise<unknown>)[] = []
beforeEach(() => {
  watchMock.mockReset()
  watchers.length = 0
  watchMock.mockImplementation((_path: unknown, _options: unknown, changed: () => void) => {
    const watcher = new Watcher(changed)
    watchers.push(watcher)
    return watcher
  })
})
afterEach(async () => {
  for (const dispose of disposers.splice(0).reverse()) await dispose()
  vi.restoreAllMocks()
})
const workspaceId = 'scratch' as WorkspaceId
const signal = (): AbortSignal => new AbortController().signal
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}
class Capture extends LlmAdapter {
  requests: GenerateOptions[] = []
  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}
async function researchTurn(ctx: Context, origin: ResearchOrigin) {
  const model = new Capture()
  ctx.llm.registerAdapter(['capture'], model)
  const agent = await ctx.agentLoop.create(SessionId('cancel-source-preparation'), { provider: 'capture', model: 'capture' })
  agent.followup(createUserMessage({ source: { kind: 'aitp-research', actor: 'human', origin },
    content: [{ type: 'text', text: 'Read the current scope before answering.' }] }))
  return { agent, model }
}
async function idleBeforeRelease(agent: Agent): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([agent.whenIdle(), new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { reject(new Error('The cancelled runtime turn still waits for the held source read.')) }, 1000)
    })])
  } finally { clearTimeout(timer) }
}
function titles(result: Result<ReadEnvelope<TopicPage>>): string[] {
  if (!result.ok) throw new Error(result.error.message)
  return result.value.value.items.map(item => item.value.title)
}
async function fixture(options: { watchSources?: boolean; watchMode?: 'recursive' | 'bounded' } = {}) {
  const path = await mkdtemp(join(tmpdir(), 'research-observation-'))
  disposers.push(() => rm(path, { recursive: true, force: true }))
  await writeFile(join(path, 'research.md'), '# Project\nThe project question.\n')
  const ctx = new Context()
  disposers.push(() => ctx.fiber.dispose())
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(AgentLoop, { agents: [] })
  const effects = vi.spyOn(ctx, 'effect')
  const service = new ResearchMemory(ctx, ResearchMemory.Config({ roots: [{ path, id: workspaceId, writable: false }], ...options }))
  const sourceEffect = effects.mock.calls.findIndex(([, label]) => label === 'research-memory: source observations and admitted onboarding')
  const sourceDisposer = effects.mock.results[sourceEffect]
  effects.mockRestore()
  if (sourceDisposer?.type !== 'return') throw new Error('Source observation effect was not registered')
  const list = () => service.listTopics({ workspaceId, query: {} }, signal())
  const add = async (name: string) => {
    await mkdir(join(path, name))
    await writeFile(join(path, name, 'research.md'), `# ${name}\nThe ${name} question.\n`)
  }
  return { path, ctx, service, list, add, disposeSources: sourceDisposer.value }
}

describe('source refresh ownership', () => {
  it('reuses bounded discovery and refreshes it after a source notification', async () => {
    const { service, list, add } = await fixture({ watchMode: 'bounded' })
    await add('first')
    expect(titles(await list())).toEqual(['first'])
    expect(await service.provider({ workspaceId }, signal())).toMatchObject({ capabilities: { read: true, changeEvents: true } })
    const rebuild = vi.spyOn(MarkdownWorkspace.prototype, 'rebuild')
    await list()
    expect(rebuild).not.toHaveBeenCalled()
    await add('second')
    for (const watcher of watchers) watcher.changed()
    await vi.waitFor(async () => { expect(titles(await list())).toEqual(['first', 'second']) }, { timeout: 3000 })
    expect(watchMock.mock.calls.every(call => !(call[1] as { recursive: boolean }).recursive)).toBe(true)
  })

  it('can disable recursive watches while rechecking current sources on every read', async () => {
    const { service, list, add } = await fixture({ watchSources: false })
    await add('first')
    expect(titles(await list())).toEqual(['first'])
    expect(watchMock).not.toHaveBeenCalled()
    expect(await service.provider({ workspaceId }, signal())).toMatchObject({ capabilities: { read: true, changeEvents: false } })
    const stream = service.follow({ workspaceId }, signal())[Symbol.asyncIterator]()
    expect((await stream.next()).value).toEqual({ kind: 'resync-required', reason: 'automatic-source-notifications-unavailable' })
    await stream.return?.(undefined)
    await add('second')
    expect(titles(await list())).toEqual(['first', 'second'])
    expect(watchMock).not.toHaveBeenCalled()
  })

  it('stops an admitted runtime turn while its shared source scan continues for another reader', async () => {
    const { ctx, list } = await fixture()
    const entered = deferred()
    const release = deferred()
    let scanSignal: AbortSignal | undefined
    // oxlint-disable-next-line typescript/unbound-method -- Forward the actual instance through call(this).
    const original = MarkdownWorkspace.prototype.rebuild
    vi.spyOn(MarkdownWorkspace.prototype, 'rebuild').mockImplementation(async function (this: MarkdownWorkspace, options) {
      scanSignal = options?.signal
      entered.resolve()
      await release.promise
      return original.call(this, options)
    })
    const { agent, model } = await researchTurn(ctx, { workspaceId })
    await entered.promise
    const other = list()
    try {
      agent.cancel({ kind: 'user' })
      await idleBeforeRelease(agent)
      expect(model.requests).toEqual([])
      expect(scanSignal?.aborted).toBe(false)
    } finally {
      release.resolve()
      await Promise.allSettled([other, agent.whenIdle()])
    }
    expect(titles(await other)).toEqual([])
  })

  it.each(['root source', 'root selection', 'topic origin', 'topic context'] as const)(
    'stops an admitted runtime turn during its fresh %s read', async (stage) => {
      const { ctx, list, add } = await fixture()
      await add('Alpha')
      await list()
      const entered = deferred()
      const release = deferred()
      let readSignal: AbortSignal | undefined
      const hold = async (signal: AbortSignal | undefined): Promise<void> => {
        readSignal = signal
        entered.resolve()
        await new Promise<void>((resolve) => {
          const aborted = (): void => { signal?.removeEventListener('abort', aborted); resolve() }
          signal?.addEventListener('abort', aborted, { once: true })
          void release.promise.then(() => { signal?.removeEventListener('abort', aborted); resolve() })
          if (signal?.aborted) aborted()
        })
      }
      if (stage === 'root source') {
        // oxlint-disable-next-line typescript/unbound-method -- Forward the actual instance through call(this).
        const original = MarkdownWorkspace.prototype.readSource
        vi.spyOn(MarkdownWorkspace.prototype, 'readSource').mockImplementation(async function (this: MarkdownWorkspace, resourceId, options) {
          await hold(options?.signal)
          return original.call(this, resourceId, options)
        })
      } else if (stage === 'topic context') {
        // oxlint-disable-next-line typescript/unbound-method -- Forward the actual instance through call(this).
        const original = MarkdownWorkspace.prototype.readContext
        vi.spyOn(MarkdownWorkspace.prototype, 'readContext').mockImplementation(async function (this: MarkdownWorkspace, query, options) {
          await hold(options?.signal)
          return original.call(this, query, options)
        })
      } else {
        // oxlint-disable-next-line typescript/unbound-method -- Forward the actual instance through call(this).
        const original = MarkdownWorkspace.prototype.resolveOrigin
        vi.spyOn(MarkdownWorkspace.prototype, 'resolveOrigin').mockImplementation(async function (this: MarkdownWorkspace, query, options) {
          await hold(options?.signal)
          return original.call(this, query, options)
        })
      }
      const origin: ResearchOrigin = stage.startsWith('root') ? { workspaceId,
        ...(stage === 'root selection' ? { selectedText: 'The project question.' } : {}) }
        : { workspaceId, topicId: topicIdForPath('Alpha/research.md') }
      const { agent, model } = await researchTurn(ctx, origin)
      await entered.promise
      try {
        expect(readSignal).toBeInstanceOf(AbortSignal)
        agent.cancel({ kind: 'user' })
        await idleBeforeRelease(agent)
        expect(readSignal?.aborted).toBe(true)
        expect(model.requests).toEqual([])
      } finally {
        agent.cancel({ kind: 'user' })
        release.resolve()
        await agent.whenIdle()
      }
    },
  )

  it('makes concurrent readers and explicit refresh wait for the same in-flight scan', async () => {
    const { service, list, add } = await fixture()
    expect(titles(await list())).toEqual([])
    await add('Alpha')
    watchers[0]!.changed()
    const entered = deferred()
    const release = deferred()
    // oxlint-disable-next-line typescript/unbound-method -- The controlled barrier forwards the actual instance through call(this).
    const original = MarkdownWorkspace.prototype.rebuild
    let active = 0
    let peak = 0
    let calls = 0
    vi.spyOn(MarkdownWorkspace.prototype, 'rebuild').mockImplementation(async function (this: MarkdownWorkspace, options) {
      calls++
      peak = Math.max(peak, ++active)
      try {
        if (calls === 1) { entered.resolve(); await release.promise }
        return await original.call(this, options)
      } finally { active-- }
    })
    const first = list()
    await entered.promise
    let finished = false
    const second = list().then((value) => { finished = true; return value })
    const explicit = service.refresh({ workspaceId }, signal())
    try {
      await new Promise(resolve => setTimeout(resolve, 25))
      expect(finished).toBe(false)
      expect(calls).toBe(1)
    } finally { release.resolve() }
    const [a, b] = await Promise.all([first, second, explicit])
    expect(titles(a)).toEqual(['Alpha'])
    expect(titles(b)).toEqual(['Alpha'])
    expect(peak).toBe(1)
  })

  it('retains an explicit refresh joining a held watchless scan and consumes its new-identity intent once', async () => {
    watchMock.mockImplementation(() => { throw new Error('watch capacity exhausted') })
    const { service, add, list } = await fixture()
    await add('Alpha')
    await add('Beta')
    const first = await service.listTopics({ workspaceId, query: { limit: 1 } }, signal())
    if (!first.ok || first.value.value.nextCursor === null) throw new Error('The first page has no continuation')
    const cursor = first.value.value.nextCursor
    const captured = deferred()
    const release = deferred()
    const joined = deferred()
    const explicitSignal = signal()
    const combine = AbortSignal.any.bind(AbortSignal)
    vi.spyOn(AbortSignal, 'any').mockImplementation((signals) => {
      const combined = combine(signals)
      if (signals.includes(explicitSignal)) {
        const add = combined.addEventListener.bind(combined)
        vi.spyOn(combined, 'addEventListener').mockImplementation((type, listener, options) => {
          add(type, listener, options)
          if (type === 'abort') joined.resolve()
        })
      }
      return combined
    })
    // oxlint-disable-next-line typescript/unbound-method -- Forward the actual instance through call(this).
    const original = MarkdownWorkspace.prototype.rebuild
    let calls = 0
    vi.spyOn(MarkdownWorkspace.prototype, 'rebuild').mockImplementation(async function (this: MarkdownWorkspace, options) {
      const held = ++calls === 1
      const result = await original.call(this, options)
      if (held) { captured.resolve(); await release.promise }
      return result
    })
    const fallback = list()
    await captured.promise
    const explicit = service.refresh({ workspaceId }, explicitSignal)
    try {
      await joined.promise
      expect(calls).toBe(1)
    } finally {
      release.resolve()
      await Promise.all([fallback, explicit])
    }
    expect(calls).toBe(2)
    expect(await service.listTopics({ workspaceId, query: { limit: 1, cursor } }, signal()))
      .toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    const current = await service.listTopics({ workspaceId, query: { limit: 1 } }, signal())
    if (!current.ok || current.value.value.nextCursor === null) throw new Error('The refreshed page has no continuation')
    expect(titles(await service.listTopics({ workspaceId, query: { limit: 1, cursor: current.value.value.nextCursor } }, signal())))
      .toEqual(['Beta'])
  })

  it('rescans a second notification received after an in-flight scan captured its files', async () => {
    const { list, add } = await fixture()
    await list()
    await add('Alpha')
    watchers[0]!.changed()
    const captured = deferred()
    const release = deferred()
    // oxlint-disable-next-line typescript/unbound-method -- The controlled barrier forwards the actual instance through call(this).
    const original = MarkdownWorkspace.prototype.rebuild
    let calls = 0
    vi.spyOn(MarkdownWorkspace.prototype, 'rebuild').mockImplementation(async function (this: MarkdownWorkspace, options) {
      const first = ++calls === 1
      const result = await original.call(this, options)
      if (first) { captured.resolve(); await release.promise }
      return result
    })
    const first = list()
    await captured.promise
    await add('Beta')
    watchers[0]!.changed()
    const second = list()
    release.resolve()
    const results = await Promise.all([first, second])
    for (const result of results) expect(titles(result)).toEqual(['Alpha', 'Beta'])
    expect(calls).toBe(2)
  })

  it('keeps reads available and rescans when watcher setup fails', async () => {
    watchMock.mockImplementation(() => { throw new Error('watch capacity exhausted') })
    const { service, list, add } = await fixture()
    expect(titles(await list())).toEqual([])
    await add('Alpha')
    expect(titles(await list())).toEqual(['Alpha'])
    const provider = await service.provider({ workspaceId }, signal())
    expect(provider.capabilities).toMatchObject({ read: true, changeEvents: false })
    expect(provider.notice).toContain('watch capacity exhausted')
    const stop = new AbortController()
    const stream = service.follow({ workspaceId }, stop.signal)[Symbol.asyncIterator]()
    expect((await stream.next()).value).toEqual({ kind: 'resync-required', reason: 'automatic-source-notifications-unavailable' })
    const pending = stream.next()
    stop.abort()
    expect((await pending).done).toBe(true)
  })

  it.each(['setup', 'carrier'] as const)('continues topic pages after %s watcher failure while rescanning changed sources', async (failure) => {
    if (failure === 'setup') watchMock.mockImplementation(() => { throw new Error('watch capacity exhausted') })
    const { path, service, add } = await fixture()
    await add('Alpha')
    await add('Beta')
    if (failure === 'carrier') {
      await service.provider({ workspaceId }, signal())
      watchers[0]!.emit('error', new Error('watch carrier failed'))
    }
    const first = await service.listTopics({ workspaceId, query: { limit: 1 } }, signal())
    if (!first.ok || first.value.value.nextCursor === null) throw new Error('The first topic page has no continuation')
    const cursor = first.value.value.nextCursor
    expect(titles(first)).toEqual(['Alpha'])
    expect(titles(await service.listTopics({ workspaceId, query: { limit: 1, cursor } }, signal()))).toEqual(['Beta'])
    await add('Gamma')
    expect(await service.listTopics({ workspaceId, query: { limit: 1, cursor } }, signal()))
      .toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    expect(titles(await service.listTopics({ workspaceId, query: {} }, signal()))).toEqual(['Alpha', 'Beta', 'Gamma'])
    const latest = await service.listTopics({ workspaceId, query: { limit: 1 } }, signal())
    if (!latest.ok || latest.value.value.nextCursor === null) throw new Error('The fresh topic page has no continuation')
    await writeFile(join(path, 'Beta/research.md'), '# Corrected Beta\nThe changed current question.\n')
    expect(await service.listTopics({ workspaceId, query: { limit: 1, cursor: latest.value.value.nextCursor } }, signal()))
      .toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    const current = await service.getTopic({ workspaceId, topicId: topicIdForPath('Beta/research.md') }, signal())
    expect(current).toMatchObject({ ok: true, value: { value: { title: 'Corrected Beta', question: 'The changed current question.' } } })
  })

  it('withdraws failed watcher capability without closing the readable connection', async () => {
    const { service, list, add } = await fixture()
    const stop = new AbortController()
    const stream = service.follow({ workspaceId }, stop.signal)[Symbol.asyncIterator]()
    expect((await stream.next()).value).toEqual({ kind: 'resync-required', reason: 'connected-or-reconnected' })
    const pending = stream.next()
    watchers[0]!.emit('error', new Error('watch carrier failed'))
    expect((await pending).value).toEqual({ kind: 'resync-required', reason: 'automatic-source-notifications-unavailable' })
    expect(watchers[0]!.close).toHaveBeenCalledOnce()
    await add('Late')
    expect(titles(await list())).toEqual(['Late'])
    expect(await service.provider({ workspaceId }, signal())).toMatchObject({ capabilities: { changeEvents: false } })
    const ending = stream.next()
    stop.abort()
    expect((await ending).done).toBe(true)
  })

  it.each(['fulfilled', 'rejected'] as const)('waits for a held %s rebuild to settle before disposal completes', async (outcome) => {
    const { ctx, list, disposeSources } = await fixture()
    const entered = deferred()
    const release = deferred()
    // oxlint-disable-next-line typescript/unbound-method -- The controlled barrier forwards the actual instance through call(this).
    const original = MarkdownWorkspace.prototype.rebuild
    let rebuilt = false
    const rebuild = vi.spyOn(MarkdownWorkspace.prototype, 'rebuild').mockImplementation(async function (this: MarkdownWorkspace, options) {
      const result = await original.call(this, options)
      entered.resolve()
      await release.promise
      try {
        if (outcome === 'rejected') throw new Error('Held source rebuild failed')
        return result
      } finally { rebuilt = true }
    })
    const waiting = list()
    await entered.promise
    watchers[0]!.changed()
    let disposed = false
    const disposingSources = Promise.resolve(disposeSources()).then(() => {
      disposed = true
      return rebuilt
    })
    const disposing = Promise.resolve(ctx.fiber.dispose()).then(() => rebuilt)
    try {
      await expect(waiting).rejects.toMatchObject({ name: 'AbortError' })
      await expect(list()).rejects.toMatchObject({ name: 'AbortError' })
      expect(watchers[0]!.close).toHaveBeenCalledOnce()
      expect(disposed).toBe(false)
      expect(rebuild).toHaveBeenCalledOnce()
    } finally {
      release.resolve()
      const settled = await Promise.all([disposingSources, disposing])
      expect(settled).toEqual([true, true])
    }
    watchers[0]!.changed()
    await expect(list()).rejects.toMatchObject({ name: 'AbortError' })
    expect(rebuild).toHaveBeenCalledOnce()
  })

  it('aborts before root lookup, detaches a pending reader and closes active streams on disposal', async () => {
    const { path, ctx, service, list } = await fixture()
    const early = service.follow({ workspaceId: 'missing' as WorkspaceId }, AbortSignal.abort())[Symbol.asyncIterator]()
    await expect(early.next()).rejects.toMatchObject({ name: 'AbortError' })
    expect(watchMock).not.toHaveBeenCalled()
    const entered = deferred()
    const release = deferred()
    // oxlint-disable-next-line typescript/unbound-method -- The controlled barrier forwards the actual instance through call(this).
    const original = MarkdownWorkspace.prototype.rebuild
    vi.spyOn(MarkdownWorkspace.prototype, 'rebuild').mockImplementation(async function (this: MarkdownWorkspace, options) {
      entered.resolve()
      await release.promise
      return original.call(this, options)
    })
    const stop = new AbortController()
    const waiting = service.follow({ workspaceId }, stop.signal)[Symbol.asyncIterator]().next()
    await entered.promise
    stop.abort()
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' })
    const ordinary = list()
    release.resolve()
    expect(titles(await ordinary)).toEqual([])
    const live = service.follow({ workspaceId }, signal())[Symbol.asyncIterator]()
    await live.next()
    const notifications = (service as unknown as { notifications: EventEmitter }).notifications
    expect(notifications.listenerCount(path)).toBe(1)
    await ctx.fiber.dispose()
    expect(notifications.listenerCount(path)).toBe(0)
    expect((await live.next()).done).toBe(true)
    expect(watchers[0]!.close).toHaveBeenCalledOnce()
  })
})
