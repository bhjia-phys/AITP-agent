/** Framework resource integration: cancellation, stale observations and provider lifetimes. */
import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { Project, ReadEnvelope, ResearchProvider, Result, TopicId } from '@deepseek-ai/dsh-client-ui-aitp-research/client'
import { ResourceRegistry } from '@deepseek-ai/dsh-client-resources/src/client/resources.ts'
import { ResearchWorkspaceRegistry } from '@deepseek-ai/dsh-client-ui-aitp-research/src/client/workspace-service.ts'
import {
  registerWorkspaceResources, workspaceActivityAddress, workspaceProjectAddress,
  workspaceResourceAddress, workspaceTopicAddress, workspaceTopicsAddress,
} from '@deepseek-ai/dsh-client-ui-aitp-research/src/client/workspace-resources.ts'
import { FixtureWorkspaceAdapter } from '../src/client/workspace-adapter.ts'

const WS = 'fixture workspace/one' as WorkspaceId
const CHAOS = 'quantum-chaos' as TopicId

function harness() {
  const ctx = new Context()
  const resources = new ResourceRegistry(ctx)
  ctx.reflect.provide('resources', resources)
  const registry = new ResearchWorkspaceRegistry(ctx)
  registerWorkspaceResources(ctx, registry)
  const adapter = new FixtureWorkspaceAdapter(WS)
  return { registry, resources, adapter }
}

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

async function flush(): Promise<void> { for (let i = 0; i < 20; i += 1) await Promise.resolve() }

