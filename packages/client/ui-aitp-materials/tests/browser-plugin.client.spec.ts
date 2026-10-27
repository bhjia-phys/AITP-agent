// @vitest-environment jsdom
/** Generated Remote mounting, independent domain contributions and live-generation cleanup. */
import { expect, vi } from 'vitest'
import { ClientRoster, createClientTest, webApp } from '@deepseek-ai/dsh-client-test-runtime/src/assembly/index.ts'
import { ok, openStream } from '@deepseek-ai/dsh-remote-mock'
import type { ResourceEntryId, ResourcePage, ResourceReading, SourceId, SourceRootId } from '@deepseek-ai/dsh-research-resources/types'
import type { ResearchDiscussions } from '@deepseek-ai/dsh-client-ui-aitp-research/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { materialSourceAddress } from '@deepseek-ai/dsh-research-resources/protocol'
import type {} from '../src/client/index.ts'

const MATERIALS = '@deepseek-ai/dsh-client-ui-aitp-materials'
const domains = ['literature', 'knowledge', 'code'] as const
const packages = domains.map(domain => `@deepseek-ai/dsh-client-ui-aitp-${domain}`)
const owned = new Set([MATERIALS, ...packages])
const it = createClientTest({ roster: ClientRoster.of([
  ...webApp.rows.filter(row => !owned.has(row.name)),
  { name: MATERIALS, immediately: false, inject: [
    '@deepseek-ai/dsh-api-gateway', '@deepseek-ai/dsh-client-resources', '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-client-ui-sidebar',
    '@deepseek-ai/dsh-client-ui-workspace', '@deepseek-ai/dsh-client-ui-sidebar-right',
  ] },
  ...packages.map(name => ({ name, immediately: false, inject: [MATERIALS, '@deepseek-ai/dsh-client-locale'] })),
]) })

const initial: ResourcePage = { items: [], nextCursor: null, completeness: 'complete', issues: [], observedAt: '2026-10-25T01:00:00Z' }

it('mounts the actual endpoint, follows real resource reads and withdraws only the unloaded domain', async ({ mock, start }) => {
  // Mock only after boot: a synthetic namespace must not hide a missing production $mount.
  const client = await start()
  expect(client.ctx.get('remote.researchResources')).toBeDefined()
  expect(client.ctx.researchMaterials).toBeDefined()
  expect(domains.map(domain => client.ctx.researchMaterials.open({ domain }))).toEqual([true, true, true])
  mock.load({ unary: {
    'researchResources/listResources': ok({ ok: true, value: initial }),
  }, stream: {
    'researchResources/follow': openStream([{ kind: 'resync-required', reason: 'connected' }]),
  } })
  const source = client.ctx.resources.source('dsh-resource://aitp-material-list/literature?q=Chinese+%E4%B8%AD%E6%96%87')
  const release = source.subscribe(() => {})
  try {
    await vi.waitFor(() => { expect(source.getSnapshot()).toMatchObject({ status: 'live', value: initial }) })
    expect(mock.log.requests('researchResources/listResources')).toContainEqual({ request: { domain: 'literature', query: 'Chinese 中文' } })
    expect(mock.log.streams('researchResources/follow')).toHaveLength(1)
    const updated = { ...initial, completeness: 'partial', issues: [{ reason: 'Unavailable collection' }], observedAt: '2026-10-25T02:00:00Z' }
    mock.unary('researchResources/listResources', ok({ ok: true, value: updated }))
    mock.streams.push('researchResources/follow', { kind: 'invalidated', rootId: 'selected-root' })
    await vi.waitFor(() => { expect(source.getSnapshot().value).toEqual(updated) })
    await client.reload(MATERIALS)
    await client.flush()
    await vi.waitFor(() => { expect(source.getSnapshot()).toMatchObject({ status: 'live', value: updated }) })
    expect(domains.map(domain => client.ctx.researchMaterials.open({ domain }))).toEqual([true, true, true])
    expect(mock.log.streams('researchResources/follow').map(stream => stream.state)).toEqual(['cancelled', 'open'])
    await client.unload(packages[0]!)
    await client.flush()
    expect(client.ctx.researchMaterials.open({ domain: 'literature' })).toBe(false)
    expect(client.ctx.researchMaterials.open({ domain: 'knowledge' })).toBe(true)
    expect(client.ctx.researchMaterials.open({ domain: 'code' })).toBe(true)
    await client.unload(MATERIALS)
    await client.flush()
    expect(client.ctx.get('remote.researchResources')).toBeUndefined()
    expect(client.ctx.get('researchMaterials')).toBeUndefined()
    expect(mock.log.streams('researchResources/follow').map(stream => stream.state)).toEqual(['cancelled', 'cancelled'])
    // This plugin owns the protocols as well as the transport: withdrawing it
    // removes the source observation instead of inventing a fresh disconnected read.
    expect(source.getSnapshot().status).not.toBe('live')
    expect(source.getSnapshot().value).toBeUndefined()
  } finally { release() }
}, 60_000)

