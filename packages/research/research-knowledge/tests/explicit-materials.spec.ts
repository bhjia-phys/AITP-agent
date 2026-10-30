/** Real domain projections over precise topic links, independent of workspace discovery. */
import { Context } from '@deepseek-ai/cordis'
import ResearchResources, { GuardedFiles, sourceIdForPath, sourceRootId } from '@deepseek-ai/dsh-research-resources'
import type { Config as ResourceConfig, ResourceProvider, ResourceResult, SourceTopicId, TopicAssociation } from '@deepseek-ai/dsh-research-resources'
import { Config as LiteratureConfig, createLiteratureProvider } from '@deepseek-ai/dsh-research-literature'
import { Config as CodeConfig, createCodeProvider } from '@deepseek-ai/dsh-research-code'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { Config, createKnowledgeProvider } from '../src/index.ts'

const cleanup: (() => Promise<unknown>)[] = []
afterEach(async () => { for (const dispose of cleanup.splice(0).reverse()) await dispose(); vi.restoreAllMocks() })
const signal = (): AbortSignal => new AbortController().signal
const topic: TopicAssociation = { workspaceId: 'workspace:physics' as TopicAssociation['workspaceId'],
  topicId: 'topic:branch-a' as SourceTopicId, reason: 'Explicit main-note reference.' }
const sibling = { ...topic, topicId: 'topic:branch-b' as SourceTopicId }
function value<T>(result: ResourceResult<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}
async function fixture(config: ResourceConfig = {}, permissionOnly = true) {
  const base = await mkdtemp(join(tmpdir(), 'explicit-materials-'))
  cleanup.push(() => rm(base, { recursive: true, force: true }))
  await mkdir(join(base, 'deep'))
  await writeFile(join(base, 'deep/proof.md'), '# Conditional proof\n\nOnly under A.\n\n[Archive](unselected.pdf)\n')
  await writeFile(join(base, 'deep/model.py'), 'first condition\nsecond condition\nthird condition\n')
  await writeFile(join(base, 'deep/result.json'), '{"scope":"finite-size"}\n')
  const pdf = await readFile(new URL('../../research-literature/tests/fixtures/two-pages.pdf', import.meta.url))
  await writeFile(join(base, 'deep/paper.pdf'), pdf)
  await writeFile(join(base, 'deep/unselected.pdf'), pdf)
  const ctx = new Context()
  cleanup.push(() => ctx.fiber.dispose())
  const service = new ResearchResources(ctx, { workspaceRootsInCatalog: false, watchSources: false, ...config })
  let allowed = true
  const root = await service.registerRoot({ id: 'physics', path: base, isAuthorized: () => allowed,
    ...permissionOnly ? { workspaceId: topic.workspaceId, grantKind: 'research-enrollment' as const } : {} })
  const ref = (path: string) => ({ rootId: root.rootId, sourceId: sourceIdForPath(path) })
  return { service, base, root, ref, revoke: () => { allowed = false } }
}
function domains(service: ResearchResources): void {
  service.registerProvider(createKnowledgeProvider(Config({})))
  service.registerProvider(createLiteratureProvider(LiteratureConfig({ primaryPdfOnly: true })))
  service.registerProvider(createCodeProvider(CodeConfig({})))
}
function gate() {
  let entered!: () => void
  let release!: () => void
  return { started: new Promise<void>((resolve) => { entered = resolve }),
    paused: new Promise<void>((resolve) => { release = resolve }), enter: () => { entered() }, finish: () => { release() } }
}

it('projects and opens linked PDFs, notes, code and saved inputs without scanning permission-only workspaces', async () => {
  const { service, ref } = await fixture()
  domains(service)
  const scan = vi.spyOn(GuardedFiles.prototype, 'scan')
  const files = ['deep/paper.pdf', 'deep/proof.md', 'deep/model.py', 'deep/result.json']
  service.registerTopicAssociations({ id: 'main-notes', read: async () => files.flatMap(path => [
    { ref: ref(path), topic }, { ref: ref(path), topic: sibling },
  ]) })
  expect(value(await service.listResources({}, signal())).items).toEqual([])
  const page = value(await service.listResources({ topic }, signal()))
  expect(new Set(page.items.map(item => item.ref.sourceId))).toEqual(new Set(files.map(sourceIdForPath)))
  expect(page.items.every(item => item.topics.length === 2)).toBe(true)
  expect(page.items.some(item => item.ref.sourceId === sourceIdForPath('deep/unselected.pdf'))).toBe(false)
  const knowledge = value(await service.listResources({ topic, domain: 'knowledge' }, signal()))
  expect(knowledge.items.map(item => item.title)).toEqual(['Conditional proof'])
  expect(knowledge.items[0]?.metadata.review).toBeUndefined()
  const paper = value(await service.readResource({ ref: ref('deep/paper.pdf'), locator: { kind: 'pdf-page', page: 2 } }, signal()))
  expect(paper.body).toMatchObject({ kind: 'pdf', pageCount: 2 })
  const note = value(await service.readResource({ ref: ref('deep/proof.md'), domain: 'knowledge' }, signal()))
  expect(note.body).toMatchObject({ kind: 'text', format: 'markdown' })
  const located = await service.resolveLocalLink({ from: ref('deep/proof.md'), href: 'model.py#L2-L3' }, signal())
  expect(located).toEqual({ ref: ref('deep/model.py'), locator: { kind: 'code', startLine: 2, endLine: 3 } })
  const code = value(await service.readResource(located!, signal()))
  expect(code.body).toMatchObject({ kind: 'text', format: 'code', text: 'second condition\nthird condition\n', startLine: 2 })
  expect(value(await service.listResources({}, signal())).items).toEqual([])
  expect(scan).not.toHaveBeenCalled()
})

