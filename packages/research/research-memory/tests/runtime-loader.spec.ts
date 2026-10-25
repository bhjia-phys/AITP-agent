import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runLoaderSmoke, LOADER_SMOKE_TEST_TIMEOUT_MS } from '@deepseek-ai/dsh-loader-smoke'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session'

async function logs(path: string): Promise<string[]> {
  return (await Promise.all((await readdir(path, { withFileTypes: true })).map(async (entry) => {
    const child = join(path, entry.name)
    return entry.isDirectory() ? logs(child) : entry.name.endsWith('.jsonl') ? [child] : []
  }))).flat()
}

describe('research runtime through a minimal production-service Loader composition', () => {
  it('restores original corrections and failed-route conditions after two real compactions and a disk restart', async () => {
    let requests: GenerateOptions[] = []
    let events: SessionEvent[] = []
    const driver = fileURLToPath(new URL('./fixtures/runtime/driver.ts', import.meta.url))
    await runLoaderSmoke({
      label: 'research memory continuity', tempDirPrefix: 'research-runtime-', binScript: driver, libBinScript: driver,
      configPath: fileURLToPath(new URL('./fixtures/runtime/runtime.cordis.yml', import.meta.url)),
      tsconfigPath: fileURLToPath(new URL('../../../../tsconfig.json', import.meta.url)),
      inspect: async (cwd) => {
        requests = (await readFile(join(cwd, 'runtime-requests.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as GenerateOptions)
        const files = await logs(join(cwd, '.sessions'))
        expect(files).toHaveLength(2)
        events = (await Promise.all(files.map(async file => (await readFile(file, 'utf8')).trim().split('\n').slice(1).map(line => JSON.parse(line) as SessionEvent)))).flat()
        const withoutPlugin = JSON.parse(await readFile(join(cwd, 'runtime-disabled.json'), 'utf8')) as {
          researchProjectionAbsent: boolean
          researchToolsAbsent: boolean
          compactionCount: number
          originalQuestions: unknown[]
          successfulToolResults: unknown[]
        }
        expect(withoutPlugin.researchProjectionAbsent).toBe(true)
        expect(withoutPlugin.researchToolsAbsent).toBe(true)
        expect(withoutPlugin.compactionCount).toBe(2)
        expect(JSON.stringify(withoutPlugin.originalQuestions)).toContain('只做解析推导')
        expect(JSON.stringify(withoutPlugin.successfulToolResults)).toContain('Reopen only after the boundary condition changes')
      },
    })
    expect(events.filter(event => event.type === 'compaction/end')).toHaveLength(2)
    const final = JSON.stringify(requests.at(-1))
    expect(final).toContain('只做解析推导')
    expect(final).toContain('Preserve the exact boundary convention')
    expect(final).toContain('Reopen only after the boundary condition changes')
    expect(final).toContain('does not establish a thermodynamic limit')
    expect(final).toContain('resume now')
    expect(final).toContain('fresh owner ask')
    expect(final).toContain('Historical provisional failed-route')
    expect(events.filter(event => event.type === 'user/message' && event.data.source.kind === 'aitp-research')).toHaveLength(2)
  }, LOADER_SMOKE_TEST_TIMEOUT_MS)
})
