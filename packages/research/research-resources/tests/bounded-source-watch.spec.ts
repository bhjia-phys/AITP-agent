/** Bounded real directory watching keeps active sources fresh without recursive traversal. */
import { mkdtemp, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { BoundedSourceWatcher, GuardedFiles } from '../src/files.ts'
import type { SourceProviderContext } from '../src/types.ts'

it('watches only observed directories and an explicitly opened deeper source, including atomic saves', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aitp-bounded-watch-'))
  const changed = vi.fn()
  let observer: BoundedSourceWatcher | undefined
  try {
    await mkdir(join(root, 'deep', 'extra'), { recursive: true })
    await writeFile(join(root, 'deep', 'extra', 'note.md'), '# Before\n')
    observer = new BoundedSourceWatcher(root, 20, changed)
    const scan = await new GuardedFiles(root, 1, 1024).scan()
    expect(scan.partial).toBe(true)
    observer.sync(scan.directories ?? [])
    expect(observer.count).toBe(1)
    observer.includeFile('deep/extra/note.md')
    expect(observer.count).toBe(3)
    await writeFile(join(root, 'deep', 'extra', 'note.tmp'), '# After\n')
    await rename(join(root, 'deep', 'extra', 'note.tmp'), join(root, 'deep', 'extra', 'note.md'))
    await vi.waitFor(() => { expect(changed).toHaveBeenCalled() }, { timeout: 3000 })
    const count = observer.count
    observer.close()
    expect(observer.count).toBe(0)
    expect(count).toBeGreaterThan(0)
  } finally { observer?.close(); await rm(root, { recursive: true, force: true }) }
})

it('replaces an obsolete watch before allocating a renamed directory at the limit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aitp-watch-rename-'))
  let observer: BoundedSourceWatcher | undefined
  try {
    await mkdir(join(root, 'old'))
    observer = new BoundedSourceWatcher(root, 2, () => {})
    observer.sync(['', 'old'])
    await rename(join(root, 'old'), join(root, 'new'))
    expect(() => observer?.sync(['', 'new'])).not.toThrow()
    expect(observer.count).toBe(2)
  } finally { observer?.close(); await rm(root, { recursive: true, force: true }) }
})

it('reattaches a watch when a discovered directory is replaced', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aitp-replaced-watch-'))
  const changed = vi.fn()
  let observer: BoundedSourceWatcher | undefined
  try {
    await mkdir(join(root, 'child'))
    observer = new BoundedSourceWatcher(root, 20, changed)
    observer.sync(['', 'child'])
    await rename(join(root, 'child'), join(root, 'old'))
    await mkdir(join(root, 'child'))
    observer.sync(['', 'child'])
    await vi.waitFor(() => { expect(changed).toHaveBeenCalled() }, { timeout: 3000 })
    changed.mockClear()
    await writeFile(join(root, 'child', 'note.md'), 'changed\n')
    await vi.waitFor(() => { expect(changed).toHaveBeenCalled() }, { timeout: 3000 })
  } finally { observer?.close(); await rm(root, { recursive: true, force: true }) }
})

it('reuses a watched catalog and refreshes after an external source change', async () => {
  const { Context } = await import('@deepseek-ai/cordis')
  const { default: ResearchResources, resourceEntryId, sourceIdForPath } = await import('../src/index.ts')
  const root = await mkdtemp(join(tmpdir(), 'aitp-watched-catalog-'))
  const ctx = new Context()
  const abort = new AbortController()
  try {
    await writeFile(join(root, 'note.md'), '# Before\n')
    const service = new ResearchResources(ctx, { watchMode: 'bounded' })
    const lease = await service.registerRoot({ id: 'root', path: root })
    const listProvider = vi.fn(async (context: SourceProviderContext) => context.paths.map((path: string) => {
      const ref = { rootId: context.root.id, sourceId: sourceIdForPath(path) }
      return { id: resourceEntryId(ref), ref, title: path, kind: 'note' as const, domain: 'knowledge' as const,
        providerId: 'test', metadata: {}, links: [], topics: [] }
    }))
    service.registerProvider({ id: 'test', domain: 'knowledge', list: listProvider })
    const first = await service.listResources({}, abort.signal)
    expect(first.ok).toBe(true)
    await service.listResources({}, abort.signal)
    expect(listProvider).toHaveBeenCalledTimes(1)
    const feed = service.follow({ rootId: lease.rootId }, abort.signal)[Symbol.asyncIterator]()
    await feed.next()
    const event = feed.next()
    await writeFile(join(root, 'second.md'), '# Second\n')
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      await expect(Promise.race([event, new Promise((_, reject) => { timeout = setTimeout(() => { reject(new Error('No change event')) }, 3000) })]))
        .resolves.toMatchObject({ value: { kind: 'invalidated', rootId: lease.rootId } })
    } finally { clearTimeout(timeout) }
    const second = await service.listResources({}, abort.signal)
    expect(second.ok && second.value.items.map(item => item.title)).toEqual(['note.md', 'second.md'])
    expect(listProvider).toHaveBeenCalledTimes(2)
    abort.abort()
    await feed.return?.(undefined)
  } finally { abort.abort(); await ctx.fiber.dispose(); await rm(root, { recursive: true, force: true }) }
})
