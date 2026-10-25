// @vitest-environment jsdom
/** Explicit enrollment and topic creation with retained drafts and safe retries. */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { en } from '../src/client/locales.ts'
import { WorkspaceSetup } from '../src/client/WorkspaceSetup.tsx'
import { TopicCreation } from '../src/client/TopicCreation.tsx'
import { createResearchPanelStore } from '../src/client/store.ts'
import type { CreateTopicReceipt, CreateTopicRequest, ResearchInitializeRequest, ResearchSetup, Result, ResourceId, TopicId } from '../src/client/workspace-contract.ts'

afterEach(cleanup)
const t = makeTranslate(en) as TranslateNS<'aitp.research'>
const parent = 'parent' as TopicId
const WS = 'workspace' as WorkspaceId
const receipt: CreateTopicReceipt = { operationId: 'test', topicId: 'new' as TopicId, resourceId: 'new-account' as ResourceId }
const failure = { ok: false as const, error: { code: 'unavailable' as const, message: 'The project is unavailable.', retryable: true } }

it('enables only after explicit submission and retains the read/write choice on a failed attempt', async () => {
  let finish!: (result: Result<ResearchSetup>) => void
  const initialize = vi.fn<(request: ResearchInitializeRequest) => Promise<Result<ResearchSetup>>>(
    () => new Promise((resolve) => { finish = resolve }),
  )
  const retry = vi.fn()
  render(<WorkspaceSetup t={t} setup={{ configured: false, writable: false, canInitialize: true }} initialize={initialize} retry={retry} />)
  expect(initialize).not.toHaveBeenCalled()
  expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Allow saving research changes' }).checked).toBe(false)
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Enable research project' }))
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Enabling…' }).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Enabling…' }))
  expect(initialize).toHaveBeenCalledExactlyOnceWith({ writable: true })
  await act(async () => { finish(failure) })
  expect(screen.getByRole('alert').textContent).toBe('The project is unavailable.')
  expect(screen.getByRole<HTMLInputElement>('checkbox').checked).toBe(true)
  expect(retry).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Enable research project' }))
  await act(async () => { finish({ ok: true, value: { configured: true, writable: true, canInitialize: true } }) })
  expect(retry).not.toHaveBeenCalled()
})

