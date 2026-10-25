import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage, LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import SessionQueryEngine from '@deepseek-ai/dsh-session-query'
import { SessionPersistenceRevision } from '@deepseek-ai/dsh-session-persistence'
import * as JsonlPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { installRuntime } from '../src/runtime.ts'
import { createSessionRecovery } from '../src/recovery.ts'
import type { ResearchOrigin } from '../src/working-types.ts'

class Query extends SessionQueryEngine {
  readonly hidden = new Set<string>()
  override async searchSessions(): Promise<never> { throw new Error('Full-text search is not used') }
  override async searchEvents(): Promise<never> { throw new Error('Full-text search is not used') }
  override async listSessions(signal?: AbortSignal) {
    return (await super.listSessions(signal)).filter(record => !this.hidden.has(record.header.id))
  }
}

class Adapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []
  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'done' } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

const origin: ResearchOrigin = { workspaceId: 'workspace-history', topicId: 'topic-target' }
const roots: Context[] = []
const directories: string[] = []
const limits = { maxRecoverySessions: 24, maxRecoveryEvents: 10000, maxRecoveryCharacters: 12000 }
const runtimeLimits = {
  maxContextCharacters: 20000, maxHumanInputs: 8, maxHumanCharacters: 8000, maxWorkingItems: 16, maxItemCharacters: 2000,
}
const message = (text: string, selected = origin) => createUserMessage({
  source: { kind: 'aitp-research', actor: 'human', origin: selected },
  content: [{ type: 'text', text }],
})

afterEach(async () => {
  for (const ctx of roots.splice(0)) await ctx.fiber.dispose()
  for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true })
})

async function mount(persistenceRoot?: string, eventLimit = limits.maxRecoveryEvents) {
  const ctx = new Context()
  roots.push(ctx)
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(Query)
  const persistence = persistenceRoot === undefined ? undefined
    : await ctx.plugin(JsonlPersistence, { root: persistenceRoot, compression: 'none' })
  const recovery = createSessionRecovery(ctx, { ...limits, maxRecoveryEvents: eventLimit })
  installRuntime(ctx, runtimeLimits, async () => ({ entries: [], omissions: [] }), recovery)
  const adapter = new Adapter()
  ctx.llm.registerAdapter(['history'], adapter)
  return { ctx, recovery, adapter, persistence }
}

function live(ctx: Context, id: string, selected: ResearchOrigin, text: string, createdAt: number) {
  const session = ctx.sessions.create(SessionId(id), { meta: { cwd: process.cwd(), createdAt } })
  session.append('user/message', message(text, selected), { surfaceOp: 'append' })
  return session
}

async function stored(ctx: Context, id: string, selected: ResearchOrigin, text: string, createdAt: number) {
  const session = ctx.sessions.prepare(SessionId(id), { meta: { cwd: process.cwd(), createdAt } })
  session.append('user/message', message(text, selected), { surfaceOp: 'append' })
  await using handle = await ctx.sessionPersistence.create(session.header)
  await handle.append(session.snapshotEvents())
  await handle.flush()
}

async function appendStored(ctx: Context, id: string, selected: ResearchOrigin, text: string) {
  await using handle = await ctx.sessionPersistence.open(SessionId(id), 'write')
  const before = await handle.read()
  const session = ctx.sessions.prepare(SessionId(id), {
    seed: [...before.events], meta: handle.header, inheritedEventCount: handle.inheritedEventCount,
    eventState: 'detached',
  })
  session.append('user/message', message(text, selected), { surfaceOp: 'append' })
  await handle.append(session.snapshotEvents().slice(before.events.length))
  await handle.flush()
}

