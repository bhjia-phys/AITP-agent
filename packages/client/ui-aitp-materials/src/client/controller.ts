/** Reversible module composition and navigation over one shared material store. */
import type { Context } from '@deepseek-ai/cordis'
import type { BoundActions } from '@deepseek-ai/dsh-client-store'
import type { ResourceDomain, SourceSelection } from '@deepseek-ai/dsh-research-resources/types'
import { COLLECTION_SOURCE_ID, materialSourceAddress } from '@deepseek-ai/dsh-research-resources/protocol'
import type { ResearchDiscussions } from '@deepseek-ai/dsh-client-ui-aitp-research/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { LibraryModule, MaterialField, MaterialsScope, OpenMaterials } from './contracts.ts'
import type { MaterialsState, MaterialsStore } from './store.ts'
import { materialsScopeKey } from './store.ts'
import type { MaterialsConnection } from './connection.ts'
import { MaterialsPanel, MaterialsSidebar, type MaterialsPanelFace } from './MaterialsPanel.tsx'
import { LibraryIcon } from './icons.tsx'
import { TopicLibraryLink, type TopicLibraryFace } from './TopicLibraryLink.tsx'

/** Public client service; modules and topic views pass data/callbacks, never components. */
export interface MaterialsLibraryService {
  /**
   * Register one independently unloadable library entry.
   * @param module - domain-owned labels and stable panel identity.
   * @returns a disposer withdrawing only that domain's UI contributions.
   */
  registerModule(module: LibraryModule): () => void
  /**
   * Open a library/source with an explicit question scope.
   * @param request - domain, optional source and explicit scope/return callback.
   * @returns false when the domain module is not installed.
   */
  open(request: OpenMaterials): boolean
  /**
   * Read a supplied reference and open its provider-declared domain.
   * @param request - root-qualified reference and explicit optional question scope.
   * @returns whether the source could be read and its domain opened.
   */
  openSource(request: Omit<OpenMaterials, 'domain'> & {
    readonly ref: NonNullable<OpenMaterials['ref']>
    readonly domain?: ResourceDomain
  }): Promise<boolean>
}

/** Shared registration owner; the renderer creates the live store instance. */
export class MaterialsController implements MaterialsLibraryService {
  private readonly modules = new Map<ResourceDomain, LibraryModule>()
  private actions: BoundActions<MaterialsStore> | undefined
  private pending: OpenMaterials | undefined
  private externalReturn: (() => void) | undefined
  private returnScopeKey: string | undefined
  private snapshot: (() => MaterialsState) | undefined
  private sourceEntry: string | undefined
  private readonly stopPanelObservation: () => void
  private readonly suspendedDiscussions = new Map<string, () => void>()
  private readonly returnToOwner = (): void => { this.externalReturn?.() }
  /** End all this client generation's pending reads and questions on unload. */
  readonly lifetime = new AbortController()

  constructor(private readonly ctx: Context, readonly store: MaterialsStore, readonly connection: MaterialsConnection) {
    let previous = ctx.layout.panelInfo.getSnapshot().activePanelId
    this.stopPanelObservation = ctx.layout.panelInfo.subscribe(() => {
      const panel = ctx.layout.panelInfo.getSnapshot().activePanelId
      if (panel === previous) return
      previous = panel
      const sourceEntry = this.sourceEntry === panel
      this.sourceEntry = undefined
      const scope = this.snapshot?.().scope
      const library = [...this.modules.values()].some(module => module.panelId === panel)
      if (!library) {
        for (const restore of this.suspendedDiscussions.values()) restore()
        this.suspendedDiscussions.clear()
      } else if (!sourceEntry && scope !== undefined) {
        this.showCatalogue(scope)
      }
    })
  }

  /**
   * Bind the current framework-owned viewing state for navigation without copying it into this controller.
   * @param snapshot - getter evaluated when a navigation command needs the current scope.
   */
  observeState(snapshot: () => MaterialsState): void { this.snapshot = snapshot }

