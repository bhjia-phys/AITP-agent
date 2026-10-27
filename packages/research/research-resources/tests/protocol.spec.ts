import { describe, expect, it } from 'vitest'
import type { SourceLocator, SourceRef, SourceRootId, SourceId } from '../src/types.ts'
import { materialBytesAddress, materialSourceAddress, materialSourcePath, parseMaterialBytes, parseMaterialSource } from '../src/protocol.ts'

const ref: SourceRef = { rootId: '理论 / library' as SourceRootId, sourceId: 'source:papers%2Fsame.md' as SourceId }

describe('shared material source addresses', () => {
  it('keeps native preview bytes separate from located readings and rejects malformed or non-file byte addresses', () => {
    expect(parseMaterialBytes(materialBytesAddress(ref))).toEqual({ ref })
    expect(parseMaterialSource(materialBytesAddress(ref))).toBeUndefined()
    expect(parseMaterialBytes(materialSourceAddress(ref))).toBeUndefined()
    for (const suffix of ['?location={}', '?domain=literature', '#page=2']) {
      expect(parseMaterialBytes(materialBytesAddress(ref) + suffix)).toBeUndefined()
    }
    for (const sourceId of ['draft:note', 'source:..%2Fprivate.pdf', 'source:%ZZ', 'source:%00']) {
      expect(parseMaterialBytes(materialBytesAddress({ ...ref, sourceId: sourceId as SourceId }))).toBeUndefined()
    }
    expect(parseMaterialBytes('https://aitp-material-bytes/root/a/source/source%3Afile.pdf')).toBeUndefined()
    expect(parseMaterialBytes('not an address')).toBeUndefined()
  })
  it('displays actual path identities once without presenting virtual or escaping identities as file paths', () => {
    expect(materialSourcePath('source:notes%2F%E4%B8%AD%E6%96%87%2520note.md' as SourceId)).toBe('notes/中文%20note.md')
    for (const id of ['draft:saved-note', 'git:checkout-diff', 'source:%ZZ', 'source:%2Fprivate', 'source:..%2Foutside', 'source:C%3A%2Fprivate']) {
      expect(materialSourcePath(id as SourceId)).toBeUndefined()
    }
  })

  it.each<SourceLocator>([
    { kind: 'text', start: 2, end: 7, quote: '中文与公式' },
    { kind: 'anchor', anchor: '前提与限制' },
    { kind: 'pdf-page', page: 3, quote: 'Only under A', region: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 } },
    { kind: 'code', startLine: 3, endLine: 7, revision: 'fixed-commit' },
    { kind: 'git', view: 'diff', scope: 'commit', revision: 'fixed-commit', path: 'src/a b.cpp' },
  ])('round-trips the same source and exact $kind locator on Host and Client', (locator) => {
    expect(parseMaterialSource(materialSourceAddress(ref, locator))).toEqual({ ref, locator })
  })

  it('keeps equal relative source identities in different roots distinct', () => {
    const other = { ...ref, rootId: 'another-root' as SourceRootId }
    expect(materialSourceAddress(other)).not.toBe(materialSourceAddress(ref))
    expect(parseMaterialSource(materialSourceAddress(other))).toEqual({ ref: other })
  })

  it('keeps optional library views separate without changing source identity or legacy addresses', () => {
    const legacy = materialSourceAddress(ref)
    expect(legacy).not.toContain('?')
    for (const domain of ['literature', 'knowledge', 'code'] as const) {
      expect(parseMaterialSource(materialSourceAddress(ref, undefined, domain))).toEqual({ ref, domain })
      expect(materialSourceAddress(ref, undefined, domain)).not.toBe(legacy)
    }
    expect(parseMaterialSource(materialSourceAddress(ref, { kind: 'pdf-page', page: 2 }, 'literature')))
      .toEqual({ ref, locator: { kind: 'pdf-page', page: 2 }, domain: 'literature' })
    expect(parseMaterialSource(`${legacy}?domain=unknown`)).toBeUndefined()
    expect(parseMaterialSource(`${legacy}?domain=`)).toBeUndefined()
    expect(parseMaterialSource(materialSourceAddress(ref, { kind: 'pdf-page', page: 2 }, 'code'))).toBeUndefined()
    expect(parseMaterialSource(materialSourceAddress(ref, { kind: 'git', view: 'diff' }, 'knowledge'))).toBeUndefined()
  })

  it.each(['https://example.test/source', 'dsh-resource://aitp-material-source/root/a/source/',
    'dsh-resource://aitp-material-source/root/%ZZ/source/x',
    'dsh-resource://aitp-material-source/root/a/source/x?location=%7B%22kind%22%3A%22pdf-page%22%2C%22page%22%3A0%7D',
  ])('refuses an invalid or unsupported source address %s', (address) => {
    expect(parseMaterialSource(address)).toBeUndefined()
  })

  it.each<SourceLocator>([
    { kind: 'text', start: 2, end: 8, quote: '中文与公式' },
    { kind: 'text', start: 2, end: 2, quote: '' },
    { kind: 'pdf-page', page: 1, region: { x: -0.1, y: 0, width: 0.1, height: 0.1 } },
    { kind: 'pdf-page', page: 1, region: { x: 0.8, y: 0, width: 0.3, height: 0.1 } },
    { kind: 'pdf-page', page: 1, region: { x: 0, y: 0, width: 0, height: 0.1 } },
  ])('rejects inconsistent passage lengths and normalized PDF regions: $kind', (locator) => {
    expect(parseMaterialSource(materialSourceAddress(ref, locator))).toBeUndefined()
  })

  it('rejects a decoded null source identifier', () => {
    expect(parseMaterialSource('dsh-resource://aitp-material-source/root/a/source/%00')).toBeUndefined()
  })
})
