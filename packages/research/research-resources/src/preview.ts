/** Supported native document headers; browsers remain responsible for full decoding. */
import { SourceError } from './files.ts'
import type { ResourceBytes, ResourceImageMediaType } from './types.ts'

const IMAGE_MEDIA_TYPES: Readonly<Record<string, ResourceImageMediaType>> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  bmp: 'image/bmp', ico: 'image/x-icon', svg: 'image/svg+xml',
}

/** @param path - normalized source path. @returns its native preview type, without granting read authority. */
export function previewMediaType(path: string): ResourceBytes['mediaType'] | undefined {
  const extension = path.split('.').at(-1)?.toLowerCase()
  return extension === 'pdf' ? 'application/pdf'
    : extension !== undefined && Object.hasOwn(IMAGE_MEDIA_TYPES, extension) ? IMAGE_MEDIA_TYPES[extension] : undefined
}

function hasBytes(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value)
}

/** Find the XML document element after its prolog without expanding a declaration or reading any URI. */
function svgHeader(bytes: Uint8Array): boolean {
  const encoding = hasBytes(bytes, [0xff, 0xfe]) ? 'utf-16le' : hasBytes(bytes, [0xfe, 0xff]) ? 'utf-16be' : 'utf-8'
  let source = new TextDecoder(encoding).decode(bytes).trimStart()
  while (source.startsWith('<?') || source.startsWith('<!--') || source.startsWith('<!DOCTYPE')) {
    if (source.startsWith('<?') || source.startsWith('<!--')) {
      const ending = source.startsWith('<?') ? '?>' : '-->'
      const index = source.indexOf(ending)
      if (index < 0) return false
      source = source.slice(index + ending.length).trimStart()
      continue
    }
    let quote: string | undefined
    let depth = 0
    let end = -1
    for (let index = 9; index < source.length; index++) {
      const character = source[index]
      if (quote !== undefined) { if (character === quote) quote = undefined; continue }
      if (character === '"' || character === "'") quote = character
      else if (character === '[') depth++
      else if (character === ']') depth--
      else if (character === '>' && depth === 0) { end = index; break }
    }
    if (end < 0) return false
    source = source.slice(end + 1).trimStart()
  }
  return /^<(?:[\p{L}_][\w.-]*:)?svg(?=[\s/>])/u.test(source)
}

/**
 * Reject a mismatched type before returning complete authorized bytes to an image or PDF element.
 * @param path - normalized filename; unsupported HTML and arbitrary binary types are rejected.
 * @param bytes - complete bounded source data supplied by GuardedFiles.
 * @returns the MIME type established by its extension and header, not a decoding or scientific claim.
 */
export function checkedPreviewMediaType(path: string, bytes: Uint8Array): ResourceBytes['mediaType'] {
  const mediaType = previewMediaType(path)
  let valid = false
  switch (mediaType) {
    case 'application/pdf': valid = /%PDF-\d\.\d/u.test(new TextDecoder('latin1').decode(bytes.subarray(0, 1024))); break
    case 'image/png': valid = hasBytes(bytes, [137, 80, 78, 71, 13, 10, 26, 10]); break
    case 'image/jpeg': valid = hasBytes(bytes, [255, 216, 255]); break
    case 'image/gif': valid = hasBytes(bytes, [71, 73, 70, 56, 55, 97]) || hasBytes(bytes, [71, 73, 70, 56, 57, 97]); break
    case 'image/webp': valid = hasBytes(bytes, [82, 73, 70, 70]) && hasBytes(bytes, [87, 69, 66, 80], 8); break
    case 'image/bmp': valid = hasBytes(bytes, [66, 77]); break
    case 'image/x-icon': valid = hasBytes(bytes, [0, 0, 1, 0]); break
    case 'image/svg+xml': valid = svgHeader(bytes); break
    case undefined: throw new SourceError('unsupported', 'Native source bytes support PDF and registered image formats only.')
  }
  if (!valid) throw new SourceError('unsupported', 'The source content does not match its declared native preview format.')
  return mediaType
}
