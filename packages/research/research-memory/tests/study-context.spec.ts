import { expect, it, vi } from 'vitest'
import type { ResourceBody, ResourceEntryId, ResourceReading, SourceId, SourceRef, SourceRootId } from '@deepseek-ai/dsh-research-resources/types'
import { parseMaterialSource } from '@deepseek-ai/dsh-research-resources/protocol'
import { readStudyContext } from '../src/study-context.ts'
import { renderResearchContext } from '../src/runtime.ts'
import { acceptHumanInput, emptyWorkingState } from '../src/working-state.ts'
import { createUserMessage } from '@deepseek-ai/dsh-llm'

const ref = (root: string): SourceRef => ({ rootId: root as SourceRootId, sourceId: 'source:notes.md' as SourceId })
function reading(source: SourceRef, body: ResourceBody): ResourceReading {
  return { resource: { id: `entry:${source.rootId}` as ResourceEntryId, ref: source, title: String(source.rootId),
    kind: 'note', domain: 'knowledge', providerId: 'test', metadata: {}, links: [], topics: [] },
  body, observedAt: '2026-10-25T00:00:00.000Z', issues: [] }
}
const signal = (): AbortSignal => new AbortController().signal

it('does not claim that an image preview delivered image content or OCR while keeping another actual text source', async () => {
  const image = ref('image'), note = ref('note')
  const readResource = vi.fn(async ({ ref: source }: { ref: SourceRef }) => ({ ok: true as const,
    value: reading(source, source.rootId === image.rootId ? { kind: 'image', mediaType: 'image/png' }
      : { kind: 'text', format: 'plain-text', text: 'The recorded bound holds only under A.' }) }))
  const result = await readStudyContext({ readResource }, [{ ref: image }, { ref: note }], 'bound', 24000, signal())
  expect(result.entries).toHaveLength(1)
  expect(result.entries[0]?.text).toBe('The recorded bound holds only under A.')
  expect(result.invalidSelections).toEqual([
    'image/source:notes.md: This source is an image preview; no image content, OCR text or visual interpretation was delivered by the text source reader.',
  ])
  expect(result.omissions).toEqual(result.invalidSelections)
})

it('keeps same-named files in different selected roots distinct in actual citation addresses', async () => {
  const readResource = vi.fn(async ({ ref: source }: { ref: SourceRef }) => ({ ok: true as const,
    value: reading(source, { kind: 'text', format: 'markdown', text: `# ${source.rootId}\n条件：只用于这个来源。` }) }))
  const result = await readStudyContext({ readResource }, [{ ref: ref('first') }, { ref: ref('second') }], '条件', 24000, signal())
  expect(result.invalidSelections).toEqual([])
  expect(result.entries).toHaveLength(2)
  expect(result.entries.map(entry => parseMaterialSource(entry.source.target)?.ref.rootId)).toEqual(['first', 'second'])
  expect(result.entries[0]?.text).toContain('只用于这个来源')
})

it('does not relocate an old exact selection after its source offsets change', async () => {
  const source = ref('first')
  const readResource = vi.fn(async () => ({ ok: true as const,
    value: reading(source, { kind: 'text', format: 'markdown', text: '新增一行\n原有条件。' }) }))
  const result = await readStudyContext({ readResource }, [{ ref: source,
    locator: { kind: 'text', start: 0, end: 5, quote: '原有条件。' } }], '条件', 24000, signal())
  expect(result.entries).toEqual([])
  expect(result.invalidSelections[0]).toContain('offsets no longer match')
})

