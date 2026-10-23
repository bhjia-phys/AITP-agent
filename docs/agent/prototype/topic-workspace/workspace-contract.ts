/**
 * Proposed frontend/backend handoff for the topic workspace, not a shipped API.
 * The HTML's full editing scenarios remain an inline, in-memory simulator;
 * declaring this contract does not make that simulator backend-compatible.
 * A browser read adapter may demonstrate the read methods independently.
 *
 * Adapters bind one workspace and one authenticated connection. UI and AI may
 * use the same operations; the server derives the actor and checks authority.
 * Caller-provided session IDs are context, never identity or permission.
 * No storage format, database, model runtime or transport is prescribed here.
 */

/** Stable identities survive renames; revisions are opaque equality tokens. */
export type TopicId = string
export type ResourceId = string
export type Revision = string
export type DataOrigin = 'fixture' | 'runtime'

export type Target =
  | { readonly kind: 'project'; readonly id: string }
  | { readonly kind: 'topic'; readonly id: TopicId }
  | { readonly kind: 'resource'; readonly id: ResourceId }

export interface VersionedTarget {
  readonly target: Target
  readonly revision: Revision
}

/** Actor information in committed records is supplied by the authenticated backend. */
export interface RecordedActor {
  readonly id: string
  readonly kind: 'researcher' | 'agent' | 'external'
  readonly label: string
}

export interface Provenance {
  readonly actor?: RecordedActor
  readonly recordedAt?: string
  readonly sourceResourceIds: readonly ResourceId[]
  /** Attribution does not establish scientific verification. */
  readonly explanation?: string
}

/** Metadata belongs to this observed value, including values retained after refresh failure. */
export interface ReadEnvelope<T> {
  readonly origin: DataOrigin
  readonly revision: Revision
  readonly observedAt: string
  readonly value: T
}

export type WorkspaceError =
  | {
    readonly code: 'not-connected' | 'not-found' | 'unsupported' | 'read-only'
      | 'permission-denied' | 'invalid-request' | 'preview-expired'
      | 'operation-reused' | 'cancelled' | 'unavailable'
    readonly message: string
    readonly retryable: boolean
  }
  | {
    readonly code: 'revision-conflict'
    readonly message: string
    readonly current: readonly VersionedTarget[]
  }
  | {
    /** A disconnected response must not be presented as a confirmed failed write. */
    readonly code: 'outcome-unknown'
    readonly message: string
    readonly operationId: string
  }
  | {
    /** An adapter without multi-target atomicity must expose partial application. */
    readonly code: 'partial-apply'
    readonly message: string
    readonly operationId: string
    readonly changed: readonly VersionedTarget[]
    readonly remaining: readonly Target[]
  }

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: WorkspaceError }

export interface ReadOptions {
  readonly signal?: AbortSignal
}

export interface Project {
  readonly id: string
  readonly title: string
  readonly directions: readonly { readonly id: string; readonly title: string }[]
  readonly seeds: readonly {
    readonly id: string
    readonly title: string
    readonly summary: string
    readonly provenance: Provenance
  }[]
}

/** The text and its limits travel together; this is not a global success badge. */
export interface QualifiedAnswer {
  readonly text: string
  readonly qualification: string
  readonly provenance: Provenance
}

export type WorkState = 'active' | 'waiting-on-researcher' | 'waiting-on-run'
  | 'waiting-on-analysis' | 'waiting-on-integration' | 'paused' | 'dormant'
  | 'superseded' | 'concluded' | 'unknown'

export interface WorkSummary {
  readonly state: WorkState
  readonly label: string
  readonly nextAction?: string
}

export interface TopicSummary {
  readonly id: TopicId
  readonly title: string
  readonly shortTitle?: string
  readonly directionId?: string
  /** One primary parent; cross-topic uses do not change ownership. */
  readonly parentId: TopicId | null
  readonly childIds: readonly TopicId[]
  readonly currentAnswer: QualifiedAnswer | null
  readonly gap: string | null
  readonly work: WorkSummary
  readonly resourceCount: number
}

export interface WorkItem {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly state: WorkState
  readonly continuation?: { readonly label: string; readonly text: string }
  readonly options?: readonly { readonly id: string; readonly label: string }[]
  readonly contributingTopicId?: TopicId
  readonly provenance: Provenance
}

