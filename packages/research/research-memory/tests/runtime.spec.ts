import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage, createToolResultMessage, LlmAdapter, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { installRuntime, renderResearchContext } from '../src/runtime.ts'
import { applyWorkingEvent, emptyWorkingState, readHumanInput, readSessionWrite, WORKING_TOOL } from '../src/working-state.ts'
import type { ResearchRuntimeConfig } from '../src/working-types.ts'

const config: ResearchRuntimeConfig = {
  maxContextCharacters: 12000, maxWorkingItems: 12, maxItemCharacters: 2000,
  maxHumanInputs: 8, maxHumanCharacters: 6000,
}
const origin = { workspaceId: 'w', topicId: 'branch-a' }
const contexts: Context[] = []
afterEach(async () => { for (const ctx of contexts.splice(0)) await ctx.fiber.dispose() })

function response(text: string): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}
function call(name: string, args: unknown, id = 'work-1'): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'tool-call' },
    { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId(id), name, arguments: JSON.stringify(args) } },
    { type: 'finish', reason: { kind: 'tool-calls' } },
  ]
}
class Adapter extends LlmAdapter {
  requests: GenerateOptions[] = []
  constructor(private readonly script: StreamChunk[][]) { super() }
  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const chunks = this.script.shift()
    if (chunks === undefined) throw new Error('test script exhausted')
    yield* chunks
  }
}
async function mount(adapter: Adapter) {
  const ctx = new Context()
  contexts.push(ctx)
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(AgentLoop, { agents: [] })
  const dispose = installRuntime(ctx, config, async selected => ({
    entries: [{ label: 'Owning research note', text: `Question for ${selected.topicId}; finite results only.`, source: { target: 'resource:research.md', locator: 'answer' } }], omissions: [],
  }))
  ctx.llm.registerAdapter(['mock'], adapter)
  return { ctx, dispose }
}
function human(text: string, selected = origin) {
  return createUserMessage({ source: { kind: 'aitp-research', actor: 'human', origin: selected }, content: [{ type: 'text', text }] })
}
function scopeText(request: GenerateOptions): string {
  return JSON.stringify(request.messages.filter(message => message.role !== 'system'))
}

