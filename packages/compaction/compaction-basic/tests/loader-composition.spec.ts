import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import LlmRuntime, { LlmAdapter, LlmError, CONTEXT_WINDOW_EXCEEDED_CODE, createMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, LlmResolvedModelInfo, Message, StreamChunk } from '@deepseek-ai/dsh-llm'
import SessionStore, { Session, SessionId } from '@deepseek-ai/dsh-session'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { estimateMessage } from '@deepseek-ai/dsh-token-meter/src/estimate.ts'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import TokenMeter from '@deepseek-ai/dsh-token-meter'
import BasicCompactionEngine from '@deepseek-ai/dsh-compaction-basic'
import ToolResultPruner from '@deepseek-ai/dsh-compaction-tool-result-pruner'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

async function loadYaml(lines: readonly string[], prepare?: (ctx: Context) => Promise<void>): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-token-meter-loader-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [...lines, ''].join('\n'))

  context = new Context()
  await prepare?.(context)
  context.baseUrl = pathToFileURL(root).href + '/'
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-llm', LlmRuntime],
    ['@deepseek-ai/dsh-session', SessionStore],
    ['@deepseek-ai/dsh-session-projection', SessionProjectionRegistry],
    ['@deepseek-ai/dsh-token-meter', TokenMeter],
    ['@deepseek-ai/dsh-compaction-tool-result-pruner', ToolResultPruner],
    ['@deepseek-ai/dsh-compaction-basic', BasicCompactionEngine],
    ['@deepseek-ai/dsh-agent-loop', AgentLoop],
  ])
  context.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof context.loader.internal>
  await context.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await context.loader.await()
  return context
}

