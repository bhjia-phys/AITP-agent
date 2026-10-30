/** Account discovery follows authored questions, never a recursive material inventory. */
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { MarkdownFiles } from '../src/markdown-files.ts'
import { MarkdownWorkspace, resourceIdForPath, topicIdForPath } from '../src/markdown.ts'
import type { Result } from '../src/types.ts'

const roots: string[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})
function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  return result.value
}
async function fixture(files: Record<string, string>, maxFiles = 20) {
  const root = await mkdtemp(join(tmpdir(), 'aitp-account-discovery-'))
  roots.push(root)
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), text)
  }
  const onDirectories = vi.fn()
  return { root, onDirectories, workspace: new MarkdownWorkspace({ root, maxFiles,
    maxFileBytes: 20_000, maxContextCharacters: 20_000, discoveryExcludedDirectories: ['history'], onDirectories }) }
}

it('reads only accounts and immediate account directories despite ordinary files and linked run READMEs', async () => {
  const { workspace, onDirectories } = await fixture({
    'research.md': '# Project\n## Branches\n[Named](questions/one.md)\n',
    'questions/one.md': '# One\n## Materials\n[Run](../runs/README.md)\n[Analysis](../notes/result.md)\n',
    'runs/README.md': '# Run\n## Branches\n[Not an account declaration](nested/research.md)\n',
    'runs/nested/research.md': '# Hidden inside material tree\n',
    'notes/result.md': '# Result\n',
    'history/research.md': '# Historical question\n',
    ...Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`raw-${i}.txt`, 'raw data'])),
  }, 5)
  const scan = vi.spyOn(MarkdownFiles.prototype, 'scan')
  const listing = vi.spyOn(MarkdownFiles.prototype, 'listDirectory')
  const read = vi.spyOn(workspace, 'readSource')
  const page = value(await workspace.listTopics({})).value
  expect(page.completeness).toBe('complete')
  expect(page.items.map(item => item.value.title)).toEqual(['One'])
  expect(scan).not.toHaveBeenCalled()
  expect(listing.mock.calls.map(([path]) => path)).toEqual(['', 'questions'])
  expect(read.mock.calls.map(([id]) => id)).not.toContain(resourceIdForPath('runs/README.md'))
  expect(onDirectories).toHaveBeenLastCalledWith(['', 'questions'], false)
  expect(workspace.materialLinks().links.some(link => link.href === '../runs/README.md')).toBe(true)
})

it('finds unlinked immediate accounts with no root account but never infers parents from directories', async () => {
  const { workspace } = await fixture({
    'question/research.md': '# Question\n',
    'question/child/research.md': '# Child without declared parent\n',
    'assets/gap/research.md': '# Deep orphan\n',
  })
  const page = value(await workspace.listTopics({})).value
  expect(page.completeness).toBe('complete')
  expect(page.items.map(item => item.value.title).sort()).toEqual(['Child without declared parent', 'Question'])
  expect(page.items.every(item => item.value.parentId === null)).toBe(true)
  expect(value(await workspace.getTopic(topicIdForPath('assets/gap/research.md'))).value.title).toBe('Deep orphan')
  expect(value(await workspace.listTopics({})).value.completeness).toBe('partial')
})

it('keeps complete map scope and cursors while opening unlinked authorized materials on demand', async () => {
  const { workspace } = await fixture({
    'research.md': '# Project\n## Branches\n[A](a/research.md)\n[B](b/research.md)\n',
    'a/research.md': '# A\n', 'b/research.md': '# B\n',
    'assets/deep/README.md': '# Ordinary run\n## Branches\n[Old run](research.md)\n',
    'assets/deep/research.md': '# Old run\n',
    'assets/deep/model.py': 'x = 1\n',
    'history/research.md': '# Historical observation\n',
  })
  const before = value(await workspace.listTopics({ limit: 1 })).value
  expect(before.completeness).toBe('complete')
  const associations = workspace.materialLinks()
  for (const path of ['assets/deep/README.md', 'assets/deep/model.py', 'history/research.md']) {
    const resource = value(await workspace.getResource(resourceIdForPath(path))).value
    expect(resource.content?.kind).not.toBe('unavailable')
    expect(resource.ownerTopicId).toBeNull()
  }
  const after = value(await workspace.listTopics({ limit: 1, cursor: before.nextCursor! })).value
  expect(after.completeness).toBe('complete')
  expect(workspace.materialLinks()).toEqual(associations)
  expect(value(await workspace.listTopics({})).value.items).toHaveLength(2)
  expect(await workspace.getTopic(topicIdForPath('assets/deep/README.md'))).toMatchObject({ ok: false, error: { code: 'not-found' } })
})

it.skipIf(process.platform === 'win32')('rejects a declared symlink account and a selected symlink material without inventorying aliases', async () => {
  const { root, workspace } = await fixture({
    'research.md': '# Project\n## Branches\n[Alias](alias/research.md)\n',
    'real/research.md': '# Real\n', 'real/result.txt': 'evidence',
  })
  await symlink(join(root, 'real'), join(root, 'alias'))
  const status = value(await workspace.rebuild())
  expect(status.completeness).toBe('partial')
  expect(status.issues.some(issue => issue.path === 'alias/research.md')).toBe(true)
  expect(await workspace.getResource(resourceIdForPath('alias/result.txt'))).toMatchObject({ ok: false, error: { code: 'permission-denied' } })
})
