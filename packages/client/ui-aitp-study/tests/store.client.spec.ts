import { expect, it } from 'vitest'
import type { StudyArtifactId, StudyArtifactVersion } from '@deepseek-ai/dsh-research-study/types'
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
