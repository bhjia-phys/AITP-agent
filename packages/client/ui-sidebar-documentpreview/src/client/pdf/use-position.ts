/** Retained reading position without treating adjacent raster prefetch as page navigation. */
import { useCallback, useEffect, useRef, useState, type RefCallback } from 'react'
import { visiblePdfPage } from './position.ts'

interface PositionInput {
  readonly data: Uint8Array<ArrayBuffer> | undefined
  readonly page: number
  readonly pageCount: number | undefined
  readonly signal: AbortSignal | undefined
  readonly navigate: boolean
  readonly scrollTop: number | undefined
  readonly scrollportRef: RefCallback<HTMLElement>
  readonly onPageChange: (page: number) => void
  readonly onScrollTopChange: ((top: number) => void) | undefined
}

interface Position {
  readonly data: Uint8Array<ArrayBuffer> | undefined
  inputPage: number
  reportedPage: number
  pending: number | undefined
  restoredTop: number | undefined
  reportedTop: number | undefined
  documentSignal: AbortSignal | undefined
  explicitViewport: { readonly scrollTop: number; readonly height: number; readonly contentHeight: number } | undefined
}

/** Bind the native scrollport and page-render notifications to the caller's retained position. */
export function usePdfPosition(input: PositionInput) {
  const body = useRef<HTMLElement>(null)
  const [scrollport, setScrollport] = useState<HTMLElement | null>(null)
  const [layout, setLayout] = useState(0)
  const state = useRef<Position>()
  if (state.current?.data !== input.data || state.current === undefined) {
    state.current = { data: input.data, inputPage: input.page, reportedPage: input.page,
      pending: input.navigate ? input.page : undefined, restoredTop: input.scrollTop, reportedTop: undefined,
      documentSignal: undefined, explicitViewport: undefined }
  } else if (state.current.inputPage !== input.page) {
    state.current.inputPage = input.page
    // A controlled owner echoes observations. Only a different request is a navigation.
    if (input.navigate && state.current.reportedPage !== input.page) {
      state.current.pending = input.page
      state.current.restoredTop = undefined
    }
  }
  const position = state.current
  if (input.signal !== undefined && position.documentSignal !== input.signal) {
    if (position.documentSignal !== undefined && input.navigate) {
      position.pending = input.page
      position.restoredTop = input.scrollTop ?? position.reportedTop
    }
    position.documentSignal = input.signal
  }
  const externalRef = input.scrollportRef
  const bindScrollport = useCallback((node: HTMLElement | null) => {
    setScrollport(node)
    externalRef(node)
  }, [externalRef])
  const pageReady = useCallback(() => { setLayout(value => value + 1) }, [])
  const { onPageChange, onScrollTopChange, signal } = input
  const report = useCallback(() => {
    if (scrollport === null || state.current !== position || signal?.aborted === true || position.pending !== undefined) return
    const bounds = scrollport.getBoundingClientRect()
    // Hidden native tabs have no reading line and cannot invalidate the explicit page they retain.
    if (bounds.bottom <= bounds.top) return
    const explicit = position.explicitViewport
    if (explicit !== undefined) {
      if (scrollport.scrollTop === explicit.scrollTop && scrollport.clientHeight === explicit.height
        && scrollport.scrollHeight === explicit.contentHeight) return
      const maximumTop = Math.max(0, scrollport.scrollHeight - scrollport.clientHeight)
      const previousMaximum = Math.max(0, explicit.contentHeight - explicit.height)
      const target = body.current?.querySelector<HTMLElement>(`[data-pdf-page="${position.reportedPage}"]`)?.getBoundingClientRect()
      // Lazy page geometry and dock resizing can move the bottom limit after navigation. While the
      // requested page is still clamped there, that layout adjustment is not a choice of another page.
      if (target !== undefined && explicit.scrollTop >= previousMaximum - 1 && scrollport.scrollTop >= maximumTop - 1
        && scrollport.scrollTop + target.top - bounds.top > maximumTop
        && target.bottom > bounds.top && target.top < bounds.bottom) {
        position.explicitViewport = { scrollTop: scrollport.scrollTop,
          height: scrollport.clientHeight, contentHeight: scrollport.scrollHeight }
        position.reportedTop = scrollport.scrollTop
        onScrollTopChange?.(scrollport.scrollTop)
        return
      }
      position.explicitViewport = undefined
    }
    const pages = Array.from(body.current?.querySelectorAll<HTMLElement>('[data-pdf-page]') ?? []).map((node) => {
      const rect = node.getBoundingClientRect()
      return { page: Number(node.dataset.pdfPage), top: rect.top, bottom: rect.bottom }
    })
    const page = visiblePdfPage(pages, bounds)
    if (page !== undefined && page !== position.reportedPage) {
      position.reportedPage = page
      onPageChange(page)
    }
    if (page !== undefined && scrollport.scrollTop !== position.reportedTop) {
      position.reportedTop = scrollport.scrollTop
      onScrollTopChange?.(scrollport.scrollTop)
    }
  }, [position, scrollport, signal, onPageChange, onScrollTopChange])

  useEffect(() => {
    if (scrollport === null || input.pageCount === undefined || signal?.aborted === true) return
    const requested = position.pending
    if (requested !== undefined) {
      const page = Math.max(1, Math.min(input.pageCount, Number.isSafeInteger(requested) ? requested : 1))
      const target = body.current?.querySelector<HTMLElement>(`[data-pdf-page="${page}"]`)
      if (target?.dataset.pdfPageReady !== 'true') return
      const top = position.restoredTop
      const alignedTop = scrollport.scrollTop + target.getBoundingClientRect().top - scrollport.getBoundingClientRect().top
      scrollport.scrollTop = top !== undefined && Number.isFinite(top) && top >= 0 ? top : alignedTop
      position.pending = undefined
      position.restoredTop = undefined
      // Short documents and a clamped final page cannot reach the reading line. Retain the explicit
      // page choice until the person scrolls or the viewport changes, including on a retained return.
      const maximumTop = Math.max(0, scrollport.scrollHeight - scrollport.clientHeight)
      if (alignedTop > maximumTop && scrollport.scrollTop >= maximumTop - 1
        || scrollport.scrollHeight <= scrollport.clientHeight) {
        position.reportedPage = page
        position.explicitViewport = { scrollTop: scrollport.scrollTop,
          height: scrollport.clientHeight, contentHeight: scrollport.scrollHeight }
        onScrollTopChange?.(scrollport.scrollTop)
      }
    }
    report()
  }, [input.page, input.pageCount, layout, position, scrollport, signal, report, onScrollTopChange])

  useEffect(() => {
    if (scrollport === null || input.pageCount === undefined) return
    scrollport.addEventListener('scroll', report, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(report)
    observer?.observe(scrollport)
    if (body.current !== null) observer?.observe(body.current)
    report()
    return () => { scrollport.removeEventListener('scroll', report); observer?.disconnect() }
  }, [scrollport, input.pageCount, report])

  return { body, bindScrollport, pageReady }
}
