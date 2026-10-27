/** Fresh selected-source observations for normal Harness research conversations. */
import type { ResearchResources } from '@deepseek-ai/dsh-research-resources'
import type { ResourceReading, SourceLocator, SourceSelection } from '@deepseek-ai/dsh-research-resources/types'
import { materialSourceAddress } from '@deepseek-ai/dsh-research-resources/protocol'
import { parseMarkdown } from './markdown-model.ts'
import type { ResearchContextRead } from './working-types.ts'

interface Passage {
  text: string
  locator?: SourceLocator
}

/** Current reading limitations distinguished from invalid original selections. */
export interface StudyContextRead extends ResearchContextRead {
  invalidSelections: string[]
}

function uniqueQuote(text: string, quote: string): { start: number; end: number } | undefined {
  const start = text.indexOf(quote)
  if (quote.length === 0 || start < 0 || start !== text.lastIndexOf(quote)) return undefined
  return { start, end: start + quote.length }
}

/**
 * Resolve a selected text range or anchor against the current authorized reading.
 * @param reading - observed source body, including any provider-resolved code revision.
 * @param selection - requested source location and optional exact quotation.
 * @returns the located passage, before retrieval or result-size truncation.
 */
export function resolveStudyTextPassage(reading: ResourceReading, selection: SourceSelection): Passage {
  if (reading.body.kind !== 'text') throw new Error('The selected source is not a text reading.')
  const raw = reading.body.text
  let start = 0, end = raw.length
  const locator = reading.locator?.kind === 'code' || reading.locator?.kind === 'git' ? reading.locator : selection.locator
  if (locator?.kind === 'text') {
    if (raw.slice(locator.start, locator.end) !== locator.quote) throw new Error('The selected text changed or its original source offsets no longer match.')
    start = locator.start
    end = locator.end
  } else if (locator?.kind === 'anchor') {
    const sections = parseMarkdown('source.md', raw).anchors.get(locator.anchor)
    if (sections?.length !== 1 || sections[0] === undefined) throw new Error('The selected source anchor is missing or ambiguous.')
    start = sections[0].start
    end = sections[0].end
  }
  let text = raw.slice(start, end)
  if (selection.selectedText !== undefined) {
    const quote = uniqueQuote(text, selection.selectedText)
    if (quote === undefined) throw new Error('The selected quote is missing or repeated in the current reading; select an exact source range.')
    start += quote.start
    end = start + selection.selectedText.length
    text = selection.selectedText
  }
  if (locator?.kind === 'code' || locator?.kind === 'git') return locatedPart({ text: raw, locator }, text, start)
  return { text, locator: { kind: 'text', start, end, quote: text } }
}

/**
 * Resolve selected text or PDF passages against the current authorized reading.
 * @param reading - observed source body before retrieval or result-size truncation.
 * @param selection - requested source location and optional exact quotation.
 * @returns the matching passages, retaining their exact source locations.
 */
export function resolveStudyPassages(reading: ResourceReading, selection: SourceSelection): Passage[] {
  if (reading.body.kind === 'unavailable') throw new Error(reading.body.detail)
  if (reading.body.kind === 'image') {
    throw new Error('This source is an image preview; no image content, OCR text or visual interpretation was delivered by the text source reader.')
  }
  if (reading.body.kind === 'text') return [resolveStudyTextPassage(reading, selection)]
  if (selection.locator !== undefined && selection.locator.kind !== 'pdf-page') throw new Error('The selected locator does not address a PDF page.')
  const requested = selection.locator
  const pages = requested === undefined ? reading.body.pages : reading.body.pages.filter(page => page.page === requested.page)
  if (pages.length === 0) throw new Error('The selected PDF page is unavailable in this edition.')
  const quote = selection.selectedText ?? requested?.quote
  if (quote !== undefined) {
    const candidates = pages.flatMap(page => uniqueQuote(page.text, quote) === undefined ? [] : [page])
    if (candidates.length !== 1 || candidates[0] === undefined) throw new Error('The PDF quote is missing or ambiguous in the selected edition/page.')
    return [{ text: quote, locator: { kind: 'pdf-page', page: candidates[0].page, quote,
      ...(requested?.region === undefined ? {} : { region: requested.region }) } }]
  }
  return pages.filter(page => page.text.trim() !== '').map(page => ({ text: page.text,
    locator: { kind: 'pdf-page', page: page.page } }))
}

function queryTerms(question: string): string[] {
  const words: string[] = question.toLocaleLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []
  for (const word of words.filter(value => /\p{Script=Han}/u.test(value))) {
    const chars = Array.from(word)
    for (let index = 0; index + 1 < chars.length; index++) words.push(chars.slice(index, index + 2).join(''))
  }
  return [...new Set(words)]
}

function locatedPart(passage: Passage, text: string, start: number): Passage {
  const locator = passage.locator
  if (locator?.kind === 'code') {
    const startLine = locator.startLine + (passage.text.slice(0, start).match(/\n/g)?.length ?? 0)
    const lines = text.replace(/\r?\n$/, '').split(/\r?\n/).length
    return { text, locator: { ...locator, startLine, endLine: Math.min(locator.endLine, startLine + lines - 1) } }
  }
  return { text, ...(locator === undefined ? {} : { locator: locator.kind === 'text'
    ? { kind: 'text' as const, start: locator.start + start, end: locator.start + start + text.length, quote: text }
    : locator.kind === 'pdf-page' ? { ...locator, quote: text } : locator }) }
}

