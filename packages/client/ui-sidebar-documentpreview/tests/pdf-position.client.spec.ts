import { expect, it } from 'vitest'
import { visiblePdfPage } from '../src/client/pdf/position.ts'

it('excludes nearby prefetched pages and chooses the physical page at the reading line', () => {
  expect(visiblePdfPage([
    { page: 1, top: -700, bottom: -20 }, { page: 2, top: -8, bottom: 700 }, { page: 3, top: 712, bottom: 1400 },
  ], { top: 0, bottom: 600 })).toBe(2)
  expect(visiblePdfPage([
    { page: 2, top: -680, bottom: 20 }, { page: 3, top: 32, bottom: 740 },
  ], { top: 0, bottom: 600 })).toBe(3)
})

it('does not invent a reading page before layout or for completely offscreen pages', () => {
  expect(visiblePdfPage([{ page: 5, top: 0, bottom: 0 }], { top: 0, bottom: 0 })).toBeUndefined()
  expect(visiblePdfPage([{ page: 5, top: 900, bottom: 1800 }], { top: 0, bottom: 600 })).toBeUndefined()
})
