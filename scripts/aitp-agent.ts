/** Fork launcher: named dsh profiles, portable AITP Skills, and an isolated default home. */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { constants, homedir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * Select AITP defaults without mutating the supplied environment.
 * @param root - Repository root containing the pinned protocol submodule.
 * @param environment - Explicit launch overrides.
 * @param home - User home used for the default application directory.
 * @returns environment for both artifact builds and application launch.
 */
export function aitpEnvironment(root: string, environment: NodeJS.ProcessEnv, home = homedir()): NodeJS.ProcessEnv {
  return {
    ...environment,
    DSH_HOME: environment.DSH_HOME ?? join(home, '.aitp-agent'),
    DSH_CLIENT_TITLE: environment.DSH_CLIENT_TITLE ?? 'aitp-agent',
    DSH_BUNDLED_SKILL_DIR: environment.DSH_BUNDLED_SKILL_DIR ?? join(root, 'aitp/plugins/aitp/skills'),
  }
}

/**
 * Compose the supported dsh launcher arguments; auth never submits a model task.
 * @param root - Repository root used to resolve overlays independently of cwd.
 * @param args - User arguments after the aitp-agent script name.
 * @returns arguments for apps/cli/src/bin.ts.
 */
export function aitpArguments(root: string, args: readonly string[]): string[] {
  if (args[0] === 'plugin') return [...args]
  const identity = ['--patch', join(root, 'apps/cli/config/aitp-agent.cordis.patch.yml')]
  if (args[0] === 'auth') {
    return ['--profile', 'headless', ...identity, '--patch', join(root, 'apps/cli/config/aitp-auth.cordis.patch.yml'), ...args.slice(1)]
  }
  const selected = args.indexOf('--profile')
  const inline = args.find(arg => arg.startsWith('--profile='))
  const first = args[0]
  const named = first !== undefined && !first.startsWith('-')
  const profile = selected !== -1 ? args[selected + 1] : inline?.slice('--profile='.length) ?? (named ? first : 'web')
  const overlays = profile === 'web'
    ? [...identity, '--patch', join(root, 'apps/cli/config/aitp-web.cordis.patch.yml')]
    : identity
  if (selected !== -1 || inline !== undefined) return [...overlays, ...args]
  if (named) return ['--profile', first, ...overlays, ...args.slice(1)]
  return ['--profile', 'web', ...overlays, ...args]
}

if (import.meta.main) {
  const root = resolve(import.meta.dirname, '..')
  const args = process.argv.slice(2)
  const environment = aitpEnvironment(root, process.env)
  const build = args[0] === 'build'
  const skillDirectory = environment.DSH_BUNDLED_SKILL_DIR
  if (!build && (skillDirectory === undefined || !existsSync(skillDirectory))) {
    throw new Error('aitp-agent: the AITP Skills directory is missing. Run git submodule update --init aitp, or set DSH_BUNDLED_SKILL_DIR to an existing Skills directory.')
  }
  const entry = build ? 'scripts/build.ts' : 'apps/cli/src/bin.ts'
  const child = spawn(process.execPath, ['--import', 'tsx/esm', join(root, entry),
    ...(build ? args.slice(1) : aitpArguments(root, args))], {
    // The wrapper owns delivery: a terminal group signal must not reach dsh twice.
    detached: process.platform !== 'win32', stdio: 'inherit', env: environment,
  })
  const forward = (signal: 'SIGINT' | 'SIGTERM'): void => {
    if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return
    if (process.platform === 'win32') {
      child.kill(signal)
      return
    }
    try { process.kill(-child.pid, signal) }
    catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) throw error
    }
  }
  const interrupt = (): void => { forward('SIGINT') }
  const terminate = (): void => { forward('SIGTERM') }
  const release = (): void => {
    process.off('SIGINT', interrupt)
    process.off('SIGTERM', terminate)
  }
  process.on('SIGINT', interrupt)
  process.on('SIGTERM', terminate)
  child.once('error', (error) => {
    release()
    console.error(`aitp-agent: ${error.message}`)
    process.exitCode = 1
  })
  child.once('exit', (code, signal) => {
    release()
    process.exitCode = code ?? (signal === null ? 1 : 128 + constants.signals[signal])
  })
}
