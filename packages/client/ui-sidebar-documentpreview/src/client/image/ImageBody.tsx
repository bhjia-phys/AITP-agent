/** Complete image bytes rendered in a shared zoom viewport. */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { FactoryComponentPropsOf, PropsLocale, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { pathPartsOf } from '@deepseek-ai/dsh-util-workspace-path'
import type { DocumentPreviewProps } from '../document/contract.ts'
import { LoadingIndicator } from '../LoadingIndicator.tsx'
import { hostFileOf } from '../rpc.ts'
import { ZoomViewport, zoomSurfaceClass } from '../zoom/ZoomViewport.tsx'
import { DEFAULT_ZOOM, type ZoomInjected, type ZoomStore } from '../zoom/store.ts'
import type { ZoomLabels, ZoomPreference } from '../zoom/types.ts'
import type {} from './locales.ts'
import type {} from './source-reader.ts'
import css from './ImageBody.module.css'

const IMAGE_MEDIA_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
} as const

type ImageMediaType = typeof IMAGE_MEDIA_TYPES[keyof typeof IMAGE_MEDIA_TYPES]

/** Standard document props plus the image renderer's dictionary. */
export type ImageBodyProps = DocumentPreviewProps & PropsLocale<'sidebarImage'> & PropsStore<ZoomStore> & ZoomInjected

type ImageSource =
  | {
    readonly kind: 'ready'
    readonly data: Uint8Array<ArrayBuffer>
    readonly mediaType: ImageMediaType
    readonly url: string
    readonly signal: AbortSignal
  }
  | { readonly kind: 'failed'; readonly data: Uint8Array<ArrayBuffer>; readonly mediaType: ImageMediaType }

/**
 * Resolve a supported filename to the media type assigned to its Blob.
 * @param path - decoded workspace file path.
 * @returns the image media type, or undefined for an unregistered suffix.
 */
export function imageMediaType(path: string): ImageMediaType | undefined {
  const normalized = path.replaceAll('\\', '/')
  const name = normalized.slice(normalized.lastIndexOf('/') + 1).toLowerCase()
  const extension = name.slice(name.lastIndexOf('.') + 1) as keyof typeof IMAGE_MEDIA_TYPES
  return IMAGE_MEDIA_TYPES[extension]
}

/**
 * Present complete image bytes with fit-width and fixed-scale viewing.
 * @param props - document bytes, resource identity, and locale.
 * @returns a rounded image fitted or scaled at its intrinsic aspect ratio.
 */
export function ImageBody(props: ImageBodyProps): ReactNode {
  const { tab } = props.useTabInfo()
  const preference = props.useStore(state => state.byTab[tab.id] ?? DEFAULT_ZOOM)
  const path = useMemo(() => hostFileOf(props.resourceAddress).path, [props.resourceAddress])
  const setPreference = useCallback((value: ZoomPreference): void => {
    props.actions.zoom(tab.id, value)
  }, [props.actions, tab.id])
  useEffect(() => { props.retainTab(tab.id, tab.signal) }, [props.retainTab, tab.id, tab.signal])
  return <ImageSurface data={props.content.kind === 'bytes' ? props.content.data : undefined}
    mediaType={imageMediaType(path)} name={pathPartsOf(path).name} preference={preference} onPreference={setPreference}
    signal={tab.signal} scrollportRef={props.scrollportRef} t={props.t} />
}

const ignoreScrollport = (): void => {}

/**
 * Adapt already-authorized image bytes to the native image and zoom surface.
 * @param props - image identity, bytes and caller-retained viewing preferences.
 * @returns the native image viewer without a Session or filesystem read.
 */
export function SourceImageReader(props: FactoryComponentPropsOf<'document.image.reader'>): ReactNode {
  const { data, onZoomChange } = props
  const [localZoom, setLocalZoom] = useState<{ data: Uint8Array<ArrayBuffer>; value: ZoomPreference }>()
  const preference = props.zoom ?? (localZoom?.data === data ? localZoom.value : DEFAULT_ZOOM)
  const mediaType = props.mediaType === undefined ? imageMediaType(props.name)
    : Object.values(IMAGE_MEDIA_TYPES).find(type => type === props.mediaType)
  const setPreference = useCallback((value: ZoomPreference) => {
    setLocalZoom({ data, value })
    onZoomChange?.(value)
  }, [data, onZoomChange])
  return <ImageSurface data={data} mediaType={mediaType} name={props.name} preference={preference} onPreference={setPreference}
    scrollportRef={ignoreScrollport} scrollTop={props.scrollTop} onScrollTopChange={props.onScrollTopChange} t={props.t} />
}

