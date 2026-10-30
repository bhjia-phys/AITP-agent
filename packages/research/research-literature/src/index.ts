/** Local paper artifacts and authored reading routes over shared source access. */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { posix } from 'node:path'
import { pathForSourceId, resourceEntryId, sourceIdForPath } from '@deepseek-ai/dsh-research-resources'
import { markupAttribute, parseSourceMarkup } from '@deepseek-ai/dsh-research-resources/markup'
import type { ResourceLink, ResourceProvider, ResourceSummary, SourceProviderContext, SourceRef } from '@deepseek-ai/dsh-research-resources'
import type { MarkupDocument } from '@deepseek-ai/dsh-research-resources/markup'
import { readPdf } from './pdf.ts'

/** Existing reading entry points and bounded PDF extraction; all reads still obey shared root limits. */
export interface Config {
  /** Show primary PDF artifacts and omit extracted source/figure files from the global paper catalog. */
  readonly primaryPdfOnly: boolean
  /** Existing root-relative Markdown reading-index entry points. */
  readonly readingIndexPaths: string[]
  /** Include existing top-level Markdown reading maps in a dedicated reading root. */
  readonly includeRootReadingNotes: boolean
  /** Maximum explicitly linked reading notes inspected per admitted root. */
  readonly maxReadingNotes: number
  /** Maximum original PDF bytes accepted before page extraction. */
  readonly maxPdfBytes: number
  /** Maximum physical pages extracted for an unlocated initial reading. */
  readonly initialPdfPages: number
  /** Maximum complete page-text characters retained by one PDF reading. */
  readonly maxPdfTextCharacters: number
  /** Maximum original PDF bytes offered for any inline visual preview. */
  readonly maxInlinePdfBytes: number
}

export const Config: z<Partial<Config>, Config> = z.object({
  primaryPdfOnly: z.boolean().default(false),
  readingIndexPaths: z.array(z.string()).default(['index.md', 'README.md']),
  includeRootReadingNotes: z.boolean().default(false),
  maxReadingNotes: z.number().step(1).min(1).max(10000).default(256),
  maxPdfBytes: z.number().step(1).min(1).max(268435456).default(33554432),
  initialPdfPages: z.number().step(1).min(1).max(1000).default(4),
  maxPdfTextCharacters: z.number().step(1).min(1).max(10000000).default(120000),
  maxInlinePdfBytes: z.number().step(1).min(0).max(268435456).default(1048576),
})
export const name = 'research-literature'
export const inject = ['researchResources']

function paperArtifact(context: SourceProviderContext, path: string, primaryPdfOnly: boolean): ResourceSummary | undefined {
  if (!/\.(pdf|tex|bib)$/i.test(path)) return undefined
  if (primaryPdfOnly && (!/\.pdf$/i.test(path) || path.split('/').some(part => part.toLowerCase() === 'source'))) return undefined
  const arxiv = primaryPdfOnly ? /^arxiv\/([^/]+)\/paper\.pdf$/i.exec(path)?.[1] : undefined
  const reference = { rootId: context.root.id, sourceId: sourceIdForPath(path) }
  return { id: resourceEntryId(reference), ref: reference, title: arxiv === undefined ? posix.basename(path) : `arXiv ${arxiv}`,
    kind: 'literature', domain: 'literature', providerId: name, metadata: {
      format: posix.extname(path).slice(1).toLowerCase(), titleSource: arxiv === undefined ? 'filename' : 'local-identifier',
      ...arxiv === undefined ? {} : { arxiv }, work: 'unknown', edition: 'unknown',
    }, links: [], topics: [] }
}

