import { randomUUID } from 'node:crypto'
import { posix, resolve } from 'node:path'
import { fromMarkdown } from 'mdast-util-from-markdown'
import type {
  ContextQuery, ContextRead, Project, ReadEnvelope, ReadOptions, Resource, ResourceId,
  ResearchSourceRange, ResourceReference, Result, Revision, Topic, TopicId, TopicPage, TopicQuery, TopicSummary,
} from './types.ts'
import { MarkdownFiles, pathForResourceId, pathForTopicId, resourceIdForPath, sourceFailure, SourceError, topicIdForPath } from './markdown-files.ts'
import type { ScanIssue } from './markdown-files.ts'
import { curatedMaterialsHeading, namedSection, parseMarkdown } from './markdown-model.ts'
import type { ParsedMarkdown } from './markdown-model.ts'
import { renderedSelectionRanges } from './markdown-selection.ts'
import { fittingSourcePrefix } from './context-excerpt.ts'

export { pathForResourceId, resourceIdForPath, topicIdForPath } from './markdown-files.ts'

/** Authorized root and positive bounds for discovery/selected-source entries, complete file bytes and serialized context characters. */
export interface MarkdownWorkspaceConfig {
  readonly root: string
  readonly maxFiles: number
  readonly maxFileBytes: number
  readonly maxContextCharacters: number
  /** Receives directories visited by bounded discovery for optional notification coverage. */
  readonly onDirectories?: (directories: readonly string[], partial: boolean) => void
}

/** A complete fresh source observation; its revision is an opaque read token, not a content hash or edit precondition. */
export interface MarkdownSource {
  readonly resourceId: ResourceId
  readonly relativePath: string
  readonly text: string
  readonly revision: Revision
  readonly observedAt: string
}

/** Rebuild observation and discovered counts; issues make incompleteness visible without changing source documents. */
export interface MarkdownIndexStatus {
  readonly revision: Revision
  readonly observedAt: string
  readonly files: number
  readonly topics: number
  readonly completeness: 'complete' | 'partial'
  readonly issues: readonly ScanIssue[]
}

/** Explicit material uses in recognized topic accounts, before cross-root resolution. */
export interface MarkdownMaterialLinks {
  readonly revision: Revision
  readonly links: readonly { readonly topicId: TopicId; readonly accountPath: string; readonly href: string; readonly reason: string }[]
}

/** Original user question and optional displayed origin; supplying text does not establish ownership or a decision. */
export interface OriginQuery {
  readonly topicId?: TopicId
  readonly resourceId?: ResourceId
  readonly anchor?: string
  readonly selectedText?: string
  readonly selectedTextFormat?: 'source' | 'rendered'
  readonly selectedRange?: ResearchSourceRange
  readonly question: string
}

/** Located source and candidate ownership; missing or ambiguous origins remain explicit instead of choosing a topic. */
export interface ResolvedOrigin {
  readonly status: 'resolved' | 'ambiguous' | 'missing'
  readonly question: string
  readonly topicId?: TopicId
  readonly candidateTopicIds: readonly TopicId[]
  readonly resourceId?: ResourceId
  readonly anchor?: string
  readonly selectedText?: string
  readonly selectedTextFormat?: 'source' | 'rendered'
  /** Exact raw interval for a uniquely located quote; retained independently of its rendered spelling. */
  readonly selectedRange?: ResearchSourceRange
  readonly selectedPassage?: string
  readonly source?: MarkdownSource
  readonly reason?: string
}

interface Note { readonly source: MarkdownSource; readonly parsed: ParsedMarkdown }
interface Index {
  readonly paths: ReadonlySet<string>
  readonly topicPaths: ReadonlySet<string>
  readonly notes: ReadonlyMap<string, Note>
  readonly parents: ReadonlyMap<string, readonly string[]>
  readonly users: ReadonlyMap<string, readonly string[]>
  readonly status: MarkdownIndexStatus
  readonly sourceIssues: readonly ScanIssue[]
  readonly unobserved: boolean
  readonly supplemented: boolean
  readonly establishedParents: ReadonlyMap<string, string>
  readonly establishedOwners: ReadonlyMap<string, string>
}
interface SelectedSources {
  readonly index: Index
  readonly fresh: ReadonlyMap<string, MarkdownSource>
}

function uniqueRelations(relations: ReadonlyMap<string, readonly string[]>): ReadonlyMap<string, string> {
  const unique = new Map<string, string>()
  for (const [path, values] of relations) {
    const value = values[0]
    if (values.length === 1 && value !== undefined) unique.set(path, value)
  }
  return unique
}

