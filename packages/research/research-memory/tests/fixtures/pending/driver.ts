/** Production timed questioning and research context through Loader, compaction and cold JSONL restore. */
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import LlmRuntime, { createUserMessage, LlmAdapter, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import Projections from '@deepseek-ai/dsh-session-projection'
import * as Persistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import Prompt from '@deepseek-ai/dsh-system-prompt'
import Tools from '@deepseek-ai/dsh-tools'
import Agents from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import Typert from '@deepseek-ai/dsh-typert-registry'
import Policy from '@deepseek-ai/dsh-sandbox-policy'
import ResearchMemory from '@deepseek-ai/dsh-research-memory'
import TokenMeter from '@deepseek-ai/dsh-token-meter'
import Compaction from '@deepseek-ai/dsh-compaction-basic'
import UserQuestions from '@deepseek-ai/dsh-user-questions'
import * as AskUser from '@deepseek-ai/dsh-tool-ask-user'
import ExactSessionQuery from '../runtime/query-plugin.ts'

const supplied = process.argv[2]
if (supplied === undefined) throw new Error('Pending-question fixture requires its Loader configuration.')
const configPath = supplied
const root = resolve('notes')
const ownerId = SessionId('pending-owner')
const origin = { workspaceId: 'pending-workspace', topicId: 'topic:child%2Fresearch.md', resourceId: 'resource:child%2Fresearch.md' }
const options = { provider: 'pending-fixture', model: 'pending-fixture' }
const question = '请选择还未确定的边界条件。'
const choices = [{ label: '周期边界', description: '保留平移对称' }, { label: '开边界', description: '改变边界作用' }]
let initialQuestionSent = false
let compacted = 0

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

function runtimeText(request: GenerateOptions): string {
  const context = request.messages.findLast(message => message.role === 'user' && message.source?.kind === 'runtime-context')
  return JSON.stringify(context)
}

class Adapter extends LlmAdapter {
  override async * stream(request: GenerateOptions): AsyncIterable<StreamChunk> {
    await appendFile('pending-requests.jsonl', JSON.stringify(request) + '\n')
    if (request.purpose === 'compaction') compacted++
    if (request.sessionId === ownerId && request.purpose === undefined && !initialQuestionSent) {
      initialQuestionSent = true
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId('pending-boundary'),
        name: 'ask_user_question', arguments: JSON.stringify({ questions: [{ id: 'boundary', question, options: choices }], timeout: 1 }) } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
      return
    }
    if (request.sessionId === 'pending-reference-reader'
      && !request.messages.some(message => message.role === 'tool' && message.toolCallId === 'reopen-pending')) {
      const reference = /Source Unanswered assistant question \[(session:pending-owner#\d+)\]/.exec(runtimeText(request))?.[1]
      assert(reference !== undefined, 'The fresh request did not expose its pending question reference.')
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId('reopen-pending'),
        name: 'research_read_context', arguments: JSON.stringify({ sourceId: reference }) } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
      return
    }
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'A short summary. No question, options or decision retained here.' } }
    yield { type: 'usage', usage: { inputTokens: 100, outputTokens: 12 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

const mock = { name: 'pending-model-substitute', inject: ['llm'], apply(ctx: Context): void {
  ctx.llm.registerAdapter(['pending-fixture'], new Adapter())
} }

async function boot(): Promise<Context> {
  const ctx = new Context()
  ctx.provide('dshHomePath', (...parts: string[]) => resolve('.home', ...parts))
  ctx.baseUrl = pathToFileURL(dirname(configPath)).href + '/'
  await ctx.plugin(Loader)
  Object.assign(ctx.loader.builtins, { include: Include, llm: LlmRuntime, sessions: SessionStore,
    projections: Projections, persistence: Persistence, query: ExactSessionQuery, prompt: Prompt,
    tools: Tools, agents: Agents, loop: AgentLoop, typert: Typert, policy: Policy, meter: TokenMeter,
    compaction: Compaction, questions: UserQuestions, ask: AskUser, mock, research: ResearchMemory })
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  for (const entry of ctx.loader.entries()) await entry.fiber?.await()
  assert(ctx.get('researchMemory') !== undefined, 'The production research-memory service did not load.')
  return ctx
}

async function ask(ctx: Context, id: string, text: string): Promise<Agent> {
  const agent = await ctx.agentLoop.create(SessionId(id), options, { cwd: root })
  agent.followup(createUserMessage({ source: { kind: 'aitp-research', actor: 'human', origin },
    content: [{ type: 'text', text }] }))
  await agent.whenIdle()
  await ctx.sessions.flush(agent.session)
  return agent
}

await mkdir(join(root, 'child'), { recursive: true })
await writeFile(join(root, 'research.md'), '# Project\n\n[Child](child/research.md) owns the finite question.\n')
await writeFile(join(root, 'child/research.md'), '# Child\n\nOnly the stated finite-system question is studied.\n')
let ctx = await boot()
try {
  const owner = await ask(ctx, ownerId, '继续这个课题；边界条件尚未选择，需要时请向我提问。')
  assert(ctx.sessionProjections.stateOf(owner.session, 'researchWorking')?.pending.length === 1, 'Timed question lost its pending source.')
  await ask(ctx, 'pending-fresh-before', '新对话只恢复还没有回答的问题和全部选项。')
  for (let index = 0; index < 2; index++) {
    owner.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'No answer was supplied. '.repeat(80) }] }))
    await owner.whenIdle()
    const result = await ctx.compaction.compactNow(owner, new AbortController().signal)
    assert(result !== null, 'The fixture had no compactable region.')
  }
  await ctx.sessions.flush(owner.session)
  await writeFile('pending-before-cold.json', JSON.stringify(owner.session.snapshotEvents()))
} finally { await ctx.fiber.dispose() }

ctx = await boot()
try {
  const handle = await ctx.agents.resume({ resumeSessionId: ownerId, agentOptions: options })
  handle.agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '冷恢复后，仍未提供边界选择。' }] }))
  await handle.agent.whenIdle()
  await ctx.sessions.flush(handle.agent.session)
  await ask(ctx, 'pending-reference-reader', '新对话从交付的引用重新打开还未回答的问题，不选任何选项。')
  const requests = (await readFile('pending-requests.jsonl', 'utf8')).trim().split('\n').map(line => JSON.parse(line) as GenerateOptions)
  const selected = ['pending-fresh-before', ownerId, 'pending-reference-reader'].map(id => requests.findLast(request => request.sessionId === id && request.purpose === undefined))
  assert(selected.every(request => request !== undefined && runtimeText(request).includes(question)), 'A latest research-context snapshot lost the original pending question.')
  await writeFile('pending-result.json', JSON.stringify({ compacted,
    state: ctx.sessionProjections.stateOf(handle.agent.session, 'researchWorking'),
    questions: ctx.sessionProjections.stateOf(handle.agent.session, 'userQuestions'),
    source: await readFile(join(root, 'child/research.md'), 'utf8'),
  }))
} finally { await ctx.fiber.dispose() }
