/** New-conversation preference and explicit blank-draft choices; no scientific records live here. */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

interface WorkflowState { enabledByDefault: boolean; drafts: Record<string, boolean> }
type WorkflowActions = {
  choose: (draft: WorkflowState, sessionId: SessionId, enabled: boolean) => void
  capture: (draft: WorkflowState, sessionId: SessionId) => void
}

/**
 * Create persisted Research preferences without scientific data.
 * @returns the native preference store definition.
 */
export function createWorkflowStore(): EngineStoreHandle<WorkflowState, WorkflowActions> {
  return defineStore({
    init: () => ({ enabledByDefault: true, drafts: {} as Record<string, boolean> }),
    persist: 'aitp.research.workflow.v1',
    actions: {
      capture: (draft, sessionId: SessionId) => {
        draft.drafts[sessionId] ??= draft.enabledByDefault
      },
      choose: (draft, sessionId: SessionId, enabled: boolean) => {
        draft.enabledByDefault = enabled
        draft.drafts[sessionId] = enabled
      },
    },
  })
}
