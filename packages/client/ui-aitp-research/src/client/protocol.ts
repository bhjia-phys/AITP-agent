/**
 * Research views read three client resource protocols. Their values are view
 * models of existing research owners: every displayed passage carries its
 * source locator, and nothing here is an editable scientific record. A provider
 * (the research runtime adapter, or the labelled development fixture) supplies
 * them; this package only renders them.
 *
 * Addresses:
 * - `dsh-resource://aitp-topics/workspace/<workspaceId>` — topic index of one Harness Workspace.
 * - `dsh-resource://aitp-topic/workspace/<workspaceId>/topic/<topicId>` — one topic home.
 * - `dsh-resource://aitp-note/workspace/<workspaceId>/note/<path>` — one note, path workspace-relative.
 *
 * Every segment is percent-encoded as one path segment.
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'

/** Whether a value came from the research runtime or from the labelled development fixture. */
export type ResearchDataOrigin = 'runtime' | 'fixture'

/** Where a displayed passage lives in its owning note. */
export interface SourceLocator {
  /** Workspace-relative note path. */
  readonly path: string
  /** Explicit anchor when the source has one. */
  readonly anchor?: string
  /** Observed 1-based line span of this reading; a locator, not a permanent identity. */
  readonly lines?: readonly [first: number, last: number]
}

/** Verbatim note text with its locator. */
export interface SourcePassage {
  /** The passage exactly as written (Markdown, possibly with TeX math). */
  readonly text: string
  /** Where the passage was read. */
  readonly locator: SourceLocator
}

/** Topic kinds the research-record provider recognizes. */
export type TopicKind = 'topic' | 'family' | 'learning'

/** One topic in a Workspace's topic index. */
export interface TopicSummary {
  /** Provider identity used in topic addresses. */
  readonly id: string
  /** Title as written in the owning note. */
  readonly title: string
  /** Topic, family map or learning story. */
  readonly kind: TopicKind
  /** Owning main note, workspace-relative. */
  readonly notePath: string
  /** Authored disposition text, when stated. */
  readonly disposition?: string
  /** Pending researcher choices recorded in the topic. */
  readonly waiting: number
}

/** A Workspace's research root and topics. */
export interface TopicIndexView {
  /** Origin of this observed value. */
  readonly origin: ResearchDataOrigin
  /** ISO-8601 time the provider read the sources. */
  readonly observedAt: string
  /** The root note, or `none` when this Workspace has no root research note. */
  readonly root: { readonly kind: 'note'; readonly path: string } | { readonly kind: 'none' }
  /** Topics linked from the root note, in authored order. */
  readonly topics: readonly TopicSummary[]
  /** Note candidates not linked from the root note. */
  readonly unmapped: number
}

/** The opening of a main note: parsed parts, or the raw passage when parsing found none. */
export type TopicOpening =
  | {
    readonly kind: 'parsed'
    readonly question?: SourcePassage
    readonly answer?: SourcePassage
    readonly gap?: SourcePassage
  }
  | { readonly kind: 'raw'; readonly passage: SourcePassage }

/** One maintained Current work entry. */
export interface ThreadEntry {
  /** Entry title as written. */
  readonly title: string
  /** Authored disposition, verbatim. */
  readonly disposition: string
  /** The entry's continuation clause, when it has one. */
  readonly clause?: { readonly kind: 'next' | 'pending-choice' | 'resume-when'; readonly text: string }
  /** Where the entry is written. */
  readonly locator: SourceLocator
  /** Harness Sessions whose recorded origin is this thread. */
  readonly sessionIds: readonly SessionId[]
}

/** A researcher choice the note records as pending. */
export interface PendingChoice {
  /** Short title as written. */
  readonly title: string
  /** The choice passage. */
  readonly passage: SourcePassage
  /** Who decides, when the note says. */
  readonly decider?: string
  /** A Session already waiting on this choice, when recorded. */
  readonly sessionId?: SessionId
}

/** A parent's using passage for one branch. */
export interface BranchUse {
  /** Branch title. */
  readonly title: string
  /** The parent's passage stating the branch's contribution and limit. */
  readonly passage: SourcePassage
  /** Branch main note, workspace-relative. */
  readonly notePath: string
}

