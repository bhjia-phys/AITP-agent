/** Native Markdown with source-owned navigation and guarded local image observations. */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import type { ResourceLink, SourceRef } from '@deepseek-ai/dsh-research-resources/types'
import { materialBytesAddress, materialSourcePath } from '@deepseek-ai/dsh-research-resources/protocol'
import { parseSourceMarkup } from '@deepseek-ai/dsh-research-resources/markup'
import { materialRefKey } from './store.ts'
import type {} from './resources.ts'
import css from './materials.module.css'

type Props = FactoryComponentPropsOf<'aitp.materials.markdown'>

function decoded(value: string): string {
  try { return decodeURIComponent(value) } catch { return value }
}

/** @param props - observed links and text. @returns the native reader without Session file authority. */
export function MaterialMarkdown(props: Props): ReactNode {
  return <LoadedMarkdown key={materialRefKey(props.reading.resource.ref)} {...props} />
}

function LoadedMarkdown(props: Props): ReactNode {
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(new Map())
  const [failure, setFailure] = useState(false)
  const links = props.reading.resource.links
  const images = useMemo(() => {
    const embedded = new Set(parseSourceMarkup(props.text).images.map(image => decoded(image.href)))
    return links.filter(link => link.target !== undefined && embedded.has(decoded(link.href))
      && /\.(?:png|jpe?g|gif|webp|bmp|ico|svg)$/iu.test(materialSourcePath(link.target.sourceId) ?? ''))
  }, [links, props.text])
  const publish = useCallback((href: string, url: string | undefined) => {
    setUrls((previous) => {
      const next = new Map(previous)
      if (url === undefined) next.delete(href)
      else next.set(href, url)
      return next
    })
  }, [])
  const find = (href: string): ResourceLink | undefined => links.find(link => link.href === href)
    ?? links.find(link => decoded(link.href) === decoded(href))
  return <>
    {images.map((link, index) => link.target === undefined ? null : <ImageAsset key={`${link.href}:${index}`} href={link.href} source={link.target} useResource={props.useResource} publish={publish} />)}
    {failure && <p role="alert" className={css.notice}>{props.t('unresolved')}</p>}
    {props.renderFactorySlot('document.markdown.reader', {
      text: props.text,
      resolveImage: (href) => {
        const exact = urls.get(href)
        if (exact !== undefined) return exact
        const link = find(href)
        return link === undefined ? undefined : urls.get(link.href)
      },
      localLinks: { canOpen: href => find(href) !== undefined, open: (href) => {
        const link = find(href)
        setFailure(link === undefined || !props.onLink(link))
      } },
    })}
  </>
}

/** Use the parent's framework hook; this child introduces no new data authority or cache. */
function ImageAsset({ href, source, useResource, publish }: Pick<Props, 'useResource'> & {
  href: string
  source: SourceRef
  publish: (href: string, url: string | undefined) => void
}): ReactNode {
  const binary = useResource<'aitp-material-bytes'>(materialBytesAddress(source))
  const data = binary.value?.data
  const mediaType = binary.value?.mediaType
  useEffect(() => {
    if (data === undefined || mediaType === undefined || !mediaType.startsWith('image/')) return
    const url = URL.createObjectURL(new Blob([data], { type: mediaType }))
    publish(href, url)
    return () => { publish(href, undefined); URL.revokeObjectURL(url) }
  }, [data, mediaType, href, publish])
  return null
}
