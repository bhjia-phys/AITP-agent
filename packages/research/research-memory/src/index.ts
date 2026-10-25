/** Scoped research sources and conversations exposed through Harness services. */
import { realpath } from 'node:fs/promises'
import { watch, type FSWatcher } from 'node:fs'
import { EventEmitter } from 'node:events'
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Remote, RemoteError, TypertRemoteService, principalOf } from '@deepseek-ai/dsh-typert-protocol'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionQueryError } from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import type {} from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/dsh-workspace'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { MarkdownWorkspace, resourceIdForPath } from './markdown.ts'
import { ResearchChanges } from './changes.ts'
import { ResearchOnboarding } from './onboarding.ts'
import { onboardingFailure } from './onboarding-files.ts'
import { installRuntime } from './runtime.ts'
import { installWriteTools } from './write-tools.ts'
import { createSessionRecovery } from './recovery.ts'
import { buildSessionMemoryView, replaySessionWorkingState } from './session-view.ts'
import type { SessionMemoryView } from './session-view-types.ts'
import type { ResearchOrigin, ResearchContextRead } from './working-types.ts'
import type {
  ActivityPage, ActivityQuery, ApplyReceipt, ApplyRequest, ChangeIntent, ChangePreview,
  ContextQuery, ContextRead, Project, ReadEnvelope, ResearchProvider, ResearchQuestion,
  Resource, ResourceId, Result, Topic, TopicId, TopicPage, TopicQuery,
  ResearchEvent, ResearchSetup, ResearchInitializeRequest, CreateTopicRequest, CreateTopicReceipt,
} from './types.ts'

export type * from './types.ts'

const addressedWorkspace = (request: { workspaceId: WorkspaceId }): WorkspaceId => request.workspaceId
const addressedResearchSession = (request: { sessionId: SessionId }): SessionId => request.sessionId

interface SourceObservation {
  reader: MarkdownWorkspace
  dirty: boolean
  forceNewRevision: boolean
  refreshing: Promise<void> | undefined
  watcher: FSWatcher | undefined
  watchFailure: string | undefined
}

/** One caller may stop waiting without cancelling the refresh shared by other readers. */
async function waitForObservation(refreshing: Promise<void>, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  await new Promise<void>((resolve, reject) => {
    const aborted = (): void => {
      signal.removeEventListener('abort', aborted)
      const reason: unknown = signal.reason
      reject(reason instanceof Error ? reason : new DOMException('Source observation cancelled', 'AbortError'))
    }
    signal.addEventListener('abort', aborted, { once: true })
    void refreshing.then(() => { signal.removeEventListener('abort', aborted); resolve() }, (error: unknown) => {
      signal.removeEventListener('abort', aborted)
      reject(error instanceof Error ? error : new Error(String(error)))
    })
  })
}

/** Explicit host access and bounds for configured research roots. */
export interface Config {
  /** Only these roots can be read through this service. */
  roots?: {
    /** Absolute directory containing the scientific sources. */
    path: string
    /** Explicit identity for headless compositions without a Workspace registry. */
    id?: string
    /** Enable source writes on this configured scratch root; defaults to false. */
    writable?: boolean
    /** Durable operation receipts outside the scientific source tree. */
    stateDirectory?: string
  }[]
  /** Maximum directory entries inspected by discovery, including directories. */
  maxFiles?: number
  /** Maximum UTF-8 bytes read from one source file. */
  maxFileBytes?: number
  /** Maximum complete research-context characters, including labels and omissions. */
  maxContextCharacters?: number
  /** Maximum provisional model items in the current direction. */
  maxWorkingItems?: number
  /** Maximum characters in one provisional item field. */
  maxItemCharacters?: number
  /** Maximum original human inputs included in one request. */
  maxHumanInputs?: number
  /** Maximum characters allocated to original human inputs in one request. */
  maxHumanCharacters?: number
  /** Maximum characters accepted from the question form. */
  maxQuestionCharacters?: number
  /** Maximum UTF-8 bytes in a complete durable operation receipt. */
  maxOperationBytes?: number
  /** Maximum serialized model write-tool result characters. */
  maxResultCharacters?: number
  /** Maximum matching-topic conversations selected for historical delivery. */
  maxRecoverySessions?: number
  /**
   * Maximum records folded for cold topic classification and selected histories per recovery.
   * The query provider may still read a complete cold log before this processing bound applies.
   */
  maxRecoveryEvents?: number
  /** Maximum serialized historical evidence characters before the final request bound. */
  maxRecoveryCharacters?: number
}

