/** Framework-owned view state; saved artifacts belong solely to the Host. */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { CaptureStudyAnswerRequest, RemoveStudyArtifactRequest, SaveStudyNoteRequest, StudyArtifact, StudyArtifactId, StudyArtifactKind, StudyArtifactReceipt } from '@deepseek-ai/dsh-research-study/types'
import type { SourceSelection } from '@deepseek-ai/dsh-research-resources/types'
import type { SessionId, SessionSeq } from '@deepseek-ai/dsh-session/types'
import type { StudyJournal } from './operation-journal.ts'

/** One original explicit command, kept intact until the Host acknowledges its result. */
export type StudyOperation = { readonly kind: 'save'; readonly request: SaveStudyNoteRequest }
  | { readonly kind: 'capture'; readonly request: CaptureStudyAnswerRequest }
  | { readonly kind: 'remove'; readonly request: RemoveStudyArtifactRequest }

/** Unsaved editor fields; a captured answer's body is restored by the Host. */
export interface StudyDraft {
  origin: 'handwritten' | 'captured-answer'
  id?: StudyArtifactId
  title: string
  kind: StudyArtifactKind
  markdown: string
  citations: SourceSelection[]
  capture?: { sessionId: SessionId; seq: SessionSeq }
}
/** Local navigation, editing and pending-command state shared by the panel and sidebar. */
export interface StudyViewState {
  location: { kind: 'list' } | { kind: 'artifact'; id: StudyArtifactId } | { kind: 'draft' }
  filter: StudyArtifactKind | null
  cursor: string | null
  draft: StudyDraft | null
  pending: StudyOperation | null
  saving: boolean
  failure: string | null
  recoveryProblem: string | null
}

/** Explicit changes to renderer-owned draft and pending-command state. */
export type StudyActions = {
  list: (state: StudyViewState) => void
  resume: (state: StudyViewState) => void
  open: (state: StudyViewState, id: StudyArtifactId) => void
  filter: (state: StudyViewState, kind: StudyArtifactKind | null) => void
  page: (state: StudyViewState, cursor: string | null) => void
  create: (state: StudyViewState, citations?: readonly SourceSelection[]) => void
  edit: (state: StudyViewState, artifact: StudyArtifact) => void
  capture: (state: StudyViewState, sessionId: SessionId, seq: SessionSeq, title: string) => void
  change: (state: StudyViewState, field: 'title' | 'kind' | 'markdown', value: string) => void
  pending: (state: StudyViewState, operation: StudyOperation, saving: boolean, message?: string) => void
  rejected: (state: StudyViewState, message: string) => void
  acknowledged: (state: StudyViewState, receipt: StudyArtifactReceipt) => void
}

/**
 * Declare study viewing state and recover unconfirmed original commands.
 * @param journal - optional bounded same-tab operation recovery.
 * @returns one store handle instantiated by the renderer for the study panel and sidebar.
 */
export function createStudyStore(journal?: StudyJournal): EngineStoreHandle<StudyViewState, StudyActions> {
  return defineStore({
    init: (): StudyViewState => {
      const recovered = journal?.read()
      const pending = recovered?.entry?.operation ?? null
      const state: StudyViewState = { location: { kind: 'list' }, filter: null, cursor: null, draft: null,
        pending, saving: false, failure: null, recoveryProblem: recovered?.problem ?? null }
      if (pending?.kind === 'remove') state.location = { kind: 'artifact', id: pending.request.id }
      else if (pending !== null) {
        const request = pending.request
        state.location = { kind: 'draft' }
        state.draft = pending.kind === 'save' ? {
          origin: recovered?.entry?.origin ?? 'handwritten', ...pending.request.id === undefined ? {} : { id: pending.request.id },
          title: request.title, kind: request.kind, markdown: pending.request.markdown, citations: [...pending.request.citations ?? []],
        } : { origin: 'captured-answer', title: request.title, kind: request.kind, markdown: '', citations: [],
          capture: { sessionId: pending.request.sessionId, seq: pending.request.seq } }
      }
      return state
    },
    actions: {
      resume: (state) => { if (state.pending === null && state.draft !== null) state.location = { kind: 'draft' } },
      list: (state) => { if (state.pending === null) state.location = { kind: 'list' } },
      open: (state, id: StudyArtifactId) => { if (state.pending === null) { state.location = { kind: 'artifact', id }; state.failure = null } },
      filter: (state, kind: StudyArtifactKind | null) => { state.filter = kind; state.cursor = null },
      page: (state, cursor: string | null) => { state.cursor = cursor },
      create: (state, citations: readonly SourceSelection[] = []) => {
        if (state.pending !== null) return
        state.location = { kind: 'draft' }; state.failure = null
        state.draft = { origin: 'handwritten', title: '', kind: 'note', markdown: '', citations: [...citations] }
      },
      edit: (state, artifact: StudyArtifact) => {
        if (state.pending !== null) return
        state.location = { kind: 'draft' }; state.failure = null
        state.draft = { origin: artifact.origin, id: artifact.id, title: artifact.title, kind: artifact.kind, markdown: artifact.markdown,
          citations: artifact.citations.map(citation => citation.selection) }
      },
      capture: (state, sessionId: SessionId, seq: SessionSeq, title: string) => {
        if (state.pending !== null) return
        state.location = { kind: 'draft' }; state.failure = null
        state.draft = { origin: 'captured-answer', title, kind: 'note', markdown: '', citations: [], capture: { sessionId, seq } }
      },
      change: (state, field: 'title' | 'kind' | 'markdown', value: string) => {
        if (state.draft === null || state.pending !== null) return
        if (field === 'kind') {
          if (['note', 'report', 'comparison', 'outline', 'flashcards', 'mind-map'].includes(value)) state.draft.kind = value as StudyArtifactKind
        } else state.draft[field] = value
      },
      pending: (state, operation: StudyOperation, saving: boolean, message?: string) => {
        state.pending = operation; state.saving = saving; state.failure = message ?? null
        state.recoveryProblem = journal?.write({ operation, origin: state.draft?.origin ?? 'handwritten' }) ?? null
      },
      rejected: (state, message: string) => {
        state.pending = null; state.saving = false; state.failure = message
        state.recoveryProblem = journal?.write(undefined) ?? null
      },
      acknowledged: (state, receipt: StudyArtifactReceipt) => {
        state.pending = null; state.saving = false; state.failure = null
        if (receipt.state === 'saved' || state.draft?.id === receipt.id) state.draft = null
        state.location = receipt.state === 'removed' ? { kind: 'list' } : { kind: 'artifact', id: receipt.id }
        state.recoveryProblem = journal?.write(undefined) ?? null
      },
    },
  })
}
/** Renderer-owned handle shared by this plugin's main panel and sidebar entries. */
export type StudyStore = ReturnType<typeof createStudyStore>
