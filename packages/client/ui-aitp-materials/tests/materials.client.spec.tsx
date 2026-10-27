// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, onTestFinished, vi } from 'vitest'
import { bindSnapshotSelector, makeTranslate, SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots'
import type { ResourceEntryId, ResourcePage, ResourceReading, ResourceSummary, SaveSourceSetRequest, SourceId, SourceRootId, SourceSelection, SourceSetId, SourceTopicId } from '@deepseek-ai/dsh-research-resources/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { createSidebarRightRootStore } from '../../ui-sidebar-right/src/client/root-store.ts'
import { RootExpandButton } from '../../ui-sidebar-right/src/client/shell/RootExpandButton.tsx'
import { MaterialsPanel, type MaterialsManagementFace, type MaterialsPanelFace, type MaterialsPanelProps } from '../src/client/MaterialsPanel.tsx'
import { MaterialsCatalog } from '../src/client/MaterialsCatalog.tsx'
import { MaterialReader } from '../src/client/MaterialReader.tsx'
import { MaterialMarkdown } from '../src/client/MaterialMarkdown.tsx'
import { SourceMarkdownReader } from '../../ui-sidebar-documentpreview/src/client/markdown/MarkdownBody.tsx'
import { en as markdownEn } from '../../ui-sidebar-documentpreview/src/client/markdown/locales.ts'
import type { MaterialReaderInput } from '../src/client/contracts.ts'
import { en } from '../src/client/locales.ts'
import { createMaterialsStore, materialsScopeKey } from '../src/client/store.ts'
import { MATERIAL_ROOTS, MATERIAL_SETUP, materialListAddress, materialSourceSetsAddress } from '../src/client/resources.ts'

afterEach(() => { cleanup(); document.getSelection()?.removeAllRanges() })

const t = makeTranslate(en)
const source = (root: string, title: string): ResourceSummary => ({ id: root as ResourceEntryId,
  ref: { rootId: root as SourceRootId, sourceId: 'source:same.md' as SourceId }, title,
  kind: 'knowledge', domain: 'knowledge', providerId: 'knowledge', metadata: { support: 'source', review: 'awaiting review' }, links: [], topics: [],
})
const first = source('papers', '文献中的归一化')
const second = source('knowledge', '已有推导')
const page: ResourcePage = { items: [first, second], nextCursor: null, completeness: 'complete', issues: [], observedAt: '2026-10-25' }
const live = <T,>(value: T): ResourceSnapshot<T> => ({ status: 'live', value, failure: undefined })
const none: ResourceSnapshot<never> = { status: 'none', value: undefined, failure: undefined }

function unusedReaderSeat(): never { throw new Error('The source reader unexpectedly requested an unused runtime seat.') }

function readerProps(input: MaterialReaderInput): FactoryComponentPropsOf<'aitp.materials.reader'> {
  const store = createMaterialsStore().create()
  return { ...input, t, useStore: bindSnapshotSelector(store), actions: store.actions,
    renderSlot: (_name, _owner, options) => options?.fallback ?? null,
    renderFactorySlot: unusedReaderSeat, useFactorySlot: unusedReaderSeat, useResource: () => none,
    useSessions: unusedReaderSeat, useSessionStatus: unusedReaderSeat, useSessionRetainInfo: unusedReaderSeat,
    useSessionAccess: unusedReaderSeat, useWorkspaces: unusedReaderSeat,
    useWorkspaceAccess: unusedReaderSeat, usePanelInfo: unusedReaderSeat, useRemoteAccess: unusedReaderSeat,
  }
}

async function renderReader(input: MaterialReaderInput) {
  const runtime = await SlotTestRuntime.create()
  onTestFinished(() => runtime.dispose())
  const locale = { revision: 0 }
  runtime.slots.installLocale({ getSnapshot: () => locale, subscribe: () => () => {},
    bind: namespace => namespace === 'documentMarkdown' ? makeTranslate(markdownEn) : t })
  runtime.slots.registerFactory({ name: 'aitp.materials.markdown', scope: 'root', locale: 'aitp.materials' }, MaterialMarkdown)
  runtime.slots.registerFactory({ name: 'document.markdown.reader', scope: 'root', locale: 'documentMarkdown' }, SourceMarkdownReader)
  await runtime.root.declare({}, ({ renderFactorySlot }) =>
    <MaterialReader {...readerProps(input)} renderFactorySlot={renderFactorySlot} />)
  return runtime.renderRoot()
}

async function panel(overrides: Partial<MaterialsPanelFace> = {}, values: Record<string, ResourceSnapshot<unknown>> = {
  [MATERIAL_ROOTS]: live([{ id: 'papers', title: 'Papers', displayPath: '/papers' }, { id: 'knowledge', title: 'Knowledge', displayPath: '/knowledge' }]),
  [materialListAddress({ domain: 'knowledge' })]: live(page),
}) {
  const store = createMaterialsStore().create()
  const face: MaterialsPanelFace = {
    domain: 'knowledge', panelId: 'aitp-knowledge' as MaterialsPanelFace['panelId'], labels: () => ({ title: 'Knowledge library', description: 'Read the existing collection.', fields: [{ key: 'support', label: 'Support' }, { key: 'review', label: 'Review' }] }),
    preview: vi.fn(), changeScope: vi.fn<MaterialsPanelFace['changeScope']>((scope) => { store.actions.setScope(scope) }),
    refresh: vi.fn(), returnTo: vi.fn(), openLink: vi.fn(() => false), openSelection: vi.fn(), openSession: vi.fn(),
    ask: vi.fn<MaterialsPanelFace['ask']>(async () => ({ ok: true, value: { sessionId: 'ordinary-session' as SessionId } })), ...overrides,
  }
  const props = { ...face, t, useStore: bindSnapshotSelector(store), actions: store.actions,
    useWorkspaces: (select: (value: { items: readonly unknown[] }) => unknown) => select({ items: [] }),
    useResource: vi.fn((address: string) => values[address] ?? none), renderFactorySlot: vi.fn(() => null) } as MaterialsPanelProps
  const runtime = await SlotTestRuntime.create()
  onTestFinished(() => runtime.dispose())
  const locale = { revision: 0 }
  runtime.slots.installLocale({ getSnapshot: () => locale, subscribe: () => () => {}, bind: () => t })
  runtime.slots.registerFactory({ name: 'sidebar.right.root.expand', scope: 'root', locale: 'sidebarRight',
    store: createSidebarRightRootStore(), inject: () => ({
      hooks: { shortcuts: createSnapshotStore([] as const) },
    }),
  }, RootExpandButton)
  runtime.slots.registerFactory({ name: 'aitp.materials.catalog', scope: 'root', locale: 'aitp.materials',
    children: { 'aitp.materials.catalog.body': { kind: 'keyed', scope: 'root' } },
  }, MaterialsCatalog)
  runtime.slots.registerFactory({ name: 'aitp.materials.study-tools', scope: 'root',
    children: { 'aitp.materials.tasks': { kind: 'list', scope: 'root' } },
  }, owner => <button type="button" onClick={() => { owner.prepareQuestion('Compare these conventions.') }}>Prepare comparison</button>)
  const renderFactorySlot = vi.fn<MaterialsPanelProps['renderFactorySlot']>()
  props.renderFactorySlot = renderFactorySlot
  await runtime.root.declare({}, (owner) => {
    renderFactorySlot.mockImplementation(owner.renderFactorySlot)
    return <MaterialsPanel {...props} />
  })
  runtime.renderRoot()
  return { store, face, props }
}

it('keeps the code catalog mounted for an empty directory so its parent navigation remains available', async () => {
  const rootId = 'repo' as SourceRootId
  const values = {
    [MATERIAL_ROOTS]: live([{ id: rootId, title: 'Repository', displayPath: '/repo', domains: ['code'] }]),
    [materialListAddress({ domain: 'code', rootId, folder: 'empty' })]: live({ ...page, items: [] }),
  }
  const { store, props } = await panel({ domain: 'code' }, values)
  act(() => { store.actions.setRoot('code', rootId); store.actions.setFolder('code', 'empty') })
  await waitFor(() => { expect(props.renderFactorySlot).toHaveBeenCalledWith('aitp.materials.catalog', expect.objectContaining({
    domain: 'code', rootId, folderPath: 'empty', items: [],
  })) })
})

it('browses globally, keeps equal filenames distinct and submits only the explicitly selected sources', async () => {
  const { face } = await panel()
  expect(screen.getByText('Global materials')).toBeDefined()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Use “文献中的归一化” for this question' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Use “已有推导” for this question' }))
  expect(face.ask).not.toHaveBeenCalled()
  expect(face.openSession).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /^Selected sources/u }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Ask about the selected sources' }), { target: { value: '比较两种约定。' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask in a new conversation' }))
  await waitFor(() => { expect(face.openSession).toHaveBeenCalledWith({ sessionId: 'ordinary-session' }) })
  expect(face.ask).toHaveBeenCalledExactlyOnceWith({ question: '比较两种约定。', selections: [{ ref: first.ref }, { ref: second.ref }] })
})

