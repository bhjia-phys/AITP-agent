/** Session-independent Markdown navigation and authorized image resolution. */
import type { MarkdownDelegate } from '@deepseek-ai/dsh-client-ui-primitives'

/** Source owners retain file authority, asynchronous reads and navigation state. */
export interface SourceMarkdownReaderInput {
  readonly text: string
  readonly streaming?: boolean
  /** Resolve authored local image destinations only to already-authorized absolute or Blob URLs. */
  readonly resolveImage?: (destination: string) => string | undefined
  readonly onOpenFile?: MarkdownDelegate['openFile']
  readonly resourceLinks?: MarkdownDelegate['resourceLinks']
  readonly localLinks?: MarkdownDelegate['localLinks']
  readonly onOpenExternalLink?: MarkdownDelegate['openExternalLink']
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotFactoryMap {
    /** Native Markdown/frontmatter presentation with source-owned navigation. */
    'document.markdown.reader': { scope: 'root'; props: SourceMarkdownReaderInput; locale: 'documentMarkdown' }
  }
}
