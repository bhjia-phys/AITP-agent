/** Explicit materials use disposable source roots and real binary PDF input. */
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { MarkdownWorkspace } from '../src/markdown.ts'
import { topicIdForPath } from '../src/markdown-files.ts'
import { MaterialWriter, resolveMaterialTopic } from '../src/material-writes.ts'
import type { MaterialWriteGrant, MaterialWriteRequest } from '../src/material-types.ts'
import type { Result } from '../src/types.ts'
import * as files from '../src/material-files.ts'

const roots: string[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})
function value<T>(result: Result<T>): T { if (!result.ok) throw new Error(result.error.message); return result.value }

async function fixture() {
  const temporary = await mkdtemp(join(tmpdir(), 'research-materials-'))
  roots.push(temporary)
  const root = join(temporary, 'sources')
  const stateDirectory = join(temporary, 'runtime')
  await mkdir(root)
  await writeFile(join(root, 'research.md'), '# Question\n\nRetain this unresolved premise.\n')
  const grant: MaterialWriteGrant = { root, writable: true, stateDirectory,
    maxContentBytes: 40_000, maxAccountBytes: 40_000, maxOperationBytes: 20_000 }
  const writer = new MaterialWriter(grant)
  const reader = new MarkdownWorkspace({ root, maxFiles: 100, maxFileBytes: 40_000, maxContextCharacters: 10_000 })
  return { root, temporary, stateDirectory, grant, writer, reader }
}
function note(operationId = 'derivation'): MaterialWriteRequest {
  return { operationId, relativePath: 'direction/subproblem/notes/条件.md', content: { kind: 'text', text: '# 条件\n\nThe bound assumes finite N.\n' },
    association: { accountPath: 'research.md', title: 'Conditional derivation', description: 'Tests the finite N premise; the infinite limit remains open.' } }
}

it('saves a nested derivation, records its stated use and replays the exact operation after restart without duplicate links', async () => {
  const f = await fixture()
  const input = note()
  const first = value(await f.writer.save(input))
  expect(first).toMatchObject({ relativePath: input.relativePath, mediaType: 'text/plain', file: { state: 'saved', readBack: { state: 'matches' } }, association: { state: 'linked' }, retry: 'none' })
  expect(await readFile(join(f.root, input.relativePath), 'utf8')).toBe(input.content.kind === 'text' ? input.content.text : '')
  const account = await readFile(join(f.root, 'research.md'), 'utf8')
  expect(account).toContain('Retain this unresolved premise.')
  expect(account).toContain('notes/%E6%9D%A1%E4%BB%B6.md')
  expect(account).toContain('the infinite limit remains open.')
  const before = (await stat(join(f.root, input.relativePath))).mtimeMs
  const replay = value(await new MaterialWriter(f.grant).save(input))
  expect(replay).toMatchObject({ file: { state: 'saved', readBack: { state: 'matches' } }, association: { state: 'linked' }, retry: 'none' })
  expect((await stat(join(f.root, input.relativePath))).mtimeMs).toBe(before)
  expect(await readFile(join(f.root, 'research.md'), 'utf8')).toBe(account)
  expect(await readdir(join(f.root, 'direction/subproblem/notes'))).toEqual(['条件.md'])
})

it('imports actual local PDF bytes, preserves the original and reads back identical binary bytes', async () => {
  const f = await fixture()
  const original = await readFile(new URL('../../research-literature/tests/fixtures/two-pages.pdf', import.meta.url))
  const selected = join(f.temporary, 'selected.pdf')
  await writeFile(selected, original)
  const result = value(await f.writer.save({ operationId: 'import-pdf', relativePath: 'papers/control.pdf', content: { kind: 'pdf', bytes: await readFile(selected) } }))
  expect(result).toMatchObject({ mediaType: 'application/pdf', byteLength: original.length, file: { state: 'saved', readBack: { state: 'matches', byteLength: original.length } }, association: { state: 'not-requested' } })
  expect(await readFile(selected)).toEqual(original)
  expect(await readFile(join(f.root, 'papers/control.pdf'))).toEqual(original)
  expect(await readFile(join(f.root, 'research.md'), 'utf8')).not.toContain('control.pdf')
})

it('creates code and result artifacts only at their selected paths without adding metadata or a scientific claim', async () => {
  const f = await fixture()
  for (const [relativePath, text] of [['code/control.py', 'print(2 + 2)\n'], ['results/control.csv', 'N,error\n4,0.03\n']] as const) {
    const result = value(await f.writer.save({ operationId: relativePath.startsWith('code') ? 'code' : 'result', relativePath, content: { kind: 'text', text } }))
    expect(result.file.state).toBe('saved')
    expect(await readFile(join(f.root, relativePath), 'utf8')).toBe(text)
  }
  expect((await readdir(f.root)).sort()).toEqual(['code', 'research.md', 'results'])
})