it.each([['Appendix', 'appendix'], ['附录 条件', '附录-条件']])('locates a later H1 %s with its nested sections and original offsets', async (heading, anchor) => {
  const source = ref('first')
  const introduction = '---\r\ntitle: 原文\r\n---\r\n# Introduction\r\n\r\nINTRO_ONLY\r\n\r\n'
  const passage = `# ${heading}\r\n\r\n所选条件。\r\n\r\n## Detail\r\n\r\nNESTED_CONDITION\r\n\r\n`
  const text = introduction + passage + '# Following\r\n\r\nFOLLOWING_ONLY\r\n'
  const readResource = vi.fn(async () => ({ ok: true as const,
    value: reading(source, { kind: 'text', format: 'markdown', text }) }))
  const result = await readStudyContext({ readResource }, [{ ref: source,
    locator: { kind: 'anchor', anchor } }], '条件', 24000, signal())
  expect(result.invalidSelections).toEqual([])
  expect(result.entries).toHaveLength(1)
  expect(result.entries[0]?.text).toBe(passage)
  expect(parseMaterialSource(result.entries[0]!.source.target)?.locator).toEqual({ kind: 'text',
    start: introduction.length, end: introduction.length + passage.length, quote: passage })
})

it.each(['#', '##'])('rejects repeated %s anchors instead of choosing a heading occurrence', async (level) => {
  const source = ref('first')
  const text = `${level} 条件\n\nFIRST_CONDITION\n\n${level} 条件\n\nSECOND_CONDITION\n`
  const readResource = vi.fn(async () => ({ ok: true as const,
    value: reading(source, { kind: 'text', format: 'markdown', text }) }))
  const result = await readStudyContext({ readResource }, [{ ref: source,
    locator: { kind: 'anchor', anchor: '条件' } }], '条件', 24000, signal())
  expect(result.entries).toEqual([])
  expect(result.invalidSelections).toEqual(['first/source:notes.md: The selected source anchor is missing or ambiguous.'])
})

it('keeps repeated Markdown passages ambiguous until an exact original interval is selected', async () => {
  const source = ref('first'), quote = '同一句条件。'
  const text = `# 对照\n${quote}\n${quote}`
  const readResource = vi.fn(async () => ({ ok: true as const,
    value: reading(source, { kind: 'text', format: 'markdown', text }) }))
  const ambiguous = await readStudyContext({ readResource }, [{ ref: source, selectedText: quote }], '条件', 24000, signal())
  expect(ambiguous.invalidSelections[0]).toContain('repeated')
  const start = text.lastIndexOf(quote)
  const exact = await readStudyContext({ readResource }, [{ ref: source, selectedText: quote,
    locator: { kind: 'text', start, end: start + quote.length, quote } }], '条件', 24000, signal())
  expect(exact.invalidSelections).toEqual([])
  expect(exact.entries[0]?.text).toBe(quote)
  expect(parseMaterialSource(exact.entries[0]!.source.target)?.locator).toEqual({ kind: 'text', start, end: start + quote.length, quote })
})

it('delivers the selected physical PDF page instead of a same-word passage in another page', async () => {
  const source = ref('paper')
  const readResource = vi.fn(async () => ({ ok: true as const, value: reading(source,
    { kind: 'pdf', pageCount: 2, pages: [{ page: 1, text: '相同的术语；条件A。' }, { page: 2, text: '相同的术语；条件B。' }] }) }))
  const result = await readStudyContext({ readResource }, [{ ref: source,
    locator: { kind: 'pdf-page', page: 2 }, selectedText: '相同的术语' }], '哪种条件', 24000, signal())
  expect(result.invalidSelections).toEqual([])
  expect(parseMaterialSource(result.entries[0]!.source.target)?.locator).toEqual({ kind: 'pdf-page', page: 2, quote: '相同的术语' })
  expect(readResource).toHaveBeenCalledWith({ ref: source, locator: { kind: 'pdf-page', page: 2 } }, expect.any(AbortSignal))
})

it('reports a source disappearing after selection while retaining the other located observation', async () => {
  const readResource = vi.fn(async ({ ref: source }: { ref: SourceRef }) => source.rootId === 'missing'
    ? { ok: false as const, error: { code: 'not-found' as const, message: 'The source was removed.', retryable: false } }
    : { ok: true as const, value: reading(source, { kind: 'text', format: 'plain-text', text: 'Retained evidence.' }) })
  const result = await readStudyContext({ readResource }, [{ ref: ref('first') }, { ref: ref('missing') }], '', 24000, signal())
  expect(result.entries).toHaveLength(1)
  expect(result.invalidSelections[0]).toContain('removed')
  expect(result.omissions).toEqual(result.invalidSelections)
})

