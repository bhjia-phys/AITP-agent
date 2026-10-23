/** Codex wire failures retain their meaning through the production agent retry policy. */
import { afterEach, expect, it } from 'vitest'
import { WebSocketServer } from 'ws'
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import * as Retry from '@deepseek-ai/dsh-llm-retry'
import { SessionId } from '@deepseek-ai/dsh-session'
import { defineContentToolFixture } from '@deepseek-ai/dsh-tools'
import { PiAiAdapter } from '../src/adapter.ts'
import { resolveProfiles } from '../src/config.ts'
import { memoryAuth } from './auth-double.ts'
import { closeMockServers, mockServer } from './mock-server.ts'

const contexts: Context[] = []
const sockets: WebSocketServer[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  await closeMockServers()
  await Promise.all(sockets.splice(0).map(server => new Promise<void>((resolveClose, reject) => {
    for (const socket of server.clients) socket.terminate()
    server.close((error) => {
      if (error === undefined) resolveClose()
      else reject(error)
    })
  })))
})

function success(): string[] {
  const item = { type: 'message', id: 'msg_done', role: 'assistant', status: 'completed',
    content: [{ type: 'output_text', text: 'recovered', annotations: [] }] }
  return [
    { type: 'response.created', response: { id: 'resp_done' } },
    { type: 'response.output_item.added', output_index: 0, item },
    { type: 'response.output_item.done', output_index: 0, item },
    { type: 'response.completed', response: { id: 'resp_done', status: 'completed', output: [item],
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } },
  ].map(event => JSON.stringify(event))
}

async function harness(url: string, delay = 10, transport: 'sse' | 'websocket' = 'sse') {
  const ctx = new Context()
  contexts.push(ctx)
  await mountAgentLoopTestDependencies(ctx)
  const access = `fixture.${Buffer.from(JSON.stringify({
    'https://api.openai.com/auth': { chatgpt_account_id: 'fixture-account' },
  })).toString('base64url')}.fixture`
  const adapter = new PiAiAdapter({
    profiles: () => resolveProfiles({ 'openai-codex': { baseURL: url, transport,
      streamIdleTimeoutMs: 2000,
      retryPolicy: { mode: 'normal', maxRetries: 2,
        backoff: { initialDelayMs: delay, maxDelayMs: Math.max(delay, 50), jitterRatio: 0 } },
    } }),
    resolveApiKey: () => Promise.resolve(undefined),
    auth: memoryAuth({ 'openai-codex': { type: 'oauth', access, refresh: 'fixture-refresh',
      accountId: 'fixture-account', expires: Date.now() + 3600_000 } }),
  })
  ctx.llm.registerAdapter(['openai-codex'], adapter)
  ctx.effect(() => () => { adapter.dispose() })
  await ctx.plugin(Retry)
  await ctx.plugin(AgentLoop, { agents: [] })
  const agent = await ctx.agentLoop.create(SessionId('codex-wire-retry'), {
    provider: 'openai-codex', model: 'gpt-6.1-sol',
  })
  return { ctx, agent }
}

