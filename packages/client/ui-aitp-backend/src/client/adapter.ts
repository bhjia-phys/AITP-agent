import type { ClientRemote, RemoteStream } from '@deepseek-ai/dsh-api-gateway/client'
import { RemoteError, remoteErrorOf, type RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-research-memory/remote'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type {
  ActivityQuery, ApplyRequest, ChangeIntent, ContextQuery, ReadOptions, ResearchEvent,
  ResearchProvider, ResearchQuestion, ResearchWorkspaceAdapter, ResourceId, Result, TopicId, TopicQuery,
  ResearchInitializeRequest, CreateTopicRequest,
} from '@deepseek-ai/dsh-research-memory/types'
import type { BackendText } from './locales.ts'
import { invocationFailure } from './errors.ts'

/** Generated authenticated research endpoint face, including caller-cancellable reads and source notifications. */
export type ResearchRemote = ClientRemote['researchMemory']
/** Injected endpoint and stream supervision services; adapters do not construct an independent transport. */
export interface ResearchTransport {
  readonly researchMemory: ResearchRemote
  readonly $stream: ClientRemote['$stream']
}

/** One workspace's provider observation and logical notification stream. */
export class RuntimeWorkspaceAdapter implements ResearchWorkspaceAdapter {
  private readonly lifetime = new AbortController()
  private readonly listeners = new Set<(event: ResearchEvent) => void>()
  private observedProvider: ResearchProvider | undefined
  private stream: RemoteStream<ResearchEvent> | undefined
  private watching: Promise<void> | undefined
  private closing: Promise<void> | undefined
  private connection: Extract<ResearchEvent, { kind: 'connection' }> = { kind: 'connection', state: 'disconnected' }

  constructor(
    readonly workspaceId: WorkspaceId,
    private readonly transport: ResearchTransport,
    private readonly t: BackendText,
    private readonly reportError: (error: unknown) => void,
  ) {}

  /** Capabilities remain unavailable until the configured host actually reports them. */
  get provider(): ResearchProvider {
    return this.observedProvider ?? {
      id: 'unobserved-research-provider', origin: 'runtime', capabilities: {
        read: false, readContext: false, readActivity: false, previewChanges: false,
        applyChanges: false, changeEvents: false, commands: [],
      },
    }
  }

  getProject(options?: ReadOptions) {
    return this.read(signal => this.transport.researchMemory.getProject({ workspaceId: this.workspaceId }, signal), options)
  }

  getSetup() {
    return this.read(() => this.transport.researchMemory.getSetup({ workspaceId: this.workspaceId }))
  }

  async initialize(request: ResearchInitializeRequest) {
    const result = await this.read(() => this.transport.researchMemory.initialize({ ...request, workspaceId: this.workspaceId }))
    if (result.ok) {
      const stream = this.stream
      this.stream = undefined
      await stream?.dispose()
      await this.watching
      if (this.listeners.size > 0 && !this.lifetime.signal.aborted) this.startFollowing()
      this.publish({ kind: 'resync-required', reason: 'research-workspace-initialized' })
    }
    return result
  }

  async createTopic(request: CreateTopicRequest) {
    const result = await this.read(() => this.transport.researchMemory.createTopic({ ...request, workspaceId: this.workspaceId }),
      undefined, request.operationId)
    if (result.ok || result.error.code === 'partial-apply' || result.error.code === 'outcome-unknown') {
      this.publish({ kind: 'resync-required', reason: 'research-topic-created-or-unresolved' })
    }
    return result
  }

  listTopics(query: TopicQuery, options?: ReadOptions) {
    return this.read(signal => this.transport.researchMemory.listTopics({ workspaceId: this.workspaceId, query }, signal), options)
  }

  getTopic(topicId: TopicId, options?: ReadOptions) {
    return this.read(signal => this.transport.researchMemory.getTopic({ workspaceId: this.workspaceId, topicId }, signal), options)
  }

  getResource(resourceId: ResourceId, options?: ReadOptions) {
    return this.read(signal => this.transport.researchMemory.getResource({ workspaceId: this.workspaceId, resourceId }, signal), options)
  }

  readContext(query: ContextQuery, options?: ReadOptions) {
    return this.read(signal => this.transport.researchMemory.readContext({ workspaceId: this.workspaceId, query }, signal), options)
  }

  getActivity(query: ActivityQuery, options?: ReadOptions) {
    return this.read(signal => this.transport.researchMemory.getActivity({ workspaceId: this.workspaceId, query }, signal), options)
  }

  previewChange(intent: ChangeIntent) {
    return this.read(() => this.transport.researchMemory.previewChange({ workspaceId: this.workspaceId, intent }))
  }

  applyChange(request: ApplyRequest) {
    return this.read(
      () => this.transport.researchMemory.applyChange({ workspaceId: this.workspaceId, request }), undefined, request.operationId,
    )
  }

