// @vitest-environment jsdom
import { expect, vi } from 'vitest'
import { ClientRoster, createClientTest, webApp } from '@deepseek-ai/dsh-client-test-runtime/src/assembly/index.ts'
import { ok, openStream } from '@deepseek-ai/dsh-remote-mock'
import type { ResearchProvider, ReadEnvelope, Project, Revision, SessionMemoryView } from '@deepseek-ai/dsh-research-memory/types'
import type {} from '@deepseek-ai/dsh-research-memory/remote'
import { SESSION_FORMAT_VERSION, type SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionFollowFrame } from '@deepseek-ai/dsh-api-session-controller/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type {} from '../src/client/index.ts'

const BACKEND = '@deepseek-ai/dsh-client-ui-aitp-backend'
const RESEARCH = '@deepseek-ai/dsh-client-ui-aitp-research'
const WS = 'source-workspace' as WorkspaceId
const it = createClientTest({ roster: ClientRoster.of([
  ...webApp.rows,
  { name: RESEARCH, immediately: false, inject: [
    '@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-client-ui-sidebar', '@deepseek-ai/dsh-client-ui-sidebar-right',
    '@deepseek-ai/dsh-client-ui-workspace', '@deepseek-ai/dsh-client-resources', '@deepseek-ai/dsh-client-locale',
  ] },
  { name: BACKEND, immediately: false, inject: [
    '@deepseek-ai/dsh-api-gateway', RESEARCH, '@deepseek-ai/dsh-client-locale', '@deepseek-ai/dsh-client-resources',
    '@deepseek-ai/dsh-api-session-controller', '@deepseek-ai/dsh-client-connection',
  ] },
]) })

const provider: ResearchProvider = { id: 'configured-source', origin: 'runtime', capabilities: {
  automaticResearch: false, read: true, readContext: true, readActivity: false,
  previewChanges: false, applyChanges: false, changeEvents: true, commands: [],
} }
const initial: ReadEnvelope<Project> = { origin: 'runtime', observedAt: '2026-01-01T00:00:00Z', revision: 'observation-1' as Revision,
  value: { id: 'source', title: 'From the configured source', directions: [], seeds: [] } }

it('mounts its generated namespace beside the Web roster, rereads sources and withdraws both on unload', async ({ mock, start }) => {
  // Install endpoint responses only after boot: the generic client test carrier otherwise
  // manufactures namespace proxies from mock rules and hides a missing production mount.
  const client = await start()
  expect(client.ctx.get('remote.researchMemory')).toBeDefined()
  mock.load({ unary: {
    'researchMemory/provider': ok(provider),
    'researchMemory/getProject': ok({ ok: true, value: initial }),
  }, stream: {
    'researchMemory/follow': openStream([{ kind: 'resync-required', reason: 'connected-or-reconnected' }]),
  } })
  const source = client.ctx.resources.source('dsh-resource://aitp-workspace-project/workspace/source-workspace')
  const release = source.subscribe(() => {})
  try {
    await vi.waitFor(() => { expect(source.getSnapshot().status).toBe('live') })
    expect(source.getSnapshot().value).toEqual({ ...initial, provider })
    // The generated method serializes named Host arguments, unlike the test tier's positional proxy.
    expect(mock.log.requests('researchMemory/getProject')).toEqual([{ request: { workspaceId: WS } }])
    expect(mock.log.streams('researchMemory/follow')).toHaveLength(1)
    expect(client.ctx.locale.bind('aitp.backend')('disconnected')).toBe('Research data is not connected.')

    const updated = { ...initial, revision: 'observation-2' as Revision,
      value: { ...initial.value, title: 'Changed source, reread after notification' } }
    mock.unary('researchMemory/getProject', ok({ ok: true, value: updated }))
    mock.streams.push('researchMemory/follow', { kind: 'resync-required', reason: 'source-changed' })
    await vi.waitFor(() => { expect(source.getSnapshot().value).toEqual({ ...updated, provider }) })
    expect(mock.log.calls('researchMemory/refresh')).toEqual([])
    await client.unload(BACKEND)
    await client.flush()
    expect(client.ctx.get('remote.researchMemory')).toBeUndefined()
    expect(mock.log.streams('researchMemory/follow').map(stream => stream.state)).toEqual(['cancelled'])
    expect(client.ctx.researchWorkspaces.resolve(WS)).toMatchObject({ ok: false, error: { code: 'not-connected' } })
    expect(source.getSnapshot().failure?.code).toBe('aitp/workspace')
    // A retained observation remains labelled as its original source reading, never as a successful fresh read.
    expect(source.getSnapshot().value).toEqual({ ...updated, provider })
  } finally {
    release()
  }
}, 60_000)