it('recovers an expired later-page cursor without cached rows while retaining search and source-folder filters', async () => {
  const query = '归一'
  const rootId = 'papers' as SourceRootId
  const cursor = 'previous-revision-page'
  const filtered = { domain: 'knowledge' as const, query, rootId }
  const error = { code: 'invalid-request' as const, message: 'The source page cursor expired or belongs to another query.', retryable: false }
  const initial = live({ ...page, items: [first], nextCursor: cursor })
  const values: Record<string, ResourceSnapshot<unknown>> = {
    [MATERIAL_ROOTS]: live([{ id: rootId, title: 'Papers', displayPath: '/papers' }]),
    [materialListAddress({ domain: 'knowledge' })]: initial,
    [materialListAddress({ domain: 'knowledge', query })]: initial,
    [materialListAddress(filtered)]: initial,
    [materialListAddress({ ...filtered, cursor })]: { status: 'failed', value: undefined,
      failure: new RemoteError('aitp/materials', error.message, error) },
  }
  const { store, face } = await panel({}, values)
  fireEvent.change(screen.getByRole('textbox', { name: 'Search this library' }), { target: { value: query } })
  fireEvent.change(screen.getByRole('combobox', { name: 'Source folders' }), { target: { value: rootId } })
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  expect(screen.getByRole('alert')).toBeDefined()
  expect(store.getSnapshot().views.knowledge.cursor).toBe(cursor)
  fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Refresh' }))
  expect(face.refresh).toHaveBeenCalledOnce()
  expect(store.getSnapshot().views.knowledge.cursor).toBe(cursor)

  const refreshed = source('papers', '更新后的归一化')
  values[materialListAddress(filtered)] = live({ ...page, items: [refreshed], nextCursor: null })
  fireEvent.click(screen.getByRole('button', { name: 'First page' }))
  expect(screen.getByRole('button', { name: refreshed.title })).toBeDefined()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByRole('button', { name: 'First page' })).toBeNull()
  expect(store.getSnapshot().views.knowledge).toMatchObject({ query, rootId, cursor: null })
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Search this library' }).value).toBe(query)
  expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Source folders' }).value).toBe(rootId)
})

