/** Launcher composition preserves explicit overrides and keeps authentication separate from model turns. */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { aitpArguments, aitpEnvironment } from './aitp-agent.ts'
import { parseDshArgs } from '../apps/cli/src/args.ts'
import { Context } from '@deepseek-ai/cordis'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import * as SkillFileSystem from '@deepseek-ai/dsh-skill-filesystem'

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