function relationships(paths: ReadonlySet<string>, notes: ReadonlyMap<string, Note>) {
  const topicPaths = new Set([...paths].filter(path => posix.basename(path).toLowerCase() === 'research.md' && path !== 'research.md'))
  for (const note of notes.values()) {
    for (const link of note.parsed.links) {
      if (link.role !== 'reference' && /\.md$/i.test(link.path) && paths.has(link.path) && link.path !== 'research.md') topicPaths.add(link.path)
    }
  }
  const parents = new Map<string, Set<string>>()
  const users = new Map<string, Set<string>>()
  const issues: ScanIssue[] = []
  const add = (map: Map<string, Set<string>>, target: string, owner: string): void => {
    const values = map.get(target) ?? new Set<string>()
    values.add(owner)
    map.set(target, values)
  }
  for (const [path, note] of notes) {
    const siblingOwner = posix.join(posix.dirname(path), 'research.md')
    const owner = topicPaths.has(path) ? path
      : /^readme\.md$/i.test(posix.basename(path)) && topicPaths.has(siblingOwner) ? siblingOwner : undefined
    for (const link of note.parsed.links) {
      if (owner) add(users, link.path, owner)
      if (owner && topicPaths.has(link.path) && link.path !== owner) {
        if (link.role === 'child') add(parents, link.path, owner)
        if (link.role === 'parent') add(parents, owner, link.path)
      }
    }
  }
  for (const [child, candidates] of parents) {
    if (candidates.size > 1) issues.push({ path: child, reason: 'Several explicit parent relationships exist; no primary parent was chosen.' })
    const seen = new Set([child])
    let next = [...candidates][0]
    while (next !== undefined && parents.get(next)?.size === 1) {
      if (seen.has(next)) { candidates.clear(); issues.push({ path: child, reason: 'Explicit parent relationships form a cycle; the parent remains unresolved.' }); break }
      seen.add(next)
      next = [...(parents.get(next) ?? [])][0]
    }
  }
  return {
    topicPaths, issues,
    parents: new Map([...parents].map(([path, values]) => [path, [...values]])),
    users: new Map([...users].map(([path, values]) => [path, [...values]])),
  }
}

function sameSources(left: Index, paths: ReadonlySet<string>, notes: ReadonlyMap<string, Note>, issues: readonly ScanIssue[]): boolean {
  return left.paths.size === paths.size && [...paths].every(path => left.paths.has(path))
    && left.notes.size === notes.size && [...notes].every(([path, note]) => left.notes.get(path)?.source.text === note.source.text)
    && JSON.stringify(left.status.issues) === JSON.stringify(issues)
}

function textSource(path: string): boolean {
  return /\.(?:md|txt|tex|py|ts|tsx|js|json|yaml|yml|csv|log|sh|cpp|cc|h|hpp|f90)$/i.test(path)
}

function accountCandidate(index: Index, path: string): boolean {
  return path !== 'research.md' && /\.md$/i.test(path) && (index.topicPaths.has(path)
    || posix.basename(path).toLowerCase() === 'research.md'
    || [...index.notes.values()].some(note => note.parsed.links.some(link => link.path === path && link.role !== 'reference')))
}

/** Reads ordinary notes inside one configured root. Derived views never edit their sources. */
export class MarkdownWorkspace {
  /** Absolute configured root; each filesystem operation separately resolves real paths and checks containment. */
  readonly root: string
  private readonly files: MarkdownFiles
  private readonly instanceId = randomUUID()
  private sequence = 0
  private index: Index | undefined
  private discovered: Index | undefined
  private readonly supplements = new Map<string, Note | null>()
  private rebuilding: Promise<Result<MarkdownIndexStatus>> | undefined
  private readonly parsedSources = new Map<string, { readonly text: string; readonly parsed: ParsedMarkdown }>()

  constructor(private readonly config: MarkdownWorkspaceConfig) {
    for (const bound of [config.maxFiles, config.maxFileBytes, config.maxContextCharacters]) {
      if (!Number.isSafeInteger(bound) || bound < 1) throw new SourceError('invalid-request', 'Research source limits must be positive safe integers.')
    }
    this.root = resolve(config.root)
    this.files = new MarkdownFiles(this.root, config.maxFiles, config.maxFileBytes)
  }

  /**
   * Project authored links from the latest rebuilt topic index without guessing cross-root ownership.
   * @returns original using passages and their research-topic identity; source resolution remains shared-service work.
   * @throws {SourceError} before the first successful index rebuild.
   */
  materialLinks(): MarkdownMaterialLinks {
    const index = this.index
    if (index === undefined) throw new SourceError('unavailable', 'The research topic index has not been built.')
    return { revision: index.status.revision, links: [...index.topicPaths].flatMap((path) => {
      const note = index.notes.get(path)
      return note === undefined ? [] : note.parsed.authoredLinks.map(link => ({
        topicId: topicIdForPath(path), accountPath: path, href: link.href,
        reason: link.context || link.title || link.section,
      }))
    }) }
  }

  /**
   * Read current bytes without delivering model context or consulting cached source contents.
   * @param resourceId - path-derived identity of a source inside the configured root.
   * @param options - optional read cancellation; no signal means the caller supplies no cancellation lifetime.
   * @returns a complete text observation, or a typed cancellation, identity, access or source-size failure.
   */
  async readSource(resourceId: ResourceId, options?: ReadOptions): Promise<Result<MarkdownSource>> {
    return this.attempt(async () => {
      const relativePath = pathForResourceId(resourceId)
      const text = await this.files.read(relativePath, options?.signal)
      return { resourceId, relativePath, text, revision: this.revision(), observedAt: new Date().toISOString() }
    }, options)
  }

