/** AITP knowledge-index projections over shared, explicitly admitted source roots. */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { pathForSourceId, resourceEntryId, sourceIdForPath } from '@deepseek-ai/dsh-research-resources'
import { markupAttribute, parseSourceMarkup } from '@deepseek-ai/dsh-research-resources/markup'
import type { MarkupDocument, MarkupLink } from '@deepseek-ai/dsh-research-resources/markup'
import type { ResourceLink, ResourceProvider, ResourceSummary, SourceProviderContext, SourceRef } from '@deepseek-ai/dsh-research-resources'

/** Existing index locations relative to each admitted root; no scientific files are created. */
export interface Config {
  /** Existing root-relative index entry points; absent files are never created. */
  readonly indexPaths: string[]
}

export const Config: z<Partial<Config>, Config> = z.object({ indexPaths: z.array(z.string()).default(['index.md', 'README.md']) })
export const name = 'research-knowledge'
export const inject = ['researchResources']

function normalizedHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function authoredKind(value: string | undefined): string {
  if (value === undefined) return 'entry'
  if (/^(concept|theorem|technique|example|result|atom)$/i.test(value)) return 'atom'
  if (/^(paper|paper-map|section|section-note|source-reading|reading)$/i.test(value)) return 'source-reading'
  if (/^(story|learning-story|question)$/i.test(value)) return 'story'
  if (/^(author|author-collection)$/i.test(value)) return 'author-collection'
  return value
}

function recordedMetadata(document: MarkupDocument): Record<string, string> {
  const result: Record<string, string> = {}
  for (const key of ['kind', 'area', 'aliases', 'support', 'review', 'reading_depth', 'close_reading', 'origin', 'sources', 'status']) {
    const value = markupAttribute(document, key)
    if (value !== undefined) result[key] = value
  }
  result.entryKind = authoredKind(result.kind)
  return result
}

function sourceLink(context: SourceProviderContext, path: string, link: MarkupLink): ResourceLink {
  const resolved = context.resolveLink(path, link.href)
  return { label: link.label, href: link.href,
    ...(resolved === undefined ? { reason: 'The original link has not resolved to an admitted local source.' }
      : { target: resolved.ref, ...(resolved.locator === undefined ? {} : { locator: resolved.locator }) }) }
}

function sameRef(left: SourceRef, right: SourceRef): boolean {
  return left.rootId === right.rootId && left.sourceId === right.sourceId
}

/**
 * Project the existing index and its explicitly linked reading routes without promoting claims.
 * @param config - configured existing index paths.
 * @returns a disposable-registry contribution; it owns no source authority or scientific writes.
 */
