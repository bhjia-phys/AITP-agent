/** Operational references survive real Host restarts without altering scientific directories. */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Context } from '@deepseek-ai/cordis'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { afterEach, expect, it } from 'vitest'
import ResearchResources, { type Config, resourceEntryId, sourceIdForPath, sourceRootId } from '../src/index.ts'
import type { ResourceResult, SaveSourceSetRequest, SourceTopicId } from '../src/types.ts'

const disposers: (() => Promise<unknown>)[] = []
afterEach(async () => { for (const dispose of disposers.splice(0).reverse()) await dispose() })
const signal = (): AbortSignal => new AbortController().signal
const workspaceId = 'registered-workspace' as WorkspaceId
function value<T>(result: ResourceResult<T>): T { if (!result.ok) throw new Error(result.error.message); return result.value }

async function fixture() {
  const base = await mkdtemp(join(tmpdir(), 'research-resource-state-'))
  disposers.push(() => rm(base, { recursive: true, force: true }))
  const source = join(base, 'sources')
  const other = join(base, 'other')
  const home = join(base, 'host-home')
  await mkdir(source)
  await mkdir(other)
  await writeFile(join(source, 'paper.md'), '# Original\n\nA bounded observation.\n')
  const authority = new Map([[workspaceId, source]])
  function boot(config: Config = {}, options: { home?: boolean; registry?: boolean; homePath?: string } = {}) {
    const ctx = new Context()
    disposers.push(() => ctx.fiber.dispose())
    if (options.home !== false) ctx.provide('dshHomePath', (...parts: string[]) => join(options.homePath ?? home, ...parts))
    if (options.registry !== false) ctx.provide('workspaceRegistry', {
      get: (id: WorkspaceId) => {
        const path = authority.get(id)
        return path === undefined ? undefined : { path, title: 'Actual research collection' }
      },
    } as never)
    const service = new ResearchResources(ctx, config)
    return { ctx, service }
  }
  return { base, source, other, home, authority, boot }
}

it('attaches only a selected existing Workspace, preserves source bytes, and restores read access after restart', async () => {
  const f = await fixture()
  const first = f.boot()
  const original = await readFile(join(f.source, 'paper.md'), 'utf8')
  expect(value(await first.service.listRoots({}, signal()))).toEqual([])
  expect(value(await first.service.getSetup({}, signal()))).toEqual({ canConnect: true, canSaveSourceSets: true })
  expect(await first.service.connectWorkspace({ workspaceId: 'unknown' as WorkspaceId }, signal()))
    .toMatchObject({ ok: false, error: { code: 'not-found' } })
  const connection = value(await first.service.connectWorkspace({ workspaceId, domains: ['literature'] }, signal()))
  const ref = { rootId: connection.rootId, sourceId: sourceIdForPath('paper.md') }
  expect(value(await first.service.readResource({ ref }, signal())).body).toMatchObject({ kind: 'text', text: original })
  expect(await readdir(f.source)).toEqual(['paper.md'])
  await first.ctx.fiber.dispose()
  const second = f.boot()
  expect(value(await second.service.listRoots({}, signal()))).toMatchObject([{ id: connection.rootId, title: 'Actual research collection', domains: ['literature'],
    grants: [{ kind: 'workspace-connection', workspaceId }] }])
  expect(value(await second.service.connectWorkspace({ workspaceId, domains: ['literature'] }, signal()))).toEqual(connection)
  expect(value(await second.service.readResource({ ref }, signal())).body).toMatchObject({ kind: 'text', text: original })
  expect(await readFile(join(f.source, 'paper.md'), 'utf8')).toBe(original)
  expect(await readdir(f.source)).toEqual(['paper.md'])
})

