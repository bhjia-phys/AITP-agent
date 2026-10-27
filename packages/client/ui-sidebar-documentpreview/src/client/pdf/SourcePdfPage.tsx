/** Reusable physical PDF page from already-authorized bytes, without any filesystem or Session read. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { openPdf } from './runtime.ts'
import { renderPdfPage, type PdfDocument } from './document.ts'
import { PdfWorkerFailure } from './errors.ts'
import css from './SourcePdfPage.module.css'

/** Source bytes are borrowed read-only; the existing PDF runtime copies before Worker transfer. */
export interface SourcePdfPageInput {
  readonly data: Uint8Array<ArrayBuffer>
  readonly page: number
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotFactoryMap {
    /** One exact physical page using the shipped same-version Worker and assets. */
    'document.pdf.page': { scope: 'root'; props: SourcePdfPageInput; locale: 'sidebarPdf' }
  }
}

/** This page consumes authorized input and locale only; it does not read Session or global stores. */
export type SourcePdfPageProps = Pick<FactoryComponentPropsOf<'document.pdf.page'>, 'data' | 'page' | 't'>

/**
 * Paint one physical page, cancelling old work before another render uses its canvas.
 * @param props - complete authorized bytes, one-based page and renderer-owned locale.
 * @returns a real PDF canvas or explicit loading/failure state.
 */
export function SourcePdfPage(props: SourcePdfPageProps): ReactNode {
  const { data, page, t } = props
  const canvas = useRef<HTMLCanvasElement>(null)
  const tail = useRef<Promise<void>>(Promise.resolve())
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{ data: Uint8Array<ArrayBuffer>; document: PdfDocument; signal: AbortSignal }>()
  const [failure, setFailure] = useState<{ data: Uint8Array<ArrayBuffer>; error: unknown }>()
  const [painted, setPainted] = useState<{ data: Uint8Array<ArrayBuffer>; page: number }>()
  useEffect(() => {
    const lifetime = new AbortController()
    const session = openPdf(data, lifetime.signal, (error) => { if (!lifetime.signal.aborted) setFailure({ data, error }) })
    void session.document.then((document) => {
      if (!lifetime.signal.aborted) { setFailure(undefined); setLoaded({ data, document, signal: lifetime.signal }) }
    }, (error: unknown) => { if (!lifetime.signal.aborted) setFailure({ data, error }) })
    return () => { lifetime.abort(); void session.dispose() }
  }, [data, attempt])
  useEffect(() => {
    if (loaded?.data !== data || canvas.current === null) return
    const target = canvas.current
    const lifetime = new AbortController()
    const signal = AbortSignal.any([lifetime.signal, loaded.signal])
    const previous = tail.current
    const task = (async () => {
      await previous
      signal.throwIfAborted()
      if (page < 1 || page > loaded.document.numPages || !Number.isSafeInteger(page)) throw new Error(t('pageImage', { page }))
      await renderPdfPage(loaded.document, page, target, signal, globalThis.devicePixelRatio || 1)
      if (!signal.aborted) { setFailure(undefined); setPainted({ data, page }) }
    })().catch((error: unknown) => { if (!signal.aborted) setFailure({ data, error }) })
    tail.current = task
    return () => { lifetime.abort() }
  }, [data, loaded, page, attempt])
  const ready = painted?.data === data && painted.page === page && failure?.data !== data
  const error = failure?.data === data ? failure.error : undefined
  const message = error instanceof PdfWorkerFailure ? t('workerFailed')
    : error instanceof Error && error.name === 'PasswordException' ? t('password')
      : t('failed', { message: error instanceof Error ? error.message : String(error) })
  return <section className={css.page} data-source-pdf-page={page}>
    {error !== undefined && <p role="alert">{message} <Button size="sm" onClick={() => { setFailure(undefined); setAttempt(value => value + 1) }}>{t('retry')}</Button></p>}
    {!ready && error === undefined && <p role="status">{t(loaded?.data === data ? 'rendering' : 'loading')}</p>}
    <canvas ref={canvas} className={css.canvas} role="img" aria-label={t('pageImage', { page })} hidden={!ready}
      data-rendered-pdf-page={ready ? page : undefined} />
  </section>
}
