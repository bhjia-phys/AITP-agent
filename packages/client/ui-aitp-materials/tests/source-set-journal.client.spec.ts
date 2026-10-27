/** Recovery keeps the original pending operation; it never becomes a second saved-source-set owner. */
import { expect, it } from 'vitest'
import type { SaveSourceSetRequest, SourceId, SourceRootId, SourceSetId, SourceTopicId } from '@deepseek-ai/dsh-research-resources/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { createMaterialsStore, materialsScopeKey } from '../src/client/store.ts'
import { createSourceSetJournal, type SourceSetAttempt } from '../src/client/source-set-journal.ts'

const messages = { unavailable: 'Tab recovery unavailable', invalid: 'Unreadable recovery record preserved' }
function tabStorage(initial: string | null = null) {
  let raw = initial
  return { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value }, removeItem: () => { raw = null } }
}
const scope = { workspaceId: 'project' as WorkspaceId, topicId: 'branch' as SourceTopicId, title: '明确子方向' }
const selected = { ref: { rootId: 'papers' as SourceRootId, sourceId: 'source:paper.pdf' as SourceId },
  title: 'Paper', domain: 'literature' as const, locator: { kind: 'pdf-page' as const, page: 7 }, selectedText: '只在 A 下成立' }
const request: SaveSourceSetRequest = { operationId: 'save-original-once', title: '对照资料',
  selections: [{ ref: selected.ref, locator: selected.locator, selectedText: selected.selectedText }], topics: [scope] }

function attempt(count: number): SourceSetAttempt {
  return { scope, request: { ...request, selections: Array.from({ length: count }, (_, index) => ({
    ...request.selections[0], ref: { rootId: selected.ref.rootId, sourceId: `source:paper-${index}.pdf` as SourceId },
  })) }, labels: Array.from({ length: count }, (_, index) => ({ title: `Paper ${index}`, domain: 'literature' })) }
}

it.each([51, 64, 128])('round-trips all %i sources without imposing a second Host selection limit', (count) => {
  const storage = tabStorage()
  const entry = attempt(count)
  expect(createSourceSetJournal(storage, messages).write([entry])).toBeNull()
  expect(createSourceSetJournal(storage, messages).read()).toEqual({ entries: [entry], problem: null })
  const restored = createMaterialsStore(createSourceSetJournal(storage, messages)).create()
  expect(restored.getSnapshot().drafts[materialsScopeKey(scope)]).toMatchObject({ pendingSave: entry.request, saving: false })
  expect(restored.getSnapshot().drafts[materialsScopeKey(scope)]?.selections).toHaveLength(count)
})

it('refuses journal bounds before replacing a recoverable operation', () => {
  const storage = tabStorage()
  const journal = createSourceSetJournal(storage, messages)
  const original = attempt(1)
  expect(journal.write([original])).toBeNull()
  const raw = storage.getItem()
  const tooMany = Array.from({ length: 17 }, (_, index) => ({ ...original,
    scope: { workspaceId: `workspace-${index}` as WorkspaceId },
    request: { ...original.request, operationId: `operation-${index}` },
  }))
  const tooLarge = { ...original, labels: [{ title: '中文'.repeat(100_000), domain: 'literature' as const }] }
  const unreadable = { ...original, request: { ...original.request, title: 'x'.repeat(2001) } }
  for (const entries of [tooMany, [tooLarge], [unreadable]]) {
    expect(journal.write(entries)).toBe(messages.unavailable)
    expect(storage.getItem()).toBe(raw)
    expect(createSourceSetJournal(storage, messages).read()).toEqual({ entries: [original], problem: null })
  }
})

it('restores a dispatched save as uncertain after a new store is created, preserves its scope and clears only after acknowledgement', () => {
  const storage = tabStorage()
  const original = createMaterialsStore(createSourceSetJournal(storage, messages)).create()
  original.actions.setScope(scope)
  original.actions.select(selected, true)
  original.actions.pendingSave(materialsScopeKey(scope), request, true)
  const restored = createMaterialsStore(createSourceSetJournal(storage, messages)).create()
  expect(restored.getSnapshot().scope).toEqual({})
  expect(restored.getSnapshot().drafts[materialsScopeKey(scope)]).toMatchObject({
    scope, pendingSave: request, saving: false, selections: [selected],
  })
  restored.actions.setScope(scope)
  restored.actions.select(selected, false)
  expect(restored.getSnapshot().drafts[materialsScopeKey(scope)]?.pendingSave).toEqual(request)
  expect(restored.getSnapshot().drafts[materialsScopeKey(scope)]?.selections).toEqual([selected])
  restored.actions.sourceSetSaved(materialsScopeKey(scope), { operationId: request.operationId, id: 'saved' as SourceSetId, state: 'saved', committedAt: 'now' })
  expect(createSourceSetJournal(storage, messages).read()).toEqual({ entries: [], problem: null })
})

it('keeps corrupt recovery bytes and reports a refused new write instead of replacing them with an empty journal', () => {
  const raw = '{"version":99,"entries":[]}'
  const storage = tabStorage(raw)
  const journal = createSourceSetJournal(storage, messages)
  expect(journal.read()).toEqual({ entries: [], problem: messages.invalid })
  expect(journal.write([])).toBe(messages.invalid)
  expect(storage.getItem()).toBe(raw)
})

it('reports failed storage while retaining the original command in the loaded view', () => {
  const storage = { getItem: () => null, removeItem: () => {}, setItem: () => { throw new Error('Storage denied') } }
  const store = createMaterialsStore(createSourceSetJournal(storage, messages)).create()
  store.actions.select(selected, true)
  store.actions.pendingSave(materialsScopeKey({}), { ...request, topics: [] }, true)
  expect(store.getSnapshot().recoveryProblem).toBe(messages.unavailable)
  expect(store.getSnapshot().drafts[materialsScopeKey({})]?.pendingSave?.operationId).toBe(request.operationId)
})
