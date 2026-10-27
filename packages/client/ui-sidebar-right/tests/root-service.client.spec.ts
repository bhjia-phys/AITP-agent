/** Real native planners and resource lifetimes for Session-independent document browsing. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import { dockPaneIds } from '@deepseek-ai/dsh-client-ui-dockkit'
import { SidebarRightTabRegistry } from '../src/client/tab-registry.ts'
import { SidebarRightRoots } from '../src/client/root-service.ts'
import { createSidebarRightRootStore, rootSurfaceKey } from '../src/client/root-store.ts'

const PANEL = 'library' as MainPanelId
const ADDRESS = 'dsh-resource://source/论文/readme.md'

function setup() {
  const registry = new SidebarRightTabRegistry(new Context())
  registry.register({ id: 'source-body', kind: 'source', patterns: ['dsh-resource://source/**'], priority: 'builtin',
    title: address => address.slice(address.lastIndexOf('/') + 1) })
  const pin = vi.fn<(address: string, signal: AbortSignal) => void>()
  const roots = new SidebarRightRoots(registry, pin)
  const store = createSidebarRightRootStore().create()
  const surface = (scopeKey = '') => {
    const value = store.getSnapshot().surfaces[rootSurfaceKey(PANEL, scopeKey)]
    if (value === undefined) throw new Error(`Missing root surface ${scopeKey}`)
    return value
  }
  return { roots, store, pin, surface }
}

describe('global native document surfaces', () => {
  it('queues navigation until the framework adopts the root store, without a Session', () => {
    const h = setup()
    h.roots.selectScope(PANEL, 'topic-A')
    h.roots.openResource(PANEL, ADDRESS)
    expect(h.pin).not.toHaveBeenCalled()
    h.roots.adopt(h.store)
    const first = Object.values(h.surface('topic-A').layout.tabs)[0]!
    expect(h.roots.views.getSnapshot()[PANEL]).toEqual({ scopeKey: 'topic-A', expanded: true, activeAddress: ADDRESS })
    h.roots.setExpanded(PANEL, false)
    h.roots.openResource(PANEL, ADDRESS)
    expect(Object.keys(h.surface('topic-A').layout.tabs)).toEqual([first.id])
    expect(h.surface('topic-A').navigation[first.id]?.revision).toBe(2)
    expect(h.pin).toHaveBeenCalledTimes(1)
  })

  it('restores each topic independently and keeps captured background navigation in its own scope', () => {
    const h = setup()
    h.roots.adopt(h.store)
    h.roots.selectScope(PANEL, 'topic-A')
    h.roots.openResource(PANEL, ADDRESS)
    const a = h.surface('topic-A')
    h.roots.selectScope(PANEL, 'topic-B')
    expect(h.roots.views.getSnapshot()[PANEL]).toEqual({ scopeKey: 'topic-B', expanded: false })
    h.roots.openResource(PANEL, 'dsh-resource://source/b.pdf')
    const b = h.surface('topic-B')
    h.roots.openIn(PANEL, 'topic-A', 'dsh-resource://source/a-link.png')
    expect(h.surface('topic-B')).toBe(b)
    expect(h.roots.views.getSnapshot()[PANEL]?.activeAddress).toBe('dsh-resource://source/b.pdf')
    h.roots.selectScope(PANEL, 'topic-A')
    expect(Object.keys(h.surface('topic-A').layout.tabs)).toHaveLength(2)
    expect(h.surface('topic-A').layout.tabs[Object.values(a.layout.tabs)[0]!.id]).toBeDefined()
    expect(h.pin.mock.calls.every(([, signal]) => !signal.aborted)).toBe(true)
  })

  it('releases the last document only on close, collapses safely, and releases every scope on unload', () => {
    const h = setup()
    h.roots.adopt(h.store)
    h.roots.openResource(PANEL, ADDRESS)
    const first = Object.values(h.surface().layout.tabs)[0]!
    h.roots.setExpanded(PANEL, false)
    expect(h.pin.mock.calls[0]![1].aborted).toBe(false)
    h.roots.close(PANEL, first.id)
    expect(h.pin.mock.calls[0]![1].aborted).toBe(true)
    expect(h.roots.views.getSnapshot()[PANEL]).toEqual({ scopeKey: '', expanded: false })
    h.roots.openResource(PANEL, ADDRESS)
    h.roots.selectScope(PANEL, 'another')
    h.roots.openResource(PANEL, ADDRESS)
    h.roots.dispose()
    expect(h.pin.mock.calls.every(([, signal]) => signal.aborted)).toBe(true)
  })

  it('uses native two-pane split and float operations with independent retained document tabs', () => {
    const h = setup()
    h.roots.adopt(h.store)
    h.roots.openResource(PANEL, ADDRESS)
    h.roots.openResource(PANEL, 'dsh-resource://source/b.pdf', { preferNewPane: true })
    expect(dockPaneIds(h.surface().layout)).toHaveLength(2)
    const tab = Object.values(h.surface().layout.tabs)[0]!
    h.store.actions.gesture(PANEL, '', { type: 'floatTab', tabId: tab.id })
    expect(h.surface().layout.floats).toHaveLength(1)
    h.store.actions.gesture(PANEL, '', { type: 'unfloatPane', paneId: h.surface().layout.floats[0]! })
    expect(h.surface().layout.floats).toHaveLength(0)
    expect(h.pin).toHaveBeenCalledTimes(2)
  })
})
