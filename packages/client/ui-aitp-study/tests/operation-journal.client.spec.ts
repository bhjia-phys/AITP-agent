/** Same-tab reload cannot silently mint another save, answer capture or removal. */
import { expect, it } from 'vitest'
import type { SessionId, SessionSeq } from '@deepseek-ai/dsh-session/types'
import type { StudyArtifactId, StudyArtifactVersion } from '@deepseek-ai/dsh-research-study/types'
import type { SourceId, SourceRootId } from '@deepseek-ai/dsh-research-resources/types'
import { createStudyStore, type StudyOperation } from '../src/client/store.ts'
import { createStudyJournal, type StudyAttempt } from '../src/client/operation-journal.ts'

const messages = { unavailable: 'Recovery storage unavailable', invalid: 'Unreadable original recovery record' }
function tabStorage(initial: string | null = null) {
  let raw = initial
  return { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value }, removeItem: () => { raw = null } }
}

function saveAttempt(count: number): StudyAttempt & { operation: Extract<StudyOperation, { kind: 'save' }> } {
  return { origin: 'handwritten', operation: { kind: 'save', request: {
    operationId: 'save-many-citations', title: '保留全部引用', kind: 'note', markdown: '仍需核对各来源的前提。',
    citations: Array.from({ length: count }, (_, index) => ({
      ref: { rootId: 'papers' as SourceRootId, sourceId: `source:paper-${index}.pdf` as SourceId },
      locator: { kind: 'pdf-page', page: index + 1 }, selectedText: `第 ${index + 1} 份来源中的完整引用。`,
    })),
  } } }
}

it.each([51, 64, 128])('restores all %i citations and the original pending save after a same-tab reload', (count) => {
  const storage = tabStorage()
  const entry = saveAttempt(count)
  expect(createStudyJournal(storage, messages).write(entry)).toBeNull()
  expect(createStudyJournal(storage, messages).read()).toEqual({ entry, problem: null })
  const restored = createStudyStore(createStudyJournal(storage, messages)).create()
  expect(restored.getSnapshot()).toMatchObject({ pending: entry.operation, saving: false, recoveryProblem: null,
    draft: { title: entry.operation.request.title, markdown: entry.operation.request.markdown,
      citations: entry.operation.request.citations } })
  expect(restored.getSnapshot().draft?.citations).toHaveLength(count)
})

it('refuses an invalid citation before replacing a recoverable command and preserves invalid stored bytes', () => {
  const storage = tabStorage()
  const journal = createStudyJournal(storage, messages)
  const original = saveAttempt(1)
  expect(journal.write(original)).toBeNull()
  const raw = storage.getItem()
  const invalid: StudyAttempt = { ...original, operation: { kind: 'save', request: { ...original.operation.request,
    citations: [{ ref: { rootId: 'papers' as SourceRootId, sourceId: 'source:paper.pdf' as SourceId },
      locator: { kind: 'pdf-page', page: 0 } }],
  } } }
  expect(journal.write(invalid)).toBe(messages.unavailable)
  expect(storage.getItem()).toBe(raw)
  expect(createStudyJournal(storage, messages).read()).toEqual({ entry: original, problem: null })

  const unreadable = JSON.stringify({ version: 1, entry: invalid })
  const invalidStorage = tabStorage(unreadable)
  const recovery = createStudyJournal(invalidStorage, messages)
  expect(recovery.read()).toEqual({ problem: messages.invalid })
  expect(recovery.write(original)).toBe(messages.invalid)
  expect(invalidStorage.getItem()).toBe(unreadable)
})

it('round-trips the exact UTF-8 journal budget and refuses an oversized replacement', () => {
  const entry = saveAttempt(1)
  const initialBytes = new TextEncoder().encode(JSON.stringify({ version: 1, entry })).byteLength
  const exact = { ...entry, operation: { ...entry.operation, request: { ...entry.operation.request,
    markdown: entry.operation.request.markdown + 'x'.repeat(524_288 - initialBytes),
  } } }
  const raw = JSON.stringify({ version: 1, entry: exact })
  expect(new TextEncoder().encode(raw)).toHaveLength(524_288)
  const storage = tabStorage()
  const journal = createStudyJournal(storage, messages)
  expect(journal.write(exact)).toBeNull()
  expect(createStudyJournal(storage, messages).read()).toEqual({ entry: exact, problem: null })
  const oversized = { ...exact, operation: { ...exact.operation, request: { ...exact.operation.request,
    markdown: exact.operation.request.markdown + '中',
  } } }
  const oversizedRaw = JSON.stringify({ version: 1, entry: oversized })
  expect(oversizedRaw.length).toBeLessThan(524_288)
  expect(journal.write(oversized)).toBe(messages.unavailable)
  expect(storage.getItem()).toBe(raw)
  const oversizedStorage = tabStorage(oversizedRaw)
  const recovery = createStudyJournal(oversizedStorage, messages)
  expect(recovery.read()).toEqual({ problem: messages.invalid })
  expect(recovery.write(undefined)).toBe(messages.invalid)
  expect(oversizedStorage.getItem()).toBe(oversizedRaw)
})

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
