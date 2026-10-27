/** Global-panel documents share the ordinary Sidebar's native frame and docking gestures. */
import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import type { InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { DockIntents, HalvesFit, PaneId, TabRecord } from '@deepseek-ai/dsh-client-ui-dockkit'
import { canSplit, dockPaneIds, findTabPane } from '@deepseek-ai/dsh-client-ui-dockkit'
import type { SidebarRightTabDefinition } from '../tab-registry.ts'
import type { ShortcutCatalogEntry } from '@deepseek-ai/dsh-client-shortcuts/client'
import type { createSidebarRightRootStore, RootSurfaceState } from '../root-store.ts'
import type { SidebarRightRootOpenOptions } from '../root-service.ts'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarRightRootTabOwner } from '../contract/root.ts'
import type { SidebarRightPresentation } from './SidebarRight.tsx'
import { SidebarPanelFrame } from './SidebarPanelFrame.tsx'
import { dockLabels } from '../labels.ts'
import { rootExpandControl, visibleRootPane } from './root-focus.ts'
import css from './SidebarRight.module.css'

/** Native owner callbacks retain scope and report only measured presentation. */
export interface RootSidebarInjected {
  readonly hooks: {
    readonly tabTypes: HostObservable<readonly SidebarRightTabDefinition[]>
    readonly shortcuts: HostObservable<readonly ShortcutCatalogEntry[]>
  }
  readonly openIn: (panelId: MainPanelId, scopeKey: string, address: string, options?: SidebarRightRootOpenOptions) => void
  readonly syncPresentation: (panelId: MainPanelId, scopeKey: string, value: SidebarRightPresentation) => void
  readonly measureRoom: (panelId: MainPanelId, scopeKey: string, canSplitPane: (paneId: PaneId) => boolean) => void
}

type RootProps = PropsRuntime<'rightbar.root'> & PropsLocale<'sidebarRight'>
  & PropsRenderSlots<'sidebar.right.root.tab' | 'sidebar.right.root.tab.title'>
  & PropsStore<ReturnType<typeof createSidebarRightRootStore>> & InjectFace<RootSidebarInjected>

type SurfaceProps = RootProps & { readonly surface: RootSurfaceState; readonly active: boolean }

