import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { createUserMessage, LlmAdapter, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import SandboxPolicy, { setSandboxMode } from '@deepseek-ai/dsh-sandbox-policy'
import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { MarkdownWorkspace, resourceIdForPath } from '../src/markdown.ts'
import { installRuntime } from '../src/runtime.ts'
import { installWriteTools } from '../src/write-tools.ts'
import { ScratchWriter } from '../src/writer.ts'
import type { WriteOperation } from '../src/writer.ts'
import { readHumanInput } from '../src/working-state.ts'
import type { ResearchOrigin } from '../src/working-types.ts'

let temporary: string
let root: string
let workspace: MarkdownWorkspace
let writer: ScratchWriter
const contexts: Context[] = []
const origin = { workspaceId: 'scratch', topicId: 'child' }
const source = '# Child\n\nUnresolved answer.\n\n## Current work\n\nKeep the failed-route condition.\n'
const args = {
  disposition: 'edit', rationale: 'Model assessment of the new conditional result.',
  edits: [{ resourceId: resourceIdForPath('child/research.md'), originalText: 'Unresolved answer.',
    replacementText: 'Result B holds only under A.', rationale: 'Retain the condition.', sourceRefs: ['report.md#control'] }],
  remainingUses: ['Check the parent implication.'],
}

function human(text: string, selected = origin) {
  return createUserMessage({ source: { kind: 'aitp-research', actor: 'human', origin: selected }, content: [{ type: 'text', text }] })
}
function text(result: ToolExecutionResult): string {
  return result.content.filter(item => item.type === 'text').map(item => item.text).join('\n')
}
function operationId(result: ToolExecutionResult): string {
  if (result.isError) throw new Error(text(result))
  const id = /Operation ([0-9a-f-]+):/.exec(text(result))?.[1]
  if (id === undefined) throw new Error('The tool omitted its operation locator.')
  return id
}
function toolCall(name: string, arguments_: unknown, id: string): StreamChunk[] {
  return [{ type: 'block-start', index: 0, blockType: 'tool-call' },
    { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId(id), name, arguments: JSON.stringify(arguments_) } },
    { type: 'finish', reason: { kind: 'tool-calls' } }]
}
class WriterAdapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []
  override async * stream(request: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(request)
    if (this.requests.length === 1) yield* toolCall('research_prepare_change', args, 'prepare')
    else if (this.requests.length === 2) {
      const id = /Operation ([0-9a-f-]+): prepared/.exec(JSON.stringify(request.messages))?.[1]
      if (id === undefined) throw new Error('Prepared operation did not reach the actual model request.')
      yield* toolCall('research_apply_change', { operationId: id }, 'apply')
    } else {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: 'The conditional result was saved; its parent use still needs assessment.' } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
}

beforeEach(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'aitp-write-tools-'))
  root = join(temporary, 'research')
  await mkdir(join(root, 'child'), { recursive: true })
  await writeFile(join(root, 'research.md'), '# Parent\n\n[Child](child/research.md) remains unresolved.\n')
  await writeFile(join(root, 'child/research.md'), source)
  workspace = new MarkdownWorkspace({ root, maxFiles: 50, maxFileBytes: 30_000, maxContextCharacters: 20_000 })
  writer = new ScratchWriter(workspace, { writableRoot: root, stateDirectory: join(temporary, 'operations'), maxOperationBytes: 100_000 })
})
afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  await rm(temporary, { recursive: true, force: true })
})

async function mount(options: {
  mode?: 'read-only' | 'workspace-write' | 'danger-full-access'
  cwd?: string
  writable?: boolean
  policy?: boolean
  origin?: boolean
  resultLimit?: number
  notificationFails?: boolean
} = {}) {
  const ctx = new Context()
  contexts.push(ctx)
  await mountAgentLoopTestDependencies(ctx)
  if (options.policy !== false) await ctx.plugin(SandboxPolicy, { mode: options.mode ?? 'danger-full-access', workspaceRoot: root })
  await ctx.plugin(AgentLoop, { agents: [] })
  installRuntime(ctx, { maxContextCharacters: 6000, maxWorkingItems: 10, maxItemCharacters: 2000,
    maxHumanInputs: 10, maxHumanCharacters: 3000 }, async () => ({ entries: [], omissions: [] }))
  const onApplied = vi.fn(async (_origin: ResearchOrigin, _operation: WriteOperation) => {
    if (options.notificationFails) throw new Error('Notification failed')
  })
  const dispose = installWriteTools(ctx, { maxResultCharacters: options.resultLimit ?? 4000,
    resolveTarget: async () => ({ writer, root, writable: options.writable ?? true }), onApplied })
  const adapter = new WriterAdapter()
  ctx.llm.registerAdapter(['mock'], adapter)
  const agent = await ctx.agentLoop.create(SessionId(`writing-${contexts.length}`), { provider: 'mock', model: 'mock' }, { cwd: options.cwd ?? root })
  if (options.origin !== false) agent.session.append('user/message', human('Original human instruction: preserve the failed route.'), { surfaceOp: 'append' })
  let count = 0
  const call = (name: string, arguments_: unknown, target: Agent = agent) => ctx.tools.execute({ name,
    arguments: arguments_, agent: target, callId: ToolCallId(`direct-${++count}`), signal: new AbortController().signal })
  return { ctx, agent, call, adapter, dispose, onApplied }
}