/** A material linked from the topic, with the reason it is shown. */
export interface MaterialLink {
  /** Material family. */
  readonly kind: 'paper' | 'knowledge' | 'code' | 'method'
  /** Title as recorded by its owner. */
  readonly title: string
  /** Why it appears, for example the passage that links it. */
  readonly reason: string
}

/** A topic home assembled from its owning main note. */
export interface TopicHomeView {
  /** Origin of this observed value. */
  readonly origin: ResearchDataOrigin
  /** Topic identity. */
  readonly id: string
  /** Title as written. */
  readonly title: string
  /** Topic kind. */
  readonly kind: TopicKind
  /** Owning main note, workspace-relative. */
  readonly notePath: string
  /** ISO-8601 time the provider read the note. */
  readonly observedAt: string
  /** The note's opening. */
  readonly opening: TopicOpening
  /** Pending researcher choices. */
  readonly pending: readonly PendingChoice[]
  /** Maintained Current work entries in authored order. */
  readonly threads: readonly ThreadEntry[]
  /** Failed routes recorded in the note, with their reopening conditions as written. */
  readonly failedRoutes: readonly SourcePassage[]
  /** Branch contributions as the parent states them. */
  readonly branches: readonly BranchUse[]
  /** Linked materials. */
  readonly materials: readonly MaterialLink[]
  /** Harness Sessions on this topic, or `unrecorded` while Session origins are not stored. */
  readonly sessions: { readonly kind: 'recorded'; readonly ids: readonly SessionId[] } | { readonly kind: 'unrecorded' }
}

/** One note as currently read. */
export interface NoteView {
  /** Origin of this observed value. */
  readonly origin: ResearchDataOrigin
  /** Workspace-relative path. */
  readonly path: string
  /** Title from the first heading, or the file name. */
  readonly title: string
  /** The note's Markdown, unmodified. */
  readonly markdown: string
  /** ISO-8601 time the provider read the file. */
  readonly observedAt: string
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface ResourceProtocolMap {
    'aitp-topics': TopicIndexView
    'aitp-topic': TopicHomeView
    'aitp-note': NoteView
  }
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** The requested note does not exist at its path; `path` is the requested path. */
    'aitp/note-missing': { readonly path: string }
    /** The requested topic is not in the Workspace's index. */
    'aitp/topic-missing': { readonly topicId: string }
  }
}

const enc = encodeURIComponent

/**
 * Address of a Workspace's topic index.
 * @param workspaceId - Harness Workspace.
 * @returns the resource address.
 */
export function topicsAddress(workspaceId: WorkspaceId): string {
  return `dsh-resource://aitp-topics/workspace/${enc(workspaceId)}`
}

/**
 * Address of one topic home.
 * @param workspaceId - Harness Workspace.
 * @param topicId - provider topic identity.
 * @returns the resource address.
 */
export function topicAddress(workspaceId: WorkspaceId, topicId: string): string {
  return `dsh-resource://aitp-topic/workspace/${enc(workspaceId)}/topic/${enc(topicId)}`
}

/**
 * Address of one note.
 * @param workspaceId - Harness Workspace.
 * @param path - workspace-relative note path.
 * @returns the resource address.
 */
export function noteAddress(workspaceId: WorkspaceId, path: string): string {
  return `dsh-resource://aitp-note/workspace/${enc(workspaceId)}/note/${enc(path)}`
}

/**
 * Read a note address back.
 * @param address - an `aitp-note` address.
 * @returns the Workspace and path, or undefined for any other address.
 */
export function parseNoteAddress(address: string): { workspaceId: WorkspaceId; path: string } | undefined {
  const pattern = /^dsh-resource:\/\/aitp-note\/workspace\/(?<workspace>[^/]+)\/note\/(?<path>[^/]+)$/u
  const { workspace, path } = pattern.exec(address)?.groups ?? {}
  if (workspace === undefined || path === undefined) return undefined
  return { workspaceId: decodeURIComponent(workspace) as WorkspaceId, path: decodeURIComponent(path) }
}
