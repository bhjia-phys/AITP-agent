/** Fork launcher: named dsh profiles, portable AITP Skills, and an isolated default home. */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { constants, homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { EntryOptions } from '@deepseek-ai/cordis-plugin-loader'

/** Startup composition; it does not change a stored Session's Research choice. */
export type AitpResearchSuite = 'skills' | 'browse' | 'full'
/** Independently enabled library domains. */
export type AitpResearchLibrary = 'literature' | 'knowledge' | 'code'

interface AitpCompositionArguments {
  readonly args: string[]
  readonly suite?: AitpResearchSuite
  readonly libraries?: readonly AitpResearchLibrary[]
}

/**
 * Remove only the wrapper's explicit research composition options before native parsing.
 * @param args - launcher arguments; values after `--` remain literal app arguments.
 * @returns the chosen startup capabilities and unchanged native arguments.
 * @throws when a composition option is repeated, incomplete or names an unsupported capability.
 */
export function aitpCompositionArguments(args: readonly string[]): AitpCompositionArguments {
  const forwarded: string[] = []
  let suite: AitpResearchSuite | undefined
  let libraries: AitpResearchLibrary[] | undefined
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === undefined) break
    if (arg === '--') { forwarded.push(...args.slice(index)); break }
    const key = arg.split('=', 1)[0]
    if (key !== '--research-suite' && key !== '--research-libraries') { forwarded.push(arg); continue }
    const equals = arg.indexOf('=')
    const value = equals < 0 ? args[++index] : arg.slice(equals + 1)
    if (value === undefined || value === '' || value.startsWith('--')) throw new Error(`aitp-agent: ${key} needs a value.`)
    if (key === '--research-suite') {
      if (suite !== undefined) throw new Error('aitp-agent: select --research-suite only once.')
      if (value !== 'skills' && value !== 'browse' && value !== 'full') {
        throw new Error('aitp-agent: --research-suite must be skills, browse or full.')
      }
      suite = value
    } else {
      if (libraries !== undefined) throw new Error('aitp-agent: select --research-libraries only once.')
      libraries = []
      for (const domain of value === 'none' ? [] : value.split(',')) {
        if (domain !== 'literature' && domain !== 'knowledge' && domain !== 'code') {
          throw new Error('aitp-agent: --research-libraries accepts literature,knowledge,code or none.')
        }
        if (!libraries.includes(domain)) libraries.push(domain)
      }
    }
  }
  return { args: forwarded, ...(suite === undefined ? {} : { suite }), ...(libraries === undefined ? {} : { libraries }) }
}

/**
 * Select AITP defaults without mutating the supplied environment.
 * @param root - Repository root containing the pinned protocol submodule.
 * @param environment - Explicit launch overrides.
 * @param home - User home used for the default application directory.
 * @returns environment for both artifact builds and application launch.
 */