it('keeps an existing name even when its bytes match, and rejects a reused identity with changed content or destination', async () => {
  const f = await fixture()
  const input = note()
  value(await f.writer.save(input))
  const collision = value(await f.writer.save({ ...input, operationId: 'other' }))
  expect(collision).toMatchObject({ file: { state: 'conflict', readBack: { state: 'matches' } }, association: { state: 'not-linked' }, retry: 'new-operation' })
  expect(await f.writer.save({ ...input, content: { kind: 'text', text: 'Changed source bytes' } })).toMatchObject({ ok: false, error: { code: 'operation-reused' } })
  expect(await f.writer.save({ ...input, relativePath: 'other.md' })).toMatchObject({ ok: false, error: { code: 'operation-reused' } })
  expect(await readFile(join(f.root, input.relativePath), 'utf8')).toContain('finite N')
})

it('keeps a saved file when its account is absent and retries only the ordinary link after the account is restored', async () => {
  const f = await fixture()
  const input = { ...note(), association: { accountPath: 'index.md', title: 'Explanation' } }
  const first = value(await f.writer.save(input))
  expect(first).toMatchObject({ file: { state: 'saved' }, association: { state: 'not-linked' }, retry: 'same-request' })
  const before = (await stat(join(f.root, input.relativePath))).mtimeMs
  await writeFile(join(f.root, 'index.md'), '# Existing knowledge index\n\nPreserve another explanation.\n')
  const replay = value(await new MaterialWriter(f.grant).save(input))
  expect(replay).toMatchObject({ file: { state: 'saved' }, association: { state: 'linked' }, retry: 'none' })
  expect((await stat(join(f.root, input.relativePath))).mtimeMs).toBe(before)
  expect(await readFile(join(f.root, 'index.md'), 'utf8')).toContain('Preserve another explanation.')
})

it('reports interrupted file publication as unknown even when current bytes match and does not retry that write or link', async () => {
  const f = await fixture()
  const original = files.createMaterialFile
  vi.spyOn(files, 'createMaterialFile').mockImplementation(async (root, path, bytes) => {
    await original(root, path, bytes)
    if (root === f.root) throw new Error('simulated failure after source sync')
  })
  const first = value(await f.writer.save(note()))
  expect(first).toMatchObject({ file: { state: 'unknown', readBack: { state: 'matches' } }, association: { state: 'not-linked' }, retry: 'inspect' })
  vi.restoreAllMocks()
  const create = vi.spyOn(files, 'createMaterialFile')
  const replay = value(await new MaterialWriter(f.grant).save(note()))
  expect(replay).toMatchObject({ file: { state: 'unknown', readBack: { state: 'matches' } }, retry: 'inspect' })
  expect(create).not.toHaveBeenCalled()
  expect(await readFile(join(f.root, 'research.md'), 'utf8')).not.toContain('Conditional derivation')
})

it('recovers an interrupted association by observing the exact line without appending it again', async () => {
  const f = await fixture()
  const original = files.appendMaterialLink
  vi.spyOn(files, 'appendMaterialLink').mockImplementation(async (...args) => { await original(...args); throw new Error('simulated interrupted acknowledgment') })
  expect(value(await f.writer.save(note()))).toMatchObject({ file: { state: 'saved' }, association: { state: 'unknown' }, retry: 'inspect' })
  const account = await readFile(join(f.root, 'research.md'), 'utf8')
  vi.restoreAllMocks()
  const append = vi.spyOn(files, 'appendMaterialLink')
  expect(value(await new MaterialWriter(f.grant).save(note()))).toMatchObject({ association: { state: 'linked' }, retry: 'none' })
  expect(append).not.toHaveBeenCalled()
  expect(await readFile(join(f.root, 'research.md'), 'utf8')).toBe(account)
})

it('does not rewrite a partially published file after a crash left the durable operation in publishing', async () => {
  const f = await fixture()
  const input = note()
  value(await f.writer.save(input))
  const recordPath = join(f.stateDirectory, 'materials', `${input.operationId}.json`)
  const record = JSON.parse(await readFile(recordPath, 'utf8')) as { file: string; association: string }
  record.file = 'publishing'
  record.association = 'planned'
  await writeFile(recordPath, JSON.stringify(record))
  await writeFile(join(f.root, input.relativePath), '# Partial')
  await writeFile(join(f.root, 'research.md'), '# Account after interruption\n')
  const create = vi.spyOn(files, 'createMaterialFile')
  expect(value(await new MaterialWriter(f.grant).save(input))).toMatchObject({ file: { state: 'unknown', readBack: { state: 'different' } }, association: { state: 'not-linked' }, retry: 'inspect' })
  expect(create).not.toHaveBeenCalled()
  expect(await readFile(join(f.root, input.relativePath), 'utf8')).toBe('# Partial')
  expect(await readFile(join(f.root, 'research.md'), 'utf8')).toBe('# Account after interruption\n')
})

