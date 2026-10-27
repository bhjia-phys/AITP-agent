/** Same-tab reload cannot silently mint another save, answer capture or removal. */
import { expect, it } from 'vitest'
import type { SessionId, SessionSeq } from '@deepseek-ai/dsh-session/types'
import type { StudyArtifactId, StudyArtifactVersion } from '@deepseek-ai/dsh-research-study/types'
import { createStudyStore, type StudyOperation } from '../src/client/store.ts'
import { createStudyJournal } from '../src/client/operation-journal.ts'

const messages = { unavailable: 'Recovery storage unavailable', invalid: 'Unreadable original recovery record' }
function tabStorage(initial: string | null = null) {
  let raw = initial
  return { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value }, removeItem: () => { raw = null } }
}

it.each<StudyOperation>([
  { kind: 'save', request: { operationId: 'save-once', title: '原笔记', kind: 'note', markdown: '仍需核对 A。' } },
  { kind: 'capture', request: { operationId: 'capture-once', title: '原回答', kind: 'comparison', sessionId: 'real-session' as SessionId, seq: 42 as SessionSeq } },
  { kind: 'remove', request: { operationId: 'remove-once', id: 'draft' as StudyArtifactId } },
])('restores the exact $kind command as uncertain and clears it only after confirmation', (operation) => {
  const storage = tabStorage()
  const original = createStudyStore(createStudyJournal(storage, messages)).create()
  if (operation.kind === 'capture') original.actions.capture(operation.request.sessionId, operation.request.seq, operation.request.title)
  else original.actions.create()
  original.actions.pending(operation, true)
  const restored = createStudyStore(createStudyJournal(storage, messages)).create()
  expect(restored.getSnapshot().pending).toEqual(operation)
  expect(restored.getSnapshot().saving).toBe(false)
  restored.actions.create()
  expect(restored.getSnapshot().pending?.request.operationId).toBe(operation.request.operationId)
  restored.actions.acknowledged({ operationId: operation.request.operationId, id: 'draft' as StudyArtifactId, version: 'v1' as StudyArtifactVersion,
    state: operation.kind === 'remove' ? 'removed' : 'saved', committedAt: 'now' })
  expect(createStudyJournal(storage, messages).read()).toEqual({ problem: null })
})

it('preserves an unreadable original record and reports storage denial', () => {
  const storage = tabStorage('{broken-json')
  const journal = createStudyJournal(storage, messages)
  expect(journal.read()).toEqual({ problem: messages.invalid })
  expect(journal.write(undefined)).toBe(messages.invalid)
  expect(storage.getItem()).toBe('{broken-json')
  const unavailable = createStudyJournal(undefined, messages)
  expect(unavailable.write({ origin: 'handwritten', operation: { kind: 'save', request: {
    operationId: 'save-once', title: 'Draft', kind: 'note', markdown: 'Original text',
  } } })).toBe(messages.unavailable)
})
