/** Saved preferences pass through native Settings, the profile and a fresh Loader. */
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'
import { runLoaderSmoke, LOADER_SMOKE_TEST_TIMEOUT_MS } from '@deepseek-ai/dsh-loader-smoke'

it('saves only future capabilities, preserves history, and keeps settings available in Skills', async () => {
  const driver = resolve(import.meta.dirname, 'fixtures/aitp-settings-driver.ts')
  await runLoaderSmoke({ label: 'AITP saved research preferences', tempDirPrefix: 'aitp-settings-loader-',
    binScript: driver, libBinScript: driver,
    configPath: resolve(import.meta.dirname, 'fixtures/aitp-composition.cordis.yml'),
    tsconfigPath: resolve(import.meta.dirname, '../tsconfig.json'),
    inspect: async (cwd) => {
      const result = JSON.parse(await readFile(join(cwd, 'settings-observations.json'), 'utf8')) as {
        observations: Array<{
          label: string
          memory: boolean
          automaticResearch?: boolean
          settingActive: boolean
          bootstrap: { kind: string; name: string; value: { automaticResearch: boolean | null } }
          settings: { suite: string }
          libraries: Array<{ id: string; enabled: boolean; fiber: boolean }>
          sourcesPreserved: boolean
          historyPreserved: boolean
        }>
        sourceConfigurationPreserved: boolean
        settingsRows: number
      }
      expect(result.sourceConfigurationPreserved).toBe(true)
      expect(result.settingsRows).toBe(1)
      expect(result.observations.map(row => row.label)).toEqual(['initial-full', 'saved-browse-still-full',
        'restarted-browse', 'saved-skills-still-browse', 'restarted-skills', 'saved-full-still-skills',
        'explicit-browse-overrides-full', 'restarted-saved-full'])
      for (const row of result.observations) {
        expect(row.settingActive, row.label).toBe(true)
        expect(row.sourcesPreserved, row.label).toBe(true)
        expect(row.historyPreserved, row.label).toBe(true)
      }
      expect(result.observations.map(row => row.automaticResearch ?? null)).toEqual([true, true, false, false, null, null, false, true])
      expect(result.observations.map(row => row.bootstrap.value.automaticResearch))
        .toEqual([true, true, false, false, null, null, false, true])
      expect(result.observations.map(row => row.settings.suite)).toEqual(['full', 'browse', 'browse', 'skills', 'skills', 'full', 'full', 'full'])
      expect(result.observations.map(row => row.libraries.filter(item => item.enabled && item.fiber).map(item => item.id)))
        .toEqual([
          ['research-literature', 'research-knowledge', 'research-code'],
          ['research-literature', 'research-knowledge', 'research-code'],
          ['research-knowledge'], ['research-knowledge'], [], [], ['research-code'],
          ['research-literature', 'research-knowledge', 'research-code'],
        ])
    },
  })
}, LOADER_SMOKE_TEST_TIMEOUT_MS)
