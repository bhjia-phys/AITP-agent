/** Keyless Loader coverage of redundant permission arguments in real children. */
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LOADER_SMOKE_TEST_TIMEOUT_MS, runLoaderSmoke } from '@deepseek-ai/dsh-loader-smoke'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-user-approval'

const fixtureDir = new URL('./fixtures/subagent-permissions/', import.meta.url)
const driver = fileURLToPath(new URL('driver.ts', fixtureDir))

async function logsIn(root: string): Promise<SessionEvent[][]> {
  const entries = await readdir(root, { withFileTypes: true })
  return (await Promise.all(entries.map(async (entry): Promise<SessionEvent[][]> => {
    const path = join(root, entry.name)
    if (entry.isDirectory()) return logsIn(path)
    if (!entry.name.endsWith('.jsonl')) return []
    return [(await readFile(path, 'utf8')).trimEnd().split('\n').slice(1).map(line => JSON.parse(line) as SessionEvent)]
  }))).flat()
}

describe('built-in subagent workspace permission composition', () => {
  it('spawn and fork write with redundant standing-mode arguments but cannot widen access', async () => {
    const result = await runLoaderSmoke({
      label: 'subagent same-mode permissions', tempDirPrefix: 'dsh-subagent-permission-',
      binScript: driver, libBinScript: driver,
      configPath: fileURLToPath(new URL('permissions.patch.yml', fixtureDir)),
      tsconfigPath: fileURLToPath(new URL('../../../tsconfig.json', import.meta.url)),
      sourceImport: 'tsx/esm',
      env: { DSH_TELEMETRY_DISABLED: '1' },
      inspect: async (cwd) => {
        const logs = await logsIn(join(cwd, '.sessions'))
        expect(logs).toHaveLength(3)
        for (const label of ['spawn', 'fork']) {
          expect(await readFile(join(cwd, `${label}.md`), 'utf8')).toBe('edited\n')
          await expect(readFile(join(cwd, `${label}-widen.md`))).rejects.toMatchObject({ code: 'ENOENT' })
          await expect(readFile(join(cwd, `${label}-unpaired.md`))).rejects.toMatchObject({ code: 'ENOENT' })
          const events = logs.find(log => log.some(event => event.type === 'tool/call' && event.data.callId === `${label}-write`))
          expect(events).toBeDefined()
          if (events === undefined) throw new Error(`Missing ${label} child session`)
          expect(events.filter(event => event.type === 'approval/policy').at(-1)?.data)
            .toMatchObject({ policy: 'never', source: 'delegation' })
          const results = events.filter(event => event.type === 'tool/result')
          expect(results).toHaveLength(4)
          expect(results.map(event => event.data.message.isError ?? false)).toEqual([false, false, true, true])
          expect(JSON.stringify(results[2]?.data)).toMatch(/never|denied/i)
          expect(JSON.stringify(results[3]?.data)).toMatch(/justification/)
          const hasParentTurn = events.some(event => event.type === 'user/message'
            && event.data.content.some(block => block.type === 'text' && block.text === 'Retain the completed parent turn marker.'))
          expect(hasParentTurn).toBe(label === 'fork')
        }
      },
    })
    expect(result.stderr).not.toContain('UNHANDLED')
  }, LOADER_SMOKE_TEST_TIMEOUT_MS)
})
