/** A global panel's header can reopen its retained native document Sidebar. */
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots'
import { SidebarExpandControl } from './ExpandButton.tsx'
import { rootSurfaceKey } from '../root-store.ts'
import { visibleRootPane } from './root-focus.ts'
import type {} from '../contract/root.ts'

/** @param props - root viewing store, shortcuts and owning panel. @returns the native expand control when collapsed documents exist. */
export function RootExpandButton({ panelId, useStore, actions, t, useShortcuts }: FactoryComponentPropsOf<'sidebar.right.root.expand'>): ReactNode {
  const scopeKey = useStore(state => state.selectedScopes[panelId] ?? '')
  const surface = useStore(state => state.surfaces[rootSurfaceKey(panelId, scopeKey)])
  const shortcut = useShortcuts(entries => entries.find(entry => entry.id === 'sidebar.right.toggle'))
  if (surface === undefined || surface.layout.expanded || Object.keys(surface.layout.tabs).length === 0) return null
  return <SidebarExpandControl t={t} shortcut={shortcut} panelId={panelId} open={() => {
    flushSync(() => { actions.setExpanded(panelId, scopeKey, true) })
    visibleRootPane(document, panelId, scopeKey)?.focus({ preventScroll: true })
  }} />
}
