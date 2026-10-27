import { expect, it } from 'vitest'
import { SessionSeq } from '@deepseek-ai/dsh-session'
import { captureCompletedAnswer } from '../src/capture.ts'
import { answerFixture, ptcAnswerFixture } from './fixture.ts'

it('saves the actual answer, selected quotes and recorded request context with separate evidence labels', () => {
  const f = answerFixture()
  const answer = captureCompletedAnswer(f.session.id, f.events, f.answer.seq, [], 100)
  expect(answer.markdown).toBe('The conclusion holds only under A. Other pages remain unread.')
  expect(answer.capture).toMatchObject({ sessionId: f.session.id, seq: f.answer.seq, actor: 'model', provider: 'fixture', model: 'ordinary-harness' })
  expect(answer.capture.contexts.map(item => [item.name, item.seq])).toEqual([
    ['aitp-research-memory', f.context.seq], ['research_read_source', f.read.seq],
  ])
  expect(answer.citations.map(item => item.basis)).toEqual(['selected', 'recorded-context', 'recorded-source-read'])
  expect(answer.citations[0]?.selection.selectedText).toBe('Only under A.')
  expect(answer.citations[1]?.selection).toEqual(f.delivered)
  expect(JSON.stringify(answer)).not.toContain('fully-read')
})

it('rejects an interrupted prefix, a still-running turn and a failed attempt without fabricating an answer', () => {
  for (const options of [{ interrupted: true }, { complete: false }]) {
    const f = answerFixture(options)
    expect(() => captureCompletedAnswer(f.session.id, f.events, f.answer.seq, [], 100)).toThrow()
  }
  const f = answerFixture()
  const attempt = f.session.append('assistant/attempt', { turn: 2, step: 2, stream: [] })
  expect(() => captureCompletedAnswer(f.session.id, [...f.events, attempt], attempt.seq, [], 100)).toThrow('completed assistant answer')
  expect(() => captureCompletedAnswer(f.session.id, f.events, SessionSeq(999), [], 100)).toThrow('completed assistant answer')
  expect(() => captureCompletedAnswer(f.session.id, f.events, f.answer.seq, [], 2)).toThrow('capture event limit')
})

it('does not label failed source reads or projected-away context as captured evidence', () => {
  const f = answerFixture({ failedRead: true, projectContext: true })
  const answer = captureCompletedAnswer(f.session.id, f.events, f.answer.seq, f.projections, 100)
  expect(answer.capture.contexts).toEqual([])
  expect(answer.citations.map(item => item.basis)).toEqual(['selected'])
})

it('captures the retained direct result without restoring projected-away source text or citations', () => {
  const f = answerFixture({ projectRead: true })
  const answer = captureCompletedAnswer(f.session.id, f.events, f.answer.seq, f.projections, 100)
  expect(answer.capture.contexts.find(item => item.name === 'research_read_source'))
    .toEqual({ seq: f.read.seq, name: 'research_read_source', text: 'Context projected away.' })
  expect(answer.citations.filter(item => item.basis === 'recorded-source-read')).toEqual([])
})

it.each([false, true])('captures a returned PTC source read from the visible parent result (nested=%s)', (nested) => {
  const f = ptcAnswerFixture({ nested })
  const answer = captureCompletedAnswer(f.session.id, f.events, f.answer.seq, f.projections, 100)
  expect(f.session.deriveMessages().filter(message => message.role === 'tool').map(message => message.content))
    .toEqual([[{ type: 'text', text: f.output }]])
  expect(answer.capture.contexts).toEqual([{ seq: f.result!.seq, name: 'research_read_source', text: f.text }])
  expect(answer.citations).toEqual([{ selection: f.selection, basis: 'recorded-source-read', sessionId: f.session.id, seq: f.result!.seq }])
})

it('recognizes the exact JSON string encoding returned by a PTC program', () => {
  const f = ptcAnswerFixture({ nested: true, output: 'json' })
  const answer = captureCompletedAnswer(f.session.id, f.events, f.answer.seq, f.projections, 100)
  expect(answer.capture.contexts).toEqual([{ seq: f.result!.seq, name: 'research_read_source', text: f.text }])
  expect(answer.citations).toHaveLength(1)
})

it.each([
  { output: 'undelivered' }, { output: 'truncated' }, { output: 'missing' }, { projectOutput: true },
  { failedRead: true }, { failedParent: true }, { failedIntermediate: true }, { previousTurn: true },
  { missingStart: true }, { missingParent: true },
] as const)('does not attribute unverified PTC source delivery: %j', (control) => {
  const f = ptcAnswerFixture({ nested: true, ...control })
  const answer = captureCompletedAnswer(f.session.id, f.events, f.answer.seq, f.projections, 100)
  expect(answer.capture.contexts).toEqual([])
  expect(answer.citations).toEqual([])
})
