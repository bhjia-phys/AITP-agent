/** Real six-page PDF with exact distinct text, beyond the initial extraction window. */
export const PDF_PAGE_TWO = 'Page two exact text: Only under A.'
export const PDF_PAGE_FIVE = 'Page five exact text: Keep the independent control unresolved.'

/**
 * Build complete PDF bytes with actual page objects, a standard font and an xref table.
 * @param paddingBytes - Optional valid comment bytes to exercise bounded original-file transport.
 * @returns A six-page document without network references or external assets.
 */
export function nativeLibraryPdf(paddingBytes = 0): Uint8Array {
  const phrases = ['Page one exact text: This is an isolated fixture.', PDF_PAGE_TWO,
    'Page three exact text: The assumptions remain explicit.', 'Page four exact text: Initial extraction stops here.',
    PDF_PAGE_FIVE, 'Page six exact text: No additional conclusion is established.']
  const fontId = 3 + phrases.length * 2
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${phrases.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${phrases.length} >>`]
  for (const [index, phrase] of phrases.entries()) {
    const pageId = 3 + index * 2
    const stream = `BT /F1 12 Tf 36 470 Td (${phrase}) Tj ET\nBT /F1 10 Tf 36 430 Td (Physical page ${index + 1} of 6) Tj ET`
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 480 540] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${pageId + 1} 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  }
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  let text = '%PDF-1.7\n'
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(text.length)
    text += `${index + 1} 0 obj\n${object}\nendobj\n`
  }
  if (paddingBytes > 0) text += `%${'x'.repeat(paddingBytes)}\n`
  const xref = text.length
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) text += `${String(offset).padStart(10, '0')} 00000 n \n`
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(text)
}
