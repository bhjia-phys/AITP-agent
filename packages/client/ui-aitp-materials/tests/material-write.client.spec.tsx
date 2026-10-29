// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { MaterialWriteReceipt, ResourceId, Result, TopicId } from '@deepseek-ai/dsh-research-memory/types'
import type { SourceId, SourceRootId, SourceTopicId } from '@deepseek-ai/dsh-research-resources/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { MaterialWrite } from '../src/client/MaterialWrite.tsx'
import type { MaterialWriteFace, MaterialWriteInput, MaterialWriteLocation } from '../src/client/material-write-contracts.ts'
import { createMaterialWriteJournal } from '../src/client/material-write-journal.ts'
import { createMaterialsStore } from '../src/client/store.ts'
import { en } from '../src/client/locales.ts'

afterEach(() => { cleanup(); sessionStorage.clear() })
const scope = { workspaceId: 'project' as WorkspaceId, topicId: 'branch' as SourceTopicId, title: 'Finite control' }
const location: MaterialWriteLocation = { rootPath: '/research/project', writable: true, accountPath: 'control/research.md',
  directory: 'control', resourceId: 'resource:control/research.md' as ResourceId, topicId: 'branch' as TopicId }
const live = <T,>(value: T): ResourceSnapshot<T> => ({ status: 'live', value, failure: undefined })
const none: ResourceSnapshot<never> = { status: 'none', value: undefined, failure: undefined }
const receipt: MaterialWriteReceipt = { operationId: 'replaced-by-request', relativePath: 'control/check.py',
  resourceId: 'resource:control/check.py' as ResourceId, mediaType: 'text/plain', byteLength: 13,
  file: { state: 'saved', readBack: { state: 'matches', observedAt: 'now', byteLength: 13 } },
  association: { state: 'not-requested' }, retry: 'none', issues: [] }

function harness(input: Omit<MaterialWriteInput, 'onInspect'> = { scope }, overrides: Partial<MaterialWriteFace> = {}, observed = location,
  store = createMaterialsStore().create()) {
  const face: MaterialWriteFace = { save: vi.fn<MaterialWriteFace['save']>(async command => ({ ok: true,
    value: { ...receipt, operationId: command.operationId } })),
  refresh: vi.fn(), resolveFile: vi.fn(async () => ({ rootId: 'target' as SourceRootId,
    sourceId: 'source:control/check.py' as SourceId })), ...overrides }
  const props = { ...input, ...face, onInspect: vi.fn(), t: makeTranslate(en),
    useStore: bindSnapshotSelector(store), actions: store.actions,
    useWorkspaces: (select: (snapshot: { items: readonly { workspaceId: WorkspaceId; title: string }[] }) => unknown) => select({
      items: [{ workspaceId: scope.workspaceId, title: 'Control project' }],
    }),
    useResource: (address: string) => address.startsWith('dsh-resource://aitp-material-location/') ? live(observed)
      : address.startsWith('dsh-resource://aitp-workspace-topics/') ? live({ value: { items: [{ value: { id: 'branch', title: 'Finite control' } }], completeness: 'complete', nextCursor: null } }) : none,
  } as FactoryComponentPropsOf<'aitp.materials.write'> & MaterialWriteFace
  const view = render(<MaterialWrite {...props} />)
  return { props, face, store, view }
}

async function open(name: string = en.writeFile) {
  fireEvent.click(screen.getByText(name))
  await waitFor(() => { expect(screen.getByRole('combobox', { name: en.writeWorkspace })).toBeDefined() })
}

function fill(link = true) {
  fireEvent.change(screen.getByRole('textbox', { name: en.writeRelativePath }), { target: { value: 'control/check.py' } })
  fireEvent.change(screen.getByRole('textbox', { name: en.writeContent }), { target: { value: 'print("check")' } })
  if (link) fireEvent.change(screen.getByRole('textbox', { name: en.writeLinkTitle }), { target: { value: 'Finite-system check' } })
}

