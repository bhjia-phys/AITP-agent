/** Capture existing completed assistant messages without a second transcript or model runtime. */
import { deriveEventMessage, foldSurface, isAppendSurfaceEvent } from '@deepseek-ai/dsh-session'
import type { SessionEvent, SessionId, SessionMessageProjection, SessionSeq } from '@deepseek-ai/dsh-session'
import type { SourceSelection } from '@deepseek-ai/dsh-research-resources/types'
import { parseMaterialSource } from '@deepseek-ai/dsh-research-resources/protocol'
import type {} from '@deepseek-ai/dsh-agent-loop'
import type {} from '@deepseek-ai/dsh-tools/types'
import { z } from 'zod'
import type { StudyAnswerCapture, StudyCitation } from './types.ts'
import { StudyError, selectionSchema } from './store.ts'

/** Actual answer text and its recorded selected/delivered-source evidence. */
export interface CapturedAnswer {
  readonly markdown: string
  readonly citations: readonly StudyCitation[]
  readonly capture: StudyAnswerCapture
}
const selectedSource = z.object({ kind: z.literal('aitp-research'), actor: z.literal('human'),
  origin: z.object({ selections: z.array(selectionSchema).optional() }) })

function citations(text: string, basis: StudyCitation['basis'], sessionId: SessionId, seq: SessionSeq): StudyCitation[] {
  return [...text.matchAll(/dsh-resource:\/\/aitp-material-source\/[^\s\]<>"`]+/gu)].flatMap((match) => {
    const parsed = parseMaterialSource(match[0])
    return parsed === undefined ? [] : [{ selection: parsed, basis, sessionId, seq }]
  })
}

/**
 * Read one exact completed turn's last textual answer; failed attempts and interrupted prefixes fail.
 * @param sessionId - observed Session identity, never a newly constructed conversation.
 * @param events - canonical immutable Session observation.
 * @param seq - existing selected assistant event.
 * @param projections - Session owner's registered surface interpreters.
 * @param maxEvents - bound on event processing; excess remains visible as a failure.
 * @returns exact text blocks, citations and attributed context at this answer's cut.
 */
