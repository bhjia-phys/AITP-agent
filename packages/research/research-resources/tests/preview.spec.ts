import { describe, expect, it } from 'vitest'
import { checkedPreviewMediaType, previewMediaType } from '../src/preview.ts'
import type { ResourceImageMediaType } from '../src/types.ts'

describe('native preview format headers', () => {
  it.each<{ path: string; header: readonly number[]; mediaType: ResourceImageMediaType }>([
    { path: 'figure.PNG', header: [137, 80, 78, 71, 13, 10, 26, 10], mediaType: 'image/png' },
    { path: 'figure.jpg', header: [255, 216, 255], mediaType: 'image/jpeg' },
    { path: 'figure.jpeg', header: [255, 216, 255], mediaType: 'image/jpeg' },
    { path: 'figure.gif', header: [71, 73, 70, 56, 57, 97], mediaType: 'image/gif' },
    { path: 'figure.webp', header: [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80], mediaType: 'image/webp' },
    { path: 'figure.bmp', header: [66, 77], mediaType: 'image/bmp' },
    { path: 'figure.ico', header: [0, 0, 1, 0], mediaType: 'image/x-icon' },
  ])('checks the declared $path image format while leaving decoding to the native renderer', ({ path, header, mediaType }) => {
    expect(previewMediaType(path)).toBe(mediaType)
    expect(checkedPreviewMediaType(path, new Uint8Array(header))).toBe(mediaType)
    expect(() => checkedPreviewMediaType(path, new TextEncoder().encode('<html>Not an image</html>'))).toThrow('does not match')
  })

  it('recognizes SVG XML roots after declarations and comments without fetching or expanding a declaration', () => {
    const svg = '<?xml version="1.0"?>\n<!-- illustrated -->\n<!DOCTYPE svg [<!ENTITY label "a > b">]>\n'
      + '<svg xmlns="http://www.w3.org/2000/svg"><text>&label;</text></svg>'
    expect(checkedPreviewMediaType('图 1.svg', new TextEncoder().encode(svg))).toBe('image/svg+xml')
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(svg, 'utf16le')])
    expect(checkedPreviewMediaType('图 1.svg', utf16)).toBe('image/svg+xml')
    expect(checkedPreviewMediaType('figure.svg', new TextEncoder().encode('<s:svg xmlns:s="http://www.w3.org/2000/svg"/>')))
      .toBe('image/svg+xml')
    for (const source of ['<html><svg/></html>', '<!-- unfinished', '<!DOCTYPE svg [', '<svgish/>']) {
      expect(() => checkedPreviewMediaType('figure.svg', new TextEncoder().encode(source))).toThrow('does not match')
    }
  })

  it('retains PDF header handling and does not turn the byte endpoint into an HTML or arbitrary file bridge', () => {
    expect(checkedPreviewMediaType('paper.PDF', new TextEncoder().encode('%PDF-1.7\n'))).toBe('application/pdf')
    for (const path of ['page.html', 'image.html', 'secret.bin', 'note.md', 'image.constructor', 'image.__proto__']) {
      expect(previewMediaType(path)).toBeUndefined()
      expect(() => checkedPreviewMediaType(path, new TextEncoder().encode('<svg/>'))).toThrow('registered image formats')
    }
  })
})
