/** Native code presentation over text authorized by its source owner. */
export interface SourceCodeReaderInput {
  readonly text: string
  /** Used only to choose syntax highlighting; no file is read from this path. */
  readonly path?: string
  readonly language?: string
  readonly lineNumbers?: boolean
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotFactoryMap {
    /** The native code surface without Session filesystem authority. */
    'document.code.reader': { scope: 'root'; props: SourceCodeReaderInput; locale: 'sidebarCodePreview' }
  }
}
