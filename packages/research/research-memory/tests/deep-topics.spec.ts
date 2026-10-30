import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarkdownWorkspace, pathForResourceId, resourceIdForPath, topicIdForPath } from '../src/markdown.ts'
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

async function fixture(files: Record<string, string>, maxFiles = 2000) {
  const root = await mkdtemp(join(tmpdir(), 'research-deep-topics-'))
  roots.push(root)
  await Promise.all(Object.entries(files).map(async ([path, text]) => {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), text)
  }))
  return { root, workspace: new MarkdownWorkspace({ root, maxFiles, maxFileBytes: 20_000, maxContextCharacters: 20_000 }) }
}

const selected = 'parent/target/research.md'
const report = 'parent/target/notes/control.md'
const accounts = {
  'research.md': '# Project\n\nA bounded project.\n\n## Topics\n\n[Parent](parent/research.md)\n',
  'parent/research.md': '# Parent\n\nThe parent uses the target only under A.\n\n## Topics\n\n[Target](target/research.md)\n',
  [selected]: '# Target\n\nCan the finite control settle A?\n\n## Parent\n\n[Parent](../research.md)\n\n## Scope\n\nFinite systems only; no thermodynamic claim.\n\n## Materials\n\n[Control](notes/control.md)\n',
  [report]: '# Control\n\nThe exact bounded observation.\n',
}

function crowded(files: Record<string, string>): Record<string, string> {
  return { ...files, ...Object.fromEntries(Array.from({ length: 4 }, (_, index) => [`unrelated-${index}/research.md`, `# Other ${index}\n\nAn unrelated question.\n`])) }
}