export function aitpEnvironment(root: string, environment: NodeJS.ProcessEnv, home = homedir()): NodeJS.ProcessEnv & {
  DSH_HOME: string
  TSX_TSCONFIG_PATH: string
} {
  return {
    ...environment,
    TSX_TSCONFIG_PATH: environment.TSX_TSCONFIG_PATH ?? join(root, 'tsconfig.json'),
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
  const composition = aitpCompositionArguments(args)
  args = composition.args
  const selected = args.indexOf('--profile')
  const inline = args.find(arg => arg.startsWith('--profile='))
  const first = args[0]
  const named = first !== undefined && !first.startsWith('-')
  const profile = selected !== -1 ? args[selected + 1] : inline?.slice('--profile='.length) ?? (named ? first : 'web')
  if (profile !== 'web' && (composition.suite !== undefined && composition.suite !== 'skills' || composition.libraries !== undefined)) {
    throw new Error('aitp-agent: browse/full research suites and library selection require the web profile.')
  }
  if (composition.suite === 'skills' && composition.libraries !== undefined) {
    throw new Error('aitp-agent: library selection requires the browse or full research suite.')
  }
  const suite = composition.suite ?? 'full'
  const researchPatches = [suite === 'skills' ? 'aitp-skills' : 'aitp-web',
    ...(['literature', 'knowledge', 'code'] as const)
      .filter(domain => composition.libraries !== undefined && !composition.libraries.includes(domain))
      .map(domain => `aitp-without-${domain}`),
  ].flatMap(name => ['--patch', join(root, `apps/cli/config/${name}.cordis.patch.yml`)])
  const overlays = profile === 'web'
    ? [...identity, ...researchPatches]
    : identity
  if (selected !== -1 || inline !== undefined) return [...overlays, ...args]
  if (named) return ['--profile', first, ...overlays, ...args.slice(1)]
  return ['--profile', 'web', ...overlays, ...args]
}

interface AitpStartup {
  readonly args: string[]
  readonly description?: string
  /** Remove only this launcher's temporary override after the child has stopped. */
  readonly release: () => void
}

/** Find an existing plugin row, including native Loader groups. */
function compositionEntry(entries: readonly EntryOptions[], id: string): EntryOptions | undefined {
  for (const entry of entries) {
    if (entry.id === id) return entry
    if (entry.group && Array.isArray(entry.config)) {
      const found = compositionEntry(entry.config, id)
      if (found !== undefined) return found
    }
  }
  return undefined
}

/**
 * Prepare saved or explicit capability selections without rewriting stored configuration.
 * Native profile/patch composition supplies the effective config; only the automatic
 * Research choice is replaced. The generated YAML keeps deferred `!!js` expressions.
 * @param root - repository installation root.
 * @param args - original wrapper arguments, before native parsing.
 * @param home - effective DSH_HOME, supplied explicitly to avoid process-global mutation.
 * @returns native launch arguments and cleanup for its temporary override.
 */
export async function prepareAitpStartup(root: string, args: readonly string[], home: string): Promise<AitpStartup> {
  const forwarded = aitpArguments(root, args)
  const unchanged = { args: forwarded, release: (): void => {} }
  if (args[0] === 'auth' || args[0] === 'plugin') return unchanged
  const selection = aitpCompositionArguments(args)
  // The wrapper must work from a scientific cwd before setting the child's tsconfig path.
  // Load repository-owned entry points only when composing an explicit web selection.
  const [{ composeEntries, loadOptionalPatches, loadOverlayPatches, loadProfile },
    { entryListSchema }, { isJsExpr }, { dump }, { parseDshArgs }, { Preferences, RESEARCH_SETTINGS_ID }] = await Promise.all([
    import('../packages/boot/app-boot/src/index.ts'), import('../vendor/include/src/index.ts'),
    import('../vendor/loader/src/index.ts'), import('js-yaml'), import('../apps/cli/src/args.ts'),
    import('../packages/client/ui-aitp-settings/src/preferences.ts'),
  ])
  const invocation = parseDshArgs(forwarded, 'aitp-agent')
  if (invocation.mode === 'plugin' || invocation.profile !== 'web') return unchanged
  if (invocation.fromDefaultProfile !== undefined) {
    if (selection.suite === undefined && selection.libraries === undefined) return unchanged
    throw new Error('aitp-agent: recreate a profile before selecting a research suite; these are separate launches.')
  }
  const profile = loadProfile('aitp-agent', 'web', join(root, 'apps/cli/package.json'), home, { readOnly: true })
  const inheritedLayers = [...profile.layers.map(layer => layer.patches), profile.patches,
    loadOptionalPatches('aitp-agent', join(home, 'cordis.patch.yml')) ?? []]
  const initial = composeEntries([...inheritedLayers,
    ...invocation.patches.map(path => loadOverlayPatches('aitp-agent', resolve(path)))])
  const saved: unknown = compositionEntry(initial, RESEARCH_SETTINGS_ID)?.config
  if (isJsExpr(saved)) throw new Error('aitp-agent: research startup preferences must use literal suite and library values, as saved by Settings.')
  const preferences = saved === undefined ? undefined : Preferences(saved)
  if (preferences === undefined && selection.suite === undefined && selection.libraries === undefined) return unchanged
  const suite = selection.suite ?? preferences?.suite ?? 'full'
  if (suite === 'skills' && selection.libraries !== undefined) {
    throw new Error('aitp-agent: --research-libraries requires --research-suite=browse or full when the saved suite is skills.')
  }
  const selectedLibraries = selection.libraries ?? (preferences === undefined ? undefined
    : (['literature', 'knowledge', 'code'] as const).filter(domain => preferences[domain]))
  const patchPaths = [...invocation.patches]
  // Explicit capability choices outrank custom overlays, while other fields retain native precedence.
  patchPaths.push(join(root, `apps/cli/config/${suite === 'skills' ? 'aitp-skills' : 'aitp-web'}.cordis.patch.yml`))
  for (const domain of ['literature', 'knowledge', 'code'] as const) {
    if (selectedLibraries !== undefined && !selectedLibraries.includes(domain)) {
      patchPaths.push(join(root, `apps/cli/config/aitp-without-${domain}.cordis.patch.yml`))
    }
  }
  let temporary: string | undefined
  if (suite !== 'skills') {
    const entries = composeEntries([
      ...inheritedLayers,
      ...patchPaths.map(path => loadOverlayPatches('aitp-agent', resolve(path))),
    ])
    const entry = compositionEntry(entries, 'research-memory')
    if (entry === undefined) throw new Error('aitp-agent: the web profile has no research-memory plugin; restore its research bundle before choosing browse/full.')
    const original: unknown = entry.config
    if (original !== undefined && (original === null || typeof original !== 'object' || Array.isArray(original))) {
      throw new Error('aitp-agent: research-memory config must be an object or a native !!js expression.')
    }
    const automaticResearch = suite === 'full'
    const config = isJsExpr(original)
      ? { __jsExpr: `({ ...(${original.__jsExpr}), automaticResearch: ${automaticResearch} })` }
      : { ...original, automaticResearch }
    temporary = mkdtempSync(join(tmpdir(), 'aitp-startup-'))
    try {
      const path = join(temporary, 'research.cordis.patch.yml')
      writeFileSync(path, dump([{ id: 'research-memory', config }], { schema: entryListSchema }))
      patchPaths.push(path)
    } catch (error) {
      rmSync(temporary, { recursive: true, force: true })
      throw error
    }
  }
  const nativeArgs = ['--profile', invocation.profile, ...patchPaths.flatMap(path => ['--patch', path])]
  if (invocation.mode === 'profile') nativeArgs.push('--', ...invocation.args)
  else nativeArgs.push(invocation.mode === 'dump-config-schema' ? '--dump-config-schema' : '--dump-config')
  const libraries = suite === 'skills' ? 'none' : selectedLibraries?.join(',') || (selectedLibraries === undefined ? 'literature,knowledge,code' : 'none')
  const source = selection.suite !== undefined || selection.libraries !== undefined ? 'command-line overrides saved preferences' : 'saved profile preferences'
  const description = `aitp-agent: research suite=${suite}; libraries=${libraries}; ${source}. Capability/configuration changes require relaunch. Existing files and Session history are retained.`
  return { args: nativeArgs, description,
    release: (): void => { if (temporary !== undefined) rmSync(temporary, { recursive: true, force: true }) } }
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
  let startup: AitpStartup = { args: args.slice(1), release: (): void => {} }
  if (!build) {
    // The parent also reads source APIs for explicit suites; use the child's source-resolution contract.
    const { register } = await import('tsx/esm/api')
    const unregister = register({ tsconfig: environment.TSX_TSCONFIG_PATH })
    try { startup = await prepareAitpStartup(root, args, environment.DSH_HOME) }
    finally { await unregister() }
  }
  if (startup.description !== undefined) console.error(startup.description)
  const child = spawn(process.execPath, ['--import', import.meta.resolve('tsx/esm'), join(root, entry),
    ...startup.args], {
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
    startup.release()
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
