/** Real Harness Session fixtures shared by draft-capture checks. */
import { deriveEventMessage, Session, SessionId, type SessionEvent, type SessionMessageProjection } from '@deepseek-ai/dsh-session'
import { createAssistantMessage, createToolResultMessage, createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import { materialSourceAddress } from '@deepseek-ai/dsh-research-resources/protocol'
import { sourceIdForPath, sourceRootId } from '@deepseek-ai/dsh-research-resources'
import type {} from '@deepseek-ai/dsh-agent-loop'
import type {} from '@deepseek-ai/dsh-research-memory/types'

/** @returns a completed canonical answer with selected, delivered and failed-read source controls. */
export function answerFixture(options: {
  interrupted?: boolean
  complete?: boolean
  failedRead?: boolean
  projectContext?: boolean
  projectRead?: boolean
} = {}) {
  const projection: SessionMessageProjection<'study-test/project'> = { type: 'study-test/project',
    project(event, context) {
      const original = context.events.find(item => item.seq === event.data.seq)
      const message = original === undefined ? null : deriveEventMessage(original, context.messages)
      if (message === null) throw new Error('The projected context is missing.')
      return new Map([[event.data.seq, { ...message, content: [{ type: 'text', text: 'Context projected away.' }] }]])
    } }
  const projections = options.projectContext || options.projectRead ? [projection] : []
  const session = Session.create(SessionId('study-answer'), undefined, undefined, undefined, projections)
  const events: SessionEvent[] = []
  const save = <T extends SessionEvent>(event: T): T => { events.push(event); return event }
  const selection = { ref: { rootId: sourceRootId('paper-root'), sourceId: sourceIdForPath('paper.md') },
    selectedText: 'Only under A.' }
  const delivered = { ref: selection.ref, locator: { kind: 'text' as const, start: 0, end: 13, quote: 'Only under A.' } }
  const address = materialSourceAddress(delivered.ref, delivered.locator)
  save(session.append('turn/start', { turn: 1 }))
  save(session.append('step/start', { turn: 1, step: 1 }))
  save(session.append('user/message', createUserMessage({ source: { kind: 'aitp-research', actor: 'human',
    origin: { scope: 'global', studyId: 'reading-set', selections: [selection] } },
  content: [{ type: 'text', text: 'Explain the actual selected condition.' }] }), { surfaceOp: 'append' }))
  const contextText = `Source passage [${address}]:\nOnly under A.\nUnavailable source: other pages not delivered.`
  const context = save(session.append('user/message', createUserMessage({
    source: { kind: 'runtime-context', form: 'snapshot', sections: [{ name: 'aitp-research-memory', text: contextText }] },
    content: [{ type: 'text', text: contextText }],
  }), { surfaceOp: 'append' }))
  if (options.projectContext) save(session.append('study-test/project', { seq: context.seq }))
  const callId = ToolCallId('read-one')
  save(session.append('tool/call', { turn: 1, step: 1, callId, name: 'research_read_source', arguments: '{"sourceIndex":1}' }))
  const read = save(session.append('tool/result', { turn: 1, step: 1,
    message: createToolResultMessage({ callId, isError: options.failedRead ?? false,
      content: [{ type: 'text', text: `Current reading: ${address}\nOnly under A.` }] }),
  }, { surfaceOp: 'append' }))
  if (options.projectRead) save(session.append('study-test/project', { seq: read.seq }))
  const answer = save(session.append('assistant/message', { turn: 1, step: 1, stream: [],
    ...(options.interrupted ? { interrupted: true as const } : {}),
    message: createAssistantMessage({ source: { provider: 'fixture', model: 'ordinary-harness' },
      content: [{ type: 'text', text: 'The conclusion holds only under A. Other pages remain unread.' }] }),
  }, { surfaceOp: 'append' }))
  if (options.complete !== false) {
    save(session.append('step/end', { turn: 1, step: 1 }))
    save(session.append('turn/end', { turn: 1, reason: { kind: 'completed' } }))
  }
  return { session, events, answer, read, context, selection, delivered, contextText, projections }
}

/** Canonical PTC events are log-only; only the retained root result supplies model content. */
export function ptcAnswerFixture(options: {
  nested?: boolean
  output?: 'text' | 'json' | 'undelivered' | 'truncated' | 'missing'
  projectOutput?: boolean
  failedRead?: boolean
  failedParent?: boolean
  failedIntermediate?: boolean
  previousTurn?: boolean
  missingStart?: boolean
  missingParent?: boolean
} = {}) {
  const projection: SessionMessageProjection<'study-test/project'> = { type: 'study-test/project',
    project(event, context) {
      const original = context.events.find(item => item.seq === event.data.seq)
      const message = original === undefined ? null : deriveEventMessage(original, context.messages)
      if (message === null) throw new Error('The projected result is missing.')
      return new Map([[event.data.seq, { ...message, content: [{ type: 'text', text: 'Result projected away.' }] }]])
    } }
  const projections = options.projectOutput ? [projection] : []
  const session = Session.create(SessionId('study-ptc-answer'), undefined, undefined, undefined, projections)
  session.append('turn/start', { turn: 1 })
  session.append('step/start', { turn: 1, step: 1 })
  const rootCallId = ToolCallId('program')
  const parentCallId = ToolCallId('program:ptc:1')
  const selection = { ref: { rootId: sourceRootId('paper-root'), sourceId: sourceIdForPath('nested.md') },
    locator: { kind: 'anchor' as const, anchor: 'condition' } }
  const text = `Current reading: ${materialSourceAddress(selection.ref, selection.locator)}\nThe returned condition is A.\nOther pages remain unread.`
  session.append('tool/call', { turn: 1, step: 1, callId: rootCallId, name: 'run_code', arguments: '{"code":"return await tools.research_read_source({sourceIndex:1})"}' })
  const parent = { rootCallId, parentCallId: rootCallId, subCallId: parentCallId, name: 'run_code', arguments: { code: 'return await tools.research_read_source({sourceIndex:1})' } }
  if (options.nested && !options.missingParent) session.append('tool/ptc-dispatch-start', parent)
  const read = { rootCallId, parentCallId: options.nested ? parentCallId : rootCallId,
    subCallId: ToolCallId('program:ptc:1:ptc:1'), name: 'research_read_source', arguments: { sourceIndex: 1 } }
  if (!options.missingStart) session.append('tool/ptc-dispatch-start', read)
  const dispatch = session.append('tool/ptc-dispatch', { ...read, isError: options.failedRead ?? false, content: [{ type: 'text', text }] })
  if (options.nested && !options.missingParent) session.append('tool/ptc-dispatch', { ...parent,
    isError: options.failedIntermediate ?? options.failedParent ?? false, content: [{ type: 'text', text: JSON.stringify({ text }, null, 2) }] })
  const output = options.output === 'undelivered' ? '(run_code completed with no output)'
    : options.output === 'truncated' ? `${text.slice(0, -30)}\n[output truncated]`
      : options.output === 'json' ? JSON.stringify({ text }, null, 2) : text
  const result = options.output === 'missing' ? undefined : session.append('tool/result', { turn: 1, step: 1,
    message: createToolResultMessage({ callId: rootCallId, isError: options.failedParent ?? false,
      content: [{ type: 'text', text: output }] }),
  }, { surfaceOp: 'append' })
  if (options.projectOutput && result !== undefined) session.append('study-test/project', { seq: result.seq })
  if (options.previousTurn) {
    session.append('assistant/message', { turn: 1, step: 1, stream: [],
      message: createAssistantMessage({ source: { provider: 'fixture', model: 'ordinary-harness' },
        content: [{ type: 'text', text: 'An earlier answer.' }] }),
    }, { surfaceOp: 'append' })
    session.append('step/end', { turn: 1, step: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    session.append('turn/start', { turn: 2 })
    session.append('step/start', { turn: 2, step: 2 })
  }
  const turn = options.previousTurn ? 2 : 1
  const answer = session.append('assistant/message', { turn, step: turn, stream: [],
    message: createAssistantMessage({ source: { provider: 'fixture', model: 'ordinary-harness' },
      content: [{ type: 'text', text: 'Only the returned condition can support this explanation.' }] }),
  }, { surfaceOp: 'append' })
  session.append('step/end', { turn, step: turn })
  session.append('turn/end', { turn, reason: { kind: 'completed' } })
  return { session, events: session.snapshotEvents(), answer, dispatch, result, selection, text, output, projections }
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap { 'study-test/project': { seq: SessionSeq } }
}
