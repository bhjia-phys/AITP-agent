import { describe, expect, it } from 'vitest'
import type { ResourceReading, SourceRootId, SourceId, ResourceEntryId } from '@deepseek-ai/dsh-research-resources/types'
import { selectMaterialPassage } from '../src/client/selection.ts'

const reading: ResourceReading = {
  resource: { id: 'entry' as ResourceEntryId, ref: { rootId: 'knowledge' as SourceRootId, sourceId: 'source:note.md' as SourceId }, title: '条件', domain: 'knowledge', kind: 'knowledge', providerId: 'knowledge', metadata: {}, links: [], topics: [] },
  body: { kind: 'text', format: 'markdown', text: '# 结论\n\n只在**有限系统**下成立，不能外推。' },
  observedAt: '2026-10-25T00:00:00Z', issues: [],
}

describe('exact material selections', () => {
  it('locates Chinese raw Markdown and refuses its different rendered wording', () => {
    expect(selectMaterialPassage(reading, '只在有限系统下成立，不能外推。')).toBeUndefined()
    const quote = '只在**有限系统**下成立，不能外推。'
    expect(selectMaterialPassage(reading, quote)).toEqual({ ref: reading.resource.ref,
      locator: { kind: 'text', start: 6, end: 6 + quote.length, quote }, selectedText: quote })
  })

  it('rejects a repeated passage rather than assigning the first occurrence', () => {
    const repeated = { ...reading, body: { kind: 'text' as const, format: 'plain-text' as const, text: '同一句\n同一句' } }
    expect(selectMaterialPassage(repeated, '同一句')).toBeUndefined()
    expect(selectMaterialPassage(reading, '不存在')).toBeUndefined()
  })

  it('does not turn an image preview into a text or PDF-page selection', () => {
    const image: ResourceReading = { ...reading, body: { kind: 'image', mediaType: 'image/png' } }
    expect(selectMaterialPassage(image, '条件')).toBeUndefined()
    expect(selectMaterialPassage(image, '条件', 1)).toBeUndefined()
  })

  it('keeps the physical PDF page instead of substituting its printed page label', () => {
    const pdf: ResourceReading = { ...reading, body: { kind: 'pdf', pageCount: 2, pages: [
      { page: 1, printedPage: 'iv', text: '共同的引理' }, { page: 2, printedPage: '1', text: '共同的引理' },
    ] } }
    expect(selectMaterialPassage(pdf, '共同的引理', 2)?.locator).toEqual({ kind: 'pdf-page', page: 2, quote: '共同的引理' })
    expect(selectMaterialPassage(pdf, '共同的引理')).toBeUndefined()
  })

  it('maps native PDF line wrapping to one exact source passage without merging repeated occurrences', () => {
    const pdf: ResourceReading = { ...reading, body: { kind: 'pdf', pageCount: 6, pages: [
      { page: 5, text: 'The term (A+B)\n  vanishes only under condition C.' },
    ] } }
    expect(selectMaterialPassage(pdf, 'The term (A+B) vanishes only under condition C.', 5)?.locator).toEqual({
      kind: 'pdf-page', page: 5, quote: 'The term (A+B)\n  vanishes only under condition C.',
    })
    const repeated: ResourceReading = { ...pdf, body: { kind: 'pdf', pageCount: 6, pages: [
      { page: 5, text: 'same words; same\nwords' },
    ] } }
    expect(selectMaterialPassage(repeated, 'same words', 5)).toBeUndefined()
    expect(selectMaterialPassage(pdf, 'term (A-B)', 5)).toBeUndefined()
    expect(selectMaterialPassage(pdf, 'The term', 6)).toBeUndefined()
  })

  it('retains the actual code revision and line offset supplied by the source reader', () => {
    const code: ResourceReading = { ...reading, body: { kind: 'text', format: 'code', text: 'first();\n归一化();\nlast();', revision: 'actual-commit', startLine: 30 } }
    expect(selectMaterialPassage(code, '归一化();')).toEqual({ ref: reading.resource.ref,
      locator: { kind: 'code', startLine: 31, endLine: 31, revision: 'actual-commit' }, selectedText: '归一化();' })
  })
})
