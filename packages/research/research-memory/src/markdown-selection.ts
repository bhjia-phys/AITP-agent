/** Conservative rendered-quote lookup; source offsets come from parsed nodes, never stripped-markup guesses. */
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { mathFromMarkdown } from 'mdast-util-math'
import { gfm } from 'micromark-extension-gfm'
import { math } from 'micromark-extension-math'
import type { ResearchSourceRange } from './types.ts'

type Node = ReturnType<typeof fromMarkdown> | ReturnType<typeof fromMarkdown>['children'][number]
interface Point { start: number; end: number }
interface Projection { text: string; points: (Point | undefined)[]; preserveWhitespace?: true }

function literal(text: string, start: number): Projection {
  return { text, points: Array.from({ length: text.length }, (_, index) => ({ start: start + index, end: start + index + 1 })) }
}

function unavailable(): Projection { return { text: '\0', points: [undefined] } }

function concatenate(parts: Projection[]): Projection {
  return { text: parts.map(part => part.text).join(''), points: parts.flatMap(part => part.points) }
}

function decodedText(raw: string, start: number): Projection {
  const parts: Projection[] = []
  for (const match of raw.matchAll(/\\[!-/:-@\[-`{-~]|&(?:#[xX][\da-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);|\r\n|[\s\S]/g)) {
    const token = match[0]
    let text = token.replace(/\r\n|\r/g, '\n')
    if (token.startsWith('\\') && token.length === 2) text = token.slice(1)
    else if (token.startsWith('&') && token.endsWith(';')) {
      const paragraph = fromMarkdown(token).children[0]
      const node = paragraph?.type === 'paragraph' ? paragraph.children[0] : undefined
      if (node?.type === 'text') text = node.value
    }
    const point = { start: start + match.index, end: start + match.index + token.length }
    parts.push({ text, points: Array.from({ length: text.length }, () => point) })
  }
  return concatenate(parts)
}

function leaf(node: Node, source: string): Projection {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  if (start === undefined || end === undefined || !('value' in node)) return unavailable()
  const raw = source.slice(start, end)
  if (node.type === 'text' || node.type === 'html') {
    if (node.value === raw) return literal(raw, start)
    const decoded = decodedText(raw, start)
    return decoded.text === node.value ? decoded : unavailable()
  }
  if (node.type === 'inlineCode') {
    const delimiters = /^(`+)([\s\S]*?)\1$/.exec(raw)
    if (delimiters?.[1] === undefined || delimiters[2] === undefined) return unavailable()
    const offset = start + delimiters[1].length
    const parts = [...delimiters[2].matchAll(/\r\n|[\s\S]/g)].map(match => ({
      text: /\r|\n/.test(match[0]) ? ' ' : match[0],
      points: [{ start: offset + match.index, end: offset + match.index + match[0].length }],
    }))
    const projection = concatenate(parts)
    if (projection.text.startsWith(' ') && projection.text.endsWith(' ') && /[^ ]/.test(projection.text)) {
      projection.text = projection.text.slice(1, -1)
      projection.points = projection.points.slice(1, -1)
    }
    return projection.text === node.value ? projection : unavailable()
  }
  if (node.type === 'code' && node.lang !== 'math' && node.value !== '') {
    const index = raw.indexOf(node.value)
    if (index >= 0 && index === raw.lastIndexOf(node.value)) return { ...literal(node.value, start + index), preserveWhitespace: true }
  }
  return unavailable()
}

function inline(node: Node, source: string): Projection {
  switch (node.type) {
    case 'strong': case 'emphasis': case 'delete': case 'link': case 'linkReference':
      return concatenate(node.children.map(child => inline(child, source)))
    case 'text': case 'inlineCode': case 'html':
      return leaf(node, source)
    default:
      // Math, image alternatives, footnote chrome and other renderer-specific
      // text cannot be equated to authored literal characters here.
      return unavailable()
  }
}

function projections(source: string): Projection[] {
  const tree = fromMarkdown(source, { extensions: [gfm(), math()], mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()] })
  const result: Projection[] = []
  const visit = (node: Node): void => {
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'tableCell') {
      const raw = source.slice(node.position?.start.offset, node.position?.end.offset)
      // The shared renderer additionally accepts TeX \(...\) and \[...\].
      // This grammar does not map those layouts, so their enclosing block is unavailable.
      if (/\\[([\])]/.test(raw)) return
      result.push(concatenate(node.children.map(child => inline(child, source))))
      return
    }
    if (node.type === 'code' || node.type === 'html') { result.push(leaf(node, source)); return }
    if ('children' in node && node.type !== 'footnoteDefinition') for (const child of node.children) visit(child)
  }
  visit(tree)
  return result
}

function collapsed(projection: Projection): Projection {
  const text: string[] = []
  const points: (Point | undefined)[] = []
  for (const match of projection.text.matchAll(/[\t\n\r ]+|[^\t\n\r ]/g)) {
    const first = projection.points[match.index]
    const last = projection.points[match.index + match[0].length - 1]
    text.push(/[\t\n\r ]/.test(match[0]) ? ' ' : match[0])
    points.push(first === undefined || last === undefined ? undefined : { start: first.start, end: last.end })
  }
  return { text: text.join(''), points }
}

/**
 * Find every supported rendered match within a fresh raw source interval.
 * @param source - complete unmodified Markdown text; offsets are UTF-16 code units.
 * @param quote - exact user-visible selection, never rewritten in the returned origin.
 * @param scope - allowed source interval, normally a uniquely resolved heading or the whole file.
 * @returns distinct raw ranges; zero means unsupported or missing, multiple means ambiguous.
 */
export function renderedSelectionRanges(source: string, quote: string, scope: { start: number; end: number }): ResearchSourceRange[] {
  if (quote === '') return []
  const candidates = new Map<string, ResearchSourceRange>()
  for (const projection of projections(source)) {
    for (const variant of projection.preserveWhitespace ? [projection] : [projection, collapsed(projection)]) {
      for (let offset = variant.text.indexOf(quote); offset !== -1; offset = variant.text.indexOf(quote, offset + 1)) {
        const points = variant.points.slice(offset, offset + quote.length)
        const first = points[0]
        const last = points.at(-1)
        if (first === undefined || last === undefined || points.some(point => point === undefined)
          || first.start < scope.start || last.end > scope.end) continue
        const range = { start: first.start, end: last.end, text: source.slice(first.start, last.end) }
        candidates.set(`${range.start}:${range.end}`, range)
      }
    }
  }
  return [...candidates.values()]
}
