// @vitest-environment jsdom
/** User paths over adapter snapshots; backend and transport semantics have their own suites. */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { en } from '../src/client/locales.ts'
import { ResearchPanel, type ResearchPanelFace, type ResearchPanelProps } from '../src/client/ResearchPanel.tsx'
import { createResearchPanelStore } from '../src/client/store.ts'
import { workspaceEditKey } from '../src/client/workspace-edit-state.ts'
import type { ApplyReceipt, ChangePreview, Project, ReadEnvelope, ResearchProvider, Resource, ResourceId, Result, Revision, Topic, TopicId, TopicPage, WorkspaceRead } from '../src/client/workspace-contract.ts'
import { workspaceActivityAddress, workspaceProjectAddress, workspaceResourceAddress, workspaceTopicAddress, workspaceTopicsAddress } from '../src/client/workspace-resources.ts'

afterEach(cleanup)

const t = makeTranslate(en) as TranslateNS<'aitp.research'>
const WS = 'w1' as WorkspaceId
const ROOT = 'root' as TopicId
const CHILD = 'child' as TopicId
const NOTE = 'note' as ResourceId
const PDF = 'paper' as ResourceId
const REVISION = 'r1' as Revision
const provider: ResearchProvider = {
  id: 'test', origin: 'fixture', capabilities: {
    read: true, readContext: false, readActivity: true, previewChanges: true, applyChanges: true, changeEvents: true,
    commands: ['update-scope', 'record-answer'],
  },
}
const attribution = { sourceResourceIds: [] }
const project: Project = { id: 'project', title: 'Research programme', directions: [{ id: 'd', title: 'Theory' }], seeds: [] }
const root: Topic = {
  id: ROOT, title: 'Main question', directionId: 'd', parentId: null, childIds: [CHILD], currentAnswer: { text: 'A conditional result.', qualification: 'Only under assumption A.', attribution },
  gap: 'Large systems remain open.', work: { state: 'active', label: 'Active', nextAction: 'Compare a control.' }, resourceCount: 1,
  question: 'What changes with system size?', scope: 'Finite systems.', workItems: [], statements: [], resources: [],
}
const child: Topic = {
  ...root, id: CHILD, title: 'Controlled limit', parentId: ROOT, childIds: [], currentAnswer: { text: 'The small-system result.', qualification: 'This is not a large-system conclusion.', attribution },
  gap: 'A matched comparison is still missing.', work: { state: 'waiting-on-analysis', label: 'Awaiting analysis', nextAction: 'Read the control.' },
  resources: [
    { id: NOTE, ownerTopicId: CHILD, title: 'Control calculation', kind: 'note', target: { kind: 'workspace-path', path: 'notes/control.md' } },
    { id: PDF, ownerTopicId: CHILD, title: 'Reference paper', kind: 'paper', target: { kind: 'uri', uri: 'https://example.org/paper.pdf' } },
  ], accountResourceId: NOTE,
}
const note: Resource = { ...child.resources[0]!, content: { kind: 'markdown', text: '# Full control\n\nThe full argument keeps assumption A.' }, attribution }
const paper: Resource = { ...child.resources[1]!, content: { kind: 'unavailable', reason: 'unsupported-format', detail: 'PDF reader is not connected.' }, attribution }
const read = <T,>(value: T): WorkspaceRead<T> => ({ origin: 'fixture', revision: REVISION, observedAt: '2026-10-23T12:00:00Z', value, provider })
const live = <T,>(value: T): ResourceSnapshot<T> => ({ status: 'live', value, failure: undefined })
const none: ResourceSnapshot<never> = { status: 'none', value: undefined, failure: undefined }
const page = (...topics: Topic[]): TopicPage => ({ items: topics.map(read), nextCursor: null, completeness: 'complete' })
const failure = (code: 'not-connected' | 'not-found'): RemoteError<'aitp/workspace'> => new RemoteError('aitp/workspace', 'Failed.', { code, message: 'Failed.', retryable: code === 'not-connected' })
const loading: ResourceSnapshot<never> = { status: 'loading', value: undefined, failure: undefined }

function resources(): Record<string, ResourceSnapshot<unknown>> {
  return {
    [workspaceProjectAddress(WS)]: live(read(project)),
    [workspaceTopicsAddress(WS, { parentId: null })]: live(read(page(root))),
    [workspaceTopicsAddress(WS, { parentId: ROOT })]: live(read(page(child))),
    [workspaceTopicsAddress(WS, { parentId: CHILD })]: live(read(page())),
    [workspaceTopicAddress(WS, ROOT)]: live(read(root)),
    [workspaceTopicAddress(WS, CHILD)]: live(read(child)),
    [workspaceResourceAddress(WS, NOTE)]: live(read(note)),
    [workspaceResourceAddress(WS, PDF)]: live(read(paper)),
    [workspaceActivityAddress(WS, CHILD)]: live(read({ items: [], completeness: 'complete', nextCursor: null })),
  }
}

function panel(values = resources(), overrides: Partial<ResearchPanelFace> = {}, workspaces: WorkspaceView[] = [{ workspaceId: WS, path: '/scratch/research', title: 'Workspace', sessionIds: [], createdAt: '', updatedAt: '' }]) {
  const store = createResearchPanelStore().create()
  const face: ResearchPanelFace = {
    openSession: vi.fn(), startDraft: vi.fn(), retry: vi.fn(),
    previewChange: vi.fn<ResearchPanelFace['previewChange']>(async () => ({
      ok: false, error: { code: 'unsupported', message: 'Unavailable.', retryable: false },
    })),
    applyChange: vi.fn<ResearchPanelFace['applyChange']>(async () => ({
      ok: false, error: { code: 'unsupported', message: 'Unavailable.', retryable: false },
    })),
    ...overrides,
  }
  const props = {
    t, useWorkspaces: (select: (value: { items: WorkspaceView[] }) => unknown) => select({ items: workspaces }),
    useResource: (address: string) => values[address] ?? none,
    useStore: bindSnapshotSelector(store), actions: store.actions, ...face,
  } as ResearchPanelProps
  let view = render(<ResearchPanel {...props} />)
  return {
    store, face, rerender: () => { view.rerender(<ResearchPanel {...props} />) },
    leavePanel: () => { view.unmount() },
    returnToPanel: () => { view = render(<ResearchPanel {...props} />) },
  }
}