it('keeps a scoped discussion beside the library and stages source changes without creating another Session', async () => {
  const discussion = { open: vi.fn(), setSources: vi.fn() }
  const topic = { workspaceId: 'project' as WorkspaceId, topicId: 'branch' as SourceTopicId, title: 'A direction' }
  const { store, face, props } = await panel({ discussion }, {
    [materialListAddress({ domain: 'knowledge', topic })]: live(page),
  })
  act(() => { store.actions.setScope(topic) })
  expect(screen.queryByRole('textbox', { name: 'Ask about the selected sources' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Discuss selected sources' })).toBeNull()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Use “已有推导” for this question' }))
  expect(discussion.setSources).toHaveBeenLastCalledWith(topic, [{ ref: second.ref }])
  expect(discussion.open).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Discuss selected sources' }))
  expect(discussion.open).toHaveBeenCalledExactlyOnceWith(topic, [{ ref: second.ref }], undefined)
  expect(face.ask).not.toHaveBeenCalled()
  expect(face.openSession).not.toHaveBeenCalled()
  expect(props.renderFactorySlot).toHaveBeenCalledWith('aitp.research.discussion', {
    scope: topic, presentation: 'main', returnTo: face.returnTo,
  })
  fireEvent.click(screen.getByRole('button', { name: /^Selected sources/u }))
  fireEvent.click(screen.getByRole('button', { name: 'Prepare comparison' }))
  expect(discussion.open).toHaveBeenLastCalledWith(topic, [{ ref: second.ref }], 'Compare these conventions.')
  fireEvent.click(screen.getByRole('button', { name: 'Remove “已有推导” from this question' }))
  expect(discussion.setSources).toHaveBeenLastCalledWith(topic, [])
  act(() => { store.actions.setScope({}) })
  expect(screen.queryByRole('textbox', { name: 'Ask about the selected sources' })).toBeNull()
})