it('saves only explicitly entered text at a previewed path and leaves a root-level write unassociated by default', async () => {
  const { face, store } = harness({ scope: { workspaceId: scope.workspaceId } })
  expect(face.save).not.toHaveBeenCalled()
  await open()
  expect(screen.getByRole<HTMLInputElement>('checkbox', { name: en.writeLinkAccount }).checked).toBe(false)
  fill(false)
  expect(screen.getByLabelText(en.writeDestination).textContent).toBe('/research/project/control/check.py')
  fireEvent.click(screen.getByRole('button', { name: en.writeSave }))
  await waitFor(() => { expect(screen.getByText(en.writeSaved)).toBeDefined() })
  expect(face.save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'text', relativePath: 'control/check.py', text: 'print("check")', scope: { workspaceId: scope.workspaceId } }))
  expect(vi.mocked(face.save).mock.calls[0]![0].association).toBeUndefined()
  expect(screen.getByText(en.writeNotRequested)).toBeDefined()
  expect(store.getSnapshot().scope).toEqual({})
})

it('keeps a completed file receipt collapsed when another library opens the same scope', async () => {
  const store = createMaterialsStore().create()
  const { view } = harness({ scope: { workspaceId: scope.workspaceId } }, {}, location, store)
  await open(); fill(false)
  fireEvent.click(screen.getByRole('button', { name: en.writeSave }))
  await waitFor(() => { expect(screen.getByText(en.writeSaved)).toBeDefined() })
  fireEvent.click(screen.getByRole('button', { name: en.writeOpenFile }))
  await waitFor(() => { expect(screen.queryByRole('region', { name: en.writeFile })).toBeNull() })
  view.unmount()
  harness({ scope: { workspaceId: scope.workspaceId } }, {}, location, store)
  expect(screen.queryByRole('region', { name: en.writeFile })).toBeNull()
  await open()
  expect(screen.getByText(en.writeSaved)).toBeDefined()
})

it('retains an uncertain original operation across topic switches and same-tab recovery without retrying automatically', async () => {
  const journal = () => createMaterialWriteJournal(sessionStorage, { unavailable: 'storage unavailable', invalid: 'invalid recovery' })
  const store = createMaterialsStore(undefined, journal()).create()
  const save = vi.fn<MaterialWriteFace['save']>(async command => ({ ok: false,
    error: { code: 'outcome-unknown', operationId: command.operationId, message: 'Acknowledgement lost.' } }))
  const { props, view } = harness({ scope }, { save }, location, store)
  await open(); fill()
  fireEvent.click(screen.getByRole('button', { name: en.writeSave }))
  await waitFor(() => { expect(screen.getByText('Acknowledgement lost.')).toBeDefined() })
  const command = save.mock.calls[0]![0]
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: en.writeRelativePath }).disabled).toBe(true)
  view.rerender(<MaterialWrite {...props} scope={{ workspaceId: 'another' as WorkspaceId }} />)
  expect(screen.queryByText('Acknowledgement lost.')).toBeNull()
  view.unmount()
  const restored = createMaterialsStore(undefined, journal()).create()
  harness({ scope }, { save }, location, restored)
  await waitFor(() => { expect(screen.getByRole('button', { name: en.writeRetry })).toBeDefined() })
  expect(save).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: en.writeRetry }))
  await waitFor(() => { expect(save).toHaveBeenCalledTimes(2) })
  expect(save.mock.calls[1]![0]).toEqual(command)
  expect(screen.queryByRole('button', { name: en.writeAnother })).toBeNull()
})

it('reports saved bytes and a failed association independently, and reopens the original destination', async () => {
  const save = vi.fn<MaterialWriteFace['save']>(async command => ({ ok: true, value: { ...receipt, operationId: command.operationId,
    association: { state: 'conflict', accountPath: location.accountPath }, retry: 'inspect', issues: ['The account changed.'] } }))
  const { face } = harness({ scope }, { save })
  await open(); fill()
  fireEvent.click(screen.getByRole('button', { name: en.writeSave }))
  await waitFor(() => { expect(screen.getByText(en.writeSaved)).toBeDefined() })
  expect(screen.getByText(en.writeConflict)).toBeDefined()
  expect(screen.queryByText(en.writeLinked)).toBeNull()
  expect(screen.getByText(en.writeMatches)).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: en.writeOpenFile }))
  expect(face.resolveFile).toHaveBeenCalledWith({ workspaceId: scope.workspaceId, topicId: scope.topicId }, 'control/check.py')
})

