/** Source-preserving Markdown facts shared by research-library projections. */
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import { mathFromMarkdown } from 'mdast-util-math'
import { math } from 'micromark-extension-math'
import { mathCompatibility } from '@deepseek-ai/dsh-util-markdown-math'
import { parseDocument } from 'yaml'

type MarkdownNode = ReturnType<typeof fromMarkdown> | ReturnType<typeof fromMarkdown>['children'][number]

/** A located authored link; resolving its target belongs to the shared source service. */
export interface MarkupLink {
  readonly label: string
  readonly href: string
  readonly section: string
  readonly start: number
  readonly end: number
}

/** A GFM table row with its original source span and located links. */
export interface MarkupRow {
  readonly cells: readonly string[]
  readonly start: number
  readonly end: number
  readonly text: string
  readonly links: readonly MarkupLink[]
  readonly cellLinks: readonly (readonly MarkupLink[])[]
}

/** A source table; its header is not interpreted as a scientific classification. */
export interface MarkupTable {
  readonly header: readonly string[]
  readonly rows: readonly MarkupRow[]
  readonly section: string
}

/** A heading or explicitly authored HTML anchor with its containing source section. */
export interface MarkupAnchor {
  readonly anchor: string
  readonly start: number
  readonly end: number
}

/** Authored document facts without application-owned scientific meaning. */
export interface MarkupDocument {
  readonly title: string | undefined
  readonly attributes: Readonly<Record<string, unknown>>
  readonly links: readonly MarkupLink[]
  /** Authored embedded images, kept separate so an image does not become a knowledge entry or owner link. */
  readonly images: readonly MarkupLink[]
  readonly tables: readonly MarkupTable[]
  readonly anchors: readonly MarkupAnchor[]
  readonly issues: readonly string[]
}

/** Leading YAML and the original body boundary; issues prevent treating the YAML as metadata. */
export interface SourceFrontmatter {
  readonly source: string
  readonly bodyOffset: number
  readonly attributes: Readonly<Record<string, unknown>>
  readonly issues: readonly string[]
}

function nodeText(node: MarkdownNode): string {
  if ('value' in node) return node.value
  if ('alt' in node) return node.alt ?? ''
  if ('children' in node) return node.children.map(child => nodeText(child)).join('')
  return ''
}

/**
 * Read an authored scalar or scalar list without coercing objects to source facts.
 * @param document - parsed source facts.
 * @param key - exact frontmatter key.
 * @returns recorded text, or undefined for an absent or non-scalar value.
 */
export function markupAttribute(document: MarkupDocument, key: string): string | undefined {
  const value = document.attributes[key]
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) return value.join('; ')
  return undefined
}

/**
 * Parse a closed leading YAML mapping without changing source bytes or expanding unsafe aliases.
 * @param text - complete UTF-8-decoded source text.
 * @returns original YAML, its UTF-16 body offset and metadata or issues; undefined for absent or unclosed frontmatter.
 */
export function parseSourceFrontmatter(text: string): SourceFrontmatter | undefined {
  const frontmatter = /^\uFEFF?---\r?\n(?:([\s\S]*?)\r?\n)??(?:---|\.\.\.)(?:\r?\n|$)/.exec(text)
  if (frontmatter === null) return undefined
  const source = frontmatter[1] ?? ''
  const issues: string[] = []
  let attributes: Readonly<Record<string, unknown>> = {}
  if (source !== '') {
    const yaml = parseDocument(source, { uniqueKeys: true })
    if (yaml.errors.length > 0) issues.push('The source frontmatter could not be parsed; its original text remains available.')
    else {
      let value: unknown
      try { value = yaml.toJS() }
      catch (error) {
        if (!(error instanceof Error)) throw error
        issues.push('The source frontmatter exceeded the YAML parser limits; no metadata was inferred.')
      }
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) attributes = value as Readonly<Record<string, unknown>>
      else if (value !== null && value !== undefined) issues.push('The source frontmatter is not a mapping; no metadata was inferred.')
    }
  }
  return { source, bodyOffset: frontmatter[0].length, attributes, issues }
}

