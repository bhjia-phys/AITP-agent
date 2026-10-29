/** Disposable source observations, retained only by the owning authorized root. */
import { stat } from 'node:fs/promises'
import type { GuardedFiles } from './files.ts'
import { SourceError, sourceFailure } from './files.ts'
import type { ResourceReading, ResourceResult, SourceLocator, SourceRef } from './types.ts'

interface SearchPassage {
  readonly text: string
  readonly page?: number
}
interface CachedBody {
  readonly stamp: string
  readonly bytes: number
  readonly observedAt: string
  readonly passages: readonly SearchPassage[]
  readonly issues: readonly string[]
}

/** A failed body attempt still consumes its observed file-size budget. */
export class BodySearchReadFailure extends Error {
  constructor(readonly bytes: number, cause: unknown) {
    super(sourceFailure(cause).message, { cause })
  }
}

/**
 * Identify formats intentionally inspected by body search; other formats are reported as excluded.
 * @param path - ordinary root-relative filename.
 * @returns whether a guarded text or extracted-PDF observation is supported.
 */
export function searchableSource(path: string): boolean {
  const suffix = path.split('.').at(-1)?.toLowerCase()
  return suffix !== undefined && ['md', 'markdown', 'txt', 'tex', 'bib', 'py', 'ipynb', 'ts', 'tsx', 'js', 'jsx',
    'mjs', 'cjs', 'mts', 'cts', 'json', 'yaml', 'yml', 'toml', 'f77', 'f90', 'f95', 'f03', 'f08', 'f', 'for',
    'c', 'cc', 'cpp', 'cxx', 'h', 'hpp', 'cu', 'cuh', 'rs', 'go', 'jl', 'r', 'm', 'wl', 'wls', 'nb', 'sage', 'sh', 'pdf'].includes(suffix)
}

/** One root's bounded cache; metadata validation does not replace the fresh read used in a conclusion. */
export class SourceBodyCache {
  private readonly entries = new Map<string, CachedBody>()
  private bytes = 0

  constructor(private readonly files: GuardedFiles, private readonly capacity: number) {}

  /**
   * Read or reuse a bounded current file after checking its admitted path and metadata.
   * @param ref - exact source identity.
   * @param path - ordinary root-relative file.
   * @param remaining - aggregate byte budget remaining in this query.
   * @param readPdf - existing domain reader for actually extracted PDF pages.
   * @param signal - source/query cancellation.
   * @returns observed passages, limitations and whether a body read was avoided.
   */
  async read(ref: SourceRef, path: string, remaining: number,
    readPdf: (ref: SourceRef, signal: AbortSignal) => Promise<ResourceResult<ResourceReading>>,
    signal: AbortSignal): Promise<{ readonly body: CachedBody; readonly cached: boolean }> {
    if (!await this.files.discoverable(path, signal)) throw new SourceError('not-found', 'The source is not a current ordinary file.')
    const info = await stat(await this.files.resolvePath(path))
    if (info.size > remaining) throw new SourceError('unavailable', 'This source exceeds the remaining body-search byte budget.')
    const stamp = `${info.size}:${info.mtimeMs}:${info.ctimeMs}`
    const cached = this.entries.get(path)
    if (cached?.stamp === stamp && cached.bytes <= remaining) return { body: cached, cached: true }
    if (!/\.pdf$/i.test(path) && info.size > this.files.maxFileBytes) {
      throw new SourceError('unavailable', 'This source exceeds the configured complete text-reading limit.')
    }
    try {
      let passages: readonly SearchPassage[]
      const issues: string[] = []
      if (/\.pdf$/i.test(path)) {
        const result = await readPdf(ref, signal)
        if (!result.ok) throw new SourceError(result.error.code === 'outcome-unknown' ? 'unavailable' : result.error.code, result.error.message)
        const reading = result.value
        if (reading.body.kind === 'unavailable') throw new SourceError('unavailable', reading.body.detail)
        if (reading.body.kind !== 'pdf') throw new SourceError('unsupported', 'No extracted PDF page text is available for body search.')
        const pdf = reading.body
        passages = pdf.pages.map(page => ({ text: page.text, page: page.page }))
        issues.push(...reading.issues)
        if (pdf.pages.length < pdf.pageCount) issues.push(`PDF body search covers ${pdf.pages.length} of ${pdf.pageCount} physical pages.`)
        if (passages.every(passage => passage.text.trim() === '')) issues.push('No searchable text was extracted; scans and formulas may require page inspection.')
      } else passages = [{ text: await this.files.read(path, signal) }]
      const bytes = Math.max(info.size, passages.reduce((sum, passage) => sum + Buffer.byteLength(passage.text, 'utf8'), 0))
      if (bytes > remaining) throw new SourceError('unavailable', 'Extracted source text exceeds the remaining body-search byte budget.')
      const body: CachedBody = { stamp, bytes, passages, issues, observedAt: new Date().toISOString() }
      if (cached !== undefined) { this.entries.delete(path); this.bytes -= cached.bytes }
      if (this.bytes + bytes > this.capacity || this.entries.size >= this.files.maxFiles) { this.entries.clear(); this.bytes = 0 }
      if (bytes <= this.capacity) { this.entries.set(path, body); this.bytes += bytes }
      return { body, cached: false }
    } catch (error) { throw new BodySearchReadFailure(info.size, error) }
  }
}

/**
 * Locate literal query terms without deriving offsets from case-folded Unicode text.
 * @param text - observed complete file or extracted physical page.
 * @param terms - literal query terms.
 * @param page - physical PDF page, when present.
 * @returns a located excerpt when every term occurs in this passage.
 */
export function bodyMatch(text: string, terms: readonly string[], page?: number): {
  readonly locator: SourceLocator
  readonly excerpt: string
} | undefined {
  const offsets = terms.map(term => text.search(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu')))
  if (offsets.some(offset => offset < 0)) return undefined
  const start = Math.max(0, Math.min(...offsets) - 80)
  const end = Math.min(text.length, Math.max(...offsets) + 160)
  const excerpt = text.slice(start, Math.min(end, start + 480))
  return { excerpt, locator: page === undefined ? { kind: 'text', start, end: start + excerpt.length, quote: excerpt }
    : { kind: 'pdf-page', page, quote: excerpt } }
}
