/** Shared local-source contracts; scientific ownership remains in the original files. */
import type { Branded } from '@deepseek-ai/dsh-brand'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { PromptContentPart, SessionRequestId } from '@deepseek-ai/dsh-api-session-controller/types'
import type { GuardedFiles, ScanIssue } from './files.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap { 'research/resources-owner-required': Record<string, never> }
}

/** Host-registered source root, independent of its displayed path or an owning topic. */
export type SourceRootId = Branded<'ResearchSourceRootId'>
/** Provider-owned identity within one source root; path identities do not track external renames. */
export type SourceId = Branded<'ResearchSourceId'>
/** Catalog entry identity; several entries can point to different passages of one file. */
export type ResourceEntryId = Branded<'ResearchResourceEntryId'>
/** Durable operational study-set identity, never the owner of a scientific conclusion. */
export type SourceSetId = Branded<'ResearchSourceSetId'>
/** Scientific topic identity shared structurally with the research-memory contract. */
export type SourceTopicId = Branded<'ResearchTopicId'>
/** Independently composed research-library domains. */
export type ResourceDomain = 'knowledge' | 'literature' | 'code'
/** A source's reading purpose, not a scientific verification classification. */
export type ResourceKind = 'knowledge' | 'literature' | 'code' | 'report' | 'data' | 'note'

/** Root-qualified source identity; equal relative paths in two roots stay distinct. */
export interface SourceRef {
  readonly rootId: SourceRootId
  readonly sourceId: SourceId
}

/** Image formats rendered by the native document preview, without OCR or vision-model delivery. */
export type ResourceImageMediaType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
  | 'image/bmp' | 'image/x-icon' | 'image/svg+xml'

/** Complete authorized source bytes for native preview; transient transport data, never model context. */
export interface ResourceBytes {
  readonly ref: SourceRef
  readonly data: Uint8Array<ArrayBuffer>
  readonly mediaType: 'application/pdf' | ResourceImageMediaType
  readonly observedAt: string
}

/** Exact source locations; PDF pages and code lines are one-based. */
export type SourceLocator =
  | { readonly kind: 'text'; readonly start: number; readonly end: number; readonly quote: string }
  | { readonly kind: 'anchor'; readonly anchor: string }
  | {
    readonly kind: 'pdf-page'
    readonly page: number
    readonly quote?: string
    /** Normalized top-left coordinates and extent within the physical page. */
    readonly region?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  }
  | { readonly kind: 'code'; readonly startLine: number; readonly endLine: number; readonly revision?: string }
  | {
    readonly kind: 'git'
    readonly view: 'status' | 'diff' | 'history'
    readonly scope?: 'working-tree' | 'staged' | 'commit'
    readonly revision?: string
    readonly path?: string
  }

/** An explicitly recorded topic relationship; a nearby directory is not such a record. */
export interface TopicAssociation {
  readonly workspaceId: WorkspaceId
  readonly topicId: SourceTopicId
  readonly reason: string
}

/** An existing source link or its honest unresolved locator. */
export interface ResourceLink {
  readonly label: string
  readonly href: string
  readonly target?: SourceRef
  readonly locator?: SourceLocator
  readonly reason?: string
}

/** Public root metadata; browser requests never choose its filesystem path. */
export interface SourceRoot {
  readonly id: SourceRootId
  readonly title: string
  readonly displayPath: string
  readonly workspaceId?: WorkspaceId
  /** Catalog classification only; omission offers the root to every installed domain. */
  readonly domains?: readonly ResourceDomain[]
  readonly grants?: readonly SourceGrant[]
}

/** Host-only grant of read access; registration does not authorize source writes. */
export interface SourceRootRegistration {
  readonly id: string
  readonly path: string
  readonly title?: string
  readonly workspaceId?: WorkspaceId
  /** Catalog classification, never a source-read grant beyond this root. */
  readonly domains?: readonly ResourceDomain[] | undefined
  /** Existing Host authority can withdraw a contribution without changing another root owner's grant. */
  readonly isAuthorized?: () => boolean | Promise<boolean>
  readonly grantKind?: SourceGrant['kind']
}

/** Current contributors are visible even when another independent connection is withdrawn. */
export interface SourceGrant {
  readonly kind: 'configured' | 'workspace-connection' | 'research-enrollment' | 'host'
  readonly workspaceId?: WorkspaceId
}

/** A counted root grant; unloading its final owner withdraws source access. */
export interface SourceRootLease {
  readonly rootId: SourceRootId
  readonly dispose: () => void
}

