/** Native prompt admission with only creation and unused binary attachment storage substituted. */
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { MessageSource } from '@deepseek-ai/dsh-llm'
import type { SessionPromptRequest } from '@deepseek-ai/dsh-api-session-controller/types'
import { ApiSessionAgentController } from '@deepseek-ai/dsh-api-session-controller/src/agent.ts'
import { installModelSelectionProjection } from '@deepseek-ai/dsh-api-session-controller/src/model-selection-projection.ts'
import { SessionCommandController } from '@deepseek-ai/dsh-api-session-controller/src/commands.ts'

export function promptAdmission(ctx: Context) {
  installModelSelectionProjection(ctx)
  ctx.provide('attachments', {
    admitPromptContent: async (content: Parameters<Context['attachments']['admitPromptContent']>[0]) => content.map((part) => {
      if (part.type === 'image') throw new Error('Binary image persistence is outside this fixture')
      return part
    }),
  } as never)
  ctx.provide('fileUploads', {
    resolve: () => undefined,
    bindPrompt: () => ({ commit: () => {}, [Symbol.dispose]: () => {} }),
  } as never)
  const agents = new ApiSessionAgentController(ctx)
  const commands = new SessionCommandController(ctx, agents, '/unused-creation-default')
  return {
    resolveAgent: agents.resolveAgent.bind(agents),
    promptAttributed: (request: SessionPromptRequest, source: MessageSource, guard: (agent: Agent) => void) =>
      commands.prompt(request, source, guard),
  }
}
