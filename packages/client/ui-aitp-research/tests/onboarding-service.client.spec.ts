/** Enrollment and topic mutations keep provider ownership and resource invalidation. */
import { Context } from '@deepseek-ai/cordis'
import { expect, it, vi } from 'vitest'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { ResourceRegistry } from '@deepseek-ai/dsh-client-resources/src/client/resources.ts'
import type { CreateTopicRequest, ResearchEvent, ResearchWorkspaceAdapter, ResourceId, Result, TopicId } from '../src/client/workspace-contract.ts'
import { ResearchWorkspaceRegistry } from '../src/client/workspace-service.ts'
import { registerWorkspaceResources, workspaceProviderAddress, workspaceSetupAddress } from '../src/client/workspace-resources.ts'

const WS = 'new workspace' as WorkspaceId
const failure: Result<never> = { ok: false, error: { code: 'unavailable', message: 'Research is unavailable.', retryable: true } }
const request: CreateTopicRequest = { operationId: 'same-attempt', title: 'A topic', question: 'What changes?' }

function harness() {
  const ctx = new Context()
  const resources = new ResourceRegistry(ctx)
  ctx.reflect.provide('resources', resources)
  const registry = new ResearchWorkspaceRegistry(ctx)
  registerWorkspaceResources(ctx, registry)
  const adapter: ResearchWorkspaceAdapter = {
    workspaceId: WS,
    provider: { id: 'test', origin: 'runtime', capabilities: { automaticResearch: true, read: false, readActivity: false, readContext: false, previewChanges: false, applyChanges: false, changeEvents: false, commands: [] } },
    getProject: vi.fn(async () => failure), listTopics: async () => failure, getTopic: async () => failure,
    getResource: async () => failure, getActivity: async () => failure, readContext: async () => failure,
    previewChange: async () => failure, applyChange: async () => failure, subscribeChanges: () => () => {},
  }
  return { resources, registry, adapter }
}

async function flush(): Promise<void> { for (let round = 0; round < 30; round += 1) await Promise.resolve() }

it('observes actual automatic Research availability before enrollment and withdraws it with its provider', async () => {
  const { registry, adapter, resources } = harness()
  let provider = adapter.provider
  const source = resources.source(workspaceProviderAddress(WS))
  const unsubscribe = source.subscribe(() => {})
  await flush()
  expect(source.getSnapshot()).toMatchObject({ status: 'failed', value: undefined })
  const release = registry.register(() => ({ ...adapter, get provider() { return provider } }))
  await flush()
  expect(source.getSnapshot()).toMatchObject({ status: 'live', value: { capabilities: { automaticResearch: true, read: false } } })
  provider = { ...provider, capabilities: { ...provider.capabilities, automaticResearch: false } }
  registry.retry(WS)
  await flush()
  expect(source.getSnapshot()).toMatchObject({ status: 'live', value: { capabilities: { automaticResearch: false } } })
  expect(vi.mocked(adapter).getProject.mock.calls).toHaveLength(0)
  release()
  await flush()
  expect(source.getSnapshot()).toMatchObject({ status: 'failed', failure: { details: { code: 'not-connected' } } })
  unsubscribe()
  registry.dispose()
})

it('reports a missing connection and absent optional mutations without inventing a capability', async () => {
  const { registry, adapter } = harness()
  expect(await registry.initialize(WS, { writable: true })).toMatchObject({ ok: false, error: { code: 'not-connected' } })
  expect(await registry.createTopic(WS, request)).toMatchObject({ ok: false, error: { code: 'not-connected' } })
  const release = registry.register(() => adapter)
  expect(await registry.initialize(WS, { writable: true })).toMatchObject({ ok: false, error: { code: 'unsupported' } })
  expect(await registry.createTopic(WS, request)).toMatchObject({ ok: false, error: { code: 'unsupported' } })
  release()
  registry.dispose()
})

it('delegates explicit write choices and stable requests, invalidating only acknowledged mutations', async () => {
  const { registry, adapter } = harness()
  const setup = { configured: true, writable: false, canInitialize: true }
  const initialize = vi.fn<NonNullable<ResearchWorkspaceAdapter['initialize']>>(async () => ({ ok: true, value: setup }))
  const createTopic = vi.fn<NonNullable<ResearchWorkspaceAdapter['createTopic']>>(async () => failure)
  const release = registry.register(() => ({ ...adapter, initialize, createTopic }))
  const changes = vi.fn<(event: ResearchEvent) => void>()
  const unsubscribe = registry.subscribe(WS, changes)
  expect(await registry.initialize(WS, { writable: false })).toEqual({ ok: true, value: setup })
  expect(initialize).toHaveBeenCalledExactlyOnceWith({ writable: false })
  expect(changes).toHaveBeenCalledOnce()
  expect(await registry.createTopic(WS, request)).toEqual(failure)
  expect(changes).toHaveBeenCalledOnce()
  const receipt = { operationId: request.operationId, topicId: 'created' as TopicId, resourceId: 'account' as ResourceId }
  createTopic.mockResolvedValueOnce({ ok: true, value: receipt })
  expect(await registry.createTopic(WS, request)).toEqual({ ok: true, value: receipt })
  expect(createTopic).toHaveBeenNthCalledWith(1, request)
  expect(createTopic).toHaveBeenNthCalledWith(2, request)
  expect(changes).toHaveBeenCalledTimes(2)
  unsubscribe()
  release()
  registry.dispose()
})

it('reads setup before content permission and refreshes it after explicit initialization', async () => {
  const { registry, adapter, resources } = harness()
  let setup = { configured: false, writable: false, canInitialize: true }
  const getSetup = vi.fn<NonNullable<ResearchWorkspaceAdapter['getSetup']>>(async () => ({ ok: true, value: setup }))
  const release = registry.register(() => ({ ...adapter, getSetup, initialize: async (request) => {
    setup = { configured: true, writable: request.writable, canInitialize: true }
    return { ok: true, value: setup }
  } }))
  const source = resources.source(workspaceSetupAddress(WS))
  const unsubscribe = source.subscribe(() => {})
  await flush()
  expect(source.getSnapshot()).toMatchObject({ status: 'live', value: { configured: false, writable: false } })
  expect(vi.mocked(adapter).getProject.mock.calls).toHaveLength(0)
  expect(await registry.initialize(WS, { writable: true })).toMatchObject({ ok: true })
  await flush()
  expect(source.getSnapshot()).toMatchObject({ status: 'live', value: { configured: true, writable: true } })
  expect(getSetup).toHaveBeenCalledTimes(2)
  unsubscribe()
  release()
  registry.dispose()
})

it('reports unsupported setup for a legacy provider and wakes a pending setup reader on connection', async () => {
  const { registry, adapter, resources } = harness()
  const source = resources.source(workspaceSetupAddress(WS))
  const unsubscribe = source.subscribe(() => {})
  await flush()
  expect(source.getSnapshot()).toMatchObject({ status: 'failed', failure: { details: { code: 'not-connected' } } })
  const release = registry.register(() => adapter)
  await flush()
  expect(source.getSnapshot()).toMatchObject({ status: 'failed', failure: { details: { code: 'unsupported' } } })
  unsubscribe()
  release()
  registry.dispose()
})
