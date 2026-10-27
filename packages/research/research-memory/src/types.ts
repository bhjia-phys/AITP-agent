/**
 * Application contract between the research client and replaceable workspace adapters.
 * Adapters bind one Harness Workspace; storage and model request delivery remain backend-owned.
 * The optional development provider uses fixture data and writes only to its own memory.
 */
import type { Branded } from '@deepseek-ai/dsh-brand'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { PromptContentPart, SessionRequestId } from '@deepseek-ai/dsh-api-session-controller/types'
export type { ResearchOrigin, ResearchWorkingState } from './working-types.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'research/workspace-missing': Record<string, never>
    'research/root-not-configured': Record<string, never>
    'research/refresh-failed': Record<string, never>
    'research/session-unavailable': Record<string, never>
    'research/owner-required': Record<string, never>
  }
}

/** A human question and the source location from which it was asked. */
export interface ResearchQuestion {
  readonly workspaceId: WorkspaceId
  readonly topicId?: TopicId
  readonly resourceId?: ResourceId
  readonly anchor?: string
  readonly selectedText?: string
  /** Absent means literal source text; rendered quotes require Markdown-aware source resolution. */
  readonly selectedTextFormat?: 'source' | 'rendered'
  /** Pinned by source resolution; changed bytes or offsets are never silently relocated. */
  readonly selectedRange?: ResearchSourceRange
  readonly question: string
  /** Continue this exact ordinary Session; omission creates a Session on send. */
  readonly sessionId?: SessionId
  /** Native queue/steer admission, defaulting to queue. */
  readonly mode?: 'queue' | 'steer'
  /** Stable native prompt identity; retries in the same Session do not enqueue twice. */
  readonly requestId?: SessionRequestId
  /** Full native composer content. When present its text replaces question for context retrieval. */
  readonly content?: readonly PromptContentPart[]
}

/** Exact research scope; omission of topicId means the Workspace root account. */
export interface DiscussionQuery {
  readonly topicId?: TopicId
  readonly limit?: number
}

/** Existing ordinary Sessions currently bound to one research scope. */
export interface DiscussionPage {
  readonly items: readonly {
    readonly sessionId: SessionId
    readonly title: string
    readonly updatedAt: string
    readonly busy: boolean
  }[]
  /** Partial means some candidates or older matching Sessions were omitted. */
  readonly completeness: 'complete' | 'partial'
  readonly issues: readonly string[]
}

/** One existing writer receipt proven to belong to the addressed ordinary Session. */
export interface ResearchChangeQuery {
  readonly sessionId: SessionId
  readonly operationId: string
}

/** Bounded historical file publication and separately observed current state; no new write is admitted. */
export interface ResearchChangeView {
  readonly operationId: string
  readonly sessionId: SessionId
  readonly workspaceId: WorkspaceId
  readonly topicId?: TopicId
  readonly state: 'prepared' | 'no-change' | 'pending' | 'applying' | 'applied' | 'not-applied' | 'partial' | 'unknown'
  readonly updatedAt: string
  readonly files: readonly {
    readonly resourceId: ResourceId
    readonly relativePath: string
    readonly state: 'prepared' | 'applying' | 'applied' | 'not-applied' | 'unknown'
    readonly appliedAt?: string
    /** Exact complete file texts, present together only when both fit the response bound. */
    readonly beforeText?: string
    readonly afterText?: string
    readonly current?: { readonly state: 'matches-planned-output' | 'different' | 'unavailable'; readonly observedAt: string }
  }[]
  readonly remainingUses: readonly string[]
  readonly completeness: 'complete' | 'partial'
  readonly omittedFiles: number
  readonly omittedDiffs: number
  readonly omittedUses: number
}

/** Exact UTF-16 source interval [start, end), with its observed raw Markdown for fresh-read validation. */
export interface ResearchSourceRange {
  readonly start: number
  readonly end: number
  readonly text: string
}

/** Provider-owned topic identity. Markdown path IDs survive restart; an unknown rename remains unresolved. */
export type TopicId = Branded<'ResearchTopicId'>
/** Provider-owned material identity; the Markdown provider uses an encoded relative path. */
export type ResourceId = Branded<'ResearchResourceId'>
/** Opaque equality token for an observed version; clients never order or interpret it. */
export type Revision = Branded<'ResearchRevision'>
/** Whether the supplied value came from the development fixture or a runtime provider. */
export type DataOrigin = 'fixture' | 'runtime'

