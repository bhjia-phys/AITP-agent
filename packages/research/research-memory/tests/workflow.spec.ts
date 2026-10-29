/** Default workflow uses real native admission, questions, policies and scratch files. */
import { mkdtemp, mkdir, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { SessionRequestId } from '@deepseek-ai/dsh-api-session-controller/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import SandboxPolicy from '@deepseek-ai/dsh-sandbox-policy'
import UserQuestions from '@deepseek-ai/dsh-user-questions'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { LlmAdapter, ToolCallId, createUserMessage, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { afterEach, expect, it, vi } from 'vitest'
import ResearchMemory from '../src/index.ts'
import { resourceIdForPath } from '../src/markdown-files.ts'
import ExactSessionQuery from './fixtures/runtime/query-plugin.ts'
import { promptAdmission } from './fixtures/admission.ts'

const disposers: (() => Promise<unknown>)[] = []
afterEach(async () => { for (const dispose of disposers.splice(0).reverse()) await dispose() })
const workspaceId = brandString<WorkspaceId>('workflow-test')
const signal = () => new AbortController().signal
class Capture extends LlmAdapter {
  readonly requests: GenerateOptions[] = []
  initialize = false
  writeStage = -1
  override async *stream(request: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(request)
    if (this.writeStage >= 0 && this.writeStage < 2) {
      const preparing = this.writeStage++ === 0
      const operationId = /Operation ([0-9a-f-]+): prepared/.exec(JSON.stringify(request.messages))?.[1]
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId(preparing ? 'workflow-prepare' : 'workflow-apply'),
        name: preparing ? 'research_prepare_change' : 'research_apply_change', arguments: JSON.stringify(preparing ? {
          disposition: 'edit', rationale: 'Keep the explicit finite-system constraint.', edits: [{ resourceId: resourceIdForPath('research.md'),
            originalText: '研究结论尚未记录。', replacementText: '研究结论尚未记录；只保留 N=6 的研究范围。', rationale: 'Human scope', sourceRefs: [] }], remainingUses: [],
        } : { operationId }) } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
      return
    }
    if (this.initialize) {
      this.initialize = false
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId('initialize-project'),
        name: 'research_initialize_project', arguments: JSON.stringify({ title: '边界控制', question: '有限控制能说明什么？', language: 'zh' }) } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
      return
    }
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Only a finite control.' } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}
async function fixture(mode: 'workspace-write' | 'read-only' = 'workspace-write') {
  const temp = await mkdtemp(join(tmpdir(), 'research-workflow-'))
  disposers.push(() => rm(temp, { force: true, recursive: true }))
  const root = join(temp, 'project'); await mkdir(root)
  const ctx = new Context(); disposers.push(() => ctx.fiber.dispose())
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(ExactSessionQuery)
  await ctx.plugin(UserQuestions)
  await ctx.plugin(SandboxPolicy, { mode, workspaceRoot: root })
  await ctx.plugin(AgentLoop, { agents: [] })
  const model = new Capture(); ctx.llm.registerAdapter(['workflow-capture'], model)
  ctx.provide('dshHomePath', (...parts: string[]) => join(temp, 'home', ...parts))
  ctx.provide('workspaceRegistry', { get: (id: WorkspaceId) => id === workspaceId ? { path: root } : undefined } as never)
  const admission = promptAdmission(ctx)
  ctx.provide('sessionController', { ...admission,
    prompt: (request: Parameters<typeof admission.promptAttributed>[0]) => admission.promptAttributed(request, { kind: 'user' }, () => {}),
  } as never)
  await ctx.plugin(ResearchMemory, ResearchMemory.Config({}))
  const agent = await ctx.agentLoop.create(SessionId('workflow-session'), { provider: 'workflow-capture', model: 'capture' }, { cwd: root })
  let seq = 0
  const send = async () => {
    await ctx.researchMemory.promptWorkflow({ workspaceId, sessionId: agent.id, mode: 'queue',
      requestId: brandString<SessionRequestId>(`workflow-${++seq}`), clientTimeZone: 'Asia/Shanghai',
      content: [{ type: 'text', text: '讨论这个文件夹里的有限边界控制。' }] }, signal())
    await agent.whenIdle()
  }
  return { ctx, root, model, agent, send }
}

it('associates an empty folder read-only, then retains an exact human-confirmed account in subsequent native context', async () => {
  const f = await fixture()
  await f.send()
  expect(await readdir(f.root)).toEqual([])
  expect(JSON.stringify(f.model.requests[0])).toContain('Research workflow is enabled')
  expect(JSON.stringify(f.model.requests[0])).toContain('Direct folder entries')
  expect(await f.ctx.researchMemory.getSetup({ workspaceId })).toMatchObject({ value: { writable: false } })
  let confirmedQuestion = ''
  f.ctx.on('user-questions/request', async (request) => {
    confirmedQuestion = request.questions[0]!.question
    return { answers: [{ id: 'initialize-research', selected: ['确认并建立课题'] }] }
  })
  f.model.initialize = true
  await f.send()
  expect(confirmedQuestion).toContain(f.root)
  expect(confirmedQuestion).toContain('有限控制能说明什么？')
  expect(await readdir(f.root)).toEqual(['research.md'])
  expect(await readFile(join(f.root, 'research.md'), 'utf8')).toContain('研究结论尚未记录')
  expect(JSON.stringify(f.model.requests.at(-1))).toContain('有限控制能说明什么？')
  const state = f.ctx.sessionProjections.stateOf(f.agent.session, 'researchWorking')!
  expect(state.origin).toMatchObject({ workspaceId, workflow: 'research' })
  expect(state.humans.some(item => item.sourceId === 'answer:initialize-project')).toBe(true)
  f.model.writeStage = 0
  await f.send()
  expect(await readFile(join(f.root, 'research.md'), 'utf8')).toContain('只保留 N=6 的研究范围')
})

it.each(['decline', 'read-only'] as const)('preserves source files when initialization is %s', async (reason) => {
  const f = await fixture(reason === 'read-only' ? 'read-only' : 'workspace-write')
  let asked = false
  f.ctx.on('user-questions/request', async () => {
    asked = true
    return { answers: [{ id: 'initialize-research', selected: ['先讨论，暂不建档'] }] }
  })
  f.model.initialize = true
  await f.send()
  expect(await readdir(f.root)).toEqual([])
  expect(asked).toBe(reason === 'decline')
  expect(await f.ctx.researchMemory.getSetup({ workspaceId })).toMatchObject({ value: { writable: false } })
})

it('continues ordinary history without retrospective Research ownership', async () => {
  const f = await fixture()
  f.agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'An ordinary task.' }] }))
  await f.agent.whenIdle()
  await f.send()
  expect(f.ctx.sessionProjections.stateOf(f.agent.session, 'researchWorking')?.origin).toBeNull()
  expect(JSON.stringify(f.model.requests.at(-1))).not.toContain('Research workflow is enabled')
  expect(await readdir(f.root)).toEqual([])
})


it('rechecks Session file permissions after the researcher answers the initialization question', async () => {
  const f = await fixture()
  f.ctx.on('user-questions/request', async () => {
    vi.spyOn(f.ctx.sandboxPolicy, 'resolve').mockReturnValue({ mode: 'read-only', workspaceRoot: f.root })
    return { answers: [{ id: 'initialize-research', selected: ['确认并建立课题'] }] }
  })
  f.model.initialize = true
  try {
    await f.send()
    expect(await readdir(f.root)).toEqual([])
    expect(await f.ctx.researchMemory.getSetup({ workspaceId })).toMatchObject({ value: { writable: false } })
    expect(JSON.stringify(f.model.requests.at(-1))).toContain('read-only')
  } finally { vi.restoreAllMocks() }
})
