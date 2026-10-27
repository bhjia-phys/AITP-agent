import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { runLoaderSmoke, LOADER_SMOKE_TEST_TIMEOUT_MS } from '@deepseek-ai/dsh-loader-smoke'
import type { StudyArtifact, StudyArtifactReceipt } from '../src/types.ts'
import type { ResourceResult, SourceRoot } from '@deepseek-ai/dsh-research-resources'

it('loads the actual study plugin, restarts saved drafts and withdraws its sources without losing any library', async () => {
  const driver = fileURLToPath(new URL('./fixtures/loader/driver.ts', import.meta.url))
  const configPath = fileURLToPath(new URL('./fixtures/loader/study.cordis.yml', import.meta.url))
  const original = await readFile(configPath)
  await runLoaderSmoke({ label: 'research study artifacts', tempDirPrefix: 'research-study-loader-',
    binScript: driver, libBinScript: driver, configPath,
    tsconfigPath: fileURLToPath(new URL('../../../../tsconfig.json', import.meta.url)),
    inspect: async (cwd) => {
      const observation = JSON.parse(await readFile(join(cwd, 'study-observations.json'), 'utf8')) as {
        lifecycle: { withdrawn: boolean; peersReadable: boolean }
        receipt: StudyArtifactReceipt
        retry: StudyArtifactReceipt
        restored: StudyArtifact
        roots: ResourceResult<readonly SourceRoot[]>
        pluginSourceDirectory: readonly string[]
        noModelServices: boolean
        scientificUnchanged: boolean
      }
      expect(observation.lifecycle).toEqual({ withdrawn: true, peersReadable: true })
      expect(observation.retry).toEqual(observation.receipt)
      expect(observation.restored).toMatchObject({ status: 'provisional', origin: 'handwritten', title: 'Original question' })
      expect(observation.pluginSourceDirectory).toEqual([])
      expect(observation.scientificUnchanged).toBe(true)
      expect(observation.noModelServices).toBe(true)
      if (!observation.roots.ok) throw new Error('The library roots are unavailable after restart.')
      expect(observation.roots.value).toHaveLength(4)
      expect(observation.roots.value.filter(root => root.id === 'research-study:artifacts').map(root => root.displayPath))
        .toEqual([join(cwd, 'host-home/research-study/sources')])
    },
  })
  expect(await readFile(configPath)).toEqual(original)
}, LOADER_SMOKE_TEST_TIMEOUT_MS)
