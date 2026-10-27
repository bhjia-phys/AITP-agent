/** Page feedback is based on the actual scrollport, independently from raster prefetch. */

/** One physical page's current viewport geometry. */
export interface PdfPageRect { readonly page: number; readonly top: number; readonly bottom: number }

/**
 * Choose the page at the reading line near the viewport's top, or the nearest visible page in a gap.
 * @param pages - physical pages in document order with current rendered positions.
 * @param viewport - actual scrollport bounds, excluding offscreen prefetch margins.
 * @returns the visible physical page, or undefined when layout is not measurable.
 */
export function visiblePdfPage(pages: readonly PdfPageRect[],
  viewport: { readonly top: number; readonly bottom: number }): number | undefined {
  const height = viewport.bottom - viewport.top
  if (height <= 0) return undefined
  const line = viewport.top + Math.min(100, height / 4)
  let nearest: PdfPageRect | undefined
  let distance = Infinity
  for (const page of pages) {
    if (page.bottom <= viewport.top || page.top >= viewport.bottom || page.bottom <= page.top) continue
    if (page.top <= line && page.bottom > line) return page.page
    const next = Math.min(Math.abs(page.top - line), Math.abs(page.bottom - line))
    if (next < distance) { nearest = page; distance = next }
  }
  return nearest?.page
}
