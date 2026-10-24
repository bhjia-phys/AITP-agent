import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage, createToolResultMessage, LlmAdapter, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import SessionQueryEngine from '@deepseek-ai/dsh-session-query'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { installRuntime } from '../src/runtime.ts'
import { createSessionRecovery } from '../src/recovery.ts'
import type { ResearchOrigin } from '../src/working-types.ts'

class Query extends SessionQueryEngine {
  override async searchSessions(): Promise<never> { throw new Error('Full-text search is not part of scoped recovery') }
  override async searchEvents(): Promise<never> { throw new Error('Full-text search is not part of scoped recovery') }
}
class Adapter extends LlmAdapter {
  requests: GenerateOptions[] = []
  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'done' } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}
const origin: ResearchOrigin = { workspaceId: 'workspace-one', topicId: 'topic-a' }
const roots: Context[] = []
afterEach(async () => { for (const ctx of roots.splice(0)) await ctx.fiber.dispose() })
const runtimeConfig = {
  maxContextCharacters: 15000, maxHumanInputs: 8, maxHumanCharacters: 8000, maxWorkingItems: 16, maxItemCharacters: 2000,
}
const recoveryConfig = { maxRecoverySessions: 10, maxRecoveryEvents: 5000, maxRecoveryCharacters: 8000 }
const message = (text: string, selected = origin) => createUserMessage({ source: { kind: 'aitp-research', actor: 'human', origin: selected }, content: [{ type: 'text', text }] })

async function mount(withQuery = true) {
  const ctx = new Context()
  roots.push(ctx)
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(AgentLoop, { agents: [] })
  if (withQuery) await ctx.plugin(Query)
  const recovery = createSessionRecovery(ctx, recoveryConfig)
  installRuntime(ctx, runtimeConfig, async () => ({ entries: [], omissions: [] }), recovery)
  const adapter = new Adapter()
  ctx.llm.registerAdapter(['mock'], adapter)
  return { ctx, adapter, recovery }
}

async function seed(ctx: Context, id: string, selected: ResearchOrigin, text: string, cwd = process.cwd()) {
  const agent = await ctx.agentLoop.create(SessionId(id), { provider: 'mock', model: 'mock' }, { cwd })
  agent.session.append('user/message', message(text, selected), { surfaceOp: 'append' })
  return agent
}