/** A domain's source-derived catalog projection. Metadata preserves authored values verbatim. */
export interface ResourceSummary {
  readonly id: ResourceEntryId
  readonly ref: SourceRef
  /** Root whose catalog projects this entry; its actual source may belong to another authorized root. */
  readonly catalogRootId?: SourceRootId
  readonly locator?: SourceLocator
  readonly title: string
  readonly kind: ResourceKind
  readonly domain: ResourceDomain
  readonly providerId: string
  readonly description?: string
  readonly metadata: Readonly<Record<string, string>>
  readonly links: readonly ResourceLink[]
  readonly topics: readonly TopicAssociation[]
}

/** Physical page text and labels observed from the exact PDF file. */
export interface PdfSourcePage {
  readonly page: number
  readonly text: string
  /** Label declared in the PDF metadata; this does not establish a printed page number. */
  readonly pageLabel?: string
  readonly printedPage?: string
}

/** A complete observed reading or an explicit reason that no reading is available. */
export type ResourceBody =
  | {
    readonly kind: 'text'
    readonly format: 'markdown' | 'plain-text' | 'code'
    readonly text: string
    readonly language?: string
    readonly revision?: string
    readonly startLine?: number
    readonly endLine?: number
  }
  | {
    readonly kind: 'pdf'
    readonly pageCount: number
    readonly pages: readonly PdfSourcePage[]
    readonly dataBase64?: string
  }
  | { readonly kind: 'image'; readonly mediaType: ResourceImageMediaType }
  | { readonly kind: 'unavailable'; readonly reason: 'missing' | 'unsupported' | 'ambiguous' | 'too-large' | 'unavailable'; readonly detail: string }

/** Located source observation; displaying it does not establish model delivery. */
export interface ResourceReading {
  readonly resource: ResourceSummary
  readonly body: ResourceBody
  readonly locator?: SourceLocator
  readonly observedAt: string
  readonly issues: readonly string[]
}

/** Select a library's authored projection without changing source identity or read authority. */
export interface ResourceReadRequest {
  readonly ref: SourceRef
  readonly locator?: SourceLocator
  readonly domain?: ResourceDomain
}

/** Expected read or registration rejection, without absolute-path diagnostics. */
export interface ResourceReadError {
  readonly code: 'invalid-request' | 'permission-denied' | 'not-found' | 'unavailable' | 'unsupported' | 'cancelled'
  readonly message: string
  readonly retryable: boolean
}

/** Mutation uncertainty stays separate from the established source-read failure contract. */
export interface ResourceError {
  readonly code: ResourceReadError['code'] | 'outcome-unknown'
  readonly message: string
  readonly retryable: boolean
  readonly operationId?: string
}

/** Domain result, kept separate from transport failure. */
export type ResourceResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ResourceError }

/** Discovery or provider limitation; missing coverage is never an empty-library claim. */
export interface ResourceIssue {
  readonly rootId?: SourceRootId
  readonly providerId?: string
  readonly path?: string
  readonly reason: string
}

/** Bounded catalog query; topic filtering only uses explicitly recorded associations. */
export interface ResourceQuery {
  readonly domain?: ResourceDomain
  readonly rootId?: SourceRootId
  /** Request one immediate code directory; empty string addresses the root. */
  readonly folder?: string
  readonly query?: string
  readonly cursor?: string
  readonly limit?: number
  readonly topic?: { readonly workspaceId: WorkspaceId; readonly topicId: SourceTopicId }
}

/** Query page and its actual discovery coverage. */
export interface ResourcePage {
  readonly items: readonly ResourceSummary[]
  readonly nextCursor: string | null
  readonly completeness: 'complete' | 'partial'
  readonly issues: readonly ResourceIssue[]
  readonly observedAt: string
}

/** Host-only bounded source access supplied by the shared service to each domain provider. */
export interface SourceProviderContext {
  readonly root: SourceRoot
  readonly rootPath: string
  readonly paths: readonly string[]
  readonly issues: readonly ScanIssue[]
  readonly partial: boolean
  readonly observedAt: string
  readonly files: GuardedFiles
  /** Preserve a failed or incomplete domain reading without presenting it as an empty library. */
  reportIssue(path: string, reason: string): void
  /** Resolve authored local links only against currently registered roots; this grants no access. */
  resolveLink(basePath: string, href: string): {
    readonly ref: SourceRef
    readonly locator?: SourceLocator
  } | undefined
}

/** Domain plugin contribution; providers project one shared scan and never grant their own roots. */
export interface ResourceProvider {
  readonly id: string
  readonly domain: ResourceDomain
  /** Project source observations into this domain's catalog. */
  list(context: SourceProviderContext, signal: AbortSignal): Promise<readonly ResourceSummary[]>
  /** Optionally list one immediate directory using the same authorized source context. */
  listDirectory?(context: SourceProviderContext, folder: string, signal: AbortSignal): Promise<readonly ResourceSummary[]>
  /** Observe provider-owned metadata and report changes without extending source read authority. */
  watchChanges?(context: SourceProviderContext, changed: (failed?: boolean) => void, signal: AbortSignal): Promise<() => void>
  /** Read a known source or return undefined when this provider has no specialized reader. */
  read?(context: SourceProviderContext, reference: SourceRef,
    locator: SourceLocator | undefined, signal: AbortSignal): Promise<ResourceBody | undefined>
}

