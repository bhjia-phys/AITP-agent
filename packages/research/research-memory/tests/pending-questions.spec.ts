import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createToolResultMessage, createUserMessage, LlmAdapter, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { Session, SessionId, TOOL_OUTCOME_UNKNOWN } from '@deepseek-ai/dsh-session'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { installRuntime } from '../src/runtime.ts'
import { applyWorkingEvent, emptyWorkingState, readHumanInput } from '../src/working-state.ts'
import { unansweredQuestionEntries } from '../src/question-context.ts'
import type { ResearchOrigin, ResearchRuntimeConfig } from '../src/working-types.ts'

const origin: ResearchOrigin = { workspaceId: 'pending-workspace', topicId: 'pending-branch' }
const config: ResearchRuntimeConfig = {
  maxContextCharacters: 12000, maxWorkingItems: 12, maxItemCharacters: 2000,
  maxHumanInputs: 8, maxHumanCharacters: 6000,
}
const question = { questions: [{ id: 'boundary', question: '保留哪种边界条件？', options: [
  { label: '周期边界', description: '保留平移对称' }, { label: '开边界', description: '改变边界作用' },
] }] }
const roots: Context[] = []
afterEach(async () => { for (const ctx of roots.splice(0)) await ctx.fiber.dispose() })

function human(text: string, selected = origin) {
  return createUserMessage({ source: { kind: 'aitp-research', actor: 'human', origin: selected }, content: [{ type: 'text', text }] })
}

function response(text: string): StreamChunk[] {
  return [{ type: 'block-start', index: 0, blockType: 'text' },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'finish', reason: { kind: 'stop' } }]
}

function tool(name: string, args: unknown, id: string): StreamChunk[] {
  return [{ type: 'block-start', index: 0, blockType: 'tool-call' },
    { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId(id), name, arguments: JSON.stringify(args) } },
    { type: 'finish', reason: { kind: 'tool-calls' } }]
}

class Adapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []
  constructor(private readonly script: StreamChunk[][]) { super() }
  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const chunks = this.script.shift()
    if (chunks === undefined) throw new Error('Pending-question script exhausted')
    yield* chunks
  }
}

async function mount(script: StreamChunk[][], bound = config.maxContextCharacters) {
  const ctx = new Context()
  roots.push(ctx)
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(AgentLoop, { agents: [] })
  installRuntime(ctx, { ...config, maxContextCharacters: bound }, async () => ({ entries: [], omissions: [] }))
  ctx.tools.register(defineTool({
    name: 'ask_user_question', description: 'Ask the pending test question.',
    parameters: { questions: { type: 'array', items: { type: 'object', additionalProperties: true, properties: {} }, required: true } },
    output: { schema: { type: 'object', additionalProperties: false, properties: { pending: { type: 'boolean', required: true } } },
      render: () => [{ type: 'text', text: '{"pending":true}' }] },
    execute: () => Promise.resolve({ pending: true }),
  }))
  const adapter = new Adapter(script)
  ctx.llm.registerAdapter(['pending-mock'], adapter)
  return { ctx, adapter }
}

function seedQuestion(session: Session, selected = origin, args = question) {
  session.append('user/message', human('有需要我选择的前提请提问。', selected), { surfaceOp: 'append' })
  return session.append('tool/call', { turn: 1, step: 1, callId: ToolCallId('awaiting-boundary'),
    name: 'ask_user_question', arguments: JSON.stringify(args) })
}

function latestContext(request: GenerateOptions): string {
  return JSON.stringify(request.messages.filter(message => message.role === 'user' && message.source?.kind === 'runtime-context').at(-1))
}

