/** Research context and recoverable working-state contracts. */
import type { Session } from '@deepseek-ai/dsh-session'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import type { ResearchSourceRange } from './types.ts'

/** Human-selected research location; a resource refines evidence within a topic and never grants authority. */
export interface ResearchOrigin {
  workspaceId: string
  topicId?: string
  resourceId?: string
  anchor?: string
  selectedText?: string
  selectedTextFormat?: 'source' | 'rendered'
  selectedRange?: ResearchSourceRange
}

/** Source passages with reopenable locators and explicit coverage limits, before final request budgeting. */
export interface ResearchContextRead {
  entries: { label: string; text: string; source: { target: string; locator?: string } }[]
  omissions: string[]
}

/** Request delivery bounds; original inputs outside the window remain retrievable in their owning Session. */
export interface ResearchRuntimeConfig {
  maxContextCharacters: number
  maxWorkingItems: number
  maxItemCharacters: number
  maxHumanInputs: number
  maxHumanCharacters: number
}

/** Model-owned provisional state, qualified by conditions and linked to successful tool and original input sources. */
export interface ResearchWorkingItem {
  id: string
  kind: 'gap' | 'result' | 'failed-route' | 'next-step' | 'pending-integration'
  text: string
  condition: string
  sourceIds: string[]
  origin: ResearchOrigin
  sourceId: string
}

/** Source pointers only; complete human statements remain in the existing Session. */
export interface ResearchHumanInput {
  sourceId: string
  seq: number
  kind: 'user' | 'aitp-research' | 'user-question-reply' | 'question-answer'
  origin: ResearchOrigin
  questionSeq?: number
}

/** In-flight call pointer binding later native or PTC results to the scope active when the call began. */
export interface ResearchPendingCall {
  callId: string
  name: string
  seq: number
  origin: ResearchOrigin
}

/** Successful writer outcome, projected from its tool result; original proposal stays in the tool call. */
export interface ResearchWriteRecord {
  operationId: string
  state: 'prepared' | 'no-change' | 'pending' | 'applying' | 'applied' | 'not-applied' | 'partial' | 'unknown'
  origin: ResearchOrigin
  sourceId: string
  prepareSeq: number
  seq: number
}

/** Rebuildable Session projection separating human provenance, model suggestions and recorded source-edit outcomes. */
export interface ResearchWorkingState {
  origin: ResearchOrigin | null
  ownerOrigin: boolean
  restricted: boolean
  humans: ResearchHumanInput[]
  items: ResearchWorkingItem[]
  pending: ResearchPendingCall[]
  writes: ResearchWriteRecord[]
}

/** Scoped historical evidence; it never carries executable grants or another conversation's tools. */
export interface ResearchRecovery {
  recover(origin: ResearchOrigin, current: Session, signal?: AbortSignal, proposed?: readonly UserMessage[]): Promise<ResearchContextRead>
  readOriginal(origin: ResearchOrigin, current: Session, sourceId: string, offset: number,
    signal?: AbortSignal): Promise<string | undefined>
}

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /** Human input submitted from a specific research location; never a grant. */
    'aitp-research': { kind: 'aitp-research'; actor: 'human'; origin: ResearchOrigin }
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    researchWorking: ResearchWorkingState
  }
}