/** Keep one scope's visited document bodies mounted across library and topic navigation. */
function RootSurface(props: SurfaceProps): ReactNode {
  const { surface, actions, t, width, viewportWidth, canShow, active, syncPresentation } = props
  const { panelId, scopeKey, layout } = surface
  const types = props.useTabTypes(value => value)
  const shortcuts = props.useShortcuts(value => value)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const room = useRef<ReadonlyMap<PaneId, HalvesFit>>(new Map())
  const measureRoom = props.measureRoom
  const reportRoom = useCallback((fits: ReadonlyMap<PaneId, HalvesFit>) => {
    room.current = fits
    measureRoom(panelId, scopeKey, paneId => fits.get(paneId)?.row !== false)
  }, [measureRoom, panelId, scopeKey])
  const autoFullscreen = viewportWidth < 768
  const fullscreen = autoFullscreen || layout.mode === 'fullscreen'
  const shown = active && layout.expanded
  const track = shown && !autoFullscreen
  useLayoutEffect(() => {
    if (shown && !fullscreen && !canShow) actions.setExpanded(panelId, scopeKey, false)
  }, [shown, fullscreen, canShow, actions, panelId, scopeKey])
  // The frame owns measured width; report after the fullscreen slide covers it,
  // exactly as the ordinary Session seat does, so the center never jumps early.
  useLayoutEffect(() => {
    if (!active) return
    let disposed = false
    const report = (): void => {
      if (disposed) return
      const entering = shown && fullscreen ? panelRef.current?.getAnimations({ subtree: true }).filter(animation =>
        'transitionProperty' in animation && animation.transitionProperty === 'transform'
        && animation.playState !== 'finished' && animation.playState !== 'idle') ?? [] : []
      if (entering.length === 0) syncPresentation(panelId, scopeKey, { shown, track, fullscreen })
      else void Promise.allSettled(entering.map(animation => animation.finished)).then(report)
    }
    report()
    return () => { disposed = true }
  }, [active, shown, track, fullscreen, panelId, scopeKey, syncPresentation])

  const gesture: SurfaceProps['actions']['gesture'] = actions.gesture
  const intents: DockIntents = {
    focusTab: (tabId) => { gesture(panelId, scopeKey, { type: 'focusTab', tabId }) },
    focusPane: (paneId) => { gesture(panelId, scopeKey, { type: 'focusPane', paneId }) },
    splitPane: (paneId) => { if (room.current.get(paneId)?.row !== false) gesture(panelId, scopeKey, { type: 'splitPane', paneId }) },
    addTab: () => {},
    closeTab: (tabId) => {
      const before = document.activeElement
      const owned = before !== null && panelRef.current?.contains(before)
      flushSync(() => { gesture(panelId, scopeKey, { type: 'closeTab', tabId }) })
      if (owned && (document.activeElement === document.body || document.activeElement === before)) {
        (visibleRootPane(document, panelId, scopeKey) ?? rootExpandControl(document, panelId))?.focus({ preventScroll: true })
      }
    },
    duplicateTab: (tabId) => { gesture(panelId, scopeKey, { type: 'duplicateTab', tabId }) },
    floatTab: (tabId, rect) => { gesture(panelId, scopeKey, { type: 'floatTab', tabId, ...rect === undefined ? {} : { rect } }) },
    unfloatPane: (paneId) => { gesture(panelId, scopeKey, { type: 'unfloatPane', paneId }) },
    placeTab: (tabId, paneId, index) => { gesture(panelId, scopeKey, { type: 'placeTab', tabId, paneId, index }) },
    dropTab: (tabId, paneId, zone) => { gesture(panelId, scopeKey, { type: 'dropTab', tabId, paneId, zone }) },
    moveFloat: (paneId, x, y) => { gesture(panelId, scopeKey, { type: 'moveFloat', paneId, x, y }) },
    resizeFloat: (paneId, rect) => { gesture(panelId, scopeKey, { type: 'resizeFloat', paneId, rect }) },
    resizeSplit: (splitId, sizes) => { gesture(panelId, scopeKey, { type: 'resizeSplit', splitId, sizes }) },
  }
  const owner = (tab: TabRecord): SidebarRightRootTabOwner => {
    const pane = findTabPane(layout, tab.id)
    return { panelId, scopeKey, tab,
      navigation: surface.navigation[tab.id] ?? { address: tab.contentId, params: undefined, revision: 0 },
      visible: active && (pane.host === 'float' || layout.expanded && pane.activeTabId === tab.id),
      onOpen: (address, options) => { props.openIn(panelId, scopeKey, address, options) },
      onClose: () => { intents.closeTab(tab.id) },
    }
  }
  return <div className={css.session} hidden={!active} data-sidebar-right-root-scope={scopeKey}>
    <SidebarPanelFrame panelId={panelId} width={width} fullscreen={fullscreen} panelRef={panelRef}
      t={t} shortcuts={shortcuts} collapse={() => {
        flushSync(() => { actions.setExpanded(panelId, scopeKey, false) })
        rootExpandControl(document, panelId)?.focus({ preventScroll: true })
      }}
      toggleFullscreen={() => {
        if (autoFullscreen) {
          flushSync(() => { actions.setExpanded(panelId, scopeKey, false) })
          rootExpandControl(document, panelId)?.focus({ preventScroll: true })
        }
        else actions.setMode(panelId, scopeKey, fullscreen ? 'push' : 'fullscreen')
      }} dock={{ state: layout, canSplit: canSplit(layout) && dockPaneIds(layout).length < 2,
        dropZones: 'horizontal', minPaneFraction: 0.2, canAddTab: () => false,
        intents, labels: dockLabels(t, shortcuts.find(entry => entry.id === 'pane.split'), shortcuts.find(entry => entry.id === 'page.close')),
        active, keepMounted: () => true, onRoom: reportRoom,
        renderTab: tab => <div key={tab.id} className={css.tabBody} data-sidebar-right-tab={tab.id}>
          {props.renderSlot('sidebar.right.root.tab', owner(tab), {
            entryKey: types.find(type => type.kind === tab.kind)?.id ?? tab.kind,
            fallback: <p className={css.unavailable}>{t('tab.unavailable')}</p>,
          })}</div>,
        renderTabTitle: tab => <span key={tab.id} className={css.tabTitle} data-sidebar-right-tab={tab.id}>
          {props.renderSlot('sidebar.right.root.tab.title', owner(tab), {
            entryKey: types.find(type => type.kind === tab.kind)?.id ?? tab.kind, fallback: tab.title,
          })}</span>,
      }} />
  </div>
}

/** @param props - frame geometry and framework-owned root state. @returns retained global reader surfaces. */
export function RootSidebarSeat(props: RootProps): ReactNode {
  const activePanelId = props.usePanelInfo(info => info.activePanelId)
  const state = props.useStore(value => value)
  const currentScope = activePanelId === null ? undefined : state.selectedScopes[activePanelId] ?? ''
  const hasActive = Object.values(state.surfaces).some(surface => surface.panelId === activePanelId && surface.scopeKey === currentScope)
  useLayoutEffect(() => {
    if (activePanelId !== null && !hasActive) props.syncPresentation(activePanelId, currentScope ?? '', { shown: false, track: false, fullscreen: false })
  }, [activePanelId, currentScope, hasActive, props.syncPresentation])
  return <>{Object.entries(state.surfaces).map(([key, surface]) => <RootSurface key={key} {...props} surface={surface}
    active={surface.panelId === activePanelId && surface.scopeKey === currentScope} />)}</>
}
