/** Actual profile launch, terminal interaction, exits, and persistent local grants. */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import yaml from 'js-yaml'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveExampleLaunch } from '@deepseek-ai/dsh-loader-smoke'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const homes: string[] = []

// Cloudflare's key login only collects two fields and stores them; it performs
// no request. A real terminal makes readline history and redisplay observable.
const SECRET_HISTORY_PTY = String.raw`
import errno, json, os, pty, select, signal, sys, time
node, args_json, env_json, cwd = sys.argv[1:]
env = os.environ.copy()
env.update(json.loads(env_json))
pid, fd = pty.fork()
if pid == 0:
    os.chdir(cwd)
    os.execvpe(node, [node, *json.loads(args_json)], env)
output = bytearray()
stage = 0
status = None
eof = False
deadline = time.monotonic() + 30
try:
    while time.monotonic() < deadline:
        ready, _, _ = select.select([fd], [], [], 0.05)
        if ready:
            try:
                chunk = os.read(fd, 65536)
            except OSError as error:
                if error.errno != errno.EIO:
                    raise
                chunk = b''
            eof = not chunk
            output.extend(chunk)
        if stage == 0 and b'Enter Cloudflare API key' in output:
            os.write(fd, b'fixture-history-secret\r')
            stage = 1
        elif stage == 1 and b'Enter Cloudflare account ID' in output:
            os.write(fd, b'\x1b[Afixture-account\r')
            stage = 2
        if status is None:
            waited, candidate = os.waitpid(pid, os.WNOHANG)
            if waited == pid:
                status = candidate
        if status is not None and (eof or not ready):
            break
    if status is None:
        raise TimeoutError('auth PTY process did not exit')
    sys.stdout.buffer.write(output)
    if stage != 2:
        sys.stderr.write(f'completed {stage}/2 terminal inputs\n')
        sys.exit(124)
    sys.exit(os.waitstatus_to_exitcode(status))
finally:
    if status is None:
        os.killpg(pid, signal.SIGKILL)
        os.waitpid(pid, 0)
    os.close(fd)
`

afterEach(async () => {
  for (const home of homes.splice(0)) await rm(home, { recursive: true, force: true })
})

async function launch(action: 'success' | 'failure' | 'cancel') {
  const home = await mkdtemp(join(tmpdir(), 'aitp-auth-profile-'))
  homes.push(home)
  await writeFile(join(home, 'cordis.patch.yml'), '- id: llm-pi-ai\n  config:\n    providers:\n      openai: {}\n      deepseek:\n        displayName: Retained user route\n      openai-codex:\n        displayName: Retained GPT label\n')
  const resolved = resolveExampleLaunch({
    srcBin: join(root, 'apps/cli/src/bin.ts'),
    tsconfigPath: join(root, 'tsconfig.json'),
    sourceImport: 'tsx/esm',
    configArgs: [
      '--profile', 'headless',
      '--patch', join(root, 'apps/cli/config/aitp-agent.cordis.patch.yml'),
      '--patch', join(root, 'apps/cli/config/aitp-auth.cordis.patch.yml'),
      '--patch', join(root, 'apps/cli/tests/fixtures/aitp-auth-test.cordis.patch.yml'),
      'login', 'aitp-auth-test',
    ],
    env: { DSH_HOME: home, DEEPSEEK_API_KEY: '', OPENAI_API_KEY: '' },
  })
  const child = execa(resolved.command, resolved.args, {
    cwd: root, env: { ...process.env, ...resolved.env },
    stdin: 'pipe', reject: false, timeout: 30_000, killSignal: 'SIGKILL',
  })
  let output = ''
  let answered = false
  child.stdout?.on('data', (chunk) => {
    output += String(chunk)
    if (!answered && output.includes('Scripted secret prompt\n> ')) {
      answered = true
      if (action === 'cancel') child.stdin?.end()
      else child.stdin?.write(`${action === 'success' ? 'fixture-private-key' : 'fail'}\n`)
    }
  })
  const result = await child
  expect(result.timedOut).toBe(false)
  expect(answered).toBe(true)
  const secret = /fixture-private-key|fixture-oauth-access|fixture-oauth-refresh|raw-provider-error-with-fixture-secret/
  expect(result.stdout + result.stderr).not.toMatch(secret)
  return { home, result }
}

describe('AITP auth profile', () => {
  it.skipIf(process.platform === 'win32')('never recalls a secret into a later text prompt in a real PTY', async () => {
    const home = await mkdtemp(join(tmpdir(), 'aitp-auth-history-'))
    homes.push(home)
    const resolved = resolveExampleLaunch({
      srcBin: join(root, 'apps/cli/src/bin.ts'),
      tsconfigPath: join(root, 'tsconfig.json'),
      sourceImport: 'tsx/esm',
      configArgs: ['--profile', 'headless', '--patch', join(root, 'apps/cli/config/aitp-auth.cordis.patch.yml'), 'login', 'cloudflare-workers-ai'],
      env: { DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1' },
    })
    const result = await execa('python3', ['-c', SECRET_HISTORY_PTY, resolved.command, JSON.stringify(resolved.args), JSON.stringify(resolved.env), root], {
      stdin: 'ignore', timeout: 35_000, killSignal: 'SIGKILL', reject: false,
    })
    expect(result.timedOut).toBe(false)
    expect(result.exitCode, result.stderr).toBe(0)
    expect(result.stdout).toContain('Signed in to cloudflare-workers-ai.')
    expect(result.stdout + result.stderr).not.toContain('fixture-history-secret')
    const stored = yaml.load(await readFile(join(home, '.credentials.yaml'), 'utf8'))
    expect(stored).toMatchObject({ records: { 'llm-pi-ai/cloudflare-workers-ai': {
      kind: 'api-key', key: 'fixture-history-secret', env: { CLOUDFLARE_ACCOUNT_ID: 'fixture-account' },
    } } })
  }, 40_000)

  it('completes an interactive exchange and stores the provider-owned credential', async () => {
    const { home, result } = await launch('success')
    expect(result.exitCode, result.stdout).toBe(0)
    expect(result.stdout).toContain('Signed in to aitp-auth-test.')
    expect(result.stdout).toContain('GPT models available; user route and label retained.')
    const stored = yaml.load(await readFile(join(home, '.credentials.yaml'), 'utf8'))
    expect(stored).toMatchObject({ records: { 'llm-pi-ai/aitp-auth-test': { kind: 'grant', payload: { type: 'api_key', key: 'fixture-private-key' } } } })
  }, 40_000)

  it('reports a failed exchange without printing the provider exception or a success', async () => {
    const { result } = await launch('failure')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Provider authorization failed')
    expect(result.stdout).not.toContain('Signed in to')
  }, 40_000)

  it('treats terminal EOF as cancellation and exits with 130', async () => {
    const { result } = await launch('cancel')
    expect(result.exitCode).toBe(130)
    expect(result.stdout).toContain('Sign-in cancelled.')
    expect(result.stdout).not.toContain('Signed in to')
  }, 40_000)
})