it('opens setup for an unenrolled Workspace through the generated feed, then enrolls and creates a topic with named arguments', async ({ mock, start }) => {
  const client = await start()
  const setup = { configured: false, writable: false, canInitialize: true }
  const initialized = { configured: true, writable: true, canInitialize: true }
  const receipt = { operationId: 'browser-create-once', topicId: 'topic:new%2Fresearch.md', resourceId: 'resource:new%2Fresearch.md' }
  mock.load({ unary: {
    'researchMemory/provider': ok({ ...provider, capabilities: { ...provider.capabilities, read: false, readContext: false } }),
    'researchMemory/getSetup': ok({ ok: true, value: setup }),
    'researchMemory/initialize': ok({ ok: true, value: initialized }),
    'researchMemory/createTopic': ok({ ok: true, value: receipt }),
  }, stream: {
    'researchMemory/follow': openStream([{ kind: 'resync-required', reason: 'research-workspace-not-initialized' }]),
  } })
  const source = client.ctx.resources.source('dsh-resource://aitp-workspace-setup/workspace/source-workspace')
  const release = source.subscribe(() => {})
  try {
    await vi.waitFor(() => { expect(source.getSnapshot()).toMatchObject({ status: 'live', value: setup }) })
    expect(mock.log.calls('researchMemory/getProject')).toEqual([])
    expect(mock.log.requests('researchMemory/getSetup')).toContainEqual({ request: { workspaceId: WS } })
    mock.unary('researchMemory/getSetup', ok({ ok: true, value: initialized }))
    mock.unary('researchMemory/provider', ok({ ...provider, capabilities: { ...provider.capabilities, applyChanges: true } }))
    expect(await client.ctx.researchWorkspaces.initialize(WS, { writable: true })).toEqual({ ok: true, value: initialized })
    await vi.waitFor(() => { expect(source.getSnapshot()).toMatchObject({ status: 'live', value: initialized }) })
    expect(mock.log.requests('researchMemory/initialize')).toEqual([{ request: { workspaceId: WS, writable: true } }])
    const input = { operationId: receipt.operationId, title: 'Control', question: 'Does A hold?', scope: 'Finite N.' }
    expect(await client.ctx.researchWorkspaces.createTopic(WS, input)).toEqual({ ok: true, value: receipt })
    expect(mock.log.requests('researchMemory/createTopic')).toEqual([{ request: { ...input, workspaceId: WS } }])
  } finally { release() }
}, 60_000)