describe('bounded recovery across conversations', () => {
  it('delivers prior corrections, complete choices and pending outcomes to a fresh actual model request', async () => {
    const { ctx, adapter, recovery } = await mount()
    const old = await seed(ctx, 'old', origin, '原始问题：只做解析工作，不运行计算。')
    old.session.append('tool/call', { turn: 1, step: 1, callId: ToolCallId('choice'), name: 'ask_user_question', arguments: JSON.stringify({ questions: [{ id: 'q', question: '选哪种约定？', options: [{ label: '原约定', description: '保留已有推导' }, { label: '新约定' }] }] }) })
    old.session.append('tool/result', { turn: 1, step: 1, message: createToolResultMessage({ callId: ToolCallId('choice'), isError: false, content: [{ type: 'text', text: JSON.stringify({ answers: [{ id: 'q', selected: ['原约定'], custom: '为了与旧结果比较' }] }) }] }) }, { surfaceOp: 'append' })
    old.session.append('tool/call', { turn: 1, step: 2, callId: ToolCallId('pending'), name: 'research_working_update', arguments: '{}' })
    old.session.append('tool/result', { turn: 1, step: 2, message: createToolResultMessage({ callId: ToolCallId('pending'), isError: false, content: [{ type: 'text', text: JSON.stringify({ operation: 'upsert', origin, item: { id: 'outcome', kind: 'pending-integration', text: 'A correction has not yet been written to research.md.', condition: 'Check the dependent argument first.', sourceIds: [], origin, sourceId: 'pending' } }) }] }) }, { surfaceOp: 'append' })
    old.session.append('tool/call', { turn: 1, step: 3, callId: ToolCallId('prepare'), name: 'research_prepare_change', arguments: JSON.stringify({ rationale: 'The corrected condition changes the dependent conclusion.', remainingUses: ['Recheck the old manuscript claim under the new condition.'] }) })
    old.session.append('tool/result', { turn: 1, step: 3, meta: { researchWrite: { operationId: 'edit-one', state: 'prepared' } }, message: createToolResultMessage({ callId: ToolCallId('prepare'), isError: false, content: [{ type: 'text', text: 'Shortened preparation summary.' }] }) }, { surfaceOp: 'append' })
    old.session.append('tool/call', { turn: 1, step: 4, callId: ToolCallId('apply'), name: 'research_apply_change', arguments: '{"operationId":"edit-one"}' })
    old.session.append('tool/result', { turn: 1, step: 4, meta: { researchWrite: { operationId: 'edit-one', state: 'applied' } }, message: createToolResultMessage({ callId: ToolCallId('apply'), isError: false, content: [{ type: 'text', text: 'Saved; integration details omitted from display.' }] }) }, { surfaceOp: 'append' })
    const current = await ctx.agentLoop.create(SessionId('fresh'), { provider: 'mock', model: 'mock' }, { cwd: process.cwd() })
    current.followup(message('接着这个课题回答'))
    await current.whenIdle()
    expect(adapter.requests).toHaveLength(1)
    const delivered = JSON.stringify(adapter.requests[0])
    expect(delivered).toContain('只做解析工作')
    expect(delivered).toContain('保留已有推导')
    expect(delivered).toContain('为了与旧结果比较')
    expect(delivered).toContain('answerer unspecified')
    expect(delivered).toContain('has not yet been written')
    expect(delivered).toContain('does not transfer execution permission')
    expect(delivered).toContain('Source edit operation edit-one: applied')
    expect(delivered).toContain('Recheck the old manuscript claim under the new condition.')
    expect(delivered).toContain('A saved file is not complete scientific integration')
    const full = await recovery.recover(origin, current.session)
    const original = full.entries.find(entry => entry.text.includes('原始问题'))!
    expect(await recovery.readOriginal(origin, current.session, original.source.target, 0)).toContain('只做解析工作')
    const write = full.entries.find(entry => entry.text.includes('Source edit operation'))!
    expect(await recovery.readOriginal(origin, current.session, write.source.target, 0)).toContain('corrected condition changes the dependent conclusion')
  })

  it('does not expose another workspace, sibling topic, root directory or delegated session', async () => {
    const { ctx, recovery } = await mount()
    await seed(ctx, 'matching', origin, 'MATCH')
    await seed(ctx, 'other-workspace', { ...origin, workspaceId: 'workspace-two' }, 'WRONG_WORKSPACE')
    await seed(ctx, 'sibling', { ...origin, topicId: 'topic-b' }, 'WRONG_BRANCH')
    await seed(ctx, 'other-root', origin, 'WRONG_ROOT', '/tmp')
    const child = ctx.sessions.create(SessionId('child'), { meta: { cwd: process.cwd(), parentSession: SessionId('matching'), origin: 'subagent' } })
    child.append('user/message', message('PRIVATE_CHILD'), { surfaceOp: 'append' })
    const current = await seed(ctx, 'current', origin, 'CURRENT')
    const text = JSON.stringify(await recovery.recover(origin, current.session))
    expect(text).toContain('MATCH')
    expect(text).not.toContain('WRONG_')
    expect(text).not.toContain('PRIVATE_CHILD')
    await expect(recovery.readOriginal(origin, current.session, 'session:sibling#0', 0)).rejects.toThrow('direction')
    await expect(recovery.readOriginal(origin, current.session, 'session:other-root#0', 0)).rejects.toThrow('root')
  })

  it('refuses a non-owner pending prompt before any prior text can enter that request', async () => {
    const { ctx, adapter } = await mount()
    await seed(ctx, 'private-old', origin, 'PRIVATE_OLD_MATERIAL')
    const current = await seed(ctx, 'owner-created', origin, 'ordinary current conversation')
    current.followup(createUserMessage({
      source: { kind: 'user', rpcId: 'guest-request', principal: { kind: 'guest' } } as never,
      content: [{ type: 'text', text: 'Guest continuation' }],
    }))
    await current.whenIdle()
    const delivered = JSON.stringify(adapter.requests[0])
    expect(delivered).not.toContain('PRIVATE_OLD_MATERIAL')
    expect(delivered).toContain('unavailable for this conversation access scope')
  })

  it('states missing provider and bounded-coverage limits instead of claiming full recovery', async () => {
    const absent = await mount(false)
    const current = await seed(absent.ctx, 'no-provider', origin, 'current')
    expect((await absent.recovery.recover(origin, current.session)).omissions.join()).toContain('provider is not loaded')
    const { ctx } = await mount()
    await seed(ctx, 'old-1', origin, 'first old input')
    await seed(ctx, 'old-2', origin, 'second old input')
    const next = await seed(ctx, 'new', origin, 'new question')
    const bounded = createSessionRecovery(ctx, { maxRecoverySessions: 1, maxRecoveryEvents: 1, maxRecoveryCharacters: 512 })
    const result = await bounded.recover(origin, next.session)
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(512)
    expect(result.omissions.join()).toContain('recovery session limit')
  })
})
