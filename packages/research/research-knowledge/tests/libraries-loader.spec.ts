import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { runLoaderSmoke, LOADER_SMOKE_TEST_TIMEOUT_MS } from '@deepseek-ai/dsh-loader-smoke'
import type { ResourceDomain, ResourcePage, ResourceReading } from '@deepseek-ai/dsh-research-resources'

it('boots three actual domain plugins together and unloads each without losing the other libraries', async () => {
  const driver = fileURLToPath(new URL('./fixtures/loader/driver.ts', import.meta.url))
  const configPath = fileURLToPath(new URL('./fixtures/loader/libraries.cordis.yml', import.meta.url))
  const originalConfig = await readFile(configPath)
  await runLoaderSmoke({ label: 'independent local research libraries', tempDirPrefix: 'research-libraries-loader-',
    binScript: driver, libBinScript: driver,
    configPath,
    tsconfigPath: fileURLToPath(new URL('../../../../tsconfig.json', import.meta.url)),
    inspect: async (cwd) => {
      const observation = JSON.parse(await readFile(join(cwd, 'domain-observations.json'), 'utf8')) as {
        before: Record<ResourceDomain, ResourcePage>
        paper: ResourceReading
        diff: ResourceReading
        lifecycle: { domain: ResourceDomain; disconnected: boolean; peersStillReadable: boolean; reloaded: boolean }[]
        noModelServices: boolean
        sourcesPreserved: boolean
      }
      expect(observation.before.knowledge.items.some(item => item.metadata.entryKind === 'atom')).toBe(true)
      expect(observation.before.literature.items[0]?.metadata.edition).toBe('unknown')
      expect(observation.before.code.items.find(item => item.metadata.entryKind === 'checkout')?.metadata.dirtyCount).toBe('1')
      expect(observation.paper.body).toMatchObject({ kind: 'pdf', pages: [{ page: 2, text: 'Page two exact text' }] })
      expect(observation.diff.body.kind).toBe('text')
      if (observation.diff.body.kind === 'text') expect(observation.diff.body.text).toContain('+changed condition')
      expect(observation.lifecycle).toEqual(['knowledge', 'literature', 'code'].map(domain => ({ domain, disconnected: true, peersStillReadable: true, reloaded: true })))
      expect(observation.sourcesPreserved).toBe(true)
      expect(observation.noModelServices).toBe(true)
    },
  })
  expect(await readFile(configPath)).toEqual(originalConfig)
}, LOADER_SMOKE_TEST_TIMEOUT_MS)
