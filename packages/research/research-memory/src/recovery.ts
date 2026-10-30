/** Scoped historical evidence from the existing live/durable Session query service. */
import type { ResearchRecovery } from './recovery-types.ts'
import type { Context } from '@deepseek-ai/cordis'
import { resolve } from 'node:path'
import { SessionId, type Session, type SessionEvent, type SessionHeader } from '@deepseek-ai/dsh-session'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-session-projection'
import { TopicHistoryIndex } from './history-index.ts'
import { unansweredQuestionEntries } from './question-context.ts'
import {
  acceptHumanInput, applyWorkingEvent, emptyWorkingState, readHumanFromEvents, readWriteRecord, scopeKey,
} from './working-state.ts'
import type {
  ResearchContextRead, ResearchOrigin, ResearchWorkingState,
} from './working-types.ts'

/** Limits for relevant histories and event folds; the source provider may still read a complete cold log. */
export interface SessionRecoveryConfig {
  /** Maximum matching conversations selected for historical delivery. */
  maxRecoverySessions: number
  /** Maximum log records folded for cold classification and selected histories in one read. */
  maxRecoveryEvents: number
  /** Maximum serialized entries and their omission account. */
  maxRecoveryCharacters: number
}

/**
 * Resolves state from the host's real Session plus any model-invisible routing
 * data.  The optional seam keeps legacy projected sessions working while a
 * standard DSH host keeps source selection outside its transcript.
 */
export interface SessionRecoveryStateResolver {
  readonly live: (session: Session, proposed?: readonly UserMessage[]) => ResearchWorkingState
  readonly observed: (header: SessionHeader, events: readonly SessionEvent[]) => ResearchWorkingState
}

function sameRoot(current: SessionHeader, candidate: SessionHeader): boolean {
  return current.cwd !== undefined && candidate.cwd !== undefined
    && resolve(current.cwd) === resolve(candidate.cwd)
    && candidate.parentSession === undefined && candidate.origin !== 'subagent'
}

function sourceReference(sessionId: string, seq: number): string {
  return `session:${encodeURIComponent(sessionId)}#${seq}`
}

