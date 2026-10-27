import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { readPdf } from '../src/pdf.ts'
import { labeledPdf } from './fixture.ts'

const fixture = (): Promise<Buffer> => readFile(new URL('./fixtures/two-pages.pdf', import.meta.url))
const signal = (): AbortSignal => new AbortController().signal

describe('actual PDF source pages', () => {
  it('extracts the requested physical page and validates its exact quote', async () => {
    const body = await readPdf(await fixture(), { kind: 'pdf-page', page: 2, quote: 'Page two exact text' }, { maxPages: 1, maxTextCharacters: 1000, maxInlineBytes: 1048576 }, signal())
    expect(body).toMatchObject({ kind: 'pdf', pageCount: 2, pages: [{ page: 2, text: 'Page two exact text' }] })
    if (body.kind !== 'pdf') throw new Error('The real PDF did not parse.')
    expect(body.pages[0]).not.toHaveProperty('printedPage')
    expect(body.dataBase64).toBeDefined()
    expect(Buffer.from(body.dataBase64 ?? '', 'base64')).toEqual(await fixture())
    expect(await readPdf(await fixture(), { kind: 'pdf-page', page: 1, quote: 'Page two exact text' }, { maxPages: 1, maxTextCharacters: 1000, maxInlineBytes: 1048576 }, signal()))
      .toMatchObject({ kind: 'unavailable', reason: 'missing' })
  })

  it('retains the actual PDF while exposing only its bounded initial extraction window', async () => {
    const bytes = await fixture()
    const body = await readPdf(bytes, undefined, { maxPages: 1, maxTextCharacters: 1000, maxInlineBytes: 1048576 }, signal())
    expect(body).toMatchObject({ kind: 'pdf', pageCount: 2, pages: [{ page: 1, text: 'Selectable PDF text' }] })
    if (body.kind !== 'pdf' || body.dataBase64 === undefined) throw new Error('The original PDF bytes were not retained.')
    expect(Buffer.from(body.dataBase64, 'base64')).toEqual(bytes)
    expect(await readPdf(bytes, { kind: 'pdf-page', page: 0 }, { maxPages: 2, maxTextCharacters: 1000, maxInlineBytes: 1048576 }, signal())).toMatchObject({ kind: 'unavailable', reason: 'missing' })
    expect(await readPdf(bytes, { kind: 'pdf-page', page: 3 }, { maxPages: 2, maxTextCharacters: 1000, maxInlineBytes: 1048576 }, signal())).toMatchObject({ kind: 'unavailable', reason: 'missing' })
    expect(await readPdf(bytes, { kind: 'pdf-page', page: 1 }, { maxPages: 2, maxTextCharacters: 3, maxInlineBytes: 1048576 }, signal())).toMatchObject({ kind: 'unavailable', reason: 'too-large' })
  })

  it('does not claim unsupported region extraction or continue after cancellation', async () => {
    const bytes = await fixture()
    expect(await readPdf(bytes, { kind: 'pdf-page', page: 1, region: { x: 0, y: 0, width: 0.2, height: 0.1 } }, { maxPages: 2, maxTextCharacters: 1000, maxInlineBytes: 1048576 }, signal()))
      .toMatchObject({ kind: 'unavailable', reason: 'unsupported' })
    const abort = new AbortController()
    abort.abort(new Error('cancelled source read'))
    await expect(readPdf(bytes, undefined, { maxPages: 2, maxTextCharacters: 1000, maxInlineBytes: 1048576 }, abort.signal)).rejects.toThrow('cancelled source read')
  })

  it('keeps a PDF-declared label separate from verified printed-page identity', async () => {
    const body = await readPdf(labeledPdf(await fixture()), { kind: 'pdf-page', page: 2 },
      { maxPages: 2, maxTextCharacters: 1000, maxInlineBytes: 1048576 }, signal())
    expect(body).toMatchObject({ kind: 'pdf', pages: [{ page: 2, pageLabel: 'ii' }] })
    if (body.kind !== 'pdf') throw new Error('The labeled PDF did not parse.')
    expect(body.pages[0]).not.toHaveProperty('printedPage')
  })
})