it('keeps project uses separate from child uses while retaining a shared source in both scopes', async () => {
  const { service, ref } = await fixture()
  domains(service)
  const project: TopicAssociation = { workspaceId: topic.workspaceId, reason: 'Project account reference.' }
  service.registerTopicAssociations({ id: 'project-and-branch', read: async () => [
    { ref: ref('deep/paper.pdf'), topic: project }, { ref: ref('deep/proof.md'), topic: project },
    { ref: ref('deep/proof.md'), topic }, { ref: ref('deep/model.py'), topic },
  ] })
  const projectPage = value(await service.listResources({ topic: { workspaceId: topic.workspaceId } }, signal()))
  expect(new Set(projectPage.items.map(item => item.ref.sourceId)))
    .toEqual(new Set(['deep/paper.pdf', 'deep/proof.md'].map(sourceIdForPath)))
  const branchPage = value(await service.listResources({ topic }, signal()))
  expect(new Set(branchPage.items.map(item => item.ref.sourceId)))
    .toEqual(new Set(['deep/proof.md', 'deep/model.py'].map(sourceIdForPath)))
  expect(projectPage.items.find(item => item.ref.sourceId === sourceIdForPath('deep/proof.md'))?.topics)
    .toEqual([project, topic])
  expect(value(await service.listResources({}, signal())).items).toEqual([])
  expect(value(await service.listResources({ topic: { workspaceId: 'other' as TopicAssociation['workspaceId'] } }, signal())).items).toEqual([])
})

it('does not turn a paper archive into code and reports explicitly admitted code archives as unsupported previews', async () => {
  const { service, base, ref } = await fixture()
  domains(service)
  await writeFile(join(base, 'deep/paper-source.zip'), new Uint8Array([80, 75, 0, 255]))
  await mkdir(join(base, 'code-bundles'))
  await writeFile(join(base, 'code-bundles/reproduction.zip'), new Uint8Array([80, 75, 0, 255]))
  const bundleRoot = await service.registerRoot({ id: 'code-bundles', path: join(base, 'code-bundles'), domains: ['code'] })
  const bundle = { rootId: bundleRoot.rootId, sourceId: sourceIdForPath('reproduction.zip') }
  service.registerTopicAssociations({ id: 'archives', read: async () => [
    { ref: ref('deep/paper-source.zip'), topic }, { ref: bundle, topic },
  ] })
  const page = value(await service.listResources({ topic, domain: 'code' }, signal()))
  expect(page.items.some(item => item.ref.sourceId === ref('deep/paper-source.zip').sourceId)).toBe(false)
  expect(page.issues.some(issue => issue.rootId === ref('deep/paper-source.zip').rootId
    && issue.path === 'deep/paper-source.zip')).toBe(true)
  expect(page.items.some(item => item.ref.rootId === bundle.rootId && item.ref.sourceId === bundle.sourceId)).toBe(true)
  const archive = value(await service.readResource({ ref: bundle, domain: 'code' }, signal()))
  expect(archive.body).toMatchObject({ kind: 'unavailable', reason: 'unsupported' })
})

it('finds an explicit file beyond exhausted discovery and retains the partial discovery warning', async () => {
  const { service, ref } = await fixture({ maxFiles: 1 }, false)
  domains(service)
  service.registerTopicAssociations({ id: 'selected', read: async () => [{ ref: ref('deep/paper.pdf'), topic }] })
  const page = value(await service.listResources({ topic, domain: 'literature' }, signal()))
  expect(page.items.map(item => item.ref)).toEqual([ref('deep/paper.pdf')])
  expect(page.completeness).toBe('partial')
  expect(page.issues.some(issue => /limit|bound/.test(issue.reason))).toBe(true)
})