describe('research writer tools and Session authority', () => {
  it('prepares and applies through actual model calls while preserving original human input and attribution', async () => {
    const { ctx, agent, adapter, onApplied } = await mount({ origin: false })
    const input = human('Original human instruction: preserve the failed route.')
    agent.followup(input)
    await agent.whenIdle()
    expect(adapter.requests).toHaveLength(3)
    expect(JSON.stringify(adapter.requests[0]?.tools?.find(tool => tool.name === 'research_prepare_change')))
      .toContain('Copy the exact resource: locator shown beside a Source passage in research_read_context. This is not a topic: ID, file path or original human input sourceId; a locator does not grant write permission.')
    expect(await readFile(join(root, 'child/research.md'), 'utf8')).toContain('Result B holds only under A.')
    expect(await readFile(join(root, 'research.md'), 'utf8')).toContain('remains unresolved')
    const state = ctx.sessionProjections.stateOf(agent.session, 'researchWorking')
    expect(state?.humans).toHaveLength(1)
    if (state?.humans[0] === undefined) throw new Error('Original input was lost.')
    expect(readHumanInput(agent.session, state.humans[0])).toBe('Original human instruction: preserve the failed route.')
    const resultEvents = agent.session.snapshotEvents().filter(event => event.type === 'tool/result')
    expect(resultEvents).toHaveLength(2)
    expect(resultEvents.map(event => event.data.meta)).toMatchObject([
      { researchWrite: { state: 'prepared' } }, { researchWrite: { state: 'applied' } },
    ])
    const preparedText = resultEvents[0]?.data.message.content.filter(item => item.type === 'text').map(item => item.text).join('\n')
    expect(preparedText?.replace(/Operation [0-9a-f-]+:/, 'Operation <id>:')).toMatchInlineSnapshot(`
      "Operation <id>: prepared.
      Files: {\"prepared\":1}. Remaining scientific uses: 1.
      This is a model-prepared proposal, not an original human decision. Original human inputs remain unchanged.
      Scratch writing requires cooperative editing; arbitrary external edits are not globally coordinated.
      child/research.md: prepared; current observation: not rechecked.
      Remaining use: Check the parent implication.
      Supporting reference: report.md#control
      Details omitted: 0. Read source passages separately; do not infer complete scientific integration."
    `)
    expect(JSON.stringify(adapter.requests[2]?.messages)).toContain('Check the parent implication.')
    expect(onApplied).toHaveBeenCalledTimes(1)
    const operation = onApplied.mock.calls[0]?.[1]
    expect(operation?.proposal.binding).toEqual({ sessionId: agent.session.id, workspaceId: 'scratch', topicId: 'child' })
  })

  it('requires an active human-selected origin and a mounted policy', async () => {
    const missingOrigin = await mount({ origin: false })
    expect(text(await missingOrigin.call('research_prepare_change', args))).toContain('No human-selected research location')
    const noPolicy = await mount({ policy: false })
    expect(text(await noPolicy.call('research_prepare_change', args))).toContain('file policy is unavailable')
    expect(await readFile(join(root, 'child/research.md'), 'utf8')).toBe(source)
  })

  it('keeps read-only proposals inspectable and denies application under the current Session override', async () => {
    const { agent, call } = await mount()
    const id = operationId(await call('research_prepare_change', args))
    setSandboxMode(agent.session, 'read-only')
    const denied = await call('research_apply_change', { operationId: id })
    expect(denied.isError).toBe(true)
    expect(text(denied)).toContain('read-only')
    expect(text(await call('research_recover_change', { operationId: id }))).toContain('prepared')
    expect(await readFile(join(root, 'child/research.md'), 'utf8')).toBe(source)
  })

  it('does not let full Session access override a host root without write permission', async () => {
    const { call } = await mount({ writable: false })
    const id = operationId(await call('research_prepare_change', args))
    expect(text(await call('research_apply_change', { operationId: id }))).toContain('host has not enabled')
    expect(await readFile(join(root, 'child/research.md'), 'utf8')).toBe(source)
  })

  it('allows a child workspace to edit its own file but preflights all files before a multi-owner write', async () => {
    const { call } = await mount({ mode: 'workspace-write', cwd: join(root, 'child') })
    const broad = operationId(await call('research_prepare_change', { ...args, edits: [...args.edits, {
      resourceId: resourceIdForPath('research.md'), originalText: 'remains unresolved.', replacementText: 'now has a conditional result.',
      rationale: 'Parent consequence.', sourceRefs: [],
    }] }))
    expect(text(await call('research_apply_change', { operationId: broad }))).toContain('outside this session workspace-write')
    expect(await readFile(join(root, 'child/research.md'), 'utf8')).toBe(source)
    const narrow = operationId(await call('research_prepare_change', args))
    expect(text(await call('research_apply_change', { operationId: narrow }))).toContain(': applied.')
  })

  it('rejects foreign direction, conversation and unbound UI operation IDs', async () => {
    const { ctx, agent, call } = await mount()
    const id = operationId(await call('research_prepare_change', args))
    agent.session.append('user/message', human('Another direction', { ...origin, topicId: 'other' }), { surfaceOp: 'append' })
    expect(text(await call('research_apply_change', { operationId: id }))).toContain('different conversation or research direction')
    expect(text(await call('research_recover_change', { operationId: id }))).toContain('different conversation or research direction')
    const otherAgent = await ctx.agentLoop.create(SessionId('foreign'), { provider: 'mock', model: 'mock' }, { cwd: root })
    otherAgent.session.append('user/message', human('Same topic, new conversation.'), { surfaceOp: 'append' })
    expect(text(await call('research_apply_change', { operationId: id }, otherAgent))).toContain('different conversation or research direction')
    const unbound = await writer.prepare({ ...args, disposition: 'edit' })
    if (!unbound.ok) throw new Error(unbound.error.message)
    expect(text(await call('research_apply_change', { operationId: unbound.value.operationId }))).toContain('different conversation or research direction')
    expect(await readFile(join(root, 'child/research.md'), 'utf8')).toBe(source)
  })

  it('cannot overwrite human attribution by supplying scope or actor fields in model arguments', async () => {
    const { ctx, agent, call } = await mount()
    const result = await call('research_prepare_change', { ...args, binding: { sessionId: 'foreign', workspaceId: 'root', actor: 'human' } })
    expect(result.isError).toBe(false)
    const good = operationId(result)
    const operation = await writer.recover(good)
    if (!operation.ok) throw new Error(operation.error.message)
    expect(operation.value.proposal.binding).toEqual({ sessionId: agent.session.id, workspaceId: 'scratch', topicId: 'child' })
    expect(await writer.apply(good)).toMatchObject({ ok: false, error: { code: 'permission-denied' } })
    expect(ctx.sessionProjections.stateOf(agent.session, 'researchWorking')?.humans).toHaveLength(1)
  })

  it('keeps no-change, pending and unknown outcomes explicit without new source effects', async () => {
    const { call } = await mount()
    for (const disposition of ['no-change', 'pending']) {
      const id = operationId(await call('research_prepare_change', { disposition, rationale: 'No applied scientific change.', edits: [], remainingUses: [] }))
      expect(text(await call('research_recover_change', { operationId: id }))).toContain(`: ${disposition}.`)
    }
    const id = operationId(await call('research_prepare_change', args))
    const read = await writer.recover(id)
    if (!read.ok) throw new Error(read.error.message)
    const interrupted: WriteOperation = { ...read.value, state: 'applying', files: read.value.files.map(file => ({ ...file, state: 'applying' })) }
    await writeFile(join(temporary, 'operations', `${id}.json`), JSON.stringify(interrupted))
    expect(text(await call('research_apply_change', { operationId: id }))).toContain(': unknown.')
    expect(await readFile(join(root, 'child/research.md'), 'utf8')).toBe(source)
  })

  it('bounds the complete result, reports notification failure, and disposes tool registrations', async () => {
    const { ctx, call, dispose } = await mount({ resultLimit: 1024, notificationFails: true })
    const long = { ...args, remainingUses: Array.from({ length: 20 }, () => 'Long remaining use '.repeat(50)) }
    const preview = await call('research_prepare_change', long)
    expect(JSON.stringify({ text: text(preview) }).length).toBeLessThanOrEqual(1024)
    expect(text(preview)).toContain('Details omitted:')
    const applied = await call('research_apply_change', { operationId: operationId(preview) })
    expect(text(applied)).toContain('notification failed')
    expect(text(applied)).toContain(': applied.')
    dispose()
    expect(ctx.tools.schemas().filter(tool => tool.name.startsWith('research_') && tool.name.endsWith('_change'))).toEqual([])
  })
})