function excerpts(passage: Passage, question: string, fits: (part: Passage) => boolean): Passage[] {
  if (fits(passage)) return [passage]
  const pieces: { text: string; start: number; score: number }[] = []
  const terms = queryTerms(question)
  const pattern = /[^\n]*(?:\n|$)/g
  let current = '', start = 0
  const emit = (): void => {
    if (current !== '') pieces.push({ text: current, start,
      score: terms.reduce((sum, term) => sum + (current.toLocaleLowerCase().includes(term) ? 1 : 0), 0) })
    current = ''
  }
  for (const match of passage.text.matchAll(pattern)) {
    if (match[0] === '') continue
    if (!fits(locatedPart(passage, current + match[0], current === '' ? match.index : start))) emit()
    if (current === '') start = match.index
    if (!fits(locatedPart(passage, match[0], match.index))) continue
    current += match[0]
  }
  emit()
  return pieces.sort((left, right) => right.score - left.score || left.start - right.start)
    .slice(0, 1).map(piece => locatedPart(passage, piece.text, piece.start))
}

/**
 * Observe only explicitly selected sources and retain source/locator failures for the next inference.
 * @param resources - the single authorized local-source service.
 * @param selections - eligible sources selected by the human, distinct from delivered excerpts.
 * @param question - retrieval terms for long readings; this does not establish scientific relevance.
 * @param maxCharacters - complete source-context budget before the runtime's final admission.
 * @param signal - cancellation for the current observer.
 * @returns located source units, omitted coverage and invalid original selections.
 */
export async function readStudyContext(resources: Pick<ResearchResources, 'readResource'>,
  selections: readonly SourceSelection[], question: string, maxCharacters: number, signal: AbortSignal): Promise<StudyContextRead> {
  const result: StudyContextRead = { entries: [], omissions: [], invalidSelections: [] }
  const observations = await Promise.allSettled(selections.map(selection => resources.readResource({ ref: selection.ref,
    ...(selection.locator === undefined || selection.locator.kind === 'text' || selection.locator.kind === 'anchor'
      ? {} : { locator: selection.locator }) }, signal)))
  const perSource = Math.max(1, Math.floor(maxCharacters / Math.max(1, selections.length)))
  for (const [index, observed] of observations.entries()) {
    signal.throwIfAborted()
    const selection = selections[index]
    if (selection === undefined) continue
    const name = `${selection.ref.rootId}/${selection.ref.sourceId}`
    try {
      if (observed.status === 'rejected') throw observed.reason
      if (!observed.value.ok) throw new Error(observed.value.error.message)
      const reading = observed.value.value
      const sourcePassages = resolveStudyPassages(reading, selection)
      if (sourcePassages.length === 0) throw new Error('No extractable text is available; an image-only PDF needs a transcription provider.')
      const entryFor = (passage: Passage): ResearchContextRead['entries'][number] => ({
        label: `${reading.resource.title} (source ${index + 1})`, text: passage.text,
        // The exact locator is already in the reopenable address; avoid duplicating its quotation in context.
        source: { target: materialSourceAddress(selection.ref, passage.locator) },
      })
      const fits = (passage: Passage): boolean => passage.text.length <= perSource && JSON.stringify(entryFor(passage)).length <= perSource
      const explicit = selection.selectedText !== undefined || selection.locator?.kind === 'text'
        || selection.locator?.kind === 'pdf-page' && selection.locator.quote !== undefined
      const chosen = sourcePassages.flatMap(passage => explicit ? [passage] : excerpts(passage, question, fits))
      let used = 0
      const delivered: Passage[] = []
      for (const passage of chosen) {
        const entry = entryFor(passage)
        const size = JSON.stringify(entry).length
        if (used + size > perSource) continue
        result.entries.push(explicit ? entry : { ...entry, excerpt: (fitsFinal) => {
          const fitted = excerpts(passage, question, part => fitsFinal(entryFor(part)))[0]
          return fitted === undefined ? undefined : entryFor(fitted)
        } })
        delivered.push(passage)
        used += size
      }
      if (used === 0) result.omissions.push(
        `${name}: no complete selected passage fits the source-context budget; use a smaller exact selection or reopen this source.`)
      else if (delivered.length !== sourcePassages.length
        || sourcePassages.some(passage => !delivered.some(part => part.text === passage.text))) {
        result.omissions.push(`${name}: only located excerpts were delivered; the remaining source was not included.`)
      }
      result.omissions.push(...reading.issues.map(issue => `${name}: ${issue}`))
    } catch (error) {
      signal.throwIfAborted()
      const reason = `${name}: ${error instanceof Error ? error.message : 'The selected source is unavailable.'}`
      result.invalidSelections.push(reason)
      result.omissions.push(reason)
    }
  }
  return result
}