it('bounds explicit sources and reports missing, symlink, directory and unsupported material without following their children', async () => {
  const { service, base, ref } = await fixture({ maxCatalogEntries: 8 })
  domains(service)
  await symlink(join(base, 'deep/proof.md'), join(base, 'deep/alias.md'))
  await writeFile(join(base, 'deep/plot.png'), 'not opened for projection')
  service.registerTopicAssociations({ id: 'incomplete', read: async () => [
    'deep/missing.md', 'deep/alias.md', 'deep', 'deep/plot.png', 'deep/proof.md',
  ].map(path => ({ ref: ref(path), topic })) })
  const page = value(await service.listResources({ topic }, signal()))
  expect(new Set(page.items.map(item => item.ref.sourceId))).toEqual(new Set([sourceIdForPath('deep/proof.md')]))
  expect(page.completeness).toBe('partial')
  expect(page.issues.some(issue => /not an accessible regular file/.test(issue.reason))).toBe(true)
  expect(page.issues.some(issue => /No connected library/.test(issue.reason))).toBe(true)
  const bounded = await fixture({ maxCatalogEntries: 1 })
  domains(bounded.service)
  bounded.service.registerTopicAssociations({ id: 'bounded', read: async () => ['deep/paper.pdf', 'deep/model.py'].map(path => ({ ref: bounded.ref(path), topic })) })
  const limited = value(await bounded.service.listResources({ topic }, signal()))
  expect(limited.items).toHaveLength(1)
  expect(limited.issues.some(issue => /explicit topic-source limit/.test(issue.reason))).toBe(true)
})

it.each(['owner', 'provider', 'authority'] as const)('withdraws a %s removed while explicit projection is pending', async (removed) => {
  const { service, ref, revoke } = await fixture()
  const pending = gate()
  const knowledge = createKnowledgeProvider(Config({}))
  const project = knowledge.projectSources!.bind(knowledge)
  const unload = service.registerProvider({ ...knowledge, projectSources: async (context, signal) => {
    pending.enter(); await pending.paused; return project(context, signal)
  } })
  const owner = service.registerTopicAssociations({ id: 'owner', read: async () => [{ ref: ref('deep/proof.md'), topic }] })
  const result = service.listResources({ topic }, signal())
  await pending.started
  if (removed === 'owner') owner()
  else if (removed === 'provider') unload()
  else revoke()
  pending.finish()
  expect(value(await result).items).toEqual([])
})

it('cancels pending projection and ignores unknown roots without extending source authority', async () => {
  const { service, ref } = await fixture()
  const pending = gate()
  const knowledge = createKnowledgeProvider(Config({}))
  const project = vi.fn<NonNullable<ResourceProvider['projectSources']>>(async (context, signal) => {
    pending.enter(); await pending.paused; signal.throwIfAborted(); return knowledge.projectSources!(context, signal)
  })
  service.registerProvider({ ...knowledge, projectSources: project })
  const owner = service.registerTopicAssociations({ id: 'owner', read: async () => [{ ref: ref('deep/proof.md'), topic }] })
  const controller = new AbortController()
  const result = service.listResources({ topic }, controller.signal)
  await pending.started
  controller.abort()
  expect(await result).toMatchObject({ ok: false, error: { code: 'cancelled' } })
  pending.finish()
  owner()
  project.mockClear()
  service.registerTopicAssociations({ id: 'unknown', read: async () => [{ ref: { ...ref('deep/proof.md'), rootId: sourceRootId('unknown') }, topic }] })
  expect(value(await service.listResources({ topic }, signal())).items).toEqual([])
  expect(project).not.toHaveBeenCalled()
})

it('keeps Markdown fragments and colon-containing filenames literal while parsing valid code line anchors', async () => {
  const { service, ref } = await fixture()
  for (const [href, locator] of [
    ['model.py#L2', { kind: 'code', startLine: 2, endLine: 2 }],
    ['model.py#L0', { kind: 'anchor', anchor: 'L0' }],
    ['model.py#L3-L2', { kind: 'anchor', anchor: 'L3-L2' }],
    ['proof.md#L2', { kind: 'anchor', anchor: 'L2' }],
  ] as const) expect(await service.resolveLocalLink({ from: ref('deep/proof.md'), href }, signal())).toMatchObject({ locator })
  expect(await service.resolveLocalLink({ from: ref('deep/proof.md'), href: './model.py:2' }, signal()))
    .toEqual({ ref: ref('deep/model.py:2') })
})