/** Existing scientific owners contribute only the relationships they actually record. */
export interface TopicAssociationProvider {
  readonly id: string
  /** Report unavailable owner coverage while returning the independent relationships that were read. */
  read(signal: AbortSignal, reportIssue?: (issue: ResourceIssue) => void):
  Promise<readonly { readonly ref: SourceRef; readonly topic: TopicAssociation }[]>
}

/** Invalidation asks consumers to reread authoritative values. */
export type ResourceEvent =
  | { readonly kind: 'resync-required'; readonly reason: string }
  | { readonly kind: 'invalidated'; readonly rootId: SourceRootId }
  | { readonly kind: 'provider'; readonly providerId: string; readonly connected: boolean }

/** An eligible source and optional exact selected passage for one explicit question. */
export interface SourceSelection {
  readonly ref: SourceRef
  readonly locator?: SourceLocator
  readonly selectedText?: string
}

/** Normal Harness conversation request; absence of a topic keeps the question global. */
export interface StudyRequest {
  /** Explicit root research scope; omission preserves legacy global source-study behavior without a topic. */
  readonly scope?: 'workspace' | 'global'
  readonly workspaceId?: WorkspaceId
  readonly topicId?: SourceTopicId
  /** Operational source-set identity, independent of scientific topic ownership. */
  readonly sourceSetId?: string
  readonly question: string
  /** Native Session continuation; its existing topic/global scope cannot be rebound. */
  readonly sessionId?: SessionId
  readonly mode?: 'queue' | 'steer'
  readonly requestId?: SessionRequestId
  /** Actual composer content; its text is authoritative when supplied. */
  readonly content?: readonly PromptContentPart[]
  readonly selections: readonly SourceSelection[]
}

/** Existing conversation receipt, not a second chat runtime. */
export interface StudyReceipt { readonly sessionId: SessionId }

/** Context-owning integration supplied by research-memory, never by domain readers. */
export type StudyHandler = (request: StudyRequest, signal: AbortSignal) => Promise<ResourceResult<StudyReceipt>>

/** Whether operational storage and existing Workspace attachment are available. */
export interface ResourceSetup {
  readonly canConnect: boolean
  readonly canSaveSourceSets: boolean
}

/** Durable read-only connection to the exact canonical path selected through a registered Workspace. */
export interface RootConnection {
  readonly workspaceId: WorkspaceId
  readonly rootId: SourceRootId
  readonly domains?: readonly ResourceDomain[]
  readonly connectedAt: string
}

/** An explicitly associated research direction; operational membership does not assert scientific support. */
export interface SourceSetTopic {
  readonly workspaceId: WorkspaceId
  readonly topicId: SourceTopicId
}

/** A study-set list omits selected excerpts; opening the set retrieves its complete bounded selections. */
export interface SourceSetSummary {
  readonly id: SourceSetId
  readonly title: string
  readonly selectionCount: number
  readonly topics: readonly SourceSetTopic[]
  readonly createdAt: string
  readonly updatedAt: string
}

/** Source references and explicitly selected quotations, with no copied whole-source body. */
export interface SourceSet extends SourceSetSummary {
  readonly selections: readonly SourceSelection[]
}

/** Stable request identity makes retries recoverable after a lost save acknowledgment or restart. */
export interface SaveSourceSetRequest {
  readonly operationId: string
  readonly id?: SourceSetId
  readonly title: string
  readonly selections: readonly SourceSelection[]
  readonly topics?: readonly SourceSetTopic[]
}

/** Removal withdraws an operational collection without deleting scientific sources. */
export interface RemoveSourceSetRequest {
  readonly operationId: string
  readonly id: SourceSetId
}

/** Acknowledged historical operation; getSourceSet reads the set's present state separately. */
export interface SourceSetReceipt {
  readonly operationId: string
  readonly id: SourceSetId
  readonly state: 'saved' | 'removed'
  readonly committedAt: string
}

/** Source-set index query, with a single actual topic filter and opaque pagination. */
export interface SourceSetQuery {
  readonly cursor?: string
  readonly limit?: number
  readonly topic?: SourceSetTopic
}

/** Bounded summaries backed by one operational-store revision. */
export interface SourceSetPage {
  readonly items: readonly SourceSetSummary[]
  readonly nextCursor: string | null
}
