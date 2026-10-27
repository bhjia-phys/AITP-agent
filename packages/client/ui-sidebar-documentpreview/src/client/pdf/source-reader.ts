/** Root-capable PDF presentation accepts authorized bytes without borrowing a Session or file tab. */
import type { ZoomPreference } from '../zoom/types.ts'

/** Viewing state belongs to the caller; PDF.js receives only a copied byte buffer. */
export interface SourcePdfReaderInput {
  readonly data: Uint8Array<ArrayBuffer>
  /** Physical page to restore or navigate to; viewing feedback does not reissue navigation. */
  readonly page: number
  /** Reports the physical page actually occupying the reading viewport, never a prefetched page. */
  readonly onPageChange: (page: number) => void
  readonly zoom?: ZoomPreference
  readonly onZoomChange?: (zoom: ZoomPreference) => void
  /** Optional exact scroll restoration on mount; subsequent page changes navigate to that page's top. */
  readonly scrollTop?: number
  readonly onScrollTopChange?: (top: number) => void
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotFactoryMap {
    /** The native continuous PDF reader, supplied with already-authorized bytes. */
    'document.pdf.reader': { scope: 'root'; props: SourcePdfReaderInput; locale: 'sidebarPdf' }
  }
}
