/** Root document navigation owns global panel viewing scopes without acquiring Session authority. */
import { activeDockPaneId, dockPaneIds, findTabPane, getPane, type PaneId, type TabId } from '@deepseek-ai/dsh-client-ui-dockkit'
import { createSnapshotStore, type ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarRightTabRegistry } from './tab-registry.ts'
import type { SidebarRightOpenResourceOptions } from './service.ts'
import { rootSurfaceKey, type createSidebarRightRootStore, type SidebarRightRootState } from './root-store.ts'
import type { PinResource } from './tab-domain.ts'

/** Resource placement plus an optional title already read by its source owner. */
export interface SidebarRightRootOpenOptions extends SidebarRightOpenResourceOptions { readonly title?: string }

/** Public viewing facts; content and permissions remain with each resource provider. */
export interface SidebarRightRootView {
  readonly scopeKey: string
  readonly expanded: boolean
  readonly activeAddress?: string
}

/** A framework-minted root store; no component creates or subscribes to it. */
export interface SidebarRightRootStoreInstance {
  readonly actions: BoundActions<ReturnType<typeof createSidebarRightRootStore>>
  readonly getSnapshot: () => SidebarRightRootState
  readonly subscribe: (listener: () => void) => () => void
}

/** The global-panel counterpart of the ordinary Session navigation face. */
export class SidebarRightRoots {
  private store: SidebarRightRootStoreInstance | undefined
  private readonly pending: Array<(store: SidebarRightRootStoreInstance) => void> = []
  private readonly pins = new Map<string, Map<TabId, AbortController>>()
  private readonly rooms = new Map<string, (paneId: PaneId) => boolean>()
  private readonly source = createSnapshotStore<Readonly<Record<string, SidebarRightRootView>>>({})
  readonly views: ObservableSnapshot<Readonly<Record<string, SidebarRightRootView>>> = this.source

  /** @param tabs - native tab resolver. @param pin - source retention for an open tab's lifetime. */
  constructor(private readonly tabs: SidebarRightTabRegistry, private readonly pin: PinResource,
    private readonly currentPanel: () => MainPanelId | null = () => null,
    private readonly focusOpened: (panelId: MainPanelId, scopeKey: string) => void = () => {}) {}

  /** Native shortcut adapter; a captured command cannot operate on a later scope. */
  command(kind: 'toggle' | 'split' | 'fullscreen' | 'close', element: Element | null): (() => void) | undefined {
    const panelId = this.currentPanel()
    const store = this.store
    if (panelId === null || store === undefined) return
    const scopeKey = store.getSnapshot().selectedScopes[panelId] ?? ''
    const surface = store.getSnapshot().surfaces[rootSurfaceKey(panelId, scopeKey)]
    if (surface === undefined || Object.keys(surface.layout.tabs).length === 0) return
    const owner = element?.closest<HTMLElement>('[data-sidebar-right-root]')
    if (kind !== 'toggle' && owner?.dataset.sidebarRightRoot !== panelId) return
    const tabName = element?.closest<HTMLElement>('[data-dockkit-content]')?.dataset.dockkitContent
    const tab = Object.values(surface.layout.tabs).find(value => value.id === tabName)
    const pane = tab === undefined ? getPane(surface.layout, activeDockPaneId(surface.layout)) : findTabPane(surface.layout, tab.id)
    if ((kind === 'split' || kind === 'fullscreen') && pane.host === 'float') return
    if (kind === 'split' && (dockPaneIds(surface.layout).length >= 2
      || this.rooms.get(rootSurfaceKey(panelId, scopeKey))?.(pane.id) === false)) return
    return () => {
      if (this.currentPanel() !== panelId || (store.getSnapshot().selectedScopes[panelId] ?? '') !== scopeKey) return
      const current = store.getSnapshot().surfaces[rootSurfaceKey(panelId, scopeKey)]
      if (current === undefined) return
      if (kind !== 'toggle' && (current.layout.nodes[pane.id] === undefined
        || tab !== undefined && current.layout.tabs[tab.id] === undefined)) return
      if (kind === 'toggle') store.actions.setExpanded(panelId, scopeKey, !current.layout.expanded)
      else if (kind === 'fullscreen') {
        if (owner?.ownerDocument.documentElement.clientWidth !== undefined && owner.ownerDocument.documentElement.clientWidth < 768) {
          store.actions.setExpanded(panelId, scopeKey, false)
        } else store.actions.setMode(panelId, scopeKey, current.layout.mode === 'fullscreen' ? 'push' : 'fullscreen')
      } else if (kind === 'split') store.actions.gesture(panelId, scopeKey, { type: 'splitPane', paneId: pane.id })
      else {
        const id = tab?.id ?? pane.activeTabId
        if (id !== undefined) store.actions.gesture(panelId, scopeKey, { type: 'closeTab', tabId: id })
      }
      this.focusOpened(panelId, scopeKey)
    }
  }

  /** @param panelId - measured panel. @param scopeKey - reading scope. @param canSplitPane - the native kit's width verdict. */
  measure(panelId: MainPanelId, scopeKey: string, canSplitPane: (paneId: PaneId) => boolean): void {
    this.rooms.set(rootSurfaceKey(panelId, scopeKey), canSplitPane)
  }