it('reads real Session resources through the mounted endpoint, follows the existing event stream, and opens current sources separately', async ({ mock, start }) => {
  const sessionId = 'memory-session' as SessionId
  mock.unary('session/list', ok({ items: [{ sessionId, updatedAt: 0, running: false, blank: false, agentAvailable: false }] }))
  const client = await start()
  const memory: SessionMemoryView = { origin: 'runtime', sessionId,
    researcher: [{ id: 'original', kind: 'task', text: 'Does B require A?', turn: 1 }],
    agent: [], gaps: [], rules: [], summaries: [],
    sources: [{ id: 'selected', label: 'report.md', reason: 'selected', requirement: 'researcher', state: { kind: 'unknown' },
      address: 'dsh-resource://aitp-note/workspace/source-workspace/note/report.md' }],
  }
  const snapshot: SessionFollowFrame = { type: 'snapshot',
    header: { version: SESSION_FORMAT_VERSION, id: sessionId, createdAt: 0, isSeeded: false }, cursor: -1,
    records: [], hasMore: false, projections: { asOfSeq: -1, values: {} }, assistantStream: { revision: 0 },
  }
  mock.load({ unary: {
    'researchMemory/provider': ok(provider),
    'researchMemory/getSessionMemory': ok({ ok: true, value: null }),
    'researchMemory/getResource': ok({ ok: true, value: { ...initial, value: { id: 'resource:report.md', title: 'Current report',
      content: { kind: 'markdown', text: 'Current source B holds under A.' } } } }),
  }, stream: {
    'session/follow': openStream([snapshot]),
    'researchMemory/follow': openStream([{ kind: 'resync-required', reason: 'connected-or-reconnected' }]),
  } })
  const source = client.ctx.resources.source('dsh-resource://aitp-session/session/memory-session')
  const release = source.subscribe(() => {})
  const note = client.ctx.resources.source(memory.sources[0]!.address!)
  const releaseNote = note.subscribe(() => {})
  try {
    expect(client.ctx.remote.researchMemory.getSessionMemory).toBeTypeOf('function')
    await vi.waitFor(() => { expect(source.getSnapshot()).toEqual({ status: 'live', value: null, failure: undefined }) })
    expect(mock.log.requests('researchMemory/getSessionMemory')).toEqual([{ request: { sessionId } }])
    expect(client.ctx.sessions.retainInfo(sessionId).getSnapshot().retainedBy).toEqual({ researchMemory: 1 })
    expect(mock.log.streams('session/follow')).toHaveLength(1)
    // The new conversation can open before its queued research-origin input is committed.
    mock.unary('researchMemory/getSessionMemory', ok({ ok: true, value: memory }))
    mock.streams.push('session/follow', { type: 'event', event: { type: 'turn/start', seq: 0, time: 1, data: { turn: 1 } } })
    await vi.waitFor(() => { expect(source.getSnapshot().value).toEqual(memory) })
    await vi.waitFor(() => { expect(note.getSnapshot().value).toMatchObject({ origin: 'runtime', path: 'report.md', markdown: 'Current source B holds under A.' }) })
    expect(mock.log.requests('researchMemory/getResource')).toContainEqual({ request: { workspaceId: WS, resourceId: 'resource:report.md' } })
    const changed = { ...memory, researcher: [...memory.researcher, { id: 'correction', kind: 'input' as const, text: 'Keep the original convention.', turn: 2 }] }
    mock.unary('researchMemory/getSessionMemory', ok({ ok: true, value: changed }))
    // A committed owner-defined event must invalidate even when it is outside the old selected event-name list.
    mock.streams.push('session/follow', { type: 'event', event: { type: 'turn/start', seq: 1, time: 2, data: { turn: 2 } } })
    await vi.waitFor(() => { expect(source.getSnapshot().value).toEqual(changed) })
    expect(mock.log.streams('session/follow')).toHaveLength(1)
    mock.unary('researchMemory/getSessionMemory', ok({ ok: true, value: null }))
    mock.streams.push('session/follow', { type: 'event', event: { type: 'turn/end', seq: 2, time: 3, data: { turn: 2, reason: { kind: 'completed' } } } })
    await vi.waitFor(() => { expect(source.getSnapshot()).toEqual({ status: 'live', value: null, failure: undefined }) })
    expect(client.ctx.sessions.retainInfo(sessionId).getSnapshot().referenceCount).toBe(1)
    expect(mock.log.calls('session/prompt')).toEqual([])
    expect(mock.log.calls('researchMemory/ask')).toEqual([])
  } finally { release(); releaseNote() }
  await vi.waitFor(() => { expect(client.ctx.sessions.retainInfo(sessionId).getSnapshot().referenceCount).toBe(0) })
}, 60_000)
