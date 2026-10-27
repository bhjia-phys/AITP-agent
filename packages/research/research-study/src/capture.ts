/** Capture existing completed assistant messages without a second transcript or model runtime. */
import { deriveEventMessage, foldSurface, isAppendSurfaceEvent } from '@deepseek-ai/dsh-session'
import type { SessionEvent, SessionId, SessionMessageProjection, SessionSeq } from '@deepseek-ai/dsh-session'
import type { SourceSelection } from '@deepseek-ai/dsh-research-resources/types'
import { parseMaterialSource } from '@deepseek-ai/dsh-research-resources/protocol'
import type {} from '@deepseek-ai/dsh-agent-loop'
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
  const reads = new Set(prefix.flatMap(event => event.type === 'tool/call' && event.data.name === 'research_read_source'
    && event.data.turn === target.data.turn ? [event.data.callId] : []))
  for (const event of prefix) {
    if (event.type !== 'tool/result' || event.data.message.isError || !reads.has(event.data.message.toolCallId)
      || !visible.has(event.seq)) continue
    const text = event.data.message.content.filter(block => block.type === 'text').map(block => block.text).join('\n')
    contexts.push({ seq: event.seq, name: 'research_read_source', text })
    refs.push(...citations(text, 'recorded-source-read', sessionId, event.seq))
  }
  return { markdown, citations: refs.filter((item, index, array) =>
    array.findIndex(other => JSON.stringify(other) === JSON.stringify(item)) === index),
  capture: { sessionId, seq, messageId: target.data.message.id, provider: target.data.message.source.provider,
    model: target.data.message.source.model, actor: 'model', contexts } }
}
