/** Real Codex transport ownership when a title and agent request connect together. */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { WebSocketServer } from 'ws'
import { Context } from '@deepseek-ai/cordis'
import LocalCredentialProvider from '@deepseek-ai/dsh-credentials-local'
import LlmRuntime, { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import * as LlmPiAi from '@deepseek-ai/dsh-llm-pi-ai'
import { recordKeyFor } from '../../../packages/llm/llm-pi-ai/src/auth.ts'
import { assemble } from '../../../packages/llm/llm-pi-ai/tests/assemble.ts'

async function mountCodex(ctx: Context, root: string, baseURL: string): Promise<void> {
  await ctx.plugin(LocalCredentialProvider, { path: join(root, '.credentials.yaml'), watch: false })
  const access = `fixture.${Buffer.from(JSON.stringify({
    'https://api.openai.com/auth': { chatgpt_account_id: 'fixture-account' },
  })).toString('base64url')}.fixture`
  await ctx.credentials.modifyRecord(recordKeyFor('openai-codex'), () => Promise.resolve({
    kind: 'grant', payload: { type: 'oauth', access, refresh: 'fixture-refresh',
      accountId: 'fixture-account', expires: Date.now() + 3600_000 },
  }))
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(LlmPiAi, { providers: { 'openai-codex': {
    baseURL, transport: 'websocket', streamIdleTimeoutMs: 5000,
  } } })
}

it('closes both connections when two requests acquire the same empty session cache concurrently', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aitp-codex-concurrent-'))
  const ctx = new Context()
  const handshakes: (() => void)[] = []
  const sockets = new WebSocketServer({ host: '127.0.0.1', port: 0,
    verifyClient: (_info, accept) => {
      handshakes.push(() => accept(true))
      // Neither connect may finish until both have observed an empty cache.
      if (handshakes.length === 2) for (const complete of handshakes) complete()
    },
  })
  const closed: Promise<void>[] = []
  let requests = 0
  sockets.on('connection', (socket) => {
    closed.push(new Promise<void>(resolveClose => socket.once('close', resolveClose)))
    socket.on('message', () => {
      requests++
      const item = { type: 'message', id: `msg_${requests}`, role: 'assistant', status: 'completed',
        content: [{ type: 'output_text', text: 'complete', annotations: [] }] }
      for (const event of [
        { type: 'response.created', response: { id: `resp_${requests}` } },
        { type: 'response.output_item.added', output_index: 0, item },
        { type: 'response.output_item.done', output_index: 0, item },
        { type: 'response.completed', response: { id: `resp_${requests}`, status: 'completed', output: [item],
          usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } } },
      ]) socket.send(JSON.stringify(event))
    })
  })
  try {
    await new Promise<void>((resolveListen, reject) => {
      sockets.once('listening', resolveListen)
      sockets.once('error', reject)
    })
    const address = sockets.address()
    if (address === null || typeof address === 'string') throw new Error('expected an allocated TCP address')
    await mountCodex(ctx, root, `http://127.0.0.1:${address.port}`)
    const prompt = createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Reply complete.' }] })
    const options = { provider: 'openai-codex', model: 'gpt-6.1-sol', messages: [prompt],
      sessionId: 'shared-session' as NonNullable<GenerateOptions['sessionId']> }
    const results = await Promise.all([
      assemble(ctx, options),
      assemble(ctx, { ...options, purpose: 'session-title' }),
    ])
    expect(results.map(result => result.finish)).toEqual([{ kind: 'stop' }, { kind: 'stop' }])
    expect(requests).toBe(2)
    expect(closed).toHaveLength(2)
    await ctx.fiber.dispose()
    let watchdog: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([Promise.all(closed), new Promise<never>((_resolve, reject) => {
        watchdog = setTimeout(() => reject(new Error(`plugin disposed with ${sockets.clients.size} WebSocket(s) still open`)), 2000)
      })])
    } finally { clearTimeout(watchdog) }
    expect(sockets.clients.size).toBe(0)
  } finally {
    await ctx.fiber.dispose()
    for (const socket of sockets.clients) socket.terminate()
    await new Promise<void>((resolveClose, reject) => sockets.close(error => error ? reject(error) : resolveClose()))
    await rm(root, { recursive: true, force: true })
  }
}, 15_000)

it.each(['sessionless', 'cached-busy'] as const)('does not dispatch after connect-time cancellation (%s)', async (mode) => {
  const root = await mkdtemp(join(tmpdir(), 'aitp-codex-connect-abort-'))
  const ctx = new Context()
  const controller = new AbortController()
  const primaryController = new AbortController()
  const sockets = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  const firstRequest = Promise.withResolvers<undefined>()
  const closed: Promise<void>[] = []
  let requests = 0
  let primary: ReturnType<typeof assemble> | undefined
  let restore = (): void => {}
  sockets.on('connection', (socket) => {
    closed.push(new Promise<void>(resolveClose => socket.once('close', resolveClose)))
    socket.on('message', () => {
      requests++
      firstRequest.resolve(undefined)
    })
  })
  try {
    await new Promise<void>((resolveListen, reject) => {
      sockets.once('listening', resolveListen)
      sockets.once('error', reject)
    })
    const address = sockets.address()
    if (address === null || typeof address === 'string') throw new Error('expected an allocated TCP address')
    await mountCodex(ctx, root, `http://127.0.0.1:${address.port}`)
    const options = {
      provider: 'openai-codex', model: 'gpt-6.1-sol',
      messages: [createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Wait for cancellation.' }] })],
      ...(mode === 'cached-busy' ? { sessionId: 'busy-session' as NonNullable<GenerateOptions['sessionId']> } : {}),
    }
    if (mode === 'cached-busy') {
      primary = assemble(ctx, { ...options, signal: primaryController.signal })
      await firstRequest.promise
    }

    const nativeAdd = globalThis.WebSocket.prototype.addEventListener
    const interception = vi.spyOn(globalThis.WebSocket.prototype, 'addEventListener')
      .mockImplementation(function (this: WebSocket, type, listener, options) {
        if (type !== 'open' || !this.url.startsWith(`ws://127.0.0.1:${address.port}/`)) {
          return nativeAdd.call(this, type, listener, options)
        }
        // Resolve connect first, then abort before its awaiting caller resumes.
        // A one-shot wrapper cannot survive the owned connection's open event.
        nativeAdd.call(this, type, (event: Event) => {
          if (typeof listener === 'function') listener.call(this, event)
          else listener?.handleEvent(event)
          controller.abort()
        }, { once: true })
      })
    restore = () => interception.mockRestore()
    const cancelled = await assemble(ctx, { ...options, signal: controller.signal })
    restore()
    expect(cancelled.finish).toMatchObject({ kind: 'aborted' })
    primaryController.abort()
    if (primary !== undefined) expect((await primary).finish).toMatchObject({ kind: 'aborted' })
    await Promise.all(closed)
    expect(closed).toHaveLength(mode === 'cached-busy' ? 2 : 1)
    expect(requests).toBe(mode === 'cached-busy' ? 1 : 0)
    expect(sockets.clients.size).toBe(0)
  } finally {
    restore()
    controller.abort()
    primaryController.abort()
    await primary
    await ctx.fiber.dispose()
    for (const socket of sockets.clients) socket.terminate()
    await new Promise<void>((resolveClose, reject) => sockets.close(error => error ? reject(error) : resolveClose()))
    await rm(root, { recursive: true, force: true })
  }
}, 15_000)
