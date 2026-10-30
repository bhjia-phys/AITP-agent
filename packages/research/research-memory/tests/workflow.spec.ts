/** Default workflow uses real native admission, questions, policies and scratch files. */
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
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
import { ResearchOnboarding } from '../src/onboarding.ts'
import ExactSessionQuery from './fixtures/runtime/query-plugin.ts'
import { promptAdmission } from './fixtures/admission.ts'

const disposers: (() => Promise<unknown>)[] = []
afterEach(async () => { for (const dispose of disposers.splice(0).reverse()) await dispose() })
const workspaceId = brandString<WorkspaceId>('workflow-test')
const signal = () => new AbortController().signal
class Capture extends LlmAdapter {
  readonly requests: GenerateOptions[] = []
  initialize = false
  preserveExisting = false
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
        name: 'research_initialize_project', arguments: JSON.stringify({ title: '边界控制', question: '有限控制能说明什么？', language: 'zh', preserveExisting: this.preserveExisting }) } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
      return
    }
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Only a finite control.' } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}
async function fixture(mode: 'workspace-write' | 'read-only' = 'workspace-write', attributedAdmission = true) {
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
  ctx.provide('workspaceRegistry', {
    get: (id: WorkspaceId) => id === workspaceId ? { path: root } : undefined,
    list: () => [{ id: workspaceId, path: root }],
  } as never)
  const admission = promptAdmission(ctx)
  ctx.provide('sessionController', attributedAdmission
    ? { ...admission,
      prompt: (request: Parameters<typeof admission.promptAttributed>[0]) => admission.promptAttributed(request, { kind: 'user' }, () => {}),
    }
    : { resolveAgent: admission.resolveAgent,
      prompt: (request: Parameters<typeof admission.promptAttributed>[0]) => admission.promptAttributed(request, { kind: 'user' }, () => {}),
    } as never)
  await ctx.plugin(ResearchMemory, ResearchMemory.Config({}))
  const agent = await ctx.agentLoop.create(SessionId('workflow-session'), { provider: 'workflow-capture', model: 'capture' }, { cwd: root })
  let seq = 0
  const send = async (text = '讨论这个文件夹里的有限边界控制。') => {
    await ctx.researchMemory.promptWorkflow({ workspaceId, sessionId: agent.id, mode: 'queue',
      requestId: brandString<SessionRequestId>(`workflow-${++seq}`), clientTimeZone: 'Asia/Shanghai',
      content: [{ type: 'text', text }] }, signal())
    await agent.whenIdle()
  }
  return { ctx, root, model, agent, send }
}

it('enrolls the authorized question once and retains its account in subsequent native context', async () => {
  const f = await fixture()
  await f.send()
  expect(await readdir(f.root)).toEqual([])
  expect(JSON.stringify(f.model.requests[0])).toContain('Research workflow is enabled')
  expect(JSON.stringify(f.model.requests[0])).toContain('Direct folder entries')
  expect(await f.ctx.researchMemory.getSetup({ workspaceId })).toMatchObject({ value: { writable: false } })
  const ask = vi.spyOn(f.ctx.userQuestions, 'ask')
  f.model.initialize = true
  await f.send('已确认：建立边界控制课题，问题是有限控制能说明什么；允许初始化并保存。')
  expect(ask).not.toHaveBeenCalled()
  expect(await f.ctx.researchMemory.getSetup({ workspaceId })).toMatchObject({ value: { writable: true } })
  expect(await readdir(f.root)).toEqual(['research.md'])
  expect(await readFile(join(f.root, 'research.md'), 'utf8')).toContain('研究结论尚未记录')
  expect(JSON.stringify(f.model.requests.at(-1))).toContain('有限控制能说明什么？')
  const state = f.ctx.sessionProjections.stateOf(f.agent.session, 'researchWorking')!
  expect(state.origin).toMatchObject({ workspaceId, workflow: 'research' })
  expect(state.humans.some(item => item.sourceId === 'answer:initialize-project')).toBe(false)
  expect(state.pending.some(item => item.callId === 'initialize-project')).toBe(false)
  f.model.writeStage = 0
  await f.send()
  expect(await readFile(join(f.root, 'research.md'), 'utf8')).toContain('只保留 N=6 的研究范围')
})

it('uses the standard composer when the host has no attributed-admission seam', async () => {
  const f = await fixture('workspace-write', false)
  await f.send('Keep the finite boundary condition explicit.')
  expect(JSON.stringify(f.model.requests.at(-1))).toContain('Keep the finite boundary condition explicit.')
  expect(JSON.stringify(f.model.requests.at(-1))).toContain('Research workflow is enabled')
  const events = f.agent.session.snapshotEvents().filter(event => event.type === 'user/message')
  expect(events.filter(event => event.data.source.kind === 'user')).toHaveLength(1)
  expect(events.filter(event => event.data.source.kind === 'aitp-research')).toHaveLength(0)
  // The host-owned projection stays a literal Session-log projection. Runtime
  // consumers use the plugin resolver for its model-invisible binding.
  expect(f.ctx.sessionProjections.stateOf(f.agent.session, 'researchWorking')?.origin).toBeNull()
})