type ResolvedConfig = Required<Config>

declare module '@deepseek-ai/cordis' {
  interface Context { researchMemory: ResearchMemory }
}

/** One source adapter per explicitly configured research root. */
export class ResearchMemory extends TypertRemoteService {
  static inject = ['typert', 'agents', 'sessions', 'systemPrompt', 'tools', 'sessionProjections']
  static Config: z<Config, ResolvedConfig> = z.object({
    roots: z.array(z.object({
      path: z.string().required(), id: z.string(), writable: z.boolean().default(false), stateDirectory: z.string(),
    })).default([]),
    maxFiles: z.natural().min(1).default(2000),
    maxFileBytes: z.natural().min(1).default(1_048_576),
    maxContextCharacters: z.natural().min(1024).default(24_000),
    maxWorkingItems: z.natural().min(1).default(32),
    maxItemCharacters: z.natural().min(1).default(2000),
    maxHumanInputs: z.natural().min(1).default(16),
    maxHumanCharacters: z.natural().min(1).default(10_000),
    maxQuestionCharacters: z.natural().min(1).default(8000),
    maxOperationBytes: z.natural().min(1).default(2_097_152),
    maxResultCharacters: z.natural().min(1024).default(12_000),
    maxRecoverySessions: z.natural().min(1).default(24),
    maxRecoveryEvents: z.natural().min(1).default(10_000),
    maxRecoveryCharacters: z.natural().min(1024).default(12_000),
  })

  private readonly readers = new Map<string, SourceObservation>()
  private readonly config: ResolvedConfig
  private readonly changes = new Map<string, ResearchChanges>()
  private readonly notifications = new EventEmitter().setMaxListeners(0)
  private readonly lifetime = new AbortController()
  private readonly onboarding: ResearchOnboarding
  private readonly onboardingOperations = new Set<Promise<void>>()

