/** Explicitly saved, provisional study products; canonical answers stay in their Sessions. */
import type { Branded } from '@deepseek-ai/dsh-brand'
import type { SessionId, SessionSeq } from '@deepseek-ai/dsh-session/types'
import type { SourceSelection } from '@deepseek-ai/dsh-research-resources/types'

/** Stable operational artifact identity, independent of scientific topic ownership. */
export type StudyArtifactId = Branded<'ResearchStudyArtifactId'>
/** Observed version of one complete saved artifact. */
export type StudyArtifactVersion = Branded<'ResearchStudyArtifactVersion'>
/** Product intent; selecting a kind never manufactures content or runs a model. */
export type StudyArtifactKind = 'note' | 'report' | 'comparison' | 'outline' | 'flashcards' | 'mind-map'
/** Expected operational failure; unknown writes retain the original operation identity. */
export interface StudyFailure {
  readonly code: 'unsupported' | 'not-found' | 'invalid-request' | 'conflict' | 'unavailable' | 'unknown'
  readonly message: string
  readonly retryable: boolean
  readonly operationId?: string
}
/** Complete acknowledged value or an explicit failure, never a partial silent save. */
export type StudyResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: StudyFailure }
/** A linked passage; selection and recorded context are different evidence. */
export interface StudyCitation {
  readonly selection: SourceSelection
  readonly basis: 'human-linked' | 'selected' | 'recorded-context' | 'recorded-source-read'
  readonly sessionId?: SessionId
  readonly seq?: SessionSeq
}
/** Exact named context preserved at the selected answer's observed request surface. */
export interface StudyRecordedContext { readonly seq: SessionSeq; readonly name: string; readonly text: string }
/** Saved answer identity; no client-supplied text can create this attribution. */
export interface StudyAnswerCapture {
  readonly sessionId: SessionId
  readonly seq: SessionSeq
  readonly messageId: string
  readonly provider: string
  readonly model: string
  readonly actor: 'model'
  readonly contexts: readonly StudyRecordedContext[]
}
/** Small index item; bodies, quotes and context snapshots are fetched on opening. */
export interface StudyArtifactSummary {
  readonly id: StudyArtifactId
  readonly version: StudyArtifactVersion
  readonly title: string
  readonly kind: StudyArtifactKind
  readonly status: 'provisional'
  readonly origin: 'handwritten' | 'captured-answer'
  readonly edited: boolean
  readonly citationCount: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly savedBy: 'host-owner'
  /** Present only while this plugin's optional shared-source bridge is connected. */
  readonly source?: SourceSelection
}
/** One explicit draft; editing does not turn it into a research decision or knowledge atom. */
export interface StudyArtifact extends StudyArtifactSummary {
  readonly markdown: string
  readonly citations: readonly StudyCitation[]
  readonly capture?: StudyAnswerCapture
}
/** Creation or explicit edit; manually linked citations cannot assert model delivery. */
export interface SaveStudyNoteRequest {
  readonly operationId: string
  readonly id?: StudyArtifactId
  readonly title: string
  readonly kind: StudyArtifactKind
  readonly markdown: string
  /** Human-linked citations for a new handwritten note; captured provenance survives edits. */
  readonly citations?: readonly SourceSelection[]
}
/** Capture one real completed answer, retaining its source attribution from the Session. */
export interface CaptureStudyAnswerRequest {
  readonly operationId: string
  readonly title: string
  readonly kind: StudyArtifactKind
  readonly sessionId: SessionId
  readonly seq: SessionSeq
}
/** Removal affects only this plugin's operational draft. */
export interface RemoveStudyArtifactRequest {
  readonly operationId: string
  readonly id: StudyArtifactId
}
/** Historical acknowledgement; getArtifact retrieves its current state separately. */
export interface StudyArtifactReceipt {
  readonly operationId: string
  readonly id: StudyArtifactId
  readonly version: StudyArtifactVersion
  readonly state: 'saved' | 'removed'
  readonly committedAt: string
}
/** Revision-bound pagination over summaries. */
export interface StudyArtifactQuery { readonly cursor?: string; readonly limit?: number; readonly kind?: StudyArtifactKind }
/** Bodies are never copied into the index response. */
export interface StudyArtifactPage { readonly items: readonly StudyArtifactSummary[]; readonly nextCursor: string | null }
/** Host capabilities are explicit, including absent storage or Session observation. */
export interface StudySetup { readonly canSave: boolean; readonly canCapture: boolean; readonly asSources: boolean }

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap { 'research/study-owner-required': Record<string, never> }
}
