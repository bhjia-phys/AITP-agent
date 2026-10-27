/** Native document docking state for global panels, independent of Session state and authority. */
import { defineStore } from '@deepseek-ai/dsh-client-store'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { DockMode, DockZone, FloatRect, LayoutOp, LayoutState, Mint, PaneId, SplitId, TabId } from '@deepseek-ai/dsh-client-ui-dockkit'
import {
  dockPaneIds, findContentTab, findTabPane, getPane, planDropTab, planDuplicateTab, planFloatTab,
  planOpenContent, planPlaceTab, planResizeSplit, planSetExpanded, planSetMode, planSplitPane, planUnfloatPane,
} from '@deepseek-ai/dsh-client-ui-dockkit'
import { advanceSurface, createSurface, type SurfaceState } from './stores.ts'
import type { SidebarRightTabClaim } from './tab-registry.ts'
import type { SidebarRightTabNavigation } from './contract/slots.ts'
import type { SidebarRightRootOpenOptions } from './root-service.ts'

/** One global panel's independent reading scope and its native document surfaces. */
export interface RootSurfaceState extends SurfaceState {
  readonly panelId: MainPanelId
  readonly scopeKey: string
  readonly navigation: Readonly<Record<string, SidebarRightTabNavigation>>
}

/** Root viewing state only; source content remains in the resource service. */
export interface SidebarRightRootState {
  selectedScopes: Record<string, string>
  surfaces: Record<string, RootSurfaceState>
}

/** @param panelId - global panel. @param scopeKey - its chosen research/browsing scope. @returns an unambiguous viewing identity. */
export function rootSurfaceKey(panelId: MainPanelId, scopeKey: string): string { return JSON.stringify([panelId, scopeKey]) }

/** Gestures emitted by the shared native docking kit. */
export type RootDockGesture =
  | { type: 'focusTab'; tabId: TabId } | { type: 'focusPane'; paneId: PaneId }
  | { type: 'splitPane'; paneId: PaneId } | { type: 'closeTab'; tabId: TabId }
  | { type: 'duplicateTab'; tabId: TabId } | { type: 'floatTab'; tabId: TabId; rect?: FloatRect }
  | { type: 'unfloatPane'; paneId: PaneId }
  | { type: 'placeTab'; tabId: TabId; paneId: PaneId; index: number }
  | { type: 'dropTab'; tabId: TabId; paneId: PaneId; zone: DockZone }
  | { type: 'moveFloat'; paneId: PaneId; x: number; y: number }
  | { type: 'resizeFloat'; paneId: PaneId; rect: FloatRect }
  | { type: 'resizeSplit'; splitId: SplitId; sizes: readonly number[] }

function changed(draft: SidebarRightRootState, panelId: MainPanelId, scopeKey: string,
  update: (surface: RootSurfaceState) => RootSurfaceState): void {
  const key = rootSurfaceKey(panelId, scopeKey)
  const before = draft.surfaces[key]
  const after = update(before ?? { ...createSurface(), panelId, scopeKey, navigation: {} })
  if (after === before) return
  // Duplicating a tab carries its source navigation; closed tabs lose their state.
  const navigation: Record<string, SidebarRightTabNavigation> = {}
  for (const tab of Object.values(after.layout.tabs)) {
    navigation[tab.id] = after.navigation[tab.id]
      ?? Object.values(after.navigation).find(value => value.address === tab.contentId)
      ?? { address: tab.contentId, params: undefined, revision: 0 }
  }
  draft.surfaces = { ...draft.surfaces, [key]: { ...after, navigation } }
}

function planned(surface: RootSurfaceState, plan: (state: LayoutState, mint: Mint) => readonly LayoutOp[]): RootSurfaceState {
  const next = advanceSurface(surface, plan)
  return next === surface ? surface : { ...surface, ...next }
}