  ask(question: Omit<ResearchQuestion, 'workspaceId'>) {
    return this.read(signal => this.transport.researchMemory.ask({ ...question, workspaceId: this.workspaceId }, signal))
  }

  /** Subscribers share one reconnecting feed; the adapter owner closes it on provider withdrawal. */
  subscribeChanges(options: { readonly afterEventId?: string }, listener: (event: ResearchEvent) => void): () => void {
    if (this.lifetime.signal.aborted) {
      this.deliver(listener, { kind: 'connection', state: 'disconnected', message: this.t('closed') })
      return () => {}
    }
    this.listeners.add(listener)
    this.deliver(listener, this.connection)
    if (options.afterEventId !== undefined) this.deliver(listener, { kind: 'resync-required', reason: 'notification-history-is-not-replayed' })
    if (this.stream === undefined) this.startFollowing()
    return () => { this.listeners.delete(listener) }
  }

  /** Abort pending calls and await logical stream teardown before the plugin finishes unloading. */
  dispose(): Promise<void> {
    if (this.closing !== undefined) return this.closing
    this.lifetime.abort()
    this.listeners.clear()
    const stream = this.stream
    this.closing = (async () => {
      await stream?.dispose()
      await this.watching
    })()
    return this.closing
  }

  private async read<T>(
    operation: (signal: AbortSignal) => Promise<RemoteResult<Result<T>>>,
    options?: ReadOptions,
    operationId?: string,
  ): Promise<Result<T>> {
    const signal = options?.signal === undefined ? this.lifetime.signal : AbortSignal.any([this.lifetime.signal, options.signal])
    if (isAborted(signal)) return this.cancelled()
    try {
      const result = await operation(signal)
      if (!result.ok) return { ok: false, error: invocationFailure(result.error, this.t, operationId) }
      if (isAborted(signal) && operationId === undefined) return this.cancelled()
      return result.value
    } catch (error) {
      const remote = remoteErrorOf(error)
      if (remote === undefined) throw error
      return { ok: false, error: invocationFailure(remote, this.t, operationId) }
    }
  }

  private startFollowing(): void {
    const name = `research workspace ${this.workspaceId}`
    const stream = this.transport.$stream<ResearchEvent>({
      name,
      open: signal => this.openGeneration(signal),
      ended: accepted => new Error(this.t(accepted ? 'updatesEnded' : 'missingBaseline')),
      carrierFailed: () => { this.publish({ kind: 'connection', state: 'disconnected', message: this.t('disconnected') }) },
    })
    this.stream = stream
    this.watching = (async () => {
      let generation = 0
      try {
        for await (const item of stream) {
          if (this.lifetime.signal.aborted) return
          if (generation !== item.generation) {
            if (item.value.kind !== 'resync-required') throw new RemoteError('gateway/internal', this.t('missingBaseline'), {})
            generation = item.generation
            this.publish({ kind: 'connection', state: 'connected' })
          }
          this.publish(item.value)
          item.accept()
        }
      } catch (error) {
        if (this.lifetime.signal.aborted) return
        const remote = remoteErrorOf(error)
        const failure = remote === undefined ? undefined : invocationFailure(remote, this.t)
        this.publish({ kind: 'connection', state: failure?.code === 'unsupported' ? 'unsupported' : 'disconnected',
          message: failure?.message ?? this.t('disconnected') })
        if (remote === undefined) this.reportError(error)
      }
    })()
  }

  private async *openGeneration(signal: AbortSignal): AsyncIterable<ResearchEvent> {
    const result = await this.transport.researchMemory.provider({ workspaceId: this.workspaceId }, signal)
    if (signal.aborted || this.lifetime.signal.aborted) return
    if (!result.ok) throw result.error
    this.observedProvider = result.value
    for await (const event of this.transport.researchMemory.follow({ workspaceId: this.workspaceId }, signal)) {
      if (event.kind === 'resync-required' && event.reason === 'automatic-source-notifications-unavailable') {
        const current = await this.transport.researchMemory.provider({ workspaceId: this.workspaceId }, signal)
        if (!current.ok) throw current.error
        this.observedProvider = current.value
      }
      yield event
    }
  }

  private cancelled(): Result<never> {
    return { ok: false, error: { code: 'cancelled', message: this.t('cancelled'), retryable: false } }
  }

  private publish(event: ResearchEvent): void {
    if (this.lifetime.signal.aborted) return
    if (event.kind === 'connection') this.connection = event
    for (const listener of this.listeners) this.deliver(listener, event)
  }

  private deliver(listener: (event: ResearchEvent) => void, event: ResearchEvent): void {
    try { listener(event) }
    catch (error) { this.reportError(error) }
  }
}

function isAborted(signal: AbortSignal): boolean { return signal.aborted }
