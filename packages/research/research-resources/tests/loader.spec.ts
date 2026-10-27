/** Production source-service composition and provider lifecycle, independent of an Agent or LLM. */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { LOADER_SMOKE_TEST_TIMEOUT_MS, runLoaderSmoke } from '@deepseek-ai/dsh-loader-smoke'
import type { ResourcePage, ResourceReading, ResourceResult, SourceSet, SourceSetReceipt } from '../src/types.ts'

it('boots the actual read service and withdraws and reloads a domain through Loader fibers', async () => {
  const driver = fileURLToPath(new URL('./fixtures/loader/driver.ts', import.meta.url))
  await runLoaderSmoke({ label: 'local research resources through Loader', tempDirPrefix: 'local-resources-loader-',
    binScript: driver, libBinScript: driver,
    configPath: fileURLToPath(new URL('./fixtures/loader/resources.cordis.yml', import.meta.url)),
    tsconfigPath: fileURLToPath(new URL('../../../../tsconfig.json', import.meta.url)),
    inspect: async (cwd) => {
      const result = JSON.parse(await readFile(join(cwd, 'observations.json'), 'utf8')) as {
        before: ResourcePage
        reading: ResourceReading
        afterDispose: ResourceResult<ResourcePage>
        afterReload: ResourcePage
        persisted: SourceSet
        saved: SourceSetReceipt
        repeatedReceipt: SourceSetReceipt
        readingAfterServiceReload: ResourceReading
        sourcePreserved: boolean
        withoutModelServices: boolean
      }
      expect(result.before.items).toHaveLength(1)
      expect(result.reading.body.kind).toBe('text')
      if (result.reading.body.kind !== 'text') throw new Error('The Loader returned no actual source text.')
      expect(result.reading.body.text).toContain('only at finite N')
      expect(result.before.items[0]?.metadata).toEqual({ support: 'source', review: 'awaiting researcher review' })
      expect(result.afterDispose).toMatchObject({ ok: false, error: { code: 'unavailable' } })
      expect(result.afterReload.items.map(item => item.id)).toEqual(result.before.items.map(item => item.id))
      expect(result.persisted.selections).toEqual([{ ref: result.before.items[0]?.ref }])
      expect(result.repeatedReceipt).toEqual(result.saved)
      expect(result.readingAfterServiceReload.body).toEqual(result.reading.body)
      expect(result.sourcePreserved).toBe(true)
      expect(result.withoutModelServices).toBe(true)
    },
  })
}, LOADER_SMOKE_TEST_TIMEOUT_MS)
