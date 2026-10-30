// @vitest-environment jsdom
/** A real Topic page opens independently composed library panels and returns without changing scope. */
import { act, fireEvent, within } from '@testing-library/react'
import { expect, vi } from 'vitest'
import { ClientRoster, createClientTest, webApp } from '@deepseek-ai/dsh-client-test-runtime/src/assembly/index.ts'
import { ok, openStream } from '@deepseek-ai/dsh-remote-mock'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { ResearchWorkspaceAdapter, Topic, TopicId, ResourceId, Revision } from '@deepseek-ai/dsh-client-ui-aitp-research/client'
import type { ResourceReadRequest, ResourceReading, ResourceEntryId, SourceRootId, SourceId } from '@deepseek-ai/dsh-research-resources/types'
import type {} from '../src/client/index.ts'

const RESEARCH = '@deepseek-ai/dsh-client-ui-aitp-research'
const MATERIALS = '@deepseek-ai/dsh-client-ui-aitp-materials'
const domains = ['literature', 'knowledge', 'code'] as const
const modules = domains.map(domain => `@deepseek-ai/dsh-client-ui-aitp-${domain}`)
const owned = new Set([RESEARCH, MATERIALS, ...modules])
const it = createClientTest({ roster: ClientRoster.of([
  ...webApp.rows.filter(row => !owned.has(row.name)),
  { name: RESEARCH, immediately: false, inject: [
    '@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-client-ui-sidebar', '@deepseek-ai/dsh-client-ui-sidebar-right',
    '@deepseek-ai/dsh-client-ui-workspace', '@deepseek-ai/dsh-client-resources', '@deepseek-ai/dsh-client-locale',
  ] },
  { name: MATERIALS, immediately: false, inject: [
    '@deepseek-ai/dsh-api-gateway', '@deepseek-ai/dsh-client-resources', '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-client-ui-sidebar',
    '@deepseek-ai/dsh-client-ui-workspace', '@deepseek-ai/dsh-client-ui-sidebar-right',
  ] },
  ...modules.map(name => ({ name, immediately: false, inject: [MATERIALS, '@deepseek-ai/dsh-client-locale'] })),
]) }, { mount: true })
const WS = 'topic-workspace' as WorkspaceId
const TOPIC = 'specific-direction' as TopicId
const LEGACY = 'existing-source' as ResourceId
const topic: Topic = { id: TOPIC, title: 'Explicit direction', parentId: null, childIds: [], question: 'Does A hold?', scope: 'Finite systems.',
  currentAnswer: null, gap: null, work: { state: 'active', label: 'Active' }, workItems: [], statements: [], resourceCount: 1,
  resources: [{ id: LEGACY, ownerTopicId: TOPIC, title: 'Existing source', kind: 'note', target: { kind: 'workspace-path', path: 'notes/existing.md' } }],
}
const observation = <T>(value: T) => ({ origin: 'fixture' as const, revision: 'read-one' as Revision, observedAt: 'now', value })
const unsupported = async () => ({ ok: false as const, error: { code: 'unsupported' as const, message: 'Read-only test adapter', retryable: false } })
const adapter: ResearchWorkspaceAdapter = {
  workspaceId: WS, provider: { id: 'explicit-test', origin: 'fixture', capabilities: { automaticResearch: false, read: true, readContext: false, readActivity: false,
    previewChanges: false, applyChanges: false, changeEvents: false, commands: [] } },
  getProject: async () => ({ ok: true, value: observation({ id: 'project', title: 'Test project', directions: [], seeds: [] }) }),
  listTopics: async query => ({ ok: true, value: observation({ items: query.parentId === TOPIC ? [] : [observation(topic)], nextCursor: null, completeness: 'complete' }) }),
  getTopic: async () => ({ ok: true, value: observation(topic) }),
  getResource: async () => ({ ok: true, value: observation({ ...topic.resources[0]!, content: { kind: 'plain-text', text: 'Original legacy source remains readable.' }, attribution: { sourceResourceIds: [] } }) }),
  getActivity: unsupported, readContext: unsupported, previewChange: unsupported, applyChange: unsupported,
  subscribeChanges: () => () => {},
}