describe('topic-first historical recovery', () => {
  it('delivers an older correction after 24 unrelated live histories without observing their bodies', async () => {
    const { ctx, recovery, adapter } = await mount(undefined, 1)
    live(ctx, 'older-relevant', origin, 'OLDER_FINITE_SYSTEM_ONLY', 1)
    for (let i = 1; i <= 24; i++) {
      live(ctx, `unrelated-${i}`, { ...origin, topicId: `unrelated-topic-${i}` }, `UNRELATED_${i}`, i + 1)
    }
    const observed = vi.spyOn(ctx.sessionQuery, 'observeSession')
    const current = await ctx.agentLoop.create(SessionId('fresh-target'), { provider: 'history', model: 'history' }, { cwd: process.cwd() })
    current.followup(message('恢复这个方向已有的更正。'))
    await current.whenIdle()
    const delivered = JSON.stringify(adapter.requests[0])
    expect(delivered).toContain('OLDER_FINITE_SYSTEM_ONLY')
    expect(delivered).not.toContain('UNRELATED_')
    expect(observed.mock.calls.map(([id]) => id)).toEqual(['older-relevant'])
    expect((await recovery.recover(origin, current.session)).omissions).toEqual([])
  })

  it('refreshes live scope and access without trusting an earlier negative or positive classification', async () => {
    const { ctx, recovery } = await mount()
    const changing = live(ctx, 'changing', { ...origin, topicId: 'other-topic' }, 'OTHER_INPUT', 1)
    const current = live(ctx, 'current', origin, 'CURRENT', 2)
    expect(JSON.stringify(await recovery.recover(origin, current))).not.toContain('OTHER_INPUT')
    changing.append('user/message', message('NEW_TOPIC_CORRECTION'), { surfaceOp: 'append' })
    changing.append('user/message', message('UNRELATED_LATEST', { ...origin, topicId: 'other-topic' }), { surfaceOp: 'append' })
    const recovered = JSON.stringify(await recovery.recover(origin, current))
    expect(recovered).toContain('NEW_TOPIC_CORRECTION')
    expect(recovered).not.toContain('UNRELATED_LATEST')
    changing.append('user/message', createUserMessage({
      source: { kind: 'user', principal: { kind: 'guest' } } as never,
      content: [{ type: 'text', text: 'RESTRICTED_INPUT' }],
    }), { surfaceOp: 'append' })
    expect(JSON.stringify(await recovery.recover(origin, current))).not.toContain('NEW_TOPIC_CORRECTION')
    await expect(recovery.readOriginal(origin, current, 'session:changing#1', 0)).rejects.toThrow('access scope')
  })

  it('rebuilds cold topic classifications, reuses unchanged negatives and observes a changed stored scope', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'research-topic-history-'))
    directories.push(directory)
    const first = await mount(directory)
    await stored(first.ctx, 'older-relevant', origin, 'COLD_OLD_CORRECTION', 1)
    for (let i = 1; i <= 24; i++) {
      await stored(first.ctx, `unrelated-${i}`, { ...origin, topicId: `other-${i}` }, `OTHER_COLD_${i}`, i + 1)
    }
    await first.ctx.fiber.dispose()
    roots.splice(roots.indexOf(first.ctx), 1)
    const { ctx, recovery } = await mount(directory)
    const current = live(ctx, 'current', origin, 'CURRENT', 100)
    const observed = vi.spyOn(ctx.sessionQuery, 'observeSession')
    expect(JSON.stringify(await recovery.recover(origin, current))).toContain('COLD_OLD_CORRECTION')
    expect(observed).toHaveBeenCalledTimes(25)
    observed.mockClear()
    expect(JSON.stringify(await recovery.recover(origin, current))).toContain('COLD_OLD_CORRECTION')
    expect(observed.mock.calls.map(([id]) => id)).toEqual(['older-relevant'])
    await appendStored(ctx, 'unrelated-1', origin, 'NEW_STORED_SCOPE')
    observed.mockClear()
    const changed = JSON.stringify(await recovery.recover(origin, current))
    expect(changed).toContain('NEW_STORED_SCOPE')
    expect(changed).toContain('COLD_OLD_CORRECTION')
    expect(changed).not.toContain('OTHER_COLD_')
    expect(observed.mock.calls.map(([id]) => id).sort()).toEqual(['older-relevant', 'unrelated-1'])
  })

  it('reports cold discovery bounds and advances through unchanged unrelated classifications on later reads', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'research-topic-history-budget-'))
    directories.push(directory)
    const { ctx, recovery } = await mount(directory, 2)
    await stored(ctx, 'older-relevant', origin, 'BOUNDED_OLD_CORRECTION', 1)
    for (let i = 1; i <= 4; i++) {
      await stored(ctx, `unrelated-${i}`, { ...origin, topicId: `other-${i}` }, 'OTHER', i + 1)
    }
    const current = live(ctx, 'current', origin, 'CURRENT', 100)
    const first = await recovery.recover(origin, current)
    expect(first.entries).toEqual([])
    expect(first.omissions.join()).toContain('event bound')
    const second = await recovery.recover(origin, current)
    expect(second.entries).toEqual([])
    expect(second.omissions.join()).toContain('event bound')
    const third = await recovery.recover(origin, current)
    expect(third.entries.some(entry => entry.text.includes('BOUNDED_OLD_CORRECTION'))).toBe(true)
  })

  it('drops a cached classification when its Session disappears from the listed corpus', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'research-topic-history-prune-'))
    directories.push(directory)
    const { ctx, recovery } = await mount(directory)
    await stored(ctx, 'hidden-other', { ...origin, topicId: 'other' }, 'OTHER', 1)
    const current = live(ctx, 'current', origin, 'CURRENT', 2)
    const observed = vi.spyOn(ctx.sessionQuery, 'observeSession')
    await recovery.recover(origin, current)
    expect(observed).toHaveBeenCalledTimes(1)
    const query = ctx.sessionQuery as Query
    query.hidden.add('hidden-other')
    observed.mockClear()
    expect((await recovery.recover(origin, current)).entries).toEqual([])
    expect(observed).not.toHaveBeenCalled()
    await expect(recovery.readOriginal(origin, current, 'session:hidden-other#0', 0)).rejects.toThrow('root')
    query.hidden.clear()
    await recovery.recover(origin, current)
    expect(observed.mock.calls.map(([id]) => id)).toEqual(['hidden-other'])
  })

  it('does not reuse a cold classification after persistence replacement with the same id and revision token', async () => {
    const firstDirectory = await mkdtemp(join(tmpdir(), 'research-topic-history-first-'))
    const secondDirectory = await mkdtemp(join(tmpdir(), 'research-topic-history-second-'))
    directories.push(firstDirectory, secondDirectory)
    const { ctx, recovery, persistence } = await mount(firstDirectory)
    await stored(ctx, 'reused-slot', { ...origin, topicId: 'other' }, 'OLD_OTHER', 1)
    const firstProvider = ctx.sessionPersistence
    const firstStat = firstProvider.stat.bind(firstProvider)
    vi.spyOn(firstProvider, 'stat').mockImplementation(async (...args) => {
      const snapshot = await firstStat(...args)
      return snapshot === undefined ? undefined : { ...snapshot, revision: SessionPersistenceRevision('same-revision') }
    })
    const current = live(ctx, 'current', origin, 'CURRENT', 2)
    expect((await recovery.recover(origin, current)).entries).toEqual([])
    if (persistence === undefined) throw new Error('This fixture requires persistence')
    const firstIdentity = firstProvider.identity
    await persistence.dispose()
    await ctx.plugin(JsonlPersistence, { root: secondDirectory, compression: 'none' })
    await stored(ctx, 'reused-slot', origin, 'NEW_PROVIDER_CORRECTION', 1)
    const nextProvider = ctx.sessionPersistence
    const nextStat = nextProvider.stat.bind(nextProvider)
    vi.spyOn(nextProvider, 'stat').mockImplementation(async (...args) => {
      const snapshot = await nextStat(...args)
      return snapshot === undefined ? undefined : { ...snapshot, revision: SessionPersistenceRevision('same-revision') }
    })
    expect(nextProvider.identity).not.toBe(firstIdentity)
    const text = JSON.stringify(await recovery.recover(origin, current))
    expect(text).toContain('NEW_PROVIDER_CORRECTION')
    expect(text).not.toContain('OLD_OTHER')
  })

  it('does not inspect a historical body after a cancelled metadata read or retain a false negative', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'research-topic-history-cancel-'))
    directories.push(directory)
    const { ctx, recovery } = await mount(directory)
    await stored(ctx, 'cancelled-source', origin, 'STILL_AVAILABLE', 1)
    const current = live(ctx, 'current', origin, 'CURRENT', 2)
    const controller = new AbortController()
    const originalStat = ctx.sessionPersistence.stat.bind(ctx.sessionPersistence)
    const stat = vi.spyOn(ctx.sessionPersistence, 'stat').mockImplementation(async (...args) => {
      const snapshot = await originalStat(...args)
      controller.abort(new Error('cancel-history'))
      return snapshot
    })
    const observed = vi.spyOn(ctx.sessionQuery, 'observeSession')
    await expect(recovery.recover(origin, current, controller.signal)).rejects.toThrow('cancel-history')
    expect(observed).not.toHaveBeenCalled()
    stat.mockRestore()
    expect(JSON.stringify(await recovery.recover(origin, current))).toContain('STILL_AVAILABLE')
  })
})