describe('unanswered research question delivery', () => {
  it('delivers the complete question and options in refreshed context as an assistant question, not a human choice', async () => {
    const { ctx, adapter } = await mount([tool('ask_user_question', question, 'awaiting-boundary'), response('waiting'), response('continued')])
    const agent = await ctx.agentLoop.create(SessionId('pending-current'), { provider: 'pending-mock', model: 'pending-mock' })
    agent.followup(human('有需要我选择的前提请提问。'))
    await agent.whenIdle()
    agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '继续恢复还没有回答的问题。' }] }))
    await agent.whenIdle()
    const text = latestContext(adapter.requests.at(-1)!)
    expect(text).toContain('保留哪种边界条件')
    expect(text).toContain('保留平移对称')
    expect(text).toContain('改变边界作用')
    expect(text).toContain('not a human decision')
    const state = ctx.sessionProjections.stateOf(agent.session, 'researchWorking')!
    expect(state.pending).toHaveLength(1)
    expect(state.humans).toHaveLength(2)
  })

  it('lists and reopens an omitted whole question by exact current-Session reference without a historical provider', async () => {
    const script: StreamChunk[][] = []
    const { ctx, adapter } = await mount(script, 1200)
    const agent = await ctx.agentLoop.create(SessionId('large-pending'), { provider: 'pending-mock', model: 'pending-mock' })
    const asked = seedQuestion(agent.session, origin, { questions: [{ ...question.questions[0]!, question: '完整问题：' + '必要限定'.repeat(700) }] })
    const sourceId = `session:large-pending#${asked.seq}`
    script.push(tool('research_read_context', { inputOffset: 0 }, 'list-pending'),
      tool('research_read_context', { sourceId, offset: 500 }, 'read-pending'), response('reopened'))
    agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '恢复未答问题，不要补选答案。' }] }))
    await agent.whenIdle()
    const initial = latestContext(adapter.requests[0]!)
    expect(initial).not.toContain('完整问题')
    expect(initial).toContain('1 source units')
    const listing = JSON.stringify(adapter.requests[1]?.messages.find(message => message.role === 'tool' && message.toolCallId === 'list-pending'))
    expect(listing).toContain(sourceId)
    expect(listing).toContain('unanswered assistant question')
    const recovered = JSON.stringify(adapter.requests[2]?.messages.find(message => message.role === 'tool' && message.toolCallId === 'read-pending'))
    expect(recovered).toContain('必要限定')
    expect(recovered).toContain('character offset 500')
    expect(recovered).not.toContain('not found')
  })

  it('keeps the question scoped to its original direction after the current conversation moves', async () => {
    const { ctx, adapter } = await mount([response('other direction')])
    const agent = await ctx.agentLoop.create(SessionId('pending-scope'), { provider: 'pending-mock', model: 'pending-mock' })
    seedQuestion(agent.session)
    agent.followup(human('现在只恢复另一子方向。', { ...origin, topicId: 'other-branch' }))
    await agent.whenIdle()
    expect(latestContext(adapter.requests[0]!)).not.toContain('保留哪种边界条件')
  })

  it('preserves a later ordinary human correction without inventing a structured selection or denying its authority', async () => {
    const { ctx, adapter } = await mount([response('correction received')])
    const agent = await ctx.agentLoop.create(SessionId('pending-correction'), { provider: 'pending-mock', model: 'pending-mock' })
    seedQuestion(agent.session)
    const correction = '之前给的两种边界都先不要选，我决定先检查连续极限。'
    agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: correction }] }))
    await agent.whenIdle()
    const text = latestContext(adapter.requests[0]!)
    expect(text).toContain(correction)
    expect(text).toContain('No structured reply is linked to this question call')
    expect(text).toContain('later human messages may answer or supersede it and retain authority')
    expect(text).not.toContain('No answer is recorded')
    const state = ctx.sessionProjections.stateOf(agent.session, 'researchWorking')!
    expect(state.pending).toHaveLength(1)
    expect(state.humans.map(input => input.kind)).toEqual(['aitp-research', 'user'])
    expect(readHumanInput(agent.session, state.humans.at(-1)!)).toBe(correction)
  })

  it('prioritizes the unanswered question over an unrelated provisional item under a tight delivery bound', async () => {
    const { ctx, adapter } = await mount([
      tool('ask_user_question', question, 'awaiting-boundary'),
      tool('research_working_update', { operation: 'upsert', id: 'optional-detail', kind: 'result', text: '可选工作细节'.repeat(200) }, 'working-detail'),
      response('waiting'), response('continued'),
    ], 2200)
    const agent = await ctx.agentLoop.create(SessionId('pending-priority'), { provider: 'pending-mock', model: 'pending-mock' })
    agent.followup(human('保留问题，不能替我选择。'))
    await agent.whenIdle()
    agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '恢复原问题。' }] }))
    await agent.whenIdle()
    const text = latestContext(adapter.requests.at(-1)!)
    expect(text).toContain('保留哪种边界条件')
    expect(text).toContain('1 working items')
    expect(text).not.toContain('可选工作细节')
  })
})

