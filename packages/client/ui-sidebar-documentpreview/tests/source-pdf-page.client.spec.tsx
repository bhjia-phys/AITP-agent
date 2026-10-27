// @vitest-environment jsdom
/** Authorised PDF bytes retain the existing worker lifecycle and serialize reused canvas work. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { PdfDocument, renderPdfPage } from '../src/client/pdf/document.ts'
import type { openPdf } from '../src/client/pdf/runtime.ts'

const engine = vi.hoisted(() => ({ open: vi.fn<typeof openPdf>(), render: vi.fn<typeof renderPdfPage>() }))
vi.mock('../src/client/pdf/runtime.ts', () => ({ openPdf: engine.open }))
vi.mock('../src/client/pdf/document.ts', () => ({ renderPdfPage: engine.render }))
import { SourcePdfPage, type SourcePdfPageProps } from '../src/client/pdf/SourcePdfPage.tsx'
import { PdfWorkerFailure } from '../src/client/pdf/errors.ts'
import { en } from '../src/client/pdf/locales.ts'

const loads: Array<{ deferred: ReturnType<typeof Promise.withResolvers<PdfDocument>>; dispose: ReturnType<typeof vi.fn> }> = []
const bytes = new Uint8Array([1, 2, 3])
const t = makeTranslate(en)
const documentOf = (): PdfDocument => ({ numPages: 3, getPage: vi.fn() })
const props = (data = bytes, page = 1): SourcePdfPageProps => ({ data, page, t })

beforeEach(() => {
  loads.length = 0
  engine.open.mockReset().mockImplementation(() => {
    const deferred = Promise.withResolvers<PdfDocument>()
    const dispose = vi.fn(async () => {})
    loads.push({ deferred, dispose })
    return { document: deferred.promise, dispose }
  })
  engine.render.mockReset().mockResolvedValue({ width: 100, height: 100 })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('source physical PDF page', () => {
  it('marks a canvas ready only after its own physical page finished drawing', async () => {
    const draw = Promise.withResolvers<{ width: number; height: number }>()
    engine.render.mockReturnValueOnce(draw.promise)
    const view = render(<SourcePdfPage {...props()} />)
    expect(screen.getByRole('status').textContent).toBe(en.loading)
    await act(async () => { loads[0]!.deferred.resolve(documentOf()) })
    expect(view.container.querySelector('canvas')!.hidden).toBe(true)
    expect(screen.getByRole('status').textContent).toBe(en.rendering)
    await act(async () => { draw.resolve({ width: 100, height: 100 }) })
    expect(screen.getByRole('img', { name: 'PDF page 1' }).getAttribute('data-rendered-pdf-page')).toBe('1')
    expect(engine.render.mock.calls[0]![1]).toBe(1)
    view.unmount()
    expect(engine.open.mock.calls[0]![1].aborted).toBe(true)
    expect(loads[0]!.dispose).toHaveBeenCalledOnce()
  })

  it('aborts and finishes an old canvas job before drawing a newly requested page', async () => {
    const first = Promise.withResolvers<{ width: number; height: number }>()
    engine.render.mockReturnValueOnce(first.promise)
    const view = render(<SourcePdfPage {...props()} />)
    await act(async () => { loads[0]!.deferred.resolve(documentOf()) })
    view.rerender(<SourcePdfPage {...props(bytes, 2)} />)
    expect(engine.render.mock.calls[0]![3].aborted).toBe(true)
    expect(engine.render).toHaveBeenCalledOnce()
    await act(async () => { first.resolve({ width: 100, height: 100 }) })
    expect(engine.render.mock.calls.map(call => call[1])).toEqual([1, 2])
    expect(view.container.querySelector('[data-rendered-pdf-page="1"]')).toBeNull()
    expect(screen.getByRole('img', { name: 'PDF page 2' }).getAttribute('data-rendered-pdf-page')).toBe('2')
    expect(engine.open).toHaveBeenCalledOnce()
  })

  it('ignores replaced source failures and retries real worker failures with a new owned load', async () => {
    const next = new Uint8Array([4, 5, 6])
    const view = render(<SourcePdfPage {...props()} />)
    view.rerender(<SourcePdfPage {...props(next)} />)
    expect(loads[0]!.dispose).toHaveBeenCalledOnce()
    await act(async () => {
      loads[0]!.deferred.reject(new Error('stale source'))
      engine.open.mock.calls[0]![2](new PdfWorkerFailure(new ErrorEvent('error', { message: 'late worker' })))
      loads[1]!.deferred.reject(new PdfWorkerFailure(new ErrorEvent('error')))
    })
    expect(screen.getByRole('alert').textContent).toContain(en.workerFailed)
    expect(screen.getByRole('alert').textContent).not.toContain('stale source')
    fireEvent.click(screen.getByRole('button', { name: en.retry }))
    expect(loads[1]!.dispose).toHaveBeenCalledOnce()
    await act(async () => { loads[2]!.deferred.resolve(documentOf()) })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('img', { name: 'PDF page 1' })).toBeDefined()
  })
})