/** From the map overview: focus the root, focus its branch, then open the branch's page. */
function openChild(): void {
  fireEvent.click(screen.getByRole('button', { name: /^Main question/ }))
  fireEvent.click(screen.getByRole('button', { name: /^Controlled limit/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Open topic' }))
}

const trail = (): HTMLElement => screen.getByRole('navigation', { name: 'Research location' })
const section = (name: string): HTMLElement => screen.getByRole('button', { name: new RegExp(`^${name}`) })

describe('research map overview', () => {
  it('orients by direction and topic without answers, and reveals branches only on request', () => {
    const { store } = panel()
    expect(screen.getByRole('heading', { name: 'Research programme', level: 2 })).toBeDefined()
    expect(screen.queryByRole('navigation', { name: 'Research location' })).toBeNull()
    const lane = screen.getByRole('region', { name: 'Theory' })
    expect(within(lane).getByRole('button', { name: /^Main question/ })).toBeDefined()
    expect(screen.queryByText('A conditional result.')).toBeNull()
    expect(screen.queryByText('Large systems remain open.')).toBeNull()
    const toggle = screen.getByRole('button', { name: '1 branch of Main question' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: /^Controlled limit/ })).toBeNull()
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: '1 branch of Main question' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: /^Controlled limit/ })).toBeDefined()
    expect(Object.values(store.getSnapshot().disclosure)).toEqual([true])
    expect(screen.getByText('Demo workspace')).toBeDefined()
  })

  it('shows the recorded summary, ideas and unassigned topics, and says when a direction has none', () => {
    const values = resources()
    values[workspaceProjectAddress(WS)] = live(read<Project>({
      ...project, summary: 'What finite calculations can establish.', directions: [...project.directions, { id: 'empty', title: 'Methods' }],
      seeds: [{ id: 'seed', title: 'Boundary conditions', summary: 'A periodic comparison may change answers.', attribution }],
    }))
    values[workspaceTopicsAddress(WS, { parentId: null })] = live(read(page(root, { ...child, id: 'loose' as TopicId, title: 'Loose reading', parentId: null, directionId: 'gone' })))
    panel(values)
    expect(screen.getByText('What finite calculations can establish.')).toBeDefined()
    expect(screen.getByText('Boundary conditions')).toBeDefined()
    expect(within(screen.getByRole('region', { name: 'Methods' })).getByText('No topics are recorded in this direction.')).toBeDefined()
    expect(within(screen.getByRole('region', { name: 'Other topics' })).getByRole('button', { name: /^Loose reading/ })).toBeDefined()
  })

  it('names the lane plainly without directions and reports an empty project', () => {
    const values = resources()
    values[workspaceProjectAddress(WS)] = live(read<Project>({ ...project, directions: [] }))
    panel(values)
    expect(within(screen.getByRole('region', { name: 'Topics' })).getByRole('button', { name: /^Main question/ })).toBeDefined()
    cleanup()
    values[workspaceTopicsAddress(WS, { parentId: null })] = live(read(page()))
    panel(values)
    expect(screen.getByText('No topics are available in this project yet.')).toBeDefined()
  })

  it('continues the topic list on request and keeps a lane honest while topics are unread', () => {
    const values = resources()
    const more = { parentId: null, cursor: 'next' } as const
    values[workspaceTopicsAddress(WS, { parentId: null })] = live(read({ items: [], nextCursor: 'next', completeness: 'complete' }))
    values[workspaceTopicsAddress(WS, more)] = loading
    const { rerender } = panel(values)
    expect(screen.getByText('No topics in this direction are loaded yet.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Load more topics' }))
    expect(screen.getByRole('status', { name: 'Loading' })).toBeDefined()
    values[workspaceTopicsAddress(WS, more)] = { status: 'failed', value: undefined, failure: failure('not-connected') }
    act(rerender)
    expect(screen.getByText('More items could not be read; the loaded items remain.')).toBeDefined()
    values[workspaceTopicsAddress(WS, more)] = live(read({ items: [read(root)], nextCursor: null, completeness: 'partial', incompleteReason: 'One note was unreadable.' }))
    act(rerender)
    expect(screen.getByRole('button', { name: /^Main question/ })).toBeDefined()
    expect(screen.getByText('One note was unreadable.')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Load more topics' })).toBeNull()
  })

  it('marks a retained list and a partial page without a reason', () => {
    const values = resources()
    values[workspaceTopicsAddress(WS, { parentId: null })] = { status: 'failed', value: read({ items: [read(root)], nextCursor: null, completeness: 'partial' }), failure: failure('not-connected') }
    const { face } = panel(values)
    expect(screen.getByText('Only part of this list is available.')).toBeDefined()
    fireEvent.click(within(screen.getByRole('note')).getByRole('button', { name: 'Read again' }))
    expect(face.retry).toHaveBeenCalledWith(WS)
    cleanup()
    values[workspaceTopicsAddress(WS, { parentId: null })] = { status: 'failed', value: undefined, failure: failure('not-connected') }
    panel(values)
    expect(screen.getByText('Research workspace is not connected')).toBeDefined()
  })

  it('moves between map nodes by arrow, Home and End keys and ignores other keys and targets', () => {
    panel()
    fireEvent.click(screen.getByRole('button', { name: '1 branch of Main question' }))
    const [first, second] = screen.getAllByRole('button', { name: /^(Main question|Controlled limit)/ }) as [HTMLElement, HTMLElement]
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(second)
    fireEvent.keyDown(second, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(second)
    fireEvent.keyDown(second, { key: 'Home' })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: 'End' })
    expect(document.activeElement).toBe(second)
    fireEvent.keyDown(second, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: 'a' })
    expect(document.activeElement).toBe(first)
    const toggle = screen.getByRole('button', { name: '1 branch of Main question' })
    toggle.focus()
    fireEvent.keyDown(toggle, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(toggle)
    const icon = toggle.querySelector('svg')!
    fireEvent.keyDown(icon, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(toggle)
  })
})

