/**
 * Labelled development fixture for the AITP research views. It registers
 * providers for the `aitp-topics`, `aitp-topic`, `aitp-note` and
 * `aitp-session` protocols, serving the synthetic workspace in `data.ts` and
 * the same demonstration memory for every Session. Every value carries `origin: 'fixture'`,
 * which the views display. The shipped composition keeps this plugin
 * disabled; it exists so the interface can be built and checked before the
 * research runtime supplies these protocols, and it must not be enabled
 * against real research work.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { RemoteError, type RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ResourceProtocol, ResourceProtocolMap } from '@deepseek-ai/dsh-client-resources/client'
import type {} from '@deepseek-ai/dsh-client-ui-aitp-research/client'
import type {} from '@deepseek-ai/dsh-client-ui-aitp-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { NOTES, TOPICS, TOPIC_INDEX, demoMemory } from './data.ts'
import { hold, segmentAfter } from './stream.ts'
import { FixtureWorkspaceAdapter } from './workspace-adapter.ts'

/** Services the providers register on. */
export const inject = ['resources', 'researchWorkspaces']

/**
 * Register one protocol for the plugin's lifetime.
 * @param ctx - plugin context.
 * @param protocol - protocol served.
 * @param read - the frame for an address.
 */
function serve<P extends ResourceProtocol>(
  ctx: ClientContext,
  protocol: P,
  read: (address: string) => RemoteResult<ResourceProtocolMap[P]>,
): void {
  ctx.effect(() => ctx.resources.register<P>({
    protocol,
    open: (address, { signal }) => hold(read(address), signal),
  }), `ui-aitp-fixtures: ${protocol}`)
}

/**
 * Register the fixture providers.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.researchWorkspaces.register(workspaceId => new FixtureWorkspaceAdapter(workspaceId)), 'ui-aitp-fixtures: workspace adapter')
  serve(ctx, 'aitp-topics', () => ({ ok: true, value: TOPIC_INDEX }))
  serve(ctx, 'aitp-topic', (address) => {
    const topicId = segmentAfter(address, 'topic') ?? ''
    const topic = TOPICS[topicId]
    return topic === undefined
      ? { ok: false, error: new RemoteError('aitp/topic-missing', `fixture has no topic "${topicId}"`, { topicId }) }
      : { ok: true, value: topic }
  })
  serve(ctx, 'aitp-note', (address) => {
    const path = segmentAfter(address, 'note') ?? ''
    const note = NOTES[path]
    return note === undefined
      ? { ok: false, error: new RemoteError('aitp/note-missing', `fixture has no note "${path}"`, { path }) }
      : { ok: true, value: note }
  })
  serve(ctx, 'aitp-session', address => ({ ok: true, value: demoMemory((segmentAfter(address, 'session') ?? '') as SessionId) }))
}