  /**
   * Rebuild derived discovery and explicit relationships without modifying source documents.
   * Concurrent callers share the existing rebuild and its initiating cancellation lifetime.
   * @param options - cancellation and whether unchanged fresh discovery can retain its cursor identity.
   * @returns discovered counts and omission issues, or a typed failure when rebuilding cannot complete.
   */
  async rebuild(options?: ReadOptions & { readonly preserveUnchangedRevision?: boolean }): Promise<Result<MarkdownIndexStatus>> {
    if (this.rebuilding) return this.rebuilding
    this.rebuilding = this.attempt(async () => {
      const scan = await this.files.scan(options?.signal)
      this.config.onDirectories?.(scan.directories ?? [''], scan.partial)
      const paths = new Set(scan.paths)
      const notes = new Map<string, Note>()
      const topicPaths = new Set(scan.paths.filter(path => posix.basename(path).toLowerCase() === 'research.md' && path !== 'research.md'))
      const pending = scan.paths.filter(path => /^(research|readme)\.md$/i.test(posix.basename(path)))
      const issues = [...scan.issues]
      for (const path of pending) {
        if (notes.has(path)) continue
        const source = await this.readSource(resourceIdForPath(path), options)
        if (!source.ok) { issues.push({ path, reason: source.error.message }); continue }
        const parsed = this.parse(source.value)
        notes.set(path, { source: source.value, parsed })
        for (const link of parsed.links) {
          if ((link.role === 'child' || link.role === 'parent') && /\.md$/i.test(link.path) && paths.has(link.path) && link.path !== 'research.md') {
            topicPaths.add(link.path)
            if (!pending.includes(link.path)) pending.push(link.path)
          }
        }
      }
      const relation = relationships(paths, notes)
      const sourceIssues = [...issues]
      issues.push(...relation.issues)
      const completeness = scan.partial || issues.length ? 'partial' : 'complete'
      const previous = this.index
      const unchanged = options?.preserveUnchangedRevision && previous !== undefined
        && previous.status.completeness === completeness && sameSources(previous, paths, notes, issues)
      const status: MarkdownIndexStatus = {
        revision: unchanged ? previous.status.revision : this.revision(),
        observedAt: new Date().toISOString(), files: paths.size, topics: relation.topicPaths.size, completeness, issues,
      }
      this.index = {
        paths, notes, topicPaths: relation.topicPaths, status, sourceIssues,
        parents: relation.parents, users: relation.users,
        unobserved: scan.partial || sourceIssues.length > 0, supplemented: false,
        establishedParents: uniqueRelations(relation.parents), establishedOwners: uniqueRelations(relation.users),
      }
      this.discovered = this.index
      this.supplements.clear()
      return status
    }, options)
    try { return await this.rebuilding }
    finally { this.rebuilding = undefined }
  }

  /**
   * Rebuild discovery after any active rebuild finishes, so refresh cannot reuse a pre-change snapshot.
   * @param resourceId - optional source to validate by reading before starting the fresh rebuild.
   * @returns new index status, or the validation/rebuild failure; this method supplies no cancellation signal.
   */
  async refresh(resourceId?: ResourceId): Promise<Result<MarkdownIndexStatus>> {
    if (resourceId !== undefined) {
      const read = await this.readSource(resourceId)
      if (!read.ok) return read
    }
    if (this.rebuilding) await this.rebuilding
    return this.rebuild()
  }

  /**
   * Read the authored project title and opening after discovery; empty roots do not acquire a new note.
   * @param options - optional cancellation for discovery and the fresh root-account read.
   * @returns a runtime project envelope, with a directory-name fallback and no inferred scientific directions, or a typed failure.
   */
  async getProject(options?: ReadOptions): Promise<Result<ReadEnvelope<Project>>> {
    return this.attempt(async () => {
      const index = await this.ensure(options)
      const root = index.paths.has('research.md') ? await this.mustRead('research.md', options) : undefined
      const authored = root === undefined ? undefined : this.parse(root)
      return this.envelope({
        id: 'project', title: authored?.title ?? posix.basename(this.root),
        ...(authored?.opening ? { summary: authored.opening } : {}),
        ...(root === undefined ? {} : { accountResourceId: root.resourceId }),
        directions: [], seeds: [],
      }, root)
    }, options)
  }