it('fits long-source excerpts with their complete encoded citations and exposes unread coverage', async () => {
  const source = ref('long')
  const text = Array.from({ length: 90 }, (_, index) => index === 75
    ? '关键归一化条件：这里采用约定乙，不能套用约定甲。\n' : `背景段落 ${index}，本段讨论不同问题并保留其自身条件。\n`).join('')
  const readResource = vi.fn(async () => ({ ok: true as const,
    value: reading(source, { kind: 'text', format: 'markdown', text }) }))
  const result = await readStudyContext({ readResource }, [{ ref: source }], '关键归一化条件与约定乙', 1800, signal())
  expect(result.entries).toHaveLength(1)
  expect(result.entries[0]?.text).toContain('关键归一化条件')
  expect(JSON.stringify(result.entries[0]).length).toBeLessThanOrEqual(1800)
  expect(result.omissions[0]).toContain('remaining source was not included')
  const locator = parseMaterialSource(result.entries[0]!.source.target)?.locator
  expect(locator?.kind).toBe('text')
  if (locator?.kind === 'text') expect(text.slice(locator.start, locator.end)).toBe(locator.quote)
})


it('cites the observed immutable revision while retaining a moving branch only in the original selection', async () => {
  const source = ref('checkout')
  const original = { ref: source, locator: { kind: 'code' as const, startLine: 10, endLine: 11, revision: 'HEAD' } }
  const revision = '0123456789abcdef0123456789abcdef01234567'
  const observed: ResourceReading = { ...reading(source, { kind: 'text', format: 'plain-text', text: 'condition_A()\nreturn finite_bound\n', revision }),
    locator: { ...original.locator, revision } }
  const readResource = vi.fn(async () => ({ ok: true as const, value: observed }))
  const result = await readStudyContext({ readResource }, [original], 'condition', 24000, signal())
  expect(result.invalidSelections).toEqual([])
  expect(parseMaterialSource(result.entries[0]!.source.target)?.locator).toEqual({ ...original.locator, revision })
  expect(original.locator.revision).toBe('HEAD')
})


it('refits an implicit source to the actual request envelope without losing its exact locator or human constraints', async () => {
  const source = ref('saved-draft')
  const text = '# Provisional captured draft\n\n' + Array.from({ length: 200 }, (_, index) =>
    `Finite condition ${index}: only under A; other pages remain unread.\n`).join('')
  const readResource = vi.fn(async () => ({ ok: true as const, value: reading(source,
    { kind: 'text', format: 'markdown', text }) }))
  const question = 'Preserve my original constraint and treat this draft as provisional. '.repeat(10)
  const state = acceptHumanInput(emptyWorkingState(), createUserMessage({
    source: { kind: 'aitp-research', actor: 'human', origin: { scope: 'global', studyId: 'draft-reuse', selections: [{ ref: source }] } },
    content: [{ type: 'text', text: question }],
  }), -1)
  const budget = 3600
  const read = await readStudyContext({ readResource }, [{ ref: source }], question, budget, signal())
  const rendered = renderResearchContext(state, read, { maxContextCharacters: budget, maxHumanInputs: 8,
    maxHumanCharacters: 2000, maxWorkingItems: 12, maxItemCharacters: 2000 }, () => question)
  expect(rendered.length).toBeLessThanOrEqual(budget)
  expect(rendered).toContain(question)
  expect(rendered).toContain('Finite condition')
  expect(rendered).toContain('Reading coverage: only this located excerpt')
  const address = /Source saved-draft \(source 1\) \[(dsh-resource:[^\]]+)\]:/u.exec(rendered)?.[1]
  expect(address).toBeDefined()
  const locator = address === undefined ? undefined : parseMaterialSource(address)?.locator
  expect(locator?.kind).toBe('text')
  if (locator?.kind === 'text') expect(text.slice(locator.start, locator.end)).toBe(locator.quote)
})