describe('research workspace resource bridge', () => {
  it('wakes existing readers on late provider registration and retains observed content after disconnect', async () => {
    const { registry, resources, adapter } = harness()
    const source = resources.source(workspaceProjectAddress(WS))
    const release = source.subscribe(() => {})
    await flush()
    expect(source.getSnapshot()).toMatchObject({ status: 'failed', value: undefined, failure: { code: 'aitp/workspace', details: { code: 'not-connected' } } })
    const dispose = registry.register(() => adapter)
    await flush()
    const observed = source.getSnapshot().value
    expect(source.getSnapshot()).toMatchObject({ status: 'live', value: { origin: 'fixture', provider: { capabilities: { read: true } }, value: { title: 'Research workspace' } } })
    adapter.setConnected(false)
    await flush()
    expect(source.getSnapshot()).toMatchObject({ status: 'failed', failure: { details: { code: 'not-connected' } } })
    expect(source.getSnapshot().value).toBe(observed)
    adapter.setConnected(true)
    await flush()
    expect(source.getSnapshot().status).toBe('live')
    const observedAgain = source.getSnapshot().value
    dispose()
    await flush()
    expect(source.getSnapshot().status).toBe('failed')
    expect(source.getSnapshot().value).toBe(observedAgain)
    release()
    registry.dispose()
  })

  it('rereads topic cards, full documents and activity only after an acknowledged operation', async () => {
    const { registry, resources, adapter } = harness()
    const dispose = registry.register(() => adapter)
    const topic = value(await adapter.getTopic(CHAOS))
    const sources = [
      resources.source(workspaceTopicAddress(WS, CHAOS)),
      resources.source(workspaceTopicsAddress(WS)),
      resources.source(workspaceResourceAddress(WS, topic.value.accountResourceId!)),
      resources.source(workspaceActivityAddress(WS, CHAOS)),
    ]
    const releases = sources.map(source => source.subscribe(() => {}))
    await flush()
    const preview = value(await registry.previewChange(WS, { topicId: CHAOS, expectedRevision: topic.revision, command: { kind: 'update-scope', scope: 'Revised scope' } }))
    expect(sources[0]!.getSnapshot().value).toMatchObject({ value: { scope: topic.value.scope } })
    value(await registry.applyChange(WS, { previewId: preview.value.previewId, operationId: 'scope-update' }))
    await flush()
    expect(sources[0]!.getSnapshot().value).toMatchObject({ value: { scope: 'Revised scope' } })
    expect(sources[1]!.getSnapshot().value).toHaveProperty('value.items.0.revision', 'fixture-revision-2')
    expect(sources[1]!.getSnapshot().value).toHaveProperty('value.items.0.value.id', CHAOS)
    expect(sources[2]!.getSnapshot().value).toMatchObject({ value: { content: { text: expect.stringContaining('Revised scope') as string } } })
    expect(sources[3]!.getSnapshot().value).toHaveProperty('value.items.0.kind', 'change')
    for (const release of releases) release()
    dispose()
    registry.dispose()
  })

  it('aborts superseded reads and does not publish a late stale response', async () => {
    const { registry, resources, adapter } = harness()
    const original = value(await adapter.getProject())
    const oldRead = Promise.withResolvers<Result<ReadEnvelope<Project>>>()
    const getProject = vi.spyOn(adapter, 'getProject')
      .mockImplementationOnce(() => oldRead.promise)
    const dispose = registry.register(() => adapter)
    const source = resources.source(workspaceProjectAddress(WS)), release = source.subscribe(() => {})
    await flush()
    expect(source.getSnapshot().status).toBe('loading')
    const firstSignal = getProject.mock.calls[0]![0]!.signal!
    registry.retry(WS)
    await flush()
    expect(firstSignal.aborted).toBe(true)
    expect(source.getSnapshot()).toMatchObject({ status: 'live', value: { value: { title: 'Research workspace' } } })
    const current = source.getSnapshot().value
    oldRead.resolve({ ok: true, value: { ...original, value: { ...original.value, title: 'Obsolete response' } } })
    await flush()
    expect(source.getSnapshot().value).toBe(current)
    release()
    dispose()
    registry.dispose()
  })

  it('releases an uncooperative in-flight read when its final holder leaves', async () => {
    const { registry, resources, adapter } = harness()
    const pending = Promise.withResolvers<Result<ReadEnvelope<Project>>>()
    const getProject = vi.spyOn(adapter, 'getProject').mockImplementation(() => pending.promise)
    const dispose = registry.register(() => adapter)
    const source = resources.source(workspaceProjectAddress(WS)), release = source.subscribe(() => {})
    await flush()
    const signal = getProject.mock.calls[0]![0]!.signal!
    release()
    await flush()
    expect(signal.aborted).toBe(true)
    expect(source.getSnapshot()).toMatchObject({ status: 'loading', value: undefined })
    dispose()
    registry.dispose()
  })

  it('validates address boundaries and preserves explicit missing-source failures', async () => {
    const { registry, resources, adapter } = harness()
    const dispose = registry.register(() => adapter)
    const addresses = [
      workspaceTopicAddress(WS, 'missing' as TopicId),
      'dsh-resource://aitp-workspace-topics/workspace/w?limit=-1',
      'dsh-resource://aitp-workspace-topic/not-a-workspace',
      'dsh-resource://aitp-workspace-topic/workspace/%ZZ/topic/topic',
      workspaceTopicsAddress(WS, { parentId: null, limit: 1 }),
    ]
    const sources = addresses.map(address => resources.source(address))
    const releases = sources.map(source => source.subscribe(() => {}))
    await flush()
    expect(sources[0]!.getSnapshot()).toMatchObject({ status: 'failed', failure: { details: { code: 'not-found' } } })
    for (const index of [1, 2, 3]) expect(sources[index]!.getSnapshot()).toMatchObject({ status: 'failed', failure: { details: { code: 'invalid-request' } } })
    expect(sources[4]!.getSnapshot().status).toBe('live')
    expect(sources[4]!.getSnapshot().value).toHaveProperty('value.items.0.value.parentId', null)
    for (const release of releases) release()
    dispose()
    registry.dispose()
  })


  it('does not let a replaced provider publish its in-flight observation', async () => {
    const { registry, resources, adapter } = harness()
    const old = value(await adapter.getProject())
    const pending = Promise.withResolvers<Result<ReadEnvelope<Project>>>()
    vi.spyOn(adapter, 'getProject').mockReturnValue(pending.promise)
    const dispose = registry.register(() => adapter)
    const source = resources.source(workspaceProjectAddress(WS)), release = source.subscribe(() => {})
    await flush()
    dispose()
    const replacement = new FixtureWorkspaceAdapter(WS)
    const disposeReplacement = registry.register(() => replacement)
    await flush()
    const current = source.getSnapshot().value
    expect(source.getSnapshot().status).toBe('live')
    pending.resolve({ ok: true, value: { ...old, value: { ...old.value, title: 'Removed provider' } } })
    await flush()
    expect(source.getSnapshot().value).toBe(current)
    release()
    disposeReplacement()
    registry.dispose()
  })

  it('reports unsupported reads and read-only changes without invoking unavailable capabilities', async () => {
    const { registry, resources, adapter: baseline } = harness()
    class LimitedFixture extends FixtureWorkspaceAdapter {
      override readonly provider: ResearchProvider = {
        ...baseline.provider,
        capabilities: { ...baseline.provider.capabilities, read: false, previewChanges: false, applyChanges: false },
      }
    }
    const adapter = new LimitedFixture(WS), dispose = registry.register(() => adapter)
    const getProject = vi.spyOn(adapter, 'getProject'), preview = vi.spyOn(adapter, 'previewChange'), apply = vi.spyOn(adapter, 'applyChange')
    const source = resources.source(workspaceProjectAddress(WS)), release = source.subscribe(() => {})
    await flush()
    expect(source.getSnapshot()).toMatchObject({ status: 'failed', failure: { details: { code: 'unsupported' } } })
    expect(getProject).not.toHaveBeenCalled()
    const topic = value(await baseline.getTopic(CHAOS))
    expect(await registry.previewChange(WS, { topicId: CHAOS, expectedRevision: topic.revision, command: { kind: 'update-scope', scope: 'Unavailable' } })).toMatchObject({ ok: false, error: { code: 'read-only' } })
    expect(await registry.applyChange(WS, { previewId: 'preview', operationId: 'operation' })).toMatchObject({ ok: false, error: { code: 'read-only' } })
    expect(preview).not.toHaveBeenCalled()
    expect(apply).not.toHaveBeenCalled()
    release()
    dispose()
    registry.dispose()
  })

  it('keeps a single provider owner and removes adapter event subscriptions on unload', async () => {
    const { registry, adapter } = harness()
    const unsubscribe = vi.fn(), subscribe = vi.spyOn(adapter, 'subscribeChanges').mockReturnValue(unsubscribe)
    const dispose = registry.register(() => adapter)
    expect(registry.resolve(WS).ok).toBe(true)
    expect(registry.resolve(WS).ok).toBe(true)
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(() => registry.register(() => adapter)).toThrow('already registered')
    dispose()
    dispose()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(registry.resolve(WS)).toMatchObject({ ok: false, error: { code: 'not-connected' } })
    registry.dispose()
  })
})
