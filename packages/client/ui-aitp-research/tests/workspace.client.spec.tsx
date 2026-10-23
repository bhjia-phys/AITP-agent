// @vitest-environment jsdom
/** User paths over adapter snapshots; backend and transport semantics have their own suites. */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { en } from '../src/client/locales.ts'
import { ResearchPanel, type ResearchPanelFace, type ResearchPanelProps } from '../src/client/ResearchPanel.tsx'
import { createResearchPanelStore } from '../src/client/store.ts'
import { workspaceEditKey } from '../src/client/workspace-edit-state.ts'
import type { ApplyReceipt, ChangePreview, Project, ReadEnvelope, ResearchProvider, Resource, ResourceId, Result, Revision, Topic, TopicId, TopicPage, WorkspaceRead } from '../src/client/workspace-contract.ts'
import { workspaceActivityAddress, workspaceProjectAddress, workspaceResourceAddress, workspaceTopicAddress, workspaceTopicsAddress } from '../src/client/workspace-resources.ts'

afterEach(cleanup)

const t = makeTranslate(en) as TranslateNS<'aitp.research'>
const WS = 'w1' as WorkspaceId
const ROOT = 'root' as TopicId
const CHILD = 'child' as TopicId
const NOTE = 'note' as ResourceId
const PDF = 'paper' as ResourceId
const REVISION = 'r1' as Revision
const provider: ResearchProvider = {
  id: 'test', origin: 'fixture', capabilities: {
    read: true, readContext: false, readActivity: true, previewChanges: true, applyChanges: true, changeEvents: true,
    commands: ['update-scope', 'record-answer'],
  },
}
const attribution = { sourceResourceIds: [] }
const project: Project = { id: 'project', title: 'Research programme', directions: [{ id: 'd', title: 'Theory' }], seeds: [] }
const root: Topic = {
  id: ROOT, title: 'Main question', parentId: null, childIds: [CHILD], currentAnswer: { text: 'A conditional result.', qualification: 'Only under assumption A.', attribution },
  gap: 'Large systems remain open.', work: { state: 'active', label: 'Active', nextAction: 'Compare a control.' }, resourceCount: 1,
  question: 'What changes with system size?', scope: 'Finite systems.', workItems: [], statements: [], resources: [],
}
const child: Topic = {
  ...root, id: CHILD, title: 'Controlled limit', parentId: ROOT, childIds: [], currentAnswer: { text: 'The small-system result.', qualification: 'This is not a large-system conclusion.', attribution },
  gap: 'A matched comparison is still missing.', work: { state: 'waiting-on-analysis', label: 'Awaiting analysis', nextAction: 'Read the control.' },
  resources: [
    { id: NOTE, ownerTopicId: CHILD, title: 'Control calculation', kind: 'note', target: { kind: 'workspace-path', path: 'notes/control.md' } },
    { id: PDF, ownerTopicId: CHILD, title: 'Reference paper', kind: 'paper', target: { kind: 'uri', uri: 'https://example.org/paper.pdf' } },
  ], accountResourceId: NOTE,
}
const note: Resource = { ...child.resources[0]!, content: { kind: 'markdown', text: '# Full control\n\nThe full argument keeps assumption A.' }, attribution }
const paper: Resource = { ...child.resources[1]!, content: { kind: 'unavailable', reason: 'unsupported-format', detail: 'PDF reader is not connected.' }, attribution }
const read = <T,>(value: T): WorkspaceRead<T> => ({ origin: 'fixture', revision: REVISION, observedAt: '2026-10-23T12:00:00Z', value, provider })
const live = <T,>(value: T): ResourceSnapshot<T> => ({ status: 'live', value, failure: undefined })
const none: ResourceSnapshot<never> = { status: 'none', value: undefined, failure: undefined }
const page = (...topics: Topic[]): TopicPage => ({ items: topics.map(read), nextCursor: null, completeness: 'complete' })

function resources(): Record<string, ResourceSnapshot<unknown>> {
  return {
    [workspaceProjectAddress(WS)]: live(read(project)),
    [workspaceTopicsAddress(WS, { parentId: null })]: live(read(page(root))),
    [workspaceTopicsAddress(WS, { parentId: ROOT })]: live(read(page(child))),
    [workspaceTopicsAddress(WS, { parentId: CHILD })]: live(read(page())),
    [workspaceTopicAddress(WS, ROOT)]: live(read(root)),
    [workspaceTopicAddress(WS, CHILD)]: live(read(child)),
    [workspaceResourceAddress(WS, NOTE)]: live(read(note)),
    [workspaceResourceAddress(WS, PDF)]: live(read(paper)),
    [workspaceActivityAddress(WS, CHILD)]: live(read({ items: [], completeness: 'complete', nextCursor: null })),
  }
}

