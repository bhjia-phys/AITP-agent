/** Run both built-in delegation tools through the shipped headless profile. */
import { resolveConfigPath } from '@deepseek-ai/dsh-app-boot'
import { runFixtureTurn } from '@deepseek-ai/dsh-loader-smoke'
import type {} from '@deepseek-ai/dsh-subagent'
import { bootProductionProfile } from '../../../../../packages/test-support/loader-smoke/tests/fixtures/production-profile.ts'

const configPath = process.argv[2]
if (configPath === undefined) throw new Error('Subagent permission fixture requires a patch path')

const ctx = await bootProductionProfile({
  binName: 'subagent-permissions-fixture',
  profile: 'headless',
  overlayPaths: [resolveConfigPath(configPath, undefined)],
})
try {
  // A completed first turn distinguishes a real fork from a fresh spawn.
  await runFixtureTurn(ctx, { task: 'Retain the completed parent turn marker.' })
  const result = await runFixtureTurn(ctx, { task: 'Delegate the permission probes.' })
  const parent = ctx.agents.roots().find(agent => agent.id === result.sessionId)
  if (parent === undefined) throw new Error('Permission fixture parent is unavailable')
  do {
    await parent.whenIdle()
  } while (await ctx.subagents.waitForChildren(parent))
  await ctx.sessions.flush(parent.session)
} finally {
  await ctx.fiber.dispose()
}
