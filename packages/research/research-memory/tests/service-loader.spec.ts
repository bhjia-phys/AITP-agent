import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runLoaderSmoke, LOADER_SMOKE_TEST_TIMEOUT_MS } from '@deepseek-ai/dsh-loader-smoke'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import type { CreateTopicReceipt, ReadEnvelope, ResearchSetup, SessionMemoryView, Topic } from '../src/types.ts'
import type { WriteOperation } from '../src/writer.ts'

function currentContext(request: GenerateOptions | undefined): string {
  const message = request?.messages.filter(item => item.role === 'user' && item.source?.kind === 'runtime-context').at(-1)
  if (message === undefined) throw new Error('The actual model request has no runtime context message.')
  return JSON.stringify(message)
}

describe('the production ResearchMemory service through Loader', () => {
  it('delivers a scoped child result and explicit parent-use repair after model writeback and disk restart', async () => {
    const driver = fileURLToPath(new URL('./fixtures/service/driver.ts', import.meta.url))
    await runLoaderSmoke({ label: 'research service read, scoped model write and restart',
      tempDirPrefix: 'research-service-', binScript: driver, libBinScript: driver,
      configPath: fileURLToPath(new URL('./fixtures/service/service.cordis.yml', import.meta.url)),
      tsconfigPath: fileURLToPath(new URL('../../../../tsconfig.json', import.meta.url)),
      inspect: async (cwd) => {
        const onboarding = JSON.parse(await readFile(join(cwd, 'service-onboarding.json'), 'utf8')) as {
          setupBefore: ResearchSetup
          providerBefore: { capabilities: { read: boolean } }
          readOnlyCreatedNoFiles: boolean
          created: CreateTopicReceipt
          child: CreateTopicReceipt
        }
        expect(onboarding.setupBefore).toEqual({ configured: false, writable: false, canInitialize: true })
        expect(onboarding.providerBefore.capabilities.read).toBe(false)
        expect(onboarding.readOnlyCreatedNoFiles).toBe(true)
        const onboardingRestarted = JSON.parse(await readFile(join(cwd, 'service-onboarding-restarted.json'), 'utf8')) as {
          setup: ResearchSetup
          sameReceipt: CreateTopicReceipt
          child: ReadEnvelope<Topic>
          context: unknown
        }
        expect(onboardingRestarted.setup).toEqual({ configured: true, writable: true, canInitialize: true })
        expect(onboardingRestarted.sameReceipt).toEqual(onboarding.created)
        expect(onboardingRestarted.child.value)
          .toMatchObject({ id: onboarding.child.topicId, parentId: onboarding.created.topicId, currentAnswer: null })
        expect(JSON.stringify(onboardingRestarted.context)).toContain('Does the isolated control settle A?')
        expect(JSON.stringify(onboardingRestarted.context)).toContain('Finite size only.')
        const requests = (await readFile(join(cwd, 'service-requests.jsonl'), 'utf8')).trim().split('\n')
          .map(line => JSON.parse(line) as GenerateOptions)
        expect(requests).toHaveLength(7)
        const observations = JSON.parse(await readFile(join(cwd, 'service-observations.json'), 'utf8')) as {
          before: ReadEnvelope<Topic>
          after: ReadEnvelope<Topic>
          parentBeforeRepairPreserved: boolean
          parentAfterRepair: string
          siblingPreserved: boolean
        }
        expect(observations.before.value.currentAnswer?.text).toContain('No accepted bound.')
        expect(observations.after.value.currentAnswer?.text).toContain('At N=6, B holds only under A.')
        expect(observations.parentBeforeRepairPreserved).toBe(true)
        expect(observations.parentAfterRepair).toContain('establishes B at N=6 only under A; no thermodynamic or root conclusion follows.')
        expect(observations.siblingPreserved).toBe(true)
        const afterWrite = currentContext(requests[2])
        expect(afterWrite).toContain('At N=6, B holds only under A.')
        expect(afterWrite).toContain('Assess whether this finite result changes the parent use.')
        expect(afterWrite).toContain('supplies finite-size controls only; it does not settle the root question.')
        const afterParentRepair = currentContext(requests[5])
        expect(afterParentRepair).toContain('At N=6, B holds only under A.')
        expect(afterParentRepair).toContain('establishes B at N=6 only under A; no thermodynamic or root conclusion follows.')
        const afterRestart = currentContext(requests[6])
        expect(afterRestart).toContain('At N=6, B holds only under A.')
        expect(afterRestart).toContain('establishes B at N=6 only under A; no thermodynamic or root conclusion follows.')
        expect(afterRestart).toContain('This repair completes that identified parent-use assessment')
        expect(afterRestart).toContain('Preserve the failed route and every condition.')
        expect(afterRestart).toContain('only after its boundary condition changes')
        expect(afterRestart).toContain('No thermodynamic claim.')
        const restarted = JSON.parse(await readFile(join(cwd, 'service-restarted.json'), 'utf8')) as {
          topic: ReadEnvelope<Topic>
          memory: SessionMemoryView
          parent: string
          siblingPreserved: boolean
        }
        expect(restarted.topic.value.currentAnswer?.text).toBe(observations.after.value.currentAnswer?.text)
        expect(restarted.memory.origin).toBe('runtime')
        expect(restarted.memory.researcher.some(item => item.text.includes('Preserve the failed route and every condition.'))).toBe(true)
        expect(restarted.memory.contextSnapshots?.some(item => item.text.includes('At N=6, B holds only under A.'))).toBe(true)
        expect(restarted.parent).toBe(observations.parentAfterRepair)
        expect(restarted.siblingPreserved).toBe(true)
        const receipts = (await readdir(join(cwd, '.operations'))).filter(path => path.endsWith('.json'))
        expect(receipts).toHaveLength(2)
        const operations = await Promise.all(receipts.map(async name => JSON.parse(await readFile(join(cwd, '.operations', name), 'utf8')) as WriteOperation))
        const child = operations.find(operation => operation.proposal.edits[0]?.resourceId === 'resource:child%2Fresearch.md')
        const parent = operations.find(operation => operation.proposal.edits[0]?.resourceId === 'resource:research.md')
        expect(child?.state).toBe('applied')
        expect(parent?.state).toBe('applied')
        expect(child?.proposal.binding).toEqual({ sessionId: 'research-service-write', workspaceId: 'service-scratch', topicId: 'topic:child%2Fresearch.md' })
        expect(parent?.proposal.binding).toEqual(child?.proposal.binding)
        expect(child?.proposal.remainingUses).toEqual(['Assess whether this finite result changes the parent use.'])
        expect(parent?.proposal.remainingUses).toEqual([])
        expect(parent?.proposal.rationale).toContain('This repair completes that identified parent-use assessment')
        expect(parent?.proposal.edits[0]?.sourceRefs).toContain(`operation:${child?.operationId}`)
      },
    })
  }, LOADER_SMOKE_TEST_TIMEOUT_MS)
})
