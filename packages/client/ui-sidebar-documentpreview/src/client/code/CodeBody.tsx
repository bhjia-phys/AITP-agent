/** Incrementally highlighted source; the document owner supplies the accumulated text and wrap preference. */
import type { ReactNode } from 'react'
import type { FactoryComponentPropsOf, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { CodeBlock, languageForPath } from '@deepseek-ai/dsh-client-ui-primitives'
import { parseFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import type { DocumentPreviewProps } from '../document/contract.ts'
import type { SourceCodeReaderInput } from './source-reader.ts'
import type {} from './locales.ts'
import css from './CodeBody.module.css'

/** Document owner props and this renderer's localized controls. */
export type CodeBodyProps = DocumentPreviewProps & PropsLocale<'sidebarCodePreview'>

/** @param props - accumulated document contents and framework props. @returns one stable CodeBlock, or no body for byte contents. */
export function CodeBody({ resourceAddress, content, wrap, scrollportRef, t }: CodeBodyProps): ReactNode {
  if (content.kind !== 'text') return null
  const file = parseFileAddress(resourceAddress)
  if (file === undefined) throw new Error(`ui-sidebar-documentpreview: not a file address "${resourceAddress}"`)
  return <CodeSurface text={content.text} path={file.path} streaming={!content.eof}
    wrap={wrap} scrollportRef={scrollportRef} t={t} />
}

/**
 * Render already-authorized source text with the ordinary document code surface.
 * @param props - source contents, highlighting hint and native locale.
 * @returns the shared code surface with local wrap and copy controls.
 */
export function SourceCodeReader(props: FactoryComponentPropsOf<'document.code.reader'>): ReactNode {
  return <CodeSurface {...props} />
}

/** Both file tabs and source owners use the same highlighter, gutter and scrollport. */
function CodeSurface({ text, path, language, lineNumbers = true, streaming = false, wrap, scrollportRef, t }:
  SourceCodeReaderInput & PropsLocale<'sidebarCodePreview'> & {
    readonly streaming?: boolean
    readonly wrap?: boolean
    readonly scrollportRef?: DocumentPreviewProps['scrollportRef']
  }): ReactNode {
  return (
    <div className={css.renderer} data-code-preview data-wrap={wrap}>
      <CodeBlock
        className={css.code}
        contentRef={scrollportRef}
        code={text}
        lang={language ?? (path === undefined ? undefined : languageForPath(path))}
        streaming={streaming}
        wrap={wrap}
        lineNumbers={lineNumbers}
        copyLabel={t('copy')}
        copiedLabel={t('copied')}
        toolbarLabels={{ codeLabel: t('codeBlock.title'), wrapLabel: t('codeBlock.wrap'), unwrapLabel: t('codeBlock.unwrap') }}
      />
    </div>
  )
}