it('clicks the current Topic into each library, returns to that Topic and retains legacy reading after unload', async ({ mock, start }) => {
  const client = await start()
  mock.streams.push('workspace/follow', { type: 'replace', value: { items: [{ workspaceId: WS, title: 'Project workspace', path: '/test-project',
    sessionIds: [], createdAt: '', updatedAt: '' }], archivedSessionIds: [], pinnedSessionIds: [] } })
  const release = client.ctx.researchWorkspaces.register(() => adapter)
  mock.load({ unary: {
    'researchResources/listRoots': ok({ ok: true, value: [] }),
    'researchResources/getSetup': ok({ ok: true, value: { canConnect: false, canSaveSourceSets: false } }),
    'researchResources/listSourceSets': ok({ ok: true, value: { items: [], nextCursor: null } }),
    'researchResources/listResources': ok({ ok: true, value: { items: [], nextCursor: null, completeness: 'complete', issues: [], observedAt: 'now' } }),
  }, stream: { 'researchResources/follow': openStream([{ kind: 'resync-required', reason: 'test-connected' }]) } })
  const ui = within(client.container!)
  try {
    await vi.waitFor(() => { expect(client.ctx.workspaces.list.getSnapshot().items).toHaveLength(1) })
    act(() => { client.ctx.layout.selectPanel('aitp-research' as MainPanelId) })
    await client.flush()
    await vi.waitFor(() => { expect(client.container!.querySelector('[data-map-node]')).not.toBeNull() })
    const overviewReading = client.container!.querySelector<HTMLElement>('[data-research-reading]')!
    overviewReading.scrollTop = 120
    ui.getByRole('button', { name: 'Related Literature library' }).focus()
    fireEvent.click(ui.getByRole('button', { name: 'Related Literature library' }))
    await vi.waitFor(() => { expect(mock.log.requests('researchResources/listResources'))
      .toContainEqual({ request: { domain: 'literature', topic: { workspaceId: WS } } }) })
    expect(ui.getByText('Current project: Test project')).toBeDefined()
    fireEvent.click(ui.getByRole('button', { name: 'Return to project' }))
    await client.flush()
    expect(ui.getByRole('heading', { name: 'Test project' })).toBeDefined()
    await vi.waitFor(() => {
      expect(client.container!.querySelector<HTMLElement>('[data-research-reading]')!.scrollTop).toBe(120)
      expect(document.activeElement).toBe(ui.getByRole('button', { name: 'Related Literature library' }))
    })
    fireEvent.click(client.container!.querySelector('[data-map-node]')!)
    await client.flush()
    fireEvent.click(ui.getByRole('button', { name: 'Open topic' }))
    await vi.waitFor(() => { expect(ui.getByRole('heading', { name: 'Explicit direction' })).toBeDefined() })
    fireEvent.click(ui.getByRole('button', { name: /^Claims & routes/ }))
    for (const [domain, label] of [['literature', 'Related Literature library'], ['knowledge', 'Related Knowledge library'], ['code', 'Related Code libraries']] as const) {
      const reading = client.container!.querySelector<HTMLElement>('[data-research-reading]')!
      reading.scrollTop = 360
      const entry = ui.getByRole('button', { name: label })
      entry.focus()
      fireEvent.click(entry)
      await client.flush()
      expect(ui.getByText('Current topic: Explicit direction')).toBeDefined()
      await vi.waitFor(() => { expect(mock.log.requests('researchResources/listResources'))
        .toContainEqual({ request: { domain, topic: { workspaceId: WS, topicId: TOPIC } } }) })
      fireEvent.click(ui.getByRole('button', { name: 'Return to topic' }))
      await client.flush()
      expect(ui.getByRole('heading', { name: 'Explicit direction' })).toBeDefined()
      await vi.waitFor(() => {
        expect(client.container!.querySelector<HTMLElement>('[data-research-reading]')!.scrollTop).toBe(360)
        expect(document.activeElement).toBe(ui.getByRole('button', { name: label }))
      })
      expect(ui.getByRole('button', { name: /^Claims & routes/ }).getAttribute('aria-expanded')).toBe('true')
    }
    fireEvent.click(ui.getByRole('button', { name: 'Back' }))
    await client.flush()
    expect(ui.getByRole('button', { name: 'Open topic' })).toBeDefined()
    fireEvent.click(ui.getByRole('button', { name: 'Open topic' }))
    await client.flush()
    await client.unload(modules[0]!)
    await client.flush()
    expect(ui.queryByRole('button', { name: 'Related Literature library' })).toBeNull()
    expect(ui.getByRole('button', { name: 'Related Knowledge library' })).toBeDefined()
    await client.unload(MATERIALS)
    await client.flush()
    expect(ui.queryByRole('button', { name: /^Related / })).toBeNull()
    fireEvent.click(ui.getByRole('button', { name: /Existing source/ }))
    await vi.waitFor(() => { expect(ui.getByText('Original legacy source remains readable.')).toBeDefined() })
    expect(mock.log.calls('researchResources/askStudy')).toEqual([])
  } finally { release() }
}, 60_000)