function panel(values = resources(), overrides: Partial<ResearchPanelFace> = {}, workspaces: WorkspaceView[] = [{ workspaceId: WS, path: '/scratch/research', title: 'Workspace', sessionIds: [], createdAt: '', updatedAt: '' }]) {
  const store = createResearchPanelStore().create()
  const face: ResearchPanelFace = {
    openSession: vi.fn(), startDraft: vi.fn(), retry: vi.fn(),
    previewChange: vi.fn<ResearchPanelFace['previewChange']>(async () => ({
      ok: false, error: { code: 'unsupported', message: 'Unavailable.', retryable: false },
    })),
    applyChange: vi.fn<ResearchPanelFace['applyChange']>(async () => ({
      ok: false, error: { code: 'unsupported', message: 'Unavailable.', retryable: false },
    })),
    ...overrides,
  }
  const props = {
    t, useWorkspaces: (select: (value: { items: WorkspaceView[] }) => unknown) => select({ items: workspaces }),
    useResource: (address: string) => values[address] ?? none,
    useStore: bindSnapshotSelector(store), actions: store.actions, ...face,
  } as ResearchPanelProps
  let view = render(<ResearchPanel {...props} />)
  return {
    store, face, rerender: () => { view.rerender(<ResearchPanel {...props} />) },
    leavePanel: () => { view.unmount() },
    returnToPanel: () => { view = render(<ResearchPanel {...props} />) },
  }
}

function openChild(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Controlled limit' }))
}

const preview: ChangePreview = {
  previewId: 'preview-1', summary: 'Update scope', bases: [{ target: { kind: 'topic', id: CHILD }, revision: REVISION }],
  edits: [{ target: { kind: 'topic', id: CHILD }, label: 'Scope', before: 'Finite systems.', after: 'Matched finite systems.' }], pendingIntegration: [],
}

