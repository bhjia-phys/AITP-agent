import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MarkdownWorkspace, pathForResourceId, resourceIdForPath, topicIdForPath } from '../src/markdown.ts'
import { parseMarkdown } from '../src/markdown-model.ts'
import type { Result, ResourceId } from '../src/types.ts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  return result.value
}

async function fixture(
  files: Record<string, string>,
  bounds: Partial<{
    maxFiles: number
    maxFileBytes: number
    maxContextCharacters: number
    discoveryExcludedDirectories: readonly string[] }> = {},
) {
  const root = await mkdtemp(join(tmpdir(), 'research-markdown-'))
  roots.push(root)
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), text)
  }
  return { root, workspace: new MarkdownWorkspace({ root, maxFiles: 100, maxFileBytes: 20_000, maxContextCharacters: 20_000, ...bounds }) }
}

const project = {
  'research.md': '# Project\nThe common physical question.\n## Topics\n[Alpha](alpha/research.md)\n[Beta](beta/research.md)\n',
  'alpha/research.md': '# Alpha\nQuestion A with its original condition.\n## Scope\nOnly finite systems.\n## Current work\nThe earlier ansatz failed when the boundary is open. Do not retry without changing that assumption.\n## Subtopics\n[Control](control/research.md) supplies a limited reference, not the full result.\n## Materials\n[Comparison](../shared.md)\n',
  'alpha/control/research.md': '# Control\nA bounded control.\n## 当前工作\n仍需分析结果。\n',
  'beta/research.md': '# Beta\nQuestion B.\n## Materials\n[Comparison](../shared.md)\n',
  'shared.md': '# Comparison\nShared raw observation, not a project decision.\n',
}

