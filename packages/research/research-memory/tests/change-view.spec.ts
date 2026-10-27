/** Receipt presentation keeps original file outcomes and omits whole diffs within a bounded response. */
import { expect, it } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { researchChangeView } from '../src/change-view.ts'
import { resourceIdForPath } from '../src/markdown.ts'
import type { WriteOperation, WriteOperationId } from '../src/writer-types.ts'

const owner = { workspaceId: brandString<WorkspaceId>('scratch'), sessionId: SessionId('owner'), operationId: 'operation' }
const stamp = '2026-10-26T00:00:00.000Z'
function operation(state: WriteOperation['state'] = 'applied'): WriteOperation {
  return { format: 1, operationId: brandString<WriteOperationId>(owner.operationId), sourceRoot: '/synthetic',
    createdAt: stamp, updatedAt: stamp, state, concurrency: 'cooperative-single-writer', refreshWarnings: [],
    proposal: { disposition: 'edit', rationale: 'Synthetic exact correction.', edits: [], binding: owner,
      remainingUses: ['Independent parent implication remains unresolved.'] },
    files: [{ resourceId: resourceIdForPath('a/research.md'), relativePath: 'a/research.md',
      state: state === 'unknown' ? 'unknown' : 'applied', beforeText: 'Before '.repeat(1000), afterText: 'After '.repeat(1000),
      current: { state: 'matches-planned-output', observedAt: stamp } }],
  }
}

it('omits complete before/after pairs and reports the bound without changing actual file outcomes', () => {
  const view = researchChangeView(operation(), owner, 900)
  expect(JSON.stringify(view).length).toBeLessThanOrEqual(900)
  expect(view).toMatchObject({ state: 'applied', completeness: 'partial', omittedFiles: 0, omittedDiffs: 1,
    files: [{ state: 'applied', relativePath: 'a/research.md' }] })
  expect(view.files[0]).not.toHaveProperty('beforeText')
  expect(view.files[0]).not.toHaveProperty('afterText')
  const complete = researchChangeView(operation(), owner, 20_000)
  expect(complete).toMatchObject({ completeness: 'complete', omittedFiles: 0, omittedDiffs: 0, omittedUses: 0 })
  expect(complete.files[0]?.beforeText).toBe(operation().files[0]?.beforeText)
  expect(complete.files[0]?.afterText).toBe(operation().files[0]?.afterText)
})

it('keeps interrupted unknown and per-file partial receipts even when current text matches planned output', () => {
  const unknown = researchChangeView(operation('unknown'), owner, 900)
  expect(unknown).toMatchObject({ state: 'unknown', files: [{ state: 'unknown', current: { state: 'matches-planned-output' } }] })
  const applied = operation().files[0]!
  const partial = researchChangeView({ ...operation('partial'), files: [applied,
    { ...applied, resourceId: resourceIdForPath('b/research.md'), relativePath: 'b/research.md', state: 'not-applied' }],
  }, owner, 1200)
  expect(partial).toMatchObject({ state: 'partial', files: [{ state: 'applied' }, { state: 'not-applied' }], omittedDiffs: 2 })
  expect(JSON.stringify(partial).length).toBeLessThanOrEqual(1200)
})

it('refuses a response limit unable to carry the actual operation identity and omission counts', () => {
  expect(() => researchChangeView(operation(), owner, 10)).toThrow('ownership and omission counts')
})