export function createKnowledgeProvider(config: Config): ResourceProvider {
  return { id: name, domain: 'knowledge',
    async list(context, signal) {
      const summaries: ResourceSummary[] = []
      const observedDocuments = new Map<string, Promise<MarkupDocument | undefined>>()
      const targetMetadata = async (reference: SourceRef): Promise<Record<string, string>> => {
        if (reference.rootId !== context.root.id || !reference.sourceId.startsWith('source:')) return {}
        const path = pathForSourceId(reference.sourceId)
        if (!/\.md$/i.test(path)) return {}
        let reading = observedDocuments.get(path)
        if (reading === undefined) {
          reading = context.files.read(path, signal).then(parseSourceMarkup, (error: unknown) => {
            if (signal.aborted) throw error
            context.reportIssue(path, 'The indexed knowledge owner could not be read; its index record remains available.')
            return undefined
          })
          observedDocuments.set(path, reading)
        }
        const document = await reading
        return document === undefined ? {} : recordedMetadata(document)
      }
      const indexes = config.indexPaths.filter(path => context.paths.includes(path))
      for (const path of indexes) {
        signal.throwIfAborted()
        let text: string
        try { text = await context.files.read(path, signal) }
        catch (error) {
          if (signal.aborted) throw error
          context.reportIssue(path, 'The existing knowledge index could not be read within the configured source limits.')
          continue
        }
        const document = parseSourceMarkup(text)
        for (const issue of document.issues) context.reportIssue(path, issue)
        const reference: SourceRef = { rootId: context.root.id, sourceId: sourceIdForPath(path) }
        const links = document.links.map(link => sourceLink(context, path, link))
        summaries.push({ id: resourceEntryId(reference), ref: reference, title: document.title ?? path,
          kind: 'knowledge', domain: 'knowledge', providerId: name,
          metadata: { ...recordedMetadata(document), entryKind: 'index', catalogScope: 'Existing authored index and its explicit links.' }, links, topics: [] })
        const rowLinks = new Set<number>()
        for (const table of document.tables) {
          const header = table.header.map(normalizedHeader)
          const titleIndex = header.findIndex(value => /^(entry|question|story|concept|条目|问题|学习主线)$/.test(value))
          if (titleIndex < 0) continue
          const supportIndex = header.findIndex(value => /^(support|支持|依据)$/.test(value))
          const statusIndex = header.findIndex(value => /^(status|state|review|review state|状态|审阅)$/.test(value))
          const kindIndex = header.findIndex(value => /^(kind|type|类型)$/.test(value))
          const questionIndex = header.findIndex(value => /what it answers|question|scope|回答|适用/.test(value))
          const ownerIndex = header.findIndex(value => /^(note|explanation|atom|owner|笔记|解释|原文)$/.test(value))
          for (const row of table.rows) {
            const title = row.cells[titleIndex]?.trim()
            if (!title) continue
            for (const link of row.links) rowLinks.add(link.start)
            const authoredLinks = row.links.map(link => sourceLink(context, path, link))
            const ownerLinks = ownerIndex < 0 ? row.cellLinks[titleIndex] ?? [] : row.cellLinks[ownerIndex] ?? []
            const preferred = ownerLinks.map(link => sourceLink(context, path, link))
            const targets = (preferred.length > 0 ? preferred : authoredLinks).flatMap(link => link.target === undefined
              ? [] : [{ ref: link.target, locator: link.locator }])
            const uniqueTargets = targets.filter((target, index) => targets.findIndex(other => sameRef(other.ref, target.ref)
              && JSON.stringify(other.locator) === JSON.stringify(target.locator)) === index)
            const target = uniqueTargets.length === 1 ? uniqueTargets[0] : undefined
            const support = supportIndex < 0 ? undefined : row.cells[supportIndex]
            const status = statusIndex < 0 ? undefined : row.cells[statusIndex]
            const provisional = [support, status].some(value => value !== undefined && /\bprovisional\b|临时|待确认/i.test(value))
            const metadata: Record<string, string> = { ...(target === undefined || provisional ? {} : await targetMetadata(target.ref)),
              recordKind: 'index-row', indexPath: path, indexSection: table.section }
            metadata.entryKind = provisional ? 'provisional-pointer' : metadata.entryKind === undefined || metadata.entryKind === 'entry'
              ? header[titleIndex] === 'story' ? 'story' : 'entry' : metadata.entryKind
            if (support !== undefined) {
              if (metadata.support !== undefined) metadata.ownerSupport = metadata.support
              metadata.support = support
            }
            const recordedKind = kindIndex < 0 ? undefined : row.cells[kindIndex]
            if (recordedKind !== undefined) metadata.kind = recordedKind
            if (status !== undefined) metadata.status = status
            if (uniqueTargets.length > 1) metadata.targetState = 'multiple-source-links'
            const rowLocator = { kind: 'text' as const, start: row.start, end: row.end, quote: row.text }
            summaries.push({ id: resourceEntryId(reference, `row:${row.start}`), ref: target?.ref ?? reference,
              ...(target?.locator !== undefined ? { locator: target.locator } : target === undefined ? { locator: rowLocator } : {}),
              title, kind: 'knowledge', domain: 'knowledge', providerId: name,
              ...(questionIndex < 0 || row.cells[questionIndex] === undefined ? {} : { description: row.cells[questionIndex] }),
              metadata, topics: [], links: [...authoredLinks, { label: 'Original index row', href: `${path}#row-${row.start}`, target: reference, locator: rowLocator }] })
          }
        }
        for (const link of document.links) {
          if (rowLinks.has(link.start)) continue
          const resolved = context.resolveLink(path, link.href)
          if (resolved === undefined || sameRef(resolved.ref, reference)) continue
          const metadata: Record<string, string> = { ...await targetMetadata(resolved.ref), indexPath: path, indexSection: link.section }
          summaries.push({ id: resourceEntryId(reference, `link:${link.start}`), ref: resolved.ref,
            ...(resolved.locator === undefined ? {} : { locator: resolved.locator }), title: link.label || link.href,
            kind: 'knowledge', domain: 'knowledge', providerId: name, metadata, topics: [],
            links: [{ label: 'Original index link', href: path, target: reference,
              locator: { kind: 'text', start: link.start, end: link.end, quote: text.slice(link.start, link.end) } }] })
        }
      }
      return summaries
    },
  }
}

/**
 * Mount the knowledge projection independently of literature, code and conversation plugins.
 * @param ctx - Host plugin context with shared source access.
 * @param config - source index locations.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.effect(() => ctx.researchResources.registerProvider(createKnowledgeProvider(config)), 'research-knowledge: provider')
}
