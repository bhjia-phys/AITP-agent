// @vitest-environment jsdom
/** Same-tab reload restores creation identity without replaying an unconfirmed write. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { createResearchPanelStore } from '../src/client/store.ts'
import { TopicCreation } from '../src/client/TopicCreation.tsx'
import { createTopicCreationJournal } from '../src/client/topic-creation-journal.ts'
import { en } from '../src/client/locales.ts'
import type { CreateTopicReceipt, CreateTopicRequest, ResourceId, Result, Revision, TopicId } from '../src/client/workspace-contract.ts'

afterEach(cleanup)
const t = makeTranslate(en) as TranslateNS<'aitp.research'>
const useResource = () => ({ status: 'none' as const, value: undefined, failure: undefined })
const WS = 'tab-workspace' as WorkspaceId
const KEY = 'dsh.aitp.topic-creation.v1'

function storage() {
  const values = new Map<string, string>()
  return { values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

it('retains dispatch identity before the request, restores a reloaded pending form as uncertain and clears after acknowledgement', async () => {
  const tab = storage()
  const journal = createTopicCreationJournal(tab, t('topic.create.reloaded'))
  const original = createResearchPanelStore(journal).create()
  const create = vi.fn<(request: CreateTopicRequest) => Promise<Result<CreateTopicReceipt>>>(async (request) => {
    expect(tab.values.get(KEY)).toContain(request.operationId)
    return new Promise<Result<CreateTopicReceipt>>(() => {})
  })
  const created = vi.fn()
  const view = render(<TopicCreation t={t} workspaceId={WS} useResource={useResource}
    useStore={bindSnapshotSelector(original)} actions={original.actions}
    currentTopicId={null} writable create={create} created={created} />)
  fireEvent.click(screen.getByRole('button', { name: 'New topic' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Reloaded topic' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Folder name (optional)' }), { target: { value: '精细 子方向' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Research question' }), { target: { value: 'Was this already created?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create topic' }))
  const request = create.mock.calls[0]![0]
  view.unmount()

  const restored = createResearchPanelStore(journal).create()
  const retry = vi.fn<(request: CreateTopicRequest) => Promise<Result<CreateTopicReceipt>>>(async submitted => ({ ok: true,
    value: { operationId: submitted.operationId, topicId: 'restored-topic' as TopicId, resourceId: 'restored-account' as ResourceId },
  }))
  render(<TopicCreation t={t} workspaceId={WS} useResource={useResource}
    useStore={bindSnapshotSelector(restored)} actions={restored.actions}
    currentTopicId={null} writable create={retry} created={created} />)
  expect(retry).not.toHaveBeenCalled()
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Title' }).value).toBe('Reloaded topic')
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Folder name (optional)' }).value).toBe('精细 子方向')
  expect(request.directory).toBe('精细 子方向')
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Title' }).disabled).toBe(true)
  fireEvent.click(screen.getByText('Creation details'))
  expect(screen.getByText(t('topic.create.reloaded'))).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Retry topic creation' }))
  await waitFor(() => { expect(created).toHaveBeenCalledOnce() })
  expect(retry).toHaveBeenCalledExactlyOnceWith(request)
  expect(tab.values.has(KEY)).toBe(false)
})

it('retains a partial result and its actual account inspection target across a reload', () => {
  const tab = storage()
  const journal = createTopicCreationJournal(tab, t('topic.create.reloaded'))
  const original = createResearchPanelStore(journal).create()
  const request: CreateTopicRequest = { operationId: 'partial-attempt', title: 'Partial', question: 'What was saved?' }
  original.actions.beginTopic(WS, undefined, undefined, undefined)
  original.actions.changeTopic(WS, 'title', request.title)
  original.actions.changeTopic(WS, 'question', request.question)
  original.actions.submitTopic(WS, request)
  original.actions.settleTopic(WS, request.operationId, { ok: false, error: { code: 'partial-apply', operationId: request.operationId,
    message: 'The account exists at notes/partial/research.md; inspect the parent link.',
    changed: [{ target: { kind: 'resource', id: 'partial-resource' as ResourceId }, revision: 'observed' as Revision }], remaining: [],
  } })
  const restored = createResearchPanelStore(journal).create()
  const inspect = vi.fn()
  const create = vi.fn<(request: CreateTopicRequest) => Promise<Result<CreateTopicReceipt>>>()
  render(<TopicCreation t={t} workspaceId={WS} useResource={useResource}
    useStore={bindSnapshotSelector(restored)} actions={restored.actions}
    currentTopicId={null} writable create={create} created={vi.fn()} inspect={inspect} />)
  expect(create).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Creation details'))
  expect(screen.getByText('The account exists at notes/partial/research.md; inspect the parent link.')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Inspect created account' }))
  expect(inspect).toHaveBeenCalledExactlyOnceWith('partial-resource')
  fireEvent.click(screen.getByRole('button', { name: 'Resume topic creation' }))
  expect(screen.getByRole('button', { name: 'Check creation status' })).toBeDefined()
  expect(restored.getSnapshot().topicDrafts[WS]?.request).toEqual(request)
})

it('reports unavailable tab persistence and preserves an unreadable journal instead of silently replacing it', () => {
  const blocked = createTopicCreationJournal({ getItem: () => null, removeItem: () => {}, setItem: () => { throw new Error('quota') } }, t('topic.create.reloaded'))
  const instance = createResearchPanelStore(blocked).create()
  instance.actions.beginTopic(WS, undefined, undefined, undefined)
  expect(instance.getSnapshot().topicRecovery).toBe('unavailable')
  expect(createTopicCreationJournal(undefined, '').load().state).toBe('unavailable')

  const tab = storage()
  tab.values.set(KEY, '{invalid')
  const restored = createResearchPanelStore(createTopicCreationJournal(tab, '')).create()
  render(<TopicCreation t={t} workspaceId={WS} useResource={useResource}
    useStore={bindSnapshotSelector(restored)} actions={restored.actions}
    currentTopicId={null} writable create={vi.fn()} created={vi.fn()} />)
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'New topic' }).disabled).toBe(true)
  expect(screen.getByText(t('topic.create.recoveryUnreadable'))).toBeDefined()
  restored.actions.selectWorkspace(WS)
  expect(tab.values.get(KEY)).toBe('{invalid')
})