describe('branch focus', () => {
  it('summarises a focused topic with its conditions beside its branches', () => {
    panel()
    fireEvent.click(screen.getByRole('button', { name: /^Main question/ }))
    expect(screen.getByRole('heading', { name: 'Main question', level: 2 })).toBeDefined()
    const summary = screen.getByRole('complementary', { name: 'Current understanding' })
    expect(within(summary).getByText('A conditional result.')).toBeDefined()
    expect(within(summary).getByText('Only under assumption A.')).toBeDefined()
    expect(within(summary).getByText('Large systems remain open.')).toBeDefined()
    expect(within(summary).getByText('Compare a control.')).toBeDefined()
    expect(within(trail()).getByText('Theory')).toBeDefined()
    expect(within(trail()).getByText('Main question').getAttribute('aria-current')).toBe('location')
    expect(within(screen.getByRole('region', { name: 'Branches of Main question' })).getByRole('button', { name: /^Controlled limit/ })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /^Controlled limit/ }))
    expect(screen.getByRole('heading', { name: 'Controlled limit', level: 2 })).toBeDefined()
    expect(screen.getByText('No branches are recorded under this topic.')).toBeDefined()
    expect(screen.queryByText(/^Role in/)).toBeNull()
    fireEvent.click(within(trail()).getByRole('button', { name: 'Main question' }))
    expect(screen.getByRole('heading', { name: 'Main question', level: 2 })).toBeDefined()
    fireEvent.click(within(trail()).getByRole('button', { name: 'Research map' }))
    expect(screen.getByRole('heading', { name: 'Research programme', level: 2 })).toBeDefined()
  })

  it('opens the page or the full account from the focus summary', () => {
    const { store } = panel()
    fireEvent.click(screen.getByRole('button', { name: /^Main question/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Controlled limit/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Read full account' }))
    expect(store.getSnapshot().location).toEqual({ kind: 'resource', topicId: CHILD, resourceId: NOTE })
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: /Reference paper/ }))
    expect(store.getSnapshot().location).toEqual({ kind: 'resource', topicId: CHILD, resourceId: PDF })
  })

  it('shows recorded relations and contributions and infers none from parenthood', () => {
    const values = resources()
    const alternative = { ...child, parentContribution: { text: 'Tests the same comparison by another route.', relation: 'alternative' as const }, work: { state: 'superseded' as const, label: 'Superseded' } }
    values[workspaceTopicsAddress(WS, { parentId: ROOT })] = live(read(page(alternative)))
    values[workspaceTopicAddress(WS, CHILD)] = live(read(alternative))
    panel(values)
    fireEvent.click(screen.getByRole('button', { name: /^Main question/ }))
    const node = screen.getByRole('button', { name: /^Controlled limit/ })
    expect(within(node).getByText('Alternative route')).toBeDefined()
    expect(node.closest('li')?.getAttribute('data-state')).toBe('superseded')
    fireEvent.click(node)
    expect(screen.getByText('Role in Main question:')).toBeDefined()
    expect(screen.getByText('Tests the same comparison by another route.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Open topic' }))
    expect(screen.getByText('Alternative route')).toBeDefined()
    expect(screen.getByText('Role in Main question:')).toBeDefined()
    fireEvent.click(within(trail()).getByRole('button', { name: 'Main question' }))
    expect(within(section('Branches')).getByText('1')).toBeDefined()
    expect(screen.getByText('Tests the same comparison by another route.')).toBeDefined()
    expect(screen.getAllByText('Alternative route')).toHaveLength(1)
    values[workspaceTopicAddress(WS, ROOT)] = loading
    cleanup()
    const { store } = panel(values)
    act(() => { store.actions.open(WS, { kind: 'topic', topicId: CHILD }, { scrollTop: 0, focusIndex: null }) })
    expect(screen.getByText('Role in the parent topic:')).toBeDefined()
    expect(within(trail()).getByText('Parent topic')).toBeDefined()
  })

  it('offers the other loaded topics at the same level and the complete level when more exist', () => {
    const values = resources()
    const sibling = { ...child, id: 'sibling' as TopicId, title: 'Sibling route' }
    const neighbour = { ...root, id: 'neighbour' as TopicId, title: 'Neighbouring question', childIds: [] }
    values[workspaceTopicsAddress(WS, { parentId: null })] = live(read(page(root, neighbour, { ...neighbour, id: 'elsewhere' as TopicId, title: 'Elsewhere', directionId: 'other' })))
    values[workspaceTopicAddress(WS, ROOT)] = live(read({ ...root, childIds: [CHILD, sibling.id, 'third' as TopicId] }))
    values[workspaceTopicsAddress(WS, { parentId: ROOT })] = live(read({ items: [read(child), read(sibling)], nextCursor: 'more', completeness: 'complete' }))
    const { store } = panel(values)
    fireEvent.click(screen.getByRole('button', { name: /^Main question/ }))
    const roots = screen.getByRole('region', { name: 'Other topics in this direction' })
    expect(within(roots).getByRole('button', { name: /^Neighbouring question/ })).toBeDefined()
    expect(within(roots).queryByText('Elsewhere')).toBeNull()
    expect(screen.getByText('1 branch is not loaded yet.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /^Controlled limit/ }))
    const level = screen.getByRole('region', { name: 'Other branches at this level' })
    fireEvent.click(within(level).getByRole('button', { name: /^Sibling route/ }))
    expect(store.getSnapshot().location).toEqual({ kind: 'map', focusId: 'sibling' })
    act(() => { store.actions.open(WS, { kind: 'map', focusId: CHILD }, { scrollTop: 0, focusIndex: null }) })
    fireEvent.click(screen.getByRole('button', { name: 'Show all at this level' }))
    expect(store.getSnapshot().location).toEqual({ kind: 'map', focusId: ROOT })
  })

  it('focuses a topic read on its own, without loaded neighbours or a known direction', () => {
    const values = resources()
    const orphan = { ...child, id: 'orphan' as TopicId, title: 'Orphan branch', parentId: 'unread-parent' as TopicId }
    const loose = { ...root, id: 'loose' as TopicId, title: 'Loose root', directionId: 'gone', childIds: [CHILD, 'second' as TopicId] }
    values[workspaceTopicAddress(WS, orphan.id)] = live(read(orphan))
    values[workspaceTopicAddress(WS, loose.id)] = live(read(loose))
    values[workspaceTopicsAddress(WS, { parentId: null })] = live(read(page(root, loose)))
    const { store } = panel(values)
    const toggle = screen.getByRole('button', { name: '2 branches of Loose root' })
    expect(within(toggle).getByText('2 branches')).toBeDefined()
    act(() => { store.actions.open(WS, { kind: 'map', focusId: orphan.id }, { scrollTop: 0, focusIndex: null }) })
    expect(screen.queryByRole('region', { name: 'Other branches at this level' })).toBeNull()
    expect(within(trail()).getByRole('button', { name: 'Parent topic' })).toBeDefined()
    act(() => { store.actions.open(WS, { kind: 'map', focusId: loose.id }, { scrollTop: 0, focusIndex: null }) })
    expect(within(trail()).getAllByRole('listitem')).toHaveLength(2)
  })

  it('counts recorded branches that a complete reading lacks, and reads branch failures inline', () => {
    const values = resources()
    values[workspaceTopicAddress(WS, ROOT)] = live(read({ ...root, childIds: [CHILD, 'lost-a' as TopicId, 'lost-b' as TopicId] }))
    const { face, rerender } = panel(values)
    fireEvent.click(screen.getByRole('button', { name: /^Main question/ }))
    expect(screen.getByText('2 recorded branches are not available in this reading.')).toBeDefined()
    values[workspaceTopicsAddress(WS, { parentId: ROOT })] = loading
    act(rerender)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeDefined()
    values[workspaceTopicsAddress(WS, { parentId: ROOT })] = { status: 'failed', value: undefined, failure: failure('not-found') }
    act(rerender)
    expect(screen.getByText('This item is no longer available')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Read again' }))
    values[workspaceTopicAddress(WS, ROOT)] = { status: 'failed', value: undefined, failure: failure('not-found') }
    act(rerender)
    fireEvent.click(screen.getByRole('button', { name: 'Read again' }))
    expect(face.retry).toHaveBeenCalledTimes(2)
  })

  it('describes a missing material and a linked material with no reader', () => {
    const values = resources()
    values[workspaceResourceAddress(WS, NOTE)] = { status: 'failed', value: undefined, failure: failure('not-found') }
    const { face } = panel(values)
    openChild()
    fireEvent.click(screen.getByRole('button', { name: 'Read full account' }))
    expect(screen.getByText('This item is no longer available')).toBeDefined()
    expect(within(trail()).getByText('Material')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Read again' }))
    expect(face.retry).toHaveBeenCalledWith(WS)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: /Reference paper/ }))
    expect(screen.getByText('Content is not available in this reader')).toBeDefined()
    expect(screen.getByText('PDF reader is not connected.')).toBeDefined()
  })
})

