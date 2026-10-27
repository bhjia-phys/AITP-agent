/** Read-only UI projection over one authorized, immutable Session observation. */
import { deriveEventMessage, foldSurface, type SessionEvent, type SessionMessageProjection } from '@deepseek-ai/dsh-session'
import type { SessionObservation } from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-agent-loop'
import type {} from '@deepseek-ai/dsh-compaction'
import { applyWorkingEvent, contentText, emptyWorkingState, scopeKey } from './working-state.ts'
import type { ResearchWorkingState } from './working-types.ts'
import type { AgentItem, ResearchContextSnapshot, ResearcherItem, SessionMemoryView, SourceItem, SummaryItem } from './session-view-types.ts'
import { materialSourceAddress } from '@deepseek-ai/dsh-research-resources/protocol'

/** Bounds apply to the complete serialized UI response, including references and notices. */
export interface SessionMemoryLimits {
  /** Maximum complete items across all displayed sections. */
  readonly maxItems: number
  /** Maximum characters in the complete JSON response. */
  readonly maxCharacters: number
}

/**
 * Replay existing accepted input and tool records without creating an Agent or another transcript.
 * @param events Exact authorized Session observation, in sequence order.
 * @returns Current scope and original/provisional pointers; failed or unpaired tool results are ignored.
 */
export function replaySessionWorkingState(events: readonly SessionEvent[]): ResearchWorkingState {
  return events.reduce(applyWorkingEvent, emptyWorkingState())
}

function pathOf(id: string | undefined, prefix: string): string | undefined {
  if (id === undefined || !id.startsWith(prefix)) return undefined
  try {
    const path = decodeURIComponent(id.slice(prefix.length))
    if (path.length === 0 || path.startsWith('/') || path.includes('\\') || path.split('/').some(part => part === '..' || part === '.')) return undefined
    return path
  } catch { return undefined }
}

/**
 * Present original inputs, successful model items and recorded request context without rereading sources.
 * @param observation Authorized immutable live or cold Session cut; the caller owns its lease.
 * @param state Working projection at the same cut, used for scope and successful-operation provenance.
 * @param limits Complete-result bounds; oversized units are omitted with a visible count, never paraphrased.
 * @param messageProjections Existing Session-owner interpreters, required when the log contains content projections.
 * @returns A bounded view, or undefined for an unbound ordinary Session.
 * @throws If the configured bound cannot contain the identity and omission notice.
 */
