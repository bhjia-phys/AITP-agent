import { RemoteStream, RemoteStreamCarrierError } from '@deepseek-ai/dsh-api-gateway/client'
import type { ConnectionGeneration } from '@deepseek-ai/dsh-client-connection/client'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import type { RemoteStreamHandle } from '@deepseek-ai/dsh-typert-protocol'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { ResearchEvent, ResearchProvider, ResourceId, Revision, TopicId } from '@deepseek-ai/dsh-research-memory/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RuntimeWorkspaceAdapter, type ResearchRemote, type ResearchTransport } from '../src/client/adapter.ts'
import { en } from '../src/client/locales.ts'

const WS = 'configured-workspace' as WorkspaceId
const TOPIC = 'topic:source' as TopicId
const adapters: RuntimeWorkspaceAdapter[] = []
afterEach(async () => { await Promise.all(adapters.splice(0).map(adapter => adapter.dispose())) })

const readProvider: ResearchProvider = {
  id: 'runtime-provider', origin: 'runtime', capabilities: {
    automaticResearch: false, read: true, readContext: true, readActivity: false, previewChanges: false,
    applyChanges: false, changeEvents: true, commands: [],
  },
}

class Feed implements RemoteStreamHandle<ResearchEvent, never> {
  private readonly events: ResearchEvent[] = []
  private wake: (() => void) | undefined
  private error: Error | undefined
  private readonly release = new AbortController()
  closed = false
  constructor(private readonly signal: AbortSignal) {}
  push(event: ResearchEvent): void { this.events.push(event); this.wake?.() }
  fail(error: Error): void { this.error = error; this.wake?.() }
  send(): void { throw new Error('No uplink is supported by this feed.') }
  end(): void { this.dispose() }
  dispose(): void { this.release.abort(); this.wake?.() }
  async *[Symbol.asyncIterator](): AsyncIterator<ResearchEvent> {
    const abort = (): void => { this.wake?.() }
    this.signal.addEventListener('abort', abort)
    try {
      while (!this.signal.aborted && !this.release.signal.aborted) {
        if (this.error !== undefined) throw this.error
        const item = this.events.shift()
        if (item !== undefined) yield item
        else await new Promise<void>((resolve) => { this.wake = resolve })
      }
    } finally {
      this.closed = true
      this.signal.removeEventListener('abort', abort)
    }
  }
}

function harness() {
  const feeds: Feed[] = []
  const listeners = new Set<() => void>()
  let generation: ConnectionGeneration | undefined = { id: 1, host: { home: '/test-host' } }
  const project = { origin: 'runtime' as const, revision: 'observation-1' as Revision, observedAt: '2026-01-01T00:00:00Z',
    value: { id: 'p', title: 'Current source project', directions: [], seeds: [] } }
  const unsupported = { ok: true as const, value: { ok: false as const, error: {
    code: 'unsupported' as const, message: 'This source does not provide that operation.', retryable: false,
  } } }
  const remote = {
    setResearchMode: vi.fn<ResearchRemote['setResearchMode']>().mockResolvedValue({ ok: true, value: { enabled: false } }),
    promptWorkflow: vi.fn<ResearchRemote['promptWorkflow']>().mockResolvedValue({ ok: true, value: { accepted: true } }),
    getSetup: vi.fn<ResearchRemote['getSetup']>().mockResolvedValue({ ok: true, value: { ok: true, value: { configured: false, writable: false, canInitialize: true } } }),
    initialize: vi.fn<ResearchRemote['initialize']>().mockResolvedValue({ ok: true, value: { ok: true, value: { configured: true, writable: true, canInitialize: true } } }),
    prepareDiscussion: vi.fn<ResearchRemote['prepareDiscussion']>().mockResolvedValue(unsupported),
    prepareStudy: vi.fn<ResearchRemote['prepareStudy']>().mockResolvedValue(unsupported),
    createTopic: vi.fn<ResearchRemote['createTopic']>().mockResolvedValue(unsupported),
    provider: vi.fn<ResearchRemote['provider']>().mockResolvedValue({ ok: true, value: readProvider }),
    getProject: vi.fn<ResearchRemote['getProject']>().mockResolvedValue({ ok: true, value: { ok: true, value: project } }),
    getChange: vi.fn<ResearchRemote['getChange']>().mockResolvedValue(unsupported),
    listDiscussions: vi.fn<ResearchRemote['listDiscussions']>().mockResolvedValue(unsupported),
    listTopics: vi.fn<ResearchRemote['listTopics']>().mockResolvedValue(unsupported),
    getTopic: vi.fn<ResearchRemote['getTopic']>().mockResolvedValue(unsupported),
    getResource: vi.fn<ResearchRemote['getResource']>().mockResolvedValue(unsupported),
    readContext: vi.fn<ResearchRemote['readContext']>().mockResolvedValue(unsupported),
    getActivity: vi.fn<ResearchRemote['getActivity']>().mockResolvedValue(unsupported),
    previewChange: vi.fn<ResearchRemote['previewChange']>().mockResolvedValue(unsupported),
    applyChange: vi.fn<ResearchRemote['applyChange']>().mockResolvedValue(unsupported),
    ask: vi.fn<ResearchRemote['ask']>().mockResolvedValue(unsupported),
    getSessionMemory: vi.fn<ResearchRemote['getSessionMemory']>().mockResolvedValue(unsupported),
    refresh: vi.fn<ResearchRemote['refresh']>().mockResolvedValue({ ok: true, value: undefined }),
    follow: vi.fn<ResearchRemote['follow']>((_request: Parameters<ResearchRemote['follow']>[0], signal?: AbortSignal) => {
      if (signal === undefined) throw new Error('A follow generation needs cancellation.')
      const feed = new Feed(signal)
      feeds.push(feed)
      return feed
    }),
  } satisfies ResearchRemote
  const transport: ResearchTransport = {
    researchMemory: remote,
    $stream: options => new RemoteStream({ generation: {
      getSnapshot: () => generation,
      subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    } }, options),
  }
  const report = vi.fn()
  const adapter = new RuntimeWorkspaceAdapter(WS, transport, key => en[key], report)
  adapters.push(adapter)
  return { adapter, remote, feeds, report, transport, project,
    disconnect: () => { generation = undefined },
    reconnect: () => { generation = { id: 2, host: { home: '/test-host' } }; for (const listener of listeners) listener() },
  }
}