/** A project, topic or material owner addressed by reads, changes and invalidations. */
export type Target =
  | { readonly kind: 'project'; readonly id: string }
  | { readonly kind: 'topic'; readonly id: TopicId }
  | { readonly kind: 'resource'; readonly id: ResourceId }

/** An owner paired with the version observed or acknowledged by the provider. */
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

/** Recorded authorship and source references, separate from scientific verification. */
export interface SourceAttribution {
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

/** Typed failure that distinguishes rejected requests, conflicts and unresolved or partial writes. */
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

/** An adapter value or an expected domain failure; expected transport errors use the failure branch. */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: WorkspaceError }

/** Owner-visible research enrollment, available before source access has been granted. */
export interface ResearchSetup {
  readonly configured: boolean
  readonly writable: boolean
  /** Explicit enrollment or a change to an existing enrollment is available. */
  readonly canInitialize: boolean
}

/** Explicit owner authorization for the registered Workspace's canonical root. */
export interface ResearchInitializeRequest {
  readonly writable: boolean
}

/** Human-authored topic opening; an identical retry reuses operationId. */
export interface CreateTopicRequest {
  readonly operationId: string
  readonly title: string
  readonly question: string
  readonly scope?: string
  readonly parentTopicId?: TopicId
}

/** Durable acknowledgment of a new source account and its explicit parent link. */
export interface CreateTopicReceipt {
  readonly operationId: string
  readonly topicId: TopicId
  readonly resourceId: ResourceId
}

/** Cancellation control for one adapter read, independent of other readers. */
export interface ReadOptions {
  readonly signal?: AbortSignal
}

/** Project identity, research directions and attributed ideas shown above the topic hierarchy. */
export interface Project {
  readonly id: string
  readonly title: string
  /** Optional provider-recorded statement of what the project investigates; clients omit it when absent. */
  readonly summary?: string
  /** Source account for the authored project opening, when the provider can reopen it. */
  readonly accountResourceId?: ResourceId
  readonly directions: readonly { readonly id: string; readonly title: string }[]
  readonly seeds: readonly {
    readonly id: string
    readonly title: string
    readonly summary: string
    readonly attribution: SourceAttribution
  }[]
}

/** The text and its limits travel together; this is not a global success badge. */
export interface QualifiedAnswer {
  readonly text: string
  readonly qualification: string
  readonly attribution: SourceAttribution
}

/** Operational disposition of research work; it does not assert scientific validity. */
export type WorkState = 'active' | 'waiting-on-researcher' | 'waiting-on-run'
  | 'waiting-on-analysis' | 'waiting-on-integration' | 'paused' | 'dormant'
  | 'superseded' | 'concluded' | 'unknown'

/**
 * How a topic serves its primary parent, as recorded at the parent. Providers
 * supply it only from an explicit statement; it is never inferred from
 * parenthood, ordering or wording, and clients show nothing when it is absent.
 */
export interface ParentContribution {
  /** The recorded contribution, including its limiting condition. */
  readonly text: string
  /** Optional recorded relation; omitted when the record does not classify it. */
  readonly relation?: 'prerequisite' | 'alternative' | 'control' | 'application'
}

/** Provider-owned work status and optional next action for a topic card. */
export interface WorkSummary {
  readonly state: WorkState
  /** Authored provider label; empty when none is recorded so the client can localize the state fallback. */
  readonly label: string
  readonly nextAction?: string
}

/** A topic card projected from its own owner, with primary hierarchy and qualified current understanding. */
export interface TopicSummary {
  readonly id: TopicId
  readonly title: string
  readonly shortTitle?: string
  readonly directionId?: string
  /** One primary parent; cross-topic uses do not change ownership. */
  readonly parentId: TopicId | null
  readonly childIds: readonly TopicId[]
  /** Optional recorded contribution to the primary parent; see {@link ParentContribution}. */
  readonly parentContribution?: ParentContribution
  readonly currentAnswer: QualifiedAnswer | null
  readonly gap: string | null
  readonly work: WorkSummary
  readonly resourceCount: number
}