it('withdraws stale Workspace authority and disconnects its runtime grant without revoking independent grants', async () => {
  const f = await fixture()
  const first = f.boot()
  const connection = value(await first.service.connectWorkspace({ workspaceId }, signal()))
  const ref = { rootId: connection.rootId, sourceId: sourceIdForPath('paper.md') }
  f.authority.set(workspaceId, f.other)
  expect(await first.service.readResource({ ref }, signal())).toMatchObject({ ok: false, error: { code: 'permission-denied' } })
  await first.ctx.fiber.dispose()
  const second = f.boot({ roots: [{ id: 'configured-original', path: f.source, domains: ['knowledge'] }] })
  expect(value(await second.service.listRoots({}, signal()))).toMatchObject([{ id: sourceRootId('configured-original') }])
  expect(value(await second.service.disconnectWorkspace({ workspaceId }, signal()))).toEqual({ disconnected: true })
  const configured = { rootId: sourceRootId('configured-original'), sourceId: sourceIdForPath('paper.md') }
  expect(value(await second.service.readResource({ ref: configured }, signal())).body).toMatchObject({ kind: 'text' })
  const moved = value(await second.service.connectWorkspace({ workspaceId }, signal()))
  expect(moved.rootId).not.toBe(connection.rootId)
  f.authority.delete(workspaceId)
  expect(await second.service.readResource({ ref: { rootId: moved.rootId, sourceId: sourceIdForPath('missing.md') } }, signal()))
    .toMatchObject({ ok: false, error: { code: 'permission-denied' } })
  expect(value(await second.service.listRoots({}, signal()))).toHaveLength(1)
})

it('keeps a configured grant visible when the same canonical runtime connection is removed', async () => {
  const f = await fixture()
  const { service } = f.boot({ roots: [{ id: 'static', path: f.source }] })
  const connection = value(await service.connectWorkspace({ workspaceId }, signal()))
  expect(connection.rootId).toBe(sourceRootId('static'))
  expect(value(await service.listRoots({}, signal()))[0]?.grants?.map(grant => grant.kind)).toEqual(['configured', 'workspace-connection'])
  value(await service.disconnectWorkspace({ workspaceId }, signal()))
  expect(value(await service.listRoots({}, signal()))[0]?.grants).toEqual([{ kind: 'configured' }])
  expect(value(await service.readResource({ ref: { rootId: connection.rootId, sourceId: sourceIdForPath('paper.md') } }, signal())).body)
    .toMatchObject({ kind: 'text' })
})

it('retains the actual shared root identity after a configured grant is absent on restart', async () => {
  const f = await fixture()
  const first = f.boot({ roots: [{ id: 'initially-configured', path: f.source }] })
  const connection = value(await first.service.connectWorkspace({ workspaceId }, signal()))
  const ref = { rootId: connection.rootId, sourceId: sourceIdForPath('paper.md') }
  expect(ref.rootId).toBe(sourceRootId('initially-configured'))
  await first.ctx.fiber.dispose()
  const second = f.boot()
  expect(value(await second.service.listRoots({}, signal()))[0]?.id).toBe(ref.rootId)
  expect(value(await second.service.readResource({ ref }, signal())).body).toMatchObject({ kind: 'text' })
})

it('keeps saved references, explicit quotations and multiple actual topics across restart with exact retry receipts', async () => {
  const f = await fixture()
  const first = f.boot()
  const topics = [{ workspaceId, topicId: 'topic:a' as SourceTopicId }, { workspaceId, topicId: 'topic:b' as SourceTopicId }] as const
  const request: SaveSourceSetRequest = { operationId: 'saved-selection', title: 'Finite-size controls', topics,
    selections: [{ ref: { rootId: sourceRootId('missing-later'), sourceId: sourceIdForPath('paper.md') }, selectedText: 'A bounded observation.' }] }
  const receipt = value(await first.service.saveSourceSet(request, signal()))
  await first.ctx.fiber.dispose()
  const second = f.boot()
  expect(value(await second.service.saveSourceSet(request, signal()))).toEqual(receipt)
  const saved = value(await second.service.getSourceSet({ id: receipt.id }, signal()))
  expect(saved).toMatchObject({ title: request.title, topics, selections: request.selections })
  const listed = value(await second.service.listSourceSets({ topic: topics[1] }, signal()))
  expect(listed.items).toHaveLength(1)
  expect(listed.items[0]).not.toHaveProperty('selections')
  expect(JSON.stringify(listed)).not.toContain('A bounded observation.')
  expect(await second.service.saveSourceSet({ ...request, title: 'Different content' }, signal()))
    .toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  const removed = value(await second.service.removeSourceSet({ operationId: 'remove-selection', id: receipt.id }, signal()))
  expect(value(await second.service.removeSourceSet({ operationId: 'remove-selection', id: receipt.id }, signal()))).toEqual(removed)
  expect(value(await second.service.saveSourceSet(request, signal()))).toEqual(receipt)
  expect(await second.service.getSourceSet({ id: receipt.id }, signal())).toMatchObject({ ok: false, error: { code: 'not-found' } })
  expect(await readdir(f.source)).toEqual(['paper.md'])
})