function readingNote(context: SourceProviderContext, path: string, document: MarkupDocument,
  links: readonly ResourceLink[]): ResourceSummary | undefined {
  const kind = markupAttribute(document, 'kind')
  if (!/^(paper|paper-map|section|section-note|source-reading|reading)$/i.test(kind ?? '')
    && !document.links.some(link => /\.(pdf|tex|bib)(?:#|$)/i.test(link.href))) return undefined
  const metadata: Record<string, string> = { recordKind: 'source-reading' }
  for (const key of ['kind', 'authors', 'year', 'arxiv', 'doi', 'edition', 'version', 'reading_depth', 'close_reading', 'support', 'review']) {
    const value = markupAttribute(document, key)
    if (value !== undefined) metadata[key] = value
  }
  const reference = { rootId: context.root.id, sourceId: sourceIdForPath(path) }
  return { id: resourceEntryId(reference), ref: reference, title: markupAttribute(document, 'title') ?? document.title ?? path,
    kind: 'literature', domain: 'literature', providerId: name, metadata, links, topics: [] }
}

/** Enrich only an exact PDF linked by one authored paper map, retaining the map itself. */
function projectCatalog(items: readonly ResourceSummary[]): readonly ResourceSummary[] {
  const key = (ref: SourceRef): string => JSON.stringify([ref.rootId, ref.sourceId])
  const maps = new Map<string, ResourceSummary[]>()
  for (const item of items) {
    if (item.providerId !== name || item.metadata.recordKind !== 'source-reading' || item.metadata.kind !== 'paper') continue
    const targets = new Map(item.links.flatMap(link => link.target !== undefined && link.target.sourceId.startsWith('source:')
      && /\.pdf$/i.test(pathForSourceId(link.target.sourceId)) ? [[key(link.target), link.target] as const] : []))
    if (targets.size !== 1) continue
    const target = targets.keys().next().value
    if (target === undefined) continue
    const entries = maps.get(target) ?? []
    entries.push(item)
    maps.set(target, entries)
  }
  return items.map((item) => {
    if (item.providerId !== name || item.metadata.format !== 'pdf') return item
    const candidates = maps.get(key(item.ref)) ?? []
    if (candidates.length !== 1) return item
    const map = candidates[0]
    if (map === undefined) return item
    const metadata = { ...item.metadata, titleSource: 'reading-note', readingNote: map.title }
    for (const field of ['authors', 'year', 'reading_depth', 'close_reading', 'support', 'review', 'version']) {
      const value = map.metadata[field]
      if (value !== undefined) Object.assign(metadata, { [field]: value })
    }
    const topics = [...item.topics]
    for (const topic of map.topics) {
      if (!topics.some(existing => existing.workspaceId === topic.workspaceId && existing.topicId === topic.topicId
        && existing.reason === topic.reason)) topics.push(topic)
    }
    return { ...item, title: map.title, metadata, topics }
  })
}

/**
 * Project local paper artifacts and explicit source-reading links without guessing their edition.
 * @param config - existing note entry points and complete extraction limits.
 * @returns an independent domain contribution with a real PDF page reader.
 */
export function createLiteratureProvider(config: Config): ResourceProvider {
  return { id: name, domain: 'literature',
    projectCatalog,
    async projectSources(context, signal) {
      const summaries: ResourceSummary[] = []
      for (const path of context.paths) {
        signal.throwIfAborted()
        const artifact = paperArtifact(context, path, false)
        if (artifact !== undefined) { summaries.push(artifact); continue }
        if (!/\.(?:md|markdown)$/i.test(path)) continue
        try {
          const document = parseSourceMarkup(await context.files.read(path, signal))
          for (const issue of document.issues) context.reportIssue(path, issue)
          const links = document.links.map((link) => {
            const resolved = context.resolveLink(path, link.href)
            return { label: link.label, href: link.href, ...(resolved === undefined ? {} : { target: resolved.ref,
              ...(resolved.locator === undefined ? {} : { locator: resolved.locator }) }) }
          })
          const note = readingNote(context, path, document, links)
          if (note !== undefined) summaries.push(note)
        } catch (error) {
          void error
          signal.throwIfAborted()
          context.reportIssue(path, 'The explicitly linked literature reading could not be read within the configured source limits.')
        }
      }
      return summaries
    },
    async list(context, signal) {
      const summaries: ResourceSummary[] = []
      for (const path of context.paths) {
        const artifact = paperArtifact(context, path, config.primaryPdfOnly)
        if (artifact !== undefined) summaries.push(artifact)
      }
      const queue = [...new Set([
        ...config.readingIndexPaths.filter(path => context.paths.includes(path)),
        ...config.includeRootReadingNotes ? context.paths.filter(path => !path.includes('/') && /\.md$/i.test(path)) : [],
      ])]
      const visited = new Set<string>()
      while (queue.length > 0 && visited.size < config.maxReadingNotes) {
        signal.throwIfAborted()
        const path = queue.shift()
        if (path === undefined || visited.has(path)) continue
        visited.add(path)
        let text: string
        try { text = await context.files.read(path, signal) }
        catch (error) {
          if (signal.aborted) throw error
          context.reportIssue(path, 'The existing literature reading could not be read within the configured source limits.')
          continue
        }
        const document = parseSourceMarkup(text)
        for (const issue of document.issues) context.reportIssue(path, issue)
        const links: ResourceLink[] = document.links.map((link) => {
          const resolved = context.resolveLink(path, link.href)
          if (resolved !== undefined && resolved.ref.rootId === context.root.id && resolved.ref.sourceId.startsWith('source:')) {
            const target = pathForSourceId(resolved.ref.sourceId)
            if (/\.md$/i.test(target) && !visited.has(target) && !queue.includes(target)) queue.push(target)
          }
          return { label: link.label, href: link.href, ...(resolved === undefined ? {} : { target: resolved.ref,
            ...(resolved.locator === undefined ? {} : { locator: resolved.locator }) }) }
        })
        const note = readingNote(context, path, document, links)
        if (note !== undefined) summaries.push(note)
      }
      if (queue.length > 0) context.reportIssue('', 'The literature reading-note traversal reached its configured bound; further linked notes remain uninspected.')
      return summaries
    },
    async read(context, reference, locator, signal) {
      if (!reference.sourceId.startsWith('source:')) return undefined
      const path = pathForSourceId(reference.sourceId)
      if (!/\.pdf$/i.test(path)) return undefined
      const bytes = await context.files.readBytes(path, signal, config.maxPdfBytes)
      try {
        const body = await readPdf(bytes, locator, { maxPages: config.initialPdfPages,
          maxTextCharacters: config.maxPdfTextCharacters, maxInlineBytes: config.maxInlinePdfBytes }, signal)
        if (body.kind === 'pdf') {
          if (locator === undefined && body.pages.length < body.pageCount) context.reportIssue(path,
            `Only the first ${body.pages.length} physical PDF pages were extracted. Other pages remain available through explicit page reads.`)
          if (body.pages.some(page => page.text.length === 0)) context.reportIssue(path, 'A selected page has no extractable text. Scanned material needs an OCR provider.')
        }
        return body
      } catch (error) {
        if (signal.aborted) throw error
        const detail = error instanceof Error && error.name === 'PasswordException'
          ? 'The PDF is password-protected; this reader has no admitted password.'
          : 'The admitted PDF could not be parsed. Its original file remains unchanged.'
        context.reportIssue(path, detail)
        return { kind: 'unavailable', reason: 'unavailable', detail }
      }
    },
  }
}

/**
 * Mount local literature independently of knowledge, code and model providers.
 * @param ctx - Host plugin context with shared source access.
 * @param config - bounded literature-reading configuration.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.effect(() => ctx.researchResources.registerProvider(createLiteratureProvider(config)), 'research-literature: provider')
}
