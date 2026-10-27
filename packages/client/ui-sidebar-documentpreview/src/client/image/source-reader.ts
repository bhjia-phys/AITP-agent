/** Authorized image bytes and caller-retained native viewing preferences. */
import type { ZoomPreference } from '../zoom/types.ts'

/** This reader owns its Blob URL, never filesystem access or a Session. */
export interface SourceImageReaderInput {
  readonly data: Uint8Array<ArrayBuffer>
  readonly name: string
  /** Supported image MIME type; omitted values use the displayed filename's registered suffix. */
  readonly mediaType?: string
  readonly zoom?: ZoomPreference
  readonly onZoomChange?: (zoom: ZoomPreference) => void
  readonly scrollTop?: number
  readonly onScrollTopChange?: (top: number) => void
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotFactoryMap {
    /** Native image/zoom presentation over already-authorized source bytes. */
    'document.image.reader': { scope: 'root'; props: SourceImageReaderInput; locale: 'sidebarImage' }
  }
}