describe('topic page', () => {
  it('leads with the qualified answer, then remembers which sections are open across a material visit', () => {
    const { store } = panel()
    openChild()
    expect(screen.getByRole('heading', { name: 'Controlled limit', level: 2 })).toBeDefined()
    const understanding = screen.getByRole('region', { name: 'Current understanding' })
    expect(within(understanding).getByText('The small-system result.')).toBeDefined()
    expect(within(understanding).getByText('This is not a large-system conclusion.')).toBeDefined()
    expect(screen.getByText('A matched comparison is still missing.')).toBeDefined()
    expect(screen.getByText('Finite systems.')).toBeDefined()
    expect(screen.getByText('Read the control.')).toBeDefined()
    expect(screen.queryByText('Compare a control.')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Branches/ })).toBeNull()
    expect(section('Materials').getAttribute('aria-expanded')).toBe('true')
    expect(section('Claims & routes').getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(section('Claims & routes'))
    expect(screen.getByText('No claims or routes are recorded.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Control calculation/ }))
    expect(screen.getByRole('heading', { name: 'Full control' })).toBeDefined()
    expect(screen.getByText('The full argument keeps assumption A.')).toBeDefined()
    expect(within(trail()).getByRole('button', { name: 'Controlled limit' })).toBeDefined()
    expect(within(trail()).getByText('Control calculation').getAttribute('aria-current')).toBe('location')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(store.getSnapshot().location).toEqual({ kind: 'topic', topicId: CHILD })
    expect(section('Claims & routes').getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Show on map' }))
    expect(store.getSnapshot().location).toEqual({ kind: 'map', focusId: CHILD })
  })

  it('mounts closed sections only when opened and reports missing activity honestly', () => {
    const values = resources()
    const reader = vi.fn((address: string) => values[address] ?? none)
    const store = createResearchPanelStore().create()
    const props = {
      t, useWorkspaces: (select: (value: { items: WorkspaceView[] }) => unknown) => select({ items: [{ workspaceId: WS, path: '/r', title: 'W', sessionIds: [], createdAt: '', updatedAt: '' }] }),
      useResource: reader, useStore: bindSnapshotSelector(store), actions: store.actions,
      openSession: vi.fn(), startDraft: vi.fn(), retry: vi.fn(), previewChange: vi.fn(), applyChange: vi.fn(),
    } as ResearchPanelProps
    render(<ResearchPanel {...props} />)
    act(() => { store.actions.open(WS, { kind: 'topic', topicId: CHILD }, { scrollTop: 0, focusIndex: null }) })
    expect(reader).not.toHaveBeenCalledWith(workspaceActivityAddress(WS, CHILD))
    fireEvent.click(section('Activity'))
    expect(screen.getByText('No activity is recorded for this topic.')).toBeDefined()
    fireEvent.click(section('Work & choices'))
    expect(screen.getByText('No active work or pending choice is recorded.')).toBeDefined()
    fireEvent.click(section('Activity'))
    expect(screen.queryByText('No activity is recorded for this topic.')).toBeNull()
    cleanup()
    const quiet = { ...provider, capabilities: { ...provider.capabilities, readActivity: false } }
    values[workspaceTopicAddress(WS, CHILD)] = live({ ...read(child), provider: quiet })
    const second = panel(values)
    act(() => { second.store.actions.open(WS, { kind: 'topic', topicId: CHILD }, { scrollTop: 0, focusIndex: null }) })
    fireEvent.click(section('Activity'))
    expect(screen.getByText('Activity is not provided by this connection.')).toBeDefined()
  })

  it('opens pending choices, claims with their checks, and the contributing topic', () => {
    const values = resources()
    const detailed: Topic = {
      ...child, gap: null, currentAnswer: null,
      workItems: [{
        id: 'run', title: 'Run the control', description: 'Queued.', state: 'waiting-on-run',
        continuation: { label: 'Resume when', text: 'The run finishes.' }, contributingTopicId: 'unread' as TopicId, attribution,
      }, {
        id: 'choice', title: 'Choose a route', description: 'Two routes remain.', state: 'active',
        options: [{ id: 'a', label: 'Route A' }], contributingTopicId: ROOT, attribution,
      }],
      statements: [{
        id: 's', kind: 'claim', title: 'Bounded claim', text: 'Holds at small size.', qualification: 'Only at small size.', origin: 'imported', assessment: 'checked',
        disposition: 'retained', checks: [{ kind: 'numerical', scope: 'Control grid', outcome: 'passed', resourceIds: [NOTE, 'gone' as ResourceId] }], attribution,
      }, {
        id: 'u', kind: 'question', title: 'Open question', text: 'Does it extend?', qualification: '', origin: 'unknown', assessment: 'unchecked', checks: [], attribution,
      }],
    }
    values[workspaceTopicAddress(WS, CHILD)] = live(read(detailed))
    const { store } = panel(values)
    act(() => { store.actions.open(WS, { kind: 'topic', topicId: CHILD }, { scrollTop: 0, focusIndex: null }) })
    expect(screen.getByText('No current answer recorded')).toBeDefined()
    expect(screen.getByText('No gap recorded')).toBeDefined()
    expect(section('Work & choices').getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Route A')).toBeDefined()
    expect(screen.getByText('The run finishes.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Open the contributing topic' })).toBeDefined()
    fireEvent.click(section('Claims & routes'))
    expect(screen.getByText('Checked within the stated scope')).toBeDefined()
    expect(screen.getByText('Retained')).toBeDefined()
    expect(screen.getByText('Only at small size.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'gone' }))
    expect(store.getSnapshot().location).toEqual({ kind: 'resource', topicId: CHILD, resourceId: 'gone' })
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: 'Update understanding' }))
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Answer' }).value).toBe('')
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Conditions and limitations' }).value).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Contributing topic: Main question' }))
    expect(store.getSnapshot().location).toEqual({ kind: 'topic', topicId: ROOT })
  })

  it('lists recorded activity with its Sessions, partial notice and next page', () => {
    const values = resources()
    const actor = { id: 'user', kind: 'researcher', label: 'Researcher' } as const
    values[workspaceActivityAddress(WS, CHILD)] = { status: 'failed', failure: failure('not-connected'), value: read({
      items: [
        { kind: 'change', changeId: 'c1', topicId: CHILD, summary: 'Scope narrowed', recordedAt: '2026-10-23T10:00:00Z', actor },
        { kind: 'session', sessionId: 's1', topicId: CHILD, title: 'Control run', lastActiveAt: '2026-10-23T11:00:00Z' },
        { kind: 'proposal', previewId: 'p1', topicId: CHILD, summary: 'Proposed answer', recordedAt: '2026-10-23T12:00:00Z', actor },
      ],
      completeness: 'partial', nextCursor: 'later',
    }) }
    values[workspaceActivityAddress(WS, CHILD, 'later')] = live(read({ items: [], completeness: 'partial', incompleteReason: 'Older activity is archived.', nextCursor: null }))
    const { store, face } = panel(values)
    act(() => { store.actions.open(WS, { kind: 'topic', topicId: CHILD }, { scrollTop: 0, focusIndex: null }) })
    fireEvent.click(section('Activity'))
    expect(screen.getByText('Scope narrowed')).toBeDefined()
    expect(screen.getByText('Proposed answer')).toBeDefined()
    expect(screen.getByText('Only part of this list is available.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Control run' }))
    expect(face.openSession).toHaveBeenCalledWith('s1')
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(screen.getByText('Older activity is archived.')).toBeDefined()
  })

  it('offers a retry for the topic, its branch list and its activity when each read fails', () => {
    const values = resources()
    values[workspaceTopicsAddress(WS, { parentId: ROOT })] = { status: 'failed', value: undefined, failure: failure('not-connected') }
    values[workspaceActivityAddress(WS, ROOT)] = { status: 'failed', value: undefined, failure: failure('not-connected') }
    const { store, face, rerender } = panel(values)
    act(() => { store.actions.open(WS, { kind: 'topic', topicId: ROOT }, { scrollTop: 0, focusIndex: null }) })
    const branches = section('Branches').closest('section')!
    fireEvent.click(within(branches).getByRole('button', { name: 'Read again' }))
    fireEvent.click(section('Activity'))
    const activity = section('Activity').closest('section')!
    fireEvent.click(within(activity).getByRole('button', { name: 'Read again' }))
    values[workspaceTopicAddress(WS, ROOT)] = { status: 'failed', value: undefined, failure: failure('not-connected') }
    act(rerender)
    fireEvent.click(screen.getByRole('button', { name: 'Read again' }))
    expect(face.retry).toHaveBeenCalledTimes(3)
  })

  it('lists branches with their recorded role and counts those not yet read', () => {
    const values = resources()
    values[workspaceTopicAddress(WS, ROOT)] = live(read({ ...root, childIds: [CHILD, 'later' as TopicId, 'lost' as TopicId] }))
    values[workspaceTopicsAddress(WS, { parentId: ROOT })] = live(read({ items: [read(child)], nextCursor: 'more', completeness: 'complete' }))
    values[workspaceTopicsAddress(WS, { parentId: ROOT, cursor: 'more' })] = live(read(page({ ...child, id: 'later' as TopicId, title: 'Later branch' })))
    const { store, rerender } = panel(values)
    act(() => { store.actions.open(WS, { kind: 'topic', topicId: ROOT }, { scrollTop: 0, focusIndex: null }) })
    expect(screen.getByText('2 branches are not loaded yet.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Load more branches' }))
    expect(screen.getByRole('button', { name: /^Later branch/ })).toBeDefined()
    expect(screen.getByText('1 recorded branch is not available in this reading.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /^Later branch/ }))
    expect(store.getSnapshot().location).toEqual({ kind: 'topic', topicId: 'later' })
    act(() => { store.actions.goBack(WS) })
    expect(screen.getByRole('button', { name: /^Later branch/ })).toBeDefined()
    values[workspaceTopicsAddress(WS, { parentId: ROOT })] = { status: 'failed', value: undefined, failure: failure('not-connected') }
    act(rerender)
    expect(within(screen.getByRole('button', { name: /^Branches/ }).closest('section')!).getByText('Research workspace is not connected')).toBeDefined()
  })
})