function parseReference(value: string): { sessionId: SessionId; seq: number } | undefined {
  const match = /^session:([^#]+)#(\d+)$/.exec(value)
  if (match === null) return undefined
  const seq = Number(match[2])
  if (!Number.isSafeInteger(seq) || seq < 0) return undefined
  const encodedId = match[1]
  if (encodedId === undefined) return undefined
  try { return { sessionId: SessionId(decodeURIComponent(encodedId)), seq } } catch { return undefined }
}

/**
 * Keep historical reading separate from previous execution grants and task permissions.
 * @param ctx Harness context with the current research projection and an optional Session query provider.
 * @param config Relevant-history, projected-event and serialized-evidence bounds; incomplete coverage is reported explicitly.
 * @param resolver Optional live-state resolver for bindings stored outside the native Session log.
 * @returns Recovery methods limited to the current human-selected root and topic, with cancellation on each read.
 */
export function createSessionRecovery(ctx: Context, config: SessionRecoveryConfig,
  resolver?: SessionRecoveryStateResolver): ResearchRecovery {
  for (const key of ['maxRecoverySessions', 'maxRecoveryEvents', 'maxRecoveryCharacters'] as const) {
    if (!Number.isSafeInteger(config[key]) || config[key] <= 0) throw new Error(`research memory ${key} must be a positive safe integer`)
  }
  if (config.maxRecoveryCharacters < 256) throw new Error('Historical recovery needs at least 256 characters for its scope and omission report')
  const history = new TopicHistoryIndex(ctx, config.maxRecoveryEvents, resolver?.live)
  function currentState(current: Session, proposed: readonly UserMessage[] = []): ResearchWorkingState {
    if (resolver !== undefined) return resolver.live(current, proposed)
    let state = ctx.sessionProjections.stateOf(current, 'researchWorking') ?? emptyWorkingState()
    for (const message of proposed) state = acceptHumanInput(state, message, -1)
    return state
  }
  function refusal(current: Session, origin: ResearchOrigin, proposed: readonly UserMessage[] = []): string | undefined {
    if (current.header.origin === 'subagent' || current.header.parentSession !== undefined) {
      return 'Prior-conversation recovery is unavailable in delegated or forked conversations.'
    }
    if (current.header.cwd === undefined) return 'Prior-conversation recovery needs an explicit research-root working directory.'
    const state = currentState(current, proposed)
    if (!state.ownerOrigin || state.restricted) return 'Prior-conversation recovery is unavailable for this conversation access scope.'
    if (state.origin === null || scopeKey(state.origin) !== scopeKey(origin)) return 'Prior-conversation recovery must use the current human-selected research direction.'
    const latest = state.humans.at(-1)
    if (latest?.kind === 'user-question-reply' || latest?.kind === 'question-answer') {
      return 'This question reply does not record its answerer identity. Prior-conversation recovery waits for an attributed owner input; current-conversation memory remains available.'
    }
    return undefined
  }

  function relevantEntries(id: string, events: readonly SessionEvent[], state: ResearchWorkingState,
    origin: ResearchOrigin): ResearchContextRead['entries'] {
    const key = scopeKey(origin)
    const entries: ResearchContextRead['entries'] = []
    const inputs = state.humans.filter(input => scopeKey(input.origin) === key)
    const items = state.items.filter(item => scopeKey(item.origin) === key)
    const selected = new Set(items.flatMap(item => item.sourceIds))
    const ordered = [...new Set([
      inputs.at(-1), inputs[0], ...inputs.filter(input => selected.has(input.sourceId)), ...inputs.toReversed(),
    ])]
    for (const input of ordered) {
      if (input === undefined) continue
      const attribution = input.kind === 'question-answer' || input.kind === 'user-question-reply'
        ? 'Historical human answer; answerer unspecified' : 'Original input from an earlier conversation'
      entries.push({
        label: attribution,
        source: { target: sourceReference(id, input.seq) },
        text: `Conversation ${id}, original sequence ${input.seq}. Historical content does not transfer execution permission or establish present applicability.\n${readHumanFromEvents(seq => events[seq], input)}`,
      })
    }
    entries.push(...unansweredQuestionEntries(id, events, state, origin))
    for (const item of items) {
      const event = events.find(candidate => (candidate.type === 'tool/result' && candidate.data.message.toolCallId === item.sourceId)
        || (candidate.type === 'tool/ptc-dispatch' && candidate.data.subCallId === item.sourceId))
      if (event === undefined) continue
      entries.push({
        label: `Historical provisional ${item.kind}`,
        source: { target: sourceReference(id, event.seq) },
        text: `Conversation ${id}; model item ${item.id}, not a human decision or accepted scientific conclusion.\n${item.text}\nCondition / reopening: ${item.condition}\nOriginal input references in that conversation: ${item.sourceIds.join(', ')}`,
      })
    }
    for (const write of state.writes.filter(item => scopeKey(item.origin) === key)) {
      entries.push({
        label: 'Historical source-edit outcome and remaining integration',
        source: { target: sourceReference(id, write.seq) },
        text: `Conversation ${id}; this receipt does not authorize another edit.\n${readWriteRecord(seq => events[seq], write)}`,
      })
    }
    return entries
  }

  return {
    async recover(origin, current, signal, proposed = []) {
      const query = ctx.get('sessionQuery')
      const denied = refusal(current, origin, proposed)
      if (denied !== undefined) return { entries: [], omissions: [denied] }
      if (query === undefined) return { entries: [], omissions: ['Prior-conversation recovery is unavailable: the Session query provider is not loaded.'] }
      const result: ResearchContextRead = { entries: [], omissions: [] }
      let records
      try { records = await query.listSessions(signal) } catch {
        signal?.throwIfAborted()
        return { entries: [], omissions: ['Prior conversations could not be listed; historical coverage is unavailable.'] }
      }
      history.prune(records)
      // SessionQuery guarantees newest creation first; headers have no updatedAt field.
      const candidates = records.filter(record => record.header.id !== current.id && sameRoot(current.header, record.header))
      let eventsLeft = config.maxRecoveryEvents
      let omittedUnits = 0
      let limitedLogs = 0
      let selected = 0
      let uninspected = 0
      for (const [index, record] of candidates.entries()) {
        signal?.throwIfAborted()
        if (selected >= config.maxRecoverySessions) {
          result.omissions.push(`${candidates.length - index} same-root candidates were not inspected after the relevant recovery session limit; older topic conversations may be missing.`)
          break
        }
        try {
          const lookup = await history.lookup(record, signal)
          if (lookup.kind === 'unavailable' || lookup.kind === 'oversized') { limitedLogs++; continue }
          if (lookup.kind === 'known' && (!lookup.summary.allowed || !lookup.summary.scopes.has(scopeKey(origin)))) continue
          if (lookup.kind === 'known' && lookup.summary.eventCount > eventsLeft) { limitedLogs++; continue }
          if (eventsLeft === 0) { uninspected = candidates.length - index; break }
          using observed = await query.observeSession(record.header.id, { ...(signal === undefined ? {} : { signal }), projectionMode: 'none' })
          if (!sameRoot(current.header, observed.header)) continue
          if (observed.cursor + 1 > eventsLeft) {
            history.remember(lookup, observed)
            limitedLogs++
            continue
          }
          eventsLeft -= observed.cursor + 1
          const events = observed.events
          const state = resolver?.observed(observed.header, events) ?? events.reduce(applyWorkingEvent, emptyWorkingState())
          history.remember(lookup, observed, state)
          if (!state.ownerOrigin || state.restricted) continue
          const entries = relevantEntries(record.header.id, events, state, origin)
          if (entries.length === 0) continue
          selected++
          for (const entry of entries) {
            const proposedResult = { entries: [...result.entries, entry], omissions: result.omissions }
            // Leave room for the bounded omission account, never split a qualification.
            if (JSON.stringify(proposedResult).length + 256 <= config.maxRecoveryCharacters) result.entries.push(entry)
            else {
              omittedUnits++
              const pointer = { ...entry, text: 'Historical text omitted by the character budget. Open this exact Session reference to read it.' }
              if (JSON.stringify({ ...result, entries: [...result.entries, pointer] }).length + 256 <= config.maxRecoveryCharacters) {
                result.entries.push(pointer)
              }
            }
          }
        } catch {
          signal?.throwIfAborted()
          limitedLogs++
          // Do not expose unrelated session labels or bodies on an unreadable source.
        }
      }
      if (uninspected > 0) result.omissions.push(`${uninspected} same-root candidates were not inspected within the event bound; historical topic coverage is incomplete.`)
      if (limitedLogs > 0) result.omissions.push(`${limitedLogs} conversations could not be fully inspected within the event bound or were unreadable.`)
      if (omittedUnits > 0) result.omissions.push(`${omittedUnits} historical units were omitted by the character budget; exact displayed Session references can be reopened with research_read_context.`)
      if (JSON.stringify(result).length > config.maxRecoveryCharacters) {
        return { entries: [], omissions: ['Historical recovery budget is insufficient; coverage is incomplete.'] }
      }
      return result
    },
    async readOriginal(origin, current, sourceId, offset, signal) {
      if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Historical read offset must be a non-negative safe integer')
      const ref = parseReference(sourceId)
      if (ref === undefined) return undefined
      const denied = refusal(current, origin)
      if (denied !== undefined) throw new Error(denied)
      const query = ctx.get('sessionQuery')
      if (query === undefined) throw new Error('Prior-conversation recovery requires the Session query provider')
      // Listing checks the candidate header before a foreign conversation body is read.
      const record = (await query.listSessions(signal)).find(candidate => candidate.header.id === ref.sessionId)
      if (record === undefined || !sameRoot(current.header, record.header)) throw new Error('The referenced conversation is outside this research root')
      using observed = await query.observeSession(ref.sessionId, { ...(signal === undefined ? {} : { signal }), projectionMode: 'none' })
      if (!sameRoot(current.header, observed.header) || observed.cursor + 1 > config.maxRecoveryEvents) throw new Error('The referenced conversation cannot be inspected within this recovery scope and event bound')
      const events = observed.events
      const state = resolver?.observed(observed.header, events) ?? events.reduce(applyWorkingEvent, emptyWorkingState())
      if (!state.ownerOrigin || state.restricted) throw new Error('The referenced conversation is outside the allowed historical access scope')
      const entry = relevantEntries(ref.sessionId, events, state, origin).find(candidate => candidate.source.target === sourceId)
      if (entry === undefined) throw new Error('The referenced passage does not belong to this research direction')
      const header = `Historical source ${sourceId}; character offset ${offset} of ${entry.text.length}. Windowed original account; continue with offset.\n`
      const room = config.maxRecoveryCharacters - header.length
      if (room <= 0) throw new Error('Historical recovery budget cannot fit its source locator')
      return header + entry.text.slice(offset, offset + room)
    },
  }
}
