/** Markdown implementation labels and primitive chrome. */
export const zh = {
  'viewer.label': 'Markdown',
  'code.copy': '复制',
  'code.copied': '已复制',
  'footnotes': '脚注',
  'image.dialog': '图片预览',
  'image.close': '关闭图片预览',
  'image.open': '打开图片',
  'image.loading': '正在加载图片…',
  'image.failed': '图片无法显示',
} satisfies Record<string, string>

/** Markdown namespace keys. */
export type MarkdownPreviewKey = keyof typeof zh

/** English labels, paired with the Chinese key set. */
export const en = {
  'viewer.label': 'Markdown',
  'code.copy': 'Copy',
  'code.copied': 'Copied',
  'footnotes': 'Footnotes',
  'image.dialog': 'Image preview',
  'image.close': 'Close image preview',
  'image.open': 'Open image',
  'image.loading': 'Loading image…',
  'image.failed': 'Image could not be displayed',
} satisfies Record<MarkdownPreviewKey, string>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Markdown document renderer and its code/footnote controls. */
    documentMarkdown: MarkdownPreviewKey
  }
}
