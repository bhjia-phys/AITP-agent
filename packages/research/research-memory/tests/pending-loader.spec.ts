import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runLoaderSmoke, LOADER_SMOKE_TEST_TIMEOUT_MS } from '@deepseek-ai/dsh-loader-smoke'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import type { ResearchWorkingState } from '../src/working-types.ts'

describe('pending questions through the production Loader services', () => {
  it('delivers and reopens complete unanswered choices after two compactions and cold service restore', async () => {
    const driver = fileURLToPath(new URL('./fixtures/pending/driver.ts', import.meta.url))
    await runLoaderSmoke({
      label: 'research pending questions', tempDirPrefix: 'research-pending-', binScript: driver, libBinScript: driver,
      configPath: fileURLToPath(new URL('./fixtures/pending/pending.cordis.yml', import.meta.url)),
      tsconfigPath: fileURLToPath(new URL('../../../../tsconfig.json', import.meta.url)),
      inspect: async (cwd) => {
        const requests = (await readFile(join(cwd, 'pending-requests.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as GenerateOptions)
        const result = JSON.parse(await readFile(join(cwd, 'pending-result.json'), 'utf8')) as {
          compacted: number
          state: ResearchWorkingState
          questions: unknown
          source: string
        }
        expect(result.compacted).toBe(2)
        expect(result.state.pending).toHaveLength(1)
        expect(result.state.humans.every(input => input.kind !== 'question-answer' && input.kind !== 'user-question-reply')).toBe(true)
        expect(JSON.stringify(result.questions)).toContain('请选择还未确定的边界条件')
        for (const id of ['pending-fresh-before', 'pending-owner', 'pending-reference-reader']) {
          const last = requests.findLast(request => request.sessionId === id && request.purpose === undefined)!
          const current = JSON.stringify(last.messages.findLast(message => message.role === 'user' && message.source?.kind === 'runtime-context'))
          expect(current).toContain('请选择还未确定的边界条件')
          expect(current).toContain('周期边界')
          expect(current).toContain('开边界')
          expect(current).toContain('not a human decision')
        }
        const reopened = requests.findLast(request => request.sessionId === 'pending-reference-reader')!
          .messages.find(message => message.role === 'tool' && message.toolCallId === 'reopen-pending')
        expect(reopened).toBeDefined()
        expect(reopened?.role === 'tool' && reopened.isError).not.toBe(true)
        expect(JSON.stringify(reopened)).toContain('周期边界')
        expect(JSON.stringify(reopened)).toContain('改变边界作用')
        expect(result.source).toBe('# Child\n\nOnly the stated finite-system question is studied.\n')
      },
    })
  }, LOADER_SMOKE_TEST_TIMEOUT_MS)
})
