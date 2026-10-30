/** One authenticated resource transport; framework resources own the observed source cache. */
import { RemoteError, type RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {
  ResourceBytes, ResourceError, ResourcePage, ResourceQuery, ResourceReading, ResourceResult, ResourceSetup,
  RootConnection, SaveSourceSetRequest, RemoveSourceSetRequest, SourceLocator, SourceRef, SourceRoot, SourceSet,
  SourceSetId, SourceSetPage, SourceSetQuery, SourceSetReceipt, StudyReceipt, StudyRequest,
} from '@deepseek-ai/dsh-research-resources/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { ResourceDomain } from '@deepseek-ai/dsh-research-resources/types'

/** Operational collections and existing-Workspace grants, never arbitrary filesystem writes. */
export interface MaterialsManagementTransport {
  getSetup(signal: AbortSignal): Promise<ResourceResult<ResourceSetup>>
  connectWorkspace(
    workspaceId: WorkspaceId, signal: AbortSignal, domains?: readonly ResourceDomain[],
  ): Promise<ResourceResult<RootConnection>>
  disconnectWorkspace(workspaceId: WorkspaceId, signal: AbortSignal): Promise<ResourceResult<{ readonly disconnected: boolean }>>
  listSourceSets(query: SourceSetQuery, signal: AbortSignal): Promise<ResourceResult<SourceSetPage>>
  getSourceSet(id: SourceSetId, signal: AbortSignal): Promise<ResourceResult<SourceSet>>
  saveSourceSet(request: SaveSourceSetRequest, signal: AbortSignal): Promise<ResourceResult<SourceSetReceipt>>
  removeSourceSet(request: RemoveSourceSetRequest, signal: AbortSignal): Promise<ResourceResult<SourceSetReceipt>>
}

/** Narrow methods consumed by browser resources and explicit study submission. */
export interface MaterialsTransport {
  readonly management?: MaterialsManagementTransport
  refresh?(signal: AbortSignal): Promise<ResourceResult<true>>
  listRoots(signal: AbortSignal): Promise<ResourceResult<readonly SourceRoot[]>>
  listResources(query: ResourceQuery, signal: AbortSignal): Promise<ResourceResult<ResourcePage>>
  readResource(ref: SourceRef, locator: SourceLocator | undefined, signal: AbortSignal,
    domain?: ResourceDomain): Promise<ResourceResult<ResourceReading>>
  readSourceBytes?(ref: SourceRef, signal: AbortSignal): Promise<ResourceResult<ResourceBytes>>
  askStudy(request: StudyRequest, signal: AbortSignal): Promise<ResourceResult<StudyReceipt>>
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap { 'aitp/materials': ResourceError }
}

/** Reversible connection and invalidation owner; contains no second source index. */
export class MaterialsConnection {
  private transport: MaterialsTransport | undefined
  private readonly listeners = new Set<() => void>()
  private observe: (() => void) | undefined

  constructor(private readonly unavailable: () => string, private readonly report: (error: unknown) => void) {}

  /**
   * Bind one transport until its owning plugin generation leaves.
   * @param transport - authenticated shared resource endpoint.
   * @returns the connection disposer.
   */
  bind(transport: MaterialsTransport): () => void {
    if (this.transport !== undefined) throw new Error('research materials already have a transport')
    this.transport = transport
    this.changed()
    return () => {
      if (this.transport !== transport) return
      this.transport = undefined
      this.changed()
    }
  }

  /** Ask all current resources to reread their owners. */
  changed(): void {
    for (const listener of this.listeners) listener()
  }

  /**
   * Explicit refresh invalidates the source owner's catalog before clients reread.
   * @param signal - owning plugin lifetime.
   */
  async refresh(signal: AbortSignal): Promise<void> {
    await this.run(transport => transport.refresh?.(signal))
    this.changed()
  }

  /**
   * Start source notifications only when a library resource is actually observed.
   * @param start - generation-owned lazy notification startup.
   * @returns disposer preventing later source reads from restarting this generation.
   */
  observeReads(start: () => void): () => void {
    this.observe = start
    if (this.listeners.size > 0) start()
    return () => { if (this.observe === start) this.observe = undefined }
  }

  /**
   * Ask through the same normal Session bridge as other research questions.
   * @param request - human question, explicit scope and selected sources.
   * @param signal - caller-owned cancellation.
   * @returns the normal Session identity or a retained failure.
   */
  async ask(request: StudyRequest, signal: AbortSignal): Promise<ResourceResult<StudyReceipt>> {
    if (this.transport === undefined) return this.disconnected()
    try { return await this.transport.askStudy(request, signal) }
    catch (error) { this.report(error); return this.disconnected() }
  }

  /**
   * Perform an explicit operational action through its owning authenticated generation.
   * @param operation - read or grant/store command; absence of storage stays explicit.
   * @param operationId - stable collection mutation identity, retained when acknowledgement is lost.
   * @returns the owner result or an honest transport-uncertainty outcome.
   */
  async run<T>(
    operation: (transport: MaterialsTransport) => Promise<ResourceResult<T>> | undefined,
    operationId?: string,
  ): Promise<ResourceResult<T>> {
    if (this.transport === undefined) return this.disconnected()
    try {
      const pending = operation(this.transport)
      if (pending === undefined) return { ok: false, error: { code: 'unsupported', message: this.unavailable(), retryable: false } }
      return await pending
    } catch (error) {
      this.report(error)
      if (operationId !== undefined) return { ok: false, error: { code: 'outcome-unknown', message: this.unavailable(), retryable: false, operationId } }
      return this.disconnected()
    }
  }

  /**
   * Emit fresh reads after binding, source invalidation and reconnect.
   * @param signal - framework resource lifetime.
   * @param read - one bounded operation using the active connection.
   * @returns source frames whose previous successful observation is retained by the framework.
   */
  async *frames<T>(
    signal: AbortSignal,
    read: (transport: MaterialsTransport, signal: AbortSignal) => Promise<ResourceResult<T>>,
  ): AsyncIterable<RemoteResult<T>> {
    let generation = 0
    let dirty = true
    let active: AbortController | undefined
    let wake: (() => void) | undefined
    const changed = (): void => { generation += 1; dirty = true; active?.abort(); wake?.() }
    const stop = (): void => { active?.abort(); wake?.() }
    this.listeners.add(changed)
    this.observe?.()
    signal.addEventListener('abort', stop, { once: true })
    try {
      while (!signal.aborted) {
        if (!dirty) await new Promise<void>((resolve) => { wake = resolve })
        wake = undefined
        if (signal.aborted) return
        dirty = false
        const observed = generation
        const transport = this.transport
        if (transport === undefined) { yield failure(this.disconnected().error); continue }
        const controller = new AbortController()
        active = controller
        let cancelled: (() => void) | undefined
        const stopped = new Promise<undefined>((resolve) => {
          cancelled = () => { resolve(undefined) }
          controller.signal.addEventListener('abort', cancelled, { once: true })
        })
        let result: ResourceResult<T> | undefined
        try { result = await Promise.race([read(transport, controller.signal), stopped]) }
        catch (error) {
          if (controller.signal.aborted) continue
          this.report(error)
          result = this.disconnected()
        } finally {
          if (cancelled !== undefined) controller.signal.removeEventListener('abort', cancelled)
          if (active === controller) active = undefined
        }
        if (signal.aborted) return
        if (observed !== generation || result === undefined) continue
        yield result.ok ? { ok: true, value: result.value } : failure(result.error)
      }
    } finally {
      active?.abort()
      this.listeners.delete(changed)
      signal.removeEventListener('abort', stop)
    }
  }

  private disconnected(): { readonly ok: false; readonly error: ResourceError } {
    return { ok: false, error: { code: 'unavailable', message: this.unavailable(), retryable: true } }
  }
}

/**
 * Preserve a domain read failure in the framework resource error channel.
 * @param error - source service rejection.
 * @returns the corresponding resource frame.
 */
export function failure(error: ResourceError): RemoteResult<never> {
  return { ok: false, error: new RemoteError('aitp/materials', error.message, error) }
}