describe('research backend browser adapter', () => {
  it('reads setup before provider admission, forwards explicit enrollment and restarts an initially unavailable source feed', async () => {
    const h = harness()
    expect(await h.adapter.getSetup()).toEqual({ ok: true, value: { configured: false, writable: false, canInitialize: true } })
    expect(h.remote.getSetup).toHaveBeenCalledWith({ workspaceId: WS })
    expect(h.remote.provider).not.toHaveBeenCalled()
    h.remote.provider.mockResolvedValueOnce({ ok: false, error: new RemoteError('research/root-not-configured', 'Not enrolled.', {}) })
    const events: ResearchEvent[] = []
    h.adapter.subscribeChanges({}, event => events.push(event))
    await vi.waitFor(() => { expect(events.at(-1)).toMatchObject({ kind: 'connection', state: 'disconnected' }) })
    expect(await h.adapter.initialize({ writable: true })).toMatchObject({ ok: true, value: { configured: true, writable: true } })
    expect(h.remote.initialize).toHaveBeenCalledWith({ workspaceId: WS, writable: true })
    await vi.waitFor(() => { expect(h.feeds).toHaveLength(1) })
    h.feeds[0]!.push({ kind: 'resync-required', reason: 'connected-or-reconnected' })
    await vi.waitFor(() => { expect(events.at(-2)).toMatchObject({ kind: 'connection', state: 'connected' }) })
  })

  it('forwards stable topic creation identities and preserves a lost acknowledgment without an automatic retry', async () => {
    const h = harness()
    const request = { operationId: 'new-topic-once', title: 'Control', question: 'Does A hold?', parentTopicId: TOPIC }
    const receipt = { operationId: request.operationId, topicId: 'topic:new-source' as TopicId, resourceId: 'resource:new-source' as ResourceId }
    h.remote.createTopic.mockResolvedValueOnce({ ok: true, value: { ok: true, value: receipt } })
    expect(await h.adapter.createTopic(request)).toEqual({ ok: true, value: receipt })
    expect(h.remote.createTopic).toHaveBeenCalledWith({ ...request, workspaceId: WS })
    h.remote.createTopic.mockResolvedValueOnce({ ok: false, error: new RemoteError('gateway/internal', 'Acknowledgment lost.', {}) })
    expect(await h.adapter.createTopic(request)).toMatchObject({ ok: false, error: { code: 'outcome-unknown', operationId: request.operationId } })
    expect(h.remote.createTopic).toHaveBeenCalledTimes(2)
  })

  it('publishes host capabilities and resync notifications, and refreshes them on real stream reconnection', async () => {
    const h = harness()
    expect(h.adapter.provider.capabilities.read).toBe(false)
    const events: ResearchEvent[] = []
    const release = h.adapter.subscribeChanges({}, event => events.push(event))
    await vi.waitFor(() => { expect(h.feeds).toHaveLength(1) })
    expect(events).toEqual([{ kind: 'connection', state: 'disconnected' }])
    h.feeds[0]!.push({ kind: 'resync-required', reason: 'connected-or-reconnected' })
    await vi.waitFor(() => { expect(events.at(-2)).toEqual({ kind: 'connection', state: 'connected' }) })
    expect(h.adapter.provider).toBe(readProvider)
    h.disconnect()
    h.feeds[0]!.fail(new RemoteStreamCarrierError('The test carrier disconnected.'))
    await vi.waitFor(() => { expect(events.at(-1)).toMatchObject({ kind: 'connection', state: 'disconnected' }) })
    const writable = { ...readProvider, capabilities: { ...readProvider.capabilities, applyChanges: true } }
    h.remote.provider.mockResolvedValue({ ok: true, value: writable })
    h.reconnect()
    await vi.waitFor(() => { expect(h.feeds).toHaveLength(2) })
    h.feeds[1]!.push({ kind: 'resync-required', reason: 'connected-or-reconnected' })
    await vi.waitFor(() => { expect(h.adapter.provider.capabilities.applyChanges).toBe(true) })
    expect(h.remote.provider).toHaveBeenCalledTimes(2)
    expect(h.remote.refresh).not.toHaveBeenCalled()
    release()
    const count = events.length
    h.feeds[1]!.push({ kind: 'resync-required', reason: 'later-source-change' })
    await h.adapter.dispose()
    expect(events).toHaveLength(count)
    expect(h.feeds.every(feed => feed.closed)).toBe(true)
  })

  it('rejects a generation without its fresh-read baseline and contains subscriber exceptions', async () => {
    const h = harness()
    const good = vi.fn<(event: ResearchEvent) => void>()
    h.adapter.subscribeChanges({ afterEventId: 'old-event' }, () => { throw new Error('A consumer failed.') })
    h.adapter.subscribeChanges({}, good)
    await vi.waitFor(() => { expect(h.feeds).toHaveLength(1) })
    h.feeds[0]!.push({ kind: 'connection', state: 'connected' })
    await vi.waitFor(() => { expect(good).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'disconnected' })) })
    expect(h.report).toHaveBeenCalled()
    expect(good.mock.calls.some(([event]) => event.kind === 'connection' && event.state === 'connected')).toBe(false)
  })

  it('forwards workspace identity and abort signals while preserving domain outcomes', async () => {
    const h = harness()
    const controller = new AbortController()
    expect(await h.adapter.getProject({ signal: controller.signal })).toEqual({ ok: true, value: h.project })
    expect(h.remote.getProject).toHaveBeenCalledWith({ workspaceId: WS }, expect.any(AbortSignal))
    expect(await h.adapter.getActivity({ topicId: TOPIC })).toMatchObject({ ok: false, error: { code: 'unsupported' } })
    const cancelled = new AbortController()
    cancelled.abort()
    expect(await h.adapter.getProject({ signal: cancelled.signal })).toMatchObject({ ok: false, error: { code: 'cancelled' } })
    expect(h.remote.getProject).toHaveBeenCalledTimes(1)
    h.remote.getTopic.mockImplementation((_request: Parameters<ResearchRemote['getTopic']>[0], signal?: AbortSignal) => new Promise((resolve) => {
      signal?.addEventListener('abort', () => { resolve({ ok: false, error: new RemoteError('gateway/cancelled', 'cancelled', {}) }) })
    }))
    const reading = h.adapter.getTopic(TOPIC, { signal: controller.signal })
    controller.abort()
    expect(await reading).toMatchObject({ ok: false, error: { code: 'cancelled' } })
    await h.adapter.ask({ topicId: TOPIC, question: 'What changed?', selectedText: 'A precise condition.' })
    expect(h.remote.ask).toHaveBeenCalledWith({ workspaceId: WS, topicId: TOPIC,
      question: 'What changed?', selectedText: 'A precise condition.' }, expect.any(AbortSignal))
    const lifetimeReading = h.adapter.getTopic(TOPIC)
    await h.adapter.dispose()
    expect(await lifetimeReading).toMatchObject({ ok: false, error: { code: 'cancelled' } })
    expect(await h.adapter.getProject()).toMatchObject({ ok: false, error: { code: 'cancelled' } })
  })

  it('retains unknown save outcomes and never retries a mutation automatically', async () => {
    const h = harness()
    const request = { previewId: 'preview', operationId: 'same-operation' }
    h.remote.applyChange.mockResolvedValue({ ok: false, error: new RemoteError('gateway/internal', 'Response lost.', {}) })
    expect(await h.adapter.applyChange(request)).toEqual({ ok: false, error: {
      code: 'outcome-unknown', message: en.unknownWrite, operationId: 'same-operation',
    } })
    expect(h.remote.applyChange).toHaveBeenCalledTimes(1)
    h.remote.applyChange.mockResolvedValue({ ok: false, error: new RemoteError('gateway/bad-request', 'Rejected before dispatch.', {}) })
    expect(await h.adapter.applyChange(request)).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    h.remote.getProject.mockRejectedValue(new Error('An assembly bug.'))
    await expect(h.adapter.getProject()).rejects.toThrow('An assembly bug.')
  })

})