/** An attributed work thread or pending choice with its recorded continuation and contributing topic. */
export interface WorkItem {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly state: WorkState
  readonly continuation?: { readonly label: string; readonly text: string }
  readonly options?: readonly { readonly id: string; readonly label: string }[]
  readonly contributingTopicId?: TopicId
  readonly attribution: SourceAttribution
}

/** A scientific statement retaining its conditions, source classification and scoped verification records. */
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
  readonly attribution: SourceAttribution
}

/** A target is a locator, not the identity of the resource or proof it was read. */
export type ResourceTarget =
  | { readonly kind: 'workspace-path'; readonly path: string; readonly anchor?: string }
  | { readonly kind: 'uri'; readonly uri: string; readonly anchor?: string }
  | { readonly kind: 'unavailable'; readonly reason: string }

/** A navigable material reference whose stable identity is distinct from its current locator. */
export interface ResourceReference {
  readonly id: ResourceId
  /** Null identifies a shared/global resource; topic references do not copy it. */
  readonly ownerTopicId: TopicId | null
  readonly title: string
  readonly kind: 'note' | 'paper' | 'code' | 'report' | 'data' | 'other'
  readonly target: ResourceTarget
}

/** A material reading with verbatim content or an explicit reason that content is unavailable. */
export interface Resource extends ResourceReference {
  readonly content:
    | { readonly kind: 'markdown' | 'plain-text'; readonly text: string }
    | { readonly kind: 'unavailable'; readonly reason: 'linked-only' | 'unsupported-format' | 'not-connected'; readonly detail: string }
  readonly attribution: SourceAttribution
}

/** A topic detail projection linking its own work and statements to resources and the full account. */
export interface Topic extends TopicSummary {
  readonly question: string
  readonly scope: string
  readonly workItems: readonly WorkItem[]
  readonly statements: readonly Statement[]
  readonly resources: readonly ResourceReference[]
  /** An optional full account is read with getResource; no research.md filename is required. */
  readonly accountResourceId?: ResourceId
}

/** Parent selection and opaque pagination for browsing the topic hierarchy. */
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

/** Selection and size bounds for a context read; requesting material does not deliver it to a model. */
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

/** A serializable topic operation bound to the version the requester actually observed. */
export interface ChangeIntent {
  readonly topicId: TopicId
  readonly expectedRevision: Revision
  readonly command: ChangeCommand
  readonly reason?: string
  readonly originatingSessionId?: string
}

/** Provider-prepared edits and read bases awaiting application, with remaining integration work. */
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

/** A prepared preview and stable operation identity reused for identical application retries. */
export interface ApplyRequest {
  readonly previewId: string
  /** Reuse for an identical retry; duplicate IDs with different requests must be rejected. */
  readonly operationId: string
}

