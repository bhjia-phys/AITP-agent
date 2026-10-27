/** One retained Markdown renderer over the document owner's accumulated text. */
import { lazy, Suspense, useMemo } from 'react'
import type { ReactNode } from 'react'
import { MarkdownDelegateProvider, MarkdownText, type MarkdownLabels, type MarkdownPathImages } from '@deepseek-ai/dsh-client-ui-primitives'
import type { FactoryComponentPropsOf, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { DocumentPreviewProps } from '../document/contract.ts'
import { splitFrontmatter } from './frontmatter.ts'
import type { FrontmatterFieldsProps } from './frontmatter-fields.tsx'
import { markdownImageUrl } from './path-images.ts'
import type { SourceMarkdownReaderInput } from './source-reader.ts'
import type {} from './locales.ts'
import css from './MarkdownBody.module.css'

/** Show the verbatim frontmatter when the field-list chunk cannot load. */
function FrontmatterFallback({ fallback }: FrontmatterFieldsProps): ReactNode {
  return fallback
}

const FrontmatterFields = lazy(() => import('./frontmatter-fields.tsx').then(
  module => ({ default: module.FrontmatterFields }),
  // The failed chunk only removes the field layout; the body and verbatim metadata stay usable.
  () => ({ default: FrontmatterFallback }),
))

/** Standard document inputs and this implementation's locale. */
export type MarkdownBodyProps = DocumentPreviewProps & PropsLocale<'documentMarkdown'>

/**
 * Render one accumulated document; EOF completes the primitive's full parse.
 * A leading YAML frontmatter block renders as a field list instead of Markdown; its
 * verbatim source stands in while the field-list chunk loads or when it fails.
 * @param props - owner-loaded contents and localized primitive labels.
 * @returns Markdown content, or nothing for a non-text delivery.
 */
export function MarkdownBody({ content, resourceAddress, useResource, t }: MarkdownBodyProps): ReactNode {
  const absolutePath = useResource<'file'>(resourceAddress).value?.absolutePath
  const resolveImage = useMemo(() => (value: string) => markdownImageUrl(document.baseURI, absolutePath, value), [absolutePath])
  if (content.kind !== 'text') return null
  return <MarkdownSurface text={content.text} streaming={!content.eof} resolveImage={resolveImage} t={t} />
}

/**
 * Render native Markdown without granting a source another Session's file authority.
 * @param props - source text, authorized image URLs and explicit navigation callbacks.
 * @returns the same native Markdown/frontmatter body with a source-owned navigation boundary.
 */
export function SourceMarkdownReader(props: FactoryComponentPropsOf<'document.markdown.reader'>): ReactNode {
  const fileImages = useMemo(() => ({
    resolve: (path: string) => props.resolveImage?.(path),
    labels: { dialog: props.t('image.dialog'), close: props.t('image.close'), open: props.t('image.open'),
      loading: props.t('image.loading'), failed: props.t('image.failed') },
  }), [props.resolveImage, props.t])
  return <MarkdownDelegateProvider openFile={props.onOpenFile} resourceLinks={props.resourceLinks}
    localLinks={props.localLinks} fileImages={fileImages}
    openExternalLink={props.onOpenExternalLink}>
    <MarkdownSurface {...props} />
  </MarkdownDelegateProvider>
}

/** Shared actual body for ordinary file previews and root source readers. */
function MarkdownSurface({ text, streaming = false, resolveImage, t }:
  SourceMarkdownReaderInput & PropsLocale<'documentMarkdown'>): ReactNode {
  const pathImages = useMemo<MarkdownPathImages | undefined>(
    () => resolveImage === undefined ? undefined : { resolve: resolveImage }, [resolveImage])
  const copyLabel = t('code.copy')
  const copiedLabel = t('code.copied')
  const footnotes = t('footnotes')
  const codeLabel = t('codeBlock.title')
  const wrapLabel = t('codeBlock.wrap')
  const unwrapLabel = t('codeBlock.unwrap')
  const labels = useMemo<MarkdownLabels>(() => ({
    code: { copyLabel, copiedLabel, toolbarLabels: { codeLabel, wrapLabel, unwrapLabel } }, footnotes,
  }), [copyLabel, copiedLabel, footnotes, codeLabel, wrapLabel, unwrapLabel])
  const split = useMemo(() => splitFrontmatter(text), [text])
  return (
    <div className={css.document} data-document-markdown>
      {split === undefined ? null : <FrontmatterBox source={split.source} />}
      <MarkdownText text={split?.body ?? text} streaming={streaming} labels={labels} pathImages={pathImages} />
    </div>
  )
}

/**
 * Frame one frontmatter block and choose its field list or verbatim source.
 * @param props - YAML between the frontmatter delimiters.
 * @returns the metadata box; it collapses when the document has no content.
 */
function FrontmatterBox({ source }: { source: string }): ReactNode {
  const verbatim = <pre className={css.frontmatterSource}>{source}</pre>
  return (
    <div className={css.frontmatter} data-document-frontmatter>
      <Suspense fallback={verbatim}><FrontmatterFields source={source} fallback={verbatim} /></Suspense>
    </div>
  )
}