it('opens research materials through a host-enrolled Workspace root and leaves ambiguous roots unresolved', async ({ mock, start }) => {
  const client = await start()
  const root = { id: 'enrolled-root' as SourceRootId, title: 'Research project', displayPath: '/research/project',
    grants: [{ kind: 'host' as const, workspaceId: WS }] }
  const ref = { rootId: root.id, sourceId: 'source:notes%2Fexisting.md' as SourceId }
  const reading: ResourceReading = { resource: { id: 'enrolled-note' as ResourceEntryId, ref, title: 'Original enrolled note',
    kind: 'note', domain: 'knowledge', providerId: 'knowledge', metadata: {}, links: [], topics: [] },
  body: { kind: 'text', format: 'markdown', text: 'The original finite-system limitation remains visible.' }, observedAt: 'now', issues: [] }
  mock.load({ unary: {
    'researchResources/listRoots': ok({ ok: true, value: [root] }),
    'researchResources/readResource': ok({ ok: true, value: reading }),
  }, stream: { 'researchResources/follow': openStream([]) } })
  act(() => { client.ctx.layout.selectPanel('aitp-research' as MainPanelId) })
  const material = topic.resources[0]!
  let opened = false
  await act(async () => { opened = await client.ctx.researchMaterialNavigation.open({ workspaceId: WS, topicId: TOPIC }, material) })
  expect(opened).toBe(true)
  await vi.waitFor(() => { expect(within(client.container!).getByText('The original finite-system limitation remains visible.')).toBeDefined() })
  expect(client.ctx.layout.panelInfo.getSnapshot().activePanelId).toBe('aitp-research')
  mock.unary('researchResources/listRoots', ok({ ok: true, value: [root, { ...root, id: 'second-root' as SourceRootId }] }))
  await act(async () => { opened = await client.ctx.researchMaterialNavigation.open({ workspaceId: WS, topicId: TOPIC }, material) })
  expect(opened).toBe(false)
  expect(mock.log.calls('researchResources/askStudy')).toEqual([])
}, 60_000)

