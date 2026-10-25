/** Replay of research working items using ordinary Session input and tool records. */
import { z } from 'zod'
import type { ContentBlock, UserMessage } from '@deepseek-ai/dsh-llm'
import { SessionSeq, type Session, type SessionEvent } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-user-questions'
import type { ResearchHumanInput, ResearchOrigin, ResearchWorkingState, ResearchWriteRecord } from './working-types.ts'

/** Existing tool-result carrier used for model-owned provisional items; it does not edit original human inputs. */
export const WORKING_TOOL = 'research_working_update'
const WRITE_TOOLS = new Set(['research_prepare_change', 'research_apply_change', 'research_recover_change'])
const writeOutcomeSchema = z.object({
  operationId: z.string().min(1),
  state: z.enum(['prepared', 'no-change', 'pending', 'applying', 'applied', 'not-applied', 'partial', 'unknown']),
})
/** Normalizes selected source addressing without treating a location or selected passage as an execution grant. */
export const originSchema = z.object({
  workspaceId: z.string().min(1), topicId: z.string().optional(), resourceId: z.string().optional(),
  anchor: z.string().optional(), selectedText: z.string().optional(),
  selectedTextFormat: z.enum(['source', 'rendered']).optional(),
  selectedRange: z.object({ start: z.number().int().nonnegative(), end: z.number().int().nonnegative(), text: z.string() })
    .refine(value => value.end > value.start && value.end - value.start === value.text.length).optional(),
}).transform((value): ResearchOrigin => ({
  workspaceId: value.workspaceId,
  ...(value.topicId === undefined ? {} : { topicId: value.topicId }),
  ...(value.resourceId === undefined ? {} : { resourceId: value.resourceId }),
  ...(value.anchor === undefined ? {} : { anchor: value.anchor }),
  ...(value.selectedText === undefined ? {} : { selectedText: value.selectedText }),
  ...(value.selectedTextFormat === undefined ? {} : { selectedTextFormat: value.selectedTextFormat }),
  ...(value.selectedRange === undefined ? {} : { selectedRange: value.selectedRange }),
}))
/** Validates provisional model content together with its scope and successful tool-call provenance. */
export const itemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['gap', 'result', 'failed-route', 'next-step', 'pending-integration']),
  text: z.string(), condition: z.string(), sourceIds: z.array(z.string()),
  origin: originSchema, sourceId: z.string(),
})
const humanResearchSourceSchema = z.object({ kind: z.literal('aitp-research'), actor: z.literal('human'), origin: originSchema })
/** Schema for a rebuildable Session projection; originals remain in their durable input and tool records. */
export const workingStateSchema = z.object({
  origin: originSchema.nullable(),
  ownerOrigin: z.boolean(), restricted: z.boolean(),
  humans: z.array(z.object({
    sourceId: z.string(), seq: z.number(),
    kind: z.enum(['user', 'aitp-research', 'user-question-reply', 'question-answer']),
    origin: originSchema, questionSeq: z.number().optional(),
  }).transform((value): ResearchHumanInput => ({
    sourceId: value.sourceId, seq: value.seq, kind: value.kind, origin: value.origin,
    ...(value.questionSeq === undefined ? {} : { questionSeq: value.questionSeq }),
  }))),
  items: z.array(itemSchema),
  pending: z.array(z.object({ callId: z.string(), name: z.string(), seq: z.number(), origin: originSchema })),
  writes: z.array(writeOutcomeSchema.extend({ origin: originSchema, sourceId: z.string(), prepareSeq: z.number(), seq: z.number() })),
})
/** Successful working-tool receipt shape; replay additionally checks matching call, scope and source identity. */
export const receiptSchema = z.object({
  operation: z.enum(['upsert', 'retire']), origin: originSchema,
  item: itemSchema,
})

/**
 * Start a projection without an inferred research scope or historical-read provenance.
 * @returns Empty derived state; no scientific note or parallel conversation record is created.
 */
export function emptyWorkingState(): ResearchWorkingState {
  return { origin: null, ownerOrigin: false, restricted: false, humans: [], items: [], pending: [], writes: [] }
}

/**
 * The standard RPC input producer records a principal only for a non-owner.
 * @param message Durable or pending input produced by Harness, not model-provided authority metadata.
 * @returns Whether a recorded principal requires restricting cross-session recovery.
 */
export function isNonOwnerInput(message: UserMessage): boolean {
  const source: object & { principal?: unknown } = message.source
  return source.principal !== undefined
}

/**
 * A selected resource is evidence within a topic, not a separate task namespace.
 * @param origin Human-selected workspace and optional topic, with optional source addressing.
 * @returns Stable equality key for that workspace/topic pair; it grants no access.
 */
export function scopeKey(origin: ResearchOrigin): string {
  return JSON.stringify([origin.workspaceId, origin.topicId ?? null])
}

/**
 * Keep source addressing in projections; the selected body remains in its original message.
 * @param origin Original selection, which may contain an excerpt.
 * @returns Addressing fields without duplicating the selected text into every derived item.
 */
