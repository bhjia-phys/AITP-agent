// @vitest-environment jsdom
import type { ComponentProps } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { bindSnapshotSelector, makeTranslate, RemoteError, sessionSnapshot, workspaceSnapshot } from '@deepseek-ai/dsh-client-test-runtime'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ResourceSnapshot } from '@deepseek-ai/dsh-client-resources/client'
import type { ResearchProvider, SessionMemoryView } from '../src/client/workspace-contract.ts'
import { ResearchWorkflowChoiceControl, ResearchWorkflowControl } from '../src/client/ResearchWorkflow.tsx'
import { createWorkflowStore } from '../src/client/workflow-store.ts'
import { workspaceProviderAddress } from '../src/client/workspace-resources.ts'
import { en } from '../src/client/locales.ts'

afterEach(() => { cleanup(); localStorage.removeItem('aitp.research.workflow.v1') })
const sessionId = 'choice-session' as SessionId
const workspaceId = 'choice-workspace' as WorkspaceId
const workspace: WorkspaceView = { workspaceId, title: 'Current work', path: '/project', sessionIds: [sessionId], createdAt: '', updatedAt: '' }
const provider: ResearchProvider = { id: 'actual', origin: 'runtime', capabilities: {
  automaticResearch: true, read: false, readContext: false, readActivity: false, previewChanges: false,
  applyChanges: false, changeEvents: false, commands: [],
} }

it('uses the actual Session workspace and never offers Research from stale or disabled provider capabilities', () => {
  const store = createWorkflowStore().create()
  let observation: ResourceSnapshot<ResearchProvider> = { status: 'live', value: provider, failure: undefined }
  const reads: string[] = []
  const props = { sessionId, t: makeTranslate(en), useStore: bindSnapshotSelector(store), actions: store.actions,
    useSession: selector => selector({ ...sessionSnapshot(sessionId), blank: true }),
    useSessions: selector => selector({ ids: [sessionId], phase: 'ready', projectionsBySession: {}, byId: {
      [sessionId]: { id: sessionId, displayTitle: 'New draft', running: false, retainedBy: {},
        blank: true, updatedAt: 0, cwd: '/different-directory' },
    } }),
    useWorkspaces: selector => selector({ ...workspaceSnapshot(), items: [
      { ...workspace, workspaceId: 'other-workspace' as WorkspaceId, path: '/different-directory', sessionIds: [] }, workspace,
    ] }),
    useResource: (address) => { reads.push(address); return observation },
  } as ComponentProps<typeof ResearchWorkflowChoiceControl>
  const view = render(<ResearchWorkflowChoiceControl {...props} />)
  let checkbox = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Research' })
  expect(checkbox.checked).toBe(true)
  expect(checkbox.disabled).toBe(false)
  expect(reads.every(address => address === workspaceProviderAddress(workspaceId))).toBe(true)
  act(() => { store.actions.choose('another-draft' as SessionId, false) })
  expect(checkbox.checked).toBe(true)
  observation = { status: 'failed', value: provider, failure: new RemoteError('aitp/workspace', 'Disconnected', {
    code: 'not-connected', message: 'Disconnected', retryable: true,
  }) }
  view.rerender(<ResearchWorkflowChoiceControl {...props} />)
  checkbox = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Research' })
  expect(checkbox.checked).toBe(false)
  expect(checkbox.disabled).toBe(true)
  observation = { status: 'live', value: { ...provider, capabilities: { ...provider.capabilities, automaticResearch: false } }, failure: undefined }
  view.rerender(<ResearchWorkflowChoiceControl {...props} />)
  expect(checkbox.disabled).toBe(true)
  expect(store.getSnapshot()).toEqual({ enabledByDefault: false, drafts: { [sessionId]: true, 'another-draft': false } })
  observation = { status: 'live', value: provider, failure: undefined }
  view.rerender(<ResearchWorkflowChoiceControl {...props} />)
  expect(checkbox.checked).toBe(true)
  fireEvent.click(checkbox)
  expect(store.getSnapshot().drafts[sessionId]).toBe(false)
})

it('uses the recorded Global Session mode without an optimistic copy and surfaces retryable change failures', async () => {
  const store = createWorkflowStore().create()
  const location = { global: true, workflow: true, automaticResearch: true, initializing: false }
  let memory: ResourceSnapshot<Pick<SessionMemoryView, 'researchLocation'> | null> = {
    status: 'live', value: { researchLocation: location }, failure: undefined,
  }
  const pending = Promise.withResolvers<undefined>()
  const setMode = vi.fn<(sessionId: SessionId, enabled: boolean) => Promise<void>>()
    .mockReturnValueOnce(pending.promise).mockRejectedValueOnce(new Error('Connection interrupted; retry this change.')).mockResolvedValue(undefined)
  const reads: string[] = []
  const props = { sessionId, t: makeTranslate(en), useStore: bindSnapshotSelector(store), actions: store.actions, setMode,
    useSession: selector => selector(sessionSnapshot(sessionId)),
    useResource: (address) => { reads.push(address); return memory },
  } as ComponentProps<typeof ResearchWorkflowControl>
  const view = render(<ResearchWorkflowControl {...props} />)
  const checkbox = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Research' })
  fireEvent.click(checkbox)
  expect(setMode).toHaveBeenCalledExactlyOnceWith(sessionId, false)
  expect(checkbox.checked).toBe(true)
  expect(checkbox.disabled).toBe(true)
  await act(async () => { pending.resolve(undefined); await pending.promise })
  expect(checkbox.checked).toBe(true)
  expect(store.getSnapshot()).toEqual({ enabledByDefault: true, drafts: {} })
  memory = { ...memory, value: { researchLocation: { ...location, workflow: false } } }
  view.rerender(<ResearchWorkflowControl {...props} />)
  expect(checkbox.checked).toBe(false)
  fireEvent.click(checkbox)
  await waitFor(() => { expect(screen.getByRole('alert').textContent).toContain('Connection interrupted') })
  expect(checkbox.checked).toBe(false)
  expect(checkbox.disabled).toBe(false)
  fireEvent.click(checkbox)
  await waitFor(() => { expect(checkbox.disabled).toBe(false) })
  expect(setMode).toHaveBeenLastCalledWith(sessionId, true)
  expect(screen.queryByRole('alert')).toBeNull()
  memory = { ...memory, value: { researchLocation: { ...location, automaticResearch: false } } }
  view.rerender(<ResearchWorkflowControl {...props} />)
  expect(checkbox.disabled).toBe(true)
  expect(checkbox.checked).toBe(false)
  expect(reads.every(address => address === `dsh-resource://aitp-session/session/${sessionId}`)).toBe(true)
  memory = { status: 'live', value: null, failure: undefined }
  view.rerender(<ResearchWorkflowControl {...props} />)
  expect(screen.queryByRole('checkbox', { name: 'Research' })).toBeNull()
})
