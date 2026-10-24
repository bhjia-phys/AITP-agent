import { fromMarkdown } from 'mdast-util-from-markdown'
import { posix } from 'node:path'

type Node = ReturnType<typeof fromMarkdown> | ReturnType<typeof fromMarkdown>['children'][number]
/** A headed source span with UTF-16 offsets and a Unicode-preserving derived anchor; text is trimmed. */
export interface SourceSection {
  readonly title: string
  readonly anchor: string
  readonly start: number
  readonly end: number
  readonly text: string
}
/** A root-relative local link whose explicit label or enclosing heading supplies its relationship role. */
export interface SourceLink { readonly path: string; readonly title: string; readonly section: string; readonly role: 'parent' | 'child' | 'reference'; readonly text: string }
/** Authored title, opening and spans; anchor entries retain all matches rather than silently resolving duplicates. */
export interface ParsedMarkdown {
  readonly title: string
  readonly opening: string
  readonly sections: readonly SourceSection[]
  readonly links: readonly SourceLink[]
  readonly anchors: ReadonlyMap<string, readonly SourceSection[]>
}

function nodeText(node: Node): string {
  if ('value' in node) return node.value
  if ('children' in node) return node.children.map(child => nodeText(child)).join('')
  return ''
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/g, '-')
}

function role(title: string, section: string): SourceLink['role'] {
  if (/^(parent(?: topic)?|upstream|父课题|上级课题|返回主课题|所属课题)$/i.test(title.trim()) || /^(parent(?: topic)?|父课题|上级课题)$/i.test(section)) return 'parent'
  if (/^(topics?|subtopics?|branches|child topics?|课题|子课题|子方向|研究分支|分支)$/i.test(section)) return 'child'
  return 'reference'
}

/**
 * Parse source spans without requiring a note template or deriving claims from headings.
 * @param path - root-relative source path used to resolve local links and provide a missing-title fallback.
 * @param text - complete source text, retained by spans without rewriting unfamiliar sections.
 * @returns parsed headings and local relationships; links escaping the root are excluded, not followed.
 */
export function parseMarkdown(path: string, text: string): ParsedMarkdown {
  const tree = fromMarkdown(text)
  const headings = tree.children.filter(node => node.type === 'heading')
  const title = headings.find(node => node.depth === 1)
  const sectionHeadings = headings.filter(node => node.depth > 1)
  const sections: SourceSection[] = sectionHeadings.map((heading, index) => {
    const start = heading.position?.start.offset ?? 0
    const next = sectionHeadings.slice(index + 1).find(candidate => candidate.depth <= heading.depth)
    const end = next?.position?.start.offset ?? text.length
    const name = nodeText(heading)
    return { title: name, anchor: slug(name), start, end, text: text.slice(start, end).trim() }
  })
  const anchors = new Map<string, SourceSection[]>()
  const explicitAnchors = new Map<string, SourceSection[]>()
  const addAnchor = (anchor: string, section: SourceSection): void => { anchors.set(anchor, [...(anchors.get(anchor) ?? []), section]) }
  if (title) addAnchor(slug(nodeText(title)), { title: nodeText(title), anchor: slug(nodeText(title)), start: 0, end: text.length, text })
  for (const section of sections) addAnchor(section.anchor, section)
  const definitions = new Map(tree.children.filter(node => node.type === 'definition').map(node => [node.identifier.toLowerCase(), node.url]))
  const links: SourceLink[] = []
  const visit = (node: Node): void => {
    const offset = node.position?.start.offset ?? 0
    const section = [...sections].reverse().find(candidate => candidate.start <= offset && candidate.end > offset)
    if (node.type === 'html') {
      for (const match of node.value.matchAll(/<a\s+[^>]*(?:id|name)\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
        const anchor = match[1]
        if (anchor === undefined) continue
        const following = sections.find(candidate => candidate.start > offset)
        const target = following ?? section ?? {
          title: title ? nodeText(title) : path, anchor, start: 0, end: text.length, text,
        }
        explicitAnchors.set(anchor, [...(explicitAnchors.get(anchor) ?? []), target])
      }
    }
    let url: string | undefined
    if (node.type === 'link') url = node.url
    if (node.type === 'linkReference') url = definitions.get(node.identifier.toLowerCase())
    if (url !== undefined && !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(url)) {
      let decoded: string | undefined
      try { decoded = decodeURIComponent(url.split('#')[0] ?? '') }
      catch (error) { if (!(error instanceof URIError)) throw error }
      if (decoded && !decoded.includes('\\') && !decoded.includes('\0')) {
        // Directory links remain references; source reads will report that they contain no file text.
        const target = posix.normalize(posix.join(posix.dirname(path), decoded)).replace(/\/+$/, '')
        if (target !== '' && target !== '.' && target !== '..' && !target.startsWith('../')) {
          const label = nodeText(node)
          links.push({ path: target, title: label, section: section?.title ?? '', role: role(label, section?.title ?? ''), text: text.slice(node.position?.start.offset ?? 0, node.position?.end.offset ?? 0) })
        }
      }
    }
    if ('children' in node) for (const child of node.children) visit(child)
  }
  visit(tree)
  for (const [anchor, targets] of explicitAnchors) anchors.set(anchor, targets)
  return {
    title: title ? nodeText(title) : posix.basename(posix.dirname(path)) || path,
    opening: text.slice(title?.position?.end.offset ?? 0, sectionHeadings[0]?.position?.start.offset ?? text.length).trim(),
    sections, links, anchors,
  }
}

/**
 * Select a recognized section only when its heading matches unambiguously.
 * @param parsed - the current source's parsed sections.
 * @param names - a heading predicate, normally a non-global regular expression.
 * @returns the sole matching section, or undefined for absent or duplicate matches.
 */
export function namedSection(parsed: ParsedMarkdown, names: RegExp): SourceSection | undefined {
  const matches = parsed.sections.filter(section => names.test(section.title))
  return matches.length === 1 ? matches[0] : undefined
}
