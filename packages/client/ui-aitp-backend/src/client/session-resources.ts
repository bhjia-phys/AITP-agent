/** Existing Session subscriptions drive read-only research memory and source-reader resources. */
import type { Context } from '@deepseek-ai/cordis'
import { RemoteError, remoteErrorOf, type RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { ResourceId, SessionMemoryView, WorkspaceError } from '@deepseek-ai/dsh-research-memory/types'
import type { NoteView } from '@deepseek-ai/dsh-client-ui-aitp-research/client'
import type {} from '@deepseek-ai/dsh-client-ui-aitp-session/client'
import type {} from '@deepseek-ai/dsh-client-resources/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionReference } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ResearchRemote } from './adapter.ts'
import type { BackendText } from './locales.ts'

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap {
    /** One Sources & memory resource reader; never creates a Host Agent. */
    researchMemory: unknown
  }
}

function failed<T>(error: WorkspaceError): RemoteResult<T> {
  return { ok: false, error: new RemoteError('aitp/workspace', error.message, error) }
}

/**
 * Reread on an existing owner's invalidation; cancellation immediately releases subscriptions even while yielded.
 * @param read One cancellable authoritative read; null means no research binding at this observation.
 * @param subscribe Existing owner notification channel, returning its disposer.
 * @param signal Final resource holder's lifetime.
 * @returns A live stream retained through null values until the resource holder releases it.
 * @yields Only current-generation values or explicit failures; no optimistic state is stored.
 */
export async function* observedFrames<T>(
  read: (signal: AbortSignal) => Promise<RemoteResult<T>>,
  subscribe: (changed: () => void) => () => void,
  signal: AbortSignal,
): AsyncIterable<RemoteResult<T>> {
  // The owner can abort during any await; each check must reread the live signal.
  const released = (): boolean => signal.aborted
  if (released()) return
  let dirty = true, generation = 0
  let wake: (() => void) | undefined
  let active: AbortController | undefined
  let release: (() => void) | undefined
  const changed = (): void => { dirty = true; generation++; active?.abort(); wake?.() }
  const stop = (): void => { active?.abort(); release?.(); release = undefined; wake?.() }
  release = subscribe(changed)
  signal.addEventListener('abort', stop, { once: true })
  try {
    while (!released()) {
      if (!dirty) await new Promise<void>((resolve) => { wake = resolve })
      wake = undefined
      if (released()) return
      dirty = false
      const observedGeneration = generation
      const controller = new AbortController()
      active = controller
      let abortRead: (() => void) | undefined
      const cancelled = new Promise<undefined>((resolve) => {
        abortRead = () => { resolve(undefined) }
        controller.signal.addEventListener('abort', abortRead, { once: true })
      })
      let result: RemoteResult<T> | undefined
      try { result = await Promise.race([read(controller.signal), cancelled]) } finally {
        if (abortRead !== undefined) controller.signal.removeEventListener('abort', abortRead)
        active = undefined
      }
      if (released()) return
      if (observedGeneration !== generation || result === undefined) continue
      yield result
    }
  } finally {
    stop()
    signal.removeEventListener('abort', stop)
  }
}

function parse(address: string, protocol: string, kind: string): string[] | undefined {
  let url: URL
  try { url = new URL(address) } catch { return undefined }
  if (url.protocol !== 'dsh-resource:' || url.hostname !== protocol || url.search || url.hash) return undefined
  const parts = url.pathname.split('/').slice(1)
  if (parts[0] !== kind) return undefined
  try { return parts.map(decodeURIComponent) } catch { return undefined }
}

/**
 * Register real memory and current-note resources through the framework resource owner.
 * @param ctx Browser context with existing Session, resource, workspace and connection services.
 * @param remote Mounted generated research endpoint face.
 * @param t Locale-owned transport diagnostics.
 */
export function registerSessionResources(ctx: Context, remote: ResearchRemote, t: BackendText): void {
  const connection = ctx.get('connection') as ConnectionHandle
  const invalid = (): RemoteResult<never> => failed({ code: 'invalid-request', message: t('invalidAddress'), retryable: false })
  ctx.effect(() => ctx.resources.register({
    protocol: 'aitp-session',
    async *open(address, { signal }) {
      const parts = parse(address, 'aitp-session', 'session')
      if (parts?.length !== 2 || !parts[1]) { yield invalid(); return }
      const sessionId = parts[1] as SessionId
      let reference: SessionReference | undefined
      const releaseReference = (): void => { reference?.release() }
      try {
        reference = ctx.sessions.retain(sessionId, { source: 'researchMemory', signal })
        signal.addEventListener('abort', releaseReference, { once: true })
        const binding = await reference.ready
        yield* observedFrames<SessionMemoryView | null>(async (readSignal) => {
          const result = await remote.getSessionMemory({ sessionId }, readSignal)
          if (!result.ok) return result
          return result.value.ok ? { ok: true, value: result.value.value } : failed(result.value.error)
        }, (changed) => {
          const eventChanged = (): void => {
            const delta = binding.eventSource.getSnapshot().change
            if (delta.kind !== 'append' || delta.entries.some(entry => entry.type === 'event')) changed()
          }
          const stopEvents = binding.eventSource.subscribe(eventChanged)
          const stopConnection = connection.generation.subscribe(changed)
          return () => { stopEvents(); stopConnection() }
        }, signal)
      } catch (error: unknown) {
        if (!signal.aborted) yield { ok: false, error: remoteErrorOf(error) ?? new RemoteError('aitp/workspace', t('disconnected'), {
          code: 'unavailable', message: t('disconnected'), retryable: true,
        }) }
      } finally {
        signal.removeEventListener('abort', releaseReference)
        reference?.release()
      }
    },
  }), 'ui-aitp-backend: Session memory resource')
  ctx.effect(() => ctx.resources.register({
    protocol: 'aitp-note',
    async *open(address, { signal }) {
      const parts = parse(address, 'aitp-note', 'workspace')
      if (parts?.length !== 4 || !parts[1] || parts[2] !== 'note' || !parts[3]) { yield invalid(); return }
      const workspaceId = parts[1] as WorkspaceId
      const path = parts[3]
      const resourceId = `resource:${encodeURIComponent(path)}` as ResourceId
      yield* observedFrames<NoteView>(async (readSignal) => {
        const adapter = ctx.researchWorkspaces.resolve(workspaceId)
        if (!adapter.ok) return failed(adapter.error)
        const result = await adapter.value.getResource(resourceId, { signal: readSignal })
        if (!result.ok) return failed(result.error)
        const { value, observedAt } = result.value
        if (value.content.kind === 'unavailable') return failed({ code: 'unavailable', message: value.content.detail, retryable: false })
        return { ok: true, value: { origin: 'runtime', path, title: value.title, markdown: value.content.text, observedAt } }
      }, changed => ctx.researchWorkspaces.subscribe(workspaceId, changed), signal)
    },
  }), 'ui-aitp-backend: current Markdown reader')
}
