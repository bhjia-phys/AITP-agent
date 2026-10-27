/** Located PDF text readings through the maintained PDF.js Node entry. */
import type { ResourceBody, SourceLocator } from '@deepseek-ai/dsh-research-resources'

/** Bounds supplied by the literature plugin's validated configuration. */
export interface PdfReadLimits {
  readonly maxPages: number
  readonly maxTextCharacters: number
  readonly maxInlineBytes: number
}

async function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted()
  return new Promise<T>((resolve, reject) => {
    const aborted = (): void => { reject(signal.reason instanceof Error ? signal.reason : new DOMException('The PDF reading was cancelled.', 'AbortError')) }
    signal.addEventListener('abort', aborted, { once: true })
    void operation.then((value) => { signal.removeEventListener('abort', aborted); resolve(value) }, (error: unknown) => {
      signal.removeEventListener('abort', aborted)
      reject(error instanceof Error ? error : new Error(String(error)))
    })
    if (signal.aborted) aborted()
  })
}

/**
 * Read actual PDF pages without inventing an edition or treating physical pages as printed pages.
 * @param bytes - bounded bytes already admitted by the shared source authority.
 * @param locator - optional one-based page and exact extracted quote.
 * @param limits - bounds for the initial page window and complete extracted text.
 * @param signal - cancellation of loading, extraction and resource lifetime.
 * @returns page text and optional original PDF data, or an explicit unsupported/ambiguous reading.
 */
export async function readPdf(
  bytes: Uint8Array, locator: SourceLocator | undefined, limits: PdfReadLimits, signal: AbortSignal,
): Promise<ResourceBody> {
  if (locator !== undefined && locator.kind !== 'pdf-page') return { kind: 'unavailable', reason: 'unsupported', detail: 'This PDF reader needs a physical PDF page locator.' }
  if (locator?.region !== undefined) return { kind: 'unavailable', reason: 'unsupported',
    detail: 'PDF region extraction is unavailable; use the exact page and extracted text quote.' }
  signal.throwIfAborted()
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, disableFontFace: true,
    useWorkerFetch: false, verbosity: 0 })
  try {
    const document = await abortable(task.promise, signal)
    const selectedPage = locator?.page
    if (selectedPage !== undefined && (!Number.isInteger(selectedPage) || selectedPage < 1 || selectedPage > document.numPages)) {
      return { kind: 'unavailable', reason: 'missing', detail: 'The selected physical page does not exist in this PDF.' }
    }
    const labels = await abortable(document.getPageLabels(), signal)
    const pages: { page: number; text: string; pageLabel?: string }[] = []
    let characters = 0
    const first = selectedPage ?? 1
    const last = selectedPage ?? Math.min(document.numPages, limits.maxPages)
    for (let pageNumber = first; pageNumber <= last; pageNumber++) {
      signal.throwIfAborted()
      const page = await abortable(document.getPage(pageNumber), signal)
      try {
        const content = await abortable(page.getTextContent(), signal)
        const text = content.items.flatMap(item => 'str' in item ? [item.str, item.hasEOL ? '\n' : ' '] : []).join('').trim()
        characters += text.length
        if (characters > limits.maxTextCharacters) return { kind: 'unavailable', reason: 'too-large', detail: 'The requested PDF text exceeds the configured extraction bound. Select a smaller page or passage.' }
        if (locator?.quote !== undefined) {
          const at = text.indexOf(locator.quote)
          if (at < 0) return { kind: 'unavailable', reason: 'missing', detail: 'The selected quote does not occur in the current extracted page text.' }
          if (locator.quote.length === 0 || text.indexOf(locator.quote, at + 1) >= 0) return { kind: 'unavailable', reason: 'ambiguous', detail: 'The selected quote does not identify one occurrence on the page.' }
        }
        const label = labels?.[pageNumber - 1]
        pages.push({ page: pageNumber, text, ...(label === undefined ? {} : { pageLabel: label }) })
      } finally { page.cleanup() }
    }
    return { kind: 'pdf', pageCount: document.numPages, pages,
      ...(bytes.byteLength <= limits.maxInlineBytes ? { dataBase64: Buffer.from(bytes).toString('base64') } : {}) }
  } finally { await task.destroy() }
}