it('projects explicitly saved topic selections into the catalog across restart and removes them when the set is removed', async () => {
  const f = await fixture()
  const config: Config = { roots: [{ id: 'catalog', path: f.source, domains: ['literature'] }] }
  const ref = { rootId: sourceRootId('catalog'), sourceId: sourceIdForPath('paper.md') }
  const topic = { workspaceId, topicId: 'topic:one' as SourceTopicId }
  const register = (service: ResearchResources): void => { service.registerProvider({ id: 'test-papers', domain: 'literature',
    list: async () => [{ id: resourceEntryId(ref), ref, title: 'Paper', kind: 'literature', domain: 'literature',
      providerId: 'test-papers', metadata: {}, links: [], topics: [] }] }) }
  const first = f.boot(config)
  register(first.service)
  const receipt = value(await first.service.saveSourceSet({ operationId: 'catalog-add', title: 'Selected papers', topics: [topic], selections: [{ ref }] }, signal()))
  expect(value(await first.service.listResources({ domain: 'literature', topic }, signal())).items).toHaveLength(1)
  await first.ctx.fiber.dispose()
  const second = f.boot(config)
  register(second.service)
  expect(value(await second.service.listResources({ domain: 'literature', topic }, signal())).items).toHaveLength(1)
  value(await second.service.removeSourceSet({ operationId: 'catalog-remove', id: receipt.id }, signal()))
  expect(value(await second.service.listResources({ domain: 'literature', topic }, signal())).items).toHaveLength(0)
  expect(await readFile(join(f.source, 'paper.md'), 'utf8')).toBe('# Original\n\nA bounded observation.\n')
})

it('restores saved reference sets while their Workspace authority is absent without restoring source access', async () => {
  const f = await fixture()
  const first = f.boot()
  const connected = value(await first.service.connectWorkspace({ workspaceId }, signal()))
  const selection = { ref: { rootId: connected.rootId, sourceId: sourceIdForPath('paper.md') }, selectedText: 'A bounded observation.' }
  const receipt = value(await first.service.saveSourceSet({ operationId: 'authority-is-separate', title: 'A retained reference',
    selections: [selection] }, signal()))
  f.authority.delete(workspaceId)
  await first.ctx.fiber.dispose()
  const second = f.boot()
  expect(value(await second.service.listRoots({}, signal()))).toEqual([])
  expect(value(await second.service.getSourceSet({ id: receipt.id }, signal())).selections).toEqual([selection])
  expect(await second.service.readResource({ ref: selection.ref }, signal())).toMatchObject({ ok: false, error: { code: 'permission-denied' } })
  f.authority.set(workspaceId, f.source)
  expect(value(await second.service.connectWorkspace({ workspaceId }, signal())).rootId).toBe(connected.rootId)
  expect(value(await second.service.readResource({ ref: selection.ref }, signal())).body).toMatchObject({ kind: 'text' })
  expect(await readdir(f.source)).toEqual(['paper.md'])
})

