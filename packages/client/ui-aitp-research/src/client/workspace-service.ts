/** Workspace adapter ownership; content caches remain in the framework resource service. */
import type { Context } from '@deepseek-ai/cordis'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {
  ApplyReceipt, ApplyRequest, ChangeIntent, ChangePreview, ReadEnvelope,
  ResearchEvent, ResearchWorkspaceAdapter, Result,
  ResearchQuestion,
} from './workspace-contract.ts'

/** Factory supplied by a fixture or a separately developed backend transport. */
export type WorkspaceAdapterFactory = (workspaceId: WorkspaceId) => ResearchWorkspaceAdapter

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Workspace-bound research adapters, with no Session creation requirement. */
    researchWorkspaces: ResearchWorkspaceRegistry
  }
}

interface BoundAdapter {
  readonly adapter: ResearchWorkspaceAdapter
  unsubscribe: () => void
  connection: 'connected' | 'disconnected' | 'unsupported'
}

/** One provider owns workspace adapters for its registration lifetime. */
export class ResearchWorkspaceRegistry {
  private factory: WorkspaceAdapterFactory | undefined
  private readonly adapters = new Map<WorkspaceId, BoundAdapter>()
  private readonly listeners = new Map<WorkspaceId, Set<(event: ResearchEvent) => void>>()

  /** @param ctx - plugin context owning provider registration effects. */
  constructor(private readonly ctx: Context) {}

  /**
   * Register the sole adapter factory; late registrations wake existing readers.
   * @param factory - binds an adapter to one Harness Workspace.
   * @returns an idempotent disposer for this provider registration.
   */
  register(factory: WorkspaceAdapterFactory): () => void {
    if (this.factory !== undefined) throw new Error('researchWorkspaces: a provider is already registered')
    const dispose = this.ctx.effect(() => {
      this.factory = factory
      this.notifyAll({ kind: 'resync-required', reason: 'provider-connected' })
      return () => {
        if (this.factory !== factory) return
        this.factory = undefined
        for (const entry of this.adapters.values()) entry.unsubscribe()
        this.adapters.clear()
        this.notifyAll({ kind: 'connection', state: 'disconnected' })
      }
    }, 'researchWorkspaces: provider')
    return () => { void dispose() }
  }

  /**
   * Resolve the current adapter, reporting unavailable connections explicitly.
   * @param workspaceId - Harness Workspace identity.
   * @returns an adapter or a typed connection error.
   */
  resolve(workspaceId: WorkspaceId): Result<ResearchWorkspaceAdapter> {
    if (this.factory === undefined) return { ok: false, error: { code: 'not-connected', message: 'No research workspace provider is connected.', retryable: true } }
    let entry = this.adapters.get(workspaceId)
    if (entry === undefined) {
      const adapter = this.factory(workspaceId)
      if (adapter.workspaceId !== workspaceId) throw new Error('researchWorkspaces: adapter belongs to another Workspace')
      entry = { adapter, unsubscribe: () => {}, connection: 'connected' }
      const bound = entry
      entry.unsubscribe = adapter.subscribeChanges({}, (event) => {
        if (event.kind === 'connection') bound.connection = event.state
        this.notify(workspaceId, event)
      })
      this.adapters.set(workspaceId, entry)
    }
    if (entry.connection !== 'connected') {
      return { ok: false, error: { code: entry.connection === 'unsupported' ? 'unsupported' : 'not-connected', message: 'The research workspace connection is unavailable.', retryable: entry.connection === 'disconnected' } }
    }
    return { ok: true, value: entry.adapter }
  }

  /**
   * Observe invalidations and provider changes; readers own their unsubscribe.
   * @param workspaceId - Harness Workspace identity.
   * @param listener - callback receiving invalidations, never replacement content.
   * @returns the listener disposer.
   */
  subscribe(workspaceId: WorkspaceId, listener: (event: ResearchEvent) => void): () => void {
    let set = this.listeners.get(workspaceId)
    if (set === undefined) {
      set = new Set()
      this.listeners.set(workspaceId, set)
    }
    set.add(listener)
    return () => {
      set.delete(listener)
      if (set.size === 0) this.listeners.delete(workspaceId)
    }
  }

  /**
   * Reread current observations after a user-requested retry.
   * @param workspaceId - Harness Workspace identity.
   */
  retry(workspaceId: WorkspaceId): void {
    this.notify(workspaceId, { kind: 'resync-required', reason: 'requested-refresh' })
  }

  /**
   * Submit a human question with its displayed topic and material selection.
   * @param question - submitted words and current Workspace/topic/material origin.
   * @returns the normal Session identity or a typed connection/unsupported failure.
   */
  async ask(question: ResearchQuestion): Promise<Result<{ readonly sessionId: SessionId }>> {
    const resolved = this.resolve(question.workspaceId)
    if (!resolved.ok) return resolved
    if (resolved.value.ask === undefined) return { ok: false, error: { code: 'unsupported', message: 'Contextual conversations are unavailable from this provider.', retryable: false } }
    return resolved.value.ask(question)
  }

  /**
   * Prepare a change without applying it.
   * @param workspaceId - Harness Workspace identity.
   * @param intent - serializable command and expected source revision.
   * @returns a preview or a typed failure.
   */
  async previewChange(workspaceId: WorkspaceId, intent: ChangeIntent): Promise<Result<ReadEnvelope<ChangePreview>>> {
    const resolved = this.resolve(workspaceId)
    if (!resolved.ok) return resolved
    if (!resolved.value.provider.capabilities.previewChanges) return { ok: false, error: { code: 'read-only', message: 'This provider cannot preview changes.', retryable: false } }
    if (!resolved.value.provider.capabilities.commands.includes(intent.command.kind)) {
      return { ok: false, error: { code: 'unsupported', message: 'This provider does not support the requested command.', retryable: false } }
    }
    return resolved.value.previewChange(intent)
  }

  /**
   * Apply the backend-bound preview; no optimistic local content is published.
   * @param workspaceId - Harness Workspace identity.
   * @param request - preview identity and idempotent operation identity.
   * @returns an authoritative receipt or a typed failure.
   */
  async applyChange(workspaceId: WorkspaceId, request: ApplyRequest): Promise<Result<ReadEnvelope<ApplyReceipt>>> {
    const resolved = this.resolve(workspaceId)
    if (!resolved.ok) return resolved
    if (!resolved.value.provider.capabilities.applyChanges) return { ok: false, error: { code: 'read-only', message: 'This provider cannot apply changes.', retryable: false } }
    return resolved.value.applyChange(request)
  }

  /** Release subscriptions when the owning client plugin unloads. */
  dispose(): void {
    this.factory = undefined
    for (const entry of this.adapters.values()) entry.unsubscribe()
    this.adapters.clear()
    this.listeners.clear()
  }

  private notify(workspaceId: WorkspaceId, event: ResearchEvent): void {
    for (const listener of this.listeners.get(workspaceId) ?? []) listener(event)
  }

  private notifyAll(event: ResearchEvent): void {
    for (const workspaceId of this.listeners.keys()) this.notify(workspaceId, event)
  }
}