it('admits selected sources through the existing Session transport and releases the optional discussion bridge on unload', async ({ mock, start }) => {
  const client = await start()
  mock.load({ stream: { 'researchResources/follow': openStream([]) } })
  const submissions = new Set<Parameters<ResearchDiscussions['registerStudySubmission']>[0]>()
  const readers = new Set<Parameters<ResearchDiscussions['registerResourceNavigation']>[0]>()
  const service: ResearchDiscussions = {
    open: vi.fn(async () => {}), select: vi.fn(async () => {}), newDiscussion: vi.fn(async () => {}),
    showSession: vi.fn(async () => {}), setSource: vi.fn(), collapse: vi.fn(), suspend: vi.fn(() => () => {}),
    registerStudySubmission: (submit) => { submissions.add(submit); return () => { submissions.delete(submit) } },
    registerResourceNavigation: (open) => { readers.add(open); return () => { readers.delete(open) } },
  }
  const release = client.ctx.reflect.provide('researchDiscussions', service)
  try {
    await client.flush()
    expect(submissions.size).toBe(1)
    expect(readers.size).toBe(1)
    const submit = [...submissions][0]!
    const sessionId = 'existing-direction-session' as SessionId
    const request: Parameters<typeof submit>[1] = {
      sessionId, requestId: 'native-request' as Parameters<typeof submit>[1]['requestId'], mode: 'steer',
      content: [{ type: 'text', text: 'Use the new convention.' }, { type: 'text', text: 'Keep the unresolved route.' }],
    }
    const selection = { ref: { rootId: 'root-one' as SourceRootId, sourceId: 'source:note.md' as SourceId },
      locator: { kind: 'text' as const, start: 15, end: 23, quote: 'evidence' }, selectedText: 'evidence' }
    mock.unary('researchResources/askStudy', ok({ ok: true, value: { sessionId } }))
    expect(await submit({ workspaceId: 'project', topicId: 'branch', selections: [selection] }, request)).toEqual({
      ok: true, value: { sessionId },
    })
    expect(mock.log.requests('researchResources/askStudy')).toContainEqual({ request: {
      workspaceId: 'project', topicId: 'branch', ...request, question: 'Use the new convention.\nKeep the unresolved route.',
      selections: [selection],
    } })
    await submit({ workspaceId: 'project', selections: [selection] }, request)
    expect(mock.log.requests('researchResources/askStudy')).toContainEqual({ request: {
      workspaceId: 'project', scope: 'workspace', ...request, question: 'Use the new convention.\nKeep the unresolved route.',
      selections: [selection],
    } })
    const read = [...readers][0]!
    const scope = { workspaceId: 'project' as WorkspaceId, topicId: 'branch' }
    expect(read(scope, 'dsh-resource://some-other-reader/source')).toBe(false)
    const reading: ResourceReading = {
      resource: { id: 'entry' as ResourceEntryId, ref: selection.ref, title: 'Located evidence',
        domain: 'knowledge', kind: 'knowledge', providerId: 'knowledge', metadata: {}, links: [], topics: [] },
      body: { kind: 'text', format: 'markdown', text: 'The exact evidence.' }, observedAt: 'now', issues: [],
    }
    mock.unary('researchResources/readResource', ok({ ok: true, value: reading }))
    expect(await read(scope, materialSourceAddress(selection.ref, selection.locator))).toBe(true)
    expect(client.ctx.layout.panelInfo.getSnapshot().activePanelId).toBe('aitp-knowledge')
    const paper: ResourceReading = { ...reading, resource: { ...reading.resource, domain: 'literature',
      providerId: 'literature', title: 'Authored paper title', metadata: { authors: 'A. Author', year: '2026' } } }
    mock.unary('researchResources/readResource', ok({ ok: true, value: paper }))
    const paperAddress = materialSourceAddress(selection.ref, undefined, 'literature')
    expect(await read(scope, paperAddress)).toBe(true)
    expect(client.ctx.layout.panelInfo.getSnapshot().activePanelId).toBe('aitp-literature')
    expect(mock.log.requests('researchResources/readResource')).toContainEqual({ request: { ref: selection.ref, domain: 'literature' } })
    const source = client.ctx.resources.source(paperAddress)
    const releaseSource = source.subscribe(() => {})
    try {
      await vi.waitFor(() => { expect(source.getSnapshot()).toMatchObject({ status: 'live', value: paper }) })
      expect(mock.log.requests('researchResources/readResource')).toContainEqual({ request: { ref: selection.ref, domain: 'literature' } })
    } finally { releaseSource() }
    mock.unary('researchResources/readResource', ok({ ok: false,
      error: { code: 'unavailable', message: 'Source was disconnected.', retryable: true } }))
    await expect(read(scope, materialSourceAddress(selection.ref))).rejects.toThrow('could not be resolved')
    let settle!: (value: unknown) => void
    mock.unary('researchResources/readResource', () => new Promise((resolve) => { settle = resolve }))
    const cancelled = client.ctx.researchMaterials.openSource({ ref: selection.ref })
    await vi.waitFor(() => { expect(settle).toBeTypeOf('function') })
    client.ctx.layout.selectPanel(null)
    settle(ok({ ok: true, value: reading }))
    expect(await cancelled).toBe(false)
    expect(client.ctx.layout.panelInfo.getSnapshot().activePanelId).toBeNull()
    await client.reload(MATERIALS)
    await client.flush()
    expect(submissions.size).toBe(1)
    expect(readers.size).toBe(1)
    await client.unload(MATERIALS)
    await client.flush()
    expect(submissions.size).toBe(0)
    expect(readers.size).toBe(0)
  } finally { await release() }
}, 60_000)