it('keeps an uncertain association without an exact saved line unresolved instead of repeating it', async () => {
  const f = await fixture()
  vi.spyOn(files, 'appendMaterialLink').mockRejectedValueOnce(new Error('interrupted append before acknowledgment'))
  expect(value(await f.writer.save(note()))).toMatchObject({ file: { state: 'saved' }, association: { state: 'unknown' }, retry: 'inspect' })
  vi.restoreAllMocks()
  const append = vi.spyOn(files, 'appendMaterialLink')
  expect(value(await new MaterialWriter(f.grant).save(note()))).toMatchObject({ association: { state: 'unknown' }, retry: 'inspect' })
  expect(append).not.toHaveBeenCalled()
})

it('refuses to steal an interrupted operation claim or reconstruct missing durable payload bytes', async () => {
  const f = await fixture()
  value(await f.writer.save(note()))
  const state = join(f.stateDirectory, 'materials')
  await writeFile(join(state, 'derivation.lock'), '')
  expect(await f.writer.save(note())).toMatchObject({ ok: false, error: { code: 'unavailable' } })
  await rm(join(state, 'derivation.lock'))
  await rm(join(state, 'derivation.payload'))
  expect(await f.writer.save(note())).toMatchObject({ ok: false, error: { code: 'unavailable' } })
  expect(await readFile(join(f.root, note().relativePath), 'utf8')).toContain('finite N')
})

it('preserves an external material edit and does not create a still-missing association on retry', async () => {
  const f = await fixture()
  const input = { ...note(), association: { accountPath: 'index.md', title: 'Explanation' } }
  expect(value(await f.writer.save(input)).association.state).toBe('not-linked')
  await writeFile(join(f.root, input.relativePath), 'External corrected premise.\n')
  await writeFile(join(f.root, 'index.md'), '# Index\n')
  expect(value(await f.writer.save(input))).toMatchObject({ file: { state: 'saved', readBack: { state: 'different' } }, association: { state: 'not-linked' }, retry: 'inspect' })
  expect(await readFile(join(f.root, input.relativePath), 'utf8')).toBe('External corrected premise.\n')
  expect(await readFile(join(f.root, 'index.md'), 'utf8')).toBe('# Index\n')
})

it('does not restore a link deleted by an external editor', async () => {
  const f = await fixture()
  value(await f.writer.save(note()))
  await writeFile(join(f.root, 'research.md'), '# Deliberately removed association\n')
  expect(value(await f.writer.save(note()))).toMatchObject({ association: { state: 'conflict' }, retry: 'new-operation' })
  expect(await readFile(join(f.root, 'research.md'), 'utf8')).toBe('# Deliberately removed association\n')
})

it('enforces read-only authority before creating application state or sources', async () => {
  const f = await fixture()
  expect(await new MaterialWriter({ ...f.grant, writable: false }).save(note())).toMatchObject({ ok: false, error: { code: 'read-only' } })
  expect(await readdir(f.temporary)).toEqual(['sources'])
  expect(await readdir(f.root)).toEqual(['research.md'])
})

it.each(['../escape.md', '/absolute.md', 'x/../../escape.md', 'x\\escape.md', '.git/config', 'CON.md', 'x/new.md:stream'])('rejects the unsafe material destination %s', async (relativePath) => {
  const f = await fixture()
  expect(await f.writer.save({ ...note(), relativePath })).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  expect(await readdir(f.root)).toEqual(['research.md'])
})

it('rejects a symlink destination directory and leaves its external target unchanged', async () => {
  const f = await fixture()
  const outside = join(f.temporary, 'outside')
  await mkdir(outside)
  await symlink(outside, join(f.root, 'redirect'), 'dir')
  const result = value(await f.writer.save({ ...note(), relativePath: 'redirect/new.md' }))
  expect(result).toMatchObject({ file: { state: 'not-saved', readBack: { state: 'unavailable' } }, retry: 'inspect' })
  expect(await readdir(outside)).toEqual([])
})

it('refuses a write through an association symlink while retaining the successfully saved material', async () => {
  const f = await fixture()
  const outside = join(f.temporary, 'outside.md')
  await writeFile(outside, '# External\n')
  await symlink(outside, join(f.root, 'index.md'))
  const result = value(await f.writer.save({ ...note(), association: { accountPath: 'index.md', title: 'Explanation' } }))
  expect(result).toMatchObject({ file: { state: 'saved' }, association: { state: 'not-linked' } })
  expect(await readFile(outside, 'utf8')).toBe('# External\n')
})