it('imports an authorized PDF reference only after an explicit copy request and does not add a filesystem picker', async () => {
  const source = { ref: { rootId: 'shared-papers' as SourceRootId, sourceId: 'source:paper.pdf' as SourceId }, title: 'Shared paper' }
  const { face } = harness({ scope, source })
  await open(en.importPdfCopy)
  expect(screen.getByText(en.importPdfHelp)).toBeDefined()
  expect(screen.getByText(en.writePublicationHelp)).toBeDefined()
  expect(screen.queryByText(en.writeIndexHelp)).toBeNull()
  expect(screen.queryByRole('textbox', { name: en.writeContent })).toBeNull()
  expect(document.querySelector('input[type="file"]')).toBeNull()
  expect(face.save).not.toHaveBeenCalled()
  fireEvent.change(screen.getByRole('textbox', { name: en.writeRelativePath }), { target: { value: 'control/paper.pdf' } })
  fireEvent.click(screen.getByRole('button', { name: en.writeImport }))
  await waitFor(() => { expect(face.save).toHaveBeenCalledOnce() })
  expect(face.save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'pdf', source: source.ref, relativePath: 'control/paper.pdf',
    association: { accountPath: 'control/research.md', title: source.title } }))
})

it('keeps actual read-only destinations visible without enabling file publication', async () => {
  const { face } = harness({ scope }, {}, { ...location, writable: false })
  await open(); fill()
  expect(screen.getByText(en.writeReadOnly)).toBeDefined()
  expect(screen.getByRole<HTMLButtonElement>('button', { name: en.writeSave }).disabled).toBe(true)
  expect(face.save).not.toHaveBeenCalled()
})

it('settles a late receipt only in its original context and clears confirmed recovery data', async () => {
  let resolve!: (result: Result<MaterialWriteReceipt>) => void
  const save = vi.fn<MaterialWriteFace['save']>(() => new Promise((done) => { resolve = done }))
  const journal = createMaterialWriteJournal(sessionStorage, { unavailable: 'storage unavailable', invalid: 'invalid recovery' })
  const store = createMaterialsStore(undefined, journal).create()
  const { view, props } = harness({ scope }, { save }, location, store)
  await open(); fill()
  fireEvent.click(screen.getByRole('button', { name: en.writeSave }))
  const command = save.mock.calls[0]![0]
  view.rerender(<MaterialWrite {...props} scope={{ workspaceId: 'other' as WorkspaceId }} />)
  await act(async () => { resolve({ ok: true, value: { ...receipt, operationId: command.operationId } }) })
  expect(screen.queryByText(en.writeSaved)).toBeNull()
  expect(Object.values(store.getSnapshot().materialWrites)[0]?.result).toMatchObject({ ok: true })
  expect(journal.read().commands).toEqual({})
})

it('rechecks an inspection-only unknown outcome with its original command and keeps new publication unavailable', async () => {
  const save = vi.fn<MaterialWriteFace['save']>(async command => ({ ok: true, value: { ...receipt, operationId: command.operationId,
    association: { state: 'unknown', accountPath: location.accountPath }, retry: 'inspect' } }))
  harness({ scope }, { save })
  await open(); fill()
  fireEvent.click(screen.getByRole('button', { name: en.writeSave }))
  await waitFor(() => { expect(screen.getByText(en.writeInspectHelp)).toBeDefined() })
  expect(screen.queryByRole('button', { name: en.writeRetry })).toBeNull()
  expect(screen.queryByRole('button', { name: en.writeAnother })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: en.writeRecheck }))
  await waitFor(() => { expect(save).toHaveBeenCalledTimes(2) })
  expect(save.mock.calls[1]![0]).toEqual(save.mock.calls[0]![0])
})

it('does not overwrite malformed pending-file recovery with a later command', () => {
  sessionStorage.setItem('aitp.materials.pending-files.v1', '{ interrupted')
  const journal = createMaterialWriteJournal(sessionStorage, { unavailable: 'storage unavailable', invalid: 'invalid recovery' })
  expect(journal.read()).toEqual({ commands: {}, problem: 'invalid recovery' })
  expect(journal.write({})).toBe('invalid recovery')
  expect(sessionStorage.getItem('aitp.materials.pending-files.v1')).toBe('{ interrupted')
})

it('bounds pending-file recovery in bytes and exposes storage failure without claiming durable recovery', () => {
  const journal = createMaterialWriteJournal(sessionStorage, { unavailable: 'storage unavailable', invalid: 'invalid recovery' })
  expect(journal.write({ oversized: { kind: 'text', text: '中'.repeat(750_000), scope, operationId: 'bounded-operation', relativePath: 'note.md' } })).toBe('storage unavailable')
  expect(journal.read().commands).toEqual({})
})