/**
 * Parse optional YAML frontmatter, Markdown links and GFM tables with UTF-16 offsets.
 * Unknown frontmatter stays uninterpreted; invalid YAML is reported without rewriting source.
 * @param text - complete UTF-8-decoded source text.
 * @returns located authored facts; no filesystem access or relationship inference occurs here.
 */
export function parseSourceMarkup(text: string): MarkupDocument {
  const frontmatter = parseSourceFrontmatter(text)
  const offset = frontmatter?.bodyOffset ?? 0
  const attributes = frontmatter?.attributes ?? {}
  const issues = frontmatter?.issues ?? []
  const tree = fromMarkdown(text.slice(offset), {
    extensions: [gfm(), math(), mathCompatibility()], mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()],
  })
  const definitions = new Map(tree.children.filter(node => node.type === 'definition').map(node => [node.identifier.toLowerCase(), node.url]))
  const headings = tree.children.filter(node => node.type === 'heading')
  const sections = headings.map((heading, index) => ({
    heading, start: (heading.position?.start.offset ?? 0) + offset,
    end: (headings.slice(index + 1).find(next => next.depth <= heading.depth)?.position?.start.offset ?? text.length - offset) + offset,
  }))
  const anchors: MarkupAnchor[] = sections.map(section => ({
    anchor: nodeText(section.heading).toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/g, '-'),
    start: section.start, end: section.end,
  }))
  const sectionAt = (start: number): string => {
    const before = headings.filter(heading => (heading.position?.start.offset ?? 0) <= start)
    const heading = before.at(-1)
    return heading === undefined ? '' : nodeText(heading)
  }
  const links: MarkupLink[] = []
  const images: MarkupLink[] = []
  const visit = (node: MarkdownNode): void => {
    const start = node.position?.start.offset ?? 0
    const end = node.position?.end.offset ?? start
    const href = node.type === 'link' ? node.url : node.type === 'linkReference' ? definitions.get(node.identifier.toLowerCase()) : undefined
    if (href !== undefined) links.push({ label: nodeText(node), href, section: sectionAt(start), start: start + offset, end: end + offset })
    const image = node.type === 'image' ? node.url
      : node.type === 'imageReference' ? definitions.get(node.identifier.toLowerCase()) : undefined
    if (image !== undefined) images.push({
      label: nodeText(node), href: image, section: sectionAt(start), start: start + offset, end: end + offset,
    })
    if (node.type === 'html') {
      for (const match of node.value.matchAll(/<a\s+[^>]*(?:id|name)\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
        if (match[1] === undefined) continue
        const after = sections.find(section => section.start >= end + offset)
        const current = sections.filter(section => section.start <= start + offset && section.end > start + offset).at(-1)
        const target = after ?? current
        anchors.push({ anchor: match[1], start: target?.start ?? start + offset, end: target?.end ?? text.length })
      }
    }
    if ('children' in node) for (const child of node.children) visit(child)
  }
  visit(tree)
  const tables: MarkupTable[] = []
  for (const node of tree.children) {
    if (node.type !== 'table') continue
    const header = node.children[0]
    if (header === undefined) continue
    const section = sectionAt(node.position?.start.offset ?? 0)
    tables.push({ header: header.children.map(cell => nodeText(cell)), section,
      rows: node.children.slice(1).map((row) => {
        const start = (row.position?.start.offset ?? 0) + offset
        const end = (row.position?.end.offset ?? 0) + offset
        return { cells: row.children.map(cell => nodeText(cell)), start, end, text: text.slice(start, end),
          links: links.filter(link => link.start >= start && link.end <= end),
          cellLinks: row.children.map((cell) => {
            const cellStart = (cell.position?.start.offset ?? 0) + offset
            const cellEnd = (cell.position?.end.offset ?? 0) + offset
            return links.filter(link => link.start >= cellStart && link.end <= cellEnd)
          }) }
      }) })
  }
  const heading = headings.find(node => node.depth === 1)
  const authoredTitle = attributes.title
  const uniqueAnchors = anchors.filter((anchor, index) => anchors.findIndex(other => other.anchor === anchor.anchor
    && other.start === anchor.start && other.end === anchor.end) === index)
  return { title: typeof authoredTitle === 'string' ? authoredTitle : heading === undefined ? undefined : nodeText(heading),
    attributes, links, images, tables, anchors: uniqueAnchors, issues }
}