export function originPointer(origin: ResearchOrigin): ResearchOrigin {
  const { selectedText: _selectedText, selectedRange: _selectedRange, ...pointer } = origin
  return pointer
}

/**
 * Extract the textual portion of an existing message without interpreting its authority.
 * @param content Original Harness content blocks; non-text blocks remain in their source record.
 * @returns Text blocks joined in their original order, or an empty string when none exist.
 */
export function contentText(content: readonly ContentBlock[]): string {
  return content.filter(block => block.type === 'text').map(block => block.text).join('\n')
}

/**
 * Preview an admitted human input without claiming it is already persisted.
 * @param state Previous projection, including pending questions and the current origin.
 * @param message Actual Harness human input; synthetic context is ignored and late replies retain their question scope.
 * @param seq Original Session sequence, or -1 for an input still being prepared for admission.
 * @returns Updated source pointers and access provenance, retaining the original human content in its carrier.
 */
export function acceptHumanInput(state: ResearchWorkingState, message: UserMessage, seq: number): ResearchWorkingState {
  if (isNonOwnerInput(message) && !state.restricted) state = { ...state, restricted: true }
  const source = message.source
  const explicit = source.kind === 'aitp-research' ? humanResearchSourceSchema.safeParse(source) : null
  let origin = explicit?.success === true ? explicit.data.origin : state.origin
  let questionSeq: number | undefined
  if (source.kind === 'user-question-reply') {
    const question = state.pending.find(call => call.callId === source.callId && call.name === 'ask_user_question')
    if (question === undefined) return state
    origin = question.origin
    questionSeq = question.seq
  }
  if (origin === null || (source.kind !== 'user' && source.kind !== 'user-question-reply' && explicit?.success !== true)) return state
  if (state.humans.some(input => input.sourceId === message.id)) return state
  return {
    ...state,
    origin: explicit?.success === true ? origin : state.origin,
    ownerOrigin: state.ownerOrigin || explicit?.success === true,
    pending: source.kind === 'user-question-reply'
      ? state.pending.filter(call => call.callId !== source.callId) : state.pending,
    humans: [...state.humans, {
      sourceId: message.id, seq, origin: originPointer(origin), kind: source.kind as ResearchHumanInput['kind'],
      ...(questionSeq === undefined ? {} : { questionSeq }),
    }],
  }
}

/**
 * Fold only completed, successful matching calls; duplicate delivery has no pending call.
 * @param state Derived state immediately before this event.
 * @param event Existing Session input, native tool or PTC record; unrelated events have no effect.
 * @returns Replayed pointers, provisional items and correlated write outcomes without a second transcript.
 */
export function applyWorkingEvent(state: ResearchWorkingState, event: SessionEvent): ResearchWorkingState {
  if (event.type === 'agent/inbox/spliced' && event.data.inserted.some(isNonOwnerInput)) {
    return state.restricted ? state : { ...state, restricted: true }
  }
  if (event.type === 'user/message') return acceptHumanInput(state, event.data, event.seq)
  if (event.type === 'tool/call' || event.type === 'tool/ptc-dispatch-start') {
    if (state.origin === null) return state
    const name = event.data.name
    if (name !== WORKING_TOOL && name !== 'ask_user_question' && !WRITE_TOOLS.has(name)) return state
    const callId = event.type === 'tool/call' ? event.data.callId : event.data.subCallId
    if (state.pending.some(call => call.callId === callId)) return state
    return { ...state, pending: [...state.pending, { callId, name, seq: event.seq, origin: originPointer(state.origin) }] }
  }
  if (event.type !== 'tool/result' && event.type !== 'tool/ptc-dispatch') return state
  const callId = event.type === 'tool/result' ? event.data.message.toolCallId : event.data.subCallId
  const call = state.pending.find(pending => pending.callId === callId)
  if (call === undefined) return state
  const isError = event.type === 'tool/result' ? event.data.message.isError === true : event.data.isError
  const content = event.type === 'tool/result' ? event.data.message.content : event.data.content
  if (WRITE_TOOLS.has(call.name)) {
    const settled = { ...state, pending: state.pending.filter(pending => pending.callId !== callId) }
    if (isError) return settled
    const meta = event.data.meta
    const outcome = z.object({ researchWrite: writeOutcomeSchema }).safeParse(meta)
    if (!outcome.success) return settled
    const previous = state.writes.find(write => write.operationId === outcome.data.researchWrite.operationId
      && scopeKey(write.origin) === scopeKey(call.origin))
    // An unbound result cannot recover proposal details from a different conversation.
    const prepareSeq = call.name === 'research_prepare_change' ? call.seq : previous?.prepareSeq
    if (prepareSeq === undefined) return settled
    const write: ResearchWriteRecord = {
      ...outcome.data.researchWrite, origin: call.origin, sourceId: callId, prepareSeq, seq: event.seq,
    }
    return { ...settled, writes: [...state.writes.filter(item => item !== previous), write] }
  }
  if (call.name === 'ask_user_question') {
    if (isError || state.humans.some(input => input.sourceId === `answer:${callId}`)) return state
    let answer: unknown
    try { answer = JSON.parse(contentText(content)) } catch { return state }
    const answered = z.object({ answers: z.array(z.object({
      id: z.string(), selected: z.array(z.string()), custom: z.string().optional(),
    })).min(1) }).safeParse(answer)
    if (!answered.success) return state
    return { ...state, pending: state.pending.filter(pending => pending.callId !== callId), humans: [...state.humans, {
      sourceId: `answer:${callId}`, seq: event.seq, kind: 'question-answer', origin: call.origin, questionSeq: call.seq,
    }] }
  }
  const settled = { ...state, pending: state.pending.filter(pending => pending.callId !== callId) }
  if (isError) return settled
  let raw: unknown
  try { raw = JSON.parse(contentText(content)) } catch { return settled }
  const parsed = receiptSchema.safeParse(raw)
  if (!parsed.success || scopeKey(parsed.data.origin) !== scopeKey(call.origin)
    || scopeKey(parsed.data.item.origin) !== scopeKey(call.origin)
    || parsed.data.item.sourceId !== callId) return settled
  const { item, operation } = parsed.data
  const items = state.items.filter(previous => previous.id !== item.id || scopeKey(previous.origin) !== scopeKey(call.origin))
  if (operation === 'upsert') items.push(item)
  return { ...settled, items }
}