  /** @param panelId - global panel. @param scopeKey - explicit scope to restore, never a Session id. */
  selectScope(panelId: MainPanelId, scopeKey: string): void {
    this.run((store) => { store.actions.selectScope(panelId, scopeKey) })
  }

  /** @param panelId - source-owning panel. @param address - registered resource address. @param options - navigation and placement. */
  openResource(panelId: MainPanelId, address: string, options: SidebarRightRootOpenOptions = {}): void {
    this.run((store) => { this.openIn(panelId, store.getSnapshot().selectedScopes[panelId] ?? '', address, options) })
  }

  /** @param panelId - owning panel. @param tabId - tab in its currently selected scope. */
  close(panelId: MainPanelId, tabId: TabId): void {
    this.run((store) => { store.actions.gesture(panelId, store.getSnapshot().selectedScopes[panelId] ?? '', { type: 'closeTab', tabId }) })
  }

  /** @param panelId - global panel whose retained document surface should reopen or collapse. */
  toggleExpanded(panelId: MainPanelId): void {
    this.run((store) => {
      const scopeKey = store.getSnapshot().selectedScopes[panelId] ?? ''
      const surface = store.getSnapshot().surfaces[rootSurfaceKey(panelId, scopeKey)]
      store.actions.setExpanded(panelId, scopeKey, surface?.layout.expanded !== true)
    })
  }

  /** @param panelId - global panel. @param expanded - whether to show its current reading scope. */
  setExpanded(panelId: MainPanelId, expanded: boolean): void {
    this.run((store) => { store.actions.setExpanded(panelId, store.getSnapshot().selectedScopes[panelId] ?? '', expanded) })
  }

  /** Explicit captured-scope navigation for a retained tab; it never changes another topic's tabs. */
  openIn(panelId: MainPanelId, scopeKey: string, address: string, options: SidebarRightRootOpenOptions = {}): void {
    if (!address.startsWith('dsh-resource://')) throw new Error('sidebarRightRoots: expected a resource address')
    const claim = this.tabs.claim(address, options.kind)
    this.run((store) => {
      const surface = store.getSnapshot().surfaces[rootSurfaceKey(panelId, scopeKey)]
      const paneId = options.paneId ?? (surface === undefined ? undefined : activeDockPaneId(surface.layout))
      const canSplit = paneId === undefined || this.rooms.get(rootSurfaceKey(panelId, scopeKey))?.(paneId) !== false
      store.actions.open(panelId, scopeKey, claim, canSplit ? options : { ...options, preferNewPane: false })
      this.focusOpened(panelId, scopeKey)
    })
  }

  /** @param store - framework-owned root state. @returns release for this adoption. */
  adopt(store: SidebarRightRootStoreInstance): () => void {
    this.store = store
    const unsubscribe = store.subscribe(() => { this.sync(store.getSnapshot()) })
    this.sync(store.getSnapshot())
    for (const command of this.pending.splice(0)) command(store)
    return () => { unsubscribe(); if (this.store === store) this.store = undefined }
  }

  /** Release all resource lifetimes on plugin unload. */
  dispose(): void {
    for (const tabs of this.pins.values()) for (const controller of tabs.values()) controller.abort()
    this.pins.clear()
    this.rooms.clear()
    this.pending.length = 0
    this.store = undefined
  }

  private run(command: (store: SidebarRightRootStoreInstance) => void): void {
    if (this.store === undefined) this.pending.push(command)
    else command(this.store)
  }

  private sync(state: SidebarRightRootState): void {
    for (const [key, held] of this.pins) {
      const layout = state.surfaces[key]?.layout
      for (const [id, controller] of held) if (layout?.tabs[id] === undefined) { controller.abort(); held.delete(id) }
      if (layout === undefined) this.pins.delete(key)
    }
    for (const [key, surface] of Object.entries(state.surfaces)) {
      let held = this.pins.get(key)
      if (held === undefined) { held = new Map(); this.pins.set(key, held) }
      for (const tab of Object.values(surface.layout.tabs)) {
        if (held.has(tab.id)) continue
        const controller = new AbortController()
        held.set(tab.id, controller)
        this.pin(tab.contentId, controller.signal)
      }
    }
    const views: Record<string, SidebarRightRootView> = {}
    for (const [panelId, scopeKey] of Object.entries(state.selectedScopes)) views[panelId] = { scopeKey, expanded: false }
    for (const surface of Object.values(state.surfaces)) {
      if ((state.selectedScopes[surface.panelId] ?? '') !== surface.scopeKey) continue
      const pane = getPane(surface.layout, surface.layout.activePaneId)
      const address = pane.activeTabId === undefined ? undefined : surface.layout.tabs[pane.activeTabId]?.contentId
      views[surface.panelId] = { scopeKey: surface.scopeKey, expanded: surface.layout.expanded,
        ...address === undefined ? {} : { activeAddress: address } }
    }
    const before = this.source.getSnapshot()
    if (Object.keys(before).length !== Object.keys(views).length || Object.entries(views).some(([id, value]) => {
      const previous = before[id]
      return previous?.scopeKey !== value.scopeKey || previous.expanded !== value.expanded || previous.activeAddress !== value.activeAddress
    })) this.source.set(views)
  }
}
