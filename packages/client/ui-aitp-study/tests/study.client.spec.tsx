// @vitest-environment jsdom
/** Saved drafts and model attribution remain distinct from prepared questions and source selection. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { SessionId, SessionSeq } from '@deepseek-ai/dsh-session/types'
import type { SourceId, SourceRootId, SourceSelection } from '@deepseek-ai/dsh-research-resources/types'
import type { StudyArtifact, StudyArtifactId, StudyArtifactVersion } from '@deepseek-ai/dsh-research-study/types'
import { StudyPanel, type StudyFace, type StudyPanelProps } from '../src/client/StudyPanel.tsx'
import { StudyTasks, CaptureAction, type CaptureActionProps, type StudyTasksProps } from '../src/client/StudyActions.tsx'
import { createStudyStore } from '../src/client/store.ts'
import { STUDY_SETUP, studyArtifactAddress, studyListAddress } from '../src/client/resources.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)
const t = makeTranslate(en)
const live = <T,>(value: T): ResourceSnapshot<T> => ({ status: 'live', value, failure: undefined })
const none: ResourceSnapshot<never> = { status: 'none', value: undefined, failure: undefined }
const source: SourceSelection = { ref: { rootId: 'papers' as SourceRootId, sourceId: 'source:paper.pdf' as SourceId }, locator: { kind: 'pdf-page', page: 3 } }
const artifact: StudyArtifact = { id: 'draft-a' as StudyArtifactId, version: 'v1' as StudyArtifactVersion,
  title: 'A conditional answer', kind: 'comparison', status: 'provisional', origin: 'captured-answer', edited: false,
  citationCount: 1, createdAt: 'then', updatedAt: 'now', savedBy: 'host-owner', markdown: 'Only under **A**.',
  citations: [{ selection: source, basis: 'selected' }],
  capture: { sessionId: 'original-session' as SessionId, seq: 42 as SessionSeq, messageId: 'real-message', provider: 'provider', model: 'model', actor: 'model',
    contexts: [{ seq: 10 as SessionSeq, name: 'source material', text: 'Actually recorded excerpt' }] },
}

function panel(values: Record<string, ResourceSnapshot<unknown>> = {}) {
  const store = createStudyStore().create()
  const face: StudyFace = { refresh: vi.fn(), execute: vi.fn(async () => {}), openSession: vi.fn(), openSource: vi.fn(async () => false),
    exportArtifact: vi.fn<StudyFace['exportArtifact']>(async () => ({ ok: false, error: { code: 'unsupported', message: 'Export unavailable', retryable: false } })),
  }
  const read = vi.fn((address: string) => values[address] ?? none)
  const props = { ...face, t, useStore: bindSnapshotSelector(store), actions: store.actions,
    useResource: read } as StudyPanelProps
  render(<StudyPanel {...props} />)
  return { store, face, read }
}

it('submits a handwritten note with human-linked references and no fabricated captured-answer identity', () => {
  const { store, face } = panel({ [STUDY_SETUP]: live({ canSave: true, canCapture: true, asSources: true }) })
  act(() => { store.actions.create([source]) })
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: '读到的前提' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Note text (Markdown)' }), { target: { value: '只在 A 的前提下成立，仍需核对推导。' } })
  expect(face.execute).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
  const operation = vi.mocked(face.execute).mock.calls[0]?.[0]
  expect(operation).toMatchObject({ kind: 'save', request: {
    title: '读到的前提', kind: 'note', markdown: '只在 A 的前提下成立，仍需核对推导。', citations: [source],
  } })
  expect(operation?.request.operationId).toEqual(expect.any(String))
})

it('captures only real answer coordinates, leaving the original text and attribution to the Host', () => {
  const { store, face } = panel({ [STUDY_SETUP]: live({ canSave: true, canCapture: true, asSources: true }) })
  act(() => { store.actions.capture('original-session' as SessionId, 42 as SessionSeq, 'Selected answer') })
  expect(screen.queryByRole('textbox', { name: 'Note text (Markdown)' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Capture selected answer' }))
  const operation = vi.mocked(face.execute).mock.calls[0]?.[0]
  expect(operation).toMatchObject({ kind: 'capture', request: {
    title: 'Selected answer', kind: 'note', sessionId: 'original-session', seq: 42,
  } })
  expect(operation?.request.operationId).toEqual(expect.any(String))
  expect(operation?.request).not.toHaveProperty('markdown')
})

it('keeps selected-source attribution distinct from recorded model context and preserves model origin on edit', () => {
  const { store, face } = panel({ [studyArtifactAddress(artifact.id)]: live(artifact) })
  act(() => { store.actions.open(artifact.id) })
  expect(screen.getByText('Chosen for the question')).toBeDefined()
  expect(screen.getByText('Provisional draft · Comparison · Captured model answer')).toBeDefined()
  fireEvent.click(screen.getByText('Recorded model context · provider / model'))
  fireEvent.click(screen.getByRole('button', { name: 'Open original conversation' }))
  expect(face.openSession).toHaveBeenCalledExactlyOnceWith('original-session')
  fireEvent.click(screen.getByRole('button', { name: 'Edit note' }))
  expect(store.getSnapshot().draft?.origin).toBe('captured-answer')
  expect(screen.getByText('Provisional draft · Captured model answer')).toBeDefined()
})

it('prepares an editable localized source task without submitting or manufacturing a model product', () => {
  const prepareQuestion = vi.fn(), newNote = vi.fn()
  render(<StudyTasks {...{ selectionCount: 1, selections: [source], prepareQuestion, newNote, t } as StudyTasksProps} />)
  fireEvent.click(screen.getByText('Prepare a task'))
  fireEvent.click(screen.getByRole('button', { name: 'Comparison' }))
  expect(prepareQuestion).toHaveBeenCalledExactlyOnceWith(en.comparisonTask)
  expect(newNote).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Write a reading note' }))
  expect(newNote).toHaveBeenCalledExactlyOnceWith([source])
})

it('offers answer capture only for the matching durable, uninterrupted assistant message', () => {
  const capture = vi.fn()
  const node = { kind: 'assistant', messageId: 'visible-message', seq: 42 }
  const props = { messageId: 'visible-message', t, capture,
    useChat: (select: (snapshot: unknown) => unknown) => select({ legacy: { nodes: [node] } }) } as CaptureActionProps
  const view = render(<CaptureAction {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Save this answer as a draft' }))
  expect(capture).toHaveBeenCalledExactlyOnceWith(42)
  view.rerender(<CaptureAction {...{ ...props, messageId: 'another-message' } as CaptureActionProps} />)
  expect(screen.queryByRole('button')).toBeNull()
  view.rerender(<CaptureAction {...{ ...props,
    useChat: (select: (snapshot: unknown) => unknown) => select({ legacy: { nodes: [{ ...node, interrupted: true }] } }),
  } as CaptureActionProps} />)
  expect(screen.queryByRole('button')).toBeNull()
})

it('offers the retained note draft after returning to the list and resumes all typed fields', () => {
  const { store } = panel({ [STUDY_SETUP]: live({ canSave: true, canCapture: true, asSources: true }) })
  fireEvent.click(screen.getByRole('button', { name: 'New note' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: '待完成的中文笔记' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Note text (Markdown)' }), { target: { value: '保留已写内容与未解问题。' } })
  fireEvent.click(screen.getByRole('button', { name: 'Back to study notes' }))
  expect(screen.queryByRole('button', { name: 'New note' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Continue draft' }))
  expect(screen.getByRole('textbox', { name: 'Title' }).getAttribute('value')).toBe('待完成的中文笔记')
  expect(store.getSnapshot().draft?.markdown).toBe('保留已写内容与未解问题。')
})

it('continues an unsaved note after removing a different saved artifact from the list', () => {
  const { store, face } = panel({
    [STUDY_SETUP]: live({ canSave: true, canCapture: true, asSources: true }),
    [studyListAddress({})]: live({ items: [artifact], nextCursor: null }),
    [studyArtifactAddress(artifact.id)]: live(artifact),
  })
  fireEvent.click(screen.getByRole('button', { name: 'New note' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Keep this note' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Note text (Markdown)' }), { target: { value: 'Unfinished independent observations.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Back to study notes' }))
  fireEvent.click(screen.getByRole('button', { name: artifact.title }))
  fireEvent.click(screen.getByText('Remove draft', { selector: 'summary' }))
  fireEvent.click(screen.getByRole('button', { name: 'Remove draft' }))
  const operation = vi.mocked(face.execute).mock.calls[0]?.[0]
  if (operation?.kind !== 'remove') throw new Error('The reading action must remove its saved artifact.')
  expect(operation.request.id).toBe(artifact.id)
  act(() => {
    store.actions.pending(operation, true)
    store.actions.acknowledged({ operationId: operation.request.operationId, id: artifact.id,
      version: 'v2' as StudyArtifactVersion, state: 'removed', committedAt: 'now' })
  })
  fireEvent.click(screen.getByRole('button', { name: 'Continue draft' }))
  expect(screen.getByRole('textbox', { name: 'Title' }).getAttribute('value')).toBe('Keep this note')
  expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Note text (Markdown)' }).value).toBe('Unfinished independent observations.')
})

it.each(['save', 'remove'] as const)('returns to a readable first page after %s invalidates the second-page cursor', (kind) => {
  const second: StudyArtifact = { ...artifact, id: 'draft-b' as StudyArtifactId, title: 'Second-page note' }
  const cursor = 'previous-revision-page'
  const oldPage = studyListAddress({ cursor })
  const values: Record<string, ResourceSnapshot<unknown>> = {
    [STUDY_SETUP]: live({ canSave: true, canCapture: true, asSources: true }),
    [studyListAddress({})]: live({ items: [artifact], nextCursor: cursor }),
    [oldPage]: live({ items: [second], nextCursor: null }),
    [studyArtifactAddress(second.id)]: live(second),
  }
  const { store, face, read } = panel(values)
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  expect(screen.getByRole('button', { name: 'First page' })).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: second.title }))
  if (kind === 'save') {
    fireEvent.click(screen.getByRole('button', { name: 'Edit note' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Note text (Markdown)' }), { target: { value: 'Revised observation.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
  } else {
    fireEvent.click(screen.getByText('Remove draft', { selector: 'summary' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove draft' }))
  }
  const operation = vi.mocked(face.execute).mock.calls[0]?.[0]
  if (operation === undefined || operation.kind !== kind) throw new Error('The reading action must submit its selected mutation.')
  expect(operation.request).toMatchObject({ id: second.id })
  act(() => {
    store.actions.pending(operation, true)
    values[oldPage] = { status: 'failed', value: undefined, failure: new RemoteError('aitp/study',
      'The study list changed; reopen its first page.', { code: 'invalid-request', message: 'The study list changed; reopen its first page.', retryable: true }) }
    values[studyListAddress({})] = live({ items: [artifact], nextCursor: kind === 'save' ? 'current-revision-page' : null })
    read.mockClear()
    store.actions.acknowledged({ operationId: operation.request.operationId, id: second.id,
      version: 'v2' as StudyArtifactVersion, state: kind === 'save' ? 'saved' : 'removed', committedAt: 'now' })
  })
  if (kind === 'save') fireEvent.click(screen.getByRole('button', { name: 'Back to study notes' }))
  expect(screen.getByRole('button', { name: artifact.title })).toBeDefined()
  expect(screen.queryByRole('button', { name: 'First page' })).toBeNull()
  expect(read).toHaveBeenCalledWith(studyListAddress({}))
  expect(read).not.toHaveBeenCalledWith(oldPage)
})

it('offers an explicit first-page recovery when an external change invalidates the remounted filtered list', () => {
  const second: StudyArtifact = { ...artifact, id: 'draft-b' as StudyArtifactId, title: 'Second-page note' }
  const cursor = 'previous-revision-page'
  const firstPage = studyListAddress({ kind: 'comparison' })
  const oldPage = studyListAddress({ kind: 'comparison', cursor })
  const values: Record<string, ResourceSnapshot<unknown>> = {
    [firstPage]: live({ items: [artifact], nextCursor: cursor }),
    [oldPage]: live({ items: [second], nextCursor: null }),
    [studyArtifactAddress(second.id)]: live(second),
  }
  const { store, face, read } = panel(values)
  fireEvent.change(screen.getByRole('combobox', { name: 'Product' }), { target: { value: 'comparison' } })
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  fireEvent.click(screen.getByRole('button', { name: second.title }))
  values[oldPage] = { status: 'failed', value: undefined, failure: new RemoteError('aitp/study',
    'The study list changed; reopen its first page.', { code: 'invalid-request', message: 'The study list changed; reopen its first page.', retryable: true }) }
  values[firstPage] = live({ items: [artifact], nextCursor: 'current-revision-page' })
  fireEvent.click(screen.getByRole('button', { name: 'Back to study notes' }))
  expect(screen.getByRole('alert')).toBeDefined()
  expect(store.getSnapshot()).toMatchObject({ cursor, filter: 'comparison' })
  expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull()
  read.mockClear()
  fireEvent.click(screen.getByRole('button', { name: 'First page' }))
  expect(store.getSnapshot()).toMatchObject({ cursor: null, filter: 'comparison' })
  expect(read).toHaveBeenCalledWith(firstPage)
  expect(read).not.toHaveBeenCalledWith(oldPage)
  expect(screen.getByRole('button', { name: artifact.title })).toBeDefined()
  expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Product' }).value).toBe('comparison')
  expect(screen.queryByRole('button', { name: 'First page' })).toBeNull()
  expect(face.execute).not.toHaveBeenCalled()
})
