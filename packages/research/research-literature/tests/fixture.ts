/** A larger valid fixture with the original two pages and an unreferenced padding stream. */
function objectsIn(source: Uint8Array): string[] {
  const original = new TextDecoder().decode(source)
  const objects = [...original.matchAll(/\d+ 0 obj\n([\s\S]*?)\nendobj/g)].map(match => match[1] ?? '')
  if (objects.length === 0) throw new Error('The deterministic PDF fixture has no objects.')
  return objects
}

/** @returns a valid larger PDF, retaining the two known page streams. */
export function paddedPdf(source: Uint8Array, bytes: number): Uint8Array {
  const objects = objectsIn(source)
  const padding = ' '.repeat(bytes)
  objects.push(`<< /Length ${padding.length} >>\nstream\n${padding}\nendstream`)
  return serialize(objects)
}

/** @returns the known pages with PDF-declared roman page labels, distinct from physical page identity. */
export function labeledPdf(source: Uint8Array): Uint8Array {
  const objects = objectsIn(source)
  objects[0] = '<< /Type /Catalog /Pages 2 0 R /PageLabels << /Nums [0 << /S /r >>] >> >>'
  return serialize(objects)
}

function serialize(objects: readonly string[]): Uint8Array {
  let text = '%PDF-1.7\n'
  const offsets: number[] = []
  for (const [index, object] of objects.entries()) {
    offsets.push(text.length)
    text += `${index + 1} 0 obj\n${object}\nendobj\n`
  }
  const xref = text.length
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) text += `${String(offset).padStart(10, '0')} 00000 n \n`
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(text)
}
