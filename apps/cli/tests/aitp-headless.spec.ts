/** A fresh AITP headless process must reuse its own stored OAuth grant outside the checkout. */
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'
import yaml from 'js-yaml'
import { Context } from '@deepseek-ai/cordis'
import LocalCredentialProvider from '@deepseek-ai/dsh-credentials-local'
import { recordKeyFor } from '../../../packages/llm/llm-pi-ai/src/auth.ts'
import { closeMockServers, mockServer } from '../../../packages/llm/llm-pi-ai/tests/mock-server.ts'

it('uses the persisted grant from a scratch working directory through the AITP launcher', async () => {
  const root = resolve(import.meta.dirname, '../../..')
  const home = await mkdtemp(join(tmpdir(), 'aitp-headless-oauth-'))
  const ctx = new Context()
  try {
    await ctx.plugin(LocalCredentialProvider, { path: join(home, '.credentials.yaml'), watch: false })
    const access = `fixture.${Buffer.from(JSON.stringify({
      'https://api.openai.com/auth': { chatgpt_account_id: 'fixture-account' },
    })).toString('base64url')}.fixture`
    await ctx.credentials.modifyRecord(recordKeyFor('openai-codex'), () => Promise.resolve({
      kind: 'grant', payload: { type: 'oauth', access, refresh: 'fixture-refresh',
        accountId: 'fixture-account', expires: Date.now() + 3600_000 },
    }))
    await ctx.fiber.dispose()
    const item = { type: 'message', id: 'msg_fixture', role: 'assistant', status: 'completed',
      content: [{ type: 'output_text', text: 'HEADLESS_OAUTH_OK', annotations: [] }] }
    const server = await mockServer([{ events: [
      JSON.stringify({ type: 'response.created', response: { id: 'resp_fixture' } }),
      JSON.stringify({ type: 'response.output_item.added', output_index: 0, item }),
      JSON.stringify({ type: 'response.output_item.done', output_index: 0, item }),
      JSON.stringify({ type: 'response.completed', response: { id: 'resp_fixture', status: 'completed',
        output: [item], usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } } }),
    ] }])
    const patch = join(home, 'test.patch.yml')
    // Provider objects are replaced by a later layer, so retain AITP's actual transport
    // while redirecting only the external endpoint to the fixture.
    const defaults = yaml.load(await readFile(join(root, 'apps/cli/config/aitp-agent.cordis.patch.yml'), 'utf8')) as {
      id: string
      config?: { providers?: Record<string, { transport?: string }> }
    }[]
    const transport = defaults.find(entry => entry.id === 'llm-pi-ai')?.config?.providers?.['openai-codex']?.transport
    expect(transport).toBe('sse')
    await writeFile(patch, `- id: session-title-llm
  disabled: true
- id: agent-default-model
  config:
    provider: openai-codex
    model: gpt-6.1-sol
- id: llm-pi-ai
  config:
    providers:
      openai-codex:
        baseURL: ${server.url}
        transport: ${transport}
`)
    const child = spawn(process.execPath, ['--import', import.meta.resolve('tsx/esm'),
      join(root, 'scripts/aitp-agent.ts'), 'headless', '--patch', patch, 'Reply HEADLESS_OAUTH_OK.'], {
      cwd: home, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DSH_HOME: home, OPENAI_API_KEY: '', DEEPSEEK_API_KEY: '',
        TSX_TSCONFIG_PATH: join(root, 'tsconfig.json') },
    })
    let output = ''
    let diagnostic = ''
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { diagnostic += chunk.toString() })
    const exited = new Promise<number | null>((resolveExit, reject) => {
      child.once('error', reject)
      child.once('exit', (code) => { resolveExit(code) })
    })
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM') }, 30_000)
    try {
      expect(await exited, diagnostic).toBe(0)
      expect(timedOut, 'headless must exit naturally before the watchdog').toBe(false)
      expect(output).toContain('HEADLESS_OAUTH_OK')
      expect(server.requests).toHaveLength(1)
      expect(server.headers[0]?.['chatgpt-account-id']).toBe('fixture-account')
      expect(output + diagnostic).not.toContain(access)
    } finally {
      clearTimeout(timer)
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
      await exited
    }
  } finally {
    await ctx.fiber.dispose()
    await closeMockServers()
    await rm(home, { recursive: true, force: true })
  }
}, 45_000)
