/** Bind research views to the authenticated Harness research service. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import researchMemoryRemote from '@deepseek-ai/dsh-research-memory/remote'
import type {} from '@deepseek-ai/dsh-client-ui-aitp-research/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { RuntimeWorkspaceAdapter } from './adapter.ts'
import { en, zh } from './locales.ts'
import { registerSessionResources } from './session-resources.ts'

export const inject = ['remote', 'researchWorkspaces', 'locale', 'resources', 'sessions', 'connection']

/**
 * Mount the generated research namespace, then register its workspace provider.
 * @param ctx - browser context with the Remote mount service, workspace registry and locale.
 * @returns disposer that stops adapters before withdrawing their generated endpoint namespace.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  ctx.effect(() => ctx.locale.register('aitp.backend', { en, zh }), 'ui-aitp-backend: dictionaries')
  const unmount = await ctx.remote.$mount(researchMemoryRemote)
  const provider = ctx.inject(['remote.researchMemory'], bindWorkspaceProvider)
  return async () => {
    await provider.dispose()
    await unmount()
  }
}

/** Consume the namespace only after this plugin's generated contribution has made it available. */
function bindWorkspaceProvider(ctx: Context): void {
  const t = ctx.locale.bind('aitp.backend')
  const { remote } = ctx
  const { researchMemory } = remote
  registerSessionResources(ctx, researchMemory, t)
  const releaseWorkflow = ctx.reflect.provide('researchWorkflowTransport', {
    submit: workspaceId => (request, signal) => researchMemory.promptWorkflow({ ...request, workspaceId }, signal),
    setMode: async (sessionId, enabled) => {
      const result = await researchMemory.setResearchMode({ sessionId, enabled })
      if (!result.ok) throw result.error
    },
  } satisfies Context['researchWorkflowTransport'])
  ctx.effect(() => releaseWorkflow, 'ui-aitp-backend: default Research transport')
  const transport = { researchMemory, $stream: remote.$stream.bind(remote) }
  ctx.effect(() => {
    const adapters = new Set<RuntimeWorkspaceAdapter>()
    const unregister = ctx.researchWorkspaces.register((workspaceId: WorkspaceId) => {
      const adapter = new RuntimeWorkspaceAdapter(workspaceId, transport, t, (error) => { ctx.logger.error(error) })
      adapters.add(adapter)
      return adapter
    })
    return async () => {
      unregister()
      await Promise.all([...adapters].map(adapter => adapter.dispose()))
      adapters.clear()
    }
  }, 'ui-aitp-backend: runtime provider')
}