describe('workspace reading states', () => {
  it('shows loading, no connection and no Workspace without inventing topics', () => {
    panel({})
    expect(screen.getByText('Research workspace is not connected')).toBeDefined()
    cleanup()
    panel({ [workspaceProjectAddress(WS)]: loading })
    expect(screen.getByRole('status', { name: 'Loading' })).toBeDefined()
    cleanup()
    panel({}, {}, [])
    expect(screen.getByText('No Workspace yet')).toBeDefined()
  })

  it.each([
    ['not-connected', 'Research workspace is not connected', 'Connect a research data provider to browse topics and materials here.'],
    ['not-found', 'This item is no longer available', 'It may have been moved or removed. Return to its topic or read again.'],
    ['unsupported', 'This view is not supported by this connection', 'The connected provider does not offer this kind of reading yet.'],
    ['permission-denied', 'Access to this content is denied', 'The current connection does not have permission to read this item.'],
  ] as const)('localizes a typed %s read failure instead of showing transport text', (code, title, body) => {
    panel({ [workspaceProjectAddress(WS)]: {
      status: 'failed', value: undefined,
      failure: new RemoteError('aitp/workspace', 'Internal transport diagnostic.', { code, message: 'Internal transport diagnostic.', retryable: false }),
    } })
    expect(screen.getByText(title)).toBeDefined()
    expect(screen.getByText(body)).toBeDefined()
    expect(screen.queryByText('Internal transport diagnostic.')).toBeNull()
  })

  it('reports a failure outside the workspace protocol as an unavailable read', () => {
    panel({ [workspaceProjectAddress(WS)]: { status: 'failed', value: undefined, failure: new RemoteError('gateway/internal', 'Gateway failed.', {}) } })
    expect(screen.getByText('This content is unavailable')).toBeDefined()
    expect(screen.queryByText('Gateway failed.')).toBeNull()
  })

  it('reads the project again from its unavailable state and switches between Workspaces', () => {
    const second: WorkspaceView = { workspaceId: 'w2' as WorkspaceId, path: '/scratch/other', title: 'Other Workspace', sessionIds: [], createdAt: '', updatedAt: '' }
    const first: WorkspaceView = { workspaceId: WS, path: '/scratch/research', title: 'Workspace', sessionIds: [], createdAt: '', updatedAt: '' }
    const { store, face } = panel({ [workspaceProjectAddress(WS)]: { status: 'failed', value: undefined, failure: failure('not-connected') } }, {}, [first, second])
    fireEvent.click(screen.getByRole('button', { name: 'Read again' }))
    expect(face.retry).toHaveBeenCalledWith(WS)
    fireEvent.click(screen.getByRole('button', { name: 'Choose a Workspace' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Other Workspace' }))
    expect(store.getSnapshot().workspaceId).toBe('w2')
    fireEvent.click(screen.getByRole('button', { name: 'Choose a Workspace' }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose a Workspace' }))
    expect(screen.queryByRole('menuitem', { name: 'Other Workspace' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Choose a Workspace' }))
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menuitem', { name: 'Other Workspace' })).toBeNull()
  })

  it('keeps the old observation beside a refresh failure and offers a retry', () => {
    const values = resources()
    values[workspaceProjectAddress(WS)] = { status: 'failed', value: read(project), failure: new RemoteError('aitp/workspace', 'Connection lost.', { code: 'not-connected', message: 'Connection lost.', retryable: true }) }
    const { face } = panel(values)
    expect(screen.getByText(/Showing the last reading/)).toBeDefined()
    expect(screen.getByText(/^Read /, { selector: 'p' })).toBeDefined()
    expect(screen.queryByText(/revision r1/)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Research programme' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Read again' }))
    expect(face.retry).toHaveBeenCalledWith(WS)
  })

  it('labels only fixture readings, and reads a material that belongs to no topic', () => {
    const values = resources()
    const real = <T,>(value: T): ResourceSnapshot<WorkspaceRead<T>> => live({ ...read(value), origin: 'runtime' })
    values[workspaceProjectAddress(WS)] = real(project)
    values[workspaceResourceAddress(WS, NOTE)] = real<Resource>({
      ...note, ownerTopicId: null, target: { kind: 'unavailable', reason: 'Not linked to a file.' }, content: { kind: 'plain-text', text: 'Plain record.' },
    })
    const { store } = panel(values)
    expect(screen.queryByText('Demo workspace')).toBeNull()
    act(() => { store.actions.open(WS, { kind: 'resource', topicId: null, resourceId: NOTE }, { scrollTop: 0, focusIndex: null }) })
    expect(screen.getByText('Plain record.')).toBeDefined()
    expect(within(trail()).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Source location: Not linked to a file.')).toBeDefined()
  })
})

const preview: ChangePreview = {
  previewId: 'preview-1', summary: 'Update scope', bases: [{ target: { kind: 'topic', id: CHILD }, revision: REVISION }],
  edits: [{ target: { kind: 'topic', id: CHILD }, label: 'Scope', before: 'Finite systems.', after: 'Matched finite systems.' }], pendingIntegration: [],
}

describe('workspace edit feedback', () => {
  it('previews the revision-bound intent before applying, then labels the fixture acknowledgement', async () => {
    const previewChange = vi.fn<ResearchPanelFace['previewChange']>(async () => ({ ok: true, value: read(preview) }))
    const applyChange = vi.fn<ResearchPanelFace['applyChange']>(async (_workspaceId, request) => ({ ok: true, value: read({ operationId: request.operationId, changeId: 'change', committedAt: '', actor: { id: 'user', kind: 'researcher', label: 'Researcher' }, changed: [] }) }))
    const { face } = panel(resources(), { previewChange, applyChange })
    openChild()
    fireEvent.click(screen.getByRole('button', { name: 'Edit scope' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Scope' }), { target: { value: 'Matched finite systems.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    await screen.findByText('Proposed version')
    expect(previewChange).toHaveBeenCalledWith(WS, { topicId: CHILD, expectedRevision: REVISION, command: { kind: 'update-scope', scope: 'Matched finite systems.' } })
    expect(applyChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Apply change' }))
    await screen.findByText('Change applied to demo data. Research files are unchanged.')
    expect(applyChange.mock.calls[0]?.[0]).toBe(WS)
    expect(applyChange.mock.calls[0]?.[1].previewId).toBe('preview-1')
    expect(typeof applyChange.mock.calls[0]?.[1].operationId).toBe('string')
    expect(face.retry).toHaveBeenCalledWith(WS)
  })

  it('keeps the answer and its limits together in the requested change', async () => {
    const previewChange = vi.fn<ResearchPanelFace['previewChange']>(async () => ({ ok: true, value: read(preview) }))
    panel(resources(), { previewChange })
    openChild()
    fireEvent.click(screen.getByRole('button', { name: 'Update understanding' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Answer' }), { target: { value: 'Updated answer.' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Conditions and limitations' }), { target: { value: 'Only at fixed size.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    await screen.findByText('Proposed version')
    expect(previewChange).toHaveBeenCalledWith(WS, expect.objectContaining({ command: { kind: 'record-answer', text: 'Updated answer.', qualification: 'Only at fixed size.', sourceResourceIds: [] } }))
  })

  it('retains a conflicting draft and prepares it against the newly read revision', async () => {
    const previewChange = vi.fn<ResearchPanelFace['previewChange']>().mockResolvedValueOnce({ ok: false, error: { code: 'revision-conflict', message: 'Changed elsewhere.', current: [] } }).mockResolvedValue({ ok: true, value: read(preview) })
    const values = resources()
    const { rerender } = panel(values, { previewChange })
    openChild()
    fireEvent.click(screen.getByRole('button', { name: 'Edit scope' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Scope' }), { target: { value: 'My retained draft.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    await screen.findByRole('alert')
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Scope' }).value).toBe('My retained draft.')
    values[workspaceTopicAddress(WS, CHILD)] = live({ ...read({ ...child, scope: 'New external scope.' }), revision: 'r2' as Revision })
    act(rerender)
    expect(within(screen.getByRole('alert')).getByText('New external scope.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Use this version as the draft base' }))
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    await screen.findByText('Proposed version')
    expect(previewChange).toHaveBeenLastCalledWith(WS, expect.objectContaining({ expectedRevision: 'r2' }))
  })

  it('keeps the original base when an external update arrives while editing', async () => {
    const previewChange = vi.fn<ResearchPanelFace['previewChange']>(async () => ({ ok: false, error: { code: 'revision-conflict', message: 'External change.', current: [] } }))
    const values = resources()
    const { rerender } = panel(values, { previewChange })
    openChild()
    fireEvent.click(screen.getByRole('button', { name: 'Edit scope' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Scope' }), { target: { value: 'My older draft.' } })
    values[workspaceTopicAddress(WS, CHILD)] = live({ ...read({ ...child, scope: 'External replacement.' }), revision: 'r2' as Revision })
    act(rerender)
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    await screen.findByRole('alert')
    expect(previewChange).toHaveBeenCalledWith(WS, expect.objectContaining({ expectedRevision: 'r1', command: { kind: 'update-scope', scope: 'My older draft.' } }))
    expect(screen.getByRole('button', { name: 'Use this version as the draft base' })).toBeDefined()
  })

  it('reuses the same operation after an unknown acknowledgement, without changing the draft', async () => {
    const previewChange = vi.fn<ResearchPanelFace['previewChange']>(async () => ({ ok: true, value: read(preview) }))
    const applyChange = vi.fn<ResearchPanelFace['applyChange']>(async (_workspaceId, request) => ({ ok: false, error: { code: 'outcome-unknown', message: 'Receipt lost.', operationId: request.operationId } }))
    panel(resources(), { previewChange, applyChange })
    openChild()
    fireEvent.click(screen.getByRole('button', { name: 'Edit scope' }))
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    await screen.findByText('Proposed version')
    fireEvent.click(screen.getByRole('button', { name: 'Apply change' }))
    await screen.findByRole('alert')
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Scope' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Retry the same operation' }))
    await waitFor(() => { expect(applyChange).toHaveBeenCalledTimes(2) })
    expect(applyChange.mock.calls[1]).toEqual(applyChange.mock.calls[0])
  })

  it('retains a submitted change before awaiting, and recovers a late unknown result after leaving the panel', async () => {
    let finish = (_result: Result<ReadEnvelope<ApplyReceipt>>): void => { throw new Error('No request was submitted') }
    const previewChange = vi.fn<ResearchPanelFace['previewChange']>(async () => ({ ok: true, value: read(preview) }))
    const applyChange = vi.fn<ResearchPanelFace['applyChange']>()
      .mockImplementationOnce(async () => new Promise((resolve) => { finish = resolve }))
      .mockImplementation(async (_workspaceId, request) => ({ ok: true, value: read({ operationId: request.operationId, changeId: 'recovered', committedAt: '', actor: { id: 'user', kind: 'researcher', label: 'Researcher' }, changed: [] }) }))
    const values = resources()
    const { store, leavePanel, returnToPanel } = panel(values, { previewChange, applyChange })
    openChild()
    fireEvent.click(screen.getByRole('button', { name: 'Edit scope' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Scope' }), { target: { value: 'Retained submitted scope.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    await screen.findByText('Proposed version')
    fireEvent.click(screen.getByRole('button', { name: 'Apply change' }))
    const original = applyChange.mock.calls[0]!
    expect(store.getSnapshot().pendingEdits[workspaceEditKey(WS, CHILD)]).toMatchObject({
      pending: 'apply', text: 'Retained submitted scope.', prepared: { operationId: original[1].operationId },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close for now' }))
    leavePanel()
    await act(async () => { finish({ ok: false, error: { code: 'outcome-unknown', message: 'Late lost receipt.', operationId: original[1].operationId } }) })
    // Recovery remains available even when navigation has released the old topic reading.
    values[workspaceTopicAddress(WS, CHILD)] = none
    returnToPanel()
    expect(screen.getByText(/original request is retained for recovery/)).toBeDefined()
    expect(screen.getByText('Research workspace is not connected')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Resume original change' }))
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Scope' }).value).toBe('Retained submitted scope.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry the same operation' }))
    await screen.findByText('Change applied to demo data. Research files are unchanged.')
    expect(applyChange.mock.calls[1]).toEqual(original)
    expect(previewChange).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot().pendingEdits[workspaceEditKey(WS, CHILD)]?.uncertain).toBe(false)
  })

  it('preserves uncertainty after a disconnected retry and after topic navigation', async () => {
    const previewChange = vi.fn<ResearchPanelFace['previewChange']>(async () => ({ ok: true, value: read(preview) }))
    const applyChange = vi.fn<ResearchPanelFace['applyChange']>()
      .mockImplementationOnce(async (_workspaceId, request) => ({ ok: false, error: { code: 'outcome-unknown', message: 'Receipt lost.', operationId: request.operationId } }))
      .mockResolvedValueOnce({ ok: false, error: { code: 'not-connected', message: 'Still disconnected.', retryable: true } })
      .mockImplementation(async (_workspaceId, request) => ({ ok: true, value: read({ operationId: request.operationId, changeId: 'recovered', committedAt: '', actor: { id: 'user', kind: 'researcher', label: 'Researcher' }, changed: [] }) }))
    const { store } = panel(resources(), { previewChange, applyChange })
    openChild()
    fireEvent.click(screen.getByRole('button', { name: 'Edit scope' }))
    fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
    await screen.findByText('Proposed version')
    fireEvent.click(screen.getByRole('button', { name: 'Apply change' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Retry the same operation' }))
    await screen.findByText('Still disconnected.')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Preview change' }).disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Update understanding' }).disabled).toBe(true)
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Scope' }).disabled).toBe(true)
    expect(store.getSnapshot().pendingEdits[workspaceEditKey(WS, CHILD)]?.uncertain).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Research map' }))
    openChild()
    expect(screen.getByText(/original request is retained for recovery/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Retry the same operation' }))
    await screen.findByText('Change applied to demo data. Research files are unchanged.')
    expect(applyChange.mock.calls[1]).toEqual(applyChange.mock.calls[0])
    expect(applyChange.mock.calls[2]).toEqual(applyChange.mock.calls[0])
    expect(previewChange).toHaveBeenCalledTimes(1)
  })

  it('disables editing when the provider does not advertise changes', () => {
    const values = resources()
    values[workspaceTopicAddress(WS, CHILD)] = live({
      ...read(child), provider: { ...provider, capabilities: { ...provider.capabilities, previewChanges: false } },
    })
    panel(values)
    openChild()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Edit scope' }).disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Update understanding' }).disabled).toBe(true)
  })
})

it.each(['map summary', 'topic page'] as const)('asks from the recorded child account owner when opened from its parent %s, then returns to the parent', async (from) => {
  const askQuestion = vi.fn<NonNullable<ResearchPanelFace['askQuestion']>>(async () => ({ ok: true, value: { sessionId: 'child-account-question' as SessionId } }))
  const values = resources()
  const parent = { ...root, resources: [child.resources[0]!] }
  values[workspaceTopicsAddress(WS, { parentId: null })] = live(read(page(parent)))
  values[workspaceTopicAddress(WS, ROOT)] = live(read(parent))
  const { store, face } = panel(values, { askQuestion })
  fireEvent.click(screen.getByRole('button', { name: /^Main question/ }))
  if (from === 'topic page') fireEvent.click(screen.getByRole('button', { name: 'Open topic' }))
  fireEvent.click(screen.getByRole('button', { name: /Control calculation/ }))
  expect(screen.getByRole('heading', { name: 'Full control' })).toBeDefined()
  const input = screen.getByRole('textbox', { name: 'Ask about this research' })
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'What does this account establish?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask in a new conversation' }))
  await waitFor(() => { expect(face.openSession).toHaveBeenCalledWith('child-account-question') })
  expect(askQuestion).toHaveBeenCalledExactlyOnceWith({ workspaceId: WS, topicId: CHILD, resourceId: NOTE,
    question: 'What does this account establish?' })
  expect(store.getSnapshot().location).toEqual({ kind: 'resource', topicId: CHILD, resourceId: NOTE })
  expect(within(trail()).getByRole('button', { name: 'Controlled limit' })).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(store.getSnapshot().location).toEqual(from === 'topic page' ? { kind: 'topic', topicId: ROOT } : { kind: 'map', focusId: ROOT })
  expect(screen.getByRole('heading', { name: 'Main question', level: 2 })).toBeDefined()
})

it('keeps the selected topic when asking about a shared material, then returns to its topic page', async () => {
  const askQuestion = vi.fn<NonNullable<ResearchPanelFace['askQuestion']>>(async () => ({ ok: true, value: { sessionId: 'shared-material-question' as SessionId } }))
  const values = resources()
  const shared = { ...note, ownerTopicId: null }
  values[workspaceTopicAddress(WS, CHILD)] = live(read({ ...child, resources: [shared] }))
  values[workspaceResourceAddress(WS, NOTE)] = live(read(shared))
  const { store, face } = panel(values, { askQuestion })
  openChild()
  fireEvent.click(screen.getByRole('button', { name: /Control calculation/ }))
  const input = screen.getByRole('textbox', { name: 'Ask about this research' })
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'How does this shared evidence constrain this topic?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask in a new conversation' }))
  await waitFor(() => { expect(face.openSession).toHaveBeenCalledWith('shared-material-question') })
  expect(askQuestion).toHaveBeenCalledExactlyOnceWith({ workspaceId: WS, topicId: CHILD, resourceId: NOTE,
    question: 'How does this shared evidence constrain this topic?' })
  expect(store.getSnapshot().location).toEqual({ kind: 'resource', topicId: CHILD, resourceId: NOTE })
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(store.getSnapshot().location).toEqual({ kind: 'topic', topicId: CHILD })
  expect(screen.getByRole('heading', { name: 'Controlled limit', level: 2 })).toBeDefined()
})

it('submits a human question with its material and topic only after explicit submission', async () => {
  const askQuestion = vi.fn<NonNullable<ResearchPanelFace['askQuestion']>>(async () => ({ ok: true, value: { sessionId: 'new-research-session' as never } }))
  const { face } = panel(resources(), { askQuestion })
  openChild()
  fireEvent.click(screen.getByRole('button', { name: /Control calculation/ }))
  expect(askQuestion).not.toHaveBeenCalled()
  const source = screen.getByText('The full argument keeps assumption A.')
  const range = document.createRange()
  range.selectNodeContents(source)
  const selection = document.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  const input = screen.getByRole('textbox', { name: 'Ask about this research' })
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: '这个限制为什么还不能取消？' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask in a new conversation' }))
  await waitFor(() => { expect(face.openSession).toHaveBeenCalledWith('new-research-session') })
  expect(askQuestion).toHaveBeenCalledExactlyOnceWith({ workspaceId: WS, topicId: CHILD, resourceId: NOTE,
    selectedText: 'The full argument keeps assumption A.', selectedTextFormat: 'rendered', question: '这个限制为什么还不能取消？' })
  selection.removeAllRanges()
})

it('keeps the browser-rendered quote across bold, link and inline-code elements', async () => {
  const askQuestion = vi.fn<NonNullable<ResearchPanelFace['askQuestion']>>(async () => ({ ok: true, value: { sessionId: 'formatted-question' as never } }))
  const values = resources()
  values[workspaceResourceAddress(WS, NOTE)] = live(read({ ...note,
    content: { kind: 'markdown', text: '# Full control\n\nThe **finite result** uses [a control](https://example.test/control) at `N=8`.' },
  }))
  panel(values, { askQuestion })
  openChild()
  fireEvent.click(screen.getByRole('button', { name: /Control calculation/ }))
  const paragraph = screen.getByText('finite result').closest('p')!
  const range = document.createRange()
  range.selectNodeContents(paragraph)
  const selection = document.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  const quote = selection.toString()
  expect(quote).toBe('The finite result uses a control at N=8.')
  const input = screen.getByRole('textbox', { name: 'Ask about this research' })
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'What remains untested?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask in a new conversation' }))
  await waitFor(() => { expect(askQuestion).toHaveBeenCalledExactlyOnceWith({ workspaceId: WS, topicId: CHILD, resourceId: NOTE,
    selectedText: quote, selectedTextFormat: 'rendered', question: 'What remains untested?' }) })
  selection.removeAllRanges()
})

it('uses the selected nested branch owner instead of the currently focused parent', async () => {
  const askQuestion = vi.fn<NonNullable<ResearchPanelFace['askQuestion']>>(async () => ({ ok: true, value: { sessionId: 'branch-question' as never } }))
  panel(resources(), { askQuestion })
  fireEvent.click(screen.getByRole('button', { name: /^Main question/ }))
  const branch = screen.getByRole('button', { name: /^Controlled limit/ }).querySelector('[data-research-source]')!
  const range = document.createRange()
  range.selectNodeContents(branch)
  const selection = document.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  const input = screen.getByRole('textbox', { name: 'Ask about this research' })
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'What does this branch settle?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask in a new conversation' }))
  await waitFor(() => { expect(askQuestion).toHaveBeenCalledExactlyOnceWith({ workspaceId: WS, topicId: CHILD,
    selectedText: 'Controlled limit', selectedTextFormat: 'rendered', question: 'What does this branch settle?' }) })
  selection.removeAllRanges()
})

it('binds a root summary selection to its provider-recorded account', async () => {
  const askQuestion = vi.fn<NonNullable<ResearchPanelFace['askQuestion']>>(async () => ({ ok: true, value: { sessionId: 'project-question' as never } }))
  const values = resources()
  values[workspaceProjectAddress(WS)] = live(read({ ...project, summary: 'The project question.', accountResourceId: NOTE }))
  panel(values, { askQuestion })
  const range = document.createRange()
  range.selectNodeContents(screen.getByText('The project question.'))
  const selection = document.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  const input = screen.getByRole('textbox', { name: 'Ask about this research' })
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'How do the branches contribute?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask in a new conversation' }))
  await waitFor(() => { expect(askQuestion).toHaveBeenCalledExactlyOnceWith({ workspaceId: WS, resourceId: NOTE,
    selectedText: 'The project question.', selectedTextFormat: 'source', question: 'How do the branches contribute?' }) })
  selection.removeAllRanges()
})

it('retains an unsupported mathematical selection visibly and requires clearing or reselecting it', () => {
  const askQuestion = vi.fn<NonNullable<ResearchPanelFace['askQuestion']>>()
  const values = resources()
  values[workspaceResourceAddress(WS, NOTE)] = live(read({ ...note, content: { kind: 'markdown', text: '# Full control\n\nThe formula is $x^2$.' } }))
  panel(values, { askQuestion })
  openChild()
  fireEvent.click(screen.getByRole('button', { name: /Control calculation/ }))
  const formula = document.querySelector('.katex')!
  expect(formula).not.toBeNull()
  const range = document.createRange()
  range.selectNodeContents(formula)
  const selection = document.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  const input = screen.getByRole('textbox', { name: 'Ask about this research' })
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'What is assumed here?' } })
  expect(screen.getByRole('alert').textContent).toBe(t('workspace.ask.unsupportedSelection'))
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Ask in a new conversation' }).disabled).toBe(true)
  expect(askQuestion).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Ask in a new conversation' }).disabled).toBe(false)
})

it('retains the question and shows a failed submission without opening a conversation', async () => {
  const askQuestion = vi.fn<NonNullable<ResearchPanelFace['askQuestion']>>(async () => ({ ok: false, error: { code: 'not-connected', message: 'Research host disconnected.', retryable: true } }))
  const { face } = panel(resources(), { askQuestion })
  const input = screen.getByRole('textbox', { name: 'Ask about this research' })
  fireEvent.change(input, { target: { value: '先保留这个问题。' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask in a new conversation' }))
  await waitFor(() => { expect(screen.getByRole('alert').textContent).toContain('Research host disconnected.') })
  expect((input as HTMLTextAreaElement).value).toBe('先保留这个问题。')
  expect(face.openSession).not.toHaveBeenCalled()
})

it('captures a Tab gesture before focus can overtake the queued selection change', () => {
  const added = vi.spyOn(document, 'addEventListener')
  const removed = vi.spyOn(document, 'removeEventListener')
  try {
    const askQuestion = vi.fn<NonNullable<ResearchPanelFace['askQuestion']>>()
    const { leavePanel } = panel(resources(), { askQuestion })
    openChild()
    fireEvent.click(screen.getByRole('button', { name: /Control calculation/ }))
    const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask about this research' })
    const selection = document.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(screen.getByText('The full argument keeps assumption A.'))
    selection.removeAllRanges()
    selection.addRange(range)
    // The browser has not delivered selectionchange when Tab starts its default focus move.
    fireEvent.keyDown(document, { key: 'Tab' })
    selection.removeAllRanges()
    act(() => { input.focus() })
    expect(screen.getByText('Selected passage')).toBeDefined()
    expect(screen.getByRole('blockquote').textContent).toBe('The full argument keeps assumption A.')
    const listener = added.mock.calls.filter(([type, , options]) => type === 'keydown' && options === true).at(-1)?.[1]
    expect(listener).toBeDefined()
    leavePanel()
    expect(removed).toHaveBeenCalledWith('keydown', listener, true)
    expect(askQuestion).not.toHaveBeenCalled()
  } finally { added.mockRestore(); removed.mockRestore() }
})

it('retains a source gesture across native focus, clears stale candidates and releases the browser listener', () => {
  const added = vi.spyOn(document, 'addEventListener')
  const removed = vi.spyOn(document, 'removeEventListener')
  try {
    const askQuestion = vi.fn<NonNullable<ResearchPanelFace['askQuestion']>>()
    const { leavePanel } = panel(resources(), { askQuestion })
    openChild()
    fireEvent.click(screen.getByRole('button', { name: /Control calculation/ }))
    const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask about this research' })
    const selection = document.getSelection()!
    const selectSource = (): void => {
      const range = document.createRange()
      range.selectNodeContents(screen.getByText('The full argument keeps assumption A.'))
      selection.removeAllRanges()
      selection.addRange(range)
      fireEvent(document, new Event('selectionchange'))
    }
    selectSource()
    selection.removeAllRanges()
    act(() => { input.focus() })
    expect(screen.getByText('Selected passage')).toBeDefined()
    expect(screen.getByRole('blockquote').textContent).toBe('The full argument keeps assumption A.')
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    act(() => { input.blur(); input.focus() })
    expect(screen.queryByText('Selected passage')).toBeNull()

    act(() => { input.blur() })
    selectSource()
    selection.removeAllRanges()
    fireEvent(document, new Event('selectionchange'))
    act(() => { input.focus() })
    expect(screen.queryByText('Selected passage')).toBeNull()

    act(() => { input.blur() })
    selectSource()
    selection.removeAllRanges()
    act(() => { input.focus() })
    expect(screen.getByText('Selected passage')).toBeDefined()
    fireEvent.click(within(trail()).getByRole('button', { name: 'Back' }))
    act(() => { screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask about this research' }).focus() })
    expect(screen.queryByText('Selected passage')).toBeNull()
    const listener = added.mock.calls.filter(([type]) => type === 'selectionchange').at(-1)?.[1]
    expect(listener).toBeDefined()
    leavePanel()
    expect(removed).toHaveBeenCalledWith('selectionchange', listener)
    expect(askQuestion).not.toHaveBeenCalled()
  } finally { added.mockRestore(); removed.mockRestore() }
})

it.each(['overview', 'focus', 'topic'] as const)('submits from the %s with its current research origin', async (view) => {
  const askQuestion = vi.fn<NonNullable<ResearchPanelFace['askQuestion']>>(async () => ({
    ok: true, value: { sessionId: 'scoped-question' as never },
  }))
  const { face } = panel(resources(), { askQuestion })
  if (view !== 'overview') {
    fireEvent.click(screen.getByRole('button', { name: /^Main question/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Controlled limit/ }))
    if (view === 'topic') fireEvent.click(screen.getByRole('button', { name: 'Open topic' }))
  }
  expect(askQuestion).not.toHaveBeenCalled()
  const input = screen.getByRole('textbox', { name: 'Ask about this research' })
  expect(input.getAttribute('placeholder')).toBe('What is still unclear, or what should we investigate next?')
  const question = '  Keep the original question.\nWhat remains unresolved?  '
  fireEvent.change(input, { target: { value: question } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask in a new conversation' }))
  await waitFor(() => { expect(face.openSession).toHaveBeenCalledWith('scoped-question') })
  expect(askQuestion).toHaveBeenCalledExactlyOnceWith({ workspaceId: WS, question,
    ...(view === 'overview' ? {} : { topicId: CHILD }),
  })
})

it('clears attached text, blocks duplicate submissions while pending and retains a failed draft', async () => {
  let complete!: (result: Result<{ readonly sessionId: SessionId }>) => void
  const askQuestion = vi.fn<NonNullable<ResearchPanelFace['askQuestion']>>(() => new Promise((resolve) => { complete = resolve }))
  const { face } = panel(resources(), { askQuestion })
  openChild()
  fireEvent.click(screen.getByRole('button', { name: /Control calculation/ }))
  const range = document.createRange()
  range.selectNodeContents(screen.getByText('The full argument keeps assumption A.'))
  const selection = document.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask about this research' })
  fireEvent.focus(input)
  expect(screen.getByText('Selected passage')).toBeDefined()
  expect(screen.getAllByText('The full argument keeps assumption A.')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
  fireEvent.focus(input)
  expect(screen.queryByText('Selected passage')).toBeNull()
  fireEvent.change(input, { target: { value: 'Explain the whole material instead.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask in a new conversation' }))
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Opening conversation…' }).disabled).toBe(true)
  expect(input.disabled).toBe(true)
  fireEvent.submit(input.form!)
  expect(askQuestion).toHaveBeenCalledExactlyOnceWith({ workspaceId: WS, topicId: CHILD, resourceId: NOTE,
    question: 'Explain the whole material instead.',
  })
  await act(async () => { complete({ ok: false, error: { code: 'unavailable', message: 'Could not open the conversation.', retryable: true } }) })
  expect(screen.getByRole('alert').textContent).toBe('Could not open the conversation.')
  expect(input.value).toBe('Explain the whole material instead.')
  expect(input.disabled).toBe(false)
  expect(face.openSession).not.toHaveBeenCalled()
})

it.each(['different', 'unavailable'] as const)('distinguishes an earlier saved change from a currently %s source', async (state) => {
  const previewChange = vi.fn<ResearchPanelFace['previewChange']>(async () => ({ ok: true, value: read(preview) }))
  const applyChange = vi.fn<ResearchPanelFace['applyChange']>(async (_workspaceId, request) => ({ ok: true,
    value: { ...read({ operationId: request.operationId, changeId: 'change', committedAt: '',
      actor: { id: 'owner', kind: 'researcher' as const, label: 'Researcher' }, changed: [],
      sourceObservations: [{ target: { kind: 'resource' as const, id: NOTE }, state }],
    }), origin: 'runtime' },
  }))
  panel(resources(), { previewChange, applyChange })
  openChild()
  fireEvent.click(screen.getByRole('button', { name: 'Edit scope' }))
  fireEvent.click(screen.getByRole('button', { name: 'Preview change' }))
  await screen.findByText('Proposed version')
  fireEvent.click(screen.getByRole('button', { name: 'Apply change' }))
  const message = t(state === 'different' ? 'workspace.edit.appliedEarlier' : 'workspace.edit.appliedUnavailable')
  expect((await screen.findByRole('status')).textContent).toBe(message)
})

it('keeps a provider observation warning visible with readable source content', () => {
  const values = resources()
  values[workspaceProjectAddress(WS)] = live({ ...read(project), provider: { ...provider, notice: 'Automatic source watching is unavailable; refresh to reread.' } })
  panel(values)
  expect(screen.getByText('Automatic source watching is unavailable; refresh to reread.')).toBeDefined()
  expect(screen.getByRole('heading', { name: 'Research programme' })).toBeDefined()
})