  /**
   * Read a bounded topic page with fresh account text and relationships from the observed index.
   * @param query - parent scope, page limit and optional cursor belonging to this index snapshot and scope.
   * @param options - optional cancellation for discovery and each selected account read.
   * @returns observed topic summaries and discovery completeness, or a failure for stale cursors, invalid bounds or unreadable accounts.
   */
  async listTopics(query: TopicQuery, options?: ReadOptions): Promise<Result<ReadEnvelope<TopicPage>>> {
    return this.attempt(async () => {
      const index = await this.ensure(options)
      const limit = query.limit ?? this.config.maxFiles
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > this.config.maxFiles) throw new SourceError('invalid-request', 'Topic page limit is outside the configured discovery bound.')
      const scope = query.parentId === undefined ? 'all' : query.parentId === null ? 'roots' : query.parentId
      let offset = 0
      if (query.cursor !== undefined) {
        const expectedPrefix = `${index.status.revision}:${encodeURIComponent(scope)}:`
        if (!query.cursor.startsWith(expectedPrefix) || !/^\d+$/.test(query.cursor.slice(expectedPrefix.length))) throw new SourceError('invalid-request', 'The topic cursor is stale or belongs to another query; restart from the first page.')
        offset = Number(query.cursor.slice(expectedPrefix.length))
      }
      const paths = [...index.topicPaths].filter((path) => {
        const parent = this.primaryParent(index, path)
        return query.parentId === undefined || (parent === undefined ? null : topicIdForPath(parent)) === query.parentId
      }).sort()
      if (!Number.isSafeInteger(offset) || offset > paths.length) throw new SourceError('invalid-request', 'The topic cursor is outside this snapshot.')
      const items: ReadEnvelope<TopicSummary>[] = []
      for (const path of paths.slice(offset, offset + limit)) {
        const source = await this.mustRead(path, options)
        items.push(this.envelope(this.topic(index, path, source), source))
      }
      return this.envelope({ items, nextCursor: offset + limit < paths.length ? `${index.status.revision}:${encodeURIComponent(scope)}:${offset + limit}` : null, completeness: index.status.completeness, ...(index.status.completeness === 'partial' ? { incompleteReason: index.status.issues.map(issue => `${issue.path}: ${issue.reason}`).join('\n') } : {}) })
    }, options)
  }

  /**
   * Read the current account; file nesting never supplies a scientific parent.
   * @param topicId - account identity recognized by inventory or validated direct selection during incomplete discovery.
   * @param options - optional cancellation for discovery and the fresh account read.
   * @returns an attributed topic projection preserving unrecognized account text, or a typed identity/access failure.
   */
  async getTopic(topicId: TopicId, options?: ReadOptions): Promise<Result<ReadEnvelope<Topic>>> {
    return this.attempt(async () => {
      const path = pathForTopicId(topicId)
      const selection = await this.selected(path, true, options)
      const { index } = selection
      if (!index.topicPaths.has(path)) throw new SourceError('not-found', 'The topic is outside the discovered scope. Refresh to discover new topics.')
      const source = selection.fresh.get(path) ?? await this.mustRead(path, options)
      return this.envelope(this.topic(index, path, source), source)
    }, options)
  }

  /**
   * Read current text for supported text formats; other materials remain navigable references.
   * @param resourceId - observed source identity, or an explicitly named file validated during incomplete discovery.
   * @param options - optional cancellation for discovery and the fresh supported-format read.
   * @returns an attributed material envelope with complete text or explicit unsupported-format content, or a typed read failure.
   */
  async getResource(resourceId: ResourceId, options?: ReadOptions): Promise<Result<ReadEnvelope<Resource>>> {
    return this.attempt(async () => {
      const path = pathForResourceId(resourceId)
      const selection = await this.selected(path, false, options)
      const { index } = selection
      if (!index.paths.has(path) && !index.users.has(path)) throw new SourceError('not-found', 'The resource is outside the discovered scope. Refresh to discover new resources.')
      const reference = this.reference(index, path)
      if (!textSource(path)) {
        return this.envelope({ ...reference, content: { kind: 'unavailable', reason: 'unsupported-format', detail: 'This reader currently opens Markdown and text sources only.' }, attribution: { sourceResourceIds: [resourceId] } })
      }
      const source = selection.fresh.get(path) ?? await this.mustRead(path, options)
      return this.envelope({ ...reference, content: { kind: /\.md$/i.test(path) ? 'markdown' : 'plain-text', text: source.text }, attribution: { sourceResourceIds: [resourceId] } }, source)
    }, options)
  }

  /**
   * Read coherent source units with omissions; the character bound includes the serialized JSON envelope.
   * @param query - recognized or explicitly selected account, related-source classes and optional tighter character/item bounds.
   * @param options - optional cancellation for discovery and fresh selected-source reads.
   * @returns bounded attributed context with complete units and explicit omissions;
   * invalid scope or an unusably small budget yields a typed failure.
   */
  async readContext(query: ContextQuery, options?: ReadOptions): Promise<Result<ReadEnvelope<ContextRead>>> {
    return this.attempt(async () => {
      const path = pathForTopicId(query.topicId)
      const selection = await this.selected(path, true, options)
      const { index } = selection
      if (!index.topicPaths.has(path)) throw new SourceError('not-found', 'The context topic is not discovered.')
      const maxCharacters = Math.min(query.maxCharacters ?? this.config.maxContextCharacters, this.config.maxContextCharacters)
      const maxItems = query.maxItems ?? this.config.maxFiles
      if (!Number.isSafeInteger(maxCharacters) || maxCharacters < 1 || !Number.isSafeInteger(maxItems) || maxItems < 1) throw new SourceError('invalid-request', 'Context bounds must be positive safe integers.')
      const include = new Set(query.include ?? ['ancestors', 'work'])
      const selected = [path]
      if (include.has('ancestors')) {
        const seen = new Set(selected)
        const candidates = index.supplemented ? [...(index.parents.get(path) ?? [])]
          : [this.primaryParent(index, path)].filter((parent): parent is string => parent !== undefined)
        for (const parent of candidates) if (!seen.has(parent)) {
          selected.push(parent)
          seen.add(parent)
          if (index.supplemented) candidates.push(...(index.parents.get(parent) ?? []))
          else {
            const next = this.primaryParent(index, parent)
            if (next !== undefined) candidates.push(next)
          }
        }
        if (index.paths.has('research.md')) selected.push('research.md')
      }
      if (include.has('children')) selected.push(...[...index.topicPaths].filter(candidate => this.primaryParent(index, candidate) === path))
      if (include.has('resources')) selected.push(...(index.notes.get(path)?.parsed.links.map(link => link.path) ?? []))
      const entries: ContextRead['entries'][number][] = []
      const omissions: ContextRead['omissions'][number][] = []
      if (index.status.completeness === 'partial') {
        omissions.push({ target: { kind: 'topic', id: query.topicId }, reason: 'Discovery is partial; sources or relationships outside the observed index may remain.' })
      }
      const response = this.envelope<ContextRead>({ topicId: query.topicId, entries, completeness: 'complete', omissions })
      for (const candidate of new Set(selected)) {
        const id = resourceIdForPath(candidate)
        if (entries.length >= maxItems) {
          omissions.push({ target: { kind: 'resource', id }, reason: 'This source was not read because the context item limit was reached.' })
          continue
        }
        const current = selection.fresh.get(candidate)
        const source = current === undefined ? await this.readSource(id, options) : { ok: true as const, value: current }
        if (!source.ok) { omissions.push({ target: { kind: 'resource', id }, reason: source.error.message }); continue }
        const parsed = this.parse(source.value)
        const isAccount = index.topicPaths.has(candidate) || candidate === 'research.md'
        const work = namedSection(parsed, /^(current work|当前工作|进行中的工作)$/i)
        const relevant = parsed.sections.filter((section) => {
          const links = parsed.links.filter(link => link.section === section.title)
          const directoryListing = links.length > 1 && links.every(link => link.role === 'child')
          const questionOrAnswer = /^(question|research question|current answer|current conclusion|问题|研究问题|当前答案|当前结论|当前认识)$/i
          const binding = /^(scope|assumptions?|limitations?|open questions?|decisions?|failed (?:routes|attempts)|retained alternatives)$/i
          const bindingChinese = /^(范围|研究范围|假设|局限|限制|未解决问题|缺口|决定|决策|失败路线|保留的路线)$/
          return questionOrAnswer.test(section.title) || binding.test(section.title) || bindingChinese.test(section.title)
            || (candidate !== path && !directoryListing && links.some(link => link.path === path))
        })
        const accountUnits = [...new Set([parsed.opening, ...relevant.map(section => section.text), ...(include.has('work') && work ? [work.text] : []), ...(include.has('statements') ? parsed.sections.filter(section => section !== work).map(section => section.text) : [])])].filter(Boolean)
        const structured = relevant.length > 0 || work !== undefined || include.has('statements')
        const units = isAccount && accountUnits.length && (candidate !== path || structured) ? accountUnits : [source.value.text]
        for (const unit of units) {
          const start = source.value.text.indexOf(unit)
          const located = start >= 0 && start === source.value.text.lastIndexOf(unit)
          const entryFor = (text: string): ContextRead['entries'][number] => ({
            source: { target: { kind: 'resource' as const, id }, revision: source.value.revision },
            label: `${parsed.title} — ${candidate}`, text,
            ...(located ? { range: { start, end: start + text.length } } : {}),
          })
          const entry = entryFor(unit)
          entries.push(entry)
          if (entries.length > maxItems || JSON.stringify(response).length > maxCharacters) {
            entries.pop()
            const omission = { target: { kind: 'resource' as const, id }, reason: 'A complete source unit was omitted by the context item or character budget.' }
            omissions.push(omission)
            if (isAccount && located && entries.length < maxItems) {
              omission.reason = 'Only a located prefix of this source unit was delivered; the remaining argument and conditions require reopening the source.'
              const prefix = fittingSourcePrefix(unit, text => JSON.stringify({ ...response,
                value: { ...response.value, completeness: 'partial', entries: [...entries, entryFor(text)] },
              }).length <= maxCharacters)
              if (prefix !== undefined) entries.push(entryFor(prefix))
              else omission.reason = 'A complete source unit was omitted by the context item or character budget.'
            }
          }
        }
      }
      const value: ContextRead = { topicId: query.topicId, entries, completeness: omissions.length || index.status.completeness === 'partial' ? 'partial' : 'complete', omissions }
      let bounded: ReadEnvelope<ContextRead> = { ...response, value }
      if (JSON.stringify(bounded).length > maxCharacters) {
        let omittedCount = omissions.length
        const combined = [{ target: { kind: 'topic' as const, id: query.topicId }, reason: `${omittedCount} source entries could not be included; request fewer sources or a larger context budget.` }]
        bounded = { ...response, value: { ...value, completeness: 'partial', omissions: combined } }
        while (entries.length && JSON.stringify(bounded).length > maxCharacters) {
          entries.pop()
          omittedCount++
          combined[0] = { target: { kind: 'topic', id: query.topicId }, reason: `${omittedCount} source entries could not be included; request fewer sources or a larger context budget.` }
        }
      }
      if (JSON.stringify(bounded).length > maxCharacters) throw new SourceError('invalid-request', 'The context budget cannot hold even the source and omission metadata.')
      return bounded
    }, options)
  }

  /**
   * Resolve an explicit topic or selected material; shared resources require a scoped origin.
   * @param query - original question and displayed topic/material, with optional anchor and exact selected text.
   * @param options - optional cancellation for discovery and the fresh selected-source read.
   * @returns a resolved, ambiguous or missing origin with original question text retained, or a typed identity/access failure.
   */
  async resolveOrigin(query: OriginQuery, options?: ReadOptions): Promise<Result<ResolvedOrigin>> {
    return this.attempt(async () => {
      const path = query.resourceId !== undefined ? pathForResourceId(query.resourceId)
        : query.topicId !== undefined ? pathForTopicId(query.topicId) : undefined
      const explicit = query.topicId !== undefined ? pathForTopicId(query.topicId) : undefined
      let selection: SelectedSources
      if (explicit !== undefined) selection = await this.selected(explicit, true, options)
      else if (path !== undefined) selection = await this.selected(path, false, options)
      else selection = { index: await this.ensure(options), fresh: new Map() }
      if (explicit !== undefined && path !== undefined && path !== explicit && accountCandidate(selection.index, path)) {
        const material = await this.selected(path, true, options)
        selection = { index: material.index, fresh: new Map([...selection.fresh, ...material.fresh]) }
      }
      const { index } = selection
      if (explicit !== undefined && !index.topicPaths.has(explicit)) return { ...query, status: 'missing', candidateTopicIds: [], reason: 'The requested topic was not discovered.' }
      const candidates = path === undefined ? [] : index.topicPaths.has(path) ? [path] : [...(index.users.get(path) ?? [])]
      if (explicit !== undefined && path !== explicit && !candidates.includes(explicit)) return { ...query, status: 'ambiguous', candidateTopicIds: candidates.map(topicIdForPath), reason: 'The selected material has no recorded relationship to the requested topic.' }
      const owner = candidates[0]
      const uncertainOwner = index.supplemented && path !== undefined && !index.topicPaths.has(path)
        && (candidates.length !== 1 || owner === undefined || index.establishedOwners.get(path) !== owner)
      const chosen = explicit ?? (!uncertainOwner && candidates.length === 1 ? candidates[0] : undefined)
      if (path === undefined) return { ...query, status: 'missing', candidateTopicIds: [], reason: 'No topic or source was selected; the question remains a global discussion.' }
      const source = selection.fresh.get(path) ?? await this.mustRead(path, options)
      let selectedPassage = source.text
      let scope = { start: 0, end: source.text.length }
      if (query.anchor !== undefined) {
        const matches = this.parse(source).anchors.get(query.anchor) ?? []
        const match = matches[0]
        if (matches.length !== 1 || match === undefined) return { ...query, source, status: matches.length ? 'ambiguous' : 'missing', candidateTopicIds: candidates.map(topicIdForPath), reason: matches.length ? 'The source contains several matching anchors or headings.' : 'The selected anchor is absent from the current source.' }
        selectedPassage = match.text
        scope = { start: match.start, end: match.end }
      }
      let selectedRange: ResearchSourceRange | undefined
      const unresolved = (status: 'missing' | 'ambiguous', reason: string): ResolvedOrigin => ({ ...query, source, status, candidateTopicIds: candidates.map(topicIdForPath), reason })
      if (query.selectedRange !== undefined && query.selectedText === undefined) return unresolved('missing', 'A pinned source range requires its original selected text.')
      if (query.selectedText !== undefined) {
        const quote = query.selectedText
        const pinned = query.selectedRange
        if (pinned !== undefined && (!Number.isSafeInteger(pinned.start) || !Number.isSafeInteger(pinned.end)
          || pinned.start < scope.start || pinned.end > scope.end || pinned.end <= pinned.start
          || source.text.slice(pinned.start, pinned.end) !== pinned.text)) {
          return unresolved('missing', 'The pinned selected source range changed; reopen the source and select it again.')
        }
        const matches: ResearchSourceRange[] = []
        if (quote !== '' && query.selectedTextFormat === 'rendered') {
          matches.push(...renderedSelectionRanges(source.text, quote, scope))
        } else if (quote !== '') {
          for (let offset = source.text.indexOf(quote, scope.start); offset !== -1 && offset + quote.length <= scope.end;
            offset = source.text.indexOf(quote, offset + 1)) {
            matches.push({ start: offset, end: offset + quote.length, text: quote })
          }
        }
        const applicable = pinned === undefined ? matches
          : matches.filter(match => match.start === pinned.start && match.end === pinned.end)
        if (applicable.length === 0) return unresolved('missing', query.selectedTextFormat === 'rendered'
          ? 'The rendered selection cannot be located in the current source range. Select a supported prose or code passage, or reopen the source.'
          : 'The selected text is not present in the current source range.')
        if (applicable.length > 1) return unresolved('ambiguous', 'The selected text occurs more than once in the source range; select a longer passage or a narrower anchor.')
        selectedRange = applicable[0]
      }
      return { ...query, resourceId: source.resourceId, source, selectedPassage, ...(selectedRange === undefined ? {} : { selectedRange }), ...(chosen !== undefined ? { topicId: topicIdForPath(chosen) } : {}), status: chosen !== undefined ? 'resolved' : candidates.length ? 'ambiguous' : 'missing', candidateTopicIds: candidates.map(topicIdForPath), ...(chosen === undefined ? { reason: uncertainOwner ? 'Discovery is partial; material ownership is unresolved. Select the intended research question.' : candidates.length ? 'This material is used by several topics; select the intended question.' : 'No owning research question was found in the discovered links.' } : {}) }
    }, options)
  }

  private topic(index: Index, path: string, source: MarkdownSource): Topic {
    const parsed = this.parse(source)
    const parent = this.primaryParent(index, path)
    const answer = namedSection(parsed, /^(current answer|current conclusion|当前答案|当前结论|当前认识)$/i)
    const gap = namedSection(parsed, /^(limitations?|open questions?|局限|未解决问题|缺口)$/i)
    const work = namedSection(parsed, /^(current work|当前工作|进行中的工作)$/i)
    const scope = namedSection(parsed, /^(scope|范围|研究范围)$/i)
    const question = namedSection(parsed, /^(question|research question|问题|研究问题)$/i)
    const questionHeading = question === undefined ? undefined : fromMarkdown(question.text).children[0]
    const questionBody = questionHeading?.type === 'heading'
      ? question?.text.slice(questionHeading.position?.end.offset ?? 0).trim() : undefined
    const curated = parsed.sections.some(section => curatedMaterialsHeading.test(section.title.trim()))
    const visibleLinks = curated ? parsed.links.filter(link => link.curated && link.role === 'reference') : parsed.links
    const resources = [...new Set([path, ...visibleLinks.map(link => link.path)])].map((resource) => {
      const reference = this.reference(index, resource)
      if (resource === path || (!/^(?:readme|index)(?:\.md)?$/i.test(reference.title)
        && reference.title !== posix.basename(resource))) return reference
      const label = visibleLinks.find(link => link.path === resource && link.title.trim() !== ''
        && link.title.trim() !== posix.basename(resource)
        && !/^(?:readme|index)(?:\.md)?$/i.test(link.title.trim()))?.title.trim()
      return label === undefined ? reference : { ...reference, title: label }
    })
    return {
      id: topicIdForPath(path), title: parsed.title, parentId: parent ? topicIdForPath(parent) : null,
      childIds: [...index.topicPaths].filter(child => this.primaryParent(index, child) === path).map(topicIdForPath),
      currentAnswer: answer ? { text: answer.text, qualification: gap?.text ?? 'The source does not separately state qualifications; inspect the complete account.', attribution: { sourceResourceIds: [source.resourceId] } } : null,
      gap: gap?.text ?? null, work: { state: 'unknown', label: '' }, resourceCount: resources.length,
      question: questionBody || parsed.opening || source.text,
      scope: scope?.text ?? 'Scope is not separately stated; inspect the full source account.',
      workItems: work ? [{ id: `${topicIdForPath(path)}#${work.anchor}`, title: work.title, description: work.text, state: 'unknown', attribution: { sourceResourceIds: [source.resourceId] } }] : [],
      statements: [], resources, accountResourceId: source.resourceId,
    }
  }

  private reference(index: Index, path: string): ResourceReference {
    const owners = index.topicPaths.has(path) ? [path] : index.users.get(path) ?? []
    const owner = owners[0]
    const provenOwner = !index.supplemented || index.topicPaths.has(path) || index.establishedOwners.get(path) === owner
    return { id: resourceIdForPath(path), ownerTopicId: provenOwner && owners.length === 1 && owner !== undefined ? topicIdForPath(owner) : null, title: index.notes.get(path)?.parsed.title ?? posix.basename(path), kind: /\.md$/i.test(path) ? 'note' : /\.pdf$/i.test(path) ? 'paper' : 'other', target: { kind: 'workspace-path', path } }
  }

  private primaryParent(index: Index, path: string): string | undefined {
    const candidates = index.parents.get(path)
    const parent = candidates?.length === 1 ? candidates[0] : undefined
    return parent !== undefined && (!index.supplemented || index.establishedParents.get(path) === parent) ? parent : undefined
  }

  private parse(source: MarkdownSource): ParsedMarkdown {
    const previous = this.parsedSources.get(source.relativePath)
    // Fresh bytes were read first. Equality only reuses parsing, never authorizes an edit.
    if (previous?.text === source.text) return previous.parsed
    const parsed = parseMarkdown(source.relativePath, source.text)
    const firstKey = this.parsedSources.keys().next().value
    if (this.parsedSources.size >= this.config.maxFiles && firstKey !== undefined) this.parsedSources.delete(firstKey)
    this.parsedSources.set(source.relativePath, { text: source.text, parsed })
    return parsed
  }

  private async selected(path: string, account: boolean, options?: ReadOptions): Promise<SelectedSources> {
    const observed = await this.ensure(options)
    const fresh = new Map<string, MarkdownSource>()
    const recognized = account ? observed.topicPaths.has(path)
      : observed.paths.has(path) || (observed.users.has(path) && !accountCandidate(observed, path))
    if (!this.supplements.has(path) && (recognized || !observed.unobserved)) return { index: observed, fresh }
    if (account && !/\.md$/i.test(path)) throw new SourceError('not-found', 'The selected source is not a recognized research account.')
    if (!await this.files.discoverable(path, options?.signal)) throw new SourceError('invalid-request', 'The selected source is not a regular file.')
    const selectedSource = account || textSource(path) ? await this.mustRead(path, options) : undefined
    if (selectedSource !== undefined) fresh.set(path, selectedSource)
    const additions = new Map<string, Note | null>()
    const accountNote = account || accountCandidate(observed, path) || /^(research|readme)\.md$/i.test(posix.basename(path))
    const note = selectedSource !== undefined && accountNote
      ? { source: selectedSource, parsed: this.parse(selectedSource) } : null
    additions.set(path, note)
    const queue: { path: string; declared: boolean }[] = []
    const scheduled = new Set([path])
    const issues: ScanIssue[] = []
    const limitIssue = { path, reason: 'Selected-source relationship inspection reached the configured entry limit.' }
    const enqueue = (candidate: string, declared: boolean): void => {
      if (scheduled.has(candidate)) return
      if (scheduled.size >= this.config.maxFiles) {
        if (!issues.includes(limitIssue)) issues.push(limitIssue)
        return
      }
      scheduled.add(candidate)
      queue.push({ path: candidate, declared })
    }
    const parentsOf = (value: Note): void => {
      for (const link of value.parsed.links) if (link.role === 'parent' && /\.md$/i.test(link.path)) enqueue(link.path, true)
    }
    if (note !== null) parentsOf(note)
    for (const owner of [...(observed.parents.get(path) ?? []), ...(observed.users.get(path) ?? [])]) enqueue(owner, true)
    let directory = posix.dirname(path)
    while (true) {
      enqueue(directory === '.' ? 'research.md' : posix.join(directory, 'research.md'), false)
      enqueue(directory === '.' ? 'README.md' : posix.join(directory, 'README.md'), false)
      if (directory === '.') break
      directory = posix.dirname(directory)
    }
    for (const candidate of queue) {
      options?.signal?.throwIfAborted()
      try {
        if (!await this.files.discoverable(candidate.path, options?.signal)) {
          if (candidate.declared) issues.push({ path: candidate.path, reason: 'The declared account is not a regular source file.' })
          continue
        }
        const source = await this.mustRead(candidate.path, options)
        fresh.set(candidate.path, source)
        const parsed = this.parse(source)
        const candidateNote = { source, parsed }
        additions.set(candidate.path, candidateNote)
        parentsOf(candidateNote)
      } catch (error) {
        options?.signal?.throwIfAborted()
        const failure = sourceFailure(error)
        if (candidate.declared || failure.code !== 'not-found') issues.push({ path: candidate.path, reason: failure.message })
      }
    }
    const base = this.discovered ?? observed
    const admitted = new Map(this.supplements)
    // Keep the selected source even when a very small bound evicts its supporting candidates.
    for (const [candidate, candidateNote] of additions) if (candidate !== path) {
      admitted.delete(candidate)
      admitted.set(candidate, candidateNote)
    }
    admitted.delete(path)
    admitted.set(path, note)
    while (admitted.size > this.config.maxFiles) {
      const oldest = admitted.keys().next().value
      if (oldest === undefined) break
      admitted.delete(oldest)
    }
    const paths = new Set([...base.paths, ...admitted.keys()])
    const notes = new Map(base.notes)
    for (const [candidate, candidateNote] of admitted) if (candidateNote !== null) notes.set(candidate, candidateNote)
    const relation = relationships(paths, notes)
    if (account && !relation.topicPaths.has(path)) {
      throw new SourceError('not-found', 'The selected document exists, but no research-account relationship was observed within the bounded selection. Inspect its project links or refresh discovery.')
    }
    const sourceIssues = base.sourceIssues.filter(issue => !fresh.has(issue.path))
    const combined = [...sourceIssues, ...issues, ...relation.issues,
      { path: '', reason: 'Selected sources supplement partial discovery; incoming parent relationships and other material owners may remain unobserved.' },
    ]
    const previous = this.index ?? observed
    const status: MarkdownIndexStatus = {
      revision: sameSources(previous, paths, notes, combined) ? previous.status.revision : this.revision(),
      observedAt: new Date().toISOString(), files: paths.size, topics: relation.topicPaths.size,
      completeness: 'partial', issues: combined,
    }
    const index: Index = { paths, notes, topicPaths: relation.topicPaths, parents: relation.parents, users: relation.users,
      status, sourceIssues, unobserved: true, supplemented: true,
      establishedParents: base.establishedParents, establishedOwners: base.establishedOwners }
    this.supplements.clear()
    for (const [candidate, candidateNote] of admitted) this.supplements.set(candidate, candidateNote)
    this.index = index
    return { index, fresh }
  }

  private async ensure(options?: ReadOptions): Promise<Index> {
    if (!this.index) {
      const result = await this.rebuild(options)
      if (!result.ok) throw new SourceError('unavailable', result.error.message)
    }
    if (!this.index) throw new SourceError('unavailable', 'Source discovery did not publish an index.')
    return this.index
  }

  private async mustRead(path: string, options?: ReadOptions): Promise<MarkdownSource> {
    const result = await this.readSource(resourceIdForPath(path), options)
    if (!result.ok) throw new SourceError(result.error.code === 'not-found' || result.error.code === 'permission-denied' || result.error.code === 'invalid-request' || result.error.code === 'cancelled' ? result.error.code : 'unavailable', result.error.message)
    return result.value
  }

  private revision(): Revision { return `${this.instanceId}:${++this.sequence}` as Revision }
  private envelope<T>(value: T, observed?: Pick<MarkdownSource, 'revision' | 'observedAt'>): ReadEnvelope<T> {
    return { origin: 'runtime', revision: observed?.revision ?? this.revision(), observedAt: observed?.observedAt ?? new Date().toISOString(), value }
  }

  private async attempt<T>(operation: () => Promise<T>, options?: ReadOptions): Promise<Result<T>> {
    try {
      if (options?.signal?.aborted) throw new SourceError('cancelled', 'The source read was cancelled.')
      const value = await operation()
      if (options?.signal?.aborted) throw new SourceError('cancelled', 'The source read was cancelled.')
      return { ok: true, value }
    } catch (error) {
      return { ok: false, error: options?.signal?.aborted ? { code: 'cancelled', message: 'The source read was cancelled.', retryable: false } : sourceFailure(error) }
    }
  }
}