  /** @param ctx - composed Harness host. @param config - authorized source roots and bounds. */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'researchMemory', { namespace: 'researchMemory' })
    this.config = ResearchMemory.Config(config)
    const homePath = ctx.get('dshHomePath')
    this.onboarding = new ResearchOnboarding(homePath === undefined ? undefined : () => homePath('research-memory'),
      this.config.maxOperationBytes, this.config.maxFileBytes)
    ctx.effect(() => async () => {
      this.lifetime.abort()
      const refreshing: Promise<void>[] = []
      for (const observed of this.readers.values()) {
        observed.watcher?.close()
        observed.watcher = undefined
        if (observed.refreshing !== undefined) refreshing.push(observed.refreshing)
      }
      await Promise.allSettled([...refreshing, ...this.onboardingOperations])
    }, 'research-memory: source observations and admitted onboarding')
    installRuntime(ctx, this.config, (origin, signal) => this.contextFor(origin, signal), createSessionRecovery(ctx, this.config))
    installWriteTools(ctx, {
      maxResultCharacters: this.config.maxResultCharacters,
      resolveTarget: async (origin) => {
        const changes = await this.writer(origin.workspaceId as WorkspaceId)
        if (changes === undefined) return undefined
        const reader = await this.reader(origin.workspaceId as WorkspaceId)
        const provider = await this.provider({ workspaceId: origin.workspaceId as WorkspaceId }, new AbortController().signal)
        return { writer: changes.writer, root: reader.root, writable: provider.capabilities.applyChanges }
      },
      onApplied: async (origin) => {
        const reader = await this.reader(origin.workspaceId as WorkspaceId)
        this.markDirty(reader.root)
      },
    })
  }

  private markDirty(root: string): void {
    const observed = this.readers.get(root)
    if (observed !== undefined) observed.dirty = true
    this.notifications.emit(root)
  }

  private admitOnboarding(): Disposable | undefined {
    if (this.lifetime.signal.aborted) return undefined
    let release: () => void = () => {}
    const settled = new Promise<void>((resolve) => { release = resolve })
    this.onboardingOperations.add(settled)
    return { [Symbol.dispose]: () => {
      this.onboardingOperations.delete(settled)
      release()
    } }
  }

  private stopping(): Result<never> {
    return { ok: false, error: { code: 'unavailable', message: 'The research service is stopping; no new setup operation was admitted.', retryable: true } }
  }

  /** Unavailable configured paths grant no access and do not disable other canonical matches. */
  private async configuredRoots(root: string, signal?: AbortSignal): Promise<ResolvedConfig['roots']> {
    const resolved = await Promise.allSettled(this.config.roots.map(async item => ({ ...item, path: await realpath(item.path) })))
    signal?.throwIfAborted()
    const configured = resolved.flatMap(item => item.status === 'fulfilled' && item.value.path === root ? [item.value] : [])
    if (configured.length > 0) return configured
    const enrolled = await this.onboarding.enrolled(root)
    signal?.throwIfAborted()
    return enrolled === undefined ? [] : [enrolled]
  }

  private async workspaceRoot(workspaceId: WorkspaceId, registered = false): Promise<string> {
    const workspace = this.ctx.get('workspaceRegistry')?.get(workspaceId)
    const path = workspace?.path ?? (registered ? undefined : this.config.roots.find(item => item.id === workspaceId)?.path)
    if (path === undefined) throw new RemoteError('research/workspace-missing', 'The Workspace is unavailable.', {})
    return realpath(path)
  }

  private async reader(workspaceId: WorkspaceId, signal?: AbortSignal, refresh = false): Promise<MarkdownWorkspace> {
    const lifetime = signal === undefined ? this.lifetime.signal : AbortSignal.any([signal, this.lifetime.signal])
    lifetime.throwIfAborted()
    const root = await this.workspaceRoot(workspaceId)
    lifetime.throwIfAborted()
    const allowed = await this.configuredRoots(root, lifetime)
    if (allowed.length === 0) throw new RemoteError('research/root-not-configured', 'This research root has not been configured for access.', {})
    let observed = this.readers.get(root)
    if (observed === undefined) {
      observed = {
        reader: new MarkdownWorkspace({ root, maxFiles: this.config.maxFiles,
          maxFileBytes: this.config.maxFileBytes, maxContextCharacters: this.config.maxContextCharacters }),
        dirty: true, forceNewRevision: false, refreshing: undefined, watcher: undefined, watchFailure: undefined,
      }
      this.readers.set(root, observed)
      const owner = observed
      const failed = (error: unknown): void => {
        owner.watchFailure = `Source notifications are unavailable: ${error instanceof Error ? error.message : String(error)}. Sources will be rescanned on every read.`
        owner.watcher?.close()
        owner.watcher = undefined
        this.markDirty(root)
      }
      try {
        owner.watcher = watch(root, { recursive: true }, () => { this.markDirty(root) })
        owner.watcher.on('error', failed)
      } catch (error: unknown) { failed(error) }
    }
    if (refresh) observed.forceNewRevision = true
    if (refresh || observed.watcher === undefined) observed.dirty = true
    if (observed.refreshing === undefined && observed.dirty) {
      const owner = observed
      owner.refreshing = (async () => {
        while (owner.dirty) {
          this.lifetime.signal.throwIfAborted()
          owner.dirty = false
          const forceNewRevision = owner.forceNewRevision
          owner.forceNewRevision = false
          try {
            const result = await owner.reader.rebuild({ signal: this.lifetime.signal,
              preserveUnchangedRevision: owner.watcher === undefined && !forceNewRevision })
            if (!result.ok) throw new RemoteError('research/refresh-failed', result.error.message, {})
          } catch (error: unknown) {
            owner.dirty = true
            owner.forceNewRevision ||= forceNewRevision
            throw error
          }
        }
      })().finally(() => { owner.refreshing = undefined })
    }
    if (observed.refreshing !== undefined) await waitForObservation(observed.refreshing, lifetime)
    lifetime.throwIfAborted()
    return observed.reader
  }

  private async writer(workspaceId: WorkspaceId): Promise<ResearchChanges | undefined> {
    const reader = await this.reader(workspaceId)
    const configured = (await this.configuredRoots(reader.root))[0]
    if (configured?.stateDirectory === undefined) return undefined
    let changes = this.changes.get(reader.root)
    if (changes === undefined) {
      changes = new ResearchChanges(reader, { writableRoot: reader.root,
        stateDirectory: configured.stateDirectory, maxOperationBytes: this.config.maxOperationBytes }, async () => {
        const current = (await this.configuredRoots(reader.root))[0]
        return current?.writable === true && current.stateDirectory === configured.stateDirectory
      })
      this.changes.set(reader.root, changes)
    }
    return changes
  }

  /**
   * Observe owner setup before any source root has been authorized.
   * @param request - existing Workspace identity, resolved by the host registry.
   * @returns current access and explicit enrollment availability, without reading scientific content.
   */
  @Remote({ name: 'getSetup', resources: { workspace: addressedWorkspace } })
  async getSetup(request: { workspaceId: WorkspaceId }): Promise<Result<ResearchSetup>> {
    this.requireOwner()
    try {
      const root = await this.workspaceRoot(request.workspaceId)
      const allowed = await this.configuredRoots(root)
      const staticRoot = await Promise.allSettled(this.config.roots.map(item => realpath(item.path)))
      const configured = staticRoot.some(item => item.status === 'fulfilled' && item.value === root)
      return { ok: true, value: { configured: allowed.length > 0,
        writable: allowed.some(item => item.writable && item.stateDirectory !== undefined),
        canInitialize: !configured && this.ctx.get('workspaceRegistry')?.get(request.workspaceId) !== undefined
          && await this.onboarding.available(root) } }
    } catch (error) {
      if (error instanceof RemoteError) throw error
      return { ok: false, error: onboardingFailure(error) }
    }
  }

  /**
   * Explicitly enroll a registered Workspace and create its root account only when absent.
   * @param request - Workspace and the owner's chosen source-write authorization.
   * @returns durable setup; configured deployment policy cannot be broadened here.
   */
  @Remote({ name: 'initialize', resources: { workspace: addressedWorkspace } })
  async initialize(request: { workspaceId: WorkspaceId } & ResearchInitializeRequest): Promise<Result<ResearchSetup>> {
    this.requireOwner()
    using operation = this.admitOnboarding()
    if (operation === undefined) return this.stopping()
    const setup = await this.getSetup(request)
    if (!setup.ok) return setup
    if (!setup.value.canInitialize) return { ok: false, error: { code: 'read-only',
      message: 'Research access for this Workspace is controlled by host configuration, or application enrollment is unavailable.', retryable: false } }
    const root = await this.workspaceRoot(request.workspaceId, true)
    const previous = this.changes.get(root)
    const enroll = () => this.onboarding.initialize(root, request)
    const result = previous === undefined ? await enroll() : await previous.writer.serializeSources(enroll)
    if (!result.ok) return result
    this.markDirty(root)
    return { ok: true, value: { configured: true, writable: result.value.writable, canInitialize: true } }
  }

  /**
   * Create a new ordinary topic account and append an explicit parent/child relationship.
   * @param request - Workspace, human-authored opening and stable retry identity.
   * @returns durable source identities, or an honest rejected, partial or unknown outcome.
   */
  @Remote({ name: 'createTopic', resources: { workspace: addressedWorkspace } })
  async createTopic(request: { workspaceId: WorkspaceId } & CreateTopicRequest): Promise<Result<CreateTopicReceipt>> {
    this.requireOwner()
    using operation = this.admitOnboarding()
    if (operation === undefined) return this.stopping()
    const reader = await this.reader(request.workspaceId)
    const allowed = (await this.configuredRoots(reader.root))[0]
    if (!allowed?.writable || allowed.stateDirectory === undefined) return { ok: false, error: {
      code: 'read-only', message: 'Saving topics is disabled for this research root.', retryable: false,
    } }
    const changes = await this.writer(request.workspaceId)
    if (changes === undefined) return { ok: false, error: { code: 'read-only', message: 'This root has no operation storage.', retryable: false } }
    const result = await changes.writer.serializeSources(async (): Promise<Result<CreateTopicReceipt>> => {
      const current = (await this.configuredRoots(reader.root))[0]
      if (!current?.writable || current.stateDirectory === undefined) return { ok: false, error: {
        code: 'read-only', message: 'Saving topics was disabled before publication.', retryable: false,
      } }
      return this.onboarding.create(reader, current.stateDirectory, request)
    })
    if (result.ok || result.error.code === 'partial-apply' || result.error.code === 'outcome-unknown') {
      this.markDirty(reader.root)
      // Source receipts remain authoritative if a derived refresh fails after publication.
      try { await this.reader(request.workspaceId, undefined, true) }
      catch (error) {
        if (!(error instanceof Error)) throw error
        if (!this.lifetime.signal.aborted) this.ctx.logger.warn('Research topic was published; its index needs a refresh.')
      }
    }
    return result
  }

  /**
   * Read provider capabilities for one explicitly configured root.
   * @param request - addressed Workspace; its root must be explicitly configured.
   * @param signal - cancels this caller while shared source refresh remains owned by the service.
   * @returns actual read/write and live-watcher capabilities, with any observation warning.
   */
  @Remote({ name: 'provider', resources: { workspace: addressedWorkspace } })
  async provider(request: { workspaceId: WorkspaceId }, signal: AbortSignal): Promise<ResearchProvider> {
    signal.throwIfAborted()
    const root = await this.workspaceRoot(request.workspaceId)
    const allowed = await this.configuredRoots(root, signal)
    if (allowed.length === 0) {
      this.requireOwner()
      return { id: 'aitp-markdown', origin: 'runtime', capabilities: {
        read: false, readContext: false, readActivity: false, previewChanges: false,
        applyChanges: false, changeEvents: true, commands: [],
      } }
    }
    const reader = await this.reader(request.workspaceId, signal)
    const configured = await this.configuredRoots(reader.root, signal)
    const writable = principalOf(this.ctx.invocation) === undefined
      && configured.some(item => item.writable && item.stateDirectory !== undefined)
    const observed = this.readers.get(reader.root)
    return { id: 'aitp-markdown', origin: 'runtime',
      ...(observed?.watchFailure === undefined ? {} : { notice: observed.watchFailure }), capabilities: {
        read: true, readContext: true, readActivity: false, previewChanges: writable,
        applyChanges: writable, changeEvents: observed?.watcher !== undefined, commands: writable ? ['update-scope', 'record-answer'] : [],
      } }
  }

  /**
   * Read the research overview.
   * @param request - Workspace whose root account is read.
   * @param signal - caller cancellation for source reads.
   * @returns a fresh project observation or a typed source failure.
   */
  @Remote({ name: 'getProject', resources: { workspace: addressedWorkspace } })
  async getProject(request: { workspaceId: WorkspaceId }, signal: AbortSignal): Promise<Result<ReadEnvelope<Project>>> {
    return (await this.reader(request.workspaceId, signal)).getProject({ signal })
  }

  /**
   * Read a bounded page of authored topic relationships.
   * @param request - Workspace and parent/cursor selection.
   * @param signal - caller cancellation for discovery and reads.
   * @returns a bounded topic page with explicit incompleteness or a source failure.
   */
  @Remote({ name: 'listTopics', resources: { workspace: addressedWorkspace } })
  async listTopics(request: { workspaceId: WorkspaceId; query: TopicQuery },
    signal: AbortSignal): Promise<Result<ReadEnvelope<TopicPage>>> {
    return (await this.reader(request.workspaceId, signal)).listTopics(request.query, { signal })
  }

  /**
   * Read one topic from its source.
   * @param request - Workspace and provider-owned topic identity.
   * @param signal - caller cancellation for this read.
   * @returns the current topic account or an explicit unavailable result.
   */
  @Remote({ name: 'getTopic', resources: { workspace: addressedWorkspace } })
  async getTopic(request: { workspaceId: WorkspaceId; topicId: TopicId }, signal: AbortSignal): Promise<Result<ReadEnvelope<Topic>>> {
    return (await this.reader(request.workspaceId, signal)).getTopic(request.topicId, { signal })
  }

  /**
   * Read one material, retaining explicit unavailable content.
   * @param request - Workspace and material identity.
   * @param signal - caller cancellation for this read.
   * @returns source content or its typed missing/unsupported state.
   */
  @Remote({ name: 'getResource', resources: { workspace: addressedWorkspace } })
  async getResource(request: { workspaceId: WorkspaceId; resourceId: ResourceId },
    signal: AbortSignal): Promise<Result<ReadEnvelope<Resource>>> {
    return (await this.reader(request.workspaceId, signal)).getResource(request.resourceId, { signal })
  }

  /**
   * Prepare bounded source material; this is not a model-delivery receipt.
   * @param request - Workspace, topic and requested context bounds.
   * @param signal - caller cancellation for source preparation.
   * @returns complete qualified source units and omissions, or a typed read failure.
   */
  @Remote({ name: 'readContext', resources: { workspace: addressedWorkspace } })
  async readContext(request: { workspaceId: WorkspaceId; query: ContextQuery },
    signal: AbortSignal): Promise<Result<ReadEnvelope<ContextRead>>> {
    return (await this.reader(request.workspaceId, signal)).readContext(request.query, { signal })
  }

  /**
   * Read original inputs, provisional items and recorded context at one immutable Session cut.
   * @param request - existing Session identity; reading never creates an Agent or a conversation.
   * @param signal - cancels observation and configured-root authorization.
   * @returns bounded memory, null for an ordinary unbound Session, or an explicit unavailable result.
   * @throws when the caller is not the owner or the recorded root is outside configured access.
   */
  @Remote({ name: 'getSessionMemory', resources: { session: addressedResearchSession } })
  async getSessionMemory(request: { sessionId: SessionId }, signal: AbortSignal): Promise<Result<SessionMemoryView | null>> {
    this.requireOwner()
    signal.throwIfAborted()
    const query = this.ctx.get('sessionQuery')
    if (query === undefined) return { ok: false, error: { code: 'unsupported', message: 'This host does not provide Session observation.', retryable: false } }
    try {
      using observed = await query.observeSession(request.sessionId, { signal, projectionMode: 'none' })
      const state = replaySessionWorkingState(observed.events)
      if (state.origin === null || !state.ownerOrigin || state.restricted) return { ok: true, value: null }
      await this.reader(state.origin.workspaceId as WorkspaceId, signal)
      const value = buildSessionMemoryView(observed, state, {
        maxItems: this.config.maxWorkingItems + this.config.maxHumanInputs + 8,
        maxCharacters: this.config.maxContextCharacters * 2,
      }, this.ctx.sessions.messageProjections)
      signal.throwIfAborted()
      return { ok: true, value: value ?? null }
    } catch (error) {
      if (signal.aborted) throw error
      if (error instanceof SessionQueryError && error.code === 'SESSION_QUERY_SESSION_NOT_FOUND') {
        return { ok: false, error: { code: 'not-found', message: 'The Session is unavailable.', retryable: false } }
      }
      throw error
    }
  }

  /**
   * Explicitly rescan a root after external edits or a reconnect.
   * @param request - Workspace to invalidate and rebuild.
   * @param signal - cancels this caller without cancelling another reader.
   * @throws if the root is unavailable or the shared rebuild fails.
   */
  @Remote({ name: 'refresh', resources: { workspace: addressedWorkspace } })
  async refresh(request: { workspaceId: WorkspaceId }, signal: AbortSignal): Promise<void> {
    const reader = await this.reader(request.workspaceId, signal, true)
    this.notifications.emit(reader.root)
  }

  /**
   * Every connection begins with a baseline; unenrolled owner feeds carry setup invalidations only.
   * @param request - Workspace whose observations are followed.
   * @param signal - ends the stream and immediately detaches observation listeners.
   * @returns coalesced invalidations; source values must be reread after each one.
   */
  @Remote({ name: 'follow', mode: 'stream', resources: { workspace: addressedWorkspace } })
  async *follow(request: { workspaceId: WorkspaceId }, signal: AbortSignal): AsyncIterable<ResearchEvent> {
    const lifetime = AbortSignal.any([signal, this.lifetime.signal])
    lifetime.throwIfAborted()
    const root = await this.workspaceRoot(request.workspaceId)
    const allowed = await this.configuredRoots(root, lifetime)
    if (allowed.length === 0) this.requireOwner()
    else await this.reader(request.workspaceId, lifetime)
    lifetime.throwIfAborted()
    let dirty = false
    let wake: (() => void) | undefined
    const changed = (): void => { dirty = true; wake?.() }
    const detach = (): void => {
      this.notifications.off(root, changed)
      lifetime.removeEventListener('abort', stopped)
    }
    const stopped = (): void => { changed(); detach() }
    this.notifications.on(root, changed)
    lifetime.addEventListener('abort', stopped, { once: true })
    try {
      lifetime.throwIfAborted()
      yield { kind: 'resync-required', reason: allowed.length === 0 ? 'research-workspace-not-initialized'
        : this.readers.get(root)?.watcher === undefined ? 'automatic-source-notifications-unavailable' : 'connected-or-reconnected' }
      const isAborted = (): boolean => lifetime.aborted
      const hasChanges = (): boolean => dirty
      while (!isAborted()) {
        if (!hasChanges()) await new Promise<void>((resolve) => { wake = resolve })
        wake = undefined
        if (isAborted()) break
        dirty = false
        yield { kind: 'resync-required', reason: this.readers.get(root)?.watcher === undefined
          ? 'automatic-source-notifications-unavailable' : 'source-changed' }
      }
    } finally { detach() }
  }

  /**
   * Unsupported history stays explicit until its durable producer is connected.
   * @param request - Workspace and activity selection, validated without inventing history.
   * @param signal - cancels before activity admission.
   * @returns unsupported; this adapter does not supply an activity feed.
   */
  @Remote({ name: 'getActivity', resources: { workspace: addressedWorkspace } })
  async getActivity(request: { workspaceId: WorkspaceId; query: ActivityQuery },
    signal: AbortSignal): Promise<Result<ReadEnvelope<ActivityPage>>> {
    signal.throwIfAborted()
    await this.reader(request.workspaceId)
    return { ok: false, error: { code: 'unsupported', message: 'Research activity is not available from this source adapter.', retryable: false } }
  }

  /**
   * Prepare a source change; unsupported writing never advertises a successful preview.
   * @param request - Workspace and proposed UI field change.
   * @returns a retained scratch preview or typed refusal; no scientific source is changed.
   * @throws when the caller is not the owner or root access is unavailable.
   */
  @Remote({ name: 'previewChange', resources: { workspace: addressedWorkspace } })
  async previewChange(request: { workspaceId: WorkspaceId; intent: ChangeIntent }): Promise<Result<ReadEnvelope<ChangePreview>>> {
    this.requireOwner()
    const writer = await this.writer(request.workspaceId)
    if (writer !== undefined) return writer.preview(request.intent)
    return { ok: false, error: { code: 'read-only', message: 'Writing is not enabled for this research root.', retryable: false } }
  }

  /**
   * Apply only through the configured writer.
   * @param request - Workspace, preview and durable retry identity.
   * @returns historical publication and separate current observations, or partial/unknown/refused outcome.
   * @throws when the caller is not the owner or root access is unavailable.
   */
  @Remote({ name: 'applyChange', resources: { workspace: addressedWorkspace } })
  async applyChange(request: { workspaceId: WorkspaceId; request: ApplyRequest }): Promise<Result<ReadEnvelope<ApplyReceipt>>> {
    this.requireOwner()
    const writer = await this.writer(request.workspaceId)
    if (writer !== undefined) {
      const result = await writer.apply(request.request, { id: 'host-owner', kind: 'researcher', label: 'Researcher' })
      if (result.ok || result.error.code === 'partial-apply' || result.error.code === 'outcome-unknown') this.notifications.emit((await this.reader(request.workspaceId)).root)
      return result
    }
    return { ok: false, error: { code: 'read-only', message: 'Writing is not enabled for this research root.', retryable: false } }
  }

  /**
   * Submit a human-authored question with its selected topic/material origin.
   * @param request - exact submitted words and the displayed origin.
   * @param signal - cancels before admission; admitted messages remain in their Session.
   * @returns the created normal Session identity or an unresolved-origin/service failure.
   * @throws when the caller is not the owner or the created Session cannot be reached.
   */
  @Remote({ name: 'ask', resources: { workspace: addressedWorkspace } })
  async ask(request: ResearchQuestion, signal: AbortSignal): Promise<Result<{ sessionId: SessionId }>> {
    this.requireOwner()
    signal.throwIfAborted()
    if (request.question.trim() === '' || request.question.length > this.config.maxQuestionCharacters) {
      return { ok: false, error: { code: 'invalid-request', message: 'The question is empty or exceeds the configured limit.', retryable: false } }
    }
    const reader = await this.reader(request.workspaceId)
    if ((request.selectedText?.length ?? 0) > this.config.maxContextCharacters) return { ok: false, error: { code: 'invalid-request', message: 'The selected passage exceeds the configured context limit.', retryable: false } }
    const resolved = await reader.resolveOrigin(request)
    if (!resolved.ok) return resolved
    if (resolved.value.status === 'ambiguous') return { ok: false, error: { code: 'invalid-request', message: resolved.value.reason ?? 'This material serves several topics. Open it from the intended topic before asking.', retryable: false } }
    const selectionMissing = (request.selectedText !== undefined || request.anchor !== undefined || request.selectedRange !== undefined)
      && resolved.value.selectedPassage === undefined
    if (resolved.value.status === 'missing' && (selectionMissing || request.topicId !== undefined || request.resourceId !== undefined && request.resourceId !== resourceIdForPath('research.md'))) return { ok: false, error: { code: 'invalid-request', message: resolved.value.reason ?? 'The selected source has no resolved topic.', retryable: false } }
    const { question, ...selected } = request
    const origin = { ...selected,
      ...(resolved.value.topicId === undefined ? {} : { topicId: resolved.value.topicId }),
      ...(resolved.value.resourceId === undefined ? {} : { resourceId: resolved.value.resourceId }),
      ...(resolved.value.selectedRange === undefined ? {} : { selectedRange: resolved.value.selectedRange }),
    }
    if (JSON.stringify(origin).length > this.config.maxContextCharacters) {
      return { ok: false, error: { code: 'invalid-request', message: 'The complete selected-source location exceeds the configured context limit. Select a smaller passage.', retryable: false } }
    }
    const controller = this.ctx.get('sessionController')
    if (controller === undefined) return { ok: false, error: { code: 'unsupported', message: 'This host does not provide conversation creation.', retryable: false } }
    signal.throwIfAborted()
    const created = await controller.create({ workspaceId: request.workspaceId })
    const agent = this.ctx.agents.get(created.sessionId)
    if (agent === undefined) throw new RemoteError('research/session-unavailable', 'The new conversation is unavailable.', {})
    agent.followup(createUserMessage({ content: [{ type: 'text', text: question }], source: { kind: 'aitp-research', actor: 'human', origin } }))
    return { ok: true, value: { sessionId: created.sessionId } }
  }

  private requireOwner(): void {
    if (principalOf(this.ctx.invocation) !== undefined) throw new RemoteError('research/owner-required', 'Research source writes, conversations and memory views are available to the workspace owner.', {})
  }

  private async contextFor(origin: ResearchOrigin, signal?: AbortSignal): Promise<ResearchContextRead> {
    const reader = await this.reader(origin.workspaceId as WorkspaceId, signal)
    const options = signal === undefined ? undefined : { signal }
    if (origin.topicId === undefined && (origin.resourceId === undefined || origin.resourceId === resourceIdForPath('research.md'))) {
      const root = await reader.readSource(resourceIdForPath('research.md'), options)
      if (!root.ok) return { entries: [], omissions: [root.error.message] }
      const omissions: string[] = []
      if (origin.anchor !== undefined || origin.selectedText !== undefined) {
        const selected = await reader.resolveOrigin({ resourceId: root.value.resourceId,
          ...(origin.anchor === undefined ? {} : { anchor: origin.anchor }),
          ...(origin.selectedTextFormat === undefined ? {} : { selectedTextFormat: origin.selectedTextFormat }),
          ...(origin.selectedRange === undefined ? {} : { selectedRange: origin.selectedRange }),
          ...(origin.selectedText === undefined ? {} : { selectedText: origin.selectedText }), question: '',
        }, options)
        if (!selected.ok) omissions.push(selected.error.message)
        else if (selected.value.selectedPassage === undefined) omissions.push(selected.value.reason ?? 'The original root selection could not be resolved.')
      }
      return { entries: [{ label: 'Research root account', text: root.value.text, source: { target: root.value.resourceId } }], omissions }
    }
    const resolved = await reader.resolveOrigin({
      ...(origin.topicId === undefined ? {} : { topicId: origin.topicId as TopicId }),
      ...(origin.resourceId === undefined ? {} : { resourceId: origin.resourceId as ResourceId }),
      ...(origin.anchor === undefined ? {} : { anchor: origin.anchor }),
      ...(origin.selectedTextFormat === undefined ? {} : { selectedTextFormat: origin.selectedTextFormat }),
      ...(origin.selectedRange === undefined ? {} : { selectedRange: origin.selectedRange }),
      ...(origin.selectedText === undefined ? {} : { selectedText: origin.selectedText }), question: '',
    }, options)
    const omissions = !resolved.ok ? [resolved.error.message] : resolved.value.status === 'resolved' ? []
      : [resolved.value.reason ?? `The original research selection is ${resolved.value.status}.`]
    // The explicit topic can still supply general evidence when its original selection is no longer valid.
    const topicId = origin.topicId as TopicId | undefined ?? (resolved.ok ? resolved.value.topicId : undefined)
    if (topicId === undefined) return { entries: [], omissions: [
      ...omissions, 'No single topic has been selected; resolve the question origin before assuming an owner.',
    ] }
    const read = await reader.readContext({ topicId, include: ['ancestors', 'work', 'resources'], maxCharacters: this.config.maxContextCharacters }, options)
    if (!read.ok) return { entries: [], omissions: [...omissions, read.error.message] }
    return {
      entries: [
        ...(!resolved.ok || resolved.value.status !== 'resolved' || resolved.value.selectedPassage === undefined ? []
          : [{ label: 'Selected source passage', text: resolved.value.selectedPassage, source: { target: resolved.value.resourceId ?? topicId } }]),
        ...read.value.value.entries.map(entry => ({ label: entry.label, text: entry.text, source: { target: entry.source.target.id } })),
      ],
      omissions: [...omissions, ...read.value.value.omissions.map(item => item.reason)],
    }
  }
}

export default ResearchMemory
