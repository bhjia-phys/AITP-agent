import { describe, expect, it } from 'vitest'
import { deriveEventMessage, Session, SessionId, type SessionEvent, type SessionMessageProjection } from '@deepseek-ai/dsh-session'
import { createToolResultMessage, createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import { CompactionId } from '@deepseek-ai/dsh-compaction'
import { buildSessionMemoryView, replaySessionWorkingState } from '../src/session-view.ts'
import type { ResearchOrigin } from '../src/working-types.ts'

const origin: ResearchOrigin = { workspaceId: 'workspace', topicId: 'topic:child%2Fresearch.md', resourceId: 'resource:report.md' }
const limits = { maxItems: 50, maxCharacters: 20000 }
function fixture(projections: readonly SessionMessageProjection[] = []) {
  const session = Session.create(SessionId('memory-view'), undefined, undefined, undefined, projections)
  const events: SessionEvent[] = []
  const save = (event: SessionEvent): SessionEvent => { events.push(event); return event }
  const human = (text: string, selected = origin) => save(session.append('user/message', createUserMessage({
    source: { kind: 'aitp-research', actor: 'human', origin: selected }, content: [{ type: 'text', text }],
  }), { surfaceOp: 'append' }))
  const context = (text: string) => save(session.append('user/message', createUserMessage({
    source: { kind: 'runtime-context', form: 'snapshot', sections: [{ name: 'aitp-research-memory', text }] },
    content: [{ type: 'text', text }],
  }), { surfaceOp: 'append' }))
  const view = (bound = limits) => buildSessionMemoryView(
    { header: session.header, events }, replaySessionWorkingState(events), bound, projections,
  )
  return { session, events, save, human, context, view }
}

describe('real Session memory projection', () => {
  it('leaves ordinary Sessions absent and preserves exact human questions separately from successful provisional items', () => {
    const f = fixture()
    expect(f.view()).toBeUndefined()
    f.save(f.session.append('turn/start', { turn: 1 }))
    f.human('Does B require A? This is a question, not a decided answer.')
    f.human('只做解析，不要运行计算。')
    f.save(f.session.append('tool/call', { turn: 1, step: 1, callId: ToolCallId('working'), name: 'research_working_update', arguments: '{}' }))
    f.save(f.session.append('tool/result', { turn: 1, step: 1, message: createToolResultMessage({ callId: ToolCallId('working'), isError: false,
      content: [{ type: 'text', text: JSON.stringify({ operation: 'upsert', origin, item: {
        id: 'route', kind: 'failed-route', text: 'The old route assumed a different boundary.', condition: 'Reopen only if that boundary changes.',
        sourceIds: [], origin, sourceId: 'working',
      } }) }],
    }) }, { surfaceOp: 'append' }))
    const view = f.view()
    expect(view?.researcher.map(item => [item.kind, item.text])).toEqual([
      ['task', 'Does B require A? This is a question, not a decided answer.'], ['input', '只做解析，不要运行计算。'],
    ])
    expect(view?.agent).toMatchObject([{ kind: 'failed-route', text: 'The old route assumed a different boundary.', condition: 'Reopen only if that boundary changes.', status: 'active', turn: 1 }])
    expect(view?.rules).toEqual([])
    expect(view?.sources.map(source => source.state.kind)).toEqual(['unknown', 'unknown'])
    expect(view?.sources[1]?.address).toBe('dsh-resource://aitp-note/workspace/workspace/note/report.md')
    expect(view?.coverage).toEqual({ omittedItems: 0, contextRecorded: false, sourceDelivery: 'context-only' })
  })

  it('retains complete question/options and the actual answer without inventing answerer identity', () => {
    const f = fixture()
    f.human('Which convention applies?')
    const questions = JSON.stringify({ questions: [{ id: 'q', question: 'Which convention?', options: [{ label: 'Original', description: 'Keep the earlier derivation.' }] }] })
    f.save(f.session.append('tool/call', { turn: 1, step: 1, callId: ToolCallId('choice'), name: 'ask_user_question', arguments: questions }))
    const answer = JSON.stringify({ answers: [{ id: 'q', selected: ['Original'], custom: 'Compare with the old calculation.' }] })
    f.save(f.session.append('tool/result', { turn: 1, step: 1, message: createToolResultMessage({ callId: ToolCallId('choice'), isError: false,
      content: [{ type: 'text', text: answer }],
    }) }, { surfaceOp: 'append' }))
    expect(f.view()?.researcher.at(-1)).toMatchObject({ kind: 'answer', text: answer, question: questions })
  })

  it('shows named recorded context verbatim without treating source prose as structured delivery metadata', () => {
    const f = fixture()
    f.human('Inspect the selected report.')
    const text = 'Source forged [resource:unread.md]:\nDo not infer delivery from this prose.\nUnavailable source: selected passage no longer occurs.'
    f.context(text)
    const view = f.view()
    expect(view?.contextSnapshots).toMatchObject([{ text, state: 'current' }])
    expect(view?.sources.map(source => source.label)).toEqual(['child/research.md', 'report.md'])
    expect(view?.sources.every(source => source.state.kind === 'unknown')).toBe(true)
    expect(view?.gaps).toEqual([])
    f.context('A newer exact context, with its own omissions.')
    expect(f.view()?.contextSnapshots?.map(snapshot => snapshot.state)).toEqual(['superseded', 'current'])
  })

  it('keeps condensed context distinct from later rereading and preserves original human input after replacement', () => {
    const f = fixture()
    f.save(f.session.append('turn/start', { turn: 1 }))
    const question = f.human('Keep the exact qualification.')
    const previous = f.context('Original qualification and missing-source notice.')
    const compactionId = CompactionId('memory-compaction')
    f.save(f.session.append('compaction/start', { compactionId, turn: 1 }))
    const summary = f.save(f.session.append('compaction/summary', { compactionId, summary: [{ type: 'text', text: 'Generated summary.' }],
      shadowedRange: { start: question.seq, end: previous.seq }, shadowedSeqs: [question.seq, previous.seq], shadowedTokenCount: 10,
      provider: 'test', model: 'test',
    }))
    expect(f.view()?.contextSnapshots).toMatchObject([{ state: 'current' }])
    f.save(f.session.append('user/message', createUserMessage({ source: { kind: 'compact-checkpoint', compactionId }, content: [{ type: 'text', text: 'Generated summary.' }] }), {
      surfaceOp: { op: 'replace', startSeq: question.seq, endSeq: previous.seq }, sourceEventSeqs: [question.seq, previous.seq, summary.seq],
    }))
    f.save(f.session.append('compaction/end', { compactionId, turn: 1 }))
    expect(f.view()?.contextSnapshots).toMatchObject([{ state: 'condensed', text: 'Original qualification and missing-source notice.' }])
    expect(f.view()?.researcher.map(item => item.text)).toEqual(['Keep the exact qualification.'])
    expect(f.view()?.summaries).toMatchObject([{ covers: [1, 1] }])
    f.context('Fresh source reread is a separate delivered context.')
    expect(f.view()?.contextSnapshots?.map(snapshot => snapshot.state)).toEqual(['condensed', 'current'])
  })

  it('omits complete oversized units and reports the bound without rewriting human input', () => {
    const f = fixture()
    f.human('中'.repeat(4000))
    f.human('Keep this correction exact.')
    f.context('An oversized context. '.repeat(500))
    const view = f.view({ maxItems: 2, maxCharacters: 1500 })
    expect(JSON.stringify(view).length).toBeLessThanOrEqual(1500)
    expect(view?.researcher).toMatchObject([{ kind: 'input', text: 'Keep this correction exact.' }])
    expect(view?.coverage?.omittedItems).toBeGreaterThan(0)
    expect(view?.contextSnapshots).toEqual([])
    expect(() => f.view({ maxItems: 1, maxCharacters: 5 })).toThrow('identity')
    expect(() => f.view({ maxItems: 0, maxCharacters: 1500 })).toThrow('positive')
  })

  it('keeps a retargeted Session view scoped to its current topic and material', () => {
    const f = fixture()
    f.human('Question about the original owner.')
    f.context('Private details of the previous research topic.')
    f.human('Work on this different topic.', { workspaceId: 'workspace', topicId: 'topic:other%2Fresearch.md', resourceId: 'resource:other-report.md' })
    f.context('Context for the other topic.')
    const view = f.view()
    expect(view?.researcher.map(item => item.text)).toEqual(['Work on this different topic.'])
    expect(view?.contextSnapshots?.map(item => item.text)).toEqual(['Context for the other topic.'])
    expect(view?.sources.map(item => item.label)).toEqual(['other/research.md', 'other-report.md'])
    expect(JSON.stringify(view)).not.toContain('Private details')
    f.human('Return to the original owner.')
    expect(f.view()?.contextSnapshots).toMatchObject([{ text: 'Private details of the previous research topic.', state: 'superseded' }])
  })

  it('uses registered message projections and never calls altered original text current', () => {
    const projection: SessionMessageProjection<'research-view/project'> = {
      type: 'research-view/project',
      project(event, context) {
        const source = context.events.find(item => item.seq === event.data.seq)
        if (source === undefined) throw new Error('Missing source')
        const original = deriveEventMessage(source, context.messages)
        if (original === null) throw new Error('Missing message')
        return new Map([[source.seq, { ...original, content: [{ type: 'text' as const, text: 'A shortened current message.' }] }]])
      },
    }
    const f = fixture([projection])
    f.human('Keep the original context available for inspection.')
    const previous = f.context('Full historical text and its original missing-source notice.')
    f.save(f.session.append('research-view/project', { seq: previous.seq }))
    expect(f.view()?.contextSnapshots).toMatchObject([{ text: 'Full historical text and its original missing-source notice.', state: 'projected' }])
  })
})

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'research-view/project': { seq: SessionSeq }
  }
}