export interface Statement {
  readonly id: string
  readonly kind: 'assumption' | 'hypothesis' | 'claim' | 'evidence' | 'question'
  readonly title: string
  readonly text: string
  readonly qualification: string
  /** A source classification is independent of whether its claim was checked. */
  readonly origin: 'imported' | 'local' | 'unknown'
  readonly assessment: 'unchecked' | 'checked' | 'disputed'
  /** Checked/disputed summaries retain the actual check, its scope and evidence. */
  readonly checks: readonly {
    readonly kind: 'source-check' | 'derivation' | 'consistency' | 'numerical' | 'other'
    readonly scope: string
    readonly outcome: 'passed' | 'failed' | 'inconclusive'
    readonly resourceIds: readonly ResourceId[]
  }[]
  /** Declining a route or finding no support is not a scientific refutation. */
  readonly disposition?: 'retained' | 'unsupported' | 'declined' | 'invalidated'
  readonly provenance: Provenance
}

/** A target is a locator, not the identity of the resource or proof it was read. */
export type ResourceTarget =
  | { readonly kind: 'workspace-path'; readonly path: string; readonly anchor?: string }
  | { readonly kind: 'uri'; readonly uri: string; readonly anchor?: string }
  | { readonly kind: 'unavailable'; readonly reason: string }

export interface ResourceReference {
  readonly id: ResourceId
  /** Null identifies a shared/global resource; topic references do not copy it. */
  readonly ownerTopicId: TopicId | null
  readonly title: string
  readonly kind: 'note' | 'paper' | 'code' | 'report' | 'data' | 'other'
  readonly target: ResourceTarget
}

export interface Resource extends ResourceReference {
  readonly content:
    | { readonly kind: 'markdown' | 'plain-text'; readonly text: string }
    | { readonly kind: 'unavailable'; readonly reason: 'linked-only' | 'unsupported-format' | 'not-connected'; readonly detail: string }
  readonly provenance: Provenance
}

export interface Topic extends TopicSummary {
  readonly question: string
  readonly scope: string
  readonly workItems: readonly WorkItem[]
  readonly statements: readonly Statement[]
  readonly resources: readonly ResourceReference[]
  /** An optional full account is read with getResource; no research.md filename is required. */
  readonly accountResourceId?: ResourceId
}

export interface TopicQuery {
  /** Omitted: all topics. Null: roots only. ID: direct children only. */
  readonly parentId?: TopicId | null
  readonly cursor?: string
  readonly limit?: number
}

/** Cursors preserve query and snapshot; invalidated cursors require a fresh first page. */
export interface TopicPage {
  readonly items: readonly ReadEnvelope<TopicSummary>[]
  readonly nextCursor: string | null
  readonly completeness: 'complete' | 'partial'
  readonly incompleteReason?: string
}

export interface ContextQuery {
  readonly topicId: TopicId
  readonly include?: readonly ('ancestors' | 'children' | 'statements' | 'work' | 'resources')[]
  /** Positive bounds; the adapter may impose a lower documented maximum. */
  readonly maxItems?: number
  readonly maxCharacters?: number
}

/** Bounded read material, not evidence that a model received or understood it. */
export interface ContextRead {
  readonly topicId: TopicId
  readonly entries: readonly {
    readonly source: VersionedTarget
    readonly label: string
    readonly text: string
  }[]
  readonly completeness: 'complete' | 'partial'
  /** Omit whole qualified units when bounded; never silently remove their conditions. */
  readonly omissions: readonly { readonly target: Target; readonly reason: string }[]
}

/** Serializable, focused operations. Unsupported operations return a typed error. */
export type ChangeCommand =
  | { readonly kind: 'update-scope'; readonly scope: string }
  | { readonly kind: 'correct-statement'; readonly statementId: string; readonly text: string; readonly qualification: string }
  | { readonly kind: 'record-answer'; readonly text: string; readonly qualification: string; readonly sourceResourceIds: readonly ResourceId[] }
  | { readonly kind: 'set-thread-state'; readonly threadId: string; readonly state: WorkState }
  | { readonly kind: 'choose-route'; readonly threadId: string; readonly optionId: string }
  | { readonly kind: 'set-statement-disposition'; readonly statementId: string; readonly disposition: 'unsupported' | 'declined' | 'invalidated' }
  | { readonly kind: 'revert-change'; readonly changeId: string }

export interface ChangeIntent {
  readonly topicId: TopicId
  readonly expectedRevision: Revision
  readonly command: ChangeCommand
  readonly reason?: string
  readonly originatingSessionId?: string
}

