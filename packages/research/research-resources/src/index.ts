/** Shared guarded sources and independently replaceable research-library projections. */
import { watch, type FSWatcher } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { EventEmitter, on } from 'node:events'
import { createHash, randomUUID } from 'node:crypto'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Remote, RemoteError, principalOf, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type {} from '@deepseek-ai/dsh-workspace'
import type {} from '@deepseek-ai/dsh-app-boot'
import { BoundedSourceWatcher, GuardedFiles, normalizedPath, SourceError, sourceFailure } from './files.ts'
import { pathForSourceId, resourceEntryId, sourceIdForPath, sourceRootId } from './identity.ts'
import { parseSourceMarkup } from './markup.ts'
import { checkedPreviewMediaType, previewMediaType } from './preview.ts'
import { MATERIAL_WATCH_UNAVAILABLE } from './protocol.ts'
import { OperationalOutcomeUnknown, ResourceState, type StoredConnection } from './state.ts'
import type {
  ResourceBody, ResourceBytes, ResourceDomain, ResourceEvent, ResourceIssue, ResourcePage, ResourceProvider,
  ResourceQuery, ResourceReadRequest, ResourceReading, ResourceResult, ResourceSummary, SourceLocator, SourceProviderContext,
  SourceRef, SourceRoot, SourceRootId, SourceRootLease, SourceRootRegistration, StudyHandler, StudyReceipt, StudyRequest,
  TopicAssociationProvider,
  ResourceSetup, RootConnection, SourceSet, SourceSetId, SourceSetQuery, SourceSetPage,
  SaveSourceSetRequest, RemoveSourceSetRequest, SourceSetReceipt,
} from './types.ts'

export type * from './types.ts'
export { GuardedFiles, normalizedPath, SourceError, sourceFailure } from './files.ts'
export { pathForSourceId, resourceEntryId, sourceIdForPath, sourceRootId } from './identity.ts'

/** Configured local roots and complete reading/catalog bounds; none authorizes source writes. */
export interface Config {
  /** Explicit local read grants; an empty list admits no scientific directory. */
  roots?: {
    /** Stable Host-chosen source-root identity. */
    id: string
    /** Existing absolute local directory; registration never authorizes source writes. */
    path: string
    /** Optional human-facing collection title. */
    title?: string
    /** Optional actual Harness Workspace associated with this configured grant. */
    workspaceId?: string
    /** Catalog domains offered to providers; omission offers every installed domain. */
    domains?: ResourceDomain[] | undefined
  }[]
  /** Whether unclassified Workspace grants appear in library catalogs; their read authority remains intact. */
  workspaceRootsInCatalog?: boolean
  /** Maximum discovered directory entries per root, including directories. */
  maxFiles?: number
  /** Enable source-change notifications; false rescans on each catalog read instead. */
  watchSources?: boolean
  /** Use bounded directory watches rather than a recursive whole-tree watch. */
  watchMode?: 'recursive' | 'bounded'
  /** Maximum UTF-8 bytes in one complete source-text reading. */
  maxFileBytes?: number
  /** Maximum bytes in one complete source-binary reading. */
  maxBinaryBytes?: number
  /** Maximum projected catalog entries per root and local-link pairs per Host batch. */
  maxCatalogEntries?: number
  /** Maximum entries returned in one catalog or saved-source-set summary page. */
  maxPageSize?: number
  /** Maximum characters in a complete serialized read result, including metadata. */
  maxResultCharacters?: number
  /** Maximum characters in a study question or catalog search. */
  maxQuestionCharacters?: number
  /** Maximum explicitly selected sources submitted to one ordinary study conversation. */
  maxSelections?: number
  /** Maximum UTF-8 bytes in the complete operational connection and source-set store. */
  maxStateBytes?: number
  /** Maximum saved source sets; reaching the limit retains existing sets. */
  maxSourceSets?: number
  /** Maximum retained source-set operation receipts; prior retry identities are never evicted automatically. */
  maxStateOperations?: number
  /** Maximum characters in one complete normalized source-set save payload. */
  maxSourceSetCharacters?: number
  /** Maximum characters in each explicitly selected quotation, including located text and PDF quotes. */
  maxSelectionCharacters?: number
  /** Maximum source selections retained in one saved operational set. */
  maxSourceSetSelections?: number
  /** Maximum characters in a saved source set's single-line title. */
  maxSourceSetTitleCharacters?: number
}

type ResolvedConfig = Required<Config>
interface RootEntry {
  readonly id: SourceRootId
  readonly path: string
  readonly aliases: Set<SourceRootId>
  readonly grants: Map<object, SourceRootRegistration>
  readonly files: GuardedFiles
  readonly lifetime: AbortController
  readonly providerWatches: Map<string, Promise<() => void>>
  watcher: FSWatcher | BoundedSourceWatcher | undefined
  watchFailure: boolean
  dirty: boolean
  snapshot: CatalogSnapshot | undefined
  refreshing: Promise<CatalogSnapshot> | undefined
}
interface CatalogSnapshot {
  readonly context: SourceProviderContext
  readonly items: readonly ResourceSummary[]
  readonly issues: readonly ResourceIssue[]
  readonly linkRootIds: readonly SourceRootId[]
}

declare module '@deepseek-ai/cordis' {
  interface Context { researchResources: ResearchResources }
}
function isWithin(root: string, path: string): boolean {
  const local = relative(root, path)
  return local !== '' && local !== '..' && !local.startsWith(`..${sep}`) && !isAbsolute(local)
}

function sameReference(left: SourceRef, right: SourceRef): boolean {
  return left.rootId === right.rootId && left.sourceId === right.sourceId
}

async function prospectivePath(path: string): Promise<string> {
  let existing = resolve(path)
  const suffix: string[] = []
  while (true) {
    try { return resolve(await realpath(existing), ...suffix.reverse()) }
    catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
      const parent = dirname(existing)
      if (parent === existing) throw error
      suffix.push(relative(parent, existing))
      existing = parent
    }
  }
}

/** Shared local reads; model execution and scientific writing remain separately owned consumers. */
export class ResearchResources extends TypertRemoteService {
  static inject = ['typert']
  static Config: z<Config, ResolvedConfig> = z.object({
    roots: z.array(z.object({ id: z.string().required(), path: z.string().required(), title: z.string(),
      workspaceId: z.string(), domains: (z.array(z.union(['knowledge', 'literature', 'code'])) as z<ResourceDomain[] | undefined>).default(undefined) })).default([]),
    workspaceRootsInCatalog: z.boolean().default(true),
    maxFiles: z.natural().min(1).default(2000),
    watchSources: z.boolean().default(true),
    watchMode: (z.union(['recursive', 'bounded']) as z<'recursive' | 'bounded'>).default('recursive'),
    maxFileBytes: z.natural().min(1).default(1_048_576),
    maxBinaryBytes: z.natural().min(1).default(20_971_520),
    maxCatalogEntries: z.natural().min(1).default(5000),
    maxPageSize: z.natural().min(1).default(100),
    maxResultCharacters: z.natural().min(1024).default(32_000_000),
    maxQuestionCharacters: z.natural().min(1).default(8000),
    maxSelections: z.natural().min(1).default(32),
    maxStateBytes: z.natural().min(1024).default(8_388_608),
    maxSourceSets: z.natural().min(1).default(1000),
    maxStateOperations: z.natural().min(1).default(2000),
    maxSourceSetCharacters: z.natural().min(1).default(128_000),
    maxSelectionCharacters: z.natural().min(1).default(8000),
    maxSourceSetSelections: z.natural().min(1).default(64),
    maxSourceSetTitleCharacters: z.natural().min(1).default(500),
  })

  private readonly config: ResolvedConfig
  private readonly roots = new Map<SourceRootId, RootEntry>()
  private readonly canonicalRoots = new Map<string, RootEntry>()
  private readonly providers = new Map<string, ResourceProvider>()
  private readonly topicAssociations = new Map<string, TopicAssociationProvider>()
  private readonly events = new EventEmitter().setMaxListeners(0)
  private readonly lifetime = new AbortController()
  private readonly startupIssues: ResourceIssue[] = []
  private readonly ready: Promise<void>
  private readonly state: ResourceState
  private readonly connections = new Map<WorkspaceId, { lease: SourceRootLease; record: StoredConnection }>()
  private restoring: Promise<void> | undefined
  private restored = false
  private studyHandler: StudyHandler | undefined
  private revision = 0

