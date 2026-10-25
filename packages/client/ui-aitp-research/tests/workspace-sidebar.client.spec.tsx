// @vitest-environment jsdom
/** Shared selection and source states in the host's contextual topic browser. */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { WorkspaceSidebar, type WorkspaceSidebarProps } from '../src/client/WorkspaceSidebar.tsx'
import { sidebarEn } from '../src/client/sidebar-locales.ts'
import { createResearchPanelStore } from '../src/client/store.ts'
import { workspaceProjectAddress, workspaceTopicsAddress } from '../src/client/workspace-resources.ts'
import type { Project, ResearchProvider, ResourceId, Revision, TopicId, TopicPage, TopicSummary, WorkspaceRead } from '../src/client/workspace-contract.ts'

afterEach(cleanup)

const WS = 'sidebar-workspace' as WorkspaceId
const ROOT = 'root' as TopicId
const CHILD = 'child' as TopicId
const GRANDCHILD = 'grandchild' as TopicId
const provider: ResearchProvider = {
  id: 'sidebar-fixture', origin: 'fixture',
  capabilities: {
    read: true, readContext: false, readActivity: false, previewChanges: false,
    applyChanges: false, changeEvents: true, commands: [],
  },
}
const workspaces: WorkspaceView[] = [
  { workspaceId: WS, path: '/fixture', title: 'Workspace', sessionIds: [], createdAt: '', updatedAt: '' },
]
const none: ResourceSnapshot<never> = { status: 'none', value: undefined, failure: undefined }

function envelope<T>(value: T): WorkspaceRead<T> {
  return { origin: 'fixture', provider, value, revision: 'one' as Revision, observedAt: '2026-10-23T00:00:00Z' }
}

function topic(id: TopicId, title: string, parentId: TopicId | null, childIds: TopicId[]): TopicSummary {
  return { id, title, parentId, childIds, currentAnswer: null, gap: null, work: { state: 'active', label: 'In progress' }, resourceCount: 0 }
}

const page: TopicPage = {
  items: [
    envelope(topic(ROOT, 'Spectral dynamics', null, [CHILD])),
    envelope(topic(CHILD, 'Finite systems', ROOT, [GRANDCHILD])),
    envelope(topic(GRANDCHILD, 'Convergence check', CHILD, [])),
  ],
  nextCursor: null, completeness: 'complete',
}

const live = <T,>(value: T): ResourceSnapshot<T> => ({ status: 'live', value, failure: undefined })
const stay = { scrollTop: 0, focusIndex: null }
const expand = (title: string): void => { fireEvent.click(screen.getByRole('button', { name: `Show branches of ${title}` })) }

function mount(options: {
  wide?: boolean
  workspaces?: WorkspaceView[]
  topics?: ResourceSnapshot<WorkspaceRead<TopicPage>>
  resources?: Record<string, ResourceSnapshot<unknown>>
} = {}) {
  const store = createResearchPanelStore().create()
  const callbacks = { expandSidebar: vi.fn(), showConversations: vi.fn(), retry: vi.fn() }
  let currentWorkspaces = options.workspaces ?? workspaces
  const resources: Record<string, ResourceSnapshot<unknown>> = {
    [workspaceProjectAddress(WS)]: live(envelope<Project>({ id: 'project', title: 'Example research', directions: [], seeds: [] })),
    [workspaceTopicsAddress(WS)]: options.topics ?? live(envelope(page)),
    ...options.resources,
  }
  const props = {
    ...callbacks,
    wide: options.wide ?? true,
    t: makeTranslate(sidebarEn),
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    useWorkspaces: (select: (snapshot: { items: readonly WorkspaceView[] }) => unknown) =>
      select({ items: currentWorkspaces }),
    useResource: (address: string) => resources[address] ?? none,
  } as WorkspaceSidebarProps
  const view = render(<WorkspaceSidebar {...props} />)
  return {
    store, ...callbacks,
    updateResource: (address: string, snapshot: ResourceSnapshot<unknown>) => {
      resources[address] = snapshot
      view.rerender(<WorkspaceSidebar {...props} />)
    },
    updateWorkspaces: (items: WorkspaceView[]) => {
      currentWorkspaces = items
      view.rerender(<WorkspaceSidebar {...props} />)
    },
  }
}

