/** Research scope and exact page citations around the same PDF reader used by native documents. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ZoomPreference } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import { Button, IconLoadingOutlineRegular, IconNewChatOutlineRegular, IconPlusOutlineRegular,
  IconChevronLeftOutlineRegular, IconChevronRightOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { materialBytesAddress, materialSourceAddress } from '@deepseek-ai/dsh-research-resources/protocol'
import { selectMaterialPassage } from './selection.ts'
import { MaterialReaderHeader, MaterialReaderLinks } from './MaterialReaderHeader.tsx'
import { MaterialSourceDetails, type LocatedMaterialReaderProps } from './MaterialSourceDetails.tsx'
import type {} from './resources.ts'
import css from './materials.module.css'

/** @param node - selected text endpoint. @returns its physical page in the native PDF text layer. */
function selectedPage(node: Node | null): number | undefined {
  const element = node instanceof Element ? node : node?.parentElement
  const value = element?.closest<HTMLElement>('[data-pdf-page]')?.dataset.pdfPage
  return value !== undefined && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : undefined
}

/** @param props - authorized source and retained view callbacks. @returns native PDF reading with explicit research actions. */
export function PdfMaterialReader(props: LocatedMaterialReaderProps): ReactNode {
  const { reading, t } = props
  const { resource, body } = reading
  const dock = props.presentation === 'dock'
  const source = useRef<HTMLElement>(null)
  const [localPage, setLocalPage] = useState(reading.locator?.kind === 'pdf-page' ? reading.locator.page : 1)
  const [localZoom, setLocalZoom] = useState<ZoomPreference>()
  const [localScroll, setLocalScroll] = useState<number>()
  const [failure, setFailure] = useState<string | null>(null)
  const [pendingQuote, setPendingQuote] = useState<{ page: number; text: string }>()
  const consumedQuote = useRef<typeof pendingQuote>()
  const [download, setDownload] = useState<string>()
  const pageCount = body.kind === 'pdf' ? body.pageCount : 1
  const page = Math.max(1, Math.min(pageCount, props.pdfPosition?.page ?? localPage))
  const binary = props.useResource<'aitp-material-bytes'>(materialBytesAddress(resource.ref))
  const pageReading = props.useResource<'aitp-material-source'>(materialSourceAddress(resource.ref, { kind: 'pdf-page', page: pendingQuote?.page ?? page }, 'literature'))
  const observedPage = pageReading.value?.body.kind === 'pdf'
    && pageReading.value.locator?.kind === 'pdf-page' && pageReading.value.locator.page === page
    ? pageReading.value : undefined
  const text = observedPage?.body.kind === 'pdf' ? observedPage.body.pages.find(item => item.page === page)?.text
    : body.kind === 'pdf' ? body.pages.find(item => item.page === page)?.text : undefined
  const data = binary.value?.data
  const zoom = props.pdfPosition?.zoom ?? localZoom
  const scrollTop = props.pdfPosition?.scrollTop ?? localScroll
  useEffect(() => {
    if (data === undefined) { setDownload(undefined); return }
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
    setDownload(url)
    return () => { URL.revokeObjectURL(url) }
  }, [data])
  const choosePage = (next: number): void => {
    if (page === next) return
    setFailure(null)
    if (props.pdfPosition === undefined) setLocalPage(next)
    else props.pdfPosition.onChange(next)
  }
  const quote = (): void => {
    const selection = globalThis.getSelection()
    if (selection?.anchorNode == null || selection.focusNode === null
      || !source.current?.contains(selection.anchorNode) || !source.current.contains(selection.focusNode)) {
      setFailure(t('unlocated')); return
    }
    // Extracted-text disclosure belongs to the displayed page; native ranges must stay on one physical page.
    const startPage = selectedPage(selection.anchorNode)
    const endPage = selectedPage(selection.focusNode)
    if (startPage === undefined || endPage === undefined) { setFailure(t('unlocated')); return }
    if (startPage !== endPage) { setFailure(t('pdfOnePage')); return }
    setFailure(null)
    setPendingQuote({ page: startPage, text: selection.toString() })
  }
  useEffect(() => {
    if (pendingQuote === undefined || consumedQuote.current === pendingQuote) return
    if (pageReading.status === 'loading') return
    if (pageReading.status === 'failed' || pageReading.status === 'none') {
      consumedQuote.current = pendingQuote
      setPendingQuote(undefined)
      setFailure(t('pdfPageUnavailable'))
      return
    }
    const snapshot = pageReading.value
    if (snapshot?.locator?.kind !== 'pdf-page' || snapshot.locator.page !== pendingQuote.page) return
    consumedQuote.current = pendingQuote
    setPendingQuote(undefined)
    const selected = selectMaterialPassage(snapshot, pendingQuote.text, pendingQuote.page)
    if (selected === undefined) { setFailure(t('unlocated')); return }
    setFailure(null)
    props.onSelect?.(selected)
  }, [pendingQuote, pageReading.status, pageReading.value, props.onSelect, t])

  return <article ref={source} className={dock ? `${css.reader} ${css.dockReader}` : css.reader}
    data-material-presentation={props.presentation} data-material-domain={resource.domain} tabIndex={0} aria-label={resource.title}
    onKeyDown={(event) => {
      if (event.target !== event.currentTarget || event.key !== 'PageDown' && event.key !== 'PageUp') return
      event.preventDefault()
      choosePage(Math.max(1, Math.min(pageCount, page + (event.key === 'PageDown' ? 1 : -1))))
    }}>
    {!dock && <MaterialReaderHeader {...props} />}
    <MaterialSourceDetails {...props} />
    {(props.onDiscuss !== undefined || props.onSelect !== undefined) && <div className={css.readerActions}>
      {props.onDiscuss !== undefined && <Button size="sm" variant="primary" icon={<IconNewChatOutlineRegular />}
        onClick={() => { props.onDiscuss?.({ ref: resource.ref, locator: { kind: 'pdf-page', page } }) }}>{t('discussPage')}</Button>}
      {props.onSelect !== undefined && <>
        <Button size="sm" variant="outline" icon={<IconPlusOutlineRegular />} onClick={() => {
          props.onSelect?.({ ref: resource.ref, ...reading.locator === undefined ? {} : { locator: reading.locator } })
        }}>{t('useSource')}</Button>
        <Button size="sm" variant="ghost" disabled={pendingQuote !== undefined} onClick={quote}>{t('quote')}</Button>
      </>}
    </div>}
    {pendingQuote !== undefined && <p role="status" className={css.muted}>{t('pdfQuoteLoading')}</p>}
    {failure !== null && <p role="alert" className={css.notice}>{failure}</p>}
    {!dock && <div className={css.toolbar}>
      <Button size="sm" variant="outline" icon={<IconChevronLeftOutlineRegular />} disabled={page <= 1}
        onClick={() => { choosePage(page - 1) }}>{t('previousPage')}</Button>
      <span>{t('pdfPage', { page, count: pageCount })}</span>
      <Button size="sm" variant="outline" icon={<IconChevronRightOutlineRegular />} disabled={page >= pageCount}
        onClick={() => { choosePage(page + 1) }}>{t('nextPage')}</Button>
      {download !== undefined && <a href={download} download={resource.title}>{t('downloadPdf')}</a>}
    </div>}
    <section className={dock ? `${css.source} ${css.dockBinary}` : css.source}>
      {data === undefined ? <div className={css.loading} role={binary.status === 'loading' ? 'status' : 'alert'}>
        {binary.status === 'loading' ? <IconLoadingOutlineRegular size={24} /> : <>{t('pdfUnavailable')} {binary.failure?.message ?? t('disconnected')}</>}
      </div> : <>
        {binary.status === 'failed' && <p role="alert" className={css.notice}>{t('sourceChanged')} {binary.failure?.message}</p>}
        <div className={css.pdfViewport}>{props.renderFactorySlot('document.pdf.reader', {
          data, page, onPageChange: choosePage,
          ...zoom === undefined ? {} : { zoom },
          onZoomChange: (zoom) => {
            if (props.pdfPosition?.onZoomChange !== undefined) props.pdfPosition.onZoomChange(zoom)
            else setLocalZoom(zoom)
          },
          ...scrollTop === undefined ? {} : { scrollTop },
          onScrollTopChange: (top) => {
            if (props.pdfPosition?.onScrollTopChange !== undefined) props.pdfPosition.onScrollTopChange(top)
            else setLocalScroll(top)
          },
        })}</div>
      </>}
      {!dock && <details data-pdf-page={page}><summary>{t('pdfText')}</summary>
        {pageReading.status === 'failed' && <p role="alert">{t('pdfPageUnavailable')} {pageReading.failure?.message}</p>}
        <pre>{text ?? t(pageReading.status === 'loading' ? 'pdfPageLoading' : 'noContent')}</pre>
      </details>}
    </section>
    {!dock && reading.issues.length > 0 && <ul className={css.notice}>{reading.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
    {!dock && <MaterialReaderLinks {...props} onFailure={() => { setFailure(t('unresolved')) }} />}
    <details className={css.observation}><summary>{t('readingInfo')}</summary>
      {dock && <>
        <MaterialReaderHeader {...props} />
        <p>{t('pdfPage', { page, count: pageCount })}</p>
        {download !== undefined && <a href={download} download={resource.title}>{t('downloadPdf')}</a>}
        <details data-pdf-page={page}><summary>{t('pdfText')}</summary>
          {pageReading.status === 'failed' && <p role="alert">{t('pdfPageUnavailable')} {pageReading.failure?.message}</p>}
          <pre>{text ?? t(pageReading.status === 'loading' ? 'pdfPageLoading' : 'noContent')}</pre>
        </details>
        {reading.issues.length > 0 && <ul className={css.notice}>{reading.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        <MaterialReaderLinks {...props} onFailure={() => { setFailure(t('unresolved')) }} />
      </>}
      <p className={css.muted}>{t('observed', { time: reading.observedAt })}</p>
      <p className={css.muted}>{t('sourceChanged')}</p>
    </details>
  </article>
}