  private showCatalogue(scope: MaterialsScope): void {
    const key = materialsScopeKey(scope)
    const discussion = this.ctx.get('researchDiscussions')
    if (discussion === undefined) return
    if (!this.suspendedDiscussions.has(key)) this.suspendedDiscussions.set(key,
      discussion.suspend(scope))
    else discussion.collapse(scope)
  }

  /**
   * Resolve metadata labels from the registered library owner.
   * @param domain - source provider domain.
   * @returns the library's localized fields, or an empty list when it is not registered.
   */
  fields(domain: ResourceDomain): readonly MaterialField[] { return this.modules.get(domain)?.labels().fields ?? [] }

  /**
   * Register this domain's main panel and one replacement sidebar context.
   * @param module - domain-owned labels and stable navigation identity.
   * @returns disposer removing only this domain's contributions.
   */
  registerModule(module: LibraryModule): () => void {
    if (this.modules.has(module.domain)) throw new Error(`Material module already registered: ${module.domain}`)
    this.modules.set(module.domain, module)
    const { ctx, store } = this
    const releaseMain = ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: module.panelId,
      locale: 'aitp.materials', store, inject: actions => this.face(module, actions) }, MaterialsPanel))
    const releaseSidebar = ctx.slots.inject('sidebar.context', () => ctx.slots.register({ name: 'sidebar.context', key: module.panelId,
      locale: 'aitp.materials', store, inject: actions => this.face(module, actions) }, MaterialsSidebar))
    // Research is optional: withdrawing its service restores the independent global libraries.
    const discussion = ctx.inject(['researchDiscussions'], (child) => {
      child.slots.inject('main', () => child.slots.register({ name: 'main', key: module.panelId, priority: -1,
        locale: 'aitp.materials', store, inject: actions => this.face(module, actions, child.researchDiscussions) }, MaterialsPanel))
      child.slots.inject('sidebar.context', () => child.slots.register({ name: 'sidebar.context', key: module.panelId, priority: -1,
        locale: 'aitp.materials', store, inject: actions => this.face(module, actions, child.researchDiscussions) }, MaterialsSidebar))
    })
    const releaseEntry = ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: module.panelId,
      order: module.order, label: () => module.labels().title, inject: () => ({ domain: module.domain }) }, LibraryIcon))
    const releaseTopic = ctx.slots.inject('aitp.research.topic.libraries', () => ctx.slots.register({
      name: 'aitp.research.topic.libraries', id: `aitp-materials-${module.domain}`, order: module.order, locale: 'aitp.materials',
      inject: (): TopicLibraryFace => ({ labels: module.labels, open: (owner) => {
        this.open({ domain: module.domain, scope: { workspaceId: owner.workspaceId, topicId: owner.topicId, title: owner.title },
          returnTo: owner.returnTo })
      } }),
    }, TopicLibraryLink))
    return () => {
      if (this.modules.get(module.domain) !== module) return
      if (ctx.layout.panelInfo.getSnapshot().activePanelId === module.panelId) ctx.layout.selectPanel(null)
      void discussion.dispose()
      releaseTopic(); releaseEntry(); releaseSidebar(); releaseMain()
      this.modules.delete(module.domain)
    }
  }

  /**
   * Open a source without inheriting its maintenance owner's topic.
   * @param request - chosen domain, explicit scope and optional source.
   * @returns whether the requested module is currently registered.
   */
  open(request: OpenMaterials): boolean {
    const module = this.modules.get(request.domain)
    if (module === undefined) return false
    if (request.ref === undefined && request.scope !== undefined) this.showCatalogue(request.scope)
    const scopeKey = materialsScopeKey(request.scope ?? {})
    // A citation opened from this library passes our delegate; retain the original topic owner instead of recursing.
    if (request.returnTo !== this.returnToOwner || this.returnScopeKey !== scopeKey) {
      this.externalReturn = request.returnTo === this.returnToOwner ? undefined : request.returnTo
      this.returnScopeKey = scopeKey
    }
    if (this.actions === undefined) this.pending = request
    else this.navigate(request, this.actions)
    if (request.ref !== undefined && this.ctx.layout.panelInfo.getSnapshot().activePanelId !== module.panelId) {
      this.sourceEntry = module.panelId
    }
    this.ctx.layout.selectPanel(module.panelId)
    return true
  }

  /**
   * Resolve a reference through its actual provider before selecting its library.
   * @param request - one source and an explicit optional question scope.
   * @returns whether an installed library can present the resolved source.
   */
  async openSource(request: Omit<OpenMaterials, 'domain'> & {
    readonly ref: NonNullable<OpenMaterials['ref']>
    readonly domain?: ResourceDomain
  }): Promise<boolean> {
    const signal = AbortSignal.any([this.ctx.layout.beginNavigation(), this.lifetime.signal])
    if (request.ref.sourceId === COLLECTION_SOURCE_ID) {
      const roots = await this.connection.run(transport => transport.listRoots(signal))
      if (!roots.ok || signal.aborted) return false
      const root = roots.value.find(item => item.id === request.ref.rootId)
      if (root === undefined || root.domains?.length === 0) return false
      const domain = request.domain !== undefined && (root.domains === undefined || root.domains.includes(request.domain)) ? request.domain
        : [...this.modules.keys()].find(item => root.domains === undefined || root.domains.includes(item))
      if (domain === undefined) return false
      return this.open({ domain, rootId: root.id, ...request.scope === undefined ? {} : { scope: request.scope },
        ...request.returnTo === undefined ? {} : { returnTo: request.returnTo } })
    }
    const result = await this.connection.run(transport => transport.readResource(request.ref, request.locator, signal, request.domain))
    if (!result.ok || signal.aborted) return false
    const active = [...this.modules.values()].find(module => module.panelId === this.ctx.layout.panelInfo.getSnapshot().activePanelId)
    const keepReading = active !== undefined && request.returnTo === this.returnToOwner
      && this.returnScopeKey === materialsScopeKey(request.scope ?? {})
    const destination = this.modules.get(result.value.resource.domain) ?? active ?? this.modules.values().next().value
    if (destination === undefined) return false
    return this.open({ ...request, domain: keepReading ? active.domain : destination.domain,
      readerDomain: request.domain ?? null })
  }

  /**
   * Bind the framework-created root store before a view handles commands.
   * @param actions - framework-baked action interface.
   */
  bind(actions: BoundActions<MaterialsStore>): void {
    this.actions = actions
    if (this.pending !== undefined) {
      const pending = this.pending
      this.pending = undefined
      this.navigate(pending, actions)
    }
  }

  private navigate(request: OpenMaterials, actions: BoundActions<MaterialsStore>): void {
    actions.setScope(request.scope ?? {})
    this.selectReaderScope(request.scope ?? {})
    actions.open(request.domain, request.ref === undefined ? { kind: 'list' }
      : { kind: 'source', ref: request.ref, ...request.readerDomain === undefined ? {} : { readerDomain: request.readerDomain }, ...request.locator === undefined ? {} : { locator: request.locator } })
    if (request.rootId !== undefined) { actions.setCollection(request.domain, request.rootId); actions.setQuery(request.domain, '') }
    const module = this.modules.get(request.domain)
    if (module !== undefined && request.ref !== undefined) this.preview(module, {
      ref: request.ref, ...request.locator === undefined ? {} : { locator: request.locator },
    }, request.scope ?? {}, request.readerDomain)
  }

  private selectReaderScope(scope: MaterialsScope): void {
    for (const module of this.modules.values()) this.ctx.sidebarRightRoots.selectScope(module.panelId, materialsScopeKey(scope))
  }

  private preview(module: LibraryModule, source: SourceSelection, scope: MaterialsScope, readerDomain?: ResourceDomain | null): void {
    this.ctx.sidebarRightRoots.selectScope(module.panelId, materialsScopeKey(scope))
    this.ctx.sidebarRightRoots.openResource(module.panelId, materialSourceAddress(source.ref, source.locator,
      readerDomain === null ? undefined : readerDomain ?? module.domain), { params: { scope, libraryDomain: module.domain } })
  }

  private face(module: LibraryModule, actions: BoundActions<MaterialsStore>, discussion?: ResearchDiscussions): MaterialsPanelFace {
    this.bind(actions)
    return {
      domain: module.domain, labels: module.labels, panelId: module.panelId,
      preview: (selection, scope) => { this.preview(module, selection, scope) },
      changeScope: (scope) => { actions.setScope(scope); this.selectReaderScope(scope) },
      ...discussion === undefined ? {} : { discussion: {
        open: (scope, selections, prompt) => { void discussion.open(scope, { ...scope,
          selections: selections.map(({ ref, locator, selectedText }) => ({ ref, ...locator === undefined ? {} : { locator },
            ...selectedText === undefined ? {} : { selectedText } })),
        }, prompt) },
        setSources: (scope, selections) => { discussion.setSource(scope, { ...scope,
          selections: selections.map(({ ref, locator, selectedText }) => ({ ref, ...locator === undefined ? {} : { locator },
            ...selectedText === undefined ? {} : { selectedText } })),
        }) },
      } satisfies MaterialsPanelFace['discussion'] },
      management: {
        isCurrent: () => !this.lifetime.signal.aborted,
        connect: workspaceId => this.connection.run(transport => transport.management?.connectWorkspace(workspaceId, this.lifetime.signal)),
        disconnect: workspaceId => this.connection.run(transport => transport.management?.disconnectWorkspace(
          workspaceId, this.lifetime.signal,
        )),
        save: request => this.connection.run(transport => transport.management?.saveSourceSet(
          request, this.lifetime.signal,
        ), request.operationId),
        load: async (id) => {
          const result = await this.connection.run(transport => transport.management?.getSourceSet(id, this.lifetime.signal))
          if (!result.ok) return result
          const selections = await Promise.all(result.value.selections.map(async (selection) => {
            const read = await this.connection.run(transport => transport.readResource(
              selection.ref, selection.locator, this.lifetime.signal,
            ))
            if (!read.ok) return { ...selection, title: selection.ref.sourceId, domain: module.domain, unavailable: read.error.message }
            return { ...selection, title: read.value.resource.title, domain: read.value.resource.domain,
              ...read.value.body.kind === 'unavailable' ? { unavailable: read.value.body.detail } : {} }
          }))
          return { ok: true, value: { sourceSet: result.value, selections } }
        },
      },
      refresh: () => { void this.connection.refresh(this.lifetime.signal) },
      returnTo: this.returnToOwner,
      prepareFullConversation: scope => () => {
        if (this.lifetime.signal.aborted) return
        actions.setScope(scope)
        this.selectReaderScope(scope)
        this.sourceEntry = module.panelId
        this.ctx.layout.selectPanel(module.panelId)
      },
      hasReturn: scope => this.externalReturn !== undefined && this.returnScopeKey === materialsScopeKey(scope),
      openLink: (link) => {
        if (link.target === undefined) return false
        actions.open(module.domain, { kind: 'source', ref: link.target, readerDomain: null,
          ...link.locator === undefined ? {} : { locator: link.locator } })
        return true
      },
      ask: request => this.connection.ask({ ...request,
        ...(discussion === undefined ? {} : { workflow: discussion.workflowEnabled(request.sessionId) }),
      }, this.lifetime.signal),
      openSession: (receipt) => { this.ctx.uiWorkspace.openSession(receipt.sessionId) },
      openSelection: (selection, scope) => {
        const destination = this.modules.get(selection.domain) ?? this.modules.get(module.domain)
        if (destination === undefined) return
        actions.open(destination.domain, { kind: 'source', ref: selection.ref, readerDomain: null,
          ...selection.locator === undefined ? {} : { locator: selection.locator } })
        this.preview(destination, selection, scope, null)
        this.ctx.layout.selectPanel(destination.panelId)
      },
    }
  }

  /** Release owned pending operations; plugin effects remove all source contributions. */
  dispose(): void {
    this.lifetime.abort(); this.stopPanelObservation(); this.snapshot = undefined; this.sourceEntry = undefined
    for (const restore of this.suspendedDiscussions.values()) restore()
    this.suspendedDiscussions.clear()
    this.pending = undefined; this.externalReturn = undefined; this.returnScopeKey = undefined
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context { researchMaterials: MaterialsLibraryService }
}
