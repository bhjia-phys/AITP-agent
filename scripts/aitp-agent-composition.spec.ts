/** Real Loader evidence for startup selections, domain disposal and durable research history. */
import { readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runLoaderSmoke, LOADER_SMOKE_TEST_TIMEOUT_MS } from '@deepseek-ai/dsh-loader-smoke'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import type { ResourceResult, ResourcePage } from '@deepseek-ai/dsh-research-resources'

describe('AITP capability compositions through the production Loader', () => {
  it('switches independent libraries and automation while retaining files, history and browse access', async () => {
    const driver = resolve(import.meta.dirname, 'fixtures/aitp-composition-driver.ts')
    await runLoaderSmoke({ label: 'AITP optional suites', tempDirPrefix: 'aitp-suite-loader-',
      binScript: driver, libBinScript: driver,
      configPath: resolve(import.meta.dirname, 'fixtures/aitp-composition.cordis.yml'),
      tsconfigPath: resolve(import.meta.dirname, '../tsconfig.json'),
      inspect: async (cwd) => {
        const observations = JSON.parse(await readFile(join(cwd, 'composition-observations.json'), 'utf8')) as {
          label: string
          memory: boolean
          resources: boolean
          historyPreserved: boolean
          sourcesPreserved: boolean
          storedConfigPreserved: boolean
          provider?: { capabilities: { automaticResearch: boolean; read: boolean } }
          topic?: { ok: boolean; value: { value: { currentAnswer: { text: string } } } }
          domains: Record<string, ResourceResult<ResourcePage>>
        }[]
        expect(observations.map(item => item.label)).toEqual(['full', 'without-literature', 'without-knowledge', 'without-code', 'without-libraries', 'browse', 'skills', 'restored'])
        for (const item of observations) {
          expect(item.historyPreserved, item.label).toBe(true)
          expect(item.sourcesPreserved, item.label).toBe(true)
          expect(item.storedConfigPreserved, item.label).toBe(true)
          expect(item.memory, item.label).toBe(item.label !== 'skills')
          expect(item.resources, item.label).toBe(item.label !== 'skills')
          if (item.label === 'skills') continue
          expect(item.provider?.capabilities).toMatchObject({ read: true, automaticResearch: item.label !== 'browse' })
          expect(item.topic?.ok, `${item.label}: ${JSON.stringify(item.topic)}`).toBe(true)
          expect(item.topic?.value.value.currentAnswer.text).toContain('FIXTURE_ACCEPTED_FINITE_BOUND')
          for (const domain of ['literature', 'knowledge', 'code']) {
            const result = item.domains[domain]
            const disabled = item.label === `without-${domain}` || item.label === 'without-libraries'
            expect(result?.ok, `${item.label}: ${domain}`).toBe(!disabled)
            if (result?.ok) {
              expect(result.value.items.some(resource => resource.domain === domain), `${item.label}: ${domain}`).toBe(true)
            } else expect(result?.error.code).toBe('unavailable')
          }
        }
        const requests = (await readFile(join(cwd, 'composition-requests.jsonl'), 'utf8')).trim().split('\n')
          .map(line => JSON.parse(line) as GenerateOptions)
        expect(requests).toHaveLength(3)
        const runtimeContext = (request: GenerateOptions): string => JSON.stringify(request.messages.filter(message => message.role === 'user' && message.source?.kind === 'runtime-context'))
        expect(runtimeContext(requests[0]!)).toContain('FIXTURE_ACCEPTED_FINITE_BOUND')
        expect(runtimeContext(requests[1]!)).not.toContain('FIXTURE_ACCEPTED_FINITE_BOUND')
        expect(runtimeContext(requests[2]!)).not.toContain('FIXTURE_ACCEPTED_FINITE_BOUND')
      },
    })
  }, LOADER_SMOKE_TEST_TIMEOUT_MS)
})
