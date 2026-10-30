import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { MarkdownWorkspace, topicIdForPath } from '../src/markdown.ts'
import { parseMarkdown } from '../src/markdown-model.ts'
import type { Result } from '../src/types.ts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  return result.value
}

async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), 'research-authored-relations-'))
  roots.push(root)
  await Promise.all(Object.entries(files).map(async ([path, text]) => {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), text)
  }))
  return new MarkdownWorkspace({ root, maxFiles: 100, maxFileBytes: 20_000, maxContextCharacters: 20_000 })
}

it('recovers the authored onboarding subtopic hierarchy without promoting its project or ancestor reference', async () => {
  // These opening/navigation passages reproduce the real isolated onboarding failure.
  const files = {
    'research.md': '# 有限自旋链中的边界条件效应\n\n未进行计算，没有已验证物理结论。\n\n## Current work\n\n- **开放边界 → [open-boundary 子课题](open-boundary/research.md)**：承担 OBC 侧的概念整理。\n',
    'open-boundary/research.md': '# 开放边界：有限 XXZ 链能隙的比较问题\n\n本子课题服务于[隔离研究主线](../research.md)，负责 OBC 概念整理，以 PBC 为对照。\n\n## Current work\n\n- **有限尺寸含义 → [finite-size 子子课题](finite-size/research.md)**：限定 L=6 能隙解释边界；尚无数值或推导证据。\n',
    'open-boundary/finite-size/research.md': '# 有限尺寸：L=6 的能隙概念与比较边界\n\n本子子课题隶属于[open-boundary 子课题](../research.md)，服务于[隔离主线](../../research.md)中 OBC 与 PBC 的有限尺寸能隙概念比较。\n\n未进行计算，没有已验证物理结论。\n',
    'open-boundary/independent/research.md': '# Independent question\n\nA nearby directory does not declare a parent.\n',
  }
  const workspace = await fixture(files)
  const items = value(await workspace.listTopics({})).value.items.map(item => item.value)
  const parent = topicIdForPath('open-boundary/research.md')
  const child = topicIdForPath('open-boundary/finite-size/research.md')
  expect(items.find(item => item.id === parent)?.parentId).toBeNull()
  expect(items.find(item => item.id === child)?.parentId).toBe(parent)
  expect(items.find(item => item.id === topicIdForPath('open-boundary/independent/research.md'))?.parentId).toBeNull()
  expect(items.some(item => item.id === topicIdForPath('research.md'))).toBe(false)
  expect(value(await workspace.listTopics({ parentId: parent })).value.items.map(item => item.value.id)).toEqual([child])
  expect(parseMarkdown('open-boundary/finite-size/research.md', files['open-boundary/finite-size/research.md']).links
    .map(({ path, role }) => ({ path, role }))).toEqual([
    { path: 'open-boundary/research.md', role: 'parent' },
    { path: 'research.md', role: 'reference' },
  ])
})

it('recognizes the portable writing template navigation, including reference-style links and anchors', async () => {
  const workspace = await fixture({
    'research.md': '# Project\n',
    'owner/research.md': '# Parent question\n\n## Finite control\nOnly a finite control is warranted.\n',
    'unrelated-location/control/research.md': '# Control\n\nServes [the parent question][parent] as a control · [folder map](README.md).\n\n[parent]: ../../owner/research.md#finite-control\n',
    'unrelated-location/control/README.md': '# Folder map\n',
  })
  expect(value(await workspace.getTopic(topicIdForPath('unrelated-location/control/research.md'))).value.parentId)
    .toBe(topicIdForPath('owner/research.md'))
  const parsed = parseMarkdown('parent/control/research.md', '# Control\n\nServes [the parent question](../research.md#section) as a control · [folder map](README.md)\n')
  expect(parsed.links.map(link => link.role)).toEqual(['parent', 'reference'])
})

it.each([
  '本子子课题服务于[更上层主线](../research.md)。',
  '服务于[更上层主线](../research.md)并不声明直接父课题。',
  '本子课题不隶属于[其他课题](../research.md)。',
  '如果本子课题隶属于[其他课题](../research.md)，需要先确认范围。',
  '该控制隶属于[其他课题](../research.md)，本课题只使用它的输入。',
  '## Related work\n\nDepends on [the parent question](../research.md) for a convention.',
  '## Related work\n\nServes [a neighboring question](../research.md) as a comparison.',
  'The related control serves [the parent question](../research.md); this note is independent.',
  '> 本子子课题隶属于[被引用课题](../research.md)。',
  '> Serves [the parent question](../research.md) as a control.',
])('keeps non-owning, conditional and quoted prose as references: %s', (passage) => {
  const parsed = parseMarkdown('child/research.md', `# Independent question\n\n${passage}\n`)
  expect(parsed.links).toHaveLength(1)
  expect(parsed.links[0]?.role).toBe('reference')
})

it('retains ambiguity when separate explicit declarations name different parents', async () => {
  const workspace = await fixture({
    'research.md': '# Project\n',
    'first/research.md': '# First question\n',
    'second/research.md': '# Second question\n',
    'child/research.md': '# Unresolved ownership\n\n本子课题隶属于[第一课题](../first/research.md)。\n\nServes [the parent question](../second/research.md) as a control.\n',
  })
  expect(value(await workspace.rebuild()).issues).toContainEqual({
    path: 'child/research.md', reason: 'Several explicit parent relationships exist; no primary parent was chosen.',
  })
  expect(value(await workspace.getTopic(topicIdForPath('child/research.md'))).value.parentId).toBeNull()
})
