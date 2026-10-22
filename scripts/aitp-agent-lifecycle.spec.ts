/** The actual auth profile must finish teardown before its launcher exits. */
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')

async function within<T>(pending: Promise<T>, milliseconds: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => { reject(new Error('Timed out waiting for the auth launcher')) }, milliseconds)
      }),
    ])
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
  }
}

function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH') return false
    throw error
  }
}

function killOwned(pid: number | undefined): void {
  if (pid === undefined || !alive(pid)) return
  try { process.kill(-pid, 'SIGKILL') }
  catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) throw error
    process.kill(pid, 'SIGKILL')
  }
}

describe.skipIf(process.platform === 'win32')('aitp-agent Unix signal lifecycle', () => {
  it.each([
    { signal: 'SIGTERM' as const, group: false, code: 0 },
    { signal: 'SIGINT' as const, group: false, code: 130 },
    { signal: 'SIGINT' as const, group: true, code: 130 },
  ])('forwards $signal (group=$group) once and waits for its auth child', async ({ signal, group, code }) => {
    const home = await mkdtemp(join(tmpdir(), 'aitp-launcher-signal-'))
    const pidFile = join(home, 'child.pid')
    const signalFile = join(home, 'child.signals')
    const probe = join(home, 'observe-child.mjs')
    await writeFile(probe, `import { appendFileSync, writeFileSync } from 'node:fs';
if (process.argv[1]?.endsWith('/apps/cli/src/bin.ts')) {
  writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => appendFileSync(${JSON.stringify(signalFile)}, signal + '\\n'));
  }
}
`)
    const child = spawn(process.execPath, ['--import', 'tsx/esm', join(root, 'scripts/aitp-agent.ts'),
      'auth', '--patch', join(root, 'apps/cli/tests/fixtures/aitp-auth-test.cordis.patch.yml'),
      'login', 'aitp-auth-test'], {
      cwd: root, detached: true, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, DSH_HOME: home, DEEPSEEK_API_KEY: '', OPENAI_API_KEY: '',
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${pathToFileURL(probe).href}` },
    })
    const ready = Promise.withResolvers<undefined>()
    const exited = Promise.withResolvers<{ code: number | null; signal: NodeJS.Signals | null }>()
    let output = ''
    let authPid: number | undefined
    child.once('error', (error) => { ready.reject(error); exited.reject(error) })
    child.once('exit', (exitCode, exitSignal) => {
      ready.reject(new Error(`Auth exited before its prompt: ${output}`))
      exited.resolve({ code: exitCode, signal: exitSignal })
    })
    const observe = (chunk: Buffer): void => {
      output += chunk.toString()
      if (output.includes('Scripted secret prompt\n> ')) ready.resolve(undefined)
    }
    child.stdout.on('data', observe)
    child.stderr.on('data', observe)
    try {
      await within(ready.promise, 30_000)
      authPid = Number(await readFile(pidFile, 'utf8'))
      expect(Number.isSafeInteger(authPid) && authPid > 0).toBe(true)
      expect(alive(authPid)).toBe(true)
      process.kill(group ? -child.pid! : child.pid!, signal)
      expect(await within(exited.promise, 10_000), output).toEqual({ code, signal: null })
      expect(alive(authPid), 'The dsh child must be reaped before the wrapper exits').toBe(false)
      expect(await readFile(signalFile, 'utf8')).toBe(`${signal}\n`)
    } finally {
      if (authPid === undefined) {
        try { authPid = Number(await readFile(pidFile, 'utf8')) }
        catch (error) {
          if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
        }
      }
      killOwned(authPid)
      killOwned(child.pid)
      await within(exited.promise, 5_000)
      child.stdin.destroy()
      child.stdout.destroy()
      child.stderr.destroy()
      await rm(home, { recursive: true, force: true })
    }
  }, 45_000)
})
