/** Default Research intent crosses the existing native composer through a source-owned transport. */
import type { SessionPromptTransport } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

declare module '@deepseek-ai/cordis' {
  interface Context {
    researchWorkflowTransport: {
      /** Resolve authority on the Host; never accept a browser-controlled filesystem path. */
      readonly submit: (workspaceId: WorkspaceId) => SessionPromptTransport
      /** Record a human mode choice without starting a model turn; Session events refresh its view. */
      readonly setMode: (sessionId: SessionId, enabled: boolean) => Promise<void>
    }
  }
}

/** The viewing owner freezes a new Session's Research choice before asynchronous admission. */
export interface ResearchWorkflowChoice {
  readonly enabled: (sessionId?: SessionId) => boolean
}