describe('real Loader composition', () => {
  it.each([
    { model: 'large', manual: false }, { model: 'small', manual: false }, { model: 'small', manual: true },
  ])('restores pressure and the selected $model route with manual=$manual', async ({ model, manual }) => {
    const requests: GenerateOptions[] = []
    const adapter = new class extends LlmAdapter {
      override resolveModel(provider: string, id: string): Promise<LlmResolvedModelInfo> {
        return Promise.resolve({ provider, id, name: id, context: { contextWindow: id === 'small' ? 2048 : 4096 } })
      }
      override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
        requests.push(options)
        const tokens = options.messages.reduce((sum, message) => sum + estimateMessage(message as Message), 0)
        const capacity = options.model === 'small' ? 2048 : 4096
        if (tokens + (options.maxTokens ?? 0) > capacity) {
          throw new LlmError('fixture context overflow', CONTEXT_WINDOW_EXCEEDED_CODE)
        }
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: options.purpose === 'compaction' ? 'Prior evidence retained in source history.' : 'Resumed successfully.' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }()
    const loaded = await loadYaml([
      "- name: '@deepseek-ai/dsh-token-meter'",
      "- name: '@deepseek-ai/dsh-compaction-basic'",
      '  config:', '    headroomTokens: 0', '    thresholdRatio: 0.5',
      '    retainTokens: 64', '    maxTokens: 128', '    compactionRetries: 0',
      "- name: '@deepseek-ai/dsh-agent-loop'", '  config:', '    agents: []',
    ], async (ctx) => {
      await mountAgentLoopTestDependencies(ctx, { systemPrompt: { includeHarnessIdentity: false, includeRuntimeContext: false } })
      ctx.llm.registerAdapter(['mock'], adapter)
    })
    const seed = Session.create(SessionId('restored-source'))
    for (let turn = 1; turn <= 8; turn += 1) {
      seed.append('turn/start', { turn })
      seed.append('user/message', createUserMessage({ content: [{ type: 'text', text: `evidence ${turn} ` + 'evidence '.repeat(150) }], source: { kind: 'user' } }), { surfaceOp: 'append' })
      seed.append('step/start', { turn, step: 1 })
      if (turn === 1) seed.append('request/header', { header: { config: { provider: 'mock', model: manual ? model : 'large' } }, reason: 'initial' })
      seed.append('assistant/message', {
        turn, step: 1, stream: [], message: createMessage({ role: 'assistant', content: [{ type: 'text', text: 'analysis '.repeat(150) }], source: { kind: 'model', provider: 'mock', model: 'large' } }),
      }, { surfaceOp: 'append' })
      seed.append('step/end', { turn, step: 1 })
      seed.append('turn/end', { turn, reason: { kind: 'completed' } })
    }
    const { agent } = await loaded.agentLoop.createAgent(loaded, {
      sessionId: SessionId(`restored-${model}`), seed: seed.snapshotEvents(), agentOptions: { provider: 'mock', model },
    })
    expect(agent.session.requestHeader()?.config.model).toBe(manual ? model : 'large')
    if (manual) await expect(loaded.compaction.compactNow(agent, new AbortController().signal)).resolves.not.toBeNull()
    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Continue.' }], source: { kind: 'user' } }))
    await agent.whenIdle()
    expect(agent.session.snapshotEvents().at(-1), JSON.stringify(agent.session.snapshotEvents().filter(event => event.type === 'compaction/end'))).toMatchObject({ type: 'turn/end', data: { reason: { kind: 'completed' } } })
    const summaries = requests.filter(request => request.purpose === 'compaction')
    expect(summaries.length).toBeGreaterThan(1)
    expect(summaries.length).toBeLessThan(16)
    expect(summaries.every(request => request.provider === 'mock' && request.model === model)).toBe(true)
    expect(requests.filter(request => request.purpose !== 'compaction')).toHaveLength(model === 'large' || manual ? 1 : 2)
    expect(agent.session.snapshotEvents().at(-1)).toMatchObject({ type: 'turn/end', data: { reason: { kind: 'completed' } } })
    const replay = Session.create(SessionId(`replayed-${model}`), agent.session.snapshotEvents())
    expect(replay.deriveMessages()).toEqual(agent.session.deriveMessages())
    expect(replay.requestHeader()?.config.model).toBe(model)
  })

  it('loads the shipped token-meter, pruning, and compaction-basic YAML order', async () => {
    const loaded = await loadYaml([
      "- name: '@deepseek-ai/dsh-llm'",
      "- name: '@deepseek-ai/dsh-session'",
      "- name: '@deepseek-ai/dsh-session-projection'",
      "- name: '@deepseek-ai/dsh-token-meter'",
      "- name: '@deepseek-ai/dsh-compaction-tool-result-pruner'",
      '  config:',
      '    thresholdChars: 100',
      '    headChars: 20',
      '    tailChars: 10',
      "- name: '@deepseek-ai/dsh-compaction-basic'",
      '  config:',
      '    thresholdRatio: 0.5',
      '    headroomTokens: 4000',
      '    modelPolicies:',
      '      - provider: mock',
      '        model: small',
      '        headroomTokens: 0',
      '        maxTokens: 32',
      '    retainRatio: 0.125',
      '    auto: false',
    ])

    const unloaded = [...loaded.loader.entries()]
      .filter(entry => entry.fiber === undefined && !entry.disabled)
      .map(entry => entry.options.name)
    expect(unloaded).toEqual([])
    expect(loaded.get('toolResultPruner')).toBeInstanceOf(ToolResultPruner)
    expect(loaded.get('compaction')).toBeInstanceOf(BasicCompactionEngine)
    expect((loaded.compaction as BasicCompactionEngine).config).toMatchObject({
      thresholdRatio: 0.5,
      headroomTokens: 4000,
      modelPolicies: [{ provider: 'mock', model: 'small', headroomTokens: 0, maxTokens: 32 }],
      retainRatio: 0.125,
      auto: false,
    })
  })

  it('rejects stale token-meter config after Schemastery normalization', async () => {
    context = new Context()
    await context.plugin(SessionProjectionRegistry)
    await expect(context.plugin(TokenMeter, {
      contextWindow: 4096,
    } as never)).rejects.toThrow(/TokenMeterConfig: unknown key "contextWindow"/)
  })

  it('rejects stale compaction-basic config after Schemastery normalization', async () => {
    context = new Context()
    await context.plugin(LlmRuntime)
    await context.plugin(SessionStore)
    await context.plugin(SessionProjectionRegistry)
    await context.plugin(TokenMeter)
    await expect(context.plugin(BasicCompactionEngine, {
      models: { legacy: { thresholdRatio: 0.5 } },
    } as never)).rejects.toThrow(/BasicCompactionConfig: unknown key "models"/)
  })

  it('rejects a capacity-independent merged ratio conflict during plugin load', async () => {
    context = new Context()
    await context.plugin(LlmRuntime)
    await context.plugin(SessionStore)
    await context.plugin(SessionProjectionRegistry)
    await context.plugin(TokenMeter)
    await expect(context.plugin(BasicCompactionEngine, {
      retainRatio: 0.2,
      modelPolicies: [{
        provider: 'test-provider',
        model: 'test-model',
        thresholdRatio: 0.1,
      }],
    })).rejects.toThrow(/modelPolicies\[0\]: retainRatio \(0.2\).*thresholdRatio \(0.1\)/)
  })

  it('rejects an incomplete model-policy summarization pair during plugin load', async () => {
    context = new Context()
    await context.plugin(LlmRuntime)
    await context.plugin(SessionStore)
    await context.plugin(SessionProjectionRegistry)
    await context.plugin(TokenMeter)
    await expect(context.plugin(BasicCompactionEngine, {
      summarizationProvider: 'default-provider',
      summarizationModel: 'default-model',
      modelPolicies: [{
        provider: 'test-provider',
        model: 'test-model',
        summarizationModel: '',
      }],
    })).rejects.toThrow(/modelPolicies\[0\].*must be set together/)
  })
})