it('preserves files and enrollment when native Session policy is read-only', async () => {
  const f = await fixture('read-only')
  const ask = vi.spyOn(f.ctx.userQuestions, 'ask')
  f.model.initialize = true
  await f.send('建立并保存已确认的边界控制课题。')
  expect(await readdir(f.root)).toEqual([])
  expect(ask).not.toHaveBeenCalled()
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


it('rechecks native file permissions immediately before initialization', async () => {
  const f = await fixture()
  const resolve = f.ctx.sandboxPolicy.resolve.bind(f.ctx.sandboxPolicy)
  let observations = 0
  vi.spyOn(f.ctx.sandboxPolicy, 'resolve').mockImplementation(request =>
    ++observations >= 2 ? { mode: 'read-only', workspaceRoot: f.root } : resolve(request))
  f.model.initialize = true
  try {
    await f.send('建立并保存已确认的边界控制课题。')
    expect(await readdir(f.root)).toEqual([])
    expect(await f.ctx.researchMemory.getSetup({ workspaceId })).toMatchObject({ value: { writable: false } })
    expect(JSON.stringify(f.model.requests.at(-1))).toContain('read-only')
  } finally { vi.restoreAllMocks() }
})

it.each(['research.md', 'README.md'])('enrolls an existing %s without changing its source bytes', async (account) => {
  const f = await fixture()
  const original = '# Independently authored question\n\nA bounded argument with its existing links and limitations.\n'
    + (account === 'README.md' ? '\n## Topics\n[Existing question](branch/research.md)\n' : '')
  if (account === 'README.md') {
    await mkdir(join(f.root, 'branch'))
    await writeFile(join(f.root, 'branch/research.md'), '# Existing question\nOnly a bounded control.\n')
  }
  await writeFile(join(f.root, account), original)
  f.model.initialize = true
  f.model.preserveExisting = true
  await f.send('已确认可以保存：保留已写好的科研主记录，启用这个目录的工作台保存，不重写正文。')
  expect(await readFile(join(f.root, account), 'utf8')).toBe(original)
  if (account === 'README.md') await expect(readFile(join(f.root, 'research.md'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await f.ctx.researchMemory.getSetup({ workspaceId })).toMatchObject({ value: { writable: true } })
  const state = f.ctx.sessionProjections.stateOf(f.agent.session, 'researchWorking')!
  expect(state.humans.some(item => item.sourceId === 'answer:initialize-project')).toBe(false)
  expect(state.pending.some(item => item.callId === 'initialize-project')).toBe(false)
})

it.each(['research.md', 'README.md'])('does not replace %s if it disappears after the preservation observation', async (account) => {
  const f = await fixture()
  const original = '# Existing account\n\nOriginal evidence and qualifications.\n'
    + (account === 'README.md' ? '\n## Topics\n[Existing question](branch/research.md)\n' : '')
  if (account === 'README.md') {
    await mkdir(join(f.root, 'branch'))
    await writeFile(join(f.root, 'branch/research.md'), '# Existing question\nOnly a bounded control.\n')
  }
  await writeFile(join(f.root, account), original)
  await f.send()
  expect(await f.ctx.researchMemory.getSetup({ workspaceId })).toMatchObject({ value: { writable: false } })
  const initialize = ResearchOnboarding.prototype.initialize
  const observation = vi.spyOn(ResearchOnboarding.prototype, 'initialize').mockImplementation(async function (
    this: ResearchOnboarding, root, request, reader, existingAccountPath,
  ) {
    // A real external removal occurs after getProject, before the enrollment lock checks the source.
    await rm(join(root, account))
    return initialize.call(this, root, request, reader, existingAccountPath)
  })
  f.model.initialize = true
  f.model.preserveExisting = true
  try {
    await f.send('已允许启用保存，但保留原记录；原记录不存在时不得新建替代记录。')
    expect(observation).toHaveBeenCalledTimes(1)
    await expect(readFile(join(f.root, account))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(join(f.root, 'research.md'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readdir(f.root)).toEqual(account === 'README.md' ? ['branch'] : [])
    expect(await f.ctx.researchMemory.getSetup({ workspaceId })).toMatchObject({ value: { writable: false } })
    expect(JSON.stringify(f.model.requests.at(-1))).toContain('previously observed research account is no longer present')
  } finally { observation.mockRestore() }
})
