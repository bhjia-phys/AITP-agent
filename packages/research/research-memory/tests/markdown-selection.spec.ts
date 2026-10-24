import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MarkdownWorkspace, resourceIdForPath, topicIdForPath } from '../src/markdown.ts'
import { renderedSelectionRanges } from '../src/markdown-selection.ts'
import { acceptHumanInput, emptyWorkingState, originSchema, originPointer } from '../src/working-state.ts'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Result } from '../src/types.ts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { force: true, recursive: true }))) })
function value<T>(result: Result<T>): T { if (!result.ok) throw new Error(result.error.message); return result.value }
async function workspace(text: string) {
  const root = await mkdtemp(join(tmpdir(), 'research-selection-'))
  roots.push(root)
  await writeFile(join(root, 'research.md'), '# Project\n## Topics\n[Subject](subject.md)\n')
  await writeFile(join(root, 'subject.md'), text)
  return { root, reader: new MarkdownWorkspace({ root, maxFiles: 10, maxFileBytes: 20_000, maxContextCharacters: 20_000 }) }
}
const origin = { topicId: topicIdForPath('subject.md'), resourceId: resourceIdForPath('subject.md'), question: 'What does this establish?', selectedTextFormat: 'rendered' as const }

describe('rendered selections keep original wording and exact source intervals', () => {
  it('maps a phrase across bold, link and inline-code nodes without including a destination as visible text', async () => {
    const text = '# Subject\n\n🧪 A **finite result** uses [the control](https://example.test/hidden) and `N=8`.\n\n## Limits\nFinite N is not the limit.\n'
    const quote = 'finite result uses the control and N=8'
    const { reader } = await workspace(text)
    const resolved = value(await reader.resolveOrigin({ ...origin, selectedText: quote }))
    const start = text.indexOf('finite result')
    const end = text.indexOf('N=8') + 'N=8'.length
    expect(resolved).toMatchObject({ status: 'resolved', selectedText: quote, selectedRange: { start, end, text: text.slice(start, end) } })
    expect(resolved.selectedPassage).toBe(text)
    expect(value(await reader.resolveOrigin({ ...origin, selectedText: 'hidden' }))).toMatchObject({ status: 'missing' })
  })

  it.each([
    ['Only **finite** evidence.', 'Only finite evidence.', 'Only **finite** evidence.'],
    ['Use [control](report.md).', 'control', 'control'],
    ['Check `` x ` y ``.', 'x ` y', 'x ` y'],
    ['```ts\nconst n = 8\n```', 'const n = 8', 'const n = 8'],
    ['A ~~failed~~ route.', 'A failed route.', 'A ~~failed~~ route.'],
    ['Finite\nsize control.', 'Finite size control.', 'Finite\nsize control.'],
    ['A &amp; B with \\*literal\\* markers.', 'A & B with *literal* markers.', 'A &amp; B with \\*literal\\* markers.'],
    ['The value is `\nN=8\n`.', 'N=8', 'N=8'],
    ['🧭 **𝒜** supports 🧪.', '𝒜 supports 🧪', '𝒜** supports 🧪'],
  ])('maps %j using syntax-node offsets', (source, quote, expected) => {
    const matches = renderedSelectionRanges(source, quote, { start: 0, end: source.length })
    expect(matches).toHaveLength(1)
    expect(matches[0]?.text).toBe(expected)
    expect(source.slice(matches[0]!.start, matches[0]!.end)).toBe(expected)
  })

  it('does not choose the first of repeated rendered phrases or prefer a literal over a formatted occurrence', async () => {
    const text = '# Subject\n## First\nA **finite result**.\n## Second\nA [finite result](report.md).\n'
    const { reader } = await workspace(text)
    expect(value(await reader.resolveOrigin({ ...origin, selectedText: 'A finite result.' }))).toMatchObject({ status: 'ambiguous' })
    const narrowed = value(await reader.resolveOrigin({ ...origin, anchor: 'second', selectedText: 'A finite result.' }))
    expect(narrowed).toMatchObject({ status: 'resolved', selectedRange: { start: text.indexOf('A [finite'), text: 'A [finite result](report.md).' } })
    const mixed = 'A finite result.\n\nA **finite result**.'
    expect(renderedSelectionRanges(mixed, 'A finite result.', { start: 0, end: mixed.length })).toHaveLength(2)
    const entity = 'A &amp; B.\n\nA & B.'
    expect(renderedSelectionRanges(entity, 'A & B.', { start: 0, end: entity.length })).toHaveLength(2)
  })

  it.each(['The value is $x^2$.', 'The value is \\(x^2\\).', '```math\nx^2\n```'])('keeps an unsupported math selection missing in %j', async (formula) => {
    const { reader } = await workspace(`# Subject\n${formula}\n`)
    const resolved = value(await reader.resolveOrigin({ ...origin, selectedText: 'x^2' }))
    expect(resolved.status).toBe('missing')
    expect(resolved.reason).toContain('rendered selection cannot be located')
    expect(resolved).not.toHaveProperty('selectedPassage')
  })

  it('does not relocate a pinned quote after source edits, even when the same rendered words remain elsewhere', async () => {
    const text = '# Subject\n## First\nA **finite result**.\n## Second\nA **finite result**.\n'
    const { reader, root } = await workspace(text)
    const resolved = value(await reader.resolveOrigin({ ...origin, anchor: 'first', selectedText: 'finite result' }))
    expect(resolved.status).toBe('resolved')
    const pinned = { ...origin, selectedText: resolved.selectedText!, selectedRange: resolved.selectedRange! }
    expect(value(await reader.resolveOrigin(pinned)).status).toBe('resolved')
    await writeFile(join(root, 'subject.md'), text.replace('A **finite result**.', 'An obsolete claim.'))
    const changed = value(await reader.resolveOrigin(pinned))
    expect(changed).toMatchObject({ status: 'missing', selectedText: 'finite result' })
    expect(changed.reason).toContain('pinned selected source range changed')
    expect(changed).not.toHaveProperty('selectedPassage')
  })

  it('revalidates grammar as well as pinned bytes so a quote cannot become a math fragment unnoticed', async () => {
    const text = '# Subject\nA *finite* result.\n'
    const { reader, root } = await workspace(text)
    const resolved = value(await reader.resolveOrigin({ ...origin, selectedText: 'finite' }))
    await writeFile(join(root, 'subject.md'), text.replace('*finite*', '$finite$'))
    expect(value(await reader.resolveOrigin({ ...origin, selectedText: 'finite', selectedRange: resolved.selectedRange! })).status).toBe('missing')
  })

  it('keeps plain-source clients literal and exposes a reopenable root account', async () => {
    const { reader } = await workspace('# Subject\nA **finite** result.\n')
    expect(value(await reader.resolveOrigin({ ...origin, selectedTextFormat: 'source', selectedText: 'A finite result.' })).status).toBe('missing')
    const literal = value(await reader.resolveOrigin({ ...origin, selectedTextFormat: 'source', selectedText: '**finite**' }))
    expect(literal).toMatchObject({ status: 'resolved', selectedRange: { text: '**finite**' } })
    expect(value(await reader.getProject()).value.accountResourceId).toBe(resourceIdForPath('research.md'))
  })

  it('replays the exact rendered quote and pinned raw range but omits them from repeated working pointers', () => {
    const selected = { workspaceId: 'w', ...origin, selectedText: 'finite result', selectedRange: { start: 10, end: 25, text: '**finite** note' } }
    const parsed = originSchema.parse(selected)
    expect(parsed.selectedRange).toEqual(selected.selectedRange)
    expect(originPointer(parsed)).not.toHaveProperty('selectedRange')
    const message = createUserMessage({ source: { kind: 'aitp-research', actor: 'human', origin: parsed }, content: [{ type: 'text', text: 'Why?' }] })
    const state = acceptHumanInput(emptyWorkingState(), message, 1)
    expect(state.origin).toEqual(parsed)
    expect(state.humans[0]?.origin).not.toHaveProperty('selectedText')
    expect(state.humans[0]?.origin).not.toHaveProperty('selectedRange')
    expect(originSchema.safeParse({ ...selected, selectedRange: { start: 10, end: 9, text: 'bad' } }).success).toBe(false)
  })
})
