/** Exact unanswered assistant questions from already-authorized Session records. */
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { scopeKey } from './working-state.ts'
import type { ResearchContextRead, ResearchOrigin, ResearchWorkingState } from './working-types.ts'

/**
 * Recover original question arguments for active calls in the selected research direction.
 * @param sessionId Identity of the already-authorized owning Session.
 * @param events Original native or PTC carriers, including rows hidden from ordinary model history.
 * @param state Replayed scope and unsettled-call pointers; answers remain separate human records.
 * @param origin Human-selected workspace and topic; it supplies no new execution permission.
 * @returns Complete assistant-question entries with exact reopenable references, never inferred answers.
 */
export function unansweredQuestionEntries(
  sessionId: string,
  events: readonly SessionEvent[],
  state: ResearchWorkingState,
  origin: ResearchOrigin,
): ResearchContextRead['entries'] {
  const original = new Map(events.map(event => [Number(event.seq), event]))
  const entries: ResearchContextRead['entries'] = []
  const selected = scopeKey(origin)
  for (const pending of state.pending) {
    if (pending.name !== 'ask_user_question' || scopeKey(pending.origin) !== selected) continue
    const event = original.get(pending.seq)
    let argumentsText: string | undefined
    if (event?.type === 'tool/call' && event.data.name === pending.name && event.data.callId === pending.callId) {
      argumentsText = event.data.arguments
    } else if (event?.type === 'tool/ptc-dispatch-start' && event.data.name === pending.name && event.data.subCallId === pending.callId) {
      argumentsText = JSON.stringify(event.data.arguments)
    }
    if (argumentsText === undefined) continue
    entries.push({
      label: 'Unanswered assistant question',
      source: { target: `session:${encodeURIComponent(sessionId)}#${pending.seq}` },
      text: 'No structured reply is linked to this question call; later human messages may answer or supersede it and retain authority. '
        + 'This is an assistant question, not a human decision or execution permission.\nOriginal question and offered options: '
        + argumentsText,
    })
  }
  return entries
}