describe('research context on the actual Harness model request', () => {
  it('returns exact source resource locators from research_read_context without changing their identities', async () => {
    const adapter = new Adapter([call('research_read_context', {}, 'discover-source'), response('located')])
    const { ctx } = await mount(adapter)
    const agent = await ctx.agentLoop.create(SessionId('source-locators'), { provider: 'mock', model: 'mock' })
    agent.followup(human('Find the exact source location before deciding whether to edit.'))
    await agent.whenIdle()
    expect(adapter.requests).toHaveLength(2)
    const result = adapter.requests[1]?.messages.find(message => message.role === 'tool' && message.toolCallId === 'discover-source')
    expect(JSON.stringify(result)).toContain('Source Owning research note [resource:research.md]')
    expect(JSON.stringify(result)).toContain('Passage locator: answer')
    expect(JSON.stringify(result)).not.toContain('resource:research.md#answer')
    expect(JSON.stringify(adapter.requests[0]?.tools?.find(tool => tool.name === 'research_read_context')))
      .toContain('exact resource: locators beside Source passages')
  })

  it('delivers first-turn context and committed working items without putting source text in the system prompt', async () => {
    const adapter = new Adapter([
      call(WORKING_TOOL, { operation: 'upsert', id: 'failure', kind: 'failed-route', text: '此近似未证明可积性', condition: '仅在边界条件改变后重开' }),
      response('recorded'), response('continued'),
    ])
    const { ctx } = await mount(adapter)
    ctx.systemPrompt.suppressRuntimeContext()
    const agent = await ctx.agentLoop.create(SessionId('research-loop'), { provider: 'mock', model: 'mock' })
    agent.followup(human('只讨论解析推导，不进行数值计算。'))
    await agent.whenIdle()
    agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Keep the boundary convention unchanged.' }] }))
    await agent.whenIdle()
    expect(adapter.requests).toHaveLength(3)
    expect(scopeText(adapter.requests[0]!)).toContain('Question for branch-a')
    expect(scopeText(adapter.requests[1]!)).toContain('仅在边界条件改变后重开')
    expect(scopeText(adapter.requests[2]!)).toContain('只讨论解析推导')
    expect(scopeText(adapter.requests[2]!)).toContain('Keep the boundary convention unchanged.')
    for (const request of adapter.requests) {
      expect(JSON.stringify(request.messages.filter(message => message.role === 'system'))).not.toContain('Question for branch-a')
    }
    expect(ctx.sessionProjections.stateOf(agent.session, 'researchWorking')?.items[0]?.kind).toBe('failed-route')
  })

  it('does not mix branches and disposes both tools and context registrations', async () => {
    const adapter = new Adapter([response('a'), response('b')])
    const { ctx, dispose } = await mount(adapter)
    const agent = await ctx.agentLoop.create(SessionId('branches'), { provider: 'mock', model: 'mock' })
    agent.followup(human('A-only correction'))
    await agent.whenIdle()
    agent.followup(human('B-only question', { ...origin, topicId: 'branch-b' }))
    await agent.whenIdle()
    const snapshots = agent.session.snapshotEvents().filter(event => event.type === 'user/message' && event.data.source.kind === 'runtime-context')
    expect(JSON.stringify(snapshots.at(-1))).toContain('B-only question')
    expect(JSON.stringify(snapshots.at(-1))).not.toContain('A-only correction')
    dispose()
    expect(ctx.tools.schemas().some(tool => tool.name === WORKING_TOOL)).toBe(false)
    expect(ctx.sessionProjections.stateOf(agent.session, 'researchWorking')).toBeUndefined()
    const assembled = await ctx.systemPrompt.assemble({})
    expect(assembled.contexts.some(section => section.name === 'aitp-research-memory')).toBe(false)
  })

  it('reports source disappearance while preserving the exact human request', async () => {
    const adapter = new Adapter([response('conditional answer')])
    const ctx = new Context()
    contexts.push(ctx)
    await mountAgentLoopTestDependencies(ctx)
    await ctx.plugin(AgentLoop, { agents: [] })
    installRuntime(ctx, config, async () => { throw new Error('child/research.md was deleted') })
    ctx.llm.registerAdapter(['mock'], adapter)
    const agent = await ctx.agentLoop.create(SessionId('missing'), { provider: 'mock', model: 'mock' })
    agent.followup(human('请说明当前缺了什么证据'))
    await agent.whenIdle()
    expect(adapter.requests).toHaveLength(1)
    expect(scopeText(adapter.requests[0]!)).toContain('child/research.md was deleted')
    expect(scopeText(adapter.requests[0]!)).toContain('请说明当前缺了什么证据')
  })

  it('retrieves an exact original input and cannot modify its source record', async () => {
    const input = human('精确原话：只验证这一假设，不采用新模型。')
    const adapter = new Adapter([
      call('research_read_context', { sourceId: input.id }, 'read-input'),
      call(WORKING_TOOL, { operation: 'upsert', id: input.id, text: 'A model suggestion', sourceIds: [input.id] }, 'model-suggestion'),
      response('done'),
    ])
    const { ctx } = await mount(adapter)
    const agent = await ctx.agentLoop.create(SessionId('exact-input'), { provider: 'mock', model: 'mock' })
    agent.followup(input)
    await agent.whenIdle()
    const state = ctx.sessionProjections.stateOf(agent.session, 'researchWorking')!
    expect(readHumanInput(agent.session, state.humans[0]!)).toBe('精确原话：只验证这一假设，不采用新模型。')
    expect(state.items[0]?.sourceId).toBe('model-suggestion')
    expect(scopeText(adapter.requests[1]!)).toContain(`Original human input [${input.id}]`)
  })
})

