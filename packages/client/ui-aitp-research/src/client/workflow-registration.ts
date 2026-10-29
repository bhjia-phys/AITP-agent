/** Optional backend integration preserves source-specific submission owners and native tool presets. */
import type { Context } from '@deepseek-ai/cordis'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { createWorkflowStore } from './workflow-store.ts'
import { ResearchWorkflowControl, ResearchWorkflowStatus } from './ResearchWorkflow.tsx'
import type { ResearchWorkflowChoice } from './workflow-contract.ts'
import type {} from './workflow-contract.ts'

/**
 * Connect the Research preference to native admission and its existing controls.
 * @param ctx - Research plugin owner.
 * @returns stable capture of one draft's Research preference.
 */
export function registerResearchWorkflow(ctx: Context): ResearchWorkflowChoice {
  const handle = createWorkflowStore()
  const instance = handle.create()
  const store: typeof handle = { ...handle, create: () => instance }
  const enabled: ResearchWorkflowChoice['enabled'] = (sessionId) => {
    if (sessionId === undefined) return instance.getSnapshot().enabledByDefault
    instance.actions.capture(sessionId)
    return instance.getSnapshot().drafts[sessionId] ?? instance.getSnapshot().enabledByDefault
  }
  ctx.inject(['researchWorkflowTransport'], (child) => {
    child.effect(() => child.conversation.submissions.registerFallback('aitp-research-workflow', (sessionId) => {
      if (!enabled(sessionId)) return undefined
      const snapshot = child.sessions.list.getSnapshot().byId[sessionId]
      const workspaces = child.workspaces.list.getSnapshot().items
      const workspace = workspaces.find(item => item.sessionIds.includes(sessionId))
        ?? workspaces.find(item => item.path === snapshot?.cwd)
      if (workspace === undefined) return undefined
      const provider = child.researchWorkspaces.resolve(workspace.workspaceId)
      if (!provider.ok) return () => Promise.resolve({ ok: false, error: new RemoteError('aitp/workspace', provider.error.message, provider.error) })
      if (!provider.value.provider.capabilities.automaticResearch) return undefined
      return child.researchWorkflowTransport.submit(workspace.workspaceId)
    }), 'research: default native composer admission')
    child.slots.inject('conversation.input.dock', () => child.slots.register({ name: 'conversation.input.dock',
      id: 'aitp-research-mode', order: -30, locale: 'aitp.research', store,
      inject: () => ({ setMode: child.researchWorkflowTransport.setMode }),
    }, ResearchWorkflowControl))
    child.slots.inject('conversation.session.header.actions', () => child.slots.register({ name: 'conversation.session.header.actions',
      id: 'aitp-research-mode-status', order: 39, locale: 'aitp.research',
    }, ResearchWorkflowStatus))
  })
  return { enabled }
}
