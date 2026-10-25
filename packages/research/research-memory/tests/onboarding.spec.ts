/** Owner onboarding uses private real filesystem roots and the production Host service. */
import { link, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { afterEach, expect, it, vi } from 'vitest'
import ResearchMemory, { type Config } from '../src/index.ts'
import { pathForResourceId, topicIdForPath } from '../src/markdown-files.ts'
import type { CreateTopicRequest, Result } from '../src/types.ts'
import * as onboardingFiles from '../src/onboarding-files.ts'
import { MarkdownWorkspace } from '../src/markdown.ts'
import { ResearchOnboarding } from '../src/onboarding.ts'
import { ScratchWriter } from '../src/writer.ts'

const disposers: (() => Promise<unknown>)[] = []
afterEach(async () => { vi.restoreAllMocks(); for (const dispose of disposers.splice(0).reverse()) await dispose() })
const workspaceId = 'onboarding-workspace' as WorkspaceId
const signal = (): AbortSignal => new AbortController().signal
function unwrap<T>(result: Result<T>): T { if (!result.ok) throw new Error(result.error.message); return result.value }
const request = (operationId: string): CreateTopicRequest => ({ operationId, title: 'Finite-size bound', question: 'Does the finite-size bound hold?', scope: 'Finite N under assumption A.' })

async function fixture() {
  const temporary = await mkdtemp(join(tmpdir(), 'research-onboarding-'))
  disposers.push(() => rm(temporary, { recursive: true, force: true }))
  const root = join(temporary, 'sources')
  const home = join(temporary, 'app-home')
  await mkdir(root)
  const boot = async (config: Config = {}, options: { home?: boolean; registry?: boolean } = {}) => {
    const ctx = new Context()
    disposers.push(() => ctx.fiber.dispose())
    await mountAgentLoopTestDependencies(ctx)
    await ctx.plugin(TypertRegistry)
    if (options.home !== false) ctx.provide('dshHomePath', (...parts: string[]) => join(home, ...parts))
    if (options.registry !== false) ctx.provide('workspaceRegistry', { get: (id: WorkspaceId) => id === workspaceId ? { path: root } : undefined } as never)
    const plugin = await ctx.plugin(ResearchMemory, ResearchMemory.Config(config))
    return { service: ctx.researchMemory, ctx, disposeService: () => plugin.dispose() }
  }
  return { temporary, root, home, boot }
}

it('requires explicit access, then creates linked parent and child accounts with stable retry receipts across restart', async () => {
  const f = await fixture()
  const { service, ctx } = await f.boot()
  expect(await service.getSetup({ workspaceId })).toEqual({ ok: true, value: { configured: false, writable: false, canInitialize: true } })
  await expect(service.getProject({ workspaceId }, signal())).rejects.toThrow('not been configured')
  expect(await readdir(f.root)).toEqual([])
  expect(unwrap(await service.initialize({ workspaceId, writable: true })))
    .toEqual({ configured: true, writable: true, canInitialize: true })
  const original = await readFile(join(f.root, 'research.md'), 'utf8')
  const input = request('parent-create')
  const parent = unwrap(await service.createTopic({ workspaceId, ...input }))
  expect(unwrap(await service.getTopic({ workspaceId, topicId: parent.topicId }, signal())).value)
    .toMatchObject({ title: input.title, parentId: null, currentAnswer: null })
  const child = unwrap(await service.createTopic({ workspaceId, ...request('child-create'), title: 'Boundary control', parentTopicId: parent.topicId }))
  const detail = unwrap(await service.getTopic({ workspaceId, topicId: child.topicId }, signal())).value
  expect(detail).toMatchObject({ title: 'Boundary control', parentId: parent.topicId, accountResourceId: child.resourceId, currentAnswer: null })
  const children = unwrap(await service.listTopics({ workspaceId, query: { parentId: parent.topicId } }, signal())).value.items
  expect(children.map(item => item.value.id)).toEqual([child.topicId])
  const context = JSON.stringify(unwrap(await service.readContext({ workspaceId, query: { topicId: child.topicId, include: ['ancestors'] } }, signal())))
  expect(context).toContain(input.question)
  expect(context).toContain(input.scope)
  expect((await readFile(join(f.root, 'research.md'), 'utf8')).startsWith(original)).toBe(true)
  const beforeRetry = await readFile(join(f.root, 'research.md'), 'utf8')
  await ctx.fiber.dispose()
  const restarted = await f.boot()
  expect(unwrap(await restarted.service.getSetup({ workspaceId }))).toEqual({ configured: true, writable: true, canInitialize: true })
  expect(unwrap(await restarted.service.createTopic({ workspaceId, ...input }))).toEqual(parent)
  expect(await readFile(join(f.root, 'research.md'), 'utf8')).toBe(beforeRetry)
  expect(await restarted.service.createTopic({ workspaceId, ...input, title: 'Different request' })).toMatchObject({ ok: false, error: { code: 'operation-reused' } })
  expect(unwrap(await restarted.service.getResource({ workspaceId, resourceId: child.resourceId }, signal())).value.content.kind).toBe('markdown')
})

it('connects the owner setup feed without reading or enrolling scientific sources', async () => {
  const f = await fixture()
  const { service } = await f.boot()
  const rebuild = vi.spyOn(MarkdownWorkspace.prototype, 'rebuild')
  const read = vi.spyOn(MarkdownWorkspace.prototype, 'readSource')
  expect(await service.provider({ workspaceId }, signal())).toMatchObject({ capabilities: { read: false, applyChanges: false } })
  const lifetime = new AbortController()
  const feed = service.follow({ workspaceId }, lifetime.signal)[Symbol.asyncIterator]()
  try {
    expect((await feed.next()).value).toEqual({ kind: 'resync-required', reason: 'research-workspace-not-initialized' })
    expect(rebuild).not.toHaveBeenCalled()
    expect(read).not.toHaveBeenCalled()
    expect(await readdir(f.root)).toEqual([])
    expect(unwrap(await service.getSetup({ workspaceId })).configured).toBe(false)
    const next = feed.next()
    unwrap(await service.initialize({ workspaceId, writable: false }))
    expect((await next).value).toMatchObject({ kind: 'resync-required' })
  } finally { lifetime.abort(); await feed.return?.() }
})

it('enrolls read-only without creating sources, survives restart and enables saving only after an explicit upgrade', async () => {
  const f = await fixture()
  const first = await f.boot()
  expect(unwrap(await first.service.initialize({ workspaceId, writable: false })))
    .toEqual({ configured: true, writable: false, canInitialize: true })
  expect(await readdir(f.root)).toEqual([])
  expect(await first.service.createTopic({ workspaceId, ...request('read-only-create') })).toMatchObject({ ok: false, error: { code: 'read-only' } })
  await first.ctx.fiber.dispose()
  const restarted = await f.boot()
  expect(unwrap(await restarted.service.getSetup({ workspaceId })).writable).toBe(false)
  expect(unwrap(await restarted.service.getProject({ workspaceId }, signal())).value.accountResourceId).toBeUndefined()
  expect(unwrap(await restarted.service.initialize({ workspaceId, writable: true })).writable).toBe(true)
  expect(await readdir(f.root)).toEqual(['research.md'])
})

it('preserves existing root bytes and appends children without replacing existing parent text, including concurrent requests', async () => {
  const f = await fixture()
  const original = '\uFEFF# Authored project\r\n\r\nKeep this scientific account exactly.\r\n'
  await writeFile(join(f.root, 'research.md'), original)
  const { service } = await f.boot()
  unwrap(await service.initialize({ workspaceId, writable: true }))
  expect(await readFile(join(f.root, 'research.md'), 'utf8')).toBe(original)
  const results = await Promise.all([service.createTopic({ workspaceId, ...request('same-request') }), service.createTopic({ workspaceId, ...request('same-request') })])
  expect(results[0]).toEqual(results[1])
  unwrap(results[0])
  const [a, b] = await Promise.all([service.createTopic({ workspaceId, ...request('different-a') }), service.createTopic({ workspaceId, ...request('different-b') })])
  unwrap(a); unwrap(b)
  const after = await readFile(join(f.root, 'research.md'), 'utf8')
  expect(after.startsWith(original)).toBe(true)
  expect(after.match(/\[Finite-size bound\]/g)).toHaveLength(3)
  expect(after).toContain('\r\n## Child topics\r\n')
  expect(after.match(/## Child topics/g)).toHaveLength(1)
})

it('adds links to an existing topic directory without duplicating headings or changing later authored sections', async () => {
  const f = await fixture()
  const opening = '# Authored project\n\n## Topics\n\nAn existing list.\n\n'
  const later = '## Scientific account\n\nRetain the complete original argument.\n'
  await writeFile(join(f.root, 'research.md'), opening + later)
  const { service } = await f.boot()
  unwrap(await service.initialize({ workspaceId, writable: true }))
  unwrap(await service.createTopic({ workspaceId, ...request('listed-a') }))
  unwrap(await service.createTopic({ workspaceId, ...request('listed-b') }))
  const after = await readFile(join(f.root, 'research.md'), 'utf8')
  expect(after.startsWith(opening)).toBe(true)
  expect(after.endsWith(later)).toBe(true)
  expect(after.match(/## Topics/g)).toHaveLength(1)
  expect(after).not.toContain('## Child topics')
  expect(after.match(/\[Finite-size bound\]/g)).toHaveLength(2)
})

it('rechecks durable write authority for an existing writer after another Host revokes source writes', async () => {
  const f = await fixture()
  const a = await f.boot()
  unwrap(await a.service.initialize({ workspaceId, writable: true }))
  const receipt = unwrap(await a.service.createTopic({ workspaceId, ...request('authority-parent') }))
  const topic = unwrap(await a.service.getTopic({ workspaceId, topicId: receipt.topicId }, signal()))
  const preview = unwrap(await a.service.previewChange({ workspaceId, intent: { topicId: receipt.topicId,
    expectedRevision: topic.revision, command: { kind: 'update-scope', scope: 'Changed scope.' } } }))
  const original = await readFile(join(f.root, pathForResourceId(receipt.resourceId)), 'utf8')
  const b = await f.boot()
  unwrap(await b.service.initialize({ workspaceId, writable: false }))
  expect(unwrap(await a.service.getSetup({ workspaceId })).writable).toBe(false)
  expect(await a.service.provider({ workspaceId }, signal())).toMatchObject({ capabilities: { applyChanges: false } })
  expect(await a.service.applyChange({ workspaceId, request: { previewId: preview.value.previewId, operationId: 'revoked-apply' } })).toMatchObject({ ok: false, error: { code: 'read-only' } })
  expect(await readFile(join(f.root, pathForResourceId(receipt.resourceId)), 'utf8')).toBe(original)
})

it('rechecks a queued topic creation after an earlier source operation revokes saving on the same Host', async () => {
  const f = await fixture()
  const { service } = await f.boot()
  unwrap(await service.initialize({ workspaceId, writable: true }))
  unwrap(await service.createTopic({ workspaceId, ...request('before-revocation') }))
  let release: () => void = () => {}
  let entered: () => void = () => {}
  const gate = new Promise<void>((resolve) => { release = resolve })
  const started = new Promise<void>((resolve) => { entered = resolve })
  // oxlint-disable-next-line typescript/unbound-method -- The wrapper below restores the original receiver with call().
  const initialize = ResearchOnboarding.prototype.initialize
  vi.spyOn(ResearchOnboarding.prototype, 'initialize').mockImplementationOnce(async function (this: ResearchOnboarding, root, input) {
    entered(); await gate; return initialize.call(this, root, input)
  })
  const publications = vi.spyOn(ScratchWriter.prototype, 'serializeSources')
  const revoking = service.initialize({ workspaceId, writable: false })
  await started
  const creating = service.createTopic({ workspaceId, ...request('queued-after-revocation') })
  try { await vi.waitFor(() => { expect(publications).toHaveBeenCalledTimes(2) }) }
  finally { release() }
  unwrap(await revoking)
  expect(await creating).toMatchObject({ ok: false, error: { code: 'read-only' } })
  expect((await readdir(f.root)).filter(path => path.startsWith('topic-'))).toHaveLength(1)
})

it.each(['initialize', 'createTopic'] as const)('drains an admitted %s on plugin unload and rejects later onboarding admission', async (kind) => {
  const f = await fixture()
  const { service, disposeService } = await f.boot()
  if (kind === 'createTopic') unwrap(await service.initialize({ workspaceId, writable: true }))
  const feed = service.follow({ workspaceId }, signal())[Symbol.asyncIterator]()
  await feed.next()
  const feedStopped = feed.next()
  let release: () => void = () => {}
  let entered: () => void = () => {}
  const gate = new Promise<void>((resolve) => { release = resolve })
  const started = new Promise<void>((resolve) => { entered = resolve })
  // oxlint-disable-next-line typescript/unbound-method -- Each wrapper calls the original method with its original receiver.
  const initialize = ResearchOnboarding.prototype.initialize
  // oxlint-disable-next-line typescript/unbound-method -- Each wrapper calls the original method with its original receiver.
  const create = ResearchOnboarding.prototype.create
  if (kind === 'initialize') vi.spyOn(ResearchOnboarding.prototype, 'initialize')
    .mockImplementationOnce(async function (this: ResearchOnboarding, root, input) {
      entered(); await gate; return initialize.call(this, root, input)
    })
  else vi.spyOn(ResearchOnboarding.prototype, 'create')
    .mockImplementationOnce(async function (this: ResearchOnboarding, reader, directory, input) {
      entered(); await gate; return create.call(this, reader, directory, input)
    })
  const admitted = kind === 'initialize' ? service.initialize({ workspaceId, writable: true })
    : service.createTopic({ workspaceId, ...request('drained-create') })
  await started
  let disposed = false
  const disposing = disposeService().then(() => { disposed = true })
  try {
    // The live feed ends when the actual service disposer closes admission.
    expect((await feedStopped).done).toBe(true)
    expect(await service.initialize({ workspaceId, writable: false })).toMatchObject({ ok: false, error: { code: 'unavailable' } })
    expect(await service.createTopic({ workspaceId, ...request('after-stop') })).toMatchObject({ ok: false, error: { code: 'unavailable' } })
    expect(disposed).toBe(false)
  } finally { release() }
  expect((await admitted).ok).toBe(true)
  await disposing
  expect(disposed).toBe(true)
  expect(await readFile(join(f.root, 'research.md'), 'utf8')).toContain(kind === 'createTopic' ? 'Finite-size bound' : '## Topics')
  expect((await readdir(f.root)).filter(path => path.startsWith('topic-'))).toHaveLength(kind === 'createTopic' ? 1 : 0)
})

it('cannot broaden a configured read-only root or initialize for a non-owner or unregistered Workspace', async () => {
  const f = await fixture()
  const { service, ctx } = await f.boot({ roots: [{ path: f.root, writable: false }] })
  expect(unwrap(await service.getSetup({ workspaceId }))).toEqual({ configured: true, writable: false, canInitialize: false })
  expect(await service.initialize({ workspaceId, writable: true })).toMatchObject({ ok: false, error: { code: 'read-only' } })
  expect(await readdir(f.root)).toEqual([])
  const caller = ctx.extend({ invocation: { peer: { principal: { kind: 'external-onboarding-test' } } } })
  for (const call of [() => caller.researchMemory.getSetup({ workspaceId }), () => caller.researchMemory.initialize({ workspaceId, writable: true }), () => caller.researchMemory.createTopic({ workspaceId, ...request('external-create') })]) {
    await expect(call()).rejects.toThrow('available to the workspace owner')
  }
  const unregistered = await f.boot({}, { registry: false })
  await expect(unregistered.service.initialize({ workspaceId, writable: true })).rejects.toThrow('Workspace is unavailable')
  const noHome = await f.boot({}, { home: false })
  expect(unwrap(await noHome.service.getSetup({ workspaceId }))).toEqual({ configured: false, writable: false, canInitialize: false })
})

it.skipIf(process.platform === 'win32')('rejects symlinked and hardlinked accounts without modifying their targets', async () => {
  const f = await fixture()
  const outside = join(f.temporary, 'outside.md')
  await writeFile(outside, '# Outside\nKeep me.\n')
  await symlink(outside, join(f.root, 'research.md'))
  const { service } = await f.boot()
  expect(await service.initialize({ workspaceId, writable: true })).toMatchObject({ ok: false, error: { code: 'permission-denied' } })
  await rm(join(f.root, 'research.md'))
  await link(outside, join(f.root, 'research.md'))
  expect(await service.initialize({ workspaceId, writable: true })).toMatchObject({ ok: false, error: { code: 'permission-denied' } })
  expect(await readFile(outside, 'utf8')).toBe('# Outside\nKeep me.\n')
})

it('rejects unsafe requests and overlarge source accounts before creating directories', async () => {
  const f = await fixture()
  const { service } = await f.boot({ maxFileBytes: 256 })
  unwrap(await service.initialize({ workspaceId, writable: true }))
  for (const input of [{ ...request('../escape') }, { ...request('empty-question'), question: '' }, { ...request('bad-parent'), parentTopicId: topicIdForPath('absent/research.md') }, { ...request('too-large'), scope: 'X'.repeat(600) }]) {
    expect(await service.createTopic({ workspaceId, ...input })).toMatchObject({ ok: false })
  }
  expect(await readdir(f.root)).toEqual(['research.md'])
})

it('does not replay a creation whose durable receipt stopped before parent linkage', async () => {
  const f = await fixture()
  const { service, ctx } = await f.boot()
  unwrap(await service.initialize({ workspaceId, writable: true }))
  const input = request('interrupted-create')
  const receipt = unwrap(await service.createTopic({ workspaceId, ...input }))
  const sourceBefore = await readFile(join(f.root, 'research.md'), 'utf8')
  const enrollments = JSON.parse(await readFile(join(f.home, 'research-memory/enrollments.json'), 'utf8')) as { roots: { stateDirectory: string }[] }
  const operationPath = join(enrollments.roots[0]!.stateDirectory, 'onboarding', `${input.operationId}.json`)
  const operation = JSON.parse(await readFile(operationPath, 'utf8')) as { state: string }
  operation.state = 'published'
  await writeFile(operationPath, JSON.stringify(operation))
  await ctx.fiber.dispose()
  const restarted = await f.boot()
  expect(await restarted.service.createTopic({ workspaceId, ...input })).toMatchObject({ ok: false, error: { code: 'outcome-unknown', operationId: input.operationId } })
  expect(await readFile(join(f.root, 'research.md'), 'utf8')).toBe(sourceBefore)
  expect(await readFile(join(f.root, pathForResourceId(receipt.resourceId)), 'utf8')).toContain(input.question)
})

it.skipIf(process.platform === 'win32')('reports partial creation when the parent becomes a symlink before linking and never writes outside the root', async () => {
  const f = await fixture()
  const { service } = await f.boot()
  unwrap(await service.initialize({ workspaceId, writable: true }))
  const outside = join(f.temporary, 'outside.md')
  await writeFile(outside, '# Outside\nUntouched account.\n')
  const append = onboardingFiles.appendChild
  vi.spyOn(onboardingFiles, 'appendChild').mockImplementationOnce(async (root, path, child, maxBytes) => {
    await rename(path, join(f.root, 'original-root.md'))
    await symlink(outside, path)
    return append(root, path, child, maxBytes)
  })
  const input = request('changed-parent')
  const result = await service.createTopic({ workspaceId, ...input })
  expect(result).toMatchObject({ ok: false, error: { code: 'partial-apply', operationId: input.operationId, changed: [{ target: { kind: 'resource' } }] } })
  expect(await readFile(outside, 'utf8')).toBe('# Outside\nUntouched account.\n')
  expect((await readdir(f.root)).filter(path => path.startsWith('topic-'))).toHaveLength(1)
  expect(await service.createTopic({ workspaceId, ...input })).toEqual(result)
})