async function run(agent: Agent): Promise<void> {
  const idle = agent.whenIdle()
  agent.followup(createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Recover.' }] }))
  await idle
}

function retries(agent: Agent) {
  return agent.session.snapshotEvents().filter(event => event.type === 'llm/retry').map(event => event.data)
}

it('retries a status-only overload once and keeps the response body out of the session', async () => {
  const server = await mockServer([
    { status: 503, body: JSON.stringify({ error: { message: 'PRIVATE_BODY: Service temporarily unavailable' } }) },
    { events: success() },
  ])
  const { agent } = await harness(server.url)
  await run(agent)
  expect(server.requests).toHaveLength(2)
  expect(retries(agent)).toMatchObject([{ failure: { code: 'SERVER', status: 503 } }])
  expect(agent.session.deriveMessages().at(-1)).toMatchObject({ content: [{ type: 'text', text: 'recovered' }] })
  expect(JSON.stringify(agent.session.snapshotEvents())).not.toContain('PRIVATE_BODY')
})

async function eventServer(transport: 'sse' | 'websocket', event: object) {
  if (transport === 'sse') return mockServer([{ events: [JSON.stringify(event)] }, { events: success() }])
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  sockets.push(server)
  const requests: string[] = []
  server.on('connection', socket => socket.on('message', (data) => {
    const bytes = Array.isArray(data) ? Buffer.concat(data)
      : Buffer.isBuffer(data) ? data : Buffer.from(data)
    requests.push(bytes.toString())
    for (const frame of requests.length === 1 ? [JSON.stringify(event)] : success()) socket.send(frame)
  }))
  await new Promise<void>((resolveListen, reject) => {
    server.once('listening', resolveListen)
    server.once('error', reject)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('expected an allocated TCP address')
  return { url: `http://127.0.0.1:${address.port}`, requests }
}

for (const transport of ['sse', 'websocket'] as const) {
  it.each([undefined, 'unrecognized_failure'])(`${transport} preserves message-only context overflow with code %s`, async (code) => {
    const server = await eventServer(transport, { type: 'error', code,
      message: 'PRIVATE_EVENT: maximum context length exceeded', param: null, sequence_number: 1 })
    const { agent } = await harness(server.url, 10, transport)
    await run(agent)
    expect(server.requests).toHaveLength(1)
    expect(retries(agent)).toHaveLength(0)
    expect(agent.session.snapshotEvents().at(-1)).toMatchObject({ type: 'turn/end',
      data: { reason: { kind: 'error', error: { code: 'CONTEXT_WINDOW_EXCEEDED' } } } })
    expect(JSON.stringify(agent.session.snapshotEvents())).not.toContain('PRIVATE_EVENT')
  })

  it(`${transport} keeps a recognized structured code ahead of overflow text`, async () => {
    const server = await eventServer(transport, { type: 'error', code: 'invalid_api_key',
      message: 'PRIVATE_EVENT: maximum context length exceeded', param: null, sequence_number: 1 })
    const { agent } = await harness(server.url, 10, transport)
    await run(agent)
    expect(server.requests).toHaveLength(1)
    expect(retries(agent)).toHaveLength(0)
    expect(agent.session.snapshotEvents().at(-1)).toMatchObject({ type: 'turn/end',
      data: { reason: { kind: 'error', error: { code: 'AUTH' } } } })
    expect(JSON.stringify(agent.session.snapshotEvents())).not.toContain('PRIVATE_EVENT')
  })

  it(`${transport} preserves message-only overflow in response.failed`, async () => {
    const server = await eventServer(transport, { type: 'response.failed',
      response: { id: 'failed', status: 'failed',
        error: { message: 'PRIVATE_EVENT: maximum context length exceeded' } } })
    const { agent } = await harness(server.url, 10, transport)
    await run(agent)
    expect(server.requests).toHaveLength(1)
    expect(retries(agent)).toHaveLength(0)
    expect(agent.session.snapshotEvents().at(-1)).toMatchObject({ type: 'turn/end',
      data: { reason: { kind: 'error', error: { code: 'CONTEXT_WINDOW_EXCEEDED' } } } })
    expect(JSON.stringify(agent.session.snapshotEvents())).not.toContain('PRIVATE_EVENT')
  })

  it.each(['server_error', 'rate_limit_exceeded'])(`${transport} retries response.failed code %s`, async (code) => {
    const server = await eventServer(transport, { type: 'response.failed',
      response: { id: 'failed', status: 'failed', error: { code, message: 'PRIVATE_EVENT' } } })
    const { agent } = await harness(server.url, 10, transport)
    await run(agent)
    expect(server.requests).toHaveLength(2)
    expect(retries(agent)).toMatchObject([{ failure: { code: code === 'server_error' ? 'SERVER' : 'RATE_LIMIT' } }])
    expect(agent.session.deriveMessages().at(-1)).toMatchObject({ content: [{ type: 'text', text: 'recovered' }] })
    expect(JSON.stringify(agent.session.snapshotEvents())).not.toContain('PRIVATE_EVENT')
  })

  it.each([
    ['usage_limit_reached', 'QUOTA'], ['invalid_api_key', 'AUTH'],
    ['context_length_exceeded', 'CONTEXT_WINDOW_EXCEEDED'], ['unrecognized_failure', 'PI_AI_ERROR'],
  ] as const)(`${transport} preserves terminal error code %s without retry`, async (code, expected) => {
    const server = await eventServer(transport, { type: 'error', code, message: 'PRIVATE_EVENT with misleading 503 text',
      param: null, sequence_number: 1 })
    const { agent } = await harness(server.url, 10, transport)
    await run(agent)
    expect(server.requests).toHaveLength(1)
    expect(retries(agent)).toHaveLength(0)
    expect(agent.session.snapshotEvents().at(-1)).toMatchObject({ type: 'turn/end',
      data: { reason: { kind: 'error', error: { code: expected } } } })
    expect(JSON.stringify(agent.session.snapshotEvents())).not.toContain('PRIVATE_EVENT')
  })

  it(`${transport} cancellation wins when a recoverable event schedules backoff`, async () => {
    const server = await eventServer(transport, { type: 'error', code: 'server_error', message: 'Unavailable',
      param: null, sequence_number: 1 })
    const { ctx, agent } = await harness(server.url, 1000, transport)
    ctx.on('session/event', (session, event) => {
      if (session === agent.session && event.type === 'llm/retry') agent.cancel({ kind: 'user' })
    })
    await run(agent)
    expect(server.requests).toHaveLength(1)
    expect(agent.session.snapshotEvents().at(-1)).toMatchObject({ type: 'turn/end',
      data: { reason: { kind: 'aborted' } } })
  })
}

it('retains Responses WebSocket nested error status and retry headers', async () => {
  const server = await eventServer('websocket', { type: 'error', status: 429,
    error: { code: 'rate_limit_exceeded', type: 'rate_limit_error', message: 'PRIVATE_EVENT', param: null,
      headers: { 'retry-after': '0.02', authorization: 'PRIVATE_HEADER' } } })
  const { agent } = await harness(server.url, 10, 'websocket')
  await run(agent)
  expect(server.requests).toHaveLength(2)
  expect(retries(agent)).toMatchObject([{ delayMs: 20,
    failure: { code: 'RATE_LIMIT', status: 429, providerRetryAfterMs: 20 } }])
  expect(JSON.stringify(agent.session.snapshotEvents())).not.toMatch(/PRIVATE_(?:EVENT|HEADER)/)
})

it('preserves a transient 429 and its bounded Retry-After for the outer retry policy', async () => {
  const server = await mockServer([
    { status: 429, headers: { 'retry-after': '0.02' },
      body: JSON.stringify({ error: { code: 'rate_limit_exceeded', message: 'Slow down' } }) },
    { events: success() },
  ])
  const { agent } = await harness(server.url)
  await run(agent)
  expect(server.requests).toHaveLength(2)
  expect(retries(agent)).toMatchObject([{ delayMs: 20,
    failure: { code: 'RATE_LIMIT', status: 429, providerRetryAfterMs: 20 } }])
})

it('stops after two outer retries without SDK request multiplication', async () => {
  const server = await mockServer(Array.from({ length: 3 }, () => ({ status: 503, body: 'Unavailable' })))
  const { agent } = await harness(server.url)
  await run(agent)
  expect(server.requests).toHaveLength(3)
  expect(retries(agent)).toHaveLength(2)
  expect(agent.session.snapshotEvents().at(-1)).toMatchObject({ type: 'turn/end',
    data: { reason: { kind: 'error', error: { code: 'SERVER', status: 503 } } } })
})

it.each([
  [401, 'invalid_token', 'AUTH'], [403, 'permission_denied', 'AUTH'],
  [429, 'usage_limit_reached', 'QUOTA'], [429, 'insufficient_quota', 'QUOTA'],
] as const)('does not retry HTTP %i with provider code %s', async (status, providerCode, code) => {
  const server = await mockServer([{ status,
    body: JSON.stringify({ error: { code: providerCode, message: 'No numeric status in this message' } }) }])
  const { agent } = await harness(server.url)
  await run(agent)
  expect(server.requests).toHaveLength(1)
  expect(retries(agent)).toHaveLength(0)
  expect(agent.session.snapshotEvents().at(-1)).toMatchObject({ type: 'turn/end',
    data: { reason: { kind: 'error', error: { code, status } } } })
})

it('cancels during backoff without opening a second request', async () => {
  const server = await mockServer([{ status: 503, body: 'Unavailable' }, { events: success() }])
  const { ctx, agent } = await harness(server.url, 1000)
  ctx.on('session/event', (session, event) => {
    if (session === agent.session && event.type === 'llm/retry') agent.cancel({ kind: 'user' })
  })
  await run(agent)
  expect(server.requests).toHaveLength(1)
  expect(retries(agent)).toHaveLength(1)
  expect(agent.session.snapshotEvents().at(-1)).toMatchObject({ type: 'turn/end',
    data: { reason: { kind: 'aborted' } } })
})

it('retries a truncated tool stream without executing or replaying the failed partial call', async () => {
  const server = await mockServer([{ events: [
    JSON.stringify({ type: 'response.created', response: { id: 'resp_broken' } }),
    JSON.stringify({ type: 'response.output_item.added', output_index: 0,
      item: { type: 'function_call', id: 'fc_broken', call_id: 'call_broken', name: 'lookup', arguments: '' } }),
    JSON.stringify({ type: 'response.function_call_arguments.delta', output_index: 0, delta: '{"value":' }),
  ] }, { events: success() }])
  const { ctx, agent } = await harness(server.url)
  let executions = 0
  ctx.tools.register(defineContentToolFixture({ name: 'lookup', description: 'Fixture lookup', parameters: {},
    async execute() { executions += 1; return [{ type: 'text', text: 'unexpected' }] },
  }))
  await run(agent)
  expect(server.requests).toHaveLength(2)
  expect(retries(agent)).toMatchObject([{ failure: { code: 'TRANSPORT' } }])
  expect(executions).toBe(0)
  expect(agent.session.snapshotEvents().some(event => event.type === 'tool/call')).toBe(false)
  expect(JSON.stringify(server.requests[1])).not.toContain('call_broken')
  expect(agent.session.deriveMessages().at(-1)).toMatchObject({ content: [{ type: 'text', text: 'recovered' }] })
})