/** Acknowledgement that the advertised edit set committed, with resulting owner versions and actor. */
export interface ApplyReceipt {
  /** Source receipt remains authoritative if downstream view invalidation failed. */
  readonly notificationWarning?: string
  readonly operationId: string
  readonly changeId: string
  readonly committedAt: string
  readonly actor: RecordedActor
  readonly changed: readonly VersionedTarget[]
  /** Current reads are separate from the historical publication represented by changed. */
  readonly sourceObservations?: readonly {
    readonly target: Target
    readonly state: 'matches-applied' | 'different' | 'unavailable'
    readonly revision?: Revision
  }[]
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

/** One topic’s activity selection and opaque pagination bounds. */
export interface ActivityQuery {
  readonly topicId: TopicId
  readonly cursor?: string
  readonly limit?: number
}

/** Recorded activity with an explicit continuation and completeness boundary. */
export interface ActivityPage {
  readonly items: readonly ActivityItem[]
  readonly nextCursor: string | null
  readonly completeness: 'complete' | 'partial'
  readonly incompleteReason?: string
}

/** Connection changes and read invalidations; events do not replace authoritative readings. */
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

/** Provider identity and advertised operations used to expose supported client controls. */
export interface ResearchProvider {
  readonly id: string
  readonly origin: DataOrigin
  /** A current deployment limitation, displayed alongside source observations. */
  readonly notice?: string
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
  readonly workspaceId: WorkspaceId
  readonly provider: ResearchProvider
  /** Read owner enrollment before attempting any source reads. */
  getSetup?(): Promise<Result<ResearchSetup>>
  /** Explicitly authorize this registered Workspace and preserve any existing root account. */
  initialize?(request: ResearchInitializeRequest): Promise<Result<ResearchSetup>>
  /** Create a fresh linked account using the supplied human question and scope. */
  createTopic?(request: CreateTopicRequest): Promise<Result<CreateTopicReceipt>>
  /** Submit an explicit human question with its reading origin to a new conversation. */
  ask?(question: Omit<ResearchQuestion, 'workspaceId'>, options?: ReadOptions): Promise<Result<{ readonly sessionId: SessionId }>>
  /** Inspect exact receipt text only after proving its original Session and Workspace ownership. */
  getChange?(query: ResearchChangeQuery, options?: ReadOptions): Promise<Result<ResearchChangeView>>
  /** Read existing discussions without starting or resuming their Agents. */
  listDiscussions?(query: DiscussionQuery, options?: ReadOptions): Promise<Result<DiscussionPage>>
  /**
   * Read the bound workspace's project overview.
   * @param options - cancellation for this read.
   * @returns the observed project or a typed failure.
   */
  getProject(options?: ReadOptions): Promise<Result<ReadEnvelope<Project>>>
  /**
   * Read a page of topic summaries from their current owners.
   * @param query - parent selection, cursor and optional page-size bound.
   * @param options - cancellation for this read.
   * @returns an observed page with explicit completeness, or a typed failure.
   */
  listTopics(query: TopicQuery, options?: ReadOptions): Promise<Result<ReadEnvelope<TopicPage>>>
  /**
   * Read one topic by stable identity.
   * @param topicId - topic to read within this workspace.
   * @param options - cancellation for this read.
   * @returns the observed topic or a typed failure.
   */
  getTopic(topicId: TopicId, options?: ReadOptions): Promise<Result<ReadEnvelope<Topic>>>
  /**
   * Read a material's current locator and available content.
   * @param resourceId - stable material identity.
   * @param options - cancellation for this read.
   * @returns the observed resource, including explicit unavailable content, or a typed failure.
   */
  getResource(resourceId: ResourceId, options?: ReadOptions): Promise<Result<ReadEnvelope<Resource>>>
  /**
   * Read recorded changes, proposals and Session references for one topic.
   * @param query - topic identity and pagination bounds.
   * @param options - cancellation for this read.
   * @returns an observed activity page or a typed failure.
   */
  getActivity(query: ActivityQuery, options?: ReadOptions): Promise<Result<ReadEnvelope<ActivityPage>>>
  /**
   * Assemble bounded reading material without claiming delivery to a model.
   * @param query - topic, included material and size bounds.
   * @param options - cancellation for this read.
   * @returns attributed entries and omissions, or a typed failure.
   */
  readContext(query: ContextQuery, options?: ReadOptions): Promise<Result<ReadEnvelope<ContextRead>>>
  /**
   * Prepare a supported edit against the requester's observed version.
   * @param intent - serializable operation and revision precondition.
   * @returns an unapplied preview or a typed failure such as a conflict.
   */
  previewChange(intent: ChangeIntent): Promise<Result<ReadEnvelope<ChangePreview>>>
  /**
   * The server rechecks authorization and all preview bases before committing.
   * Success means the whole advertised edit set committed; a known partial
   * commit returns partial-apply. Idempotent retry and recovery require server
   * implementation and are not established by this interface or the prototype.
   * @param request - prepared preview and operation identity, reused for identical retries.
   * @returns the application receipt or a typed rejected, unresolved or partial outcome.
   */
  applyChange(request: ApplyRequest): Promise<Result<ReadEnvelope<ApplyReceipt>>>
  /**
   * Events invalidate reads; they are not complete state replacements. Event
   * IDs are opaque. Reconnect with an unsupported/expired cursor requests a
   * full resync. The unsubscribe function removes this listener only.
   * @param options - optional last observed event identity for reconnect recovery.
   * @param listener - consumer of connection and invalidation events.
   * @returns the disposer for this listener.
   */
  subscribeChanges(
    options: { readonly afterEventId?: string },
    listener: (event: ResearchEvent) => void,
  ): () => void
}

/** A resource observation with the capabilities of the adapter that supplied it. */
export interface WorkspaceRead<T> extends ReadEnvelope<T> {
  readonly provider: ResearchProvider
}
export type * from './session-view-types.ts'
