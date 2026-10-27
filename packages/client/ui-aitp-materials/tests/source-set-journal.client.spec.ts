/** Recovery keeps the original pending operation; it never becomes a second saved-source-set owner. */
import { expect, it } from 'vitest'
import type { SaveSourceSetRequest, SourceId, SourceRootId, SourceSetId, SourceTopicId } from '@deepseek-ai/dsh-research-resources/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { createMaterialsStore, materialsScopeKey } from '../src/client/store.ts'
import { createSourceSetJournal } from '../src/client/source-set-journal.ts'

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