export function buildSessionMemoryView(
  observation: Pick<SessionObservation, 'header' | 'events'>,
  state: ResearchWorkingState,
  limits: SessionMemoryLimits,
  messageProjections: readonly SessionMessageProjection[] = [],
): SessionMemoryView | undefined {
  const origin = state.origin
  if (origin === null) return undefined
  if (!Number.isSafeInteger(limits.maxItems) || limits.maxItems < 1
    || !Number.isSafeInteger(limits.maxCharacters) || limits.maxCharacters < 1) {
    throw new Error('Session memory bounds must be positive safe integers')
  }
  const { events, header } = observation
  const bySeq = new Map(events.map(event => [Number(event.seq), event]))
  const turns = new Map<number, number>()
  const calls = new Map<string, number>()
  const scopes = new Map<number, string>()
  let scopedState = emptyWorkingState()
  let turn = 0
  for (const event of events) {
    scopedState = applyWorkingEvent(scopedState, event)
    if (scopedState.origin !== null) scopes.set(event.seq, scopeKey(scopedState.origin))
    if (event.type === 'turn/start') turn = event.data.turn
    turns.set(event.seq, turn)
    if (event.type === 'tool/result') calls.set(event.data.message.toolCallId, event.seq)
    if (event.type === 'tool/ptc-dispatch') calls.set(event.data.subCallId, event.seq)
  }
  const key = scopeKey(origin)
  const inputs = state.humans.filter(input => scopeKey(input.origin) === key)
  const humans: ResearcherItem[] = inputs.flatMap((input, index) => {
    const event = bySeq.get(input.seq)
    const text = event?.type === 'user/message' ? contentText(event.data.content)
      : event?.type === 'tool/result' ? contentText(event.data.message.content)
        : event?.type === 'tool/ptc-dispatch' ? contentText(event.data.content) : undefined
    if (text === undefined) return []
    const question = input.questionSeq === undefined ? undefined : bySeq.get(input.questionSeq)
    const questionText = question?.type === 'tool/call' ? question.data.arguments
      : question?.type === 'tool/ptc-dispatch-start' ? JSON.stringify(question.data.arguments) : undefined
    const answered = input.kind === 'question-answer' || input.kind === 'user-question-reply'
    return [{ id: input.sourceId, kind: answered ? 'answer' : index === 0 ? 'task' : 'input', text,
      turn: turns.get(input.seq) ?? 0, ...(questionText === undefined ? {} : { question: questionText }) }]
  })
  const agent: AgentItem[] = state.items.filter(item => scopeKey(item.origin) === key).map(item => ({
    id: item.id, kind: item.kind, text: item.text, turn: turns.get(calls.get(item.sourceId) ?? -1) ?? 0,
    status: 'active', ...(item.condition.length === 0 ? {} : { condition: item.condition }),
  }))
  const surface = foldSurface(events, messageProjections)
  const visible = new Set(surface.nodes)
  const latestContext = events.findLast(event => event.type === 'user/message'
    && event.data.source.kind === 'runtime-context' && visible.has(event.seq))
  const shadowedByCompaction = new Set(events.flatMap(event => event.type === 'compaction/summary' ? event.data.shadowedSeqs : []))
  const contexts: ResearchContextSnapshot[] = events.flatMap((event) => {
    if (event.type !== 'user/message' || event.data.source.kind !== 'runtime-context' || event.data.source.form !== 'snapshot') return []
    if (scopes.get(event.seq) !== key) return []
    const section = event.data.source.sections.find(item => item.name === 'aitp-research-memory')
    if (section === undefined) return []
    const projected = deriveEventMessage(event, surface.projectedMessages)
    const exactTextRetained = projected !== null && contentText(projected.content).includes(section.text)
    return [{ id: `context:${event.seq}`, turn: turns.get(event.seq) ?? 0, text: section.text,
      state: event === latestContext ? exactTextRetained ? 'current' : 'projected'
        : shadowedByCompaction.has(event.seq) && !visible.has(event.seq) ? 'condensed' : 'superseded' }]
  })
  const summaries: SummaryItem[] = events.flatMap(event => event.type === 'compaction/summary' && scopes.get(event.seq) === key ? [{
    id: `summary:${event.seq}`, turn: turns.get(event.seq) ?? 0,
    covers: [turns.get(event.data.shadowedRange.start) ?? 0, turns.get(event.data.shadowedRange.end) ?? 0],
  }] : [])
  const topicPath = origin.workspaceId === undefined ? undefined : pathOf(origin.topicId, 'topic:')
  const materialPath = origin.workspaceId === undefined ? undefined : pathOf(origin.resourceId, 'resource:')
  const source = (path: string, reason: 'owner' | 'selected', workspaceId: string): SourceItem => ({
    id: `${reason}:${path}`, label: path,
    address: `dsh-resource://aitp-note/workspace/${encodeURIComponent(workspaceId)}/note/${encodeURIComponent(path)}`,
    reason, requirement: reason === 'selected' ? 'researcher' : 'optional', state: { kind: 'unknown' },
  })
  const sources = [
    ...(topicPath === undefined || origin.workspaceId === undefined ? [] : [source(topicPath, 'owner', origin.workspaceId)]),
    ...(materialPath === undefined || materialPath === topicPath || origin.workspaceId === undefined ? [] : [source(materialPath, 'selected', origin.workspaceId)]),
    ...(origin.selections ?? []).map((selection): SourceItem => ({
      id: materialSourceAddress(selection.ref, selection.locator),
      label: `${selection.ref.rootId}: ${selection.ref.sourceId}`,
      address: materialSourceAddress(selection.ref, selection.locator),
      reason: 'selected', requirement: 'researcher', state: { kind: 'unknown' },
    })),
  ]
  const researcher: ResearcherItem[] = [], selectedAgent: AgentItem[] = [], selectedSources: SourceItem[] = []
  const selectedContexts: ResearchContextSnapshot[] = [], selectedSummaries: SummaryItem[] = []
  const coverage = { omittedItems: 0, contextRecorded: contexts.length > 0, sourceDelivery: 'context-only' as const }
  const view: SessionMemoryView = {
    origin: 'runtime', sessionId: header.id,
    ...(origin.scope === 'global' ? { sessionOrigin: { kind: 'global' as const } }
      : materialPath !== undefined ? { sessionOrigin: { kind: 'source' as const, label: materialPath, notePath: materialPath } }
        : topicPath !== undefined ? { sessionOrigin: { kind: 'topic' as const, topic: topicPath, notePath: topicPath } } : {}),
    researcher, agent: selectedAgent, gaps: [], sources: selectedSources, rules: [], summaries: selectedSummaries,
    contextSnapshots: selectedContexts, coverage,
  }
  let count = 0
  const total = humans.length + agent.length + sources.length + contexts.length + summaries.length
  coverage.omittedItems = total
  if (JSON.stringify(view).length > limits.maxCharacters) throw new Error('Session memory bound cannot fit its identity and omission notice')
  function admit<T>(target: T[], item: T): void {
    if (count >= limits.maxItems) return
    target.push(item)
    coverage.omittedItems--
    if (JSON.stringify(view).length > limits.maxCharacters) { target.pop(); coverage.omittedItems++; return }
    count++
  }
  // Preserve the task and most recent correction before older detail; complete oversized units stay omitted.
  const rankedHumans = [...new Set([humans[0], ...humans.toReversed()])]
  for (const item of rankedHumans) if (item !== undefined) admit(researcher, item)
  for (const item of agent.toReversed()) admit(selectedAgent, item)
  for (const item of sources) admit(selectedSources, item)
  for (const item of contexts.toReversed()) admit(selectedContexts, item)
  for (const item of summaries.toReversed()) admit(selectedSummaries, item)
  const humanOrder = new Map(humans.map((item, index) => [item.id, index]))
  researcher.sort((left, right) => (humanOrder.get(left.id) ?? 0) - (humanOrder.get(right.id) ?? 0))
  selectedAgent.reverse(); selectedContexts.reverse(); selectedSummaries.reverse()
  return view
}