function gesturePlan(state: LayoutState, mint: Mint, gesture: RootDockGesture): readonly LayoutOp[] {
  switch (gesture.type) {
    case 'focusTab': {
      const pane = findTabPane(state, gesture.tabId)
      return pane.activeTabId === gesture.tabId && state.activePaneId === pane.id ? [] : [gesture]
    }
    case 'focusPane': return state.activePaneId === gesture.paneId ? [] : [gesture]
    case 'splitPane': {
      const tabId = getPane(state, gesture.paneId).activeTabId
      const tab = tabId === undefined ? undefined : state.tabs[tabId]
      return tab === undefined || dockPaneIds(state).length >= 2 ? []
        : planSplitPane(state, mint, gesture.paneId, id => ({ ...tab, id }))
    }
    case 'closeTab': {
      if (state.tabs[gesture.tabId] === undefined) return []
      const pane = findTabPane(state, gesture.tabId)
      return pane.host === 'dock' && pane.tabs.length === 1 && dockPaneIds(state).length === 1
        ? [gesture, ...planSetExpanded(state, false), ...planSetMode(state, 'push')] : [gesture]
    }
    case 'duplicateTab': return planDuplicateTab(state, mint, gesture.tabId).ops
    case 'floatTab': return planFloatTab(state, mint, gesture.tabId, gesture.rect).ops
    case 'unfloatPane': return planUnfloatPane(state, gesture.paneId)
    case 'placeTab': return planPlaceTab(state, gesture.tabId, gesture.paneId, gesture.index)
    case 'dropTab': return gesture.zone === 'top' || gesture.zone === 'bottom'
      || gesture.zone !== 'center' && dockPaneIds(state).length >= 2 ? []
      : planDropTab(state, mint, gesture.tabId, gesture.paneId, gesture.zone)
    case 'moveFloat': case 'resizeFloat': return [gesture]
    case 'resizeSplit': return planResizeSplit(gesture.splitId, gesture.sizes, 0.2)
  }
}

/** @returns the framework-owned global document viewing store. */
export function createSidebarRightRootStore() {
  return defineStore({
    init: (): SidebarRightRootState => ({ selectedScopes: {}, surfaces: {} }),
    actions: {
      selectScope(d: SidebarRightRootState, panelId: MainPanelId, scopeKey: string) {
        if (d.selectedScopes[panelId] !== scopeKey) d.selectedScopes = { ...d.selectedScopes, [panelId]: scopeKey }
      },
      open(d: SidebarRightRootState, panelId: MainPanelId, scopeKey: string,
        claim: SidebarRightTabClaim, options: SidebarRightRootOpenOptions) {
        changed(d, panelId, scopeKey, (surface) => {
          let opened: TabId | undefined
          const next = planned(surface, (state, mint) => {
            const replacement = options.replaceTab === undefined ? undefined : state.tabs[options.replaceTab]
            const pane = replacement === undefined ? undefined : findTabPane(state, replacement.id)
            const paneId = pane?.host === 'dock' ? pane.id : options.paneId
            const existing = options.revealIfOpened === false ? undefined : findContentTab(state, claim.contentId, claim.kind)
            let splitTab: TabId | undefined
            const split = options.preferNewPane === true && replacement === undefined && existing === undefined
              && dockPaneIds(state).length < 2 ? planSplitPane(state, mint, paneId, (id) => {
                splitTab = id
                return { ...claim, id, title: options.title ?? claim.title }
              }) : []
            const result = splitTab === undefined ? planOpenContent(state, mint, { ...claim,
              ...options.title === undefined ? {} : { title: options.title },
              ...paneId === undefined ? {} : { paneId },
              ...pane?.host !== 'dock' || replacement === undefined ? {} : { index: pane.tabs.indexOf(replacement.id) },
              ...options.revealIfOpened === undefined ? {} : { revealIfOpened: options.revealIfOpened },
            }) : { tabId: splitTab, ops: split }
            opened = result.tabId
            return [...planSetExpanded(state, true), ...result.ops,
              ...replacement !== undefined && replacement.id !== opened ? [{ type: 'closeTab' as const, tabId: replacement.id }] : []]
          })
          if (opened === undefined) return next
          return { ...next, navigation: { ...next.navigation, [opened]: {
            address: claim.contentId, params: options.params, revision: (surface.navigation[opened]?.revision ?? 0) + 1,
          } } }
        })
      },
      setExpanded(d: SidebarRightRootState, panelId: MainPanelId, scopeKey: string, expanded: boolean) {
        changed(d, panelId, scopeKey, s => planned(s,
          state => Object.keys(state.tabs).length === 0 ? [] : planSetExpanded(state, expanded)))
      },
      setMode(d: SidebarRightRootState, panelId: MainPanelId, scopeKey: string, mode: DockMode) {
        changed(d, panelId, scopeKey, s => planned(s, state => planSetMode(state, mode)))
      },
      gesture(d: SidebarRightRootState, panelId: MainPanelId, scopeKey: string, gesture: RootDockGesture) {
        changed(d, panelId, scopeKey, s => planned(s, (state, mint) => gesturePlan(state, mint, gesture)))
      },
    },
  })
}