  /** @param ctx - owning Host composition. @param config - explicit read roots and bounds. */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'researchResources', { namespace: 'researchResources' })
    this.config = ResearchResources.Config(config)
    const home = ctx.get('dshHomePath')
    this.state = new ResourceState(home === undefined ? undefined : home('research-resources'), {
      maxStateBytes: this.config.maxStateBytes, maxSourceSets: this.config.maxSourceSets,
      maxStateOperations: this.config.maxStateOperations, maxSourceSetCharacters: this.config.maxSourceSetCharacters,
      maxSelectionCharacters: this.config.maxSelectionCharacters, maxSourceSetSelections: this.config.maxSourceSetSelections,
      maxTitleCharacters: this.config.maxSourceSetTitleCharacters, maxPageSize: this.config.maxPageSize,
    }, path => this.validateStateDirectory(path))
    this.ready = this.configureRoots().then(() => this.restoreConnections())
    ctx.inject(['workspaceRegistry'], () => {
      void this.ready.then(() => this.restoreConnections()).catch((error: unknown) => {
        this.startupIssues.push({ reason: sourceFailure(error).message })
      })
    })
    ctx.effect(() => async () => {
      this.lifetime.abort()
      await this.state.close()
      await Promise.allSettled(this.restoring === undefined ? [] : [this.restoring])
      for (const connection of this.connections.values()) connection.lease.dispose()
      this.connections.clear()
      const pendingWatches = [...this.canonicalRoots.values()].flatMap(root => [...root.providerWatches.values()])
      for (const root of this.canonicalRoots.values()) {
        root.lifetime.abort(); root.watcher?.close(); this.closeProviderWatches(root)
      }
      await Promise.allSettled(pendingWatches)
      await Promise.allSettled([...this.canonicalRoots.values()].flatMap(root => root.refreshing === undefined ? [] : [root.refreshing]))
      this.roots.clear()
      this.canonicalRoots.clear()
      this.providers.clear()
      this.topicAssociations.clear()
      this.studyHandler = undefined
    }, 'research-resources: source roots and observations')
  }

  /** Wait for configured root admission before the plugin becomes ready. */
  async [Service.init](): Promise<void> { await this.ready }

  private async configureRoots(): Promise<void> {
    const results = await Promise.allSettled(this.config.roots.map((root) => {
      const { workspaceId, ...registration } = root
      return this.registerRoot({ ...registration, grantKind: 'configured',
        ...(workspaceId === undefined ? {} : { workspaceId: workspaceId as WorkspaceId }) })
    }))
    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') continue
      const root = this.config.roots[index]
      this.startupIssues.push({ ...(root === undefined ? {} : { rootId: sourceRootId(root.id) }),
        reason: sourceFailure(result.reason).message })
    }
  }

  /**
   * Contribute a Host-authorized local root; equal canonical roots share one source identity.
   * @param registration - configured or already-enrolled root; never browser-supplied paths.
   * @returns a counted lease whose disposal withdraws only this contributor's grant.
   * @throws when the path is unavailable, not absolute, or its identity conflicts with another root.
   */
  async registerRoot(registration: SourceRootRegistration): Promise<SourceRootLease> {
    this.lifetime.signal.throwIfAborted()
    const requestedId = sourceRootId(registration.id)
    if (registration.isAuthorized !== undefined && !await registration.isAuthorized()) throw new SourceError('permission-denied', 'The Host no longer authorizes this source root.')
    if (!isAbsolute(registration.path)) throw new SourceError('invalid-request', 'A configured source root must be an absolute directory.')
    const path = await realpath(registration.path)
    if (!(await stat(path)).isDirectory()) throw new SourceError('invalid-request', 'The configured source root is not a directory.')
    if (this.state.directory !== undefined) {
      const statePath = await prospectivePath(this.state.directory)
      if (statePath === path || isWithin(path, statePath)) throw new SourceError('permission-denied', 'Operational library storage must remain outside scientific source roots.')
    }
    this.lifetime.signal.throwIfAborted()
    const alias = this.roots.get(requestedId)
    if (alias !== undefined && alias.path !== path) throw new SourceError('invalid-request', 'This source-root identity already names another directory.')
    let entry = this.canonicalRoots.get(path)
    if (entry === undefined) {
      entry = { id: requestedId, path, aliases: new Set(), grants: new Map(),
        files: new GuardedFiles(path, this.config.maxFiles, this.config.maxFileBytes, this.config.maxBinaryBytes),
        lifetime: new AbortController(), providerWatches: new Map(), watcher: undefined, watchFailure: false,
        dirty: true, snapshot: undefined, refreshing: undefined }
      this.canonicalRoots.set(path, entry)
      const observed = entry
      if (this.config.watchSources) {
        try {
          observed.watcher = this.config.watchMode === 'bounded'
            ? new BoundedSourceWatcher(path, Math.min(this.config.maxFiles, 1024), () => { this.invalidate(observed) })
            : watch(path, { recursive: true }, () => { this.invalidate(observed) })
          observed.watcher.on('error', () => {
            observed.watchFailure = true
            observed.watcher?.close()
            observed.watcher = undefined
            this.invalidate(observed)
          })
        } catch (error) {
          // Unsupported watches use a fresh bounded scan on every read instead.
          observed.watchFailure = true
          void error
        }
      }
    }
    entry.aliases.add(requestedId)
    this.roots.set(requestedId, entry)
    this.roots.set(entry.id, entry)
    const owner = {}
    entry.grants.set(owner, registration)
    this.invalidateAll()
    const registered = entry
    return { rootId: registered.id, dispose: () => {
      if (!registered.grants.delete(owner)) return
      if (registered.grants.size === 0) {
        registered.lifetime.abort()
        registered.watcher?.close()
        this.closeProviderWatches(registered)
        for (const id of registered.aliases) this.roots.delete(id)
        this.roots.delete(registered.id)
        this.canonicalRoots.delete(registered.path)
      }
      this.invalidateAll()
    } }
  }

  /**
   * Install one domain projection; every catalog and reader is withdrawn on disposal.
   * @param provider - trusted plugin contribution, consuming the shared guarded source context.
   * @returns an idempotent disposer; the caller retains it in its plugin effect.
   */
  registerProvider(provider: ResourceProvider): () => void {
    if (!provider.id || this.providers.has(provider.id)) throw new SourceError('invalid-request', 'A source provider needs a unique nonempty identity.')
    this.providers.set(provider.id, provider)
    this.invalidateAll()
    this.events.emit('change', { kind: 'provider', providerId: provider.id, connected: true } satisfies ResourceEvent)
    return () => {
      if (this.providers.get(provider.id) !== provider) return
      this.providers.delete(provider.id)
      this.invalidateAll()
      this.events.emit('change', { kind: 'provider', providerId: provider.id, connected: false } satisfies ResourceEvent)
    }
  }

  /**
   * Connect the single existing-conversation owner without importing a model runtime here.
   * @param handler - research-memory integration creating ordinary Harness conversations.
   * @returns an idempotent disposer for this handler's lifecycle.
   */
  registerStudyHandler(handler: StudyHandler): () => void {
    if (this.studyHandler !== undefined) throw new SourceError('invalid-request', 'A study conversation handler is already registered.')
    this.studyHandler = handler
    return () => { if (this.studyHandler === handler) this.studyHandler = undefined }
  }

  /**
   * Contribute explicit source relationships from existing scientific owners.
   * @param provider - source-backed batched reader; it cannot register roots or infer scientific support.
   * @returns an idempotent disposer removing this contributor and invalidating the projected catalog.
   */
  registerTopicAssociations(provider: TopicAssociationProvider): () => void {
    if (!provider.id || this.topicAssociations.has(provider.id)) {
      throw new SourceError('invalid-request', 'A topic-association provider needs a unique nonempty identity.')
    }
    this.topicAssociations.set(provider.id, provider)
    this.invalidateAll()
    return () => {
      if (this.topicAssociations.get(provider.id) !== provider) return
      this.topicAssociations.delete(provider.id)
      this.invalidateAll()
    }
  }

  /**
   * Resolve an authored local link through already authorized roots without reading its target.
   * @param request - a known source and its original href.
   * @param signal - cancellation while current Host grants are checked.
   * @returns a root-qualified location, or undefined for unregistered, external or malformed links.
   */
  async resolveLocalLink(request: { from: SourceRef; href: string },
    signal: AbortSignal): Promise<{ ref: SourceRef; locator?: SourceLocator } | undefined> {
    return (await this.resolveLocalLinks({ links: [request] }, signal))[0]
  }

  /**
   * Resolve many owned-note links using one current authorized-root observation.
   * @param request - original source and href pairs; output positions match input positions.
   * @param signal - cancellation for the complete bounded relationship read.
   * @returns source locations or undefined without reading unregistered targets.
   */
  async resolveLocalLinks(request: { links: readonly { from: SourceRef; href: string }[] },
    signal: AbortSignal): Promise<readonly ({ ref: SourceRef; locator?: SourceLocator } | undefined)[]> {
    if (request.links.length > this.config.maxCatalogEntries) throw new SourceError('invalid-request', 'The requested link batch exceeds the catalog bound.')
    const roots: RootEntry[] = []
    for (const root of this.canonicalRoots.values()) {
      try { await this.authorizedMetadata(root, signal); roots.push(root) }
      catch (error) { signal.throwIfAborted(); void error }
    }
    return request.links.map((link) => {
      const root = this.roots.get(link.from.rootId)
      if (root === undefined || !roots.includes(root)) return undefined
      try { return this.resolveLink(root, pathForSourceId(link.from.sourceId), link.href, roots) }
      catch (error) { void error; return undefined }
    })
  }

  private watchOpenedSource(root: RootEntry, path: string): void {
    if (!(root.watcher instanceof BoundedSourceWatcher)) return
    try { root.watcher.includeFile(path) }
    catch (error) { root.watchFailure = true; root.watcher.close(); root.watcher = undefined; this.invalidate(root); void error }
  }

  private invalidate(root: RootEntry): void {
    this.closeProviderWatches(root)
    root.dirty = true
    this.revision++
    this.events.emit('change', { kind: 'invalidated', rootId: root.id } satisfies ResourceEvent)
  }

  private closeProviderWatches(root: RootEntry): void {
    for (const pending of root.providerWatches.values()) void pending.then((dispose) => { dispose() }, () => {})
    root.providerWatches.clear()
  }

  private async watchProvider(root: RootEntry, provider: ResourceProvider, context: SourceProviderContext): Promise<void> {
    if (!(root.watcher instanceof BoundedSourceWatcher) || provider.watchChanges === undefined
      || root.providerWatches.has(provider.id)) return
    const pending = provider.watchChanges(context, (failed) => {
      if (failed) root.watchFailure = true
      this.invalidate(root)
    }, root.lifetime.signal)
    root.providerWatches.set(provider.id, pending)
    try {
      const dispose = await pending
      if (root.lifetime.signal.aborted || root.providerWatches.get(provider.id) !== pending) dispose()
    } catch (error) {
      if (!root.lifetime.signal.aborted && root.providerWatches.get(provider.id) === pending) {
        root.watchFailure = true; root.providerWatches.delete(provider.id)
      }
      void error
    }
  }

  private invalidateAll(): void {
    for (const root of this.canonicalRoots.values()) { this.closeProviderWatches(root); root.dirty = true }
    this.revision++
    this.events.emit('change', { kind: 'resync-required', reason: 'Source providers changed.' } satisfies ResourceEvent)
  }

  private rootMetadata(entry: RootEntry, grants: readonly SourceRootRegistration[]): SourceRoot {
    const title = grants.find(grant => grant.title?.trim())?.title ?? (basename(entry.path) || entry.path)
    const workspaces = [...new Set(grants.flatMap(grant => grant.workspaceId === undefined ? [] : [grant.workspaceId]))]
    const catalogGrants = grants.filter(grant => this.config.workspaceRootsInCatalog
      || grant.workspaceId === undefined || grant.grantKind === 'configured' || grant.domains !== undefined)
    const domains = catalogGrants.some(grant => grant.domains === undefined) ? undefined
      : [...new Set(catalogGrants.flatMap(grant => grant.domains ?? []))]
    const workspaceId = workspaces.length === 1 ? workspaces[0] : undefined
    return { id: entry.id, title, displayPath: entry.path,
      grants: grants.map(grant => ({ kind: grant.grantKind ?? 'host',
        ...(grant.workspaceId === undefined ? {} : { workspaceId: grant.workspaceId }) })),
      ...(workspaceId === undefined ? {} : { workspaceId }), ...(domains === undefined ? {} : { domains }) }
  }

  private async validateStateDirectory(path: string): Promise<void> {
    const canonical = await prospectivePath(path)
    for (const root of this.canonicalRoots.values()) {
      if (canonical === root.path || isWithin(root.path, canonical)) {
        throw new SourceError('permission-denied', 'Operational library storage must remain outside scientific source roots.')
      }
    }
  }

  private async connectionAuthorized(record: StoredConnection): Promise<boolean> {
    const persisted = await this.state.connection(record.workspaceId)
    if (persisted === undefined || JSON.stringify(persisted) !== JSON.stringify(record)) return false
    const workspace = this.ctx.get('workspaceRegistry')?.get(record.workspaceId)
    return workspace !== undefined && await realpath(workspace.path) === record.canonicalPath
  }

  private async activateConnection(record: StoredConnection): Promise<RootConnection> {
    const existing = this.connections.get(record.workspaceId)
    const { canonicalPath: _path, ...connection } = record
    if (existing !== undefined && JSON.stringify(existing.record) === JSON.stringify(record)) {
      return { ...connection, rootId: existing.lease.rootId }
    }
    existing?.lease.dispose()
    this.connections.delete(record.workspaceId)
    const workspaceTitle = this.ctx.get('workspaceRegistry')?.get(record.workspaceId)?.title
    const lease = await this.registerRoot({ id: record.rootId, path: record.canonicalPath,
      workspaceId: record.workspaceId, grantKind: 'workspace-connection',
      title: typeof workspaceTitle === 'string' && workspaceTitle.trim() ? workspaceTitle.trim() : basename(record.canonicalPath),
      ...(record.domains === undefined ? {} : { domains: record.domains }),
      isAuthorized: () => this.connectionAuthorized(record) })
    this.connections.set(record.workspaceId, { lease, record })
    return { ...connection, rootId: lease.rootId }
  }

  private async restoreConnections(): Promise<void> {
    if (this.restored || !this.state.supported || this.ctx.get('workspaceRegistry') === undefined) return
    if (this.restoring === undefined) this.restoring = (async () => {
      try {
        for (const connection of await this.state.connections()) {
          if (!await this.connectionAuthorized(connection)) continue
          await this.activateConnection(connection)
        }
        this.restored = true
      } catch (error) {
        if (!this.lifetime.signal.aborted) this.startupIssues.push({ reason: sourceFailure(error).message })
      }
    })().finally(() => { this.restoring = undefined })
    await this.restoring
  }

  private async authorizedMetadata(entry: RootEntry, signal: AbortSignal): Promise<SourceRoot> {
    signal.throwIfAborted()
    if (await realpath(entry.path) !== entry.path) {
      throw new SourceError('permission-denied', 'The original canonical source root no longer resolves to its authorized directory.')
    }
    const contributions = [...entry.grants.values()]
    const allowed = await Promise.all(contributions.map(async (grant) => {
      try { return grant.isAuthorized === undefined || await grant.isAuthorized() }
      catch (error) { void error; return false }
    }))
    signal.throwIfAborted()
    const grants = contributions.filter((grant, index) => allowed[index] === true && [...entry.grants.values()].includes(grant))
    if (grants.length === 0) throw new SourceError('permission-denied', 'The Host no longer authorizes this source root.')
    return this.rootMetadata(entry, grants)
  }

  private resolveLink(root: RootEntry, basePath: string, href: string,
    roots: readonly RootEntry[]): { ref: SourceRef; locator?: SourceLocator } | undefined {
    try {
      normalizedPath(basePath)
      const split = href.indexOf('#')
      const location = split === -1 ? href : href.slice(0, split)
      const anchor = split === -1 ? undefined : decodeURIComponent(href.slice(split + 1))
      let absolute: string
      if (location.startsWith('file:')) absolute = fileURLToPath(location)
      else {
        if (/^[a-z][a-z0-9+.-]*:/i.test(location) || location.includes('?') || location.includes('\0')) return undefined
        absolute = location ? resolve(root.path, dirname(basePath), decodeURIComponent(location)) : resolve(root.path, basePath)
      }
      const target = roots.filter(candidate => isWithin(candidate.path, absolute))
        .sort((a, b) => b.path.length - a.path.length)[0]
      if (target === undefined) return undefined
      const path = relative(target.path, absolute).split(sep).join('/')
      const pageDigits = /\.pdf$/i.test(path) ? /^page=(\d+)$/.exec(anchor ?? '')?.[1] : undefined
      const page = pageDigits === undefined ? undefined : Number(pageDigits)
      const locator: SourceLocator | undefined = page !== undefined && Number.isSafeInteger(page) && page > 0
        ? { kind: 'pdf-page', page } : anchor ? { kind: 'anchor', anchor } : undefined
      return { ref: { rootId: target.id, sourceId: sourceIdForPath(path) },
        ...(locator === undefined ? {} : { locator }) }
    } catch (error) {
      // Malformed or unregistered links stay authored hrefs, never guessed sources.
      void error
      return undefined
    }
  }

  private async snapshot(entry: RootEntry, signal: AbortSignal, metadata?: SourceRoot,
    linkRoots: readonly RootEntry[] = []): Promise<CatalogSnapshot> {
    const caller = AbortSignal.any([signal, entry.lifetime.signal])
    const shared = AbortSignal.any([this.lifetime.signal, entry.lifetime.signal])
    caller.throwIfAborted()
    const current = metadata ?? await this.authorizedMetadata(entry, caller)
    if (entry.snapshot !== undefined && JSON.stringify(entry.snapshot.context.root) !== JSON.stringify(current)) entry.dirty = true
    const linkRootIds = linkRoots.map(root => root.id)
    if (entry.snapshot !== undefined && JSON.stringify(entry.snapshot.linkRootIds) !== JSON.stringify(linkRootIds)) entry.dirty = true
    if (entry.watcher === undefined) entry.dirty = true
    if (entry.refreshing === undefined && (entry.dirty || entry.snapshot === undefined)) {
      entry.dirty = false
      entry.refreshing = (async () => {
        const scan = await entry.files.scan(shared)
        if (entry.watcher instanceof BoundedSourceWatcher) {
          try { entry.watcher.sync(scan.directories ?? ['']) }
          catch (error) { entry.watchFailure = true; entry.watcher.close(); entry.watcher = undefined; this.invalidate(entry); void error }
        }
        const issues: ResourceIssue[] = scan.issues.map(issue => ({ rootId: entry.id, ...issue }))
        const items: ResourceSummary[] = []
        const base = { root: current, rootPath: entry.path, paths: scan.paths, issues: scan.issues,
          partial: scan.partial, observedAt: new Date().toISOString(), files: entry.files,
          resolveLink: (path: string, href: string) => this.resolveLink(entry, path, href, linkRoots) }
        let firstContext: SourceProviderContext | undefined
        for (const provider of this.providers.values()) {
          if (current.domains !== undefined && !current.domains.includes(provider.domain)) continue
          const context: SourceProviderContext = { ...base,
            reportIssue: (path, reason) => { issues.push({ rootId: entry.id, providerId: provider.id, path, reason }) } }
          firstContext ??= context
          try {
            await this.watchProvider(entry, provider, context)
            const projected = await provider.list(context, shared)
            if (this.providers.get(provider.id) !== provider) { entry.dirty = true; continue }
            for (const item of projected) {
              if (items.length >= this.config.maxCatalogEntries) {
                issues.push({ rootId: entry.id, providerId: provider.id, reason: 'The configured catalog-entry limit was reached; entries remain undisplayed.' })
                break
              }
              items.push({ ...item, catalogRootId: entry.id })
            }
          } catch (error) {
            shared.throwIfAborted()
            issues.push({ rootId: entry.id, providerId: provider.id, reason: sourceFailure(error).message })
          }
        }
        const context: SourceProviderContext = firstContext ?? { ...base,
          reportIssue: (path, reason) => { issues.push({ rootId: entry.id, path, reason }) } }
        const snapshot = { context, items, issues, linkRootIds }
        if (entry.snapshot !== undefined
          && JSON.stringify([entry.snapshot.items, entry.snapshot.issues]) !== JSON.stringify([items, issues])) this.revision++
        entry.snapshot = snapshot
        return snapshot
      })().catch((error: unknown) => { entry.dirty = true; throw error }).finally(() => { entry.refreshing = undefined })
    }
    if (entry.refreshing !== undefined) return this.waitFor(entry.refreshing, caller)
    if (entry.snapshot === undefined) throw new SourceError('unavailable', 'The source catalog has no completed observation.')
    return entry.snapshot
  }

  private async waitFor<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
    signal.throwIfAborted()
    return new Promise<T>((resolvePromise, reject) => {
      const aborted = (): void => {
        signal.removeEventListener('abort', aborted)
        const reason: unknown = signal.reason
        reject(reason instanceof Error ? reason : new DOMException('The source observation was cancelled.', 'AbortError'))
      }
      signal.addEventListener('abort', aborted, { once: true })
      void pending.then((value) => { signal.removeEventListener('abort', aborted); resolvePromise(value) }, (error: unknown) => {
        signal.removeEventListener('abort', aborted)
        reject(error instanceof Error ? error : new Error(String(error)))
      })
    })
  }

  private requireOwner(): void {
    if (principalOf(this.ctx.invocation) !== undefined) throw new RemoteError('research/resources-owner-required', 'Research library access is available to the Host owner only.', {})
  }

  private async attempt<T>(signal: AbortSignal, operation: (signal: AbortSignal) => Promise<T>,
    characters: (value: T) => number = value => JSON.stringify(value).length): Promise<ResourceResult<T>> {
    const lifetime = AbortSignal.any([signal, this.lifetime.signal])
    try {
      lifetime.throwIfAborted()
      await this.waitFor(this.ready, lifetime)
      await this.restoreConnections()
      const value = await operation(lifetime)
      lifetime.throwIfAborted()
      if (characters(value) > this.config.maxResultCharacters) throw new SourceError('unavailable', 'The complete source result exceeds the configured character limit; nothing was truncated.')
      return { ok: true, value }
    } catch (error) {
      if (lifetime.aborted) return { ok: false, error: { code: 'cancelled', message: 'The source read was cancelled.', retryable: false } }
      return { ok: false, error: sourceFailure(error) }
    }
  }

  private async stateOperation<T>(signal: AbortSignal, operation: () => Promise<T>): Promise<ResourceResult<T>> {
    this.requireOwner()
    if (!this.state.supported) return { ok: false, error: { code: 'unsupported', message: 'This Host has no operational storage for library connections or saved source sets.', retryable: false } }
    const lifetime = AbortSignal.any([signal, this.lifetime.signal])
    let admitted = false
    try {
      lifetime.throwIfAborted()
      await this.waitFor(this.ready, lifetime)
      lifetime.throwIfAborted()
      // Once admitted, publication settles its receipt even when the caller disconnects.
      admitted = true
      return { ok: true, value: await operation() }
    } catch (error) {
      if (error instanceof OperationalOutcomeUnknown) return { ok: false, error: {
        code: 'outcome-unknown', message: error.message, operationId: error.operationId, retryable: true,
      } }
      if (lifetime.aborted && !admitted) return { ok: false, error: { code: 'cancelled', message: 'The library operation was cancelled before admission.', retryable: false } }
      return { ok: false, error: sourceFailure(error) }
    }
  }

  /**
   * Inspect operational capabilities without granting any filesystem access.
   * @param request - reserved existing Workspace selection; it is never a path.
   * @param signal - cancellation for this capability read.
   * @returns availability of read-only attachment and Host-owned saved source sets.
   */
  @Remote({ name: 'getSetup' })
  async getSetup(request: { workspaceId?: WorkspaceId }, signal: AbortSignal): Promise<ResourceResult<ResourceSetup>> {
    this.requireOwner()
    return this.attempt(signal, async () => {
      void request
      if (this.state.supported) await this.state.connections()
      return { canConnect: this.state.supported && this.ctx.get('workspaceRegistry') !== undefined,
        canSaveSourceSets: this.state.supported }
    })
  }

  /**
   * Explicitly attach a registered Workspace as a read-only library root.
   * @param request - Host Workspace identity and catalog domains; no browser-controlled root path.
   * @param signal - cancellation before admitting the operational connection.
   * @returns a durable connection to the captured canonical path, without creating scientific files.
   */
  @Remote({ name: 'connectWorkspace' })
  async connectWorkspace(request: { workspaceId: WorkspaceId; domains?: readonly ResourceDomain[] },
    signal: AbortSignal): Promise<ResourceResult<RootConnection>> {
    return this.stateOperation(signal, async () => {
      const workspace = this.ctx.get('workspaceRegistry')?.get(request.workspaceId)
      if (workspace === undefined) throw new SourceError('not-found', 'The selected Workspace is no longer registered.')
      const path = await realpath(workspace.path)
      if (!(await stat(path)).isDirectory()) throw new SourceError('invalid-request', 'The selected Workspace is not a local directory.')
      const directory = this.state.directory
      if (directory === undefined) throw new SourceError('unavailable', 'The Host operational storage is unavailable.')
      const statePath = await prospectivePath(directory)
      if (statePath === path || isWithin(path, statePath)) {
        throw new SourceError('permission-denied', 'Operational library storage must remain outside the selected source directory.')
      }
      await this.validateStateDirectory(directory)
      const previous = await this.state.connection(request.workspaceId)
      const record = await this.state.connect({ workspaceId: request.workspaceId, canonicalPath: path,
        rootId: this.canonicalRoots.get(path)?.id
          ?? (previous?.canonicalPath === path ? previous.rootId : sourceRootId(`workspace:${request.workspaceId}:${randomUUID()}`)),
        ...(request.domains === undefined ? {} : { domains: request.domains }), connectedAt: new Date().toISOString() })
      try { return await this.activateConnection(record) }
      catch (error) {
        // The connection record is already published; a retry reconciles its active grant.
        void error
        throw new OperationalOutcomeUnknown(`connect:${request.workspaceId}`)
      }
    })
  }

  /**
   * Withdraw only the saved Workspace connection, preserving independent configured/research grants.
   * @param request - existing or retained Workspace identity to disconnect.
   * @param signal - cancellation before operational publication.
   * @returns whether a runtime connection record was removed; scientific files are untouched.
   */
  @Remote({ name: 'disconnectWorkspace' })
  async disconnectWorkspace(request: { workspaceId: WorkspaceId },
    signal: AbortSignal): Promise<ResourceResult<{ disconnected: boolean }>> {
    return this.stateOperation(signal, async () => {
      const disconnected = await this.state.disconnect(request.workspaceId)
      this.connections.get(request.workspaceId)?.lease.dispose()
      this.connections.delete(request.workspaceId)
      this.invalidateAll()
      return { disconnected }
    })
  }

  /**
   * List saved operational collections without returning their selected quotations.
   * @param request - bounded page and optional actual topic filter.
   * @param signal - cancellation for this read.
   * @returns source-set summaries with opaque pagination.
   */
  @Remote({ name: 'listSourceSets' })
  async listSourceSets(request: SourceSetQuery, signal: AbortSignal): Promise<ResourceResult<SourceSetPage>> {
    this.requireOwner()
    if (!this.state.supported) return { ok: false, error: { code: 'unsupported', message: 'Saved source sets are unavailable on this Host.', retryable: false } }
    return this.attempt(signal, () => this.state.listSets(request))
  }

  /**
   * Open a saved set; its references may now be missing and are never replaced by title guesses.
   * @param request - durable source-set identity.
   * @param signal - cancellation for this read.
   * @returns complete bounded references and explicit quotations, not fresh source content.
   */
  @Remote({ name: 'getSourceSet' })
  async getSourceSet(request: { id: SourceSetId }, signal: AbortSignal): Promise<ResourceResult<SourceSet>> {
    this.requireOwner()
    if (!this.state.supported) return { ok: false, error: { code: 'unsupported', message: 'Saved source sets are unavailable on this Host.', retryable: false } }
    return this.attempt(signal, () => this.state.getSet(request.id))
  }

  /**
   * Save source references and short selected quotations in Host operational storage.
   * @param request - exact title, references, optional topic associations and stable retry identity.
   * @param signal - cancellation before admitting the bounded publication.
   * @returns its durable operation receipt; the current set is read separately.
   */
  @Remote({ name: 'saveSourceSet' })
  async saveSourceSet(request: SaveSourceSetRequest, signal: AbortSignal): Promise<ResourceResult<SourceSetReceipt>> {
    return this.stateOperation(signal, async () => {
      const receipt = await this.state.saveSet(request)
      this.events.emit('change', { kind: 'resync-required', reason: 'Saved study sets changed.' } satisfies ResourceEvent)
      return receipt
    })
  }

  /**
   * Remove one operational set without deleting its sources or scientific notes.
   * @param request - set identity and stable removal operation identity.
   * @param signal - cancellation before publication admission.
   * @returns the durable historical removal receipt, including unchanged retries.
   */
  @Remote({ name: 'removeSourceSet' })
  async removeSourceSet(request: RemoveSourceSetRequest, signal: AbortSignal): Promise<ResourceResult<SourceSetReceipt>> {
    return this.stateOperation(signal, async () => {
      const receipt = await this.state.removeSet(request.operationId, request.id)
      this.events.emit('change', { kind: 'resync-required', reason: 'Saved study sets changed.' } satisfies ResourceEvent)
      return receipt
    })
  }

  private async catalog(signal: AbortSignal, selection?: Pick<ResourceQuery, 'domain' | 'rootId'>): Promise<{
    items: ResourceSummary[]
    issues: ResourceIssue[]
    observedAt: string
    roots: readonly RootEntry[]
    snapshots: ReadonlyMap<RootEntry, CatalogSnapshot>
  }> {
    const items: ResourceSummary[] = []
    const selectedRoot = selection?.rootId === undefined ? undefined : this.roots.get(selection.rootId)
    if (selection?.rootId !== undefined && selectedRoot === undefined) throw new SourceError('permission-denied', 'The requested catalog root is not registered.')
    const issues: ResourceIssue[] = this.startupIssues.filter(issue => selectedRoot === undefined
      || issue.rootId === undefined || this.roots.get(issue.rootId) === selectedRoot)
    const authorized: { root: RootEntry; metadata: SourceRoot }[] = []
    const snapshots = new Map<RootEntry, CatalogSnapshot>()
    for (const root of this.canonicalRoots.values()) {
      try { authorized.push({ root, metadata: await this.authorizedMetadata(root, signal) }) }
      catch (error) {
        signal.throwIfAborted()
        root.watcher?.close()
        root.watcher = undefined
        issues.push({ rootId: root.id, reason: sourceFailure(error).message })
      }
    }
    const linkRoots = authorized.map(item => item.root)
    for (const { root, metadata } of authorized) {
      if (selectedRoot !== undefined && root !== selectedRoot) continue
      if (metadata.domains?.length === 0 || selection?.domain !== undefined
        && metadata.domains !== undefined && !metadata.domains.includes(selection.domain)) continue
      try {
        const snapshot = await this.snapshot(root, signal, metadata, linkRoots)
        snapshots.set(root, snapshot)
        await this.authorizedMetadata(root, signal)
        items.push(...snapshot.items)
        issues.push(...snapshot.issues)
        if (root.watchFailure) issues.push({ rootId: root.id, reason: MATERIAL_WATCH_UNAVAILABLE })
      } catch (error) {
        signal.throwIfAborted()
        issues.push({ rootId: root.id, reason: sourceFailure(error).message })
      }
    }
    const authorizedRoots = new Set(authorized.map(entry => entry.root))
    const sourceEntries = new Map<string, number[]>()
    for (const [index, item] of items.entries()) {
      const key = JSON.stringify([item.ref.rootId, item.ref.sourceId])
      const indices = sourceEntries.get(key) ?? []
      indices.push(index)
      sourceEntries.set(key, indices)
    }
    for (const contributor of this.topicAssociations.values()) {
      const reported: ResourceIssue[] = []
      try {
        const relationships = await contributor.read(signal, (issue) => { reported.push({ ...issue, providerId: contributor.id }) })
        if (this.topicAssociations.get(contributor.id) !== contributor) continue
        issues.push(...reported)
        for (const relationship of relationships) {
          const root = this.roots.get(relationship.ref.rootId)
          if (root === undefined || !authorizedRoots.has(root)) continue
          for (const index of sourceEntries.get(JSON.stringify([root.id, relationship.ref.sourceId])) ?? []) {
            const item = items[index]
            if (item === undefined) continue
            const topic = relationship.topic
            if (item.topics.some(current => current.workspaceId === topic.workspaceId && current.topicId === topic.topicId
              && current.reason === topic.reason)) continue
            items[index] = { ...item, topics: [...item.topics, topic] }
          }
        }
      } catch (error) {
        signal.throwIfAborted()
        if (this.topicAssociations.get(contributor.id) === contributor) {
          issues.push(...reported, { providerId: contributor.id, reason: sourceFailure(error).message })
        }
      }
    }
    const stillAuthorized = new Set<RootEntry>()
    for (const root of linkRoots) {
      try { await this.authorizedMetadata(root, signal); stillAuthorized.add(root) }
      catch (error) { signal.throwIfAborted(); issues.push({ rootId: root.id, reason: sourceFailure(error).message }) }
    }
    const current = items.filter((item) => {
      const sourceRoot = this.roots.get(item.ref.rootId)
      const catalogRoot = this.roots.get(item.catalogRootId ?? item.ref.rootId)
      return sourceRoot !== undefined && catalogRoot !== undefined && stillAuthorized.has(sourceRoot) && stillAuthorized.has(catalogRoot)
    })
    return { items: current, issues, observedAt: new Date().toISOString(), roots: [...stillAuthorized], snapshots }
  }

  /**
   * List roots explicitly contributed by Host configuration or an existing research grant.
   * @param request - optional exact root filter, without a browser-controlled path.
   * @param signal - cancellation for this observer.
   * @returns canonical root metadata; duplicate grants appear once.
   */
  @Remote({ name: 'listRoots' })
  async listRoots(request: { rootId?: SourceRootId }, signal: AbortSignal): Promise<ResourceResult<readonly SourceRoot[]>> {
    this.requireOwner()
    return this.attempt(signal, async (observed) => {
      const roots: SourceRoot[] = []
      for (const root of this.canonicalRoots.values()) {
        if (request.rootId !== undefined && this.roots.get(request.rootId) !== root) continue
        try { roots.push(await this.authorizedMetadata(root, observed)) }
        catch (error) { observed.throwIfAborted(); void error }
      }
      return roots
    })
  }

  private async directoryPage(request: ResourceQuery, signal: AbortSignal): Promise<ResourcePage> {
    if (request.domain !== 'code' || request.rootId === undefined || request.folder === undefined
      || request.query !== undefined || request.topic !== undefined) {
      throw new SourceError('invalid-request', 'A directory view requires one code root and no search or topic filter.')
    }
    const root = this.roots.get(request.rootId)
    if (root === undefined) throw new SourceError('permission-denied', 'The requested catalog root is not registered.')
    const metadata = await this.authorizedMetadata(root, signal)
    if (metadata.domains !== undefined && !metadata.domains.includes('code')) {
      throw new SourceError('permission-denied', 'The selected source root is not a code catalog.')
    }
    const provider = [...this.providers.values()].find(candidate => candidate.domain === 'code' && candidate.listDirectory !== undefined)
    if (provider?.listDirectory === undefined) throw new SourceError('unsupported', 'No code directory reader is connected.')
    const limit = request.limit ?? this.config.maxPageSize
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > this.config.maxPageSize) {
      throw new SourceError('invalid-request', 'The requested source page exceeds the configured page limit.')
    }
    const folder = request.folder === '' ? '' : normalizedPath(request.folder)
    const issues: ResourceIssue[] = []
    const roots: RootEntry[] = []
    for (const entry of this.canonicalRoots.values()) {
      try { await this.authorizedMetadata(entry, signal); roots.push(entry) }
      catch (error) { signal.throwIfAborted(); void error }
    }
    const context: SourceProviderContext = { root: metadata, rootPath: root.path, paths: [], issues: [], partial: false,
      observedAt: new Date().toISOString(), files: root.files,
      reportIssue: (path, reason) => { issues.push({ rootId: root.id, providerId: provider.id, path, reason }) },
      resolveLink: (basePath, href) => this.resolveLink(root, basePath, href, roots),
    }
    await this.watchProvider(root, provider, context)
    const items = await provider.listDirectory(context, folder, signal)
    this.watchOpenedSource(root, folder === '' ? '_directory_' : `${folder}/_directory_`)
    await this.authorizedMetadata(root, signal)
    if (root.watchFailure) issues.push({ rootId: root.id, reason: MATERIAL_WATCH_UNAVAILABLE })
    const key = JSON.stringify(['directory', root.id, folder, limit])
    const observation = createHash('sha256').update(JSON.stringify([items, issues])).digest('base64url')
    let offset = 0
    if (request.cursor !== undefined) {
      if (request.cursor.length > this.config.maxQuestionCharacters * 4) throw new SourceError('invalid-request', 'The source page cursor exceeds its configured size bound.')
      let cursor: unknown
      try { cursor = JSON.parse(Buffer.from(request.cursor, 'base64url').toString()) }
      catch { throw new SourceError('invalid-request', 'The source page cursor is invalid.') }
      if (!Array.isArray(cursor) || cursor.length !== 4 || cursor[0] !== this.revision || cursor[1] !== key || cursor[3] !== observation
        || !Number.isSafeInteger(cursor[2]) || cursor[2] < 0) throw new SourceError('invalid-request', 'The source page cursor expired or belongs to another query.')
      offset = cursor[2] as number
    }
    const next = offset + limit
    return { items: items.slice(offset, next),
      nextCursor: next < items.length ? Buffer.from(JSON.stringify([this.revision, key, next, observation])).toString('base64url') : null,
      completeness: issues.length === 0 ? 'complete' : 'partial', issues, observedAt: context.observedAt }
  }

  /**
   * Browse a bounded domain catalog with explicit missing discovery coverage.
   * @param request - source/root/topic filters and an opaque page cursor.
   * @param signal - cancellation for this observer, not for another reader's shared scan.
   * @returns a catalog page; rejected or stale cursors require a fresh first page.
   */
  @Remote({ name: 'listResources' })
  async listResources(request: ResourceQuery, signal: AbortSignal): Promise<ResourceResult<ResourcePage>> {
    this.requireOwner()
    return this.attempt(signal, async (observed) => {
      if (request.folder !== undefined) return this.directoryPage(request, observed)
      const catalog = await this.catalog(observed, request)
      if (request.rootId !== undefined && !this.roots.has(request.rootId)) throw new SourceError('permission-denied', 'The requested catalog root is not registered.')
      if (request.domain !== undefined && ![...this.providers.values()].some(provider => provider.domain === request.domain)) {
        throw new SourceError('unavailable', 'The requested library source provider is not connected.')
      }
      if (this.providers.size === 0) catalog.issues.push({ reason: 'No library source providers are connected; source coverage is unavailable.' })
      const query = request.query?.trim().toLocaleLowerCase() ?? ''
      if (query.length > this.config.maxQuestionCharacters) throw new SourceError('invalid-request', 'The source search exceeds its configured length limit.')
      const topic = request.topic
      const items = catalog.items.filter(item => (request.domain === undefined || item.domain === request.domain)
        && (request.rootId === undefined || this.roots.get(request.rootId)?.id === (item.catalogRootId ?? item.ref.rootId))
        && (topic === undefined || item.topics.some(use => use.workspaceId === topic.workspaceId && use.topicId === topic.topicId))
        && (!query || [item.title, item.description ?? '', ...Object.values(item.metadata)].some(value => value.toLocaleLowerCase().includes(query))))
      const limit = request.limit ?? this.config.maxPageSize
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > this.config.maxPageSize) throw new SourceError('invalid-request', 'The requested source page exceeds the configured page limit.')
      const key = JSON.stringify([request.domain ?? null, request.rootId ?? null, query, request.topic ?? null, limit])
      let offset = 0
      if (request.cursor !== undefined) {
        if (request.cursor.length > this.config.maxQuestionCharacters * 4) throw new SourceError('invalid-request', 'The source page cursor exceeds its configured size bound.')
        let cursor: unknown
        try { cursor = JSON.parse(Buffer.from(request.cursor, 'base64url').toString()) }
        catch (error) { void error; throw new SourceError('invalid-request', 'The source page cursor is invalid.') }
        if (!Array.isArray(cursor) || cursor.length !== 3 || cursor[0] !== this.revision || cursor[1] !== key
          || !Number.isSafeInteger(cursor[2]) || cursor[2] < 0) throw new SourceError('invalid-request', 'The source page cursor expired or belongs to another query.')
        offset = cursor[2] as number
      }
      const next = offset + limit
      return { items: items.slice(offset, next),
        nextCursor: next < items.length ? Buffer.from(JSON.stringify([this.revision, key, next])).toString('base64url') : null,
        completeness: catalog.issues.length ? 'partial' : 'complete', issues: catalog.issues, observedAt: catalog.observedAt }
    })
  }

  /**
   * Search domain titles, descriptions and authored metadata within the same bounded catalog.
   * @param request - search text and the same explicit root/topic filters as browsing.
   * @param signal - cancellation for this read.
   * @returns matching catalog entries and the actual discovery limits.
   */
  @Remote({ name: 'search' })
  async search(request: ResourceQuery, signal: AbortSignal): Promise<ResourceResult<ResourcePage>> {
    return this.listResources(request, signal)
  }

  /**
   * Read a complete authorized PDF or image for native preview without expanding any source grant.
   * @param request - root-qualified current local-file identity, never an arbitrary Host path.
   * @param signal - cancellation propagated through the root lifetime and complete bounded read.
   * @returns preview bytes through binary transport, or an explicit rejection without partial bytes.
   */
  @Remote({ name: 'readSourceBytes' })
  async readSourceBytes(request: { ref: SourceRef }, signal: AbortSignal): Promise<ResourceResult<ResourceBytes>> {
    this.requireOwner()
    return this.attempt(signal, async (observed) => {
      const root = this.roots.get(request.ref.rootId)
      if (root === undefined) throw new SourceError('permission-denied', 'This source root is not currently authorized.')
      const sourceSignal = AbortSignal.any([observed, root.lifetime.signal])
      await this.authorizedMetadata(root, sourceSignal)
      const path = pathForSourceId(request.ref.sourceId)
      if (previewMediaType(path) === undefined) throw new SourceError('unsupported', 'Native source bytes support PDF and registered image formats only.')
      if (!await root.files.discoverable(path, sourceSignal)) throw new SourceError('not-found', 'The selected source is not a readable regular file.')
      this.watchOpenedSource(root, path)
      const bytes = await root.files.readBytes(path, sourceSignal)
      const mediaType = checkedPreviewMediaType(path, bytes)
      await this.authorizedMetadata(root, sourceSignal)
      sourceSignal.throwIfAborted()
      return { ref: { rootId: root.id, sourceId: request.ref.sourceId }, data: new Uint8Array(bytes),
        mediaType, observedAt: new Date().toISOString() }
    }, value => JSON.stringify({ ref: value.ref, mediaType: value.mediaType, observedAt: value.observedAt }).length)
  }

  /**
   * Open a known source or a newly selected guarded local file in an authorized root.
   * @param request - root-qualified identity and optional located reading.
   * @param signal - cancellation propagated to the provider and bounded source read.
   * @returns current complete content or an explicit unsupported/missing reading.
   */
  @Remote({ name: 'readResource' })
  async readResource(request: ResourceReadRequest, signal: AbortSignal): Promise<ResourceResult<ResourceReading>> {
    this.requireOwner()
    return this.attempt(signal, async (observed) => {
      const root = this.roots.get(request.ref.rootId)
      if (root === undefined) throw new SourceError('permission-denied', 'This source root is not currently authorized.')
      await this.authorizedMetadata(root, observed)
      const reference = { ...request.ref, rootId: root.id }
      const sourcePath = reference.sourceId.startsWith('source:') ? pathForSourceId(reference.sourceId) : undefined
      const locatedDomain = request.locator?.kind === 'code' || request.locator?.kind === 'git' ? 'code'
        : request.locator?.kind === 'pdf-page' ? 'literature' : undefined
      if (request.domain !== undefined && locatedDomain !== undefined && request.domain !== locatedDomain) {
        throw new SourceError('invalid-request', 'The requested library does not match the specialized source location.')
      }
      const domain = request.domain ?? locatedDomain
      const catalog = await this.catalog(observed, domain === undefined ? undefined : { domain })
      const projections = catalog.items.filter(item => sameReference(item.ref, reference)
        && (domain === undefined || item.domain === domain))
      const existing = projections.find(item => request.locator === undefined
        || JSON.stringify(item.locator) === JSON.stringify(request.locator))
        ?? projections[0]
      const selectedLocator = request.locator ?? existing?.locator
      const specializedDomain = selectedLocator?.kind === 'code' || selectedLocator?.kind === 'git' ? 'code'
        : selectedLocator?.kind === 'pdf-page' ? 'literature' : undefined
      if (specializedDomain !== undefined && ![...this.providers.values()]
        .some(provider => provider.domain === specializedDomain && provider.read !== undefined)) {
        throw new SourceError('unsupported', 'The requested source location has no connected specialized reader.')
      }
      const revisionRead = (selectedLocator?.kind === 'code' || selectedLocator?.kind === 'git')
        && selectedLocator.revision !== undefined && selectedLocator.revision !== 'working-tree'
        && [...this.providers.values()].some(provider => provider.domain === 'code' && provider.read !== undefined)
      if (sourcePath !== undefined) {
        if (revisionRead) await root.files.validateHistoricalPath(sourcePath, observed)
        else if (!await root.files.discoverable(sourcePath, observed)) {
          throw new SourceError('not-found', 'The selected source is not a readable regular file.')
        }
        if (!revisionRead) this.watchOpenedSource(root, sourcePath)
      }
      const snapshot = catalog.snapshots.get(root) ?? await this.snapshot(root, observed, undefined, catalog.roots)
      let body: ResourceBody | undefined
      const sourceSignal = AbortSignal.any([observed, root.lifetime.signal])
      const readingIssues: string[] = []
      const candidates = [...this.providers.values()]
        .filter(provider => specializedDomain === undefined || provider.domain === specializedDomain)
        .sort((left, right) => Number(right.id === existing?.providerId) - Number(left.id === existing?.providerId))
      let reader: ResourceProvider | undefined
      for (const provider of candidates) {
        const context = { ...snapshot.context, reportIssue: (path: string, reason: string): void => { readingIssues.push(`${path}: ${reason}`) } }
        body = await provider.read?.(context, reference, selectedLocator, sourceSignal)
        if (body !== undefined) { reader = provider; break }
      }
      let resource = existing
      if (body === undefined) {
        if (selectedLocator !== undefined && selectedLocator.kind !== 'text' && selectedLocator.kind !== 'anchor') {
          throw new SourceError('unsupported', 'The requested location needs its specialized source reader; a current whole file cannot represent it.')
        }
        if (!reference.sourceId.startsWith('source:')) {
          throw new SourceError('not-found', 'This provider-owned source was removed or its reader is unavailable; it is not a local-file identity.')
        }
        const path = pathForSourceId(reference.sourceId)
        if (!await root.files.discoverable(path, sourceSignal)) throw new SourceError('not-found', 'The selected source is not a readable regular file.')
        const mediaType = previewMediaType(path)
        if (mediaType !== undefined && mediaType !== 'application/pdf' && selectedLocator === undefined) {
          const checked = checkedPreviewMediaType(path, await root.files.readBytes(path, sourceSignal))
          if (checked === 'application/pdf') throw new SourceError('unsupported', 'The source is not an image.')
          body = { kind: 'image', mediaType: checked }
        } else {
          const text = await root.files.read(path, sourceSignal)
          body = { kind: 'text', format: /\.(md|markdown)$/i.test(path) ? 'markdown'
            : (domain ?? existing?.domain) === 'code' ? 'code' : 'plain-text', text }
        }
        resource ??= { id: resourceEntryId(reference), ref: reference, title: path,
          kind: body.kind === 'image' ? 'data' : domain === undefined || domain === 'knowledge' ? 'note' : domain,
          domain: domain ?? 'knowledge',
          providerId: '', metadata: {}, links: [], topics: [] }
      }
      if (revisionRead && body.kind === 'text' && !/^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(body.revision ?? '')) {
        throw new SourceError('unavailable', 'The historical source reader did not identify the actual immutable commit.')
      }
      if (resource === undefined && body.kind !== 'unavailable' && reader !== undefined) {
        resource = { id: resourceEntryId(reference), ref: reference, catalogRootId: root.id,
          title: reference.sourceId.startsWith('source:') ? pathForSourceId(reference.sourceId) : reference.sourceId,
          kind: reader.domain === 'knowledge' ? 'note' : reader.domain, domain: reader.domain, providerId: reader.id,
          metadata: {}, links: [], topics: [] }
      }
      if (body.kind === 'text' && selectedLocator?.kind === 'text') {
        const { start, end, quote } = selectedLocator
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start
          || body.text.slice(start, end) !== quote || end - start !== quote.length) {
          throw new SourceError('invalid-request', 'The original text selection no longer resolves exactly; select the current passage again.')
        }
      }
      if (body.kind === 'text' && selectedLocator?.kind === 'anchor') {
        const anchors = parseSourceMarkup(body.text).anchors.filter(anchor => anchor.anchor === selectedLocator.anchor)
        if (anchors.length !== 1) {
          body = { kind: 'unavailable', reason: anchors.length === 0 ? 'missing' : 'ambiguous',
            detail: 'The requested anchor does not identify exactly one current source passage.' }
        }
      }
      if (resource === undefined) {
        if (body.kind === 'unavailable') throw new SourceError(body.reason === 'missing' ? 'not-found'
          : body.reason === 'unsupported' ? 'unsupported' : 'unavailable', body.detail)
        throw new SourceError('not-found', 'No source projection is available for this reading.')
      }
      if (sourcePath !== undefined && body.kind === 'text' && selectedLocator?.kind !== 'git'
        && (body.format === 'markdown' || /\.(?:md|markdown)$/iu.test(sourcePath))) {
        const document = parseSourceMarkup(body.text)
        const links = [...resource.links]
        const authoredLinks = [...document.links, ...document.images].sort((left, right) => left.start - right.start)
        for (const link of authoredLinks.slice(0, this.config.maxCatalogEntries)) {
          const resolved = snapshot.context.resolveLink(sourcePath, link.href)
          const authored = { label: link.label, href: link.href, ...(resolved === undefined ? {} : {
            target: resolved.ref, ...(resolved.locator === undefined ? {} : { locator: resolved.locator }),
          }) }
          if (!links.some(existing => existing.label === authored.label && existing.href === authored.href
            && JSON.stringify(existing.target) === JSON.stringify(authored.target)
            && JSON.stringify(existing.locator) === JSON.stringify(authored.locator))) links.push(authored)
        }
        if (authoredLinks.length > this.config.maxCatalogEntries) readingIssues.push('The source-link preview reached its configured limit; remaining links are not included.')
        resource = { ...resource, links }
      }
      sourceSignal.throwIfAborted()
      await this.authorizedMetadata(root, sourceSignal)
      let locator = request.locator ?? resource.locator
      if (body.kind === 'text' && body.revision !== undefined && (locator?.kind === 'code' || locator?.kind === 'git')) {
        locator = { ...locator, revision: body.revision }
      }
      const reading: ResourceReading = { resource, body, ...(locator === undefined ? {} : { locator }),
        observedAt: new Date().toISOString(),
        issues: [...catalog.issues.filter(issue => issue.rootId === root.id).map(issue => issue.reason),
          ...root.watchFailure && !catalog.issues.some(issue => issue.rootId === root.id && issue.reason === MATERIAL_WATCH_UNAVAILABLE)
            ? [MATERIAL_WATCH_UNAVAILABLE] : [], ...readingIssues] }
      if (body.kind === 'pdf' && body.dataBase64 !== undefined && JSON.stringify(reading).length > this.config.maxResultCharacters) {
        const { dataBase64: _preview, ...pages } = body
        return { ...reading, body: pages }
      }
      return reading
    })
  }

  /**
   * Mark current catalogs stale; this neither fetches remote material nor modifies source files.
   * @param request - optional registered root, or every currently authorized root.
   * @param signal - cancellation before invalidation.
   * @returns whether the requested invalidation was admitted.
   */
  @Remote({ name: 'refresh' })
  async refresh(request: { rootId?: SourceRootId }, signal: AbortSignal): Promise<ResourceResult<true>> {
    this.requireOwner()
    return this.attempt(signal, () => {
      if (request.rootId === undefined) this.invalidateAll()
      else {
        const root = this.roots.get(request.rootId)
        if (root === undefined) throw new SourceError('not-found', 'The source root is not registered.')
        this.invalidate(root)
      }
      return Promise.resolve(true as const)
    })
  }

  /**
   * Submit explicit selected evidence through the existing conversation integration.
   * @param request - the person's words, optional actual topic and eligible source selections.
   * @param signal - cancellation before the integration admits a normal Session input.
   * @returns that Session's identity; no domain reader starts its own model loop.
   */
  @Remote({ name: 'askStudy', resources: { workspace: (request: StudyRequest) => request.workspaceId,
    session: (request: StudyRequest) => request.sessionId } })
  async askStudy(request: StudyRequest, signal: AbortSignal): Promise<ResourceResult<StudyReceipt>> {
    this.requireOwner()
    const lifetime = AbortSignal.any([signal, this.lifetime.signal])
    lifetime.throwIfAborted()
    await this.waitFor(this.ready, lifetime)
    const question = request.content === undefined ? request.question
      : request.content.filter(part => part.type === 'text').map(part => part.text).join('\n')
    if ((!question.trim() && request.content?.some(part => part.type !== 'text') !== true) || question.length > this.config.maxQuestionCharacters
      || request.selections.length > this.config.maxSelections
      || request.selections.some(selection => (selection.selectedText?.length ?? 0) > this.config.maxFileBytes)) {
      return { ok: false, error: { code: 'invalid-request', message: 'The question or selected evidence exceeds its configured bounds.', retryable: false } }
    }
    for (const selection of request.selections) {
      const root = this.roots.get(selection.ref.rootId)
      if (root === undefined) return { ok: false, error: { code: 'permission-denied', message: 'A selected source root is no longer authorized.', retryable: false } }
      try { await this.authorizedMetadata(root, lifetime) }
      catch (error) { lifetime.throwIfAborted(); return { ok: false, error: sourceFailure(error) } }
    }
    if (this.studyHandler === undefined) return { ok: false, error: { code: 'unsupported', message: 'The research conversation integration is not connected.', retryable: false } }
    return this.studyHandler(request, lifetime)
  }

  /**
   * Observe source/provider invalidation and an initial resync baseline.
   * @param request - reserved empty filter; all events remain Host-owner scoped.
   * @param signal - caller cancellation or plugin disposal closes the subscription.
   * @returns source events; clients reread current authoritative values after each invalidation.
   */
  @Remote({ name: 'follow', mode: 'stream' })
  async *follow(request: { rootId?: SourceRootId }, signal: AbortSignal): AsyncIterable<ResourceEvent> {
    this.requireOwner()
    const lifetime = AbortSignal.any([signal, this.lifetime.signal])
    await this.waitFor(this.ready, lifetime)
    const events = on(this.events, 'change', { signal: lifetime })
    try {
      yield { kind: 'resync-required', reason: 'Read the current source roots and catalogs.' }
      for await (const values of events) {
        const event = values[0] as ResourceEvent
        if (event.kind !== 'invalidated' || request.rootId === undefined || this.roots.get(request.rootId)?.id === event.rootId) yield event
      }
    } finally { await events.return?.() }
  }
}

export default ResearchResources