it('opens PDF and Git links in native document tabs while retaining the catalog, topic and return action', async ({ mock, start }) => {
  const client = await start()
  const source = { rootId: 'source-root' as SourceRootId, sourceId: 'source:note.md' as SourceId }
  const pdf = { ...source, sourceId: 'source:paper.PDF' as SourceId }
  const git = { ...source, sourceId: 'git:checkout' as SourceId }
  const original: ResourceReading = { resource: { id: 'original' as ResourceEntryId, ref: source, title: 'Original explanation',
    kind: 'knowledge', domain: 'knowledge', providerId: 'knowledge', metadata: {}, topics: [], links: [
      { label: 'Physical paper', href: 'paper.PDF', target: pdf },
      { label: 'Current patch', href: 'recorded-git-view', target: git, locator: { kind: 'git', view: 'diff', scope: 'working-tree' } },
    ] }, body: { kind: 'text', format: 'markdown', text: 'Keep the current question scope.' }, observedAt: 'now', issues: [] }
  const paper: ResourceReading = { ...original, resource: { ...original.resource, ref: pdf, title: 'Physical paper',
    kind: 'literature', domain: 'literature', providerId: 'literature', links: [] },
  body: { kind: 'unavailable', reason: 'unsupported', detail: 'This unit checks routing without a PDF renderer.' } }
  const patch: ResourceReading = { ...original, resource: { ...original.resource, ref: git, title: 'Current patch',
    kind: 'code', domain: 'code', providerId: 'code', links: [] },
  body: { kind: 'text', format: 'plain-text', text: 'Original patch observation.' }, locator: { kind: 'git', view: 'diff', scope: 'working-tree' } }
  mock.load({ unary: {
    'researchResources/listRoots': ok({ ok: true, value: [] }),
    'researchResources/getSetup': ok({ ok: true, value: { canConnect: false, canSaveSourceSets: false } }),
    'researchResources/listSourceSets': ok({ ok: true, value: { items: [], nextCursor: null } }),
    'researchResources/listResources': ok({ ok: true, value: { items: [], nextCursor: null, completeness: 'complete', issues: [], observedAt: 'now' } }),
  }, stream: { 'researchResources/follow': openStream([{ kind: 'resync-required', reason: 'test-connected' }]) } })
  mock.unary('researchResources/readResource', ({ request }: { request: ResourceReadRequest }) => ok({ ok: true,
    value: request.ref.sourceId === pdf.sourceId ? paper : request.ref.sourceId === git.sourceId ? patch : original }))
  const ui = within(client.container!)
  const returnTo = vi.fn()
  const scope = { workspaceId: WS, topicId: TOPIC, title: 'Explicit direction' }
  for (const label of ['Physical paper', 'Current patch']) {
    act(() => { client.ctx.researchMaterials.open({ domain: 'knowledge', ref: source, scope, returnTo }) })
    await client.flush()
    await vi.waitFor(() => { expect(ui.getByRole('tab', { name: /^Original explanation/u }).getAttribute('aria-selected')).toBe('true') })
    expect(ui.getByRole('textbox', { name: 'Search this library' })).toBeDefined()
    const originalReader = client.container!.querySelector<HTMLElement>('[data-material-source]')
    if (originalReader === null) throw new Error('Expected the native source tab body.')
    const details = within(originalReader).getByText('About this reading').closest('details')
    if (details === null) throw new Error('Expected source details in the native reader.')
    if (!details.open) fireEvent.click(within(details).getByText('About this reading'))
    fireEvent.click(ui.getByRole('button', { name: label }))
    await client.flush()
    expect(client.ctx.layout.panelInfo.getSnapshot().activePanelId).toBe('aitp-knowledge')
    await vi.waitFor(() => { expect(ui.getByRole('tab', { name: new RegExp(`^${label}`, 'u') }).getAttribute('aria-selected')).toBe('true') })
    expect(ui.getByRole('tab', { name: /^Original explanation/u }).getAttribute('aria-selected')).toBe('false')
    if (label === 'Physical paper') expect(ui.getByRole('note').textContent).toContain('This unit checks routing without a PDF renderer.')
    else expect(ui.getByLabelText('Git patch').textContent).toContain('Original patch observation.')
    expect(ui.getByText('Current topic: Explicit direction')).toBeDefined()
    expect(ui.getByRole('textbox', { name: 'Search this library' })).toBeDefined()
    fireEvent.click(ui.getByRole('tab', { name: /^Original explanation/u }))
    await client.flush()
    await vi.waitFor(() => { expect(ui.getByRole('tab', { name: /^Original explanation/u }).getAttribute('aria-selected')).toBe('true') })
    expect(ui.getByText('Keep the current question scope.')).toBeDefined()
    expect(client.ctx.layout.panelInfo.getSnapshot().activePanelId).toBe('aitp-knowledge')
    fireEvent.click(ui.getByRole('button', { name: 'Return to topic' }))
  }
  expect(returnTo).toHaveBeenCalledTimes(2)
  expect(mock.log.requests('researchResources/readResource')).toContainEqual({ request: { ref: pdf } })
  expect(mock.log.requests('researchResources/readResource')).toContainEqual({ request: { ref: git,
    locator: { kind: 'git', view: 'diff', scope: 'working-tree' } } })
  expect(mock.log.calls('researchResources/askStudy')).toEqual([])
}, 60_000)