it('bounds UTF-8 content and complete operation storage before any scientific write and rejects text masquerading as a PDF', async () => {
  const f = await fixture()
  const bounded = new MaterialWriter({ ...f.grant, maxContentBytes: 5 })
  expect(await bounded.save({ operationId: 'utf8', relativePath: 'x.md', content: { kind: 'text', text: '条件' } })).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  expect(await new MaterialWriter({ ...f.grant, maxOperationBytes: 2 }).save(note())).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  expect(await f.writer.save({ operationId: 'fake', relativePath: 'fake.pdf', content: { kind: 'text', text: '%PDF- a string' } })).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  expect(await readdir(f.root)).toEqual(['research.md'])
})

it('saves exact-limit UTF-8 content and reports an oversized association independently', async () => {
  const f = await fixture()
  const bounded = new MaterialWriter({ ...f.grant, maxContentBytes: 6, maxAccountBytes: 6 })
  const exact = value(await bounded.save({ operationId: 'exact', relativePath: 'x.md', content: { kind: 'text', text: '条件' }, association: { accountPath: 'research.md', title: 'Use' } }))
  expect(exact).toMatchObject({ byteLength: 6, file: { state: 'saved', readBack: { state: 'matches' } }, association: { state: 'not-linked' }, retry: 'same-request' })
  expect(await readFile(join(f.root, 'x.md'), 'utf8')).toBe('条件')
})

it('keeps the account byte limit independent of the larger PDF publication limit', async () => {
  const f = await fixture()
  const bytes = await readFile(new URL('../../research-literature/tests/fixtures/two-pages.pdf', import.meta.url))
  const original = await readFile(join(f.root, 'research.md'), 'utf8')
  const writer = new MaterialWriter({ ...f.grant, maxAccountBytes: Buffer.byteLength(original, 'utf8') })
  const saved = value(await writer.save({ operationId: 'large-binary-small-account', relativePath: 'papers/original.pdf',
    content: { kind: 'pdf', bytes }, association: { accountPath: 'research.md', title: 'Reference' } }))
  expect(saved).toMatchObject({ file: { state: 'saved', readBack: { state: 'matches' } }, association: { state: 'not-linked' }, retry: 'same-request' })
  expect(await readFile(join(f.root, 'research.md'), 'utf8')).toBe(original)
  expect(await readFile(join(f.root, 'papers/original.pdf'))).toEqual(bytes)
})

it('resolves the actual fourth-level account without synthesizing a root-relative topic path', async () => {
  const f = await fixture()
  const paths = ['existing/research.md', 'existing/branch/research.md', 'existing/branch/control/research.md', 'existing/branch/control/fourth/research.md']
  for (const [index, path] of paths.entries()) {
    await mkdir(dirname(join(f.root, path)), { recursive: true })
    await writeFile(join(f.root, path), `# Level ${index + 1}\n\nQuestion ${index + 1}.\n${index < paths.length - 1 ? `\n## Subtopics\n[Child](${index === 0 ? 'branch' : index === 1 ? 'control' : 'fourth'}/research.md)\n` : ''}`)
  }
  await writeFile(join(f.root, 'research.md'), '# Project\n\n## Topics\n[Existing](existing/research.md)\n')
  const deepest = paths.at(-1)!
  expect(value(await resolveMaterialTopic(f.reader, topicIdForPath(deepest)))).toMatchObject({ accountPath: deepest, directory: 'existing/branch/control/fourth' })
  expect(value(await resolveMaterialTopic(f.reader))).toMatchObject({ accountPath: 'research.md', directory: '' })
  expect(await resolveMaterialTopic(f.reader, topicIdForPath('missing/research.md'))).toMatchObject({ ok: false })
})

it('associates a shared family resource with its existing README map', async () => {
  const f = await fixture()
  await rm(join(f.root, 'research.md'))
  await mkdir(join(f.root, 'direction'))
  await writeFile(join(f.root, 'direction/research.md'), '# One independent question\n')
  await writeFile(join(f.root, 'README.md'), '# Family map\n\n## Topics\n[Direction](direction/research.md)\n')
  const location = value(await resolveMaterialTopic(f.reader))
  expect(location).toMatchObject({ accountPath: 'README.md', directory: '' })
  const receipt = value(await f.writer.save({ operationId: 'family-reference', relativePath: 'notes/reading.md',
    content: { kind: 'text', text: '# Shared reading\nA source summary, not a joint conclusion.\n' },
    association: { accountPath: location.accountPath, title: 'Shared source reading' } }))
  expect(receipt.association.state).toBe('linked')
  expect(await readFile(join(f.root, 'README.md'), 'utf8')).toContain('notes/reading.md')
  expect(await readdir(f.root)).not.toContain('research.md')
})