it('allows read-only enrollment and requires a fresh write choice to enable saving', async () => {
  const initialize = vi.fn(async (_request: ResearchInitializeRequest): Promise<Result<ResearchSetup>> => ({
    ok: true, value: { configured: true, writable: false, canInitialize: true },
  }))
  const view = render(<WorkspaceSetup t={t} initialize={initialize} retry={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Enable research project' }))
  await waitFor(() => { expect(initialize).toHaveBeenCalledWith({ writable: false }) })
  view.rerender(<WorkspaceSetup t={t} setup={{ configured: true, writable: false, canInitialize: true }}
    initialize={initialize} retry={vi.fn()} />)
  await waitFor(() => { expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Enable saving' }).disabled).toBe(true) })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Enable saving' }))
  await waitFor(() => { expect(initialize).toHaveBeenLastCalledWith({ writable: true }) })
})

it('retains an explicit setup action through a failed setup read and reports unsupported initialization', async () => {
  const retry = vi.fn()
  render(<WorkspaceSetup t={t} unavailable retry={retry} />)
  expect(screen.getByText('Research setup could not be read. Try again or enable this project explicitly.')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Enable research project' }))
  expect(screen.getByText('This connection cannot enable research projects.')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Read again' }))
  expect(retry).toHaveBeenCalledOnce()
})

it('retains a rejected or unexpectedly failed initialization without changing the write choice', async () => {
  const initialize = vi.fn(async (): Promise<Result<ResearchSetup>> => { throw new Error('lost connection') })
  render(<WorkspaceSetup t={t} initialize={initialize} retry={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Enable research project' }))
  expect((await screen.findByRole('alert')).textContent).toBe('The project could not be enabled. Try again.')
  expect(screen.getByRole<HTMLInputElement>('checkbox').checked).toBe(false)
})

function form(initialParent = false) {
  const store = createResearchPanelStore().create()
  const create = vi.fn<(request: CreateTopicRequest) => Promise<Result<CreateTopicReceipt>>>(async () => failure)
  const created = vi.fn()
  render(<TopicCreation t={t} workspaceId={WS} useStore={bindSnapshotSelector(store)} actions={store.actions}
    currentTopicId={parent} writable create={create} created={created} />)
  fireEvent.click(screen.getByRole('button', { name: initialParent ? 'New subdirection' : 'New topic' }))
  return { create, created, store }
}

function fill(): void {
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'A controlled limit' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Research question' }), { target: { value: 'Which assumptions survive?' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Scope (optional)' }), { target: { value: 'Finite systems only.' } })
}

it('validates title and question, offers the selected parent and lets the researcher choose project level', async () => {
  const { create } = form(true)
  const title = screen.getByRole<HTMLInputElement>('textbox', { name: 'Title' })
  expect(document.activeElement).toBe(title)
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create topic' }).disabled).toBe(true)
  fireEvent.submit(title.form!)
  expect(screen.getByRole('alert').textContent).toBe('Enter a title and research question.')
  expect(create).not.toHaveBeenCalled()
  fill()
  fireEvent.click(screen.getByRole('button', { name: 'Place in project Under “Current topic”' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Top-level topic' }))
  fireEvent.click(screen.getByRole('button', { name: 'Create topic' }))
  await waitFor(() => { expect(create).toHaveBeenCalledOnce() })
  const submitted = create.mock.calls[0]?.[0]
  expect(submitted?.operationId).toBeTypeOf('string')
  expect(submitted?.operationId).not.toBe('')
  expect(submitted).toEqual({ operationId: submitted?.operationId, title: 'A controlled limit',
    question: 'Which assumptions survive?', scope: 'Finite systems only.' })
})

it('blocks duplicate submissions, retains the failed branch draft and retries with the same operation identity', async () => {
  const { create, created } = form(true)
  let finish!: (result: Result<CreateTopicReceipt>) => void
  create.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  fill()
  const title = screen.getByRole<HTMLInputElement>('textbox', { name: 'Title' })
  fireEvent.click(screen.getByRole('button', { name: 'Create topic' }))
  fireEvent.submit(title.form!)
  expect(create).toHaveBeenCalledOnce()
  expect(title.disabled).toBe(true)
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Creating topic…' }).disabled).toBe(true)
  await act(async () => { finish(failure) })
  expect(title.value).toBe('A controlled limit')
  expect(screen.getByRole('alert').textContent).toBe('The project is unavailable.')
  expect(created).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Create topic' }))
  expect(create.mock.calls[1]?.[0]).toEqual(create.mock.calls[0]?.[0])
  expect(create.mock.calls[0]?.[0].parentTopicId).toBe(parent)
  await act(async () => { finish({ ok: true, value: receipt }) })
  expect(created).toHaveBeenCalledExactlyOnceWith(receipt)
  expect(screen.queryByRole('textbox', { name: 'Title' })).toBeNull()
})

it.each(['typed', 'throw'] as const)('keeps an unconfirmed %s outcome locked to the original request for retry', async (kind) => {
  const { create, created } = form()
  create.mockImplementationOnce(async (request) => {
    if (kind === 'throw') throw new Error('lost reply')
    return { ok: false, error: { code: 'outcome-unknown', operationId: request.operationId, message: 'Reply lost.' } }
  })
  fill()
  fireEvent.click(screen.getByRole('button', { name: 'Create topic' }))
  await screen.findByRole('alert')
  const retry = await screen.findByRole('button', { name: 'Retry topic creation' })
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Title' }).disabled).toBe(true)
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Close for now' }).disabled).toBe(false)
  create.mockResolvedValueOnce({ ok: true, value: receipt })
  fireEvent.click(retry)
  await waitFor(() => { expect(created).toHaveBeenCalledOnce() })
  expect(create.mock.calls[1]?.[0]).toEqual(create.mock.calls[0]?.[0])
})

it('cancels an unsubmitted form and reports unavailable creation honestly', () => {
  form()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('textbox', { name: 'Title' })).toBeNull()
  cleanup()
  const store = createResearchPanelStore().create()
  render(<TopicCreation t={t} workspaceId={WS} useStore={bindSnapshotSelector(store)} actions={store.actions}
    currentTopicId={null} writable create={undefined} created={vi.fn()} />)
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'New topic' }).disabled).toBe(true)
  expect(screen.getByText('Topic creation is unavailable from this connection.')).toBeDefined()
})
