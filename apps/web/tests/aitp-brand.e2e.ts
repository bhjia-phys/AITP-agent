/** AITP's real source launcher serves its assembled brand and owns web teardown. */
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium, type Browser } from 'playwright'
import { expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../..')

async function within<T>(pending: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { reject(new Error('Timed out waiting for the AITP web launcher')) }, milliseconds)
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
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

it.skipIf(process.platform === 'win32')('serves aitp-agent title and sidebar through its real web profile', async () => {
  const world = await mkdtemp(join(tmpdir(), 'aitp-web-brand-'))
  const pidFile = join(world, 'dsh.pid')
  const probe = join(world, 'observe-child.mjs')
  // Keep .env and settings isolated while the source loader resolves this checkout's dependencies.
  await symlink(join(root, 'node_modules'), join(world, 'node_modules'), 'dir')
  await writeFile(probe, `import { writeFileSync } from 'node:fs';
if (process.argv[1]?.endsWith('/apps/cli/src/bin.ts')) {
  writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
}
`)
  const child = spawn(process.execPath, ['--import', 'tsx/esm', join(root, 'scripts/aitp-agent.ts'),
    'web', '--patch', join(root, 'apps/web/tests/pin-browse-picker.overlay.yml'), '--no-open', '--port', '0'], {
    cwd: world, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, TSX_TSCONFIG_PATH: join(root, 'tsconfig.json'),
      DSH_HOME: join(world, 'home'), DSH_AGENTS_HOME: join(world, 'agents'),
      DSH_TELEMETRY_DISABLED: '1', DEEPSEEK_API_KEY: '', OPENAI_API_KEY: '',
      NODE_OPTIONS: `--import=${pathToFileURL(probe).href}` },
  })
  const ready = Promise.withResolvers<string>()
  const exited = Promise.withResolvers<{ code: number | null; signal: NodeJS.Signals | null }>()
  let output = ''
  let dshPid: number | undefined
  let browser: Browser | undefined
  const logs = (): string => output.replace(/([?&]token=)[A-Za-z0-9_-]+/gu, '$1<redacted>')
  child.once('error', (error) => { ready.reject(error); exited.reject(error) })
  child.once('exit', (code, signal) => {
    ready.reject(new Error(`Web launcher exited before readiness: ${logs()}`))
    exited.resolve({ code, signal })
  })
  const observe = (chunk: Buffer): void => {
    output += chunk.toString()
    const url = /dsh web: (http:\/\/[^\s]+)/u.exec(output)?.[1]
    if (url !== undefined) ready.resolve(url)
  }
  child.stdout.on('data', observe)
  child.stderr.on('data', observe)
  try {
    const url = await within(ready.promise, 45_000)
    dshPid = Number(await readFile(pidFile, 'utf8'))
    expect(Number.isSafeInteger(dshPid) && dshPid > 0).toBe(true)
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' })
    const errors: string[] = []
    page.on('pageerror', (error) => { errors.push(error.message) })
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await expect.poll(() => page.title(), { timeout: 30_000 }).toBe('aitp-agent')
    const notice = page.getByRole('button', { name: 'Continue', exact: true })
    await notice.waitFor({ state: 'visible', timeout: 30_000 })
    await notice.click()
    const brand = page.locator('[data-window-drag]').getByText('aitp-agent', { exact: true })
    await brand.waitFor({ state: 'visible', timeout: 30_000 })
    expect(await brand.count()).toBe(1)
    expect(errors).toEqual([])
    await browser.close()
    browser = undefined
    child.kill('SIGTERM')
    expect(await within(exited.promise, 15_000), logs()).toEqual({ code: 0, signal: null })
    expect(alive(dshPid), 'The web process must exit before its launcher').toBe(false)
    await expect(fetch(new URL('/', url), { signal: AbortSignal.timeout(2_000) })).rejects.toThrow()
  } finally {
    await browser?.close()
    if (dshPid === undefined) {
      try { dshPid = Number(await readFile(pidFile, 'utf8')) }
      catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
      }
    }
    killOwned(dshPid)
    killOwned(child.pid)
    await within(exited.promise, 5_000)
    child.stdout.destroy()
    child.stderr.destroy()
    await rm(world, { recursive: true, force: true })
  }
}, 120_000)