it('discusses the visible physical PDF page explicitly while preserving whole-source selection', () => {
  const onDiscuss = vi.fn(), onSelect = vi.fn()
  const reading: ResourceReading = { resource: first, body: { kind: 'pdf', pageCount: 2,
    pages: [{ page: 1, text: 'The source opening.' }, { page: 2, text: 'The selected result.' }],
  }, observedAt: 'now', issues: [] }
  render(<MaterialReader {...readerProps({ reading, fields: [], onLink: vi.fn(() => true), onDiscuss, onSelect })} />)
  fireEvent.click(screen.getByRole('button', { name: 'Next PDF page' }))
  expect(onDiscuss).not.toHaveBeenCalled()
  expect(onSelect).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this page' }))
  expect(onDiscuss).toHaveBeenCalledExactlyOnceWith({ ref: first.ref, locator: { kind: 'pdf-page', page: 2 } })
  fireEvent.click(screen.getByRole('button', { name: 'Use this source' }))
  expect(onSelect).toHaveBeenCalledExactlyOnceWith({ ref: first.ref })
})

it('uses the opened source as current context without replacing an explicitly staged source set', async () => {
  const discussion = { open: vi.fn(), setSources: vi.fn() }
  const topic = { workspaceId: 'project' as WorkspaceId, topicId: 'branch' as SourceTopicId }
  const { store } = await panel({ discussion }, { [materialListAddress({ domain: 'knowledge', topic })]: live(page) })
  act(() => { store.actions.setScope(topic) })
  fireEvent.click(screen.getByRole('button', { name: '已有推导' }))
  expect(discussion.setSources).toHaveBeenCalledExactlyOnceWith(topic, [{ ref: second.ref }])
  expect(store.getSnapshot().drafts[materialsScopeKey(topic)]?.selections ?? []).toEqual([])
  expect(discussion.open).not.toHaveBeenCalled()
  expect(screen.getByRole('textbox', { name: 'Search this library' })).toBeDefined()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Use “文献中的归一化” for this question' }))
  expect(discussion.setSources).toHaveBeenLastCalledWith(topic, [{ ref: first.ref }])
  fireEvent.click(screen.getByRole('button', { name: '已有推导' }))
  expect(discussion.setSources).toHaveBeenCalledTimes(2)
  expect(store.getSnapshot().drafts[materialsScopeKey(topic)]?.selections.map(selection => selection.ref)).toEqual([first.ref])
})

it('shows authored association text without duplicate descriptions or turning its relative Markdown reference into a browser link', async () => {
  await panel({}, { [materialListAddress({ domain: 'knowledge' })]: live({ ...page, items: [{ ...second, description: second.title,
    topics: [{ workspaceId: 'project' as WorkspaceId, topicId: 'branch' as SourceTopicId, reason: 'See [control](../private.md) under **A**.' }],
  }] }) })
  expect(screen.getAllByText(second.title)).toHaveLength(1)
  expect(screen.getByText('See control under A.')).toBeDefined()
  expect(screen.queryByRole('link', { name: 'control' })).toBeNull()
})

it('retains an uncertain question in its original scope after the researcher switches topics', async () => {
  let settle!: (result: Awaited<ReturnType<MaterialsPanelFace['ask']>>) => void
  const ask = vi.fn<MaterialsPanelFace['ask']>(() => new Promise((resolve) => { settle = resolve }))
  const { store, face } = await panel({ ask })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Use “已有推导” for this question' }))
  fireEvent.click(screen.getByRole('button', { name: /^Selected sources/u }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Ask about the selected sources' }), { target: { value: '原先的问题' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask in a new conversation' }))
  const topic = { workspaceId: 'project' as WorkspaceId, topicId: 'branch' as SourceTopicId, title: '另一方向' }
  act(() => { store.actions.setScope(topic) })
  act(() => { store.actions.question('新的问题') })
  await act(async () => { settle({ ok: false, error: { code: 'unavailable', message: 'Connection ended', retryable: true } }) })
  expect(store.getSnapshot().drafts[materialsScopeKey({})]).toMatchObject({ question: '原先的问题', failure: 'Connection ended', sending: false })
  expect(store.getSnapshot().drafts[materialsScopeKey(topic)]).toMatchObject({ question: '新的问题', failure: null })
  expect(face.openSession).not.toHaveBeenCalled()
})

