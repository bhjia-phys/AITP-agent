import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import * as atomic from '@deepseek-ai/dsh-atomic-write'
import { afterEach, expect, it, vi } from 'vitest'
import { StudyStore, type StudyStoreLimits } from '../src/store.ts'

const limits: StudyStoreLimits = { maxStateBytes: 200_000, maxArtifacts: 5, maxOperations: 10,
  maxArtifactCharacters: 20_000, maxTitleCharacters: 100, maxPageSize: 2, lockWaitMs: 1000 }
const cleanups: (() => Promise<unknown>)[] = []
afterEach(async () => { vi.restoreAllMocks(); for (const cleanup of cleanups.splice(0).reverse()) await cleanup() })
async function fixture(overrides: Partial<StudyStoreLimits> = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'research-study-store-'))
  cleanups.push(() => rm(directory, { recursive: true, force: true }))
  const store = new StudyStore(directory, { ...limits, ...overrides })
  cleanups.push(() => store.close())
  return { directory, store }
}
const draft = (title: string) => ({ title, kind: 'note' as const, markdown: `Exact note: ${title}`, citations: [] })

it('recovers stable save and removal receipts after restart, without duplicating drafts or rewriting their source identity', async () => {
  const f = await fixture()
  const saved = await f.store.save('save-one', 'original request', async () => draft('Question about A'))
  const first = await f.store.get(saved.id)
  await f.store.close()
  const restarted = new StudyStore(f.directory, limits)
  cleanups.push(() => restarted.close())
  expect(await restarted.save('save-one', 'original request', async () => { throw new Error('Original Session disappeared') })).toEqual(saved)
  expect(await restarted.list({})).toMatchObject({ items: [{ id: saved.id, origin: 'handwritten', savedBy: 'host-owner', status: 'provisional' }] })
  expect((await restarted.get(saved.id)).markdown).toBe(first.markdown)
  await expect(restarted.save('save-one', 'changed request', async () => draft('Different'))).rejects.toMatchObject({ failure: { code: 'conflict' } })
  const removed = await restarted.remove('remove-one', saved.id)
  expect(await restarted.remove('remove-one', saved.id)).toEqual(removed)
  expect(await restarted.save('save-one', 'original request', async () => draft('Must not resurrect'))).toEqual(saved)
  await expect(restarted.get(saved.id)).rejects.toMatchObject({ failure: { code: 'not-found' } })
  expect(await readdir(f.directory)).toEqual(['state.json'])
})

it('keeps writes serialized across independent store owners and does not reuse a cursor after a later save', async () => {
  const f = await fixture()
  const second = new StudyStore(f.directory, limits)
  cleanups.push(() => second.close())
  await Promise.all([f.store.save('one', 'one', async () => draft('One')), second.save('two', 'two', async () => draft('Two'))])
  const page = await f.store.list({ limit: 1 })
  expect(page.items).toHaveLength(1)
  expect(page.items[0]).not.toHaveProperty('markdown')
  expect(page.nextCursor).not.toBeNull()
  await f.store.save('three', 'three', async () => draft('Three'))
  await expect(f.store.list({ limit: 1, cursor: page.nextCursor ?? '' })).rejects.toThrow('list changed')
  expect((await f.store.catalog()).map(item => item.title).sort()).toEqual(['One', 'Three', 'Two'])
})

it('preserves unknown save identity and accepts the unchanged retry after a publication failure', async () => {
  const f = await fixture()
  vi.spyOn(atomic, 'writeFileAtomic').mockRejectedValueOnce(new Error('Filesystem publication failed'))
  await expect(f.store.save('retry-one', 'request one', async () => draft('Uncertain')))
    .rejects.toMatchObject({ failure: { code: 'unknown', operationId: 'retry-one', retryable: true } })
  const receipt = await f.store.save('retry-one', 'request one', async () => draft('Uncertain'))
  expect(await f.store.save('retry-one', 'request one', async () => draft('Must not replace'))).toEqual(receipt)
  expect((await f.store.catalog()).map(item => item.title)).toEqual(['Uncertain'])
})

it('rejects excess content and corrupt storage without discarding existing records', async () => {
  const f = await fixture({ maxArtifactCharacters: 800, maxOperations: 2 })
  await f.store.save('first', 'first', async () => draft('Keep'))
  const path = join(f.directory, 'state.json'), original = await readFile(path, 'utf8')
  await expect(f.store.save('too-big', 'large', async () => ({ ...draft('Large'), markdown: 'x'.repeat(1000) }))).rejects.toThrow()
  expect(await readFile(path, 'utf8')).toBe(original)
  await writeFile(path, '{ broken JSON')
  await expect(f.store.list({})).rejects.toThrow()
  expect(await readFile(path, 'utf8')).toBe('{ broken JSON')
  await expect(new StudyStore(undefined, limits).list({})).rejects.toMatchObject({ failure: { code: 'unsupported' } })
})