describe('source-attributed recovery', () => {
  it('replays originals, full question/options/answer and only successful working updates', () => {
    const session = Session.create(SessionId('replay'))
    session.append('user/message', human('原始任务与限制'), { surfaceOp: 'append' })
    session.append('tool/call', { turn: 1, step: 1, callId: ToolCallId('ask'), name: 'ask_user_question', arguments: JSON.stringify({ questions: [{ id: 'q', question: '选择边界？', options: [{ label: '周期', description: '保留平移' }, { label: '开边界' }] }] }) })
    session.append('tool/result', { turn: 1, step: 1, message: createToolResultMessage({ callId: ToolCallId('ask'), content: [{ type: 'text', text: JSON.stringify({ answers: [{ id: 'q', selected: ['周期'], custom: '为了比较动量分块' }] }) }], isError: false }) }, { surfaceOp: 'append' })
    const item = { id: 'f', kind: 'failed-route', text: '失败路线', condition: '更换假设才重开', sourceIds: [], origin, sourceId: 'good' }
    const receipt = JSON.stringify({ operation: 'upsert', origin, item })
    session.append('tool/call', { turn: 1, step: 2, callId: ToolCallId('bad'), name: WORKING_TOOL, arguments: '{}' })
    session.append('tool/result', { turn: 1, step: 2, message: createToolResultMessage({ callId: ToolCallId('bad'), content: [{ type: 'text', text: receipt }], isError: true }) }, { surfaceOp: 'append' })
    session.append('tool/call', { turn: 1, step: 3, callId: ToolCallId('good'), name: WORKING_TOOL, arguments: '{}' })
    session.append('tool/result', { turn: 1, step: 3, message: createToolResultMessage({ callId: ToolCallId('good'), content: [{ type: 'text', text: receipt }], isError: false }) }, { surfaceOp: 'append' })
    const original = session.snapshotEvents().reduce(applyWorkingEvent, emptyWorkingState())
    const restored = Session.create(SessionId('restored'), session.snapshotEvents())
    const replay = restored.snapshotEvents().reduce(applyWorkingEvent, emptyWorkingState())
    expect(replay).toEqual(original)
    expect(replay.items).toHaveLength(1)
    expect(replay.humans).toHaveLength(2)
    const answer = readHumanInput(restored, replay.humans[1]!)
    expect(answer).toContain('选择边界')
    expect(answer).toContain('保留平移')
    expect(answer).toContain('为了比较动量分块')
    const duplicate = restored.snapshotEvents().at(-1)!
    expect(applyWorkingEvent(replay, duplicate)).toEqual(replay)
  })

  it('keeps original source pointers outside the bounded delivery window and reports omissions', () => {
    const session = Session.create(SessionId('bounded'))
    for (let n = 0; n < 15; n++) session.append('user/message', human(`input ${n}: ${'中'.repeat(30)}`), { surfaceOp: 'append' })
    const state = session.snapshotEvents().reduce(applyWorkingEvent, emptyWorkingState())
    const text = renderResearchContext(state, { entries: [], omissions: ['missing-research.md'] }, { ...config, maxHumanInputs: 2, maxHumanCharacters: 120, maxContextCharacters: 1200 }, input => readHumanInput(session, input))
    expect(text.length).toBeLessThanOrEqual(1200)
    expect(text).toContain('input 0:')
    expect(text).toContain('input 14:')
    expect(text).toContain('13 human inputs')
    expect(state.humans).toHaveLength(15)
    expect(() => renderResearchContext(state, { entries: [], omissions: [] }, { ...config, maxContextCharacters: 10 }, input => readHumanInput(session, input))).toThrow('budget')
  })

  it('retains a late human answer in the question scope after the conversation moves to another branch', () => {
    const session = Session.create(SessionId('late-answer'))
    session.append('user/message', human('A question'), { surfaceOp: 'append' })
    session.append('tool/call', { turn: 1, step: 1, callId: ToolCallId('choose'), name: 'ask_user_question', arguments: JSON.stringify({ questions: [{ id: 'q', question: 'Keep which convention?', options: [{ label: 'original' }] }] }) })
    session.append('tool/result', { turn: 1, step: 1, message: createToolResultMessage({ callId: ToolCallId('choose'), content: [{ type: 'text', text: '{"kind":"pending"}' }], isError: false }) }, { surfaceOp: 'append' })
    session.append('user/message', human('B question', { ...origin, topicId: 'branch-b' }), { surfaceOp: 'append' })
    session.append('user/message', createUserMessage({ source: { kind: 'user-question-reply', callId: ToolCallId('choose'), outcome: 'answered' }, content: [{ type: 'text', text: JSON.stringify({ answers: [{ id: 'q', selected: ['original'], custom: 'comparison needs it' }] }) }] }), { surfaceOp: 'append' })
    const state = session.snapshotEvents().reduce(applyWorkingEvent, emptyWorkingState())
    expect(state.origin?.topicId).toBe('branch-b')
    expect(state.humans.at(-1)?.origin.topicId).toBe('branch-a')
    expect(readHumanInput(session, state.humans.at(-1)!)).toContain('Keep which convention?')
  })

  it('folds nested PTC success through the same working-item rules and ignores failed dispatches', () => {
    const session = Session.create(SessionId('ptc'))
    session.append('user/message', human('PTC scope'), { surfaceOp: 'append' })
    const dispatch = { rootCallId: ToolCallId('outer'), parentCallId: ToolCallId('outer'), subCallId: ToolCallId('inner'), name: WORKING_TOOL, arguments: { operation: 'upsert', id: 'gap' } }
    session.append('tool/ptc-dispatch-start', dispatch)
    session.append('tool/ptc-dispatch', { ...dispatch, isError: false, content: [{ type: 'text', text: JSON.stringify({ operation: 'upsert', origin, item: { id: 'gap', kind: 'gap', text: 'Unproved implication', condition: 'Need an independent proof', sourceIds: [], origin, sourceId: 'inner' } }) }] })
    const state = session.snapshotEvents().reduce(applyWorkingEvent, emptyWorkingState())
    expect(state.items).toHaveLength(1)
    expect(state.items[0]?.text).toBe('Unproved implication')
    expect(applyWorkingEvent(state, session.snapshotEvents().at(-1)!)).toEqual(state)
  })

  it('recovers source-edit intent from correlated successful metadata, including nested PTC calls', () => {
    const session = Session.create(SessionId('write-replay'))
    session.append('user/message', human('Correct the note and retain the downstream work.'), { surfaceOp: 'append' })
    const dispatch = { rootCallId: ToolCallId('outer'), parentCallId: ToolCallId('outer'), subCallId: ToolCallId('prepare'), name: 'research_prepare_change', arguments: { rationale: 'Keep the corrected boundary assumption attached.', remainingUses: ['Revisit the comparison figure.'] } }
    session.append('tool/ptc-dispatch-start', dispatch)
    session.append('tool/ptc-dispatch', { ...dispatch, isError: false, meta: { researchWrite: { operationId: 'edit', state: 'prepared' } }, content: [{ type: 'text', text: 'Details omitted by presentation budget.' }] })
    const apply = { ...dispatch, subCallId: ToolCallId('apply'), name: 'research_apply_change', arguments: { operationId: 'edit' } }
    session.append('tool/ptc-dispatch-start', apply)
    session.append('tool/ptc-dispatch', { ...apply, isError: true, meta: { researchWrite: { operationId: 'edit', state: 'applied' } }, content: [{ type: 'text', text: 'failure' }] })
    const uncorrelated = { ...dispatch, subCallId: ToolCallId('uncorrelated'), arguments: {} }
    session.append('tool/ptc-dispatch-start', uncorrelated)
    session.append('tool/ptc-dispatch', { ...uncorrelated, isError: false, content: [{ type: 'text', text: 'Source edit operation guessed: applied' }] })
    const state = session.snapshotEvents().reduce(applyWorkingEvent, emptyWorkingState())
    expect(state.writes).toHaveLength(1)
    expect(state.writes[0]?.state).toBe('prepared')
    const text = renderResearchContext(state, { entries: [], omissions: [] }, config,
      input => readHumanInput(session, input), write => readSessionWrite(session, write))
    expect(text).toContain('Revisit the comparison figure.')
    expect(text).toContain('Keep the corrected boundary assumption attached.')
    expect(text).not.toContain('guessed')
    expect(applyWorkingEvent(state, session.snapshotEvents()[2]!)).toEqual(state)
  })
})