export interface ChangePreview {
  readonly previewId: string
  readonly summary: string
  readonly expiresAt?: string
  /** The backend binds the preview to its intent, authenticated actor and every read base. */
  readonly bases: readonly VersionedTarget[]
  readonly edits: readonly {
    readonly target: Target
    readonly label: string
    readonly before: string | null
    readonly after: string | null
  }[]
  readonly pendingIntegration: readonly string[]
}

export interface ApplyRequest {
  readonly previewId: string
  /** Reuse for an identical retry; duplicate IDs with different requests must be rejected. */
  readonly operationId: string
}

export interface ApplyReceipt {
  readonly operationId: string
  readonly changeId: string
  readonly committedAt: string
  readonly actor: RecordedActor
  readonly changed: readonly VersionedTarget[]
  readonly eventId?: string
}

/** Session IDs refer to the existing host; this interface does not run a chat loop. */
export type ActivityItem =
  | {
    readonly kind: 'change'
    readonly changeId: string
    readonly topicId: TopicId
    readonly summary: string
    readonly recordedAt: string
    readonly actor: RecordedActor
  }
  | {
    readonly kind: 'session'
    readonly sessionId: string
    readonly topicId: TopicId
    readonly title: string
    readonly task?: string
    readonly lastActiveAt: string
  }
  | {
    readonly kind: 'proposal'
    readonly previewId: string
    readonly topicId: TopicId
    readonly summary: string
    readonly recordedAt: string
    readonly actor: RecordedActor
  }

export interface ActivityQuery {
  readonly topicId: TopicId
  readonly cursor?: string
  readonly limit?: number
}

export interface ActivityPage {
  readonly items: readonly ActivityItem[]
  readonly nextCursor: string | null
  readonly completeness: 'complete' | 'partial'
  readonly incompleteReason?: string
}

export type ResearchEvent =
  | {
    readonly kind: 'invalidate'
    readonly eventId: string
    readonly targets: readonly VersionedTarget[]
  }
  | {
    /** Includes reconnects whose event history cannot cover the requested cursor. */
    readonly kind: 'resync-required'
    readonly reason: string
  }
  | {
    readonly kind: 'connection'
    readonly state: 'connected' | 'disconnected' | 'unsupported'
    readonly message?: string
  }

export interface ResearchProvider {
  readonly id: string
  readonly origin: DataOrigin
  readonly capabilities: {
    readonly read: boolean
    readonly readContext: boolean
    readonly readActivity: boolean
    readonly previewChanges: boolean
    readonly applyChanges: boolean
    readonly changeEvents: boolean
    readonly commands: readonly ChangeCommand['kind'][]
  }
}

/**
 * Reads and mutations return typed failures, including unavailable/read-only
 * capabilities. Adapters normalize expected transport failures into Result.
 * UI loading/error/stale state is local; a failed refresh must retain its old
 * observedAt and revision when displaying a retained value.
 */
export interface ResearchWorkspaceAdapter {
  readonly workspaceId: string
  readonly provider: ResearchProvider
  getProject(options?: ReadOptions): Promise<Result<ReadEnvelope<Project>>>
  listTopics(query: TopicQuery, options?: ReadOptions): Promise<Result<ReadEnvelope<TopicPage>>>
  getTopic(topicId: TopicId, options?: ReadOptions): Promise<Result<ReadEnvelope<Topic>>>
  getResource(resourceId: ResourceId, options?: ReadOptions): Promise<Result<ReadEnvelope<Resource>>>
  getActivity(query: ActivityQuery, options?: ReadOptions): Promise<Result<ReadEnvelope<ActivityPage>>>
  readContext(query: ContextQuery, options?: ReadOptions): Promise<Result<ReadEnvelope<ContextRead>>>
  previewChange(intent: ChangeIntent): Promise<Result<ReadEnvelope<ChangePreview>>>
  /**
   * The server rechecks authorization and all preview bases before committing.
   * Success means the whole advertised edit set committed; a known partial
   * commit returns partial-apply. Idempotent retry and recovery require server
   * implementation and are not established by this interface or the prototype.
   */
  applyChange(request: ApplyRequest): Promise<Result<ReadEnvelope<ApplyReceipt>>>
  /**
   * Events invalidate reads; they are not complete state replacements. Event
   * IDs are opaque. Reconnect with an unsupported/expired cursor requests a
   * full resync. The unsubscribe function removes this listener only.
   */
  subscribeChanges(
    options: { readonly afterEventId?: string },
    listener: (event: ResearchEvent) => void,
  ): () => void
}
