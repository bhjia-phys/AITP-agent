/** Real Harness Session fixtures shared by draft-capture checks. */
import { deriveEventMessage, Session, SessionId, type SessionEvent, type SessionMessageProjection } from '@deepseek-ai/dsh-session'
import { createAssistantMessage, createToolResultMessage, createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import { materialSourceAddress } from '@deepseek-ai/dsh-research-resources/protocol'
import { sourceIdForPath, sourceRootId } from '@deepseek-ai/dsh-research-resources'
import type {} from '@deepseek-ai/dsh-agent-loop'
import type {} from '@deepseek-ai/dsh-research-memory/types'

/** @returns a completed canonical answer with selected, delivered and failed-read source controls. */
export function answerFixture(options: { interrupted?: boolean; complete?: boolean; failedRead?: boolean; projectContext?: boolean } = {}) {
  const projection: SessionMessageProjection<'study-test/project'> = { type: 'study-test/project',
    project(event, context) {
      const original = context.events.find(item => item.seq === event.data.seq)
      const message = original === undefined ? null : deriveEventMessage(original, context.messages)
      if (message === null) throw new Error('The projected context is missing.')
      return new Map([[event.data.seq, { ...message, content: [{ type: 'text', text: 'Context projected away.' }] }]])
    } }
  const projections = options.projectContext ? [projection] : []
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

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap { 'study-test/project': { seq: SessionSeq } }
}
