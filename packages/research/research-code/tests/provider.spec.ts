import { Context } from '@deepseek-ai/cordis'
import ResearchResources, { sourceIdForPath } from '@deepseek-ai/dsh-research-resources'
import type { ResourceResult } from '@deepseek-ai/dsh-research-resources'
import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuardedFiles } from '@deepseek-ai/dsh-research-resources/files'
import { Config, createCodeProvider } from '../src/index.ts'
import { createCheckoutFixture } from './fixture.ts'

const cleanup: (() => Promise<unknown>)[] = []
afterEach(async () => { for (const dispose of cleanup.splice(0).reverse()) await dispose() })
const signal = (): AbortSignal => new AbortController().signal
function value<T>(result: ResourceResult<T>): T {
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

async function fixture(watchSources = true) {
  const checkout = await createCheckoutFixture()
  cleanup.push(checkout.dispose)
  const ctx = new Context()
  cleanup.push(() => ctx.fiber.dispose())
  const service = new ResearchResources(ctx, { watchSources })
  const root = await service.registerRoot({ id: 'checkout', path: checkout.root, domains: ['code'] })
  service.registerProvider(createCodeProvider(Config({ gitTimeoutMs: 5000 })))
  return { ...checkout, service, sourceRoot: root.rootId }
}

describe('checkout source readings', () => {
  it('retains the actual commit behind a movable revision and later reopens the same source', async () => {
    const { service, root, git, sourceRoot } = await fixture()
    const ref = { rootId: sourceRoot, sourceId: sourceIdForPath('model.py') }
    const first = value(await service.readResource({ ref, locator: { kind: 'code', startLine: 1, endLine: 1, revision: 'HEAD' } }, signal()))
    expect(first.body).toMatchObject({ kind: 'text', format: 'code', text: 'original condition\n', startLine: 1, endLine: 1 })
    if (first.locator?.kind !== 'code' || first.locator.revision === undefined) throw new Error('The observed commit was not retained.')
    expect(first.locator.revision).toMatch(/^[a-f0-9]{40,64}$/)
    expect(first.locator.revision).not.toBe('HEAD')
    await writeFile(join(root, 'model.py'), 'later condition\nsecond line\n')
    await git('add', 'model.py')
    await git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-qm', 'Later model')
    const reopened = value(await service.readResource({ ref, locator: first.locator }, signal()))
    expect(reopened.body).toMatchObject({ text: 'original condition\n', revision: first.locator.revision })
    expect(value(await service.readResource({ ref, locator: { kind: 'code', startLine: 1, endLine: 1 } }, signal())).body)
      .toMatchObject({ text: 'later condition\n', revision: 'working-tree' })
  })

  it('keeps staged and unstaged changes distinct and preserves exact line endings', async () => {
    const { service, root, git, sourceRoot } = await fixture()
    await writeFile(join(root, 'model.py'), 'staged condition\r\nsecond line\r\n')
    await git('add', 'model.py')
    await writeFile(join(root, 'model.py'), 'working condition\r\nsecond line\r\n')
    const index = await readFile(join(root, '.git/index'))
    const page = value(await service.listResources({ domain: 'code' }, signal()))
    const checkout = page.items.find(item => item.metadata.entryKind === 'checkout')
    if (checkout === undefined) throw new Error('The actual checkout was not listed.')
    const staged = value(await service.readResource({ ref: checkout.ref, locator: { kind: 'git', view: 'diff', scope: 'staged' } }, signal()))
    const working = value(await service.readResource({ ref: checkout.ref, locator: { kind: 'git', view: 'diff', scope: 'working-tree' } }, signal()))
    expect(staged.body.kind).toBe('text')
    expect(working.body.kind).toBe('text')
    if (staged.body.kind === 'text') expect(staged.body.text).toContain('+staged condition')
    if (working.body.kind === 'text') expect(working.body.text).toContain('+working condition')
    const ref = { rootId: sourceRoot, sourceId: sourceIdForPath('model.py') }
    expect(value(await service.readResource({ ref, locator: { kind: 'code', startLine: 2, endLine: 2 } }, signal())).body)
      .toMatchObject({ text: 'second line\r\n' })
    expect(value(await service.readResource({ ref, locator: { kind: 'code', startLine: 3, endLine: 3 } }, signal())).body)
      .toMatchObject({ kind: 'unavailable', reason: 'missing' })
    expect(await readFile(join(root, '.git/index'))).toEqual(index)
  })

  it('keeps a selected file inside its own Git diff and status rather than switching to another file or the whole checkout', async () => {
    const { service, root, git, sourceRoot } = await fixture()
    await writeFile(join(root, 'other.py'), 'original unrelated source\n')
    await git('add', 'other.py')
    await git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-qm', 'Other source')
    await writeFile(join(root, 'model.py'), 'selected A changed\n')
    await writeFile(join(root, 'other.py'), 'UNSELECTED_B_CONTENT\n')
    const ref = { rootId: sourceRoot, sourceId: sourceIdForPath('model.py') }
    for (const path of [undefined, 'model.py']) {
      const reading = value(await service.readResource({ ref, locator: { kind: 'git', view: 'diff',
        ...(path === undefined ? {} : { path }) } }, signal()))
      expect(reading.body).toMatchObject({ kind: 'text' })
      if (reading.body.kind !== 'text') throw new Error('The selected file diff is unavailable.')
      expect(reading.body.text).toContain('+selected A changed')
      expect(reading.body.text).not.toContain('UNSELECTED_B_CONTENT')
      expect(reading.body.text).not.toContain('other.py')
    }
    const escaped = value(await service.readResource({ ref, locator: { kind: 'git', view: 'diff', path: 'other.py' } }, signal()))
    expect(escaped.body).toMatchObject({ kind: 'unavailable', reason: 'unsupported' })
    const status = value(await service.readResource({ ref, locator: { kind: 'git', view: 'status' } }, signal()))
    if (status.body.kind !== 'text') throw new Error('The selected file status is unavailable.')
    expect(status.body.text).toContain('model.py')
    expect(status.body.text).not.toContain('other.py')
    const checkout = value(await service.listResources({ domain: 'code' }, signal())).items.find(item => item.metadata.entryKind === 'checkout')
    if (checkout === undefined) throw new Error('The explicit checkout source is unavailable.')
    const full = value(await service.readResource({ ref: checkout.ref, locator: { kind: 'git', view: 'diff' } }, signal()))
    if (full.body.kind !== 'text') throw new Error('The explicit checkout diff is unavailable.')
    expect(full.body.text).toContain('UNSELECTED_B_CONTENT')
  })

  it('does not attach an ignored historical revision to current checkout status or diffs', async () => {
    const { service, root, sourceRoot } = await fixture()
    await writeFile(join(root, 'model.py'), 'current modified condition\n')
    const ref = { rootId: sourceRoot, sourceId: sourceIdForPath('model.py') }
    for (const locator of [
      { kind: 'git' as const, view: 'status' as const, revision: 'HEAD' },
      { kind: 'git' as const, view: 'diff' as const, scope: 'working-tree' as const, revision: 'HEAD' },
      { kind: 'git' as const, view: 'diff' as const, scope: 'staged' as const, revision: 'HEAD' },
    ]) expect(value(await service.readResource({ ref, locator }, signal())).body)
      .toMatchObject({ kind: 'unavailable', reason: 'unsupported' })
    for (const locator of [
      { kind: 'git' as const, view: 'history' as const, revision: 'HEAD' },
      { kind: 'git' as const, view: 'diff' as const, scope: 'commit' as const, revision: 'HEAD' },
    ]) {
      const reading = value(await service.readResource({ ref, locator }, signal()))
      expect(reading.body.kind).toBe('text')
      expect(reading.locator?.kind === 'git' ? reading.locator.revision : undefined).toMatch(/^[a-f0-9]{40,64}$/)
    }
  })

  it('reads the exact historical blob after the working file and its latest committed entry were deleted', async () => {
    const { service, root, git, sourceRoot } = await fixture()
    const revision = (await git('rev-parse', 'HEAD')).stdout.trim()
    await rm(join(root, 'model.py'))
    await git('add', 'model.py')
    await git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-qm', 'Remove current model')
    const reading = value(await service.readResource({ ref: { rootId: sourceRoot, sourceId: sourceIdForPath('model.py') },
      locator: { kind: 'code', startLine: 1, endLine: 2, revision } }, signal()))
    expect(reading.body).toMatchObject({ kind: 'text', format: 'code', text: 'original condition\nsecond line\n', revision })
    expect(reading.locator).toEqual({ kind: 'code', startLine: 1, endLine: 2, revision })
    expect(reading.resource).toMatchObject({ domain: 'code', providerId: 'research-code', title: 'model.py' })
  })
})

it('lists only one chosen checkout directory with current Git status and without a recursive catalog scan', async () => {
  const { service, root, sourceRoot } = await fixture()
  await mkdir(join(root, 'src/nested'), { recursive: true })
  await writeFile(join(root, 'src/nested/deep.cpp'), 'int x;\n')
  await writeFile(join(root, 'model.py'), 'modified working copy\n')
  const scans = vi.spyOn(GuardedFiles.prototype, 'scan')
  try {
    const top = value(await service.listResources({ domain: 'code', rootId: sourceRoot, folder: '' }, signal()))
    expect(scans).not.toHaveBeenCalled()
    expect(top.items.find(item => item.title === 'src')?.metadata.entryKind).toBe('source-folder')
    expect(top.items.find(item => item.title === 'model.py')?.metadata.fileStatus).toContain('M')
    expect(top.items.some(item => item.title.includes('deep.cpp'))).toBe(false)
    expect(top.items.some(item => item.metadata.entryKind === 'checkout')).toBe(true)
    const nested = value(await service.listResources({ domain: 'code', rootId: sourceRoot, folder: 'src/nested' }, signal()))
    expect(nested.items.map(item => item.title)).toEqual(['src/nested/deep.cpp'])
    expect(await service.listResources({ domain: 'code', rootId: sourceRoot, folder: '../outside' }, signal()))
      .toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  } finally { scans.mockRestore() }
})

it('paginates one directory and rejects another folder cursor', async () => {
  const { service, root, sourceRoot } = await fixture(false)
  await mkdir(join(root, 'src'))
  await writeFile(join(root, 'a.cpp'), 'a\n')
  await writeFile(join(root, 'b.cpp'), 'b\n')
  const first = value(await service.listResources({ domain: 'code', rootId: sourceRoot, folder: '', limit: 2 }, signal()))
  expect(first.items).toHaveLength(2)
  expect(first.nextCursor).not.toBeNull()
  const cursor = first.nextCursor
  if (cursor === null) throw new Error('expected a next page')
  const second = value(await service.listResources({ domain: 'code', rootId: sourceRoot, folder: '', limit: 2,
    cursor }, signal()))
  expect(second.items.length).toBeGreaterThan(0)
  expect(await service.listResources({ domain: 'code', rootId: sourceRoot, folder: 'src', limit: 2,
    cursor }, signal())).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  await writeFile(join(root, '0.cpp'), 'new\n')
  expect(await service.listResources({ domain: 'code', rootId: sourceRoot, folder: '', limit: 2,
    cursor }, signal())).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
})

it.each(['checkout', 'worktree'])('invalidates a bounded %s observation after a Git-only commit', async (kind) => {
  const checkout = await createCheckoutFixture()
  cleanup.push(checkout.dispose)
  const path = kind === 'worktree' ? join(checkout.root, 'worktree') : checkout.root
  if (kind === 'worktree') await checkout.git('worktree', 'add', '-q', '-b', 'fixture-branch', path)
  await writeFile(join(path, 'model.py'), 'staged before observation\n')
  await checkout.git('-C', path, 'add', 'model.py')
  const ctx = new Context()
  cleanup.push(() => ctx.fiber.dispose())
  const service = new ResearchResources(ctx, { watchMode: 'bounded' })
  const root = await service.registerRoot({ id: 'checkout', path, domains: ['code'] })
  service.registerProvider(createCodeProvider(Config({ gitTimeoutMs: 5000 })))
  const before = value(await service.listResources({ domain: 'code', rootId: root.rootId, folder: '' }, signal()))
  const oldHead = before.items.find(item => item.metadata.entryKind === 'checkout')?.metadata.head
  const abort = new AbortController()
  const feed = service.follow({ rootId: root.rootId }, abort.signal)[Symbol.asyncIterator]()
  try {
    await feed.next()
    const event = feed.next()
    await checkout.git('-C', path, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-qm', 'Commit staged change')
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await expect(Promise.race([event, new Promise((_, reject) => { timer = setTimeout(() => { reject(new Error('No Git change event')) }, 5000) })]))
        .resolves.toMatchObject({ value: { kind: 'invalidated', rootId: root.rootId } })
    } finally { clearTimeout(timer) }
    const after = value(await service.listResources({ domain: 'code', rootId: root.rootId, folder: '' }, signal()))
    expect(after.items.find(item => item.metadata.entryKind === 'checkout')?.metadata.head).not.toBe(oldHead)
  } finally { abort.abort(); await feed.return?.(undefined) }
})

// Windows symlink creation commonly requires privileges unavailable to CI workers.
it.skipIf(process.platform === 'win32')('does not follow a symbolic link when browsing a checkout', async () => {
  const { service, root, sourceRoot } = await fixture()
  await symlink('/tmp', join(root, 'link'))
  const page = value(await service.listResources({ domain: 'code', rootId: sourceRoot, folder: '' }, signal()))
  expect(page.completeness).toBe('partial')
  expect(page.issues.some(issue => issue.reason.includes('Symbolic links'))).toBe(true)
  expect(await service.listResources({ domain: 'code', rootId: sourceRoot, folder: 'link' }, signal()))
    .toMatchObject({ ok: false, error: { code: 'permission-denied' } })
})
