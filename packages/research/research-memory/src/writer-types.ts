import type { Branded } from '@deepseek-ai/dsh-brand'
import type { ResourceId } from './types.ts'

/** Identity of one durable scratch operation, retained for application retries. */
export type WriteOperationId = Branded<'ResearchWriteOperationId'>

/** An exact source passage selected by the researcher or model for replacement. */
export interface SourceEdit {
  readonly resourceId: ResourceId
  readonly originalText: string
  readonly replacementText: string
  readonly rationale: string
  readonly sourceRefs: readonly string[]
}

/** The caller's editorial judgment; the writer does not decide scientific meaning. */
export interface WriteProposal {
  readonly disposition: 'edit' | 'no-change' | 'pending'
  readonly rationale: string
  readonly edits: readonly SourceEdit[]
  readonly remainingUses: readonly string[]
  /** Present for model tools; populated from the real Session, never model arguments. */
  readonly binding?: {
    readonly sessionId: string
    readonly workspaceId: string
    readonly topicId?: string
  }
}

/** A literal patch failure or filesystem outcome requiring attention. */
export interface WriteDiagnostic {
  readonly code: 'missing-passage' | 'ambiguous-passage' | 'unavailable-source'
    | 'unsafe-path' | 'io-failure' | 'readback-differs' | 'interrupted'
  readonly message: string
}

/** Current text is an observation, never evidence that an interrupted write succeeded. */
export interface WriteObservation {
  readonly state: 'matches-planned-output' | 'different' | 'unavailable'
  readonly observedAt: string
}

/** An independently published file; other files in the operation may have failed. */
export interface WriteFileOutcome {
  readonly resourceId: ResourceId
  readonly relativePath: string
  readonly state: 'prepared' | 'applying' | 'applied' | 'not-applied' | 'unknown'
  /** Exact observed before/after text used for review and the application receipt. */
  readonly beforeText: string
  readonly afterText: string
  /** Present only after publication, source readback and durable receipt recording. */
  readonly appliedAt?: string
  readonly diagnostic?: WriteDiagnostic
  /** Absent until recovery inspects the present source. */
  readonly current?: WriteObservation
}

/** Durable operation state outside the scientific source tree. */
export interface WriteOperation {
  readonly format: 1
  readonly operationId: WriteOperationId
  readonly sourceRoot: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly proposal: WriteProposal
  readonly state: 'prepared' | 'no-change' | 'pending' | 'applying'
    | 'applied' | 'not-applied' | 'partial' | 'unknown'
  readonly files: readonly WriteFileOutcome[]
  /** A file can be applied while derived views still require refresh. */
  readonly refreshWarnings: readonly string[]
  /** This writer coordinates its own calls, not arbitrary external editors. */
  readonly concurrency: 'cooperative-single-writer'
}

/** Explicit deployment bounds; null writableRoot allows previews but disables application. */
export interface ScratchWriterConfig {
  readonly writableRoot: string | null
  /** Runtime receipt directory, required to be outside the research root. */
  readonly stateDirectory: string
  /** Bound the complete UTF-8 receipt, including sources, proposals and diagnostics. */
  readonly maxOperationBytes: number
}
