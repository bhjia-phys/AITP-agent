import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { MarkdownWorkspace, topicIdForPath } from '../src/markdown.ts'
import { ResearchChanges } from '../src/changes.ts'
import type { Result } from '../src/types.ts'

const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
const value = <T>(result: Result<T>): T => { if (!result.ok) throw new Error(result.error.message); return result.value }
const actor = { id: 'owner', kind: 'researcher' as const, label: 'Researcher' }

async function fixture(text: string) {
  const temporary = await mkdtemp(join(tmpdir(), 'research-section-edit-'))
  roots.push(temporary)
  const root = join(temporary, 'source')
  await mkdir(join(root, 'child'), { recursive: true })
  const path = join(root, 'child/research.md')
  await writeFile(path, text)
  const source = new MarkdownWorkspace({ root, maxFiles: 20, maxFileBytes: 10000, maxContextCharacters: 10000 })
  const changes = new ResearchChanges(source, { writableRoot: root, stateDirectory: join(temporary, 'runtime'), maxOperationBytes: 100000 })
  return { path, source, changes, topicId: topicIdForPath('child/research.md') }
}

it.each([
  ['ATX', '## Scope\n\n'],
  ['Setext and CRLF', 'Scope\r\n-----\r\n\r\n'],
])('preserves %s scope heading and boundaries for body-only and complete-section edits', async (_name, heading) => {
  const newline = heading.includes('\r\n') ? '\r\n' : '\n'
  const original = `# Child${newline}${newline}A question.${newline}${newline}${heading}Finite systems.${newline}${newline}## Materials${newline}${newline}Keep this passage.${newline}`
  const { path, source, changes, topicId } = await fixture(original)
  let current = value(await source.getTopic(topicId))
  for (const scope of new Set([current.value.scope, current.value.scope.replace(/\r\n/g, '\n'), 'Finite systems.'])) {
    const unchanged = value(await changes.preview({ topicId, expectedRevision: current.revision,
      command: { kind: 'update-scope', scope } }))
    expect(unchanged.value.edits).toEqual([])
    value(await changes.apply({ previewId: unchanged.value.previewId, operationId: `unchanged-${scope.length}` }, actor))
    expect(await readFile(path, 'utf8')).toBe(original)
  }
  const preview = value(await changes.preview({ topicId, expectedRevision: current.revision,
    command: { kind: 'update-scope', scope: 'Only the matched finite control.' } }))
  expect(await readFile(path, 'utf8')).toBe(original)
  value(await changes.apply({ previewId: preview.value.previewId, operationId: 'body-edit' }, actor))
  const first = original.replace('Finite systems.', 'Only the matched finite control.')
  expect(await readFile(path, 'utf8')).toBe(first)
  current = value(await source.getTopic(topicId))
  expect(current.value.scope).toContain(heading + 'Only the matched finite control.')
  const complete = value(await changes.preview({ topicId, expectedRevision: current.revision,
    command: { kind: 'update-scope', scope: current.value.scope.replace('matched finite control', 'matched N=6 control') } }))
  value(await changes.apply({ previewId: complete.value.previewId, operationId: 'complete-section-edit' }, actor))
  expect(await readFile(path, 'utf8')).toBe(first.replace('matched finite control', 'matched N=6 control'))
})

it('preserves answer headings and does not duplicate unchanged qualifications inside the answer passage', async () => {
  const original = '# Child\n\nA question.\n\n## Current answer\n\nOld answer.\n\n### Limitations\n\nFinite systems only.\n\n## Materials\n\nKeep this passage.\n'
  const { path, source, changes, topicId } = await fixture(original)
  const current = value(await source.getTopic(topicId))
  const answer = current.value.currentAnswer!
  const unchanged = value(await changes.preview({ topicId, expectedRevision: current.revision,
    command: { kind: 'record-answer', text: answer.text, qualification: answer.qualification, sourceResourceIds: [] } }))
  expect(unchanged.value.edits).toEqual([])
  value(await changes.apply({ previewId: unchanged.value.previewId, operationId: 'same-answer' }, actor))
  expect(await readFile(path, 'utf8')).toBe(original)
  const changed = value(await changes.preview({ topicId, expectedRevision: current.revision,
    command: { kind: 'record-answer', text: 'New bounded answer.', qualification: answer.qualification, sourceResourceIds: [] } }))
  value(await changes.apply({ previewId: changed.value.previewId, operationId: 'answer-edit' }, actor))
  expect(await readFile(path, 'utf8')).toBe(original.replace('Old answer.', 'New bounded answer.'))
})

it.each(['retained answer section', 'body only'])('updates nested qualifications once when the answer editor supplies %s', async (mode) => {
  const original = '# Child\n\nA question.\n\n## Current answer\n\nOld answer.\n\n### Limitations\n\nFinite systems only.\n\n## Materials\n\nKeep this passage.\n'
  const { path, source, changes, topicId } = await fixture(original)
  const current = value(await source.getTopic(topicId))
  const answer = current.value.currentAnswer!
  const text = mode === 'body only' ? 'New bounded answer.' : answer.text.replace('Old answer.', 'New bounded answer.')
  const changed = value(await changes.preview({ topicId, expectedRevision: current.revision,
    command: { kind: 'record-answer', text, qualification: 'Only the matched N=6 control; no thermodynamic claim.', sourceResourceIds: [] } }))
  value(await changes.apply({ previewId: changed.value.previewId, operationId: 'qualified-answer-edit' }, actor))
  expect(await readFile(path, 'utf8')).toBe(original.replace('Old answer.', 'New bounded answer.')
    .replace('Finite systems only.', 'Only the matched N=6 control; no thermodynamic claim.'))
  expect(value(await source.getTopic(topicId)).value.currentAnswer?.qualification)
    .toBe('### Limitations\n\nOnly the matched N=6 control; no thermodynamic claim.')
})

