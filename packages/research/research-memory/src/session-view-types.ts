/**
 * Session research memory, read through the `aitp-session` client resource
 * protocol at `dsh-resource://aitp-session/session/<sessionId>`. The value is a
 * projection of the Session's logged inputs, the model's explicit working
 * items and source observations. Its consumers render a read-only observation.
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** Whether the value came from the research runtime or from the labelled development fixture. */
export type MemoryDataOrigin = 'runtime' | 'fixture'

/** Recorded research scope; runtime views use the active scope, fixtures may describe a starting point. */
export type SessionOrigin =
  | { readonly kind: 'topic'; readonly topic: string; readonly thread?: string; readonly notePath: string }
  | { readonly kind: 'source'; readonly label: string; readonly notePath?: string }
  | { readonly kind: 'global' }

/** A researcher's own words: the task, a later instruction, or a choice answer with its question. */
export interface ResearcherItem {
  /** Stable item identity. */
  readonly id: string
  /** What kind of input it was. */
  readonly kind: 'task' | 'input' | 'instruction' | 'choice' | 'answer'
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
  readonly kind: 'gap' | 'result' | 'next-step' | 'failed-route' | 'method-use' | 'pending-integration'
  /** The agent's text. */
  readonly text: string
  /** Recorded condition or reopening criterion, without an inferred explanation. */
  readonly condition?: string
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
    | { readonly kind: 'unknown' }
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

/** Exact retained research-context contribution; a snapshot is not proof of source completeness. */
export interface ResearchContextSnapshot {
  /** Originating Session event identity. */
  readonly id: string
  /** Turn in which the runtime recorded the context. */
  readonly turn: number
  /** Exact model-facing text of the named contribution, without source rereading. */
  readonly text: string
  /** Exact original still current, compacted away, altered by a content projection, or superseded. */
  readonly state: 'current' | 'condensed' | 'projected' | 'superseded'
}

/** Bounded UI reading; omitted complete units remain in the original Session. */
export interface SessionMemoryCoverage {
  /** Complete units omitted from this response because of its configured bound. */
  readonly omittedItems: number
  /** Whether an attributed research-context snapshot was recorded. */
  readonly contextRecorded: boolean
  /** Per-file delivery metadata is not reconstructed from source prose. */
  readonly sourceDelivery: 'context-only'
}

/** The research memory of one Session. */
export interface SessionMemoryView {
  /** Actual recorded location; no extra file grant or inferred reassignment. */
  readonly researchLocation?: {
    readonly workspaceId?: string
    readonly topicId?: string
    readonly global: boolean
    readonly workflow: boolean
    /** Actual deployment capability; the recorded Session choice remains separate. */
    readonly automaticResearch: boolean
    readonly initializing: boolean
    readonly title?: string
  }
  /** Origin of this observed value. */
  readonly origin: MemoryDataOrigin
  /** The Session this memory belongs to. */
  readonly sessionId: SessionId
  /** Active recorded research scope in runtime views; a starting-point description in legacy fixtures. */
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
  /** Actual named runtime-context records; absent for legacy fixture providers. */
  readonly contextSnapshots?: readonly ResearchContextSnapshot[]
  /** Response and attribution limits; absent for legacy fixture providers. */
  readonly coverage?: SessionMemoryCoverage
}
