// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { bindSnapshotSelector, makeTranslate, RemoteError } from '@deepseek-ai/dsh-client-test-runtime'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { DiscussionSessionViews } from '../src/client/discussion-controller.ts'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { ResourceProtocolMap } from '@deepseek-ai/dsh-client-ui-slots'
import { ResearchHome, type ResearchHomeProps } from '../src/client/ResearchHome.tsx'
import { createResearchPanelStore } from '../src/client/store.ts'
import { en } from '../src/client/locales.ts'
import { workspaceSetupAddress } from '../src/client/workspace-resources.ts'

afterEach(cleanup)
const ws = 'home-workspace' as WorkspaceId
const workspace: WorkspaceView = { workspaceId: ws, title: 'A research project', path: '/scratch/project', sessionIds: [], createdAt: '', updatedAt: '' }
function mount(setup: ResourceSnapshot<ResourceProtocolMap['aitp-workspace-setup']>, overrides: Partial<ResearchHomeProps> = {}) {
  const store = createResearchPanelStore().create()
  const showProject = vi.fn(), retry = vi.fn(), reads: string[] = []
  const props = { useStore: bindSnapshotSelector(store), actions: store.actions, t: makeTranslate(en), showProject, retry,
    useDiscussionSessions: selector => selector({}),
    useWorkspaces: selector => selector({ items: [workspace], phase: 'ready', state: 'idle', archivedSessionIds: [], pinnedSessionIds: [], error: null }),
    useResource: (address) => {
      reads.push(address)
      return address === workspaceSetupAddress(ws) ? setup : { status: 'none', value: undefined, failure: undefined }
    }, ...overrides,
  } as ResearchHomeProps
  const view = render(<ResearchHome {...props} />)
  return { view, store, showProject, retry, reads }
}
it('offers explicit workspace navigation without reading an unenrolled project or creating a Session', () => {
  const fixture = mount({ status: 'live', value: { configured: false, writable: false, canInitialize: true }, failure: undefined })
  expect(fixture.reads).toEqual([workspaceSetupAddress(ws)])
  expect(screen.queryByRole('button', { name: 'A research project' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Browse projects' }))
  expect(fixture.showProject).toHaveBeenCalledWith(ws)
  expect(fixture.store.getSnapshot().workspaceId).toBe(ws)
})
it('keeps a project connection failure visible with a working retry', () => {
  const failure = new RemoteError('aitp/workspace', 'Connection failed', { code: 'not-connected', message: 'Connection failed', retryable: true })
  const fixture = mount({ status: 'failed', value: undefined, failure })
  expect(screen.getByRole('status').textContent).toContain('Project connection could not be checked')
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(fixture.retry).toHaveBeenCalledWith(ws)
})

it('shows the addressed scoped draft without depending on the currently selected reading discussion', () => {
  const sessionId = brandString<SessionId>('scoped-home-draft')
  const sessions: DiscussionSessionViews = {
    [sessionId]: { scope: { workspaceId: ws, topicId: 'partition', title: 'Response partition' },
      origin: { workspaceId: ws, topicId: 'partition' }, canReturn: false },
    another: { scope: { workspaceId: ws, topicId: 'partition', title: 'Another discussion' },
      origin: { workspaceId: ws, topicId: 'partition' }, canReturn: false },
  }
  const fixture = mount({ status: 'none', value: undefined, failure: undefined }, {
    sessionId, useDiscussionSessions: selector => selector(sessions),
  })
  expect(screen.getByRole('heading', { name: 'Response partition' })).toBeTruthy()
  expect(screen.queryByText(en['home.chatHint'])).toBeNull()
  expect(fixture.reads).toEqual([])
})
