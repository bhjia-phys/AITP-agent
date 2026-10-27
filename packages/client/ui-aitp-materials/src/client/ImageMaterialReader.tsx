/** Research actions around the native image/zoom reader, using only guarded source bytes. */
import { useState, type ReactNode } from 'react'
import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots'
import type { ZoomPreference } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import { Button, IconLoadingOutlineRegular, IconNewChatOutlineRegular, IconPlusOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { materialBytesAddress, materialSourcePath } from '@deepseek-ai/dsh-research-resources/protocol'
import { MaterialReaderHeader, MaterialReaderLinks } from './MaterialReaderHeader.tsx'
import type {} from './resources.ts'
import css from './materials.module.css'

/** @param props - observed source and retained image position. @returns a native image reader. */
export function ImageMaterialReader(props: FactoryComponentPropsOf<'aitp.materials.reader'>): ReactNode {
  const { reading, t } = props
  const dock = props.presentation === 'dock'
  const [zoom, setZoom] = useState<ZoomPreference>()
  const [scrollTop, setScrollTop] = useState<number>()
  const [failure, setFailure] = useState(false)
  const binary = props.useResource<'aitp-material-bytes'>(materialBytesAddress(reading.resource.ref))
  const value = binary.value
  const selection = { ref: reading.resource.ref }
  const retainedZoom = props.imagePosition?.zoom ?? zoom
  const retainedScroll = props.imagePosition?.scrollTop ?? scrollTop
  return <article className={dock ? `${css.reader} ${css.dockReader}` : css.reader}
    data-material-presentation={props.presentation} data-material-domain={reading.resource.domain}>
    {!dock && <MaterialReaderHeader {...props} />}
    {(props.onDiscuss !== undefined || props.onSelect !== undefined) && <div className={css.readerActions}>
      {props.onDiscuss !== undefined && <Button size="sm" variant="primary" icon={<IconNewChatOutlineRegular />}
        onClick={() => { props.onDiscuss?.(selection) }}>{t('discussSource')}</Button>}
      {props.onSelect !== undefined && <Button size="sm" variant="outline" icon={<IconPlusOutlineRegular />}
        onClick={() => { props.onSelect?.(selection) }}>{t('useSource')}</Button>}
    </div>}
    {value !== undefined && binary.status === 'failed' && <p role="alert" className={css.notice}>
      {t('imageUnavailable')} {binary.failure?.message}
    </p>}
    {value === undefined ? <div className={css.loading} role={binary.status === 'loading' ? 'status' : 'alert'}>
      {binary.status === 'loading' ? <IconLoadingOutlineRegular aria-label={t('loading')} /> : <p>{t('imageUnavailable')} {binary.failure?.message}</p>}
    </div> : <div className={css.pdfViewport}>
      {props.renderFactorySlot('document.image.reader', {
        data: value.data, mediaType: value.mediaType,
        name: materialSourcePath(reading.resource.ref.sourceId) ?? reading.resource.title,
        ...retainedZoom === undefined ? {} : { zoom: retainedZoom },
        onZoomChange: (next) => { setZoom(next); props.imagePosition?.onZoomChange?.(next) },
        ...retainedScroll === undefined ? {} : { scrollTop: retainedScroll },
        onScrollTopChange: (top) => { setScrollTop(top); props.imagePosition?.onScrollTopChange?.(top) },
      })}
    </div>}
    {!dock && <p className={css.muted}>{t('imageContext')}</p>}
    {failure && <p role="alert" className={css.notice}>{t('unresolved')}</p>}
    {!dock && <MaterialReaderLinks {...props} onFailure={() => { setFailure(true) }} />}
    <details className={css.observation}><summary>{t('readingInfo')}</summary>
      {dock && <>
        <MaterialReaderHeader {...props} />
        <p className={css.muted}>{t('imageContext')}</p>
        <MaterialReaderLinks {...props} onFailure={() => { setFailure(true) }} />
      </>}
      <p className={css.muted}>{t('path')}: {materialSourcePath(reading.resource.ref.sourceId)}</p>
      <p className={css.muted}>{t('observed', { time: reading.observedAt })}</p>
    </details>
  </article>
}
