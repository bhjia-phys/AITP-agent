/** Client resource declaration for the shared, source-attributed Session memory view. */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionMemoryView } from '@deepseek-ai/dsh-research-memory/types'
export type { AgentItem, GapItem, MemoryDataOrigin, Requirement, ResearchContextSnapshot, ResearcherItem, RuleItem, SessionMemoryCoverage, SessionMemoryView, SessionOrigin, SourceItem, SummaryItem } from '@deepseek-ai/dsh-research-memory/types'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface ResourceProtocolMap {
    'aitp-session': SessionMemoryView | null
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