it('shows missing connection and partial coverage instead of manufacturing an empty complete library', async () => {
  await panel({}, {})
  expect(screen.getByRole('alert').textContent).toContain('not connected')
  cleanup()
  await panel({}, { [materialListAddress({ domain: 'knowledge' })]: live({ ...page, items: [], completeness: 'partial', issues: [{ reason: 'One configured folder could not be read.' }] }) })
  expect(screen.getByRole('note').textContent).toContain('Only part')
  fireEvent.click(screen.getByText('Reading limits'))
  expect(screen.getByText('One configured folder could not be read.')).toBeDefined()
})

it('selects exact Chinese source text without treating rendered Markdown as the raw source', async () => {
  const onSelect = vi.fn()
  const reading: ResourceReading = { resource: second, body: { kind: 'text', format: 'markdown', text: '# 结论\n\n只在**有限系统**下成立。' }, observedAt: 'now', issues: [] }
  await renderReader({ reading, fields: [], onLink: vi.fn(() => true), onSelect })
  expect(screen.queryByRole('button', { name: 'Use selected passage' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Source text' }))
  const raw = screen.getByText(/只在\*\*有限系统\*\*下成立。/)
  expect(raw.textContent).toBe(reading.body.kind === 'text' ? reading.body.text : '')
  const range = document.createRange()
  range.setStart(raw.firstChild!, 6)
  range.setEnd(raw.firstChild!, raw.textContent.length)
  document.getSelection()!.addRange(range)
  fireEvent.click(screen.getByRole('button', { name: 'Use selected passage' }))
  const quote = '只在**有限系统**下成立。'
  expect(onSelect).toHaveBeenCalledExactlyOnceWith({ ref: second.ref, locator: { kind: 'text', start: 6, end: 6 + quote.length, quote }, selectedText: quote })
})

it('opens authored inline links only through observed source links and leaves unobserved destinations inert', async () => {
  const link = { label: 'Local source', href: 'paper.md', target: first.ref }
  const onLink = vi.fn(() => true)
  const reading: ResourceReading = { resource: { ...second, links: [link] },
    body: { kind: 'text', format: 'markdown', text: '[Local source](paper.md) and [Unknown source](missing.md)' }, observedAt: 'now', issues: [] }
  await renderReader({ reading, fields: [], onLink })
  const inline = screen.getAllByRole('button', { name: 'Local source' }).at(0)
  if (inline === undefined) throw new Error('The authored link must be actionable.')
  fireEvent.click(inline)
  expect(onLink).toHaveBeenCalledExactlyOnceWith(link)
  expect(screen.queryByRole('button', { name: 'Unknown source' })).toBeNull()
  expect(screen.getByText(/Unknown source/u)).toBeDefined()
  expect(onLink).toHaveBeenCalledOnce()
})

it('keeps Markdown metadata out of the prose while preserving every field and exact source-selection offsets', async () => {
  const onSelect = vi.fn()
  const metadata = 'support: source\r\nreview: awaiting review\r\ncustom: author-only'
  const quote = '只在**有限系统**下成立。'
  const text = `\uFEFF---\r\n${metadata}\r\n---\r\n# 结论\r\n\r\n${quote}`
  const reading: ResourceReading = { resource: second, body: { kind: 'text', format: 'markdown', text }, observedAt: 'now', issues: [] }
  const view = await renderReader({ reading, fields: [{ key: 'review', label: 'Review' }], onLink: vi.fn(() => true), onSelect })
  expect(screen.getByText('awaiting review')).toBeDefined()
  expect(screen.getByRole('heading', { name: '结论' })).toBeDefined()
  expect(view.container.querySelector('section')?.textContent).not.toContain('support:')
  const details = screen.getByText('Recorded source details').closest('details')!
  expect(details.open).toBe(false)
  expect(details.querySelector('pre')?.textContent).toBe(metadata)
  expect(onSelect).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Use this source' }))
  expect(onSelect).toHaveBeenCalledExactlyOnceWith({ ref: second.ref })
  fireEvent.click(screen.getByRole('button', { name: 'Source text' }))
  const raw = view.container.querySelector('section pre')!
  expect(raw.textContent).toBe(text)
  const start = text.indexOf(quote)
  const range = document.createRange()
  range.setStart(raw.firstChild!, start)
  range.setEnd(raw.firstChild!, text.length)
  document.getSelection()!.addRange(range)
  fireEvent.click(screen.getByRole('button', { name: 'Use selected passage' }))
  expect(onSelect).toHaveBeenNthCalledWith(2, {
    ref: second.ref, locator: { kind: 'text', start, end: text.length, quote }, selectedText: quote,
  })
})

it.each([
  ['invalid YAML', '---\ntitle: [broken\n---\n# Body', 'title: [broken'],
  ['a non-mapping', '---\n- author note\n---\n# Body', '- author note'],
  ['an unclosed block', '---\ntitle: unclosed\n# Body', 'title: unclosed'],
])('keeps %s visible instead of silently hiding it as metadata', async (_label, text, expected) => {
  const reading: ResourceReading = { resource: second, body: { kind: 'text', format: 'markdown', text },
    observedAt: 'now', issues: ['The original source remains available.'] }
  const view = await renderReader({ reading, fields: [], onLink: vi.fn(() => true) })
  expect(view.container.querySelector('section')?.textContent).toContain(expected)
  expect(screen.queryByText('Recorded source details')).toBeNull()
  expect(screen.getByText('The original source remains available.')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Source text' }))
  expect(view.container.querySelector('section pre')?.textContent).toBe(text)
})

it('opens native source details without replacing the searchable catalogue or submitting a question', async () => {
  const { face, store } = await panel()
  fireEvent.click(screen.getByRole('button', { name: '已有推导' }))
  expect(face.preview).toHaveBeenCalledExactlyOnceWith({ ref: second.ref }, {})
  expect(screen.getByRole('textbox', { name: 'Search this library' })).toBeDefined()
  expect(screen.getByRole('button', { name: '文献中的归一化' })).toBeDefined()
  expect(store.getSnapshot().views.knowledge.location).toEqual({ kind: 'list' })
  expect(face.ask).not.toHaveBeenCalled()
  expect(face.openSession).not.toHaveBeenCalled()
})

it('keeps a retained PDF position within the currently observed page count', () => {
  const reading: ResourceReading = { resource: first, body: { kind: 'pdf', pageCount: 1,
    pages: [{ page: 1, text: 'Current shorter edition.' }],
  }, observedAt: 'now', issues: [] }
  const onChange = vi.fn()
  render(<MaterialReader {...readerProps({ reading, fields: [], onLink: vi.fn(() => true), pdfPosition: { page: 4, onChange } })} />)
  expect(screen.getByText('PDF page 1 of 1')).toBeDefined()
  expect(screen.getByText('Current shorter edition.')).toBeDefined()
  expect(screen.getByRole('alert').textContent).toContain('The PDF could not be opened.')
  expect(screen.getByRole('button', { name: 'Previous PDF page' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Next PDF page' }).hasAttribute('disabled')).toBe(true)
  expect(onChange).not.toHaveBeenCalled()
})

it('retains an unknown save request and checks the exact operation instead of creating a duplicate set', async () => {
  const save = vi.fn<NonNullable<MaterialsPanelFace['management']>['save']>()
    .mockResolvedValueOnce({ ok: false, error: { code: 'outcome-unknown', message: 'Acknowledgement lost', retryable: false } })
    .mockResolvedValueOnce({ ok: false, error: { code: 'permission-denied', message: 'Owner temporarily unavailable', retryable: false } })
    .mockImplementation(async request => ({ ok: true, value: { operationId: request.operationId, id: 'saved-set' as SourceSetId, state: 'saved', committedAt: 'now' } }))
  const management = { save, connect: vi.fn(), disconnect: vi.fn(), load: vi.fn() }
  const { store, face } = await panel({ management }, {
    [MATERIAL_SETUP]: live({ canConnect: false, canSaveSourceSets: true }),
    [materialListAddress({ domain: 'knowledge' })]: live(page),
  })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Use “已有推导” for this question' }))
  fireEvent.click(screen.getByRole('button', { name: /^Selected sources/u }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Source-set name' }), { target: { value: '归一化比较' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save source set' }))
  await waitFor(() => { expect(screen.getByText(/The save result is unknown/)).toBeDefined() })
  const request: SaveSourceSetRequest = save.mock.calls[0]![0]
  expect(request).toMatchObject({ title: '归一化比较', selections: [{ ref: second.ref }] })
  expect(request.topics).toEqual([])
  expect(screen.getByRole('checkbox', { name: 'Use “已有推导” for this question' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('textbox', { name: 'Source-set name' }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Check save result' }))
  await waitFor(() => { expect(screen.getByText('Owner temporarily unavailable')).toBeDefined() })
  expect(screen.getByRole('textbox', { name: 'Source-set name' }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Check save result' }))
  await waitFor(() => { expect(screen.getByText('Source set saved in this app.')).toBeDefined() })
  expect(save.mock.calls[1]![0]).toEqual(request)
  expect(save.mock.calls[2]![0]).toEqual(request)
  expect(face.ask).not.toHaveBeenCalled()
  expect(store.getSnapshot().drafts[materialsScopeKey({})]).toMatchObject({ sourceSetId: 'saved-set', pendingSave: null, saving: false })
})

it('reopens cross-library saved references without changing the question scope to a source owner', async () => {
  const topic = { workspaceId: 'project' as WorkspaceId, topicId: 'branch' as SourceTopicId }
  const id = 'cross-library' as SourceSetId
  const sourceSet = { id, title: '跨库研读', selectionCount: 1, topics: [topic], selections: [{ ref: first.ref }], createdAt: 'then', updatedAt: 'now' }
  const management = { save: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), load: vi.fn(async () => ({ ok: true as const,
    value: { sourceSet, selections: [{ ref: first.ref, title: first.title, domain: 'literature' as const, unavailable: 'Original file moved' }] } })) }
  const { store } = await panel({ management }, {
    [MATERIAL_SETUP]: live({ canConnect: false, canSaveSourceSets: true }),
    [materialSourceSetsAddress({})]: live({ items: [sourceSet], nextCursor: null }),
    [materialListAddress({ domain: 'knowledge' })]: live(page),
  })
  fireEvent.click(screen.getByText('Source sets and folders'))
  fireEvent.click(screen.getByRole('button', { name: '跨库研读' }))
  await waitFor(() => { expect(store.getSnapshot().drafts[materialsScopeKey({})]?.sourceSetId).toBe(id) })
  expect(store.getSnapshot().scope).toEqual({})
  expect(store.getSnapshot().drafts[materialsScopeKey({})]?.sourceSetTopics).toEqual([topic])
  expect(store.getSnapshot().drafts[materialsScopeKey({})]?.selections[0]).toMatchObject({ ref: first.ref, domain: 'literature', unavailable: 'Original file moved' })
  expect(screen.getByText(/Original file moved/)).toBeDefined()
})

async function loadingSourceSet() {
  const topic = { workspaceId: 'project' as WorkspaceId, topicId: 'branch' as SourceTopicId }
  const other = { ...topic, topicId: 'another-branch' as SourceTopicId }
  const selection: SourceSelection = { ref: second.ref, locator: { kind: 'text', start: 0, end: 5, quote: 'Proof' }, selectedText: 'Proof' }
  const sourceSet = { id: 'saved-b' as SourceSetId, title: 'Saved collection B', selectionCount: 1,
    topics: [other], selections: [selection], createdAt: 'then', updatedAt: 'now' }
  const result = { ok: true as const, value: { sourceSet,
    selections: [{ ...selection, title: second.title, domain: second.domain }] } }
  const reply = Promise.withResolvers<Awaited<ReturnType<MaterialsManagementFace['load']>>>()
  const management: MaterialsManagementFace = { save: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), load: vi.fn(() => reply.promise) }
  const discussion = { open: vi.fn(), setSources: vi.fn() }
  const fixture = await panel({ management, discussion }, {
    [MATERIAL_SETUP]: live({ canConnect: false, canSaveSourceSets: true }),
    [materialSourceSetsAddress({ topic })]: live({ items: [sourceSet], nextCursor: null }),
    [materialListAddress({ domain: 'knowledge', topic })]: live(page),
    [materialListAddress({ domain: 'knowledge', topic: other })]: live(page),
  })
  act(() => { fixture.store.actions.setScope(topic) })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Use “文献中的归一化” for this question' }))
  expect(discussion.setSources).toHaveBeenLastCalledWith(topic, [{ ref: first.ref }])
  fireEvent.click(screen.getByText('Source sets and folders'))
  fireEvent.click(screen.getByRole('button', { name: sourceSet.title }))
  expect(management.load).toHaveBeenCalledExactlyOnceWith(sourceSet.id)
  discussion.setSources.mockClear()
  const finish = async () => { await act(async () => { reply.resolve(result); await reply.promise }) }
  return { ...fixture, topic, other, selection, sourceSet, discussion, finish }
}

it('replaces the next discussion sources when the saved collection finishes loading without another Discuss click', async () => {
  const fixture = await loadingSourceSet()
  await fixture.finish()
  expect(fixture.store.getSnapshot().drafts[materialsScopeKey(fixture.topic)]).toMatchObject({
    sourceSetId: fixture.sourceSet.id, selections: [{ ...fixture.selection, title: second.title, domain: second.domain }],
  })
  expect(fixture.discussion.setSources).toHaveBeenCalledExactlyOnceWith(fixture.topic, [fixture.selection])
  expect(fixture.discussion.open).not.toHaveBeenCalled()
  expect(fixture.face.ask).not.toHaveBeenCalled()
})

it('finishes in the captured topic without changing the sources chosen in another topic', async () => {
  const fixture = await loadingSourceSet()
  act(() => { fixture.store.actions.setScope(fixture.other) })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Use “文献中的归一化” for this question' }))
  fixture.discussion.setSources.mockClear()
  await fixture.finish()
  expect(fixture.store.getSnapshot().scope).toEqual(fixture.other)
  expect(fixture.store.getSnapshot().drafts[materialsScopeKey(fixture.other)]?.selections.map(item => item.ref)).toEqual([first.ref])
  expect(fixture.discussion.setSources).toHaveBeenCalledExactlyOnceWith(fixture.topic, [fixture.selection])
})

it('keeps an edited question while the selected saved collection loads', async () => {
  const fixture = await loadingSourceSet()
  act(() => { fixture.store.actions.question('Keep the question being prepared.') })
  await fixture.finish()
  expect(fixture.store.getSnapshot().drafts[materialsScopeKey(fixture.topic)]).toMatchObject({
    sourceSetId: fixture.sourceSet.id, question: 'Keep the question being prepared.',
  })
  expect(fixture.discussion.setSources).toHaveBeenCalledExactlyOnceWith(fixture.topic, [fixture.selection])
})

it.each(['selection', 'title', 'topic', 'pending-save', 'sending'] as const)('does not replace a newer %s action with a late source-set load', async (change) => {
  const fixture = await loadingSourceSet()
  const key = materialsScopeKey(fixture.topic)
  if (change === 'selection') fireEvent.click(screen.getByRole('checkbox', { name: 'Use “已有推导” for this question' }))
  else act(() => {
    if (change === 'title') fixture.store.actions.sourceSetTitle('A newer collection title')
    else if (change === 'topic') fixture.store.actions.sourceSetTopic(fixture.other, true)
    else if (change === 'sending') fixture.store.actions.sending(key, true)
    else fixture.store.actions.pendingSave(key, { operationId: 'save-a', title: 'Keep A', selections: [{ ref: first.ref }] }, true)
  })
  const current = fixture.store.getSnapshot().drafts[key]
  fixture.discussion.setSources.mockClear()
  await fixture.finish()
  expect(fixture.store.getSnapshot().drafts[key]).toEqual(current)
  expect(fixture.discussion.setSources).not.toHaveBeenCalled()
})

it('explains a slow first source read and reports a failed source watcher without hiding content', async () => {
  const { MaterialUnavailable } = await import('../src/client/MaterialsPanel.tsx')
  const { MATERIAL_WATCH_UNAVAILABLE } = await import('@deepseek-ai/dsh-research-resources/protocol')
  const loading: ResourceSnapshot<never> = { status: 'loading', value: undefined, failure: undefined }
  const view = render(<MaterialUnavailable t={t} refresh={vi.fn()} snapshot={loading} />)
  expect(screen.getByRole('status').textContent).toContain(en.loadingSource)
  view.unmount()
  const reading: ResourceReading = { resource: first, body: { kind: 'text', format: 'plain-text', text: 'Still readable' },
    issues: [MATERIAL_WATCH_UNAVAILABLE], observedAt: 'now' }
  const props = readerProps({ reading, presentation: 'dock', fields: [], onLink: vi.fn(() => true) })
  props.renderFactorySlot = (() => <pre>Still readable</pre>) as typeof props.renderFactorySlot
  render(<MaterialReader {...props} />)
  expect(screen.getByRole('status').textContent).toContain(en.watchUnavailable)
  expect(screen.getByText('Still readable')).toBeTruthy()
})

it('shows the available code roots without requesting a whole-code catalog on first entry', async () => {
  const roots = [{ id: 'repo' as SourceRootId, title: 'LibRPA', displayPath: '/repo', domains: ['code'] as const }]
  const view = await panel({ domain: 'code', panelId: 'aitp-code' as MaterialsPanelFace['panelId'] }, {
    [MATERIAL_ROOTS]: live(roots),
  })
  expect(view.props.useResource).not.toHaveBeenCalledWith(materialListAddress({ domain: 'code' }))
  expect(view.props.renderFactorySlot).toHaveBeenCalledWith('aitp.materials.catalog', expect.objectContaining({ domain: 'code', items: [], roots }))
})
