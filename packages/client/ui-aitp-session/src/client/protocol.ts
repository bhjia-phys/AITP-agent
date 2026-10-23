/**
 * Session research memory, read through the `aitp-session` client resource
 * protocol at `dsh-resource://aitp-session/session/<sessionId>`. The value is a
 * projection of the Session's logged inputs, the model's explicit working
 * items and source observations; this package renders it and edits nothing.
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** Whether the value came from the research runtime or from the labelled development fixture. */
export type MemoryDataOrigin = 'runtime' | 'fixture'

/** Where a Session started, as recorded by the runtime. */
export type SessionOrigin =
  | { readonly kind: 'topic'; readonly topic: string; readonly thread?: string; readonly notePath: string }
  | { readonly kind: 'source'; readonly label: string; readonly notePath?: string }
  | { readonly kind: 'global' }

/** A researcher's own words: the task, a later instruction, or a choice answer with its question. */
export interface ResearcherItem {
  /** Stable item identity. */
  readonly id: string
  /** What kind of input it was. */
  readonly kind: 'task' | 'instruction' | 'choice'
  /** The text exactly as the researcher wrote or chose it. */
  readonly text: string
  /** For a choice: the question asked. */
  readonly question?: string
  /** Turn number of the originating message. */
  readonly turn: number
}

/** A provisional working item the agent recorded explicitly. */
export interface AgentItem {
  /** Stable item identity. */
  readonly id: string
  /** Item kind. */
  readonly kind: 'gap' | 'next-step' | 'failed-route' | 'method-use' | 'pending-integration'
  /** The agent's text. */
  readonly text: string
  /** Turn of the latest revision. */
  readonly turn: number
  /** `superseded` when a researcher instruction or later item replaced it. */
  readonly status: 'active' | 'superseded'
}

/** Why material is required for the current work. */
export type Requirement = 'researcher' | 'owner' | 'agent' | 'optional'

/** A declared input that is missing, omitted or otherwise not available. */
export interface GapItem {
  /** Stable item identity. */
  readonly id: string
  /** What is missing, in plain words. */
  readonly text: string
  /** Who declared it required. */
  readonly requirement: Requirement
  /** What the gap affects, when stated; work that does not depend on it continues. */
  readonly effect?: string
}

/** One source and what the model actually has of it. */
export interface SourceItem {
  /** Stable item identity. */
  readonly id: string
  /** Display label, usually a workspace-relative path. */
  readonly label: string
  /** Read range, when known, for example `L19–22`. */
  readonly range?: string
  /** An `aitp-note` address the dock can open, when the source is a note. */
  readonly address?: string
  /** Why it was included. */
  readonly reason: 'selected' | 'owner' | 'agent-read' | 'linked'
  /** Requirement level. */
  readonly requirement: Requirement
  /** Availability: located only, attached but not sent, in context now, condensed since delivery, missing, or link only. */
  readonly state:
    | { readonly kind: 'located' }
    | { readonly kind: 'attached' }
    | { readonly kind: 'available'; readonly sentTurn: number }
    | { readonly kind: 'condensed'; readonly sentTurn: number; readonly rereadTurn?: number }
    | { readonly kind: 'missing'; readonly reason: string }
    | { readonly kind: 'pointer' }
}

/** One rule or method that applies to the Session, with whether it was actually used. */
export interface RuleItem {
  /** Stable item identity. */
  readonly id: string
  /** Rule text or method name, verbatim. */
  readonly text: string
  /** Where it comes from, for example `Your rule · this topic` or `AITP Skill · aitp-memory`. */
  readonly source: string
  /** Adoption: used by a request, saved but not yet used, or loaded earlier and condensed since. */
  readonly adoption:
    | { readonly kind: 'used'; readonly turn: number }
    | { readonly kind: 'saved-not-used' }
    | { readonly kind: 'condensed'; readonly loadedTurn: number }
}

/** A generated compaction summary: recovery help, never the researcher's words. */
export interface SummaryItem {
  /** Stable item identity. */
  readonly id: string
  /** Turn at which the summary was generated. */
  readonly turn: number
  /** First and last condensed turns. */
  readonly covers: readonly [first: number, last: number]
}

/** The research memory of one Session. */
export interface SessionMemoryView {
  /** Value provenance. */
  readonly origin: MemoryDataOrigin
  /** The Session this memory belongs to. */
  readonly sessionId: SessionId
  /** Recorded Session origin, when the runtime stored one. */
  readonly sessionOrigin?: SessionOrigin
  /** Researcher items, oldest first; the first `task` item is the task statement. */
  readonly researcher: readonly ResearcherItem[]
  /** Agent working items, oldest first. */
  readonly agent: readonly AgentItem[]
  /** Gaps, most consequential first. */
  readonly gaps: readonly GapItem[]
  /** Sources with availability. */
  readonly sources: readonly SourceItem[]
  /** Rules and methods in effect. */
  readonly rules: readonly RuleItem[]
  /** Generated summaries, oldest first. */
  readonly summaries: readonly SummaryItem[]
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface ResourceProtocolMap {
    'aitp-session': SessionMemoryView
  }
}

/**
 * Address of one Session's research memory.
 * @param sessionId - Harness Session.
 * @returns the resource address.
 */
export function memoryAddress(sessionId: SessionId): string {
  return `dsh-resource://aitp-session/session/${encodeURIComponent(sessionId)}`
}
