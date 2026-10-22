/** The terminal consumer uses the existing grant transaction and persistence. */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AuthorizationService from '@deepseek-ai/dsh-authorization'
import type { AuthorizationInteraction, AuthorizationSession } from '@deepseek-ai/dsh-authorization'
import { credentialKey } from '@deepseek-ai/dsh-credentials'
import LocalCredentialProvider from '@deepseek-ai/dsh-credentials-local'
import { credentialStoreFrom } from '../../../packages/llm/llm-pi-ai/src/auth.ts'
import { runAuthCommand } from '../src/aitp-auth.ts'

const resources: { ctx: Context; dir: string }[] = []
const key = credentialKey('llm-pi-ai', 'scripted')

async function setup(run: (session: AuthorizationSession) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'aitp-auth-'))
  const ctx = new Context()
  resources.push({ ctx, dir })
  await ctx.plugin(LocalCredentialProvider, { path: join(dir, '.credentials.yaml'), watch: false })
  await ctx.plugin(AuthorizationService)
  ctx.authorization.registerFlow({ key, label: 'Scripted provider', methods: [{ id: 'oauth', label: 'Sign in' }], run })
  return { ctx, dir }
}

afterEach(async () => {
  for (const { ctx, dir } of resources.splice(0)) {
    await ctx.fiber.dispose()
    await rm(dir, { recursive: true, force: true })
  }
})

describe('AITP provider authorization consumer', () => {
  it('relays notice and prompt, persists the grant, and exposes it through the adapter store', async () => {
    const { ctx, dir } = await setup(async (session) => {
      session.notify({ message: 'Open the browser', url: 'https://login.example/', code: 'ABCD' })
      expect(await session.prompt({ kind: 'text', message: 'Verification code' })).toBe('human-response')
      await session.commit({ kind: 'grant', payload: { type: 'oauth', access: 'fixture-access', refresh: 'fixture-refresh', expires: 999 } })
    })
    const interaction: AuthorizationInteraction = { notify: vi.fn(), prompt: vi.fn(async () => 'human-response') }
    const output = vi.fn()
    await expect(runAuthCommand(ctx, { action: 'login', provider: 'scripted' }, interaction, output, new AbortController().signal)).resolves.toBe(0)
    expect(interaction.notify).toHaveBeenCalledWith({ message: 'Open the browser', url: 'https://login.example/', code: 'ABCD' })
    expect(output).toHaveBeenCalledWith('Signed in to scripted.\n')
    expect(JSON.stringify(output.mock.calls)).not.toMatch(/fixture-access|fixture-refresh|human-response/)
    await ctx.fiber.dispose()
    const restarted = new Context()
    resources.push({ ctx: restarted, dir })
    await restarted.plugin(LocalCredentialProvider, { path: join(dir, '.credentials.yaml'), watch: false })
    await expect(credentialStoreFrom(restarted).read('scripted')).resolves.toMatchObject({ type: 'oauth', access: 'fixture-access' })
  })

  it('reports credential presence without reading or printing the grant', async () => {
    const { ctx } = await setup(async () => {})
    await ctx.credentials.modifyRecord(key, () => Promise.resolve({ kind: 'grant', payload: 'fixture-secret' }))
    const read = vi.spyOn(ctx.credentials, 'readRecord')
    const output = vi.fn()
    await runAuthCommand(ctx, { action: 'list' }, { notify() {}, prompt: async () => '' }, output, new AbortController().signal)
    expect(output).toHaveBeenCalledWith('scripted: oauth; credential stored\n')
    expect(read).not.toHaveBeenCalled()
    expect(JSON.stringify(output.mock.calls)).not.toContain('fixture-secret')
  })

  it('cancels a running sign-in without overwriting an existing credential', async () => {
    const { ctx } = await setup(async (session) => {
      await session.prompt({ kind: 'text', message: 'Wait for the researcher' })
      await session.commit({ kind: 'grant', payload: 'replacement' })
    })
    await ctx.credentials.modifyRecord(key, () => Promise.resolve({ kind: 'grant', payload: 'original' }))
    const controller = new AbortController()
    const prompt = vi.fn(() => new Promise<string>(() => {}))
    const output = vi.fn()
    const result = runAuthCommand(ctx, { action: 'login', provider: 'scripted' }, { notify() {}, prompt }, output, controller.signal)
    await vi.waitFor(() => { expect(prompt).toHaveBeenCalledOnce() })
    controller.abort()
    await expect(result).resolves.toBe(130)
    expect(output).toHaveBeenCalledWith('Sign-in cancelled.\n')
    await expect(ctx.credentials.readRecord(key)).resolves.toEqual({ kind: 'grant', payload: 'original' })
  })

  it('refuses an unavailable method before starting a provider or writing a grant', async () => {
    const run = vi.fn(async () => {})
    const { ctx } = await setup(run)
    const output = vi.fn()
    await expect(runAuthCommand(ctx, { action: 'login', provider: 'scripted', method: 'unavailable' }, { notify() {}, prompt: async () => '' }, output, new AbortController().signal)).rejects.toThrow()
    expect(run).not.toHaveBeenCalled()
    expect(output).not.toHaveBeenCalled()
    await expect(ctx.credentials.describeRecord(key)).resolves.toMatchObject({ configured: false })
  })

  it('does not report success when the provider fails before committing', async () => {
    const { ctx } = await setup(async () => { throw new Error('exchange failed') })
    const output = vi.fn()
    await expect(runAuthCommand(ctx, { action: 'login', provider: 'scripted' }, { notify() {}, prompt: async () => '' }, output, new AbortController().signal)).rejects.toThrow('exchange failed')
    expect(output).not.toHaveBeenCalled()
    await expect(ctx.credentials.describeRecord(key)).resolves.toMatchObject({ configured: false })
  })
})