describe('contextual research sidebar', () => {
  it('navigates nested topics through collapsed branches and follows selections made by the main panel', () => {
    const { store } = mount()
    expect(screen.getByText('Example project')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Research map' }).getAttribute('aria-current')).toBe('page')
    expect(screen.queryByRole('button', { name: 'Finite systems' })).toBeNull()
    expand('Spectral dynamics')
    const root = screen.getByRole('button', { name: 'Spectral dynamics' }).closest('li')!
    expect(within(root).getByRole('button', { name: 'Hide branches of Spectral dynamics' }).getAttribute('aria-expanded')).toBe('true')
    expand('Finite systems')
    const child = within(root).getByRole('button', { name: 'Finite systems' }).closest('li')!
    fireEvent.click(within(child).getByRole('button', { name: 'Convergence check' }))
    expect(store.getSnapshot().workspaceId).toBe(WS)
    expect(store.getSnapshot().location).toEqual({ kind: 'topic', topicId: GRANDCHILD })
    expect(screen.getByRole('button', { name: 'Convergence check' }).getAttribute('aria-current')).toBe('page')
    fireEvent.click(screen.getByRole('button', { name: 'Hide branches of Spectral dynamics' }))
    expect(screen.queryByRole('button', { name: 'Convergence check' })).toBeNull()
    act(() => { store.actions.open(WS, { kind: 'map', focusId: ROOT }, stay) })
    expect(screen.getByRole('button', { name: 'Spectral dynamics' }).getAttribute('aria-current')).toBe('page')
    fireEvent.click(screen.getByRole('button', { name: 'Research map' }))
    expect(store.getSnapshot().location).toEqual({ kind: 'map', focusId: null })
  })

  it('opens the outline along the path to the current topic, including a material location', () => {
    const { store } = mount()
    act(() => { store.actions.open(WS, { kind: 'resource', topicId: GRANDCHILD, resourceId: 'note' as ResourceId }, stay) })
    expect(screen.getByRole('button', { name: 'Convergence check' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Hide branches of Finite systems' })).toBeTruthy()
    act(() => { store.actions.open(WS, { kind: 'map', focusId: CHILD }, stay) })
    expect(screen.getByRole('button', { name: 'Show branches of Finite systems' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Convergence check' })).toBeNull()
  })

  it('stops following recorded parents when they form a cycle', () => {
    const cyclic: TopicPage = {
      items: [envelope(topic(ROOT, 'Spectral dynamics', CHILD, [CHILD])), envelope(topic(CHILD, 'Finite systems', ROOT, [ROOT]))],
      nextCursor: null, completeness: 'complete',
    }
    const { store } = mount({ topics: live(envelope(cyclic)) })
    act(() => { store.actions.open(WS, { kind: 'topic', topicId: CHILD }, stay) })
    expect(screen.getByRole('button', { name: 'Research map' }).getAttribute('aria-current')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Finite systems' })).toBeNull()
  })

  it('returns to the existing Conversations browser and expands the collapsed rail', () => {
    const expanded = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Conversations' }))
    expect(expanded.showConversations).toHaveBeenCalledOnce()
    cleanup()
    const collapsed = mount({ wide: false })
    fireEvent.click(screen.getByRole('button', { name: 'Open topic navigation' }))
    expect(collapsed.expandSidebar).toHaveBeenCalledOnce()
    expect(screen.queryByText('Spectral dynamics')).toBeNull()
  })

  it('keeps the route to add a Workspace available when no Workspace exists', () => {
    const { showConversations } = mount({ workspaces: [] })
    expect(screen.getByText('Choose or add a Workspace in Conversations')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Conversations' }))
    expect(showConversations).toHaveBeenCalledOnce()
  })

  it('shows loading and unavailable states instead of inventing topics', () => {
    mount({ topics: { status: 'loading', value: undefined, failure: undefined } })
    expect(screen.getByRole('status', { name: 'Loading topics' })).toBeTruthy()
    cleanup()
    mount({ topics: none })
    expect(screen.getByText('Research data is not connected')).toBeTruthy()
    expect(screen.queryByText('Spectral dynamics')).toBeNull()
    cleanup()
    mount({ topics: {
      status: 'failed', value: undefined,
      failure: new RemoteError('aitp/workspace', 'Disconnected', { code: 'not-connected', message: 'Disconnected', retryable: true }),
    } })
    expect(screen.getByText('Research data is not connected')).toBeTruthy()
    expect(screen.getByText('Example project')).toBeTruthy()
    cleanup()
    mount({ topics: {
      status: 'failed', value: undefined,
      failure: new RemoteError('aitp/workspace', 'Unavailable', { code: 'unavailable', message: 'Unavailable', retryable: true }),
    } })
    expect(screen.getByText('Topics could not be loaded')).toBeTruthy()
    cleanup()
    mount({ topics: live(envelope<TopicPage>({ items: [], nextCursor: null, completeness: 'complete' })) })
    expect(screen.getByText('No topics yet')).toBeTruthy()
  })

  it('keeps retained topics with a stale notice and shows partial or unparented loaded rows honestly', () => {
    const retained = envelope<TopicPage>({
      items: [envelope(topic(CHILD, 'Finite systems', ROOT, []))],
      completeness: 'partial', nextCursor: 'next-page',
    })
    mount({ topics: {
      status: 'failed', value: retained,
      failure: new RemoteError('aitp/workspace', 'Disconnected', { code: 'not-connected', message: 'Disconnected', retryable: true }),
    } })
    expect(screen.getByRole('status').textContent).toBe('Showing the last topics read')
    expect(screen.getByText('Other loaded topics')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Finite systems' })).toBeTruthy()
    expect(screen.getByText('Only part of the topic list is available')).toBeTruthy()
  })

  it('pins the navigated Workspace and shows overview if that Workspace is removed', () => {
    const { store, updateWorkspaces } = mount()
    const otherWorkspace = { ...workspaces[0]!, workspaceId: 'other-workspace' as WorkspaceId, title: 'Other Workspace' }
    expand('Spectral dynamics')
    fireEvent.click(screen.getByRole('button', { name: 'Finite systems' }))
    updateWorkspaces([otherWorkspace, ...workspaces])
    expect(store.getSnapshot().workspaceId).toBe(WS)
    expect(screen.getByRole('button', { name: 'Finite systems' }).getAttribute('aria-current')).toBe('page')
    updateWorkspaces([otherWorkspace])
    expect(screen.getByText('Other Workspace')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Research map' }).getAttribute('aria-current')).toBe('page')
    expect(screen.queryByRole('button', { name: 'Finite systems' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Research map' }))
    expect(store.getSnapshot().workspaceId).toBe(otherWorkspace.workspaceId)
    expect(store.getSnapshot().location).toEqual({ kind: 'map', focusId: null })
  })
})

describe('topic continuation in the contextual sidebar', () => {
  const first: TopicPage = { items: [page.items[0]!], nextCursor: 'children', completeness: 'complete' }
  const second: TopicPage = { items: [page.items[1]!], nextCursor: null, completeness: 'complete' }
  const continuation = workspaceTopicsAddress(WS, { cursor: 'children' })
  const unavailable = new RemoteError('aitp/workspace', 'Disconnected', {
    code: 'not-connected', message: 'Disconnected', retryable: true,
  })

  it('follows nextCursor even on a complete page and merges children into one tree', () => {
    mount({ topics: live(envelope(first)), resources: { [continuation]: live(envelope(second)) } })
    expect(screen.queryByRole('button', { name: 'Finite systems' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Load more topics' }))
    expand('Spectral dynamics')
    const root = screen.getByRole('button', { name: 'Spectral dynamics' }).closest('li')!
    expect(within(root).getByRole('button', { name: 'Finite systems' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Research map' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Spectral dynamics' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Load more topics' })).toBeNull()
    expect(screen.queryByText('Only part of the topic list is available')).toBeNull()
  })

  it('moves previously unparented children below a parent received on a later page', () => {
    mount({
      topics: live(envelope<TopicPage>({ ...first, items: [page.items[1]!] })),
      resources: { [continuation]: live(envelope<TopicPage>({ ...second, items: [page.items[0]!, page.items[1]!] })) },
    })
    expect(screen.getByText('Other loaded topics')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Load more topics' }))
    expand('Spectral dynamics')
    const root = screen.getByRole('button', { name: 'Spectral dynamics' }).closest('li')!
    expect(within(root).getByRole('button', { name: 'Finite systems' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Finite systems' })).toHaveLength(1)
    expect(screen.queryByText('Other loaded topics')).toBeNull()
  })

  it('keeps prior rows visible while a continuation loads or fails, and offers a retry', () => {
    const { updateResource, retry } = mount({ topics: live(envelope(first)), resources: {
      [continuation]: { status: 'loading', value: undefined, failure: undefined },
    } })
    fireEvent.click(screen.getByRole('button', { name: 'Load more topics' }))
    expect(screen.getByRole('status', { name: 'Loading topics' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Spectral dynamics' })).toBeTruthy()
    updateResource(continuation, { status: 'failed', value: undefined, failure: unavailable })
    expect(screen.getByText('More topics could not be loaded; the previous topics remain available')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Spectral dynamics' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Read topics again' }))
    expect(retry).toHaveBeenCalledWith(WS)
    expect(screen.getByRole('button', { name: 'Load more topics' })).toBeTruthy()
  })

  it('preserves a retained child on refresh failure and discards old pages when the first revision changes', () => {
    const { updateResource } = mount({ topics: live(envelope(first)), resources: { [continuation]: live(envelope(second)) } })
    fireEvent.click(screen.getByRole('button', { name: 'Load more topics' }))
    updateResource(continuation, { status: 'failed', value: envelope(second), failure: unavailable })
    expect(screen.getByText('Showing the last topics read')).toBeTruthy()
    expand('Spectral dynamics')
    const root = screen.getByRole('button', { name: 'Spectral dynamics' }).closest('li')!
    expect(within(root).getByRole('button', { name: 'Finite systems' })).toBeTruthy()
    updateResource(workspaceTopicsAddress(WS), live({ ...envelope(first), revision: 'two' as Revision }))
    expect(screen.queryByRole('button', { name: 'Finite systems' })).toBeNull()
    expect(screen.queryByText('Showing the last topics read')).toBeNull()
    expect(screen.getByRole('button', { name: 'Load more topics' })).toBeTruthy()
  })

  it('drops an expired continuation while keeping the earlier tree and explains how to resume', () => {
    const { updateResource, retry } = mount({ topics: live(envelope(first)), resources: {
      [continuation]: live(envelope(second)),
    } })
    fireEvent.click(screen.getByRole('button', { name: 'Load more topics' }))
    updateResource(continuation, {
      status: 'failed', value: envelope(second), failure: new RemoteError('aitp/workspace', 'Cursor expired', {
        code: 'invalid-request', message: 'Cursor expired', retryable: false,
      }),
    })
    expect(screen.queryByRole('button', { name: 'Finite systems' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Spectral dynamics' })).toBeTruthy()
    expect(screen.getByText('The topic list changed; read it again to continue')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Read topics again' }))
    expect(retry).toHaveBeenCalledWith(WS)
  })
})