describe('known source reads after partial discovery', () => {
  it('reads a linked account and material without charging ordinary file entries to account discovery', async () => {
    const files: Record<string, string> = { ...accounts }
    for (let index = 0; index < 100; index++) files[`unrelated-${String(index).padStart(4, '0')}/research.md`] = `# Other ${index}\n\nAn unrelated question.\n`
    const { root, workspace } = await fixture(files, 200)
    const initial = value(await workspace.rebuild())
    expect(initial.completeness).toBe('complete')
    const topicId = topicIdForPath(selected)
    const read = vi.spyOn(workspace, 'readSource')
    const rebuild = vi.spyOn(workspace, 'rebuild')
    expect(value(await workspace.getTopic(topicId)).value).toMatchObject({ title: 'Target', parentId: topicIdForPath('parent/research.md') })
    const context = value(await workspace.readContext({ topicId, include: ['ancestors', 'resources'] })).value
    expect(context.completeness).toBe('complete')
    expect(context.entries.map(entry => entry.text).join('\n')).toContain('The parent uses the target only under A.')
    expect(context.entries.map(entry => entry.text).join('\n')).toContain('The exact bounded observation.')
    expect(context.omissions).toEqual([])
    expect(value(await workspace.getResource(resourceIdForPath(report))).value.content).toEqual({ kind: 'markdown', text: accounts[report] })
    expect(value(await workspace.resolveOrigin({ topicId, resourceId: resourceIdForPath(report), question: 'What does this control establish?' }))).toMatchObject({ status: 'resolved', topicId })
    expect(rebuild).not.toHaveBeenCalled()
    expect(read.mock.calls.every(([resource]) => !pathForResourceId(resource).startsWith('unrelated-'))).toBe(true)
    expect(await readFile(join(root, selected), 'utf8')).toBe(accounts[selected])
  })

  it('retains ambiguity and requires an explicit material scope when incoming coverage is incomplete', async () => {
    const { workspace } = await fixture(crowded({ ...accounts,
      'other/research.md': '# Other owner\n\n## Materials\n\n[Shared](../parent/target/notes/control.md)\n',
    }), 8)
    value(await workspace.getTopic(topicIdForPath(selected)))
    expect(value(await workspace.getResource(resourceIdForPath(report))).value.ownerTopicId).toBeNull()
    const unscoped = value(await workspace.resolveOrigin({ resourceId: resourceIdForPath(report), question: 'Whose result is this?' }))
    expect(unscoped.status).toBe('ambiguous')
    expect(unscoped.reason).toContain('several topics')
    const unrelated = value(await workspace.resolveOrigin({ topicId: topicIdForPath(selected), resourceId: resourceIdForPath('other/research.md'), question: 'Can this retarget the scope?' }))
    expect(unrelated.status).toBe('ambiguous')
    expect(unrelated.candidateTopicIds).toEqual([topicIdForPath('other/research.md')])
  })

  it('recognizes a named account only through an authored relation, without deriving a parent from its directory', async () => {
    const named = 'parent/target/account.md'
    const { workspace } = await fixture(crowded({ ...accounts,
      [named]: '# Named branch\n\nA distinct research question.\n',
      'parent/README.md': '# Topic map\n\n## Topics\n\n[Named](target/account.md)\n',
      'parent/target/ordinary.md': '# Ordinary material\n\nThis is not a declared topic.\n',
    }), 12)
    const topic = value(await workspace.getTopic(topicIdForPath(named))).value
    expect(topic).toMatchObject({ title: 'Named branch', parentId: topicIdForPath('parent/research.md') })
    const context = value(await workspace.readContext({ topicId: topic.id, include: ['ancestors'] })).value
    expect(context.entries.map(entry => entry.text).join('\n')).toContain('The parent uses the target only under A.')
    expect(await workspace.getTopic(topicIdForPath('parent/target/ordinary.md'))).toMatchObject({ ok: false, error: { code: 'not-found' } })
    expect(await workspace.getTopic(topicIdForPath('parent/target/missing/research.md'))).toMatchObject({ ok: false, error: { code: 'not-found' } })
  })

  it('keeps an unchanged supplemented page cursor stable and invalidates it when a source changes', async () => {
    const selected = 'zz-unlinked/deep/research.md'
    const source = '# Unlinked question\n\n## Scope\n\nFinite systems only; no thermodynamic claim.\n'
    const { root, workspace } = await fixture(crowded({ ...accounts,
      [selected]: source,
      'a/research.md': '# A\n\nAn independent question.\n',
      'b/research.md': '# B\n\nAnother independent question.\n',
    }), 12)
    const before = value(await workspace.listTopics({ limit: 1 })).value.nextCursor
    expect(before).not.toBeNull()
    value(await workspace.getTopic(topicIdForPath(selected)))
    expect(await workspace.listTopics({ limit: 1, cursor: before! })).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    const stable = value(await workspace.listTopics({ limit: 1 })).value.nextCursor
    expect(stable).not.toBeNull()
    value(await workspace.getTopic(topicIdForPath(selected)))
    expect((await workspace.listTopics({ limit: 1, cursor: stable! })).ok).toBe(true)
    await writeFile(join(root, selected), source.replace('Finite systems only;', 'Finite N under A only;'))
    expect(value(await workspace.getTopic(topicIdForPath(selected))).value.scope).toContain('Finite N under A only;')
    expect(await workspace.listTopics({ limit: 1, cursor: stable! })).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    value(await workspace.refresh())
    expect(value(await workspace.readContext({ topicId: topicIdForPath(selected) })).value.entries.map(entry => entry.text).join('\n')).toContain('Finite N under A only;')
  })

  it.each([false, true])('preserves discovered hierarchy and ownership unless the selected source adds ambiguity (%s)', async (addsAmbiguity) => {
    const deep = 'z/target/research.md'
    const knownParent = topicIdForPath('a/research.md')
    const knownChild = topicIdForPath('a/child/research.md')
    const knownReport = resourceIdForPath('a/report.md')
    const { workspace } = await fixture(crowded({
      'research.md': '# Project\n\n## Topics\n\n[A](a/research.md)\n',
      'a/research.md': '# A\n\nA known question.\n\n## Topics\n\n[Child](child/research.md)\n\n## Materials\n\n[Report](report.md)\n',
      'a/child/research.md': '# Known child\n\nA known child question.\n',
      'a/report.md': '# Report\n\nA known observation.\n',
      [deep]: `# Deep\n\nAn independent selected question.\n${addsAmbiguity ? '\n## Topics\n\n[Child](../../a/child/research.md)\n\n## Materials\n\n[Report](../../a/report.md)\n' : ''}`,
    }), 16)
    value(await workspace.rebuild())
    expect(value(await workspace.getTopic(knownChild)).value.parentId).toBe(knownParent)
    expect(value(await workspace.getResource(knownReport)).value.ownerTopicId).toBe(knownParent)
    value(await workspace.getTopic(topicIdForPath(deep)))
    expect(value(await workspace.getTopic(knownChild)).value.parentId).toBe(addsAmbiguity ? null : knownParent)
    expect(value(await workspace.getResource(knownReport)).value.ownerTopicId).toBe(addsAmbiguity ? null : knownParent)
    const children = value(await workspace.listTopics({ parentId: knownParent })).value.items.map(item => item.value.id)
    expect(children.includes(knownChild)).toBe(!addsAmbiguity)
    const origin = value(await workspace.resolveOrigin({ resourceId: knownReport, question: 'Which known question owns this?' }))
    expect(origin.status).toBe(addsAmbiguity ? 'ambiguous' : 'resolved')
  })

  it('bounds retained supplements while allowing an evicted known source to be read again', async () => {
    const files: Record<string, string> = { 'research.md': '# Project\n\nAn orientation.\n' }
    for (let index = 0; index < 10; index++) files[`known/target-${index}/research.md`] = `# Target ${index}\n\nA separate question.\n`
    const { workspace } = await fixture(files, 4)
    value(await workspace.rebuild())
    for (let index = 0; index < 10; index++) expect(value(await workspace.getTopic(topicIdForPath(`known/target-${index}/research.md`))).value.title).toBe(`Target ${index}`)
    const retained = value(await workspace.listTopics({})).value
    expect(retained.items.length).toBeGreaterThan(0)
    expect(retained.items.length).toBeLessThanOrEqual(4)
    expect(retained.nextCursor).toBeNull()
    expect(value(await workspace.getTopic(topicIdForPath('known/target-0/research.md'))).value.title).toBe('Target 0')
  })

  it.skipIf(process.platform === 'win32')('retains discovery exclusions and never opens selected symlink aliases or escaped sources', async () => {
    const { root, workspace } = await fixture(crowded({ ...accounts,
      '.git/hidden/research.md': '# Hidden\n\nNot a research source.\n',
      'node_modules/hidden/research.md': '# Hidden dependency\n',
      '.research-memory/hidden/research.md': '# Runtime data\n',
    }), 8)
    const outside = await fixture({ 'research.md': '# Outside\n\nPrivate outside source.\n' })
    await symlink(join(root, 'parent/target'), join(root, 'inside-alias'))
    await symlink(outside.root, join(root, 'outside-alias'))
    for (const path of ['.git/hidden/research.md', '.GIT/hidden/research.md', 'node_modules/hidden/research.md',
      'NODE_MODULES/hidden/research.md', '.research-memory/hidden/research.md', '.RESEARCH-MEMORY/hidden/research.md',
      'inside-alias/research.md', 'outside-alias/research.md']) {
      expect(await workspace.getTopic(topicIdForPath(path))).toMatchObject({ ok: false, error: { code: 'permission-denied' } })
    }
    expect(await workspace.readContext({ topicId: 'topic:..%2Fresearch.md' as ReturnType<typeof topicIdForPath> })).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    expect(await workspace.getResource(resourceIdForPath('outside-alias/research.md'))).toMatchObject({ ok: false, error: { code: 'permission-denied' } })
  })
})