describe('MarkdownWorkspace source ownership', () => {
  it.each(['research.md', 'README.md'])('keeps %s material uses at project scope without inventing a root topic', async (account) => {
    const { workspace } = await fixture({
      [account]: '# Programme\n## Topics\n[Branch](branch/research.md)\n## Materials\n[Shared proof](proof.md)\n',
      'branch/research.md': '# Branch\n[Same proof](../proof.md)\n',
      'proof.md': '# Proof\nOnly under the recorded conditions.\n',
    })
    const projectRead = value(await workspace.getProject()).value
    expect(projectRead.accountResourceId).toBe(resourceIdForPath(account))
    expect(value(await workspace.listTopics({})).value.items.map(item => item.value.id))
      .toEqual([topicIdForPath('branch/research.md')])
    expect(workspace.materialLinks().links.filter(link => link.href.endsWith('proof.md'))).toEqual([
      expect.objectContaining({ accountPath: 'branch/research.md', topicId: topicIdForPath('branch/research.md') }),
      expect.objectContaining({ accountPath: account, href: 'proof.md' }),
    ])
    expect(workspace.materialLinks().links.find(link => link.accountPath === account)?.topicId).toBeUndefined()
    expect((await workspace.getTopic(topicIdForPath(account))).ok).toBe(false)
  })

  it('does not discover a fictional source from a mathematical functional', () => {
    const text = String.raw`# Formula

\(\mathcal F[H_0](k_i)\)

\[
\mathcal F[H_0](k_i)
\]

## Materials
[Actual evidence](notes/evidence.md)
`
    const parsed = parseMarkdown('research.md', text)
    expect(parsed.links.map(link => link.path)).toEqual(['notes/evidence.md'])
    expect(parsed.authoredLinks.map(link => link.href)).toEqual(['notes/evidence.md'])
  })

  it('discovers the linked research backbone without spending its budget in an output tree', async () => {
    const { workspace } = await fixture({
      'README.md': '# Family\n[Independent question](z-question/research.md).\n',
      'a-outputs/first.txt': 'raw evidence\n',
      'a-outputs/second.txt': 'more evidence\n',
      'z-question/research.md': '# Question\nA qualified question.\n## Branches\n[Control](deep/control/research.md).\n',
      'z-question/deep/control/research.md': '# Control\nA finite control only.\n',
    }, { maxFiles: 5 })
    const page = value(await workspace.listTopics({})).value
    expect(page.items.map(item => item.value.title)).toEqual(['Control', 'Question'])
    expect(page.completeness).toBe('complete')
    expect(value(await workspace.getTopic(topicIdForPath('z-question/deep/control/research.md'))).value.parentId)
      .toBe(topicIdForPath('z-question/research.md'))
  })

  it('keeps excluded historical accounts readable without promoting them to current topics', async () => {
    const archived = '# Old question\nA historical observation, not the current conclusion.\n'
    const { workspace } = await fixture({
      'research.md': '# Programme\n## Topics\n[Current](live/research.md)\n',
      'live/research.md': '# Current\n[Original account](../history/research.md).\n',
      'history/research.md': archived,
      '.venv/library/research.md': '# Unrelated dependency\n',
    }, { discoveryExcludedDirectories: ['history', '.venv'] })
    expect(value(await workspace.listTopics({})).value.items.map(item => item.value.title)).toEqual(['Current'])
    expect(value(await workspace.getResource(resourceIdForPath('history/research.md'))).value.content)
      .toEqual({ kind: 'markdown', text: archived })
    expect((await workspace.getTopic(topicIdForPath('history/research.md'))).ok).toBe(false)
    expect(value(await workspace.listTopics({})).value.items.map(item => item.value.title)).toEqual(['Current'])
  })

  it('uses an existing family map without inventing a shared scientific account', async () => {
    const { root, workspace } = await fixture({
      'README.md': '# Shared-code family\nTwo independent questions share one implementation.\n## Topics\n[A](a/research.md)\n[B](b/research.md)\n',
      'a/research.md': '# A\nQuestion A.\n', 'b/research.md': '# B\nQuestion B.\n',
    })
    const family = value(await workspace.getProject()).value
    expect(family.title).toBe('Shared-code family')
    expect(family.accountResourceId).toBe(resourceIdForPath('README.md'))
    expect(family.directions).toEqual([])
    const context = value(await workspace.readContext({ topicId: topicIdForPath('a/research.md') })).value
    expect(context.entries.some(entry => entry.text.includes('Two independent questions'))).toBe(true)
    await expect(readFile(join(root, 'research.md'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('shows explicitly curated materials without turning other citations into topic materials', async () => {
    const { workspace } = await fixture({
      'research.md': '# Project\n\n## Topics\n[Alpha](alpha/research.md)\n',
      'alpha/research.md': '# Alpha\n\nEvidence: [historical source](history.md).\n\n## 精选资料\n\n### 研究笔记\n[Selected](selected.md)\n\n### 缺失资料\n[Missing](missing.md)\n\n## Current work\n[Other evidence](other.md)\n',
      'alpha/history.md': '# Historical source\n', 'alpha/selected.md': '# Selected\n', 'alpha/other.md': '# Other\n',
    })
    const topic = value(await workspace.getTopic(topicIdForPath('alpha/research.md'))).value
    expect(topic.resources.map(resource => resource.id)).toEqual([
      resourceIdForPath('alpha/research.md'), resourceIdForPath('alpha/selected.md'), resourceIdForPath('alpha/missing.md'),
    ])
    expect((await workspace.getResource(resourceIdForPath('alpha/missing.md'))).ok).toBe(false)
    const account = value(await workspace.getResource(topic.accountResourceId!)).value
    expect(account.content?.kind).toBe('markdown')
    if (account.content?.kind === 'markdown') expect(account.content.text).toContain('[historical source](history.md)')
    const context = value(await workspace.readContext({ topicId: topicIdForPath('alpha/research.md'), include: ['resources'] })).value
    expect(JSON.stringify(context)).toContain('Historical source')
  })

  it('uses an authored link label to distinguish generic README references without changing their identity', async () => {
    const { workspace } = await fixture({
      'research.md': '# Project\n\n## Topics\n\n[Alpha](alpha/research.md)\n',
      'alpha/research.md': '# Alpha\n\n[Control run](../control/README.md)\n\n[Missing comparison](../missing/README.md)\n\n[Named record](../named/README.md)\n',
      'control/README.md': '# README\n\nA control.\n',
      'named/README.md': '# Actual scientific title\n\nA report.\n',
    })
    const topic = value(await workspace.getTopic(topicIdForPath('alpha/research.md'))).value
    expect(topic.resources.find(resource => resource.id === resourceIdForPath('control/README.md'))?.title).toBe('Control run')
    expect(topic.resources.find(resource => resource.id === resourceIdForPath('missing/README.md'))?.title).toBe('Missing comparison')
    expect(topic.resources.find(resource => resource.id === resourceIdForPath('named/README.md'))?.title).toBe('Named record')
    expect(value(await workspace.getResource(resourceIdForPath('named/README.md'))).value.content)
      .toEqual({ kind: 'markdown', text: '# Actual scientific title\n\nA report.\n' })
    expect((await workspace.getResource(resourceIdForPath('missing/README.md'))).ok).toBe(false)
  })
  it('uses only the authored root opening as the project summary without inferring relationship labels', async () => {
    const opening = 'Can the finite control support a broader claim?\n\nThe [existing result](alpha/research.md) remains conditional.'
    const { workspace } = await fixture({ ...project,
      'research.md': `# Project\n\n${opening}\n\n## Topics\n\n[Alpha](alpha/research.md) supplies a finite control only.\n`,
    })
    const overview = value(await workspace.getProject()).value
    expect(overview.summary).toBe(opening)
    expect(overview.directions).toEqual([])
    expect(overview.seeds).toEqual([])
    expect(value(await workspace.getTopic(topicIdForPath('alpha/research.md'))).value).not.toHaveProperty('parentContribution')
  })

  it.each([
    { 'research.md': '# Project\n\n## Topics\n\n[Alpha](alpha/research.md) supplies a finite control only.\n' },
    {},
  ])('omits an absent project opening instead of borrowing a child or a relationship statement', async (rootFiles) => {
    const { workspace } = await fixture({ 'alpha/research.md': '# Alpha\nA child question is not the project opening.\n', ...rootFiles })
    expect(value(await workspace.getProject()).value).not.toHaveProperty('summary')
  })

  it.each(['## Question', 'Research question\n-----------------', '## 问题', '## 研究问题'])(
    'uses the exact authored %s body before the opening or full-account fallback', async (heading) => {
      const question = 'Does **B** follow only under A?\n\nThe [finite control](report.md) does not establish the thermodynamic claim.'
      const text = `# Child\nAn opening orientation, not the focused question.\n\n${heading}\n\n${question}\n\n## Scope\nFinite N only.\n`
      const { workspace } = await fixture({ 'child/research.md': text })
      const topic = value(await workspace.getTopic(topicIdForPath('child/research.md'))).value
      expect(topic.question).toBe(question)
      expect(topic.question).not.toContain('## Scope')
      expect(value(await workspace.getResource(topic.accountResourceId!)).value.content).toEqual({ kind: 'markdown', text })
    },
  )

  it('does not choose between conflicting authored question sections', async () => {
    const { workspace } = await fixture({ 'child/research.md': '# Child\nKeep the original opening.\n\n## Question\nQuestion A.\n\n## 问题\nQuestion B.\n' })
    expect(value(await workspace.getTopic(topicIdForPath('child/research.md'))).value.question).toBe('Keep the original opening.')
  })

  it('resolves explicit branches, shared material and distinct topic files in one folder', async () => {
    const { workspace } = await fixture({
      ...project,
      'alpha/unrelated/research.md': '# Independent\nDirectory proximity does not make this an Alpha branch.\n',
      'README.md': '# Map\n## Topics\n[One](one.md)\n[Two][two]\n\n[two]: two.md\n',
      'one.md': '# First problem\nFirst independent question.\n',
      'two.md': '# Second problem\nSecond independent question.\n',
    })
    expect(value(await workspace.getProject()).value.title).toBe('Project')
    const control = value(await workspace.getTopic(topicIdForPath('alpha/control/research.md'))).value
    expect(control.parentId).toBe(topicIdForPath('alpha/research.md'))
    expect(value(await workspace.getTopic(topicIdForPath('alpha/unrelated/research.md'))).value.parentId).toBeNull()
    expect(value(await workspace.getTopic(topicIdForPath('one.md'))).value.title).toBe('First problem')
    expect(value(await workspace.getTopic(topicIdForPath('two.md'))).value.title).toBe('Second problem')
    const shared = value(await workspace.resolveOrigin({ resourceId: resourceIdForPath('shared.md'), question: 'What does this imply?' }))
    expect(shared.status).toBe('ambiguous')
    expect(shared.candidateTopicIds).toEqual([topicIdForPath('alpha/research.md'), topicIdForPath('beta/research.md')])
    expect(value(await workspace.getResource(resourceIdForPath('shared.md'))).value.ownerTopicId).toBeNull()
    expect(value(await workspace.resolveOrigin({ topicId: topicIdForPath('beta/research.md'), resourceId: resourceIdForPath('shared.md'), question: 'For B?' })).status).toBe('resolved')
  })

  it('preserves unfamiliar and multilingual accounts without inventing structured conclusions', async () => {
    const text = '# 未分类课题\n## 一些尚未成形的想法\n这个原始问题还没有结论。\n原有条件不能丢失。\n'
    const { workspace } = await fixture({ 'new/research.md': text })
    const topic = value(await workspace.getTopic(topicIdForPath('new/research.md'))).value
    expect(topic.currentAnswer).toBeNull()
    expect(topic.work.state).toBe('unknown')
    expect(topic.question).toBe(text)
    expect(value(await workspace.getResource(topic.accountResourceId!)).value.content).toEqual({ kind: 'markdown', text })
    expect(value(await workspace.readContext({ topicId: topic.id })).value.entries[0]?.text).toBe(text)
  })

  it('delivers a free-form active account beyond its opening when headings do not define the overview', async () => {
    const text = '# Our charge calculation\n\nWe study a normalized perturbative charge.\n\n'
      + '## Derivation in our notation\n\nThe finite control needs a second-order normalization correction.\n\n'
      + '## Boundary of this claim\n\nOnly the stated finite-dimensional example is covered.\n'
    const { workspace } = await fixture({ 'new/research.md': text })
    const topic = value(await workspace.getTopic(topicIdForPath('new/research.md'))).value
    expect(topic.currentAnswer).toBeNull()
    const context = value(await workspace.readContext({ topicId: topic.id })).value
    expect(context.entries[0]?.text).toBe(text)
    expect(context.entries[0]?.text).toContain('second-order normalization correction')
    expect(context.entries[0]?.text).toContain('finite-dimensional example')
  })

  it('retains a located opening when a free-form account exceeds the complete context budget', async () => {
    const text = '# Charge investigation\n\nThe original condition is Delta > 0 and finite dimension.\n\n'
      + '## Derivation in our notation\n\n' + 'Formula detail and constraints.\n'.repeat(850)
    const { workspace } = await fixture({ 'charge/research.md': text }, { maxFileBytes: 100_000, maxContextCharacters: 24_000 })
    const result = value(await workspace.readContext({ topicId: topicIdForPath('charge/research.md') }))
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(24_000)
    expect(result.value.completeness).toBe('partial')
    const entry = result.value.entries[0]
    expect(entry?.text).toContain('Delta > 0 and finite dimension')
    expect(entry?.text.length).toBeLessThan(text.length)
    expect(entry?.range).toEqual({ start: 0, end: entry?.text.length })
    expect(text.slice(entry!.range!.start, entry!.range!.end)).toBe(entry?.text)
    expect(result.value.omissions.some(item => item.reason.includes('located prefix'))).toBe(true)
  })

  it('reports conflicting parents, duplicate headings and missing selections explicitly', async () => {
    const { workspace } = await fixture({
      ...project,
      'beta/research.md': '# Beta\n## Subtopics\n[Control](../alpha/control/research.md)\n',
      'alpha/control/research.md': '# Control\n## Same\nFirst.\n## Same\nSecond.\n',
    })
    expect(value(await workspace.rebuild()).issues.some(issue => issue.reason.includes('Several explicit parent'))).toBe(true)
    expect(value(await workspace.getTopic(topicIdForPath('alpha/control/research.md'))).value.parentId).toBeNull()
    const selected = { topicId: topicIdForPath('alpha/control/research.md'), question: 'Explain this.' }
    expect(value(await workspace.resolveOrigin({ ...selected, anchor: 'same' })).status).toBe('ambiguous')
    expect(value(await workspace.resolveOrigin({ ...selected, anchor: 'removed' })).status).toBe('missing')
    expect(value(await workspace.resolveOrigin({ ...selected, selectedText: 'no longer here' })).status).toBe('missing')
    expect(value(await workspace.resolveOrigin({ question: 'A new global discussion.' })).status).toBe('missing')
  })

  it('does not parse example links in code blocks as scientific relationships', async () => {
    const { workspace } = await fixture({
      ...project,
      'beta/research.md': '# Beta\n## Subtopics\n```markdown\n[Control](../alpha/control/research.md)\n```\n',
    })
    expect(value(await workspace.getTopic(topicIdForPath('alpha/control/research.md'))).value.parentId).toBe(topicIdForPath('alpha/research.md'))
  })

  it('uses explicit anchors without duplicating the matching generated heading anchor', async () => {
    const { workspace } = await fixture({
      'topic/research.md': '# Topic\nA question.\n<a id="current-work"></a>\n## Current work\nThe exact selected constraint.\n',
    })
    const origin = value(await workspace.resolveOrigin({
      topicId: topicIdForPath('topic/research.md'), anchor: 'current-work',
      selectedText: 'The exact selected constraint.', question: 'Why this constraint?',
    }))
    expect(origin.status).toBe('resolved')
    expect(origin.selectedPassage).toBe('## Current work\nThe exact selected constraint.')
  })
})

describe('MarkdownWorkspace current observations and bounds', () => {
  it('keeps topic and parent evidence when authored directory links cannot supply source text', async () => {
    const { workspace } = await fixture({
      ...project,
      'alpha/research.md': `${project['alpha/research.md']}\n[Notes](notes/)\n[Missing folder](missing/)\n[This folder](./)\n[Root folder](../)\n`,
      'alpha/notes/control.md': '# Unselected control\nNot automatically read through a directory.\n',
    })
    const topicId = topicIdForPath('alpha/research.md')
    const topic = value(await workspace.getTopic(topicId)).value
    expect(topic.resources.some(resource => resource.id === resourceIdForPath('alpha/notes'))).toBe(true)
    expect(topic.resources.some(resource => resource.target.kind === 'workspace-path' && resource.target.path === '.')).toBe(false)
    const read = value(await workspace.readContext({ topicId, include: ['ancestors', 'work', 'resources'] })).value
    expect(read.completeness).toBe('partial')
    expect(read.entries.some(entry => entry.text.includes('Only finite systems.'))).toBe(true)
    expect(read.entries.some(entry => entry.text.includes('The common physical question.'))).toBe(true)
    expect(read.entries.some(entry => entry.text.includes('Shared raw observation'))).toBe(true)
    expect(read.entries.some(entry => entry.text.includes('Not automatically read through a directory.'))).toBe(false)
    for (const path of ['alpha/notes', 'alpha/missing', 'alpha']) {
      expect(read.omissions.some(item => item.target.kind === 'resource' && item.target.id === resourceIdForPath(path))).toBe(true)
    }
    expect(() => resourceIdForPath('alpha/notes/')).toThrow('normalized relative path')
  })

  it('rereads selected sources, reconstructs identities after restart and leaves source bytes untouched', async () => {
    const { root, workspace } = await fixture(project)
    const id = topicIdForPath('alpha/research.md')
    value(await workspace.getTopic(id))
    const replacement = '# Alpha corrected\nThe newly qualified conclusion.\n'
    await writeFile(join(root, 'alpha/research.md'), replacement)
    expect(value(await workspace.getTopic(id)).value.question).toBe('The newly qualified conclusion.')
    const restarted = new MarkdownWorkspace({ root, maxFiles: 100, maxFileBytes: 20_000, maxContextCharacters: 20_000 })
    expect(value(await restarted.getTopic(id)).value.title).toBe('Alpha corrected')
    expect(await readFile(join(root, 'alpha/research.md'), 'utf8')).toBe(replacement)
  })

  it('retains source conditions and the actual parent-use passage in context without unrelated children', async () => {
    const { workspace } = await fixture(project)
    const result = value(await workspace.readContext({ topicId: topicIdForPath('alpha/control/research.md') }))
    const text = result.value.entries.map(entry => entry.text).join('\n')
    expect(text).toContain('Only finite systems.')
    expect(text).toContain('supplies a limited reference, not the full result')
    expect(text).toContain('Do not retry without changing that assumption.')
    expect(text).not.toContain('Question B.')
  })

  it.each([
    ['Question', 'Current answer'], ['Research question', 'Current conclusion'],
    ['问题', '当前答案'], ['研究问题', '当前结论'], ['研究问题', '当前认识'],
  ])('keeps the authored %s and %s beside scoped material context', async (questionHeading, answerHeading) => {
    const question = 'Can this finite control settle the owning question?'
    const answer = 'Only under A; the general question remains unresolved.'
    const { workspace } = await fixture({
      'research.md': '# Project\nAn orientation.\n',
      'child/research.md': `# Child\nAn orientation, not the actual question or answer.\n## ${questionHeading}\n${question}\n## ${answerHeading}\n${answer}\n## Scope\nFinite N only.\n## Materials\n[Report](../report.md)\n## Unrelated ideas\nDo not automatically include this speculative branch.\n`,
      'report.md': '# Report\nThe selected finite control.\n',
    })
    const read = value(await workspace.readContext({ topicId: topicIdForPath('child/research.md'), include: ['ancestors', 'work', 'resources'] })).value
    const delivered = read.entries.map(entry => entry.text).join('\n')
    expect(delivered).toContain(question)
    expect(delivered).toContain(answer)
    expect(delivered).toContain('Finite N only.')
    expect(delivered).toContain('The selected finite control.')
    expect(delivered).not.toContain('Do not automatically include this speculative branch.')
    expect(read.completeness).toBe('complete')
  })

  it('bounds the serialized envelope while identifying partial account text and its unread remainder', async () => {
    const condition = '条件不可截断。'.repeat(300)
    const { workspace } = await fixture({ 'topic/research.md': `# Topic\n${condition}\n` })
    const read = value(await workspace.readContext({ topicId: topicIdForPath('topic/research.md'), maxCharacters: 800 }))
    expect(JSON.stringify(read).length).toBeLessThanOrEqual(800)
    expect(read.value.entries).toHaveLength(1)
    const entry = read.value.entries[0]!
    expect(`# Topic\n${condition}\n`.startsWith(entry.text)).toBe(true)
    expect(entry.text).toContain('条件')
    expect(entry.range).toEqual({ start: 0, end: entry.text.length })
    expect(read.value.completeness).toBe('partial')
    expect(read.value.omissions.some(item => item.reason.includes('remaining argument and conditions'))).toBe(true)
    const tiny = await workspace.readContext({ topicId: topicIdForPath('topic/research.md'), maxCharacters: 1 })
    expect(tiny).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  })

  it('bounds UTF-8 bytes and distinguishes exact account-discovery limits', async () => {
    const exact = await fixture({ 'research.md': '中文' }, { maxFiles: 1, maxFileBytes: 6 })
    expect(value(await exact.workspace.rebuild()).completeness).toBe('complete')
    expect(value(await exact.workspace.readSource(resourceIdForPath('research.md'))).text).toBe('中文')
    const exceeded = await fixture({ 'research.md': '中文多' }, { maxFiles: 1, maxFileBytes: 6 })
    expect(await exceeded.workspace.readSource(resourceIdForPath('research.md'))).toMatchObject({ ok: false, error: { code: 'unavailable' } })
    const limited = await fixture({ 'a/research.md': 'a', 'b/research.md': 'b' }, { maxFiles: 1 })
    expect(value(await limited.workspace.rebuild()).completeness).toBe('partial')
  })

  it('rejects stale or mismatched cursors and cancelled reads', async () => {
    const { workspace } = await fixture(project)
    const first = value(await workspace.listTopics({ limit: 1 }))
    const cursor = first.value.nextCursor!
    expect(value(await workspace.listTopics({ limit: 1, cursor })).value.items).toHaveLength(1)
    expect(await workspace.listTopics({ parentId: null, limit: 1, cursor })).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    value(await workspace.refresh())
    expect(await workspace.listTopics({ limit: 1, cursor })).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    const controller = new AbortController()
    controller.abort()
    expect(await workspace.getProject({ signal: controller.signal })).toMatchObject({ ok: false, error: { code: 'cancelled' } })
  })

  it.skipIf(process.platform === 'win32')('rejects symlink escapes and traversal identities on every source read', async () => {
    const { root, workspace } = await fixture(project)
    const outside = await fixture({ 'secret.md': 'Outside root' })
    await symlink(join(outside.root, 'secret.md'), join(root, 'escape.md'))
    expect(await workspace.readSource(resourceIdForPath('escape.md'))).toMatchObject({ ok: false, error: { code: 'permission-denied' } })
    await symlink(outside.root, join(root, 'escape-dir'))
    expect(await workspace.readSource(resourceIdForPath('escape-dir/secret.md'))).toMatchObject({ ok: false, error: { code: 'permission-denied' } })
    expect(await workspace.readSource('resource:..%2Fsecret.md' as ResourceId)).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    expect(() => pathForResourceId('resource:%ZZ' as ResourceId)).toThrow('invalid encoding')
    expect(value(await workspace.rebuild()).completeness).toBe('complete')
    await writeFile(join(root, 'alpha/research.md'), `${project['alpha/research.md']}\n[Outside](../escape.md)\n`)
    value(await workspace.refresh())
    const context = value(await workspace.readContext({ topicId: topicIdForPath('alpha/research.md'), include: ['resources'] })).value
    expect(context.entries.some(entry => entry.text.includes('Only finite systems.'))).toBe(true)
    expect(JSON.stringify(context.entries)).not.toContain('Outside root')
    expect(context.omissions.some(item => item.reason.includes('outside the configured research root'))).toBe(true)
  })
})