export function captureCompletedAnswer(sessionId: SessionId, events: readonly SessionEvent[], seq: SessionSeq,
  projections: readonly SessionMessageProjection[], maxEvents: number): CapturedAnswer {
  if (events.length > maxEvents) throw new StudyError({ code: 'unavailable', message: 'The Session exceeds this capture event limit; its original answer was retained.', retryable: false })
  const target = events.find(event => event.seq === seq)
  if (target?.type !== 'assistant/message' || !isAppendSurfaceEvent(target) || target.data.interrupted === true) {
    throw new StudyError({ code: 'invalid-request', message: 'Choose a completed assistant answer, rather than an attempt or interrupted prefix.', retryable: false })
  }
  const turnEnd = events.find(event => event.seq > seq && event.type === 'turn/end' && event.data.turn === target.data.turn)
  if (turnEnd?.type !== 'turn/end' || turnEnd.data.reason.kind !== 'completed'
    || events.some(event => event.seq > seq && event.seq < turnEnd.seq && event.type === 'assistant/message')
    || target.data.message.content.some(block => block.type === 'tool-call')) {
    throw new StudyError({ code: 'invalid-request', message: 'The selected answer has not completed its turn. Wait for its final reply before saving.', retryable: true })
  }
  const markdown = target.data.message.content.filter(block => block.type === 'text').map(block => block.text).join('\n')
  if (!markdown.trim()) throw new StudyError({ code: 'invalid-request', message: 'The selected answer has no completed textual content to save.', retryable: false })
  const prefix = events.filter(event => event.seq <= seq)
  const surface = foldSurface(prefix, projections)
  const visible = new Set(surface.nodes)
  let selected: SessionEvent<'user/message'> | undefined
  let selections: readonly SourceSelection[] = []
  for (const event of prefix) {
    if (event.type !== 'user/message') continue
    const parsed = selectedSource.safeParse(event.data.source)
    if (!parsed.success) continue
    selected = event
    selections = parsed.data.origin.selections ?? []
  }
  const refs: StudyCitation[] = selections.map(selection => ({ selection, basis: 'selected', sessionId,
    ...(selected === undefined ? {} : { seq: selected.seq }) }))
  const contexts: StudyAnswerCapture['contexts'][number][] = []
  const context = prefix.findLast(event => event.type === 'user/message' && event.data.source.kind === 'runtime-context'
    && event.data.source.form === 'snapshot' && visible.has(event.seq))
  if (context?.type === 'user/message' && context.data.source.kind === 'runtime-context' && context.data.source.form === 'snapshot') {
    const projected = deriveEventMessage(context, surface.projectedMessages)
    const retained = projected?.content.filter(block => block.type === 'text').map(block => block.text).join('\n') ?? ''
    for (const section of context.data.source.sections) {
      if (section.name !== 'aitp-research-memory' || !retained.includes(section.text)) continue
      contexts.push({ seq: context.seq, name: section.name, text: section.text })
      refs.push(...citations(section.text, 'recorded-context', sessionId, context.seq))
    }
  }
  const calls = new Map(prefix.flatMap(event => event.type === 'tool/call' && event.data.turn === target.data.turn
    ? [[event.data.callId, event] as const] : []))
  const starts = new Map(prefix.flatMap(event => event.type === 'tool/ptc-dispatch-start'
    ? [[event.data.subCallId, event] as const] : []))
  const dispatches = new Map(prefix.flatMap(event => event.type === 'tool/ptc-dispatch'
    ? [[event.data.subCallId, event] as const] : []))
  const nestedReads = new Map<SessionEvent<'tool/call'>['data']['callId'], SessionEvent<'tool/ptc-dispatch'>[]>()
  for (const event of dispatches.values()) {
    if (event.data.name !== 'research_read_source' || event.data.isError) continue
    const reads = nestedReads.get(event.data.rootCallId) ?? []
    reads.push(event)
    nestedReads.set(event.data.rootCallId, reads)
  }
  const pairedStart = (event: SessionEvent<'tool/ptc-dispatch'>): SessionEvent<'tool/ptc-dispatch-start'> | undefined => {
    const start = starts.get(event.data.subCallId)
    return start !== undefined && start.seq < event.seq && start.data.name === event.data.name
      && start.data.rootCallId === event.data.rootCallId && start.data.parentCallId === event.data.parentCallId ? start : undefined
  }
  const recordRead = (text: string, seq: SessionSeq): void => {
    if (contexts.some(context => context.seq === seq && context.name === 'research_read_source' && context.text === text)) return
    contexts.push({ seq, name: 'research_read_source', text })
    refs.push(...citations(text, 'recorded-source-read', sessionId, seq))
  }
  for (const event of prefix) {
    if (event.type !== 'tool/result' || event.data.message.isError || event.data.turn !== target.data.turn || !visible.has(event.seq)) continue
    const call = calls.get(event.data.message.toolCallId)
    if (call === undefined || call.seq >= event.seq) continue
    const retained = deriveEventMessage(event, surface.projectedMessages)
    if (retained?.role !== 'tool' || retained.isError || retained.toolCallId !== call.data.callId) continue
    const text = retained.content.filter(block => block.type === 'text').map(block => block.text).join('\n')
    if (call.data.name === 'research_read_source') { recordRead(text, event.seq); continue }
    if (call.data.name !== 'run_code') continue
    for (const read of nestedReads.get(call.data.callId) ?? []) {
      let child = read
      let start = pairedStart(child)
      if (start === undefined || child.seq >= event.seq) continue
      // Log-only dispatches require a complete enclosing chain and evidence in the model-visible root result.
      while (child.data.parentCallId !== call.data.callId) {
        const parent = dispatches.get(child.data.parentCallId)
        const parentStart = parent === undefined ? undefined : pairedStart(parent)
        if (parent === undefined || parentStart === undefined || parent.data.isError
          || parent.data.rootCallId !== call.data.callId || parent.seq <= child.seq || parent.seq >= event.seq
          || parentStart.seq >= start.seq) { start = undefined; break }
        child = parent
        start = parentStart
      }
      if (start === undefined || start.seq <= call.seq) continue
      const passage = read.data.content.filter(block => block.type === 'text').map(block => block.text).join('\n')
      if (passage.trim() && (text.includes(passage) || text.includes(JSON.stringify(passage)))) recordRead(passage, event.seq)
    }
  }
  return { markdown, citations: refs.filter((item, index, array) =>
    array.findIndex(other => JSON.stringify(other) === JSON.stringify(item)) === index),
  capture: { sessionId, seq, messageId: target.data.message.id, provider: target.data.message.source.provider,
    model: target.data.message.source.model, actor: 'model', contexts } }
}
