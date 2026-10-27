/** Exact source-text selections; rendered Markdown is never treated as raw source. */
import type { ResourceReading, SourceSelection } from '@deepseek-ai/dsh-research-resources/types'

/**
 * Locate a passage from the source-text view or an extracted PDF page.
 * @param reading - current source observation.
 * @param selectedText - text explicitly selected by the researcher.
 * @param page - physical PDF page, when the source is a PDF.
 * @returns an exact selection, or undefined for missing, repeated or unsupported text.
 */
export function selectMaterialPassage(reading: ResourceReading, selectedText: string, page?: number): SourceSelection | undefined {
  let quote = selectedText.trim()
  if (!quote) return undefined
  const { body } = reading
  if ((body.kind === 'unavailable' || body.kind === 'image')) return undefined
  const text = body.kind === 'pdf' ? body.pages.find(item => item.page === page)?.text : body.text
  if (text === undefined) return undefined
  if (body.kind === 'pdf') {
    // The native text layer and Host extraction can place whitespace differently at line breaks.
    // Match the same words exactly and retain the source's own whitespace; repeated matches stay ambiguous.
    const pattern = quote.split(/\s+/u).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')
    const matches = text.matchAll(new RegExp(pattern, 'gu'))
    const first = matches.next()
    if (first.done || !matches.next().done) return undefined
    quote = first.value[0]
  }
  const start = text.indexOf(quote)
  if (start === -1 || text.indexOf(quote, start + 1) !== -1) return undefined
  if (body.kind === 'pdf') {
    if (page === undefined) return undefined
    return { ref: reading.resource.ref, locator: { kind: 'pdf-page', page, quote }, selectedText: quote }
  }
  if (reading.locator?.kind === 'git') return { ref: reading.resource.ref, locator: reading.locator, selectedText: quote }
  if (body.format === 'code') {
    const startLine = (body.startLine ?? 1) + text.slice(0, start).split('\n').length - 1
    return { ref: reading.resource.ref, locator: { kind: 'code', startLine, endLine: startLine + quote.split('\n').length - 1,
      ...body.revision === undefined ? {} : { revision: body.revision } }, selectedText: quote }
  }
  return { ref: reading.resource.ref, locator: { kind: 'text', start, end: start + quote.length, quote }, selectedText: quote }
}