describe('unanswered question settlement', () => {
  it('preserves native and PTC originals by exact scope until a real late reply is admitted', () => {
    const session = Session.create(SessionId('pending/ptc'))
    seedQuestion(session)
    const dispatch = { rootCallId: ToolCallId('outer'), parentCallId: ToolCallId('outer'),
      subCallId: ToolCallId('ptc-question'), name: 'ask_user_question', arguments: question }
    const dispatched = session.append('tool/ptc-dispatch-start', dispatch)
    session.append('tool/ptc-dispatch', { ...dispatch, isError: false, content: [{ type: 'text', text: '{"pending":true}' }] })
    let state = session.snapshotEvents().reduce(applyWorkingEvent, emptyWorkingState())
    const entries = unansweredQuestionEntries(session.id, session.snapshotEvents(), state, origin)
    expect(entries).toHaveLength(2)
    expect(entries.every(entry => entry.source.target.startsWith('session:pending%2Fptc#'))).toBe(true)
    expect(entries.every(entry => entry.text.includes(JSON.stringify(question)))).toBe(true)
    expect(unansweredQuestionEntries(session.id, session.snapshotEvents(), state, { ...origin, topicId: 'sibling' })).toEqual([])
    session.append('user/message', createUserMessage({ source: { kind: 'user-question-reply', callId: ToolCallId('ptc-question'), outcome: 'answered' },
      content: [{ type: 'text', text: '{"answers":[{"id":"boundary","selected":[]}]}' }] }), { surfaceOp: 'append' })
    state = session.snapshotEvents().reduce(applyWorkingEvent, emptyWorkingState())
    expect(unansweredQuestionEntries(session.id, session.snapshotEvents(), state, origin)).toHaveLength(1)
    expect(state.humans.at(-1)?.questionSeq).toBe(dispatched.seq)
  })

  it.each([['selected', ['周期边界']], ['skipped', []]] as const)('clears a %s native answer without interpreting an empty selection as pending', (_label, selected) => {
    const session = Session.create(SessionId('settled-pending'))
    seedQuestion(session)
    session.append('tool/result', { turn: 1, step: 1, message: createToolResultMessage({ callId: ToolCallId('awaiting-boundary'),
      isError: false, content: [{ type: 'text', text: JSON.stringify({ answers: [{ id: 'boundary', selected }] }) }] }) }, { surfaceOp: 'append' })
    const state = session.snapshotEvents().reduce(applyWorkingEvent, emptyWorkingState())
    expect(state.pending).toHaveLength(0)
    expect(state.humans.at(-1)?.kind).toBe('question-answer')
  })

  it.each(['native', 'PTC'] as const)('settles an empty answer batch from the %s carrier and retains its exact no-selection source', (carrier) => {
    const session = Session.create(SessionId(`empty-batch-${carrier}`))
    session.append('user/message', human('有需要我选择的前提请提问。'), { surfaceOp: 'append' })
    const callId = ToolCallId('empty-answer')
    const dispatch = { rootCallId: ToolCallId('outer'), parentCallId: ToolCallId('outer'),
      subCallId: callId, name: 'ask_user_question', arguments: question }
    const call = carrier === 'native'
      ? session.append('tool/call', { turn: 1, step: 1, callId, name: 'ask_user_question', arguments: JSON.stringify(question) })
      : session.append('tool/ptc-dispatch-start', dispatch)
    const content = [{ type: 'text' as const, text: '{"answers":[]}' }]
    if (carrier === 'native') {
      session.append('tool/result', { turn: 1, step: 1,
        message: createToolResultMessage({ callId, isError: false, content }) }, { surfaceOp: 'append' })
    } else {
      session.append('tool/ptc-dispatch', { ...dispatch, isError: false, content })
    }
    const state = session.snapshotEvents().reduce(applyWorkingEvent, emptyWorkingState())
    expect(state.pending).toEqual([])
    expect(unansweredQuestionEntries(session.id, session.snapshotEvents(), state, origin)).toEqual([])
    expect(state.humans).toHaveLength(2)
    const reply = state.humans.at(-1)!
    expect(reply).toMatchObject({ kind: 'question-answer', origin, questionSeq: call.seq })
    const original = readHumanInput(session, reply)
    expect(original).toContain(JSON.stringify(question))
    expect(original).toContain('Human answer: {"answers":[]}')
  })

  it('settles a failed question but preserves a recorded unknown outcome for later recovery', () => {
    const session = Session.create(SessionId('failed-pending'))
    seedQuestion(session)
    session.append('tool/result', { turn: 1, step: 1, message: createToolResultMessage({ callId: ToolCallId('awaiting-boundary'),
      isError: true, content: [{ type: 'text', text: 'Question service rejected the request.' }] }) }, { surfaceOp: 'append' })
    const settled = session.snapshotEvents().reduce(applyWorkingEvent, emptyWorkingState())
    expect(settled.pending).toHaveLength(0)
    const unknown = Session.create(SessionId('unknown-pending'))
    seedQuestion(unknown)
    unknown.append('tool/result', { turn: 1, step: 1, error: { name: 'SessionFormatError', code: TOOL_OUTCOME_UNKNOWN, reason: 'The process stopped before an answer was recorded.' },
      message: createToolResultMessage({ callId: ToolCallId('awaiting-boundary'), isError: true,
        content: [{ type: 'text', text: 'Unknown tool outcome.' }] }) }, { surfaceOp: 'append' })
    expect(unknown.snapshotEvents().reduce(applyWorkingEvent, emptyWorkingState()).pending).toHaveLength(1)
  })
})
