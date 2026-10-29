import { expect, it } from 'vitest'
import { fittingSourcePrefix, refittableSource } from '../src/context-excerpt.ts'

it('preserves UTF-16 pairs and a truthful interval when a single long line must be shortened', () => {
  const source = refittableSource({ label: 'Observed note', text: 'A𝛼B', source: { target: 'note.md' } }, 7)
  const part = source.excerpt?.(entry => entry.text.length <= 2)
  expect(part).toMatchObject({ text: 'A', source: { locator: 'UTF-16 characters [7, 8) in the observed source' } })
  expect(fittingSourcePrefix(' A\nB', text => text.length <= 4)).toBe(' A\nB')
})

it('keeps complete lines when possible and declines an unusable budget or unknown location', () => {
  expect(fittingSourcePrefix('condition\nargument', text => text.length <= 12)).toBe('condition\n')
  expect(fittingSourcePrefix('condition', () => false)).toBeUndefined()
  expect(refittableSource({ label: 'Repeated passage', text: 'condition', source: { target: 'note.md' } }).excerpt).toBeUndefined()
})