it('bounds saved quotations, complete UTF-8 store size, pagination and retry history without discarding prior sets', async () => {
  const f = await fixture()
  const { service } = f.boot({ maxSelectionCharacters: 12, maxStateOperations: 3, maxPageSize: 1 })
  const selection = { ref: { rootId: sourceRootId('retained'), sourceId: sourceIdForPath('paper.md') } }
  expect(await service.saveSourceSet({ operationId: 'too-long', title: 'A', selections: [{ ...selection, selectedText: 'x'.repeat(13) }] }, signal()))
    .toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  expect(await service.saveSourceSet({ operationId: 'bad-location', title: 'A', selections: [
    { ...selection, locator: { kind: 'code', startLine: 0, endLine: 1 } },
  ] }, signal())).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  const a = value(await service.saveSourceSet({ operationId: 'a', title: 'A', selections: [selection] }, signal()))
  value(await service.saveSourceSet({ operationId: 'b', title: 'B', selections: [selection] }, signal()))
  const page = value(await service.listSourceSets({}, signal()))
  expect(page.items).toHaveLength(1)
  expect(page.nextCursor).not.toBeNull()
  expect(value(await service.listSourceSets({ cursor: page.nextCursor ?? '' }, signal())).items).toHaveLength(1)
  value(await service.saveSourceSet({ operationId: 'c', id: a.id, title: 'A revised', selections: [selection] }, signal()))
  expect(await service.listSourceSets({ cursor: page.nextCursor ?? '' }, signal())).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  expect(await service.listSourceSets({ cursor: 'broken' }, signal())).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  expect(await service.saveSourceSet({ operationId: 'd', title: 'D', selections: [selection] }, signal()))
    .toMatchObject({ ok: false, error: { code: 'unavailable' } })
  expect(value(await service.getSourceSet({ id: a.id }, signal())).title).toBe('A revised')
  const small = f.boot({ maxStateBytes: 1024 }, { homePath: join(f.base, 'small-home') }).service
  expect(await small.saveSourceSet({ operationId: 'utf8', title: '多字节', selections: [{ ...selection, selectedText: '文'.repeat(200) }] }, signal()))
    .toMatchObject({ ok: false, error: { code: 'unavailable' } })
})

it('reports uncertain publication honestly and accepts an unchanged retry after the operational obstruction is removed', async () => {
  const f = await fixture()
  const { service } = f.boot()
  value(await service.getSetup({}, signal()))
  const target = join(f.home, 'research-resources', 'state.json')
  await mkdir(target, { recursive: true })
  const request: SaveSourceSetRequest = { operationId: 'publication', title: 'A review set', selections: [] }
  expect(await service.saveSourceSet(request, signal())).toMatchObject({ ok: false, error: { code: 'outcome-unknown', operationId: 'publication' } })
  await rm(target, { recursive: true })
  const receipt = value(await service.saveSourceSet(request, signal()))
  expect(value(await service.saveSourceSet(request, signal()))).toEqual(receipt)
})

it('preserves a corrupt existing store and rejects operational storage inside a selected scientific root', async () => {
  const f = await fixture()
  const target = join(f.home, 'research-resources', 'state.json')
  await mkdir(join(f.home, 'research-resources'), { recursive: true })
  await writeFile(target, '{interrupted old file')
  const { service } = f.boot()
  expect(await service.saveSourceSet({ operationId: 'replace', title: 'No replacement', selections: [] }, signal()))
    .toMatchObject({ ok: false, error: { code: 'unavailable' } })
  expect(await readFile(target, 'utf8')).toBe('{interrupted old file')
  const inside = f.boot({}, { homePath: join(f.source, 'runtime-home') }).service
  expect(await inside.connectWorkspace({ workspaceId }, signal())).toMatchObject({ ok: false, error: { code: 'permission-denied' } })
  expect(await readdir(f.source)).toEqual(['paper.md'])
})

it('reports missing operational capabilities and rejects external owners before any source-set mutation', async () => {
  const f = await fixture()
  const absent = f.boot({}, { home: false })
  expect(value(await absent.service.getSetup({}, signal()))).toEqual({ canConnect: false, canSaveSourceSets: false })
  expect(await absent.service.saveSourceSet({ operationId: 'unsupported', title: 'Absent', selections: [] }, signal()))
    .toMatchObject({ ok: false, error: { code: 'unsupported' } })
  const current = f.boot()
  const external = current.ctx.extend({ invocation: { peer: { principal: { kind: 'external-test-reader' } } } })
  await expect(external.researchResources.saveSourceSet({ operationId: 'forbidden', title: 'Forbidden', selections: [] }, signal()))
    .rejects.toThrow('Host owner')
  expect(await readdir(f.source)).toEqual(['paper.md'])
})
