/** Explicit no-watch mode reuses fresh bounded reads without allocating recursive watches. */
import { EventEmitter } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import ResearchResources, { resourceEntryId, sourceIdForPath } from '../src/index.ts'

const watchMock = vi.hoisted(() => vi.fn(() => Object.assign(new EventEmitter(), { close: vi.fn() })))
vi.mock('node:fs', async original => ({ ...await original<typeof import('node:fs')>(), watch: watchMock }))

it('omits recursive watches and rediscovers externally changed files on the next read', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aitp-no-watch-'))
  const ctx = new Context()
  try {
    await writeFile(join(root, 'first.md'), '# First\n')
    const service = new ResearchResources(ctx, { watchSources: false })
    await service.registerRoot({ id: 'library', path: root })
    service.registerProvider({ id: 'test', domain: 'knowledge', list: async context => context.paths.map((path) => {
      const ref = { rootId: context.root.id, sourceId: sourceIdForPath(path) }
      return { id: resourceEntryId(ref), ref, title: path, kind: 'note', domain: 'knowledge', providerId: 'test',
        metadata: {}, links: [], topics: [] }
    }) })
    const list = () => service.listResources({ domain: 'knowledge' }, new AbortController().signal)
    const first = await list()
    expect(first.ok && first.value.items.map(item => item.title)).toEqual(['first.md'])
    expect(watchMock).not.toHaveBeenCalled()
    await writeFile(join(root, 'second.md'), '# Second\n')
    const second = await list()
    expect(second.ok && second.value.items.map(item => item.title)).toEqual(['first.md', 'second.md'])
    const firstPage = await service.listResources({ domain: 'knowledge', limit: 1 }, new AbortController().signal)
    if (!firstPage.ok || firstPage.value.nextCursor === null) throw new Error('The initial catalog did not have a second page')
    const cursor = firstPage.value.nextCursor
    expect(await service.listResources({ domain: 'knowledge', limit: 1, cursor }, new AbortController().signal))
      .toMatchObject({ ok: true, value: { items: [{ title: 'second.md' }] } })
    await writeFile(join(root, 'third.md'), '# Third\n')
    expect(await service.listResources({ domain: 'knowledge', limit: 1, cursor }, new AbortController().signal))
      .toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    const refreshed = await list()
    expect(refreshed.ok && refreshed.value.items.map(item => item.title)).toEqual(['first.md', 'second.md', 'third.md'])
    expect(watchMock).not.toHaveBeenCalled()
  } finally {
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

it('reports watcher failure with the source instead of pretending updates remain automatic', async () => {
  const { MATERIAL_WATCH_UNAVAILABLE } = await import('../src/protocol.ts')
  const root = await mkdtemp(join(tmpdir(), 'aitp-watch-failure-'))
  const ctx = new Context()
  watchMock.mockClear()
  try {
    await writeFile(join(root, 'note.md'), '# Still readable\n')
    const service = new ResearchResources(ctx, { watchMode: 'bounded' })
    const lease = await service.registerRoot({ id: 'root', path: root })
    await service.listResources({}, new AbortController().signal)
    const watcher: unknown = watchMock.mock.results[0]?.value as unknown
    if (!(watcher instanceof EventEmitter)) throw new Error('The bounded watcher was not registered')
    watcher.emit('error', new Error('Watch limit reached'))
    const result = await service.readResource({ ref: { rootId: lease.rootId, sourceId: sourceIdForPath('note.md') } }, new AbortController().signal)
    expect(result.ok && result.value.issues).toContain(MATERIAL_WATCH_UNAVAILABLE)
    expect(result.ok && result.value.body).toMatchObject({ kind: 'text', text: '# Still readable\n' })
  } finally { await ctx.fiber.dispose(); await rm(root, { recursive: true, force: true }) }
})