/**
 * Read original statements and full question/options from their durable carriers.
 * @param session Owning Session, including original events shadowed by compaction.
 * @param input Scoped source pointer produced by replay, not a replacement summary.
 * @returns Original text with the complete recorded question/options when applicable; missing carriers contribute no text.
 */
export function readHumanInput(session: Session, input: ResearchHumanInput): string {
  return readHumanFromEvents((seq) => {
    // oxlint-disable-next-line typescript/no-deprecated -- Source-addressed recovery needs the original event, including compacted rows.
    return session.eventAt(SessionSeq(seq))
  }, input)
}

/**
 * Read original source carriers in a leased historical Session observation.
 * @param eventAt Exact event lookup within the already-authorized owning Session observation.
 * @param input Replayed pointer to the original input and, for replies, its question call.
 * @returns Original textual content paired with complete question arguments; this does not infer answerer identity.
 */
export function readHumanFromEvents(eventAt: (seq: number) => SessionEvent | undefined, input: ResearchHumanInput): string {
  const event = eventAt(input.seq)
  let text = event?.type === 'user/message' ? contentText(event.data.content)
    : event?.type === 'tool/result' ? contentText(event.data.message.content)
      : event?.type === 'tool/ptc-dispatch' ? contentText(event.data.content) : ''
  if (input.questionSeq !== undefined) {
    const question = eventAt(input.questionSeq)
    const asked = question?.type === 'tool/call' ? question.data.arguments
      : question?.type === 'tool/ptc-dispatch-start' ? JSON.stringify(question.data.arguments) : ''
    text = `Question and offered options: ${asked}\nHuman answer: ${text}`
  }
  return text
}

/**
 * Recover the editorial rationale and remaining uses even when the displayed result omitted them.
 * @param eventAt Exact event lookup within the owning Session, after the caller has checked its scope.
 * @param write Successful correlated writer outcome pointing to its original preparation call.
 * @returns Recorded edit state and original integration needs, or an explicit explanation that proposal details are unavailable.
 */
export function readWriteRecord(eventAt: (seq: number) => SessionEvent | undefined, write: ResearchWriteRecord): string {
  const event = eventAt(write.prepareSeq)
  const raw = event?.type === 'tool/call' ? event.data.arguments
    : event?.type === 'tool/ptc-dispatch-start' ? JSON.stringify(event.data.arguments) : ''
  let proposal: unknown
  try { proposal = JSON.parse(raw) } catch { proposal = null }
  const details = z.object({ rationale: z.string(), remainingUses: z.array(z.string()) }).safeParse(proposal)
  return `Source edit operation ${write.operationId}: ${write.state}. A saved file is not complete scientific integration.\n`
    + (details.success
      ? `Model's editorial rationale: ${details.data.rationale}\nRemaining scientific uses: ${JSON.stringify(details.data.remainingUses)}`
      : 'The original editorial rationale and remaining uses could not be recovered; inspect the preparation call.')
}

/**
 * Read a current Session's source-edit outcome without depending on a shortened tool summary.
 * @param session Session retaining the original preparation and successful outcome records.
 * @param write Scoped writer pointer produced only from a successful correlated tool result.
 * @returns Qualified editorial account; an applied file receipt does not establish complete scientific integration.
 */
export function readSessionWrite(session: Session, write: ResearchWriteRecord): string {
  return readWriteRecord((seq) => {
    // oxlint-disable-next-line typescript/no-deprecated -- The original preparation is the scoped source for editorial intent.
    return session.eventAt(SessionSeq(seq))
  }, write)
}