describe('workspace reading and navigation', () => {
  it('shows qualified root cards, direct child links and the child-owned next step', () => {
    panel()
    expect(screen.getByRole('heading', { name: 'Research programme' })).toBeDefined()
    expect(screen.getByText('Only under assumption A.')).toBeDefined()
    expect(screen.getByText('Demo workspace')).toBeDefined()
    openChild()
    expect(screen.getByRole('heading', { name: 'Controlled limit' })).toBeDefined()
    expect(screen.getByText('The small-system result.')).toBeDefined()
    expect(screen.getByText('This is not a large-system conclusion.')).toBeDefined()
    expect(screen.getByText('Read the control.')).toBeDefined()
    expect(screen.queryByText('Compare a control.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Main question' }))
    expect(screen.getByRole('heading', { name: 'Main question' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Controlled limit' })).toBeDefined()
  })

  it('opens a material and returns to the selected tab and topic', () => {
    const { store } = panel()
    openChild()
    fireEvent.click(screen.getByRole('tab', { name: 'Materials' }))
    fireEvent.click(screen.getByRole('button', { name: /Control calculation/ }))
    expect(screen.getByRole('heading', { name: 'Full control' })).toBeDefined()
    expect(screen.getByText('The full argument keeps assumption A.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('tab', { name: 'Materials' }).getAttribute('aria-selected')).toBe('true')
    expect(store.getSnapshot().location).toEqual({ kind: 'topic', topicId: CHILD, tab: 'materials' })
    fireEvent.click(screen.getByRole('button', { name: /Reference paper/ }))
    expect(screen.getByText('Content is not available in this reader')).toBeDefined()
    expect(screen.getByText('PDF reader is not connected.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Project overview' }))
    expect(screen.getByRole('heading', { name: 'Research programme' })).toBeDefined()
  })

  it('moves through topic tabs by keyboard and reports missing activity honestly', () => {
    panel()
    openChild()
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Overview' }), { key: 'End' })
    expect(screen.getByRole('tab', { name: 'Activity' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('No activity is recorded for this topic.')).toBeDefined()
  })

  it('shows loading, no connection and no Workspace without inventing topics', () => {
    panel({})
    expect(screen.getByText('Research workspace is not connected')).toBeDefined()
    cleanup()
    panel({ [workspaceProjectAddress(WS)]: { status: 'loading', value: undefined, failure: undefined } })
    expect(screen.getByRole('status', { name: 'Loading' })).toBeDefined()
    cleanup()
    panel({}, {}, [])
    expect(screen.getByText('No Workspace yet')).toBeDefined()
  })

  it.each([
    ['not-connected', 'Research workspace is not connected', 'Connect a research data provider to browse topics and materials here.'],
    ['not-found', 'This item is no longer available', 'It may have been moved or removed. Return to its topic or read again.'],
    ['unsupported', 'This view is not supported by this connection', 'The connected provider does not offer this kind of reading yet.'],
    ['permission-denied', 'Access to this content is denied', 'The current connection does not have permission to read this item.'],
  ] as const)('localizes a typed %s read failure instead of showing transport text', (code, title, body) => {
    panel({ [workspaceProjectAddress(WS)]: {
      status: 'failed', value: undefined,
      failure: new RemoteError('aitp/workspace', 'Internal transport diagnostic.', { code, message: 'Internal transport diagnostic.', retryable: false }),
    } })
    expect(screen.getByText(title)).toBeDefined()
    expect(screen.getByText(body)).toBeDefined()
    expect(screen.queryByText('Internal transport diagnostic.')).toBeNull()
  })

  it('distinguishes a missing material from a linked material that has no reader', () => {
    const values = resources()
    values[workspaceResourceAddress(WS, NOTE)] = {
      status: 'failed', value: undefined,
      failure: new RemoteError('aitp/workspace', 'Missing.', { code: 'not-found', message: 'Missing.', retryable: false }),
    }
    panel(values)
    openChild()
    fireEvent.click(screen.getByRole('button', { name: 'Read full account' }))
    expect(screen.getByText('This item is no longer available')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Materials' }))
    fireEvent.click(screen.getByRole('button', { name: /Reference paper/ }))
    expect(screen.getByText('Content is not available in this reader')).toBeDefined()
    expect(screen.getByText('PDF reader is not connected.')).toBeDefined()
  })

  it('keeps the old observation beside a refresh failure and offers a retry', () => {
    const values = resources()
    values[workspaceProjectAddress(WS)] = { status: 'failed', value: read(project), failure: new RemoteError('aitp/workspace', 'Connection lost.', { code: 'not-connected', message: 'Connection lost.', retryable: true }) }
    const { face } = panel(values)
    expect(screen.getByText(/Showing the last reading/)).toBeDefined()
    expect(screen.getByText(/^Read /, { selector: 'p' })).toBeDefined()
    expect(screen.queryByText(/revision r1/)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Research programme' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Read again' }))
    expect(face.retry).toHaveBeenCalledWith(WS)
  })

  it('offers explicit pagination when the topic list has another page', () => {
    const values = resources()
    values[workspaceTopicsAddress(WS, { parentId: null })] = live(read({ items: [read(root)], nextCursor: 'next', completeness: 'partial' }))
    values[workspaceTopicsAddress(WS, { parentId: null, cursor: 'next' })] = live(read(page({ ...child, id: 'other' as TopicId, title: 'Another root', parentId: null })))
    panel(values)
    expect(screen.queryByRole('button', { name: 'Another root' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(screen.getByRole('button', { name: 'Another root' })).toBeDefined()
  })
})

describe('workspace edit feedback', () => {
  it('previews the revision-bound intent before applying, then labels the fixture acknowledgement', async () => {
    const previewChange = vi.fn<ResearchPanelFace['previewChange']>(async () => ({ ok: true, value: read(preview) }))
    const applyChange = vi.fn<ResearchPanelFace['applyChange']>(async (_workspaceId, request) => ({ ok: true, value: read({ operationId: request.operationId, changeId: 'change', committedAt: '', actor: { id: 'user', kind: 'researcher', label: 'Researcher' }, changed: [] }) }))
    const { face } = panel(resources(), { previewChange, applyChange })
    openChild()
    fireEvent.click(screen.getByRole('button', { name: 'Edit scope' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Scope' }), { target: { value: 'Matched finite systems.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    await screen.findByText('Proposed version')
    expect(previewChange).toHaveBeenCalledWith(WS, { topicId: CHILD, expectedRevision: REVISION, command: { kind: 'update-scope', scope: 'Matched finite systems.' } })
    expect(applyChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Apply change' }))
    await screen.findByText('Change applied to demo data. Research files are unchanged.')
    expect(applyChange.mock.calls[0]?.[0]).toBe(WS)
    expect(applyChange.mock.calls[0]?.[1].previewId).toBe('preview-1')
    expect(typeof applyChange.mock.calls[0]?.[1].operationId).toBe('string')
    expect(face.retry).toHaveBeenCalledWith(WS)
  })

  it('keeps the answer and its limits together in the requested change', async () => {
    const previewChange = vi.fn<ResearchPanelFace['previewChange']>(async () => ({ ok: true, value: read(preview) }))
    panel(resources(), { previewChange })
    openChild()
    fireEvent.click(screen.getByRole('button', { name: 'Update understanding' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Answer' }), { target: { value: 'Updated answer.' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Conditions and limitations' }), { target: { value: 'Only at fixed size.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    await screen.findByText('Proposed version')
    expect(previewChange).toHaveBeenCalledWith(WS, expect.objectContaining({ command: { kind: 'record-answer', text: 'Updated answer.', qualification: 'Only at fixed size.', sourceResourceIds: [] } }))
  })

  it('retains a conflicting draft and prepares it against the newly read revision', async () => {
    const previewChange = vi.fn<ResearchPanelFace['previewChange']>().mockResolvedValueOnce({ ok: false, error: { code: 'revision-conflict', message: 'Changed elsewhere.', current: [] } }).mockResolvedValue({ ok: true, value: read(preview) })
    const values = resources()
    const { rerender } = panel(values, { previewChange })
    openChild()
    fireEvent.click(screen.getByRole('button', { name: 'Edit scope' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Scope' }), { target: { value: 'My retained draft.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    await screen.findByRole('alert')
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Scope' }).value).toBe('My retained draft.')
    values[workspaceTopicAddress(WS, CHILD)] = live({ ...read({ ...child, scope: 'New external scope.' }), revision: 'r2' as Revision })
    act(rerender)
    expect(within(screen.getByRole('alert')).getByText('New external scope.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Use this version as the draft base' }))
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    await screen.findByText('Proposed version')
    expect(previewChange).toHaveBeenLastCalledWith(WS, expect.objectContaining({ expectedRevision: 'r2' }))
  })

  it('keeps the original base when an external update arrives while editing', async () => {
    const previewChange = vi.fn<ResearchPanelFace['previewChange']>(async () => ({ ok: false, error: { code: 'revision-conflict', message: 'External change.', current: [] } }))
    const values = resources()
    const { rerender } = panel(values, { previewChange })
    openChild()
    fireEvent.click(screen.getByRole('button', { name: 'Edit scope' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Scope' }), { target: { value: 'My older draft.' } })
    values[workspaceTopicAddress(WS, CHILD)] = live({ ...read({ ...child, scope: 'External replacement.' }), revision: 'r2' as Revision })
    act(rerender)
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    await screen.findByRole('alert')
    expect(previewChange).toHaveBeenCalledWith(WS, expect.objectContaining({ expectedRevision: 'r1', command: { kind: 'update-scope', scope: 'My older draft.' } }))
    expect(screen.getByRole('button', { name: 'Use this version as the draft base' })).toBeDefined()
  })

  it('reuses the same operation after an unknown acknowledgement, without changing the draft', async () => {
    const previewChange = vi.fn<ResearchPanelFace['previewChange']>(async () => ({ ok: true, value: read(preview) }))
    const applyChange = vi.fn<ResearchPanelFace['applyChange']>(async (_workspaceId, request) => ({ ok: false, error: { code: 'outcome-unknown', message: 'Receipt lost.', operationId: request.operationId } }))
    panel(resources(), { previewChange, applyChange })
    openChild()
    fireEvent.click(screen.getByRole('button', { name: 'Edit scope' }))
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    await screen.findByText('Proposed version')
    fireEvent.click(screen.getByRole('button', { name: 'Apply change' }))
    await screen.findByRole('alert')
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Scope' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Retry the same operation' }))
    await waitFor(() => { expect(applyChange).toHaveBeenCalledTimes(2) })
    expect(applyChange.mock.calls[1]).toEqual(applyChange.mock.calls[0])
  })

  it('retains a submitted change before awaiting, and recovers a late unknown result after leaving the panel', async () => {
    let finish = (_result: Result<ReadEnvelope<ApplyReceipt>>): void => { throw new Error('No request was submitted') }
    const previewChange = vi.fn<ResearchPanelFace['previewChange']>(async () => ({ ok: true, value: read(preview) }))
    const applyChange = vi.fn<ResearchPanelFace['applyChange']>()
      .mockImplementationOnce(async () => new Promise((resolve) => { finish = resolve }))
      .mockImplementation(async (_workspaceId, request) => ({ ok: true, value: read({ operationId: request.operationId, changeId: 'recovered', committedAt: '', actor: { id: 'user', kind: 'researcher', label: 'Researcher' }, changed: [] }) }))
    const values = resources()
    const { store, leavePanel, returnToPanel } = panel(values, { previewChange, applyChange })
    openChild()
    fireEvent.click(screen.getByRole('button', { name: 'Edit scope' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Scope' }), { target: { value: 'Retained submitted scope.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    await screen.findByText('Proposed version')
    fireEvent.click(screen.getByRole('button', { name: 'Apply change' }))
    const original = applyChange.mock.calls[0]!
    expect(store.getSnapshot().pendingEdits[workspaceEditKey(WS, CHILD)]).toMatchObject({
      pending: 'apply', text: 'Retained submitted scope.', prepared: { operationId: original[1].operationId },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close for now' }))
    leavePanel()
    await act(async () => { finish({ ok: false, error: { code: 'outcome-unknown', message: 'Late lost receipt.', operationId: original[1].operationId } }) })
    // Recovery remains available even when navigation has released the old topic reading.
    values[workspaceTopicAddress(WS, CHILD)] = none
    returnToPanel()
    expect(screen.getByText(/original request is retained for recovery/)).toBeDefined()
    expect(screen.getByText('Research workspace is not connected')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Resume original change' }))
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Scope' }).value).toBe('Retained submitted scope.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry the same operation' }))
    await screen.findByText('Change applied to demo data. Research files are unchanged.')
    expect(applyChange.mock.calls[1]).toEqual(original)
    expect(previewChange).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot().pendingEdits[workspaceEditKey(WS, CHILD)]?.uncertain).toBe(false)
  })

  it('preserves uncertainty after a disconnected retry and after topic navigation', async () => {
    const previewChange = vi.fn<ResearchPanelFace['previewChange']>(async () => ({ ok: true, value: read(preview) }))
    const applyChange = vi.fn<ResearchPanelFace['applyChange']>()
      .mockImplementationOnce(async (_workspaceId, request) => ({ ok: false, error: { code: 'outcome-unknown', message: 'Receipt lost.', operationId: request.operationId } }))
      .mockResolvedValueOnce({ ok: false, error: { code: 'not-connected', message: 'Still disconnected.', retryable: true } })
      .mockImplementation(async (_workspaceId, request) => ({ ok: true, value: read({ operationId: request.operationId, changeId: 'recovered', committedAt: '', actor: { id: 'user', kind: 'researcher', label: 'Researcher' }, changed: [] }) }))
    const { store } = panel(resources(), { previewChange, applyChange })
    openChild()
    fireEvent.click(screen.getByRole('button', { name: 'Edit scope' }))
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    await screen.findByText('Proposed version')
    fireEvent.click(screen.getByRole('button', { name: 'Apply change' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Retry the same operation' }))
    await screen.findByText('Still disconnected.')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Preview change' }).disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Update understanding' }).disabled).toBe(true)
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Scope' }).disabled).toBe(true)
    expect(store.getSnapshot().pendingEdits[workspaceEditKey(WS, CHILD)]?.uncertain).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Project overview' }))
    openChild()
    expect(screen.getByText(/original request is retained for recovery/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Retry the same operation' }))
    await screen.findByText('Change applied to demo data. Research files are unchanged.')
    expect(applyChange.mock.calls[1]).toEqual(applyChange.mock.calls[0])
    expect(applyChange.mock.calls[2]).toEqual(applyChange.mock.calls[0])
    expect(previewChange).toHaveBeenCalledTimes(1)
  })

  it('disables editing when the provider does not advertise changes', () => {
    const values = resources()
    values[workspaceTopicAddress(WS, CHILD)] = live({
      ...read(child), provider: { ...provider, capabilities: { ...provider.capabilities, previewChanges: false } },
    })
    panel(values)
    openChild()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Edit scope' }).disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Update understanding' }).disabled).toBe(true)
  })
})