interface ImageSurfaceInput extends PropsLocale<'sidebarImage'> {
  readonly data: Uint8Array<ArrayBuffer> | undefined
  readonly mediaType: ImageMediaType | undefined
  readonly name: string
  readonly preference: ZoomPreference
  readonly onPreference: (preference: ZoomPreference) => void
  readonly signal?: AbortSignal
  readonly scrollportRef: ImageBodyProps['scrollportRef']
  readonly scrollTop?: number | undefined
  readonly onScrollTopChange?: ((top: number) => void) | undefined
}

/** A single owner creates/revokes image URLs and cancels native viewport gestures. */
function ImageSurface({ data, mediaType, name, preference, onPreference, signal,
  scrollportRef, scrollTop, onScrollTopChange, t }: ImageSurfaceInput): ReactNode {
  const [source, setSource] = useState<ImageSource>()
  useEffect(() => {
    if (data === undefined || mediaType === undefined) return
    const lifetime = new AbortController()
    let url: string | undefined
    try {
      url = URL.createObjectURL(new Blob([data], { type: mediaType }))
      setSource({ kind: 'ready', data, mediaType, url, signal: lifetime.signal })
    } catch {
      setSource({ kind: 'failed', data, mediaType })
    }
    return () => {
      lifetime.abort()
      if (url !== undefined) URL.revokeObjectURL(url)
    }
  }, [data, mediaType])
  if (data === undefined || mediaType === undefined) return <p className={css.status} role="alert">{t('unsupported')}</p>
  if (source?.data !== data || source.mediaType !== mediaType) return <LoadingIndicator label={t('loading')} />
  if (source.kind === 'failed') return <p className={css.status} role="alert">{t('failed')}</p>
  const labels: ZoomLabels = {
    controls: t('zoomControls'), menu: t('zoomMenu'), out: t('zoomOut'), into: t('zoomIn'),
    fitWidth: t('zoomFitWidth'), value: percent => t('zoomValue', { percent }),
  }
  return <LoadedImage key={source.url} url={source.url} name={name} preference={preference}
    onPreference={onPreference} labels={labels} signal={source.signal} scrollportRef={scrollportRef}
    scrollTop={scrollTop} onScrollTopChange={onScrollTopChange} externalSignal={signal} t={t} />
}

/** SVG stays in the browser's static image mode because its bytes only reach an img Blob URL. */
function LoadedImage({ url, name, preference, onPreference, labels, signal, externalSignal,
  scrollportRef, scrollTop, onScrollTopChange, t }: {
  readonly url: string
  readonly name: string
  readonly preference: ZoomPreference
  readonly onPreference: (preference: ZoomPreference) => void
  readonly labels: ZoomLabels
  readonly signal: AbortSignal
  readonly externalSignal: AbortSignal | undefined
  readonly scrollportRef: ImageBodyProps['scrollportRef']
  readonly t: ImageBodyProps['t']
  readonly scrollTop: number | undefined
  readonly onScrollTopChange: ((top: number) => void) | undefined
}): ReactNode {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [width, setWidth] = useState<number>()
  const stopped = useMemo(() => externalSignal === undefined ? signal : AbortSignal.any([signal, externalSignal]), [signal, externalSignal])
  const [scrollport, setScrollport] = useState<HTMLElement | null>(null)
  const restored = useRef(false)
  const bindScrollport = useCallback((node: HTMLElement | null) => {
    setScrollport(node)
    scrollportRef(node)
  }, [scrollportRef])
  useEffect(() => {
    if (state !== 'ready' || scrollport === null || stopped.aborted) return
    if (!restored.current) {
      if (scrollTop !== undefined && Number.isFinite(scrollTop) && scrollTop >= 0) scrollport.scrollTop = scrollTop
      restored.current = true
    }
    const report = () => { if (!stopped.aborted) onScrollTopChange?.(scrollport.scrollTop) }
    scrollport.addEventListener('scroll', report, { passive: true })
    return () => { scrollport.removeEventListener('scroll', report) }
  }, [state, scrollport, scrollTop, onScrollTopChange, stopped])
  return <ZoomViewport preference={preference} intrinsicWidth={width} horizontalInset={24}
    labels={labels} signal={stopped} scrollportRef={bindScrollport} onPreference={onPreference}>
    <div className={css.frame} data-image-preview>
      {state === 'loading' && <LoadingIndicator label={t('loading')} />}
      {state === 'failed' && <p className={css.status} role="alert">{t('failed')}</p>}
      <div className={`${css.surface} ${zoomSurfaceClass}`} data-document-zoom-surface
        style={{ '--document-zoom-width': `${width ?? 0}px` } as CSSProperties} hidden={state !== 'ready'}>
        <img
          className={css.image}
          src={url}
          alt={t('preview', { name })}
          decoding="async"
          draggable={false}
          referrerPolicy="no-referrer"
          onLoad={(event) => { setWidth(event.currentTarget.naturalWidth); setState('ready') }}
          onError={() => { setState('failed') }}
        />
      </div>
    </div>
  </ZoomViewport>
}