it.each(['\n', '\r\n'])('retains a qualification edited only inside the complete answer with %j endings', async (newline) => {
  const original = '# Child\n\nA question.\n\n## Current answer\n\nOld answer.\n\n### Limitations\n\nFinite systems only.\n\n## Materials\n\nKeep this passage.\n'.replace(/\n/g, newline)
  const { path, source, changes, topicId } = await fixture(original)
  const current = value(await source.getTopic(topicId))
  const answer = current.value.currentAnswer!
  const updated = 'Only N=6 under A; other sizes remain unresolved.'
  const edited = answer.text.replace('Finite systems only.', updated).replace(/\r\n/g, '\n')
  const preview = value(await changes.preview({ topicId, expectedRevision: current.revision,
    command: { kind: 'record-answer', text: edited, qualification: answer.qualification, sourceResourceIds: [] } }))
  value(await changes.apply({ previewId: preview.value.previewId, operationId: 'answer-contains-new-condition' }, actor))
  expect(await readFile(path, 'utf8')).toBe(original.replace('Finite systems only.', updated))
})

it('accepts identical simultaneous condition edits once and refuses divergent or duplicated conditions', async () => {
  const original = '# Child\n\nA question.\n\n## Current answer\n\nOld answer.\n\n### Limitations\n\nFinite systems only.\n'
  const { path, source, changes, topicId } = await fixture(original)
  const current = value(await source.getTopic(topicId))
  const answer = current.value.currentAnswer!
  const edited = answer.text.replace('Finite systems only.', 'Only N=6 under A.')
  const same = value(await changes.preview({ topicId, expectedRevision: current.revision,
    command: { kind: 'record-answer', text: edited, qualification: 'Only N=6 under A.', sourceResourceIds: [] } }))
  expect(same.value.edits[0]?.after).toBe(original.replace('Finite systems only.', 'Only N=6 under A.'))
  for (const text of [edited, `${edited}\n\n${answer.qualification}`]) {
    const conflict = await changes.preview({ topicId, expectedRevision: current.revision,
      command: { kind: 'record-answer', text, qualification: 'Only N=8 under B.', sourceResourceIds: [] } })
    expect(conflict).toMatchObject({ ok: false, error: { code: 'unsupported' } })
  }
  expect(await readFile(path, 'utf8')).toBe(original)
})

it('keeps separately authored answer qualifications outside the simplified field editor', async () => {
  const original = '# Child\n\nA question.\n\n## Current answer\n\nOld answer.\n\n## Limitations\n\nFinite systems only.\n'
  const { path, source, changes, topicId } = await fixture(original)
  const current = value(await source.getTopic(topicId))
  expect(await changes.preview({ topicId, expectedRevision: current.revision,
    command: { kind: 'record-answer', text: 'New answer.', qualification: 'Finite systems only.', sourceResourceIds: [] } }))
    .toMatchObject({ ok: false, error: { code: 'unsupported' } })
  expect(await readFile(path, 'utf8')).toBe(original)
})

it('separates historical publication from changed or missing sources on a retry', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'research-changes-'))
  roots.push(temporary)
  const root = join(temporary, 'source')
  await mkdir(join(root, 'child'), { recursive: true })
  const path = join(root, 'child/research.md')
  const original = '# Child\nA question.\n## Scope\nFinite systems.\n'
  await writeFile(path, original)
  const source = new MarkdownWorkspace({ root, maxFiles: 20, maxFileBytes: 10000, maxContextCharacters: 10000 })
  const changes = new ResearchChanges(source, { writableRoot: root, stateDirectory: join(temporary, 'runtime'), maxOperationBytes: 100000 })
  const topicId = topicIdForPath('child/research.md')
  const current = value(await source.getTopic(topicId))
  const preview = value(await changes.preview({ topicId, expectedRevision: current.revision, command: { kind: 'update-scope', scope: 'Only the matched finite control.' } }))
  const request = { previewId: preview.value.previewId, operationId: 'same-attempt' }
  const actor = { id: 'owner', kind: 'researcher' as const, label: 'Researcher' }
  const applied = value(await changes.apply(request, actor))
  expect(applied.value.sourceObservations?.[0]?.state).toBe('matches-applied')
  await writeFile(path, original + '\nA later independent edit.\n')
  const changed = value(await changes.apply(request, actor))
  expect(changed.value.changed).toEqual(applied.value.changed)
  expect(changed.value.sourceObservations?.[0]?.state).toBe('different')
  await rm(path)
  const missing = value(await changes.apply(request, actor))
  expect(missing.value.changed).toEqual(applied.value.changed)
  expect(missing.value.sourceObservations?.[0]).toMatchObject({ state: 'unavailable' })
  expect(missing.value.sourceObservations?.[0]).not.toHaveProperty('revision')
})
