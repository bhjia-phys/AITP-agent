import { expect, it } from 'vitest'
import type { StudyArtifact, StudyArtifactId, StudyArtifactVersion } from '@deepseek-ai/dsh-research-study/types'
import { createStudyStore, type StudyOperation } from '../src/client/store.ts'

it('retains an unacknowledged original mutation across view changes and does not mint a replacement', () => {
  const store = createStudyStore().create()
  store.actions.create()
  store.actions.change('title', 'Original note')
  const operation: StudyOperation = { kind: 'save', request: { operationId: 'save-once', title: 'Original note', kind: 'note', markdown: 'Original text' } }
  store.actions.pending(operation, false, 'Acknowledgement lost')
  store.actions.change('title', 'Must not replace the pending operation')
  store.actions.create()
  store.actions.list()
  expect(store.getSnapshot()).toMatchObject({ location: { kind: 'draft' }, draft: { title: 'Original note' }, pending: operation, saving: false })
  store.actions.acknowledged({ operationId: 'save-once', id: 'note-a' as StudyArtifactId, version: 'v1' as StudyArtifactVersion, state: 'saved', committedAt: 'now' })
  expect(store.getSnapshot()).toMatchObject({ location: { kind: 'artifact', id: 'note-a' }, draft: null, pending: null })
})

it.each([undefined, 'another-note', 'removed-note'])('clears only an editor draft belonging to the removed artifact (%s)', (draftId) => {
  const store = createStudyStore().create()
  if (draftId === undefined) store.actions.create()
  else {
    const artifact: StudyArtifact = { id: draftId as StudyArtifactId, version: 'v1' as StudyArtifactVersion,
      title: 'Original title', kind: 'note', markdown: 'Original text', citations: [], citationCount: 0,
      status: 'provisional', origin: 'handwritten', edited: false, createdAt: 'then', updatedAt: 'then', savedBy: 'host-owner' }
    store.actions.edit(artifact)
  }
  store.actions.change('title', 'Unfinished reading note')
  store.actions.change('markdown', 'Keep my unsaved observations.')
  const draft = store.getSnapshot().draft
  store.actions.list()
  const id = 'removed-note' as StudyArtifactId
  store.actions.open(id)
  store.actions.pending({ kind: 'remove', request: { operationId: 'remove-once', id } }, true)
  store.actions.acknowledged({ operationId: 'remove-once', id, version: 'v2' as StudyArtifactVersion, state: 'removed', committedAt: 'now' })
  expect(store.getSnapshot()).toMatchObject({ location: { kind: 'list' }, pending: null, saving: false, failure: null,
    draft: draftId === id ? null : draft })
  store.actions.resume()
  expect(store.getSnapshot().location.kind).toBe(draftId === id ? 'list' : 'draft')
})
