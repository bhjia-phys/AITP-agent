/** Launcher composition preserves explicit overrides and keeps authentication separate from model turns. */
import { describe, expect, it, onTestFinished } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { aitpArguments, aitpCompositionArguments, aitpEnvironment, prepareAitpStartup } from './aitp-agent.ts'
import { composeEntries, loadOptionalPatches, loadOverlayPatches, loadProfile } from '@deepseek-ai/dsh-app-boot'
import { parseDshArgs } from '../apps/cli/src/args.ts'
import { Context } from '@deepseek-ai/cordis'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import * as SkillFileSystem from '@deepseek-ai/dsh-skill-filesystem'
import { execa } from 'execa'

describe('aitp-agent launcher', () => {
  const root = '/checkout with spaces'
  const identity = join(root, 'apps/cli/config/aitp-agent.cordis.patch.yml')

  it('uses separate defaults and preserves explicitly supplied locations', () => {
    expect(aitpEnvironment(root, {}, '/user')).toMatchObject({
      DSH_HOME: join('/user', '.aitp-agent'), DSH_CLIENT_TITLE: 'aitp-agent',
      DSH_BUNDLED_SKILL_DIR: join(root, 'aitp/plugins/aitp/skills'),
    })
    const override = { DSH_HOME: '/isolated trial', DSH_CLIENT_TITLE: 'Trial', DSH_BUNDLED_SKILL_DIR: '/skills' }
    expect(aitpEnvironment(root, override)).toEqual({ ...override, TSX_TSCONFIG_PATH: join(root, 'tsconfig.json') })
  })

  it('defaults to web and forwards app options through the public parser', () => {
    expect(parseDshArgs(aitpArguments(root, ['--no-open']), 'test')).toMatchObject({
      mode: 'profile', profile: 'web',
      patches: [identity, join(root, 'apps/cli/config/aitp-web.cordis.patch.yml')], args: ['--no-open'],
    })
  })

  it.each([['headless', 'a literal $(task)'], ['--profile', 'headless', 'a literal $(task)']])('preserves explicit profile selection: %j', (...args) => {
    expect(parseDshArgs(aitpArguments(root, args), 'test')).toMatchObject({
      mode: 'profile', profile: 'headless', patches: [identity], args: ['a literal $(task)'],
    })
  })

  it('routes auth to its no-model overlay and leaves plugin management unchanged', () => {
    expect(parseDshArgs(aitpArguments(root, ['auth', 'login', 'openai-codex']), 'test')).toMatchObject({
      mode: 'profile', profile: 'headless',
      patches: [identity, join(root, 'apps/cli/config/aitp-auth.cordis.patch.yml')],
      args: ['login', 'openai-codex'],
    })
    const command = ['plugin', '--profile', 'web', 'list']
    expect(aitpArguments(root, command)).toEqual(command)
  })

  it('resolves its source configuration independently of the research working directory', () => {
    expect(aitpEnvironment('/app', {}, '/user').TSX_TSCONFIG_PATH).toBe('/app/tsconfig.json')
    expect(aitpEnvironment('/app', { TSX_TSCONFIG_PATH: '/custom/tsconfig.json' }, '/user').TSX_TSCONFIG_PATH)
      .toBe('/custom/tsconfig.json')
  })

  it('keeps wrapper options out of native app arguments and preserves literal suffixes', () => {
    expect(aitpCompositionArguments(['--research-suite=browse', '--research-libraries', 'code,knowledge,code', '--no-open']))
      .toEqual({ suite: 'browse', libraries: ['code', 'knowledge'], args: ['--no-open'] })
    expect(aitpCompositionArguments(['--', '--research-suite', 'literal $(task)']))
      .toEqual({ args: ['--', '--research-suite', 'literal $(task)'] })
    expect(aitpCompositionArguments(['--research-libraries=none'])).toEqual({ args: [], libraries: [] })
    for (const args of [
      ['--research-suite'], ['--research-suite=other'], ['--research-suite', 'browse', '--research-suite', 'full'],
      ['--research-libraries', 'code,other'], ['--research-libraries=none,code'],
    ]) expect(() => aitpCompositionArguments(args)).toThrow('aitp-agent:')
    expect(() => aitpArguments(root, ['headless', '--research-suite', 'browse'])).toThrow('require the web profile')
    expect(() => aitpArguments(root, ['--research-suite=skills', '--research-libraries=none'])).toThrow('requires the browse or full')
  })

  it.each(['browse', 'full', 'skills'] as const)('applies explicit %s after user overlays without changing their files', async (suite) => {
    const checkout = resolve(import.meta.dirname, '..')
    const home = mkdtempSync(join(tmpdir(), 'aitp-composition-unit-'))
    onTestFinished(() => { rmSync(home, { recursive: true, force: true }) })
    const userPatch = join(home, 'cordis.patch.yml')
    const contents = '- id: research-memory\n  config:\n    roots: [{ id: mine, path: /research, writable: false }]\n    watchMode: bounded\n    maxContextCharacters: 12345\n    automaticResearch: true\n'
    writeFileSync(userPatch, contents)
    const custom = join(home, 'override.yml')
    writeFileSync(custom, '- id: research-code\n  disabled: false\n- id: research-memory\n  disabled: false\n')
    const args = [`--research-suite=${suite}`, ...(suite === 'skills' ? [] : ['--research-libraries=knowledge']), '--patch', custom, '--no-open']
    const startup = await prepareAitpStartup(checkout, args, home)
    onTestFinished(startup.release)
    const invocation = parseDshArgs(startup.args, 'test')
    if (invocation.mode !== 'profile') throw new Error('Expected a profile launch')
    expect(invocation.args).toEqual(['--no-open'])
    expect(startup.description).toContain('require relaunch')
    const profile = loadProfile('test', 'web', join(checkout, 'apps/cli/package.json'), home, { readOnly: true })
    const entries = composeEntries([
      ...profile.layers.map(layer => layer.patches), profile.patches,
      loadOptionalPatches('test', userPatch) ?? [],
      ...invocation.patches.map(path => loadOverlayPatches('test', path)),
    ])
    const memory = entries.find(row => row.id === 'research-memory')
    expect(memory?.disabled).toBe(suite === 'skills')
    expect(memory?.config).toMatchObject({ roots: [{ id: 'mine', path: '/research', writable: false }], watchMode: 'bounded', maxContextCharacters: 12345,
      automaticResearch: suite !== 'browse' })
    expect(entries.find(row => row.id === 'research-code')?.disabled).toBe(true)
    expect(entries.find(row => row.id === 'research-literature')?.disabled).toBe(true)
    expect(entries.find(row => row.id === 'research-knowledge')?.disabled).toBe(suite === 'skills')
    expect(readFileSync(userPatch, 'utf8')).toBe(contents)
    expect(existsSync(join(home, 'profiles'))).toBe(false)
    const generated = invocation.patches.at(-1)!
    startup.release()
    if (suite !== 'skills') expect(existsSync(generated)).toBe(false)
    expect(existsSync(custom)).toBe(true)
  })

  it('retains a whole-config expression for native activation and leaves absent home absent', async () => {
    const checkout = resolve(import.meta.dirname, '..')
    const scratch = mkdtempSync(join(tmpdir(), 'aitp-expression-unit-'))
    onTestFinished(() => { rmSync(scratch, { recursive: true, force: true }) })
    const custom = join(scratch, 'expression.yml')
    writeFileSync(custom, '- id: research-memory\n  config: !!js "({ roots: [], watchMode: \'bounded\', automaticResearch: true })"\n')
    const home = join(scratch, 'absent-home')
    const startup = await prepareAitpStartup(checkout, ['--research-suite=browse', '--patch', custom], home)
    onTestFinished(startup.release)
    const invocation = parseDshArgs(startup.args, 'test')
    if (invocation.mode !== 'profile') throw new Error('Expected a profile launch')
    const generated = readFileSync(invocation.patches.at(-1)!, 'utf8')
    expect(generated).toContain('!!js')
    expect(generated).toContain('automaticResearch: false')
    expect(generated).toContain("watchMode: 'bounded'")
    expect(existsSync(home)).toBe(false)
  })

  it('launches an explicit browse composition from outside the checkout', async () => {
    const checkout = resolve(import.meta.dirname, '..')
    const home = mkdtempSync(join(tmpdir(), 'aitp-launcher-cwd-'))
    onTestFinished(() => { rmSync(home, { recursive: true, force: true }) })
    const result = await execa(process.execPath, ['--import', import.meta.resolve('tsx/esm'),
      join(checkout, 'scripts/aitp-agent.ts'), '--research-suite=browse', '--research-libraries=knowledge', '--dump-config'], {
      cwd: home, env: { ...process.env, DSH_HOME: home, TSX_TSCONFIG_PATH: undefined },
      timeout: 20_000, killSignal: 'SIGKILL', reject: false,
    })
    expect(result.exitCode, result.stderr).toBe(0)
    expect(result.stderr).toContain('research suite=browse; libraries=knowledge')
    expect(result.stdout).toContain('automaticResearch: false')
  }, 25_000)

  it('discovers the seven portable AITP Skills through the public filesystem provider', async () => {
    const context = new Context()
    try {
      await context.plugin(SkillRegistry).await()
      await context.plugin(SkillFileSystem, {
        includeDefaultRoots: false,
        bundledSkillDir: join(import.meta.dirname, '../aitp/plugins/aitp/skills'),
        watch: false,
      }).await()
      const names = (await context.skills.list()).map(skill => skill.name).sort()
      expect(names).toEqual([
        'aitp-distill', 'aitp-human-brainstorming', 'aitp-human-learning',
        'aitp-memory', 'aitp-research', 'aitp-verify', 'aitp-writing',
      ])
      expect((await context.skills.get('aitp-memory'))?.content).toContain('research.md')
    } finally {
      await context.fiber.dispose()
    }
  })
})
