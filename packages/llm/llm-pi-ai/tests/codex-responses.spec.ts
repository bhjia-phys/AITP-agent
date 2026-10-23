/** Exercise the Codex OAuth route through the real adapter and an isolated SSE server. */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import * as codexTransport from '@earendil-works/pi-ai/api/openai-codex-responses'
import { Context } from '@deepseek-ai/cordis'
import LocalCredentialProvider from '@deepseek-ai/dsh-credentials-local'
import LlmRuntime, { createToolResultMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, Message } from '@deepseek-ai/dsh-llm'
import * as LlmPiAi from '@deepseek-ai/dsh-llm-pi-ai'
import { recordKeyFor } from '../src/auth.ts'
import { assemble } from './assemble.ts'
import { closeMockServers, mockServer } from './mock-server.ts'

vi.mock('@earendil-works/pi-ai/api/openai-codex-responses', async (importOriginal) => {
  const actual = await importOriginal<typeof codexTransport>()
  return { ...actual, closeOpenAICodexWebSocketSessions: vi.fn(actual.closeOpenAICodexWebSocketSessions) }
})

const contexts: Context[] = []
const roots: string[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  await closeMockServers()
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

function frames(toolCalls: boolean): string[] {
  const items = toolCalls ? [
    { type: 'reasoning', id: 'rs_1', encrypted_content: 'opaque-reasoning', summary: [] },
    ...[1, 2].map(index => ({ type: 'function_call', id: `fc_${index}`, call_id: `call_${index}`,
      name: 'lookup', arguments: JSON.stringify({ value: index }), status: 'completed' })),
  ] : [{ type: 'message', id: 'msg_1', role: 'assistant', status: 'completed',
    content: [{ type: 'output_text', text: 'complete', annotations: [] }] }]
  return [
    JSON.stringify({ type: 'response.created', response: { id: 'resp_1' } }),
    ...items.flatMap((item, output_index) => [
      JSON.stringify({ type: 'response.output_item.added', output_index, item }),
      JSON.stringify({ type: 'response.output_item.done', output_index, item }),
    ]),
    JSON.stringify({ type: 'response.completed', response: {
      id: 'resp_1', status: 'completed', output: items,
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    } }),
  ]
}

async function harness(url: string): Promise<Context> {
  const root = await mkdtemp(join(tmpdir(), 'aitp-codex-wire-'))
  roots.push(root)
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(LocalCredentialProvider, { path: join(root, '.credentials.yaml'), watch: false })
  const access = `fixture.${Buffer.from(JSON.stringify({
    'https://api.openai.com/auth': { chatgpt_account_id: 'fixture-account' },
  })).toString('base64url')}.fixture`
  await ctx.credentials.modifyRecord(recordKeyFor('openai-codex'), () => Promise.resolve({
    kind: 'grant', payload: { type: 'oauth', access, refresh: 'unused-fixture',
      accountId: 'fixture-account', expires: Date.now() + 3600_000 },
  }))
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(LlmPiAi, { providers: {
    'openai-codex': { baseURL: url, transport: 'sse', streamIdleTimeoutMs: 5000 },
  } })
  return ctx
}

const prompt = createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Look up both values.' }] })
const tool = { name: 'lookup', description: 'Look up a fixture value.',
  parameters: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] } }
const route = { provider: 'openai-codex', model: 'gpt-6.1-sol' }

it('replays opaque reasoning and parallel tool IDs after serializing the OAuth response', async () => {
  const server = await mockServer([{ events: frames(true) }, { events: frames(false) }])
  const ctx = await harness(server.url)
  const first = await assemble(ctx, { ...route, messages: [prompt], tools: [tool] })
  expect(first.finish).toEqual({ kind: 'tool-calls' })
  const calls = first.message.content.filter(block => block.type === 'tool-call')
  expect(calls).toHaveLength(2)
  const history = JSON.parse(JSON.stringify([prompt, first.message, ...calls.map(call => createToolResultMessage({
    callId: call.id, content: [{ type: 'text', text: 'fixture result' }], isError: false,
  }))])) as Message[]
  const second = await assemble(ctx, { ...route, messages: history, tools: [tool] })
  expect(second.finish).toEqual({ kind: 'stop' })
  expect(server.paths).toEqual(['/codex/responses', '/codex/responses'])
  expect(server.headers[0]?.['chatgpt-account-id']).toBe('fixture-account')
  expect(server.requests[1]).toMatchObject({ store: false, input: expect.arrayContaining([
    expect.objectContaining({ type: 'reasoning', encrypted_content: 'opaque-reasoning' }),
    ...[1, 2].flatMap(index => [
      expect.objectContaining({ type: 'function_call', call_id: `call_${index}` }),
      expect.objectContaining({ type: 'function_call_output', call_id: `call_${index}`, output: 'fixture result' }),
    ]),
  ]) })
})

it.each([401, 429, 503])('returns HTTP %i without hidden HTTP retries', async (status) => {
  const server = await mockServer([{ status, body: JSON.stringify({ error: { message: `HTTP ${status}` } }) }])
  const ctx = await harness(server.url)
  const result = await assemble(ctx, { ...route, messages: [prompt] })
  expect(result.finish.kind).toBe('error')
  expect(server.requests).toHaveLength(1)
})

it('cancels a waiting Codex stream and closes its connection', async () => {
  const server = await mockServer([{ events: [], holdOpen: true }])
  const ctx = await harness(server.url)
  const controller = new AbortController()
  const result = assemble(ctx, { ...route, messages: [prompt], signal: controller.signal })
  await server.requestReceived
  controller.abort()
  await expect(result).resolves.toMatchObject({ finish: { kind: 'aborted', failure: { code: 'ABORTED' } } })
  await server.responseClosed
  expect(server.closedResponses).toBe(1)
})

it('releases only its own cached Codex sessions when the plugin unloads', async () => {
  const close = vi.mocked(codexTransport.closeOpenAICodexWebSocketSessions)
  close.mockClear()
  const server = await mockServer(Array.from({ length: 3 }, () => ({ events: frames(false) })))
  const ctx = await harness(server.url)
  for (const sessionId of ['owned-one', 'owned-two', '']) {
    await assemble(ctx, { ...route, sessionId: sessionId as NonNullable<GenerateOptions['sessionId']>, messages: [prompt] })
  }
  expect(close).not.toHaveBeenCalled()
  await ctx.fiber.dispose()
  expect(close.mock.calls).toEqual([['owned-one'], ['owned-two']])
})

it('aborts a pending Codex stream when its plugin unloads', async () => {
  const server = await mockServer([{ events: [], holdOpen: true }])
  const ctx = await harness(server.url)
  const result = assemble(ctx, { ...route, sessionId: 'pending' as NonNullable<GenerateOptions['sessionId']>, messages: [prompt] })
  await server.requestReceived
  await ctx.fiber.dispose()
  await expect(result).resolves.toMatchObject({ finish: { kind: 'aborted', failure: { code: 'ABORTED' } } })
  await server.responseClosed
  expect(server.closedResponses).toBe(1)
})
