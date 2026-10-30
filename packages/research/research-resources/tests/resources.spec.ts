/** Shared authority, domain lifecycle and exact source identity over real local files. */
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Context } from '@deepseek-ai/cordis'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { afterEach, expect, it, vi } from 'vitest'
import ResearchResources, { resourceEntryId, sourceIdForPath, sourceRootId } from '../src/index.ts'
import { GuardedFiles, SourceError, normalizedPath } from '../src/files.ts'
import type { ResourceBody, ResourceProvider, ResourceResult, ResourceSummary, SourceId, SourceProviderContext, SourceTopicId } from '../src/types.ts'
import { paddedPdf } from '../../research-literature/tests/fixture.ts'

const cleanup: (() => Promise<unknown>)[] = []
afterEach(async () => { for (const dispose of cleanup.splice(0).reverse()) await dispose() })
const signal = (): AbortSignal => new AbortController().signal
function bodyText(body: ResourceBody): string {
  if (body.kind !== 'text') throw new Error('The expected text source was not returned.')
  return body.text
}

function value<T>(result: ResourceResult<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

async function fixture(config: ConstructorParameters<typeof ResearchResources>[1] = {}) {
  const base = await mkdtemp(join(tmpdir(), 'research-resources-'))
  cleanup.push(() => rm(base, { recursive: true, force: true }))
  const a = join(base, 'a')
  const b = join(base, 'b')
  await mkdir(a)
  await mkdir(b)
  await writeFile(join(a, 'note.md'), '# Alpha\n\nFinite-size evidence only.\n')
  await writeFile(join(b, 'note.md'), '# Beta\n\nDifferent source.\n')
  const ctx = new Context()
  cleanup.push(() => ctx.fiber.dispose())
  const service = new ResearchResources(ctx, config)
  return { base, a, b, ctx, service }
}

function row(context: SourceProviderContext, path: string): ResourceSummary {
  const ref = { rootId: context.root.id, sourceId: sourceIdForPath(path) }
  return { id: resourceEntryId(ref), ref, title: path, kind: 'note', domain: 'knowledge', providerId: 'test-knowledge',
    metadata: {}, links: [], topics: [] }
}

const provider = (list: ResourceProvider['list'] = async context => context.paths.map(path => row(context, path))): ResourceProvider => ({
  id: 'test-knowledge', domain: 'knowledge', list,
})

it('shares equal canonical roots across counted grants and keeps other domain grants after withdrawal', async () => {
  const { service, a } = await fixture()
  const knowledge = await service.registerRoot({ id: 'knowledge', path: a, domains: ['knowledge'] })
  const code = await service.registerRoot({ id: 'workspace:a', path: join(a, '.'), domains: ['code'] })
  expect(code.rootId).toBe(knowledge.rootId)
  expect(value(await service.listRoots({}, signal()))).toHaveLength(1)
  expect(value(await service.listRoots({}, signal()))[0]?.domains).toEqual(['knowledge', 'code'])
  knowledge.dispose()
  knowledge.dispose()
  expect(value(await service.listRoots({}, signal()))[0]?.domains).toEqual(['code'])
  const ref = { rootId: code.rootId, sourceId: sourceIdForPath('note.md') }
  expect(bodyText(value(await service.readResource({ ref }, signal())).body)).toContain('Finite-size')
  code.dispose()
  expect(value(await service.listRoots({}, signal()))).toEqual([])
  expect(await service.readResource({ ref }, signal())).toMatchObject({ ok: false, error: { code: 'permission-denied' } })
})

it('discovers body-only conditions and reuses unchanged source bodies without requiring catalog metadata', async () => {
  const { service, a } = await fixture({ watchSources: false })
  await mkdir(join(a, 'deep'))
  const original = '# Unusual orientation\n\nThe orthogonality obstruction requires a degenerate subspace.\n'
  await writeFile(join(a, 'deep/untitled.tex'), original)
  await service.registerRoot({ id: 'body-root', path: a })
  const catalog = vi.fn<ResourceProvider['list']>(async () => [])
  service.registerProvider(provider(catalog))
  const read = vi.spyOn(GuardedFiles.prototype, 'read')
  cleanup.push(async () => { read.mockRestore() })
  const cold = value(await service.searchBodies({ query: 'orthogonality obstruction' }, signal()))
  expect(cold.hits).toHaveLength(1)
  expect(cold.hits[0]?.ref).toEqual({ rootId: sourceRootId('body-root'), sourceId: sourceIdForPath('deep/untitled.tex') })
  expect(cold.hits[0]?.excerpt).toContain('requires a degenerate subspace')
  expect(catalog).not.toHaveBeenCalled()
  expect(cold.bytesRead).toBeGreaterThan(0)
  read.mockClear()
  const warm = value(await service.searchBodies({ query: 'degenerate subspace' }, signal()))
  expect(warm.hits).toHaveLength(1)
  expect(warm.bytesRead).toBe(0)
  expect(warm.cacheHits).toBe(warm.inspectedFiles)
  expect(read).not.toHaveBeenCalled()
  await writeFile(join(a, 'deep/untitled.tex'), original.replace('Unusual orientation', 'Renamed heading') + '\nOnly first perturbative order.\n')
  const changed = value(await service.searchBodies({ query: 'first perturbative order' }, signal()))
  expect(changed.hits[0]?.excerpt).toContain('Only first perturbative order')
  expect(read).toHaveBeenCalledTimes(1)
  const hit = changed.hits[0]!
  expect(bodyText(value(await service.readResource({ ref: hit.ref, locator: hit.locator }, signal())).body))
    .toContain('Only first perturbative order')
})

it('starts narrowed body discovery inside the requested folder despite an exhausted root scan', async () => {
  const { service, a } = await fixture({ maxFiles: 3 })
  await writeFile(join(a, 'a.txt'), 'Unrelated material.')
  await writeFile(join(a, 'b.txt'), 'More unrelated material.')
  await mkdir(join(a, 'z-topic'))
  await writeFile(join(a, 'z-topic', 'condition.tex'), 'The orthogonality obstruction remains conditional.')
  const root = await service.registerRoot({ id: 'limited', path: a })
  const broad = value(await service.searchBodies({ query: 'orthogonality', rootId: root.rootId }, signal()))
  expect(broad).toMatchObject({ completeness: 'partial', hits: [] })
  const narrowed = value(await service.searchBodies({ query: 'orthogonality', rootId: root.rootId, folder: 'z-topic' }, signal()))
  expect(narrowed.hits).toHaveLength(1)
  expect(narrowed.hits[0]?.path).toBe('z-topic/condition.tex')
  expect(narrowed.inspectedFiles).toBe(1)
  expect(narrowed.completeness).toBe('complete')
})

it('keeps excluded and symlink directories excluded when discovery is explicitly narrowed', async () => {
  const { service, a } = await fixture()
  await mkdir(join(a, '.git'))
  await mkdir(join(a, 'actual'))
  await writeFile(join(a, '.git/hidden.txt'), 'PRIVATE_FOLDER_SEARCH_MARKER')
  await writeFile(join(a, 'actual/visible.txt'), 'PRIVATE_FOLDER_SEARCH_MARKER')
  await symlink(join(a, 'actual'), join(a, 'alias'))
  const root = await service.registerRoot({ id: 'folder-boundary', path: a })
  for (const folder of ['.git', 'alias']) {
    const observed = value(await service.searchBodies({ query: 'PRIVATE_FOLDER_SEARCH_MARKER', rootId: root.rootId, folder }, signal()))
    expect(observed.hits).toEqual([])
    expect(observed.completeness).toBe('partial')
    expect(observed.issues.length).toBeGreaterThan(0)
  }
})

it('reports partial zero-hit body searches and rejects unauthorized roots and traversal', async () => {
  const { service, a } = await fixture({ maxSearchBytes: 40, watchSources: false })
  await writeFile(join(a, 'oversize.tex'), 'A decisive condition appears beyond this deliberately small byte budget.\n')
  await service.registerRoot({ id: 'bounded-search', path: a })
  const result = value(await service.searchBodies({ query: 'decisive condition' }, signal()))
  expect(result.hits).toEqual([])
  expect(result.completeness).toBe('partial')
  expect(result.issues.some(issue => issue.reason.includes('byte budget'))).toBe(true)
  expect(result.bytesExamined).toBeLessThanOrEqual(40)
  expect(await service.searchBodies({ query: 'condition', rootId: sourceRootId('unadmitted') }, signal()))
    .toMatchObject({ ok: false, error: { code: 'permission-denied' } })
  expect(await service.searchBodies({ query: 'condition', folder: '../outside' }, signal()))
    .toMatchObject({ ok: false, error: { code: 'invalid-request' } })
})

it('keeps physical PDF locations and explicit extraction coverage in body-search candidates', async () => {
  const { service, a } = await fixture()
  await writeFile(join(a, 'control.pdf'), '%PDF fixture supplied by a bounded domain reader')
  await service.registerRoot({ id: 'pdf-search', path: a })
  const release = service.registerProvider({ id: 'pdf-search', domain: 'literature', list: async context => context.paths.filter(path => path.endsWith('.pdf'))
    .map(path => ({ ...row(context, path), providerId: 'pdf-search', domain: 'literature', kind: 'literature' })),
  read: async (_context, ref) => ref.sourceId === sourceIdForPath('control.pdf')
    ? { kind: 'pdf', pageCount: 3, pages: [{ page: 2, text: 'The finite control requires perturbative order one.' }] }
    : undefined })
  const result = value(await service.searchBodies({ query: 'perturbative order' }, signal()))
  expect(result.hits[0]?.locator).toMatchObject({ kind: 'pdf-page', page: 2 })
  expect(result.completeness).toBe('partial')
  expect(result.issues.some(issue => issue.reason.includes('1 of 3 physical pages'))).toBe(true)
  release()
  const unloaded = value(await service.searchBodies({ query: 'perturbative order' }, signal()))
  expect(unloaded.hits).toEqual([])
  expect(unloaded.completeness).toBe('partial')
})

it('charges failed decoding attempts against the search budget and exposes other admitted roots for continuation', async () => {
  const { service, a, b } = await fixture({ watchSources: false, maxSearchBytes: 8 })
  await writeFile(join(a, 'bad.tex'), Buffer.from([255, 255, 255, 255]))
  await service.registerRoot({ id: 'invalid-text', path: a })
  await service.registerRoot({ id: 'other-admitted-root', path: b })
  const result = value(await service.searchBodies({ query: 'condition' }, signal()))
  expect(result.failedReadBytes).toBe(4)
  expect(result.bytesExamined).toBeLessThanOrEqual(8)
  expect(result.completeness).toBe('partial')
  expect(result.availableRoots).toContain(sourceRootId('other-admitted-root'))
})

it('rechecks a withdrawn root grant before reusing body-search observations', async () => {
  const { service, a } = await fixture({ watchSources: false })
  let admitted = true
  await service.registerRoot({ id: 'conditional-body-root', path: a, isAuthorized: () => admitted })
  const query = { query: 'Finite-size', rootId: sourceRootId('conditional-body-root') }
  expect(value(await service.searchBodies(query, signal())).hits).toHaveLength(1)
  admitted = false
  expect(await service.searchBodies(query, signal())).toMatchObject({ ok: false, error: { code: 'permission-denied' } })
})

it('rechecks existing Host authority and keeps an independently configured grant when a Workspace grant stops applying', async () => {
  const { service, a } = await fixture()
  let authorized = true
  const workspace = await service.registerRoot({ id: 'workspace:a', path: a, domains: ['knowledge'], isAuthorized: () => authorized })
  const ref = { rootId: workspace.rootId, sourceId: sourceIdForPath('note.md') }
  service.registerProvider(provider())
  expect(value(await service.listResources({}, signal())).items).toHaveLength(1)
  authorized = false
  expect(value(await service.listRoots({}, signal()))).toEqual([])
  expect(value(await service.listResources({}, signal()))).toMatchObject({ items: [], completeness: 'partial' })
  expect(await service.readResource({ ref }, signal())).toMatchObject({ ok: false, error: { code: 'permission-denied' } })
  const staticGrant = await service.registerRoot({ id: 'static:a', path: a, domains: ['code'] })
  expect(staticGrant.rootId).toBe(workspace.rootId)
  expect(value(await service.listRoots({}, signal()))[0]?.domains).toEqual(['code'])
  expect(value(await service.readResource({ ref }, signal())).body).toMatchObject({ kind: 'text' })
  staticGrant.dispose()
  expect(await service.readResource({ ref }, signal())).toMatchObject({ ok: false, error: { code: 'permission-denied' } })
})

it('keeps same-named files in distinct roots and rejects root-ID aliasing to another directory', async () => {
  const { service, a, b } = await fixture()
  const first = await service.registerRoot({ id: 'a', path: a })
  const second = await service.registerRoot({ id: 'b', path: b })
  service.registerProvider(provider())
  const catalog = value(await service.listResources({ domain: 'knowledge' }, signal()))
  expect(catalog.items).toHaveLength(2)
  expect(new Set(catalog.items.map(item => item.id)).size).toBe(2)
  expect(bodyText(value(await service.readResource({ ref: { rootId: first.rootId, sourceId: sourceIdForPath('note.md') } }, signal())).body))
    .toContain('Alpha')
  expect(bodyText(value(await service.readResource({ ref: { rootId: second.rootId, sourceId: sourceIdForPath('note.md') } }, signal())).body))
    .toContain('Beta')
  await expect(service.registerRoot({ id: 'a', path: b })).rejects.toThrow('another directory')
})

it('delivers complete native PDF bytes beyond the inline and JSON bounds without changing the source', async () => {
  const { service, a } = await fixture({ maxResultCharacters: 1024 })
  const original = await readFile(new URL('../../research-literature/tests/fixtures/two-pages.pdf', import.meta.url))
  const bytes = paddedPdf(original, 1_048_576)
  const file = join(a, 'paper.pdf')
  await writeFile(file, bytes)
  const lease = await service.registerRoot({ id: 'native-pdf', path: a })
  const ref = { rootId: lease.rootId, sourceId: sourceIdForPath('paper.pdf') }
  const result = value(await service.readSourceBytes({ ref }, signal()))
  expect(result).toMatchObject({ ref, mediaType: 'application/pdf' })
  expect(Number.isFinite(Date.parse(result.observedAt))).toBe(true)
  expect(result.data).toBeInstanceOf(Uint8Array)
  expect(result.data.byteLength).toBeGreaterThan(1_048_576)
  expect(Buffer.from(result.data).equals(Buffer.from(bytes))).toBe(true)
  expect((await readFile(file)).equals(Buffer.from(bytes))).toBe(true)
  lease.dispose()
  expect(await service.readSourceBytes({ ref }, signal())).toMatchObject({ ok: false, error: { code: 'permission-denied' } })
})

it('rejects unsupported, escaped, missing, oversized and withdrawn native byte reads', async () => {
  const { service, a, b, ctx } = await fixture({ maxBinaryBytes: 64 })
  let authorized = true
  const lease = await service.registerRoot({ id: 'native-pdf-bounds', path: a, isAuthorized: () => authorized })
  const ref = { rootId: lease.rootId, sourceId: sourceIdForPath('paper.pdf') }
  const read = (path: string) => service.readSourceBytes({ ref: { ...ref, sourceId: sourceIdForPath(path) } }, signal())
  await writeFile(join(a, 'paper.pdf'), '%PDF-1.7\n' + 'x'.repeat(65))
  expect(await read('paper.pdf')).toMatchObject({ ok: false, error: { code: 'unavailable' } })
  await writeFile(join(a, 'paper.pdf'), '%PDF-1.7\n')
  await writeFile(join(a, 'wrong.pdf'), 'A text note renamed as PDF')
  await writeFile(join(b, 'outside.pdf'), '%PDF-1.7\n')
  await symlink(join(b, 'outside.pdf'), join(a, 'linked.pdf'))
  await mkdir(join(a, '.git'))
  await writeFile(join(a, '.git/hidden.pdf'), '%PDF-1.7\n')
  expect(await read('wrong.pdf')).toMatchObject({ ok: false, error: { code: 'unsupported' } })
  expect(await read('note.md')).toMatchObject({ ok: false, error: { code: 'unsupported' } })
  expect(await read('missing.pdf')).toMatchObject({ ok: false, error: { code: 'not-found' } })
  for (const path of ['linked.pdf', '.git/hidden.pdf']) {
    expect(await read(path)).toMatchObject({ ok: false, error: { code: 'permission-denied' } })
  }
  expect(await service.readSourceBytes({ ref: { ...ref, rootId: sourceRootId('unknown') } }, signal()))
    .toMatchObject({ ok: false, error: { code: 'permission-denied' } })
  for (const id of ['source:..%2Foutside.pdf', 'source:%2Foutside.pdf', 'draft:paper', 'source:%ZZ']) {
    expect(await service.readSourceBytes({ ref: { ...ref, sourceId: id as SourceId } }, signal()))
      .toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  }
  const caller = ctx.extend({ invocation: { peer: { principal: { kind: 'external-test-reader' } } } })
  await expect(caller.researchResources.readSourceBytes({ ref }, signal())).rejects.toThrow('Host owner')
  const cancelled = new AbortController()
  cancelled.abort()
  expect(await service.readSourceBytes({ ref }, cancelled.signal)).toMatchObject({ ok: false, error: { code: 'cancelled' } })
  authorized = false
  expect(await read('paper.pdf')).toMatchObject({ ok: false, error: { code: 'permission-denied' } })
})

it('opens guarded images as native image bodies and keeps bytes separate from text readings', async () => {
  const { service, a, b } = await fixture({ maxBinaryBytes: 128 })
  const lease = await service.registerRoot({ id: 'image-root', path: a })
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1AAAAABJRU5ErkJggg==', 'base64')
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'
  await writeFile(join(a, 'figure.PNG'), png)
  await writeFile(join(a, 'figure.svg'), svg)
  await writeFile(join(a, 'wrong.svg'), '<html><svg/></html>')
  await writeFile(join(a, 'wrong.png'), '<html>Not an image</html>')
  await writeFile(join(a, 'too-large.png'), Buffer.concat([png, Buffer.alloc(128)]))
  await writeFile(join(b, 'outside.png'), png)
  await symlink(join(b, 'outside.png'), join(a, 'linked.png'))
  const ref = (path: string) => ({ rootId: lease.rootId, sourceId: sourceIdForPath(path) })
  for (const [path, mediaType] of [['figure.PNG', 'image/png'], ['figure.svg', 'image/svg+xml']]) {
    if (path === undefined || mediaType === undefined) throw new Error('Missing fixture identity')
    const source = ref(path)
    const reading = value(await service.readResource({ ref: source }, signal()))
    expect(reading.body).toEqual({ kind: 'image', mediaType })
    expect(reading.resource).toMatchObject({ ref: source, title: path, kind: 'data', metadata: {} })
    // Opening this exact image does not scan siblings or diagnose their symlinks.
    expect(reading.issues).toEqual([])
    const bytes = value(await service.readSourceBytes({ ref: source }, signal()))
    expect(bytes.mediaType).toBe(mediaType)
    expect(Buffer.from(bytes.data).equals(await readFile(join(a, path)))).toBe(true)
  }
  for (const [path, code] of [['wrong.svg', 'unsupported'], ['wrong.png', 'unsupported'],
    ['too-large.png', 'unavailable'], ['linked.png', 'permission-denied']]) {
    if (path === undefined) throw new Error('Missing rejected fixture path')
    expect(await service.readResource({ ref: ref(path) }, signal())).toMatchObject({ ok: false, error: { code } })
    expect(await service.readSourceBytes({ ref: ref(path) }, signal())).toMatchObject({ ok: false, error: { code } })
  }
  expect(await readFile(join(a, 'figure.PNG'))).toEqual(png)
  expect(await readFile(join(a, 'figure.svg'), 'utf8')).toBe(svg)
})

it('resolves embedded Markdown images from unindexed notes without inventing knowledge entries or new root authority', async () => {
  const { service, a, b } = await fixture()
  const lease = await service.registerRoot({ id: 'images-and-notes', path: a })
  await mkdir(join(a, 'notes'))
  await mkdir(join(a, 'figures'))
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>'
  await writeFile(join(a, 'figures/图 1.svg'), svg)
  await writeFile(join(a, 'figures/literal%20name.svg'), svg)
  await writeFile(join(b, 'outside.svg'), svg)
  const text = '# Ordinary note\n\n![中文空格](<../figures/图 1.svg>)\n\n![Encoded][img]\n\n'
    + '![Literal percent](../figures/literal%2520name.svg)\n\n![Outside](../../b/outside.svg)\n\n'
    + '[Unknown note](../unindexed.md)\n\n[img]: ../figures/%E5%9B%BE%201.svg\n'
  await writeFile(join(a, 'notes/ordinary.md'), text)
  await writeFile(join(a, 'unindexed.md'), '# Unindexed\n\nThe existing explanation stays here.\n')
  const ref = { rootId: lease.rootId, sourceId: sourceIdForPath('notes/ordinary.md') }
  const reading = value(await service.readResource({ ref }, signal()))
  expect(reading.body).toEqual({ kind: 'text', format: 'markdown', text })
  expect(reading.resource).toMatchObject({ title: 'notes/ordinary.md', kind: 'note', metadata: {} })
  for (const label of ['中文空格', 'Encoded']) {
    expect(reading.resource.links.find(link => link.label === label)?.target)
      .toEqual({ rootId: lease.rootId, sourceId: sourceIdForPath('figures/图 1.svg') })
  }
  expect(reading.resource.links.find(link => link.label === 'Literal percent')?.target)
    .toEqual({ rootId: lease.rootId, sourceId: sourceIdForPath('figures/literal%20name.svg') })
  expect(reading.resource.links.find(link => link.label === 'Outside'))
    .toEqual({ label: 'Outside', href: '../../b/outside.svg' })
  const target = reading.resource.links.find(link => link.label === 'Unknown note')?.target
  if (target === undefined) throw new Error('The ordinary local Markdown link did not resolve')
  expect(value(await service.readResource({ ref: target }, signal())).body)
    .toEqual({ kind: 'text', format: 'markdown', text: '# Unindexed\n\nThe existing explanation stays here.\n' })
  expect(await readFile(join(a, 'notes/ordinary.md'), 'utf8')).toBe(text)
  lease.dispose()
  expect(await service.readSourceBytes({ ref: { ...ref, sourceId: sourceIdForPath('figures/图 1.svg') } }, signal()))
    .toMatchObject({ ok: false, error: { code: 'permission-denied' } })
})

it('resolves Markdown links in code-provider source files while leaving Git observations uninterpreted', async () => {
  const { service, a } = await fixture()
  const root = await service.registerRoot({ id: 'code-notes', path: a, domains: ['code'] })
  const text = '# Guide\n\n![Diagram](figure.svg)\n\n[Note](note.md)\n'
  await writeFile(join(a, 'README.markdown'), text)
  await writeFile(join(a, 'figure.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
  const ref = { rootId: root.rootId, sourceId: sourceIdForPath('README.markdown') }
  service.registerProvider({ id: 'code-documents', domain: 'code', list: async context => [{ ...row(context, 'README.markdown'),
    domain: 'code', providerId: 'code-documents' }], read: async () => ({ kind: 'text', format: 'code', text }) })
  const reading = value(await service.readResource({ ref, domain: 'code' }, signal()))
  expect(reading.body).toEqual({ kind: 'text', format: 'code', text })
  expect(reading.resource.links).toContainEqual({ label: 'Diagram', href: 'figure.svg',
    target: { rootId: root.rootId, sourceId: sourceIdForPath('figure.svg') } })
  expect(reading.resource.links).toContainEqual({ label: 'Note', href: 'note.md',
    target: { rootId: root.rootId, sourceId: sourceIdForPath('note.md') } })
  for (const view of ['diff', 'history'] as const) {
    const observation = value(await service.readResource({ ref, locator: { kind: 'git', view } }, signal()))
    expect(observation.resource.links).toEqual([])
  }
})

it('returns the requested library projection for a shared source and gives specialized locators their actual reader', async () => {
  const { service, a } = await fixture()
  const root = await service.registerRoot({ id: 'shared-library', path: a })
  const ref = { rootId: root.rootId, sourceId: sourceIdForPath('note.md') }
  service.registerProvider(provider(async context => [{ ...row(context, 'note.md'), title: 'Indexed research question',
    metadata: { entryKind: 'source-reading', review: 'awaiting' } }]))
  service.registerProvider({ id: 'paper-reading', domain: 'literature', list: async context => [{
    ...row(context, 'note.md'), title: 'Actual paper title', domain: 'literature', providerId: 'paper-reading',
    metadata: { authors: 'A. Author', year: '2026' },
  }], read: async (_context, _ref, locator) => locator?.kind === 'pdf-page'
    ? { kind: 'pdf', pageCount: 2, pages: [{ page: locator.page, text: 'Actual page text.' }] } : undefined })
  const codeRead = vi.fn<NonNullable<ResourceProvider['read']>>(async (_context, _ref, locator) => locator?.kind === 'code'
    ? { kind: 'text' as const, format: 'code' as const, text: 'exact line', startLine: locator.startLine, endLine: locator.endLine } : undefined)
  service.registerProvider({ id: 'code-reader', domain: 'code', list: async context => [{
    ...row(context, 'note.md'), domain: 'code', providerId: 'code-reader', metadata: { branch: 'main' },
  }], read: codeRead })
  const legacy = value(await service.readResource({ ref }, signal()))
  expect(legacy.resource).toMatchObject({ title: 'Indexed research question', domain: 'knowledge' })
  const literature = value(await service.readResource({ ref, domain: 'literature' }, signal()))
  expect(literature.resource).toMatchObject({ title: 'Actual paper title', domain: 'literature', metadata: { authors: 'A. Author', year: '2026' } })
  expect(literature.resource.metadata).not.toHaveProperty('entryKind')
  expect(literature.body).toEqual(legacy.body)
  codeRead.mockClear()
  const code = value(await service.readResource({ ref, locator: { kind: 'code', startLine: 1, endLine: 1 } }, signal()))
  expect(code.resource).toMatchObject({ domain: 'code', providerId: 'code-reader', metadata: { branch: 'main' } })
  expect(code.body).toMatchObject({ kind: 'text', format: 'code', text: 'exact line' })
  expect(codeRead).toHaveBeenCalledTimes(1)
  expect(value(await service.readResource({ ref, locator: { kind: 'pdf-page', page: 2 } }, signal())).resource.domain).toBe('literature')
  expect(await service.readResource({ ref, domain: 'knowledge', locator: { kind: 'code', startLine: 1, endLine: 1 } }, signal()))
    .toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  expect(await service.readResource({ ref, domain: 'code', locator: { kind: 'pdf-page', page: 1 } }, signal()))
    .toMatchObject({ ok: false, error: { code: 'invalid-request' } })
})

it('resolves bounded actual source links relative to their owner while retaining catalog provenance and current grants', async () => {
  const { service, a, b } = await fixture({ maxCatalogEntries: 2 })
  await mkdir(join(a, 'notes'))
  const text = '# Owner\n\n[Sibling](../note.md#alpha)\n[Other root](../../b/note.md#beta)\n[Omitted](third.md)\n'
  await writeFile(join(a, 'notes/owner.md'), text)
  const first = await service.registerRoot({ id: 'owner', path: a })
  const other = await service.registerRoot({ id: 'other', path: b })
  const ref = { rootId: first.rootId, sourceId: sourceIdForPath('notes/owner.md') }
  service.registerProvider(provider(async context => context.root.id === first.rootId ? [{ ...row(context, 'notes/owner.md'),
    links: [{ label: 'Original index row', href: '../note.md', target: { rootId: first.rootId, sourceId: sourceIdForPath('note.md') } }],
  }] : []))
  const reading = value(await service.readResource({ ref, domain: 'knowledge' }, signal()))
  expect(reading.resource.links).toEqual(expect.arrayContaining([
    expect.objectContaining({ label: 'Original index row' }),
    { label: 'Sibling', href: '../note.md#alpha', target: { rootId: first.rootId, sourceId: sourceIdForPath('note.md') }, locator: { kind: 'anchor', anchor: 'alpha' } },
    { label: 'Other root', href: '../../b/note.md#beta', target: { rootId: other.rootId, sourceId: sourceIdForPath('note.md') }, locator: { kind: 'anchor', anchor: 'beta' } },
  ]))
  expect(reading.resource.links.some(link => link.label === 'Omitted')).toBe(false)
  expect(reading.issues).toContain('The source-link preview reached its configured limit; remaining links are not included.')
  other.dispose()
  const withdrawn = value(await service.readResource({ ref, domain: 'knowledge' }, signal()))
  expect(withdrawn.resource.links.find(link => link.label === 'Other root')).toEqual({ label: 'Other root', href: '../../b/note.md#beta' })
  expect(await readFile(join(a, 'notes/owner.md'), 'utf8')).toBe(text)
})

it('keeps domain grants separate from read authority and exposes provider withdrawal instead of an empty library', async () => {
  const { service, a } = await fixture()
  await service.registerRoot({ id: 'a', path: a, domains: ['code'] })
  const list = vi.fn(async (context: SourceProviderContext) => context.paths.map(path => row(context, path)))
  const remove = service.registerProvider(provider(list))
  expect(value(await service.listResources({ domain: 'knowledge' }, signal())).items).toEqual([])
  expect(list).not.toHaveBeenCalled()
  remove()
  expect(await service.listResources({ domain: 'knowledge' }, signal())).toMatchObject({ ok: false, error: { code: 'unavailable' } })
})

it('resolves authored links only to registered roots and keeps parsing failures visibly partial', async () => {
  const { service, a, b } = await fixture()
  const first = await service.registerRoot({ id: 'a', path: a })
  const second = await service.registerRoot({ id: 'b', path: b })
  const targets: unknown[] = []
  service.registerProvider(provider(async (context) => {
    if (context.root.id === first.rootId) {
      targets.push(context.resolveLink('note.md', '../b/note.md#beta'))
      targets.push(context.resolveLink('note.md', '../missing/note.md'))
      targets.push(context.resolveLink('note.md', 'https://example.com/paper'))
      context.reportIssue('note.md', 'An authored support label remains unresolved.')
    }
    return context.paths.map(path => row(context, path))
  }))
  const catalog = value(await service.listResources({}, signal()))
  expect(targets).toContainEqual({ ref: { rootId: second.rootId, sourceId: sourceIdForPath('note.md') }, locator: { kind: 'anchor', anchor: 'beta' } })
  expect(targets.filter(target => target === undefined)).toHaveLength(2)
  expect(catalog.completeness).toBe('partial')
  expect(catalog.issues.some(issue => issue.reason.includes('support label'))).toBe(true)
})

it('refreshes cross-root link projections after a root is attached, withdrawn or loses current authority', async () => {
  const { service, a, b } = await fixture()
  const first = await service.registerRoot({ id: 'a', path: a })
  service.registerProvider(provider(async (context) => {
    const link = context.resolveLink('note.md', '../b/note.md')
    return context.root.id === first.rootId ? [{ ...row(context, 'note.md'),
      links: [{ label: 'Related note', href: '../b/note.md', ...(link === undefined ? {} : { target: link.ref }) }] }] : []
  }))
  const linkedRoot = async () => value(await service.listResources({ rootId: first.rootId }, signal())).items[0]?.links[0]?.target?.rootId
  expect(await linkedRoot()).toBeUndefined()
  let allowed = true
  const second = await service.registerRoot({ id: 'b', path: b, isAuthorized: () => allowed })
  expect(await linkedRoot()).toBe(second.rootId)
  allowed = false
  expect(await linkedRoot()).toBeUndefined()
  allowed = true
  expect(await linkedRoot()).toBe(second.rootId)
  second.dispose()
  expect(await linkedRoot()).toBeUndefined()
})

it('batch-resolves links with one authority observation and projects only explicit topic associations', async () => {
  const { service, a, b } = await fixture()
  const allowed = vi.fn(() => true)
  const first = await service.registerRoot({ id: 'a', path: a, isAuthorized: allowed })
  const second = await service.registerRoot({ id: 'b', path: b })
  const from = { rootId: first.rootId, sourceId: sourceIdForPath('note.md') }
  const target = { rootId: second.rootId, sourceId: sourceIdForPath('note.md') }
  allowed.mockClear()
  const links = await service.resolveLocalLinks({ links: [
    { from, href: '../b/note.md#beta' }, { from: target, href: '../a/note.md' }, { from, href: 'https://example.com/paper' },
  ] }, signal())
  expect(links).toEqual([{ ref: target, locator: { kind: 'anchor', anchor: 'beta' } }, { ref: from }, undefined])
  expect(allowed).toHaveBeenCalledTimes(1)
  service.registerProvider(provider())
  const workspaceId = 'explicit-owner' as WorkspaceId
  const topicId = 'topic:branch' as SourceTopicId
  const dispose = service.registerTopicAssociations({ id: 'explicit-owner-links', read: async () => [
    { ref: target, topic: { workspaceId, topicId, reason: 'The branch account explicitly uses this source.' } },
  ] })
  expect(value(await service.listResources({ topic: { workspaceId, topicId } }, signal())).items.map(item => item.ref)).toEqual([target])
  dispose()
  expect(value(await service.listResources({ topic: { workspaceId, topicId } }, signal())).items).toEqual([])
})

it('resolves only valid PDF page fragments while preserving other anchors and current root authority', async () => {
  const { service, a, b } = await fixture()
  const first = await service.registerRoot({ id: 'notes', path: a })
  let authorized = true
  const papers = await service.registerRoot({ id: 'papers', path: b, isAuthorized: () => authorized })
  const from = { rootId: first.rootId, sourceId: sourceIdForPath('note.md') }
  const path = '文献 乙.PDF'
  const href = `../b/${encodeURIComponent(path)}`
  const target = { rootId: papers.rootId, sourceId: sourceIdForPath(path) }
  for (const page of ['1', '2', '02', String(Number.MAX_SAFE_INTEGER)]) {
    expect(await service.resolveLocalLink({ from, href: `${href}#page=${page}` }, signal()))
      .toEqual({ ref: target, locator: { kind: 'pdf-page', page: Number(page) } })
  }
  for (const fragment of ['page=0', 'page=-1', 'page=1.5', 'page=2e0', 'page=', 'page=9007199254740992', 'page=2&zoom=100', 'named-destination']) {
    expect(await service.resolveLocalLink({ from, href: `${href}#${fragment}` }, signal()))
      .toEqual({ ref: target, locator: { kind: 'anchor', anchor: fragment } })
  }
  for (const anchor of ['page=2', '定义']) {
    expect(await service.resolveLocalLink({ from, href: `note.md#${encodeURIComponent(anchor)}` }, signal()))
      .toEqual({ ref: from, locator: { kind: 'anchor', anchor } })
  }
  for (const rejected of ['../missing/paper.pdf#page=2', 'https://example.com/paper.pdf#page=2', `${href}#page=%ZZ`]) {
    expect(await service.resolveLocalLink({ from, href: rejected }, signal())).toBeUndefined()
  }
  authorized = false
  expect(await service.resolveLocalLink({ from, href: `${href}#page=2` }, signal())).toBeUndefined()
})

it('keeps independent explicit associations when another contributor fails and removes a disposed in-flight contribution', async () => {
  const { service, a } = await fixture()
  const root = await service.registerRoot({ id: 'a', path: a })
  const alias = await service.registerRoot({ id: 'alias', path: a })
  service.registerProvider(provider())
  const topic = { workspaceId: 'research-owner' as WorkspaceId, topicId: 'topic:branch' as SourceTopicId, reason: 'An explicit source use.' }
  const ref = { rootId: root.rootId, sourceId: sourceIdForPath('note.md') }
  const dispose = service.registerTopicAssociations({ id: 'healthy-associations', read: async () => [
    { ref: { ...ref, rootId: sourceRootId('alias') }, topic }, { ref, topic },
  ] })
  const failed = service.registerTopicAssociations({ id: 'unavailable-owner', read: async () => { throw new Error('Owner unavailable') } })
  const partial = value(await service.listResources({ topic }, signal()))
  expect(partial.items).toHaveLength(1)
  expect(partial.items[0]?.topics).toEqual([topic])
  expect(partial.completeness).toBe('partial')
  expect(partial.issues.some(issue => issue.providerId === 'unavailable-owner')).toBe(true)
  failed()
  dispose()
  alias.dispose()
  let entered: (() => void) | undefined
  let finish: (() => void) | undefined
  const started = new Promise<void>((resolve) => { entered = resolve })
  const paused = new Promise<void>((resolve) => { finish = resolve })
  const remove = service.registerTopicAssociations({ id: 'removed-during-read', read: async () => {
    entered?.(); await paused; return [{ ref, topic }]
  } })
  const reading = service.listResources({ topic }, signal())
  await started
  remove()
  finish?.()
  expect(value(await reading)).toMatchObject({ items: [], completeness: 'complete' })
})

it('withdraws roots that lose authority while the explicit scientific relationship owner is being read', async () => {
  const { service, a } = await fixture()
  let allowed = true
  await service.registerRoot({ id: 'a', path: a, isAuthorized: () => allowed })
  service.registerProvider(provider())
  service.registerTopicAssociations({ id: 'revoking-owner', read: async () => { allowed = false; return [] } })
  const catalog = value(await service.listResources({}, signal()))
  expect(catalog.items).toEqual([])
  expect(catalog.completeness).toBe('partial')
})

it('keeps healthy owner relationships when one association provider reports an independent unreadable owner', async () => {
  const { service, a } = await fixture()
  const root = await service.registerRoot({ id: 'a', path: a })
  service.registerProvider(provider())
  const ref = { rootId: root.rootId, sourceId: sourceIdForPath('note.md') }
  const topic = { workspaceId: 'healthy-owner' as WorkspaceId, topicId: 'topic:healthy' as SourceTopicId, reason: 'An authored material use.' }
  service.registerTopicAssociations({ id: 'multi-owner-reader', read: async (_signal, reportIssue) => {
    reportIssue?.({ rootId: sourceRootId('unavailable-owner'), reason: 'The second research owner could not be read.' })
    return [{ ref, topic }]
  } })
  const page = value(await service.listResources({ topic }, signal()))
  expect(page.items.map(item => item.ref)).toEqual([ref])
  expect(page.completeness).toBe('partial')
  expect(page.issues).toContainEqual({ rootId: sourceRootId('unavailable-owner'), providerId: 'multi-owner-reader',
    reason: 'The second research owner could not be read.' })
})

it('never interprets a removed synthetic draft as an ordinary local file', async () => {
  const { service, a } = await fixture()
  await writeFile(join(a, 'draft:local'), 'THIS FILE IS NOT THE VIRTUAL DRAFT')
  const root = await service.registerRoot({ id: 'a', path: a })
  const ref = { rootId: root.rootId, sourceId: 'draft:local' as SourceId }
  let present = true
  const dispose = service.registerProvider({ id: 'synthetic-drafts', domain: 'knowledge',
    list: async context => present ? [{ ...row(context, 'note.md'), ref, providerId: 'synthetic-drafts' }] : [],
    read: async (_context, reference) => reference.sourceId === ref.sourceId && present
      ? { kind: 'text', format: 'markdown', text: 'The original provisional draft.' } : undefined,
  })
  expect(bodyText(value(await service.readResource({ ref }, signal())).body)).toBe('The original provisional draft.')
  present = false
  value(await service.refresh({}, signal()))
  const read = vi.spyOn(GuardedFiles.prototype, 'read')
  try {
    expect(await service.readResource({ ref }, signal())).toMatchObject({ ok: false, error: { code: 'not-found' } })
    expect(read).not.toHaveBeenCalled()
    dispose()
    expect(await service.readResource({ ref }, signal())).toMatchObject({ ok: false, error: { code: 'not-found' } })
    expect(read).not.toHaveBeenCalled()
  } finally { read.mockRestore() }
  expect(await readFile(join(a, 'draft:local'), 'utf8')).toBe('THIS FILE IS NOT THE VIRTUAL DRAFT')
})

it('refuses specialized locations without their reader and keeps ordinary text and anchor fallback', async () => {
  const { service, a } = await fixture()
  const root = await service.registerRoot({ id: 'a', path: a })
  const ref = { rootId: root.rootId, sourceId: sourceIdForPath('note.md') }
  const read = vi.spyOn(GuardedFiles.prototype, 'read')
  try {
    for (const locator of [{ kind: 'code', startLine: 1, endLine: 1 }, { kind: 'git', view: 'history' },
      { kind: 'pdf-page', page: 1 }] as const) {
      expect(await service.readResource({ ref, locator }, signal())).toMatchObject({ ok: false, error: { code: 'unsupported' } })
    }
    expect(read).not.toHaveBeenCalled()
    expect(value(await service.readResource({ ref, locator: { kind: 'text', start: 0, end: 7, quote: '# Alpha' } }, signal())).body)
      .toMatchObject({ kind: 'text' })
    expect(value(await service.readResource({ ref, locator: { kind: 'anchor', anchor: 'alpha' } }, signal())).body)
      .toMatchObject({ kind: 'text' })
    const remove = service.registerProvider(provider(async context => [{ ...row(context, 'note.md'),
      locator: { kind: 'code', startLine: 1, endLine: 1 } }]))
    expect(await service.readResource({ ref }, signal())).toMatchObject({ ok: false, error: { code: 'unsupported' } })
    remove()
    service.registerProvider(provider(async context => [{ ...row(context, 'note.md'),
      locator: { kind: 'text', start: 0, end: 7, quote: '# Omega' } }]))
    expect(await service.readResource({ ref }, signal())).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  } finally { read.mockRestore() }
})

it('derives an honest source summary only after a historical code reader supplies its immutable observation', async () => {
  const { service, a } = await fixture()
  const root = await service.registerRoot({ id: 'a', path: a })
  const ref = { rootId: root.rootId, sourceId: sourceIdForPath('deleted/solver.py') }
  const revision = '1'.repeat(40)
  let pinned = true
  service.registerProvider({ id: 'historical-code-reader', domain: 'code', list: async () => [], read: async () => ({
    kind: 'text', format: 'code', text: 'The reader supplied this archived source.',
    ...(pinned ? { revision } : {}), startLine: 2, endLine: 2,
  }) })
  const locator = { kind: 'code' as const, startLine: 2, endLine: 2, revision: 'original-branch' }
  const reading = value(await service.readResource({ ref, locator }, signal()))
  expect(reading.resource).toMatchObject({ ref, title: 'deleted/solver.py', kind: 'code', domain: 'code',
    providerId: 'historical-code-reader', topics: [], metadata: {} })
  expect(reading.locator).toEqual({ ...locator, revision })
  pinned = false
  expect(await service.readResource({ ref, locator }, signal())).toMatchObject({ ok: false, error: { code: 'unavailable' } })
  for (const path of ['deleted/.git/config', 'deleted/node_modules/library.js', '../outside.py']) {
    const invalid = `source:${encodeURIComponent(path)}` as SourceId
    expect(await service.readResource({ ref: { ...ref, sourceId: invalid }, locator }, signal()))
      .toMatchObject({ ok: false, error: { code: path.startsWith('..') ? 'invalid-request' : 'permission-denied' } })
  }
})

it('rejects a historical source path through a present symlink ancestor before asking its code reader', async () => {
  const { service, a, b } = await fixture()
  const root = await service.registerRoot({ id: 'a', path: a })
  await symlink(b, join(a, 'external'))
  const read = vi.fn(async () => undefined)
  service.registerProvider({ id: 'historical-code-reader', domain: 'code', list: async () => [], read })
  expect(await service.readResource({ ref: { rootId: root.rootId, sourceId: sourceIdForPath('external/deleted.py') },
    locator: { kind: 'code', startLine: 1, endLine: 1, revision: '1'.repeat(40) } }, signal()))
    .toMatchObject({ ok: false, error: { code: 'permission-denied' } })
  expect(read).not.toHaveBeenCalled()
})

it('opens an index pointer at its separately authorized research owner without copying its conclusion', async () => {
  const { service, a, b } = await fixture()
  const knowledge = await service.registerRoot({ id: 'knowledge', path: a, domains: ['knowledge'] })
  const research = await service.registerRoot({ id: 'research', path: b, domains: [] })
  const ref = { rootId: research.rootId, sourceId: sourceIdForPath('note.md') }
  service.registerProvider(provider(async context => context.root.id === knowledge.rootId ? [{
    ...row(context, 'note.md'), id: resourceEntryId(ref, 'index-row'), ref, title: 'Does the finite control settle the question?',
    metadata: { support: 'provisional', indexSource: 'note.md' },
  }] : []))
  expect(value(await service.listResources({ rootId: knowledge.rootId, domain: 'knowledge' }, signal())).items)
    .toMatchObject([{ ref, catalogRootId: knowledge.rootId }])
  const reading = value(await service.readResource({ ref }, signal()))
  expect(reading.resource.metadata.support).toBe('provisional')
  expect(bodyText(reading.body)).toContain('Different source')
})

it('tries the specialized reader when a knowledge pointer opens a paper and preserves read-time limitations', async () => {
  const { service, a } = await fixture()
  const root = await service.registerRoot({ id: 'a', path: a })
  const ref = { rootId: root.rootId, sourceId: 'paper:edition' as SourceId }
  service.registerProvider(provider(async context => [{ ...row(context, 'note.md'), ref }]))
  service.registerProvider({ id: 'pdf-reader', domain: 'literature', list: async () => [],
    read: async (context, reference) => {
      if (reference.sourceId !== ref.sourceId) return undefined
      context.reportIssue('paper.pdf', 'The selected edition has no printed-page mapping.')
      return { kind: 'pdf', pageCount: 1, pages: [{ page: 1, text: 'A condition preserved from the paper.' }] }
    },
  })
  const reading = value(await service.readResource({ ref, locator: { kind: 'pdf-page', page: 1 } }, signal()))
  expect(reading.body).toMatchObject({ kind: 'pdf', pages: [{ page: 1 }] })
  expect(reading.issues).toContain('paper.pdf: The selected edition has no printed-page mapping.')
})

it('omits optional embedded PDF bytes without a false preview failure and preserves actual reading issues', async () => {
  const { service, a } = await fixture({ maxResultCharacters: 1024 })
  const root = await service.registerRoot({ id: 'a', path: a })
  const ref = { rootId: root.rootId, sourceId: 'paper:edition' as SourceId }
  service.registerProvider({ id: 'pdf-reader', domain: 'literature',
    list: async context => [{ ...row(context, 'note.md'), ref, domain: 'literature', providerId: 'pdf-reader' }],
    read: async (context) => {
      context.reportIssue('paper.pdf', 'The selected edition has no printed-page mapping.')
      return { kind: 'pdf', pageCount: 1, pages: [{ page: 1, text: 'The complete selected page.' }], dataBase64: 'a'.repeat(2000) }
    },
  })
  const reading = value(await service.readResource({ ref }, signal()))
  expect(reading.body).toEqual({ kind: 'pdf', pageCount: 1, pages: [{ page: 1, text: 'The complete selected page.' }] })
  expect(reading.issues).toEqual(['paper.pdf: The selected edition has no printed-page mapping.'])
})

it('rejects traversal, internal files and symlink discovery and preserves the actual source on every read', async () => {
  const { service, a, b } = await fixture()
  const root = await service.registerRoot({ id: 'a', path: a })
  await mkdir(join(a, '.git'))
  await writeFile(join(a, '.git/config'), 'private git metadata')
  await symlink(join(b, 'note.md'), join(a, 'escape.md'))
  for (const sourceId of ['source:..%2Fb%2Fnote.md', sourceIdForPath('.git/config'), sourceIdForPath('escape.md')]) {
    const read = await service.readResource({ ref: { rootId: root.rootId, sourceId: sourceId as SourceId } }, signal())
    expect(read).toMatchObject({ ok: false })
  }
  expect(await readFile(join(a, 'note.md'), 'utf8')).toBe('# Alpha\n\nFinite-size evidence only.\n')
  expect(() => normalizedPath('../b/note.md')).toThrow(SourceError)
})

it('keeps a complete exact text selection or explicitly rejects its changed original', async () => {
  const { service, a } = await fixture()
  const root = await service.registerRoot({ id: 'a', path: a })
  const ref = { rootId: root.rootId, sourceId: sourceIdForPath('note.md') }
  const text = await readFile(join(a, 'note.md'), 'utf8')
  const start = text.indexOf('Finite-size')
  const locator = { kind: 'text' as const, start, end: start + 11, quote: 'Finite-size' }
  expect(value(await service.readResource({ ref, locator }, signal())).locator).toEqual(locator)
  await writeFile(join(a, 'note.md'), '# Alpha\n\nChanged condition.\n')
  expect(await service.readResource({ ref, locator }, signal())).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
})

it('validates exact selections against the full current text returned by a virtual-source provider', async () => {
  const { service, a } = await fixture()
  const root = await service.registerRoot({ id: 'drafts', path: a })
  const ref = { rootId: root.rootId, sourceId: 'draft:editable' as SourceId }
  let text = '# Draft\n\nThe original condition.\n'
  service.registerProvider({ id: 'editable-drafts', domain: 'knowledge', list: async context => [{
    ...row(context, 'note.md'), ref, title: 'Editable draft', providerId: 'editable-drafts',
  }], read: async () => ({ kind: 'text', format: 'markdown', text }) })
  const quote = 'The original condition.'
  const start = text.indexOf(quote)
  const locator = { kind: 'text' as const, start, end: start + quote.length, quote }
  const original = value(await service.readResource({ ref, locator }, signal()))
  expect(bodyText(original.body)).toBe(text)
  expect(original.locator).toEqual(locator)
  text = '# Draft\n\nThe revised condition.\n'
  expect(await service.readResource({ ref, locator }, signal())).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  expect(bodyText(value(await service.readResource({ ref }, signal())).body)).toBe(text)
})

it('validates virtual Markdown anchors without slicing or rewriting the provider observation', async () => {
  const { service, a } = await fixture()
  const root = await service.registerRoot({ id: 'drafts', path: a })
  const ref = { rootId: root.rootId, sourceId: 'draft:anchored' as SourceId }
  let text = '# Draft\n\n## Claim\n\nA provisional observation.\n'
  service.registerProvider({ id: 'anchored-drafts', domain: 'knowledge', list: async context => [{
    ...row(context, 'note.md'), ref, providerId: 'anchored-drafts',
  }], read: async () => ({ kind: 'text', format: 'markdown', text }) })
  const locator = { kind: 'anchor' as const, anchor: 'claim' }
  expect(bodyText(value(await service.readResource({ ref, locator }, signal())).body)).toBe(text)
  text = '# Draft\n\n## Changed claim\n\nA different observation.\n'
  expect(value(await service.readResource({ ref, locator }, signal())).body).toMatchObject({ kind: 'unavailable', reason: 'missing' })
  text = '# Draft\n\n## Claim\n\nFirst.\n\n## Claim\n\nSecond.\n'
  expect(value(await service.readResource({ ref, locator }, signal())).body).toMatchObject({ kind: 'unavailable', reason: 'ambiguous' })
})

it('retains a unique source anchor and makes missing or duplicate anchors explicit', async () => {
  const { service, a } = await fixture()
  const root = await service.registerRoot({ id: 'a', path: a })
  const ref = { rootId: root.rootId, sourceId: sourceIdForPath('note.md') }
  expect(value(await service.readResource({ ref, locator: { kind: 'anchor', anchor: 'alpha' } }, signal())).body).toMatchObject({ kind: 'text' })
  expect(value(await service.readResource({ ref, locator: { kind: 'anchor', anchor: 'absent' } }, signal())).body).toMatchObject({ kind: 'unavailable', reason: 'missing' })
  await writeFile(join(a, 'note.md'), '<a id="same"></a>\nFirst.\n<a id="same"></a>\nSecond.\n')
  expect(value(await service.readResource({ ref, locator: { kind: 'anchor', anchor: 'same' } }, signal())).body).toMatchObject({ kind: 'unavailable', reason: 'ambiguous' })
})

it('uses explicit topic associations, searches recorded metadata and expires cursors after refresh', async () => {
  const { service, a } = await fixture({ maxPageSize: 1 })
  await writeFile(join(a, 'other.md'), '# Other\n')
  await service.registerRoot({ id: 'a', path: a })
  const topic = { workspaceId: 'workspace' as WorkspaceId, topicId: 'topic:question' as SourceTopicId }
  service.registerProvider(provider(async context => context.paths.map(path => ({ ...row(context, path),
    metadata: { support: path === 'note.md' ? 'derived' : 'unchecked' }, topics: path === 'note.md' ? [{ ...topic, reason: 'A recorded finite-size control.' }] : [] }))))
  const first = value(await service.listResources({}, signal()))
  expect(first.nextCursor).not.toBeNull()
  expect(value(await service.listResources({ cursor: first.nextCursor! }, signal())).items).toHaveLength(1)
  expect(value(await service.search({ query: 'derived', topic }, signal())).items[0]?.title).toBe('note.md')
  value(await service.refresh({}, signal()))
  expect(await service.listResources({ cursor: first.nextCursor! }, signal())).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
})

it('reports incomplete discovery and oversized whole results rather than returning a convincing empty or truncated reading', async () => {
  const { service, a } = await fixture({ maxFiles: 1, maxResultCharacters: 1024 })
  await writeFile(join(a, 'second.md'), '# Second\n')
  await service.registerRoot({ id: 'a', path: a })
  service.registerProvider(provider())
  expect(value(await service.listResources({}, signal()))).toMatchObject({ completeness: 'partial' })
  await writeFile(join(a, 'note.md'), 'a'.repeat(2000))
  expect(await service.readResource({ ref: { rootId: sourceRootId('a'), sourceId: sourceIdForPath('note.md') } }, signal()))
    .toMatchObject({ ok: false, error: { code: 'unavailable' } })
})

it('rejects non-owner readers and source-set questions before starting any conversation', async () => {
  const { service, ctx, a } = await fixture({ maxSelections: 1 })
  const root = await service.registerRoot({ id: 'a', path: a })
  const caller = ctx.extend({ invocation: { peer: { principal: { kind: 'external-test-reader' } } } })
  await expect(caller.researchResources.listRoots({}, signal())).rejects.toThrow('Host owner')
  const handler = vi.fn(async () => ({ ok: false as const, error: { code: 'unsupported' as const, message: 'test', retryable: false } }))
  const remove = service.registerStudyHandler(handler)
  const ref = { rootId: root.rootId, sourceId: sourceIdForPath('note.md') }
  expect(await service.askStudy({ question: 'Too many?', selections: [{ ref }, { ref }] }, signal())).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  expect(handler).not.toHaveBeenCalled()
  const request = { sourceSetId: 'saved-set', question: 'What is the qualification?', selections: [{ ref }] }
  await service.askStudy(request, signal())
  expect(handler).toHaveBeenCalledWith(request, expect.any(AbortSignal))
  remove()
  expect(await service.askStudy(request, signal())).toMatchObject({ ok: false, error: { code: 'unsupported' } })
})

it('withdraws provider observations with its disposer and closes a follower on cancellation', async () => {
  const { service, a } = await fixture()
  await service.registerRoot({ id: 'a', path: a })
  const cancellation = new AbortController()
  const stream = service.follow({}, cancellation.signal)[Symbol.asyncIterator]()
  expect((await stream.next()).value).toMatchObject({ kind: 'resync-required' })
  const remove = service.registerProvider(provider())
  expect((await stream.next()).value).toMatchObject({ kind: 'resync-required' })
  expect((await stream.next()).value).toMatchObject({ kind: 'provider', connected: true })
  remove()
  expect((await stream.next()).value).toMatchObject({ kind: 'resync-required' })
  expect((await stream.next()).value).toMatchObject({ kind: 'provider', connected: false })
  const waiting = stream.next()
  cancellation.abort()
  await expect(waiting).rejects.toThrow()
})

it('keeps binary reads complete and bounded independently of text decoding', async () => {
  const { a } = await fixture()
  await writeFile(join(a, 'image.bin'), new Uint8Array([0xff, 0x00, 0x81]))
  const files = new GuardedFiles(a, 10, 2, 4)
  expect([...await files.readBytes('image.bin')]).toEqual([0xff, 0, 0x81])
  await expect(files.readBytes('image.bin', undefined, 2)).rejects.toThrow('byte limit')
  await expect(files.read('image.bin')).rejects.toThrow()
  await expect(files.readBytes('image.bin', AbortSignal.abort())).rejects.toThrow()
})

it('keeps project sources readable without listing them as shared libraries', async () => {
  const { service, a } = await fixture({ workspaceRootsInCatalog: false })
  const workspaceId = 'project' as WorkspaceId
  const project = await service.registerRoot({ id: 'project', path: a, workspaceId, grantKind: 'workspace-connection' })
  const host = await service.registerRoot({ id: 'project-memory', path: a, workspaceId, grantKind: 'host' })
  service.registerProvider(provider())
  const roots = value(await service.listRoots({}, signal()))
  expect(roots[0]?.domains).toEqual([])
  expect(value(await service.listResources({ domain: 'knowledge' }, signal())).items).toEqual([])
  expect(bodyText(value(await service.readResource({ ref: { rootId: project.rootId, sourceId: sourceIdForPath('note.md') } }, signal())).body))
    .toContain('Finite-size')
  host.dispose()
})

it('only builds catalog projections belonging to the requested root and domain', async () => {
  const { service, a, b } = await fixture()
  const code = await service.registerRoot({ id: 'code', path: a, domains: ['code'] })
  await service.registerRoot({ id: 'knowledge', path: b, domains: ['knowledge'] })
  const codeList = vi.fn(async (context: SourceProviderContext) => context.paths.map(path => ({ ...row(context, path), domain: 'code' as const, kind: 'code' as const })))
  const knowledgeList = vi.fn(async (context: SourceProviderContext) => context.paths.map(path => row(context, path)))
  service.registerProvider({ id: 'code', domain: 'code', list: codeList })
  service.registerProvider(provider(knowledgeList))
  expect(value(await service.listResources({ domain: 'code', rootId: code.rootId }, signal())).items).toHaveLength(1)
  expect(codeList).toHaveBeenCalledTimes(1)
  expect(knowledgeList).not.toHaveBeenCalled()
})

it('resolves an explicitly linked admitted collection as a catalog destination without inventing file content or topic membership', async () => {
  const f = await fixture()
  const source = await f.service.registerRoot({ id: 'owner', path: f.a, domains: ['knowledge'] })
  const collection = await f.service.registerRoot({ id: 'collection', path: f.b, domains: ['literature'] })
  const from = { rootId: source.rootId, sourceId: sourceIdForPath('note.md') }
  expect(await f.service.resolveLocalLink({ from, href: f.b }, signal())).toEqual({ ref: { rootId: collection.rootId, sourceId: 'collection:root' } })
  expect(await f.service.resolveLocalLink({ from, href: join(f.b, 'note.md') }, signal()))
    .toEqual({ ref: { rootId: collection.rootId, sourceId: sourceIdForPath('note.md') } })
  collection.dispose()
  expect(await f.service.resolveLocalLink({ from, href: f.b }, signal())).toBeUndefined()
})

it('finds an authored title by its actual filename and Chinese source path without changing the display title', async () => {
  const f = await fixture()
  await mkdir(join(f.a, '中文 空格'))
  await writeFile(join(f.a, '中文 空格/真实记录.md'), '# Original source\n')
  await f.service.registerRoot({ id: 'titles', path: f.a, domains: ['knowledge'] })
  f.service.registerProvider(provider(async context => context.paths.map(path => ({ ...row(context, path), title: 'Authored scientific title' }))))
  for (const query of ['note.md', '中文 空格/真实记录.md']) {
    const page = value(await f.service.listResources({ domain: 'knowledge', query }, signal()))
    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.title).toBe('Authored scientific title')
    expect(page.items[0]?.ref.sourceId).toBe(sourceIdForPath(query))
  }
})
